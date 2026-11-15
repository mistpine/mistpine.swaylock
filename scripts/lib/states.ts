/**
 * The lock screen's states, from swaylock itself: scripts/render/states.sh
 * in Docker, and what each state must show. pnpm verify and pnpm render
 * both use it.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Spec } from "./colors.ts";
import { ROOT } from "./colors.ts";
import { image } from "./docker.ts";
import { type Expect, expectPixels, histogram, load } from "./pixels.ts";

export const STATES = ["typing", "backspace", "cleared", "capslock", "verifying", "wrong"] as const;
export type State = (typeof STATES)[number];

/** What each 560×560 tile must have; minimums are about half a good render. */
export function expectations(spec: Spec): Record<State, Expect[]> {
  const ui = (n: string) => (spec.ui[n]?.hex ?? "").toLowerCase();
  const pal = (n: string) => (spec.palette[n] ?? "").toLowerCase();
  const canvas = { label: "canvas (bg1)", hex: ui("editorBg"), min: 100_000 };
  const ring = { label: "ring (border)", hex: ui("border"), min: 10_000 };
  return {
    typing: [canvas, ring, { label: "key highlight (accent)", hex: ui("accent"), min: 1_000 }],
    backspace: [
      canvas,
      ring,
      { label: "backspace highlight (orange)", hex: pal("orange"), min: 1_000 },
    ],
    cleared: [
      canvas,
      { label: "cleared ring and text (warning)", hex: ui("warning"), min: 12_000 },
    ],
    capslock: [
      canvas,
      ring,
      { label: "Caps Lock text and key (warning)", hex: ui("warning"), min: 1_000 },
    ],
    verifying: [
      canvas,
      { label: "verifying ring (accent)", hex: ui("accent"), min: 12_000 },
      { label: "verifying text (editorFg)", hex: ui("editorFg"), min: 30 },
    ],
    wrong: [canvas, { label: "wrong ring and text (error)", hex: ui("error"), min: 12_000 }],
  };
}

export interface Run {
  version: string;
  /** Lines swaylock printed, without the expected PAM refusal. */
  said: string[];
  /** Each state's tile, by base path (no extension); `wrong` is the reddest frame. */
  tiles: Record<State, string>;
  /** Failed expectations, as lines. */
  failures: string[];
}

/** Locks headless sway on one Ubuntu release and checks every state. */
export function run(release: string, out: string, spec: Spec): Run {
  execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "--init",
      "-v",
      `${join(ROOT, "themes")}:/themes:ro`,
      "-v",
      `${join(ROOT, "scripts", "render", "states.sh")}:/states.sh:ro`,
      "-v",
      `${out}:/out`,
      "--user",
      `${process.getuid?.() ?? 0}:${process.getgid?.() ?? 0}`,
      "-e",
      "HOME=/tmp/home",
      image(release),
      "sh",
      "/states.sh",
    ],
    { stdio: ["ignore", "inherit", "inherit"], timeout: 120_000 },
  );
  const version = readFileSync(join(out, "version"), "utf8").match(/version (\S+)/)?.[1] ?? "?";
  const said = readFileSync(join(out, "swaylock.log"), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !/pam_authenticate failed: invalid credentials/.test(l));

  // The wrong state lasts about 2 s: take the frame with the most red.
  const red = (spec.ui.error?.hex ?? "").toLowerCase();
  let wrong = join(out, "wrong-1");
  let most = -1;
  for (let i = 1; existsSync(join(out, `wrong-${i}.rgb`)); i++) {
    const n = histogram(load(join(out, `wrong-${i}`))).get(red) ?? 0;
    if (n > most) [most, wrong] = [n, join(out, `wrong-${i}`)];
  }
  const tiles = Object.fromEntries(
    STATES.map((s) => [s, s === "wrong" ? wrong : join(out, s)]),
  ) as Record<State, string>;

  const expect = expectations(spec);
  const failures = STATES.flatMap((s) =>
    expectPixels(load(tiles[s]), expect[s]).map((f) => `${s}: ${f}`),
  );
  return { version, said, tiles, failures };
}
