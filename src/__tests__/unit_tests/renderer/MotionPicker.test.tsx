/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The animations switch in the actions menu's settings tray: whether the app
 * animates is the app's own choice, saved for the next launch, and the row
 * says when the running window does not match it yet. On is full motion, off
 * is reduced.
 */

import '@testing-library/jest-dom';
import type * as TestingLibrary from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IMotionPreferenceState } from 'main/ipc/motionPreference';
import type { TMotionPreference } from 'main/motionPreference';
import type { ReactElement } from 'react';
// Transformed once while the file is collected, where no test's five seconds
// are running. `load()` takes fresh copies from the module registry, but the
// transform behind them is shared, and without these the first test paid for
// compiling the picker and the renderer inside its own budget — it timed out
// in a cold run beside App.test, and passed alone.
import '@testing-library/react/pure';
import '../../../renderer/components/MotionPicker';

type TLibrary = typeof TestingLibrary;

let library: TLibrary | undefined;
let saved: TMotionPreference;
let answer: (() => void) | undefined;
const setMotionPreference = jest.fn(
  async (motion: TMotionPreference): Promise<IMotionPreferenceState> => {
    saved = motion;
    return { chosen: saved, atLaunch: 'full' };
  },
);

beforeEach(() => {
  saved = 'full';
  answer = undefined;
  setMotionPreference.mockClear();
  window.electron = {
    ipcRenderer: {
      motionPreference: () =>
        new Promise<IMotionPreferenceState>((resolve) => {
          answer = () => resolve({ chosen: saved, atLaunch: 'full' });
        }),
      setMotionPreference,
    },
  } as unknown as typeof window.electron;
});

afterEach(() => {
  library?.cleanup();
  library = undefined;
  Reflect.deleteProperty(window, 'matchMedia');
});

/** The row and a renderer from a fresh registry, so no earlier answer is kept. */
const load = () => {
  let Picker: (() => ReactElement) | undefined;
  jest.isolateModules(() => {
    /* eslint-disable global-require -- a fresh module registry is the point */
    library = require('@testing-library/react/pure');
    Picker = require('../../../renderer/components/MotionPicker').default;
    /* eslint-enable global-require */
  });
  if (!Picker || !library) {
    throw new Error('MotionPicker did not load');
  }
  return { Picker, fresh: library };
};

const animations = (fresh: TLibrary) =>
  fresh.screen.getByRole('checkbox', { name: 'Animations' });

describe('the animations switch in the actions menu', () => {
  it('is named by its row, so pressing the word flips it too', async () => {
    const { Picker, fresh } = load();
    const user = userEvent.setup();
    fresh.render(<Picker />);
    await fresh.act(async () => answer?.());

    await user.click(fresh.screen.getByText('Animations'));

    expect(setMotionPreference).toHaveBeenCalledWith('reduced');
  });

  it('shows what the window runs from its first frame, before main has answered', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
      }),
    });
    const { Picker, fresh } = load();

    fresh.render(<Picker />);

    expect(answer).toBeDefined();
    expect(animations(fresh)).not.toBeChecked();
    expect(fresh.screen.queryByRole('status')).not.toBeInTheDocument();
  });

  // Off is felt at once: the choice is written on the document, where one
  // rule stands every animation and transition down. It used to be a launch
  // switch alone, so the switch did nothing at all until the next start.
  it('stands the window down the moment it is switched off, with no restart asked for', async () => {
    const { Picker, fresh } = load();
    const user = userEvent.setup();
    fresh.render(<Picker />);
    await fresh.act(async () => answer?.());

    expect(animations(fresh)).toBeChecked();
    expect(fresh.screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(animations(fresh));

    expect(setMotionPreference).toHaveBeenCalledWith('reduced');
    await fresh.waitFor(() =>
      expect(document.documentElement).toHaveAttribute(
        'data-motion',
        'reduced',
      ),
    );
    expect(animations(fresh)).not.toBeChecked();
    // Nothing to restart for: this window is already still.
    expect(fresh.screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(animations(fresh));

    expect(setMotionPreference).toHaveBeenLastCalledWith('full');
    await fresh.waitFor(() => expect(animations(fresh)).toBeChecked());
    expect(document.documentElement).toHaveAttribute('data-motion', 'full');
    expect(fresh.screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('reopens on a choice made earlier in the session, without waiting for main', async () => {
    const { Picker, fresh } = load();
    const user = userEvent.setup();
    const first = fresh.render(<Picker />);
    await fresh.act(async () => answer?.());
    await user.click(animations(fresh));
    await fresh.waitFor(() =>
      expect(document.documentElement).toHaveAttribute(
        'data-motion',
        'reduced',
      ),
    );
    first.unmount();
    answer = undefined;

    fresh.render(<Picker />);

    expect(answer).toBeDefined();
    expect(animations(fresh)).not.toBeChecked();
    expect(fresh.screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
