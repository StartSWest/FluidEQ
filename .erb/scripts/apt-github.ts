/** Linux releases must not strand older Windows clients at a shared Latest tag. */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import {
  UPDATE_FEED_KEYS,
  verifyUpdateFeedSignature,
} from '../../src/main/updateFeedSignature';
import {
  RELEASE_REPO,
  releaseAsset,
  assertFeedShape,
  atomicWrite,
  aptSetup,
} from './apt-repository';
import { readFeed } from './sign-update-feed';

const run = (args: string[], cwd?: string) =>
  execFileSync('gh', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
  }).trim();
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const authorizeWindowsMirror = (
  yaml: string,
  name: string,
  bytes: Buffer,
  keys: Readonly<Record<string, string>> = UPDATE_FEED_KEYS,
): string => {
  assertFeedShape(yaml);
  const { version, sha512s } = readFeed(yaml);
  const signature = verifyUpdateFeedSignature(
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
  if (!signature.valid || !version || !Object.keys(keys).length) {
    throw new Error(
      'The existing Windows feed cannot be verified; leave Windows unchanged.',
    );
  }
  if (
    name !== `FluidEQ-Setup-${version}.exe` ||
    !/^\d+\.\d+\.\d+$/.test(version)
  ) {
    throw new Error('Unexpected Windows mirror filename.');
  }
  const entries = Array.from(
    yaml.matchAll(
      /^ {2}- url: ([^\r\n]+)\r?\n {4}sha512: (\S+)\r?\n {4}size: (\d+)\s*$/gm,
    ),
  );
  const matches = entries.filter((entry) => entry[1] === name);
  const [match] = matches;
  if (
    matches.length !== 1 ||
    Number(match[3]) !== bytes.length ||
    match[2] !== createHash('sha512').update(bytes).digest('base64')
  ) {
    throw new Error('Windows mirror bytes differ from its signed feed.');
  }
  return version;
};

export const publishLinuxGitHubRelease = (
  version: string,
  build: string,
  notes: string,
  revision: string,
  root: string,
): void => {
  const response: unknown = JSON.parse(
    run(['api', `repos/${RELEASE_REPO}/releases?per_page=100`]),
  );
  if (!Array.isArray(response)) {
    throw new Error('GitHub did not return releases.');
  }
  const releases: Record<string, unknown>[] = response.filter(object);
  const existing = releases.find((entry) => entry.tag_name === `v${version}`);
  if (existing?.draft) {
    throw new Error('Another publisher owns the existing draft release.');
  }
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), 'fluideq-release-assets-'),
  );
  try {
    const source = path.join(
      temporary,
      `FluidEQ-${version}-linux-source.tar.gz`,
    );
    execFileSync(
      'git',
      [
        'archive',
        '--format=tar.gz',
        `--prefix=FluidEQ-${version}-linux/`,
        '-o',
        source,
        revision,
      ],
      { cwd: root },
    );
    const assets = [
      path.join(build, releaseAsset(version)),
      path.join(build, `FluidEQ-${version}-x86_64.AppImage`),
      path.join(build, 'latest-linux.yml'),
      source,
    ];
    if (existing) {
      const listed = Array.isArray(existing.assets)
        ? existing.assets.filter(object)
        : [];
      assets.forEach((file) => {
        const asset = listed.find(
          (entry) => entry.name === path.basename(file),
        );
        if (!asset) {
          return;
        }
        const expected = createHash('sha256')
          .update(fs.readFileSync(file))
          .digest('hex');
        if (
          typeof asset.digest === 'string' &&
          asset.digest === `sha256:${expected}`
        ) {
          return;
        }
        const previous = path.join(temporary, 'existing', path.basename(file));
        fs.mkdirSync(path.dirname(previous), { recursive: true });
        run([
          'release',
          'download',
          `v${version}`,
          '--repo',
          RELEASE_REPO,
          '--pattern',
          path.basename(file),
          '--output',
          previous,
        ]);
        if (
          createHash('sha256')
            .update(fs.readFileSync(previous))
            .digest('hex') !== expected
        ) {
          throw new Error(
            `Refusing to change published release bytes: ${path.basename(file)}`,
          );
        }
      });
      const missing = assets.filter(
        (file) => !listed.some((asset) => asset.name === path.basename(file)),
      );
      if (missing.length) {
        run([
          'release',
          'upload',
          `v${version}`,
          '--repo',
          RELEASE_REPO,
          ...missing,
        ]);
      }
      const current: unknown = JSON.parse(
        run([
          'release',
          'view',
          `v${version}`,
          '--repo',
          RELEASE_REPO,
          '--json',
          'body',
        ]),
      );
      if (!object(current) || typeof current.body !== 'string') {
        throw new Error('Cannot preserve the existing release notes.');
      }
      if (!current.body.includes(aptSetup())) {
        const combined = path.join(temporary, 'notes.md');
        atomicWrite(
          combined,
          `${current.body.trimEnd()}\n\n${fs.readFileSync(notes, 'utf8')}`,
        );
        run([
          'release',
          'edit',
          `v${version}`,
          '--repo',
          RELEASE_REPO,
          '--notes-file',
          combined,
        ]);
      }
      return;
    }
    // GitHubProvider resolves installers under the selected release's tag,
    // not the feed's version. Copying latest.yml alone breaks older Windows
    // clients. Mirror its unchanged, verified installer and block map too.
    const windows = releases.find(
      (entry) =>
        !entry.draft &&
        !entry.prerelease &&
        Array.isArray(entry.assets) &&
        entry.assets.some(
          (asset: unknown) =>
            object(asset) &&
            typeof asset.name === 'string' &&
            /^FluidEQ-Setup-\d+\.\d+\.\d+\.exe$/.test(asset.name),
        ),
    );
    if (
      !object(windows) ||
      typeof windows.tag_name !== 'string' ||
      !Array.isArray(windows.assets)
    ) {
      throw new Error('No canonical Windows release to preserve.');
    }
    run([
      'release',
      'download',
      windows.tag_name,
      '--repo',
      RELEASE_REPO,
      '--pattern',
      'latest.yml',
      '--dir',
      temporary,
    ]);
    const yaml = fs.readFileSync(path.join(temporary, 'latest.yml'), 'utf8');
    const { version: windowsVersion } = readFeed(yaml);
    if (!windowsVersion) {
      throw new Error('No Windows version in its existing feed.');
    }
    const executable = `FluidEQ-Setup-${windowsVersion}.exe`;
    run([
      'release',
      'download',
      windows.tag_name,
      '--repo',
      RELEASE_REPO,
      '--pattern',
      executable,
      '--dir',
      temporary,
    ]);
    authorizeWindowsMirror(
      yaml,
      executable,
      fs.readFileSync(path.join(temporary, executable)),
    );
    assets.push(
      path.join(temporary, 'latest.yml'),
      path.join(temporary, executable),
    );
    const blockMap = `${executable}.blockmap`;
    if (
      windows.assets.some(
        (asset: unknown) => object(asset) && asset.name === blockMap,
      )
    ) {
      run([
        'release',
        'download',
        windows.tag_name,
        '--repo',
        RELEASE_REPO,
        '--pattern',
        blockMap,
        '--dir',
        temporary,
      ]);
      assets.push(path.join(temporary, blockMap));
    }
    run([
      'release',
      'create',
      `v${version}`,
      '--repo',
      RELEASE_REPO,
      '--target',
      revision,
      '--draft',
      '--title',
      `FluidEQ ${version} for Linux`,
      '--notes-file',
      notes,
      ...assets,
    ]);
    run([
      'release',
      'edit',
      `v${version}`,
      '--repo',
      RELEASE_REPO,
      '--draft=false',
      '--latest',
    ]);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
};
