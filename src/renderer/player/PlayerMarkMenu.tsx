/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useRef, useState } from 'react';
import BrandMark from '../icons/BrandMark';
import ThemePicker from '../components/ThemePicker';
import MenuIcon, { type MenuIconName } from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu from '../widgets/AnchoredMenu';
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

interface IPlayerMarkMenuProps {
  onFold: () => void;
  /** Back to the full app, on one of its pages. */
  onOpenPage: (page: TPlayerPage) => void;
}

/**
 * The FluidEQ mark on its key, and the menu it opens.
 *
 * The menu stands in for the app's tab strip: every page is one press away,
 * and pressing one brings the full app back on it. Then the amp's own light
 * or dark, Always on top, and the fold. The folded line wears the same key
 * (`FoldStrip`) but not this menu: a window one line tall has nowhere to
 * open one (Ivan, 2026-09-22), so there the key is the way back to the app.
 */
const PlayerMarkMenu = ({ onFold, onOpenPage }: IPlayerMarkMenuProps) => {
  const { t } = useTranslation();
  const { isPinned } = useWindowMode();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  useMenuDismiss(isMenuOpen, holder, closeMenu);
  const togglePin = () => setWindowPinned(!isPinned).catch(() => undefined);

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
        className="player-menu"
        ariaLabel={t('player.menu')}
      >
        <button
          type="button"
          role="menuitem"
          className="player-menu__item"
          onClick={() => {
            closeMenu();
            setWindowMode('app').catch(() => undefined);
          }}
        >
          <PlayerIcon name="app" />
          <span>{t('player.menu.fullApp')}</span>
        </button>
        <div className="player-menu__rule" role="separator" />
        <span className="player-menu__heading">{t('player.menu.openIn')}</span>
        <div className="player-menu__pages">
          {PAGES.map(({ page, labelKey, icon }) => (
            <button
              key={page}
              type="button"
              role="menuitem"
              className="button small subtle player-menu__page"
              onClick={() => {
                closeMenu();
                onOpenPage(page);
              }}
            >
              <MenuIcon name={icon} />
              {t(labelKey)}
            </button>
          ))}
        </div>
        <div className="player-menu__rule" role="separator" />
        {/* THE AMP'S OWN LIGHT OR DARK. The app's own picker, unchanged: it
            reads and writes whichever choice belongs to the window's current
            mode (`utils/theme.ts`), so opened from here it is the amp's and
            opened from the full app's menu it is the app's. The two are
            remembered apart (Ivan, 2026-09-22). */}
        <ThemePicker />
        <div className="player-menu__rule" role="separator" />
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={isPinned}
          className="player-menu__item"
          onClick={togglePin}
        >
          <PlayerIcon name={isPinned ? 'check' : 'pin'} />
          <span>{t('player.menu.alwaysOnTop')}</span>
        </button>
        <button
          type="button"
          role="menuitem"
          className="player-menu__item"
          onClick={() => {
            closeMenu();
            onFold();
          }}
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
