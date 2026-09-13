/**
 * Makes the update feed's key pair, once, on the maker's machine.
 *
 *   pnpm update-feed-keys
 *
 * Writes the private key into `.env` (`FLUIDEQ_UPDATE_FEED_KEY`, with its id
 * in `FLUIDEQ_UPDATE_FEED_KEY_ID`) and the public key into
 * `src/main/updateFeedSignature.ts`, and prints neither secret. Commit the
 * source file; never commit `.env`, and keep a copy of the key somewhere safe
 * — a lost key means installed copies can no longer be updated by any release
 * signed with another. Refuses to replace a key that is already there.
 */

import fs from 'fs';
import path from 'path';
import { generateKeyPairSync } from 'crypto';
import { UPDATE_FEED_KEYS } from '../../src/main/updateFeedSignature';
import { FEED_KEY_ENV, FEED_KEY_ID_ENV } from './sign-update-feed';

const root = path.join(__dirname, '../..');
const envPath = path.join(root, '.env');
const sourcePath = path.join(root, 'src/main/updateFeedSignature.ts');

const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
if (
  Object.keys(UPDATE_FEED_KEYS).length > 0 ||
  new RegExp(`^${FEED_KEY_ENV}=`, 'm').test(envText)
) {
  console.error(
    'An update feed key already exists. Replacing it would stop installed ' +
      'copies taking updates signed with it; refusing.',
  );
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const keyId = `fluideq-feed-${new Date().toISOString().slice(0, 10)}`;
const publicBase64 = publicKey
  .export({ format: 'der', type: 'spki' })
  .toString('base64');
const privateBase64 = privateKey
  .export({ format: 'der', type: 'pkcs8' })
  .toString('base64');

const source = fs.readFileSync(sourcePath, 'utf8');
const empty =
  'export const UPDATE_FEED_KEYS: Readonly<Record<string, string>> = {};';
if (!source.includes(empty)) {
  console.error(`${sourcePath} does not hold the empty key list any more.`);
  process.exit(1);
}
fs.writeFileSync(
  sourcePath,
  source.replace(
    empty,
    `export const UPDATE_FEED_KEYS: Readonly<Record<string, string>> = {\n  '${keyId}': '${publicBase64}',\n};`,
  ),
);
fs.writeFileSync(
  envPath,
  `${envText.replace(/\n*$/, '\n')}\n# The update feed's private key: never commit, keep a safe copy.\n${FEED_KEY_ID_ENV}=${keyId}\n${FEED_KEY_ENV}=${privateBase64}\n`,
);
console.log(
  `Made update feed key "${keyId}". The public half is in ` +
    'src/main/updateFeedSignature.ts (commit it); the private half is in .env ' +
    '(back it up, never commit it).',
);
