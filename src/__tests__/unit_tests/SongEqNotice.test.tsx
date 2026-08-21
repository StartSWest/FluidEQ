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
import { fireEvent, render, screen } from '@testing-library/react';
import { FilterTypeEnum, ISmartEqSettings } from 'common/constants';
import { translate } from 'common/i18n';
import type { ISongEqEntry } from 'common/songEq';
import type { ISongIdentity } from 'common/songIdentity';
import SongEqNotice from 'renderer/components/SongEqNotice';
import * as session from 'renderer/audio/songEqSession';

/**
 * Everything this module's own reducer and timer already own —
 * whether a match happened, when the toast fades, what Undo and Forget
 * actually do underneath — is proven in `songEqSession.test.tsx`. This suite
 * only proves the one thing that lives here instead: given a notice, does
 * the component draw the right sentence and wire the right button to the
 * right call.
 */
jest.mock('renderer/audio/songEqSession');

const mockUseSongEqNotice = session.useSongEqNotice as jest.Mock;

const IDENTITY: ISongIdentity = {
  key: 'library:black-dog',
  title: 'Black Dog',
  source: 'library',
};

const settingsOf = (gain: number): ISmartEqSettings => ({
  filters: {
    'smart-1000': {
      id: 'smart-1000',
      frequency: 1000,
      gain,
      quality: 1.4,
      type: FilterTypeEnum.PK,
    },
  },
});

const entryOf = (plays: number): ISongEqEntry => ({
  settings: settingsOf(2),
  title: 'Black Dog',
  plays,
  updatedAt: 1,
});

describe('SongEqNotice', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  /**
   * Fails if the `notice === undefined` guard is dropped or inverted — the
   * component would then render its dialog with `undefined.entry` and either
   * throw or draw a broken shell instead of nothing.
   */
  it('draws nothing when no song was matched', () => {
    mockUseSongEqNotice.mockReturnValue(undefined);
    const { container } = render(<SongEqNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  /**
   * Positive control for the test above. Without it, "draws nothing" is
   * satisfied just as well by a component that never renders anything at
   * all — this is what proves the guard is a branch, not the whole function.
   */
  it('names the song it is using a saved curve for', () => {
    mockUseSongEqNotice.mockReturnValue({
      identity: IDENTITY,
      entry: entryOf(3),
    });
    render(<SongEqNotice />);
    expect(
      screen.getByText(translate('en', 'songEq.noticeTitle')),
    ).toBeVisible();
    expect(
      screen.getByText(
        translate('en', 'songEq.noticeBody', {
          title: 'Black Dog',
          plays: 3,
        }),
      ),
    ).toBeVisible();
  });

  /**
   * Fails if either button's class list loses `subtle` — the exact defect
   * CLAUDE.md names by example, and one this notice must not repeat now that
   * neither action is the recommendation.
   */
  it('offers undo and forget, both quiet', () => {
    mockUseSongEqNotice.mockReturnValue({
      identity: IDENTITY,
      entry: entryOf(1),
    });
    render(<SongEqNotice />);
    const undo = screen.getByRole('button', {
      name: translate('en', 'songEq.undo'),
    });
    const forget = screen.getByRole('button', {
      name: translate('en', 'songEq.forget'),
    });
    expect(undo.className).toContain('subtle');
    expect(forget.className).toContain('subtle');
  });

  /**
   * Fails if Undo is wired to the wrong session call, to no call, or to the
   * same call Forget uses.
   */
  it('calls undoSongEqLoan when Undo is pressed', () => {
    mockUseSongEqNotice.mockReturnValue({
      identity: IDENTITY,
      entry: entryOf(1),
    });
    render(<SongEqNotice />);
    fireEvent.click(
      screen.getByRole('button', { name: translate('en', 'songEq.undo') }),
    );
    expect(session.undoSongEqLoan).toHaveBeenCalledTimes(1);
    expect(session.forgetCurrentSongEq).not.toHaveBeenCalled();
  });

  /**
   * Fails if Forget is wired to the wrong session call, to no call, or to the
   * same call Undo uses.
   */
  it('calls forgetCurrentSongEq when Forget is pressed', () => {
    mockUseSongEqNotice.mockReturnValue({
      identity: IDENTITY,
      entry: entryOf(1),
    });
    render(<SongEqNotice />);
    fireEvent.click(
      screen.getByRole('button', { name: translate('en', 'songEq.forget') }),
    );
    expect(session.forgetCurrentSongEq).toHaveBeenCalledTimes(1);
    expect(session.undoSongEqLoan).not.toHaveBeenCalled();
  });

  /**
   * Fails if the guard is written `plays < 1` instead of `plays <= 1`, or
   * reads `entry.plays` as truthy (`0` is falsy, which a careless `if
   * (entry.plays)` guard would treat the same as `undefined`) — either would
   * fall through to the plural key at the one value the singular text exists
   * for most.
   */
  it('uses the singular body at zero plays', () => {
    mockUseSongEqNotice.mockReturnValue({
      identity: IDENTITY,
      entry: entryOf(0),
    });
    render(<SongEqNotice />);
    expect(
      screen.getByText(
        translate('en', 'songEq.noticeBodyOnce', { title: 'Black Dog' }),
      ),
    ).toBeVisible();
  });

  /**
   * Fails if the `plays <= 1` branch is missing, or reads `< 1` instead —
   * either leaves a single play rendering the plural key, which is the exact
   * "learned over 1 plays" defect `noticeBodyOnce` exists to avoid.
   */
  it('uses the singular body at exactly one play', () => {
    mockUseSongEqNotice.mockReturnValue({
      identity: IDENTITY,
      entry: entryOf(1),
    });
    render(<SongEqNotice />);
    expect(
      screen.getByText(
        translate('en', 'songEq.noticeBodyOnce', { title: 'Black Dog' }),
      ),
    ).toBeVisible();
  });

  /**
   * Fails if the branch boundary leans the other way (`plays < 1`, or a
   * default of the plural at zero) — either would show the plural text one
   * play earlier or later than the singular test above expects.
   */
  it('uses the plural body once plays is above one', () => {
    mockUseSongEqNotice.mockReturnValue({
      identity: IDENTITY,
      entry: entryOf(2),
    });
    render(<SongEqNotice />);
    expect(
      screen.getByText(
        translate('en', 'songEq.noticeBody', { title: 'Black Dog', plays: 2 }),
      ),
    ).toBeVisible();
  });
});
