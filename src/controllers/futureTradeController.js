const Binance = require('node-binance-api');
const axios = require('axios');
const connection = require('../config/database');

// Fetch Public IP Address using ipify API
async function fetchPublicIP() {
    try {
        const response = await axios.get('https://api.ipify.org?format=json');
        return response.data.ip;
    } catch (error) {
        console.error('Error fetching public IP:', error.message);
        return 'IP fetch failed';
    }
}

// Fetch Binance Futures Balance
async function fetchTradingData(apiKey, apiSecret) {
    const binance = new Binance().options({
        APIKEY: apiKey,
        APISECRET: apiSecret,
        test: false,
    });

    try {
        const balances = await binance.futuresBalance();
        console.log('Futures Balance Response:', JSON.stringify(balances, null, 2));

        const usdtBalance = balances.find(bal => bal.asset === 'USDT');
        if (usdtBalance) {
            console.log('USDT Balance:', usdtBalance.balance);
            return { balance: usdtBalance.balance };
        } else {
            console.log('No USDT balance found');
            return { error: 'No USDT balance found' };
        }
    } catch (error) {
        console.error('Error fetching futures balance:', error.message);
        return { error: error.message || 'An error occurred fetching the futures balance' };
    }
}

// Main function to fetch account info
async function getFutureAccountInfo(req, res) {
    const userId = req.query.userId;
    console.log("Received userId:", userId);

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        // Fetch API Keys from database
        const [rows] = await connection.query('SELECT * FROM api_keys WHERE userId = ?', [userId]);
           console.log("check",rows);
           console.log("Received userId:", userId);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'API keys not found' });
        }

        const { apiKey, apiSecret } = rows[0];
        console.log('API Keys Fetched:', { apiKey, apiSecret });

        // Fetch Public IP
        const publicIP = await fetchPublicIP();

        // Fetch Binance Trading Data
        const tradingData = await fetchTradingData(apiKey, apiSecret);

        console.log('Public IP:', publicIP);
        console.log('Trading Data:', tradingData);

        // Combine and send the response
        const result = {
            publicIP: publicIP,
            tradingData: tradingData,
        };

        res.status(200).json(result);
    } catch (error) {
        console.error('Error in getFutureAccountInfo:', error.message);
        res.status(500).json({ error: 'Failed to fetch account info', details: error.message });
    }
}

module.exports = { getFutureAccountInfo };
