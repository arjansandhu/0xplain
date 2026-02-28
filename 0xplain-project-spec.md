# 0xplain — Transaction Intelligence API (x402)

## Overview

**0xplain** is a pay-per-request transaction intelligence API behind x402. Submit a transaction hash, get a plain-English explanation of what happened. Submit a wallet address, get a risk score. Paid in USDC on Base via x402 micropayments.

Built in two phases:

- **Phase 1 (Testnet):** Build and test on Base Sepolia with testnet USDC
- **Phase 2 (Mainnet):** Deploy on Base mainnet with real USDC — same code, different config

This is an experimental prototype that:

1. Demonstrates x402 protocol integration for pay-per-request AI-powered APIs
2. Provides a genuinely useful service for the x402 developer community
3. Establishes the foundation for further development — the risk scoring engine here is designed to evolve into a full policy gateway for agent-to-agent payment authorization

---

## Domain Primer: Blockchain Transactions for Payments Engineers

This section maps blockchain transaction concepts to traditional payment system equivalents (card networks, ACH, ISO 8583) for context.

### What is Base?

Base is a "Layer 2" (L2) blockchain built on top of Ethereum by Coinbase. Think of it like this:

- **Ethereum** = the main settlement network (like Fedwire — slow, expensive, very secure)
- **Base** = a faster/cheaper network that batches transactions and settles them on Ethereum (like a card network that batches and settles with the bank at end of day)

Base uses the same technology as Ethereum (same smart contracts, same wallet addresses, same tooling) but transactions cost fractions of a cent instead of dollars, and confirm in ~2 seconds instead of ~12.

**Why Base matters for this project:** x402's primary network is Base because Coinbase built both. The x402 facilitator runs on Base. Most x402 developers are building on Base. An API analyzing Base transactions serves the exact audience that would use it.

### What is ERC-20?

ERC-20 is a standard interface for tokens on Ethereum-compatible blockchains. It's like the ISO 8583 of crypto — a specification that all tokens implement so wallets, exchanges, and smart contracts can interact with any token the same way.

Every ERC-20 token implements these core functions:

- `transfer(to, amount)` — send tokens from your wallet to another address
- `approve(spender, amount)` — authorize another address to spend your tokens (like a pre-auth)
- `transferFrom(from, to, amount)` — spend tokens you've been approved to spend

**USDC is an ERC-20 token.** When x402 settles a payment, it's calling `transferWithAuthorization` on the USDC contract — a specialized version of `transfer` that uses a signed message instead of requiring the sender to submit the transaction themselves.

### What Transactions Look Like On-Chain

Every transaction on Base has:

- **Transaction hash** — unique identifier (like a transaction reference number)
- **From address** — the wallet that initiated and paid gas for the transaction
- **To address** — the contract or wallet being called
- **Input data** — the function being called and its parameters (encoded)
- **Event logs** — events emitted during execution (like audit log entries)
- **Gas used / gas price** — the fee paid to the network
- **Status** — success or failure
- **Block number / timestamp** — when it was confirmed

For an ERC-20 transfer, the transaction's `to` field is the token contract address (not the recipient), and the actual recipient is encoded in the input data. The `Transfer(from, to, value)` event log tells you what actually moved.

### What Our API Scope Covers

**In scope — ERC-20 token transfers on Base:**

| Use Case                        | Example                                                  | How Common                                                   |
| ------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| Wallet-to-wallet USDC transfer  | Alice sends $50 USDC to Bob                              | Very common — the most basic on-chain payment                |
| Wallet-to-wallet USDT transfer  | Payment for a service in USDT                            | Very common                                                  |
| Other stablecoin transfers      | DAI, EURC movements                                      | Common                                                       |
| Non-stablecoin ERC-20 transfers | Sending governance tokens, meme tokens, etc.             | Common                                                       |
| x402 payment settlements        | The facilitator settling a payment on behalf of a client | Very common in x402 ecosystem — this is our primary audience |
| Exchange deposits/withdrawals   | Moving tokens to/from Coinbase, Binance                  | Common                                                       |
| Token approvals                 | Authorizing a DEX or contract to spend your tokens       | Common (we can flag risky approvals)                         |

**Out of scope (for now):**

| Use Case                     | Why Excluded                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------- |
| DEX swaps (Uniswap, etc.)    | Multiple token transfers in one tx, complex routing — good v2 feature        |
| NFT transfers (ERC-721/1155) | Different token standard, different use cases                                |
| Smart contract deployments   | Not a payment/transfer                                                       |
| Bridge transactions          | Cross-chain, complex multi-step flows                                        |
| Native ETH transfers         | Different mechanism than ERC-20 (no event logs, simpler) — easy to add later |
| Batch/multicall transactions | One tx containing many operations — complex to parse                         |

**Why this scope is the right starting point:**

