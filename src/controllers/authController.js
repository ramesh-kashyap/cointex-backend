const { oauth2client } = require("../config/googleConfig");
const axios = require('axios');
const connection = require('../config/database');
const jwt = require('jsonwebtoken');  
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');

const { body, validationResult } = require('express-validator');
const crypto = require('crypto');

// const twilio = require('twilio'); // Assuming you're using Twilio for SMS

const otpExpiry = 5 * 60 * 1000;


const formRegister = async (req, res) => {
  const { name, phone, password, referralCode } = req.body;

  try {
      // Check if phone is already registered
      const [existingUser] = await connection.query('SELECT * FROM users WHERE phone = ?', [phone]);
      if (existingUser.length) {
          return res.status(400).json({ message: 'Phone number is already registered' });
      }

      // Validate referral code (if provided)
      let referreconnectiony = null;
      if (referralCode) {
          const [referrer] = await connection.query('SELECT * FROM users WHERE referral_code = ?', [referralCode]);
          if (!referrer.length) {
              return res.status(400).json({ message: 'Invalid referral code' });
          }

          referreconnectiony = referrer[0].username;
      }

      // Hash the password securely
      const SALT_ROUNDS = 10;
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // Generate a unique referral code
      const generateReferralCode = () => crypto.randomBytes(5).toString('hex').toUpperCase();
      const referralCodeForUser = generateReferralCode();
      const randomUsername = Math.floor(Math.random() * 1000000);

      // Insert user into the database
      const [result] = await connection.query(
          'INSERT INTO users (name, phone, username, password, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?)',
          [name, phone, randomUsername, hashedPassword, referralCodeForUser, referreconnectiony]
      );

      const userId = result.insertId;

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000); // Generate a 6-digit OTP

      // Store OTP in the database or memory with expiry time
      const otpExpiryTime = Date.now() + otpExpiry;
      await connection.query(
          'INSERT INTO otp_verification (user_id, otp, expiry_time) VALUES (?, ?, ?)',
          [userId, otp, otpExpiryTime]
      );

      // Send OTP via SMS (Twilio or any SMS service)
      // const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
      // await client.messages.create({
      //     body: `Your OTP code is: ${otp}`,
      //     from: process.env.TWILIO_PHONE_NUMBER,
      //     to: phone,
      // });

      // Generate JWT token (without OTP verification)
      const token = jwt.sign(
          { userId, name, phone },
          process.env.JWT_SECRET,
          { expiresIn: '1h' } // Short expiry for access token
      );

      // Respond with OTP sent and token
      res.status(201).json({
          message: 'User registered successfully. Please verify your OTP.',
          token,
          userId,
      });

  } catch (error) {
      console.error('Error during registration:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
};

const verifyOtp = async (req, res) => {
  const { userId, otp } = req.body;

  try {
      // Fetch OTP from the database
      const [otpRecord] = await connection.query('SELECT * FROM otp_verification WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]);

      if (!otpRecord.length) {
          return res.status(400).json({ message: 'Invalid OTP' });
      }

      const { otp: storedOtp, expiry_time } = otpRecord[0];

      // Check if OTP is expired
      if (Date.now() > expiry_time) {
          return res.status(400).json({ message: 'OTP expired' });
      }

      // Check if OTP is correct
      if (storedOtp !== otp) {
          return res.status(400).json({ message: 'Invalid OTP' });
      }

      // OTP verified, delete OTP from the database
      await connection.query('DELETE FROM otp_verification WHERE user_id = ?', [userId]);

      // Generate a new JWT token for login
      const token = jwt.sign(
          { userId },
          process.env.JWT_SECRET,
          { expiresIn: '1h' } // Token expiry
      );

      // Respond with token and redirect to the dashboard (or any other appropriate location)
      res.status(200).json({
          message: 'OTP verified successfully',
          token,
          userId,
      });

  } catch (error) {
      console.error('Error during OTP verification:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
};

// const formRegister = async(req, res)=>{
  
 

//     const { name, phone, password, referralCode } = req.body;
//     console.log('Request Body:', req.body);
//     try {
//         // Check if phone is already registered
//         const [existingUser] = await connection.query('SELECT * FROM users WHERE phone = ?', [phone]);
//         console.log('Request Body:', existingUser);
//         if (existingUser.length) {
//             return res.status(400).json({ message: 'Phone number is already registered' });
//         }

//         // Validate referral code (if provided)
//         let referreconnectiony = null;
//         if (referralCode.length) {
//             const [referrer] = await connection.query('SELECT * FROM users WHERE referral_code = ?', [referralCode]);
//             if (!referrer.length) {
//                 return res.status(400).json({ message: 'Invalid referral code' });
//             }
            
//             referreconnectiony = referrer[0].username;
//             console.log('Referrer username:', referreconnectiony);
//         }
//         const SALT_ROUNDS = 10;
//         // Hash the password securely
//         const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        
//         // Generate a unique referral code
//         const generateReferralCode = () =>
//             crypto.randomBytes(5).toString('hex').toUpperCase();

//         const referralCodeForUser = generateReferralCode();
//         const randomUsername = Math.floor(Math.random() * 1000000);
//         // Create user in the database
//         const [result] = await connection.query(
//             'INSERT INTO users (name, phone,username, password, referral_code, referred_by) VALUES (?, ?, ?, ?, ?,?)',
//             [name, phone,randomUsername, hashedPassword, referralCodeForUser, referreconnectiony]
//         );
//         console.log("Inserting data:", name, phone, hashedPassword, referralCodeForUser, referreconnectiony);

//         const userId = result.insertId;

//         // Generate JWT token
//         const token = jwt.sign(
//             { userId, name, phone },
//             process.env.JWT_SECRET,
//             { expiresIn: '1h' } // Short expiry for access token
//         );

//         // Send response with token
//         res.status(201).json({
//             message: 'User registered successfully',
//             token,
//             user: {
//                 id: userId,
//                 name,
//                 phone,
//                 referralCode: referralCodeForUser,
//             },
//         });
//     } catch (error) {
//         console.error('Error during registration:', error);
//         res.status(500).json({ message: 'Internal server error' });
//     }
// }

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

module.exports = { loginValidator, formRegister,loginHandler, verifyOtp };

