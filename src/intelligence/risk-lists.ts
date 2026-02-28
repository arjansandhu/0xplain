import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../../data");

interface ExchangeEntry {
  address: string;
  label: string;
}

interface ScamEntry {
  address: string;
  reason: string;
}

const ofacData = JSON.parse(readFileSync(join(dataDir, "ofac-sdn.json"), "utf-8")) as {
  addresses: string[];
};
const exchangeData = JSON.parse(readFileSync(join(dataDir, "known-exchanges.json"), "utf-8")) as {
  entries: ExchangeEntry[];
};
const scamData = JSON.parse(readFileSync(join(dataDir, "known-scams.json"), "utf-8")) as {
  addresses: ScamEntry[];
};

const ofacSet = new Set(ofacData.addresses.map((a) => a.toLowerCase()));
const exchangeMap = new Map(exchangeData.entries.map((e) => [e.address.toLowerCase(), e.label]));
const scamMap = new Map(scamData.addresses.map((s) => [s.address.toLowerCase(), s.reason]));

export function checkOFAC(address: string): boolean {
  return ofacSet.has(address.toLowerCase());
}

export function checkScam(address: string): string | null {
  return scamMap.get(address.toLowerCase()) ?? null;
}

export function getExchangeLabel(address: string): string | null {
  return exchangeMap.get(address.toLowerCase()) ?? null;
}

export function isKnownEntity(address: string): { known: boolean; label?: string; risk?: "LOW" | "MEDIUM" | "HIGH" } {
  const lower = address.toLowerCase();

  if (ofacSet.has(lower)) {
    return { known: true, label: "OFAC Sanctioned", risk: "HIGH" };
  }

  const scamReason = scamMap.get(lower);
  if (scamReason) {
    return { known: true, label: `Scam: ${scamReason}`, risk: "HIGH" };
  }

  const exchangeLabel = exchangeMap.get(lower);
  if (exchangeLabel) {
    return { known: true, label: exchangeLabel, risk: "LOW" };
  }

  return { known: false };
}
