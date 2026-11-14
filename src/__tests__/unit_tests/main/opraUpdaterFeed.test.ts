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
import { checkOpraUpdate, syncOpraDatabase } from '../../../main/opraUpdater';

const NOW = Date.parse('2026-11-13T19:50:33Z');

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
    expect(mockLog.info).toHaveBeenCalledTimes(1);
    expect(mockLog.info.mock.calls[0][0]).toMatch(
      /^OPRA database check postponed until 2026-11-13T20:05:33\.000Z/,
    );
    expect(request).toHaveBeenCalledTimes(1);

    // A restart within the limit: no request, and no second line.
    await checkOpraUpdate();
    expect(request).toHaveBeenCalledTimes(1);
    expect(mockLog.info).toHaveBeenCalledTimes(1);
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
    expect(mockLog.info).not.toHaveBeenCalled();
    // Remembered for the day: the page's own check asks nobody.
    await checkOpraUpdate();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
