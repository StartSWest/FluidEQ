/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { DSP_PRESETS } from 'common/dsp/presets';
import en from 'common/i18n/en';
import defaultContext from '__tests__/utils/mockFluidEqProvider';
import VoicingQuickPick from 'renderer/components/VoicingQuickPick';
import DspChainPresetBar from 'renderer/dsp/DspChainPresetBar';
import { QUICK_DSP_PRESETS } from 'renderer/dsp/dspPresetCatalog';
import {
  DSP_PRESETS_CHANGED,
  toggleFavouriteDspPreset,
} from 'renderer/dsp/favouriteDspPresets';
import { applyDspSettings } from 'renderer/dsp/store';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';

jest.mock('renderer/dsp/systemChain', () => ({
  sendSystemDspChain: jest.fn(),
}));
let mockEngine: 'fluid' | 'apo' = 'fluid';
jest.mock('renderer/utils/useAudioEngineStatus', () => ({
  useKnownAudioEngineStatus: () => ({ engine: mockEngine }),
}));
jest.mock('renderer/utils/equalizerApi', () => ({
  setVoicing: jest.fn(),
  exportDspChainPreset: jest.fn(),
}));

/**
 * The usual chains, as both pickers name them. A Room copy is its chain's
 * name, a dot, and what tells it apart.
 */
const USUAL = [
  'Music',
  'Music · Room',
  'Movie',
  'Movie · Room',
  'Gaming',
  'Gaming · Room',
  'Gaming · Competitive',
  'Speech',
  'Late night',
];

const context = {
  ...defaultContext,
  isEnabled: true,
  isBlockingError: false,
  voicing: undefined,
};

/** The rows under one heading of the open menu, by name, in order. */
const rowsUnder = (heading: string): string[] => {
  const list = document.querySelector('.rich-pick__list');
  const names: string[] = [];
  let isInside = false;
  list
    ?.querySelectorAll('.rich-pick__group, [role="menuitemradio"]')
    .forEach((node) => {
      if (node.classList.contains('rich-pick__group')) {
        isInside = node.textContent === heading;
        return;
      }
      if (isInside) {
        names.push(node.querySelector('strong')?.textContent ?? '');
      }
    });
  return names;
};

const allRows = (): string[] =>
  Array.from(
    document.querySelectorAll('.rich-pick__list [role="menuitemradio"] strong'),
  ).map((node) => node.textContent ?? '');

const showQuickPick = () => {
  render(
    <FluidEqProviderWrapper value={context}>
      <VoicingQuickPick />
    </FluidEqProviderWrapper>,
  );
  fireEvent.click(screen.getByRole('button', { name: en['dsp.presets'] }));
};

const showRackPicker = () => {
  render(
    <FluidEqProviderWrapper value={context}>
      <DspChainPresetBar
        settings={{ ...DSP_DEFAULTS, enabled: true }}
        disabled={false}
        onChange={jest.fn()}
        onCommit={jest.fn()}
      />
    </FluidEqProviderWrapper>,
  );
  fireEvent.click(screen.getByRole('button', { name: en['dsp.presets'] }));
};

beforeEach(() => {
  mockEngine = 'fluid';
  localStorage.clear();
  // Nothing starred: a fresh install stars Gaming and Movie among others,
  // and a starred chain files under the favourites instead.
  localStorage.setItem('fluideq.dsp.favouritePresets.v1', '[]');
  applyDspSettings({ ...DSP_DEFAULTS, enabled: false });
});

