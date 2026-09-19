/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The titlebar's actions menu: the audio engine as its head, one column of
 * commands, and the settings tray — and the keyboard, pointer and Escape
 * behaviour a menu owes whoever opened it.
 */

import '@testing-library/jest-dom';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { LATEST_RELEASE_URL } from 'common/branding';
import ActionsMenu, {
  type TEngineState,
} from 'renderer/components/ActionsMenu';
import { getTheme, setTheme } from 'renderer/utils/theme';

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  setTheme('dark');
});

const handlers = () => ({
  onFix: jest.fn(),
  onOpenEngine: jest.fn(),
  onTroubleshoot: jest.fn(),
  onRestartAudio: jest.fn(),
  onImportEq: jest.fn(),
  onImportImpulse: jest.fn(),
  onProcesses: jest.fn(),
  onSupport: jest.fn(),
  onAccount: jest.fn(),
});

const show = (
  engineState: TEngineState = 'ready',
  options: { engineName?: string; hasAccount?: boolean } = {},
) => {
  const actions = handlers();
  const { hasAccount = true, engineName = 'FluidEQ Engine' } = options;
  const view = render(
    <ActionsMenu
      engineState={engineState}
      engineName={engineName}
      onFix={actions.onFix}
      onOpenEngine={actions.onOpenEngine}
      onTroubleshoot={actions.onTroubleshoot}
      onRestartAudio={actions.onRestartAudio}
      onImportEq={actions.onImportEq}
      onImportImpulse={actions.onImportImpulse}
      onProcesses={actions.onProcesses}
      onSupport={actions.onSupport}
      onAccount={hasAccount ? actions.onAccount : undefined}
    />,
  );
  const trigger = screen.getByRole('button', { name: 'FluidEQ actions' });
  return { ...view, actions, trigger };
};

const open = (trigger: HTMLElement) => {
  fireEvent.click(trigger);
  return screen.getByRole('menu', { name: 'FluidEQ actions' });
};

