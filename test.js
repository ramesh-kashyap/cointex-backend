require('dotenv').config(); // Load environment variables
const axios = require('axios');
const { RSI, SMA, EMA, MACD, BollingerBands } = require('technicalindicators');
const googleTrends = require('google-trends-api');
const Sentiment = require('sentiment');
const connection = require('../cointex-backend/src/config/database');

// Initialize sentiment analysis tool
const sentiment = new Sentiment();

// Set dynamic parameters
const rsiPeriod = 7;
const overboughtThreshold = 70;
const oversoldThreshold = 30;
const bollingerBandsStdDev = 2;
const priceActionThreshold = 0.02;
const volumeIncreaseThreshold = 1.2; // Volume threshold for bullish trends
const emaPeriod = 21;

// Fetch top coins from the database
async function fetchTopCoinsFromDatabase() {
  try {
    const [rows] = await connection.execute('SELECT symbol FROM top_25_crypto_coins');
    return rows.map(row => row.symbol);
  } catch (error) {
    console.error('Database query error:', error.message);
    throw error;
  }
}

// Fetch historical price data for a coin
async function fetchPrices(coin) {
  try {
    const formattedSymbol = `${coin.toUpperCase()}USDT`;
    const url = `https://api.binance.com/api/v3/klines?symbol=${formattedSymbol}&interval=1h&limit=100`;
    const response = await axios.get(url);
    return response.data.map(kline => parseFloat(kline[4])); // Extract closing prices
  } catch (error) {
    console.error(`Error fetching prices for ${coin}:`, error.response?.data?.msg || error.message);
    return [];
  }
}

// Fetch Google Trends data for a coin
async function fetchCoinTrends(coin) {
  try {
    const searchQuery = `${coin} cryptocurrency`;
    const results = await googleTrends.interestOverTime({ keyword: searchQuery, geo: 'US' });

    let trendsData = results;
    if (typeof results === 'string') {
      trendsData = JSON.parse(results).default.timelineData;
    } else {
      trendsData = results.default.timelineData;
    }

    if (!trendsData || trendsData.length === 0) {
      console.log(`No trends data found for ${coin}`);
      return [];
    }

    return trendsData.map(entry => entry.value[0]);
  } catch (error) {
    console.error(`Error fetching Google Trends data for ${coin}:`, error.message);
    return [];
  }
}

// Analyze sentiment based on Google Trends data
async function analyzeSentiment(trends) {
  if (trends.length === 0) return 0;

  const sentimentScores = trends.map(score => (score > 50 ? 1 : (score < 50 ? -1 : 0)));
  const weightedSentiment = sentimentScores.reduce((acc, score, index) => acc + score * (index + 1), 0) / sentimentScores.length;
  return weightedSentiment;
}

// Analyze volume for bullish or bearish trends
function analyzeVolume(pricesData, volumeData) {
  if (!Array.isArray(volumeData) || volumeData.length === 0) {
    console.log('Volume data is invalid or empty');
    return { isBullish: false, isBearish: false };
  }

  // Check if volume has increased above the threshold
  const isBullish = volumeData[volumeData.length - 1] > volumeData[volumeData.length - 2] * volumeIncreaseThreshold;
  const isBearish = !isBullish;

  return { isBullish, isBearish };
}

// Analyze price action for bullish or bearish trends
function analyzePriceAction(pricesData) {
  if (!Array.isArray(pricesData) || pricesData.length < 2) {
    console.log('Price data is invalid or insufficient');
    return { isBullish: false, isBearish: false };
  }

  const isBullish = pricesData[pricesData.length - 1] > pricesData[pricesData.length - 2] * (1 + priceActionThreshold);
  const isBearish = pricesData[pricesData.length - 1] < pricesData[pricesData.length - 2] * (1 - priceActionThreshold);

  return { isBullish, isBearish };
}

// Predict the future trend (1 hour ahead)
function predictFutureTrend(pricesData, indicators) {
  if (!pricesData || pricesData.length < 2) {
    console.log('Not enough data for prediction');
    return 'Neutral';
  }

  const { rsi, ema, sma, macd, bollingerBands, lastPrice } = indicators;

  const isBullish =
    rsi < oversoldThreshold || 
    ema > sma || 
    lastPrice < bollingerBands.lower || 
    macd.histogram > 0;

  const isBearish =
    rsi > overboughtThreshold || 
    ema < sma || 
    lastPrice > bollingerBands.upper || 
    macd.histogram < 0;

  if (isBullish) {
    return 'Bullish';
  } else if (isBearish) {
    return 'Bearish';
  } else {
    return 'Neutral';
  }
}

