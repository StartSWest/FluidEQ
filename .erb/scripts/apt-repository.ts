/** Debian metadata is generated from the same signed installer the app accepts. */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { gzipSync } from 'zlib';
import {
  LINUX_UPDATE_FEED_KEYS,
  verifyUpdateFeedSignature,
} from '../../src/main/updateFeedSignature';
import { readFeed } from './sign-update-feed';

export const APT_ORIGIN = 'https://fluideq.com/apt';
export const FIRST_APT_VERSION = '2.3.0';
export const RELEASE_REPO = 'StartSWest/FluidEQ';
export interface IAptPackage {
  version: string;
  filename: string;
  size: number;
  sha256: string;
  sha512: string;
  control: string;
}

export const atomicWrite = (file: string, contents: string | Buffer): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, contents);
  fs.renameSync(temporary, file);
};
export const digest = (contents: Buffer | string, algorithm = 'sha256') =>
  createHash(algorithm).update(contents).digest('hex');

export const releaseAsset = (version: string) => {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('apt releases require a stable three-part version.');
  }
  return `FluidEQ-${version}-amd64.deb`;
};
export const packageUrl = (record: IAptPackage) =>
  `https://github.com/${RELEASE_REPO}/releases/download/v${record.version}/${releaseAsset(record.version)}`;