describe('the engine at the head of the actions menu', () => {
  it('names the engine and says it is connected, and opens the engine settings', () => {
    const { actions, trigger } = show('ready');
    open(trigger);

    const card = screen.getByRole('menuitem', {
      name: 'FluidEQ Engine Audio engine connected',
    });
    fireEvent.click(card);

    expect(actions.onOpenEngine).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('menu', { name: 'FluidEQ actions' }),
    ).not.toBeInTheDocument();
  });

  it('says the status alone while no engine has been named, rather than guessing one', () => {
    const { trigger } = show('ready', { engineName: '' });
    open(trigger);

    expect(
      screen.getByRole('menuitem', { name: 'Audio engine connected' }),
    ).toBeInTheDocument();
  });

  it('turns a failing engine into the way back to its fix, and withholds what needs a working engine', () => {
    const { actions, trigger, container } = show('failing');

    expect(
      container.querySelector('.workspace-header__tools-trigger .status-dot'),
    ).toHaveClass('error');
    open(trigger);

    fireEvent.click(
      screen.getByRole('menuitem', {
        name: 'The audio engine is not responding FluidEQ Engine Fix this',
      }),
    );
    expect(actions.onFix).toHaveBeenCalledTimes(1);
    expect(actions.onOpenEngine).not.toHaveBeenCalled();

    open(trigger);
    expect(
      screen.queryByRole('menuitem', { name: 'Fix audio problems…' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Import EQ settings…' }),
    ).not.toBeInTheDocument();
    // Neither needs the engine, and reinstalling is a way out of one that
    // will not start.
    expect(
      screen.getByRole('menuitem', { name: 'Processes…' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Reinstall FluidEQ…' }),
    ).toBeInTheDocument();
  });

  it('offers nothing to press on the card while the engine is still being asked', () => {
    const { trigger } = show('checking', { engineName: '' });
    const menu = open(trigger);

    expect(within(menu).getByText('Checking the audio engine…')).toBeVisible();
    expect(
      screen.queryByRole('menuitem', { name: /Checking the audio engine/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Restart Windows audio' }),
    ).not.toBeInTheDocument();
  });
});

describe('the commands of the actions menu', () => {
  it.each([
    ['Fix audio problems…', 'onTroubleshoot'],
    ['Restart Windows audio', 'onRestartAudio'],
    ['Import EQ settings…', 'onImportEq'],
    ['Import impulse response…', 'onImportImpulse'],
    ['Processes…', 'onProcesses'],
    ['Account', 'onAccount'],
    ['Support the work', 'onSupport'],
  ] as const)('%s closes the menu and runs', (label, handler) => {
    const { actions, trigger } = show('ready');
    open(trigger);

    fireEvent.click(screen.getByRole('menuitem', { name: label }));

    expect(actions[handler]).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('menu', { name: 'FluidEQ actions' }),
    ).not.toBeInTheDocument();
  });

  it('sends Reinstall to the latest release page', () => {
    const windowOpen = jest.spyOn(window, 'open').mockReturnValue(null);
    const { trigger } = show('ready');
    open(trigger);

    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Reinstall FluidEQ…' }),
    );

    expect(windowOpen).toHaveBeenCalledWith(
      LATEST_RELEASE_URL,
      '_blank',
      'noopener',
    );
  });

  it('leaves Account out of a build with no backend to sign in to', () => {
    const { trigger } = show('ready', { hasAccount: false });
    open(trigger);

    expect(
      screen.queryByRole('menuitem', { name: 'Account' }),
    ).not.toBeInTheDocument();
  });

  it('does not repeat the Help menu beside it', () => {
    const { trigger } = show('ready');
    open(trigger);

    ["What's new", 'Report a problem', 'About FluidEQ…'].forEach((label) =>
      expect(
        screen.queryByRole('menuitem', { name: label }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe('the settings tray', () => {
  // Ocean was retired to make room for a light theme, and until that
  // arrives there is one theme: a segmented control with a single segment
  // would be a setting that sets nothing, so the tray offers none.
  it('offers no theme choice while Dark is the only theme', () => {
    const { trigger } = show('ready');
    open(trigger);

    expect(getTheme()).toBe('dark');
    expect(
      screen.queryByRole('group', { name: 'Theme' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Animations' }),
    ).toBeInTheDocument();
  });
});

describe('opening and closing the actions menu', () => {
  it('opens from the keyboard onto the engine, and the arrows walk every row and control, wrapping', () => {
    const { trigger } = show('ready');
    trigger.focus();

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const menu = screen.getByRole('menu', { name: 'FluidEQ actions' });
    const card = screen.getByRole('menuitem', {
      name: 'FluidEQ Engine Audio engine connected',
    });
    const language = screen.getByRole('menu', { name: 'Interface language' });
    expect(card).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(
      screen.getByRole('menuitem', { name: 'Fix audio problems…' }),
    ).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'End' });
    expect(language).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(screen.getByRole('checkbox', { name: 'Animations' })).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(
      screen.getByRole('menuitem', { name: 'Support the work' }),
    ).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'End' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(card).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(language).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'Home' });
    expect(card).toHaveFocus();
  });

  it('closes on Escape and gives the focus back to the button that opened it', async () => {
    const { trigger } = show('ready');
    open(trigger);

    fireEvent.keyDown(document.body, { key: 'Escape' });

    await waitFor(() =>
      expect(
        screen.queryByRole('menu', { name: 'FluidEQ actions' }),
      ).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on a press outside it, but not on a press in the language list it drops', () => {
    const { trigger } = show('ready');
    open(trigger);

    fireEvent.click(screen.getByRole('menu', { name: 'Interface language' }));
    fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'Español' }));
    expect(
      screen.getByRole('menu', { name: 'FluidEQ actions' }),
    ).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(
      screen.queryByRole('menu', { name: 'FluidEQ actions' }),
    ).not.toBeInTheDocument();
  });

  it('toggles from its button, which says whether it is open', () => {
    const { trigger } = show('ready');

    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute(
      'aria-controls',
      screen.getByRole('menu', { name: 'FluidEQ actions' }).id,
    );

    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('menu', { name: 'FluidEQ actions' }),
    ).not.toBeInTheDocument();
  });
});
