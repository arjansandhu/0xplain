import type { NetworkConfig } from "../types/index.js";

const testnet: NetworkConfig = {
  name: "testnet",
  chainId: 84532,
  caip2: "eip155:84532",
  rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
  explorerUrl: "https://sepolia.basescan.org",
  explorerApiUrl: "https://api.etherscan.io/v2/api",
  explorerApiKey: process.env.BASESCAN_SEPOLIA_API_KEY || "",
  usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

const mainnet: NetworkConfig = {
  name: "mainnet",
  chainId: 8453,
  caip2: "eip155:8453",
  rpcUrl: process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org",
  explorerUrl: "https://basescan.org",
  explorerApiUrl: "https://api.etherscan.io/v2/api",
  explorerApiKey: process.env.BASESCAN_MAINNET_API_KEY || "",
  usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

export function getNetworkConfig(): NetworkConfig {
  const network = process.env.NETWORK || "testnet";
  if (network === "mainnet") return mainnet;
  return testnet;
}
