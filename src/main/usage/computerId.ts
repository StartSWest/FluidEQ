import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import writeFileAtomically from '../atomicWrite';

/**
 * A random number that tells this installation's listening apart from the
 * account's other computers.
 *
 * The board adds up what an account's computers played and holds the sum to
 * the clock, so a day at the office and an evening at home count in full
 * while two computers playing at once count once. For that the server has to
 * know which computer each day came from — and nothing more: this is made on
 * first use and kept, and says nothing about the machine, its name, its
 * hardware or where it is. Deleting the file only makes the next report look
 * like a new computer, which the clock rule already holds in check.
 */

const FILE_NAME = 'computer-id.json';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const readStored = (filePath: string): string | undefined => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const id =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as { id?: unknown }).id
        : undefined;
    return typeof id === 'string' && UUID.test(id) ? id : undefined;
  } catch {
    // Missing or unreadable is the first run, or a file somebody cleared:
    // either way the answer is a fresh number.
    return undefined;
  }
};

/** This installation's id, made and kept the first time it is asked for. */
const readComputerId = (userDataDir: string): string => {
  const filePath = path.join(userDataDir, FILE_NAME);
  const stored = readStored(filePath);
  if (stored) {
    return stored;
  }
  const id = randomUUID();
  writeFileAtomically(filePath, JSON.stringify({ id }));
  return id;
};

export default readComputerId;
