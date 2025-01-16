const jwt = require('jsonwebtoken');
const dotenv = require('dotenv'); // To manage environment variables
dotenv.config(); // Load environment variables from .env file

// Middleware to authenticate JWT
const authenticateJWT = (req, res, next) => {
    // Check for token in 'Authorization' header, following the Bearer format
    const token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'
      
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
       
    }

    // Verify the JWT using the secret key from environment variables
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Forbidden: Invalid or expired token' });
        }
     
        // If valid, add the decoded user information to the request object
        req.user = user;
        next(); // Proceed to the next middleware or route handler
    });
};

module.exports = authenticateJWT;
