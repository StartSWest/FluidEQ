/**
 * Makes the update feed's key pair, once, on the maker's machine.
 *
 *   pnpm update-feed-keys
 *
 * Writes the public key into `src/main/updateFeedSignature.ts` and keeps the
 * private key encrypted for this Windows account, outside the project
 * (`update-feed-key-store.ts`); neither is printed. Commit the source file,
 * then `pnpm update-feed-key copy` and paste the key into the password
 * manager — a lost key means installed copies can no longer be updated by
 * any release signed with another. Refuses to replace a key that is already
 * there, and to run while `.env` still holds one.
 */

import fs from 'fs';
import path from 'path';
import { generateKeyPairSync } from 'crypto';
import { UPDATE_FEED_KEYS } from '../../src/main/updateFeedSignature';
import { envHoldsFeedKey } from './sign-update-feed';
import { createFeedKeyStore } from './update-feed-key-store';

const root = path.join(__dirname, '../..');
const envPath = path.join(root, '.env');
const sourcePath = path.join(root, 'src/main/updateFeedSignature.ts');
const store = createFeedKeyStore();

if (
  Object.keys(UPDATE_FEED_KEYS).length > 0 ||
  store.exists() ||
  (fs.existsSync(envPath) && envHoldsFeedKey(fs.readFileSync(envPath, 'utf8')))
) {
  console.error(
    'An update feed key already exists. Replacing it would stop installed ' +
      'copies taking updates signed with it; refusing. To use it on this ' +
      'machine: `pnpm update-feed-key import`.',
  );
  process.exit(1);
}

const source = fs.readFileSync(sourcePath, 'utf8');
const empty =
  'export const UPDATE_FEED_KEYS: Readonly<Record<string, string>> = {};';
if (!source.includes(empty)) {
  console.error(`${sourcePath} does not hold the empty key list any more.`);
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const keyId = `fluideq-feed-${new Date().toISOString().slice(0, 10)}`;
const publicBase64 = publicKey
  .export({ format: 'der', type: 'spki' })
  .toString('base64');

// The private half first: a source that trusts a key nobody holds would
// strand every copy built from it.
store.write({
  keyId,
  privateKey: privateKey
    .export({ format: 'der', type: 'pkcs8' })
    .toString('base64'),
});
fs.writeFileSync(
  sourcePath,
  source.replace(
    empty,
    `export const UPDATE_FEED_KEYS: Readonly<Record<string, string>> = {\n  '${keyId}':\n    '${publicBase64}',\n};`,
  ),
);
console.log(
  `Made update feed key "${keyId}". The public half is in ` +
    'src/main/updateFeedSignature.ts (commit it); the private half is kept ' +
    `encrypted at ${store.filePath}. Now run \`pnpm update-feed-key copy\` ` +
    'and paste it into your password manager.',
);
