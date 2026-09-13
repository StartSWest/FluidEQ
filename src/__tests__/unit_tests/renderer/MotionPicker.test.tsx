/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The animations row in the tools menu: whether the app animates is the app's
 * own choice, saved for the next launch, and the row says when the running
 * window does not match it yet.
 */

import '@testing-library/jest-dom';
import type * as TestingLibrary from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IMotionPreferenceState } from 'main/ipc/motionPreference';
import type { TMotionPreference } from 'main/motionPreference';
import type { ReactElement } from 'react';

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

const trigger = (fresh: TLibrary) => fresh.screen.getByLabelText('Animations');

describe('the animations row in the tools menu', () => {
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
    expect(trigger(fresh)).toHaveTextContent('Reduced motion');
    expect(fresh.screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('saves Reduced motion and says it applies after a restart, until the choice matches the window again', async () => {
    const { Picker, fresh } = load();
    const user = userEvent.setup();
    fresh.render(<Picker />);
    await fresh.act(async () => answer?.());

    expect(trigger(fresh)).toHaveTextContent('Animations on');
    expect(fresh.screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(trigger(fresh));
    await user.click(fresh.screen.getByLabelText('Reduced motion'));

    expect(setMotionPreference).toHaveBeenCalledWith('reduced');
    expect(await fresh.screen.findByRole('status')).toHaveTextContent(
      'Restart FluidEQ to apply',
    );

    await user.click(trigger(fresh));
    await user.click(fresh.screen.getByLabelText('Animations on'));

    expect(setMotionPreference).toHaveBeenLastCalledWith('full');
    expect(trigger(fresh)).toHaveTextContent('Animations on');
    expect(fresh.screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('reopens on a choice made earlier in the session, restart note included, without waiting for main', async () => {
    const { Picker, fresh } = load();
    const user = userEvent.setup();
    const first = fresh.render(<Picker />);
    await fresh.act(async () => answer?.());
    await user.click(trigger(fresh));
    await user.click(fresh.screen.getByLabelText('Reduced motion'));
    await fresh.screen.findByRole('status');
    first.unmount();
    answer = undefined;

    fresh.render(<Picker />);

    expect(answer).toBeDefined();
    expect(trigger(fresh)).toHaveTextContent('Reduced motion');
    expect(fresh.screen.getByRole('status')).toHaveTextContent(
      'Restart FluidEQ to apply',
    );
  });
});
