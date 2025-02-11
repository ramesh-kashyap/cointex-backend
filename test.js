require('dotenv').config();
const axios = require('axios');
const { RSI, SMA, EMA, MACD, BollingerBands } = require('technicalindicators');
const googleTrends = require('google-trends-api');
const Sentiment = require('sentiment');
const connection = require('../cointex-backend/src/config/database');
const cron = require('node-cron');
const sentiment = new Sentiment();

// Dynamic Parameters
const config = {
    rsiPeriod: 7,
    overbought: 70,
    oversold: 30,
    bollingerStdDev: 2,
    priceThreshold: 0.02,
    volumeThreshold: 1.2,
    emaPeriod: 21
};

// Fetch Top Coins
async function fetchTopCoins() {
    try {
        const [rows] = await connection.execute('SELECT symbol FROM top_25_crypto_coins');
        return rows.map(row => row.symbol);
    } catch (error) {
        console.error('Database error:', error.message);
        return [];
    }
}

// Fetch Prices
async function fetchPrices(symbol) {
    try {
        const response = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}USDT&interval=1h&limit=100`);
        return response.data.map(kline => parseFloat(kline[4]));
    } catch (error) {
        console.error(`Price fetch error (${symbol}):`, error.message);
        return [];
    }
}

// Google Trends Data
async function fetchTrends(coin) {
    try {
        const results = await googleTrends.interestOverTime({ keyword: `${coin} cryptocurrency`, geo: 'US' });
        const trends = JSON.parse(results)?.default?.timelineData || [];
        return trends.map(entry => entry.value[0]);
    } catch (error) {
        console.error(`Trends fetch error (${coin}):`, error.message);
        return [];
    }
}

// Calculate Indicators
function calculateIndicators(prices) {
    if (prices.length < 20) return null;
    return {
        rsi: RSI.calculate({ period: config.rsiPeriod, values: prices }).pop(),
        sma: SMA.calculate({ period: 20, values: prices }).pop(),
        ema: EMA.calculate({ period: config.emaPeriod, values: prices }).pop(),
        macd: MACD.calculate({ values: prices, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }).pop(),
        bollinger: BollingerBands.calculate({ period: 20, values: prices, stdDev: config.bollingerStdDev }).pop(),
        lastPrice: prices.at(-1)
    };
}

// Predict Market Trend
function predictTrend(indicators) {
    const { rsi, ema, sma, macd, bollinger, lastPrice } = indicators;
    return (rsi < config.oversold || ema > sma || lastPrice < bollinger.lower || macd.histogram > 0) ? 'Bullish' :
           (rsi > config.overbought || ema < sma || lastPrice > bollinger.upper || macd.histogram < 0) ? 'Bearish' : 'Neutral';
}

// Market Analysis
async function analyzeMarket() {
    const coins = await fetchTopCoins();
    if (!coins.length) return;

    let bullishCount = 0, bearishCount = 0, avgRSI = 0, avgSentiment = 0;
    let bullishCoin = null, bearishCoin = null;

    for (const coin of coins) {
        const prices = await fetchPrices(coin);
        const indicators = calculateIndicators(prices);
        const sentimentScore = (await fetchTrends(coin)).reduce((a, b) => a + (b > 50 ? 1 : b < 50 ? -1 : 0), 0) / 10;
        if (!indicators) continue;

        avgRSI += indicators.rsi;
        avgSentiment += sentimentScore;
        const trend = predictTrend(indicators);

        if (trend === 'Bullish') bullishCount++;
        if (trend === 'Bearish') bearishCount++;

        if (!bullishCoin || indicators.rsi < bullishCoin.rsi) bullishCoin = { coin, ...indicators, sentimentScore };
        if (!bearishCoin || indicators.rsi > bearishCoin.rsi) bearishCoin = { coin, ...indicators, sentimentScore };
    }

    const totalCoins = coins.length || 1;
    console.log({
        marketTrend: bullishCount > bearishCount ? 'Bullish' : bearishCount > bullishCount ? 'Bearish' : 'Neutral',
        avgRSI: avgRSI / totalCoins,
        avgSentiment: avgSentiment / totalCoins,
        bullishCoin,
        bearishCoin
    });
}

// Scheduled Analysis
cron.schedule('*/1 * * * *', analyzeMarket);
