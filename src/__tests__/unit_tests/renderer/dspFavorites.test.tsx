import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DSP_DEFAULTS } from 'common/dsp/chain';
import defaultContext from '__tests__/utils/mockFluidEqProvider';
import VoicingQuickPick from 'renderer/components/VoicingQuickPick';
import { applyDspSettings, readDspSettings } from 'renderer/dsp/store';
import {
  toggleFavouriteDspPreset,
  readFavouriteDspPresets,
  DSP_PRESETS_CHANGED,
} from 'renderer/dsp/favouriteDspPresets';
import { dspPresetSettings } from 'common/dsp/presets';
import type { IEqualizerSnapshot } from 'common/outputSettings';
import {
  saveUserDspPreset,
  removeUserDspPreset,
} from 'renderer/dsp/userDspPresets';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import { pickDspPreset } from 'renderer/utils/equalizerApi';
import { updateOutputEditor } from 'renderer/utils/outputEditor';

jest.mock('renderer/dsp/systemChain', () => ({
  sendSystemDspChain: jest.fn(),
}));
jest.mock('renderer/utils/useAudioEngineStatus', () => ({
  useKnownAudioEngineStatus: () => ({ engine: 'fluid' }),
}));
jest.mock('renderer/utils/equalizerApi', () => ({ pickDspPreset: jest.fn() }));

const refreshState = jest.fn(async () => undefined);
const setGlobalError = jest.fn();

const show = () =>
  render(
    <FluidEqProviderWrapper
      value={{
        ...defaultContext,
        isEnabled: true,
        isBlockingError: false,
        voicing: undefined,
        refreshState,
        setGlobalError,
      }}
    >
      <VoicingQuickPick />
    </FluidEqProviderWrapper>,
  );

beforeEach(() => {
  localStorage.clear();
  applyDspSettings({ ...DSP_DEFAULTS, enabled: false });
  jest.clearAllMocks();
  jest.mocked(pickDspPreset).mockReset().mockResolvedValue(undefined);
  updateOutputEditor({
    outputEditor: {
      device: {
        id: 'speakers',
        name: 'Speakers',
        guid: '{speakers}',
        isDefault: true,
        isActive: true,
      },
      generation: 2,
    },
  } as IEqualizerSnapshot);
});

/*
 * The pick is the core's to put on (`main/presetPicks.ts`, its rules in
 * `presetPick.test.ts`): the window asks for it, for the whole machine and
 * for the output on screen, and then reads back the rack and curve it got.
 */
it('opens the real grouped picker and asks the core to put Gaming on, then reads the rack back', async () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
  const picks = screen.getAllByRole('menuitemradio', { name: /Gaming/ });
  expect(picks.length).toBeGreaterThan(0);
  await act(async () => {
    fireEvent.click(picks[0]);
  });
  expect(pickDspPreset).toHaveBeenCalledWith('gaming', true, 'speakers');
  expect(refreshState).toHaveBeenCalledWith({ adoptRack: true });
});

it('reads nothing back from a pick the core refused, and says why', async () => {
  jest.mocked(pickDspPreset).mockRejectedValueOnce({ errorCode: 1 });
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
  await act(async () => {
    fireEvent.click(
      screen.getByRole('menuitemradio', { name: /^Gaming (?!·)/ }),
    );
  });
  expect(refreshState).not.toHaveBeenCalled();
  expect(setGlobalError).toHaveBeenCalledWith({ errorCode: 1 });
});

it('updates favorites from saved presets immediately and removes stale entries', async () => {
  const saved = saveUserDspPreset('My sound', {
    ...DSP_DEFAULTS,
    enabled: true,
  });
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
  act(() => {
    toggleFavouriteDspPreset(saved.id, [saved.id]);
  });
  const button = screen.getByRole('menuitemradio', { name: /My sound/ });
  await act(async () => {
    fireEvent.click(button);
  });
  expect(pickDspPreset).toHaveBeenCalledWith(saved.id, true, 'speakers');
  const rack = readDspSettings();
  fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
  act(() => {
    removeUserDspPreset(saved.id);
  });
  expect(
    screen.queryByRole('menuitemradio', { name: /My sound/ }),
  ).not.toBeInTheDocument();
  // Forgetting a saved chain takes nothing off the rack.
  expect(readDspSettings()).toBe(rack);
});