describe('the usual chains', () => {
  it('are all in the catalogue, each Room copy straight after the chain it copies', () => {
    const usual = QUICK_DSP_PRESETS.map((id) =>
      DSP_PRESETS.find((one) => one.id === id),
    );
    usual.forEach((preset, index) => {
      const id = QUICK_DSP_PRESETS[index];
      expect({ id, found: preset !== undefined }).toEqual({ id, found: true });
      if (preset?.copyLabelKey === undefined) {
        return;
      }
      // The nearest chain above it that is not itself a copy.
      const chain = usual
        .slice(0, index)
        .reverse()
        .find((one) => one?.copyLabelKey === undefined);
      expect({ id, labelKey: chain?.labelKey }).toEqual({
        id,
        labelKey: preset.labelKey,
      });
    });
  });

  it('lead the quick pick on the equaliser page, in order', () => {
    showQuickPick();
    expect(rowsUnder(en['dsp.quick.classics'])).toEqual(USUAL);
  });

  it('lead the rack’s own picker under the same heading, in the same order, once each', () => {
    showRackPicker();
    expect(rowsUnder(en['dsp.quick.classics'])).toEqual(USUAL);
    const rows = allRows();
    USUAL.forEach((name) => {
      expect({
        name,
        times: rows.filter((row) => row === name).length,
      }).toEqual({ name, times: 1 });
    });
    // Straight under the starred ones, above every other heading.
    const headings = Array.from(
      document.querySelectorAll('.rich-pick__list .rich-pick__group'),
    ).map((node) => node.textContent);
    expect(headings[0]).toBe(en['dsp.quick.classics']);
  });

  it('give a starred one up to the favourites, in both pickers', () => {
    toggleFavouriteDspPreset('movie', ['movie']);
    showRackPicker();
    expect(rowsUnder(en['library.playlist.favorites'])).toEqual(['Movie']);
    expect(rowsUnder(en['dsp.quick.classics'])).toEqual(
      USUAL.filter((name) => name !== 'Movie'),
    );
    const headings = Array.from(
      document.querySelectorAll('.rich-pick__list .rich-pick__group'),
    ).map((node) => node.textContent);
    expect(headings.slice(0, 2)).toEqual([
      en['library.playlist.favorites'],
      en['dsp.quick.classics'],
    ]);
  });

  it('offer no Room copy under Equalizer APO, which takes a chain’s EQ curve and nothing else', () => {
    mockEngine = 'apo';
    showQuickPick();
    expect(rowsUnder(en['dsp.quick.classics'])).toEqual(
      USUAL.filter((name) => !name.includes(' · ')),
    );
  });
});

/*
 * The equaliser's page and the player's deck re-render with every frame of a
 * band being dragged, and the pick re-rendered with them: each frame read the
 * saved chains and the stars out of storage, parsed and clamped them, and
 * rebuilt every row, for a menu nobody had open. Now the pick renders only
 * for what it shows, and even then reads storage only when what is saved has
 * changed.
 */
describe('the equaliser’s pick while a band is dragged', () => {
  const CATALOGUE_KEYS = [
    'fluideq.dsp.userChainPresets.v1',
    'fluideq.dsp.favouritePresets.v1',
  ];

  it('reads no saved chain for a frame that moved only the bands', () => {
    const pick = (value: typeof context) => (
      <FluidEqProviderWrapper value={value}>
        <VoicingQuickPick />
      </FluidEqProviderWrapper>
    );
    // One band's gain moved, as one frame of a drag moves it.
    const [first, ...rest] = Object.values(context.filters);
    const dragged = {
      ...context,
      filters: Object.fromEntries(
        [{ ...first, gain: first.gain + 1 }, ...rest].map((band) => [
          band.id,
          band,
        ]),
      ),
    };
    const view = render(pick(context));
    const getItem = jest.spyOn(Storage.prototype, 'getItem');
    const catalogueReads = () =>
      getItem.mock.calls.filter(([key]) => CATALOGUE_KEYS.includes(key)).length;

    view.rerender(pick(dragged));
    expect(catalogueReads()).toBe(0);

    // Rendered again for something it shows, with nothing saved changed.
    view.rerender(pick({ ...dragged, isEnabled: false }));
    expect(catalogueReads()).toBe(0);

    // The control: a change to what is saved is read.
    act(() => {
      window.dispatchEvent(new Event(DSP_PRESETS_CHANGED));
    });
    expect(catalogueReads()).toBeGreaterThan(0);
    getItem.mockRestore();
  });
});
