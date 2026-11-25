/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { dspPresetSettings } from 'common/dsp/presets';
import defaultContext from '__tests__/utils/mockFluidEqProvider';
import { applyDspSettings, readDspSettings } from 'renderer/dsp/store';
import { readFavouriteDspPresets } from 'renderer/dsp/favouriteDspPresets';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import { setVoicing } from 'renderer/utils/equalizerApi';
import WavePresetMusic from 'renderer/shell/wavePreset/WavePresetMusic';

/*
 * The titlebar plate's panel (Ivan, 2026-11-25, design A): one field that
 * searches every preset, a star on every row, Ctrl+D, Undo, and favourites
 * that stay where they stood while the panel is open.
 */

jest.mock('renderer/dsp/systemChain', () => ({
  sendSystemDspChain: jest.fn(),
}));
const mockStatus = {
  engine: 'fluid',
  apo: { installed: false },
  fluid: { installed: true, dllVersion: '1.30.0.0' },
};
jest.mock('renderer/utils/useAudioEngineStatus', () => ({
  useKnownAudioEngineStatus: () => mockStatus,
}));
jest.mock('renderer/eq/openEqPresetTab', () => jest.fn());
// The head's curve reads how the graph draws the Preset layer, which asks
// main for the treble choice and the output's rate; with no bridge here it
// is drawn as before either is known, as the window does too.
jest.mock('renderer/utils/useTrebleDesigns', () => ({
  ...jest.requireActual('renderer/utils/useTrebleDesigns'),
  useTrebleDesigns: () => undefined,
}));
jest.mock('renderer/utils/useOutputRate', () => () => undefined);
jest.mock('renderer/utils/equalizerApi', () => ({
  setVoicing: jest.fn(),
  readUserPresets: jest.fn(async () => []),
  writeUserPresets: jest.fn(async () => true),
}));

const show = () =>
  render(
    <FluidEqProviderWrapper
      value={{ ...defaultContext, isEnabled: true, isBlockingError: false }}
    >
      <WavePresetMusic />
    </FluidEqProviderWrapper>,
  );

const open = () => {
  fireEvent.click(screen.getByRole('button', { name: /preset/i }));
  return screen.getByRole('menu', { name: 'Presets' });
};
const field = () =>
  screen.getByRole('textbox', { name: 'Search every preset' });
const type = (text: string) =>
  fireEvent.change(field(), { target: { value: text } });
const rowNamed = (name: RegExp) => screen.getByRole('menuitemradio', { name });

beforeEach(() => {
  localStorage.clear();
  applyDspSettings({ ...DSP_DEFAULTS, enabled: false });
  jest.clearAllMocks();
  jest.mocked(setVoicing).mockReset().mockResolvedValue(undefined);
});

it('opens on None and the favourites, with a field over every preset', () => {
  show();
  const menu = open();
  expect(field()).toHaveAttribute(
    'placeholder',
    expect.stringMatching(/^Type to search all \d{3} presets$/),
  );
  expect(within(menu).getByText('Favourites')).toBeInTheDocument();
  // The six stars a first run starts with (`DEFAULT_DSP_FAVOURITES`).
  expect(rowNamed(/^None/)).toBeInTheDocument();
  expect(rowNamed(/^Warm/)).toBeInTheDocument();
  expect(rowNamed(/^Podcast/)).toBeInTheDocument();
  // A preset nobody starred is only a search away, never listed here.
  expect(
    screen.queryByRole('menuitemradio', { name: /^Drum & bass/ }),
  ).not.toBeInTheDocument();
});

it('finds by name first, then by what a preset does, with the match lit', () => {
  show();
  const menu = open();
  type('bass');
  const drumBass = rowNamed(/^Drum & bass/);
  expect(
    within(drumBass).getByText('bass', { selector: 'mark' }),
  ).toBeVisible();
  // Late night runs Bass Forge: found by what it does, and its row says so.
  const lateNight = rowNamed(/^Late night/);
  expect(lateNight).toHaveTextContent('Runs Bass Forge');
  expect(within(menu).getByText('By what it does')).toBeInTheDocument();
  // Names stand before what the others do, and the count is every row.
  const rows = within(menu).getAllByRole('menuitemradio');
  expect(rows.indexOf(drumBass)).toBeLessThan(rows.indexOf(lateNight));
  expect(within(menu).getByText(`${rows.length} found`)).toBeInTheDocument();
  expect(
    within(menu).getByText(`All ${rows.length} presets for`, { exact: false }),
  ).toBeInTheDocument();
});

