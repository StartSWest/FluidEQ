/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import HelpMenu from 'renderer/help/HelpMenu';
import { requestHelpGuide } from 'renderer/help/helpGuideRequests';
import { HELP_CHAPTERS } from 'common/helpGuide';
import { I18nProvider } from 'renderer/utils/I18nContext';

// Counted from the guide itself: a chapter added to it used to fail these two
// cases on the number alone, which says nothing about what broke.
const CHAPTERS = HELP_CHAPTERS.length;

// jsdom has no native dialog or scrolling implementation. Keep these shims
// local to the guide tests; the real focus trap is checked in Electron.
const dialogMethods = {
  showModal: Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    'showModal',
  ),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
};
const scrollMethods = {
  scrollIntoView: Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'scrollIntoView',
  ),
  scrollTo: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo'),
};

beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open');
      },
    },
  });
  Object.defineProperties(HTMLElement.prototype, {
    scrollIntoView: { configurable: true, writable: true, value: jest.fn() },
    scrollTo: {
      configurable: true,
      writable: true,
      value(this: HTMLElement, options: ScrollToOptions) {
        this.scrollTop = options.top ?? 0;
      },
    },
  });
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

afterAll(() => {
  Object.entries(dialogMethods).forEach(([name, descriptor]) => {
    if (descriptor) {
      Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    } else {
      Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    }
  });
  Object.entries(scrollMethods).forEach(([name, descriptor]) => {
    if (descriptor) {
      Object.defineProperty(HTMLElement.prototype, name, descriptor);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, name);
    }
  });
});

const showMenu = (forumOpen = false) => {
  const onAbout = jest.fn();
  const onForum = jest.fn();
  const onReleaseNotes = jest.fn();
  render(
    <I18nProvider>
      <HelpMenu
        onAbout={onAbout}
        onTour={jest.fn()}
        onReleaseNotes={onReleaseNotes}
        onReport={jest.fn()}
        onTroubleshoot={jest.fn()}
        onForum={onForum}
        forumOpen={forumOpen}
      />
    </I18nProvider>,
  );
  return { onAbout, onForum, onReleaseNotes };
};

it('offers every version’s notes right under What’s new', () => {
  const { onReleaseNotes } = showMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  const items = screen.getAllByRole('menuitem');
  const whatsNew = screen.getByRole('menuitem', { name: /What.s new/ });
  const notes = screen.getByRole('menuitem', { name: 'Full release notes' });
  expect(items.indexOf(notes)).toBe(items.indexOf(whatsNew) + 1);
  fireEvent.click(notes);
  expect(onReleaseNotes).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

const openGuide = () => {
  showMenu();
  screen.getByRole('button', { name: 'Help' }).focus();
  fireEvent.keyDown(document, { key: 'F1' });
  return screen.getByRole('dialog', { name: 'User guide' });
};

const openSettledGuide = async () => {
  showMenu();
  screen.getByRole('button', { name: 'Help' }).focus();
  await act(async () => {
    fireEvent.keyDown(document, { key: 'F1' });
  });
  return screen.getByRole('dialog', { name: 'User guide' });
};

const changeSearch = async (search: HTMLElement, value: string) => {
  await act(async () => {
    fireEvent.change(search, { target: { value } });
  });
};

const clickInGuide = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.click(element);
  });
};

