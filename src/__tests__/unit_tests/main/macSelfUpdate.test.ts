/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A Mac updates itself from a feed the maker signed, never from one that is
 * merely on GitHub. Each refusal below sits beside the same case with the
 * one thing changed, so "refused" cannot pass by refusing everything.
 */

import { createHash, generateKeyPairSync, sign } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  bundleOf,
  isNewerVersion,
  newestMacRelease,
  parseMacFeed,
  setUpMacSelfUpdates,
  type IMacSelfUpdateDeps,
} from '../../../main/macSelfUpdate';
import {
  FEED_KEY_FIELD,
  FEED_SIGNATURE_FIELD,
  updateFeedMessage,
} from '../../../main/updateFeedSignature';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const KEYS = {
  'test-key': publicKey
    .export({ format: 'der', type: 'spki' })
    .toString('base64'),
};

const ZIP_BYTES = Buffer.from('a FluidEQ 2.3.0 zip');
const zipSha = createHash('sha512').update(ZIP_BYTES).digest('base64');

const feedText = ({
  version = '2.3.0',
  sha512 = zipSha,
  signed = true,
}: { version?: string; sha512?: string; signed?: boolean } = {}) => {
  const body = [
    `version: ${version}`,
    'files:',
    `  - url: FluidEQ-${version}-arm64-mac.zip`,
    `    sha512: ${sha512}`,
    `    size: ${ZIP_BYTES.length}`,
    `  - url: FluidEQ-${version}-arm64.dmg`,
    '    sha512: dmgsha',
    '    size: 9',
    `path: FluidEQ-${version}-arm64-mac.zip`,
    `sha512: ${sha512}`,
    "releaseDate: '2026-10-29T22:31:00.000Z'",
  ];
  if (signed) {
    const signature = sign(
      null,
      Buffer.from(updateFeedMessage(version, [sha512, 'dmgsha'])),
      privateKey,
    ).toString('base64');
    body.push(
      `${FEED_KEY_FIELD}: test-key`,
      `${FEED_SIGNATURE_FIELD}: ${signature}`,
    );
  }
  return `${body.join('\n')}\n`;
};

const DOWNLOADS = 'https://github.com/StartSWest/FluidEQ/releases/download';

/** GitHub's release list, newest first: a Linux release, then the Mac one. */
const releasesJson = (version = '2.3.0') =>
  JSON.stringify([
    {
      draft: false,
      prerelease: false,
      assets: [
        {
          name: 'latest-linux.yml',
          browser_download_url: `${DOWNLOADS}/v9.9.9/latest-linux.yml`,
        },
      ],
    },
    {
      draft: false,
      prerelease: false,
      assets: [
        {
          name: 'latest-mac.yml',
          browser_download_url: `${DOWNLOADS}/mac-v${version}/latest-mac.yml`,
        },
        {
          name: `FluidEQ-${version}-arm64-mac.zip`,
          browser_download_url: `${DOWNLOADS}/mac-v${version}/FluidEQ-${version}-arm64-mac.zip`,
        },
      ],
    },
  ]);

let root: string;
let bundle: string;

const writeApp = (app: string, version: string) => {
  fs.mkdirSync(path.join(app, 'Contents', 'MacOS'), { recursive: true });
  fs.writeFileSync(
    path.join(app, 'Contents', 'Info.plist'),
    JSON.stringify({ id: 'com.fluideq.app', version }),
  );
  fs.writeFileSync(path.join(app, 'Contents', 'MacOS', 'FluidEQ'), version);
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mac-update-'));
  bundle = path.join(root, 'FluidEQ.app');
  writeApp(bundle, '2.2.0');
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

/** Deps over a real folder, with the system tools played by the test. */
const depsFor = (
  overrides: Partial<IMacSelfUpdateDeps> & {
    feed?: string;
    unzipped?: string;
  } = {},
) => {
  const { feed = feedText(), unzipped = '2.3.0', ...rest } = overrides;
  const sent: unknown[] = [];
  let onQuit: (() => void) | undefined;
  // The download runs on after a check has answered; this settles when it is
  // verified (a ready status) or refused (an error logged).
  let finish: () => void = () => undefined;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const deps: IMacSelfUpdateDeps = {
    executablePath: path.join(bundle, 'Contents', 'MacOS', 'FluidEQ'),
    currentVersion: '2.2.0',
    isPackaged: true,
    platform: 'darwin',
    arch: 'arm64',
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(() => finish()),
    },
    sendStatus: (payload) => {
      sent.push(payload);
      if (payload.phase === 'ready') {
        finish();
      }
    },
    fetchText: jest.fn(async (url: string) =>
      url.startsWith('https://api.github.com/') ? releasesJson() : feed,
    ),
    download: jest.fn(async (_url, file, onBytes) => {
      fs.writeFileSync(file, ZIP_BYTES);
      onBytes(ZIP_BYTES.length, ZIP_BYTES.length);
    }),
    run: jest.fn(async (tool: string, args: readonly string[]) => {
      if (tool === '/usr/bin/plutil') {
        const plist = JSON.parse(
          fs.readFileSync(args[args.length - 1], 'utf8'),
        );
        return args[1] === 'CFBundleIdentifier' ? plist.id : plist.version;
      }
      if (tool === '/usr/bin/ditto') {
        writeApp(path.join(args[args.length - 1], 'FluidEQ.app'), unzipped);
      }
      return '';
    }),
    canWrite: async () => true,
    onQuit: (listener) => {
      onQuit = listener;
    },
    relaunch: jest.fn(),
    quit: jest.fn(),
    feedKeys: KEYS,
    ...rest,
  };
  return { deps, sent, finished, runQuit: () => onQuit?.() };
};

