// marketAnalyzer.js

require('dotenv').config();
const axios = require('axios');
const { RSI, SMA, EMA, MACD, BollingerBands } = require('technicalindicators');
const googleTrends = require('google-trends-api');
const Sentiment = require('sentiment');
const cron = require('node-cron');
const connection = require('../config/database'); // Adjust path as needed

// Initialize sentiment analyzer
const sentimentAnalyzer = new Sentiment();

// ---------------------------
// Configuration Parameters
// ---------------------------
const config = {
  rsiPeriod: 7,
  overbought: 70,
  oversold: 30,
  bollingerStdDev: 2,
  emaPeriod: 21,
  priceActionThreshold: 0.02, // 2%
  volumeThreshold: 1.2,
  // Crash Opportunity criteria
  crashRSIThreshold: 30,       // RSI below this indicates oversold conditions
  crashBandMultiplier: 1.05    // Price within 5% above lower Bollinger band considered near oversold
};

// ---------------------------
// Database: Fetch Top Coins
// ---------------------------
async function fetchTopCoinsFromDatabase() {
  try {
    const [rows] = await connection.execute('SELECT symbol FROM top_25_crypto_coins');
    return rows.map(row => row.symbol);
  } catch (error) {
    console.error('Database query error:', error.message);
    throw error;
  }
}

// ---------------------------
// Price Data: Fetch Historical Prices
// ---------------------------
/**
 * Fetches the last 100 1-hour closing prices for the given coin from Binance.
 * @param {string} coin - The coin symbol (e.g., BTC)
 * @returns {Promise<number[]>} Array of closing prices.
 */
async function fetchPrices(coin) {
  try {
    const formattedSymbol = `${coin.toUpperCase()}USDT`;
    const url = `https://api.binance.com/api/v3/klines?symbol=${formattedSymbol}&interval=1h&limit=100`;
    const response = await axios.get(url);
    return response.data.map(candle => parseFloat(candle[4])); // using the closing price
  } catch (error) {
    console.error(`Error fetching prices for ${coin}:`, error.response?.data?.msg || error.message);
    return [];
  }
}

// ---------------------------
// Trends Data: Fetch Google Trends Data
// ---------------------------
/**
 * Fetches Google Trends data for the given coin using a keyword query.
 * @param {string} coin - The coin symbol.
 * @returns {Promise<number[]>} Array of trend values.
 */
async function fetchCoinTrends(coin) {
  try {
    const keyword = `${coin} cryptocurrency`;
    const results = await googleTrends.interestOverTime({ keyword, geo: 'US' });
    const data = typeof results === 'string' ? JSON.parse(results) : results;
    const timelineData = data.default.timelineData || [];
    if (timelineData.length === 0) {
      console.log(`No trends data found for ${coin}`);
      return [];
    }
    return timelineData.map(entry => entry.value[0]);
  } catch (error) {
    console.error(`Error fetching trends for ${coin}:`, error.message);
    return [];
  }
}

// ---------------------------
// Sentiment Analysis
// ---------------------------
/**
 * Computes a simple sentiment score based on trends data.
 * @param {number[]} trends - Array of trend values.
 * @returns {number} Normalized sentiment score.
 */
async function analyzeSentiment(trends) {
  if (!trends.length) return 0;
  // Assign +1 if trend value > 50, -1 if < 50, and 0 if exactly 50.
  const scores = trends.map(val => (val > 50 ? 1 : val < 50 ? -1 : 0));
  return scores.reduce((acc, cur) => acc + cur, 0) / scores.length;
}

// ---------------------------
// Technical Indicators Calculation
// ---------------------------
/**
 * Calculates various technical indicators for the given coin.
 * @param {string} coin - The coin symbol.
 * @returns {Promise<Object|null>} Object containing indicators or null if insufficient data.
 */
async function calculateIndicatorsForCoin(coin) {
  const prices = await fetchPrices(coin);
  if (prices.length < 20) {
    console.log(`Not enough data to calculate indicators for ${coin}`);
    return null;
  }
  return {
    rsi: RSI.calculate({ period: config.rsiPeriod, values: prices }).slice(-1)[0],
    sma: SMA.calculate({ period: 20, values: prices }).slice(-1)[0],
    ema: EMA.calculate({ period: config.emaPeriod, values: prices }).slice(-1)[0],
    macd: MACD.calculate({
      values: prices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9
    }).slice(-1)[0],
    bollingerBands: BollingerBands.calculate({
      period: 20,
      values: prices,
      stdDev: config.bollingerStdDev
    }).slice(-1)[0],
    lastPrice: prices[prices.length - 1]
  };
}

