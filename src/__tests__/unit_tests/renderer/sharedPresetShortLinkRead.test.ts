/*
Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

/**
 * A short link's preset comes from FluidEQ's server, and the server's answer
 * is read exactly like a pasted code: the strict decoder, every value
 * clamped, `__proto__` dropped, the name the code's own. A forum post being
 * drawn never follows a link at all.
 */

import { deflateRawSync } from 'zlib';
import { MAXIMIZER_MAX_CEILING_DB } from '../../../common/dsp/chainStageSettings';
import { readSharedPreset } from '../../../renderer/eq/ownPresets/share/useSharedPreset';
import type { TSharedPresetFetchOutcome } from '../../../common/presetShare/sharedPresetLink';

const ID = 'Ab3dE6gH';

/**
 * A code as a hostile sender could pack it, past every clamp. Text is packed
 * as it is, so a `__proto__` key reaches the decoder as JSON carries it (an
 * object literal would make it the prototype instead).
 */
const packed = (payload: unknown): string =>
  `FQP1.${deflateRawSync(
    Buffer.from(
      typeof payload === 'string' ? payload : JSON.stringify(payload),
    ),
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')}`;

const fetchSharedPreset = jest.fn<
  Promise<TSharedPresetFetchOutcome>,
  [string]
>();

beforeAll(() => {
  Object.assign(globalThis, {
    window: { electron: { ipcRenderer: { fetchSharedPreset } } },
  });
});

beforeEach(() => fetchSharedPreset.mockReset());

const serving = (code: string, name = 'Server name') =>
  fetchSharedPreset.mockResolvedValue({
    ok: true,
    preset: { id: ID, name, code, author: 'Night Owl' },
  });

describe('a preset opened by its short link', () => {
  it('is fetched by id and read through the strict decoder', async () => {
    serving(
      packed(
        `{"n":"  Night ${'Drive '.repeat(20)}","d":{` +
          '"maximizer":{"enabled":true,"ceilingDb":50,"driveDb":1e9},' +
          '"__proto__":{"polluted":true},' +
          '"constructor":{"prototype":{"polluted":true}}}}',
      ),
    );
    const read = await readSharedPreset(
      `look: https://fluideq.com/p/${ID}`,
      true,
    );
    expect(fetchSharedPreset).toHaveBeenCalledWith(ID);
    expect(read.ok).toBe(true);
    if (!read.ok) {
      return;
    }
    // The code's own name, cleaned to 40 characters, never the server's.
    expect(read.preset.name.length).toBeLessThanOrEqual(40);
    expect(read.preset.name.startsWith('Night Drive')).toBe(true);
    expect(read.preset.settings.maximizer.ceilingDb).toBeLessThanOrEqual(
      MAXIMIZER_MAX_CEILING_DB,
    );
    expect(Number.isFinite(read.preset.settings.maximizer.driveDb)).toBe(true);
    expect(read.preset.settings.maximizer.driveDb).toBeLessThan(1e9);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(read.source).toEqual({ id: ID, author: 'Night Owl' });
  });

  it('refuses a code that inflates past the cap', async () => {
    serving(packed({ n: 'Bomb', d: { pad: 'x'.repeat(200_000) } }));
    await expect(
      readSharedPreset(`fluideq://preset/${ID}`, true),
    ).resolves.toEqual({ ok: false, problem: 'damaged' });
  });

  it('says gone for a link no longer shared and offline for no answer', async () => {
    fetchSharedPreset.mockResolvedValueOnce({ ok: false, problem: 'missing' });
    await expect(
      readSharedPreset(`https://fluideq.com/p/${ID}`, true),
    ).resolves.toEqual({ ok: false, problem: 'gone' });
    fetchSharedPreset.mockResolvedValueOnce({ ok: false, problem: 'offline' });
    await expect(
      readSharedPreset(`https://fluideq.com/p/${ID}`, true),
    ).resolves.toEqual({ ok: false, problem: 'offline' });
  });

  it('prefers a code beside the link, and asks nothing', async () => {
    const code = packed({ n: 'In the post', d: {} });
    const read = await readSharedPreset(
      `https://fluideq.com/p/${ID}\n${code}`,
      true,
    );
    expect(read.ok && read.preset.name).toBe('In the post');
    expect(fetchSharedPreset).not.toHaveBeenCalled();
  });

  it('is not followed where links are not followed: a post being drawn', async () => {
    await expect(
      readSharedPreset(`https://fluideq.com/p/${ID}`, false),
    ).resolves.toEqual({ ok: false, problem: 'missing' });
    expect(fetchSharedPreset).not.toHaveBeenCalled();
  });
});
