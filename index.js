const express = require('express');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();
const cors = require('cors'); 
 
// Initialize Express app
const app = express();

// Import the database connection (this will use environment variables set by dotenv)
require('./src/config/database');

// Import routes
const routes = require('./src/routes/web');
app.use(cors());
// Use the routes for '/auth' path
app.use('/auth', routes);

// Start the server
app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
