/** Private repository/Ubuntu checks; never launches FluidEQ or publishes a key. */
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { execFileSync, spawn } from 'child_process';
import { createHash, generateKeyPairSync, randomBytes } from 'crypto';
import assert from 'assert';
import {
  APT_ORIGIN,
  aptSetup,
  atomicWrite,
  authorizeDeb,
  debRecord,
  writeMetadata,
} from './apt-repository';
import { signRepository, verifyRepository } from './apt-signing';
import { signFeed } from './sign-update-feed';

const root = path.resolve(__dirname, '../..');
const app: { version: string } = JSON.parse(
  fs.readFileSync(path.join(root, 'release/app/package.json'), 'utf8'),
);
const built = path.join(
  root,
  'release/build',
  `FluidEQ-${app.version}-amd64.deb`,
);
const images = ['ubuntu:24.04', 'ubuntu:26.04'];

/** Real data archive, changed control version only: a test upgrade, not a release. */
const nextPackage = (
  deb: string,
  version: string,
  directory: string,
): string => {
  const control = path.join(directory, 'control');
  fs.mkdirSync(control);
  execFileSync('dpkg-deb', ['--control', deb, control]);
  const metadata = path.join(control, 'control');
  atomicWrite(
    metadata,
    fs
      .readFileSync(metadata, 'utf8')
      .replace(/^Version: .+$/m, `Version: ${version}`),
  );
  const archive = path.join(directory, 'ar');
  fs.mkdirSync(archive);
  const members = execFileSync('ar', ['t', deb], { encoding: 'utf8' })
    .trim()
    .split('\n');
  const data = members.find((name) => /^data\.tar\./.test(name));
  if (!data) {
    throw new Error('No Debian data archive.');
  }
  atomicWrite(
    path.join(archive, 'debian-binary'),
    execFileSync('ar', ['p', deb, 'debian-binary']),
  );
  atomicWrite(
    path.join(archive, data),
    execFileSync('ar', ['p', deb, data], { maxBuffer: 300 * 1024 * 1024 }),
  );
  execFileSync('tar', [
    '-cJf',
    path.join(archive, 'control.tar.xz'),
    '-C',
    control,
    '.',
  ]);
  const output = path.join(directory, `FluidEQ-${version}-amd64.deb`);
  execFileSync(
    'ar',
    ['qc', `${output}.tmp`, 'debian-binary', 'control.tar.xz', data],
    { cwd: archive },
  );
  fs.renameSync(`${output}.tmp`, output);
  return output;
};

