import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseFees, inclusionTip, nextBaseFee, IDLE_TIP, MIN_BASE_FEE } from "./fees.ts";

const gwei = (n) => BigInt(Math.round(n * 1e9));

// Arc testnet's latest block on 2026-10-25: extra_data announced 20 gwei, the block's own base fee 20 gwei
const ARC_BLOCK = { baseFeePerGas: gwei(20), extraData: "0x00000004a817c800" };

test("the next base fee comes from extra_data, 8 bytes big-endian", () => {
  assert.equal(nextBaseFee(ARC_BLOCK), gwei(20));
  assert.equal(nextBaseFee({ baseFeePerGas: gwei(20), extraData: "0x00000005d21dba00" }), gwei(25));
});

test("an extra_data that isn't a base fee falls back to the block's base fee, never below the floor", () => {
  assert.equal(nextBaseFee({ baseFeePerGas: gwei(23), extraData: "0x" }), gwei(23));
  assert.equal(nextBaseFee({ baseFeePerGas: gwei(23), extraData: "0xd883010e0c846765746888676f312e32322e33856c696e7578" }), gwei(23));
  // Out of the protocol's range (below 20 gwei, above 20,000 gwei): not trusted
  assert.equal(nextBaseFee({ baseFeePerGas: gwei(21), extraData: "0x0000000000000001" }), gwei(21));
  assert.equal(nextBaseFee({ baseFeePerGas: gwei(21), extraData: "0xffffffffffffffff" }), gwei(21));
  assert.equal(nextBaseFee({ baseFeePerGas: null, extraData: "0x" }), MIN_BASE_FEE);
  assert.equal(nextBaseFee({ baseFeePerGas: gwei(1), extraData: "0x" }), MIN_BASE_FEE);
});

test("blocks with room: a 1 wei tip, whatever others tip", () => {
  // Shape of Arc testnet that day: blocks at most 15% full, some accounts tipping 500–930 gwei
  const history = { gasUsedRatio: [0.01, 0.15, 0.004, 0.02], reward: [[gwei(931.6)], [gwei(520)], [gwei(806.8)], [gwei(0)]] };
  assert.equal(inclusionTip(history), IDLE_TIP);
  assert.equal(inclusionTip({ gasUsedRatio: [] }), IDLE_TIP);
});

test("nearly full blocks: the most the cheapest transactions in them had to tip", () => {
  const history = { gasUsedRatio: [0.2, 0.95, 0.91, 0.3], reward: [[gwei(900)], [gwei(2)], [gwei(3.5)], [gwei(700)]] };
  assert.equal(inclusionTip(history), gwei(3.5));
  // A full block without reward data adds nothing
  assert.equal(inclusionTip({ gasUsedRatio: [0.99] }), IDLE_TIP);
});

test("the suggestion: base fee doubled plus the tip as the ceiling, the tip as it is", () => {
  const idle = chooseFees(ARC_BLOCK, { gasUsedRatio: [0.01], reward: [[gwei(520)]] });
  assert.deepEqual(idle, { maxFeePerGas: gwei(40) + IDLE_TIP, maxPriorityFeePerGas: IDLE_TIP });
  // Above MetaMask's "low" ceiling for Arc mainnet that day (21 gwei), so it isn't replaced
  assert.ok(idle.maxFeePerGas > gwei(21));
  // A publish (219,781 gas, measured) costs at most base + tip once included: about 0.0044 USDC, not 0.114
  const paid = BigInt(219_781) * (gwei(20) + idle.maxPriorityFeePerGas);
  assert.ok(paid < gwei(0.0045 * 1e9));

  const busy = chooseFees(ARC_BLOCK, { gasUsedRatio: [0.97], reward: [[gwei(2)]] });
  assert.deepEqual(busy, { maxFeePerGas: gwei(42), maxPriorityFeePerGas: gwei(2) });
});