ERC-20 transfers represent the vast majority of value movement on Base. USDC alone accounts for billions in daily volume. Crucially, every x402 payment settlement is an ERC-20 transfer — so 0xplain can analyze the very payments that fund it. This creates a compelling self-referential demo.

### Risk Scoring: Traditional Payments vs. Crypto

In traditional payments, risk scoring involves:

- Cardholder verification (CVV, AVS, 3DS authentication)
- Merchant category codes and velocity checks
- Fraud models trained on chargeback data
- Sanctions/PEP screening on named parties

In crypto, the challenges are different:

- **No identity by default** — wallets are pseudonymous (just an address, no name)
- **Transactions are irreversible** — no chargebacks, no disputes, no reversals
- **Everything is public** — the entire transaction history is visible to anyone
- **Risk is by association** — a wallet's risk depends on who it has transacted with

The enterprise players (Chainalysis, Elliptic, TRM Labs) charge $50K+/year for comprehensive risk scoring. They maintain proprietary databases of labeled addresses (exchanges, darknet markets, sanctioned entities) and do deep graph analysis.

**Our simplified approach** for this proof of concept:

- Check addresses against publicly available risk lists (OFAC sanctions, known scam databases)
- Analyze the counterparty's recent transaction patterns (age of wallet, transaction frequency, diversity)
- Flag suspicious behaviors (brand new wallets, interactions with known risky contracts, unusual patterns)
- Use Claude's API to synthesize a risk narrative from the raw data

This prototype won't match Chainalysis in depth, but it will be: (a) actually useful for quick pre-transaction checks, (b) accessible to any agent via x402 at $0.001/request, and (c) architected so the risk scoring engine can evolve into a full policy gateway for agent-to-agent payment authorization.

---

## Architecture

```
                                                x402 payment flow
                                           ┌──────────────────────────┐
                                           │                          │
┌──────────────┐   GET /explain?tx=0x...   │  ┌────────────────────┐  │
│              │ ─────────────────────────►│  │  Express Server    │  │
│  Agent or    │ ◄── 402 + payment terms   │  │  + x402 middleware │  │
│  Developer   │                           │  │                    │  │
│              │ ─── retry + payment sig ─►│  └────────┬───────────┘  │
│              │ ◄── 200 + data + receipt  │           │              │
└──────────────┘                           │           │              │
                                           │  ┌────────▼───────────┐  │
                                           │  │  Transaction       │  │
                                           │  │  Intelligence      │  │
                                           │  │  Engine            │  │
                                           │  │                    │  │
                                           │  │  1. Fetch tx data  │  │
                                           │  │  2. Decode ERC-20  │  │
                                           │  │  3. Check risk DBs │  │
                                           │  │  4. Analyze pattern│  │
                                           │  │  5. AI explanation │  │
                                           │  └──┬──────┬──────┬───┘  │
                                           │     │      │      │      │
                                           └─────┼──────┼──────┼──────┘
                                                 │      │      │
                                    ┌────────────┘      │      └───────────┐
                                    ▼                   ▼                  ▼
                           ┌───────────────┐   ┌──────────────┐   ┌──────────────┐
                           │ Base Sepolia  │   │ Risk Data    │   │ Claude API   │
                           │ RPC / Block   │   │              │   │              │
                           │ Explorer API  │   │ - OFAC list  │   │ Generate     │
                           │               │   │ - Scam DBs   │   │ explanation  │
                           │ Fetch tx,     │   │ - Heuristics │   │ + risk       │
                           │ receipts,     │   │              │   │ narrative    │
                           │ wallet history│   │              │   │              │
                           └───────────────┘   └──────────────┘   └──────────────┘

Settlement:
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│ x402.org     │        │ USDC Contract│        │ Base Sepolia │
│ Facilitator  │───────►│ on Base      │───────►│ Blockchain   │
│              │ settle │ Sepolia      │ confirm│              │
└──────────────┘        └──────────────┘        └──────────────┘
```

---

## Tech Stack

| Component        | Technology                                      | Purpose                                   |
| ---------------- | ----------------------------------------------- | ----------------------------------------- |
| Language         | TypeScript                                      | x402's best SDK support                   |
| Runtime          | Node.js 20+                                     | Server and client                         |
| Server framework | Express.js                                      | API server                                |
| x402 server      | `@x402/express`, `@x402/evm`, `@x402/core`      | Payment gating                            |
| x402 client      | `@x402/fetch`, `@x402/evm`, `@x402/core`        | Test client                               |
| Wallet/signing   | `viem`                                          | Transaction decoding, wallet operations   |
| Blockchain data  | Base Sepolia RPC (public or Alchemy free tier)  | Fetch transactions                        |
| Block explorer   | Basescan API (free tier)                        | Wallet history for risk scoring           |
| AI               | Anthropic Claude API (claude-sonnet-4-20250514) | Generate explanations and risk narratives |
| Network          | Base Sepolia (CAIP-2: `eip155:84532`)           | Testnet                                   |
| Stablecoin       | USDC on Base Sepolia                            | Payment settlement                        |
| Facilitator      | `https://www.x402.org/facilitator`              | Payment verification/settlement           |

