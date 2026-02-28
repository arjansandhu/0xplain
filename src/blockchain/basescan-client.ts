import type { NetworkConfig } from "../types/index.js";

interface BasescanTxListItem {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  isError: string;
}

interface BasescanResponse<T> {
  status: string;
  message: string;
  result: T;
}

export function createBasescanClient(network: NetworkConfig) {
  const baseUrl = network.explorerApiUrl;
  const apiKey = network.explorerApiKey;

  async function fetchApi<T>(params: Record<string, string>): Promise<T> {
    const url = new URL("/api", baseUrl);
    url.searchParams.set("apikey", apiKey);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Basescan API error: ${res.status}`);

    const data = (await res.json()) as BasescanResponse<T>;
    if (data.status === "0" && data.message === "No transactions found") {
      return [] as unknown as T;
    }
    if (data.status === "0") {
      throw new Error(`Basescan API: ${data.message} — ${JSON.stringify(data.result)}`);
    }
    return data.result;
  }

  return {
    async getNormalTransactions(
      address: string,
      options: { startBlock?: number; endBlock?: number; sort?: "asc" | "desc"; limit?: number } = {},
    ) {
      return fetchApi<BasescanTxListItem[]>({
        module: "account",
        action: "txlist",
        address,
        startblock: String(options.startBlock ?? 0),
        endblock: String(options.endBlock ?? 99999999),
        sort: options.sort ?? "desc",
        page: "1",
        offset: String(options.limit ?? 100),
      });
    },

    async getTokenTransfers(
      address: string,
      options: { startBlock?: number; endBlock?: number; sort?: "asc" | "desc"; limit?: number } = {},
    ) {
      return fetchApi<BasescanTxListItem[]>({
        module: "account",
        action: "tokentx",
        address,
        startblock: String(options.startBlock ?? 0),
        endblock: String(options.endBlock ?? 99999999),
        sort: options.sort ?? "desc",
        page: "1",
        offset: String(options.limit ?? 100),
      });
    },
  };
}

export type BasescanClient = ReturnType<typeof createBasescanClient>;
