import type { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("[0xplain] Error:", err.message);

  if (err.message.includes("Transaction not found") || err.message.includes("could not be found")) {
    res.status(404).json({
      error: "Transaction or address not found on-chain.",
      details: err.message,
    });
    return;
  }

  res.status(500).json({
    error: "Internal server error",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
}
