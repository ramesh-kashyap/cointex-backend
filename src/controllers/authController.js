const { oauth2client } = require("../config/googleConfig");
const axios = require('axios');
const connection = require('../config/database');
const jwt = require('jsonwebtoken');  
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');

const { body, validationResult } = require('express-validator');
const crypto = require('crypto');





const formRegister = async(req, res)=>{
  
 

    const { name, phone, password, referralCode } = req.body;
    console.log('Request Body:', req.body);
    try {
        // Check if phone is already registered
        const [existingUser] = await connection.query('SELECT * FROM users WHERE phone = ?', [phone]);
        console.log('Request Body:', existingUser);
        if (existingUser.length) {
            return res.status(400).json({ message: 'Phone number is already registered' });
        }

        // Validate referral code (if provided)
        let referreconnectiony = null;
        if (referralCode.length) {
            const [referrer] = await connection.query('SELECT * FROM users WHERE referral_code = ?', [referralCode]);
            if (!referrer.length) {
                return res.status(400).json({ message: 'Invalid referral code' });
            }
            
            referreconnectiony = referrer[0].username;
            console.log('Referrer username:', referreconnectiony);
        }
        const SALT_ROUNDS = 10;
        // Hash the password securely
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        
        // Generate a unique referral code
        const generateReferralCode = () =>
            crypto.randomBytes(5).toString('hex').toUpperCase();

        const referralCodeForUser = generateReferralCode();
        const randomUsername = Math.floor(Math.random() * 1000000);
        // Create user in the database
        const [result] = await connection.query(
            'INSERT INTO users (name, phone,username, password, referral_code, referred_by) VALUES (?, ?, ?, ?, ?,?)',
            [name, phone,randomUsername, hashedPassword, referralCodeForUser, referreconnectiony]
        );
        console.log("Inserting data:", name, phone, hashedPassword, referralCodeForUser, referreconnectiony);

        const userId = result.insertId;

        // Generate JWT token
        const token = jwt.sign(
            { userId, name, phone },
            process.env.JWT_SECRET,
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
    const [user] = await connection.query('SELECT * FROM users WHERE phone = ?', [phone]);
    
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
      process.env.JWT_SECRET,
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

module.exports = { loginValidator, formRegister,loginHandler };

