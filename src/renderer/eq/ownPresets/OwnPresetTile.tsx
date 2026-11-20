/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Fragment, useEffect, useState } from 'react';
import { USER_DSP_PRESET_NAME_MAX } from '../../../common/userPresetsFile';
import type { IDspCatalogEntry } from '../../dsp/dspPresetCatalog';
import MenuIcon from '../../icons/MenuIcon';
import VoicingIcon from '../../icons/VoicingIcon';
import { useTranslation } from '../../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../../widgets/AnchoredMenu';
import PresetCurveSpark from './PresetCurveSpark';

interface IOwnPresetTileProps {
  preset: IDspCatalogEntry;
  /** What the rack runs, as the Preset tab's other tiles say it. */
  hint: string;
  isPlaying: boolean;
  isDisabled: boolean;
  isRenaming: boolean;
  /** Starred: it files first in Favourites and in the preset picks. */
  isFavourite: boolean;
  /** What the star does now, give or take away, as the picks say it. */
  starLabel: string;
  onToggleStar: () => void;
  onApply: () => void;
  onPoint: () => void;
  onEdit: () => void;
  onRenameStart: () => void;
  /** Undefined for a rename let go of: Escape, or the name left as it was. */
  onRenameEnd: (name: string | undefined) => void;
  onDuplicate: () => void;
  onAskDelete: () => void;
}

type TMenuItem = {
  key: string;
  icon: 'eqBars' | 'pencil' | 'duplicate' | 'trash';
  label: string;
  run: () => void;
  isDanger?: boolean;
};

/**
 * One of the listener's presets on the Preset tab: pressed, it plays, as
 * every tile there does; its curve drawn small beside its name; and a menu of
 * its own — Edit, Rename (in place), Duplicate, Delete — which a factory
 * preset does not have. Delete asks first, in the notes beside the grid.
 */
const OwnPresetTile = ({
  preset,
  hint,
  isPlaying,
  isDisabled,
  isRenaming,
  isFavourite,
  starLabel,
  onToggleStar,
  onApply,
  onPoint,
  onEdit,
  onRenameStart,
  onRenameEnd,
  onDuplicate,
  onAskDelete,
}: IOwnPresetTileProps) => {
  const { t } = useTranslation();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [draft, setDraft] = useState(preset.name);

  // A press anywhere but the menu and its button closes it, as every menu
  // here closes; Escape too, and the focus goes back to the button.
  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !isInsideAnchoredMenu(event.target) &&
        !anchor?.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        anchor?.focus();
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [anchor, isMenuOpen]);

  const items: TMenuItem[] = [
    { key: 'edit', icon: 'eqBars', label: t('eq.own.edit'), run: onEdit },
    {
      key: 'rename',
      icon: 'pencil',
      label: t('myCurves.rename'),
      run: () => {
        setDraft(preset.name);
        onRenameStart();
      },
    },
    {
      key: 'duplicate',
      icon: 'duplicate',
      label: t('myCurves.duplicate'),
      run: onDuplicate,
    },
    {
      key: 'delete',
      icon: 'trash',
      label: t('myCurves.delete'),
      run: onAskDelete,
      isDanger: true,
    },
  ];

  const finishRename = () => {
    const next = draft.trim();
    onRenameEnd(next !== '' && next !== preset.name ? next : undefined);
  };

  return (
    <div className={`own-preset-tile${isPlaying ? ' is-playing' : ''}`}>
      {isRenaming ? (
        <div className="own-preset-tile__main">
          <VoicingIcon className="eq-preset-tab__glyph" />
          <input
            className="own-preset-tile__rename"
            aria-label={t('eq.own.renameLabel', { name: preset.name })}
            value={draft}
            maxLength={USER_DSP_PRESET_NAME_MAX}
            // The field is what the press opened; it takes the caret.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={finishRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                finishRename();
              } else if (event.key === 'Escape') {
                event.stopPropagation();
                onRenameEnd(undefined);
              }
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          className="own-preset-tile__main"
          aria-pressed={isPlaying}
          disabled={isDisabled}
          onPointerEnter={onPoint}
          onFocus={onPoint}
          onClick={onApply}
        >
          <VoicingIcon className="eq-preset-tab__glyph" />
          <span className="eq-preset-tab__words">
            <strong>{preset.name}</strong>
            <span>{hint}</span>
          </span>
          <PresetCurveSpark curve={preset.curve} size="tile" />
        </button>
      )}
      {/* The star every Preset tab tile has (`.rich-pick__star`), shown under
          the pointer or the focus and always once given, then the menu at
          the tile's end: side by side, never one over the other. */}
      <button
        type="button"
        className={`rich-pick__star own-preset-tile__star${
          isFavourite ? ' is-on' : ''
        }`}
        aria-pressed={isFavourite}
        aria-label={`${starLabel}: ${preset.name}`}
        title={starLabel}
        onPointerEnter={onPoint}
        onClick={onToggleStar}
      >
        <MenuIcon name="star" />
      </button>
      <button
        ref={setAnchor}
        type="button"
        className="own-preset-tile__more"
        aria-label={t('eq.own.more', { name: preset.name })}
        title={t('eq.own.more', { name: preset.name })}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        onPointerEnter={onPoint}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <MenuIcon name="menu" />
      </button>
      <AnchoredMenu
        anchor={anchor}
        isOpen={isMenuOpen}
        className="band-menu own-preset-menu"
        ariaLabel={t('eq.own.more', { name: preset.name })}
      >
        <p className="band-menu__subject">{preset.name}</p>
        {items.map((item) => (
          <Fragment key={item.key}>
            {/* Delete stands apart from what keeps the preset. */}
            {item.isDanger && (
              <span className="band-menu__rule" role="separator" />
            )}
            <button
              type="button"
              role="menuitem"
              className={item.isDanger ? 'is-danger' : undefined}
              onClick={() => {
                setMenuOpen(false);
                item.run();
              }}
            >
              <MenuIcon name={item.icon} className="band-menu__icon" />
              <span>{item.label}</span>
            </button>
          </Fragment>
        ))}
      </AnchoredMenu>
    </div>
  );
};

export default OwnPresetTile;
