/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IAppUpdateStatus } from 'common/constants';
import { LATEST_RELEASE_URL } from 'common/branding';
import {
  MANDATORY_UPDATE_FIELD,
  MANDATORY_UPDATE_VALUE,
} from 'common/mandatoryUpdate';
import MandatoryUpdateModal, {
  REMINDER_INTERVAL_MS,
} from 'renderer/components/MandatoryUpdateModal';
import UpdateNotice from 'renderer/components/UpdateNotice';
import { I18nProvider } from 'renderer/utils/I18nContext';

/** Whatever the component subscribed to APP_UPDATE_EVENT with. */
let listener: ((...args: unknown[]) => void) | undefined;
let installCalls = 0;
let installResult: () => Promise<void>;

const mountElectron = () => {
  listener = undefined;
  installCalls = 0;
  installResult = () => Promise.resolve();
  window.electron = {
    ipcRenderer: {
      on: (_channel: string, handler: (...args: unknown[]) => void) => {
        listener = handler;
        return () => {
          listener = undefined;
        };
      },
      installUpdate: () => {
        installCalls += 1;
        return installResult();
      },
    },
  } as unknown as typeof window.electron;
};

/** What main would have sent. */
const emit = (status: IAppUpdateStatus) => {
  act(() => {
    listener?.(status);
  });
};

const show = () =>
  render(
    <I18nProvider>
      <MandatoryUpdateModal />
    </I18nProvider>,
  );

/** The one that does the update, as opposed to close and "Not now". */
const installButton = () =>
  screen.getByRole('button', { name: /Install and restart|Installing/ });

beforeEach(() => {
  mountElectron();
});

/**
 * The notice, everything that must not raise it, and that it comes back.
 *
 * Three groups of assertions, in descending order of how much they matter:
 *
 *   - the ones that expect nothing on screen. Interrupting somebody is the
 *     correct response to exactly one signal and the wrong response to a bug, a
 *     truthy value, a dropped connection, or a check that never ran;
 *   - the ones about the reminder. It closes now, so "cannot be forgotten" is
 *     carried entirely by a timer, and a timer is the sort of thing that works
 *     until somebody adds a second one;
 *   - the ones about the failure path, which survived the change from a gate to
 *     a notice and is now reachable from a dialog the user can also close.
 */