// Calculate technical indicators for a given coin
async function calculateIndicatorsForCoin(coin) {
  const prices = await fetchPrices(coin);
  if (prices.length < 20) {
    console.log(`Not enough data to calculate indicators for ${coin}`);
    return null;
  }

  return {
    rsi: RSI.calculate({ period: rsiPeriod, values: prices }).slice(-1)[0],
    sma: SMA.calculate({ period: 20, values: prices }).slice(-1)[0],
    ema: EMA.calculate({ period: emaPeriod, values: prices }).slice(-1)[0],
    macd: MACD.calculate({
      values: prices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    }).slice(-1)[0],
    bollingerBands: BollingerBands.calculate({
      period: 20,
      values: prices,
      stdDev: bollingerBandsStdDev,
    }).slice(-1)[0],
    lastPrice: prices.slice(-1)[0],
    volume: prices.length > 0 ? prices.map(() => Math.random() * 100) : [] // Dummy volume data for example
  };
}

// Analyze market trend and classify coins based on multiple indicators
async function analyzeMarketTrend(coins) {
  const trendData = {
    totalCoins: 0,
    bullishCoins: 0,
    bearishCoins: 0,
    averageRSI: 0,
    averageSentiment: 0,
  };

  const rsiValues = [];
  const sentimentValues = [];
  let bullishCoin = null;
  let bearishCoin = null;

  for (const coin of coins) {
    console.log(`Analyzing ${coin}...`);

    const indicators = await calculateIndicatorsForCoin(coin);
    const pricesData = await fetchPrices(coin);
    const trends = await fetchCoinTrends(coin);
    const sentimentScore = await analyzeSentiment(trends);

    // Analyze volume and price action
    const volumeAnalysis = analyzeVolume(pricesData, indicators.volume); // Volume analysis now includes the threshold
    const priceActionAnalysis = analyzePriceAction(pricesData);
    console.log

    if (indicators && pricesData.length > 0) {
      const { rsi, ema, sma, lastPrice, bollingerBands, macd, volume } = indicators;

      trendData.totalCoins++;
      rsiValues.push(rsi);
      sentimentValues.push(sentimentScore);

      const futureTrend = predictFutureTrend(pricesData, indicators);

      // Check bullish/bearish conditions based on all indicators
      if (futureTrend === 'Bullish' || volumeAnalysis.isBullish || priceActionAnalysis.isBullish) {
        trendData.bullishCoins++;
      } else if (futureTrend === 'Bearish' || volumeAnalysis.isBearish || priceActionAnalysis.isBearish) {
        trendData.bearishCoins++;
      }

      if (!bullishCoin || rsi < bullishCoin.rsi) {
        bullishCoin = { coin, rsi, sentimentScore, futureTrend, volumeAnalysis, priceActionAnalysis };
      }
      if (!bearishCoin || rsi > bearishCoin.rsi) {
        bearishCoin = { coin, rsi, sentimentScore, futureTrend, volumeAnalysis, priceActionAnalysis };
      }
    }
  }

  trendData.averageRSI = rsiValues.reduce((acc, val) => acc + val, 0) / rsiValues.length;
  trendData.averageSentiment = sentimentValues.reduce((acc, val) => acc + val, 0) / sentimentValues.length;

  trendData.marketTrend =
    trendData.bullishCoins > trendData.bearishCoins
      ? 'Bullish'
      : trendData.bullishCoins < trendData.bearishCoins
      ? 'Bearish'
      : 'Neutral';

  return { trendData, bullishCoin, bearishCoin };
}

// Main function to run the analysis
async function findBullishBearishAndMarketTrend() {
  try {
    console.log('Fetching top coins from the database...');
    const coins = await fetchTopCoinsFromDatabase();
    if (!coins.length) return console.log('No coins found in the database.');

    console.log('Analyzing market trend and classifying coins...');
    const { trendData, bullishCoin, bearishCoin } = await analyzeMarketTrend(coins);

    console.log('--- Analysis Results ---');
    console.log('Market Trend:', trendData.marketTrend);
    console.log('Bullish Coins:', trendData.bullishCoins);
    console.log('Bearish Coins:', trendData.bearishCoins);
    console.log('Average RSI:', trendData.averageRSI.toFixed(2));
    console.log('Average Sentiment:', trendData.averageSentiment.toFixed(2));

    if (bullishCoin) {
      console.log('Most Bullish Coin:', bullishCoin.coin);
      console.log('Bullish Indicators:', bullishCoin);
      console.log('1-Hour Future Trend: Bullish');
    }

    if (bearishCoin) {
      console.log('Most Bearish Coin:', bearishCoin.coin);
      console.log('Bearish Indicators:', bearishCoin);
      console.log('1-Hour Future Trend: Bearish');
    }
  } catch (error) {
    console.error('Error during analysis:', error.message);
  }
}

console.log('Running trading bot...');
findBullishBearishAndMarketTrend();
module.exports = {
  analyzeMarketTrend,
  fetchTopCoinsFromDatabase,
  fetchPrices,
};