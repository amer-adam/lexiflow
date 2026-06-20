const statsService = require('./stats.service');

async function getSummary(req, res, next) {
  try {
    const summary = await statsService.getSummary(req.userId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

module.exports = { getSummary };
