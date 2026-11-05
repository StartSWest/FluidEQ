import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { atomicWrite, digest } from './apt-repository';

export const APT_KEY_UID =
  'FluidEQ apt repository <StartSWest@users.noreply.github.com>';
export const gpg = (args: string[]) =>
  execFileSync('gpg', ['--batch', ...args], { encoding: 'utf8' });

/** The owner enters a passphrase in GPG's own prompt, never in chat or argv. */
export const initializeAptKey = (assets: string): void => {
  if (fs.existsSync(path.join(assets, 'key.json'))) {
    throw new Error(
      'An apt key is already configured; refusing an implicit rotation.',
    );
  }
  execFileSync(
    'gpg',
    ['--quick-generate-key', APT_KEY_UID, 'rsa3072', 'sign', '2y'],
    { stdio: 'inherit' },
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
    `${JSON.stringify({ fingerprint }, null, 2)}\n`,
  );
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
    gpg([
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
    ]);
    fs.renameSync(`${destination}.tmp`, destination);
  });
  verifyRepository(directory, publicKey);
};
