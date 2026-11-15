/**
 * Checks the config with swaylock itself, in Docker: swaylock 1.7.2 (Ubuntu
 * 24.04) and 1.8.4 (Ubuntu 26.04), locking headless sway.
 *
 *   pnpm verify                  both releases
 *   pnpm verify -- 26.04         one Ubuntu release
 *
 * 1. themes/mistpine.conf sets every color option to the spec color its
 *    role calls for (the README's table).
 * 2. swaylock takes the file without a word: it reports unknown options on
 *    stderr but locks anyway, and takes a broken color silently, so
 * 3. every state of the lock screen (typing, backspace, cleared, Caps
 *    Lock, verifying, wrong), typed with wtype, must show its colors.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSpec, ROOT } from "./lib/colors.ts";
import { run } from "./lib/states.ts";

const RELEASES = { "24.04": "1.7.2", "26.04": "1.8.4" } as const;
type Release = keyof typeof RELEASES;

const asked = process.argv.slice(2).filter((a) => a !== "--");
const releases = (asked.length ? asked : Object.keys(RELEASES)) as Release[];
for (const r of releases) if (!(r in RELEASES)) fail(`unknown release ${r}: use 24.04 or 26.04`);

function fail(message: string): never {
  console.error(`verify: ${message}`);
  process.exit(1);
}

const { spec } = await loadSpec();
const ui = (n: string) => (spec.ui[n]?.hex ?? fail(`the spec has no ui.${n}`)).toLowerCase();
const pal = (n: string) => (spec.palette[n] ?? fail(`the spec has no ${n}`)).toLowerCase();
const NONE = "00000000";

/** Every option and its color, as RRGGBB or RRGGBBAA. */
const want: Record<string, string> = {
  color: ui("editorBg"),
  "inside-color": ui("editorBg"),
  "ring-color": ui("border"),
  "line-color": NONE,
  "separator-color": NONE,
  "text-color": ui("editorFg"),
  "key-hl-color": ui("accent"),
  "bs-hl-color": pal("orange"),
  "inside-ver-color": ui("editorBg"),
  "ring-ver-color": ui("accent"),
  "line-ver-color": NONE,
  "text-ver-color": ui("editorFg"),
  "inside-wrong-color": ui("editorBg"),
  "ring-wrong-color": ui("error"),
  "line-wrong-color": NONE,
  "text-wrong-color": ui("error"),
  "inside-clear-color": ui("editorBg"),
  "ring-clear-color": ui("warning"),
  "line-clear-color": NONE,
  "text-clear-color": ui("warning"),
  "inside-caps-lock-color": ui("editorBg"),
  "ring-caps-lock-color": ui("border"),
  "line-caps-lock-color": NONE,
  "text-caps-lock-color": ui("warning"),
  "caps-lock-key-hl-color": ui("warning"),
  "caps-lock-bs-hl-color": pal("orange"),
  "layout-bg-color": ui("statusBg"),
  "layout-border-color": NONE,
  "layout-text-color": ui("statusFg"),
};

const got = new Map<string, string>();
for (const raw of readFileSync(join(ROOT, "themes", "mistpine.conf"), "utf8").split("\n")) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const m = line.match(/^([a-z-]+)=([0-9a-f]{6}|[0-9a-f]{8})$/);
  if (!m) fail(`themes/mistpine.conf: unexpected line "${line}"`);
  got.set(m[1] as string, m[2] as string);
}
for (const [option, value] of Object.entries(want)) {
  const expected = value === NONE ? NONE : value.slice(1);
  if (got.get(option) !== expected) fail(`${option} is ${got.get(option)}, want ${expected}`);
}
if (got.size !== Object.keys(want).length) fail("themes/mistpine.conf has extra options");
console.log(`mistpine.conf: all ${got.size} color options match the spec`);

for (const release of releases) {
  const out = mkdtempSync(join(tmpdir(), "mistpine-swaylock-verify-"));
  try {
    const r = run(release, out, spec);
    if (r.version !== RELEASES[release]) fail(`ubuntu:${release} has swaylock ${r.version}`);
    const label = `swaylock ${r.version} (ubuntu:${release})`;
    if (r.said.length) fail(`${label} said:\n  ${r.said.join("\n  ")}`);
    if (r.failures.length) fail(`${label}: wrong colors on screen:\n  ${r.failures.join("\n  ")}`);
    console.log(`${label}: no warnings, and all six states show the spec's colors`);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}
