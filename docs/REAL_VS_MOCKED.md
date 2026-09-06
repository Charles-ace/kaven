# REAL vs. MOCKED Disclosure & Engineering Honesty Table

> **Project:** KAVEN — Autonomous Pre-Flight Risk Governance & Risk-Tiered Execution Agent  
> **Hackathon:** Binance Agent OS Mini Hackathon (Round 2 — Track A: "Build an AI Agent")  
> **Standard:** Hardline Engineering Integrity (v3.1 Master OS / Technical Auditor Directive)

---

## 1. Ground-Truth Principles

Kaven is an **independent risk-governance layer** that intercepts proposed agent trade intents and benchmarks them against mathematical safety invariants before any order can reach an execution venue.

Per the standing rules of the competition and the division of labor:
1. **Zero Capital at Risk:** Kaven does not risk real user funds. It governs autonomous agents by pre-flight vetting and testnet verification.
2. **Real Market Physics:** Kaven does not simulate market depth with randomized Brownian motion or synthetic order books. All depth, spread, slippage, and funding rate calculations are derived from **100% live Binance public REST APIs** (`api.binance.com` and `fapi.binance.com`).
3. **Fail-Closed Governance:** If live market data cannot be verified within strict freshness tolerances ($\le 5$ seconds), Kaven **fails closed** (`VETO` on invalid tickers, `ESCALATE` on feed drops). It never defaults to an unverified `PASS`.

---

## 2. Component-by-Component Classification

| Component | Classification | Architecture Specification | Hackathon Scope / Implementation Details |
| :--- | :--- | :--- | :--- |
| **L2 Order Book Walking Engine** | **REAL** | True volume-weighted average price (VWAP) calculation across 100 levels of live Binance bids/asks. | [`src/market/order-book-walker.ts`](../src/market/order-book-walker.ts) walks real Binance depth arrays. Computes exact VWAP, price impact ($), levels consumed, and basis-points slippage. |
| **Live Binance Depth Feed** | **REAL** | Outbound HTTPS queries to `https://api.binance.com/api/v3/depth?symbol={TICKER}&limit=100`. | [`src/market/binance-client.ts`](../src/market/binance-client.ts) pulls real-time snapshots with DNS-over-HTTPS (DoH) SNI fallback for Windows network resilience. |
| **Live Binance Funding Rates** | **REAL** | Outbound HTTPS queries to `https://fapi.binance.com/fapi/v1/premiumIndex?symbol={TICKER}`. | Fetches live 8-hour funding rates from Binance Futures public endpoints to calculate annualized carry drag. |
| **Model Context Protocol (MCP) Server** | **REAL** | Stdio MCP protocol server built with `@modelcontextprotocol/sdk` (v1.6.0). | [`src/mcp/server.ts`](../src/mcp/server.ts) exposes `limbo_evaluate_proposal` and `limbo_get_covenants` tools for direct integration into Claude Code, Cursor, and Agent OS. |
| **PR #325 Compatible REST API** | **REAL** | Express HTTP service on port 3842 (`POST /propose`, `GET /covenants`, `GET /health`). | [`src/api/server.ts`](../src/api/server.ts) matches the schema requested by Binance community PR #325 (`charter` skill) with zero mock middleware. |
| **Tamper-Evident Canonical Digest** | **REAL** | RFC 8785 compatible SHA-256 canonical hashing of normalized verdict payloads (`actionRef`). | [`src/engine/evaluator.ts`](../src/engine/evaluator.ts) derives cryptographic hashes over sorted keys, proving the proposal was cleared by Limbo without database flags. |
| **Feed Freshness Guard (Rule 0)** | **REAL** | Sub-1500ms burst coalescing with hard 5,000ms emergency fallback ceiling. | Evaluates `cacheAgeMs`. If emergency fallback is used, status degrades to `WARN` and verdict degrades to `ESCALATE`. If age $> 5000\text{ms}$, engine fails closed. |
| **Declared Portfolio NAV** | **SIMULATED** | Set via operator risk covenant policy (default: $20,000 USD). | Intentionally declared rather than fetched via private API keys. Limbo governs trading agents without requiring account custody or private API credentials. |
| **Exchange Order Execution (Kaven Executor)** | **REAL (Binance Spot Testnet)** | Direct outbound HTTPS POST queries to Binance Spot Testnet (`https://testnet.binance.vision/api/v3/order`). Holds testnet credentials only. | [`src/executor/service.ts`](../src/executor/service.ts) verifies signed action tokens, enforces 30s TTL, rejects replays/tampering, and executes authenticated orders against Binance Spot Testnet with DoH TLS SNI routing. Kaven Core retains zero custody/credentials. |

---

## 3. Adversarial Invariants & Failure Mode Handling

### A. Network Outage & Feed Disconnection
- **Behavior:** If Binance API is completely unreachable and no snapshot exists within 5 seconds, Limbo returns:
  - `decision: "ESCALATE"`
  - `rule: "Market Data Freshness & Feed Integrity"`
  - `details: "Market data connectivity failure: unable to fetch live L2 order book... Failsafe closed."`
  - `dataSource: "FAILSAFE_CLOSED"`
- **Verification:** Verified in [`tests/simulate_network_failure.ts`](../tests/simulate_network_failure.ts).

### B. Malformed / Non-Existent Symbols
- **Behavior:** If an agent hallucinates a fake ticker (e.g. `FAKECREDITUSDT`) or submits a malformed symbol string, Limbo fails closed with:
  - `decision: "VETO"`
  - `details: "Invalid symbol format / does not exist on Binance spot markets."`
- **Verification:** Verified in [`tests/stress_payload_fuzzing.ts`](../tests/stress_payload_fuzzing.ts).

### C. Concurrency & Replay Attacks
- **Behavior:** 100 simultaneous requests evaluate in isolated, stateless execution passes with singleflight in-flight coalescing. 20 rapid identical proposals generate unique timestamps, distinct proposal IDs, and deterministic canonical signatures without memory leaks.
- **Verification:** Verified in [`tests/stress_concurrent_load.ts`](../tests/stress_concurrent_load.ts) and [`tests/stress_rapid_identical.ts`](../tests/stress_rapid_identical.ts).

---

## 4. Upstream Artifact & RFC Alignment

1. **Binance Agent OS Community PR #325:** Drop-in compatibility for `POST /propose` input/output structure.
2. **Binance Agent OS Community PR #328 & PR #329:** Direct realization of the deterministic pre-trade risk engine and covenant enforcement.
3. **Binance Agent OS Issue #331:** Implementation of `action_ref` deterministic canonical SHA-256 digest for audit receipts.
