const express = require('express');
const dotenv = require('dotenv');
const cron = require('node-cron');
// Load environment variables from .env file
dotenv.config();
const cors = require('cors'); 
const  futureTradeController  = require('../cointex-backend/src/controllers/futureTradeController');
// Initialize Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Import the database connection (this will use environment variables set by dotenv)
require('./src/config/database');

// Import routes

const routes = require('./src/routes/web');
app.use(cors());
// Use the routes for '/auth' path
app.use('/api', routes);


// Start the server
app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
