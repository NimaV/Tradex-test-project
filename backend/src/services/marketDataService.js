const axios = require('axios');

const BASE_URL = 'https://pro-api.coinmarketcap.com/v1';
const API_KEY = process.env.CMC_API_KEY;
const REQUEST_DELAY_MS = 2000;

const ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', type: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', type: 'crypto' },
  { symbol: 'SOL', name: 'Solana', type: 'crypto' },
  { symbol: 'BNB', name: 'BNB', type: 'crypto' },
  { symbol: 'XRP', name: 'XRP', type: 'crypto' },
];

const marketCache = {
  ticker: null,
  lastUpdated: null,
  error: null,
  isRefreshing: false,
};

function ensureApiKey() {
  if (!API_KEY) {
    const error = new Error('Missing CMC_API_KEY in environment variables');
    error.statusCode = 500;
    throw error;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function coinMarketCapRequest(path, params = {}) {
  const response = await axios.get(`${BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      'X-CMC_PRO_API_KEY': API_KEY,
    },
    params,
    timeout: 10000,
  });

  const data = response.data;

  if (data?.status?.error_code && data.status.error_code !== 0) {
    const error = new Error(data.status.error_message || 'CoinMarketCap request failed');
    error.statusCode = 502;
    throw error;
  }

  return data;
}

async function throttledCoinMarketCapRequest(path, params = {}) {
  const result = await coinMarketCapRequest(path, params);
  await sleep(REQUEST_DELAY_MS);
  return result;
}

function round(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(digits));
}

async function fetchLatestCryptoQuotes() {
  const data = await throttledCoinMarketCapRequest('/cryptocurrency/quotes/latest', {
    symbol: ASSETS.map((asset) => asset.symbol).join(','),
    convert: 'USD',
  });

  return data.data || {};
}

function mapQuoteToTickerItem(asset, entry) {
  const usd = entry?.quote?.USD;

  return {
    symbol: asset.symbol,
    name: asset.name,
    price: round(usd?.price, asset.symbol === 'XRP' ? 4 : 2),
    change24h: round(usd?.percent_change_24h, 2),
    type: asset.type,
  };
}

async function buildFreshTickerData() {
  ensureApiKey();

  const quoteMap = await fetchLatestCryptoQuotes();

  const data = ASSETS
    .filter((asset) => quoteMap[asset.symbol])
    .map((asset) => mapQuoteToTickerItem(asset, quoteMap[asset.symbol]));

  return {
    data,
    lastUpdated: new Date().toISOString(),
  };
}

async function refreshTickerCache() {
  if (marketCache.isRefreshing) {
    return marketCache.ticker;
  }

  marketCache.isRefreshing = true;

  try {
    const fresh = await buildFreshTickerData();

    marketCache.ticker = fresh.data;
    marketCache.lastUpdated = fresh.lastUpdated;
    marketCache.error = null;

    console.log(`[market] cache refreshed at ${marketCache.lastUpdated}`);
    return marketCache.ticker;
  } catch (error) {
    marketCache.error = error.message || 'Unknown refresh error';
    console.error('[market] refresh failed:', error.message);
    return marketCache.ticker;
  } finally {
    marketCache.isRefreshing = false;
  }
}

function getTickerCache() {
  return {
    data: marketCache.ticker,
    lastUpdated: marketCache.lastUpdated,
    error: marketCache.error,
    isReady: Array.isArray(marketCache.ticker),
  };
}

async function runMarketDataLoop() {
  console.log(
    `[market] CoinMarketCap refresh loop started with ${REQUEST_DELAY_MS}ms minimum delay between upstream requests`
  );

  while (true) {
    await refreshTickerCache();
  }
}

function startMarketDataJob() {
  runMarketDataLoop().catch((error) => {
    console.error('[market] background loop crashed:', error.message);
  });
}

module.exports = {
  ASSETS,
  refreshTickerCache,
  getTickerCache,
  startMarketDataJob,
};
