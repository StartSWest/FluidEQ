/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import AnchoredMenu from '../widgets/AnchoredMenu';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import ClearPlaylistDialog from './KaraokeClearDialog';

interface IKaraokePlaylistAddMenuProps {
  isBusy: boolean;
  hasSongs: boolean;
  groupByFolder: boolean;
  onAddFiles: () => void;
  onAddFolder: () => void;
  onToggleFolderGrouping: () => void;
  onClear: () => void;
}

/**
 * The list heading's +, as the K1 mockup draws it (Ivan, 2026-11-15: "the
 * search, the add button"): adding songs or a folder, folding the list by
 * folder, and unloading it. These were four buttons in a header row of
 * their own above the whole tab.
 */
const KaraokePlaylistAddMenu = ({
  isBusy,
  hasSongs,
  groupByFolder,
  onAddFiles,
  onAddFolder,
  onToggleFolderGrouping,
  onClear,
}: IKaraokePlaylistAddMenuProps) => {
  const { t } = useTranslation();
  const holder = useRef<HTMLSpanElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const outside = (event: MouseEvent) => {
      if (
        !holder.current?.contains(event.target as Node) &&
        !content.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        setIsOpen(false);
        holder.current?.querySelector('button')?.focus();
      }
    };
    window.addEventListener('mousedown', outside);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('mousedown', outside);
      window.removeEventListener('keydown', escape);
    };
  }, [isOpen]);

  const choose = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <span ref={holder} className="karaoke-playlist__add">
      <button
        type="button"
        className="karaoke-playlist__tool"
        aria-label={t('karaoke.playlist.add')}
        title={t('karaoke.playlist.add')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <MenuIcon name="plus" />
      </button>
      <AnchoredMenu
        anchor={holder.current}
        isOpen={isOpen}
        className="karaoke-playlist__menu"
        role="menu"
        ariaLabel={t('karaoke.playlist.add')}
        align="left"
      >
        <div ref={content} className="karaoke-playlist__menu-items">
          <button
            type="button"
            role="menuitem"
            className="karaoke-playlist__menu-item"
            disabled={isBusy}
            onClick={() => choose(onAddFiles)}
          >
            <MenuIcon name="filePlus" />
            <span>{t('karaoke.import.addFiles')}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="karaoke-playlist__menu-item"
            disabled={isBusy}
            onClick={() => choose(onAddFolder)}
          >
            <MenuIcon name="folder" />
            <span>{t('karaoke.import.folder')}</span>
          </button>
          {hasSongs && (
            <>
              <span className="karaoke-playlist__menu-rule" role="separator" />
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={groupByFolder}
                className="karaoke-playlist__menu-item"
                onClick={() => choose(onToggleFolderGrouping)}
              >
                <MenuIcon name="folderTree" />
                <span>{t('karaoke.playlist.groupFolders')}</span>
                {groupByFolder && (
                  <MenuIcon
                    name="check"
                    className="karaoke-playlist__menu-check"
                  />
                )}
              </button>
              <button
                type="button"
                role="menuitem"
                className="karaoke-playlist__menu-item is-danger"
                onClick={() => choose(() => setIsClearing(true))}
              >
                <MenuIcon name="clear" />
                <span>{t('karaoke.import.clear')}</span>
              </button>
            </>
          )}
        </div>
      </AnchoredMenu>
      {isClearing && (
        <ClearPlaylistDialog
          onCancel={() => setIsClearing(false)}
          onConfirm={() => {
            setIsClearing(false);
            onClear();
          }}
        />
      )}
    </span>
  );
};

export default KaraokePlaylistAddMenu;
