const ttsService = require('./tts.service');

async function speak(req, res, next) {
    try {
        const { text, voice } = req.query.text !== undefined ? req.query : req.body;
        const result = await ttsService.synthesize(text, { voice });
        res.json(result);
    } catch (error) {
        next(error);
    }
}

module.exports = { speak };
