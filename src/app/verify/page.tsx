"use client";

import { useEffect, useState } from "react";

// Public site key — safe to expose. Without it the page can't render the
// captcha, so it says so plainly rather than showing an empty box.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type Status = "loading" | "ready" | "verifying" | "done" | "error";

export default function VerifyPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!SITE_KEY) return;

    // Turnstile calls this global with the solved token. Defined before the
    // scripts load so it always exists by the time it's invoked.
    (window as unknown as Record<string, unknown>).onTurnstileSuccess = async (token: string) => {
      setStatus("verifying");
      try {
        const chat = new URLSearchParams(window.location.search).get("chat") ?? "";
        const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string; close?: () => void } } })
          .Telegram?.WebApp;
        const initData = tg?.initData ?? "";
        const res = await fetch("/api/telegram/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, initData, chat }),
        });
        if (res.ok) {
          setStatus("done");
          setMessage("You're verified! You can head back to the group and start chatting.");
          setTimeout(() => tg?.close?.(), 1500);
        } else {
          const body = await res.json().catch(() => ({}));
          setStatus("error");
          setMessage(body?.error || "Verification failed. Please try again.");
        }
      } catch {
        setStatus("error");
        setMessage("Verification failed. Please try again.");
      }
    };

    const tgScript = document.createElement("script");
    tgScript.src = "https://telegram.org/js/telegram-web-app.js";
    document.head.appendChild(tgScript);

    const tsScript = document.createElement("script");
    tsScript.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    tsScript.async = true;
    tsScript.defer = true;
    tsScript.onload = () => setStatus("ready");
    document.head.appendChild(tsScript);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#0a0a0b",
        color: "#f5f5f7",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: 24,
        textAlign: "center",
        fontFamily: "'Poppins', -apple-system, Segoe UI, Arial, sans-serif",
      }}
    >
      <div style={{ fontSize: 40 }}>🔓</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
        GetBack<span style={{ color: "#e30613" }}>SOL</span>
      </h1>

      {!SITE_KEY ? (
        <p style={{ opacity: 0.7, maxWidth: 320 }}>Verification isn&apos;t configured yet.</p>
      ) : (
        <>
          <p style={{ opacity: 0.8, maxWidth: 320, lineHeight: 1.5 }}>
            Quick check to unlock the chat. Solve the captcha below to confirm you&apos;re human.
          </p>

          {(status === "loading" || status === "ready") && (
            <div className="cf-turnstile" data-sitekey={SITE_KEY} data-callback="onTurnstileSuccess" />
          )}
          {status === "verifying" && <p style={{ opacity: 0.8 }}>Verifying…</p>}
          {status === "done" && <p style={{ color: "#14F195", maxWidth: 320 }}>{message}</p>}
          {status === "error" && <p style={{ color: "#ff6b6b", maxWidth: 320 }}>{message}</p>}

          <p style={{ fontSize: 12, opacity: 0.5, maxWidth: 320, marginTop: 8 }}>
            We will never ask you to connect a wallet or sign anything to verify. Anyone who does is a
            scammer.
          </p>
        </>
      )}
    </div>
  );
}
