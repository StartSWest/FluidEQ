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

/*
 * None here is None on the DSP page too (Ivan, 2026-09-22): the None chain
 * on the rack, so that page's picker names it rather than the chain that was
 * taken away, and the rack off, because an empty rack still delays the sound.
 * It used to switch the rack off and leave Gaming on it, named on the DSP
 * page and back the moment the rack was switched on again.
 */
it('None puts None on the DSP page too, with the rack and Game mode off', async () => {
  const music = dspPresetSettings('music', DSP_DEFAULTS);
  const none = dspPresetSettings('empty', DSP_DEFAULTS);
  if (!music || !none) {
    throw new Error('Music or None missing');
  }
  applyDspSettings({
    ...music,
    gameMode: true,
    surround: { allChannels: false },
  });
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
  await act(async () => {
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^None/ }));
  });
  expect(readDspSettings()).toEqual({
    ...none,
    enabled: false,
    gameMode: false,
    // The listener's own, which a pick never takes.
    surround: { allChannels: false },
  });
  // POSITIVE CONTROL: Music's stages were on, there to be taken away.
  expect(music.dimension.enabled && music.maximizer.enabled).toBe(true);
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
  // the Favourites heading — spelled as the DSP page's and the Library's.
  expect(screen.getByText('Favourites')).toBeInTheDocument();
  const rows = screen
    .getAllByRole('menuitemradio')
    .map((row) => row.textContent ?? '');
  expect(rows[0]).toMatch(/^None/);
  expect(rows[1]).toMatch(/^Rock/);
});
