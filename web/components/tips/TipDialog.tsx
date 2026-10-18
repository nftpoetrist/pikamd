"use client";

import { useEffect, useId, useRef, useState } from "react";
import { erc20Abi } from "viem";
import { useConnection, useReadContract } from "wagmi";
import { PixelStar, shortAddress } from "@/components/md-format";
import { CHAIN, TIPS, USDC } from "@/lib/chain";
import { FEE_RESERVE, TIP_PRESETS, formatBalance, formatUsdc, parseTipAmount } from "@/lib/tips/amount";
import { useTipFlow } from "@/lib/tips/client";
import { closeTipDialog, useTipRequest, type TipRequest } from "@/lib/tips/dialog";
import { openWalletModal } from "@/lib/wallet/modal";

const txUrl = (hash: string) => `${CHAIN.blockExplorers?.default.url}/tx/${hash}`;
const FAUCET = "https://faucet.circle.com";

// The one tip dialog (K21), opened by any Tip button (lib/tips/dialog.ts). Native <dialog> like the
// wallet picker: focus stays inside, Esc closes, the page behind is inert. Each opening mounts a
// fresh panel; closing it stops the tip before its next wallet prompt (lib/tips/client.ts).
export default function TipDialog() {
  const request = useTipRequest();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (request && !dialog.open) dialog.showModal();
    if (!request && dialog.open) dialog.close();
  }, [request]);

  return (
    <dialog
      ref={ref}
      className="wallet-dialog"
      aria-label="Tip the author"
      onClose={closeTipDialog}
      // A click on the dimmed area (the dialog box itself, outside the panel) closes it
      onClick={(e) => e.target === ref.current && closeTipDialog()}
      // Esc closes this dialog only, not a guideline preview open underneath
      onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}
    >
      {request && <TipPanel key={request.seq} target={request} />}
    </dialog>
  );
}

