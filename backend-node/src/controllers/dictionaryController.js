const axios = require('axios');
const env = require('../config/env');

async function getDictionaryDefinition(req, res) {
    const { word } = req.query;
    if (!word) return res.status(400).json({ error: "Word parameter is required" });
    try {
        const response = await axios.get(`${env.PYTHON_API}/dictionary/${encodeURIComponent(word)}`);
        res.json(response.data);
    } catch (error) {
        console.error('Error hitting python dictionary:', error.message);
        res.status(500).json({ error: 'Failed to find in dictionary' });
    }
}

module.exports = {
    getDictionaryDefinition
};
