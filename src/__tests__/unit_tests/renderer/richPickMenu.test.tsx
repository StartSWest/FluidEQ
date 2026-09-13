/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The searchable pick's menu: a search at the top, a list that scrolls, and a
 * caller's actions held at the foot.
 *
 * The Studio's project picker had its actions after the last row, so with
 * forty projects "New project…" was a scroll away. They now sit outside the
 * list, which changed three things nothing on screen tells a test about: what
 * the menu measures to choose a side, where the keyboard can go, and whether
 * the search takes the caret on opening — which it had never actually done,
 * because the menu is drawn a render after `isOpen` turns on.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RichPick, {
  type IRichPickEntry,
} from '../../../renderer/widgets/RichPick';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}));

const PROJECTS: IRichPickEntry[] = ['Alpine', 'Bridge', 'City'].map((name) => ({
  id: name.toLowerCase(),
  name,
  hint: `D:\\scenes\\${name.toLowerCase()}`,
  group: 'projects',
  icon: <span />,
}));

/** The Carácter pick's shape: an ungrouped "None", then two headed groups. */
const VOICINGS: IRichPickEntry[] = [
  { id: '', name: 'None', hint: 'Only your bands', group: '', icon: <span /> },
  {
    id: 'music',
    name: 'Music',
    hint: 'Open top',
    group: 'purpose',
    icon: <span />,
  },
  {
    id: 'speech',
    name: 'Speech',
    hint: 'Intelligible',
    group: 'purpose',
    icon: <span />,
  },
  {
    id: 'rock',
    name: 'Rock',
    hint: 'Drums with weight',
    group: 'genre',
    icon: <span />,
  },
  {
    id: 'metal',
    name: 'Metal',
    hint: 'Tight underneath',
    group: 'genre',
    icon: <span />,
  },
];

const renderProjects = () => {
  const onPick = jest.fn();
  const onNew = jest.fn();
  render(
    <>
      <button type="button">Outside</button>
      <RichPick
        entries={PROJECTS}
        groupLabel={() => 'Your projects'}
        activeId="bridge"
        onPick={onPick}
        placeholder="Choose a project"
        triggerAriaLabel="Project"
        triggerTitle="Project"
        placeholderIcon={<span />}
        renderFooter={(close) => (
          <>
            <button
              type="button"
              className="rich-pick__action"
              onClick={() => {
                close();
                onNew();
              }}
            >
              New project
            </button>
            {/* Disabled, so the walk has a stop it must pass over. */}
            <button type="button" className="rich-pick__action" disabled>
              Unavailable
            </button>
            <button type="button" className="rich-pick__action">
              Open a folder
            </button>
          </>
        )}
      />
    </>,
  );
  return { onPick, onNew };
};

const renderVoicings = () => {
  const onPick = jest.fn();
  render(
    <RichPick
      className="voicing-pick"
      entries={VOICINGS}
      groupLabel={(group) => {
        if (group === 'genre') {
          return 'Genre';
        }
        return group === 'purpose' ? 'Purpose' : '';
      }}
      activeId=""
      onPick={onPick}
      placeholder="Character"
      triggerAriaLabel="Character: none"
      triggerTitle="Character"
      placeholderIcon={<span />}
    >
      <span role="status">Refused</span>
    </RichPick>,
  );
  return { onPick };
};

const open = (name: string) =>
  userEvent.click(screen.getByRole('button', { name }));

const search = () => screen.getByRole('textbox', { name: 'common.search' });

const menuParts = () => {
  const menu = screen.getByRole('menu');
  const list = menu.querySelector<HTMLElement>('.rich-pick__list');
  if (!list) {
    throw new Error('The menu has no list');
  }
  return { menu, list };
};

/**
 * What has focus, by the name a person would read on it.
 *
 * The trigger is named apart from the rows: it shows the chosen project's name
 * too, so by text alone a press that left focus on the trigger read as having
 * reached that row.
 */
const focusedName = () => {
  const focused = document.activeElement;
  if (focused instanceof HTMLInputElement) {
    return 'search';
  }
  if (focused?.getAttribute('aria-haspopup') === 'menu') {
    return 'trigger';
  }
  return (
    focused?.querySelector('strong')?.textContent ?? focused?.textContent ?? ''
  );
};

