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
import PresetCardCurve from '../presetCard/PresetCardCurve';
import type { IPresetCurveDesign } from '../presetCard/presetCardDrawing';
import type { TCopyLinkResult } from './share/presetShareActions';

/** Copy share link's line in place of the hint, by what came of the press. */
const LINK_LINE = {
  making: 'presetShare.linkMaking',
  copied: 'presetShare.linkCopied',
  'not-copied': 'presetShare.export.failed',
  'signed-out': 'presetShare.linkFailed.signedOut',
  suspended: 'presetShare.linkFailed.suspended',
  'rate-limited': 'presetShare.linkFailed.rateLimited',
  'too-many': 'presetShare.linkFailed.tooMany',
  'taken-down': 'presetShare.linkFailed.takenDown',
  invalid: 'presetShare.linkFailed.offline',
  offline: 'presetShare.linkFailed.offline',
} as const satisfies Record<TCopyLinkResult | 'making', string>;

interface IOwnPresetTileProps {
  preset: IDspCatalogEntry;
  /** How its curve is drawn, read once by the tab for every card. */
  curveDesign: IPresetCurveDesign;
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
  /** Share: a topic about it on the Forum's Presets board. */
  onShare: () => void;
  /** Its short link to the clipboard; resolves with what came of it. */
  onCopyLink: () => Promise<TCopyLinkResult>;
  onExport: () => void;
}

type TMenuItem = {
  key: string;
  icon:
    | 'eqBars'
    | 'pencil'
    | 'duplicate'
    | 'forum'
    | 'copyText'
    | 'upload'
    | 'trash';
  label: string;
  run: () => void;
  isDanger?: boolean;
  /** The first of a group of its own, set apart by a rule. */
  startsGroup?: boolean;
};

/**
 * One of the listener's presets on the Preset tab: pressed, it plays, as
 * every tile there does; its curve along its foot in the Preset layer's
 * violet, as every card draws its own in its ink; and a menu of its own —
 * Edit, Rename (in place), Duplicate, its three ways out (Share to the
 * community, Copy share link, Export) and Delete — which a factory
 * preset does not have. Delete asks first, in the notes beside the grid.
 */
const OwnPresetTile = ({
  preset,
  curveDesign,
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
  onShare,
  onCopyLink,
  onExport,
}: IOwnPresetTileProps) => {
  const { t } = useTranslation();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [draft, setDraft] = useState(preset.name);
  // "Making the link…", then "Link copied" or why not, in place of the hint
  // until the pointer leaves the tile: said where the press was, and gone
  // with no clock deciding when.
  const [linkState, setLinkState] = useState<
    TCopyLinkResult | 'making' | undefined
  >(undefined);
  const [tile, setTile] = useState<HTMLDivElement | null>(null);

  // The pointer leaving the tile itself, heard on the element: React's own
  // leave counts the menu as the tile's (it is rendered from inside it), so
  // the menu closing on Copy share link read as a leave and wiped the line
  // the press had just written (measured in the harness). A link still being
  // made keeps its line: its answer is still to come.
  useEffect(() => {
    if (!tile) {
      return undefined;
    }
    const onLeave = () =>
      setLinkState((state) => (state === 'making' ? state : undefined));
    tile.addEventListener('pointerleave', onLeave);
    return () => tile.removeEventListener('pointerleave', onLeave);
  }, [tile]);

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
      key: 'share',
      icon: 'forum',
      label: t('presetShare.menu.community'),
      run: onShare,
      startsGroup: true,
    },
    {
      key: 'link',
      icon: 'copyText',
      label: t('presetShare.menu.copyLink'),
      run: () => {
        setLinkState('making');
        onCopyLink()
          .then((result) => {
            setLinkState(result);
            return result;
          })
          .catch(() => setLinkState('offline'));
      },
    },
    {
      key: 'export',
      icon: 'upload',
      label: t('presetShare.menu.export'),
      run: onExport,
    },
    {
      key: 'delete',
      icon: 'trash',
      label: t('myCurves.delete'),
      run: onAskDelete,
      isDanger: true,
      startsGroup: true,
    },
  ];

  let linkLineClass: string | undefined;
  if (linkState === 'copied') {
    linkLineClass = 'own-preset-tile__done';
  } else if (linkState && linkState !== 'making') {
    linkLineClass = 'own-preset-tile__problem';
  }

  const finishRename = () => {
    const next = draft.trim();
    onRenameEnd(next !== '' && next !== preset.name ? next : undefined);
  };

  return (
    <div
      ref={setTile}
      className={`own-preset-tile${isPlaying ? ' is-playing' : ''}`}
    >
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
            <span
              className={linkLineClass}
              role={linkState ? 'status' : undefined}
            >
              {linkState ? t(LINK_LINE[linkState]) : hint}
            </span>
          </span>
        </button>
      )}
      {/* Across the card's foot, under the star and the menu too, so it
          lines up with a factory card's beside it; a press on it is the
          card's own press (`.own-preset-tile__main::before`). */}
      <PresetCardCurve
        curve={preset.curve}
        design={curveDesign}
        tone={isPlaying ? 'playing' : 'own'}
      />
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
      {/* Share beside the star: under the pointer or the focus as the
          star is, and always on the preset that plays. */}
      <button
        type="button"
        className="own-preset-tile__share"
        aria-label={t('presetShare.share', { name: preset.name })}
        title={t('presetShare.share', { name: preset.name })}
        onPointerEnter={onPoint}
        onClick={onShare}
      >
        <MenuIcon name="upload" />
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
            {/* Sharing, and Delete, stand apart from what keeps the
                preset. */}
            {item.startsGroup && (
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
