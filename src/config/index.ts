import "dotenv/config";
import { getNetworkConfig } from "./network.js";
import type { AppConfig } from "../types/index.js";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export function getConfig(): AppConfig {
  const network = getNetworkConfig();
  return {
    network,
    serverPayToAddress: requireEnv("SERVER_PAY_TO_ADDRESS") as `0x${string}`,
    anthropicApiKey: requireEnv("ANTHROPIC_API_KEY"),
    facilitatorUrl: process.env.FACILITATOR_URL || "https://www.x402.org/facilitator",
    clientPrivateKey: requireEnv("CLIENT_PRIVATE_KEY") as `0x${string}`,
    port: parseInt(process.env.PORT || "4021", 10),
  };
}
