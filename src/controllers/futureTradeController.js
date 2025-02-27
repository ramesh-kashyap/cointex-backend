// const Binance = require('node-binance-api');
// const axios = require('axios');
// const WebSocket = require('ws');
// const connection = require('../config/database');
// const https = require('https');
// const agent = new https.Agent({ family: 4 });
// const { analyzeMarketTrend, fetchTopCoinsFromDatabase } = require('../controllers/marketAiBotController');
// // Fetch Public IP Address using ipify API
// async function fetchPublicIP() {
//     try {
//         const response = await axios.get('https://api.ipify.org?format=json');
//         return response.data.ip;
//     } catch (error) {
//         console.error('Error fetching public IP:', error.message);
//         return 'IP fetch failed';
//     }
// }

// // Fetch Binance Futures Balance
// async function fetchTradingData(apiKey, apiSecret) {
//     const binance = new Binance().options({
//         APIKEY: apiKey,
//         APISECRET: apiSecret,
//         useServerTime: true,
//         test: true,  // Ensure it's set to true for Binance Testnet
//         BASE_URL: 'https://testnet.binancefuture.com/api', // Testnet URL
//         recvWindow: 10000,  
//         httpsAgent: agent,       // <-- ADDED: Use our HTTPS agent
//         family: 4                // <-- ADDED: Explicitly set family to 4
//     });

//     try {
//         const balances = await binance.futuresBalance();
//         console.log('Futures Balance Response:', JSON.stringify(balances, null, 2));

//         const usdtBalance = balances.find(bal => bal.asset === 'USDT');
//         if (usdtBalance) {
//             console.log('USDT Balance:', usdtBalance.balance);
//             return { balance: usdtBalance.balance };
//         } else {
//             console.log('No USDT balance found');
//             return { error: 'No USDT balance found' };
//         }
//     } catch (error) {
//         console.error('Error fetching futures balance:', error.message);
//         return { error: error.message || 'An error occurred fetching the futures balance' };
//     }
// }

// // Main function to fetch account info
// async function getFutureAccountInfo(req, res) {
//     const userId = 69;

//     if (!userId) {
//         return res.status(400).json({ error: 'User ID is required' });
//     }

//     try {
//         // Fetch API Keys from database
//         const [rows] = await connection.query('SELECT * FROM api_keys WHERE userId = ?', [userId]);

//         if (rows.length === 0) {
//             return res.status(404).json({ error: 'API keys not found' });
//         }

//         const { apiKey, apiSecret } = rows[0];
//         console.log('API Keys Fetched:', { apiKey, apiSecret });

//         // Fetch Public IP
//         const publicIP = await fetchPublicIP();

//         // Fetch Binance Trading Data
//         const tradingData = await fetchTradingData(apiKey, apiSecret);

//         console.log('Public IP:', publicIP);
//         console.log('Trading Data:', tradingData);

//         // Combine and send the response
//         const result = {
//             success: true,
//             message: 'Future Trade Data Fetch Successfully',
//             publicIP: publicIP,
//             tradingData: tradingData,
//         };

//         res.status(200).json(result);
//     } catch (error) {
//         console.error('Error in getFutureAccountInfo:', error.message);
//         res.status(500).json({ error: 'Failed to fetch account info', details: error.message });
//     }
// }

// // Place Futures Order
// async function placeFuturesOrder(req, res, orderType) {
//   const userId = 69;

//   if (!userId) {
//     return res.status(400).json({ error: 'User ID is required' });
//   }

//   try {
//     // Fetch API Keys from the database
//     const [rows] = await connection.query('SELECT * FROM api_keys WHERE userId = ?', [userId]);
//     if (rows.length === 0) {
//       return res.status(404).json({ error: 'API keys not found' });
//     }

//     const { apiKey, apiSecret } = rows[0];
//     console.log('API Keys Fetched:', { apiKey, apiSecret });

//     const binance = new Binance().options({
//       APIKEY: apiKey,
//       APISECRET: apiSecret,
//       useServerTime: true,
//       test: true,
//       BASE_URL: 'https://testnet.binancefuture.com/api', // Testnet URL
//       recvWindow: 10000,
//       httpsAgent: agent,       // Use our HTTPS agent forcing IPv4
//       family: 4                // Explicitly set family to 4
//     });
//     const coins = await fetchTopCoinsFromDatabase();
//     const { trendData, bullishCoin, bearishCoin } = await analyzeMarketTrend(coins);

