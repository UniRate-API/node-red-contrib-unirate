"use strict";

module.exports = function (RED) {
  /**
   * Configuration node holding the UniRate API key (as an encrypted credential)
   * and an optional base URL override. Referenced by the `unirate` action node.
   */
  function UniRateConfigNode(config) {
    RED.nodes.createNode(this, config);
    this.name = config.name;
    this.baseUrl = (config.baseUrl || "").trim();
    // this.credentials.apiKey is populated by Node-RED from the credentials store.
  }

  RED.nodes.registerType("unirate-config", UniRateConfigNode, {
    credentials: {
      apiKey: { type: "password" },
    },
  });
};
