const jwt = require('jsonwebtoken');
const { jwtConfig } = require('../config');
const { User } = require('../db/models');

const { secret, expiresIn } = jwtConfig;

// Sends a JWT Cookie
const setTokenCookie = (res, user) => {
  // Create the token payload
  const safeUser = {
    id: user.id,
    email: user.email,
    username: user.username,
  };

  // Create the JWT token
  const token = jwt.sign(
    { data: safeUser },
    secret,
    { expiresIn: parseInt(expiresIn) } // Token expires in seconds
  );

  const isProduction = process.env.NODE_ENV === "production";

  // Set the token cookie
  res.cookie('token', token, {
    maxAge: expiresIn * 1000,  // maxAge in milliseconds
    httpOnly: true,            // Ensure the cookie is not accessible via JS
    secure: isProduction,     // Set "secure" flag only in production
    sameSite: isProduction ? "Lax" : "Strict", // SameSite option based on environment
  });

  return token;
};

// Middleware to restore the current user based on the JWT token
const restoreUser = (req, res, next) => {
  const { token } = req.cookies;

  // No token found, move to next middleware
  if (!token) return next();

  // Verify the JWT token
  jwt.verify(token, secret, async (err, jwtPayload) => {
    if (err) {
      // Invalid token or expired, clear the cookie and proceed
      res.clearCookie('token');
      return next();
    }

    try {
      // Extract user ID from the payload
      const { id } = jwtPayload.data;

      // Fetch user by ID from the database
      req.user = await User.findByPk(id, {
        attributes: ['id', 'firstName', 'lastName', 'email', 'username']  // Fetch necessary attributes
      });

      // If user doesn't exist, clear the cookie
      if (!req.user) {
        res.clearCookie('token');
      }
    } catch (e) {
      // If error occurs (e.g., DB error), clear the cookie
      res.clearCookie('token');
    }

    // Continue to next middleware or route handler
    return next();
  });
};

// Middleware to require authentication
const requireAuth = (req, res, next) => {
  if (req.user) return next();

  const err = new Error('Authentication required');
  err.title = 'Authentication required';
  err.errors = { message: 'Authentication required' };
  err.status = 401;
  return next(err);
};

module.exports = { setTokenCookie, restoreUser, requireAuth };