//     const symbol = bullishCoin.coin.toUpperCase() + "USDT";
//     // Fetch Real-Time Price using WebSocket
//     const currentPrice = await fetchRealTimePrice(symbol);
//     console.log("✅ Current Price Fetched:", currentPrice);

//     // Fetch Exchange Info for Futures to get LOT_SIZE filter info.
//     const exchangeInfo = await binance.exchangeInfo();
//     const symbolInfo = exchangeInfo.symbols.find((s) => s.symbol === symbol);
//     if (!symbolInfo) {
//       return res.status(404).json({ error: `Symbol ${symbol} not found` });
//     }

//     const lotSizeFilter = symbolInfo.filters.find(filter => filter.filterType === 'LOT_SIZE');
//     const stepSize = parseFloat(lotSizeFilter.stepSize);
//     const minLotSize = parseFloat(lotSizeFilter.minQty);
//     console.log("lotSizeFilter:", lotSizeFilter);

//     // Determine allowed decimals from stepSize.
//     // For example, if stepSize is "0.001", allowed decimals will be 3.
//     const stepSizeStr = lotSizeFilter.stepSize.toString();
//     const allowedDecimals = stepSizeStr.includes('.') ? stepSizeStr.split('.')[1].length : 0;
//     console.log("Allowed decimals:", allowedDecimals);

//     // Calculate raw quantity. For example, using 10 USDT worth of asset:
//     let rawQuantity = 10 / currentPrice;
//     // Round down to the nearest multiple of stepSize:
//     rawQuantity = Math.floor(rawQuantity / stepSize) * stepSize;
//     // Format to the allowed number of decimals:
//     const formattedQuantity = rawQuantity.toFixed(allowedDecimals);
//     // Convert back to a number (or string, depending on what the API expects):
//     const quantityToOrder = parseFloat(formattedQuantity);
//     console.log("Calculated quantity:", quantityToOrder);
//     if (quantityToOrder < minLotSize) {
//       return res.status(400).json({ error: `Quantity too low. Minimum required: ${minLotSize}` });
//     }

//     // Set the leverage for the symbol (using futuresLeverage method)
//     await binance.futuresLeverage(symbol, 3);
//     console.log("Leverage set successfully for", symbol);

//     // Prepare order parameters for a MARKET order
//     const orderParams = {
//       symbol: symbol,
//       side: orderType.toUpperCase(),
//       type: 'MARKET',
//       quantity: quantityToOrder,
//       leverage: 3,
//       timeInForce: 'GTC',   // Not used in market orders but kept for reference
//     };

//     let orderResponse;
//     if (orderType.toLowerCase() === 'buy') {
//       orderResponse = await binance.futuresMarketBuy(orderParams.symbol, orderParams.quantity);
//     } else if (orderType.toLowerCase() === 'sell') {
//       orderResponse = await binance.futuresMarketSell(orderParams.symbol, orderParams.quantity);
//     } else {
//       throw new Error('Invalid order type');
//     }

//     console.log("Future Order Placed Successfully:", orderResponse);

//     // Save order to the database
//     let orderTime;
//     if (orderResponse.transactTime) {
//       const parsedTime = Number(orderResponse.transactTime);
//       orderTime = !isNaN(parsedTime) ? new Date(parsedTime) : new Date();
//     } else {
//       orderTime = new Date();
//     }
//     const orderTimeISOString = orderTime.toISOString();

//     const insertQuery = `
//       INSERT INTO future_orders (
//         userId, symbol, order_id, client_order_id, transact_time, price,
//         orig_qty, status, side, type, leverage, tradeStatus, time_in_force
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
//     `;

//     const values = [
//       userId,
//       symbol,
//       orderResponse.orderId || null,
//       orderResponse.clientOrderId || null,
//       orderTimeISOString,
//       currentPrice,
//       orderResponse.origQty || quantityToOrder,
//       orderResponse.status || 'N/A',
//       orderResponse.side || orderType.toUpperCase(),
//       'MARKET',
//       3,
//       'active',
//       'GTC'
//     ];

//     // Uncomment the following line to save the order in your database:
//     // const [results] = await connection.execute(insertQuery, values);
//     console.log('Future order saved to database:', { /* results */ });

//     return res.status(200).json({ message: 'Future market order placed and saved successfully.', orderResponse });
//   } catch (error) {
//     console.error('Error placing future order:', error.message);
//     return res.status(500).json({ error: 'Failed to place future order', details: error.message });
//   }
// }

