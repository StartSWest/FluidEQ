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

/**
 * The key typed or pasted at the terminal with nothing echoed, for Linux,
 * where this machine has no clipboard tool to read it from (`wl-paste` and
 * `xclip` are not part of a desktop install) and a key on a command line is
 * readable by every process.
 */
const readHidden = (prompt: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const { stdin } = process;
    if (!stdin.isTTY) {
      reject(
        new Error('Run this in a terminal: the key is pasted at a prompt.'),
      );
      return;
    }
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let typed = '';
    const finish = (error?: Error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stdout.write('\n');
      if (error) {
        reject(error);
      } else {
        resolve(typed);
      }
    };
    const onData = (chunk: string) => {
      // A paste arrives as one chunk, a typed key as several; Enter ends it
      // either way, and Ctrl+C abandons it rather than being read as text.
      if (chunk.includes('\u0003')) {
        finish(new Error('Cancelled.'));
        return;
      }
      const end = chunk.search(/[\r\n]/);
      typed += end === -1 ? chunk : chunk.slice(0, end);
      if (end !== -1) {
        finish();
      }
    };
    stdin.on('data', onData);
  });

/** `import` on Linux: the key at a hidden prompt, kept in the keyring. */
const importOnLinux = async (store: IFeedKeyStore): Promise<number> => {
  let pasted: string;
  try {
    pasted = await readHidden(
      'Paste the update feed key from your password manager, then press Enter: ',
    );
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }
  const outcome = importPastedKey(pasted, store);
  if (!outcome.ok) {
    console.error(outcome.reason);
    return 1;
  }
  console.log(
    `Update feed key "${outcome.keyId}" is kept in this account's keyring; ` +
      `${store.filePath} names it.`,
  );
  return 0;
};

const run = async (command: string | undefined): Promise<number> => {
  const store = createFeedKeyStore();
  if (process.platform === 'linux' && command === 'import') {
    return importOnLinux(store);
  }
  if (process.platform === 'linux' && command === 'copy') {
    console.error(
      'copy runs on Windows, where the key was made; your password manager ' +
        'already holds the copy this machine imports.',
    );
    return 1;
  }
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
  run(process.argv[2])
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
