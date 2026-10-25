"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSignedIn } from "@/lib/collection/client";
import { messageFor } from "@/lib/publish/client";
import { api } from "@/lib/wallet/api";
import { useWalletUnknown } from "@/lib/wallet/known";
import { openWalletModal } from "@/lib/wallet/modal";
import { useSignIn } from "@/lib/wallet/session";

type RequestInfo = { clientKind: "cimd" | "dcr"; clientName: string; clientHost: string | null; redirectUri: string; scope: string; expiresAt: string };

// Errors the authorization endpoint sends here instead of to the app (the app or its redirect
// couldn't be trusted). Codes only: nothing from the request is shown back.
const ERRORS: Record<string, string> = {
  invalid_client: "PikaMd couldn't identify the app that sent you here",
  invalid_redirect_uri: "The app asked to send you to an address it didn't register, so PikaMd stopped here",
  invalid_request: "The sign-in request was malformed",
  rate_limited: "Too many sign-in requests from this network. Wait a few minutes and try again",
};

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const isLoopback = (uri: string) => {
  try {
    const u = new URL(uri);
    return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
};

// The consent screen (ARCHITECTURE §8.2). It names the app by what PikaMd can verify: the host of a
// client metadata document (claude.ai), never only the name the app gives itself. It shows where
// you'll be sent back (MCP authorization: the redirect host must be shown clearly) and warns when
// that's a program on this computer. Allowing needs the wallet's signed-in session; the session
// cookie doesn't come with the cross-site arrival, so everything here asks the API after loading.
export default function ConsentPanel() {
  const params = useSearchParams();
  const requestId = params.get("request");
  const errorCode = params.get("error");
  const unknown = useWalletUnknown();
  const { wallet, signed, pending } = useSignedIn();
  const signIn = useSignIn();
  const [busy, setBusy] = useState<"allow" | "deny" | "signin" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);

  const info = useQuery({
    queryKey: ["oauth-request", requestId],
    queryFn: () => api<RequestInfo>(`/api/oauth/consent?request=${encodeURIComponent(requestId ?? "")}`),
    enabled: !!requestId && !errorCode,
    retry: false,
    staleTime: Infinity,
  });

  const answer = async (allow: boolean) => {
    setBusy(allow ? "allow" : "deny");
    setError(null);
    try {
      const { redirect } = await api<{ redirect: string }>("/api/oauth/consent", { method: "POST", body: { request: requestId, allow } });
      setLeaving(new URL(redirect).host);
      // A plain navigation, not a form post: the site's CSP limits where forms may lead
      window.location.assign(redirect);
    } catch (e) {
      setError(messageFor(e));
      setBusy(null);
    }
  };

  const startSignIn = async () => {
    if (!wallet) return;
    setBusy("signin");
    setError(null);
    try {
      await signIn(wallet);
    } catch {
      setError("You didn't sign in. Allowing the app needs one free signature from your wallet");
    } finally {
      setBusy(null);
    }
  };

  if (errorCode || !requestId) {
    return (
      <section className="consent pixel-panel" aria-labelledby="consent-title">
        <h1 id="consent-title" className="consent-title">
          Sign-in stopped
        </h1>
        <p className="consent-text">{ERRORS[errorCode ?? ""] ?? "There's no sign-in request here"}</p>
        <p className="consent-text is-dim">Go back to your app and start connecting PikaMd again</p>
      </section>
    );
  }

  if (info.isPending) {
    return <section className="consent pixel-panel" aria-busy="true" aria-label="Loading the sign-in request" style={{ minHeight: 420 }} />;
  }

  if (info.isError || !info.data) {
    return (
      <section className="consent pixel-panel" aria-labelledby="consent-title">
        <h1 id="consent-title" className="consent-title">
          This request has ended
        </h1>
        <p className="consent-text">{info.isError ? messageFor(info.error) : "This sign-in request has expired or was already answered"}</p>
        <p className="consent-text is-dim">Go back to your app and start connecting PikaMd again</p>
      </section>
    );
  }

  const r = info.data;
  const verified = r.clientKind === "cimd" && r.clientHost;
  const app = verified ? r.clientHost! : r.clientName;
  const returnsTo = new URL(r.redirectUri).host;
  const local = isLoopback(r.redirectUri);

  return (
    <section className="consent pixel-panel" aria-labelledby="consent-title">
      <p className="consent-eyebrow">Connect an app to PikaMd</p>
      <h1 id="consent-title" className="consent-title">
        {verified ? (
          <>
            <span className="consent-app">{app}</span> wants to read your PikaMd collection
          </>
        ) : (
          // A self-registered app picks its own name (it could call itself "claude.ai"), so the name
          // is only ever quoted, never shown as an identity
          <>An app calling itself &ldquo;{app}&rdquo; wants to read your PikaMd collection</>
        )}
      </h1>
      {verified ? (
        <p className="consent-text is-dim">
          It calls itself &ldquo;{r.clientName}&rdquo;. PikaMd checked that this request comes from {r.clientHost}
        </p>
      ) : (
        <p className="consent-flag">
          <b>Unverified app.</b> It registered itself, so PikaMd can&apos;t confirm who made it. Allow it only if you just started connecting
          from this app
        </p>
      )}

      <dl className="consent-list">
        <div>
          <dt>It will see</dt>
          <dd>The guidelines you saved to your collection</dd>
        </div>
        <div>
          <dt>It can&apos;t</dt>
          <dd>Publish, tip, like, report or change anything</dd>
        </div>
        <div>
          <dt>Sends you back to</dt>
          <dd>
            <code>{returnsTo}</code>
          </dd>
        </div>
        {wallet && signed && (
          <div>
            <dt>Signed in as</dt>
            <dd>
              <code>{short(wallet)}</code>
            </dd>
          </div>
        )}
      </dl>

      {local && (
        <p className="consent-flag">
          <b>This app runs on your computer.</b> It returns to {returnsTo}, a program on this machine. Allow it only if you just started
          connecting from an app here, such as Claude Code or VS Code
        </p>
      )}

      {error && (
        <p className="pub-error" role="alert">
          {error}
        </p>
      )}

      {leaving ? (
        <p className="consent-text" role="status">
          Returning to {leaving}…
        </p>
      ) : (
        <div className="consent-actions">
          {unknown || (wallet !== null && pending) ? (
            <button type="button" className="btn-gold" disabled aria-busy="true">
              Checking your wallet…
            </button>
          ) : !wallet ? (
            <button type="button" className="btn-gold" onClick={openWalletModal}>
              Connect Wallet
            </button>
          ) : !signed ? (
            <button type="button" className="btn-gold" onClick={() => void startSignIn()} disabled={busy !== null} aria-busy={busy === "signin" || undefined}>
              {busy === "signin" ? "Check your wallet…" : "Sign in"}
            </button>
          ) : (
            <button type="button" className="btn-gold" onClick={() => void answer(true)} disabled={busy !== null} aria-busy={busy === "allow" || undefined}>
              {busy === "allow" ? "Allowing…" : "Allow"}
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={() => void answer(false)} disabled={busy !== null}>
            Cancel
          </button>
        </div>
      )}
      <p className="pub-hint">
        {!wallet
          ? "Connecting your wallet is free and shares only its address"
          : !signed
            ? "One free signature from your wallet, with no transaction and no gas"
            : "You can disconnect this app any time on Connect your agent"}
      </p>
    </section>
  );
}
