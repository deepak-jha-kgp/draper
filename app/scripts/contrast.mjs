/** Measure WCAG contrast for the pairs named in src/styles/tokens.css.
 *
 *  The comments in that file claim numbers. This is what produces them, so the
 *  claim can be re-checked rather than believed.
 *
 *  Run:  node scripts/contrast.mjs
 */

const channel = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const THEMES = {
  dark: {
    chrome: "#11120F", panel: "#191A16", ink: "#F3F0E7", "ink-2": "#9B9C92",
    "ink-3": "#8A8C83", accent: "#C7FF4A", "on-accent": "#152000",
    ok: "#8FDCA2", bad: "#FF8F7F",
  },
  light: {
    chrome: "#EFEDE6", panel: "#F8F6F0", ink: "#20211D", "ink-2": "#5E5F57",
    "ink-3": "#66675E", accent: "#4E7209", "on-accent": "#FFFDF8",
    ok: "#2F6E4F", bad: "#A8321F",
  },
};

const PAIRS = [
  ["ink", "chrome"], ["ink", "panel"],
  ["ink-2", "chrome"], ["ink-2", "panel"],
  ["ink-3", "chrome"], ["ink-3", "panel"],
  ["on-accent", "accent"], ["accent", "chrome"],
  ["ok", "panel"], ["bad", "panel"],
];

let failed = 0;
for (const [name, tokens] of Object.entries(THEMES)) {
  console.log(`\n${name}`);
  for (const [ink, surface] of PAIRS) {
    const r = ratio(tokens[ink], tokens[surface]);
    const ok = r >= 4.5;
    if (!ok) failed += 1;
    console.log(
      `  ${`${ink} on ${surface}`.padEnd(24)} ${r.toFixed(2).padStart(5)}:1  ${ok ? "AA" : "BELOW AA"}`,
    );
  }
}

if (failed) {
  console.error(`\n${failed} pair(s) below AA for body text.`);
  process.exit(1);
}
console.log("\nEvery pair clears AA for body text.");
