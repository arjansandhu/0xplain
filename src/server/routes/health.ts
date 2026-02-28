import { Router } from "express";
import type { NetworkConfig } from "../../types/index.js";

export function healthRouter(network: NetworkConfig) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      service: "0xplain — Transaction Intelligence API",
      status: "healthy",
      version: "0.1.0",
      network: `${network.name === "testnet" ? "Base Sepolia" : "Base"} (${network.caip2})`,
      payment: "x402 (USDC)",
      endpoints: [
        {
          path: "/explain",
          method: "GET",
          price: "$0.001",
          description: "Decode and explain an ERC-20 transaction in plain English",
          params: { tx: "Transaction hash" },
        },
        {
          path: "/risk",
          method: "GET",
          price: "$0.005",
          description: "Risk score and analysis for a wallet address",
          params: { address: "Wallet address" },
        },
      ],
      scope: {
        supported: [
          "ERC-20 transfers",
          "ERC-20 approvals",
          "transferWithAuthorization (x402 settlements)",
        ],
        notSupported: [
          "DEX swaps",
          "NFTs",
          "native ETH transfers",
          "bridge transactions",
          "batch/multicall",
        ],
      },
    });
  });

  return router;
}
