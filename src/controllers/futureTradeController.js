const Binance = require('node-binance-api');
const axios = require('axios');
const WebSocket = require('ws');
const connection = require('../config/database');
const https = require('https');
const agent = new https.Agent({ family: 4 });
const { analyzeMarketTrend, fetchTopCoinsFromDatabase } = require('../controllers/marketAiBotController');
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
        useServerTime: true,
        test: true,  // Ensure it's set to true for Binance Testnet
        BASE_URL: 'https://testnet.binancefuture.com/api', // Testnet URL
        recvWindow: 10000,  
        httpsAgent: agent,       // <-- ADDED: Use our HTTPS agent
        family: 4                // <-- ADDED: Explicitly set family to 4
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
    const userId = 69;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        // Fetch API Keys from database
        const [rows] = await connection.query('SELECT * FROM api_keys WHERE userId = ?', [userId]);

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
            success: true,
            message: 'Future Trade Data Fetch Successfully',
            publicIP: publicIP,
            tradingData: tradingData,
        };

        res.status(200).json(result);
    } catch (error) {
        console.error('Error in getFutureAccountInfo:', error.message);
        res.status(500).json({ error: 'Failed to fetch account info', details: error.message });
    }
}

// Place Futures Order
async function placeFuturesOrder(req, res, orderType) {
    const userId = 69;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        // Fetch API Keys from the database
        const [rows] = await connection.query('SELECT * FROM api_keys WHERE userId = ?', [userId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'API keys not found' });
        }

        const { apiKey, apiSecret } = rows[0];
        console.log('API Keys Fetched:', { apiKey, apiSecret });

        const binance = new Binance().options({
            APIKEY: apiKey,
            APISECRET: apiSecret,
            useServerTime: true,
            test: true,
            BASE_URL: 'https://testnet.binancefuture.com/api', // Testnet URL
            recvWindow: 10000,  
            httpsAgent: agent,       // <-- ADDED: Use our HTTPS agent forcing IPv4
            family: 4                // <-- ADDED: Explicitly set family to 4
        });
        const coins = await fetchTopCoinsFromDatabase();
        const { trendData, bullishCoin, bearishCoin } = await analyzeMarketTrend(coins);

        // const symbol = 'TRXUSDT';
        const symbol =bullishCoin.coin.toUpperCase() +"USDT";
        // Fetch Real-Time Price using WebSocket
        
        const currentPrice = await fetchRealTimePrice(symbol);
        console.log("✅ Current Price Fetched:", currentPrice);

        // Fetch Exchange Info for Futures (e.g., minimum lot size)
        const exchangeInfo = await binance.exchangeInfo();
        const symbolInfo = exchangeInfo.symbols.find((s) => s.symbol === symbol);
        if (!symbolInfo) {
            return res.status(404).json({ error: `Symbol ${symbol} not found` });
        }

        const lotSizeFilter = symbolInfo.filters.find(filter => filter.filterType === 'LOT_SIZE');
        const stepSize = parseFloat(lotSizeFilter.stepSize);
        const minLotSize = parseFloat(lotSizeFilter.minQty);

        // Calculate the quantity to order
        let quantityToOrder = (6 / currentPrice).toFixed(8); // Example quantity based on price
        quantityToOrder = Math.floor(quantityToOrder / stepSize) * stepSize;

        if (quantityToOrder < minLotSize) {
            return res.status(400).json({ error: `Quantity too low. Minimum required: ${minLotSize}` });
        }

        // Place Futures Order
        const orderParams = {
            symbol: symbol,
            side: orderType.toUpperCase(),
            type: 'MARKET',
            quantity: quantityToOrder,
            leverage: 3,          // Example leverage
            timeInForce: 'GTC',   // Not used in market orders but kept for reference
          };
          
          // Set the leverage for the symbol (this call is required if you need to set leverage)
          await binance.futuresLeverage(orderParams.symbol, orderParams.leverage);
          
          let orderResponse;
          
          // Place the order based on the order type using the values from orderParams
          if (orderType.toLowerCase() === 'buy') {
            orderResponse = await binance.futuresMarketBuy(orderParams.symbol, orderParams.quantity);
          } else if (orderType.toLowerCase() === 'sell') {
            orderResponse = await binance.futuresMarketSell(orderParams.symbol, orderParams.quantity);
          } else {
            throw new Error('Invalid order type');
          }
          
          console.log("Future Order Placed Successfully:", orderResponse);

        // Save order to the database
       let orderTime;
if (orderResponse.transactTime) {
  const parsedTime = Number(orderResponse.transactTime);
  orderTime = !isNaN(parsedTime) ? new Date(parsedTime) : new Date();
} else {
  orderTime = new Date();
}
const orderTimeISOString = orderTime.toISOString();

// Prepare order details for saving to the database
const insertQuery = `
  INSERT INTO future_orders (
    userId, symbol, order_id, client_order_id, transact_time, price,
    orig_qty, status, side, type, leverage, trade_status, time_in_force
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;

const values = [
  userId,
  symbol,
  orderResponse.orderId || null,        // order ID
  orderResponse.clientOrderId || null,    // client order ID
  orderTimeISOString,                     // normalized transactTime
  currentPrice,
  orderResponse.origQty || quantityToOrder,
  orderResponse.status || 'N/A',          // order status (fallback)
  orderResponse.side || orderType.toUpperCase(),
  'MARKET',
  3,                                      // leverage
  'active',                               // trade status
  'GTC',                                  // time in force
];


        const [results] = await connection.execute(insertQuery, values);
        console.log('Future order saved to database:', results);

        return res.status(200).json({ message: 'Future market order placed and saved successfully.', orderResponse });
    } catch (error) {
        console.error('Error placing future order:', error.message);
        return res.status(500).json({ error: 'Failed to place future order', details: error.message });
    }
}

// Fetch real-time price from WebSocket
async function fetchRealTimePrice(symbol) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`wss://fstream.binance.com/ws/${symbol.toLowerCase()}@trade`);
        let currentPrice = null;

        ws.on('message', (data) => {
            try {
                const tradeData = JSON.parse(data);
                const price = parseFloat(tradeData.p);
                if (!isNaN(price)) {
                    currentPrice = price;
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

        ws.on('close', () => {
            console.log('WebSocket connection closed');
        });
    });
}


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
            return;
        }
       
        const symbol =bullishCoin.coin.toUpperCase() +"USDT";
        console.log(symbol);
        const [orders] = await connection.query(
                 'SELECT * FROM future_orders WHERE userId = ? AND side = ? AND trade_status = ? AND symbol = ? ORDER BY transact_time DESC LIMIT 1',
            [userId, 'BUY', 'active',symbol]
        );
                                         
        if (orders.length === 0) {
            const message = 'No orders found for this user';
            if (res) return res.status(404).json({ message });
            console.log(message);
            await placeFuturesOrder(req, res, 'buy');
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
            await   placeFuturesOrder(req, res, 'sell');

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
            await placeFuturesOrder(req, res, 'buy');
        }
    } catch (error) {
        console.error('Error monitoring price:', error.message);
        if (res) res.status(500).json({ error: error.message });
    }
}
module.exports = { getFutureAccountInfo, placeFuturesOrder,monitorPrice };
