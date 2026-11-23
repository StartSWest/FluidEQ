/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  Fragment,
  KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { LATEST_RELEASE_URL, PRODUCT_NAME } from 'common/branding';
import type { TranslationKey } from 'common/i18n/en';
import { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import Chevron from '../icons/Chevron';
import MenuIcon, { type MenuIconName } from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import useExitAnimation from '../utils/useExitAnimation';
import { useTitlebarToolsShed } from '../utils/useTitlebarRoom';
import ForumNewsBadge, {
  forumNewsText,
  useForumNewsCount,
} from '../forum/ForumNewsBadge';
import ForumNewsMenuItems from '../forum/ForumNewsMenuItems';
import { useForumNewsHidden } from '../forum/forumNewsPref';
import { requestHelpGuide } from '../help/helpGuideRequests';
import helpMenuActions, { type IHelpHandlers } from '../help/helpMenuActions';
import PlayerIcon from '../player/PlayerIcon';
import { setWindowMode } from '../player/windowModeStore';
import LanguagePicker from './LanguagePicker';
import MotionPicker from './MotionPicker';
import ResetSettingsDialog from './ResetSettingsDialog';
import EngineKeyDialog from './EngineKeyDialog';
import TuningAgentDialog from './TuningAgentDialog';
import SliderHandlePicker from './SliderHandlePicker';
import StartupPicker from './StartupPicker';
import WindowLookSection from './WindowLookSection';
import { useSelectedSceneLookId } from '../utils/graphStyle';
import { useCanSetDesktop } from '../wallpaper/WallpaperControls';
import { openWallpaperDialog } from '../wallpaper/wallpaperDialogs';
import '../styles/ActionsMenu.scss';

/**
 * Where the audio engine stands. A failure outranks a check in progress: the
 * fault is still true until the check that is running says otherwise.
 */
export type TEngineState = 'checking' | 'ready' | 'failing';

const STATUS_KEYS: Record<TEngineState, TranslationKey> = {
  checking: 'app.status.checking',
  ready: 'app.status.ready',
  failing: 'app.status.error',
};

/** The engine card's drawing: the engine at work. */
const PULSE = 'M4 12h3l2-6 4 12 2-6h5';

/**
 * The trigger's: a menu, which is what it opens — fixes, imports, the
 * window's look, the account and the language. It wore the engine's pulse,
 * which read as a meter rather than a way in (Ivan, 2026-10-25: "perhaps the
 * icon needs to be menu icon or settings"). The engine's lamp stays beside it.
 */
const MENU_LINES = 'M4 7h16M4 12h16M4 17h16';

/** Everything the arrow keys walk through, in the order it is drawn. */
const FOCUSABLE =
  '[role="menuitem"], [role="menuitemradio"], input[type="range"]:not(:disabled), .switch-checkbox, .dropdown > [role="menu"]';

interface IActionsMenuProps {
  engineState: TEngineState;
  /** The engine in use, once main has said which. */
  engineName?: string;
  /**
   * The installed FluidEQ Engine's own version, as its setup helper reports
   * it. Absent under Equalizer APO and until main has answered.
   */
  engineVersion?: string;
  /** Back to the notice that carries the Install and Retry buttons. */
  onFix: () => void;
  onOpenEngine: () => void;
  onTroubleshoot: () => void;
  onRestartAudio: () => void;
  onImportEq: () => void;
  onImportImpulse: () => void;
  onProcesses: () => void;
  onSupport: () => void;
  /**
   * Help's own entries, taken in while the titlebar has no room for Help's
   * button (`useTitlebarToolsShed`), with the compact-player switch beside it.
   */
  help?: IHelpHandlers;
}

interface IItemProps {
  icon: MenuIconName;
  onSelect: () => void;
  children: ReactNode;
}

const Item = ({ icon, onSelect, children }: IItemProps) => (
  <button
    type="button"
    role="menuitem"
    className="workspace-header__menu-item"
    onClick={onSelect}
  >
    <MenuIcon name={icon} />
    {children}
  </button>
);

const EngineBadge = ({ state }: { state: TEngineState }) => (
  <span className="actions-menu__badge" aria-hidden="true">
    <svg viewBox="0 0 24 24">
      <path d={PULSE} />
    </svg>
    {state !== 'checking' && (
      <span className={`status-dot${state === 'failing' ? ' error' : ''}`} />
    )}
  </span>
);

/**
 * The titlebar's actions: the audio engine first, then what can be done, then
 * how the window looks.
 *
 * It had grown into two columns of nine commands, three full-width rows each
 * under a rule of its own and three select fields, 440 by 650 pixels. The
 * columns never balanced — six commands against three left a hole in one
 * corner — and three of the nine were the Help menu's, which opens beside it.
 * Three rows wore the circled i, three the restart arrow, two the sliders, so
 * the glyphs that exist to be recognised before reading could not be told
 * apart, and the one thing the button's status dot is about, whether the
 * engine is working, was a grey line of small print above it all.
 *
 * The engine is the head of the menu now, drawn with the trigger's own pulse
 * and dot, and opens the engine's dialog; the two repairs follow it directly.
 * One column, grouped by what each thing is for, every glyph different. The
 * theme, animations and language are settings rather than commands, so they
 * sit apart in a recessed tray, each named and each with the control its
 * choice needs: two themes side by side, a switch, and a list for ten
 * languages.
 */
const ActionsMenu = ({
  engineState,
  engineName,
  engineVersion,
  onFix,
  onOpenEngine,
  onTroubleshoot,
  onRestartAudio,
  onImportEq,
  onImportImpulse,
  onProcesses,
  onSupport,
  help,
}: IActionsMenuProps) => {
  const { t, locale } = useTranslation();
  const isToolsShed = useTitlebarToolsShed();
  // Help's count of what is new in the Forum comes here with Help's entries
  // while Help's own button is away.
  const forumNewsAll = useForumNewsCount();
  const forumNewsHidden = useForumNewsHidden();
  const forumNews = forumNewsHidden ? 0 : forumNewsAll;
  const [open, setOpen] = useState(false);
  // Held here rather than in the menu's panel, which is gone the moment the
  // row is pressed.
  const [isResetting, setResetting] = useState(false);
  const [isPickingKey, setPickingKey] = useState(false);
  const [isTuningAgentOpen, setTuningAgentOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const exit = useExitAnimation(open, 'menu-out', panel);
  const status = t(STATUS_KEYS[engineState]);

  // The room the panel has: it hangs from the trigger's right edge, so it
  // can reach as far left as that edge less the window's 12px gutter. Two
  // columns side by side ran off the window's left edge in a narrow window;
  // held to this, the look wraps under the rest instead (`ActionsMenu.scss`).
  // Measured again whenever the window changes size while it is open.
  const isPanelPresent = exit.present;
  useLayoutEffect(() => {
    const element = panel.current;
    const button = trigger.current;
    if (!isPanelPresent || !element || !button) {
      return undefined;
    }
    const measure = () => {
      const room = Math.floor(button.getBoundingClientRect().right - 12);
      element.style.setProperty('--actions-menu-room', `${room}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, [isPanelPresent]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    // Into the menu, as the Help menu beside it does: opened from the
    // keyboard, the next key already walks it. Opened with the mouse, the
    // focus draws nothing.
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const dismiss = (event: PointerEvent) => {
      const { target } = event;
      // The language list is portalled to the body so the menu cannot clip
      // it, and it still belongs here: closing on its option's pointerdown
      // unmounted the picker before the click chose anything.
      // So is a colour picker opened from its rows (`ColourPickerPopover`,
      // an AnchoredMenu on the body): a press on its colours closed the
      // whole menu, the picker with it, as the hand moved over the field
      // (Ivan, 2026-11-18).
      if (
        target instanceof Element &&
        (root.current?.contains(target) ||
          target.closest('.language-picker-menu') ||
          isInsideAnchoredMenu(target))
      ) {
        return;
      }
      setOpen(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  // The scene the window wears, to put behind the desktop's icons; a
  // standard look has none, and a machine without the desktop manager
  // cannot take one.
  const sceneLookId = useSelectedSceneLookId();
  const canSetDesktop = useCanSetDesktop();
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  const walk = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) {
      return;
    }
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE),
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number | undefined;
    if (event.key === 'ArrowDown') {
      next = (index + 1) % items.length;
    } else if (event.key === 'ArrowUp') {
      // From nothing in particular — the panel itself focused — up is the
      // last entry, not the one before it.
      next =
        index < 0
          ? items.length - 1
          : (index - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = items.length - 1;
    }
    if (next !== undefined) {
      event.preventDefault();
      items[next]?.focus();
    }
  };

  // Working, the card is named after the engine and says it is connected.
  // Failing, the fault is the headline and the engine the small print. With
  // no engine named yet the status stands alone rather than beside a guess.
  let title = status;
  let detail: string | undefined;
  if (engineName && engineState === 'ready') {
    title = engineName;
    detail = status;
  } else if (engineName && engineState === 'failing') {
    detail = engineName;
  }
  // And which engine it is, on the same line. It decides what the app can
  // ask of it — the slot ladder's newer rungs, whether it counts the sound
  // reaching it, whether its rack will start at all — so "which version is
  // on this machine" is a question both a bug report and a repair begin
  // with, and it was only ever answerable from a report. Not for Equalizer
  // APO, which says nothing about itself.
  if (detail && engineVersion) {
    detail = `${detail} · ${engineVersion}`;
  }
  const engineText = (
    <span className="actions-menu__engine-text">
      <span className="actions-menu__engine-title">{title}</span>
      {detail && <span className="actions-menu__engine-detail">{detail}</span>}
    </span>
  );

  return (
    <div className="workspace-header__tools actions-menu" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="workspace-header__tools-trigger"
        aria-label={
          isToolsShed && help && forumNews > 0
            ? `${t('app.actions')} · ${t('forum.new.countLabel', {
                count: forumNewsText(forumNews, locale),
              })}`
            : t('app.actions')
        }
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={exit.present ? panelId : undefined}
        title={t('app.actions.title')}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={MENU_LINES} />
        </svg>
        <span
          className={`status-dot${engineState === 'failing' ? ' error' : ''}`}
        />
        {isToolsShed && help && (
          <ForumNewsBadge count={forumNews} placement="corner" />
        )}
      </button>
      {exit.present && (
        <div
          id={panelId}
          ref={panel}
          className="workspace-header__menu actions-menu__panel"
          role="menu"
          tabIndex={-1}
          aria-label={t('app.actions')}
          data-closing={exit.closing ? '' : undefined}
          inert={exit.closing}
          onAnimationEnd={exit.onAnimationEnd}
          onKeyDown={walk}
        >
          {/* Two columns (Ivan, 2026-11-16: "this menu needs to be split in
              two columns, one for all options, the other for theme
              options"): what the app does and how it behaves on the left,
              how it looks on the right. Each as wide as its own longest
              row, so no label wraps in any language; a window too narrow
              for both side by side puts the look under the rest. */}
          <div className="actions-menu__columns">
            <div className="actions-menu__column">
              {/* The status is the card, so a fault is never a line of text
              with nothing to press: failing, the whole card is the way back
              to the notice with Install and Retry, which is otherwise out of
              reach once it has been dismissed. */}
              {engineState === 'ready' && (
                <button
                  type="button"
                  role="menuitem"
                  aria-haspopup="dialog"
                  className="actions-menu__engine"
                  onClick={run(onOpenEngine)}
                >
                  <EngineBadge state={engineState} />
                  {engineText}
                  <Chevron className="actions-menu__engine-go" />
                </button>
              )}
              {engineState === 'failing' && (
                <button
                  type="button"
                  role="menuitem"
                  className="actions-menu__engine is-failing"
                  onClick={run(onFix)}
                >
                  <EngineBadge state={engineState} />
                  {engineText}
                  <span className="actions-menu__engine-fix">
                    {t('app.menu.fix')}
                  </span>
                </button>
              )}
              {engineState === 'checking' && (
                <div className="actions-menu__engine is-checking">
                  <EngineBadge state={engineState} />
                  {engineText}
                </div>
              )}

              {/* Straight under the engine they repair, and in every state.
              These four used to appear only while the engine was reported
              healthy, which put the two repairs — the troubleshooter and the
              restart — out of reach at the one moment anybody wants them:
              the menu emptied itself exactly when the light beside it went
              red. Nothing here needs a working engine. The troubleshooter
              comes first: it is the one to open without knowing which repair
              is needed, which is everybody whose sound just stopped. */}
              <Item icon="wrench" onSelect={run(onTroubleshoot)}>
                {t('app.menu.fixAudio')}
              </Item>
              <Item icon="restart" onSelect={run(onRestartAudio)}>
                {t('app.menu.restartAudio')}
              </Item>
              {/* FluidEQ's power switch on a key held system-wide, so it works
              from inside a game (`EngineKeySwitch`). */}
              <Item icon="power" onSelect={run(() => setPickingKey(true))}>
                {t('app.menu.engineKey')}
              </Item>
              <Item
                icon="configure"
                onSelect={run(() => setTuningAgentOpen(true))}
              >
                {t('app.menu.tuningAgent')}
              </Item>
              <hr className="actions-menu__rule" />
              <Item icon="import" onSelect={run(onImportEq)}>
                {t('app.menu.importEq')}
              </Item>
              <Item icon="convolution" onSelect={run(onImportImpulse)}>
                {t('app.menu.importConvolution')}
              </Item>
              <hr className="actions-menu__rule" />

              {/* In every state: neither needs the engine, and reinstalling is
              one way out of an app whose engine will not start. */}
              <Item icon="chip" onSelect={run(onProcesses)}>
                {t('app.processes.menu')}
              </Item>
              {/* A way out of an app set up into a corner, like reinstalling and
              short of it: the settings as a new install has them, the EQ,
              the outputs and the engine as they are. */}
              <Item icon="reset" onSelect={run(() => setResetting(true))}>
                {t('app.menu.resetSettings')}
              </Item>
              <Item
                icon="download"
                onSelect={run(() =>
                  window.open(LATEST_RELEASE_URL, '_blank', 'noopener'),
                )}
              >
                {t('app.menu.reinstallApp', { product: PRODUCT_NAME })}
              </Item>
              <hr className="actions-menu__rule" />
              {/* No Account row (Ivan, 2026-11-13): the sound needs no account,
              and an account is for the Visualizers, so it lives on that tab
              alone — Sign in signed out, the card at the foot of its rail
              signed in. */}
              <Item icon="support" onSelect={run(onSupport)}>
                {t('app.menu.support')}
              </Item>
              {/* What left the titlebar for want of room, so nothing it held is
              out of reach (Ivan, 2026-09-28: "shed small things"): Help's
              entries, less fixing audio, which heads this menu already, and
              the switch to the compact player, in its own drawing. */}
              {isToolsShed && help && (
                <>
                  <hr className="actions-menu__rule" />
                  {helpMenuActions(t, help, requestHelpGuide)
                    .filter((action) => action.id !== 'fixAudio')
                    .map((action) => (
                      <Fragment key={action.id}>
                        <Item icon={action.icon} onSelect={run(action.run)}>
                          {action.id === 'forum' ? (
                            <span className="help-menu__label">
                              {action.label}
                              <ForumNewsBadge
                                count={forumNews}
                                placement="row"
                              />
                            </span>
                          ) : (
                            action.label
                          )}
                        </Item>
                        {action.id === 'forum' && (
                          <ForumNewsMenuItems
                            news={forumNewsAll}
                            hidden={forumNewsHidden}
                            run={run}
                          />
                        )}
                      </Fragment>
                    ))}
                  <button
                    type="button"
                    role="menuitem"
                    className="workspace-header__menu-item"
                    onClick={run(() => {
                      // As the switch does: main answers with the mode it is in,
                      // and a request that fails reaches a main that is
                      // restarting, whose next push says which mode it came back in.
                      setWindowMode('player').catch(() => undefined);
                    })}
                  >
                    <PlayerIcon
                      name="player"
                      className="menu-icon player-icon"
                    />
                    {t('player.switch.toPlayer')}
                  </button>
                </>
              )}

              {/* Last, and in every state: someone who cannot read the rest of
              this menu still has to be able to reach the language. */}
              <div className="actions-menu__prefs">
                <MotionPicker />
                {/* Under the animations row, where Ivan asked for it
                (2026-09-19). Nothing else in the app decides this: the answer
                is Windows' own startup list for this person. */}
                <StartupPicker />
                <LanguagePicker />
              </div>
            </div>
            <div className="actions-menu__column is-look">
              {/* The window's look, all of it (`WindowLookSection`): the
                graph's Window colours menu moved here whole (Ivan,
                2026-11-16). */}
              <div className="actions-menu__prefs">
                <WindowLookSection />
                <SliderHandlePicker />
              </div>
              {sceneLookId && canSetDesktop && (
                <Item
                  icon="monitor"
                  onSelect={run(() => openWallpaperDialog(sceneLookId))}
                >
                  {t('wallpaper.action')}
                </Item>
              )}
            </div>
          </div>
        </div>
      )}
      {isResetting && (
        <ResetSettingsDialog onClose={() => setResetting(false)} />
      )}
      {isPickingKey && <EngineKeyDialog onClose={() => setPickingKey(false)} />}
      {isTuningAgentOpen && (
        <TuningAgentDialog onClose={() => setTuningAgentOpen(false)} />
      )}
    </div>
  );
};

export default ActionsMenu;
