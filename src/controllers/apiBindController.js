
const connection = require('../config/database');

const apiBind = async (req, res) => {
  const { user_id, apiKey, apiSecret, remark } = req.body;
  console.log('Request Body:', req.body);
  try {
    const [existingApi] = await connection.query(
      'SELECT * FROM api_keys WHERE  userId = ?',
      [ user_id]
    );

    if (existingApi.length > 0) {
      await connection.query(
        'UPDATE api_keys SET apiSecret = ?, remark = ? , apiKey = ?WHERE   userId = ?',
        [apiSecret, remark, apiKey, user_id]
      );
      return res.status(200).json({ message: 'API key updated successfully' });
    } else {
      await connection.query(
        'INSERT INTO api_keys (userId, apiKey, apiSecret, remark) VALUES (?, ?, ?, ?)',
        [user_id, apiKey, apiSecret, remark]
      );
      return res.status(201).json({ message: 'API key created successfully' });
    }
  } catch (error) {
    console.error('Database Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};



module.exports = { apiBind };