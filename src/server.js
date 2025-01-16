const axios = require('axios');
const Sentiment = require('sentiment');
const { TwitterApi } = require('twitter-api-v2');
const { RSI, SMA, EMA, MACD, BollingerBands } = require('technicalindicators');
const cron = require('node-cron');
const connection = require('../src/config/database');
// Initialize Twitter API client
const twitterClient = new TwitterApi({
  appKey: '4slediM5AGz602oF1xQ9e1Khx',
  appSecret: 'jj7pmJc5aJHjs7yiCHe04AagebusOsKfltMzuz6U9NypDTSD4C',
  accessToken: '1877270106369306624-GCGUu2saal61HMOtIppQOl4cyX1BKY',
  accessSecret: '15LVRNeyKfaUjLaEMxpYXzwMkF5Mwt55GaZURKJkyedHh',
});

// Sentiment analyzer instance
const sentiment = new Sentiment();

// Function to fetch all active coins from Binance API
async function fetchAllCoins() {
    try {
        const url = 'https://api.binance.com/api/v3/exchangeInfo';
        const response = await axios.get(url);
        const symbols = response.data.symbols
            .filter(symbol => symbol.status === 'TRADING') // Only active coins
            .map(symbol => symbol.symbol);
        console.log(`Available coins: ${symbols}`);
        return symbols;
    } catch (error) {
        console.error('Error fetching coins:', error);
        return [];
    }
}

// Function to fetch 24hr ticker data to filter by high volume
async function filterCoinsByVolume() {
    try {
        const url = 'https://api.binance.com/api/v3/ticker/24hr';
        const response = await axios.get(url);
        const highVolumeCoins = response.data
            .filter(ticker => parseFloat(ticker.quoteVolume) > 1000000) // Volume threshold
            .map(ticker => ticker.symbol);
        console.log(`High-volume coins: ${highVolumeCoins}`);
        return highVolumeCoins;
    } catch (error) {
        console.error('Error filtering coins by volume:', error);
        return [];
    }
}

// Function to fetch historical price data for a coin
async function fetchPrices(coin) {
    try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${coin}&interval=1d`;
        const response = await axios.get(url);
        const prices = response.data.map(item => parseFloat(item[4])); // Closing prices
        return prices;
    } catch (error) {
        console.error(`Error fetching prices for ${coin}:`, error);
        return [];
    }
}

// Calculate all indicators for a given coin
async function calculateIndicatorsForCoin(coin) {
    const prices = await fetchPrices(coin);
    if (prices.length < 20) return null; // Ensure enough data for indicators

    // Calculate RSI
    const rsi = RSI.calculate({ period: 14, values: prices });

    // Calculate Moving Averages (SMA and EMA)
    const sma = SMA.calculate({ period: 20, values: prices });
    const ema = EMA.calculate({ period: 20, values: prices });

    // Calculate MACD
    const macd = MACD.calculate({
        values: prices,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9
    });

    // Calculate Bollinger Bands
    const bollingerBands = BollingerBands.calculate({
        period: 20,
        values: prices,
        stdDev: 2
    });

    return {
        rsi: rsi[rsi.length - 1],
        sma: sma[sma.length - 1],
        ema: ema[ema.length - 1],
        macd: macd[macd.length - 1].MACD,
        macdSignal: macd[macd.length - 1].signal,
        bollingerLower: bollingerBands[bollingerBands.length - 1].lower,
        bollingerUpper: bollingerBands[bollingerBands.length - 1].upper,
        lastPrice: prices[prices.length - 1],
    };
}

// Fetch market sentiment for a coin using Twitter
async function fetchTwitterSentiment(coin) {
    try {
        const query = `${coin} -filter:retweets`; // Search for tweets with the coin's name
        const tweets = await twitterClient.v2.search(query, { max_results: 100 });

        let sentimentScore = 0;
        tweets.data.forEach(tweet => {
            const tweetSentiment = sentiment.analyze(tweet.text);
            sentimentScore += tweetSentiment.score;
        });

        // Calculate average sentiment score
        const avgSentimentScore = sentimentScore / tweets.data.length;
        console.log(`Sentiment score for ${coin}: ${avgSentimentScore}`);

        return avgSentimentScore;
    } catch (error) {
        console.error('Error fetching Twitter sentiment:', error);
        return 0;
    }
}

// Filter coin based on sentiment
async function filterCoinBySentiment(coin) {
    const sentimentScore = await fetchTwitterSentiment(coin);
    return sentimentScore > 0 ? coin : null; // Buy if sentiment is positive
}

// Combine all indicators to select the best coin
async function evaluateCoin(coin) {
    const indicators = await calculateIndicatorsForCoin(coin);
    if (!indicators) return null;

    // Determine if the coin meets buy conditions
    let buySignal = false;

    // RSI: Buy if RSI is under 30
    if (indicators.rsi < 30) {
        buySignal = true;
    }

    // Moving Averages: Buy if EMA crosses above SMA
    if (indicators.ema > indicators.sma) {
        buySignal = true;
    }

    // MACD: Buy if MACD is above the signal line
    if (indicators.macd > indicators.macdSignal) {
        buySignal = true;
    }

    // Bollinger Bands: Buy if price is below the lower Bollinger Band
    if (indicators.lastPrice < indicators.bollingerLower) {
        buySignal = true;
    }

    return buySignal ? coin : null;
}

// Main function to execute trading strategy
async function tradeAutomatically() {
    console.log('Fetching available coins...');
    const coins = await fetchAllCoins();
    if (coins.length === 0) return;

    console.log('Filtering coins by volume...');
    const highVolumeCoins = await filterCoinsByVolume();
    if (highVolumeCoins.length === 0) return;

    console.log('Filtering coins by sentiment...');
    const sentimentCoin = await filterCoinBySentiment(highVolumeCoins[0]);
    if (!sentimentCoin) return;

    console.log('Evaluating coin for indicators...');
    const bestCoin = await evaluateCoin(sentimentCoin);
    if (!bestCoin) return;

    console.log(`Selected best coin: ${bestCoin}`);
    
    // Here, you can call a method to place a buy order for the selected coin
    // For example:
    // await placeBuyOrder(bestCoin, 0.01); // Example: Buy 0.01 of the coin
}

// Schedule the bot to run every 5 minutes
// cron.schedule('*/5 * * * *', () => {
//     console.log('Running trading bot...');
//     tradeAutomatically();
// });

// Error handling for unhandled promise rejections
process.on('unhandledRejection', error => {
    console.error('Unhandled error:', error);
});
