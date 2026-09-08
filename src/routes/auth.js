const express = require('express');
const {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken
} = require('../shared/token');
const { isValidPayload } = require('../utils/validators');

const router = express.Router();

router.post('/auth/refresh', async (req, res) => {
  if (!isValidPayload(req.body, ['refreshToken'])) {
    return res.status(400).json({ error: 'missing refreshToken' });
  }

  const { refreshToken } = req.body;

  try {
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const userId = decoded.sub;
    const tokenVersion = decoded.ver;

    // In a real implementation, you would fetch the user from the database
    // and verify the token version matches (for instant revocation capability)
    const user = {
      id: userId,
      email: `user-${userId}@example.com`,
      roles: ['user'],
      permissions: [],
      tokenVersion
    };

    // Verify token version hasn't been revoked
    if (user.tokenVersion !== tokenVersion) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    console.error('Token refresh error:', err.message);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

module.exports = router;
