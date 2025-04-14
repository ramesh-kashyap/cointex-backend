const Binance = require('node-binance-api');
const { Spot } = require('@binance/connector');
const { UMFutures } = require('@binance/futures-connector');
const https = require('https');
const agent = new https.Agent({ family: 4 });
const crypto = require('crypto');
const axios = require('axios');
const WebSocket = require('ws');
const connection = require('../config/database'); // Database connection
const BASE_URL = 'https://testnet.binance.vision';
const NodeCache = require('node-cache');
const { livePrices } = require('../controllers/binaceLiveController');
const coinPriceCache = new NodeCache({ stdTTL: 60 }); // Cache TTL is 60 seconds
const { analyzeMarketTrend, fetchTopCoinsFromDatabase } = require('../controllers/marketAiBotController');
// Helper function to create a signature

const middlewareController = require('../middleware/middlewareController');
function createSignature(queryString, apiSecret) {
    return crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
}

global.user_id = 12;

// Fetch Binance server time
async function getBinanceServerTime() {
    try {
        const response = await axios.get('https://api.binance.com/api/v3/time');
        return response.data.serverTime;
    } catch (error) {
        console.error('Error fetching Binance server time:', error.message);
        throw error;
    }
}

// Generic function to make a Binance API request
async function binanceRequest(method, endpoint, params = {}, apiKey, apiSecret) {
    const serverTime = await getBinanceServerTime(); // Get server time to sync timestamp
    const timestamp = serverTime;  // Use Binance's server time
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
        console.error('Error during Binance request:', error.response?.data || error.message);
        throw error;
    }
}

// Fetch API keys from the database
async function getApiKeysFromDatabase(userId) {
    try {
        const [rows] = await connection.query(
            'SELECT apiKey, apiSecret FROM api_keys WHERE userId = ?',
            [userId]
        );
        if (rows.length === 0) {
            throw new Error('API keys not found for the user');
        }
        return rows[0]; // Return the keys (apiKey and apiSecret)
    } catch (error) {
        console.error('Database error:', error.message);
        throw error; // Ensure errors propagate for proper handling
    }
}

// Function to place a buy order for TRX
// async function buyTRX(apiKey, apiSecret, quantity) {
//     const endpoint = '/api/v3/order';
//     const params = {
//         symbol: 'TRXUSDT',         // Symbol for TRX/USDT pair
//         side: 'BUY',               // Specify buy order
//         type: 'MARKET',            // Market order type
//         quantity: quantity,       // Quantity to buy
//     };

//     try {
//         const order = await binanceRequest('POST', endpoint, params, apiKey, apiSecret);
//         console.log('Buy Order Response:', order);
//         return order;
//     } catch (error) {
//         console.error('Failed to place buy order:', error.response?.data || error.message);
//         throw error;
//     }
// }

// Real-time price tracking with WebSocket
// async function startRealTimePriceTracking(apiKey, apiSecret) {
//     const ws = new WebSocket('wss://stream.binance.com:9443/ws/trxusdt@trade');

//     ws.on('open', () => {
//         console.log('WebSocket connected for TRX/USDT');
//     });

//     ws.on('message', async (data) => {
//         const tradeData = JSON.parse(data);
//         const tradePrice = parseFloat(tradeData.p); // Real-time market price
//         console.log('Real-time TRX price:', tradePrice);

//         // Close WebSocket to avoid duplicate orders
//         ws.close();

//         try {
//             // Fetch TRX/USDT trading rules
//             const trxSymbolInfo = await binanceRequest('GET', '/api/v3/exchangeInfo', {}, apiKey, apiSecret)
//                 .then(info => info.symbols.find(symbol => symbol.symbol === 'TRXUSDT'));

//             const lotSizeFilter = trxSymbolInfo.filters.find(filter => filter.filterType === 'LOT_SIZE');
//             const minLotSize = parseFloat(lotSizeFilter.minQty);
//             const stepSize = parseFloat(lotSizeFilter.stepSize);

//             // Calculate quantity to buy with 5 USDT
//             let quantityToBuy = (5 / tradePrice).toFixed(8); // 5 USDT worth of TRX
//             quantityToBuy = Math.floor(quantityToBuy / stepSize) * stepSize; // Adjust to step size

//             if (quantityToBuy >= minLotSize) {
//                 console.log(`Placing market buy order for ${quantityToBuy} TRX`);
//                 await buyTRX(apiKey, apiSecret, quantityToBuy);
//             } else {
//                 console.error(`Quantity too low to buy. Minimum required: ${minLotSize}`);
//             }
//         } catch (error) {
//             console.error('Error during buy process:', error.response?.data || error.message);
//         }
//     });

//     ws.on('error', (error) => {
//         console.error('WebSocket error:', error);
//     });

//     ws.on('close', () => {
//         console.log('WebSocket connection closed');
//     });
// }

// Fetch account information

async function isTestnetOnline() {
    try {
        const response = await axios.get('https://testnet.binance.vision/api/v3/ping');
        return response.status === 200;
    } catch (error) {
        console.error("Binance Testnet may be down:", error.message);
        return false;
    }
}
async function getAccountInfo(req, res) {
    const userId = req.user.userId;
   console.log("user Id",userId);
    if (!userId) {
        return res.status(400).json({ success:false, message: 'User ID is required' });
    }

    try {
        const { apiKey, apiSecret } = await getApiKeysFromDatabase(userId);
        const isOnline = await isTestnetOnline();
        console.log(isOnline);
        if (!isOnline) {
            console.log("Binance Testnet is under maintenance. Try again later." );
            return res.status(503).json({ error: "Binance Testnet is under maintenance. Try again later." });
        }
        if (!apiKey || !apiSecret) {
            console.error(" API Key or Secret is missing from database!");
            return res.status(500).json({ error: "API credentials not found for user." });
        }
        const accountInfo = await binanceRequest('GET', '/api/v3/account', {}, apiKey, apiSecret);

        const usdtBalance = accountInfo.balances.find(balance => balance.asset === 'USDT');
        res.json({
            success:true,
            message: 'Spot Balance Fetch Successfully',
            usdtBalance: {
                free: usdtBalance?.free || '0',
                locked: usdtBalance?.locked || '0',
            },
        });
    } catch (error) {
        console.error('Failed to fetch account info:', error.message);
        res.status(500).json({ error: 'Failed to fetch account information', details: error.message });
    }
}

