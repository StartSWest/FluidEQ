import fs from 'fs';
import path from 'path';

/**
 * What the leaderboard's tally left on this computer, deleted.
 *
 * The board counted the minutes of music that played each day in
 * `usage-ledger.json`, beside an "opted in" switch and a mark of how much of
 * each day the board had been sent. The board is gone (Ivan, 2026-10-21) and
 * the server deleted every day it was sent (premium 0068), so those marks
 * describe nothing: the listening statistics keep their own tally in
 * `listening-ledger.json`, counted only once the account has been told, and
 * this one goes rather than lie in somebody's profile for no reason.
 *
 * `computer-id.json` stays: the statistics tell an account's computers apart
 * by the same random number, which says nothing about the machine.
 *
 * Runs at every launch and costs one failed `unlink` once the file is gone.
 * A file that cannot be removed is only logged: nothing reads it again.
 */
const LEFT_BEHIND = ['usage-ledger.json'] as const;

const forgetListening = (
  userDataDir: string,
  logger?: { warn(message: string): void },
): void => {
  LEFT_BEHIND.forEach((name) => {
    try {
      // `unlink` removes a link itself, never what it points at.
      fs.unlinkSync(path.join(userDataDir, name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger?.warn(`Could not remove ${name}: ${error}`);
      }
    }
  });
};

export default forgetListening;
