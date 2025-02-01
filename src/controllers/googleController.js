const { oauth2client } = require("../config/googleConfig");
const axios = require('axios');
const connection = require('../config/database');
const jwt = require('jsonwebtoken');

const googleLogin = async (req, res) => {
  try {
    const { code: idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: 'ID Token is required' });
    }

    // Verify the token using Google OAuth client
    const ticket = await oauth2client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const { sub, name, email, picture } = payload;

    // Check for existing user or create a new user (same as previous backend logic)
    const [existingUser] = await connection.execute(
      'SELECT * FROM users WHERE google_id = ?',
      [sub]
    );

    let userId;
    if (existingUser.length > 0) {
      userId = existingUser[0].id;
    } else {
      const randomUsername = Math.floor(Math.random() * 1000000);
      const query = `INSERT INTO users (google_id, username, name, email, picture) VALUES (?, ?, ?, ?, ?)`;
      const values = [sub, randomUsername, name, email, picture];
      const [result] = await connection.execute(query, values);
      userId = result.insertId;
    }

    // Generate JWT token
    const token = jwt.sign({ userId, googleId: sub }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.status(200).json({
      message: 'User authenticated successfully',
      token,
      user: { name, email, picture },
      userId,
    });
  } catch (err) {
    console.error('Google Login Error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};


module.exports = { googleLogin };
