/**
 * Renders the README image from swaylock itself: assets/preview.png, the six
 * states of the lock screen in a grid, each labeled.
 *
 * It runs the same states as pnpm verify (lib/states.ts) on Ubuntu 26.04
 * (swaylock 1.8.4), fails if any state misses its colors, and builds the
 * grid with ImageMagick in the same image.
 *
 *   pnpm render
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { loadSpec } from "@mistpine/port-kit";
import { image } from "@mistpine/port-kit/docker";
import { run, STATES, type State } from "./lib/states.ts";

const ROOT = join(import.meta.dirname, "..");

const WORK = join(ROOT, ".render");
const ASSETS = join(ROOT, "assets");
const { spec } = await loadSpec(ROOT);
const LABELS: Record<State, string> = {
  typing: "typing",
  backspace: "backspace",
  cleared: "cleared",
  capslock: "Caps Lock",
  verifying: "verifying",
  wrong: "wrong password",
};

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
mkdirSync(ASSETS, { recursive: true });
const r = run("26.04", WORK, spec);
if (r.said.length || r.failures.length) {
  console.error(`render: swaylock ${r.version}:\n  ${[...r.said, ...r.failures].join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ swaylock ${r.version}: six states`);

const canvas = (spec.ui.editorBg?.hex ?? "").toLowerCase();
const muted = (spec.palette.fg1 ?? "").toLowerCase();
execFileSync(
  "docker",
  [
    "run",
    "--rm",
    "-v",
    `${WORK}:/out`,
    "-v",
    `${ASSETS}:/assets`,
    "--user",
    `${process.getuid?.() ?? 0}:${process.getgid?.() ?? 0}`,
    image({
      name: "mistpine-swaylock",
      release: "26.04",
      context: join(ROOT, "scripts", "render"),
      hostUser: true,
    }),
    "montage",
    "-font",
    "/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Regular.ttf",
    "-pointsize",
    "26",
    "-fill",
    muted,
    "-background",
    canvas,
    ...STATES.flatMap((s) => ["-label", LABELS[s], `/out/${basename(r.tiles[s])}.png`]),
    "-tile",
    "3x2",
    "-geometry",
    "+0+16",
    "-alpha",
    "off",
    "-depth",
    "8",
    "-strip",
    "/assets/preview.png",
  ],
  { stdio: "inherit" },
);
console.log("wrote assets/preview.png");
