// Writes the contract ABIs the web app uses, from Foundry's build output (contracts/out):
//   cd ../contracts && arc-forge build && cd ../web && npm run abi
// The files are generated: never edit them by hand.
import { readFile, writeFile } from "node:fs/promises";

const OUT = new URL("../../contracts/out/", import.meta.url);
const CONTRACTS = [
  { name: "GuidelineRegistry", constant: "REGISTRY_ABI", file: "../lib/registry-abi.ts" },
  { name: "GuidelineTips", constant: "TIPS_ABI", file: "../lib/tips-abi.ts" },
];

for (const c of CONTRACTS) {
  const artifact = JSON.parse(await readFile(new URL(`${c.name}.sol/${c.name}.json`, OUT), "utf8"));
  if (!Array.isArray(artifact.abi) || artifact.abi.length === 0) throw new Error(`${c.name}: no ABI in contracts/out`);
  const body =
    `// ${c.name} ABI, generated from contracts/out (arc-forge build) — do not edit by hand.\n` +
    `// Regenerate after any contract change: see contracts/README.md.\n` +
    `export const ${c.constant} = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`;
  await writeFile(new URL(c.file, import.meta.url), body);
  console.log(`${c.file.replace("../", "web/")}: ${artifact.abi.length} entries`);
}
