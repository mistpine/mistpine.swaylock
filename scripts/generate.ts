/**
 * Writes themes/mistpine.conf, a swaylock config with every color option,
 * from the mistpine spec.
 *
 *   pnpm generate          write it
 *   pnpm generate --check  fail if it is out of date
 *
 * Every color comes from palette/mistpine.json in the reference repository
 * (see lib/colors.ts), except `00000000`, fully transparent, for the lines
 * swaylock draws around the ring. Before anything is written, every text
 * color must clear 4.5:1 on the inside of the ring it sits on.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contrast, loadSpec, mix, ROOT, type Spec } from "./lib/colors.ts";

const check = process.argv.includes("--check");
const { spec, source } = await loadSpec();

/** A palette key (`bg1`) or a spec token (`ui.error`), as RRGGBB; "none" is transparent. */
function color(key: string): string {
  if (key === "none") return "00000000";
  const [group, name] = key.includes(".") ? key.split(".", 2) : ["palette", key];
  const table = spec[group as keyof Spec] as Record<string, unknown> | undefined;
  const value = table?.[name as string];
  const hex = typeof value === "string" ? value : (value as { hex?: string } | undefined)?.hex;
  if (!hex) throw new Error(`the spec has no color ${key}`);
  return hex.slice(1).toLowerCase();
}

/** Recomputes the spec's blends, so the port provably uses the spec's math. */
function verifyBlends(): void {
  const names: Record<string, string> = {
    "@terminal.background": spec.terminal.background?.hex ?? "",
  };
  let checked = 0;
  for (const [name, t] of Object.entries(spec.ui)) {
    if (!t.derived) continue;
    const m = t.derived.match(/^mix\((\S+), \$(\w+), (\d+)%\)$/);
    if (!m) throw new Error(`ui.${name}: unknown blend ${t.derived}`);
    const [, base, key, pct] = m as unknown as [string, string, string, string];
    const from = names[base] ?? `#${color(base.replace(/^\$/, ""))}`;
    const got = mix(from, `#${color(key)}`, Number(pct) / 100);
    if (got !== t.hex) throw new Error(`ui.${name}: ${t.derived} gives ${got}, spec says ${t.hex}`);
    checked++;
  }
  if (checked === 0) throw new Error("the spec has no blends: did its format change?");
}

// ---------------------------------------------------------------- mapping

/** Sections of the file: a comment, then [option, color]. */
const SECTIONS: { title: string[]; options: [string, string][] }[] = [
  {
    title: ["The screen: the spec's canvas, bg1."],
    options: [["color", "ui.editorBg"]],
  },
  {
    title: [
      "Typing: a bg4 ring on the canvas, keys lighting it in the accent,",
      "backspace in orange. No lines around the ring.",
    ],
    options: [
      ["inside-color", "ui.editorBg"],
      ["ring-color", "ui.border"],
      ["line-color", "none"],
      ["separator-color", "none"],
      ["text-color", "ui.editorFg"],
      ["key-hl-color", "ui.accent"],
      ["bs-hl-color", "orange"],
    ],
  },
  {
    title: ["Verifying the password: the ring fills with the accent."],
    options: [
      ["inside-ver-color", "ui.editorBg"],
      ["ring-ver-color", "ui.accent"],
      ["line-ver-color", "none"],
      ["text-ver-color", "ui.editorFg"],
    ],
  },
  {
    title: ["Wrong password: red, as errors are everywhere in mistpine."],
    options: [
      ["inside-wrong-color", "ui.editorBg"],
      ["ring-wrong-color", "ui.error"],
      ["line-wrong-color", "none"],
      ["text-wrong-color", "ui.error"],
    ],
  },
  {
    title: ["Input cleared (Escape or Ctrl+U): yellow, a notice."],
    options: [
      ["inside-clear-color", "ui.editorBg"],
      ["ring-clear-color", "ui.warning"],
      ["line-clear-color", "none"],
      ["text-clear-color", "ui.warning"],
    ],
  },
  {
    title: [
      "Caps Lock on: the text says so in yellow, a warning. With",
      "--indicator-caps-lock (-l), keys light the ring in yellow too.",
    ],
    options: [
      ["inside-caps-lock-color", "ui.editorBg"],
      ["ring-caps-lock-color", "ui.border"],
      ["line-caps-lock-color", "none"],
      ["text-caps-lock-color", "ui.warning"],
      ["caps-lock-key-hl-color", "ui.warning"],
      ["caps-lock-bs-hl-color", "orange"],
    ],
  },
  {
    title: ["The keyboard layout (--show-keyboard-layout): a status line chip."],
    options: [
      ["layout-bg-color", "ui.statusBg"],
      ["layout-border-color", "none"],
      ["layout-text-color", "ui.statusFg"],
    ],
  },
];

