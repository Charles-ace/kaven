import { DepthSnapshot } from "./binance-client.js";

export interface BookWalkResult {
  bestPrice: number;
  vwap: number;
  slippageBps: number;
  levelsConsumed: number;
  totalQuantityFilled: number;
  notionalUsdFilled: number;
  priceImpactUsd: number;
  fullyFilled: boolean;
}

export function walkOrderBook(
  depth: DepthSnapshot,
  side: "BUY" | "SELL",
  notionalUsd: number
): BookWalkResult {
  if (notionalUsd <= 0) {
    throw new Error("Notional USD must be positive");
  }

  const levels = side === "BUY" ? depth.asks : depth.bids;
  if (!levels || levels.length === 0) {
    throw new Error("Order book depth is empty");
  }

  const bestPrice = parseFloat(levels[0][0]);
  let remainingUsd = notionalUsd;
  let totalQty = 0;
  let totalCost = 0;
  let levelsConsumed = 0;

  for (const [priceStr, qtyStr] of levels) {
    const price = parseFloat(priceStr);
    const qty = parseFloat(qtyStr);
    const levelNotional = price * qty;

    levelsConsumed++;

    if (remainingUsd <= levelNotional) {
      const fillQty = remainingUsd / price;
      totalQty += fillQty;
      totalCost += remainingUsd;
      remainingUsd = 0;
      break;
    } else {
      totalQty += qty;
      totalCost += levelNotional;
      remainingUsd -= levelNotional;
    }
  }

  const fullyFilled = remainingUsd <= 0.0001;
  const vwap = totalQty > 0 ? totalCost / totalQty : bestPrice;

  // Slippage in basis points (1 bp = 0.01% = 0.0001)
  let slippageBps = 0;
  let priceImpactUsd = 0;

  if (side === "BUY") {
    slippageBps = ((vwap - bestPrice) / bestPrice) * 10000;
    priceImpactUsd = totalQty * (vwap - bestPrice);
  } else {
    slippageBps = ((bestPrice - vwap) / bestPrice) * 10000;
    priceImpactUsd = totalQty * (bestPrice - vwap);
  }

  return {
    bestPrice,
    vwap,
    slippageBps: Math.max(0, slippageBps),
    levelsConsumed,
    totalQuantityFilled: totalQty,
    notionalUsdFilled: totalCost,
    priceImpactUsd: Math.max(0, priceImpactUsd),
    fullyFilled
  };
}
