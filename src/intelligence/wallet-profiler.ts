import type { BasescanClient } from "../blockchain/basescan-client.js";
import type { WalletProfile } from "../types/index.js";
import { formatUnits } from "viem";

export async function profileWallet(
  address: string,
  basescan: BasescanClient,
): Promise<WalletProfile> {
  const [normalTxs, tokenTxs] = await Promise.all([
    basescan.getNormalTransactions(address, { sort: "asc", limit: 200 }),
    basescan.getTokenTransfers(address, { sort: "asc", limit: 200 }),
  ]);

  const allTxTimestamps = [
    ...normalTxs.map((t) => Number(t.timeStamp)),
    ...tokenTxs.map((t) => Number(t.timeStamp)),
  ].sort((a, b) => a - b);

  const firstSeen = allTxTimestamps.length > 0
    ? new Date(allTxTimestamps[0] * 1000).toISOString()
    : new Date().toISOString();

  const ageInDays = allTxTimestamps.length > 0
    ? Math.floor((Date.now() / 1000 - allTxTimestamps[0]) / 86400)
    : 0;

  // Unique counterparties from both normal and token txs
  const counterparties = new Set<string>();
  for (const tx of normalTxs) {
    const other = tx.from.toLowerCase() === address.toLowerCase() ? tx.to : tx.from;
    if (other) counterparties.add(other.toLowerCase());
  }
  for (const tx of tokenTxs) {
    const other = tx.from.toLowerCase() === address.toLowerCase() ? tx.to : tx.from;
    if (other) counterparties.add(other.toLowerCase());
  }

  // Tokens held (from token transfers)
  const tokenSymbols = new Set<string>();
  for (const tx of tokenTxs) {
    if (tx.tokenSymbol) tokenSymbols.add(tx.tokenSymbol);
  }

  // Total value transferred (sum of token transfers, approximated)
  let totalValueUsd = 0;
  for (const tx of tokenTxs) {
    const decimals = parseInt(tx.tokenDecimal) || 18;
    const amount = Number(formatUnits(BigInt(tx.value || "0"), decimals));
    // Rough USD estimate: stablecoins at $1, others ignored for simplicity
    const stablecoins = ["USDC", "USDT", "DAI", "EURC", "BUSD"];
    if (stablecoins.includes(tx.tokenSymbol?.toUpperCase())) {
      totalValueUsd += amount;
    }
  }

  return {
    address,
    firstSeen,
    ageInDays,
    totalTransactions: normalTxs.length + tokenTxs.length,
    uniqueCounterparties: counterparties.size,
    tokensHeld: [...tokenSymbols],
    totalValueTransferred: `$${totalValueUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  };
}

export interface BehavioralFlags {
  flags: string[];
  counterpartyAddresses: string[];
  txTimestamps: number[];
  amountsPerToken: Map<string, number[]>;
}

export function analyzeBehavior(
  address: string,
  normalTxs: { timeStamp: string; from: string; to: string; value: string }[],
  tokenTxs: { timeStamp: string; from: string; to: string; value: string; tokenSymbol: string; tokenDecimal: string }[],
): BehavioralFlags {
  const flags: string[] = [];
  const allTimestamps = [
    ...normalTxs.map((t) => Number(t.timeStamp)),
    ...tokenTxs.map((t) => Number(t.timeStamp)),
  ].sort((a, b) => a - b);

  const counterparties = new Set<string>();
  for (const tx of [...normalTxs, ...tokenTxs]) {
    const other = tx.from.toLowerCase() === address.toLowerCase() ? tx.to : tx.from;
    if (other) counterparties.add(other.toLowerCase());
  }

  // BRAND_NEW_WALLET: Created < 7 days ago
  if (allTimestamps.length > 0) {
    const ageInDays = (Date.now() / 1000 - allTimestamps[0]) / 86400;
    if (ageInDays < 7) {
      flags.push(`BRAND_NEW_WALLET: Created ${Math.floor(ageInDays)} days ago`);
    }
  }

  // HIGH_VELOCITY: > 20 transactions in 24 hours
  if (allTimestamps.length > 20) {
    const last24h = allTimestamps.filter((t) => t > Date.now() / 1000 - 86400);
    if (last24h.length > 20) {
      flags.push(`HIGH_VELOCITY: ${last24h.length} transactions in 24 hours`);
    }
  }

  // LOW_DIVERSITY: < 3 unique counterparties
  if (counterparties.size < 3 && allTimestamps.length > 5) {
    flags.push(`LOW_DIVERSITY: Only ${counterparties.size} unique counterparties`);
  }

  // UNIFORM_AMOUNTS: > 50% of transfers are same amount
  const amountsPerToken = new Map<string, number[]>();
  for (const tx of tokenTxs) {
    const decimals = parseInt(tx.tokenDecimal) || 18;
    const amount = Number(formatUnits(BigInt(tx.value || "0"), decimals));
    const key = tx.tokenSymbol || "ETH";
    if (!amountsPerToken.has(key)) amountsPerToken.set(key, []);
    amountsPerToken.get(key)!.push(amount);
  }

  for (const [symbol, amounts] of amountsPerToken) {
    if (amounts.length < 5) continue;
    const freq = new Map<number, number>();
    for (const a of amounts) {
      const rounded = Math.round(a * 100) / 100;
      freq.set(rounded, (freq.get(rounded) || 0) + 1);
    }
    const maxFreq = Math.max(...freq.values());
    if (maxFreq / amounts.length > 0.5) {
      const pct = Math.round((maxFreq / amounts.length) * 100);
      const mostCommon = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
      flags.push(`UNIFORM_AMOUNTS: ${pct}% of ${symbol} transfers are exactly $${mostCommon}`);
    }
  }

  // SINGLE_TOKEN: Only holds/transfers one token type
  const tokenSymbols = new Set(tokenTxs.map((t) => t.tokenSymbol).filter(Boolean));
  if (tokenSymbols.size === 1 && tokenTxs.length > 5) {
    flags.push(`SINGLE_TOKEN: Only holds ${[...tokenSymbols][0]}`);
  }

  return {
    flags,
    counterpartyAddresses: [...counterparties],
    txTimestamps: allTimestamps,
    amountsPerToken,
  };
}
