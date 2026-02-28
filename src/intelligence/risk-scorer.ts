import { checkOFAC, checkScam, isKnownEntity } from "./risk-lists.js";
import { profileWallet, analyzeBehavior } from "./wallet-profiler.js";
import type { BasescanClient } from "../blockchain/basescan-client.js";
import type { RiskScore, RiskBreakdown, RiskResponse, CounterpartyInfo } from "../types/index.js";

const WEIGHTS = {
  sanctionsExposure: 0.30,
  scamExposure: 0.25,
  behavioralRisk: 0.25,
  counterpartyRisk: 0.10,
  walletMaturity: 0.10,
};

function computeWalletMaturity(ageInDays: number, totalTxs: number, tokenDiversity: number): number {
  let score = 0;

  // Age: newer wallets = higher risk score
  if (ageInDays < 1) score += 0.4;
  else if (ageInDays < 7) score += 0.3;
  else if (ageInDays < 30) score += 0.15;
  else if (ageInDays < 90) score += 0.05;

  // Transaction count: fewer txs = higher risk
  if (totalTxs < 5) score += 0.3;
  else if (totalTxs < 20) score += 0.15;
  else if (totalTxs < 50) score += 0.05;

  // Token diversity: fewer tokens = higher risk
  if (tokenDiversity <= 1) score += 0.3;
  else if (tokenDiversity <= 3) score += 0.1;

  return Math.min(score, 1);
}

function computeBehavioralRisk(flags: string[]): number {
  const flagWeights: Record<string, number> = {
    BRAND_NEW_WALLET: 0.25,
    HIGH_VELOCITY: 0.30,
    UNIFORM_AMOUNTS: 0.20,
    LOW_DIVERSITY: 0.15,
    SINGLE_TOKEN: 0.10,
    LARGE_APPROVAL: 0.25,
  };

  let score = 0;
  for (const flag of flags) {
    const key = flag.split(":")[0];
    score += flagWeights[key] || 0.1;
  }
  return Math.min(score, 1);
}

export async function scoreRisk(
  address: string,
  basescan: BasescanClient,
): Promise<RiskResponse> {
  const profile = await profileWallet(address, basescan);

  const [normalTxs, tokenTxs] = await Promise.all([
    basescan.getNormalTransactions(address, { sort: "desc", limit: 200 }),
    basescan.getTokenTransfers(address, { sort: "desc", limit: 200 }),
  ]);

  const behavior = analyzeBehavior(address, normalTxs, tokenTxs);

  // Sanctions check — direct and 1-hop
  const directSanctioned = checkOFAC(address);
  let sanctionsExposure = directSanctioned ? 1.0 : 0.0;
  if (!directSanctioned) {
    const sanctionedCounterparties = behavior.counterpartyAddresses.filter(checkOFAC);
    if (sanctionedCounterparties.length > 0) {
      sanctionsExposure = 0.5 + (sanctionedCounterparties.length / behavior.counterpartyAddresses.length) * 0.5;
    }
  }

  // Scam exposure — direct and counterparty
  const directScam = checkScam(address);
  let scamExposure = directScam ? 1.0 : 0.0;
  if (!directScam) {
    const scamCounterparties = behavior.counterpartyAddresses.filter((a) => checkScam(a) !== null);
    if (scamCounterparties.length > 0) {
      scamExposure = 0.3 + (scamCounterparties.length / Math.max(behavior.counterpartyAddresses.length, 1)) * 0.7;
    }
  }

  // Behavioral risk
  const behavioralRisk = computeBehavioralRisk(behavior.flags);

  // Counterparty risk: % unknown counterparties
  let unknownCount = 0;
  const knownEntities: CounterpartyInfo[] = [];
  const flaggedCounterparties: CounterpartyInfo[] = [];

  for (const cp of behavior.counterpartyAddresses) {
    const entity = isKnownEntity(cp);
    if (entity.known) {
      const info: CounterpartyInfo = { address: cp, label: entity.label!, risk: entity.risk! };
      if (entity.risk === "HIGH") {
        flaggedCounterparties.push(info);
      } else {
        knownEntities.push(info);
      }
    } else {
      unknownCount++;
    }
  }

  const counterpartyRisk = behavior.counterpartyAddresses.length > 0
    ? (unknownCount / behavior.counterpartyAddresses.length) * 0.5 +
      (flaggedCounterparties.length / Math.max(behavior.counterpartyAddresses.length, 1)) * 0.5
    : 0.5; // no counterparties = moderate risk

  // Wallet maturity
  const walletMaturity = computeWalletMaturity(
    profile.ageInDays,
    profile.totalTransactions,
    profile.tokensHeld.length,
  );

  const breakdown: RiskBreakdown = {
    sanctionsExposure,
    scamExposure,
    behavioralRisk,
    counterpartyRisk,
    walletMaturity,
  };

  const overall = Math.min(
    Object.entries(breakdown).reduce(
      (sum, [key, value]) => sum + value * WEIGHTS[key as keyof typeof WEIGHTS],
      0,
    ),
    1,
  );

  const level: RiskScore["level"] =
    overall < 0.25 ? "LOW" : overall < 0.6 ? "MEDIUM" : "HIGH";

  return {
    address,
    chain: "Base Sepolia",
    walletProfile: profile,
    riskScore: {
      overall: Math.round(overall * 100) / 100,
      level,
      breakdown: {
        sanctionsExposure: Math.round(breakdown.sanctionsExposure * 100) / 100,
        scamExposure: Math.round(breakdown.scamExposure * 100) / 100,
        behavioralRisk: Math.round(breakdown.behavioralRisk * 100) / 100,
        counterpartyRisk: Math.round(breakdown.counterpartyRisk * 100) / 100,
        walletMaturity: Math.round(breakdown.walletMaturity * 100) / 100,
      },
    },
    flags: behavior.flags,
    counterpartyAnalysis: {
      knownEntities,
      flaggedCounterparties,
      unknownCounterparties: unknownCount,
    },
    riskNarrative: "", // filled by AI narrator
  };
}
