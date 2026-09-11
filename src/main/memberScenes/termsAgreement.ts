import fs from 'fs';
import path from 'path';
import writeFileAtomically from '../atomicWrite';

/**
 * Which version of the Plus terms this computer last shared a scene under.
 *
 * Exporting a scene and publishing one both record the agreement on the
 * server with the signature; this is only what lets the Studio skip the
 * agreement next time. Kept as the highest version agreed, so publishing
 * under a newer text never makes the next export ask about an older one.
 */

const TERMS_FILE = path.join('member-scenes', 'terms.json');

export const readAgreedTerms = (userDataDir: string): number => {
  try {
    const parsed: unknown = JSON.parse(
      fs.readFileSync(path.join(userDataDir, TERMS_FILE), 'utf8'),
    );
    const value =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>).agreed
        : undefined;
    return typeof value === 'number' && Number.isInteger(value) && value > 0
      ? value
      : 0;
  } catch {
    return 0;
  }
};

export const writeAgreedTerms = (userDataDir: string, version: number) => {
  if (!Number.isInteger(version) || version <= readAgreedTerms(userDataDir)) {
    return;
  }
  writeFileAtomically(
    path.join(userDataDir, TERMS_FILE),
    JSON.stringify({ agreed: version }),
  );
};