---

## API Endpoints

### `GET /explain`

**Price:** $0.001 via x402

**Query params:** `tx` — a transaction hash on Base Sepolia

**What it does:**

1. Fetches the transaction and its receipt from Base Sepolia RPC
2. Detects if it's an ERC-20 transfer by checking the function selector and event logs
3. Decodes the token, sender, recipient, and amount
4. Looks up token metadata (symbol, decimals, name)
5. Passes the decoded data to Claude API to generate a plain-English explanation
6. Returns structured data + narrative

**Example request:**

```
GET /explain?tx=0xabc123...
Headers: PAYMENT-SIGNATURE: <x402 payment payload>
```

**Example response:**

```json
{
  "transaction": {
    "hash": "0xabc123...",
    "block": 12345678,
    "timestamp": "2025-02-28T14:30:00Z",
    "status": "success"
  },
  "decoded": {
    "type": "ERC-20 Transfer",
    "action": "transfer",
    "token": {
      "symbol": "USDC",
      "name": "USD Coin",
      "address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "decimals": 6
    },
    "from": "0xSenderAddress...",
    "to": "0xRecipientAddress...",
    "amount": "50.00",
    "amountRaw": "50000000"
  },
  "gas": {
    "used": 52000,
    "price": "0.25 gwei",
    "costUsd": "$0.0003"
  },
  "explanation": "This transaction transferred 50.00 USDC from 0xSend...to 0xReci... on Base Sepolia. USDC is a dollar-pegged stablecoin issued by Circle, so this represents a $50 payment. The transaction cost less than a tenth of a cent in network fees and was confirmed in approximately 2 seconds."
}
```

**Unsupported transaction response:**

```json
{
  "transaction": {
    "hash": "0xdef456...",
    "block": 12345679,
    "timestamp": "2025-02-28T14:31:00Z",
    "status": "success"
  },
  "decoded": {
    "type": "unsupported",
    "reason": "This appears to be a Uniswap V3 swap, which is not yet supported. Currently supports ERC-20 transfers (transfer, transferFrom, approve, transferWithAuthorization)."
  }
}
```

---

### `GET /risk`

**Price:** $0.005 via x402

**Query params:** `address` — a wallet address on Base Sepolia

**What it does:**

1. Fetches the wallet's recent transaction history from Basescan API
2. Computes basic wallet metrics (age, transaction count, unique counterparties, token diversity)
3. Checks the address against known risk indicators:
   - OFAC sanctions list (publicly available, updated regularly)
   - Known scam/phishing contract databases (community-maintained)
   - Exchange hot wallet addresses (publicly labeled)
4. Analyzes 1-hop exposure: looks at the wallet's direct counterparties and checks if any of them appear on risk lists
5. Detects suspicious behavioral patterns:
   - Brand new wallet (created very recently, few transactions)
   - Rapid transaction bursts (many transactions in a short window)
   - Uniform transaction amounts (potential structuring)
   - High concentration to a single counterparty
   - Token approval to unverified contracts
6. Passes all of the above to Claude API to generate a risk narrative
7. Returns structured risk data + score + narrative

**Example response:**

```json
{
  "address": "0xTargetWallet...",
  "chain": "Base Sepolia",
  "walletProfile": {
    "firstSeen": "2025-01-15T10:00:00Z",
    "ageInDays": 44,
    "totalTransactions": 127,
    "uniqueCounterparties": 23,
    "tokensHeld": ["USDC", "WETH", "DAI"],
    "totalValueTransferred": "$12,450.00"
  },
  "riskScore": {
    "overall": 0.25,
    "level": "LOW",
    "breakdown": {
      "sanctionsExposure": 0.0,
      "scamExposure": 0.0,
      "behavioralRisk": 0.15,
      "counterpartyRisk": 0.1,
      "walletMaturity": 0.05
    }
  },
  "flags": [],
  "counterpartyAnalysis": {
    "knownEntities": [
      { "address": "0x...", "label": "Coinbase Hot Wallet", "risk": "LOW" }
    ],
    "flaggedCounterparties": [],
    "unknownCounterparties": 18
  },
  "riskNarrative": "This wallet presents low risk. It has been active for 44 days with a diverse transaction history across 23 counterparties. One known entity identified: a Coinbase hot wallet, which suggests the owner uses a regulated exchange. No sanctions matches, no interactions with known scam contracts, and transaction patterns appear organic with no signs of structuring or wash trading. The wallet holds a diversified set of tokens including major stablecoins."
}
```

**High-risk example response:**

