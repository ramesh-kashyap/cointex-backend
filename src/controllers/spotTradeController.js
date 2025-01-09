const { Spot } = require('@binance/connector');
const crypto = require('crypto');
const axios = require('axios');
const WebSocket = require('ws');
const connection = require('../config/database'); // Database connection
const BASE_URL = 'https://testnet.binance.vision';

// Helper function to create a signature
function createSignature(queryString, apiSecret) {
    return crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
}

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
async function buyTRX(apiKey, apiSecret, quantity) {
    const endpoint = '/api/v3/order';
    const params = {
        symbol: 'TRXUSDT',         // Symbol for TRX/USDT pair
        side: 'BUY',               // Specify buy order
        type: 'MARKET',            // Market order type
        quantity: quantity,       // Quantity to buy
    };

    try {
        const order = await binanceRequest('POST', endpoint, params, apiKey, apiSecret);
        console.log('Buy Order Response:', order);
        return order;
    } catch (error) {
        console.error('Failed to place buy order:', error.response?.data || error.message);
        throw error;
    }
}

// Real-time price tracking with WebSocket
async function startRealTimePriceTracking(apiKey, apiSecret) {
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/trxusdt@trade');

    ws.on('open', () => {
        console.log('WebSocket connected for TRX/USDT');
    });

    ws.on('message', async (data) => {
        const tradeData = JSON.parse(data);
        const tradePrice = parseFloat(tradeData.p); // Real-time market price
        console.log('Real-time TRX price:', tradePrice);

        // Close WebSocket to avoid duplicate orders
        ws.close();

        try {
            // Fetch TRX/USDT trading rules
            const trxSymbolInfo = await binanceRequest('GET', '/api/v3/exchangeInfo', {}, apiKey, apiSecret)
                .then(info => info.symbols.find(symbol => symbol.symbol === 'TRXUSDT'));

            const lotSizeFilter = trxSymbolInfo.filters.find(filter => filter.filterType === 'LOT_SIZE');
            const minLotSize = parseFloat(lotSizeFilter.minQty);
            const stepSize = parseFloat(lotSizeFilter.stepSize);

            // Calculate quantity to buy with 5 USDT
            let quantityToBuy = (5 / tradePrice).toFixed(8); // 5 USDT worth of TRX
            quantityToBuy = Math.floor(quantityToBuy / stepSize) * stepSize; // Adjust to step size

            if (quantityToBuy >= minLotSize) {
                console.log(`Placing market buy order for ${quantityToBuy} TRX`);
                await buyTRX(apiKey, apiSecret, quantityToBuy);
            } else {
                console.error(`Quantity too low to buy. Minimum required: ${minLotSize}`);
            }
        } catch (error) {
            console.error('Error during buy process:', error.response?.data || error.message);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });
}

// Fetch account information
async function getAccountInfo(req, res) {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const { apiKey, apiSecret } = await getApiKeysFromDatabase(userId);
        const accountInfo = await binanceRequest('GET', '/api/v3/account', {}, apiKey, apiSecret);

        const usdtBalance = accountInfo.balances.find(balance => balance.asset === 'USDT');
        res.json({
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
async function startPriceTracking(req, res) {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const { apiKey, apiSecret } = await getApiKeysFromDatabase(userId);
        await startRealTimePriceTracking(apiKey, apiSecret);
        res.json({ message: 'Price tracking started successfully' });
    } catch (error) {
        console.error('Error starting price tracking:', error.message);
        res.status(500).json({ error: 'Failed to start price tracking', details: error.message });
    }
}
let orderPlaced = false; // Flag to prevent duplicate orders
// Generic function to place a buy or sell order for TRX
async function placeOrder(req, res, orderType) {
    const userId = 4;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
   
    try {
        const { apiKey, apiSecret } = await getApiKeysFromDatabase(userId);
        const client = new Spot(apiKey, apiSecret, { baseURL: 'https://testnet.binance.vision' });

        const symbol = 'TRXUSDT';
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
            price: currentPrice,
            quantity: quantityToOrder.toFixed(2),
            timeInForce: 'GTC',
            recvWindow: 10000,
        };        
        console.log('check o:',orderParams);
        orderSymbol=symbol;
        const orderResponse = await client.newOrder(symbol, orderType.toUpperCase(), 'LIMIT', orderParams);
        console.log('Order placed successfully:', orderResponse.data);
        // orderPlaced = true;
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
        const Symbol = 'TRXUSDT';
        const values = [
            Symbol,          // Use the already defined `symbol`
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
            side
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const [results] = await connection.execute(insertQuery, values);

    console.log('Order saved to database:', results);
    } catch (error) {
        console.error(`Error placing ${orderType} order:`, error.message);
        return res.status(500).json({ error: `Failed to place ${orderType} order`, details: error.message });
    }
}



async function monitorPrice(req , res ) {
    try {
        const userId = 4;
        console.log('Extracted userId:', userId);  // Log userId for debugging
        
        if (!userId) {
            const message = 'User ID is required';
            if (res) return res.status(400).json({ error: message });
            console.log(message);
            return;
        }

        const [orders] = await connection.query(
                 'SELECT * FROM orders WHERE userId = ? AND side = ? AND tradeStatus = ? ORDER BY transact_time DESC LIMIT 1',
            [userId, 'BUY', 'active']
        );

        if (orders.length === 0) {
            const message = 'No orders found for this user';
            if (res) return res.status(404).json({ message });
            console.log(message);
            return;
        }

        const previousBuyPrice = parseFloat(orders[0].price);
        const quantity = parseFloat(orders[0].orig_qty);
        const previousUSDT = quantity * previousBuyPrice;
        const orderId = orders[0].id;
        if (res) res.json({ orders }); // Optional early response for debugging

        const symbol = 'TRXUSDT';
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

        if (priceChangePercentage >= 0.1) {
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




module.exports = { getAccountInfo, startPriceTracking, placeOrder, monitorPrice };
