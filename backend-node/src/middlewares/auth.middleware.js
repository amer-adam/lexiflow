const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const prisma = require('../config/prisma');

const domain = process.env.VITE_AUTH0_DOMAIN;
const audience = process.env.VITE_AUTH0_AUDIENCE;

if (!domain || !audience) {
  console.error('CRITICAL: AUTH0_DOMAIN and AUTH0_AUDIENCE environment variables must be set.');
}

const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${domain}/.well-known/jwks.json`
  }),
  audience: audience,
  issuer: `https://${domain}/`,
  algorithms: ['RS256']
});

/**
 * Middleware to verify JWT and attach Auth0 user ID to req.userId
 */
function authMiddleware(req, res, next) {
  if (!domain || !audience) {
    console.warn('JWT middleware configuration is missing domain or audience.');
    return res.status(500).json({ error: 'Internal Server Error', message: 'Auth0 configuration missing' });
  }
  // console.log('Incoming Auth Header:', req.headers.authorization);

  checkJwt(req, res, async (err) => {
    if (err) {
      console.warn('JWT token is invalid or expired:', err.message);
      return res.status(401).json({ error: 'Unauthorized', message: err.message });
    }

    if (req.auth && req.auth.sub) {
      const userId = req.auth.sub;
      req.userId = userId;

      try {
        // Just-in-Time seeding: Ensure user exists in PostgreSQL to satisfy Foreign Key constraints
        // Retrieve email from token claims (req.auth) if available, otherwise fallback to placeholder
        const userEmail = (req.auth && req.auth.email) || `${userId.split('|')[1] || userId}@placeholder.com`;

        await prisma.user.upsert({
          where: { id: userId },
          update: {}, // No updates needed if they already exist
          create: {
            id: userId,
            email: userEmail
          }
        });

        // console.debug(`JWT verified and user row synced in DB for: ${req.userId}`);
        return next();
      } catch (dbError) {
        console.error(`Database seeding failed for user ${userId} in auth middleware:`, dbError);
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to initialize user session record'
        });
      }
    }

    console.warn('JWT token missing sub claim');
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing subject claim' });
  });
}

module.exports = authMiddleware;