/** Give jsdom a reading position and model only article scroll destinations. */
const modelArticleScrolling = (guide: HTMLElement) => {
  const viewport = guide.querySelector('.help-guide__article');
  if (!(viewport instanceof HTMLElement)) {
    throw new Error('The guide has no scrollable article');
  }
  const headings = Array.from(viewport.querySelectorAll<HTMLElement>('h2[id]'));
  Object.defineProperties(viewport, {
    clientHeight: { configurable: true, value: 600 },
    scrollHeight: { configurable: true, value: (CHAPTERS + 1) * 1000 },
  });
  jest
    .spyOn(viewport, 'getBoundingClientRect')
    .mockReturnValue({ top: 0 } as DOMRect);
  headings.forEach((heading, index) => {
    jest
      .spyOn(heading, 'getBoundingClientRect')
      .mockImplementation(
        () => ({ top: index * 1000 - viewport.scrollTop }) as DOMRect,
      );
  });
  const moveTo = (index: number, offset = 200) => {
    viewport.scrollTop = index * 1000 + offset;
    viewport.dispatchEvent(new Event('scroll'));
  };
  const scroll = jest
    .spyOn(HTMLElement.prototype, 'scrollIntoView')
    .mockImplementation(function scrollChapterIntoView(this: HTMLElement) {
      const heading = this.closest('.help-guide__chapter')?.querySelector('h2');
      if (heading instanceof HTMLElement) {
        const index = headings.indexOf(heading);
        if (index >= 0) {
          moveTo(index);
        }
      }
    });
  return { viewport, headings, moveTo, scroll };
};

it('opens from F1, contains app shortcuts, and restores focus on close', () => {
  const guide = openGuide();
  expect(screen.getByRole('searchbox')).toHaveFocus();
  expect(guide).toHaveAttribute('open');
  const backgroundShortcut = jest.fn();
  document.addEventListener('keydown', backgroundShortcut);
  try {
    fireEvent.keyDown(screen.getByRole('searchbox'), {
      key: 'f',
      ctrlKey: true,
    });
    expect(backgroundShortcut).not.toHaveBeenCalled();
  } finally {
    document.removeEventListener('keydown', backgroundShortcut);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Close guide' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Help' })).toHaveFocus();
});

it('opens the guide when asked from elsewhere, as What’s New’s Open Help does', () => {
  showMenu();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  act(() => requestHelpGuide());
  expect(screen.getByRole('dialog', { name: 'User guide' })).toHaveAttribute(
    'open',
  );
});

