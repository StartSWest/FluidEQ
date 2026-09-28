/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useId, useRef, useState } from 'react';
import BrandMark from '../icons/BrandMark';
import MenuIcon, { type MenuIconName } from '../icons/MenuIcon';
import MenuPreferenceIcon from '../components/MenuPreferenceIcon';
import SliderHandlePicker from '../components/SliderHandlePicker';
import BackdropVeilSlider from '../graph/BackdropVeilSlider';
import RainbowSwitch from '../graph/RainbowSwitch';
import WindowBrightnessSlider from '../graph/WindowBrightnessSlider';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu from '../widgets/AnchoredMenu';
import Switch from '../widgets/Switch';
import PlayerIcon from './PlayerIcon';
import useMenuDismiss from './useMenuDismiss';
import {
  setWindowMode,
  setWindowPinned,
  useWindowMode,
} from './windowModeStore';

/** The full app's pages, as the player's menu offers them. */
export type TPlayerPage =
  'video' | 'share' | 'eq' | 'dsp' | 'library' | 'karaoke' | 'plus';

// In the tab strip's order, under its names and behind its glyphs, all read
// from the same keys and the same icon set — this menu stands in for that
// strip while the window is the player, and a page a listener recognises by
// its picture up there should be the same picture here (Ivan, 2026-09-22).
const PAGES = [
  { page: 'video', labelKey: 'tabs.media', icon: 'video' },
  { page: 'share', labelKey: 'tabs.share', icon: 'waveform' },
  { page: 'eq', labelKey: 'tabs.eq', icon: 'layout' },
  { page: 'dsp', labelKey: 'tabs.dsp', icon: 'configure' },
  { page: 'library', labelKey: 'tabs.library', icon: 'album' },
  { page: 'karaoke', labelKey: 'tabs.karaoke', icon: 'microphone' },
  { page: 'plus', labelKey: 'tabs.plus', icon: 'plusTab' },
] as const satisfies readonly {
  page: TPlayerPage;
  labelKey: string;
  icon: MenuIconName;
}[];

/**
 * Always on top, as a row of the settings tray: a switch, because it is one
 * yes-or-no about the amp's window, like Animations in the app's own tray.
 */
const PinPreference = () => {
  const { t } = useTranslation();
  const { isPinned } = useWindowMode();
  const id = useId();
  return (
    <div className="menu-preference">
      <MenuPreferenceIcon name="pin" />
      <label htmlFor={id} className="menu-preference__label">
        {t('player.menu.alwaysOnTop')}
      </label>
      <span className="menu-preference__switch">
        <Switch
          id={id}
          isOn={isPinned}
          isDisabled={false}
          handleToggle={() => setWindowPinned(!isPinned).catch(() => undefined)}
          ariaLabel={t('player.menu.alwaysOnTop')}
        />
      </span>
    </div>
  );
};

interface IPlayerMarkMenuProps {
  onFold: () => void;
  /** Back to the full app, on one of its pages. */
  onOpenPage: (page: TPlayerPage) => void;
}

/**
 * The FluidEQ mark on its key, and the menu it opens.
 *
 * On the Stage's glass (Ivan, 2026-09-27), in the order it is used: the way
 * back to the full app, large; the app's seven pages behind the tab strip's
 * glyphs; the app's own settings tray — Brightness, Transparency, Rainbow
 * mode and the sliders' handles, the same components writing the same
 * settings (Ivan, 2026-09-26: "add brightness and transparency same as in
 * app"), with Always on top under its hairline, where the app keeps how it
 * behaves; and the fold at the foot.
 *
 * Brightness is the amp's own, as the theme always was (`utils/theme.ts`):
 * the same slider over the same range as the full app's, remembered apart
 * because the two are never on screen at once (Ivan, 2026-09-22).
 *
 * The folded line wears the same key (`FoldStrip`) but not this menu: a
 * window one line tall has nowhere to open one (Ivan, 2026-09-22), so there
 * the key is the way back to the app.
 */
const PlayerMarkMenu = ({ onFold, onOpenPage }: IPlayerMarkMenuProps) => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  useMenuDismiss(isMenuOpen, holder, closeMenu);
  const run = (action: () => void) => () => {
    closeMenu();
    action();
  };

  return (
    <div className="player-title__menu" ref={holder}>
      <button
        type="button"
        className="player-title__mark"
        aria-label={t('player.menu')}
        title={t('player.menu')}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((open) => !open)}
      >
        <BrandMark />
        <PlayerIcon name="caret" className="player-icon player-icon--caret" />
      </button>
      <AnchoredMenu
        anchor={holder.current}
        isOpen={isMenuOpen}
        align="left"
        className="player-menu player-menu--mark"
        ariaLabel={t('player.menu')}
      >
        {/* The way back to the full app, first and largest: it is the one
            thing everybody opens this menu for. */}
        <button
          type="button"
          role="menuitem"
          className="player-menu__home"
          onClick={run(() => {
            setWindowMode('app').catch(() => undefined);
          })}
        >
          <PlayerIcon name="app" />
          <span className="player-menu__home-text">
            <b>{t('player.menu.fullApp')}</b>
            <small>{t('player.menu.fullAppHint')}</small>
          </span>
          <PlayerIcon name="chevronRight" />
        </button>
        {/* The app's pages, each behind the glyph the tab strip gives it,
            four to a row: this menu stands in for that strip. */}
        <div
          className="player-menu__pages"
          role="group"
          aria-label={t('player.menu.openIn')}
        >
          {PAGES.map(({ page, labelKey, icon }) => (
            <button
              key={page}
              type="button"
              role="menuitem"
              className="player-menu__page"
              onClick={run(() => onOpenPage(page))}
            >
              <span className="player-menu__page-icon" aria-hidden="true">
                <MenuIcon name={icon} />
              </span>
              {t(labelKey)}
            </button>
          ))}
        </div>
        <div className="actions-menu__prefs">
          <div className="actions-menu__sliders">
            <WindowBrightnessSlider />
            <BackdropVeilSlider />
            <RainbowSwitch />
          </div>
          <SliderHandlePicker />
          {/* How the amp looks above, how its window behaves below. */}
          <div className="actions-menu__prefs-rule" aria-hidden="true" />
          <PinPreference />
        </div>
        <hr className="player-menu__rule" />
        <button
          type="button"
          role="menuitem"
          className="player-menu__fold"
          onClick={run(onFold)}
        >
          <PlayerIcon name="fold" />
          <span>{t('player.menu.fold')}</span>
          <small>{t('player.menu.foldHint')}</small>
        </button>
      </AnchoredMenu>
    </div>
  );
};

export default PlayerMarkMenu;
