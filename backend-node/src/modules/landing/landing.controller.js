const landingService = require('./landing.service');

function getPreviewClip(req, res) {
  res.json(landingService.getPreviewClip());
}

module.exports = { getPreviewClip };
