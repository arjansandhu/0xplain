export interface NetworkConfig {
  name: "testnet" | "mainnet";
  chainId: number;
  caip2: string;
  rpcUrl: string;
  explorerUrl: string;
  explorerApiUrl: string;
  explorerApiKey: string;
  usdcAddress: `0x${string}`;
}

export interface AppConfig {
  network: NetworkConfig;
  serverPayToAddress: `0x${string}`;
  anthropicApiKey: string;
  facilitatorUrl: string;
  clientPrivateKey: `0x${string}`;
  port: number;
}

export interface TokenInfo {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
}

export interface DecodedTransaction {
  transaction: {
    hash: string;
    block: number;
    timestamp: string;
    status: "success" | "failure";
  };
  decoded:
    | {
        type: "ERC-20 Transfer" | "ERC-20 Approval" | "ERC-20 TransferFrom" | "ERC-20 TransferWithAuthorization";
        action: string;
        token: TokenInfo;
        from: string;
        to: string;
        amount: string;
        amountRaw: string;
      }
    | {
        type: "unsupported";
        reason: string;
      };
  gas: {
    used: number;
    price: string;
    costUsd: string;
  };
}

export interface WalletProfile {
  address: string;
  firstSeen: string;
  ageInDays: number;
  totalTransactions: number;
  uniqueCounterparties: number;
  tokensHeld: string[];
  totalValueTransferred: string;
}

export interface RiskBreakdown {
  sanctionsExposure: number;
  scamExposure: number;
  behavioralRisk: number;
  counterpartyRisk: number;
  walletMaturity: number;
}

export interface RiskScore {
  overall: number;
  level: "LOW" | "MEDIUM" | "HIGH";
  breakdown: RiskBreakdown;
}

export interface CounterpartyInfo {
  address: string;
  label: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
}

export interface RiskResponse {
  address: string;
  chain: string;
  walletProfile: WalletProfile;
  riskScore: RiskScore;
  flags: string[];
  counterpartyAnalysis: {
    knownEntities: CounterpartyInfo[];
    flaggedCounterparties: CounterpartyInfo[];
    unknownCounterparties: number;
  };
  riskNarrative: string;
}

export interface ExplainResponse extends DecodedTransaction {
  explanation: string;
}
