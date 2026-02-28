import { createPublicClient, http, formatUnits, type Chain } from "viem";
import { baseSepolia, base } from "viem/chains";
import { ERC20_ABI } from "./constants.js";
import type { NetworkConfig, TokenInfo } from "../types/index.js";

const chains: Record<string, Chain> = {
  testnet: baseSepolia,
  mainnet: base,
};

export function createRpcClient(network: NetworkConfig) {
  const chain = chains[network.name];
  const client = createPublicClient({
    chain,
    transport: http(network.rpcUrl),
  });

  return {
    async getTransaction(hash: `0x${string}`) {
      return client.getTransaction({ hash });
    },

    async getTransactionReceipt(hash: `0x${string}`) {
      return client.getTransactionReceipt({ hash });
    },

    async getBlock(blockNumber: bigint) {
      return client.getBlock({ blockNumber });
    },

    async getTokenMetadata(tokenAddress: `0x${string}`): Promise<TokenInfo> {
      const [name, symbol, decimals] = await Promise.all([
        client.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "name",
        }),
        client.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "symbol",
        }),
        client.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "decimals",
        }),
      ]);

      return {
        name: name as string,
        symbol: symbol as string,
        decimals: decimals as number,
        address: tokenAddress,
      };
    },

    formatTokenAmount(amount: bigint, decimals: number): string {
      return formatUnits(amount, decimals);
    },
  };
}

export type RpcClient = ReturnType<typeof createRpcClient>;
