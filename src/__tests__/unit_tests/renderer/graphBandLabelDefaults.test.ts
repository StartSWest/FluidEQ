/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { TGraphView } from 'renderer/utils/graphViewSettings';
import { forgetSettings } from 'renderer/utils/settingsReset';

type TViewSettings = typeof import('renderer/utils/graphViewSettings');
const MODES: TGraphView[] = ['normal', 'expanded', 'fullscreen'];
const LABELS_KEY = 'fluideq.graphBandLabelsHidden';

const load = (): TViewSettings => {
  // Filled inside the callback, which control flow cannot follow into.
  const loaded: { settings?: TViewSettings } = {};
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require -- a fresh copy of the module, read with nothing stored yet
    loaded.settings = require('renderer/utils/graphViewSettings');
  });
  if (!loaded.settings) {
    throw new Error('graphViewSettings did not load');
  }
  return loaded.settings;
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

/**
 * Only Everything and Without EQ labels are about the labels, so only they
 * move the labels' own preference. Every other state wrote it too: Ctrl+W
 * through Layers turned labels hidden by default on for good.
 */
it('leaves the label preference alone through the states that are not about labels', () => {
  const settings = load();
  ['layers', 'curves', 'clean', 'wave'].forEach((state) => {
    settings.setGraphContents(
      state as Parameters<typeof settings.setGraphContents>[0],
    );
    expect(settings.getGraphBandLabelsHidden()).toBe(true);
  });
  expect(window.localStorage.getItem(`${LABELS_KEY}.normal`)).toBeNull();
  // Positive control: the state that is about them does move it.
  settings.setGraphContents('everything');
  expect(settings.getGraphBandLabelsHidden()).toBe(false);
});

it.each([
  ['hidden', true, 'unlabelled'],
  ['shown', false, 'everything'],
] as const)(
  'leaves Clean by the wave toggle or a curve chip with the labels %s as they were',
  (_name, hidden, back) => {
    const settings = load();
    settings.setGraphContents(hidden ? 'unlabelled' : 'everything');
    settings.setGraphContents('clean');
    settings.toggleGraphWave();
    expect(settings.getGraphContents()).toBe(back);
    expect(settings.getGraphBandLabelsHidden()).toBe(hidden);

    settings.setGraphContents('clean');
    settings.toggleGraphCurve('eq');
    expect(settings.getGraphContents()).toBe(back);
    expect(settings.getGraphBandLabelsHidden()).toBe(hidden);
  },
);
