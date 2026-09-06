import { z } from "zod";

export const TradeIntentSchema = z.object({
  agentId: z.string().default("autonomous-agent"),
  symbol: z.string().min(1),
  side: z.enum(["BUY", "SELL", "buy", "sell"]).transform((s) => s.toUpperCase() as "BUY" | "SELL"),
  usd: z.number().positive(),
  leverage: z.number().positive().default(1),
  orderType: z.enum(["MARKET", "LIMIT"]).default("MARKET"),
  limitPrice: z.number().positive().optional(),
  reason: z.string().optional(),
  execute: z.boolean().default(false),
  action_ref: z.string().optional()
});

export type TradeIntent = z.infer<typeof TradeIntentSchema>;

export interface CovenantPolicy {
  accountNavUsd: number;
  maxNavConcentrationPct: number; // e.g. 35%
  maxMajorLeverage: number; // e.g. 10x
  maxAltcoinLeverage: number; // e.g. 3x
  maxSlippageBps: number; // e.g. 15 bps
  maxCarryStressFundingRatePct: number; // e.g. 0.05%
  majorSymbols: string[];
}

export const DEFAULT_COVENANT_POLICY: CovenantPolicy = {
  accountNavUsd: 20000.0,
  maxNavConcentrationPct: 35.0,
  maxMajorLeverage: 10.0,
  maxAltcoinLeverage: 3.0,
  maxSlippageBps: 15.0,
  maxCarryStressFundingRatePct: 0.05,
  majorSymbols: ["BTCUSDT", "ETHUSDT"]
};

export interface CovenantRuleCheck {
  rule: string;
  category: "LEVERAGE" | "CONCENTRATION" | "SLIPPAGE" | "CARRY_RISK";
  threshold: string;
  actual: string;
  status: "PASS" | "FAIL" | "WARN";
  details: string;
}

export interface SimulationMetrics {
  bestPrice: number;
  vwap: number;
  slippageBps: number;
  levelsConsumed: number;
  navConcentrationPct: number;
  leverageUsed: number;
  fundingRatePct: number | null;
  annualizedCarryCostPct: number | null;
  estimatedPriceImpactUsd: number;
  dataSource: string;
  cacheAgeMs?: number;
}

export interface CovenantVerdict {
  proposalId: string;
  decision: "PASS" | "VETO" | "ESCALATE";
  agentId: string;
  symbol: string;
  side: "BUY" | "SELL";
  notionalUsd: number;
  reasons: string[];
  ruleChecks: CovenantRuleCheck[];
  simulation: SimulationMetrics;
  remediation?: string;
  timestamp: string;
  actionRef?: string;
  tier?: RiskTier;
  signedAction?: SignedTradeAction;
}

export type RiskTier = "TIER_1_AUTO" | "TIER_2_HUMAN_ACK" | "TIER_3_VETO";

export interface SignedTradeActionPayload {
  actionId: string;
  proposalId: string;
  symbol: string;
  side: "BUY" | "SELL";
  notionalUsd: number;
  leverage: number;
  orderType: "MARKET" | "LIMIT";
  limitPrice?: number;
  tier: RiskTier;
  autoApproved: boolean;
  requiresHumanAck: boolean;
  tierReason: string;
  issuedAt: string;
  expiresAt: number; // Unix timestamp in ms (30s TTL)
}

export interface SignedTradeAction {
  payload: SignedTradeActionPayload;
  signature: string; // HMAC-SHA256 of canonical RFC 8785 JSON
}

export interface ExecutorResult {
  status: "FILLED" | "PENDING_HUMAN_APPROVAL" | "REJECTED" | "DISCARDED";
  actionId: string;
  executionType?: "AUTO_EXECUTE" | "HUMAN_CONFIRMED";
  binanceResponse?: any;
  error?: string;
  reason?: string;
  prompt?: string;
}

