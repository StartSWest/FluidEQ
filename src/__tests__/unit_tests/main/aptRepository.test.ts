/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash, generateKeyPairSync } from 'crypto';
import { gunzipSync } from 'zlib';
import {
  authorizeDeb,
  digest,
  retainPackages,
  writeMetadata,
  aptSetup,
  type IAptPackage,
} from '../../../../.erb/scripts/apt-repository';
import { signFeed } from '../../../../.erb/scripts/sign-update-feed';
import { authorizeWindowsMirror } from '../../../../.erb/scripts/apt-github';
import updateLinuxDownloads from '../../../../.erb/scripts/apt-website';

const bytes = Buffer.from(
  'an installer whose identity is fixed by the signed feed',
);
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const keys = {
  test: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
};
const secret = privateKey
  .export({ format: 'der', type: 'pkcs8' })
  .toString('base64');
const unsigned = `version: 2.2.2\nfiles:\n  - url: FluidEQ-2.2.2-amd64.deb\n    sha512: ${createHash('sha512').update(bytes).digest('base64')}\n    size: ${bytes.length}\n`;
const signed = signFeed(unsigned, 'test', secret);
const record = (version: string): IAptPackage => ({
  version,
  filename: `pool/main/f/fluideq/fluideq_${version}_amd64.deb`,
  size: bytes.length,
  sha256: digest(bytes),
  sha512: digest(bytes, 'sha512'),
  control: `Package: fluideq\nVersion: ${version}\nArchitecture: amd64\nDescription: test`,
});

it('authorizes exactly the Debian bytes in the signed Linux feed', () => {
  expect(authorizeDeb(signed, bytes, 'FluidEQ-2.2.2-amd64.deb', keys)).toBe(
    '2.2.2',
  );
  expect(() =>
    authorizeDeb(unsigned, bytes, 'FluidEQ-2.2.2-amd64.deb', keys),
  ).toThrow(/not signed/);
  expect(() =>
    authorizeDeb(signed, bytes, 'FluidEQ-2.2.2-amd64.deb', {}),
  ).toThrow(/trusted/);
});

it('rejects SHA, size, version and trust changes beside the valid control', () => {
  expect(authorizeDeb(signed, bytes, 'FluidEQ-2.2.2-amd64.deb', keys)).toBe(
    '2.2.2',
  );
  const changed = Buffer.from(bytes);
  changed[0] = (changed[0] + 1) % 256;
  expect(() =>
    authorizeDeb(signed, changed, 'FluidEQ-2.2.2-amd64.deb', keys),
  ).toThrow(/SHA-512/);
  expect(() =>
    authorizeDeb(
      signed,
      Buffer.concat([bytes, bytes]),
      'FluidEQ-2.2.2-amd64.deb',
      keys,
    ),
  ).toThrow(/size/);
  expect(() =>
    authorizeDeb(signed, bytes, 'FluidEQ-2.2.3-amd64.deb', keys),
  ).toThrow(/filename/);
  expect(() =>
    authorizeDeb(
      signed.replace('version: 2.2.2', 'version: 2.2.3'),
      bytes,
      'FluidEQ-2.2.3-amd64.deb',
      keys,
    ),
  ).toThrow(/signature/);
  expect(() =>
    authorizeDeb(signed, bytes, 'FluidEQ-2.2.2-amd64.deb', {
      other: keys.test,
    }),
  ).toThrow(/unknown key/);
});

it('keeps older pool versions, permits an identical rerun and refuses replacement bytes', () => {
  const old = record('2.2.2');
  const next = record('2.2.3');
  expect(retainPackages([old], next)).toEqual([old, next]);
  expect(retainPackages([old, next], next)).toEqual([old, next]);
  expect(() => retainPackages([old], { ...old, sha256: 'different' })).toThrow(
    /different package bytes/,
  );
});

it('refuses ambiguous feeds beside the canonical signed positive control', () => {
  expect(authorizeDeb(signed, bytes, 'FluidEQ-2.2.2-amd64.deb', keys)).toBe(
    '2.2.2',
  );
  ['version: 2.2.2', 'files:', 'fluideqFeedKeyId: test'].forEach((extra) => {
    expect(() =>
      authorizeDeb(
        `${signed}${extra}\n`,
        bytes,
        'FluidEQ-2.2.2-amd64.deb',
        keys,
      ),
    ).toThrow(/top-level/);
  });
});

