import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const LimboTeaser30s: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene 1 (Frames 0 - 180 / 0-6s): Hero Brand Reveal
  const logoScale = spring({ frame, fps, config: { damping: 14 } });
  const logoOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const scene1Fade = interpolate(frame, [150, 180], [1, 0], { extrapolateRight: "clamp" });

  // Scene 2 (Frames 180 - 450 / 6-15s): Live Binance L2 Book-Walk
  const scene2Opacity = interpolate(frame, [180, 210, 420, 450], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const depthWalk = interpolate(frame, [210, 360], [0, 100], { extrapolateRight: "clamp" });
  const vwapPrice = interpolate(frame, [210, 360], [87420, 87690], { extrapolateRight: "clamp" });
  const slippageBps = interpolate(frame, [210, 360], [0, 32.5], { extrapolateRight: "clamp" });

  // Scene 3 (Frames 450 - 720 / 15-24s): VETO Alert & Avoided Loss Counter
  const scene3Opacity = interpolate(frame, [450, 480, 690, 720], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const vetoPop = spring({ frame: frame - 470, fps, config: { damping: 10 } });
  const savedCounter = Math.floor(interpolate(frame, [500, 660], [0, 1240], { extrapolateRight: "clamp" }));

  // Scene 4 (Frames 720 - 900 / 24-30s): Governed Paper Trading & CTA
  const scene4Opacity = interpolate(frame, [720, 750], [0, 1], { extrapolateRight: "clamp" });
  const ctaSlide = spring({ frame: frame - 740, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#070a09",
        color: "#ffffff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden"
      }}
    >
      {/* Background radial glow */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0, 252, 154, 0.12) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none"
        }}
      />

      {/* SCENE 1: LOGO INTRO */}
      {frame < 180 && (
        <div
          style={{
            opacity: logoOpacity * scene1Fade,
            transform: `scale(${logoScale})`,
            textAlign: "center"
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              padding: "10px 24px",
              borderRadius: 9999,
              fontSize: 18,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#34d399",
              marginBottom: 32,
              fontFamily: "monospace"
            }}
          >
            🛡️ BINANCE AGENT OS &middot; TRACK A ENTRY
          </div>

          <h1
            style={{
              fontSize: 120,
              fontWeight: 900,
              letterSpacing: "-0.05em",
              margin: 0,
              background: "linear-gradient(135deg, #a1ffc2 0%, #34d399 50%, #059669 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent"
            }}
          >
            LIMBO
          </h1>

          <p
            style={{
              fontSize: 34,
              fontWeight: 400,
              color: "rgba(255,255,255,0.7)",
              marginTop: 18,
              letterSpacing: "-0.02em"
            }}
          >
            Pre-Flight Risk Copilot & Governed Paper Trading
          </p>
        </div>
      )}

      {/* SCENE 2: LIVE BINANCE L2 DEPTH WALK */}
      {frame >= 180 && frame < 450 && (
        <div
          style={{
            opacity: scene2Opacity,
            width: 1000,
            textAlign: "center"
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontFamily: "monospace",
              color: "#34d399",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 16
            }}
          >
            LIVE BINANCE L2 ORDER BOOK WALKING
          </div>

          <h2
            style={{
              fontSize: 56,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              marginBottom: 36
            }}
          >
            Evaluating 500k Whale Order in Real Time
          </h2>

          {/* Depth progress bar */}
          <div
            style={{
              width: "100%",
              height: 24,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 36,
              border: "1px solid rgba(255,255,255,0.12)"
            }}
          >
            <div
              style={{
                width: `${depthWalk}%`,
                height: "100%",
                background: "linear-gradient(90deg, #34d399, #fb7185)",
                borderRadius: 12
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              background: "rgba(20, 26, 23, 0.8)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              padding: "24px 32px"
            }}
          >
            <div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Book Slippage</div>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "monospace", color: slippageBps > 15 ? "#fb7185" : "#34d399" }}>
                {slippageBps.toFixed(2)} bps
              </div>
            </div>
            <div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Execution VWAP</div>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "monospace", color: "#ffffff" }}>
                ${vwapPrice.toFixed(2)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Rule 0 Freshness</div>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "monospace", color: "#34d399" }}>
                0ms (LIVE)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCENE 3: VETO & AVOIDED LOSS */}
      {frame >= 450 && frame < 720 && (
        <div
          style={{
            opacity: scene3Opacity,
            textAlign: "center",
            maxWidth: 1000
          }}
        >
          <div
            style={{
              transform: `scale(${vetoPop})`,
              background: "rgba(251, 113, 133, 0.15)",
              border: "2px solid #fb7185",
              borderRadius: 28,
              padding: "36px 48px",
              boxShadow: "0 0 60px rgba(251, 113, 133, 0.35)",
              marginBottom: 40
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fb7185", letterSpacing: 1 }}>
              🚨 VETO: EXECUTION LOCKED BEFORE DISPATCH
            </div>
            <p style={{ fontSize: 22, color: "#fca5a5", marginTop: 12 }}>
              Slippage (32.5 bps) &gt; Max Tolerance (15 bps) &middot; Illiquid Depth Exhaustion
            </p>
          </div>

          <div
            style={{
              background: "rgba(52, 211, 153, 0.1)",
              border: "1px solid rgba(52, 211, 153, 0.4)",
              borderRadius: 24,
              padding: "28px 40px",
              display: "inline-block"
            }}
          >
            <div style={{ fontSize: 16, textTransform: "uppercase", letterSpacing: 2, color: "rgba(255,255,255,0.7)" }}>
              The Safety Dividend
            </div>
            <div style={{ fontSize: 64, fontWeight: 900, fontFamily: "monospace", color: "#a1ffc2", marginTop: 6 }}>
              🛡️ Capital Saved: +${savedCounter.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* SCENE 4: CALL TO ACTION */}
      {frame >= 720 && (
        <div
          style={{
            opacity: scene4Opacity,
            transform: `translateY(${(1 - ctaSlide) * 40}px)`,
            textAlign: "center"
          }}
        >
          <h2
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              marginBottom: 20
            }}
          >
            Trade High Stakes.<br />
            <span style={{ color: "#34d399" }}>Never Blow Up.</span>
          </h2>

          <p style={{ fontSize: 24, color: "rgba(255,255,255,0.7)", marginBottom: 36 }}>
            Interactive Agent Console &middot; Governed Paper Trading &middot; Binance Agent OS
          </p>

          <div
            style={{
              display: "inline-block",
              background: "linear-gradient(90deg, #a1ffc2 0%, #5bf55f 100%)",
              color: "#004d2c",
              padding: "16px 48px",
              borderRadius: 9999,
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: "uppercase",
              boxShadow: "0 0 40px rgba(0, 252, 154, 0.5)"
            }}
          >
            Launch Limbo Console
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
