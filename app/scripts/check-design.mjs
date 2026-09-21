/** The rules in DESIGN.md, enforced over the stylesheets.
 *
 *  Modelled on lemma-room's check of the same name. Colour drifts back one
 *  declaration at a time — a #fff to make a label legible on a fill, a value
 *  copied off a screenshot — and none of it fails a type check or a test.
 *
 *  One rule here is this app's own, and it is the important one:
 *
 *    THE CHROME NEVER WEARS THE CUSTOMER'S BRAND.
 *
 *  A --brand-* token in a chrome stylesheet is how this app starts looking
 *  broken for somebody whose brand is neon yellow or near-black. The brand is
 *  allowed inside a canvas and inside a swatch, where it is the subject. The
 *  allowance list below names those files and why.
 *
 *  Stylesheets only, deliberately. A #fff in a .tsx is usually an SVG mask or a
 *  swatch value read from pod data, and widening this produced noise, not bugs.
 *
 *  Run:  node scripts/check-design.mjs
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SEARCHED = "src/styles";

/** The file whose job is to name colours is the one place a literal belongs. */
const PALETTE = new Set(["tokens.css"]);

/** Files allowed to reference --brand-*, and the reason each one is. An entry
 *  that stops matching is one nobody is reading any more, so it has to go. */
const BRAND_SURFACES = [
  { file: "canvas.css", reason: "the preview canvas IS the brand — that is the whole subject of the screen" },
  { file: "kit.css", reason: "swatches and type specimens render the brand as the thing being shown" },
];

const LITERAL_COLOR = /(#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\()/;
const WHITE_INK = /\b(?:color|fill|stroke)\s*:\s*(?:#fff(?:f{3})?\b|white\b)/i;
const HEAVY_WEIGHT = /font-weight\s*:\s*(?:[6-9]00|bold(?:er)?)\b/i;
const BRAND_TOKEN = /var\(\s*--brand-/;

const walk = async (dir) => {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full)));
    else if (entry.name.endsWith(".css")) found.push(full);
  }
  return found;
};

const findings = [];

for (const file of await walk(path.join(ROOT, SEARCHED))) {
  const name = path.basename(file);
  const relative = path.relative(ROOT, file);
  const brandAllowed = BRAND_SURFACES.some((entry) => entry.file === name);
  const lines = (await readFile(file, "utf8")).split("\n");

  lines.forEach((line, index) => {
    const at = `${relative}:${index + 1}`;
    const code = line.split("/*")[0];
    if (!code.trim()) return;

    if (!PALETTE.has(name) && LITERAL_COLOR.test(code)) {
      findings.push(`${at}  literal colour — use a token from tokens.css\n    ${line.trim()}`);
    }
    if (!PALETTE.has(name) && WHITE_INK.test(code)) {
      findings.push(`${at}  white ink — every fill has an ink paired with it\n    ${line.trim()}`);
    }
    if (HEAVY_WEIGHT.test(code)) {
      findings.push(`${at}  weight above 500 — hierarchy comes from size and space\n    ${line.trim()}`);
    }
    if (!brandAllowed && BRAND_TOKEN.test(code)) {
      findings.push(
        `${at}  the chrome is wearing the customer's brand\n    ${line.trim()}\n` +
          `    --brand-* belongs in a canvas or a swatch. If this file is one,\n` +
          `    add it to BRAND_SURFACES in this script with the reason.`,
      );
    }
  });
}

if (findings.length) {
  console.error(`check-design: ${findings.length} finding(s)\n`);
  findings.forEach((finding) => console.error(`  ${finding}\n`));
  process.exit(1);
}
console.log("check-design: clean");
