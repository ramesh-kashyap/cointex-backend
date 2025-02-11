const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const SECRET_KEY = 'my_secret_key';

// In-memory user database (for demo purposes)
const users = [{ username: 'admin', password: 'password123' }];

// Login Endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        const token = jwt.sign({ username: user.username }, SECRET_KEY, { expiresIn: '1h' });
        console.log('Login successful:', user.username);
        res.json({ message: 'Login successful', token });
    } else {
        console.log('Invalid login attempt:', username);
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

// Middleware to verify JWT
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) {
        console.log('No token provided');
        return res.sendStatus(401);
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.log('Invalid token');
            return res.sendStatus(403);
        }
        console.log('Token verified for user:', user.username);
        req.user = user;
        next();
    });
}

// Function to fetch real-time Bitcoin price data from CoinGecko
async function fetchPriceData() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart', {
            params: {
                vs_currency: 'usd',
                days: '30', // Updated to fetch 30 days of data
                interval: 'hourly'
            }
        });
        console.log('Price data fetched successfully');
        return response.data.prices.map(price => price[1]);
    } catch (error) {
        console.error('Error fetching price data:', error);
        return [100, 95, 90, 85, 92, 97, 102, 98, 93, 88, 84, 89, 95]; // Fallback data
    }
}

// Enhanced AI Decision Model
function aiDecisionModel(price, recentPrices) {
    const averagePrice = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const volatility = Math.max(...recentPrices) - Math.min(...recentPrices);

    console.log(`Price: $${price}, Average: $${averagePrice.toFixed(2)}, Volatility: $${volatility.toFixed(2)}`);

    if (price < averagePrice * 0.95 && volatility > 5) {
        console.log('Decision: Strong Buy (2x)');
        return 2; // Increase buy if price is low and volatility is high
    } else if (price < averagePrice * 0.95) {
        console.log('Decision: Moderate Buy (1.5x)');
        return 1.5; // Moderate buy on dip
    } else if (price > averagePrice * 1.05 && volatility < 3) {
        console.log('Decision: Reduce Buy (0.3x)');
        return 0.3; // Reduce buy if price is high and stable
    } else {
        console.log('Decision: Normal Buy (1x)');
        return 1; // Normal buy
    }
}

// AI-Powered DCA Strategy (Protected Route)
const ai_dca = async(req, res) => {
    const priceData = await fetchPriceData();

    const baseInvestment = 100;
    const profitTarget = 0.12; // Slightly increased profit target
    const stopLoss = 0.15; // Reduced stop-loss for better risk management

    let totalInvested = 0;
    let coinsHeld = 0;
    let totalCost = 0;

    priceData.forEach((price, index) => {
        const recentPrices = priceData.slice(Math.max(0, index - 5), index + 1);
        const investmentMultiplier = aiDecisionModel(price, recentPrices);
        const investmentAmount = baseInvestment * investmentMultiplier;
        const coinsBought = investmentAmount / price;

        console.log(`Investing $${investmentAmount.toFixed(2)} to buy ${coinsBought.toFixed(4)} coins at $${price}`);

        totalInvested += investmentAmount;
        coinsHeld += coinsBought;
        totalCost += investmentAmount;

        const averageBuyPrice = totalCost / coinsHeld;
        console.log(`Average Buy Price: $${averageBuyPrice.toFixed(2)}, Total Coins Held: ${coinsHeld.toFixed(4)}`);

        if (price >= averageBuyPrice * (1 + profitTarget)) {
            const profit = (price - averageBuyPrice) * coinsHeld;
            console.log(`Profit Target Reached: Selling all for a profit of $${profit.toFixed(2)}`);
            totalInvested -= totalCost;
            coinsHeld = 0;
            totalCost = 0;
        } else if (price <= averageBuyPrice * (1 - stopLoss)) {
            const loss = (price - averageBuyPrice) * coinsHeld;
            console.log(`Stop-Loss Triggered: Selling all for a loss of $${loss.toFixed(2)}`);
            totalInvested -= totalCost;
            coinsHeld = 0;
            totalCost = 0;
        }
    });

    if (coinsHeld > 0) {
        const currentPrice = priceData[priceData.length - 1];
        const currentValue = currentPrice * coinsHeld;
        console.log(`Final Holdings: ${coinsHeld.toFixed(4)} coins valued at $${currentValue.toFixed(2)}`);
        // res.json({ message: 'Strategy executed', holdings: coinsHeld, currentValue, totalInvested });
    } else {
        console.log('No coins held at the end of the strategy');
        // res.json({ message: 'Strategy executed', totalInvested });
    }
};
ai_dca();
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