/** The setup, and the first check it starts, settled. */
const setUp = async (deps: IMacSelfUpdateDeps) => {
  const updater = await setUpMacSelfUpdates(deps);
  await updater?.checkNow();
  return updater;
};

describe('reading the feed', () => {
  it('reads electron-builder’s latest-mac.yml', () => {
    const info = parseMacFeed(feedText());
    expect(info.version).toBe('2.3.0');
    expect(info.files).toEqual([
      {
        url: 'FluidEQ-2.3.0-arm64-mac.zip',
        sha512: zipSha,
        size: ZIP_BYTES.length,
      },
      { url: 'FluidEQ-2.3.0-arm64.dmg', sha512: 'dmgsha', size: 9 },
    ]);
    expect(info[FEED_KEY_FIELD]).toBe('test-key');
  });

  it.each([
    ['2.3.0', '2.2.0', true],
    ['2.10.0', '2.9.9', true],
    ['2.2.0', '2.2.0', false],
    ['2.1.9', '2.2.0', false],
    ['nonsense', '2.2.0', false],
  ])('%s is newer than %s: %s', (candidate, current, newer) => {
    expect(isNewerVersion(candidate, current)).toBe(newer);
  });

  it('finds the bundle from the executable inside it', () => {
    expect(bundleOf('/Applications/FluidEQ.app/Contents/MacOS/FluidEQ')).toBe(
      '/Applications/FluidEQ.app',
    );
    expect(bundleOf('/usr/local/bin/fluideq')).toBeUndefined();
  });
});

describe('finding the Mac release', () => {
  it('takes the newest release with a Mac feed, past a newer Linux one', () => {
    expect(newestMacRelease(releasesJson())?.feedUrl).toBe(
      `${DOWNLOADS}/mac-v2.3.0/latest-mac.yml`,
    );
  });

  it('skips drafts, prereleases and links that are not this repository’s', () => {
    // Each skipped one carries a higher version than the one taken, so a
    // check that let it through would pick it.
    const release = (
      tag: string,
      version: string,
      { draft = false, prerelease = false, host = DOWNLOADS } = {},
    ) => ({
      draft,
      prerelease,
      assets: [
        {
          name: 'latest-mac.yml',
          browser_download_url: `${host}/${tag}/latest-mac.yml`,
        },
        {
          name: `FluidEQ-${version}-arm64-mac.zip`,
          browser_download_url: `${host}/${tag}/FluidEQ-${version}-arm64-mac.zip`,
        },
      ],
    });
    const json = JSON.stringify([
      release('a', '9.0.0', { draft: true }),
      release('b', '9.0.0', { prerelease: true }),
      release('x', '9.0.0', { host: 'https://example.com/releases/download' }),
      release('c', '2.3.0'),
    ]);
    expect(newestMacRelease(json)?.feedUrl).toBe(
      `${DOWNLOADS}/c/latest-mac.yml`,
    );
  });

  it('takes the highest Mac version, not the first release listed', () => {
    const release = (tag: string, version: string) => ({
      draft: false,
      prerelease: false,
      assets: [
        {
          name: 'latest-mac.yml',
          browser_download_url: `${DOWNLOADS}/${tag}/latest-mac.yml`,
        },
        {
          name: `FluidEQ-${version}-arm64-mac.zip`,
          browser_download_url: `${DOWNLOADS}/${tag}/FluidEQ-${version}-arm64-mac.zip`,
        },
      ],
    });
    const json = JSON.stringify([
      release('mac-v2.2.1', '2.2.1'),
      release('mac-v2.10.0', '2.10.0'),
      release('mac-v2.9.0', '2.9.0'),
    ]);
    expect(newestMacRelease(json)?.feedUrl).toBe(
      `${DOWNLOADS}/mac-v2.10.0/latest-mac.yml`,
    );
  });

  it('finds nothing when no release carries a Mac feed', () => {
    expect(newestMacRelease('[]')).toBeUndefined();
  });
});

