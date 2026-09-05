/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import HelpMenu from 'renderer/help/HelpMenu';

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
    scrollIntoView: { configurable: true, value: jest.fn() },
    scrollTo: {
      configurable: true,
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

const showMenu = () => {
  const onAbout = jest.fn();
  render(
    <HelpMenu
      onAbout={onAbout}
      onTour={jest.fn()}
      onReport={jest.fn()}
      onTroubleshoot={jest.fn()}
    />,
  );
  return { onAbout };
};

const openGuide = () => {
  showMenu();
  screen.getByRole('button', { name: 'Help' }).focus();
  fireEvent.keyDown(document, { key: 'F1' });
  return screen.getByRole('dialog', { name: 'User guide' });
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

it('filters chapters, clears an empty result, and marks only the current chapter', () => {
  openGuide();
  const contents = screen.getByRole('navigation', { name: 'In this guide' });
  expect(within(contents).getAllByRole('button')).toHaveLength(16);
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'between computers' },
  });
  expect(within(contents).getAllByRole('button')).toHaveLength(1);
  expect(within(contents).getByRole('button')).toHaveAttribute(
    'aria-current',
    'location',
  );
  expect(
    screen.getByRole('heading', { name: 'Share audio between computers' }),
  ).toBeVisible();
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'zzzz-no-chapter' },
  });
  expect(within(contents).queryAllByRole('button')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(within(contents).getAllByRole('button')).toHaveLength(16);
  expect(screen.getByRole('searchbox')).toHaveFocus();
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
  expectCurrent(15);
  viewport.scrollTop = 1100;
  fireEvent.scroll(viewport);
  expectCurrent(1);
});
