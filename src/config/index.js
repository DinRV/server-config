const config = {
  cors: {
    allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || '').split(',').filter(Boolean),
  },
  features: {
    v3_endpoints: process.env.FEATURE_V3_ENDPOINTS === 'true',
    new_auth_flow: process.env.FEATURE_NEW_AUTH_FLOW === 'true',
  },
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
};

module.exports = config;
