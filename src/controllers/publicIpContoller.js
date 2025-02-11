// ipFetcher.js
const axios = require('axios');

// Fetch Public IP Address using ipify API
async function fetchPublicIP(req, res) {
    try {
        const response = await axios.get('https://api.ipify.org?format=json');
        // Return the IP in a structured JSON format
      
        return res.status(201).json( { success: true, ip: response.data.ip });
    } catch (error) {
        console.error('Error fetching public IP:', error.message);
        // Return error information in JSON format
        return res.status(400).json({ success: false, message: 'IP fetch failed', error: error.message });
    }
}

module.exports = { fetchPublicIP };