it('routes the keyboard-selected menu action and dismisses the menu', () => {
  const { onAbout } = showMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  const menu = screen.getByRole('menu');
  fireEvent.keyDown(menu, { key: 'End' });
  const about = screen.getByRole('menuitem', { name: 'About FluidEQ…' });
  expect(about).toHaveFocus();
  fireEvent.click(about);
  expect(onAbout).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

/**
 * The Forum has no tab in the titlebar: it opens from here, after the ways
 * to get help and before About — with its notifications' switch under it —
 * and while it is open the Help button is what says where it is.
 */
it('opens the Forum from the Help menu, and lights Help while it is open', () => {
  const { onForum } = showMenu();
  const trigger = screen.getByRole('button', { name: 'Help' });
  expect(trigger).not.toHaveClass('is-active');
  fireEvent.click(trigger);
  const items = screen.getAllByRole('menuitem');
  const forum = screen.getByRole('menuitem', { name: 'Forum' });
  const report = screen.getByRole('menuitem', { name: 'Report a problem' });
  expect(items.indexOf(forum)).toBe(items.indexOf(report) + 1);
  expect(items[items.indexOf(forum) + 1]).toHaveTextContent(
    'Turn off Forum notifications',
  );
  expect(items[items.length - 1]).toHaveTextContent(/About/);
  fireEvent.click(forum);
  expect(onForum).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it('wears the selected look on the Help button while the Forum is open', () => {
  showMenu(true);
  expect(screen.getByRole('button', { name: 'Help' })).toHaveClass('is-active');
});

it('keeps the complete guide and contents when searching or finding nothing', async () => {
  const guide = await openSettledGuide();
  const { viewport } = modelArticleScrolling(guide);
  const contents = screen.getByRole('navigation', { name: 'In this guide' });
  const search = screen.getByRole('searchbox');
  const sections = Array.from(
    viewport.querySelectorAll('.help-guide__chapter'),
  );
  const hero = viewport.querySelector('.help-guide__hero');
  const entries = within(contents).getAllByRole('button');
  const labels = entries.map((button) => button.getAttribute('aria-label'));
  const expectChaptersUnchanged = () => {
    const drawn = Array.from(viewport.querySelectorAll('.help-guide__chapter'));
    expect(drawn).toHaveLength(CHAPTERS);
    drawn.forEach((section, index) => expect(section).toBe(sections[index]));
  };
  expect(sections).toHaveLength(CHAPTERS);
  expect(entries).toHaveLength(CHAPTERS);
  await changeSearch(search, 'between computers');
  expect(
    within(contents)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label')),
  ).toEqual(labels);
  expectChaptersUnchanged();
  expect(viewport.querySelector('.help-guide__hero')).toBe(hero);
  expect(
    within(contents).getByRole('button', {
      name: 'Share audio between computers',
    }),
  ).toHaveAttribute('aria-current', 'location');
  expect(
    entries.filter(
      (button) => button.getAttribute('aria-current') === 'location',
    ),
  ).toHaveLength(1);
  await changeSearch(search, 'zzzzqqqq');
  expect(within(contents).getAllByRole('button')).toHaveLength(CHAPTERS);
  expectChaptersUnchanged();
  expect(viewport.querySelector('.help-guide__hero')).toBe(hero);
  expect(viewport.querySelectorAll('mark.help-mark')).toHaveLength(0);
  expect(
    screen.getByText(
      'No chapters found. Try a shorter phrase or clear the search.',
    ),
  ).toBeVisible();
  await clickInGuide(screen.getByRole('button', { name: 'Clear search' }));
  expect(search).toHaveValue('');
  expect(search).toHaveFocus();
  expect(within(contents).getAllByRole('button')).toHaveLength(CHAPTERS);
  expectChaptersUnchanged();
});

it('jumps to the best passage and quotes matches without reordering chapters', async () => {
  const guide = await openSettledGuide();
  const { viewport } = modelArticleScrolling(guide);
  const search = screen.getByRole('searchbox');
  const contents = screen.getByRole('navigation', { name: 'In this guide' });
  const originalOrder = within(contents)
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'));
  const currentChapter = () =>
    viewport
      .querySelector('mark.help-mark.is-current')
      ?.closest('.help-guide__chapter')
      ?.querySelector('h2');
  await changeSearch(search, 'no sound');
  const trouble = within(contents).getByRole('button', {
    name: 'When something sounds wrong',
  });
  expect(trouble).toHaveAccessibleDescription(/sound/i);
  expect(
    within(trouble)
      .getAllByText((_, element) => element?.tagName === 'MARK')
      .some((mark) => /sound/i.test(mark.textContent ?? '')),
  ).toBe(true);
  expect(currentChapter()).toHaveTextContent('When something sounds wrong');
  await changeSearch(search, 'between computers');
  expect(currentChapter()).toHaveTextContent('Share audio between computers');
  expect(
    within(contents).getByRole('button', {
      name: 'My curves: import, edit and share',
    }),
  ).toHaveAccessibleDescription(/computers/i);
  await changeSearch(search, 'Reconnect');
  expect(currentChapter()).toHaveTextContent('Share audio between computers');
  await changeSearch(search, 'LUFS');
  expect(
    within(contents).getByRole('button', {
      name: 'Normalizer and live level control',
    }),
  ).toHaveAttribute('aria-current', 'location');
  expect(screen.getByText(`${CHAPTERS} chapters`)).toBeVisible();
  expect(
    within(contents)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label')),
  ).toEqual(originalOrder);
});

it('clears the search input without moving the chapter or reading position', async () => {
  const guide = await openSettledGuide();
  const { viewport, headings, moveTo, scroll } = modelArticleScrolling(guide);
  const search = screen.getByRole('searchbox');
  const contents = screen.getByRole('navigation', { name: 'In this guide' });
  await changeSearch(search, 'game');
  expect(viewport.scrollTop).toBeGreaterThan(0);
  expect(viewport.querySelectorAll('mark.help-mark').length).toBeGreaterThan(0);
  const gameFilter = headings.findIndex(
    (heading) => heading.id === 'help-gamefilter',
  );
  expect(gameFilter).toBeGreaterThan(0);
  await act(async () => {
    moveTo(gameFilter, 487);
  });
  const readingAt = viewport.scrollTop;
  const current = within(contents).getAllByRole('button')[gameFilter];
  expect(current).toHaveAttribute('aria-current', 'location');
  const reset = jest.spyOn(viewport, 'scrollTo');
  scroll.mockClear();
  await changeSearch(search, '');
  expect(viewport.scrollTop).toBe(readingAt);
  expect(current).toHaveAttribute('aria-current', 'location');
  expect(reset).not.toHaveBeenCalled();
  expect(
    scroll.mock.contexts.filter((element) => viewport.contains(element)),
  ).toHaveLength(0);
  expect(viewport.querySelectorAll('mark.help-mark')).toHaveLength(0);
  expect(Array.from(viewport.querySelectorAll('h2[id]'))).toEqual(headings);
});

it('keeps the reading position for an unmatched query and its Clear search button', async () => {
  const guide = await openSettledGuide();
  const { viewport, headings, moveTo, scroll } = modelArticleScrolling(guide);
  const search = screen.getByRole('searchbox');
  await changeSearch(search, 'surround');
  expect(viewport.scrollTop).toBeGreaterThan(0);
  const readingChapter = headings.findIndex(
    (heading) => heading.id === 'help-normalizer',
  );
  expect(readingChapter).toBeGreaterThan(0);
  await act(async () => {
    moveTo(readingChapter, 321);
  });
  const readingAt = viewport.scrollTop;
  scroll.mockClear();
  await changeSearch(search, 'zzzzqqqq');
  expect(viewport.scrollTop).toBe(readingAt);
  expect(viewport.querySelectorAll('.help-guide__chapter')).toHaveLength(
    CHAPTERS,
  );
  expect(
    scroll.mock.contexts.filter((element) => viewport.contains(element)),
  ).toHaveLength(0);
  await clickInGuide(screen.getByRole('button', { name: 'Clear search' }));
  expect(viewport.scrollTop).toBe(readingAt);
  expect(search).toHaveFocus();
  expect(search).toHaveValue('');
  expect(
    scroll.mock.contexts.filter((element) => viewport.contains(element)),
  ).toHaveLength(0);
});

it('opens another matching chapter and keeps that location when search is cleared', async () => {
  const guide = await openSettledGuide();
  const { viewport } = modelArticleScrolling(guide);
  const search = screen.getByRole('searchbox');
  const contents = screen.getByRole('navigation', { name: 'In this guide' });
  await changeSearch(search, 'between computers');
  const firstMatchAt = viewport.scrollTop;
  const curves = within(contents).getByRole('button', {
    name: 'My curves: import, edit and share',
  });
  expect(curves).toHaveAccessibleDescription(/computers/i);
  await clickInGuide(curves);
  const readingAt = viewport.scrollTop;
  expect(readingAt).toBeGreaterThan(0);
  expect(readingAt).not.toBe(firstMatchAt);
  expect(
    screen.getByRole('heading', { name: 'My curves: import, edit and share' }),
  ).toHaveFocus();
  expect(curves).toHaveAttribute('aria-current', 'location');
  await changeSearch(search, '');
  expect(viewport.scrollTop).toBe(readingAt);
  expect(curves).toHaveAttribute('aria-current', 'location');
});

it('keeps nonmatching chapters available and navigable during a search', async () => {
  const guide = await openSettledGuide();
  const { viewport } = modelArticleScrolling(guide);
  const search = screen.getByRole('searchbox');
  const contents = screen.getByRole('navigation', { name: 'In this guide' });
  await changeSearch(search, 'LUFS');
  const foundAt = viewport.scrollTop;
  await clickInGuide(
    within(contents).getByRole('button', { name: 'Your first five minutes' }),
  );
  expect(viewport.scrollTop).not.toBe(foundAt);
  expect(
    screen.getByRole('heading', { name: 'Your first five minutes' }),
  ).toHaveFocus();
  expect(search).toHaveValue('LUFS');
  expect(viewport.querySelectorAll('.help-guide__chapter')).toHaveLength(
    CHAPTERS,
  );
  const readingAt = viewport.scrollTop;
  await changeSearch(search, '');
  expect(viewport.scrollTop).toBe(readingAt);
});

it('marks the words in the guide and walks them with Enter and Shift+Enter', () => {
  const guide = openGuide();
  const search = screen.getByRole('searchbox');
  fireEvent.change(search, { target: { value: 'surround' } });
  const marks = Array.from(
    guide.querySelectorAll<HTMLElement>('.help-guide__article mark.help-mark'),
  );
  // The positive control: the word is marked at least twice in the guide,
  // so there is somewhere for Enter to go.
  expect(marks.length).toBeGreaterThan(1);
  marks.forEach((mark) => expect(mark.textContent).toMatch(/surround/i));
  const current = () =>
    marks.findIndex((mark) => mark.classList.contains('is-current'));
  // The search lands on the best passage and makes its first mark current.
  const landed = current();
  expect(landed).toBeGreaterThanOrEqual(0);
  fireEvent.keyDown(search, { key: 'Enter' });
  expect(current()).toBe((landed + 1) % marks.length);
  fireEvent.keyDown(search, { key: 'Enter', shiftKey: true });
  expect(current()).toBe(landed);
  expect(
    marks.filter((mark) => mark.classList.contains('is-current')),
  ).toHaveLength(1);
});

it('closes an enlarged capture without closing the guide underneath', () => {
  openGuide();
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Enlarge screenshot: Your first five minutes',
    }),
  );
  const capture = screen.getByRole('dialog', {
    name: 'Your first five minutes',
  });
  expect(capture).toHaveAttribute('open');
  expect(within(capture).getByRole('img')).toHaveAccessibleName(
    'Your first five minutes',
  );
  fireEvent(capture, new Event('cancel', { cancelable: true }));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog', { name: 'User guide' })).toHaveAttribute(
    'open',
  );
});

