# 0xplain

Pay-per-request transaction intelligence API behind [x402](https://x402.org). Submit a transaction hash, get a plain-English explanation. Submit a wallet address, get a risk score. Paid in USDC on Base via x402 micropayments.

## Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /health` | Free | Service status, pricing, supported features |
| `GET /explain?tx=0x...` | $0.001 | Decode and explain an ERC-20 transaction in plain English |
| `GET /risk?address=0x...` | $0.005 | Risk score and analysis for a wallet address |

## Scope

**Supported:** ERC-20 transfers, approvals, `transferFrom`, `transferWithAuthorization` (x402 settlements)

**Not yet supported:** DEX swaps, NFTs, native ETH transfers, bridge transactions, batch/multicall

## Setup

### Prerequisites

- Node.js 20+
- Two wallets: one for the server (receives payments), one for a test client (makes payments)
- Client wallet funded with Base Sepolia ETH ([faucet](https://faucets.chain.link/base-sepolia)) and USDC ([Circle faucet](https://faucet.circle.com/))
- [Basescan API key](https://basescan.org/apis) (free)
- [Anthropic API key](https://console.anthropic.com/)

### Environment

```bash
cp .env.example .env
# Fill in your values
```

### Install & Run

```bash
npm install

# Start the server
npm run dev

# In another terminal — test endpoints
curl http://localhost:4021/health
curl -v http://localhost:4021/explain?tx=0x...   # returns 402

# Test with x402 payment (requires funded client wallet)
npm run test:explain -- <tx_hash>
npm run test:risk -- <address>

# Diagnostic: see raw 402 flow
npm run test:manual -- <tx_hash>
```

## Architecture

```
Agent/Developer → Express + x402 middleware → Transaction Intelligence Engine
                                                ├── Fetch tx data (viem + Base RPC)
                                                ├── Decode ERC-20 (function selectors + event logs)
                                                ├── Check risk lists (OFAC, scams, exchanges)
                                                ├── Analyze wallet behavior (profiler + scorer)
                                                └── Generate narrative (Claude API)
```

## Tech Stack

- **Runtime:** TypeScript / Node.js 20+
- **Server:** Express.js with `@x402/express` payment middleware
- **Blockchain:** viem (RPC client), Basescan API (wallet history)
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514)
- **Network:** Base Sepolia (testnet) / Base (mainnet) — single config toggle
- **Payment:** USDC via x402 protocol

## Project Structure

```
src/
├── server/           # Express app, routes, x402 middleware
├── config/           # Network toggle (testnet/mainnet), env vars
├── blockchain/       # RPC client, Basescan client, ERC-20 ABI
├── intelligence/     # Decoder, risk scorer, wallet profiler, AI narrator
├── client/           # Test clients (x402 auto-pay + manual 402 flow)
└── types/            # Shared TypeScript interfaces
data/                 # Risk lists (OFAC, known exchanges, scams)
```

## Network Toggle

Set `NETWORK=testnet` or `NETWORK=mainnet` in `.env`. Everything else resolves automatically — same code, different config.

## License

MIT
