// controllers/binanceController.js
const crypto = require('crypto');
const axios = require('axios');
const connection = require('../config/database'); // Database connection

const BASE_URL = 'https://api.binance.com';

// Function to create a signature
function createSignature(queryString, apiSecret) {
    return crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
}

// Function to make a Binance API request
async function binanceRequest(method, endpoint, params = {}, apiKey, apiSecret) {
    const timestamp = Date.now();
    const queryParams = { ...params, timestamp };
    const queryString = new URLSearchParams(queryParams).toString();
    const signature = createSignature(queryString, apiSecret);

    const config = {
        method,
        url: `${BASE_URL}${endpoint}?${queryString}&signature=${signature}`,
        headers: {
            'X-MBX-APIKEY': apiKey,
        },
    };

    try {
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        throw error;
    }
}

// Function to fetch API keys from the database
async function getApiKeysFromDatabase(userId) {
    try {
        const [rows] = await connection.query('SELECT apiKey, apiSecret FROM api_keys WHERE userId = ?', [userId]);
        if (rows.length === 0) {
            throw new Error('API keys not found');
        }
        return rows[0]; // Return the API key and secret
    } catch (error) {
        console.error('Database error:', error.message);
        throw error;
    }
}

// Main function to fetch account info
async function getAccountInfo(req, res) {
    const userId = req.query.userId; // User ID from the query parameters
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        // Fetch API keys from the database
        const { apiKey, apiSecret } = await getApiKeysFromDatabase(userId);
        console.log('API Keys Fetched:', { apiKey, apiSecret });

        // Define the Binance endpoint
        const endpoint = '/api/v3/account';

        // Make the Binance API request
        const accountInfo = await binanceRequest('GET', endpoint, {}, apiKey, apiSecret);
        console.log('Account Info:', accountInfo);

        // Validate and extract the USDT balance
        if (!accountInfo || !Array.isArray(accountInfo.balances)) {
            return res.status(500).json({ error: 'Invalid account information received from Binance' });
        }

        const usdtBalance = accountInfo.balances.find(balance => balance.asset === 'USDT');
        const response = {
            usdtBalance: {
                free: usdtBalance?.free || '0',
                locked: usdtBalance?.locked || '0',
            },
        };

        res.json(response); // Send the response to the client
    } catch (error) {
        console.error('Failed to fetch account info:', error.message);
        res.status(500).json({ error: 'Failed to fetch account information', details: error.message });
    }
}

module.exports = { getAccountInfo };
