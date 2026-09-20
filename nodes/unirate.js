"use strict";

const client = require("../lib/unirate-client");

module.exports = function (RED) {
  /**
   * Action node: performs a UniRate API call and puts the result on
   * `msg.payload`. The operation and its parameters come from the node config,
   * and any of them can be overridden per-message via `msg.*`.
   */
  function UniRateNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    node.configNode = RED.nodes.getNode(config.config);
    node.operation = config.operation || "rate";
    node.from = config.from;
    node.to = config.to;
    node.amount = config.amount;
    node.country = config.country;

    node.on("input", async function (msg, send, done) {
      // Node-RED 1.0+ provides send/done; fall back for older runtimes.
      send = send || function () { node.send.apply(node, arguments); };
      done = done || function (err) { if (err) node.error(err, msg); };

      try {
        if (!node.configNode || !node.configNode.credentials) {
          throw new Error("No UniRate API configuration selected");
        }
        const apiKey = node.configNode.credentials.apiKey;
        if (!apiKey) throw new Error("UniRate API key is not set on the configuration node");

        const opts = {
          apiKey,
          baseUrl: node.configNode.baseUrl || undefined,
        };

        const operation = msg.operation || node.operation;
        let result;

        switch (operation) {
          case "rate": {
            const from = msg.from || node.from || "USD";
            const to = msg.to || node.to || undefined;
            result = await client.getRate(opts, from, to);
            break;
          }
          case "convert": {
            const to = msg.to || node.to;
            if (!to) throw new Error("`to` currency is required for convert");
            const amount = msg.amount !== undefined ? Number(msg.amount)
              : (node.amount !== undefined && node.amount !== "" ? Number(node.amount) : 1);
            const from = msg.from || node.from || "USD";
            result = await client.convert(opts, to, amount, from);
            break;
          }
          case "currencies": {
            result = await client.getSupportedCurrencies(opts);
            break;
          }
          case "vat": {
            const country = msg.country || node.country || undefined;
            result = await client.getVATRates(opts, country);
            break;
          }
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }

        node.status({ fill: "green", shape: "dot", text: "ok" });
        msg.payload = result;
        send(msg);
        done();
      } catch (err) {
        node.status({ fill: "red", shape: "ring", text: "error" });
        done(err);
      }
    });
  }

  RED.nodes.registerType("unirate", UniRateNode);
};
