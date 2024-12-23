const { oauth2client } = require("../config/googleConfig");
const axios = require('axios');
const connection = require('../config/database');
const jwt = require('jsonwebtoken');

const googleLogin = async (req, res) => {
  try {
    const { code } = req.query;

    // Ensure the 'code' is provided in the query
    if (!code) {
      return res.status(400).json({ message: 'Authorization code is required' });
    }

    // Get the tokens from Google using the authorization code
    const googleRes = await oauth2client.getToken(code);
    oauth2client.setCredentials(googleRes.tokens);

    // Fetch the user's profile information from Google
    const userRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${googleRes.tokens.access_token}`,
      },
    });

    const { sub, name, email, picture } = userRes.data;

    // Check if the user already exists in the database using google_id
    const [existingUser] = await connection.execute('SELECT * FROM users WHERE google_id = ?', [sub]);

    if (existingUser.length > 0) {
      // User exists, generate JWT and send response
      const token = jwt.sign(
        { userId: existingUser[0].id, googleId: sub },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      return res.status(200).json({
        message: 'User authenticated successfully',
        token,
        user: { name, email, picture },
        userId: existingUser[0].id,
      });
    }

    // If the user doesn't exist, create a new user in the database
    const randomUsername = Math.floor(Math.random() * 1000000); // Generate random username

    const query = `
      INSERT INTO users (google_id, username, name, email, picture)
      VALUES (?, ?, ?, ?, ?)
    `;
    const values = [sub, randomUsername, name, email, picture];

    const [result] = await connection.execute(query, values);

    // Generate JWT for the newly created user
    const token = jwt.sign(
      { userId: result.insertId, googleId: sub },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Respond with success message, JWT token, and user info
    res.status(201).json({
      message: 'User authenticated and data saved successfully',
      token,
      user: { name, email, picture },
      userId: result.insertId,
    });

  } catch (err) {
    console.error('Error during Google login:', err);
    // Provide specific error details in the response to assist debugging
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

module.exports = { googleLogin };
