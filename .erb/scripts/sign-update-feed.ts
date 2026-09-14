/**
 * Signs `release/build/latest.yml` at the end of `pnpm package`.
 *
 * The app refuses an update whose feed it cannot verify once it carries a key
 * (see `src/main/updateFeedSignature.ts`). So once `UPDATE_FEED_KEYS` holds
 * one, a package that cannot sign its feed is not a release — it would be
 * refused by every installed copy — and this fails the build. On CI, which
 * publishes nothing and holds no private key, it says so and lets the build
 * finish.
 *
 * The private key comes from the encrypted key file outside the project
 * (`update-feed-key-store.ts`), never from `.env`: a key found there is
 * refused, so it cannot quietly go back to where it was in plain text. The
 * two fields are appended to the file as top-level keys, which is how
 * electron-updater hands them to the app with the rest of the update.
 */

import fs from 'fs';
import path from 'path';
import { createPrivateKey, sign } from 'crypto';
import {
  FEED_KEY_FIELD,
  FEED_SIGNATURE_FIELD,
  UPDATE_FEED_KEYS,
  updateFeedMessage,
} from '../../src/main/updateFeedSignature';
import {
  createFeedKeyStore,
  type IFeedKeyStore,
  type IStoredFeedKey,
} from './update-feed-key-store';

/** The name the key had in `.env` before it moved out; refused wherever it appears. */
export const LEGACY_FEED_KEY_ENV = 'FLUIDEQ_UPDATE_FEED_KEY';

/** Whether `.env` text still holds the private key in plain text. */
export const envHoldsFeedKey = (envText: string): boolean =>
  new RegExp(`^\\s*${LEGACY_FEED_KEY_ENV}\\s*=`, 'm').test(envText);

/** The version and every SHA-512 in a `latest.yml`, read without a YAML library. */
export const readFeed = (yaml: string) => {
  const version = yaml.match(/^version:\s*['"]?([^'"\s]+)['"]?\s*$/m)?.[1];
  const sha512s = Array.from(
    yaml.matchAll(/^\s*(?:-\s*)?sha512:\s*['"]?([A-Za-z0-9+/=]+)['"]?\s*$/gm),
    (match) => match[1],
  );
  return { version, sha512s };
};

/** The feed with its signature appended, replacing any it already had. */
export const signFeed = (
  yaml: string,
  keyId: string,
  privateKeyBase64: string,
): string => {
  const { version, sha512s } = readFeed(yaml);
  if (!version || sha512s.length === 0) {
    throw new Error('latest.yml has no version or no sha512 to sign.');
  }
  const signature = sign(
    null,
    Buffer.from(updateFeedMessage(version, sha512s)),
    createPrivateKey({
      key: Buffer.from(privateKeyBase64, 'base64'),
      format: 'der',
      type: 'pkcs8',
    }),
  ).toString('base64');
  const unsigned = yaml
    .split(/\r?\n/)
    .filter(
      (line) =>
        !line.startsWith(`${FEED_SIGNATURE_FIELD}:`) &&
        !line.startsWith(`${FEED_KEY_FIELD}:`),
    )
    .join('\n')
    .replace(/\n*$/, '\n');
  return `${unsigned}${FEED_KEY_FIELD}: ${keyId}\n${FEED_SIGNATURE_FIELD}: ${signature}\n`;
};

/**
 * Signs the built `latest.yml`, saying why not when it cannot. False when the
 * build must not be shipped: this app trusts a feed key and the feed could
 * not be signed with it.
 */
export const signReleaseFeed = ({
  feedPath = path.join(__dirname, '../../release/build/latest.yml'),
  store = createFeedKeyStore(),
  envPath = path.join(__dirname, '../../.env'),
  keys = UPDATE_FEED_KEYS,
}: {
  feedPath?: string;
  store?: IFeedKeyStore;
  envPath?: string;
  keys?: Readonly<Record<string, string>>;
} = {}): boolean => {
  const required = Object.keys(keys).length > 0;

  if (
    fs.existsSync(envPath) &&
    envHoldsFeedKey(fs.readFileSync(envPath, 'utf8'))
  ) {
    console.error(
      `${envPath} holds the update feed's private key in plain text. Keep ` +
        'a copy in your password manager, bring it in with ' +
        '`pnpm update-feed-key import`, and delete those lines from .env.',
    );
    return false;
  }

  let key: IStoredFeedKey | undefined;
  try {
    key = store.read();
  } catch (error) {
    console.error(
      `The update feed key at ${store.filePath} could not be read: ` +
        `${(error as Error).message}`,
    );
    return false;
  }

  if (!key) {
    const message = `latest.yml is NOT signed: there is no update feed key at ${store.filePath}.`;
    if (required && !process.env.CI) {
      console.error(
        `${message}
This app trusts update feed keys, so every installed copy ` +
          'would refuse this update. Do not ship it: bring the key onto this ' +
          'machine from your password manager with `pnpm update-feed-key import`.',
      );
      return false;
    }
    console.warn(message);
    return true;
  }
  const { keyId, privateKey } = key;
  if (required && !Object.prototype.hasOwnProperty.call(keys, keyId)) {
    console.error(
      `The update feed key "${keyId}" is not one this app trusts. ` +
        'Every installed copy would refuse the update.',
    );
    return false;
  }
  if (!fs.existsSync(feedPath)) {
    console.error(`${feedPath} is not there; nothing was signed.`);
    return false;
  }
  fs.writeFileSync(
    feedPath,
    signFeed(fs.readFileSync(feedPath, 'utf8'), keyId, privateKey),
  );
  console.log(`Signed ${feedPath} with update feed key "${keyId}".`);
  return true;
};

if (require.main === module) {
  process.exit(signReleaseFeed() ? 0 : 1);
}
