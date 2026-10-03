/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { TGraphView } from 'renderer/utils/graphViewSettings';
import { forgetSettings } from 'renderer/utils/settingsReset';

type TViewSettings = typeof import('renderer/utils/graphViewSettings');
const MODES: TGraphView[] = ['normal', 'expanded', 'fullscreen'];
const LABELS_KEY = 'fluideq.graphBandLabelsHidden';

const load = (): TViewSettings => {
  let settings: TViewSettings;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    settings = require('renderer/utils/graphViewSettings');
  });
  return settings!;
};

beforeEach(() => window.localStorage.clear());

it('starts every graph view with labels hidden without saving an implicit choice', () => {
  const settings = load();
  MODES.forEach((mode) => {
    settings.setGraphView(mode);
    expect(settings.getGraphBandLabelsHidden()).toBe(true);
    expect(settings.getGraphContents()).toBe('unlabelled');
    expect(window.localStorage.getItem(`${LABELS_KEY}.${mode}`)).toBeNull();
  });
});

it('preserves an explicit show choice across restart while untouched views stay hidden', () => {
  const settings = load();
  settings.toggleGraphBandLabels();
  expect(settings.getGraphBandLabelsHidden()).toBe(false);
  expect(window.localStorage.getItem(`${LABELS_KEY}.normal`)).toBe('false');

  const restarted = load();
  expect(restarted.getGraphBandLabelsHidden()).toBe(false);
  MODES.filter((mode) => mode !== 'normal').forEach((mode) => {
    restarted.setGraphView(mode);
    expect(restarted.getGraphBandLabelsHidden()).toBe(true);
  });
});

it.each(['true', 'false'])(
  'preserves an existing saved visibility value of %s',
  (stored) => {
    MODES.forEach((mode) =>
      window.localStorage.setItem(`${LABELS_KEY}.${mode}`, stored),
    );
    const settings = load();
    MODES.forEach((mode) => {
      settings.setGraphView(mode);
      expect(settings.getGraphBandLabelsHidden()).toBe(stored === 'true');
      expect(window.localStorage.getItem(`${LABELS_KEY}.${mode}`)).toBe(stored);
    });
  },
);

it.each(['true', 'false'])(
  'preserves legacy visibility of %s on startup',
  (stored) => {
    window.localStorage.setItem(LABELS_KEY, stored);
    const settings = load();
    MODES.forEach((mode) => {
      settings.setGraphView(mode);
      expect(settings.getGraphBandLabelsHidden()).toBe(stored === 'true');
      expect(window.localStorage.getItem(`${LABELS_KEY}.${mode}`)).toBe(stored);
    });
    expect(window.localStorage.getItem(LABELS_KEY)).toBeNull();
  },
);

it('Reset All clears legacy and per-view choices and reloads with labels hidden', () => {
  const settings = load();
  MODES.forEach((mode) => {
    settings.setGraphView(mode);
    settings.setGraphContents('everything');
    expect(settings.getGraphBandLabelsHidden()).toBe(false);
  });
  window.localStorage.setItem(LABELS_KEY, 'false');
  window.localStorage.setItem('fluideq.dsp.v1', '{"savedSound":true}');

  // ResetSettingsDialog forgets settings and then reloads the renderer.
  forgetSettings(window.localStorage);
  expect(window.localStorage.getItem(LABELS_KEY)).toBeNull();
  MODES.forEach((mode) => {
    expect(window.localStorage.getItem(`${LABELS_KEY}.${mode}`)).toBeNull();
  });
  expect(window.localStorage.getItem('fluideq.dsp.v1')).toBe(
    '{"savedSound":true}',
  );

  const restarted = load();
  MODES.forEach((mode) => {
    restarted.setGraphView(mode);
    expect(restarted.getGraphBandLabelsHidden()).toBe(true);
    expect(restarted.getGraphContents()).toBe('unlabelled');
  });
});
