import { Router } from "express";
import { decodeTransaction } from "../../intelligence/decoder.js";
import { generateExplanation, generateRiskNarrative } from "../../intelligence/ai-narrator.js";
import { scoreRisk } from "../../intelligence/risk-scorer.js";
import type { RpcClient } from "../../blockchain/rpc-client.js";
import type { BasescanClient } from "../../blockchain/basescan-client.js";
import type { ExplainResponse } from "../../types/index.js";

// Simple in-memory rate limiter: 10 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export function demoRouter(rpcClient: RpcClient, basescan: BasescanClient, anthropicApiKey: string) {
  const router = Router();

  router.get("/demo/explain", async (req, res, next) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkRateLimit(ip)) {
        res.status(429).json({ error: "Rate limit exceeded. Demo allows 10 requests per minute." });
        return;
      }

      const txHash = req.query.tx as string;
      if (!txHash || !txHash.startsWith("0x") || txHash.length !== 66) {
        res.status(400).json({
          error: "Invalid transaction hash. Provide a valid 66-character hex hash via ?tx=0x...",
        });
        return;
      }

      const decoded = await decodeTransaction(txHash as `0x${string}`, rpcClient);

      if (decoded.decoded.type === "unsupported") {
        res.json(decoded);
        return;
      }

      const explanation = await generateExplanation(decoded, anthropicApiKey);
      const response: ExplainResponse = { ...decoded, explanation };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  router.get("/demo/risk", async (req, res, next) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkRateLimit(ip)) {
        res.status(429).json({ error: "Rate limit exceeded. Demo allows 10 requests per minute." });
        return;
      }

      const address = req.query.address as string;
      if (!address || !address.startsWith("0x") || address.length !== 42) {
        res.status(400).json({
          error: "Invalid wallet address. Provide a valid 42-character hex address via ?address=0x...",
        });
        return;
      }

      const riskData = await scoreRisk(address, basescan);
      riskData.riskNarrative = await generateRiskNarrative(
        riskData.walletProfile,
        riskData.riskScore,
        riskData.flags,
        anthropicApiKey,
      );

      res.json(riskData);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
