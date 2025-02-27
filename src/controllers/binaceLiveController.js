// binancePrices.js
const WebSocket = require('ws');

// Global object to store live prices (keyed by coin symbol, e.g., 'btc')
const livePrices = {};

// Mapping from our coin keys to Binance symbol endpoints.
// For example, for BTC we expect Binance's stream "btcusdt@aggTrade".
const binanceSymbols = {
  btc: 'btcusdt',
  eth: 'ethusdt',
  xrp: 'xrpusdt',
  bnb: 'bnbusdt',
  sol: 'solusdt',
  doge: 'dogeusdt',
  ada: 'adausdt',
  trx: 'trxusdt',
  avax: 'avaxusdt',
  sui: 'suiusdt',      // Adjust if needed.
  ton: 'tonusdt',      // Adjust if needed.
  link: 'linkusdt',
  shib: 'shibusdt',
  wbtc: 'wbtcusdt',
  xlm: 'xlmusdt',
  hbar: 'hbarusdt',
  dot: 'dotusdt',
  bch: 'bchusdt',
  ltc: 'ltcusdt'
};

// List of coin keys we want to subscribe to.
const coinsToSubscribe = Object.keys(binanceSymbols);

// Build combined stream URL.
const streams = coinsToSubscribe
  .map(coin => `${binanceSymbols[coin].toLowerCase()}@aggTrade`)
  .join('/');
const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;

console.log('Connecting to Binance WebSocket:', wsUrl);
const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log(`Connected to Binance WebSocket for: ${coinsToSubscribe.join(', ')}`);
});

ws.on('message', (data) => {
  try {
    const parsed = JSON.parse(data);
    // For combined streams, we expect messages of the form:
    // { stream: "btcusdt@aggTrade", data: { ... } }
    if (parsed && parsed.stream && parsed.data) {
      const stream = parsed.stream; // e.g., "btcusdt@aggTrade"
      const trade = parsed.data;
      // Extract coin key: remove '@aggTrade' and 'usdt'
      // Example: "btcusdt@aggTrade" => "btcusdt" => "btc"
      const symbol = trade.s.toLowerCase(); // e.g., "btcusdt"
      const coinKey = symbol.replace('usdt', '');
      // trade.p is the price (as a string); update our livePrices object.
      livePrices[coinKey] = parseFloat(trade.p);
      // Optionally log the update:
      // console.log(`Updated live price for ${coinKey}: ${livePrices[coinKey]}`);
    }
  } catch (err) {
    console.error('Error processing Binance WebSocket message:', err);
  }
});

ws.on('close', () => {
  console.log('Binance WebSocket connection closed.');
});

ws.on('error', (err) => {
  console.error('Binance WebSocket error:', err);
});

module.exports = { livePrices };