// async function monitorPrice(req , res ) {
//     try {
//         const userId =  69;
//         console.log('Extracted userId:', userId);  // Log userId for debugging
        
//         if (!userId) {
//             const message = 'User ID is required';
//             if (res) return res.status(400).json({ error: message });
//             console.log(message);
//             return;
//         }
//         const coins = await fetchTopCoinsFromDatabase();
//         if (!coins.length) return console.log('No coins found in the database.');
//         console.log('Analyzing market trend and classifying coins...');
//         const { trendData, bullishCoin, bearishCoin } = await analyzeMarketTrend(coins);

//         // if (!bullishCoin || trendData.marketTrend !== "Bullish" || bullishCoin.rsi < 30 || bullishCoin.rsi > 70) {
//         //     console.log('No suitable bullish coin found or RSI is out of range (30 - 70).');
//         //     console.log("coin:",bullishCoin.rsi);
//         //     console.log("coin:",bullishCoin);
//         //     if (res) return res.status(200).json({ message: 'No suitable buying opportunity found.' });
//         //     return;
//         // }
       
//         const symbol =bullishCoin.coin.toUpperCase() +"USDT";
//         console.log(symbol);
//         const [orders] = await connection.query(
//                  'SELECT * FROM future_orders WHERE userId = ? AND side = ? AND tradeStatus = ? AND symbol = ? ORDER BY transact_time DESC LIMIT 1',
//             [userId, 'BUY', 'active',symbol]
//         );
                                         
//         if (orders.length === 0) {
//             const message = 'No orders found for this user';
//             if (res) return res.status(404).json({ message });
//             console.log(message);
//             await placeFuturesOrder(req, res, 'buy');
//             return;
//         }

//         const previousBuyPrice = parseFloat(orders[0].price);
//         const quantity = parseFloat(orders[0].orig_qty);
//         const previousUSDT = quantity * previousBuyPrice;
//         const orderId = orders[0].id;
//         if (res) res.json({ orders }); // Optional early response for debugging

       
//         let currentPrice = null;

//         const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`);

//         const pricePromise = new Promise((resolve, reject) => {
//             const timeout = setTimeout(() => {
//                 ws.close();
//                 reject(new Error('Timeout: Failed to fetch real-time price'));
//             }, 10000);
 
//             ws.on('message', (data) => {
//                 try {
//                     const tradeData = JSON.parse(data);
//                     const price = parseFloat(tradeData.p);

//                     if (!isNaN(price)) {
//                         currentPrice = price;
//                         ws.close();
//                         clearTimeout(timeout);
//                         resolve(price);
//                     }
//                 } catch (error) {
//                     reject(new Error('Error parsing WebSocket data'));
//                 }
//             });

//             ws.on('error', (error) => reject(error));
//             ws.on('close', () => console.log('WebSocket connection closed'));
//         });

//         currentPrice = await pricePromise;

//         const currentUSDT = quantity * currentPrice;
//         const priceChangePercentage = ((currentUSDT - previousUSDT) / previousUSDT) * 100;

//         console.log('Previous USDT:', previousUSDT);
//         console.log('Current USDT:', currentUSDT);
//         console.log('Price Change Percentage:', priceChangePercentage);

//         if (priceChangePercentage >= 0.5) {
//             console.log(`Price increased by ${priceChangePercentage.toFixed(2)}%. Triggering sell order.`);
//             await   placeFuturesOrder(req, res, 'sell');

//             const updateQuery = 'UPDATE orders SET tradeStatus = ? WHERE id = ?';
//             const queryParams = ['inactive', orderId];
            
//             try {
//                 const [result] = await connection.query(updateQuery, queryParams);
//                 console.log('Query executed:', { query: updateQuery, params: queryParams });
//                 console.log('Query result:', result);
                
//                 if (res) {
//                     return res.status(200).json({
//                         message: 'Sell order placed and trade status updated to inactive',
//                         priceChangePercentage: priceChangePercentage.toFixed(2),
//                         query: { query: updateQuery, params: queryParams },
//                         result,
//                     });
//                 }
//             } catch (error) {
//                 console.error('Error updating tradeStatus:', error.message);
//                 if (res) return res.status(500).json({ error: 'Failed to update tradeStatus' });
//             }
        
