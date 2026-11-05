import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { randomBytes } from 'crypto';
import { atomicWrite, digest } from './apt-repository';
import {
  createAptPassphraseStore,
  type IAptPassphraseStore,
} from './apt-passphrase';

export const APT_KEY_UID =
  'FluidEQ apt repository <StartSWest@users.noreply.github.com>';
export const gpg = (args: string[]) =>
  execFileSync('gpg', ['--batch', ...args], { encoding: 'utf8' });

/** Neither secret reaches argv, environment, the checkout, logs or the user. */
export const initializeAptKey = (
  assets: string,
  store: IAptPassphraseStore = createAptPassphraseStore(),
): void => {
  if (fs.existsSync(path.join(assets, 'key.json'))) {
    throw new Error(
      'An apt key is already configured; refusing an implicit rotation.',
    );
  }
  // A failed export can leave a dedicated key behind. Never create a second
  // identity or rotate it implicitly just because its public config is absent.
  const existing = execFileSync(
    'gpg',
    ['--batch', '--with-colons', '--list-secret-keys'],
    { encoding: 'utf8' },
  );
  if (
    existing
      .split('\n')
      .some(
        (line) => line.startsWith('uid:') && line.split(':')[9] === APT_KEY_UID,
      )
  ) {
    throw new Error(
      'The dedicated apt key already exists; refusing to create a replacement.',
    );
  }
  const secret = store.read() ?? randomBytes(32).toString('hex');
  store.write(secret);
  execFileSync(
    'gpg',
    [
      '--batch',
      '--pinentry-mode',
      'loopback',
      '--passphrase-fd',
      '0',
      '--quick-generate-key',
      APT_KEY_UID,
      'rsa3072',
      'sign',
      '2y',
    ],
    { input: `${secret}\n`, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const listing = gpg(['--with-colons', '--list-secret-keys', APT_KEY_UID]);
  const fingerprints = listing
    .split('\n')
    .filter((line) => line.startsWith('fpr:'))
    .map((line) => line.split(':')[9]);
  if (fingerprints.length !== 1 || !/^[A-F0-9]{40}$/.test(fingerprints[0])) {
    throw new Error('Expected exactly one dedicated apt signing key.');
  }
  const fingerprint = fingerprints[0];
  const publicKey = execFileSync('gpg', ['--batch', '--export', fingerprint]);
  atomicWrite(path.join(assets, 'fluideq-archive-keyring.gpg'), publicKey);
  atomicWrite(
    path.join(assets, 'fluideq-archive-keyring.asc'),
    gpg(['--armor', '--export', fingerprint]),
  );
  atomicWrite(
    path.join(assets, 'key.json'),
    `${JSON.stringify({ fingerprint, protection: 'secret-service' }, null, 2)}\n`,
  );
};

const signWithAptKey = (args: string[], fingerprint: string) => {
  const configPath = path.resolve(__dirname, '../../assets/apt/key.json');
  const config: unknown = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : undefined;
  if (
    typeof config === 'object' &&
    config !== null &&
    'fingerprint' in config &&
    config.fingerprint === fingerprint &&
    'protection' in config &&
    config.protection === 'secret-service'
  ) {
    const secret = createAptPassphraseStore().read();
    if (!secret) {
      throw new Error(
        'The login keyring has no passphrase for this protected apt key.',
      );
    }
    // stdin is reserved for the passphrase; the Release is a separate file.
    // Capture and discard subprocess errors, which can include stdout buffers.
    try {
      return execFileSync(
        'gpg',
        [
          '--batch',
          '--pinentry-mode',
          'loopback',
          '--passphrase-fd',
          '0',
          ...args,
        ],
        {
          input: `${secret}\n`,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
    } catch {
      throw new Error(
        'Signing with the protected apt key failed. No unsigned repository was published.',
      );
    }
  }
  // Isolated signing fixtures and pre-existing manually protected keys use
  // GPG's normal agent. They never read the production passphrase entry.
  return gpg(args);
};

export const signingFingerprint = (assets: string): string => {
  const config: unknown = JSON.parse(
    fs.readFileSync(path.join(assets, 'key.json'), 'utf8'),
  );
  if (
    typeof config !== 'object' ||
    config === null ||
    !('fingerprint' in config) ||
    typeof config.fingerprint !== 'string' ||
    !/^[A-F0-9]{40}$/.test(config.fingerprint)
  ) {
    throw new Error(
      'No valid dedicated apt signing fingerprint. Run pnpm publish:apt --init-key in a terminal.',
    );
  }
  return config.fingerprint;
};

export const verifyRepository = (
  directory: string,
  publicKey: string,
): void => {
  const distribution = path.join(directory, 'dists/stable');
  // gpgv does not consult the user's other trusted keys.
  execFileSync(
    'gpgv',
    [
      '--keyring',
      path.resolve(publicKey),
      path.join(distribution, 'Release.gpg'),
      path.join(distribution, 'Release'),
    ],
    { stdio: 'pipe' },
  );
  const cleartext = execFileSync(
    'gpgv',
    [
      '--keyring',
      path.resolve(publicKey),
      '--output',
      '-',
      path.join(distribution, 'InRelease'),
    ],
    { stdio: 'pipe', encoding: 'utf8' },
  );
  const release = fs.readFileSync(path.join(distribution, 'Release'), 'utf8');
  if (cleartext !== release) {
    throw new Error('The two signed Release documents differ.');
  }
  [
    'main/binary-amd64/Packages',
    'main/binary-amd64/Packages.gz',
    'repository.json',
  ].forEach((relative) => {
    const bytes = fs.readFileSync(path.join(distribution, relative));
    if (!release.includes(` ${digest(bytes)} ${bytes.length} ${relative}\n`)) {
      throw new Error(`Repository checksum differs: ${relative}`);
    }
  });
};

export const signRepository = (
  directory: string,
  fingerprint: string,
  publicKey: string,
): void => {
  const distribution = path.join(directory, 'dists/stable');
  [
    ['InRelease', '--clearsign'],
    ['Release.gpg', '--detach-sign'],
  ].forEach(([name, mode]) => {
    const destination = path.join(distribution, name);
    signWithAptKey(
      [
        '--yes',
        '--local-user',
        fingerprint,
        '--digest-algo',
        'SHA256',
        '--armor',
        '--output',
        `${destination}.tmp`,
        mode,
        path.join(distribution, 'Release'),
      ],
      fingerprint,
    );
    fs.renameSync(`${destination}.tmp`, destination);
  });
  verifyRepository(directory, publicKey);
};
