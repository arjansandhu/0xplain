import { Router } from "express";
import { decodeTransaction } from "../../intelligence/decoder.js";
import { generateExplanation } from "../../intelligence/ai-narrator.js";
import type { RpcClient } from "../../blockchain/rpc-client.js";
import type { ExplainResponse } from "../../types/index.js";

export function explainRouter(rpcClient: RpcClient, anthropicApiKey: string) {
  const router = Router();

  router.get("/explain", async (req, res, next) => {
    try {
      const txHash = req.query.tx as string;

      if (!txHash || !txHash.startsWith("0x") || txHash.length !== 66) {
        res.status(400).json({
          error: "Invalid transaction hash. Provide a valid 66-character hex hash via ?tx=0x...",
        });
        return;
      }

      const decoded = await decodeTransaction(txHash as `0x${string}`, rpcClient);

      // If unsupported, return without AI explanation
      if (decoded.decoded.type === "unsupported") {
        res.json(decoded);
        return;
      }

      // Generate AI explanation
      const explanation = await generateExplanation(decoded, anthropicApiKey);

      const response: ExplainResponse = {
        ...decoded,
        explanation,
      };

      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
