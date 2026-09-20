# node-red-contrib-unirate

Node-RED nodes for the [UniRate API](https://unirateapi.com) — currency exchange
rates, conversion, the supported-currency list, and VAT rates.

- **Zero runtime dependencies.** Uses the global `fetch` built into Node.js 18+
  (which Node-RED 4 requires), so nothing is pulled in at install time.
- Works with the free UniRate tier. Pro-only endpoints (historical rates,
  time series) surface a clear `403` error and are not exposed by these nodes.

## Install

From the Node-RED editor: **Menu → Manage palette → Install**, then search for
`node-red-contrib-unirate`.

Or from your Node-RED user directory (`~/.node-red`):

```bash
npm install node-red-contrib-unirate
```

## Setup

1. Get a free API key at [unirateapi.com](https://unirateapi.com).
2. Drag a **unirate** node onto a flow.
3. Add a new **UniRate API** config node and paste your API key. (It is stored
   as an encrypted Node-RED credential, not in the flow file.)

## Nodes

### `unirate`

Sends a request on input and puts the result on `msg.payload`.

| Operation | Result on `msg.payload` |
|---|---|
| **Get rate** | The rate for `from`→`to`, or an object of all rates for `from` when `to` is blank |
| **Convert amount** | The converted amount (`amount` of `from` in `to`) |
| **List currencies** | An array of supported currency codes |
| **VAT rates** | VAT rates for a `country`, or all countries when blank |

Every field can be overridden per message:

- `msg.operation` — `"rate"` \| `"convert"` \| `"currencies"` \| `"vat"`
- `msg.from`, `msg.to`, `msg.amount`, `msg.country`

Errors (bad key, unknown currency, rate limit, Pro-gated endpoint) are raised on
the node's error output and can be handled with a **catch** node.

### `unirate-config`

Holds your API key (encrypted credential) and an optional base-URL override.

## Example

```
[inject] --> [unirate: convert 100 USD→EUR] --> [debug]
```

`msg.payload` → `84.1`

## Development

```bash
npm test        # runs the node:test suite (no external test deps)
```

## License

[MIT](LICENSE)
