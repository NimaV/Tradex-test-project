const express = require('express');
const router = express.Router();
const { getTickerData, getChartData } = require('../controllers/marketController');

router.get('/ticker', getTickerData);
router.get('/chart/:symbol', getChartData);

module.exports = router;
