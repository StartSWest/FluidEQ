import fs from 'fs';
import path from 'path';

/**
 * What the leaderboard left on this computer, deleted.
 *
 * The board counted the minutes of music that played each day, kept in
 * `usage-ledger.json`, and told a person's computers apart by a random id in
 * `computer-id.json`. The board is gone (Ivan, 2026-10-21) and nothing reads
 * either file, so neither stays: a tally of somebody's listening is not
 * something to leave lying in their profile for no reason. The server's
 * copy goes with premium migration 0068.
 *
 * Runs at every launch and costs one failed `unlink` per file once they are
 * gone. A file that cannot be removed is only logged: it holds nothing the
 * app will ever send again.
 */
const LEFT_BEHIND = ['usage-ledger.json', 'computer-id.json'] as const;

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
