/**
 * The update feed's private key, between this machine and the password manager.
 *
 *   pnpm update-feed-key copy     the key onto the clipboard, to paste into the
 *                                 password manager as a secure note
 *   pnpm update-feed-key import   the key from the clipboard onto this machine,
 *                                 encrypted for this Windows account; the
 *                                 clipboard is cleared afterwards
 *   pnpm update-feed-key check    whether this machine can sign a release
 *
 * Nothing here prints the key. See `update-feed-key-store.ts` for where it is
 * kept and why not in `.env`.
 */

import { execFileSync } from 'child_process';
import { createPrivateKey, createPublicKey, sign, verify } from 'crypto';
import {
  UPDATE_FEED_KEYS,
  updateFeedMessage,
} from '../../src/main/updateFeedSignature';
import {
  createFeedKeyStore,
  type IFeedKeyStore,
  type IStoredFeedKey,
} from './update-feed-key-store';

/** What `copy` puts on the clipboard: one line, named so it is recognisable. */
export const CLIPBOARD_PREFIX = 'fluideq-update-feed-key:1';

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** The trusted key id whose public half this private key has, if any. */
export const trustedKeyIdOf = (
  privateKey: string,
  keys: Readonly<Record<string, string>> = UPDATE_FEED_KEYS,
): string | undefined => {
  let publicKey: string;
  try {
    publicKey = createPublicKey(
      createPrivateKey({
        key: Buffer.from(privateKey, 'base64'),
        format: 'der',
        type: 'pkcs8',
      }),
    )
      .export({ format: 'der', type: 'spki' })
      .toString('base64');
  } catch {
    return undefined;
  }
  return Object.keys(keys).find((keyId) => keys[keyId] === publicKey);
};

/** The key in what was pasted: this tool's own line, the old `.env` line, or the key alone. */
export const readPastedKey = (text: string): string | undefined => {
  const candidates = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith(`${CLIPBOARD_PREFIX} `)) {
        return line.split(/\s+/)[2] ?? '';
      }
      const legacy = line.match(/^FLUIDEQ_UPDATE_FEED_KEY\s*=\s*(\S+)$/);
      return legacy ? legacy[1] : line;
    })
    .filter((value) => BASE64.test(value) && value.length >= 60);
  return candidates.length === 1 ? candidates[0] : undefined;
};

/** Signs and verifies a throwaway message with the key and the source's public half. */
export const signsForTrustedKey = (
  key: IStoredFeedKey,
  keys: Readonly<Record<string, string>> = UPDATE_FEED_KEYS,
): boolean => {
  if (!Object.prototype.hasOwnProperty.call(keys, key.keyId)) {
    return false;
  }
  const publicKey = keys[key.keyId];
  const message = Buffer.from(updateFeedMessage('0.0.0-check', ['check']));
  try {
    return verify(
      null,
      message,
      createPublicKey({
        key: Buffer.from(publicKey, 'base64'),
        format: 'der',
        type: 'spki',
      }),
      sign(
        null,
        message,
        createPrivateKey({
          key: Buffer.from(key.privateKey, 'base64'),
          format: 'der',
          type: 'pkcs8',
        }),
      ),
    );
  } catch {
    return false;
  }
};

/**
 * The clipboard, with the key kept out of Windows' clipboard history and its
 * sync across devices: a plain copy would sit in Win+V, and with sync on it
 * would be uploaded. These are the formats password managers set for the
 * same reason; `-STA` because the clipboard needs a single-threaded apartment.
 */
const clipboard = {
  write: (text: string) =>
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-STA',
        '-Command',
        [
          'Add-Type -AssemblyName System.Windows.Forms',
          '$data = New-Object System.Windows.Forms.DataObject',
          '$data.SetData([System.Windows.Forms.DataFormats]::UnicodeText, [Console]::In.ReadToEnd())',
          "foreach ($format in 'CanIncludeInClipboardHistory', 'CanUploadToCloudClipboard', 'ExcludeClipboardContentFromMonitorProcessing') { $data.SetData($format, (New-Object System.IO.MemoryStream (, [byte[]](0, 0, 0, 0)))) }",
          '[System.Windows.Forms.Clipboard]::SetDataObject($data, $true)',
        ].join('; '),
      ],
      { input: text, windowsHide: true },
    ),
  read: () =>
    execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard -Raw'],
      { encoding: 'utf8', windowsHide: true },
    ),
  clear: () =>
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-STA',
        '-Command',
        'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::Clear()',
      ],
      { windowsHide: true },
    ),
};

export const importPastedKey = (
  pasted: string,
  store: IFeedKeyStore,
  keys: Readonly<Record<string, string>> = UPDATE_FEED_KEYS,
): { ok: true; keyId: string } | { ok: false; reason: string } => {
  const privateKey = readPastedKey(pasted);
  if (!privateKey) {
    return {
      ok: false,
      reason: 'The clipboard does not hold one update feed key.',
    };
  }
  const keyId = trustedKeyIdOf(privateKey, keys);
  if (!keyId) {
    return {
      ok: false,
      reason:
        'That key is not one this app trusts (src/main/updateFeedSignature.ts).',
    };
  }
  const held = store.read();
  if (held && held.privateKey !== privateKey) {
    return {
      ok: false,
      reason: `${store.filePath} already holds a different key; not replaced.`,
    };
  }
  store.write({ keyId, privateKey });
  return { ok: true, keyId };
};

const run = (command: string | undefined): number => {
  const store = createFeedKeyStore();
  if (command === 'copy') {
    const key = store.read();
    if (!key) {
      console.error(`There is no update feed key at ${store.filePath}.`);
      return 1;
    }
    clipboard.write(`${CLIPBOARD_PREFIX} ${key.keyId} ${key.privateKey}`);
    console.log(
      `Update feed key "${key.keyId}" is on the clipboard. Paste it into your ` +
        'password manager as a secure note, then copy something else over it.',
    );
    return 0;
  }
  if (command === 'import') {
    const outcome = importPastedKey(clipboard.read(), store);
    if (!outcome.ok) {
      console.error(outcome.reason);
      return 1;
    }
    clipboard.clear();
    console.log(
      `Update feed key "${outcome.keyId}" is kept, encrypted for this Windows ` +
        `account, at ${store.filePath}. The clipboard was cleared.`,
    );
    return 0;
  }
  if (command === 'check') {
    const key = store.read();
    const ok = !!key && signsForTrustedKey(key);
    console.log(
      ok
        ? `This machine can sign releases with "${key?.keyId}".`
        : `This machine cannot sign releases: no trusted key at ${store.filePath}.`,
    );
    return ok ? 0 : 1;
  }
  console.error('Usage: pnpm update-feed-key copy | import | check');
  return 1;
};

if (require.main === module) {
  process.exit(run(process.argv[2]));
}