describe('where a Mac can update', () => {
  it('turns on for an installed copy it can replace', async () => {
    expect(await setUpMacSelfUpdates(depsFor().deps)).toBeDefined();
  });

  it.each<[string, Partial<IMacSelfUpdateDeps>]>([
    ['on Windows', { platform: 'win32' }],
    ['in development', { isPackaged: false }],
    [
      'from a disk image',
      { executablePath: '/Volumes/FluidEQ/FluidEQ.app/Contents/MacOS/FluidEQ' },
    ],
    [
      'translocated',
      {
        executablePath:
          '/private/var/folders/x/AppTranslocation/1/d/FluidEQ.app/Contents/MacOS/FluidEQ',
      },
    ],
    ['where this account cannot write', { canWrite: async () => false }],
    ['in a build that trusts no Mac key', { feedKeys: {} }],
  ])('stays off %s', async (_where, override) => {
    const { deps } = depsFor(override);
    expect(await setUpMacSelfUpdates(deps)).toBeUndefined();
    expect(deps.fetchText).not.toHaveBeenCalled();
  });
});

describe('an update', () => {
  it('is downloaded, checked and put in place at quit', async () => {
    const { deps, sent, finished, runQuit } = depsFor();
    const updater = await setUp(deps);
    await finished;

    expect(updater?.isReadyToInstall()).toBe(true);
    expect(sent).toContainEqual({ phase: 'ready', version: '2.3.0' });
    expect(deps.download).toHaveBeenCalledWith(
      `${DOWNLOADS}/mac-v2.3.0/FluidEQ-2.3.0-arm64-mac.zip`,
      expect.any(String),
      expect.any(Function),
    );

    updater?.quitAndInstall();
    expect(deps.relaunch).toHaveBeenCalled();
    expect(deps.quit).toHaveBeenCalled();
    // Nothing moves until Electron's own quit.
    expect(
      fs.readFileSync(
        path.join(bundle, 'Contents', 'MacOS', 'FluidEQ'),
        'utf8',
      ),
    ).toBe('2.2.0');
    runQuit();
    expect(
      fs.readFileSync(
        path.join(bundle, 'Contents', 'MacOS', 'FluidEQ'),
        'utf8',
      ),
    ).toBe('2.3.0');
  });

  it('is refused from a feed nobody signed', async () => {
    const { deps } = depsFor({ feed: feedText({ signed: false }) });
    const updater = await setUp(deps);
    expect(updater?.isReadyToInstall()).toBe(false);
    expect(deps.download).not.toHaveBeenCalled();
  });

  it('is refused when the download is not what the feed signed', async () => {
    const other = createHash('sha512').update('another zip').digest('base64');
    const { deps, finished } = depsFor({ feed: feedText({ sha512: other }) });
    const updater = await setUp(deps);
    await finished;
    expect(deps.download).toHaveBeenCalled();
    expect(updater?.isReadyToInstall()).toBe(false);
    expect(() => updater?.quitAndInstall()).toThrow('No verified Mac update');
  });

  it('is refused when the app inside is another version', async () => {
    const { deps, finished } = depsFor({ unzipped: '2.2.5' });
    const updater = await setUp(deps);
    await finished;
    expect(updater?.isReadyToInstall()).toBe(false);
  });

  it('is not fetched when the feed names this version', async () => {
    const { deps, sent } = depsFor({ feed: feedText({ version: '2.2.0' }) });
    const onManualCheckResult = jest.fn();
    deps.onManualCheckResult = onManualCheckResult;
    await setUp(deps);
    expect(deps.download).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
    expect(onManualCheckResult).toHaveBeenCalledWith('up-to-date', undefined);
  });

  it('puts the running version back when the new one cannot be moved in', async () => {
    const { deps, finished, runQuit } = depsFor();
    const updater = await setUp(deps);
    await finished;
    updater?.quitAndInstall();
    const staged = path.join(root, '.FluidEQ-update-2.3.0', 'FluidEQ.app');
    fs.rmSync(staged, { recursive: true, force: true });
    runQuit();
    expect(
      fs.readFileSync(
        path.join(bundle, 'Contents', 'MacOS', 'FluidEQ'),
        'utf8',
      ),
    ).toBe('2.2.0');
  });

  it('sweeps what an earlier update left beside the app', async () => {
    fs.mkdirSync(path.join(root, '.FluidEQ-replaced-2.1.0.app'));
    fs.mkdirSync(path.join(root, '.FluidEQ-update-2.1.0'));
    const { deps } = depsFor({ feed: feedText({ version: '2.2.0' }) });
    await setUp(deps);
    expect(fs.readdirSync(root)).toEqual(['FluidEQ.app']);
  });
});
