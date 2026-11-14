/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import fs from 'fs';
import os from 'os';
import path from 'path';

const mockUserData = { dir: '' };
const mockLog = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

jest.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => mockUserData.dir },
}));
jest.mock('electron-log', () => ({ __esModule: true, default: mockLog }));

// eslint-disable-next-line import/first -- the mocks above have to be in place before the module reads `app`
import {
  checkOpraUpdate,
  logOpraSyncFailure,
  syncOpraDatabase,
} from '../../../main/opraUpdater';

const NOW = Date.parse('2026-11-13T19:50:33Z');

/** What the bundled manifest says of itself, as the log line names it. */
const bundled = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../../../../assets/opra-version.json'),
    'utf8',
  ),
) as { productCount: number; generatedAt: string };
const BUNDLED = `${bundled.productCount} products, ${bundled.generatedAt.slice(0, 10)}`;
const KEEPS = `keeps the current database (${BUNDLED}).`;

describe('the startup sync under a GitHub rate limit', () => {
  let request: jest.SpyInstance;

  beforeEach(() => {
    mockUserData.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opra-feed-'));
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    request = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('rate limited', {
        status: 403,
        headers: {
          'x-ratelimit-reset': String(Math.floor(NOW / 1000) + 900),
        },
      }),
    );
    Object.values(mockLog).forEach((fn) => fn.mockClear());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(mockUserData.dir, { recursive: true, force: true });
  });

  it('resolves with nothing to compare against, logs one line and asks nothing more', async () => {
    const status = await syncOpraDatabase();
    expect(status.updateAvailable).toBe(false);
    expect(status.latest).toBeUndefined();
    expect(mockLog.warn).toHaveBeenCalledTimes(1);
    // The line as a bug report reads it: what, why, what happens next.
    expect(mockLog.warn.mock.calls[0]).toEqual([
      expect.stringMatching(
        new RegExp(
          `^OPRA database: check skipped \\(GitHub rate limit, HTTP 403/429\\); ` +
            `skipped until \\d\\d:\\d\\d \\(2026-11-13T20:05:33\\.000Z\\); ` +
            `keeps the current database \\(${BUNDLED}\\)\\.$`,
        ),
      ),
    ]);
    expect(mockLog.error).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);

    // A restart within the limit: no request, and no second line.
    await checkOpraUpdate();
    expect(request).toHaveBeenCalledTimes(1);
    expect(mockLog.warn).toHaveBeenCalledTimes(1);
  });

  it('calls the update available once a newer manifest is read (the control)', async () => {
    request.mockResolvedValue(
      new Response(
        JSON.stringify({
          version: 1,
          contentHash: 'newer',
          vendorCount: 714,
          productCount: 12594,
          curveCount: 20000,
          generatedAt: '2026-11-05T06:23:00Z',
        }),
        { status: 200 },
      ),
    );
    const status = await checkOpraUpdate();
    expect(status.updateAvailable).toBe(true);
    expect(status.latest?.contentHash).toBe('newer');
    expect(mockLog.warn).not.toHaveBeenCalled();
    // Remembered for the day: the page's own check asks nobody.
    await checkOpraUpdate();
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('a failed sync in the log', () => {
  let request: jest.SpyInstance;

  beforeEach(() => {
    mockUserData.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opra-feed-'));
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    request = jest.spyOn(global, 'fetch');
    Object.values(mockLog).forEach((fn) => fn.mockClear());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(mockUserData.dir, { recursive: true, force: true });
  });

  /** What the startup sync does with whatever the check threw. */
  const syncAndLog = async () => {
    try {
      await syncOpraDatabase();
    } catch (error) {
      logOpraSyncFailure('sync', error);
    }
  };

  it('says offline in one line, with no stack', async () => {
    request.mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), {
        cause: new Error('getaddrinfo ENOTFOUND github.com'),
      }),
    );
    await syncAndLog();
    expect(mockLog.warn.mock.calls).toEqual([
      [
        'OPRA database: sync failed (offline or unreachable: fetch failed: ' +
          `getaddrinfo ENOTFOUND github.com); tries again at the next launch; ${KEEPS}`,
      ],
    ]);
    expect(mockLog.error).not.toHaveBeenCalled();
  });

  it('names the HTTP status of a server fault', async () => {
    request.mockResolvedValue(new Response('', { status: 503 }));
    await syncAndLog();
    expect(mockLog.warn.mock.calls).toEqual([
      [
        `OPRA database: sync failed (HTTP 503); tries again at the next launch; ${KEEPS}`,
      ],
    ]);
  });

  it('says when nothing is published, once a day', async () => {
    request.mockResolvedValue(new Response('Not Found', { status: 404 }));
    await syncAndLog();
    expect(mockLog.warn.mock.calls).toEqual([
      [
        `OPRA database: nothing published to check against (HTTP 404); checks again tomorrow; ${KEEPS}`,
      ],
    ]);
    await syncAndLog();
    expect(request).toHaveBeenCalledTimes(1);
    expect(mockLog.warn).toHaveBeenCalledTimes(1);
  });

  it('keeps the stack, with the feed named, for a bug (the control)', () => {
    const bug = new TypeError(
      "Cannot read properties of undefined (reading 'x')",
    );
    logOpraSyncFailure('update', bug);
    expect(mockLog.warn).not.toHaveBeenCalled();
    expect(mockLog.error.mock.calls).toEqual([
      ['OPRA database: update failed unexpectedly', bug],
    ]);
  });
});
