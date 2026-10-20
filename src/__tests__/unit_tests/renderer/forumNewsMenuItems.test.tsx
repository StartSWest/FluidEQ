/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ForumNewsMenuItems from '../../../renderer/forum/ForumNewsMenuItems';
import * as forumNew from '../../../renderer/forum/forumNew';
import {
  reloadForumNewsHidden,
  useForumNewsHidden,
} from '../../../renderer/forum/forumNewsPref';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

/**
 * The two rows under the Forum's in a menu: clear what is new, and switch the
 * count on Help's button off or back on (Ivan, 2026-10-16).
 */

const HIDDEN_KEY = 'fluideq.forum.newsHidden.v1';

/** The rows as a menu holds them, with the switch read from where it lives. */
function Rows({
  news,
  run,
}: {
  news: number;
  run: (a: () => void) => () => void;
}) {
  const hidden = useForumNewsHidden();
  return <ForumNewsMenuItems news={news} hidden={hidden} run={run} />;
}

const passThrough = (action: () => void) => () => action();

beforeEach(() => {
  window.localStorage.removeItem(HIDDEN_KEY);
  reloadForumNewsHidden();
});

describe('the Forum count’s rows in a menu', () => {
  it('offers clearing only while something is new', () => {
    const { rerender } = render(<Rows news={0} run={passThrough} />);
    expect(
      screen.queryByRole('menuitem', { name: 'forum.new.markAllRead' }),
    ).toBeNull();
    rerender(<Rows news={3} run={passThrough} />);
    expect(
      screen.getByRole('menuitem', { name: 'forum.new.markAllRead' }),
    ).toBeInTheDocument();
  });

  it('clears through the menu’s own way of running a row', () => {
    const markAll = jest
      .spyOn(forumNew, 'markAllForumRead')
      .mockImplementation(() => undefined);
    const closed: string[] = [];
    const run = (action: () => void) => () => {
      closed.push('menu closed');
      action();
    };
    render(<Rows news={2} run={run} />);
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'forum.new.markAllRead' }),
    );
    expect(closed).toEqual(['menu closed']);
    expect(markAll).toHaveBeenCalledTimes(1);
    markAll.mockRestore();
  });

  it('switches the count off, keeps it off, and back on', () => {
    const { unmount } = render(<Rows news={2} run={passThrough} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'forum.news.hide' }));
    expect(window.localStorage.getItem(HIDDEN_KEY)).toBe('1');
    // Off, there is nothing to clear from here and the switch says "on".
    expect(
      screen.queryByRole('menuitem', { name: 'forum.new.markAllRead' }),
    ).toBeNull();
    expect(
      screen.getByRole('menuitem', { name: 'forum.news.show' }),
    ).toBeInTheDocument();

    unmount();
    reloadForumNewsHidden();
    render(<Rows news={2} run={passThrough} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'forum.news.show' }));
    expect(window.localStorage.getItem(HIDDEN_KEY)).toBeNull();
    expect(
      screen.getByRole('menuitem', { name: 'forum.news.hide' }),
    ).toBeInTheDocument();
  });
});
