import crypto from "node:crypto";
import {
  CovenantPolicy,
  CovenantRuleCheck,
  CovenantVerdict,
  DEFAULT_COVENANT_POLICY,
  RiskTier,
  SignedTradeAction,
  SignedTradeActionPayload,
  SimulationMetrics,
  TradeIntent
} from "../types.js";
import { signActionPayload } from "./signing.js";
import { BinanceMarketClient } from "../market/binance-client.js";
import { walkOrderBook } from "../market/order-book-walker.js";

export class CovenantEvaluator {
  private marketClient: BinanceMarketClient;
  private policy: CovenantPolicy;

  constructor(policy: Partial<CovenantPolicy> = {}, marketClient?: BinanceMarketClient) {
    this.policy = { ...DEFAULT_COVENANT_POLICY, ...policy };
    this.marketClient = marketClient || new BinanceMarketClient();
  }

  getPolicy(): CovenantPolicy {
    return { ...this.policy };
  }

  updatePolicy(updated: Partial<CovenantPolicy>): void {
    this.policy = { ...this.policy, ...updated };
  }

  async evaluate(intent: TradeIntent): Promise<CovenantVerdict> {
    const symbolUpper = intent.symbol.toUpperCase();
    const isMajor = this.policy.majorSymbols.includes(symbolUpper);
    const maxAllowedLeverage = isMajor ? this.policy.maxMajorLeverage : this.policy.maxAltcoinLeverage;

    const ruleChecks: CovenantRuleCheck[] = [];
    const reasons: string[] = [];
    const remediationSteps: string[] = [];

    // 0. Format Validation (Pre-flight Sanitization)
    if (symbolUpper.length < 2 || symbolUpper.length > 20 || !/^[A-Z0-9_]+$/.test(symbolUpper)) {
      const failureReason = `Invalid symbol format: '${symbolUpper}' does not match standard Binance ticker syntax (2-20 alphanumeric characters).`;
      const proposalId = `limbo-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      const timestamp = new Date().toISOString();
      return {
        proposalId,
        decision: "VETO",
        tier: "TIER_3_VETO",
        agentId: intent.agentId,
        symbol: symbolUpper,
        side: intent.side,
        notionalUsd: intent.usd,
        reasons: [failureReason],
        ruleChecks: [{
          rule: "Symbol Format & Syntax",
          category: "SLIPPAGE",
          threshold: "Valid Binance Ticker (2-20 alphanumeric characters)",
          actual: `Malformed symbol (${symbolUpper.length} chars)`,
          status: "FAIL",
          details: failureReason
        }],
        simulation: {
          bestPrice: 0,
          vwap: 0,
          slippageBps: 0,
          levelsConsumed: 0,
          navConcentrationPct: Number(((intent.usd / this.policy.accountNavUsd) * 100).toFixed(1)),
          leverageUsed: intent.leverage,
          fundingRatePct: null,
          annualizedCarryCostPct: null,
          estimatedPriceImpactUsd: 0,
          dataSource: "FAILSAFE_CLOSED",
          cacheAgeMs: 0
        },
        remediation: "Verify trading pair symbol on Binance (e.g., BTCUSDT, ETHUSDT, DOGEUSDT).",
        timestamp,
        actionRef: intent.action_ref || crypto.createHash("sha256").update(proposalId).digest("hex")
      };
    }

    // 1. Fetch Market Depth & Walk Order Book (Fail-Closed Architecture)
    let depth: any = null;
    let depthSource: string = "UNAVAILABLE";
    let cacheAgeMs: number = 0;
    let fetchError: string | null = null;

    try {
      const res = await this.marketClient.getOrderBookDepth(symbolUpper, 100);
      depth = res.depth;
      depthSource = res.source;
      cacheAgeMs = res.cacheAgeMs;
    } catch (err: any) {
      fetchError = err.message || String(err);
    }

    // If market depth is unavailable, NEVER silently default to PASS.
    // Fail-Closed: VETO if invalid symbol, ESCALATE if network outage.
    if (!depth || fetchError) {
      const isInvalidSymbol =
        fetchError?.includes("Invalid symbol") ||
        fetchError?.includes("-1121") ||
        fetchError?.toLowerCase().includes("not found");

      const decision = isInvalidSymbol ? "VETO" : "ESCALATE";
      const failureReason = isInvalidSymbol
        ? `Invalid symbol: '${symbolUpper}' does not exist on Binance spot markets.`
        : `Market data connectivity failure: unable to fetch live L2 order book for '${symbolUpper}' (${fetchError}). Failsafe closed.`;

      ruleChecks.push({
        rule: "Symbol Verification & L2 Market Depth",
        category: "SLIPPAGE",
        threshold: "Active Binance L2 Depth Available",
        actual: isInvalidSymbol ? "Invalid Symbol" : "Network / Feed Outage",
        status: "FAIL",
        details: failureReason
      });

      const navConcentrationPct = (intent.usd / this.policy.accountNavUsd) * 100;
      const proposalId = `kaven-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      const timestamp = new Date().toISOString();

      return {
        proposalId,
        decision,
        tier: decision === "VETO" ? "TIER_3_VETO" : "TIER_2_HUMAN_ACK",
        agentId: intent.agentId,
        symbol: symbolUpper,
        side: intent.side,
        notionalUsd: intent.usd,
        reasons: [failureReason],
        ruleChecks,
        simulation: {
          bestPrice: 0,
          vwap: 0,
          slippageBps: 0,
          levelsConsumed: 0,
          navConcentrationPct: Number(navConcentrationPct.toFixed(1)),
          leverageUsed: intent.leverage,
          fundingRatePct: null,
          annualizedCarryCostPct: null,
          estimatedPriceImpactUsd: 0,
          dataSource: "FAILSAFE_CLOSED",
          cacheAgeMs: 0
        },
        remediation: isInvalidSymbol
          ? `Verify trading pair symbol on Binance (e.g., BTCUSDT, ETHUSDT, DOGEUSDT).`
          : `Hold trade intent until live Binance L2 depth connectivity is restored.`,
        timestamp,
        actionRef: intent.action_ref || crypto.createHash("sha256").update(proposalId).digest("hex")
      };
    }

    // -------------------------------------------------------------
    // RULE 0: Feed Freshness & Data Source Integrity
    // -------------------------------------------------------------
    const isFallbackCache = depthSource === "CACHE_FALLBACK";
    const freshnessCheck: CovenantRuleCheck = {
      rule: "Market Feed Freshness & Integrity",
      category: "SLIPPAGE",
      threshold: "Real-time Live Feed or Active Micro-burst (<1500ms)",
      actual: depthSource === "LIVE_BINANCE_API"
        ? "Live Real-Time API (0ms latency)"
        : depthSource === "LIVE_CACHE_BURST"
        ? `Active Micro-Burst Cache (${cacheAgeMs}ms old)`
        : depthSource === "CACHE_FALLBACK"
        ? `Emergency Cache Fallback (${cacheAgeMs}ms old)`
        : `Verified Feed (${depthSource})`,
      status: isFallbackCache ? "WARN" : "PASS",
      details: isFallbackCache
        ? `Live Binance feed timed out or dropped; order book evaluated against emergency fallback cache (${cacheAgeMs}ms old). Degraded to ESCALATE for human operator confirmation.`
        : depthSource === "LIVE_CACHE_BURST"
        ? `Order book coalesced from sub-second micro-burst cache (${cacheAgeMs}ms old).`
        : depthSource === "LIVE_BINANCE_API"
        ? `Live real-time Binance L2 depth feed verified.`
        : `Market depth provided via ${depthSource}.`
    };
    ruleChecks.push(freshnessCheck);

    if (isFallbackCache) {
      reasons.push(`Market data feed warning: order book backed by emergency cache fallback (${cacheAgeMs}ms old), not real-time live feed.`);
      remediationSteps.push("Operator review required: confirm current live depth before execution, or re-submit when Binance connectivity is restored.");
    }

    let bookResult: ReturnType<typeof walkOrderBook>;
    try {
      bookResult = walkOrderBook(depth, intent.side, intent.usd);
    } catch (bookErr: any) {
      const proposalId = `kaven-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      const timestamp = new Date().toISOString();
      const failureReason = `Order book depth evaluation failed: ${bookErr.message || "Insufficient market depth"}.`;
      ruleChecks.push({
        rule: "L2 Market Depth Availability",
        category: "SLIPPAGE",
        threshold: "Active non-empty order book levels",
        actual: "Empty or malformed book",
        status: "FAIL",
        details: failureReason
      });
      return {
        proposalId,
        decision: "VETO",
        tier: "TIER_3_VETO",
        agentId: intent.agentId,
        symbol: symbolUpper,
        side: intent.side,
        notionalUsd: intent.usd,
        reasons: [failureReason],
        ruleChecks,
        simulation: {
          bestPrice: 0,
          vwap: 0,
          slippageBps: 0,
          levelsConsumed: 0,
          navConcentrationPct: Number(((intent.usd / this.policy.accountNavUsd) * 100).toFixed(1)),
          leverageUsed: intent.leverage,
          fundingRatePct: null,
          annualizedCarryCostPct: null,
          estimatedPriceImpactUsd: 0,
          dataSource: depthSource,
          cacheAgeMs
        },
        remediation: "Verify liquidity on Binance for this pair before attempting execution.",
        timestamp,
        actionRef: intent.action_ref || crypto.createHash("sha256").update(proposalId).digest("hex")
      };
    }

    // 2. Fetch Funding Rate if applicable
    const { premium } = await this.marketClient.getFuturesPremiumIndex(symbolUpper);
    let fundingRatePct: number | null = null;
    let annualizedCarryPct: number | null = null;

    if (premium && premium.lastFundingRate) {
      const rate = parseFloat(premium.lastFundingRate);
      fundingRatePct = rate * 100;
      // 3 funding intervals per day * 365 days * leverage
      annualizedCarryPct = fundingRatePct * 3 * 365 * intent.leverage;
    }

    // -------------------------------------------------------------
    // RULE 1: Leverage Limit
    // -------------------------------------------------------------
    const leverageCheck: CovenantRuleCheck = {
      rule: "Max Leverage Covenant",
      category: "LEVERAGE",
      threshold: `<= ${maxAllowedLeverage}x (${isMajor ? "Major Asset" : "Altcoin Asset"})`,
      actual: `${intent.leverage}x`,
      status: intent.leverage <= maxAllowedLeverage ? "PASS" : "FAIL",
      details:
        intent.leverage <= maxAllowedLeverage
          ? `Leverage ${intent.leverage}x satisfies ${isMajor ? "major" : "altcoin"} ceiling of ${maxAllowedLeverage}x.`
          : `Proposed leverage ${intent.leverage}x exceeds ${isMajor ? "major" : "altcoin"} risk ceiling of ${maxAllowedLeverage}x.`
    };
    ruleChecks.push(leverageCheck);

    if (leverageCheck.status === "FAIL") {
      reasons.push(
        `Excessive leverage: ${intent.leverage}x requested for ${symbolUpper}, max allowable is ${maxAllowedLeverage}x.`
      );
      remediationSteps.push(`Reduce leverage on ${symbolUpper} to <= ${maxAllowedLeverage}x.`);
    }

    // -------------------------------------------------------------
    // RULE 2: Portfolio NAV Concentration
    // -------------------------------------------------------------
    const navConcentrationPct = (intent.usd / this.policy.accountNavUsd) * 100;
    const maxConcentration = this.policy.maxNavConcentrationPct;

    let concentrationStatus: "PASS" | "FAIL" | "WARN" = "PASS";
    if (navConcentrationPct > maxConcentration) {
      concentrationStatus = "FAIL";
    } else if (navConcentrationPct > maxConcentration * 0.8) {
      concentrationStatus = "WARN";
    }

    const concentrationCheck: CovenantRuleCheck = {
      rule: "Portfolio NAV Concentration",
      category: "CONCENTRATION",
      threshold: `<= ${maxConcentration.toFixed(1)}% of NAV ($${this.policy.accountNavUsd.toLocaleString()})`,
      actual: `${navConcentrationPct.toFixed(1)}% ($${intent.usd.toLocaleString()})`,
      status: concentrationStatus,
      details:
        concentrationStatus === "PASS"
          ? `Position size represents ${navConcentrationPct.toFixed(1)}% of declared NAV, within ${maxConcentration}% limit.`
          : concentrationStatus === "WARN"
          ? `Position size represents ${navConcentrationPct.toFixed(1)}% of NAV, approaching ${maxConcentration}% limit.`
          : `Position size $${intent.usd.toLocaleString()} represents ${navConcentrationPct.toFixed(1)}% of declared NAV ($${this.policy.accountNavUsd.toLocaleString()}), breaching max limit of ${maxConcentration}%.`
    };
    ruleChecks.push(concentrationCheck);

    if (concentrationStatus === "FAIL") {
      const maxAllowedUsd = (maxConcentration / 100) * this.policy.accountNavUsd;
      reasons.push(
        `Portfolio concentration breach: $${intent.usd.toLocaleString()} is ${navConcentrationPct.toFixed(1)}% of NAV (cap is ${maxConcentration}%).`
      );
      remediationSteps.push(
        `Reduce order size to <= $${maxAllowedUsd.toLocaleString()} (<= ${maxConcentration}% of declared NAV $${this.policy.accountNavUsd.toLocaleString()}).`
      );
    }

    // -------------------------------------------------------------
    // RULE 3: L2 Book-Walk Slippage Impact
    // -------------------------------------------------------------
    let slippageStatus: "PASS" | "FAIL" | "WARN" = "PASS";
    if (!bookResult.fullyFilled) {
      slippageStatus = "FAIL";
      reasons.push(`Insufficient market depth: book only filled $${bookResult.notionalUsdFilled.toFixed(2)} of $${intent.usd.toLocaleString()}`);
      remediationSteps.push("Split order into smaller algorithmic slices or execute via TWAP.");
    } else if (bookResult.slippageBps > this.policy.maxSlippageBps) {
      slippageStatus = "FAIL";
      reasons.push(
        `Excessive slippage: simulated impact is ${bookResult.slippageBps.toFixed(2)} bps (ceiling is ${this.policy.maxSlippageBps.toFixed(2)} bps).`
      );
      remediationSteps.push(`Use limit order near best price $${bookResult.bestPrice} or reduce order size.`);
    } else if (bookResult.slippageBps > this.policy.maxSlippageBps * 0.7) {
      slippageStatus = "WARN";
    }

    const slippageCheck: CovenantRuleCheck = {
      rule: "L2 Book-Walk Slippage",
      category: "SLIPPAGE",
      threshold: `<= ${this.policy.maxSlippageBps.toFixed(1)} bps`,
      actual: `${bookResult.slippageBps.toFixed(2)} bps (${bookResult.levelsConsumed} levels)`,
      status: slippageStatus,
      details: `VWAP execution at ${bookResult.vwap.toFixed(bookResult.bestPrice < 1 ? 6 : 2)} vs best price ${bookResult.bestPrice.toFixed(bookResult.bestPrice < 1 ? 6 : 2)} (Price impact: $${bookResult.priceImpactUsd.toFixed(2)}).`
    };
    ruleChecks.push(slippageCheck);

    // -------------------------------------------------------------
    // RULE 4: Carry Stress / Funding Rate Check
    // -------------------------------------------------------------
    if (fundingRatePct !== null) {
      const isCarryPunitive =
        (intent.side === "BUY" && fundingRatePct > this.policy.maxCarryStressFundingRatePct) ||
        (intent.side === "SELL" && fundingRatePct < -this.policy.maxCarryStressFundingRatePct);

      const carryCheck: CovenantRuleCheck = {
        rule: "Perp Funding Carry Stress",
        category: "CARRY_RISK",
        threshold: `<= ${this.policy.maxCarryStressFundingRatePct.toFixed(3)}% per 8h`,
        actual: `${fundingRatePct >= 0 ? "+" : ""}${fundingRatePct.toFixed(4)}% / 8h (Annualized: ${annualizedCarryPct?.toFixed(1)}%)`,
        status: isCarryPunitive ? "WARN" : "PASS",
        details: isCarryPunitive
          ? `High adverse funding rate of ${fundingRatePct.toFixed(4)}% imposes severe drag ($${((annualizedCarryPct || 0) / 100 * intent.usd).toFixed(0)}/yr carry drag on position).`
          : `Funding rate ${fundingRatePct.toFixed(4)}% is within standard tolerances.`
      };
      ruleChecks.push(carryCheck);

      if (isCarryPunitive) {
        reasons.push(`Adverse funding carry drag of ${fundingRatePct.toFixed(4)}% per 8 hours.`);
      }
    }

    // -------------------------------------------------------------
    // Compile Verdict
    // -------------------------------------------------------------
    const hasFailures = ruleChecks.some((c) => c.status === "FAIL");
    const hasWarnings = ruleChecks.some((c) => c.status === "WARN");

    let decision: "PASS" | "VETO" | "ESCALATE" = "PASS";
    if (hasFailures) {
      decision = "VETO";
    } else if (hasWarnings) {
      decision = "ESCALATE";
    }

    const proposalId = `kaven-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const timestamp = new Date().toISOString();

    const simulation: SimulationMetrics = {
      bestPrice: bookResult.bestPrice,
      vwap: bookResult.vwap,
      slippageBps: Number(bookResult.slippageBps.toFixed(2)),
      levelsConsumed: bookResult.levelsConsumed,
      navConcentrationPct: Number(navConcentrationPct.toFixed(1)),
      leverageUsed: intent.leverage,
      fundingRatePct: fundingRatePct !== null ? Number(fundingRatePct.toFixed(4)) : null,
      annualizedCarryCostPct: annualizedCarryPct !== null ? Number(annualizedCarryPct.toFixed(1)) : null,
      estimatedPriceImpactUsd: Number(bookResult.priceImpactUsd.toFixed(2)),
      dataSource: depthSource,
      cacheAgeMs
    };

    // Deterministic canonical signature hash (RFC 8785 compatibility)
    const canonicalPayload = JSON.stringify({
      agentId: intent.agentId,
      symbol: symbolUpper,
      side: intent.side,
      usd: intent.usd,
      leverage: intent.leverage,
      decision,
      reasons,
      slippageBps: simulation.slippageBps,
      navConcentrationPct: simulation.navConcentrationPct,
      timestamp
    });
    const signature = crypto.createHash("sha256").update(canonicalPayload).digest("hex");

    // -------------------------------------------------------------
    // Risk-Tier Classification & Cryptographic Action Signing
    // -------------------------------------------------------------
    let tier: RiskTier;
    let signedAction: SignedTradeAction | undefined = undefined;

    if (decision === "VETO") {
      tier = "TIER_3_VETO";
    } else {
      const leverageRatio = intent.leverage / maxAllowedLeverage;
      const navRatio = navConcentrationPct / this.policy.maxNavConcentrationPct;
      const slippageRatio = simulation.slippageBps / this.policy.maxSlippageBps;

      const inWarningBand = leverageRatio > 0.80 || navRatio > 0.80 || slippageRatio > 0.80;
      const isEscalate = decision === "ESCALATE";

      if (inWarningBand || isEscalate) {
        tier = "TIER_2_HUMAN_ACK";
        const triggers: string[] = [];
        if (leverageRatio > 0.80) triggers.push(`Leverage at ${(leverageRatio * 100).toFixed(0)}% of ceiling`);
        if (navRatio > 0.80) triggers.push(`NAV concentration at ${(navRatio * 100).toFixed(0)}% of cap`);
        if (slippageRatio > 0.80) triggers.push(`Slippage at ${(slippageRatio * 100).toFixed(0)}% of tolerance`);
        if (isEscalate) triggers.push("Market feed latency / carry warning");

        const actionPayload: SignedTradeActionPayload = {
          actionId: `act_kaven_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
          proposalId,
          symbol: symbolUpper,
          side: intent.side,
          notionalUsd: intent.usd,
          leverage: intent.leverage,
          orderType: intent.orderType || "MARKET",
          limitPrice: intent.limitPrice,
          tier: "TIER_2_HUMAN_ACK",
          autoApproved: false,
          requiresHumanAck: true,
          tierReason: `Caution tier: ${triggers.join(", ")}. Human authorization required.`,
          issuedAt: timestamp,
          expiresAt: Date.now() + 30000
        };
        signedAction = signActionPayload(actionPayload);
      } else {
        tier = "TIER_1_AUTO";
        const actionPayload: SignedTradeActionPayload = {
          actionId: `act_kaven_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
          proposalId,
          symbol: symbolUpper,
          side: intent.side,
          notionalUsd: intent.usd,
          leverage: intent.leverage,
          orderType: intent.orderType || "MARKET",
          limitPrice: intent.limitPrice,
          tier: "TIER_1_AUTO",
          autoApproved: true,
          requiresHumanAck: false,
          tierReason: "Clean PASS: All metrics <= 80% of safety ceilings. Auto-execution cleared.",
          issuedAt: timestamp,
          expiresAt: Date.now() + 30000
        };
        signedAction = signActionPayload(actionPayload);
      }
    }

    return {
      proposalId,
      decision,
      tier,
      signedAction,
      agentId: intent.agentId,
      symbol: symbolUpper,
      side: intent.side,
      notionalUsd: intent.usd,
      reasons: reasons.length > 0 ? reasons : ["All safety covenants satisfied."],
      ruleChecks,
      simulation,
      remediation: remediationSteps.length > 0 ? remediationSteps.join(" | ") : "Trade intent cleared by Kaven.",
      timestamp,
      actionRef: intent.action_ref || signature
    };
  }
}
