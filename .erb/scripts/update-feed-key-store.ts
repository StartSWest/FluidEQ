/**
 * Where the update feed's private key lives on the maker's machine.
 *
 * Not in `.env`. That file holds build-time values that are public by
 * construction (README, "Build-time configuration"); it gets copied to other
 * clones for test builds and zipped along with the project, and a key in it
 * is a key in plain text wherever the folder goes. The first version of
 * `update-feed-keys.ts` put it there anyway, and that was the mistake this
 * file corrects.
 *
 * The key is kept encrypted with Windows' data protection for the Windows
 * account that made it (DPAPI, CurrentUser scope), in
 * `%APPDATA%\FluidEQ Release\update-feed-key.json` — outside the project, so
 * nothing that copies, commits or packages the project can carry it, and
 * unreadable to another account or on another machine. The password manager
 * holds the copy that survives this machine: `pnpm update-feed-key copy` puts
 * the key on the clipboard for it, and `pnpm update-feed-key import` brings it
 * back onto a new machine from the clipboard.
 *
 * The secret only ever crosses to PowerShell on standard input, never on a
 * command line, where any process can read it.
 *
 * On Linux, where the Linux packages are built and their feed is signed, the
 * same key is kept in the account's keyring instead (`libsecretCipher`).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

export interface IStoredFeedKey {
  keyId: string;
  /** PKCS#8 DER in base64. */
  privateKey: string;
}

export interface IFeedKeyStore {
  readonly filePath: string;
  exists(): boolean;
  read(): IStoredFeedKey | undefined;
  /** Encrypts and writes, then reads it back; throws unless it comes back the same. */
  write(key: IStoredFeedKey): void;
}

export interface IFeedKeyCipher {
  protect(plain: string): string;
  unprotect(protectedText: string): string;
}

const ENTROPY = 'fluideq-update-feed';

const powershell = (script: string, input: string): string =>
  execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { input, encoding: 'utf8', windowsHide: true },
  );

/** DPAPI for the current Windows account, through PowerShell. */
export const dpapiCipher: IFeedKeyCipher = {
  protect: (plain) =>
    powershell(
      [
        'Add-Type -AssemblyName System.Security',
        '$plain = [Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd())',
        `$entropy = [Text.Encoding]::UTF8.GetBytes('${ENTROPY}')`,
        "$sealed = [Security.Cryptography.ProtectedData]::Protect($plain, $entropy, 'CurrentUser')",
        '[Console]::Out.Write([Convert]::ToBase64String($sealed))',
      ].join('; '),
      plain,
    ).trim(),
  unprotect: (protectedText) =>
    powershell(
      [
        'Add-Type -AssemblyName System.Security',
        '$sealed = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())',
        `$entropy = [Text.Encoding]::UTF8.GetBytes('${ENTROPY}')`,
        "$plain = [Security.Cryptography.ProtectedData]::Unprotect($sealed, $entropy, 'CurrentUser')",
        '[Console]::Out.Write([Text.Encoding]::UTF8.GetString($plain))',
      ].join('; '),
      protectedText,
    ),
};

/**
 * What `libsecretCipher` writes into the key file: the key itself is not in
 * it, only where the keyring keeps it.
 */
export const KEYRING_MARK = 'keyring:fluideq-update-feed';

const secretTool = (args: string[], input?: string): string =>
  execFileSync('secret-tool', args, {
    input,
    encoding: 'utf8',
  });

/**
 * The Linux counterpart of DPAPI: the desktop's keyring (GNOME Keyring, or
 * KWallet through its Secret Service), which encrypts for this account and
 * opens with its login, through `secret-tool` (Ubuntu's `libsecret-tools`).
 * The key goes in on standard input, never on a command line, as on Windows,
 * and only the mark naming its entry is written to the key file.
 */
export const libsecretCipher: IFeedKeyCipher = {
  protect: (plain) => {
    secretTool(
      ['store', '--label=FluidEQ update feed key', 'application', ENTROPY],
      plain,
    );
    return KEYRING_MARK;
  },
  unprotect: (protectedText) => {
    if (protectedText !== KEYRING_MARK) {
      throw new Error(
        'This key file was written on Windows; import the key on this machine.',
      );
    }
    const key = secretTool(['lookup', 'application', ENTROPY]).trim();
    if (!key) {
      throw new Error('The keyring holds no update feed key.');
    }
    return key;
  },
};

export const DEFAULT_FEED_KEY_FILE =
  process.platform === 'linux'
    ? path.join(
        process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
        'FluidEQ Release',
        'update-feed-key.json',
      )
    : path.join(
        process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'),
        'FluidEQ Release',
        'update-feed-key.json',
      );

/** Windows' data protection on Windows, the account's keyring on Linux. */
const platformCipher = (): IFeedKeyCipher =>
  process.platform === 'linux' ? libsecretCipher : dpapiCipher;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const createFeedKeyStore = ({
  filePath = DEFAULT_FEED_KEY_FILE,
  cipher = platformCipher(),
}: { filePath?: string; cipher?: IFeedKeyCipher } = {}): IFeedKeyStore => {
  const read = (): IStoredFeedKey | undefined => {
    if (!fs.existsSync(filePath)) {
      return undefined;
    }
    const stored: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (
      !isRecord(stored) ||
      typeof stored.keyId !== 'string' ||
      typeof stored.protectedKey !== 'string'
    ) {
      throw new Error(`${filePath} is not an update feed key file.`);
    }
    return {
      keyId: stored.keyId,
      privateKey: cipher.unprotect(stored.protectedKey),
    };
  };

  return {
    filePath,
    exists: () => fs.existsSync(filePath),
    read,
    write: (key) => {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.tmp`;
      fs.writeFileSync(
        temporaryPath,
        JSON.stringify({
          keyId: key.keyId,
          protectedKey: cipher.protect(key.privateKey),
        }),
        'utf8',
      );
      fs.renameSync(temporaryPath, filePath);
      const back = read();
      if (back?.keyId !== key.keyId || back.privateKey !== key.privateKey) {
        throw new Error(`${filePath} did not read back as written.`);
      }
    },
  };
};
