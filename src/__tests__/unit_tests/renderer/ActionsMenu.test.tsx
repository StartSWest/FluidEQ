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
import en from 'common/i18n/en';
import ActionsMenu, {
  type TEngineState,
} from 'renderer/components/ActionsMenu';
import type { IHelpHandlers } from 'renderer/help/helpMenuActions';
import { setWindowMode } from 'renderer/player/windowModeStore';
import { getThemeShade, setTheme } from 'renderer/utils/theme';
import { OCEAN_SHADE, THEME_SHADE_MAX } from 'renderer/utils/themeShade';

// Whether the titlebar has given up Help and the compact-player switch for
// want of room, which the bar decides by measuring (`titlebarRoom.test.ts`).
let mockToolsShed = false;
jest.mock('renderer/utils/useTitlebarRoom', () => ({
  ...jest.requireActual('renderer/utils/useTitlebarRoom'),
  useTitlebarToolsShed: () => mockToolsShed,
}));
jest.mock('renderer/player/windowModeStore', () => ({
  ...jest.requireActual('renderer/player/windowModeStore'),
  setWindowMode: jest.fn(async () => undefined),
}));

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  setTheme('black');
  mockToolsShed = false;
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
  options: {
    engineName?: string;
    engineVersion?: string;
    hasAccount?: boolean;
    help?: IHelpHandlers;
  } = {},
) => {
  const actions = handlers();
  const {
    hasAccount = true,
    engineName = 'FluidEQ Engine',
    engineVersion,
    help,
  } = options;
  const view = render(
    <ActionsMenu
      engineState={engineState}
      engineName={engineName}
      engineVersion={engineVersion}
      onFix={actions.onFix}
      onOpenEngine={actions.onOpenEngine}
      onTroubleshoot={actions.onTroubleshoot}
      onRestartAudio={actions.onRestartAudio}
      onImportEq={actions.onImportEq}
      onImportImpulse={actions.onImportImpulse}
      onProcesses={actions.onProcesses}
      onSupport={actions.onSupport}
      onAccount={hasAccount ? actions.onAccount : undefined}
      help={help}
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

  it('says which engine version is on the machine, beside the status', () => {
    // It decides what the app can ask of the engine — which effect slots it
    // will take, whether it counts the sound reaching it, whether its rack
    // will start — so "which one is installed here" is where a repair and a
    // bug report both begin, and it was only ever answerable from a report.
    const { trigger } = show('ready', { engineVersion: '1.12.0.0' });
    open(trigger);

    expect(
      screen.getByRole('menuitem', {
        name: 'FluidEQ Engine Audio engine connected · 1.12.0.0',
      }),
    ).toBeInTheDocument();
  });

  it('shows no version where there is none to show', () => {
    // The positive control: Equalizer APO says nothing about itself, and
    // main has not answered yet on the first frames of a launch. Neither
    // gets a separator with nothing after it.
    const { trigger } = show('ready');
    open(trigger);

    expect(
      screen.getByRole('menuitem', {
        name: 'FluidEQ Engine Audio engine connected',
      }),
    ).toBeInTheDocument();
  });

  it('says the status alone while no engine has been named, rather than guessing one', () => {
    const { trigger } = show('ready', { engineName: '' });
    open(trigger);

    expect(
      screen.getByRole('menuitem', { name: 'Audio engine connected' }),
    ).toBeInTheDocument();
  });

  it('turns a failing engine into the way back to its fix, and keeps every repair reachable', () => {
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
    // The two repairs above all: a menu that takes them away when the light
    // beside it goes red has emptied itself at the one moment anybody opens
    // it. They used to be drawn only while the engine was reported healthy,
    // which was survivable while only a blocking failure turned the light
    // red — the app was unusable anyway — and became a working app with no
    // way to reach its own troubleshooter the moment the light started
    // telling the truth about an engine that is simply not reaching the
    // output. Nothing in this group needs a working engine.
    expect(
      screen.getByRole('menuitem', { name: 'Fix audio problems…' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Restart Windows audio' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Import EQ settings…' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Import impulse response…' }),
    ).toBeInTheDocument();
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
    // The card itself: a line of text, with nothing to press while there is
    // no answer to act on yet.
    expect(
      screen.queryByRole('menuitem', { name: /Checking the audio engine/ }),
    ).not.toBeInTheDocument();
    // The rest of the menu is not the card and does not wait on it. The
    // restart in particular is a repair, and a menu that hides its repairs
    // while the engine is being asked about hides them for exactly as long
    // as somebody is most likely to want one.
    expect(
      screen.getByRole('menuitem', { name: 'Restart Windows audio' }),
    ).toBeInTheDocument();
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

/**
 * Zoomed in far enough, the titlebar gives up Help's button and the
 * compact-player switch so the window's own buttons stay on screen (Ivan,
 * 2026-09-28: "shed small things"), and this menu takes both in: nothing the
 * bar held is out of reach.
 */
describe('Help and the compact switch, while the titlebar has no room for them', () => {
  const helpHandlers = (): IHelpHandlers => ({
    onTour: jest.fn(),
    onTroubleshoot: jest.fn(),
    onReport: jest.fn(),
    onForum: jest.fn(),
    onAbout: jest.fn(),
  });

  beforeEach(() => {
    jest.mocked(setWindowMode).mockReset().mockResolvedValue(undefined);
  });

  it.each([
    ["What's new", 'onTour'],
    ['Report a problem', 'onReport'],
    ['Forum', 'onForum'],
    ['About FluidEQ…', 'onAbout'],
  ] as const)('offers %s, which closes the menu and runs', (label, handler) => {
    mockToolsShed = true;
    const help = helpHandlers();
    const { trigger } = show('ready', { help });
    open(trigger);

    fireEvent.click(screen.getByRole('menuitem', { name: label }));

    expect(help[handler]).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('menu', { name: 'FluidEQ actions' }),
    ).not.toBeInTheDocument();
  });

  it('offers the user guide, and fixing audio once, as the menu’s own row', () => {
    mockToolsShed = true;
    const help = helpHandlers();
    const { actions, trigger } = show('ready', { help });
    open(trigger);

    expect(
      screen.getByRole('menuitem', { name: 'User guide' }),
    ).toBeInTheDocument();
    const fixes = screen.getAllByRole('menuitem', {
      name: 'Fix audio problems…',
    });
    expect(fixes).toHaveLength(1);
    fireEvent.click(fixes[0]);
    expect(actions.onTroubleshoot).toHaveBeenCalledTimes(1);
    expect(help.onTroubleshoot).not.toHaveBeenCalled();
  });

  it('switches to the compact player', () => {
    mockToolsShed = true;
    const { trigger } = show('ready', { help: helpHandlers() });
    open(trigger);

    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Switch to the compact player' }),
    );

    expect(setWindowMode).toHaveBeenCalledWith('player');
    expect(
      screen.queryByRole('menu', { name: 'FluidEQ actions' }),
    ).not.toBeInTheDocument();
  });

  it('leaves them to the titlebar while it has room for them', () => {
    const { trigger } = show('ready', { help: helpHandlers() });
    open(trigger);

    // The control: the menu is open, with its own rows.
    expect(
      screen.getByRole('menuitem', { name: 'Support the work' }),
    ).toBeInTheDocument();
    [
      'User guide',
      "What's new",
      'Forum',
      'Switch to the compact player',
    ].forEach((label) =>
      expect(
        screen.queryByRole('menuitem', { name: label }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe('the settings tray', () => {
  // The window's Brightness as Window colours sets it, and no Theme row (Ivan,
  // 2026-09-26: "do same in the main menu both options bright trans no
  // theme"). No Transparency either (2026-09-28: "remove the transparent
  // slider from the root menu since no point"): it is the Backdrop's, and
  // stands in the Backdrop's own menu and the amp's.
  it('offers Brightness and not Transparency, and Brightness moves the window as it goes', async () => {
    setTheme('black');
    const { trigger } = show('ready');
    open(trigger);
    expect(
      // The theme slider it replaced, by the name it had (the key is gone).
      screen.queryByRole('slider', { name: 'Theme' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('slider', { name: en['graph.backdropVeil'] }),
    ).not.toBeInTheDocument();
    const brightness = screen.getByRole('slider', {
      name: en['graph.sceneTint.brightness'],
    });

    // The window's own shade: Black here, where the case put it (a fresh
    // install's half way is `themeShade.test.ts`'s).
    expect(brightness).toHaveValue('0');
    // The thumb follows at once; the window restyles on the next frame
    // (`useLiveSlider`), never in the same one as the move.
    fireEvent.change(brightness, { target: { value: String(OCEAN_SHADE) } });
    expect(brightness).toHaveValue(String(OCEAN_SHADE));
    await waitFor(() => expect(getThemeShade()).toBe(OCEAN_SHADE));
    expect(document.documentElement.getAttribute('data-theme-shade')).toBe(
      String(OCEAN_SHADE),
    );

    fireEvent.change(brightness, {
      target: { value: String(THEME_SHADE_MAX) },
    });
    await waitFor(() => expect(getThemeShade()).toBe(THEME_SHADE_MAX));
    expect(brightness).toHaveValue(String(THEME_SHADE_MAX));
    // Choosing a setting is not a command: the menu stays where it is.
    expect(
      screen.getByRole('menu', { name: 'FluidEQ actions' }),
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

    // Each shape of the sliders' handle is a row of its own, walked from the
    // last to the first on the way up.
    const shapes = within(
      screen.getByRole('group', { name: en['eq.sliders'] }),
    ).getAllByRole('menuitemradio');
    [...shapes].reverse().forEach((shape) => {
      fireEvent.keyDown(menu, { key: 'ArrowUp' });
      expect(shape).toHaveFocus();
    });

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(
      screen.getByRole('checkbox', { name: en['graph.sceneTint.rainbow'] }),
    ).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(
      screen.getByRole('slider', {
        name: en['graph.sceneTint.brightness'],
      }),
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
