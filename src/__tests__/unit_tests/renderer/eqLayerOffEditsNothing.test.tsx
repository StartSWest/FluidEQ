/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The EQ layer switched off from its chip: its bands stay where they are and
 * edit nothing until it is back on — and nothing else on the page goes with
 * them.
 *
 * Two faults, both behind a stylesheet that jsdom cannot apply. The bands
 * were held still by `pointer-events: none` alone, so every slider and every
 * handle on the graph stayed a tab stop that moved its band from the
 * keyboard. And the rule dimmed and froze the whole row, the Tone's Bass, Mid
 * and Treble and the two cuts with it — a layer and a setting of their own,
 * still playing. The page's markup is read here, and the compiled stylesheet
 * is held against it.
 *
 * Mounted as the window mounts it: the whole shell with the real Bands page,
 * main answering the one request that takes the page past its spinner.
 */

import '@testing-library/jest-dom';
import { act, cleanup, render, screen } from '@testing-library/react';
import ChannelEnum from 'common/channels';
import { getDefaultState, TApoLayer } from 'common/constants';
import { DISCLAIMER_ACCEPTED_KEY, buildAcceptance } from 'common/disclaimer';
import App from 'renderer/App';
import { setGraphView } from 'renderer/utils/graphViewSettings';
import { compileStylesheet, styleRules } from '__tests__/utils/stylesheetRules';

const DIMMING = styleRules(compileStylesheet('GraphTheme.scss')).filter(
  ({ selectors, declarations }) =>
    declarations.has('opacity') &&
    selectors.some((selector) => selector.includes('is-eq-bypassed')),
);
/** Dimmed by a rule on it or on anything it sits in: opacity carries down. */
const isDimmed = (element: Element | null): boolean =>
  element !== null &&
  (DIMMING.some(({ selectors }) =>
    selectors.some((selector) => element.matches(selector)),
  ) ||
    isDimmed(element.parentElement));

type TListener = (...args: unknown[]) => void;

/** Main, answering the state request as its handler does, and nothing else. */
const installMain = (bypassed: TApoLayer[]) => {
  const listeners = new Map<string, TListener[]>();
  const subscribe = (channel: string, listener: TListener) => {
    listeners.set(channel, [...(listeners.get(channel) ?? []), listener]);
    return () => {
      listeners.set(
        channel,
        (listeners.get(channel) ?? []).filter((each) => each !== listener),
      );
    };
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    get: () => ({
      platform: 'win32',
      ipcRenderer: {
        sendMessage: (channel: string, _args: unknown[], id?: unknown) => {
          if (channel !== ChannelEnum.GET_STATE) {
            return;
          }
          Promise.resolve().then(() =>
            (listeners.get(channel) ?? []).forEach((listener) =>
              listener({ result: { ...getDefaultState(), bypassed } }, id),
            ),
          );
        },
        on: subscribe,
        onOutputMirrorsReset: (listener: () => void) =>
          subscribe('output-mirrors-reset', listener),
        removeListener: () => {},
        getWindowState: async () => ({
          mode: 'app',
          isMaximized: false,
          isFullScreen: false,
        }),
        setWindowFullScreen: async (next: boolean) => next,
        minimizeWindow: async () => {},
        toggleMaximizeWindow: async () => false,
        closeWindow: async () => {},
      },
    }),
  });
};

/** The shell, with the state answered and the Bands page past its spinner. */
const renderShell = async (bypassed: TApoLayer[]) => {
  installMain(bypassed);
  const rendered = render(<App />);
  await act(async () => Promise.resolve());
  await act(async () => Promise.resolve());
  screen.getByRole('heading', { level: 2, name: /Parametric EQ/ });
  const part = (selector: string) => {
    const element = rendered.container.querySelector(selector);
    if (!element) {
      throw new Error(`the Bands page drew no ${selector}`);
    }
    return element;
  };
  return {
    labels: part('.eq-band-labels'),
    rail: part('.bands-rail'),
    tone: part('.eq-flat-editor--tone'),
    handles: Array.from(
      rendered.container.querySelectorAll('.graph-edit-point'),
    ),
  };
};

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(
    DISCLAIMER_ACCEPTED_KEY,
    JSON.stringify(buildAcceptance('1.2.0', 'en')),
  );
  // The bands' readouts on, which a fresh install hides.
  window.localStorage.setItem('fluideq.graphBandLabelsHidden.normal', 'false');
  setGraphView('normal');
  // The graph draws its curves in with a dash the length of the path, and
  // jsdom has no geometry to measure one with.
  Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
    configurable: true,
    value: () => 100,
  });
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  setGraphView('normal');
});

it('takes the bands off the keyboard, on the graph and in the row', async () => {
  const { rail, handles, labels } = await renderShell(['eq']);
  expect(rail).toHaveAttribute('inert');
  // Their readouts on the graph go quiet with them.
  expect(isDimmed(labels)).toBe(true);
  expect(handles.length).toBeGreaterThan(0);
  handles.forEach((handle) => {
    expect(handle).toHaveAttribute('tabindex', '-1');
    expect(handle).toHaveAttribute('aria-disabled', 'true');
  });
  expect(isDimmed(rail)).toBe(true);
});

it('leaves the Tone and the cuts beside the bands live and undimmed', async () => {
  const { tone } = await renderShell(['eq']);
  expect(tone.closest('[inert]')).toBeNull();
  expect(isDimmed(tone)).toBe(false);
  // Every dial on it still turns.
  const dials = Array.from(tone.querySelectorAll('input[type="range"]'));
  expect(dials.length).toBe(5);
  dials.forEach((dial) => expect(dial).toBeEnabled());
});

it('leaves the bands on the keyboard while the EQ is on (positive control)', async () => {
  const { rail, handles, labels } = await renderShell([]);
  expect(rail).not.toHaveAttribute('inert');
  expect(isDimmed(labels)).toBe(false);
  expect(handles.length).toBeGreaterThan(0);
  handles.forEach((handle) => expect(handle).toHaveAttribute('tabindex', '0'));
  expect(isDimmed(rail)).toBe(false);
});