const container = async (image: string, script: string): Promise<string> => {
  const name = `fluideq-apt-check-${process.pid}-${image.replace(':', '-')}`;
  return new Promise((resolve, reject) => {
    const child = spawn(
      'docker',
      [
        'run',
        '--rm',
        '--name',
        name,
        '--network',
        'host',
        '-i',
        image,
        'bash',
        '-s',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let output = '';
    child.stdout.on('data', (bytes: Buffer) => {
      output += bytes.toString();
    });
    child.stderr.on('data', (bytes: Buffer) => {
      output += bytes.toString();
    });
    child.once('error', reject);
    child.once('close', (code) => {
      atomicWrite(
        path.join(os.tmpdir(), `fluideq-apt-${image.replace(':', '-')}.log`),
        output,
      );
      if (code !== 0) {
        reject(
          new Error(
            `${image} apt check failed (${code}):\n${output.slice(-6000)}`,
          ),
        );
      } else if (
        /NO_PUBKEY|BADSIG|EXPKEYSIG|not signed|signature verification failed|Missing Signed-By/i.test(
          output,
        )
      ) {
        reject(new Error(`${image} reported an apt signature warning.`));
      } else {
        resolve(output);
      }
    });
    child.stdin.end(script);
  });
};

const installedCheck = (version: string) => `
test "$(dpkg-query -W -f '\${Version}' fluideq)" = '${version}'
test -d /opt/FluidEQ
test "$(cat /opt/FluidEQ/resources/package-type)" = deb
`;

export const checkLiveApt = async (): Promise<void> => {
  for (let index = 0; index < images.length; index += 1) {
    await container(
      images[index],
      `set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y sudo ca-certificates curl
${aptSetup()}
${installedCheck(app.version)}
`,
    );
    process.stdout.write(
      `${images[index]}: public apt setup/install ${app.version}, no signature warnings\n`,
    );
  }
};

export const checkPrivateApt = async (): Promise<void> => {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), 'fluideq-apt-fixture-'),
  );
  const previousHome = process.env.GNUPGHOME;
  const keyHome = path.join(temporary, 'gpg');
  fs.mkdirSync(keyHome, { mode: 0o700 });
  process.env.GNUPGHOME = keyHome;
  const password = `${randomBytes(32).toString('hex')}\n`;
  let server: http.Server | undefined;
  try {
    // Encrypted, temporary test identity. Never the production trust anchor.
    const uid = 'FluidEQ isolated apt fixture <apt-test@invalid.example>';
    execFileSync(
      'gpg',
      [
        '--batch',
        '--pinentry-mode',
        'loopback',
        '--passphrase-fd',
        '0',
        '--quick-generate-key',
        uid,
        'rsa3072',
        'sign',
        '1d',
      ],
      { input: password, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const listing = execFileSync(
      'gpg',
      ['--batch', '--with-colons', '--list-secret-keys', uid],
      { encoding: 'utf8' },
    );
    const fingerprint = listing
      .split('\n')
      .find((line) => line.startsWith('fpr:'))
      ?.split(':')[9];
    if (!fingerprint) {
      throw new Error('No isolated test fingerprint.');
    }
    const publicKey = path.join(temporary, 'fixture.gpg');
    atomicWrite(
      publicKey,
      execFileSync('gpg', ['--batch', '--export', fingerprint]),
    );
    const warmup = path.join(temporary, 'warmup');
    atomicWrite(warmup, 'test-key cache only');
    execFileSync(
      'gpg',
      [
        '--batch',
        '--pinentry-mode',
        'loopback',
        '--passphrase-fd',
        '0',
        '--detach-sign',
        warmup,
      ],
      { input: password, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const chunks = app.version.split('.').map(Number);
    const newer = `${chunks[0]}.${chunks[1]}.${chunks[2] + 1}`;
    const next = nextPackage(built, newer, temporary);
    const first = debRecord(built, app.version);
    const second = debRecord(next, newer);
    const { publicKey: feedPublic, privateKey } =
      generateKeyPairSync('ed25519');
    const secret = privateKey
      .export({ format: 'der', type: 'pkcs8' })
      .toString('base64');
    const keys = {
      fixture: feedPublic
        .export({ format: 'der', type: 'spki' })
        .toString('base64'),
    };
    [built, next].forEach((file) => {
      const bytes = fs.readFileSync(file);
      const version = file === built ? app.version : newer;
      const feed = signFeed(
        `version: ${version}\nfiles:\n  - url: ${path.basename(file)}\n    sha512: ${createHash('sha512').update(bytes).digest('base64')}\n    size: ${bytes.length}\n`,
        'fixture',
        secret,
      );
      assert.strictEqual(
        authorizeDeb(feed, bytes, path.basename(file), keys),
        version,
      );
    });
    const initial = path.join(temporary, 'initial');
    const updated = path.join(temporary, 'updated');
    writeMetadata(initial, [first]);
    signRepository(initial, fingerprint, publicKey);
    fs.cpSync(initial, updated, { recursive: true });
    writeMetadata(updated, [first, second]);
    signRepository(updated, fingerprint, publicKey);
    verifyRepository(updated, publicKey);
    assert.throws(() =>
      signRepository(
        updated,
        '0000000000000000000000000000000000000000',
        publicKey,
      ),
    );
    verifyRepository(initial, publicKey);
    let active = initial;
    const records = new Map<string, string>([
      [first.filename, built],
      [second.filename, next],
    ]);
    server = http.createServer((request, response) => {
      const address = new URL(request.url ?? '/', 'http://localhost');
      if (request.method === 'POST' && address.pathname === '/advance') {
        active = updated;
        response.end('updated');
        return;
      }
      if (address.pathname === '/github-legacy.deb') {
        response.writeHead(302, {
          Location:
            'https://github.com/StartSWest/FluidEQ/releases/download/v2.2.1/FluidEQ-2.2.1-amd64.deb',
        });
        response.end();
        return;
      }
      const pool = records.get(address.pathname.replace(/^\/apt\//, ''));
      if (pool) {
        response.writeHead(302, { Location: `/files/${path.basename(pool)}` });
        response.end();
        return;
      }
      let file: string | undefined;
      if (address.pathname === '/apt/fluideq-archive-keyring.gpg') {
        file = publicKey;
      } else if (address.pathname.startsWith('/files/')) {
        file = [...records.values()].find(
          (value) => `/files/${path.basename(value)}` === address.pathname,
        );
      } else if (
        /^\/apt\/dists\/stable\/[A-Za-z0-9/_.-]+$/.test(address.pathname) &&
        !address.pathname.includes('..')
      ) {
        file = path.join(active, address.pathname.slice('/apt/'.length));
      }
      if (!file || !fs.existsSync(file)) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, {
        'Content-Length': fs.statSync(file).size,
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(file).pipe(response);
    });
    const listener = server;
    await new Promise<void>((resolve, reject) => {
      listener.once('error', reject);
      listener.listen(0, '127.0.0.1', resolve);
    });
    const bound = server.address();
    if (!bound || typeof bound === 'string') {
      throw new Error('No fixture address.');
    }
    const base = `http://127.0.0.1:${bound.port}`;
    const oldDeb = path.join(root, 'release/build/FluidEQ-2.2.1-amd64.deb');
    const oldHash = createHash('sha256')
      .update(fs.readFileSync(oldDeb))
      .digest('hex');
    for (let index = 0; index < images.length; index += 1) {
      active = initial;
      await container(
        images[index],
        `set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y sudo ca-certificates curl
${aptSetup().split(APT_ORIGIN).join(`${base}/apt`)}
${installedCheck(app.version)}
curl --fail -X POST '${base}/advance'
apt-get update
apt-get upgrade --assume-yes
${installedCheck(newer)}
curl --fail --location '${base}/files/${path.basename(built)}' -o /tmp/older.deb
if apt-get install --assume-yes -- /tmp/older.deb; then echo 'ERROR: stale in-app downgrade succeeded'; exit 1; fi
${installedCheck(newer)}
apt-get install -y --allow-downgrades 'fluideq=${app.version}'
${installedCheck(app.version)}
apt-get purge -y fluideq
/usr/lib/apt/apt-helper download-file '${base}/github-legacy.deb' /tmp/legacy.deb 'SHA256:${oldHash}'
apt-get install -y /tmp/legacy.deb
test "$(dpkg-query -W -f '\${Version}' fluideq-app)" = 2.2.1
useradd -m fixture
mkdir -p /home/fixture/.config/fluideq-app
printf '%s' 'settings survive migration' > /home/fixture/.config/fluideq-app/apt-marker
apt-get install -y fluideq
${installedCheck(newer)}
test "$(cat /home/fixture/.config/fluideq-app/apt-marker)" = 'settings survive migration'
test "$(dpkg-query -W -f '\${db:Status-Status}' fluideq-app)" != installed
`,
      );
      process.stdout.write(
        `${images[index]}: signed install, ${app.version} to ${newer} upgrade, downgrade refusal, old pool retained, GitHub redirect and 2.2.1 migration passed\n`,
      );
    }
  } finally {
    if (server) {
      await new Promise<void>((resolve) => {
        server?.close(() => resolve());
      });
    }
    execFileSync('gpgconf', ['--homedir', keyHome, '--kill', 'gpg-agent']);
    if (previousHome === undefined) {
      delete process.env.GNUPGHOME;
    } else {
      process.env.GNUPGHOME = previousHome;
    }
    fs.rmSync(temporary, { recursive: true, force: true });
  }
};

if (require.main === module) {
  (process.argv.includes('--live') ? checkLiveApt() : checkPrivateApt()).catch(
    (error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    },
  );
}
