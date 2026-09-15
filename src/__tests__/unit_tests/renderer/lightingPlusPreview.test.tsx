/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Dynamic lighting page without Plus: the whole page is there — the way
 * in above it, the switch, the scene, the desk, the devices and every tuning
 * control — and none of it can be worked; every way on leads to Plus.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ILightingDevice } from 'common/lighting/lightingModel';
import { KIND_PREVIEW_LAMPS } from 'common/lighting/lampLayouts';
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

jest.mock('renderer/plus/scenePictures', () => ({
  useScenePicture: () => ({ state: 'none' }),
}));

let demo: { state: string } = { state: 'still' };
jest.mock('renderer/plus/lighting/lightingDemo', () => ({
  useDemoScene: () => ({
    id: 'alpine',
    version: 49,
    lookId: 'locked:alpine',
    names: { en: 'Alpine' },
    fallbackStyle: 'bars',
    swatch: ['#0b1a2e', '#7ad7ff'],
  }),
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

beforeEach(() => {
  requestAccountPanel.mockClear();
  demo = { state: 'still' };
});

it('shows the whole page with nothing to work, and Plus above it', () => {
  render(
    <LightingPlusPreview
      devices={[keyboard]}
      searching={false}
      feed={undefined}
      brightness={0.85}
    />,
  );
  // The way in is the first thing on the page.
  const buttons = screen.getAllByRole('button', { name: 'lighting.gate.cta' });
  expect(buttons.length).toBeGreaterThanOrEqual(2);
  expect(
    document.querySelector('.lighting > :first-child')?.contains(buttons[0]),
  ).toBe(true);
  // The switch is there and out of reach.
  expect(
    screen.getByRole('checkbox', { name: 'lighting.switch' }),
  ).toBeDisabled();
  expect(screen.getByText('lighting.preview.status')).toBeVisible();
  // One scene, named, and every other one behind Plus.
  expect(
    screen.getByText('lighting.scene.title {"scene":"Alpine"}'),
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
    <LightingPlusPreview
      devices={[]}
      searching={false}
      feed={undefined}
      brightness={0.85}
    />,
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

it('names the scene playing on the desk, with the line under it either way', () => {
  demo = { state: 'playing' };
  render(
    <LightingPlusPreview
      devices={[keyboard]}
      searching={false}
      feed={undefined}
      brightness={0.85}
    />,
  );
  expect(
    screen.getByText('lighting.status.live {"scene":"Alpine"}'),
  ).toBeVisible();
  expect(screen.getByText('lighting.preview.held')).toBeVisible();
  // The strip at the top and the line under the desk both lead to Plus.
  expect(
    screen.getAllByRole('button', { name: 'lighting.gate.cta' }),
  ).toHaveLength(2);
});
