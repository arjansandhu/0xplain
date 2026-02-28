import "dotenv/config";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const privateKey = process.env.CLIENT_PRIVATE_KEY as `0x${string}`;
if (!privateKey) {
  console.error("Missing CLIENT_PRIVATE_KEY in .env");
  process.exit(1);
}

const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const signer = toClientEvmSigner(account, publicClient);
console.log(`Client wallet: ${account.address}`);

const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(signer));

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const port = process.env.PORT || "4021";
const baseUrl = `http://localhost:${port}`;

// Use an address from command line or default to the client's own address
const address = process.argv[2] || account.address;

async function main() {
  console.log(`\nTesting /risk with address: ${address}`);
  console.log(`URL: ${baseUrl}/risk?address=${address}\n`);

  try {
    const response = await fetchWithPayment(`${baseUrl}/risk?address=${address}`);

    console.log(`Status: ${response.status}`);
    console.log(`Headers:`);
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase().includes("payment") || key.toLowerCase().includes("x-")) {
        console.log(`  ${key}: ${value}`);
      }
    }

    const body = await response.json();
    console.log(`\nResponse:`);
    console.log(JSON.stringify(body, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
