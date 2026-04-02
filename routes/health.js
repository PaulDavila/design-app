const express = require('express');
const router = express.Router();
const { testConnection } = require('../config/db');

router.get('/', async (req, res) => {
  const dbOk = await testConnection();
  res.status(200).json({
    ok: true,
    service: 'design-app',
    db: dbOk ? 'connected' : 'error',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
