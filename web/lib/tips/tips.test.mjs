// Tips (K21): typed amounts → USDC units and back (amount.ts), and Tipped events → index rows (events.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import { FEE_RESERVE, MAX_TIP, MIN_TIP, TIP_PRESETS, formatUsdc, parseTipAmount } from "./amount.ts";
import { readTips, tipEvents } from "./events.ts";
import { TIPS_ABI } from "../tips-abi.ts";

// ── Amounts ──

test("typed amounts become exact USDC units (6 decimals)", () => {
  const units = (s) => parseTipAmount(s).units;
  assert.equal(units("1"), 1_000_000n);
  assert.equal(units("2.5"), 2_500_000n);
  assert.equal(units("2,50"), 2_500_000n, "a decimal comma works too");
  assert.equal(units(" 0.01 "), 10_000n);
  assert.equal(units(".5"), 500_000n);
  assert.equal(units("3."), 3_000_000n);
  assert.equal(units("1000"), 1_000_000_000n);
  assert.equal(units("0.07"), 70_000n, "no floating point: 0.07 stays 70,000 units");
});

test("amounts outside the form's rules are refused with a reason", () => {
  for (const [input, reason] of [
    ["", /Enter an amount/],
    ["   ", /Enter an amount/],
    ["abc", /up to 2 decimals/],
    ["1.234", /up to 2 decimals/],
    ["-1", /up to 2 decimals/],
    ["1e3", /up to 2 decimals/],
    ["0x10", /up to 2 decimals/],
    [".", /up to 2 decimals/],
    ["1.2.3", /up to 2 decimals/],
    ["0", /smallest tip is 0.01/],
    ["0.00", /smallest tip is 0.01/],
    ["1000.01", /up to 1,000 USDC/],
    ["9999", /up to 1,000 USDC/],
    ["10000", /up to 2 decimals/],
  ]) {
    const r = parseTipAmount(input);
    assert.ok("error" in r, `"${input}" is refused`);
    assert.match(r.error, reason, `"${input}"`);
  }
});

test("the form's limits match the contract's minimum and stay sane", () => {
  assert.equal(MIN_TIP, 10_000n, "GuidelineTips.MIN_TIP");
  assert.equal(MAX_TIP, 1_000_000_000n);
  assert.deepEqual(TIP_PRESETS, [1_000_000n, 3_000_000n, 5_000_000n]);
  assert.ok(TIP_PRESETS.every((p) => p >= MIN_TIP && p <= MAX_TIP));
  assert.equal(FEE_RESERVE, 10_000n);
});

test("units are shown exactly: whole amounts plain, others with 2 to 6 decimals", () => {
  assert.equal(formatUsdc(0n), "0");
  assert.equal(formatUsdc(5_000_000n), "5");
  assert.equal(formatUsdc(2_500_000n), "2.50");
  assert.equal(formatUsdc(10_000n), "0.01");
  assert.equal(formatUsdc(1_234_567n), "1.234567");
  assert.equal(formatUsdc(1n), "0.000001");
  assert.equal(formatUsdc(1_250_000_000n), "1,250");
  assert.equal(formatUsdc(123_456_789_012_345_678n), "123,456,789,012.345678", "beyond 2^53: still exact");
  for (const s of ["1", "2.50", "0.01", "999.99"]) assert.equal(formatUsdc(parseTipAmount(s).units), s, "round trip");
});

// ── Tipped events ──

const TIPS = "0x5b73C5498c1E3b4dbA84de0F1833c4a029d90519";
const AUTHOR = "0xd76B24F43bCF5C3fFe09906A7414CD4D02EA7cDe";
const TIPPER = "0xE3494f1C76644d5976DdCB35b42770d5F9eA3A78";
const TX = "0x" + "cd".repeat(32);

function tippedLog({ address = TIPS, guidelineId = 4n, from = TIPPER, author = AUTHOR, amount = 3_000_000n, block = 67_600_000n, logIndex = 0, tx = TX } = {}) {
  return {
    address,
    topics: encodeEventTopics({ abi: TIPS_ABI, eventName: "Tipped", args: { guidelineId, from, author } }),
    data: encodeAbiParameters([{ type: "uint256" }], [amount]),
    logIndex,
    blockNumber: block,
    transactionHash: tx,
  };
}
const receipt = (logs, status = "success") => ({ status, transactionHash: TX, blockNumber: 67_600_000n, logs });

test("a tip is read back from its receipt: guideline, tipper, author, exact amount", () => {
  assert.deepEqual(readTips(receipt([tippedLog({ logIndex: 2 })]), TIPS.toLowerCase()), [
    { guidelineId: 4n, from: TIPPER, author: AUTHOR, amount: 3_000_000n, txHash: TX, blockNumber: 67_600_000n, logIndex: 2 },
  ]);
});

test("USDC's own Transfer logs and look-alike events from other contracts are not tips", () => {
  const transfer = {
    address: "0x3600000000000000000000000000000000000000",
    topics: [
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      "0x000000000000000000000000" + TIPPER.slice(2).toLowerCase(),
      "0x000000000000000000000000" + AUTHOR.slice(2).toLowerCase(),
    ],
    data: encodeAbiParameters([{ type: "uint256" }], [3_000_000n]),
    logIndex: 1,
    blockNumber: 67_600_000n,
    transactionHash: TX,
  };
  const fake = tippedLog({ address: "0x000000000000000000000000000000000000bEEF", amount: 999_000_000n, logIndex: 3 });
  const found = readTips(receipt([tippedLog(), transfer, fake]), TIPS);
  assert.equal(found.length, 1);
  assert.equal(found[0].amount, 3_000_000n);
  assert.match(readTips(receipt([transfer, fake]), TIPS).error, /No tip found/);
});

test("failed or tipless transactions are refused", () => {
  assert.match(readTips(receipt([tippedLog()], "reverted"), TIPS).error, /failed/);
  assert.match(readTips(receipt([]), TIPS).error, /No tip found/);
});

test("several tips in one transaction (a batch) are all kept", () => {
  const found = readTips(receipt([tippedLog({ logIndex: 0 }), tippedLog({ guidelineId: 9n, amount: 10_000n, logIndex: 3 })]), TIPS);
  assert.deepEqual(found.map((t) => [t.guidelineId, t.amount, t.logIndex]), [[4n, 3_000_000n, 0], [9n, 10_000n, 3]]);
});

test("indexer: tips across blocks come out in chain order", () => {
  const logs = [
    tippedLog({ block: 12n, logIndex: 0, amount: 3n * 1_000_000n }),
    tippedLog({ block: 11n, logIndex: 7, amount: 2n * 1_000_000n }),
    tippedLog({ block: 11n, logIndex: 1, amount: 1_000_000n }),
    tippedLog({ address: "0x000000000000000000000000000000000000bEEF", block: 10n }),
  ];
  assert.deepEqual(tipEvents(logs, TIPS).map((t) => [t.blockNumber, t.logIndex, t.amount]), [
    [11n, 1, 1_000_000n],
    [11n, 7, 2_000_000n],
    [12n, 0, 3_000_000n],
  ]);
});
