const axios = require('axios');
const fs = require('fs');

// Fetch Historical Data from Binance
const fetchHistoricalData = async (symbol, interval, startTime, endTime) => {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=1000`;
    const response = await axios.get(url);
    return response.data.map(candle => ({
        timestamp: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
    }));
};

// Fetch 3 Years of Data
const fetchThreeYearsData = async (symbol, interval) => {
    const endTime = Date.now();
    const startTime = endTime - 3 * 365 * 24 * 60 * 60 * 1000; // 3 years ago
    let currentStartTime = startTime;
    let allData = [];

    while (currentStartTime < endTime) {
        const data = await fetchHistoricalData(symbol, interval, currentStartTime, endTime);
        allData = allData.concat(data);
        currentStartTime = data[data.length - 1].timestamp + 1; // Move to the next batch of data
        console.log(`Fetched ${allData.length} candles so far...`);
    }

    // Save the data to a JSON file
    fs.writeFileSync('historical_data.json', JSON.stringify(allData, null, 2));
    console.log('3 years of data saved to historical_data.json');
    return allData;
};

// Example usage: Fetch 3 years of BTC/USDT data with 1 minute intervals
fetchThreeYearsData('BTCUSDT', '1m');
