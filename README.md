# Hyperliquid Position Tracker

## Setup

Copy the env file and fill in your Chainstack RPC URL:

```bash
cp .env.example .env
```

```env
CHAINSTACK_URL=https://your-node.hyperliquid.chainstackendpoint.com
MIN_NOTIONAL=10000   # optional, defaults to 10000
```

Install dependencies and run:

```bash
npm install
npm start
```