// ---------------------------
// Crash Opportunity Checker
// ---------------------------
/**
 * Determines whether an asset appears oversold and could be a "crash opportunity".
 * @param {Object} indicators - Technical indicators for the coin.
 * @returns {boolean} True if the asset is in oversold territory.
 */
function isCrashOpportunity(indicators) {
  if (!indicators || !indicators.bollingerBands) return false;
  const nearLowerBand = indicators.lastPrice <= indicators.bollingerBands.lower * config.crashBandMultiplier;
  return indicators.rsi < config.crashRSIThreshold && nearLowerBand;
}

// ---------------------------
// Trend Prediction
// ---------------------------
/**
 * Predicts market trend based on technical indicators.
 * @param {Object} indicators - Object containing technical indicators.
 * @returns {string} 'Bullish', 'Bearish', or 'Neutral'
 */
function predictFutureTrend(indicators) {
  const { rsi, ema, sma, macd, bollingerBands, lastPrice } = indicators;
  if (rsi < config.oversold || ema > sma || lastPrice < bollingerBands.lower || (macd && macd.histogram > 0)) {
    return 'Bullish';
  }
  if (rsi > config.overbought || ema < sma || lastPrice > bollingerBands.upper || (macd && macd.histogram < 0)) {
    return 'Bearish';
  }
  return 'Neutral';
}

// ---------------------------
// Main Market Analysis Function
// ---------------------------
/**
 * Analyzes market conditions across a list of coins.
 * Returns only the top bullish coin and top bearish coin along with overall summary.
 * @param {string[]} coins - Array of coin symbols.
 * @returns {Promise<Object>} Summary object.
 */
async function analyzeMarketTrend(coins) {
  const trendData = { totalCoins: 0, bullishCoins: 0, bearishCoins: 0, averageRSI: 0, averageSentiment: 0 };
  let totalRSI = 0;
  let totalSentiment = 0;
  let count = 0;
  let bullishCoin = null;
  let bearishCoin = null;

  for (const coin of coins) {
    console.log(`Analyzing ${coin}...`);
    const indicators = await calculateIndicatorsForCoin(coin);
    if (!indicators) continue;

    const trends = await fetchCoinTrends(coin);
    const sentimentScore = await analyzeSentiment(trends);
    const futureTrend = predictFutureTrend(indicators);
    const crashOpportunity = isCrashOpportunity(indicators);

    trendData.totalCoins++;
    totalRSI += indicators.rsi;
    totalSentiment += sentimentScore;
    if (futureTrend === 'Bullish') trendData.bullishCoins++;
    if (futureTrend === 'Bearish') trendData.bearishCoins++;

    // Choose representative coins:
    // For bullish, we choose the coin with the lowest RSI (oversold)
    if (!bullishCoin || indicators.rsi < bullishCoin.indicators.rsi) {
      bullishCoin = { coin, indicators, sentimentScore, trend: futureTrend, crashOpportunity };
    }
    // For bearish, we choose the coin with the highest RSI (overbought)
    if (!bearishCoin || indicators.rsi > bearishCoin.indicators.rsi) {
      bearishCoin = { coin, indicators, sentimentScore, trend: futureTrend, crashOpportunity };
    }

    count++;
  }

  trendData.averageRSI = count ? totalRSI / count : 0;
  trendData.averageSentiment = count ? totalSentiment / count : 0;
  trendData.marketTrend =
    trendData.bullishCoins > trendData.bearishCoins ? 'Bullish' :
    trendData.bullishCoins < trendData.bearishCoins ? 'Bearish' : 'Neutral';

  const summary = {
    totalCoins: coins.length,
    averageRSI: trendData.averageRSI,
    averageSentiment: trendData.averageSentiment,
    overallTrend: trendData.marketTrend,
    topBullishCoin: bullishCoin,
    topBearishCoin: bearishCoin
  };

  console.log('Market Analysis Summary:');
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

// ---------------------------
// Scheduled Analysis
// ---------------------------
// Run market analysis every minute
// cron.schedule('*/1 * * * *', async () => {
//   try {
//     const coins = await fetchTopCoinsFromDatabase();
//     await analyzeMarketTrend(coins);
//   } catch (error) {
//     console.error('Scheduled market analysis error:', error.message);
//   }
// });

// // Also run analysis immediately when the script is executed
// (async () => {
//   try {
//     const coins = await fetchTopCoinsFromDatabase();
//     await analyzeMarketTrend(coins);
//   } catch (error) {
//     console.error('Error running market analysis:', error.message);
//   }
// })();

module.exports = { analyzeMarketTrend, fetchTopCoinsFromDatabase, fetchPrices };
