import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { getConfig } from "../config/index.js";
import { createRpcClient } from "../blockchain/rpc-client.js";
import { createBasescanClient } from "../blockchain/basescan-client.js";
import { healthRouter } from "./routes/health.js";
import { explainRouter } from "./routes/explain.js";
import { riskRouter } from "./routes/risk.js";
import { demoRouter } from "./routes/demo.js";
import { errorHandler } from "./middleware/error-handler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const config = getConfig();
const rpcClient = createRpcClient(config.network);
const basescanClient = createBasescanClient(config.network);

const app = express();

// Static frontend
app.use(express.static(join(__dirname, "../../public")));

// Free routes (before x402 middleware)
app.use(healthRouter(config.network));
app.use(demoRouter(rpcClient, basescanClient, config.anthropicApiKey));

// x402 payment middleware (only gates /explain and /risk)
const facilitatorClient = new HTTPFacilitatorClient({ url: config.facilitatorUrl });
const caip2 = config.network.caip2 as `${string}:${string}`;
const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(caip2, new ExactEvmScheme());

app.use(
  paymentMiddleware(
    {
      "GET /explain": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.001",
            network: caip2,
            payTo: config.serverPayToAddress,
          },
        ],
        description: "Decode and explain an ERC-20 transaction in plain English",
        mimeType: "application/json",
      },
      "GET /risk": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.005",
            network: caip2,
            payTo: config.serverPayToAddress,
          },
        ],
        description: "Risk score and analysis for a wallet address",
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

// Paid routes (after x402 middleware)
app.use(explainRouter(rpcClient, config.anthropicApiKey));
app.use(riskRouter(basescanClient, config.anthropicApiKey));

// Error handling
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`\n🔍 0xplain — Transaction Intelligence API`);
  console.log(`   Network:  ${config.network.name} (${config.network.caip2})`);
  console.log(`   Pay-to:   ${config.serverPayToAddress}`);
  console.log(`   Listening: http://localhost:${config.port}`);
  console.log(`\n   Endpoints:`);
  console.log(`   GET /           — frontend`);
  console.log(`   GET /health     — free`);
  console.log(`   GET /demo/*     — free (rate-limited)`);
  console.log(`   GET /explain    — $0.001 (x402)`);
  console.log(`   GET /risk       — $0.005 (x402)`);
  console.log();
});
