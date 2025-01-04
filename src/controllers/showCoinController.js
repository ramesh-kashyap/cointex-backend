const WebSocket = require('ws');

const showCoin = async (req, res) => {
    const url = "wss://stream.binance.com:9443/stream?streams=btcusdt@trade/ethusdt@trade/bnbusdt@trade/adausdt@trade/xrpusdt@trade/solusdt@trade";

    const ws = new WebSocket(url);
    const tradeData = [];

    ws.on('open', () => {
        console.log("WebSocket connection opened");
    });

    ws.on('message', (data) => {
        const message = JSON.parse(data);
        const { stream, data: trade } = message;

        // Extract coin pair (e.g., btcusdt) from the stream
        const coinPair = stream.split('@')[0].toUpperCase();

        tradeData.push({
            stream: coinPair,
            price: trade.p,
            quantity: trade.q,
            time: new Date(trade.T).toLocaleTimeString(),
        });

        if (tradeData.length >= 10) {
            ws.close();
            res.json(tradeData);
        }
    });

    ws.on('error', (error) => {
        console.error("WebSocket error:", error);
        res.status(500).send("WebSocket connection error");
    });

    ws.on('close', (code, reason) => {
        console.log(`WebSocket closed (Code: ${code}, Reason: ${reason})`);
    });
};

module.exports = { showCoin };
