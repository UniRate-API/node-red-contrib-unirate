"use strict";

/**
 * Zero-dependency UniRate API client used by the Node-RED nodes.
 *
 * Uses the global `fetch` (built into Node.js 18+, which Node-RED 4 requires),
 * so this package ships with NO runtime dependencies. All request-building and
 * response-parsing logic lives here as pure, testable functions.
 */

const DEFAULT_BASE_URL = "https://api.unirateapi.com";
const DEFAULT_TIMEOUT = 30000;

/** Base error for every client failure (HTTP and transport). */
class UniRateError extends Error {
  constructor(message, statusCode, response) {
    super(message);
    this.name = "UniRateError";
    if (statusCode !== undefined) this.statusCode = statusCode;
    if (response !== undefined) this.response = response;
  }
}

/** Coerce a string/number rate value from the API into a Number. */
function toNumber(value) {
  return typeof value === "number" ? value : parseFloat(String(value));
}

/**
 * Build the request URL for an endpoint.
 * The API key is passed as a query parameter (that is how UniRate authenticates).
 */
function buildUrl(baseUrl, apiKey, endpoint, params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  search.set("api_key", apiKey);
  const base = String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return `${base}${endpoint}?${search.toString()}`;
}

/** Map an HTTP status to a descriptive UniRateError. */
function errorForStatus(status, body) {
  switch (status) {
    case 400:
      return new UniRateError("Invalid request parameters", 400, body);
    case 401:
      return new UniRateError("Missing or invalid API key", 401, body);
    case 403:
      return new UniRateError("Endpoint requires a Pro subscription", 403, body);
    case 404:
      return new UniRateError("Currency not found or no data available", 404, body);
    case 429:
      return new UniRateError("Rate limit exceeded", 429, body);
    case 503:
      return new UniRateError("Service unavailable", 503, body);
    default:
      return new UniRateError(`API request failed with status ${status}`, status, body);
  }
}

/**
 * Perform a GET request against the UniRate API and return parsed JSON.
 *
 * @param {object} opts
 * @param {string} opts.baseUrl   Base URL (defaults to the public API).
 * @param {string} opts.apiKey    API key.
 * @param {string} opts.endpoint  Path, e.g. "/api/rates".
 * @param {object} [opts.params]  Query parameters.
 * @param {number} [opts.timeout] Timeout in ms.
 * @param {Function} [opts.fetchImpl] Injectable fetch (for tests). Defaults to global fetch.
 * @returns {Promise<any>} Parsed JSON response.
 */
async function apiRequest(opts) {
  const {
    baseUrl,
    apiKey,
    endpoint,
    params,
    timeout = DEFAULT_TIMEOUT,
    fetchImpl,
  } = opts;

  if (!apiKey) throw new UniRateError("apiKey is required");

  const doFetch = fetchImpl || (typeof fetch === "function" ? fetch : undefined);
  if (typeof doFetch !== "function") {
    throw new UniRateError(
      "No global fetch available; Node.js 18+ is required",
    );
  }

  const url = buildUrl(baseUrl, apiKey, endpoint, params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await doFetch(url, {
      method: "GET",
      // Accept header is REQUIRED — /api/currencies returns an HTML 404 without it.
      headers: { Accept: "application/json", "User-Agent": "node-red-contrib-unirate" },
      signal: controller.signal,
    });
  } catch (err) {
    const message = err && err.message ? err.message : "Unknown error";
    throw new UniRateError(`API request failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let body;
    try {
      body = await response.text();
    } catch (_e) {
      body = undefined;
    }
    throw errorForStatus(response.status, body);
  }

  return response.json();
}

/** Get the exchange rate for a pair, or all rates for a base currency. */
async function getRate(opts, from = "USD", to) {
  const params = { from: String(from).toUpperCase() };
  if (to) params.to = String(to).toUpperCase();
  const json = await apiRequest({ ...opts, endpoint: "/api/rates", params });
  if (to) return toNumber(json.rate);
  const rates = {};
  for (const [cur, rate] of Object.entries(json.rates || {})) {
    rates[cur] = toNumber(rate);
  }
  return rates;
}

/** Convert an amount from one currency to another using current rates. */
async function convert(opts, to, amount = 1, from = "USD") {
  const params = {
    amount,
    from: String(from).toUpperCase(),
    to: String(to).toUpperCase(),
  };
  const json = await apiRequest({ ...opts, endpoint: "/api/convert", params });
  if (json && json.result !== undefined) return toNumber(json.result);
  const results = {};
  for (const [cur, result] of Object.entries((json && json.results) || {})) {
    results[cur] = toNumber(result);
  }
  return results;
}

/** List all supported currency codes. */
async function getSupportedCurrencies(opts) {
  const json = await apiRequest({ ...opts, endpoint: "/api/currencies", params: {} });
  return json.currencies;
}

/** Get VAT rates for all countries, or for a single country. */
async function getVATRates(opts, country) {
  const params = {};
  if (country) params.country = String(country).toUpperCase();
  return apiRequest({ ...opts, endpoint: "/api/vat/rates", params });
}

module.exports = {
  UniRateError,
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT,
  buildUrl,
  errorForStatus,
  toNumber,
  apiRequest,
  getRate,
  convert,
  getSupportedCurrencies,
  getVATRates,
};
