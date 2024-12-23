const { oauth2client } = require("../config/googleConfig");
const axios = require('axios');
const connection = require('../config/database');
const jwt = require('jsonwebtoken');  
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');

const { body, validationResult } = require('express-validator');
const crypto = require('crypto');

const googleLogin = async (req, res) => {
  try {
    const { code } = req.query;

    // Get the tokens from Google using the authorization code
    const googleRes = await oauth2client.getToken(code);

    // Set the credentials using the tokens from Google
    oauth2client.setCredentials(googleRes.tokens);

    // Fetch the user's profile information from Google
    const userRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${googleRes.tokens.access_token}`,
      },
    });

    // Get user details from the response
    const { sub, name, email, picture } = userRes.data;

    // Generate a random integer for the username
    const randomUsername = Math.floor(Math.random() * 1000000); // Generates a random integer between 0 and 999999

    // Insert or update the user into the database
    const query = `
      INSERT INTO users (google_id, username, name, email, picture)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE name = ?, email = ?, picture = ?, username = ?
    `;
    const values = [sub, randomUsername, name, email, picture, name, email, picture, randomUsername];

    // Execute the query securely using parameterized queries (prevents SQL injection)
    connection.execute(query, values, (err, result) => {
      if (err) {
        console.error('Error inserting user into database:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Generate a JWT token for the user
      const token = jwt.sign(
        { userId: result.insertId, googleId: sub },
        process.env.JWT_SECRET, // Ensure you have a secret key in your .env file
        { expiresIn: '1h' } // The token will expire in 1 hour
      );

      // Successfully stored the user data, respond with a success message and the JWT token
      res.status(200).json({
        message: 'User authenticated and data saved successfully',
        token: token,  // Send the JWT token
        user: { name, email, picture }, // Send the user data
        userId: result.insertId,
      });
    });

  } catch (err) {
    console.error('Error during Google login:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const validateRegistration = [
  body('name')
      .isString().notEmpty().withMessage('Name is required')
      .isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
  body('phone')
      .isMobilePhone().withMessage('Phone number must be valid')
      .notEmpty().withMessage('Phone number is required'),
  body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/).withMessage('Password must contain at least one number')
      .matches(/[@$!%*?&#]/).withMessage('Password must contain at least one special character'),
  body('referralCode').optional().isString().withMessage('Referral code must be a valid string')
];


const formRegister = async(res,req)=>{
  
    // Validate inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, password, referralCode } = req.body;

    try {
        // Check if phone is already registered
        const [existingUser] = await db.query('SELECT * FROM users WHERE phone = ?', [phone]);
        if (existingUser) {
            return res.status(400).json({ message: 'Phone number is already registered' });
        }

        // Validate referral code (if provided)
        let referredBy = null;
        if (referralCode) {
            const [referrer] = await db.query('SELECT id FROM users WHERE referral_code = ?', [referralCode]);
            if (!referrer) {
                return res.status(400).json({ message: 'Invalid referral code' });
            }
            referredBy = referrer.id;
        }

        // Hash the password securely
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Generate a unique referral code
        const generateReferralCode = () =>
            crypto.randomBytes(5).toString('hex').toUpperCase();

        const referralCodeForUser = generateReferralCode();

        // Create user in the database
        const [result] = await db.query(
            'INSERT INTO users (name, phone, password, referral_code, referred_by) VALUES (?, ?, ?, ?, ?)',
            [name, phone, hashedPassword, referralCodeForUser, referredBy]
        );

        const userId = result.insertId;

        // Generate JWT token
        const token = jwt.sign(
            { userId, name, phone },
            SECRET_KEY,
            { expiresIn: '1h' } // Short expiry for access token
        );

        // Send response with token
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: userId,
                name,
                phone,
                referralCode: referralCodeForUser,
            },
        });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

// Login validation middleware
const loginValidator = [
  body('phone').isMobilePhone().withMessage('Please provide a valid phone number'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

// Login handler
const loginHandler = async (req, res) => {
  // Validate inputs
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { phone, password } = req.body;

  try {
    // Check if the user exists
    const [user] = await db.query('SELECT * FROM users WHERE phone = ?', [phone]);
    
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Compare the hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, phone: user.phone, name: user.name },
      SECRET_KEY,
      { expiresIn: '1h' } // Token expiry
    );

    // Send response with token
    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { loginValidator,validateRegistration, formRegister,loginHandler, googleLogin  };