//         } else if (priceChangePercentage < 0) {
//             console.log(`Price decreased by ${Math.abs(priceChangePercentage).toFixed(2)}%. Triggering buy order.`);
//             await placeFuturesOrder(req, res, 'buy');
//         }
//     } catch (error) {
//         console.error('Error monitoring price:', error.message);
//         if (res) res.status(500).json({ error: error.message });
//     }
// }
// async function fetchRealTimePrice(symbol) {
//     return new Promise((resolve, reject) => {
//       const ws = new WebSocket(`wss://fstream.binance.com/ws/${symbol.toLowerCase()}@trade`);
//       ws.on('message', (data) => {
//         try {
//           const tradeData = JSON.parse(data);
//           const price = parseFloat(tradeData.p);
//           if (!isNaN(price)) {
//             ws.close();
//             resolve(price);
//           }
//         } catch (error) {
//           console.error('Error parsing WebSocket data:', error);
//           ws.close();
//           reject(error);
//         }
//       });
//       ws.on('error', (error) => {
//         console.error('WebSocket error:', error);
//         ws.close();
//         reject(error);
//       });
//       ws.on('close', () => console.log('WebSocket connection closed'));
//     });
//   }
  

// async function getActiveFutureTrades(req, res) {
//     // In a real application, userId would be retrieved from the session or token.
//     const userId = 69;
//     if (!userId) {
//       return res.status(400).json({ success: false, error: 'User ID is required.' });
//     }
  
//     try {
//       // 1. Retrieve all active future trades for the user, ordered by transact_time ascending.
//       const query = `
//         SELECT *
//         FROM future_orders
//         WHERE userId = ? 
//           AND tradeStatus = ? 
//           AND market = ?
//         ORDER BY transact_time ASC
//       `;
//       const [activeTrades] = await connection.query(query, [userId, 'active', 'future']);
//       if (!activeTrades.length) {
//         return res.status(404).json({ success: false, message: 'No active future trades found.' });
//       }
  
//       // 2. Define mapping from coin symbols to CoinGecko IDs.
//       const coinGeckoMapping = {
//         btc: "bitcoin", eth: "ethereum", xrp: "ripple", bnb: "binancecoin",
//         sol: "solana", doge: "dogecoin", ada: "cardano", trx: "tron",
//         avax: "avalanche-2", sui: "sui", ton: "toncoin", link: "chainlink",
//         shib: "shiba-inu", wbtc: "wrapped-bitcoin", xlm: "stellar",
//         hbar: "hedera-hashgraph", dot: "polkadot", bch: "bitcoin-cash", ltc: "litecoin"
//       };
  
//       // 3. Extract unique coin symbols for price lookup.
//       const symbols = activeTrades.map(order =>
//         order.symbol.replace('USDT', '').toLowerCase()
//       );
//       const uniqueSymbols = [...new Set(symbols)];
//       const coinIds = uniqueSymbols
//         .map(symbol => coinGeckoMapping[symbol])
//         .filter(id => id !== undefined);
  
//       // 4. Get live prices for these coins from CoinGecko.
//       const coinGeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd`;
//       const priceResponse = await axios.get(coinGeckoUrl);
//       const livePrices = priceResponse.data;
  
//       // 5. Enhance each order with live price, calculate PnL and PnL percentage.
//       const ordersWithPrices = activeTrades.map(order => {
//         const code = order.symbol.replace('USDT', '').toLowerCase();
//         const coinId = coinGeckoMapping[code];
//         const realPrice =
//           coinId && livePrices[coinId] && livePrices[coinId].usd
//             ? livePrices[coinId].usd
//             : order.price;
//         const pnl = (realPrice - order.price) * order.orig_qty;
//         const pnlPercentage = ((realPrice - order.price) / order.price) * 100;
//         return { ...order, realPrice, pnl, pnlPercentage };
//       });
  
//       // 6. From these, pick the oldest trade per coin.
//       const firstTradesPerCoin = [];
//       const seenCoins = new Set();
//       for (const trade of ordersWithPrices) {
//         const coinCode = trade.symbol.replace('USDT', '').toLowerCase();
//         if (!seenCoins.has(coinCode)) {
//           seenCoins.add(coinCode);
//           firstTradesPerCoin.push(trade);
//         }
//       }
  
//       // 7. Get total invested amount per coin from the database.
//       const sumQuery = `
//         SELECT REPLACE(LOWER(symbol), 'usdt', '') AS coinCode, SUM(orig_qty * price) AS totalAmount
//         FROM orders
//         WHERE userId = ? 
//           AND tradeStatus = ? 
//           AND market = ?
//         GROUP BY coinCode
//       `;
//       const [sumResults] = await connection.query(sumQuery, [userId, 'active', 'future']);
  
