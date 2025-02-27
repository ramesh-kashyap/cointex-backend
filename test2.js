const { UMFutures } = require('@binance/futures-connector');
const axios = require('axios');
const https = require('https');

// Create an HTTPS agent (forces IPv4 if needed)
const agent = new https.Agent({ family: 4 });

// Replace with your Futures Testnet API credentials
const futuresApiKey = '32370593e41d672f6812fd4ae656266f2ade611c1b5cafea46d7f550f9c6dfa9';
const futuresApiSecret = '74374e4dfcd3f820289eb018bd7b27bba0ec96bc174153a3523dea15a7519310';

// For other functions (like setting leverage or placing orders) you might still use the UMFutures client:
const futuresClient = new UMFutures(futuresApiKey, futuresApiSecret, {
  baseURL: 'https://testnet.binancefuture.com',
  httpsAgent: agent,
  useServerTime: true,
});

// --------------------------------------------------------------------------
// Helper: Sign a query string using HMAC-SHA256
function signQuery(queryString, secret) {
  return require('crypto').createHmac('sha256', secret).update(queryString).digest('hex');
}

// --------------------------------------------------------------------------
// Helper: Fetch Futures Trade History using Axios directly
async function fetchFuturesTradeHistory(symbol) {
  try {
    const baseURL = 'https://testnet.binancefuture.com';
    const recvWindow = 60000;
    const timestamp = Date.now();

    // Construct query for open orders
    const openEndpoint = '/fapi/v1/openOrders';
    const openParams = { symbol, recvWindow, timestamp };
    const openQueryString = Object.keys(openParams)
      .map(key => `${key}=${encodeURIComponent(openParams[key])}`)
      .join('&');
    const openSignature = signQuery(openQueryString, futuresApiSecret);
    const openUrl = `${baseURL}${openEndpoint}?${openQueryString}&signature=${openSignature}`;

    // Construct query for all orders
    const allEndpoint = '/fapi/v1/allOrders';
    const allParams = { symbol, recvWindow, timestamp, limit: 50 };
    const allQueryString = Object.keys(allParams)
      .map(key => `${key}=${encodeURIComponent(allParams[key])}`)
      .join('&');
    const allSignature = signQuery(allQueryString, futuresApiSecret);
    const allUrl = `${baseURL}${allEndpoint}?${allQueryString}&signature=${allSignature}`;

    // Fetch open orders
    const openResponse = await axios.get(openUrl, {
      headers: { 'X-MBX-APIKEY': futuresApiKey },
      httpsAgent: agent,
    });

    // Fetch all orders
    const allResponse = await axios.get(allUrl, {
      headers: { 'X-MBX-APIKEY': futuresApiKey },
      httpsAgent: agent,
    });

    return {
      openOrders: openResponse.data,
      allOrders: allResponse.data,
    };
  } catch (error) {
    console.error('Error fetching Futures trade history:', 
      error.response ? error.response.data : error.message);
    throw error;
  }
}

// --------------------------------------------------------------------------
// Main: Combine and display Futures trade history for a given symbol
async function showFuturesTradeHistory(symbol) {
  try {
    console.log(`Fetching Futures trade history for symbol: ${symbol}`);
    const history = await fetchFuturesTradeHistory(symbol);

    // Filter closed orders: consider orders with status not "NEW" or "PARTIALLY_FILLED" as closed.
    const closedOrders = history.allOrders.filter(order =>
      order.status !== 'NEW' && order.status !== 'PARTIALLY_FILLED'
    );

    const combined = {
      symbol,
      openOrders: history.openOrders,
      closedOrders,
    };

    console.log('Futures Trade History:');
    console.log(JSON.stringify(combined, null, 2));
    return combined;
  } catch (error) {
    console.error('Error in showFuturesTradeHistory:', 
      error.response ? error.response.data : error.message);
    throw error;
  }
}

// --------------------------------------------------------------------------
// Example usage: Fetch and display Futures trade history for BTCUSDT on Testnet
showFuturesTradeHistory('BTCUSDT')
  .then(() => {
    console.log('Futures trade history fetched successfully.');
  })
  .catch((err) => {
    console.error('Error fetching Futures trade history:', 
      err.response ? err.response.data : err.message);
  });
