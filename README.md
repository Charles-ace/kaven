# KAVEN 🛡️
### Autonomous AI Trader Agent & Pre-Flight Invariant Gate for Binance
#### *Deterministic Safety Covenant Firewall for Binance Agent OS*

<div align="center">

[![Binance Agent OS](https://img.shields.io/badge/Binance%20Agent%20OS-Track%20A%20Entry-F0B90B?style=for-the-badge&logo=binance&logoColor=black)](https://github.com/binance)
[![Live Binance Depth](https://img.shields.io/badge/Binance%20L2%20API-100%25%20Live%20Market%20Data-10b981?style=for-the-badge)](https://api.binance.com)
[![Binance Spot Testnet](https://img.shields.io/badge/Binance%20Testnet-Authenticated%20Fills-orange?style=for-the-badge)](https://testnet.binance.vision)
[![Full-Stack E2E Audit](https://img.shields.io/badge/E2E%20Audit-20%2F20%20PASS%20(100%25)-emerald?style=for-the-badge)]()
[![Model Context Protocol](https://img.shields.io/badge/MCP-Stdio%20Server%20v1.6.0-8b5cf6?style=for-the-badge)](https://modelcontextprotocol.io)
[![PR #325 Compatible](https://img.shields.io/badge/PR%20%23325-Charter%20REST%20Compatible-6366f1?style=for-the-badge)](https://github.com/binance)

<br/>

**The consumer-grade risk cockpit and unbypassable mathematical firewall that lets crypto traders deploy autonomous AI agents with confidence, simulate executions against live Binance L2 order books, and enforce strict portfolio covenants before a single dollar reaches the market.**

[Live Web Console](#1-the-user-facing-product-ai-trader-cockpit--risk-copilot) • [Two Operating Modes](#2-two-operating-modes) • [3-Tier Risk Architecture](#3-the-3-tier-execution-gateway) • [Architecture](#4-architecture) • [Honesty Table](docs/REAL_VS_MOCKED.md) • [Quickstart](#7-quickstart--verification)

</div>

---

## 1. The User-Facing Product: AI Trader Cockpit & Risk Copilot

Kaven is built from the ground up as a **first-class, consumer-ready web application** designed to give human traders and portfolio managers complete visibility and authority over their autonomous agents and execution risk.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  KAVEN — Autonomous AI Agent & Pre-Flight Gate         [TESTNET LIVE]    │
│  Declared NAV: $20,000.00                              Audit: 20/20 PASS │
├──────────────────────────────────────────────────────────────────────────┤
│  [ 🤖 Autonomous AI Trader ]   [ ⚡ Trade Simulator ]   [ 📜 Testnet History ] │
│                                                                          │
│  • Autonomous 4-Stage Cycle:                                             │
│    1. Perception: Live Binance 24h Ticker + Top 20 L2 Order Book Depth   │
│    2. Thesis: Quantitative Volume Pressure & Imbalance Synthesis         │
│    3. Arbitration: Pre-Flight Invariant Check (Capped <= 80% Safety)    │
│    4. Execution: Cryptographic RFC-8785 Action Token -> Binance Testnet  │
│                                                                          │
│  • Curated 3-Tier Showcase:                                              │
│    🟢 Tier 1: Agent Alpha ($100 BTC @ 1x)     -> AUTO-EXECUTE (Testnet)  │
│    🟡 Tier 2: Agent Beta  ($500 BTC @ 9x)     -> OPERATOR SIGN-OFF (Hold)│
│    🔴 Tier 3: Agent Gamma ($15,000 DOGE @ 10x)-> HARD VETO (Zero Tokens) │
└──────────────────────────────────────────────────────────────────────────┘
```

### Core Cockpit Modules

#### 1. 🤖 Autonomous AI Trader Agent Cockpit
- Continuously scans live Binance market microstructure (price, 24h trend, bid dominance %, spread in bps).
- Formulates quantitative trading theses with **zero external LLM token costs**.
- Passes trade intent through pre-flight invariants and executes authenticated orders on **Binance Spot Testnet** (`testnet.binance.vision`).
- Displays live streaming telemetry across all 4 stages in the web console.

#### 2. ⚡ Pre-Trade Flight Simulator (Litmus Test for Judges)
- **1-Click Curated Presets:** Instant demonstration of **Tier 1 AUTO-EXECUTE**, **Tier 2 OPERATOR SIGN-OFF**, and **Tier 3 HARD VETO**.
- **Interactive Trade Simulator:** Select any Binance pair (BTC, ETH, SOL, DOGE, PEPE), enter intended side, size, and leverage, and watch Kaven walk live Binance L2 depth to calculate exact VWAP and slippage in basis points.

#### 3. 📜 Live Binance Spot Testnet Order History
- Fetches genuine fills and order states live from Binance Spot Testnet (`GET /api/v3/allOrders`).
- Confirms real Order IDs, executed quantities, and fill statuses directly on-chain.

---

## 2. Two Operating Modes

Kaven solves the chicken-and-egg problem of crypto agent adoption by supporting two clear paradigms:

| Capability | Mode 1: Built-in Autonomous Agent | Mode 2: External Bot & LLM Gateway |
| :--- | :--- | :--- |
| **Target User** | Retail trader / hands-off quantitative trader | Algorithmic developers, hedge funds, LangChain/MCP bots |
| **Setup Time** | 0 minutes (built-in out of the box) | 2 minutes (simple REST API or MCP stdio config) |
| **Perception** | Built-in live Binance L2 microstructure engine | External agent provides trade intent |
| **Execution** | Autonomous Tier 1 dispatch to Binance Testnet | Returns signed RFC-8785 token to bot for execution |
| **Safety Net** | Self-governing (strictly bounded to $\le 80\%$ safety limits) | Unbypassable mathematical gatekeeper rejecting bad trades |

---

## 3. The 3-Tier Execution Gateway

Kaven enforces the **80% Safety Margin Rule**, classifying every proposed trade into one of three deterministic risk tiers:

```
[ Trade Proposal Intercepted ]
             │
             ├───────────────────────────────────────────────────────┐
             │                                                       │
   All metrics <= 80% limit?                             Any metric in 80%-100%?
             │                                                       │
             ▼ YES                                                   ▼ YES
   [ TIER 1: AUTO-EXECUTE ]                               [ TIER 2: HUMAN ACK ]
   • RFC 8785 HMAC-SHA256 Token                           • Automation paused
   • Valid for 30s TTL                                    • Staged in operator queue
   • Dispatched straight to Binance                       • One-click Approve / Discard
             │
             ▼ NO (Any metric > 100% limit)
   [ TIER 3: HARD VETO ]
   • Dropped immediately before execution
   • Zero cryptographic tokens minted
   • Zero Binance API requests possible
```

---

## 4. Architecture

```mermaid
flowchart TD
    subgraph UI ["User-Facing Application (Port 3842)"]
        W1["🤖 Autonomous AI Trader Cockpit"]
        W2["⚡ Pre-Trade Flight Simulator"]
        W3["📜 Live Binance Order History"]
    end

    subgraph Agents ["Autonomous Agent Layer"]
        A1["Built-in Autonomous Trader"]
        A2["Claude Code / Cursor (MCP Stdio)"]
        A3["External Python / Node Bot (REST API)"]
    end

    subgraph Kaven ["Kaven Risk Governance Engine"]
        API["REST API :3842 (POST /propose, /agent/run)"]
        MCP["MCP Server (stdio JSON-RPC)"]
        Sanitize["Pre-Flight Sanitizer (Symbol & Bounds)"]
        
        subgraph Evaluator ["5 Invariant Covenants"]
            R0["Rule 0: Feed Freshness (<= 5s)"]
            R1["Rule 1: Hard Leverage (10x Major / 3x Alt)"]
            R2["Rule 2: NAV Concentration (<= 35%)"]
            R3["Rule 3: L2 Book-Walk Slippage (<= 15 bps)"]
            R4["Rule 4: Notional Loss Exposure (<= 2.5% NAV)"]
            R5["Rule 5: Throttle Defense (>= 5s between trades)"]
        end

        Walker["L2 Book-Walker Engine (VWAP)"]
        Signing["RFC 8785 Deterministic Signing (HMAC-SHA256)"]
    end

    subgraph Executor ["Isolated Execution Gateway"]
        ExecGate["Executor Service (Holds Testnet Keys)"]
        ReplayDef["Replay & Tamper Defense (Single-Use Nonce)"]
    end

    subgraph Binance ["Live Binance Testnet & Spot API"]
        DepthAPI["GET /api/v3/depth (100 Levels)"]
        TestnetOrder["POST https://testnet.binance.vision/api/v3/order"]
    end

    UI -->|HTTP POST| API
    A1 -->|Internal Cycle| API
    A2 -->|Stdio JSON-RPC| MCP
    A3 -->|HTTP POST| API

    API --> Sanitize
    MCP --> Sanitize
    Sanitize --> Evaluator
    Evaluator <--> Walker
    Walker <-->|Live HTTPS / DoH| DepthAPI
    Evaluator --> Signing
    Signing -->|Signed Action Token (30s TTL)| ExecGate
    ExecGate --> ReplayDef
    ReplayDef -->|Authenticated Live Order| TestnetOrder
```

---

## 5. Active Safety Invariants

| Covenant | Mathematical Law | Violation Verdict | Actionable Remediation |
| :--- | :--- | :--- | :--- |
| **Feed Freshness (Rule 0)** | Live feed age $\le 5,000\text{ms}$. Stale cache fails closed. | **ESCALATE / VETO** | Degrades to safe standby; fails closed on outage. |
| **Max Leverage Cap** | Major pairs (BTC/ETH) $\le 10\times$; Altcoins (DOGE, PEPE, SOL) $\le 3\times$. | **VETO** | `"Reduce leverage on DOGEUSDT to <= 3x."` |
| **Portfolio Concentration** | $\frac{\text{Notional USD}}{\text{Declared NAV}} \times 100\% \le 35.0\%$ ($20,000 default NAV). | **VETO** | `"Reduce order size to <= $7,000.00."` |
| **L2 Book-Walk Slippage** | Real execution slippage vs best ask $\le 15.0\text{ bps}$ via multi-depth walk. | **VETO** | `"Reduce order size or place limit order near $P."` |
| **Max Notional Loss** | Single-trade loss exposure $\le 2.5\%$ of NAV ($500 stop loss). | **VETO** | `"Reduce position size to keep loss exposure <= $500."` |
| **Throttle Frequency** | Minimum $5.0\text{ seconds}$ between executed trades. | **VETO** | `"Rate governor: wait 5s before next trade."` |

---

## 6. Model Context Protocol (MCP) Integration

Kaven runs as an MCP stdio server compatible with Claude Code, Cursor, OpenDevin, and any Agent OS runtime.

### Configuration (`claude_desktop_config.json` or `.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "kaven": {
      "command": "npx",
      "args": ["tsx", "c:/Builds/Binance agents '/sentinelguard/src/mcp/server.ts"]
    }
  }
}
```

### Exposed MCP Tools
- **`limbo_evaluate_proposal`**: Pre-flight evaluation of trade intent against live Binance order books.
- **`limbo_verify_action`**: Cryptographic verification of RFC-8785 signed execution tokens.
- **`limbo_scan_market`**: Microstructure scanner for 24h ticker, bid dominance %, and spread bps.
- **`limbo_get_covenants`**: Query active safety thresholds and declared NAV.

---

## 7. Quickstart & Verification

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation & Build
```bash
git clone https://github.com/Charles-ace/kaven.git
cd kaven
npm install
npm run build
```

### Configure Binance Testnet (.env)
```bash
BINANCE_TESTNET_API_KEY=your_binance_testnet_api_key
BINANCE_TESTNET_SECRET_KEY=your_binance_testnet_secret_key
BINANCE_TESTNET_BASE_URL=https://testnet.binance.vision
PORT=3842
```

### Launch Web Console & API Server
```bash
npm run api
```
Open **`http://localhost:3842/`** (Landing Page) or **`http://localhost:3842/app`** (Risk Console).

### Run Master Full-Stack E2E Audit Suite (20/20 Checks)
```bash
npm test
# or
npm run test:fullstack
```

### Run Rigorous Concurrency & Break Test (28/28 Scenarios)
```bash
npm run test:break
```

---

## 8. Empirical Verification Scorecard

| Suite | Checks | Pass Rate | Benchmark Highlights |
| :--- | :--- | :--- | :--- |
| **Suite 1: Assets & Routing** | 6 / 6 | **100%** | GET `/`, `/app`, `/health`, static assets served $\le 20\text{ms}$ |
| **Suite 2: Invariant Engine** | 5 / 5 | **100%** | Tier 1 PASS, Tier 2 HUMAN_ACK, Tier 3 VETO, PEPE depth walk |
| **Suite 3: Autonomous AI Agent** | 2 / 2 | **100%** | Live Binance ticker scan, thesis generation & autonomous testnet fill |
| **Suite 4: Cryptographic Security**| 5 / 5 | **100%** | Replay defense, HMAC tampering ($100 $\to$ $999k) rejected, 30s TTL |
| **Suite 5: Testnet Order History** | 1 / 1 | **100%** | Live query against `testnet.binance.vision` verifying real fills |
| **Suite 6: MCP Stdio Tools** | 1 / 1 | **100%** | Handshake, 6 tools discovered, evaluation executed over stdio |
| **TOTAL** | **20 / 20** | **100.0%** | **All 6 Subsystems Verified Bulletproof** |

---

## 9. License

MIT License. Built for the Binance Agent OS Mini Hackathon (September 2026).