//       // 8. Calculate per-coin PnL and combine with total invested amount.
//       const coinStats = {};
//       ordersWithPrices.forEach(order => {
//         const coinCode = order.symbol.replace('USDT', '').toLowerCase();
//         if (!coinStats[coinCode]) {
//           coinStats[coinCode] = { pnl: 0 };
//         }
//         coinStats[coinCode].pnl += order.pnl;
//       });
//       sumResults.forEach(coin => {
//         const coinCode = coin.coinCode;
//         const totalAmount = coin.totalAmount;
//         if (!coinStats[coinCode]) {
//           coinStats[coinCode] = { pnl: 0 };
//         }
//         coinStats[coinCode].totalAmount = totalAmount;
//         coinStats[coinCode].pnlPercentage = totalAmount > 0 
//           ? (coinStats[coinCode].pnl / totalAmount) * 100 
//           : 0;
//       });
  
//       // 9. Compute overall PnL and overall PnL percentage.
//       let totalOverallPnl = 0;
//       let totalInvestment = 0;
//       for (const coinCode in coinStats) {
//         totalOverallPnl += coinStats[coinCode].pnl;
//         totalInvestment += Number(coinStats[coinCode].totalAmount || 0);
//       }
//       const totalOverallPnlPercentage = totalInvestment > 0 
//         ? (totalOverallPnl / totalInvestment) * 100 
//         : 0;
  
//       // 10. Merge the per-coin stats into each trade in firstTradesPerCoin.
//       const activeTradesWithStats = firstTradesPerCoin.map(trade => {
//         const coinCode = trade.symbol.replace('USDT', '').toLowerCase();
//         return { ...trade, coinStats: coinStats[coinCode] || {} };
//       });
  
//       // 11. Return the response.
//       return res.status(200).json({
//         success: true,
//         activeTrades: activeTradesWithStats, // Each trade now includes its coinStats.
//         totalOverallPnl,
//         totalOverallPnlPercentage
//       });
//     } catch (error) {
//       console.error('Error fetching active future trades:', error.message);
//       return res.status(500).json({
//         success: false,
//         error: 'Failed to fetch active future trades',
//         details: error.message,
//       });
//     }
//   }
  


// module.exports = { getFutureAccountInfo, placeFuturesOrder,monitorPrice,getActiveFutureTrades };


// Import required modules and the Binance Connector
// futuresConnectorExample.js

const { UMFutures } = require('@binance/futures-connector');
const axios = require('axios');
const WebSocket = require('ws');
const crypto = require('crypto');
const https = require('https');
const connection = require('../config/database'); // Adjust your database connection path
const { analyzeMarketTrend, fetchTopCoinsFromDatabase } = require('../controllers/marketAiBotController');

// Create an HTTPS agent to force IPv4 if needed
const agent = new https.Agent({ family: 4 });