/** Every color option swaylock 1.7.2 and 1.8.4 know (swaylock --help). */
const ALL_OPTIONS = [
  "bs-hl-color",
  "caps-lock-bs-hl-color",
  "caps-lock-key-hl-color",
  "color",
  "inside-caps-lock-color",
  "inside-clear-color",
  "inside-color",
  "inside-ver-color",
  "inside-wrong-color",
  "key-hl-color",
  "layout-bg-color",
  "layout-border-color",
  "layout-text-color",
  "line-caps-lock-color",
  "line-clear-color",
  "line-color",
  "line-ver-color",
  "line-wrong-color",
  "ring-caps-lock-color",
  "ring-clear-color",
  "ring-color",
  "ring-ver-color",
  "ring-wrong-color",
  "separator-color",
  "text-caps-lock-color",
  "text-clear-color",
  "text-color",
  "text-ver-color",
  "text-wrong-color",
];

// ---------------------------------------------------------------- lint

const failures: string[] = [];
const options = new Map(SECTIONS.flatMap((s) => s.options));
for (const o of ALL_OPTIONS) if (!options.has(o)) failures.push(`no ${o}`);
for (const o of options.keys()) if (!ALL_OPTIONS.includes(o)) failures.push(`unknown option ${o}`);

/** Text on the inside of the ring it sits in, and the layout chip. */
const PAIRS: [string, string][] = [
  ["text-color", "inside-color"],
  ["text-ver-color", "inside-ver-color"],
  ["text-wrong-color", "inside-wrong-color"],
  ["text-clear-color", "inside-clear-color"],
  ["text-caps-lock-color", "inside-caps-lock-color"],
  ["layout-text-color", "layout-bg-color"],
];
for (const [fg, bg] of PAIRS) {
  const r = contrast(`#${color(options.get(fg) ?? "")}`, `#${color(options.get(bg) ?? "")}`);
  if (r < 4.5)
    failures.push(`${fg} on ${bg} is ${(Math.floor(r * 100) / 100).toFixed(2)}:1, want 4.5:1`);
}
// The README's table names every color the file uses.
const readme = readFileSync(join(ROOT, "README.md"), "utf8");
for (const [option, key] of options) {
  const hex = color(key);
  if (hex !== "00000000" && !readme.includes(`\`#${hex}\``)) {
    failures.push(`README.md: no \`#${hex}\` (${option})`);
  }
}
verifyBlends();

if (failures.length) {
  console.error(`generate: ${failures.length} problem(s):\n  ${failures.join("\n  ")}`);
  process.exit(1);
}

// ---------------------------------------------------------------- write

const text = [
  "# mistpine for swaylock: https://github.com/mistpine/mistpine.swaylock",
  "# MIT License",
  "#",
  "# Save as ~/.config/swaylock/config, or add these lines to yours:",
  "# swaylock has no include. Colors only; fonts, the indicator's size and",
  "# images stay yours. Colors are RRGGBB or RRGGBBAA, without #.",
  "#",
  "# Generated by scripts/generate.ts from the mistpine spec",
  "# (https://github.com/mistpine/mistpine/blob/main/palette/mistpine.json).",
  "# Do not edit by hand.",
  ...SECTIONS.flatMap((s) => [
    "",
    ...s.title.map((t) => `# ${t}`),
    ...s.options.map(([o, k]) => `${o}=${color(k)}`),
  ]),
  "",
].join("\n");

const rel = "themes/mistpine.conf";
const file = join(ROOT, rel);
let current = "";
try {
  current = readFileSync(file, "utf8");
} catch {}
if (current !== text) {
  if (check) {
    console.error(`${rel} is out of date: run pnpm generate`);
    process.exit(1);
  }
  writeFileSync(file, text);
  console.log(`wrote ${rel}`);
}
console.log(`${check ? "up to date" : "done"} (spec: ${source})`);
