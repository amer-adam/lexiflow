const usersService = require('./users.service');

async function deleteAccount(req, res, next) {
  try {
    await usersService.deleteAccount(req.userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { deleteAccount };
