/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the core writes what happened. Handed in by whatever hosts it — today
 * Electron's main process with its log file — so nothing in `src/core` needs
 * to know which.
 */
export interface ICoreLog {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
