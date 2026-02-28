import Anthropic from "@anthropic-ai/sdk";
import type { DecodedTransaction, RiskResponse, WalletProfile, RiskScore } from "../types/index.js";

let client: Anthropic | null = null;

function getClient(apiKey: string): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function generateExplanation(
  decoded: DecodedTransaction,
  apiKey: string,
): Promise<string> {
  const anthropic = getClient(apiKey);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `You are a blockchain transaction analyst. Given the following decoded transaction data, write a clear, concise explanation in 2-3 sentences that a non-technical person could understand. Include: what moved, how much, between whom, and the cost.

Transaction data:
${JSON.stringify(decoded, null, 2)}`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type === "text") {
    return block.text;
  }
  return "Unable to generate explanation.";
}

export async function generateRiskNarrative(
  walletProfile: WalletProfile,
  riskScore: RiskScore,
  flags: string[],
  apiKey: string,
): Promise<string> {
  const anthropic = getClient(apiKey);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `You are a blockchain risk analyst. Given the following wallet profile and risk metrics, write a 3-4 sentence risk assessment. Be specific about what flags were triggered and why. If the risk is low, say so clearly. If high, explain what specifically is concerning.

Wallet profile:
${JSON.stringify(walletProfile, null, 2)}

Risk scores:
${JSON.stringify(riskScore, null, 2)}

Flags:
${JSON.stringify(flags, null, 2)}`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type === "text") {
    return block.text;
  }
  return "Unable to generate risk narrative.";
}
