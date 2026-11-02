/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The names this app gives the utility processes it forks.
 *
 * One definition for both ends: `utilityProcess.fork` stamps it on the child,
 * and the process list (`ipc/processes.ts`) looks for it to say what that
 * child does. Every `utilityProcess.fork` reports the same Chromium service —
 * `node.mojom.NodeService` — so this name is the only thing that tells the
 * karaoke models from a library scan, and two copies of the string drifting
 * apart would drop a row back to an unexplained helper without a word.
 */
export const MODEL_PROCESS_NAME = 'FluidEQ Native Inference';
export const LIBRARY_SCAN_PROCESS_NAME = 'FluidEQ Library Scan';
