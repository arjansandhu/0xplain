import "dotenv/config";

/**
 * Diagnostic: Shows the raw 402 flow without the x402 SDK wrapper.
 * 1. Make a request without payment → get 402 + payment terms
 * 2. Display what the client would need to do to pay
 */

const port = process.env.PORT || "4021";
const baseUrl = `http://localhost:${port}`;

const txHash = process.argv[2] || "0x0000000000000000000000000000000000000000000000000000000000000000";

async function main() {
  console.log("=== Manual 402 Flow Diagnostic ===\n");

  // Step 1: Request without payment
  console.log("Step 1: GET /explain without payment...");
  const response = await fetch(`${baseUrl}/explain?tx=${txHash}`);
  console.log(`Status: ${response.status} ${response.statusText}`);

  if (response.status === 402) {
    console.log("\n✅ Got 402 Payment Required (expected)");
    console.log("\nResponse headers:");
    for (const [key, value] of response.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    const body = await response.text();
    try {
      const parsed = JSON.parse(body);
      console.log("\nPayment terms:");
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      console.log("\nRaw body:", body);
    }

    console.log("\n---");
    console.log("To complete payment, the x402 client would:");
    console.log("1. Parse the payment requirements from the 402 response");
    console.log("2. Sign an EIP-712 typed data message authorizing USDC transfer");
    console.log("3. Retry the request with PAYMENT-SIGNATURE header");
    console.log("4. The facilitator verifies and settles the payment on-chain");
    console.log("5. The server returns the actual data");
  } else {
    console.log(`\n⚠️  Expected 402 but got ${response.status}`);
    const body = await response.text();
    console.log("Body:", body);
  }

  // Step 2: Also test health endpoint (should be free)
  console.log("\n\nStep 2: GET /health (should be free)...");
  const healthRes = await fetch(`${baseUrl}/health`);
  console.log(`Status: ${healthRes.status}`);
  if (healthRes.ok) {
    const healthBody = await healthRes.json();
    console.log("Health:", JSON.stringify(healthBody, null, 2));
  }
}

main();