```json
{
  "address": "0xSuspiciousWallet...",
  "chain": "Base Sepolia",
  "walletProfile": {
    "firstSeen": "2025-02-27T23:00:00Z",
    "ageInDays": 1,
    "totalTransactions": 47,
    "uniqueCounterparties": 2,
    "tokensHeld": ["USDC"],
    "totalValueTransferred": "$95,000.00"
  },
  "riskScore": {
    "overall": 0.72,
    "level": "HIGH",
    "breakdown": {
      "sanctionsExposure": 0.0,
      "scamExposure": 0.0,
      "behavioralRisk": 0.85,
      "counterpartyRisk": 0.3,
      "walletMaturity": 0.95
    }
  },
  "flags": [
    "BRAND_NEW_WALLET: Created 1 day ago",
    "HIGH_VELOCITY: 47 transactions in 24 hours",
    "LOW_DIVERSITY: Only 2 unique counterparties",
    "UNIFORM_AMOUNTS: 80% of transfers are exactly $2,000",
    "SINGLE_TOKEN: Only holds USDC"
  ],
  "riskNarrative": "This wallet presents elevated risk due to several behavioral indicators. It was created only 1 day ago and has already executed 47 transactions — an unusually high volume for a new wallet. Transaction patterns show concerning uniformity: 80% of transfers are exactly $2,000 USDC to only 2 counterparties, which could indicate automated structuring. The wallet holds only USDC with no other token activity. While no sanctions or known scam exposure was detected, the combination of newness, velocity, and pattern uniformity warrants further review before transacting."
}
```

---

### `GET /health`

**Price:** Free (no x402 payment required)

**Returns:** Service status, supported features, pricing, and usage instructions.

```json
{
  "service": "0xplain — Transaction Intelligence API",
  "status": "healthy",
  "version": "0.1.0",
  "network": "Base Sepolia (eip155:84532)",
  "payment": "x402 (USDC)",
  "endpoints": [
    {
      "path": "/explain",
      "method": "GET",
      "price": "$0.001",
      "description": "Decode and explain an ERC-20 transaction in plain English",
      "params": { "tx": "Transaction hash" }
    },
    {
      "path": "/risk",
      "method": "GET",
      "price": "$0.005",
      "description": "Risk score and analysis for a wallet address",
      "params": { "address": "Wallet address" }
    }
  ],
  "scope": {
    "supported": [
      "ERC-20 transfers",
      "ERC-20 approvals",
      "transferWithAuthorization (x402 settlements)"
    ],
    "notSupported": [
      "DEX swaps",
      "NFTs",
      "native ETH transfers",
      "bridge transactions",
      "batch/multicall"
    ]
  }
}
```

---

## Prerequisites / Environment Setup

### 1. Generate Two Wallets

Two wallets are required — one for the server (receives x402 payments) and one for a test client (makes x402 payments to test the API).

```typescript
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
console.log("Private Key:", privateKey);
console.log("Address:", account.address);
```

### 2. Fund the Client Wallet

The test client wallet needs:

