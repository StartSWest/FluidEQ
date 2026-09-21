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
import { holdRackForApo, rackHeldForApo } from 'renderer/dsp/rackHeldForApo';
import { dspPresetCurve, dspPresetSettings } from 'common/dsp/presets';
import {
  saveUserDspPreset,
  removeUserDspPreset,
} from 'renderer/dsp/userDspPresets';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import { setVoicing } from 'renderer/utils/equalizerApi';

jest.mock('renderer/dsp/systemChain', () => ({
  sendSystemDspChain: jest.fn(),
}));
let mockEngine: 'fluid' | 'apo' = 'fluid';
jest.mock('renderer/utils/useAudioEngineStatus', () => ({
  useAudioEngineStatus: () => ({ status: { engine: mockEngine } }),
}));
jest.mock('renderer/utils/equalizerApi', () => ({ setVoicing: jest.fn() }));

const show = (legacy = false) =>
  render(
    <FluidEqProviderWrapper
      value={{
        ...defaultContext,
        isEnabled: true,
        isBlockingError: false,
        voicing: legacy ? { profileId: 'games', intensity: 1 } : undefined,
      }}
    >
      <VoicingQuickPick />
    </FluidEqProviderWrapper>,
  );

beforeEach(() => {
  mockEngine = 'fluid';
  localStorage.clear();
  applyDspSettings({ ...DSP_DEFAULTS, enabled: false });
  jest.clearAllMocks();
  jest.mocked(setVoicing).mockReset().mockResolvedValue(undefined);
});

it('opens the real grouped picker and loads Gaming into the shared DSP rack', async () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
  const picks = screen.getAllByRole('menuitemradio', { name: /Gaming/ });
  expect(picks.length).toBeGreaterThan(0);
  await act(async () => {
    fireEvent.click(picks[0]);
  });
  expect(readDspSettings()).toMatchObject({
    enabled: true,
    presetId: 'gaming',
    gameMode: true,
  });
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
  expect(readDspSettings().presetId).toBe(saved.id);
  fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
  act(() => {
    removeUserDspPreset(saved.id);
  });
  expect(
    screen.queryByRole('menuitemradio', { name: /My sound/ }),
  ).not.toBeInTheDocument();
  expect(readDspSettings().presetId).toBe(saved.id);
});

/*
 * A preset's tone replaces whatever voicing was on — the one tonal layer it
 * owns (`presetCurve.ts`) — and the rack waits for that to land, so the new
 * rack never plays under the old layer.
 */
it('replaces the legacy voicing with the preset curve before enabling its rack', async () => {
  let finish: () => void = () => undefined;
  jest.mocked(setVoicing).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  show(true);
  fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
  // Gaming itself, not one of its copies with the Room ("Gaming · Room").
  fireEvent.click(screen.getByRole('menuitemradio', { name: /^Gaming (?!·)/ }));
  expect(setVoicing).toHaveBeenCalledWith(
    'dsp:gaming',
    1,
    dspPresetCurve('gaming'),
  );
  expect(readDspSettings().enabled).toBe(false);
  await act(async () => {
    finish();
  });
  expect(readDspSettings()).toMatchObject({
    enabled: true,
    presetId: 'gaming',
  });
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

it('None disables the entire quick preset and Game mode without erasing its settings', async () => {
  const gaming = dspPresetSettings('gaming', DSP_DEFAULTS);
  if (!gaming) {
    throw new Error('Gaming missing');
  }
  applyDspSettings(gaming);
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
  await act(async () => {
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^None/ }));
  });
  expect(readDspSettings()).toEqual({
    ...gaming,
    enabled: false,
    gameMode: false,
  });
});

it('applies an APO tonal curve and keeps DSP and Game mode off for a quick Gaming pick', async () => {
  mockEngine = 'apo';
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
  await act(async () => {
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Gaming/ }));
  });
  expect(setVoicing).toHaveBeenCalledWith(
    'dsp:gaming',
    1,
    expect.objectContaining({ enabled: true }),
  );
  expect(readDspSettings()).toMatchObject({
    presetId: 'gaming',
    enabled: false,
    gameMode: false,
  });
  // Written down, so a switch to the FluidEQ Engine puts this preset's rack
  // on (`RackFollowsEngine`) — and nothing else's.
  expect(rackHeldForApo()).toBe('gaming');
});

it('lets go of an APO hold when a pick sets the rack itself', async () => {
  holdRackForApo('movie');
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
  await act(async () => {
    fireEvent.click(
      screen.getByRole('menuitemradio', { name: /^Gaming (?!·)/ }),
    );
  });
  expect(readDspSettings()).toMatchObject({
    enabled: true,
    presetId: 'gaming',
  });
  expect(rackHeldForApo()).toBeUndefined();
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
  // the Favorites heading.
  expect(screen.getByText('Favorites')).toBeInTheDocument();
  const rows = screen
    .getAllByRole('menuitemradio')
    .map((row) => row.textContent ?? '');
  expect(rows[0]).toMatch(/^None/);
  expect(rows[1]).toMatch(/^Rock/);
});
