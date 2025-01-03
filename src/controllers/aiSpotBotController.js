// Required Dependencies
const tf = require('@tensorflow/tfjs-node');
const Binance = require('binance-api-node').default;
const axios = require('axios');

// Binance Client Initialization
const client = Binance({
    apiKey: 'your-binance-api-key',
    apiSecret: 'your-binance-api-secret',
});

// Parameters for the Bot
const SYMBOL = 'BTCUSDT'; // Trading pair
const INTERVAL = '1m'; // Candlestick interval
const TRADE_QUANTITY = 0.001; // Quantity to trade
const MODEL_PATH = 'file://path/to/your/model'; // Trained TensorFlow model path

// Load the TensorFlow Model
let model;
const loadModel = async () => {
    try {
        model = await tf.loadLayersModel(MODEL_PATH);
        console.log('Model loaded successfully');
    } catch (error) {
        console.error('Error loading the model:', error);
    }
};

// Fetch Historical Data
const fetchHistoricalData = async (symbol, interval, limit = 50) => {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const response = await axios.get(url);
    return response.data.map(candle => ({
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
    }));
};

// Calculate SMA
const calculateSMA = (data, period) => {
    if (data.length < period) return null;
    return data.slice(-period).reduce((sum, candle) => sum + candle.close, 0) / period;
};

// Calculate RSI
const calculateRSI = (data, period = 14) => {
    if (data.length < period + 1) return null;

    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const change = data[i].close - data[i - 1].close;
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / avgLoss;

    return 100 - (100 / (1 + rs));
};

// Process Data into Features
const prepareFeatures = (data) => {
    return tf.tensor2d(data.map((candle, i, arr) => {
        const smaShort = calculateSMA(arr.slice(0, i + 1), 10) || candle.close;
        const smaLong = calculateSMA(arr.slice(0, i + 1), 50) || candle.close;
        const rsi = calculateRSI(arr.slice(0, i + 1), 14) || 50;

        return [
            (candle.close - candle.open) / candle.open, // Price change percentage
            candle.volume, // Volume
            smaShort - smaLong, // SMA difference
            rsi, // RSI value
        ];
    }));
};

// Make Predictions
const predictMarket = async (data) => {
    const features = prepareFeatures(data);
    const predictions = model.predict(features).dataSync(); // Predictions (0 to 1)
    return predictions[predictions.length - 1]; // Latest prediction
};

// Execute Trade
const executeTrade = async (side, quantity) => {
    try {
        const order = await client.order({
            symbol: SYMBOL,
            side: side,
            type: 'MARKET',
            quantity: quantity,
        });
        console.log(`${side} order executed:`, order);
    } catch (error) {
        console.error('Error executing trade:', error);
    }
};

// Bot Logic
const runBot = async () => {
    try {
        const historicalData = await fetchHistoricalData(SYMBOL, INTERVAL);
        const prediction = await predictMarket(historicalData);

        console.log(`Prediction: ${prediction}`);

        const smaShort = calculateSMA(historicalData, 10);
        const smaLong = calculateSMA(historicalData, 50);
        const rsi = calculateRSI(historicalData, 14);

        console.log(`SMA Short: ${smaShort}, SMA Long: ${smaLong}, RSI: ${rsi}`);

        if (prediction > 0.7 && smaShort > smaLong && rsi < 70) {
            console.log('Signal: BUY');
            await executeTrade('BUY', TRADE_QUANTITY);
        } else if (prediction < 0.3 && smaShort < smaLong && rsi > 30) {
            console.log('Signal: SELL');
            await executeTrade('SELL', TRADE_QUANTITY);
        } else {
            console.log('Signal: HOLD');
        }
    } catch (error) {
        console.error('Error running bot:', error);
    }
};

// Main Execution
(async () => {
    await loadModel();
    setInterval(runBot, 60000); // Run bot every minute
})();
