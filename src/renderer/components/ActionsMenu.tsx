/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { LATEST_RELEASE_URL, PRODUCT_NAME } from 'common/branding';
import type { TranslationKey } from 'common/i18n/en';
import Chevron from '../icons/Chevron';
import MenuIcon, { type MenuIconName } from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import useExitAnimation from '../utils/useExitAnimation';
import LanguagePicker from './LanguagePicker';
import MotionPicker from './MotionPicker';
import ThemePicker from './ThemePicker';
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

/** The trigger's own drawing, repeated on the engine card it opens onto. */
const PULSE = 'M4 12h3l2-6 4 12 2-6h5';

/** Everything the arrow keys walk through, in the order it is drawn. */
const FOCUSABLE =
  '[role="menuitem"], [role="menuitemradio"], .switch-checkbox, .dropdown > [role="menu"]';

interface IActionsMenuProps {
  engineState: TEngineState;
  /** The engine in use, once main has said which. */
  engineName?: string;
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
   * Absent from a build with no backend configured, which is every fork and
   * every checkout without a .env: a row opening a sign-in that cannot
   * complete is worse than no row.
   */
  onAccount?: () => void;
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
  onFix,
  onOpenEngine,
  onTroubleshoot,
  onRestartAudio,
  onImportEq,
  onImportImpulse,
  onProcesses,
  onSupport,
  onAccount,
}: IActionsMenuProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const exit = useExitAnimation(open, 'menu-out', panel);
  const status = t(STATUS_KEYS[engineState]);

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
      if (
        target instanceof Element &&
        (root.current?.contains(target) ||
          target.closest('.language-picker-menu'))
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
        aria-label={t('app.actions')}
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
          <path d={PULSE} />
        </svg>
        <span
          className={`status-dot${engineState === 'failing' ? ' error' : ''}`}
        />
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
          <Item
            icon="download"
            onSelect={run(() =>
              window.open(LATEST_RELEASE_URL, '_blank', 'noopener'),
            )}
          >
            {t('app.menu.reinstallApp', { product: PRODUCT_NAME })}
          </Item>
          <hr className="actions-menu__rule" />
          {onAccount && (
            <Item icon="artist" onSelect={run(onAccount)}>
              {t('account.menu')}
            </Item>
          )}
          <Item icon="support" onSelect={run(onSupport)}>
            {t('app.menu.support')}
          </Item>

          {/* Last, and in every state: someone who cannot read the rest of
              this menu still has to be able to reach the language. */}
          <div className="actions-menu__prefs">
            <ThemePicker />
            <MotionPicker />
            <LanguagePicker />
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionsMenu;
