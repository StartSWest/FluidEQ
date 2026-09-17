/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which graphics card the app runs on, on a computer with two.
 *
 * A laptop with an integrated chip and a discrete card hands each program to
 * one of them, and Windows hands a program like this one to the integrated
 * chip unless told otherwise: every Plus visualizer then draws on the slow
 * one while the fast one idles. Chromium cannot move a single canvas across
 * (a scene's own request for the fast card is ignored on Windows), so the
 * choice is made for the whole app, at launch, by a command-line switch —
 * main keeps it in a file read before the app is ready
 * (`main/graphicsPreference.ts`). `auto` leaves it to Windows, which is what
 * every laptop on battery wants.
 */

export const GPU_PREFERENCES = ['auto', 'high'] as const;
export type TGpuPreference = (typeof GPU_PREFERENCES)[number];

export const isGpuPreference = (value: unknown): value is TGpuPreference =>
  typeof value === 'string' &&
  (GPU_PREFERENCES as readonly string[]).includes(value);

/** Chromium's own switch: every context, the whole app, on the fast card. */
export const HIGH_PERFORMANCE_GPU_SWITCH = 'force_high_performance_gpu';

/** Where the switch means anything: Windows decides per program there. */
export const gpuPreferenceSupported = (platform: string): boolean =>
  platform === 'win32';

export interface IGraphicsPreferenceState {
  chosen: TGpuPreference;
  /** What this launch was started with; a restart is owed while they differ. */
  atLaunch: TGpuPreference;
  /** Whether the choice means anything on this platform. */
  supported: boolean;
}
