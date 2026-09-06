import {
  ExecutorResult,
  SignedTradeAction,
  SignedTradeActionPayload
} from "../types.js";
import { DEFAULT_INTERNAL_SIGNING_SECRET, verifySignedAction } from "../engine/signing.js";
import { BinanceTestnetResponse, sendBinanceTestnetOrder } from "./network.js";

export interface PendingOrder {
  signedAction: SignedTradeAction;
  prompt: string;
  createdAt: number;
}

export interface ExecutorConfig {
  apiKey?: string;
  apiSecret?: string;
  signingSecret?: string;
  testnetHost?: string;
}

export class KavenExecutorService {
  private apiKey: string;
  private apiSecret: string;
  private signingSecret: string;
  private testnetHost: string;

  private redeemedActionIds = new Set<string>();
  private pendingOrders = new Map<string, PendingOrder>();

  constructor(config: ExecutorConfig = {}) {
    try {
      if (typeof process.loadEnvFile === "function") process.loadEnvFile();
    } catch {}
    this.apiKey = config.apiKey ?? process.env.BINANCE_TESTNET_API_KEY ?? "";
    this.apiSecret = config.apiSecret ?? process.env.BINANCE_TESTNET_SECRET_KEY ?? "";
    this.signingSecret = config.signingSecret || DEFAULT_INTERNAL_SIGNING_SECRET;
    this.testnetHost = config.testnetHost || "testnet.binance.vision";
  }

  public getPendingOrders(): PendingOrder[] {
    return Array.from(this.pendingOrders.values());
  }

  public getRedeemedCount(): number {
    return this.redeemedActionIds.size;
  }

  public isRedeemed(actionId: string): boolean {
    return this.redeemedActionIds.has(actionId);
  }

  /**
   * Process a signed action token from Kaven Core
   */
  public async processAction(signedAction: SignedTradeAction): Promise<ExecutorResult> {
    // 1. Cryptographic Signature & TTL Verification
    const verification = verifySignedAction(signedAction, this.signingSecret);
    if (!verification.valid) {
      return {
        status: "REJECTED",
        actionId: signedAction?.payload?.actionId || "unknown",
        reason: verification.reason || "SIGNATURE_VERIFICATION_FAILED"
      };
    }

    const { payload } = signedAction;

    // 2. Strict Single-Use Replay Protection
    if (this.redeemedActionIds.has(payload.actionId)) {
      return {
        status: "REJECTED",
        actionId: payload.actionId,
        reason: `REPLAY_ATTACK_PREVENTED: Action ID ${payload.actionId} has already been redeemed.`
      };
    }

    // 3. Execution Routing by Risk Tier
    if (payload.tier === "TIER_1_AUTO" && payload.autoApproved) {
      // Mark redeemed immediately before network round-trip to prevent concurrent double-spend
      this.redeemedActionIds.add(payload.actionId);

      const netRes = await this.dispatchOrder(payload);
      return {
        status: netRes.ok ? "FILLED" : "REJECTED",
        actionId: payload.actionId,
        executionType: "AUTO_EXECUTE",
        binanceResponse: netRes.body,
        error: netRes.ok
          ? undefined
          : `Binance Spot Testnet returned status ${netRes.statusCode}: ${JSON.stringify(netRes.body)}`,
        reason: netRes.ok ? "Direct fill executed without human intervention." : "Binance API order placement rejected."
      };
    }

    if (payload.tier === "TIER_2_HUMAN_ACK" && payload.requiresHumanAck) {
      const prompt = `Action pending human approval: ${payload.side} $${payload.notionalUsd} ${payload.symbol} @ ${payload.leverage}x (${payload.tierReason}). Approve? (y/n)`;
      this.pendingOrders.set(payload.actionId, {
        signedAction,
        prompt,
        createdAt: Date.now()
      });

      return {
        status: "PENDING_HUMAN_APPROVAL",
        actionId: payload.actionId,
        prompt,
        reason: payload.tierReason
      };
    }

    return {
      status: "REJECTED",
      actionId: payload.actionId,
      reason: `INVALID_EXECUTION_TIER: Cannot execute action under tier ${payload.tier}`
    };
  }

  /**
   * Confirm or reject a pending Tier 2 order
   */
  public async confirmAction(actionId: string, approved: boolean): Promise<ExecutorResult> {
    const pending = this.pendingOrders.get(actionId);
    if (!pending) {
      return {
        status: "REJECTED",
        actionId,
        reason: `ORDER_NOT_PENDING: No pending order found with actionId ${actionId}`
      };
    }

    if (!approved) {
      this.pendingOrders.delete(actionId);
      return {
        status: "DISCARDED",
        actionId,
        reason: "Operator explicitly discarded the proposed trade."
      };
    }

    // Check TTL at confirmation time
    const now = Date.now();
    if (now > pending.signedAction.payload.expiresAt) {
      this.pendingOrders.delete(actionId);
      return {
        status: "REJECTED",
        actionId,
        reason: `ACTION_EXPIRED: Action expired while awaiting confirmation.`
      };
    }

    // Check single-use
    if (this.redeemedActionIds.has(actionId)) {
      this.pendingOrders.delete(actionId);
      return {
        status: "REJECTED",
        actionId,
        reason: `REPLAY_ATTACK_PREVENTED: Action ID ${actionId} has already been redeemed.`
      };
    }

    // Mark redeemed and remove from pending queue
    this.redeemedActionIds.add(actionId);
    this.pendingOrders.delete(actionId);

    const netRes = await this.dispatchOrder(pending.signedAction.payload);
    return {
      status: netRes.ok ? "FILLED" : "REJECTED",
      actionId,
      executionType: "HUMAN_CONFIRMED",
      binanceResponse: netRes.body,
      error: netRes.ok
        ? undefined
        : `Binance Spot Testnet returned status ${netRes.statusCode}: ${JSON.stringify(netRes.body)}`,
      reason: netRes.ok ? "Order placed following explicit human authorization." : "Binance API order placement rejected."
    };
  }

  private async dispatchOrder(payload: SignedTradeActionPayload): Promise<BinanceTestnetResponse> {
    if (!this.apiKey || !this.apiSecret) {
      return {
        statusCode: 0,
        body: {
          error: "NO_CREDENTIALS_CONFIGURED",
          msg: "No Binance Spot Testnet credentials configured. Set BINANCE_TESTNET_API_KEY and BINANCE_TESTNET_SECRET_KEY in .env to execute real testnet orders."
        },
        ok: false,
        endpoint: `POST https://${this.testnetHost}/api/v3/order`,
        queryString: ""
      };
    }

    return sendBinanceTestnetOrder(
      {
        symbol: payload.symbol,
        side: payload.side,
        type: payload.orderType,
        quoteOrderQty: payload.notionalUsd,
        price: payload.limitPrice
      },
      this.apiKey,
      this.apiSecret,
      this.testnetHost
    );
  }
}