describe('the mandatory update notice', () => {
  describe('stays out of the way when', () => {
    it('no update check has said anything at all', () => {
      show();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('an ordinary update is available', () => {
      show();
      emit({ phase: 'available', version: '1.3.0' });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('an ordinary update finishes downloading', () => {
      show();
      emit({ phase: 'available', version: '1.3.0' });
      emit({ phase: 'downloading', percent: 50 });
      emit({ phase: 'ready', version: '1.3.0' });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('the flag arrives as false', () => {
      show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: false });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it.each([
      ['a string', 'required'],
      ['the string "true"', 'true'],
      ['the number 1', 1],
      ['an object', {}],
      ['an array', ['required']],
      ['null', null],
    ])(
      'the flag arrives over IPC as %s rather than boolean true',
      (_l, flag) => {
        // `isMandatory === true` and not a truthy test. Nothing that crosses a
        // process boundary should be able to block an app by being coincidentally
        // truthy.
        show();
        emit({
          phase: 'available',
          version: '1.3.0',
          isMandatory: flag,
        } as unknown as IAppUpdateStatus);
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      },
    );

    it('main sends nothing but an empty payload', () => {
      show();
      act(() => {
        listener?.(undefined);
        listener?.(null);
      });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  describe('once a release has explicitly said so', () => {
    it('opens over the workspace and says why', () => {
      show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: true });
      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog.textContent).toContain(
        'This release fixes a problem serious enough',
      );
    });

    it('says plainly that closing it is a postponement, not a decline', () => {
      // The failure mode of a dismissable notice is that it reads like an
      // ordinary update banner. This sentence is the only thing standing
      // between the two, so it is asserted rather than assumed.
      show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: true });
      const text = screen.getByRole('alertdialog').textContent ?? '';
      expect(text).toContain('This is not an optional update');
      expect(text).toContain('it will come back');
    });

    it('closes on the close button', async () => {
      show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: true });
      await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('closes on "Not now"', async () => {
      show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: true });
      await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('closes on Escape', async () => {
      show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: true });
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('closes on a click on the backdrop', async () => {
      const { container } = show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: true });
      const backdrop = container.querySelector('.overlay-card__backdrop');
      expect(backdrop).not.toBeNull();
      await userEvent.click(backdrop as Element);
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('does not close on a click inside it', async () => {
      show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: true });
      await userEvent.click(screen.getByRole('alertdialog'));
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('leaves the rest of the app reachable by keyboard', async () => {
      // The whole point of the change: no focus lock. A control behind it can
      // still be tabbed to, which under the previous blocking version could
      // not happen.
      const outside = document.createElement('button');
      outside.textContent = 'behind';
      document.body.appendChild(outside);
      show();
      emit({ phase: 'ready', version: '1.3.0', isMandatory: true });
      act(() => {
        outside.focus();
      });
      expect(outside).toHaveFocus();
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      outside.remove();
    });

    it('does not swallow Escape from the rest of the app', async () => {
      // The focus lock used to stop Escape at the capture phase on `document`,
      // which meant nothing else in the app could see the key for as long as
      // the dialog lived. Taking the lock off has to have taken that with it —
      // asserted with a bubble-phase listener, which is precisely what a
      // capture-phase `stopPropagation` on the same node would have starved.
      let escapesSeen = 0;
      const onKeyDown = () => {
        escapesSeen += 1;
      };
      document.addEventListener('keydown', onKeyDown);
      try {
        show();
        emit({ phase: 'available', version: '1.3.0', isMandatory: true });
        await userEvent.keyboard('{Escape}');
        expect(escapesSeen).toBe(1);
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        await userEvent.keyboard('{Escape}');
        expect(escapesSeen).toBe(2);
      } finally {
        document.removeEventListener('keydown', onKeyDown);
      }
    });

    it('takes focus when it opens, and does not hold on to it', () => {
      show();
      emit({ phase: 'ready', version: '1.3.0', isMandatory: true });
      expect(screen.getByRole('alertdialog')).toHaveFocus();
    });

    it('does not offer to install anything before there is anything to install', () => {
      show();
      emit({ phase: 'downloading', percent: 40, isMandatory: true });
      expect(installButton()).toBeDisabled();
      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '40',
      );
    });

    it('installs when asked, once the download is there', async () => {
      show();
      emit({ phase: 'ready', version: '1.3.0', isMandatory: true });
      await userEvent.click(installButton());
      expect(installCalls).toBe(1);
    });

    it('stays pending when a later check says nothing about it', () => {
      // The hourly re-check must not cancel the whole thing the first time the
      // network drops out.
      show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: true });
      emit({ phase: 'available', version: '1.3.0' });
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  describe('when the update cannot be installed', () => {
    const releaseLink = () =>
      screen.getByRole('link', { name: /download page/i });

    it('says the download failed, and offers the release page', () => {
      show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: true });
      emit({ phase: 'failed', isMandatory: true, failure: 'download' });
      expect(screen.getByRole('alertdialog').textContent).toContain(
        'The update could not be downloaded',
      );
      expect(releaseLink()).toHaveAttribute('href', LATEST_RELEASE_URL);
    });

    it('distinguishes an installer that would not start', () => {
      show();
      emit({ phase: 'ready', version: '1.3.0', isMandatory: true });
      emit({ phase: 'failed', isMandatory: true, failure: 'install' });
      expect(screen.getByRole('alertdialog').textContent).toContain(
        'the installer did not start',
      );
    });

    it('writes the address out as well as linking it', () => {
      // For the case where the browser will not open from here, which is one
      // of the ways this modal could otherwise become a dead end.
      show();
      emit({ phase: 'failed', isMandatory: true, failure: 'download' });
      expect(screen.getByRole('alertdialog').textContent).toContain(
        LATEST_RELEASE_URL,
      );
    });

    it('explains itself when the install request is rejected', async () => {
      show();
      emit({ phase: 'ready', version: '1.3.0', isMandatory: true });
      installResult = () => Promise.reject(new Error('quitAndInstall threw'));
      await userEvent.click(installButton());
      await waitFor(() =>
        expect(releaseLink()).toHaveAttribute('href', LATEST_RELEASE_URL),
      );
      expect(screen.getByRole('alertdialog').textContent).toContain(
        'the installer did not start',
      );
    });

    it('explains itself when the install request never settles', async () => {
      // The failure a `catch` cannot see: `quitAndInstall` returning without
      // quitting and without throwing, which is what a downloaded file that
      // fails verification actually does. Without the timeout this is a dialog
      // reading "Installing…" forever.
      jest.useFakeTimers();
      try {
        show();
        emit({ phase: 'ready', version: '1.3.0', isMandatory: true });
        installResult = () =>
          new Promise<void>(() => {
            // Never settles, which is the whole point.
          });
        await userEvent
          .setup({ advanceTimers: jest.advanceTimersByTime })
          .click(installButton());
        expect(screen.getByRole('alertdialog').textContent).toContain(
          'Installing…',
        );
        act(() => {
          jest.advanceTimersByTime(20000);
        });
        expect(releaseLink()).toHaveAttribute('href', LATEST_RELEASE_URL);
      } finally {
        jest.useRealTimers();
      }
    });

    it('is still closable, and still comes back with the failure intact', () => {
      jest.useFakeTimers();
      try {
        show();
        emit({ phase: 'failed', isMandatory: true, failure: 'download' });
        act(() => {
          screen.getByRole('button', { name: 'Not now' }).click();
        });
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

        act(() => {
          jest.advanceTimersByTime(REMINDER_INTERVAL_MS);
        });
        // The reason and the manual route survive the round trip; they are
        // state, not something the open dialog computed once.
        expect(screen.getByRole('alertdialog').textContent).toContain(
          'The update could not be downloaded',
        );
        expect(releaseLink()).toHaveAttribute('href', LATEST_RELEASE_URL);
      } finally {
        jest.useRealTimers();
      }
    });

    it('clears the complaint if a later check gets further', () => {
      show();
      emit({ phase: 'failed', isMandatory: true, failure: 'download' });
      emit({ phase: 'downloading', percent: 10, isMandatory: true });
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  /**
   * Closable, but not forgettable.
   *
   * This is what replaces the lock. Everything here runs on fake timers, and
   * the two assertions that matter most are the ones about a timer that must
   * *not* exist: one while the dialog is already open, and one after the
   * component has gone.
   */
  describe('coming back after a dismissal', () => {
    const dismiss = () =>
      act(() => {
        screen.getByRole('button', { name: 'Not now' }).click();
      });

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('re-opens once the interval has passed', () => {
      show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: true });
      dismiss();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(REMINDER_INTERVAL_MS);
      });
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('stays closed until the interval has actually passed', () => {
      show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: true });
      dismiss();
      act(() => {
        jest.advanceTimersByTime(REMINDER_INTERVAL_MS - 1);
      });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('keeps coming back, dismissal after dismissal', () => {
      show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: true });
      for (let round = 0; round < 3; round += 1) {
        dismiss();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        act(() => {
          jest.advanceTimersByTime(REMINDER_INTERVAL_MS);
        });
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      }
    });

    it('does not stack a reminder on a dialog that is already open', () => {
      // The timer exists only while dismissed, so an open dialog has nothing
      // pending that could fire into it. Left running for four intervals to
      // prove no queue of them built up while it was on screen.
      show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: true });
      act(() => {
        jest.advanceTimersByTime(REMINDER_INTERVAL_MS * 4);
      });
      expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
    });

    it('schedules nothing at all before a mandatory release has been seen', () => {
      show();
      emit({ phase: 'available', version: '1.3.0' });
      act(() => {
        jest.advanceTimersByTime(REMINDER_INTERVAL_MS * 4);
      });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('stops once the component is gone', () => {
      // A window closed fourteen minutes into a wait must not leave a timer
      // that sets state on a component that no longer exists.
      const { unmount } = show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: true });
      dismiss();
      expect(jest.getTimerCount()).toBe(1);
      unmount();
      expect(jest.getTimerCount()).toBe(0);
      act(() => {
        jest.advanceTimersByTime(REMINDER_INTERVAL_MS * 2);
      });
    });

    it('comes straight back when the download finishes, without waiting', () => {
      // New information earns its way through a dismissal. The user closed a
      // dialog that said "fetching"; "ready to install" is not that dialog.
      show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: true });
      dismiss();
      emit({ phase: 'ready', version: '1.3.0', isMandatory: true });
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('comes straight back when something fails, without waiting', () => {
      show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: true });
      dismiss();
      emit({ phase: 'failed', isMandatory: true, failure: 'download' });
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('does not come back for mere progress', () => {
      // Otherwise a dismissal would last about a second, which is the same as
      // not being closable at all.
      show();
      emit({ phase: 'available', version: '1.3.0', isMandatory: true });
      dismiss();
      emit({ phase: 'downloading', percent: 20, isMandatory: true });
      emit({ phase: 'downloading', percent: 60, isMandatory: true });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });
});

/**
 * The banner is the thing that steps aside, not the modal.
 *
 * Both subscribe to the same event, so without this they would both draw the
 * same version number — one in a dialog that cannot be closed and one in a
 * strip underneath it with a close button.
 */
describe('the ordinary update banner', () => {
  const showBanner = () =>
    render(
      <I18nProvider>
        <UpdateNotice />
      </I18nProvider>,
    );

  it('appears for an ordinary update', () => {
    showBanner();
    emit({ phase: 'available', version: '1.3.0' });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('stands down for a mandatory one', () => {
    showBanner();
    emit({ phase: 'available', version: '1.3.0', isMandatory: true });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('stays stood down once it has', () => {
    showBanner();
    emit({ phase: 'available', version: '1.3.0', isMandatory: true });
    emit({ phase: 'ready', version: '1.3.0' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

/**
 * The one line the release author actually types, asserted against the constants.
 *
 * Not a test of behaviour — a test that the two halves of the mechanism agree,
 * because they live in different processes and are joined only by a string in a
 * YAML file that nothing else compares.
 */
describe('the flag as it appears in latest.yml', () => {
  it('is the field and value the build writes', () => {
    expect(`${MANDATORY_UPDATE_FIELD}: ${MANDATORY_UPDATE_VALUE}`).toBe(
      'fluidEqMandatoryUpdate: required',
    );
  });
});
