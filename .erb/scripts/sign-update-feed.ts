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
 * The private key comes from `.env`, as `FLUIDEQ_UPDATE_FEED_KEY` (PKCS#8 DER
 * in base64) with `FLUIDEQ_UPDATE_FEED_KEY_ID`; `pnpm update-feed-keys` writes
 * both. The two fields are appended to the file as top-level keys, which is
 * how electron-updater hands them to the app with the rest of the update.
 */

import fs from 'fs';
import path from 'path';
import { createPrivateKey, sign } from 'crypto';
import loadDotenv from './load-dotenv';
import {
  FEED_KEY_FIELD,
  FEED_SIGNATURE_FIELD,
  UPDATE_FEED_KEYS,
  updateFeedMessage,
} from '../../src/main/updateFeedSignature';

export const FEED_KEY_ENV = 'FLUIDEQ_UPDATE_FEED_KEY';
export const FEED_KEY_ID_ENV = 'FLUIDEQ_UPDATE_FEED_KEY_ID';

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
export const signReleaseFeed = (
  feedPath = path.join(__dirname, '../../release/build/latest.yml'),
): boolean => {
  loadDotenv();
  const keyId = process.env[FEED_KEY_ID_ENV];
  const privateKey = process.env[FEED_KEY_ENV];
  const required = Object.keys(UPDATE_FEED_KEYS).length > 0;

  if (!keyId || !privateKey) {
    const message = `latest.yml is NOT signed: ${FEED_KEY_ENV} and ${FEED_KEY_ID_ENV} are not set.`;
    if (required && !process.env.CI) {
      console.error(
        `${message}
This app trusts update feed keys, so every installed copy ` +
          'would refuse this update. Do not ship it: build on the machine whose ' +
          '.env holds the key, or restore that .env from its backup.',
      );
      return false;
    }
    console.warn(message);
    return true;
  }
  if (
    required &&
    !Object.prototype.hasOwnProperty.call(UPDATE_FEED_KEYS, keyId)
  ) {
    console.error(
      `${FEED_KEY_ID_ENV} is "${keyId}", which this app does not trust. ` +
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
