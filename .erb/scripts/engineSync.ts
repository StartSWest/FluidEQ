/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What `sync-dev-engine` reads off the helper, apart from the running of it,
 * so it can be tested without a UAC prompt or an audio restart anywhere near
 * a test run. Whether to reinstall at all is the app's own question, asked
 * the same way: `planEngineUpdate` in `src/main/engineUpdate.ts`.
 */

/** The helper's `error`, when its stdout is the result document it writes. */
export const helperError = (stdout: string): string | undefined => {
  try {
    const parsed: unknown = JSON.parse(stdout.trim());
    if (typeof parsed === 'object' && parsed !== null) {
      const { error } = parsed as { error?: unknown };
      return typeof error === 'string' && error.length > 0 ? error : undefined;
    }
  } catch {
    // Not the document: the helper's exit code is still the verdict.
  }
  return undefined;
};
