"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const client = require("../lib/unirate-client");

// A fake fetch that records the URL/headers it was called with and returns a
// canned response. Zero external dependencies.
function fakeFetch({ status = 200, json, text } = {}) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() {
        return json;
      },
      async text() {
        return text !== undefined ? text : JSON.stringify(json);
      },
    };
  };
  impl.calls = calls;
  return impl;
}

const OPTS = { apiKey: "test-key", baseUrl: "https://api.unirateapi.com" };

test("buildUrl encodes params, appends api_key, strips trailing slash", () => {
  const url = client.buildUrl("https://api.unirateapi.com/", "k", "/api/rates", {
    from: "USD",
    to: "EUR",
  });
  assert.equal(
    url,
    "https://api.unirateapi.com/api/rates?from=USD&to=EUR&api_key=k",
  );
});

test("buildUrl omits empty/undefined params", () => {
  const url = client.buildUrl("https://api.unirateapi.com", "k", "/api/vat/rates", {
    country: "",
    other: undefined,
  });
  assert.equal(url, "https://api.unirateapi.com/api/vat/rates?api_key=k");
});

test("apiRequest sends Accept: application/json (required by /api/currencies)", async () => {
  const f = fakeFetch({ json: { currencies: ["USD"] } });
  await client.apiRequest({
    ...OPTS,
    endpoint: "/api/currencies",
    fetchImpl: f,
  });
  assert.equal(f.calls[0].init.headers.Accept, "application/json");
});

test("getRate(from,to) returns a single numeric rate", async () => {
  const f = fakeFetch({ json: { rate: "0.92" } });
  const rate = await client.getRate({ ...OPTS, fetchImpl: f }, "usd", "eur");
  assert.equal(rate, 0.92);
  // currency codes are upper-cased
  assert.match(f.calls[0].url, /from=USD/);
  assert.match(f.calls[0].url, /to=EUR/);
});

test("getRate(from) with no `to` returns a numeric rate map", async () => {
  const f = fakeFetch({ json: { rates: { EUR: "0.92", GBP: 0.79 } } });
  const rates = await client.getRate({ ...OPTS, fetchImpl: f }, "USD");
  assert.deepEqual(rates, { EUR: 0.92, GBP: 0.79 });
});

test("convert returns the numeric result", async () => {
  const f = fakeFetch({ json: { result: "84.1" } });
  const out = await client.convert({ ...OPTS, fetchImpl: f }, "EUR", 100, "USD");
  assert.equal(out, 84.1);
  assert.match(f.calls[0].url, /amount=100/);
});

test("getSupportedCurrencies returns the currencies array", async () => {
  const f = fakeFetch({ json: { currencies: ["USD", "EUR", "GBP"] } });
  const list = await client.getSupportedCurrencies({ ...OPTS, fetchImpl: f });
  assert.deepEqual(list, ["USD", "EUR", "GBP"]);
});

test("getVATRates(country) passes an upper-cased country code", async () => {
  const f = fakeFetch({ json: { country: "DE", vat_data: {} } });
  await client.getVATRates({ ...OPTS, fetchImpl: f }, "de");
  assert.match(f.calls[0].url, /country=DE/);
});

test("apiRequest throws UniRateError with statusCode on 401", async () => {
  const f = fakeFetch({ status: 401, text: "unauthorized" });
  await assert.rejects(
    () => client.apiRequest({ ...OPTS, endpoint: "/api/rates", fetchImpl: f }),
    (err) => {
      assert.ok(err instanceof client.UniRateError);
      assert.equal(err.statusCode, 401);
      return true;
    },
  );
});

test("apiRequest maps 403 to a Pro-subscription message", async () => {
  const f = fakeFetch({ status: 403, text: "forbidden" });
  await assert.rejects(
    () => client.apiRequest({ ...OPTS, endpoint: "/api/historical/rates", fetchImpl: f }),
    /Pro subscription/,
  );
});

test("apiRequest requires an apiKey", async () => {
  await assert.rejects(
    () => client.apiRequest({ apiKey: "", endpoint: "/api/rates", fetchImpl: fakeFetch({}) }),
    /apiKey is required/,
  );
});

// --- Negative control -------------------------------------------------------
// Proves the harness actually fails when the assertion is false. If this ever
// "passes" (i.e. assert.rejects does NOT throw on a resolving promise), the
// test infrastructure is broken and every other green result is untrustworthy.
test("negative control: assert.rejects fails on a successful call", async () => {
  const f = fakeFetch({ json: { rate: 1 } });
  let harnessCaughtTheBug = false;
  try {
    await assert.rejects(
      () => client.getRate({ ...OPTS, fetchImpl: f }, "USD", "EUR"),
    );
  } catch (_e) {
    harnessCaughtTheBug = true; // assert.rejects correctly reported the non-rejection
  }
  assert.equal(harnessCaughtTheBug, true, "test harness did not detect a passing promise");
});
