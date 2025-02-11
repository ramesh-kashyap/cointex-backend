
const connection = require('../config/database');
const middlewareController = require('../middleware/middlewareController');
const apiBind = async (req, res) => {
  const userId = req.user.userId;
  const { apiKey, apiSecret, remark } = req.body;

  if (!userId) {
      return res.status(400).json({ success:false, message: 'User ID is required' });
  }

  // Check if all required fields are provided
  if ( !apiKey || !apiSecret || !remark) {
    return res.status(400).json({
      success: false,
      message: 'All Fields are required fields',
    });
  }

  console.log('Request Body:', req.body);

  try {
    // Check if the user already has an API key in the database
    const [existingApi] = await connection.query(
      'SELECT * FROM api_keys WHERE userId = ?',
      [userId]
    );

    if (existingApi.length > 0) {
      // If the API key exists, update it
      await connection.query(
        'UPDATE api_keys SET apiSecret = ?, remark = ?, apiKey = ? WHERE userId = ?',
        [apiSecret, remark, apiKey, userId]
      );
      return res.status(200).json({
        success: true,
        message: 'API key updated successfully',
      });
    } else {
      // If the API key does not exist, create a new record
      await connection.query(
        'INSERT INTO api_keys (userId, apiKey, apiSecret, remark) VALUES (?, ?, ?, ?)',
        [user_id, apiKey, apiSecret, remark]
      );
      return res.status(201).json({
        success: true,
        message: 'API key created successfully',
      });
    }
  } catch (error) {
    // Catch any database errors
    console.error('Database Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};



module.exports = { apiBind };