1. **Base Sepolia ETH** (for gas): Use [Coinbase Faucet](https://portal.cdp.coinbase.com/products/faucet) or [Chainlink Faucet](https://faucets.chain.link/base-sepolia)
2. **Base Sepolia USDC** (for x402 payments): Use [Circle Faucet](https://faucet.circle.com/) — select Base Sepolia, 20 USDC every 2 hours

### 3. Get API Keys

- **Basescan API key** (free): Register at [basescan.org/apis](https://basescan.org/apis) for transaction history lookups
- **Anthropic API key**: For Claude API calls to generate explanations and risk narratives
- **RPC endpoint** (optional): Public Base Sepolia RPC works, but Alchemy/QuickNode free tier is more reliable

### 4. Environment Variables

```bash
# .env

# ============================================
# NETWORK TOGGLE — this is the only thing that
# changes between testnet and mainnet
# ============================================
NETWORK=testnet   # "testnet" or "mainnet"

# Server wallet (receives x402 payments)
SERVER_PAY_TO_ADDRESS=0x...

# Blockchain data
# Testnet (used when NETWORK=testnet)
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_SEPOLIA_API_KEY=your_basescan_api_key

# Mainnet (used when NETWORK=mainnet)
BASE_MAINNET_RPC_URL=https://mainnet.base.org
BASESCAN_MAINNET_API_KEY=your_basescan_api_key

# AI
ANTHROPIC_API_KEY=your_anthropic_api_key

# x402 facilitator (works for both testnet and mainnet)
FACILITATOR_URL=https://www.x402.org/facilitator

# Test client wallet (makes x402 payments for testing)
CLIENT_PRIVATE_KEY=0x...

# Server
PORT=4021
```

---

## Network Configuration (`src/config/network.ts`)

The entire codebase is network-agnostic. A single config module resolves all network-specific values based on the `NETWORK` environment variable.

```
NETWORK=testnet                          NETWORK=mainnet
┌─────────────────────────────┐          ┌─────────────────────────────┐
│ Chain ID: 84532             │          │ Chain ID: 8453              │
│ CAIP-2: eip155:84532        │          │ CAIP-2: eip155:8453         │
│ RPC: sepolia.base.org       │          │ RPC: mainnet.base.org       │
│ Explorer: sepolia.basescan  │          │ Explorer: basescan.org      │
│ USDC: 0x036CbD53842c...     │          │ USDC: 0x833589fCD6eD...     │
│ Faucet USDC (free)          │          │ Real USDC ($)               │
└─────────────────────────────┘          └─────────────────────────────┘
```

**What changes between networks:**

| Property           | Testnet (Base Sepolia)                       | Mainnet (Base)                               |
| ------------------ | -------------------------------------------- | -------------------------------------------- |
| Chain ID           | 84532                                        | 8453                                         |
| CAIP-2 identifier  | `eip155:84532`                               | `eip155:8453`                                |
| RPC URL            | `https://sepolia.base.org`                   | `https://mainnet.base.org`                   |
| Block explorer     | `https://sepolia.basescan.org`               | `https://basescan.org`                       |
| Block explorer API | `https://api-sepolia.basescan.org`           | `https://api.basescan.org`                   |
| USDC contract      | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| USDC source        | Circle faucet (free)                         | Buy or receive real USDC                     |

**What stays exactly the same:**

- All application code (decoder, risk scorer, AI narrator, routes)
- x402 middleware configuration (just uses the CAIP-2 identifier from config)
- Facilitator URL (`https://www.x402.org/facilitator` supports both networks)
- ERC-20 ABI and function selectors
- Risk scoring logic and heuristics
- Claude API prompts

---

## Project Structure

```
0xplain/
├── package.json
├── tsconfig.json
├── .env
├── .env.example
├── .gitignore
├── README.md
├── src/
│   ├── server/
│   │   ├── index.ts                 # Express app + x402 middleware setup
│   │   ├── routes/
│   │   │   ├── explain.ts           # /explain endpoint handler
│   │   │   ├── risk.ts              # /risk endpoint handler
│   │   │   └── health.ts            # /health endpoint handler
│   │   └── middleware/
│   │       └── error-handler.ts     # Global error handling
│   ├── config/
│   │   ├── network.ts               # Network config — testnet vs mainnet switch
│   │   └── index.ts                 # Loads env vars, exports typed config
│   ├── intelligence/
│   │   ├── decoder.ts               # Transaction fetching + ERC-20 decoding
│   │   ├── risk-scorer.ts           # Risk scoring engine
│   │   ├── wallet-profiler.ts       # Wallet history analysis
│   │   ├── risk-lists.ts            # OFAC + scam database lookups
│   │   └── ai-narrator.ts           # Claude API integration for explanations
│   ├── blockchain/
│   │   ├── rpc-client.ts            # Base RPC wrapper (viem) — network-aware
│   │   ├── basescan-client.ts       # Basescan API wrapper — network-aware
│   │   └── constants.ts             # Known addresses, ABIs, contract addresses per network
│   ├── client/
│   │   ├── test-explain.ts          # Test client: call /explain with x402 payment
│   │   ├── test-risk.ts             # Test client: call /risk with x402 payment
│   │   └── manual-402-flow.ts       # Diagnostic: raw 402 flow without SDK wrapper
│   └── types/
│       └── index.ts                 # Shared TypeScript types
├── data/
│   ├── ofac-sdn.json               # OFAC sanctions list (address extract)
│   ├── known-exchanges.json         # Labeled exchange addresses on Base (both networks)
│   └── known-scams.json             # Community-maintained scam contract list
└── docs/
    └── DESIGN-DECISIONS.md          # Architecture notes and technical rationale
```

---

## Implementation Details

### Transaction Decoder (`src/intelligence/decoder.ts`)

The decoder fetches a transaction by hash and determines what happened.

**ERC-20 function selectors to detect:**

| Selector     | Function                                | What It Means                                       |
| ------------ | --------------------------------------- | --------------------------------------------------- |
| `0xa9059cbb` | `transfer(address,uint256)`             | Direct token transfer — most common                 |
| `0x23b872dd` | `transferFrom(address,address,uint256)` | Transfer on behalf of another (uses prior approval) |
| `0x095ea7b3` | `approve(address,uint256)`              | Authorize a contract to spend your tokens           |
| `0xe3ee160e` | `transferWithAuthorization(...)`        | EIP-3009 — used by x402 for gasless transfers       |

**How decoding works:**

```
Raw transaction input data:
0xa9059cbb000000000000000000000000recipientaddress...0000000000000000000amount...

Break it down:
- First 4 bytes (0xa9059cbb) = function selector → "transfer"
- Next 32 bytes = recipient address (padded to 32 bytes)
- Next 32 bytes = amount in token's smallest unit

For USDC (6 decimals): amount 50000000 = 50.00 USDC
For WETH (18 decimals): amount 1000000000000000000 = 1.0 WETH
```

The decoder should also read the transaction receipt's event logs, specifically the `Transfer(address indexed from, address indexed to, uint256 value)` event (topic `0xddf252ad...`), which confirms the actual token movement. This is important because `transferFrom` and `transferWithAuthorization` don't directly show the economic sender in the transaction's `from` field.

Use `viem`'s `decodeEventLog` and `decodeFunctionData` utilities — they handle the ABI parsing cleanly.

### Risk Scoring Engine (`src/intelligence/risk-scorer.ts`)

The risk score is a number from 0.0 (no risk) to 1.0 (maximum risk), computed from weighted sub-scores:

**Sub-score components:**

| Component           | Weight | What It Measures                                                | How to Compute                                                                                                     |
| ------------------- | ------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `sanctionsExposure` | 0.30   | Is this address or its counterparties on OFAC/sanctions lists?  | Direct lookup against OFAC SDN list. Binary: 0.0 (no match) or 1.0 (match).                                        |
| `scamExposure`      | 0.25   | Has this address interacted with known scam/phishing contracts? | Check counterparty addresses against scam databases. Score based on % of transactions involving flagged addresses. |
| `behavioralRisk`    | 0.25   | Does the transaction pattern look suspicious?                   | Composite of: wallet age (newer = riskier), transaction velocity, amount uniformity, counterparty concentration.   |
| `counterpartyRisk`  | 0.10   | How risky are the wallets this address transacts with?          | Average risk indicators of top counterparties (1-hop). Mostly: what % are unknown vs labeled entities.             |
| `walletMaturity`    | 0.10   | How established is this wallet?                                 | Age in days, total transaction count, token diversity. Newer/less active = higher score.                           |

**Overall score:** `sum(component * weight)` clamped to [0.0, 1.0]

**Risk levels:**

- 0.0 - 0.25: **LOW** — no significant risk indicators
- 0.25 - 0.60: **MEDIUM** — some flags, worth reviewing
- 0.60 - 1.0: **HIGH** — multiple risk indicators, exercise caution

**Behavioral flags to detect:**

| Flag               | Condition                                       | Risk Implication                                            |
| ------------------ | ----------------------------------------------- | ----------------------------------------------------------- |
| `BRAND_NEW_WALLET` | Created < 7 days ago                            | New wallets are higher risk — no history to evaluate        |
| `HIGH_VELOCITY`    | > 20 transactions in 24 hours                   | Unusual for normal users, could be automated                |
| `UNIFORM_AMOUNTS`  | > 50% of transfers are same amount              | Potential structuring (splitting to avoid thresholds)       |
| `LOW_DIVERSITY`    | < 3 unique counterparties                       | Funds flowing to/from very few addresses                    |
| `SINGLE_TOKEN`     | Only holds/transfers one token type             | Unusual — most active wallets interact with multiple tokens |
| `LARGE_APPROVAL`   | Unlimited token approval to unverified contract | Common phishing/scam vector                                 |

### AI Narrator (`src/intelligence/ai-narrator.ts`)

Pass the decoded transaction data and risk metrics to Claude's API with a structured prompt. The AI generates two things:

1. **For /explain**: A plain-English explanation of what the transaction did, who was involved, and what it cost
2. **For /risk**: A risk narrative that synthesizes the numerical scores and flags into actionable advice

**Prompt structure for /explain:**

```
You are a blockchain transaction analyst. Given the following decoded transaction data,
write a clear, concise explanation in 2-3 sentences that a non-technical person could understand.
Include: what moved, how much, between whom, and the cost.

Transaction data:
{decoded transaction JSON}
```

**Prompt structure for /risk:**

```
You are a blockchain risk analyst. Given the following wallet profile and risk metrics,
write a 3-4 sentence risk assessment. Be specific about what flags were triggered and why.
If the risk is low, say so clearly. If high, explain what specifically is concerning.

Wallet profile:
{wallet metrics JSON}

Risk scores:
{risk breakdown JSON}

Flags:
{flags array}
```

Keep the Claude API calls lightweight — use claude-sonnet-4-20250514 (fast, cheap) and set max_tokens to 200-300. At ~$0.003 per 1K input tokens, each API call costs well under a penny.

---

## Risk Data Sources

These are freely available and don't require expensive enterprise licenses:

| Source                                                   | What It Contains                                         | How to Use                                                            |
| -------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| [OFAC SDN List](https://sanctionssearch.ofac.treas.gov/) | US Treasury sanctions — includes crypto addresses        | Download, extract addresses, check for matches. Updated regularly.    |
| [Etherscan Labels](https://etherscan.io/labelcloud)      | Community-labeled addresses (exchanges, contracts, etc.) | Reference for identifying known entities. Some available via API.     |
| [chainabuse.com](https://www.chainabuse.com/)            | Community-reported scam/fraud addresses                  | Check counterparties against reported addresses.                      |
| [Forta Network](https://forta.org/)                      | Real-time threat detection alerts                        | Optional: check if address has triggered Forta alerts.                |
| Known exchange addresses                                 | Publicly labeled hot wallets for Coinbase, Binance, etc. | Curate a JSON file — reduces "unknown counterparty" noise in scoring. |

**For the proof of concept**, start with a small curated dataset in JSON files under `data/`. You don't need to integrate every source — even just OFAC + a few dozen known exchange addresses + basic behavioral heuristics produces meaningful results.

---

## Running the Project

```bash
# Install dependencies
npm install

# Start the server
npx ts-node src/server/index.ts

# In another terminal — test the /explain endpoint
npx ts-node src/client/test-explain.ts

# Test the /risk endpoint
npx ts-node src/client/test-risk.ts

# Diagnostic: see the raw 402 flow
npx ts-node src/client/manual-402-flow.ts
```

### Testing with curl

```bash
# Health check (free, no payment)
curl http://localhost:4021/health

# This should return 402 Payment Required with payment terms
curl -v http://localhost:4021/explain?tx=0xSomeTransactionHash

# Check the PAYMENT-REQUIRED header in the response
```

---

## Verification / Success Criteria

The prototype is complete when:

1. **Server returns 402 for unpaid requests** — curl to /explain or /risk returns HTTP 402 with `PAYMENT-REQUIRED` header
2. **Test client auto-pays and gets results** — the x402 client wrapper handles 402 → sign → retry automatically
3. **/explain correctly decodes an ERC-20 transfer** — given a real testnet tx hash, it identifies the token, amount, sender, recipient, and generates a coherent explanation
4. **/explain returns "unsupported" for non-ERC-20 transactions** — graceful handling of out-of-scope transactions
5. **/risk returns a meaningful score** — given a wallet address, it produces a risk score with breakdown and narrative
6. **Risk flags fire correctly** — test with a brand new wallet (should flag `BRAND_NEW_WALLET`), test with a well-established address (should score low)
7. **Payment receipts are present** — `PAYMENT-RESPONSE` header in successful responses
8. **On-chain settlement is verifiable** — check both wallets on [Base Sepolia Explorer](https://sepolia.basescan.org/) to confirm USDC moved

---

## Technical Reference: Core Concepts

Key protocols and standards used in 0xplain:

| Concept                                  | What It Is                                                                             | Role in This Project                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **HTTP 402 flow**                        | Server returns payment terms → client signs → retries → verified → data returned       | Payment gating for all API endpoints                                            |
| **EIP-712 signatures**                   | Typed structured data signing — proves authorization without revealing the private key | How clients authorize USDC payments to the API                                  |
| **EIP-3009 (transferWithAuthorization)** | USDC function allowing third-party settlement from a signed message                    | How the x402 facilitator settles payments on-chain                              |
| **CAIP-2 identifiers**                   | Chain-agnostic naming (`eip155:84532` = Base Sepolia, `eip155:8453` = Base mainnet)    | Network identification across testnet and mainnet configs                       |
| **ERC-20 event logs**                    | `Transfer(from, to, value)` events emitted during token movements                      | Primary data source for transaction decoding                                    |
| **Risk scoring heuristics**              | Behavioral patterns + association analysis = risk score                                | Core of the `/risk` endpoint — designed to evolve into a policy engine          |
| **Facilitator pattern**                  | Trusted third party that verifies and settles payments                                 | Payment infrastructure — understanding this informs future gateway architecture |

---

## Deployment Plan

### Phase 1: Testnet (Build & Test)

**Goal:** Get everything working on Base Sepolia with free testnet USDC.

**Steps:**

1. Scaffold project, install dependencies
2. Implement blockchain clients (RPC + Basescan) with network config
3. Build the transaction decoder — test with real testnet tx hashes
4. Build the risk scorer — test with testnet wallet addresses
5. Wire up Claude API for narratives
6. Add x402 middleware to Express routes
7. Test end-to-end: client pays x402 → gets explanation/risk score back
8. Verify payments settled on [Base Sepolia Explorer](https://sepolia.basescan.org/)

**Cost:** $0 (testnet USDC is free, Claude API costs negligible during testing)

### Phase 2: Mainnet (Deploy & Share)

**Goal:** Deploy on Base mainnet so the x402 community can actually use it.

**Prerequisites:**

- Phase 1 is complete and tested
- You have a small amount of real USDC for your test client wallet (even $5 is enough for thousands of test requests at $0.001-0.005 each)
- Your server wallet address is ready to receive real USDC payments

**Steps:**

1. Set `NETWORK=mainnet` in `.env`
2. Update `SERVER_PAY_TO_ADDRESS` to your mainnet wallet (can be the same address — Ethereum addresses work across networks)
3. Update RPC URL and Basescan API key for mainnet
4. Fund your test client wallet with real USDC on Base (buy on Coinbase and transfer, or bridge from another chain)
5. Test end-to-end on mainnet — confirm real USDC moves
6. Deploy to a hosting provider
7. Register on the x402 Bazaar for agent discovery
8. Share on X / crypto dev communities

**Hosting options (cheap):**

| Provider                       | Cost                | Notes                                     |
| ------------------------------ | ------------------- | ----------------------------------------- |
| [Railway](https://railway.app) | ~$5/month           | Easy deploy from GitHub, good for Node.js |
| [Fly.io](https://fly.io)       | Free tier available | Good for lightweight APIs                 |
| [Render](https://render.com)   | Free tier available | Auto-deploy from GitHub                   |
| DigitalOcean Droplet           | $4-6/month          | Full control, more setup                  |

**Mainnet cost economics:**

Your API charges $0.001-$0.005 per request in USDC. Your costs per request are:

- Claude API call: ~$0.001-0.003 (Sonnet, small prompts)
- RPC calls: free (public RPC) or negligible (Alchemy free tier = 300M compute units/month)
- Basescan API: free (5 calls/sec on free tier)
- Hosting: fixed ~$5/month regardless of traffic

So at $0.001/request for /explain, you roughly break even on the Claude API cost. At $0.005/request for /risk, you're profitable per request. The x402 payment covers the AI inference cost — this is a sustainable model even at tiny scale.

**Mainnet risk considerations:**

- Your server wallet will accumulate real USDC from payments. Keep the private key secure.
- Your server doesn't send money out (unlike the slot machine idea) — it only receives x402 payments. Lower risk profile.
- The amounts are tiny — even 10,000 requests at $0.005 each = $50 total. This isn't a financial risk.
- The Claude API key is the most sensitive credential — if someone gets it, they could run up your Anthropic bill. Use rate limiting.

---

## Stretch Goals

If you finish early or want to go deeper before moving to Project B:

1. **Support native ETH transfers** — simpler than ERC-20 (no event log decoding needed), broadens coverage
2. **Register on x402 Bazaar** — make 0xplain discoverable by any x402-compatible agent
3. **Build a landing page** — simple static site at 0xplain.xyz (or similar) showing what the API does, pricing, example responses, and total requests served. Good for sharing on X.
4. **Add a `/scan` endpoint** — submit a transaction hash, get both the explanation AND risk scores for both wallets involved in one call (combines /explain and /risk). Price at $0.01.
5. **Rate limiting** — protect the Claude API key by limiting requests per wallet address per minute
6. **Analytics** — track requests, revenue, popular queries. Simple SQLite or JSON file.

---

## Reference Links

### x402

- [x402 GitHub](https://github.com/coinbase/x402)
- [x402 Docs](https://docs.x402.org)
- [Seller Quickstart (Coinbase)](https://docs.cdp.coinbase.com/x402/quickstart-for-sellers)
- [Buyer Quickstart](https://docs.x402.org/getting-started/quickstart-for-buyers)
- [v1 → v2 Migration](https://docs.cdp.coinbase.com/x402/migration-guide) — use v2 patterns
- [x402 Whitepaper](https://www.x402.org/x402-whitepaper.pdf)
- [awesome-x402](https://github.com/Merit-Systems/awesome-x402)

### Blockchain / Base

- [Base Sepolia Explorer](https://sepolia.basescan.org/)
- [Basescan API Docs](https://docs.basescan.org/)
- [Circle USDC Faucet](https://faucet.circle.com/)
- [Chainlink Base Sepolia Faucet](https://faucets.chain.link/base-sepolia)
- [viem Documentation](https://viem.sh/) — the TypeScript library for Ethereum interactions

### Risk Data

- [OFAC SDN Search](https://sanctionssearch.ofac.treas.gov/)
- [chainabuse.com](https://www.chainabuse.com/)
- [Forta Network](https://forta.org/)

---

## Notes for Claude Code Prompting

When you hand this to Claude Code:

- **Use v2 x402 packages** (`@x402/express`, `@x402/fetch`, `@x402/evm`, `@x402/core`) — not v1 (`x402-express`)
- **Use CAIP-2 network identifiers** (`eip155:84532`) — not string names (`base-sepolia`)
- **Facilitator URL:** `https://www.x402.org/facilitator`
- **Real testnet USDC is required** in the client wallet before testing — cannot be mocked
- **Have Claude Code scaffold the project structure first**, then implement in order: blockchain clients → decoder → risk scorer → AI narrator → routes → x402 middleware → test clients
- **Test the server with curl first** (should get 402) before running the x402 test client
- **The decoder and risk scorer should work independently of x402** — unit test them with hardcoded transaction hashes before wiring up the payment layer
- **For Claude API calls**, use `claude-sonnet-4-20250514` with max_tokens 300. Keep prompts concise — you're paying per token.
- **Keep risk data files small for the POC** — a few dozen known exchange addresses and the OFAC digital currency addresses is enough to demonstrate the pattern