it('follows the reading position down and up, including the final short chapter', () => {
  openGuide();
  const first = screen.getByRole('heading', {
    name: 'Your first five minutes',
  });
  const viewport = first.closest('.help-guide__article');
  if (!(viewport instanceof HTMLElement)) {
    throw new Error('The guide has no scrollable article');
  }
  Object.defineProperties(viewport, {
    clientHeight: { configurable: true, value: 600 },
    scrollHeight: { configurable: true, value: 16000 },
  });
  jest
    .spyOn(viewport, 'getBoundingClientRect')
    .mockReturnValue({ top: 0 } as DOMRect);
  within(viewport)
    .getAllByRole('heading', { level: 2 })
    .forEach((heading, index) => {
      jest.spyOn(heading, 'getBoundingClientRect').mockImplementation(
        () =>
          ({
            top: index * 1000 - viewport.scrollTop,
          }) as DOMRect,
      );
    });
  const contents = screen.getByRole('navigation', { name: 'In this guide' });
  const items = within(contents).getAllByRole('button');
  const expectCurrent = (index: number) => {
    expect(items[index]).toHaveAttribute('aria-current', 'location');
    expect(
      items.filter((item) => item.hasAttribute('aria-current')),
    ).toHaveLength(1);
    expect(items[index]).toHaveClass('is-active');
  };
  fireEvent.scroll(viewport);
  expectCurrent(0);
  viewport.scrollTop = 8100;
  fireEvent.scroll(viewport);
  expectCurrent(8);
  viewport.scrollTop = 15400;
  fireEvent.scroll(viewport);
  expectCurrent(CHAPTERS - 1);
  viewport.scrollTop = 1100;
  fireEvent.scroll(viewport);
  expectCurrent(1);
});

it('opens with the new walkthrough poster and one Play card for the first chapter', () => {
  openGuide();
  const first = screen
    .getByRole('heading', { name: 'Your first five minutes' })
    .closest('section');
  expect(first?.querySelectorAll('[data-film="walkthrough"]')).toHaveLength(1);
  expect(first?.querySelector('video')).toBeNull();
  expect(first?.querySelector('.help-video')).toBeNull();
});