/** Reject ambiguous YAML rather than disagree with the updater's YAML reader. */
export const assertFeedShape = (yaml: string): void => {
  const topLevel = yaml.split(/\r?\n/).filter((line) => /^[^\s#]/.test(line));
  const names = topLevel.map(
    (line) => line.match(/^([A-Za-z][A-Za-z0-9]*):/)?.[1],
  );
  if (names.includes(undefined) || new Set(names).size !== names.length) {
    throw new Error('Duplicate or noncanonical top-level feed fields.');
  }
};

/** Only the narrow, deterministic YAML emitted by our pinned builder is read. */
export const authorizeDeb = (
  yaml: string,
  bytes: Buffer,
  name: string,
  keys: Readonly<Record<string, string>> = LINUX_UPDATE_FEED_KEYS,
): string => {
  assertFeedShape(yaml);
  const { version, sha512s } = readFeed(yaml);
  const verification = verifyUpdateFeedSignature(
    {
      version,
      files: sha512s.map((sha512) => ({ sha512 })),
      fluideqFeedKeyId: yaml.match(/^fluideqFeedKeyId: (\S+)\s*$/m)?.[1],
      fluideqFeedSignature: yaml.match(
        /^fluideqFeedSignature: (\S+)\s*$/m,
      )?.[1],
    },
    keys,
  );
  if (!verification.valid || !version || Object.keys(keys).length === 0) {
    throw new Error(
      `Refusing apt publication: ${verification.reason ?? 'no trusted Linux feed key'}`,
    );
  }
  if (name !== releaseAsset(version)) {
    throw new Error(
      'The Debian filename differs from the signed release version.',
    );
  }
  const entries = Array.from(
    yaml.matchAll(
      /^ {2}- url: ([^\r\n]+)\r?\n {4}sha512: (\S+)\r?\n {4}size: (\d+)\s*$/gm,
    ),
  );
  const debs = entries.filter((entry) => entry[1] === name);
  if (debs.length !== 1) {
    throw new Error(
      'The signed Linux feed must name this Debian installer once.',
    );
  }
  const entry = debs[0];
  if (
    Number(entry[3]) !== bytes.length ||
    createHash('sha512').update(bytes).digest('base64') !== entry[2]
  ) {
    throw new Error(
      'The Debian size/SHA-512 differs from the signed Linux feed.',
    );
  }
  return version;
};

export const debRecord = (file: string, version: string): IAptPackage => {
  const control = execFileSync('dpkg-deb', ['--field', file], {
    encoding: 'utf8',
  });
  const field = (name: string) =>
    control.match(new RegExp(`^${name}: (.+)$`, 'm'))?.[1];
  if (
    field('Package') !== 'fluideq' ||
    field('Architecture') !== 'amd64' ||
    field('Version') !== version
  ) {
    throw new Error(
      'Expected the signed amd64 fluideq package at the feed version.',
    );
  }
  [
    ['Provides', 'fluideq-app'],
    ['Replaces', `fluideq-app (<< ${FIRST_APT_VERSION})`],
    ['Breaks', `fluideq-app (<< ${FIRST_APT_VERSION})`],
  ].forEach(([name, value]) => {
    if (field(name) !== value) {
      throw new Error(`Debian migration field ${name} must be ${value}.`);
    }
  });
  const bytes = fs.readFileSync(file);
  return {
    version,
    filename: `pool/main/f/fluideq/fluideq_${version}_amd64.deb`,
    size: bytes.length,
    sha256: digest(bytes),
    sha512: digest(bytes, 'sha512'),
    control: control.trimEnd(),
  };
};

export const retainPackages = (
  previous: IAptPackage[],
  current: IAptPackage,
): IAptPackage[] => {
  const existing = previous.find(
    (record) => record.version === current.version,
  );
  // Release assets are immutable: a rebuilt version would split apt and the app.
  if (existing && JSON.stringify(existing) !== JSON.stringify(current)) {
    throw new Error(
      'This version was already published with different package bytes.',
    );
  }
  return [
    ...previous.filter((record) => record.version !== current.version),
    current,
  ].sort((a, b) => a.version.localeCompare(b.version, 'en', { numeric: true }));
};

export const writeMetadata = (
  directory: string,
  records: IAptPackage[],
  now = new Date(),
): string => {
  const distribution = path.join(directory, 'dists/stable');
  const packages = records
    .map((record) => {
      if (
        !record.control.startsWith('Package: fluideq\n') &&
        !record.control.includes('\nPackage: fluideq\n')
      ) {
        throw new Error('Only fluideq is permitted in this repository.');
      }
      releaseAsset(record.version);
      if (
        record.filename !==
        `pool/main/f/fluideq/fluideq_${record.version}_amd64.deb`
      ) {
        throw new Error('Invalid apt pool path.');
      }
      return `${record.control}\nFilename: ${record.filename}\nSize: ${record.size}\nSHA256: ${record.sha256}\nSHA512: ${record.sha512}\n`;
    })
    .join('\n');
  const files: Record<string, Buffer> = {
    'main/binary-amd64/Packages': Buffer.from(packages),
    'main/binary-amd64/Packages.gz': gzipSync(packages, { level: 9 }),
    'repository.json': Buffer.from(`${JSON.stringify(records, null, 2)}\n`),
  };
  Object.entries(files).forEach(([relative, bytes]) => {
    atomicWrite(path.join(distribution, relative), bytes);
    if (relative.includes('/Packages')) {
      atomicWrite(
        path.join(
          distribution,
          path.dirname(relative),
          'by-hash/SHA256',
          digest(bytes),
        ),
        bytes,
      );
    }
  });
  const expiration = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const release = [
    'Origin: FluidEQ',
    'Label: FluidEQ',
    'Suite: stable',
    'Codename: stable',
    `Date: ${now.toUTCString()}`,
    `Valid-Until: ${expiration.toUTCString()}`,
    'Architectures: amd64',
    'Components: main',
    'Acquire-By-Hash: yes',
    'Description: FluidEQ for Ubuntu and Debian',
    'SHA256:',
    ...Object.entries(files).map(
      ([name, bytes]) => ` ${digest(bytes)} ${bytes.length} ${name}`,
    ),
    'SHA512:',
    ...Object.entries(files).map(
      ([name, bytes]) => ` ${digest(bytes, 'sha512')} ${bytes.length} ${name}`,
    ),
    '',
  ].join('\n');
  atomicWrite(path.join(distribution, 'Release'), release);
  const redirects = records
    .map((record) => `/apt/${record.filename} ${packageUrl(record)} 302`)
    .join('\n');
  atomicWrite(path.join(directory, 'redirects.txt'), `${redirects}\n`);
  atomicWrite(
    path.join(directory, 'pool/main/f/fluideq/index.txt'),
    `${records.map(packageUrl).join('\n')}\n`,
  );
  return distribution;
};

/** One block is emitted into README/release notes/site, so setup cannot drift. */
export const aptSetup = () => `sudo apt install -y ca-certificates curl
tmp=$(mktemp -d)
curl --fail --location ${APT_ORIGIN}/fluideq-archive-keyring.gpg -o "$tmp/fluideq-archive-keyring.gpg"
printf '%s\\n' 'Types: deb' 'URIs: ${APT_ORIGIN}' 'Suites: stable' 'Components: main' 'Architectures: amd64' 'Signed-By: /usr/share/keyrings/fluideq-archive-keyring.gpg' > "$tmp/fluideq.sources"
sudo install -m 0644 "$tmp/fluideq-archive-keyring.gpg" /usr/share/keyrings/fluideq-archive-keyring.gpg.tmp
sudo mv /usr/share/keyrings/fluideq-archive-keyring.gpg.tmp /usr/share/keyrings/fluideq-archive-keyring.gpg
sudo install -m 0644 "$tmp/fluideq.sources" /etc/apt/sources.list.d/fluideq.sources.tmp
sudo mv /etc/apt/sources.list.d/fluideq.sources.tmp /etc/apt/sources.list.d/fluideq.sources
rm -r "$tmp"
sudo apt update && sudo apt install fluideq`;