it('preserves Windows only when its unchanged installer matches its existing signed feed', () => {
  const name = 'FluidEQ-Setup-2.2.2.exe';
  const yaml = signFeed(
    unsigned.replace('FluidEQ-2.2.2-amd64.deb', name),
    'test',
    secret,
  );
  expect(authorizeWindowsMirror(yaml, name, bytes, keys)).toBe('2.2.2');
  expect(() => authorizeWindowsMirror(unsigned, name, bytes, keys)).toThrow(
    /cannot be verified/,
  );
  expect(() =>
    authorizeWindowsMirror(yaml, name, Buffer.from('changed'), keys),
  ).toThrow(/differ/);
  expect(() => authorizeWindowsMirror(yaml, name, bytes, {})).toThrow(
    /cannot be verified/,
  );
  expect(() =>
    authorizeWindowsMirror(yaml, 'FluidEQ-Setup-2.2.3.exe', bytes, keys),
  ).toThrow(/filename/);
  expect(() =>
    authorizeWindowsMirror(`${yaml}files:\n`, name, bytes, keys),
  ).toThrow(/top-level/);
});

it('writes real compressed indexes, sizes, content hashes and redirects for every version', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-apt-unit-'));
  try {
    const versions = [record('2.2.2'), record('2.2.3')];
    const distribution = writeMetadata(
      directory,
      versions,
      new Date('2026-10-29T12:00:00Z'),
    );
    const packages = fs.readFileSync(
      path.join(distribution, 'main/binary-amd64/Packages'),
    );
    const compressed = fs.readFileSync(
      path.join(distribution, 'main/binary-amd64/Packages.gz'),
    );
    expect(gunzipSync(compressed)).toEqual(packages);
    const release = fs.readFileSync(path.join(distribution, 'Release'), 'utf8');
    expect(release).toContain(
      ` ${digest(packages)} ${packages.length} main/binary-amd64/Packages\n`,
    );
    expect(release).toContain(
      ` ${digest(compressed)} ${compressed.length} main/binary-amd64/Packages.gz\n`,
    );
    expect(
      fs.readFileSync(
        path.join(
          distribution,
          'main/binary-amd64/by-hash/SHA256',
          digest(packages),
        ),
      ),
    ).toEqual(packages);
    const redirects = fs.readFileSync(
      path.join(directory, 'redirects.txt'),
      'utf8',
    );
    versions.forEach((one) => {
      expect(packages.toString()).toContain(
        `Filename: ${one.filename}\nSize: ${bytes.length}\nSHA256: ${digest(bytes)}`,
      );
      expect(redirects).toContain(
        `/apt/${one.filename} https://github.com/StartSWest/FluidEQ/releases/download/v${one.version}/FluidEQ-${one.version}-amd64.deb 302`,
      );
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

it('keeps the README and emitted setup block identical and scoped to the dedicated key', () => {
  const readme = fs.readFileSync(
    path.resolve(__dirname, '../../../../README.md'),
    'utf8',
  );
  const setup = readme
    .split('<!-- FLUIDEQ_APT_SETUP_START -->')[1]
    .split('```bash\n')[1]
    .split('\n```')[0];
  expect(setup).toBe(aptSetup());
  expect(setup).toContain(
    'Signed-By: /usr/share/keyrings/fluideq-archive-keyring.gpg',
  );
  expect(setup).not.toMatch(/apt-key|trusted=yes|allow-unauthenticated/);
});

it('updates only Linux website downloads, preserves concurrent platform settings and refuses a downgrade', () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'fluideq-apt-site-unit-'),
  );
  try {
    const file = path.join(directory, 'site.config.json');
    const original = {
      version: '9.0.0',
      macVersion: '8.0.0',
      linuxVersion: '2.2.1',
      linuxReleaseUrl: 'old',
      linuxDebUrl: 'old',
      linuxAppImageUrl: 'old',
      linuxDebSize: 'old',
      linuxAppImageSize: 'old',
      linuxDebSha256: 'old',
      linuxAppImageSha256: 'old',
    };
    fs.writeFileSync(file, JSON.stringify(original, null, 2));
    fs.writeFileSync(path.join(directory, 'FluidEQ-2.3.0-amd64.deb'), bytes);
    fs.writeFileSync(
      path.join(directory, 'FluidEQ-2.3.0-x86_64.AppImage'),
      bytes,
    );
    updateLinuxDownloads(directory, '2.3.0', directory);
    const next = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(next).toMatchObject({
      version: original.version,
      macVersion: original.macVersion,
      linuxVersion: '2.3.0',
      linuxDebSha256: digest(bytes).toUpperCase(),
    });
    expect(next.linuxDebUrl).toContain('/v2.3.0/FluidEQ-2.3.0-amd64.deb');
    expect(() => updateLinuxDownloads(directory, '2.2.1', directory)).toThrow(
      /newer Linux/,
    );
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(next);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
