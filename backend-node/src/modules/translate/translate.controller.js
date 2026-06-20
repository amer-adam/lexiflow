const translateService = require('./translate.service');

async function translateText(req, res, next) {
    try {
        const { text, source, target } = req.query.text !== undefined ? req.query : req.body;
        const result = await translateService.translate(text, { source, target });
        res.json(result);
    } catch (error) {
        next(error);
    }
}

module.exports = { translateText };
