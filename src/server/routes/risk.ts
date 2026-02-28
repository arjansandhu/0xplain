import { Router } from "express";
import { scoreRisk } from "../../intelligence/risk-scorer.js";
import { generateRiskNarrative } from "../../intelligence/ai-narrator.js";
import type { BasescanClient } from "../../blockchain/basescan-client.js";

export function riskRouter(basescan: BasescanClient, anthropicApiKey: string) {
  const router = Router();

  router.get("/risk", async (req, res, next) => {
    try {
      const address = req.query.address as string;

      if (!address || !address.startsWith("0x") || address.length !== 42) {
        res.status(400).json({
          error: "Invalid wallet address. Provide a valid 42-character hex address via ?address=0x...",
        });
        return;
      }

      const riskData = await scoreRisk(address, basescan);

      // Generate AI risk narrative
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
