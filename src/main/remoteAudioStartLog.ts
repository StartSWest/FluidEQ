/* FluidEQ — GPL-3.0-or-later */
import log from 'electron-log';
import { AudioWorkerStopped, stoppedOnPurpose } from './shareAudio/host';

/** What a start that FluidEQ's own quit or restart cut short writes. */
export const START_CANCELLED_LINE =
  'Share Audio: local link start cancelled, FluidEQ closing or restarting';

/** What happens next after a start that failed, said in every line. */
const NEXT =
  'It starts again when the network comes back, when this computer wakes, or when the Share Audio page is opened again.';

const SYSTEM_WORD = /^[A-Z][A-Z0-9_]{1,39}$/;

/**
 * Writes one line for a Share Audio start that did not finish, and says
 * whether it failed (Ivan, 2026-11-13: "we need to log them and make sure
 * they record nicely").
 *
 * - Cut short by the quit or a restart: one info line, nothing failed.
 * - The system turned it down — a port, an address, the network, each with
 *   its own code (EADDRINUSE on listen): one warning naming the code and
 *   the call, no stack, because nothing in FluidEQ is wrong.
 * - Anything else — the Share Audio service died, or an error nobody
 *   expected — is a bug: one error line saying so, with the error and its
 *   stack after it for the bug report.
 *
 * Never the error's message for a system failure: the service flattens
 * those to its code on purpose (`failureCode`), and a pairing parse can
 * carry secrets.
 */
export const logStartOutcome = (error: unknown): 'cancelled' | 'failed' => {
  if (stoppedOnPurpose(error)) {
    log.info(START_CANCELLED_LINE);
    return 'cancelled';
  }
  const { code, syscall } =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown; syscall?: unknown })
      : {};
  if (typeof code === 'string' && SYSTEM_WORD.test(code)) {
    const call =
      typeof syscall === 'string' && SYSTEM_WORD.test(syscall.toUpperCase())
        ? ` on ${syscall}`
        : '';
    log.warn(
      `Share Audio: the local link could not start: the system refused it (${code}${call}). ${NEXT}`,
    );
    return 'failed';
  }
  if (error instanceof AudioWorkerStopped) {
    log.error(
      `Share Audio: the local link could not start: the Share Audio service stopped while it was starting (a bug). ${NEXT}`,
      error,
    );
    return 'failed';
  }
  log.error(
    `Share Audio: the local link could not start: an unexpected error (a bug). ${NEXT}`,
    error,
  );
  return 'failed';
};