it('says what it looked at when nothing is found, and offers words that find something', () => {
  show();
  open();
  type('polka');
  expect(screen.getByText(/^Nothing called/)).toBeInTheDocument();
  expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Car' }));
  expect(field()).toHaveValue('Car');
  expect(rowNamed(/^Car/)).toBeInTheDocument();
});

it('lands on the first find, so typing and Enter plays it', async () => {
  show();
  open();
  type('techno');
  expect(field()).toHaveAttribute(
    'aria-activedescendant',
    rowNamed(/^Techno/).id,
  );
  await act(async () => {
    fireEvent.keyDown(field(), { key: 'Enter' });
  });
  expect(readDspSettings().presetId).toBe('techno');
});

it('walks the finds with the arrows and stops at the ends', () => {
  show();
  open();
  type('pop');
  const rows = screen.getAllByRole('menuitemradio');
  fireEvent.keyDown(field(), { key: 'ArrowUp' });
  expect(field()).toHaveAttribute('aria-activedescendant', rows[0].id);
  fireEvent.keyDown(field(), { key: 'ArrowDown' });
  expect(field()).toHaveAttribute('aria-activedescendant', rows[1].id);
  expect(rows[1]).toHaveClass('is-active');
  // The caret stays in the field, so typing on needs no click back.
  expect(field()).toHaveFocus();
});

it('stars the row the keys are on with Ctrl+D, and Undo takes it back', () => {
  show();
  open();
  type('car');
  expect(readFavouriteDspPresets()).not.toContain('car');
  fireEvent.keyDown(field(), { key: 'd', ctrlKey: true });
  expect(readFavouriteDspPresets()).toContain('car');
  expect(screen.getByRole('status')).toHaveTextContent(
    'Car is in your Favourites',
  );
  expect(
    screen.getByRole('button', { name: 'Remove Car from Favourites' }),
  ).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(readFavouriteDspPresets()).not.toContain('car');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('leaves a Ctrl+D with nothing under the keys alone', () => {
  show();
  open();
  const before = readFavouriteDspPresets();
  // None is under the keys: it takes no star.
  fireEvent.keyDown(field(), { key: 'ArrowDown' });
  fireEvent.keyDown(field(), { key: 'd', ctrlKey: true });
  expect(readFavouriteDspPresets()).toEqual(before);
});

it('keeps an unstarred favourite where it stood, dimmed, until the panel closes', () => {
  show();
  open();
  const namesBefore = screen
    .getAllByRole('menuitemradio')
    .map((row) => row.textContent);
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove Warm from Favourites' }),
  );
  expect(readFavouriteDspPresets()).not.toContain('warm');
  // Nothing moved under the pointer.
  expect(
    screen.getAllByRole('menuitemradio').map((row) => row.textContent),
  ).toEqual(namesBefore);
  expect(rowNamed(/^Warm/)).toHaveClass('is-gone');
  expect(screen.getByRole('status')).toHaveTextContent(
    'Warm left your Favourites',
  );
  // Closed and opened again, it is gone.
  fireEvent.keyDown(field(), { key: 'Escape' });
  open();
  expect(
    screen.queryByRole('menuitemradio', { name: /^Warm/ }),
  ).not.toBeInTheDocument();
});

it('stars what plays from its own row, which stays under None while the panel is open', () => {
  const techno = dspPresetSettings('techno', DSP_DEFAULTS);
  if (!techno) {
    throw new Error('Techno is missing');
  }
  applyDspSettings(techno);
  show();
  open();
  const namesBefore = screen
    .getAllByRole('menuitemradio')
    .map((row) => row.textContent);
  expect(namesBefore[1]).toMatch(/^Techno.*Playing now/);
  fireEvent.click(
    screen.getByRole('button', { name: 'Add Techno to Favourites' }),
  );
  expect(readFavouriteDspPresets()).toContain('techno');
  // Starred, it neither leaves its row nor turns up twice.
  expect(
    screen.getAllByRole('menuitemradio').map((row) => row.textContent),
  ).toEqual(namesBefore);
  // Opened again, it is one of the favourites, ticked where it stands.
  fireEvent.keyDown(field(), { key: 'Escape' });
  open();
  expect(screen.queryByText('Playing now')).not.toBeInTheDocument();
  expect(rowNamed(/^Techno/)).toHaveAttribute('aria-checked', 'true');
});

it('Escape clears the search first, and only then closes', () => {
  show();
  open();
  const plate = screen.getByRole('button', { name: /preset/i });
  type('rock');
  fireEvent.keyDown(field(), { key: 'Escape' });
  expect(field()).toHaveValue('');
  expect(plate).toHaveAttribute('aria-expanded', 'true');
  fireEvent.keyDown(field(), { key: 'Escape' });
  expect(plate).toHaveAttribute('aria-expanded', 'false');
});
