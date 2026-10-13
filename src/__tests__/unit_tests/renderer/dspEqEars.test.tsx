/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * A DSP EQ band can play on one ear (Ivan, 2026-10-13, "EQ per ear"): kept
 * through every store and file the rack goes through, carried to the engine
 * in the band's switch word, and chosen in the band's own menu — the main
 * EQ's, with nothing new on the card.
 */

import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  CHAIN_BAND_PARAMS,
  CHAIN_PARAM_LEAD,
  encodeChainSettings,
} from 'common/dsp/chainWire';
import {
  DSP_DEFAULTS,
  IEqBandSettings,
  IEqSettings,
  clampDspSettings,
} from 'common/dsp/chain';
import DspBandMenu from 'renderer/dsp/DspBandMenu';
import { isHeardOn, rackPlaysEars } from 'renderer/dsp/dspEqEars';

let mockEngine: { engine: string; fluid?: { dllVersion?: string } } = {
  engine: 'fluid',
  fluid: { dllVersion: '1.22.0.0' },
};
jest.mock('renderer/utils/useAudioEngineStatus', () => ({
  useKnownAudioEngineStatus: () => mockEngine,
}));

afterEach(() => {
  cleanup();
  mockEngine = { engine: 'fluid', fluid: { dllVersion: '1.22.0.0' } };
});

const band = (
  ear?: IEqBandSettings['ear'],
  enabled = true,
): IEqBandSettings => ({
  enabled,
  dynamic: false,
  thresholdDb: -24,
  type: 'PK',
  frequency: 3000,
  gainDb: -4,
  quality: 2,
  ...(ear ? { ear } : {}),
});

const eqWith = (
  bands: IEqBandSettings[],
  stereo: IEqSettings['stereo'] = 'stereo',
) => ({ ...DSP_DEFAULTS.eq, enabled: true, stereo, bands, sourceBands: bands });

/** Each band's switch word on the wire. */
const switchWords = (bands: IEqBandSettings[]) => {
  const wire = encodeChainSettings({ ...DSP_DEFAULTS, eq: eqWith(bands) });
  return bands.map(
    (_, index) => wire[CHAIN_PARAM_LEAD + index * CHAIN_BAND_PARAMS],
  );
};

describe('a DSP EQ band kept to one ear', () => {
  it('rides the switch word: 1 both, 2 left, 3 right, 0 off whatever its ear', () => {
    expect(
      switchWords([band(), band('left'), band('right'), band('left', false)]),
    ).toEqual([1, 2, 3, 0]);
  });

  it('survives the store and drops anything that is not an ear', () => {
    const stored = clampDspSettings({
      ...DSP_DEFAULTS,
      eq: eqWith([
        band('left'),
        band('right'),
        { ...band(), ear: 'centre' } as never,
      ]),
    });
    expect(stored.eq.bands.map((one) => one.ear)).toEqual([
      'left',
      'right',
      undefined,
    ]);
    // And a band on both ears carries no ear at all, as every rack before.
    expect('ear' in stored.eq.bands[2]).toBe(false);
  });

  it('draws two ears only while the EQ applies to Stereo and a band has one', () => {
    expect(rackPlaysEars(eqWith([band(), band('left')]))).toBe(true);
    // The controls: no ear, an ear on a switched-off band, and Mid.
    expect(rackPlaysEars(eqWith([band(), band()]))).toBe(false);
    expect(rackPlaysEars(eqWith([band('left', false)]))).toBe(false);
    expect(rackPlaysEars(eqWith([band('left')], 'mid'))).toBe(false);
    expect(isHeardOn(band('left'), 'right')).toBe(false);
    expect(isHeardOn(band(), 'right')).toBe(true);
  });
});

describe("the DSP EQ band's menu", () => {
  const show = (eq: IEqSettings) => {
    const onPatch = jest.fn();
    render(
      <DspBandMenu
        eq={eq}
        index={0}
        x={10}
        y={10}
        onPatch={onPatch}
        onAddBeside={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    return onPatch;
  };

  it('sets the ear, and Both takes it off again', () => {
    const onPatch = show(eqWith([band('left')]));
    expect(
      screen.getByRole('menuitemradio', { name: 'Left ear only' }),
    ).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Both ears' }));
    const [index, next] = onPatch.mock.calls[0] as [number, IEqBandSettings];
    expect(index).toBe(0);
    expect('ear' in next).toBe(false);
    cleanup();
    const onRight = show(eqWith([band()]));
    fireEvent.click(
      screen.getByRole('menuitemradio', { name: 'Right ear only' }),
    );
    expect(onRight.mock.calls[0][1]).toMatchObject({ ear: 'right' });
  });

  it('offers no ear in Mid or Sides, where there is none to keep a band to', () => {
    show(eqWith([band()], 'mid'));
    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
    // The control: the rest of the menu is there.
    expect(screen.getByText('Reset band')).toBeVisible();
  });

  it('says the engine plays it on both ears before 1.22, and only then', () => {
    mockEngine = { engine: 'fluid', fluid: { dllVersion: '1.21.0.0' } };
    show(eqWith([band('left')]));
    expect(screen.getByText(/plays this band on both ears/)).toBeVisible();
    cleanup();
    mockEngine = { engine: 'fluid', fluid: { dllVersion: '1.22.0.0' } };
    show(eqWith([band('left')]));
    expect(screen.queryByText(/plays this band on both ears/)).toBeNull();
  });
});