// Start price tracking endpoint
// async function startPriceTracking(req, res) {
//     const userId = req.query.userId;
//     if (!userId) {
//         return res.status(400).json({ error: 'User ID is required' });
//     }

//     try {
//         const { apiKey, apiSecret } = await getApiKeysFromDatabase(userId);
//         await startRealTimePriceTracking(apiKey, apiSecret);
//         res.json({ message: 'Price tracking started successfully' });
//     } catch (error) {
//         console.error('Error starting price tracking:', error.message);
//         res.status(500).json({ error: 'Failed to start price tracking', details: error.message });
//     }
// }
let orderPlaced = false; // Flag to prevent duplicate orders
// Generic function to place a buy or sell order for TRX
async function placeOrder(req, res, orderType) {
    const userId = 69;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
   
    try {
        const { apiKey, apiSecret } = await getApiKeysFromDatabase(userId);
        const client = new Spot(apiKey, apiSecret, { baseURL: 'https://testnet.binance.vision' });

        const coins = await fetchTopCoinsFromDatabase();
        if (!coins.length) return console.log('No coins found in the database.');
        console.log('Analyzing market trend and classifying coins...');
        const { trendData, bullishCoin, bearishCoin } = await analyzeMarketTrend(coins);

        // const symbol = 'TRXUSDT';
        const symbol =bullishCoin.coin.toUpperCase() +"USDT";
        console.log('Symbol:', symbol);
      
        let currentPrice = null;
      
    
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`);

        const pricePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (!orderPlaced) {
                    ws.close(); // Close WebSocket on timeout
                    reject(new Error('Timeout: Failed to fetch real-time price'));
                }
            }, 10000); // Timeout after 10 seconds

            ws.on('message', (data) => {
                if (orderPlaced) return; // Stop further processing if already placed

                try {
                    const tradeData = JSON.parse(data);
                    currentPrice = parseFloat(tradeData.p);

                    if (!isNaN(currentPrice)) {
                        console.log('Current Price:', currentPrice);
                        // orderPlaced = true; // Mark as placed
                        ws.close(); // Close WebSocket
                        clearTimeout(timeout); // Clear the timeout
                        resolve(currentPrice);
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket data:', error);
                }
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                clearTimeout(timeout); // Clear the timeout
                reject(error);
            });

            ws.on('close', () => {
                console.log('WebSocket connection closed');
            });
        });

        currentPrice = await pricePromise;
        console.log(currentPrice);
        const trxSymbolInfo = await client.exchangeInfo();
        const symbolInfo = trxSymbolInfo.data.symbols.find((s) => s.symbol === symbol);

        if (!symbolInfo) {
            console.error(`Symbol ${symbol} not found`);
            return res.status(500).json({ error: `Symbol ${symbol} not found` });
        }

        const lotSizeFilter = symbolInfo.filters.find((filter) => filter.filterType === 'LOT_SIZE');
        const stepSize = parseFloat(lotSizeFilter.stepSize);
        const minLotSize = parseFloat(lotSizeFilter.minQty);

        let quantityToOrder = (6 / currentPrice).toFixed(8);
        quantityToOrder = Math.floor(quantityToOrder / stepSize) * stepSize;

        if (quantityToOrder < minLotSize) {
            return res.status(400).json({ error: `Quantity too low. Minimum required: ${minLotSize}` });
        }

        console.log(`Placing ${orderType} order for ${quantityToOrder} TRX at ${currentPrice} USDT`);

        const orderParams = {
            // price: currentPrice,
            quantity: quantityToOrder.toFixed(7),
            // timeInForce: 'GTC',
            recvWindow: 10000,
        };        
        console.log('check order:',orderParams);
        orderSymbol=symbol;
        const orderResponse = await client.newOrder(symbol, orderType.toUpperCase(), 'MARKET', orderParams);
        console.log('Order placed successfully:', orderResponse.data);
        // orderPlaced = true;
        const Price = orderResponse.data.fills[0].price;
        console.log('real',Price);
        const orderData = orderResponse.data;
        const { 
            orderId,
            orderListId,
            clientOrderId,
            transactTime,
            price,
            origQty,
            status,
            timeInForce,
            type,
            side
        } = orderData;
        const Symbol = symbol;
        const values = [
            Symbol,          // Use the already defined `symbol`
            orderId,
            orderListId,
            clientOrderId,
            transactTime,
            Price,
            origQty,
            status,
            timeInForce,
            type,
            side,
            userId
        ];
        const insertQuery = `
        INSERT INTO orders (
             symbol,
            order_id,
            order_list_id,
            client_order_id,
            transact_time,
            price,
            orig_qty,
            status,
            time_in_force,
            order_type,
            side,
            userId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const [results] = await connection.execute(insertQuery, values);

    console.log('Order saved to database:', results);
    } catch (error) {
        console.error(`Error placing ${orderType} order:`, error.message);
        return res.status(500).json({ error: `Failed to place ${orderType} order`, details: error.message });
    }
}

// async function placeOrder(req, res, orderType) {
//     const userId = 69;
//     if (!userId) {
//         return res.status(400).json({ error: 'User ID is required' });
//     }

//     try {
//         const { apiKey, apiSecret } = await getApiKeysFromDatabase(userId);
//         const client = new Spot(apiKey, apiSecret, { baseURL: 'https://testnet.binance.vision' });

//         // Get account info
//         const accountInfo = await client.account();
//         const balances = accountInfo.data.balances;
//         console.log('Account Info:', balances);

//         const coins = await fetchTopCoinsFromDatabase();
//         if (!coins.length) return console.log('No coins found in the database.');

//         console.log('Analyzing market trend and classifying coins...');
//         const { bullishCoin } = await analyzeMarketTrend(coins);

//         const symbol = bullishCoin.coin.toUpperCase() + "USDT";
//         console.log('Symbol:', symbol);

//         // Fetch real-time price
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
//                         console.log('Current Price:', price);
//                         ws.close();
//                         clearTimeout(timeout);
//                         resolve(price);
//                     }
//                 } catch (error) {
//                     console.error('Error parsing WebSocket data:', error);
//                     clearTimeout(timeout);
//                     reject(error);
//                 }
//             });

//             ws.on('error', (error) => {
//                 console.error('WebSocket error:', error);
//                 clearTimeout(timeout);
//                 reject(error);
//             });

//             ws.on('close', () => {
//                 console.log('WebSocket connection closed');
//             });
//         });

//         currentPrice = await pricePromise;
//         console.log("✅ Current Price Fetched:", currentPrice);

//         const exchangeInfo = await client.exchangeInfo();
//         const symbolInfo = exchangeInfo.data.symbols.find((s) => s.symbol === symbol);
//         if (!symbolInfo) {
//             console.error(`Symbol ${symbol} not found`);
//             return res.status(500).json({ error: `Symbol ${symbol} not found` });
//         }

//         const lotSizeFilter = symbolInfo.filters.find((filter) => filter.filterType === 'LOT_SIZE');
//         const stepSize = parseFloat(lotSizeFilter.stepSize);
//         const minLotSize = parseFloat(lotSizeFilter.minQty);

//         let quantityToOrder = (6 / currentPrice).toFixed(8);
//         quantityToOrder = Math.floor(quantityToOrder / stepSize) * stepSize;

//         if (quantityToOrder < minLotSize) {
//             return res.status(400).json({ error: `Quantity too low. Minimum required: ${minLotSize}` });
//         }

//         console.log(`🚀 Placing ${orderType} MARKET order for ${quantityToOrder} ${symbol}`);

//         // Place Market Order
//         const orderResponse = await client.newOrder({
//             symbol: symbol,
//             side: orderType.toUpperCase(),
//             type: 'MARKET',
//             quantity: quantityToOrder.toFixed(7),
//             timeInForce: 'GTC',
//             recvWindow: 10000
//         });

//         console.log("✅ Market Order Placed Successfully:", orderResponse.data);

//         // Extract Order Data and save to DB
//         const { orderId, clientOrderId, transactTime, origQty, status, side } = orderResponse.data;

//         const insertQuery = `
//             INSERT INTO orders (
//                 symbol, order_id, client_order_id, transact_time, price, orig_qty, status, time_in_force, order_type, side
//             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
//         `;
//         const values = [
//             symbol,
//             orderId,
//             clientOrderId,
//             transactTime,
//             null,  // No price for market orders
//             origQty,
//             status,
//             'N/A',  // Not applicable for market orders
//             'MARKET',
//             side,
//         ];

//         const [results] = await connection.execute(insertQuery, values);
//         console.log('Order saved to database:', results);

//         return res.status(200).json({ message: 'Market order placed and saved successfully.', orderId });
//     } catch (error) {
//         console.error('Error placing order:', error.response ? error.response.data : error.message);
//         return res.status(500).json({ error: `Failed to place ${orderType} order`, details: error.message });
//     }
// }

async function monitorPrice(req , res ) {
    try {
        const userId =  69;
        console.log('Extracted userId:', userId);  // Log userId for debugging
        
        if (!userId) {
            const message = 'User ID is required';
            if (res) return res.status(400).json({ error: message });
            console.log(message);
            return;
        }
        const coins = await fetchTopCoinsFromDatabase();
        if (!coins.length) return console.log('No coins found in the database.');
        console.log('Analyzing market trend and classifying coins...');
        const { trendData, bullishCoin, bearishCoin } = await analyzeMarketTrend(coins);

        if (!bullishCoin || trendData.marketTrend !== "Bullish" || bullishCoin.rsi < 30 || bullishCoin.rsi > 70) {
            console.log('No suitable bullish coin found or RSI is out of range (30 - 70).');
            console.log("coin:",bullishCoin.rsi);
            console.log("coin:",bullishCoin);
            if (res) return res.status(200).json({ message: 'No suitable buying opportunity found.' });
          
        }
        // const symbol = 'TRXUSDT';
        const symbol =bullishCoin.coin.toUpperCase() +"USDT";
        console.log(bullishCoin);
        const [orders] = await connection.query(
                 'SELECT * FROM orders WHERE userId = ? AND side = ? AND tradeStatus = ? AND symbol = ? ORDER BY transact_time DESC LIMIT 1',
            [userId, 'BUY', 'active',symbol]
        );

        if (orders.length === 0) {
            const message = 'No orders found for this user';
            if (res) return res.status(404).json({ message });
            console.log(message);
            await placeOrder(req, res, 'buy');
            return;
        }

        const previousBuyPrice = parseFloat(orders[0].price);
        const quantity = parseFloat(orders[0].orig_qty);
        const previousUSDT = quantity * previousBuyPrice;
        const orderId = orders[0].id;
        if (res) res.json({ orders }); // Optional early response for debugging

       
        let currentPrice = null;

        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`);

        const pricePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Timeout: Failed to fetch real-time price'));
            }, 10000);

            ws.on('message', (data) => {
                try {
                    const tradeData = JSON.parse(data);
                    const price = parseFloat(tradeData.p);

                    if (!isNaN(price)) {
                        currentPrice = price;
                        ws.close();
                        clearTimeout(timeout);
                        resolve(price);
                    }
                } catch (error) {
                    reject(new Error('Error parsing WebSocket data'));
                }
            });

            ws.on('error', (error) => reject(error));
            ws.on('close', () => console.log('WebSocket connection closed'));
        });

        currentPrice = await pricePromise;

        const currentUSDT = quantity * currentPrice;
        const priceChangePercentage = ((currentUSDT - previousUSDT) / previousUSDT) * 100;

        console.log('Previous USDT:', previousUSDT);
        console.log('Current USDT:', currentUSDT);
        console.log('Price Change Percentage:', priceChangePercentage);

        if (priceChangePercentage >= 0.5) {
            console.log(`Price increased by ${priceChangePercentage.toFixed(2)}%. Triggering sell order.`);
            await placeOrder(req, res, 'sell');

            const updateQuery = 'UPDATE orders SET tradeStatus = ? WHERE id = ?';
            const queryParams = ['inactive', orderId];
            
            try {
                const [result] = await connection.query(updateQuery, queryParams);
                console.log('Query executed:', { query: updateQuery, params: queryParams });
                console.log('Query result:', result);
                
                if (res) {
                    return res.status(200).json({
                        message: 'Sell order placed and trade status updated to inactive',
                        priceChangePercentage: priceChangePercentage.toFixed(2),
                        query: { query: updateQuery, params: queryParams },
                        result,
                    });
                }
            } catch (error) {
                console.error('Error updating tradeStatus:', error.message);
                if (res) return res.status(500).json({ error: 'Failed to update tradeStatus' });
            }
        
        } else if (priceChangePercentage < 0) {
            console.log(`Price decreased by ${Math.abs(priceChangePercentage).toFixed(2)}%. Triggering buy order.`);
            await placeOrder(req, res, 'buy');
        }
    } catch (error) {
        console.error('Error monitoring price:', error.message);
        if (res) res.status(500).json({ error: error.message });
    }
}

// async function getActiveTrades(req, res) {
//     const userId = 69;
//     if (!userId) {
//       return res.status(400).json({ success: false, error: 'User ID is required.' });
//     }
  
//     try {
//       // 1. Retrieve all active trades for the user, ordered by transact_time ascending.
//       const query = `
//         SELECT *
//         FROM orders
//         WHERE userId = ? AND tradeStatus = ?
//         ORDER BY transact_time ASC
//       `;
//       const [activeTrades] = await connection.query(query, [userId, 'active']);
//       if (!activeTrades.length) {
//         return res.status(404).json({ success: false, message: 'No active trades found.' });
//       }
  
//       // 2. Define mapping from our coin symbols to CoinGecko IDs.
//       const coinGeckoMapping = {
//         btc: "bitcoin", eth: "ethereum", xrp: "ripple", bnb: "binancecoin",
//         sol: "solana", doge: "dogecoin", ada: "cardano", trx: "tron",
//         avax: "avalanche-2", sui: "sui", ton: "toncoin", link: "chainlink",
//         shib: "shiba-inu", wbtc: "wrapped-bitcoin", xlm: "stellar",
//         hbar: "hedera-hashgraph", dot: "polkadot", bch: "bitcoin-cash", ltc: "litecoin"
//       };
  
//       // 3. Extract unique coin symbols (e.g., from "BTCUSDT" to "btc") for price lookup.
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
  
//       // 5. Enhance each order with live price, calculate pnl and pnlPercentage.
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
//         WHERE userId = ? AND tradeStatus = 'active'
//         GROUP BY coinCode
//       `;
//       const [sumResults] = await connection.query(sumQuery, [userId]);
  
//       // 8. Calculate per-coin PnL and combine with total invested amount.
//       const coinStats = {};
//       // Sum up pnl per coin from ordersWithPrices.
//       ordersWithPrices.forEach(order => {
//         const coinCode = order.symbol.replace('USDT', '').toLowerCase();
//         if (!coinStats[coinCode]) {
//           coinStats[coinCode] = { pnl: 0 };
//         }
//         coinStats[coinCode].pnl += order.pnl;
//       });
//       // Merge total invested amount and compute pnlPercentage.
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
//       // Each trade now gets an additional property "coinStats" with its PnL details.
//       const activeTradesWithStats = firstTradesPerCoin.map(trade => {
//         const coinCode = trade.symbol.replace('USDT', '').toLowerCase();
//         return { ...trade, coinStats: coinStats[coinCode] || {} };
//       });
  
//       // 11. Return the response.
//       return res.status(200).json({
//         success: true,
//         activeTrades: activeTradesWithStats, // Each trade includes its coinStats.
//         totalOverallPnl,
//         totalOverallPnlPercentage
//       });
//     } catch (error) {
//       console.error('Error fetching active trades:', error.message);
//       return res.status(500).json({
//         success: false,
//         error: 'Failed to fetch active trades',
//         details: error.message,
//       });
//     }
//   }
  

async function getActiveTrades(req, res) {
  const userId = 69;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required.' });
  }
  const { apiKey, apiSecret } = await getApiKeysFromDatabase(userId);
  
  const marketType = req.query.type === 'future' ? 'future' : 'spot';
  const tableName = marketType === 'future' ? 'future_orders' : 'orders';

  try {
    // 1. Retrieve all active trades
    const query = `
      SELECT *
      FROM ${tableName}
      WHERE userId = ? AND tradeStatus = ?
      ORDER BY transact_time ASC
    `;
    const queryParams = [userId, 'active'];
    const [activeTrades] = await connection.query(query, queryParams);
    if (!activeTrades.length) {
      return res.status(404).json({ success: false, message: 'No active trades found.' });
    }

    // 2. (Optional) Mapping if needed.
    // In this example, our orders use symbols like "BTCUSDT".
    // We process them by converting to lowercase and removing "usdt".
    const processSymbol = (symbol) => symbol.replace('USDT', '').toLowerCase();

    // 3. Enhance each order with live price from Binance and calculate PnL.
    // We use the livePrices object provided by our Binance WebSocket module.
    const ordersWithPrices = activeTrades.map(order => {
      const coinKey = processSymbol(order.symbol);
      // Use Binance live price if available; otherwise, fall back to the stored order price.
      const realPrice = livePrices[coinKey] ? livePrices[coinKey] : parseFloat(order.price);
      const pnl = (realPrice - parseFloat(order.price)) * parseFloat(order.orig_qty);
      const pnlPercentage = ((realPrice - parseFloat(order.price)) / parseFloat(order.price)) * 100;
      return { ...order, realPrice, pnl, pnlPercentage };
    });

    // 4. Pick the oldest trade per coin.
    const firstTradesPerCoin = [];
    const seenCoins = new Set();
    for (const trade of ordersWithPrices) {
      const coinKey = processSymbol(trade.symbol);
      if (!seenCoins.has(coinKey)) {
        seenCoins.add(coinKey);
        firstTradesPerCoin.push(trade);
      }
    }

    // 5. Get the total invested amount per coin.
    const sumQuery = `
      SELECT REPLACE(LOWER(symbol), 'usdt', '') AS coinCode, SUM(orig_qty * price) AS totalAmount
      FROM ${tableName}
      WHERE userId = ? AND tradeStatus = ?
      GROUP BY coinCode
    `;
    const sumParams = [userId, 'active'];
    const [sumResults] = await connection.query(sumQuery, sumParams);

    // 6. Compute per-coin stats.
    const coinStats = {};
    ordersWithPrices.forEach(order => {
      const coinKey = processSymbol(order.symbol);
      if (!coinStats[coinKey]) {
        coinStats[coinKey] = { pnl: 0 };
      }
      coinStats[coinKey].pnl += order.pnl;
    });
    sumResults.forEach(coin => {
      const coinKey = coin.coinCode;
      const totalAmount = parseFloat(coin.totalAmount);
      if (!coinStats[coinKey]) {
        coinStats[coinKey] = { pnl: 0 };
      }
      coinStats[coinKey].totalAmount = totalAmount;
      // console.log('real:', totalAmount);
      coinStats[coinKey].pnlPercentage = totalAmount > 0 
        ? (coinStats[coinKey].pnl / totalAmount) * 100 
        : 0;
    });

    // 7. Compute overall stats.
    let totalOverallPnl = 0;
    let totalInvestment = 0;
    for (const coinKey in coinStats) {
      totalOverallPnl += coinStats[coinKey].pnl;
      totalInvestment += Number(coinStats[coinKey].totalAmount || 0);
    }
    const totalOverallPnlPercentage = totalInvestment > 0 
      ? (totalOverallPnl / totalInvestment) * 100 
      : 0;

    // 8. Merge coin stats with the first trade per coin.
    const activeTradesWithStats = firstTradesPerCoin.map(trade => {
      const coinKey = processSymbol(trade.symbol);
      return { ...trade, coinStats: coinStats[coinKey] || {} };
    });
    // console.log('work:', activeTradesWithStats);
const BASE_URL = 'https://testnet.binancefuture.com'; // For USDT-margined futures

function getSignature(query, secret) {
    return crypto.createHmac('sha256', secret).update(query).digest('hex');
  }
  
  // Get all symbols you've traded (based on account)
  async function getTradedSymbols() {
    const timestamp = Date.now();
    const query = `timestamp=${timestamp}`;
    const signature = getSignature(query, apiSecret);
  
    try {
      const res = await axios.get(`${BASE_URL}/fapi/v2/account?${query}&signature=${signature}`, {
        headers: { 'X-MBX-APIKEY': apiKey },
      });
  
      const positions = res.data.positions;
      const symbols = positions
        .filter(p => parseFloat(p.initialMargin) > 0 || parseFloat(p.unrealizedProfit) !== 0)
        .map(p => p.symbol);
  
      return [...new Set(symbols)]; // Remove duplicates
    } catch (err) {
      console.error('Error fetching traded symbols:', err.response?.data || err.message);
      return [];
    }
  }
  
  // Get only live + canceled orders for a symbol
  async function getOrders(symbol) {
    const timestamp = Date.now();
    const params = `symbol=${symbol}&timestamp=${timestamp}`;
    const signature = getSignature(params, apiSecret);
  
    try {
      const res = await axios.get(`${BASE_URL}/fapi/v1/allOrders?${params}&signature=${signature}`, {
        headers: { 'X-MBX-APIKEY': apiKey },
      });
  
      const orders = res.data;
       console.log('orders:',orders);
      const live = orders.filter(o => o.status === 'NEW' || o.status === 'PARTIALLY_FILLED');
      const canceled = orders.filter(o => o.status === 'CANCELED');
  
      return { symbol, live, canceled };
    } catch (err) {
      console.error(`Error fetching orders for ${symbol}:`, err.response?.data || err.message);
      return null;
    }
  }
  
  // Main
  async function fetchMyLiveAndCanceledTrades() {
    const tradedSymbols = await getTradedSymbols();
  
    for (const symbol of tradedSymbols) {
      const data = await getOrders(symbol);
      console.log('checck dtat:',data);
      if (data) {
        console.log(`\n📈 ${data.symbol}`);
        if (data.live.length) console.log('🟢 Live Orders:', data.live);
        if (data.canceled.length) console.log('❌ Canceled Orders:', data.canceled);
      }
    }
  }
  
  // fetchMyLiveAndCanceledTrades();

    return res.status(200).json({
      success: true,
      activeTrades: activeTradesWithStats,
      totalOverallPnl,
      totalOverallPnlPercentage
    });
  } catch (error) {
    console.error('Error fetching active trades:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch active trades',
      details: error.message,
    });
  }
}

//  async function cancelOrder(req, res) {
//     const { symbol } = req.body;
//     const userId=69;
//     try {
//         if (!symbol) {
//           console.log(`No symbol provided to process for user ${userId}`);
//           return;
//         }
    
//         // Fetch API Keys from Database
//         const { apiKey, apiSecret } = await getApiKeysFromDatabase(userId);
//         if (!apiKey || !apiSecret) {
//           throw new Error("API credentials not found for user.");
//         }
//         console.log(`Using API Key: ${apiSecret}`);

//         // ✅ Initialize Binance Spot client
//         const client = new Spot(apiKey, apiSecret, { baseURL: 'https://testnet.binance.vision' });
//         console.log("✅ Binance Client Initialized:", JSON.stringify(client, null, 2));
//         console.log(`Attempting to sell ${symbol} for user ${userId}`);
    
//         // Fetch account information
//         const accountInfo = await client.account();
//         console.log("Account Balances:", accountInfo.data.balances); // ✅ Debugging step
    
//         // ✅ Convert symbol correctly
//         const assetCode = symbol.replace('USDT', '').toUpperCase();
//         const assetBalance = accountInfo.data.balances.find(b => b.asset === assetCode);
    
//         if (!assetBalance || parseFloat(assetBalance.free) === 0) {
//           console.log(`No balance available to sell for ${symbol}`);
//           return;
//         }
    
//         console.log(`Available balance for ${symbol}: ${assetBalance.free}`);
    
//         // ✅ Place a Market Sell Order
//         const availableQty = parseFloat(assetBalance.free);
//         const response = await client.newOrder(symbol, 'SELL', 'MARKET', { quantity: availableQty });
    
//         if (response.data && response.data.status === 'FILLED') {
//           console.log(`Successfully sold ${availableQty} of ${symbol}:`, response.data);
    
//           // Update trade status to inactive for this symbol
//           const [result] = await connection.execute(
//             'UPDATE orders SET tradeStatus = ? WHERE symbol = ? AND userId = ?',
//             ['inactive', symbol, userId]
//           );
    
//           if (result.affectedRows > 0) {
//             console.log(`Order for ${symbol} updated to inactive`);
//           } else {
//             console.log(`No order found for ${symbol} to update`);
//           }
//         } else {
//           console.log(`Order for ${symbol} was not filled`, response.data);
//         }
//       } catch (error) {
//         console.error(`Error processing ${symbol}:`, error.response?.data || error.message);
//       }
    
// }


function futuresBalanceAsync(binance) {
  return new Promise((resolve, reject) => {
    binance.futuresBalance((err, balances) => {
      if (err) {
        console.error("Error in futuresBalance:", err);
        return reject(err);
      }
      console.log("Balances retrieved:", balances);
      resolve(balances);
    });
  });
}

// Promise wrapper for callback-based futuresOrder
function futuresOrderAsync(binance, side, symbol, quantity, options) {
  return new Promise((resolve, reject) => {
    binance.futuresOrder(side, symbol, quantity, options, (err, orderResponse) => {
      if (err) {
        console.error("Error placing futures order:", err);
        return reject(err);
      }
      resolve(orderResponse);
    });
  });
}

async function cancelOrder(req, res) {
  // Extract symbol and marketType from request body.
  // marketType should be 'spot' or 'future'. Defaults to 'spot'.
  const { symbol, marketType = 'spot' } = req.body;
  const userId = 69;
  console.log('symbol:-',symbol);
  if (!symbol) {
    console.log(`No symbol provided for user ${userId}`);
    return res.status(400).json({ success: false, error: 'No symbol provided' });
  }
  
  try {
    // Fetch API keys from the database.
    const { apiKey, apiSecret } = await getApiKeysFromDatabase(userId);
    if (!apiKey || !apiSecret) {
      throw new Error("API credentials not found for user.");
    }
    console.log(`Using API credentials for user ${userId}`);
    
    if (marketType === 'future') {
      // FUTURES TRADING: Use node-binance-api for futures.
    // Initialize the Binance Futures client
    const client = new UMFutures({
      api_key: apiKey,
      api_secret: apiSecret,
      // The connector automatically uses the correct endpoint based on the options,
      // but if needed you can override with something like:
      baseUrl: 'https://testnet.binancefuture.com',
      test: true, // enable test mode
      // Other options may be added as needed
    });

    async function getOpenOrderId(symbol) {
      try {
        const timestamp = Date.now();
        const query = `symbol=${symbol}&timestamp=${timestamp}`;
        const signature = crypto.createHmac('sha256', apiSecret).update(query).digest('hex');
        
        const url = `${baseUrl}/fapi/v1/openOrders?${query}&signature=${signature}`;
        const headers = { 'X-MBX-APIKEY': apiKey };
        
        const response = await axios.get(url, { headers });
        const openOrders = response.data;
        
        console.log("Open Orders:", openOrders);
              } catch (error) {
        throw new Error(
          "Error retrieving open orders: " +
            (error.response ? JSON.stringify(error.response.data) : error.message)
        );
      }
    }
    const baseUrl = "https://testnet.binancefuture.com";
    async function forceClosePosition(symbol) {
      try {
        const timestamp = Date.now();
        const headers = { 'X-MBX-APIKEY': apiKey };
    
        // Step 1: Get all positions
        const positionQuery = `timestamp=${timestamp}`;
        const positionSignature = crypto.createHmac('sha256', apiSecret).update(positionQuery).digest('hex');
        const positionUrl = `${baseUrl}/fapi/v2/positionRisk?${positionQuery}&signature=${positionSignature}`;
    
        const posRes = await axios.get(positionUrl, { headers });
    
        // Step 2: Find position for the given symbol
        const position = posRes.data.find(p => p.symbol === symbol.toUpperCase());
        if (!position) {
          return console.log(`❌ No position found for ${symbol}`);
        }
    
        const positionAmt = parseFloat(position.positionAmt);
        if (positionAmt === 0) {
          return console.log(`✅ No open position for ${symbol}`);
        }
    
        const side = positionAmt > 0 ? 'SELL' : 'BUY';
        const quantity = Math.abs(positionAmt);
    
        // Step 3: Submit market close order
        const orderTimestamp = Date.now();
        const orderQuery = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${quantity}&reduceOnly=true&timestamp=${orderTimestamp}`;
        const orderSignature = crypto.createHmac('sha256', apiSecret).update(orderQuery).digest('hex');
        const orderUrl = `${baseUrl}/fapi/v1/order?${orderQuery}&signature=${orderSignature}`;
    
        const orderRes = await axios.post(orderUrl, null, { headers });
    
        console.log(`✅ ${symbol} position force closed:`, orderRes.data);
      } catch (err) {
        console.error(`❌ Failed to close ${symbol} position:`, err.response?.data || err.message);
      }
    }
   
    console.log("Futures client initialized using @binance/futures-connector.");
   
    async function fetchFuturesAccountInfo() {
      try {
        const recvWindow = 10000;
        const endpoint = `${baseUrl}/fapi/v2/account`;
        const timestamp = Date.now();
        const queryString = `timestamp=${timestamp}&recvWindow=${recvWindow}`;
        const signature = crypto
          .createHmac("sha256", apiSecret)
          .update(queryString)
          .digest("hex");
    
        const url = `${endpoint}?${queryString}&signature=${signature}`;
        const headers = {
          "X-MBX-APIKEY": apiKey,
        };
    console.log('apikey',apiKey);
        const response = await axios.get(url, { headers });
        return response.data; // Contains account info, including positions
      } catch (error) {
        throw new Error(
          error.response ? JSON.stringify(error.response.data) : error.message
        );
      }
    }
    
    // Main async function to close the futures position
    (async () => {
      try {
        console.log("Fetching futures positions...");
    
        // Retrieve futures account info manually
        const accountInfo = await fetchFuturesAccountInfo();
        // console.log("Account Info:", accountInfo);
    
        // Extract positions from account info (adjust if needed)
        const positions = accountInfo.positions;
        if (!positions) {
          console.error("Positions not found in account info.");
          return res.status(500).json({
            success: false,
            message: "Positions data missing",
          });
        }
    
        // Find the position for the given symbol
        const position = positions.find((p) => p.symbol === symbol);
        if (!position) {
          console.log(`No position found for ${symbol}`);
          return res.status(400).json({
            success: false,
            message: `No open position for ${symbol}`,
          });
        }
    
        // Parse the current position amount
        const positionAmt = parseFloat(position.positionAmt);
        if (positionAmt === 0) {
          console.log(`No open position to close for ${symbol}`);
          return res.status(400).json({
            success: false,
            message: `No open position for ${symbol}`,
          });
        }
    
        // Determine the side to close:
        // - If you're long (positionAmt > 0), you'll sell to close.
        // - If you're short (positionAmt < 0), you'll buy to close.
        const closeSide = positionAmt > 0 ? "SELL" : "BUY";
        const quantity = Math.abs(positionAmt); // Always use a positive number
    
        console.log(
          `Closing position for ${symbol}: positionAmt=${positionAmt}. Placing ${closeSide} order for ${quantity}.`
        );
        forceClosePosition(symbol);
    const orderId = await getOpenOrderId(symbol);
    console.log("Retrieved order ID:", orderId);
    const cancelResponse = await client.cancelOrder({ symbol, orderId });
    console.log("Order cancellation response:", cancelResponse.data);
        // Define the order parameters
        // const orderParams = {
        //   symbol, // e.g., 'BTCUSDT'
        //   side: closeSide, // "BUY" or "SELL"
        //   type: "MARKET",
        //   quantity, // The quantity to close the position
        //   reduceOnly: true,
        // };
    
        // console.log("Order parameters:", orderParams);
    
        // // Place the market order to close the position using the UMFutures client
        // const orderResponse = await client.newOrder(
        //   symbol,       // e.g., "BTCUSDT"
        //   closeSide,    // "BUY" or "SELL"
        //   "MARKET",     // Order type
        //   { 
        //     quantity,   // The quantity to close the position
        //     reduceOnly: true
        //   }
        // );
        // console.log(`Close trade order response for ${symbol}:`, orderResponse);
       
        // Check the order response. Adjust this check based on the actual response structure.
        // Here we assume that a successfully executed order returns orderResponse.data.status === 'FILLED'
        if (orderResponse && orderResponse.data && orderResponse.data.status === "FILLED") {
          try {
            // Example: Update your database (adjust SQL as needed)
            const [result] = await connection.execute(
              "UPDATE future_orders SET tradeStatus = ? WHERE symbol = ? AND userId = ?",
              ["inactive", symbol, userId]
            );
            if (result.affectedRows > 0) {
              console.log(`Futures order for ${symbol} updated to inactive`);
            } else {
              console.log(`No matching futures order found for ${symbol} to update`);
            }
            return res.status(200).json({ success: true, data: orderResponse });
          } catch (dbError) {
            console.error("Database update error:", dbError);
            return res.status(500).json({ success: false, error: dbError });
          }
        } else {
          console.log(`Close order for ${symbol} was not filled`, orderResponse);
          return res.status(500).json({
            success: false,
            message: "Close order not filled",
            data: orderResponse,
          });
        }
      } catch (error) {
        console.error(
          "Error closing trade:",
          error.response ? error.response.data : error.message
        );
        return res.status(500).json({
          success: false,
          error: error.response ? error.response.data : error.message,
        });
      }
    })();
    } else {
      // SPOT TRADING: Do not change the spot trading code.
      const client = new Spot(apiKey, apiSecret, { baseURL: 'https://testnet.binance.vision' });
      console.log("Spot client initialized.");
      
      const accountInfo = await client.account();
      console.log("Account Info:", accountInfo.data.balances);
      
      const assetCode = symbol.replace('USDT', '').toUpperCase();
      const assetBalance = accountInfo.data.balances.find(b => b.asset === assetCode);
      if (!assetBalance || parseFloat(assetBalance.free) === 0) {
        console.log(`No available balance to sell for ${symbol}`);
        return res.status(400).json({ success: false, message: `No balance available for ${symbol}` });
      }
      console.log(`Available balance for ${symbol}: ${assetBalance.free}`);
      const availableQty = parseFloat(assetBalance.free);
      
      let orderResponse = await client.newOrder(symbol, 'SELL', 'MARKET', { quantity: availableQty });
      if (orderResponse.data && orderResponse.data.status === 'FILLED') {
        console.log(`Successfully sold ${availableQty} of ${symbol}:`, orderResponse.data);
        const [result] = await connection.execute(
          'UPDATE orders SET tradeStatus = ? WHERE symbol = ? AND userId = ?',
          ['inactive', symbol, userId]
        );
        if (result.affectedRows > 0) {
          console.log(`Order for ${symbol} updated to inactive`);
        } else {
          console.log(`No matching order found for ${symbol} to update`);
          return res.status(400).json({ success: false, message: `No matching order found for ${symbol} to update`});
        }
        return res.status(200).json({ success: true, data: orderResponse.data });
      } else {
        console.log(`Order for ${symbol} was not filled`, orderResponse.data);
        return res.status(500).json({ success: false, message: 'Order not filled', data: orderResponse.data });
      }
    }
  } catch (error) {
    console.error(`Error processing ${symbol}:`, error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to cancel order',
      details: error.response?.data || error.message,
    });
  }
}

// async function getClosedTrades(req, res) {
//   const userId = 69; // Example userId, update based on req.user if needed.
//   if (!userId) {
//     return res.status(400).json({ success: false, error: 'User ID is required.' });
//   }

//   try {
//     // 1. Fetch closed trades from the database.
//     const query = `
//       SELECT *
//       FROM orders
//       WHERE userId = ? AND tradeStatus = ?
//       ORDER BY transact_time ASC
//     `;
//     const [closedTrades] = await connection.query(query, [userId, 'inactive']);

//     if (!closedTrades.length) {
//       return res.status(404).json({ success: false, message: 'No closed trades found.' });
//     }

//     // 2. Coin symbol mapping for CoinGecko
//     const coinGeckoMapping = {
//       btc: "bitcoin",
//       eth: "ethereum",
//       xrp: "ripple",
//       bnb: "binancecoin",
//       sol: "solana",
//       doge: "dogecoin",
//       ada: "cardano",
//       trx: "tron",
//       avax: "avalanche-2",
//       sui: "sui",
//       ton: "toncoin",
//       link: "chainlink",
//       shib: "shiba-inu",
//       wbtc: "wrapped-bitcoin",
//       xlm: "stellar",
//       hbar: "hedera-hashgraph",
//       dot: "polkadot",
//       bch: "bitcoin-cash",
//       ltc: "litecoin",
//     };

//     // 3. Extract unique coin symbols
//     const symbols = closedTrades.map(order =>
//       order.symbol.replace('USDT', '').toLowerCase()
//     );
//     const uniqueSymbols = [...new Set(symbols)];

//     // 4. Get CoinGecko IDs
//     const coinIds = uniqueSymbols
//       .map(symbol => coinGeckoMapping[symbol])
//       .filter(id => id !== undefined);

//     // 5. Fetch live prices from CoinGecko
//     const coinGeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(
//       ','
//     )}&vs_currencies=usd`;
//     const priceResponse = await axios.get(coinGeckoUrl);
//     const livePrices = priceResponse.data;

//     // 6. Attach live prices to closed trades
//     const ordersWithPrices = closedTrades.map(order => {
//       const code = order.symbol.replace('USDT', '').toLowerCase();
//       const coinId = coinGeckoMapping[code];
//       const realPrice =
//         coinId && livePrices[coinId] && livePrices[coinId].usd
//           ? livePrices[coinId].usd
//           : order.price;
//       return { ...order, realPrice };
//     });

//     // 7. Retrieve the oldest closed trade for each coin.
//     const firstClosedTradesPerCoin = [];
//     const seenCoins = new Set();
//     for (const trade of ordersWithPrices) {
//       const coinCode = trade.symbol.replace('USDT', '').toLowerCase();
//       if (!seenCoins.has(coinCode)) {
//         seenCoins.add(coinCode);
//         firstClosedTradesPerCoin.push(trade);
//       }
//     }

//     // 8. Sum the closed trade amounts per coin.
//     const sumQuery = `
//       SELECT REPLACE(LOWER(symbol), 'usdt', '') AS coinCode, SUM(orig_qty*price) AS totalAmount
//       FROM orders
//       WHERE userId = ? AND tradeStatus = 'inactive'
//       GROUP BY coinCode
//     `;
//     const [sumResults] = await connection.query(sumQuery, [userId]);

//     // 9. Return the closed trades and total amounts.
//     return res.status(200).json({
//       success: true,
//       closedTrades: firstClosedTradesPerCoin,
//       sumClosedTradesByCoin: sumResults,
//     });
//   } catch (error) {
//     console.error('Error fetching closed trades:', error.message);
//     return res.status(500).json({
//       success: false,
//       error: 'Failed to fetch closed trades',
//       details: error.message,
//     });
//   }
// }

async function getClosedTrades(req, res) {
  const userId = 69; // Example userId; in production, you might get this from authentication.
  // Extract marketType from request body (or req.query); defaults to "spot"
  const marketType = req.query.marketType || 'spot';

  // console.log('Market Type:',req.query.marketType);
  // Determine which table to use based on market type.
  const tableName = marketType === 'future' ? 'future_orders' : 'orders';

  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required.' });
  }

  try {
    // 1. Fetch closed trades from the appropriate table.
    const query = `
      SELECT *
      FROM ${tableName}
      WHERE userId = ? AND tradeStatus = ?
      ORDER BY transact_time ASC
    `;
    const [closedTrades] = await connection.query(query, [userId, 'inactive']);

    if (!closedTrades.length) {
      return res.status(404).json({ success: false, message: 'No closed trades found.' });
    }

    // 2. Define coin symbol mapping for CoinGecko.
    const coinGeckoMapping = {
      btc: "bitcoin",
      eth: "ethereum",
      xrp: "ripple",
      bnb: "binancecoin",
      sol: "solana",
      doge: "dogecoin",
      ada: "cardano",
      trx: "tron",
      avax: "avalanche-2",
      sui: "sui",
      ton: "toncoin",
      link: "chainlink",
      shib: "shiba-inu",
      wbtc: "wrapped-bitcoin",
      xlm: "stellar",
      hbar: "hedera-hashgraph",
      dot: "polkadot",
      bch: "bitcoin-cash",
      ltc: "litecoin",
    };

    // 3. Extract unique coin symbols from closedTrades.
    const symbols = closedTrades.map(order =>
      order.symbol.replace('USDT', '').toLowerCase()
    );
    const uniqueSymbols = [...new Set(symbols)];

    // 4. Get CoinGecko IDs for these symbols.
    const coinIds = uniqueSymbols
      .map(symbol => coinGeckoMapping[symbol])
      .filter(id => id !== undefined);

    // 5. Fetch live prices from CoinGecko.
    const coinGeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(
      ','
    )}&vs_currencies=usd`;
    const priceResponse = await axios.get(coinGeckoUrl);
    const livePrices = priceResponse.data;

    // 6. Attach live prices to closed trades.
    const ordersWithPrices = closedTrades.map(order => {
      const code = order.symbol.replace('USDT', '').toLowerCase();
      const coinId = coinGeckoMapping[code];
      const realPrice =
        coinId && livePrices[coinId] && livePrices[coinId].usd
          ? livePrices[coinId].usd
          : order.price;
      return { ...order, realPrice };
    });

    // 7. Retrieve the oldest closed trade per coin.
    const firstClosedTradesPerCoin = [];
    const seenCoins = new Set();
    for (const trade of ordersWithPrices) {
      const coinCode = trade.symbol.replace('USDT', '').toLowerCase();
      if (!seenCoins.has(coinCode)) {
        seenCoins.add(coinCode);
        firstClosedTradesPerCoin.push(trade);
      }
    }

    // 8. Sum the closed trade amounts per coin.
    const sumQuery = `
      SELECT REPLACE(LOWER(symbol), 'usdt', '') AS coinCode, SUM(orig_qty * price) AS totalAmount
      FROM ${tableName}
      WHERE userId = ? AND tradeStatus = 'inactive'
      GROUP BY coinCode
    `;
    const [sumResults] = await connection.query(sumQuery, [userId]);
  // console.log('done:',firstClosedTradesPerCoin);
    // 9. Return the closed trades and the summed amounts.
    return res.status(200).json({
      success: true,
      closedTrades: firstClosedTradesPerCoin,
      sumClosedTradesByCoin: sumResults,
    });
  } catch (error) {
    console.error('Error fetching closed trades:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch closed trades',
      details: error.message,
    });
  }
}




 module.exports = { getAccountInfo, placeOrder, monitorPrice, getActiveTrades, cancelOrder ,getClosedTrades};
