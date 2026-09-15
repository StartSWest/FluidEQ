/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Dynamic lighting page without Plus: the whole page is there — the way
 * in above it, the switch, the scene, the desk, the devices and every tuning
 * control — and none of it can be worked; every way on leads to Plus; and
 * what the real devices are doing is said as the main process says it.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  DEFAULT_LIGHTING_SETTINGS,
  type ILightingDevice,
  type ILightingState,
} from 'common/lighting/lightingModel';
import { KIND_PREVIEW_LAMPS } from 'common/lighting/lampLayouts';
import type { IScenePack } from 'common/scenePacks';
import LightingPlusPreview from 'renderer/plus/lighting/LightingPlusPreview';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, values?: Record<string, string | number>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

const requestAccountPanel = jest.fn();
jest.mock('renderer/account/accountPanel', () => ({
  requestAccountPanel: (...args: unknown[]) => requestAccountPanel(...args),
}));

const starter = {
  id: 'lantern-night',
  params: [],
  source: '// starter',
  swatch: ['#0d0b26', '#ff8a4c'],
  names: { en: 'Lantern night' },
} as unknown as IScenePack;
let demo: { state: string; pack?: IScenePack } = {
  state: 'still',
  pack: starter,
};
jest.mock('renderer/plus/lighting/lightingDemo', () => ({
  useLightingDemo: () => demo,
}));

const keyboard: ILightingDevice = {
  key: 'razer:keyboard',
  name: 'Razer DeathStalker V2 Pro TKL',
  kind: 'keyboard',
  form: 'keyboard-tkl',
  route: 'synapse',
  lamps: KIND_PREVIEW_LAMPS.keyboard,
  channel: 'synapse',
  muted: false,
};

const stateWith = (overrides: Partial<ILightingState>): ILightingState => ({
  supported: true,
  searching: false,
  settings: { ...DEFAULT_LIGHTING_SETTINGS, brightness: 0.85 },
  devices: [keyboard],
  synapse: 'running',
  hasRazerDevices: true,
  heldByWindows: [],
  canOpenRazerChroma: false,
  live: false,
  ...overrides,
});

beforeEach(() => {
  requestAccountPanel.mockClear();
  demo = { state: 'still', pack: starter };
  window.electron = {
    ipcRenderer: { openRazerChroma: jest.fn(async () => true) },
  } as unknown as typeof window.electron;
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electron');
});

it('shows the whole page with nothing to work, and Plus above it', () => {
  render(<LightingPlusPreview state={stateWith({})} feed={undefined} />);
  // The way in is the first thing on the page.
  const buttons = screen.getAllByRole('button', { name: 'lighting.gate.cta' });
  expect(buttons.length).toBeGreaterThanOrEqual(2);
  expect(
    document.querySelector('.lighting > :first-child')?.contains(buttons[0]),
  ).toBe(true);
  // The switch is there, off, and pressing it opens the way to Plus rather
  // than doing nothing: a dead switch read as broken.
  const toggle = screen.getByRole('checkbox', { name: 'lighting.switch' });
  expect(toggle).toBeEnabled();
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle);
  expect(requestAccountPanel).toHaveBeenCalledWith('subscribe');
  expect(toggle).not.toBeChecked();
  expect(screen.getByText('lighting.preview.status')).toBeVisible();
  // One scene, named, and every other one behind Plus.
  expect(
    screen.getByText('lighting.scene.title {"scene":"Lantern night"}'),
  ).toBeVisible();
  expect(screen.getByText('lighting.preview.oneScene')).toBeVisible();
  // The devices are their own, listed; nothing on a row can be switched.
  expect(screen.getByText('Razer DeathStalker V2 Pro TKL')).toBeVisible();
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  // Every slider on the page is disabled, the master one included.
  const sliders = screen.getAllByRole('slider');
  expect(sliders.length).toBeGreaterThan(1);
  sliders.forEach((slider) => expect(slider).toBeDisabled());
  expect(
    screen.getByRole('slider', { name: 'lighting.tuning.master' }),
  ).toHaveAttribute('aria-valuetext', '85%');
  // The tuning card says what it is before it shows its controls.
  expect(screen.getByText('lighting.preview.locked')).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'lighting.tuning.reset' }),
  ).toBeDisabled();
  screen
    .getAllByRole('button', { name: /lighting\.effect\./ })
    .forEach((button) => expect(button).toBeDisabled());
});

it('opens the way to Plus from the strip, the scene row and the line under the desk', () => {
  render(
    <LightingPlusPreview state={stateWith({ devices: [] })} feed={undefined} />,
  );
  fireEvent.click(
    screen.getAllByRole('button', { name: 'lighting.gate.cta' })[0],
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'lighting.preview.moreScenes' }),
  );
  fireEvent.click(
    screen.getAllByRole('button', { name: 'lighting.gate.cta' })[1],
  );
  expect(requestAccountPanel.mock.calls).toEqual([
    ['subscribe'],
    ['subscribe'],
    ['subscribe'],
  ]);
  expect(screen.getByText('lighting.preview.held')).toBeVisible();
});

it('says the devices are lit while main sends them the scene, and names it over the desk', () => {
  demo = { state: 'playing', pack: starter };
  render(
    <LightingPlusPreview state={stateWith({ live: true })} feed={undefined} />,
  );
  expect(screen.getByText('lighting.preview.lit')).toBeVisible();
  expect(screen.queryByText('lighting.preview.status')).toBeNull();
  expect(
    screen.getByText('lighting.status.live {"scene":"Lantern night"}'),
  ).toBeVisible();
  expect(screen.getByText('lighting.preview.held')).toBeVisible();
});

it('tells what keeps the devices from lighting, as the live page does', () => {
  render(
    <LightingPlusPreview
      state={stateWith({ live: true, synapse: 'not-running' })}
      feed={undefined}
    />,
  );
  expect(screen.getByText('lighting.notice.chroma.title')).toBeVisible();
});

it('names no scene when main hands none over', () => {
  demo = { state: 'dark' };
  render(<LightingPlusPreview state={stateWith({})} feed={undefined} />);
  expect(screen.getByText('lighting.preview.noScene')).toBeVisible();
  expect(screen.queryByText(/lighting\.status\.live/)).toBeNull();
});