function TipPanel({ target }: { target: TipRequest }) {
  const titleId = useId();
  const otherRef = useRef<HTMLInputElement>(null);
  const { address, status } = useConnection();
  const connected = status === "connected" && !!address;
  const flow = useTipFlow();
  const [choice, setChoice] = useState<bigint | "other">(TIP_PRESETS[0]);
  const [other, setOther] = useState("");
  const [checked, setChecked] = useState(false); // show the typed amount's problem after a try or a blur

  const parsed = choice === "other" ? parseTipAmount(other) : { units: choice };
  const amount = "units" in parsed ? parsed.units : null;

  // Shown while choosing; the flow reads both again from Arc right before sending
  const reading = connected && !!TIPS;
  const balance = useReadContract({
    address: USDC.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CHAIN.id,
    query: { enabled: reading },
  });
  const allowance = useReadContract({
    address: USDC.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && TIPS ? [address, TIPS.address] : undefined,
    chainId: CHAIN.id,
    query: { enabled: reading },
  });
  const short = amount !== null && balance.data !== undefined && balance.data < amount + FEE_RESERVE;

  const send = () => {
    setChecked(true);
    if (!connected) return openWalletModal();
    if (amount === null) return otherRef.current?.focus();
    void flow.send(target, amount, address);
  };

  if (flow.phase === "done" && flow.result) {
    return (
      <div className="wallet-panel pixel-panel tip-panel">
        <div className="tip-done" role="status">
          <p className="tip-done-title">Sent</p>
          <p className="tip-done-text">
            <strong>{formatUsdc(flow.result.amount)} USDC</strong> went straight to the author&apos;s wallet,{" "}
            <code title={flow.result.author}>{shortAddress(flow.result.author)}</code>. Thank you for supporting their work
          </p>
          <div className="tip-done-actions">
            <a href={txUrl(flow.result.txHash)} target="_blank" rel="noopener noreferrer" className="btn-ghost">
              View on Arc ↗
            </a>
            <button type="button" className="btn-gold" onClick={closeTipDialog} autoFocus>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  const amountText = amount !== null ? `${formatUsdc(amount)} USDC` : "the tip";
  const asks =
    allowance.data !== undefined && amount !== null && allowance.data >= amount
      ? "Your wallet asks once: send"
      : `Your wallet asks twice: allow ${amountText}, then send`;
  const steps = flow.needsApproval
    ? [
        { key: "allow", label: `Allow ${amountText}`, now: flow.phase === "approve" || flow.phase === "approving", done: flow.phase === "tip" || flow.phase === "sending" },
        { key: "send", label: "Send the tip", now: flow.phase === "tip" || flow.phase === "sending", done: false },
      ]
    : [{ key: "send", label: "Send the tip", now: flow.phase === "tip" || flow.phase === "sending", done: false }];
  const waiting = flow.phase === "approve" || flow.phase === "tip" ? "confirm in your wallet" : flow.phase === "approving" || flow.phase === "sending" ? "writing to Arc…" : null;

  return (
    <div className="wallet-panel pixel-panel tip-panel">
      <header className="wallet-head">
        <h2 id={titleId} className="tip-title">
          <PixelStar size={21} />
          Tip the author
        </h2>
        <button type="button" className="mdp-close" aria-label="Close" title="Close (Esc)" onClick={closeTipDialog}>
          <svg width="12" height="12" viewBox="0 0 7 7" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
            <path d="M0 0h1v1H0zM6 0h1v1H6zM1 1h1v1H1zM5 1h1v1H5zM2 2h3v3H2zM1 5h1v1H1zM5 5h1v1H5zM0 6h1v1H0zM6 6h1v1H6z" />
          </svg>
        </button>
      </header>

      <div className="tip-for">
        <p className="tip-for-title">{target.title}</p>
        <p className="tip-for-author">
          by <span title={target.author}>{target.authorName}</span>
        </p>
      </div>

      <fieldset className="tip-amounts" disabled={flow.busy}>
        <legend>Amount in USDC</legend>
        <div className="tip-chips">
          {TIP_PRESETS.map((p) => (
            <label key={p.toString()} className="tip-chip">
              <input type="radio" name="tip-amount" checked={choice === p} onChange={() => setChoice(p)} />
              <span>{formatUsdc(p)}</span>
            </label>
          ))}
          <label className="tip-chip">
            <input
              type="radio"
              name="tip-amount"
              checked={choice === "other"}
              onChange={() => {
                setChoice("other");
                window.requestAnimationFrame(() => otherRef.current?.focus());
              }}
            />
            <span>Other</span>
          </label>
        </div>
        {choice === "other" && (
          <label className="tip-other">
            <span className="sr-only">Other amount in USDC</span>
            <input
              ref={otherRef}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="2.50"
              maxLength={8}
              value={other}
              aria-invalid={checked && amount === null}
              aria-describedby={checked && "error" in parsed ? `${titleId}-amount` : undefined}
              onChange={(e) => setOther(e.target.value)}
              onBlur={() => other && setChecked(true)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <span aria-hidden="true">USDC</span>
          </label>
        )}
        {checked && "error" in parsed && (
          <p id={`${titleId}-amount`} className="tip-warn">
            {parsed.error}
          </p>
        )}
      </fieldset>

      <dl className="tip-facts">
        <div>
          <dt>To</dt>
          <dd>
            <code title={target.author}>{shortAddress(target.author)}</code>, the author as recorded on Arc
          </dd>
        </div>
        <div>
          <dt>PikaMd fee</dt>
          <dd>0%. All of it goes to the author</dd>
        </div>
        <div>
          <dt>Network fee</dt>
          <dd>Under a cent, in USDC</dd>
        </div>
        {connected && balance.data !== undefined && (
          <div>
            <dt>Your balance</dt>
            <dd>{formatBalance(balance.data)} USDC</dd>
          </div>
        )}
      </dl>

      {short && !flow.busy && (
        <p className="tip-warn">
          Not enough USDC for {amountText} and its network fee
          {CHAIN.testnet && (
            <>
              . Get testnet USDC at{" "}
              <a href={FAUCET} target="_blank" rel="noopener noreferrer">
                faucet.circle.com
              </a>
            </>
          )}
        </p>
      )}

      <div className="tip-actions">
        <button type="button" className="btn-gold tip-send" disabled={flow.busy || (connected && short)} aria-busy={flow.busy || undefined} onClick={send}>
          {!connected ? "Connect wallet" : flow.busy ? "Sending…" : `Send ${amountText}`}
        </button>
        <p className="tip-hint">{connected ? asks : "Connecting is free. Then your wallet asks to allow the amount and to send it"}</p>
      </div>

      {flow.error && (
        <p className="tip-error" role="alert">
          {flow.error}
          {flow.tx && (
            <>
              {" "}
              <a href={txUrl(flow.tx)} target="_blank" rel="noopener noreferrer">
                View it on Arc ↗
              </a>
            </>
          )}
        </p>
      )}

      {flow.busy && (
        <ol className="pub-phases tip-steps" aria-live="polite">
          {flow.phase === "checking" ? (
            <li className="is-now">
              <span aria-hidden="true">▶</span> Checking the author and your balance on Arc…
            </li>
          ) : (
            steps.map((s) => (
              <li key={s.key} className={s.done ? "is-done" : s.now ? "is-now" : ""}>
                <span aria-hidden="true">{s.done ? "✓" : s.now ? "▶" : "·"}</span> {s.label}
                {s.now && waiting ? <span className="tip-step-wait"> · {waiting}</span> : null}
              </li>
            ))
          )}
        </ol>
      )}
    </div>
  );
}