it('keeps the applied sound and its label after the last favorite is removed', () => {
  const punch = dspPresetSettings('punch', DSP_DEFAULTS);
  if (!punch) {
    throw new Error('Punch is missing');
  }
  applyDspSettings(punch);
  render(
    <FluidEqProviderWrapper value={{ ...defaultContext, isEnabled: true }}>
      <VoicingQuickPick />
    </FluidEqProviderWrapper>,
  );
  act(() => {
    localStorage.setItem('fluideq.dsp.favouritePresets.v1', '[]');
    window.dispatchEvent(new Event(DSP_PRESETS_CHANGED));
  });
  expect(readDspSettings()).toEqual(punch);
  expect(screen.getByRole('button', { name: 'Presets' })).toHaveTextContent(
    'Punch',
  );
  expect(screen.queryByText(/No favorites yet/)).not.toBeInTheDocument();
});
it('keeps classics and worldwide genres available with no favorites', () => {
  localStorage.setItem('fluideq.dsp.favouritePresets.v1', '[]');
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
  [
    'Music',
    'Rock',
    'Pop',
    'Country',
    'Modern country',
    'Afrobeats',
    'K-pop',
    'Bhangra',
  ].forEach((name) => {
    expect(
      screen.getAllByRole('menuitemradio', {
        name: new RegExp(`^${name}(?:\\s|$)`, 'i'),
      }).length,
    ).toBeGreaterThan(0);
  });
  expect(screen.queryByText(/No favorites yet/)).not.toBeInTheDocument();
});

it('reads None on a running rack as its own None', () => {
  const none = dspPresetSettings('empty', DSP_DEFAULTS);
  if (!none) {
    throw new Error('None missing');
  }
  applyDspSettings(none);
  show();
  expect(screen.getByRole('button', { name: 'Presets' })).toHaveTextContent(
    'None',
  );
});

/*
 * Starred here as on the DSP page's own picker, into the one list both file
 * first. None is the absence of a choice and takes no star.
 */
it('stars a preset into the list the DSP page shares, and never None', () => {
  localStorage.setItem('fluideq.dsp.favouritePresets.v1', '[]');
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
  expect(
    screen.queryByRole('button', { name: /Favourites: None$/ }),
  ).not.toBeInTheDocument();
  act(() => {
    fireEvent.click(
      screen.getByRole('button', { name: 'Add to Favourites: Rock' }),
    );
  });
  expect(readFavouriteDspPresets()).toEqual(['rock']);
  expect(
    screen.getByRole('button', { name: 'Remove from Favourites: Rock' }),
  ).toHaveAttribute('aria-pressed', 'true');
  // The menu stays open, and Rock now leads it, straight after None, under
  // the Favourites heading — spelled as the DSP page's and the Library's.
  expect(screen.getByText('Favourites')).toBeInTheDocument();
  const rows = screen
    .getAllByRole('menuitemradio')
    .map((row) => row.textContent ?? '');
  expect(rows[0]).toMatch(/^None/);
  expect(rows[1]).toMatch(/^Rock/);
});

/** The names of the menu's rows, None aside, as they read top to bottom. */
const rowNames = () =>
  screen
    .getAllByRole('menuitemradio')
    .slice(1)
    .map((row) => row.querySelector('strong')?.textContent ?? '');

it('lists the starred presets in the order the list itself gives them', () => {
  localStorage.setItem('fluideq.dsp.favouritePresets.v1', '[]');
  const first = show();
  fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
  const listed = rowNames();
  first.unmount();
  // Starred out of the list's order, a Room copy among them.
  const stars = [
    'rock',
    'gaming-competitive',
    'movie-room',
    'gaming-room',
    'gaming',
  ];
  localStorage.setItem(
    'fluideq.dsp.favouritePresets.v1',
    JSON.stringify(stars),
  );
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
  const starred = rowNames().slice(0, stars.length);
  // Each starred name stands where the unstarred list put it.
  expect(starred).toEqual(listed.filter((name) => starred.includes(name)));
  expect(starred.indexOf('Gaming · Room')).toBe(starred.indexOf('Gaming') + 1);
});
