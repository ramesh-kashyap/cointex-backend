// Import the express module
const express = require('express');

// Create an Express application
const app = express();

// Define the port the server will run on
const port = 3001;  // You can change this to any port you prefer

// Create a simple route that responds with 'Hello, World!' when accessed
app.get('/', (req, res) => {
  res.send('Hello, World!');
});

// Start the server and listen for incoming requests
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
