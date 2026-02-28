import { decodeFunctionData, decodeEventLog, formatUnits, formatGwei } from "viem";
import { ERC20_ABI, FUNCTION_SELECTORS, TRANSFER_EVENT_TOPIC, APPROVAL_EVENT_TOPIC } from "../blockchain/constants.js";
import type { RpcClient } from "../blockchain/rpc-client.js";
import type { DecodedTransaction, TokenInfo } from "../types/index.js";

export async function decodeTransaction(
  txHash: `0x${string}`,
  rpcClient: RpcClient,
): Promise<DecodedTransaction> {
  const [tx, receipt] = await Promise.all([
    rpcClient.getTransaction(txHash),
    rpcClient.getTransactionReceipt(txHash),
  ]);

  const block = await rpcClient.getBlock(tx.blockNumber);
  const timestamp = new Date(Number(block.timestamp) * 1000).toISOString();

  const gas = {
    used: Number(receipt.gasUsed),
    price: formatGwei(receipt.effectiveGasPrice) + " gwei",
    costUsd: "$" + (Number(formatUnits(receipt.gasUsed * receipt.effectiveGasPrice, 18)) * 2500).toFixed(4),
  };

  const selector = tx.input.slice(0, 10);
  const functionName = FUNCTION_SELECTORS[selector];

  if (!functionName) {
    return {
      transaction: {
        hash: txHash,
        block: Number(tx.blockNumber),
        timestamp,
        status: receipt.status === "success" ? "success" : "failure",
      },
      decoded: {
        type: "unsupported",
        reason: `Unknown function selector ${selector}. Currently supports ERC-20 transfers (transfer, transferFrom, approve, transferWithAuthorization).`,
      },
      gas,
    };
  }

  // Decode the function call input data
  let decoded;
  try {
    decoded = decodeFunctionData({
      abi: ERC20_ABI,
      data: tx.input,
    });
  } catch {
    return {
      transaction: {
        hash: txHash,
        block: Number(tx.blockNumber),
        timestamp,
        status: receipt.status === "success" ? "success" : "failure",
      },
      decoded: {
        type: "unsupported",
        reason: `Failed to decode function data for selector ${selector}.`,
      },
      gas,
    };
  }

  // The token contract is the tx.to address
  const tokenAddress = tx.to as `0x${string}`;
  let token: TokenInfo;
  try {
    token = await rpcClient.getTokenMetadata(tokenAddress);
  } catch {
    token = { symbol: "UNKNOWN", name: "Unknown Token", decimals: 18, address: tokenAddress };
  }

  // Extract from/to/amount based on function type
  let from: string;
  let to: string;
  let amount: bigint;

  const args = decoded.args as unknown as unknown[];

  switch (functionName) {
    case "transfer": {
      from = tx.from;
      to = args[0] as string;
      amount = args[1] as bigint;
      break;
    }
    case "transferFrom": {
      from = args[0] as string;
      to = args[1] as string;
      amount = args[2] as bigint;
      break;
    }
    case "approve": {
      from = tx.from;
      to = args[0] as string; // spender
      amount = args[1] as bigint;
      return {
        transaction: {
          hash: txHash,
          block: Number(tx.blockNumber),
          timestamp,
          status: receipt.status === "success" ? "success" : "failure",
        },
        decoded: {
          type: "ERC-20 Approval",
          action: "approve",
          token,
          from,
          to,
          amount: formatUnits(amount, token.decimals),
          amountRaw: amount.toString(),
        },
        gas,
      };
    }
    case "transferWithAuthorization": {
      from = args[0] as string;
      to = args[1] as string;
      amount = args[2] as bigint;
      break;
    }
    default: {
      from = tx.from;
      to = "";
      amount = 0n;
    }
  }

  // Cross-check with Transfer event logs if available
  for (const log of receipt.logs) {
    if (log.topics[0] === TRANSFER_EVENT_TOPIC) {
      try {
        const event = decodeEventLog({
          abi: ERC20_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (event.eventName === "Transfer") {
          const eventArgs = event.args as { from: string; to: string; value: bigint };
          from = eventArgs.from;
          to = eventArgs.to;
          amount = eventArgs.value;
        }
      } catch {
        // skip unparseable logs
      }
    }
  }

  const typeMap: Record<string, DecodedTransaction["decoded"] extends { type: string } ? string : never> = {
    transfer: "ERC-20 Transfer",
    transferFrom: "ERC-20 TransferFrom",
    transferWithAuthorization: "ERC-20 TransferWithAuthorization",
  };

  return {
    transaction: {
      hash: txHash,
      block: Number(tx.blockNumber),
      timestamp,
      status: receipt.status === "success" ? "success" : "failure",
    },
    decoded: {
      type: (typeMap[functionName] || "ERC-20 Transfer") as "ERC-20 Transfer",
      action: functionName,
      token,
      from,
      to,
      amount: formatUnits(amount, token.decimals),
      amountRaw: amount.toString(),
    },
    gas,
  };
}