/** Presses an arrow `times` times and records every place focus lands. */
const walk = async (key: 'ArrowDown' | 'ArrowUp', times: number) => {
  const trail: string[] = [];
  for (let step = 0; step < times; step += 1) {
    // eslint-disable-next-line no-await-in-loop -- each press depends on where the previous one left focus
    await userEvent.keyboard(`{${key}}`);
    trail.push(focusedName());
  }
  return trail;
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('a pick with actions under its list', () => {
  it('keeps the actions outside the list that scrolls, below it', async () => {
    renderProjects();
    await open('Project');
    const { menu, list } = menuParts();

    // The control: every row is inside the list, so the list found is the
    // one that holds them and not an empty stand-in.
    const rows = screen.getAllByRole('menuitemradio');
    expect(rows).toHaveLength(3);
    rows.forEach((row) => expect(list).toContainElement(row));

    const action = screen.getByRole('button', { name: 'New project' });
    expect(list).not.toContainElement(action);
    expect(list).not.toContainElement(search());

    const footer = action.closest('.rich-pick__footer');
    expect(Array.from(menu.children)).toEqual([
      search().closest('.rich-pick__search'),
      list,
      footer,
    ]);
    // What AnchoredMenu measures to learn how tall the menu wants to be.
    expect(list).toHaveAttribute('data-anchored-menu-scroll');
  });

  it('puts the caret in the search as it opens, every time', async () => {
    renderProjects();
    await open('Project');
    expect(search()).toHaveFocus();

    await userEvent.keyboard('bri');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    // Reopened: a fresh search, and the caret back in it.
    await open('Project');
    expect(search()).toHaveFocus();
    expect(search()).toHaveValue('');
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(3);
  });

  it('shows the chosen row as it opens', async () => {
    const scrollIntoView = jest.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });
    try {
      renderProjects();
      await open('Project');
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(
        screen.getByRole('menuitemradio', { name: /Bridge/ }),
      );
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    } finally {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    }
  });

  describe('the arrow keys', () => {
    it('walk down through the search, every row and the actions, and wrap', async () => {
      renderProjects();
      await open('Project');
      expect(await walk('ArrowDown', 6)).toEqual([
        'Alpine',
        'Bridge',
        'City',
        'New project',
        'Open a folder',
        'search',
      ]);
    });

    it('walk up from the search to the last action, and wrap', async () => {
      renderProjects();
      await open('Project');
      expect(await walk('ArrowUp', 6)).toEqual([
        'Open a folder',
        'New project',
        'City',
        'Bridge',
        'Alpine',
        'search',
      ]);
    });

    it('visit only the rows the search left', async () => {
      renderProjects();
      await open('Project');
      await userEvent.keyboard('bri');
      expect(
        screen.queryByRole('menuitemradio', { name: /Alpine/ }),
      ).not.toBeInTheDocument();
      // A whole lap: the row left, the actions, and back. Alpine and City are
      // not rendered and never come up; the disabled action is rendered and
      // is passed over.
      expect(await walk('ArrowDown', 4)).toEqual([
        'Bridge',
        'New project',
        'Open a folder',
        'search',
      ]);
    });

    it('bring a group heading into view with the row under it', async () => {
      const scrollIntoView = jest.fn();
      Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        writable: true,
        value: scrollIntoView,
      });
      try {
        renderProjects();
        await open('Project');
        scrollIntoView.mockClear();

        await userEvent.keyboard('{ArrowDown}');
        expect(scrollIntoView.mock.contexts).toEqual([
          screen.getByText('Your projects'),
          screen.getByRole('menuitemradio', { name: /Alpine/ }),
        ]);
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });

        // The control: a row with no heading over it scrolls alone.
        scrollIntoView.mockClear();
        await userEvent.keyboard('{ArrowDown}');
        expect(scrollIntoView.mock.contexts).toEqual([
          screen.getByRole('menuitemradio', { name: /Bridge/ }),
        ]);
      } finally {
        Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
      }
    });

    it('belong to whatever has focus outside the menu', async () => {
      renderProjects();
      await open('Project');
      const outside = screen.getByRole('button', { name: 'Outside' });
      act(() => outside.focus());

      // `fireEvent` answers false when a listener prevented the default.
      expect(fireEvent.keyDown(outside, { key: 'ArrowDown' })).toBe(true);
      expect(outside).toHaveFocus();
      expect(screen.getByRole('menu')).toBeInTheDocument();

      // The control: the same key from inside the menu is taken.
      act(() => search().focus());
      expect(fireEvent.keyDown(search(), { key: 'ArrowDown' })).toBe(false);
      expect(focusedName()).toBe('Alpine');
    });
  });

  describe('while searching', () => {
    it('keeps the actions when the search narrows the list to one row', async () => {
      renderProjects();
      await open('Project');
      await userEvent.keyboard('city');
      const { list } = menuParts();
      expect(screen.getAllByRole('menuitemradio')).toHaveLength(1);
      const action = screen.getByRole('button', { name: 'Open a folder' });
      expect(action).toBeInTheDocument();
      expect(list).not.toContainElement(action);
    });

    it('keeps the actions reachable when nothing matches', async () => {
      const { onNew } = renderProjects();
      await open('Project');
      await userEvent.keyboard('zzz');
      const { list } = menuParts();
      expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
      expect(list).toContainElement(screen.getByText('common.noMatches'));

      // The message is not a stop: the first press lands on the first action.
      expect(await walk('ArrowDown', 1)).toEqual(['New project']);
      await userEvent.keyboard('{Enter}');
      expect(onNew).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  describe('Escape', () => {
    it('closes the menu and gives focus back to the trigger', async () => {
      renderProjects();
      await open('Project');
      await walk('ArrowDown', 2);
      expect(
        screen.getByRole('menuitemradio', { name: /Bridge/ }),
      ).toHaveFocus();

      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Project' })).toHaveFocus();
    });

    it('closes the menu without taking focus from outside it', async () => {
      renderProjects();
      await open('Project');
      const outside = screen.getByRole('button', { name: 'Outside' });
      act(() => outside.focus());

      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(outside).toHaveFocus();
    });
  });

  describe('choosing a side of the trigger', () => {
    // A trigger 138px from the bottom of jsdom's 768px window: 124px of room
    // below it and 586px above.
    const nearTheBottom = () => {
      const root = screen
        .getByRole('button', { name: 'Project' })
        .closest('.rich-pick');
      if (!(root instanceof HTMLElement)) {
        throw new Error('The pick has no root');
      }
      jest.spyOn(root, 'getBoundingClientRect').mockReturnValue({
        top: 600,
        bottom: 630,
        left: 400,
        right: 700,
        width: 300,
        height: 30,
        x: 400,
        y: 600,
        toJSON: () => ({}),
      });
    };

    /**
     * The menu is capped at the room it has and does not overflow itself; only
     * its list might. `listHidden` is how much of the list is out of view.
     */
    const measure = (listHidden: number) => {
      jest
        .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
        .mockImplementation(function scrollHeight(this: HTMLElement) {
          return this.classList.contains('rich-pick__list')
            ? 60 + listHidden
            : 100;
        });
      jest
        .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
        .mockImplementation(function clientHeight(this: HTMLElement) {
          return this.classList.contains('rich-pick__list') ? 60 : 100;
        });
    };

    it('opens upward when only the list is taller than the room below', async () => {
      renderProjects();
      nearTheBottom();
      measure(840);
      await open('Project');
      const menu = screen.getByRole('menu');
      expect(menu.style.bottom).not.toBe('');
      expect(menu.style.top).toBe('');
    });

    // The control: the same menu with nothing hidden in its list fits below.
    it('opens downward when the list has nothing hidden', async () => {
      renderProjects();
      nearTheBottom();
      measure(0);
      await open('Project');
      const menu = screen.getByRole('menu');
      expect(menu.style.top).not.toBe('');
      expect(menu.style.bottom).toBe('');
    });
  });
});

describe('a pick with no actions, like Carácter', () => {
  it('draws no action row and keeps its headings', async () => {
    renderVoicings();
    await open('Character: none');
    const { menu, list } = menuParts();

    expect(menu.querySelector('.rich-pick__footer')).toBeNull();
    expect(Array.from(menu.children)).toEqual([
      search().closest('.rich-pick__search'),
      list,
    ]);
    expect(screen.getAllByText('Purpose')).toHaveLength(1);
    expect(screen.getAllByText('Genre')).toHaveLength(1);
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(5);
    // The caller's own message stays with the trigger, out of the menu.
    expect(menu).not.toContainElement(screen.getByRole('status'));
    expect(search()).toHaveFocus();
  });

  it('walks only the search and its rows, wrapping at both ends', async () => {
    renderVoicings();
    await open('Character: none');
    expect(await walk('ArrowDown', 6)).toEqual([
      'None',
      'Music',
      'Speech',
      'Rock',
      'Metal',
      'search',
    ]);
    expect(await walk('ArrowUp', 1)).toEqual(['Metal']);
  });

  it('picks by click, and by Enter once the search leaves one row', async () => {
    const { onPick } = renderVoicings();
    await open('Character: none');
    await userEvent.click(
      screen.getByRole('menuitemradio', { name: /Speech/ }),
    );
    expect(onPick).toHaveBeenLastCalledWith('speech');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await open('Character: none');
    await userEvent.keyboard('met');
    await userEvent.keyboard('{Enter}');
    expect(onPick).toHaveBeenLastCalledWith('metal');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on a press outside it', async () => {
    renderVoicings();
    await open('Character: none');
    await userEvent.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