// --------------------------------------------------------------------------
// Helper: Sign a query string using HMAC-SHA256
function signQuery(queryString, secret) {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

// --------------------------------------------------------------------------
// Helper: Create a new Binance Futures client using the UMFutures constructor
function createFuturesClient(apiKey, apiSecret) {
  return new UMFutures(apiKey, apiSecret, {
    baseURL: 'https://testnet.binancefuture.com', // Testnet URL for futures
    httpsAgent: agent,
  });
}

// --------------------------------------------------------------------------
// Helper: Fetch Exchange Info using Axios
async function fetchExchangeInfo(apiKey) {
  const url = 'https://testnet.binancefuture.com/fapi/v1/exchangeInfo';
  try {
    const response = await axios.get(url, {
      headers: { 'X-MBX-APIKEY': apiKey },
      httpsAgent: agent,
    });
    return response.data;
  } catch (error) {
    throw new Error(
      error.response ? JSON.stringify(error.response.data) : error.message
    );
  }
}

// --------------------------------------------------------------------------
// Helper: Set leverage manually using Axios with recvWindow parameter
async function setLeverage(apiKey, apiSecret, symbol, leverage) {
  const baseURL = 'https://testnet.binancefuture.com';
  const endpoint = '/fapi/v1/leverage';
  const timestamp = Date.now();
  const recvWindow = 60000; // 60 seconds
  const params = { symbol, leverage, timestamp, recvWindow };

  const queryString = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');

  const signature = signQuery(queryString, apiSecret);
  const url = `${baseURL}${endpoint}?${queryString}&signature=${signature}`;

  try {
    const response = await axios.post(url, null, {
      headers: { 'X-MBX-APIKEY': apiKey },
      httpsAgent: agent,
    });
    return response.data;
  } catch (error) {
    throw new Error(
      error.response ? JSON.stringify(error.response.data) : error.message
    );
  }
}

// --------------------------------------------------------------------------
// Fetch Futures Balance using the client's account() method
async function fetchTradingData(apiKey, apiSecret) {
  const client = createFuturesClient(apiKey, apiSecret);
  try {
    const response = await client.account();
    console.log('Futures Account Info:', JSON.stringify(response.data, null, 2));

    // USDT balance is typically in the "assets" array.
    const usdtAsset = response.data.assets.find(asset => asset.asset === 'USDT');
    if (usdtAsset) {
      console.log('USDT Balance:', usdtAsset.walletBalance);
      return { balance: usdtAsset.walletBalance };
    } else {
      console.log('No USDT balance found');
      return { error: 'No USDT balance found' };
    }
  } catch (error) {
    console.error('Error fetching futures balance:', error.message);
    return { error: error.message || 'Error fetching futures balance' };
  }
}

// --------------------------------------------------------------------------
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

// --------------------------------------------------------------------------
// Get Futures Account Info (using both client and Axios)
async function getFutureAccountInfo(req, res) {
  const userId = 69; // Example user ID
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  try {
    const [rows] = await connection.query('SELECT * FROM api_keys WHERE userId = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'API keys not found' });
    }
    const { apiKey, apiSecret } = rows[0];
    console.log('API Keys Fetched:', { apiKey, apiSecret });

    const publicIP = await fetchPublicIP();
    const tradingData = await fetchTradingData(apiKey, apiSecret);

    const result = {
      success: true,
      message: 'Future Trade Data Fetched Successfully',
      publicIP,
      tradingData,
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Error in getFutureAccountInfo:', error.message);
    res.status(500).json({ error: 'Failed to fetch account info', details: error.message });
  }
}

// --------------------------------------------------------------------------
// Place a Futures Order using the UMFutures client and setLeverage helper
async function placeFuturesOrder(req, res, orderType) {
  const userId = 69;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  console.log('checkck  futuer e');
  try {
    const [rows] = await connection.query('SELECT * FROM api_keys WHERE userId = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'API keys not found' });
    }
    const { apiKey, apiSecret } = rows[0];
    console.log('API Keys Fetched:', { apiKey, apiSecret });

    const client = createFuturesClient(apiKey, apiSecret);

    // Market analysis
    const coins = await fetchTopCoinsFromDatabase();
    const { topBullishCoin } = await analyzeMarketTrend(coins);
    const symbol = topBullishCoin.coin.toUpperCase() + "USDT";

    // Fetch current price via WebSocket
    const currentPrice = await fetchRealTimePrice(symbol);
    console.log("✅ Current Price Fetched:", currentPrice);

    // Fetch exchange info manually
    const exchangeInfo = await fetchExchangeInfo(apiKey);
    const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);
    if (!symbolInfo) {
      return res.status(404).json({ error: `Symbol ${symbol} not found` });
    }
    const lotSizeFilter = symbolInfo.filters.find(filter => filter.filterType === 'LOT_SIZE');
    const stepSize = parseFloat(lotSizeFilter.stepSize);
    const minLotSize = parseFloat(lotSizeFilter.minQty);
    console.log("lotSizeFilter:", lotSizeFilter);

    // Determine allowed decimals
    const decimals = lotSizeFilter.stepSize.toString().split('.')[1]?.length || 0;
    console.log("Allowed decimals:", decimals);

    // Calculate quantity based on a fixed USDT amount
    let rawQuantity = 6 / currentPrice;
    rawQuantity = Math.floor(rawQuantity / stepSize) * stepSize;
    const quantityToOrder = parseFloat(rawQuantity.toFixed(decimals));
    console.log("Calculated quantity:", quantityToOrder);
    if (quantityToOrder < minLotSize) {
      return res.status(400).json({ error: `Quantity too low. Minimum required: ${minLotSize}` });
    }

    // Set leverage manually using the helper with recvWindow
    const leverageResult = await setLeverage(apiKey, apiSecret, symbol, 3);
    console.log("Leverage set response:", leverageResult);

    // Prepare order parameters with recvWindow and timestamp
    const baseURL = 'https://testnet.binancefuture.com';
    const endpoint = '/fapi/v1/order';
    const timestamp = Date.now();
    const recvWindow = 60000;
    const orderParams = {
      symbol,
      side: orderType.toUpperCase(), // "BUY" or "SELL"
      type: 'MARKET',
      quantity: quantityToOrder,
      timestamp,
      recvWindow
    };

    // Build query string and sign it
    const queryString = Object.keys(orderParams)
      .map(key => `${key}=${encodeURIComponent(orderParams[key])}`)
      .join('&');
    const signature = signQuery(queryString, apiSecret);
    const url = `${baseURL}${endpoint}?${queryString}&signature=${signature}`;

    // Place the order using Axios
    const orderResponse = await axios.post(url, null, {
      headers: { 'X-MBX-APIKEY': apiKey },
      httpsAgent: agent,
    });
    console.log("Future Order Placed Successfully:", orderResponse.data);

    // Normalize transactTime
    let orderTime = orderResponse.data.transactTime
      ? new Date(Number(orderResponse.data.transactTime))
      : new Date();
    const orderTimeISOString = orderTime.toISOString();

    const insertQuery = `
      INSERT INTO future_orders (
        userId, symbol, order_id, client_order_id, transact_time, price,
        orig_qty, status, side, type, leverage, tradeStatus, time_in_force
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const values = [
      userId,
      symbol,
      orderResponse.data.orderId || null,
      orderResponse.data.clientOrderId || null,
      orderTimeISOString,
      currentPrice,
      orderResponse.data.origQty || quantityToOrder,
      orderResponse.data.status || 'N/A',
      orderResponse.data.side || orderType.toUpperCase(),
      'MARKET',
      3,
      'active',
      'GTC'
    ];
    // Uncomment the line below if you want to save the order to your database:
    // const [results] = await connection.execute(insertQuery, values);
    console.log('Future order saved to database:', { /* results */ });

    return res.status(200).json({ message: 'Future market order placed and saved successfully.', orderResponse: orderResponse.data });
  } catch (error) {
    console.error('Error placing future order:', error.response ? error.response.data : error.message);
    return res.status(500).json({ error: 'Failed to place future order', details: error.response ? error.response.data : error.message });
  }
}

// --------------------------------------------------------------------------
// Fetch real-time price via WebSocket from Binance Futures stream
async function fetchRealTimePrice(symbol) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://fstream.binance.com/ws/${symbol.toLowerCase()}@trade`);
    ws.on('message', (data) => {
      try {
        const tradeData = JSON.parse(data);
        const price = parseFloat(tradeData.p);
        if (!isNaN(price)) {
          ws.close();
          resolve(price);
        }
      } catch (error) {
        console.error('Error parsing WebSocket data:', error);
        ws.close();
        reject(error);
      }
    });
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      ws.close();
      reject(error);
    });
    ws.on('close', () => console.log('WebSocket connection closed'));
  });
}

