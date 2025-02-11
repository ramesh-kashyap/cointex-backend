require('dotenv').config();

const axios = require('axios');
const { RSI, SMA, EMA, MACD, BollingerBands } = require('technicalindicators');
const googleTrends = require('google-trends-api');
const Sentiment = require('sentiment');
const connection = require('../config/database');

const sentiment = new Sentiment();

// Set dynamic parameters
const rsiPeriod = 7;
const overboughtThreshold = 70;
const oversoldThreshold = 30;
const bollingerBandsStdDev = 2;
const priceActionThreshold = 0.02;
const volumeIncreaseThreshold = 1.2;
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

// Fetch historical price data
async function fetchPrices(coin) {
  try {
    const formattedSymbol = `${coin.toUpperCase()}USDT`;
    const url = `https://api.binance.com/api/v3/klines?symbol=${formattedSymbol}&interval=1h&limit=100`;
    const response = await axios.get(url);
    return response.data.map(kline => parseFloat(kline[4])); 
  } catch (error) {
    console.error(`Error fetching prices for ${coin}:`, error.response?.data?.msg || error.message);
    return [];
  }
}

// Fetch Google Trends data
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

// Analyze sentiment
async function analyzeSentiment(trends) {
  if (trends.length === 0) return 0;
  const sentimentScores = trends.map(score => (score > 50 ? 1 : (score < 50 ? -1 : 0)));
  return sentimentScores.reduce((acc, score) => acc + score, 0) / sentimentScores.length;
}

// Analyze price action
function analyzePriceAction(pricesData) {
  if (!Array.isArray(pricesData) || pricesData.length < 2) {
    console.log('Price data is invalid or insufficient');
    return { isBullish: false, isBearish: false };
  }

  const isBullish = pricesData[pricesData.length - 1] > pricesData[pricesData.length - 2] * (1 + priceActionThreshold);
  const isBearish = pricesData[pricesData.length - 1] < pricesData[pricesData.length - 2] * (1 - priceActionThreshold);

  return { isBullish, isBearish };
}

// Predict future trend
function predictFutureTrend(pricesData, indicators) {
  if (!pricesData || pricesData.length < 2) {
    console.log('Not enough data for prediction');
    return 'Neutral';
  }

  const { rsi, ema, sma, macd, bollingerBands, lastPrice } = indicators;

  const isBullish =
    rsi < oversoldThreshold || ema > sma || lastPrice < bollingerBands.lower || macd.histogram > 0;

  const isBearish =
    rsi > overboughtThreshold || ema < sma || lastPrice > bollingerBands.upper || macd.histogram < 0;

  if (isBullish) return 'Bullish';
  if (isBearish) return 'Bearish';
  return 'Neutral';
}

// Calculate technical indicators
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
    macd: MACD.calculate({ values: prices, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }).slice(-1)[0],
    bollingerBands: BollingerBands.calculate({ period: 20, values: prices, stdDev: bollingerBandsStdDev }).slice(-1)[0],
    lastPrice: prices.slice(-1)[0]
  };
}

// Analyze market trend
async function analyzeMarketTrend(coins) {
  const trendData = { totalCoins: 0, bullishCoins: 0, bearishCoins: 0, averageRSI: 0, averageSentiment: 0 };
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
    
    if (indicators && pricesData.length > 0) {
      const futureTrend = predictFutureTrend(pricesData, indicators);
      trendData.totalCoins++;
      rsiValues.push(indicators.rsi);
      sentimentValues.push(sentimentScore);

      if (futureTrend === 'Bullish') trendData.bullishCoins++;
      if (futureTrend === 'Bearish') trendData.bearishCoins++;

      if (!bullishCoin || indicators.rsi < bullishCoin.rsi) bullishCoin = { coin, indicators, sentimentScore };
      if (!bearishCoin || indicators.rsi > bearishCoin.rsi) bearishCoin = { coin, indicators, sentimentScore };
    }
  }

  trendData.averageRSI = rsiValues.reduce((acc, val) => acc + val, 0) / rsiValues.length;
  trendData.averageSentiment = sentimentValues.reduce((acc, val) => acc + val, 0) / sentimentValues.length;

  trendData.marketTrend = trendData.bullishCoins > trendData.bearishCoins ? 'Bullish' :
                          trendData.bullishCoins < trendData.bearishCoins ? 'Bearish' : 'Neutral';

  return { trendData, bullishCoin, bearishCoin };
}

module.exports = { analyzeMarketTrend, fetchTopCoinsFromDatabase, fetchPrices };
