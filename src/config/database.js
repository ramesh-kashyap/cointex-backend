const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config();

const connection = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

connection.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Connected to the database as ID ' + connection.threadId);
    // connection.release(); // Release the connection back to the pool
});
module.exports = connection;