// --------------------------------------------------------------------------
// monitorPrice: Monitor trade price changes and trigger buy/sell orders accordingly
async function monitorPrice(req, res) {
  try {
    const userId = 69;
    console.log('Extracted userId:', userId);
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    const coins = await fetchTopCoinsFromDatabase();
    
    if (!coins.length) {
      console.log('No coins found in the database.');
      return res.status(404).json({ error: 'No coins found in the database.' });
    }
    console.log('Analyzing market trend and classifying coins...');
    const analysis = await analyzeMarketTrend(coins);
    
    // Check if our analysis returned proper coin data
    const { overallTrend,  topBullishCoin,topBearishCoin } = analysis;
    if (!overallTrend) {
      return res.status(500).json({ error: 'Market analysis failed to return an overall trend.' });
    }
    console.log('check',analysis);
    console.log("Overall Trend:", overallTrend);
console.log("Top Bullish Coin:", topBullishCoin.coin);
console.log("Top Bearish Coin:", topBearishCoin.coin);
    let symbol, orderType;
    if (overallTrend === 'Bullish') {
      console.log('its check ofor woek1');
      if (!topBullishCoin || !topBullishCoin.coin) {
        return res.status(500).json({ error: 'No bullish coin data available.' });
      }
      symbol = topBullishCoin.coin.toUpperCase() + "USDT";
      orderType = 'buy';
      console.log(`Market is Bullish. Taking long position on ${symbol}.`);
    } else if (overallTrend === 'Bearish') {
     
      if (!topBearishCoin || !topBearishCoin.coin) {
        console.log('its ck ofor woek:',bearishCoin.coin);
        return res.status(500).json({ error: 'No bearish coin data available.' });
        
      }
      console.log('its check ofor woek:',topBearishCoin.coin);
      symbol = topBearishCoin.coin.toUpperCase() + "USDT";
      orderType = 'sell';
      console.log(`Market is Bearish. Taking short position on ${symbol}.`);
    } else {
      console.log('Market is Neutral. No trade executed.');
      return res.status(200).json({ message: 'Market is Neutral. No trade executed.' });
    }

    // Optionally, check if an active order already exists for this symbol.
    const [orders] = await connection.query(
      'SELECT * FROM future_orders WHERE userId = ? AND side = ? AND tradeStatus = ? AND symbol = ? ORDER BY transact_time DESC LIMIT 1',
      [userId, 'BUY', 'active', symbol]
    );
    if (orders.length > 0) {
      console.log(`An active order for ${symbol} already exists. Skipping trade.`);
      return res.status(200).json({ message: 'Active order exists. No new trade executed.' });
    }
    
    // Place the trade (using your existing placeFuturesOrder function)
    await placeFuturesOrder(req, res, orderType);
  } catch (error) {
    console.error('Error monitoring price/trading:', error.message);
    return res.status(500).json({ error: error.message });
  }
}



