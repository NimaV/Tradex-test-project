const { ASSETS, getTickerCache } = require('../services/marketDataService');

function generateDummyChartData(symbol) {
  const seriesMap = {
    BTC: [69420, 70180, 69840, 70690, 69950, 71220, 70780, 72120],
    ETH: [2120, 2168, 2140, 2192, 2158, 2228, 2186, 2219],
    SOL: [79.8, 82.4, 80.7, 84.1, 81.9, 85.6, 82.8, 83.92],
    BNB: [588, 602, 595, 611, 598, 616, 603, 605.39],
    XRP: [1.28, 1.34, 1.31, 1.37, 1.33, 1.39, 1.35, 1.3502],
  };

  const values = seriesMap[symbol] || [10, 14, 11, 15, 12, 16, 13, 15];
  const labels = ['-21h', '-18h', '-15h', '-12h', '-9h', '-6h', '-3h', 'Now'];

  return values.map((price, index) => ({
    time: labels[index],
    price,
  }));
}

const getTickerData = async (req, res, next) => {
  try {
    const cache = getTickerCache();

    if (!cache.isReady) {
      return res.status(503).json({
        success: false,
        message: 'Market data is warming up. Please try again shortly.',
      });
    }

    res.json({
      success: true,
      data: cache.data,
      lastUpdated: cache.lastUpdated,
      cached: true,
      cacheError: cache.error,
    });
  } catch (error) {
    next(error);
  }
};

const getChartData = async (req, res, next) => {
  try {
    const requestedSymbol = String(req.params.symbol || '').toUpperCase();
    const asset = ASSETS.find((item) => item.symbol === requestedSymbol);

    if (!asset) {
      return res.status(400).json({
        success: false,
        message: `Unsupported symbol: ${req.params.symbol}`,
      });
    }

    const data = generateDummyChartData(asset.symbol);

    res.json({
      success: true,
      symbol: asset.symbol,
      name: asset.name,
      data,
      note: 'Dummy 24-hour chart data for hover preview.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTickerData,
  getChartData,
};
