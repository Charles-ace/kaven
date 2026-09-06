/**
 * Kaven Autonomous Trader Agent
 * 
 * Analyzes live Binance market dynamics in real time:
 * - 24-hour price momentum and range
 * - Order Book Imbalance (Bid vs. Ask volume pressure over top 20 levels)
 * - Order Book Spread in basis points
 * 
 * Formulates an explicit market thesis and outputs a structured trade proposal
 * for pre-flight invariant verification by Kaven.
 */

export interface MarketAnalysis {
  symbol: string;
  price: number;
  priceChange24hPct: number;
  bidDepthVolume: number;
  askDepthVolume: number;
  bidPressurePct: number;
  spreadBps: number;
  volatilityBand: 'LOW' | 'NORMAL' | 'ELEVATED';
  thesis: string;
  timestamp: string;
}

export interface AgentTradeProposal {
  agentId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  notionalUsd: number;
  leverage: number;
  orderType: 'MARKET';
  analysis: MarketAnalysis;
}

export async function runMarketScan(symbol: string = 'BTCUSDT'): Promise<AgentTradeProposal> {
  const normSym = symbol.toUpperCase().trim();
  
  // 1. Fetch 24hr Ticker
  const tickerRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${normSym}`);
  if (!tickerRes.ok) {
    throw new Error(`Failed to fetch 24h ticker for ${normSym}: ${tickerRes.statusText}`);
  }
  const ticker = (await tickerRes.json()) as any;
  const lastPrice = parseFloat(ticker.lastPrice);
  const priceChangePct = parseFloat(ticker.priceChangePercent);
  const highPrice = parseFloat(ticker.highPrice);
  const lowPrice = parseFloat(ticker.lowPrice);

  // 2. Fetch L2 Depth (top 20 levels)
  const depthRes = await fetch(`https://api.binance.com/api/v3/depth?symbol=${normSym}&limit=20`);
  if (!depthRes.ok) {
    throw new Error(`Failed to fetch L2 depth for ${normSym}: ${depthRes.statusText}`);
  }
  const depth = (await depthRes.json()) as any;

  const bids: [number, number][] = (depth.bids || []).map((b: [string, string]) => [parseFloat(b[0]), parseFloat(b[1])]);
  const asks: [number, number][] = (depth.asks || []).map((a: [string, string]) => [parseFloat(a[0]), parseFloat(a[1])]);

  const bestBid = bids[0]?.[0] || lastPrice;
  const bestAsk = asks[0]?.[0] || lastPrice;
  const spreadBps = bestBid > 0 ? ((bestAsk - bestBid) / bestBid) * 10000 : 0;

  // Compute Volume Imbalance over top 20 levels
  const totalBidVol = bids.reduce((acc, b) => acc + (b[0] * b[1]), 0);
  const totalAskVol = asks.reduce((acc, a) => acc + (a[0] * a[1]), 0);
  const totalVol = totalBidVol + totalAskVol;
  const bidPressurePct = totalVol > 0 ? (totalBidVol / totalVol) * 100 : 50;

  // Determine Volatility Band
  const dailyRangePct = lowPrice > 0 ? ((highPrice - lowPrice) / lowPrice) * 100 : 0;
  let volatilityBand: 'LOW' | 'NORMAL' | 'ELEVATED' = 'NORMAL';
  if (dailyRangePct > 6.0) volatilityBand = 'ELEVATED';
  else if (dailyRangePct < 2.0) volatilityBand = 'LOW';

  // 3. Formulate Trading Thesis & Parameters
  let side: 'BUY' | 'SELL' = 'BUY';
  let notionalUsd = 150;
  let leverage = 1;
  let thesis = '';

  if (bidPressurePct >= 54) {
    side = 'BUY';
    thesis = `Bullish microstructure: ${normSym} displays strong buyer accumulation (${bidPressurePct.toFixed(1)}% bid depth) with a tight ${spreadBps.toFixed(2)} bps spread. Recommending a disciplined $150 spot momentum scalp at 1x leverage.`;
    notionalUsd = 150;
    leverage = 1;
  } else if (bidPressurePct <= 46) {
    side = 'BUY'; // Conservative buy on dip with low leverage
    thesis = `Mean-reversion posture: ${normSym} facing short-term ask resistance (${(100 - bidPressurePct).toFixed(1)}% ask dominance). Sizing down to $100 conservative accumulation at 1x leverage to avoid liquidity drag.`;
    notionalUsd = 100;
    leverage = 1;
  } else {
    side = 'BUY';
    thesis = `Balanced order book: ${normSym} showing equilibrium across top 20 levels (${bidPressurePct.toFixed(1)}% bid vs ${(100 - bidPressurePct).toFixed(1)}% ask). Placing a benchmark $120 liquidity scalp.`;
    notionalUsd = 120;
    leverage = 1;
  }

  const analysis: MarketAnalysis = {
    symbol: normSym,
    price: lastPrice,
    priceChange24hPct: priceChangePct,
    bidDepthVolume: totalBidVol,
    askDepthVolume: totalAskVol,
    bidPressurePct: parseFloat(bidPressurePct.toFixed(1)),
    spreadBps: parseFloat(spreadBps.toFixed(2)),
    volatilityBand,
    thesis,
    timestamp: new Date().toISOString()
  };

  return {
    agentId: 'autonomous-trader-core',
    symbol: normSym,
    side,
    notionalUsd,
    leverage,
    orderType: 'MARKET',
    analysis
  };
}