// --------------------------------------------------------------------------
// getActiveFutureTrades: Retrieve active future trades with live PnL data
async function getActiveFutureTrades(req, res) {
  const userId = 69;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required.' });
  }
  try {
    const query = `
      SELECT *
      FROM future_orders
      WHERE userId = ? 
        AND tradeStatus = ? 
        AND market = ?
      ORDER BY transact_time ASC
    `;
    const [activeTrades] = await connection.query(query, [userId, 'active', 'future']);
    if (!activeTrades.length) {
      return res.status(404).json({ success: false, message: 'No active future trades found.' });
    }
    const coinGeckoMapping = {
      btc: "bitcoin", eth: "ethereum", xrp: "ripple", bnb: "binancecoin",
      sol: "solana", doge: "dogecoin", ada: "cardano", trx: "tron",
      avax: "avalanche-2", sui: "sui", ton: "toncoin", link: "chainlink",
      shib: "shiba-inu", wbtc: "wrapped-bitcoin", xlm: "stellar",
      hbar: "hedera-hashgraph", dot: "polkadot", bch: "bitcoin-cash", ltc: "litecoin"
    };
    const symbols = activeTrades.map(order =>
      order.symbol.replace('USDT', '').toLowerCase()
    );
    const uniqueSymbols = [...new Set(symbols)];
    const coinIds = uniqueSymbols.map(symbol => coinGeckoMapping[symbol]).filter(id => id);
    const coinGeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd`;
    const priceResponse = await axios.get(coinGeckoUrl);
    const livePrices = priceResponse.data;
    const ordersWithPrices = activeTrades.map(order => {
      const code = order.symbol.replace('USDT', '').toLowerCase();
      const coinId = coinGeckoMapping[code];
      const realPrice = coinId && livePrices[coinId] && livePrices[coinId].usd
          ? livePrices[coinId].usd
          : order.price;
      const pnl = (realPrice - order.price) * order.orig_qty;
      const pnlPercentage = ((realPrice - order.price) / order.price) * 100;
      return { ...order, realPrice, pnl, pnlPercentage };
    });
    const firstTradesPerCoin = [];
    const seenCoins = new Set();
    for (const trade of ordersWithPrices) {
      const coinCode = trade.symbol.replace('USDT', '').toLowerCase();
      if (!seenCoins.has(coinCode)) {
        seenCoins.add(coinCode);
        firstTradesPerCoin.push(trade);
      }
    }
    let totalOverallPnl = 0, totalInvestment = 0;
    ordersWithPrices.forEach(order => {
      totalOverallPnl += order.pnl;
      totalInvestment += order.orig_qty * order.price;
    });
    const totalOverallPnlPercentage = totalInvestment ? (totalOverallPnl / totalInvestment) * 100 : 0;
    return res.status(200).json({
      success: true,
      activeTrades: firstTradesPerCoin,
      totalOverallPnl,
      totalOverallPnlPercentage
    });
  } catch (error) {
    console.error('Error fetching active future trades:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch active future trades',
      details: error.message,
    });
  }
}

// --------------------------------------------------------------------------
// Export the functions
module.exports = {
  getFutureAccountInfo,
  placeFuturesOrder,
  monitorPrice,
  getActiveFutureTrades
};
