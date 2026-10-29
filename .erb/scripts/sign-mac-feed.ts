/**
 * Signs `release/build/latest-mac.yml` at the end of `pnpm package:mac:release`.
 *
 * Every Mac copy refuses an update from a feed this key did not sign
 * (`macSelfUpdate.ts`), so a Mac release whose feed cannot be signed is not
 * a release: this fails the build instead. The key is the one Windows and
 * Linux sign with, kept on the Mac in the login Keychain (`mac-feed-key.ts`).
 */

import fs from 'fs';
import path from 'path';
import { UPDATE_FEED_KEYS } from '../../src/main/updateFeedSignature';
import { readMacFeedKey, type IMacKeychain } from './mac-feed-key';
import { signFeed } from './sign-update-feed';
import { signsForTrustedKey } from './update-feed-key';

export const signMacFeed = ({
  feedPath = path.join(__dirname, '../../release/build/latest-mac.yml'),
  keychain,
  keys = UPDATE_FEED_KEYS,
}: {
  feedPath?: string;
  keychain?: IMacKeychain;
  keys?: Readonly<Record<string, string>>;
} = {}): boolean => {
  const key = readMacFeedKey(keychain);
  if (!key) {
    console.error(
      'latest-mac.yml is NOT signed: this Mac holds no update feed key. ' +
        'Run `pnpm mac-feed-key import` with the key from your password manager on the clipboard.',
    );
    return false;
  }
  if (!signsForTrustedKey(key, keys)) {
    console.error(
      `The update feed key "${key.keyId}" is not one this app trusts. Every Mac copy would refuse the update.`,
    );
    return false;
  }
  if (!fs.existsSync(feedPath)) {
    console.error(`${feedPath} is not there; nothing was signed.`);
    return false;
  }
  fs.writeFileSync(
    feedPath,
    signFeed(fs.readFileSync(feedPath, 'utf8'), key.keyId, key.privateKey),
  );
  console.log(`Signed ${feedPath} with update feed key "${key.keyId}".`);
  return true;
};

if (require.main === module) {
  process.exit(signMacFeed() ? 0 : 1);
}
