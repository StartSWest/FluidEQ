/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import { BRAND_MARK } from 'common/branding';
import LookIcon from '../icons/LookIcon';
import LibraryPlayingBars from '../library/LibraryPlayingBars';
import { useTranslation } from '../utils/I18nContext';
import GraphSceneRemove from './GraphSceneRemove';
import GraphSceneReport from './GraphSceneReport';
import { originOf, type TFreshness } from './lookPickerFilter';
import { FAMILY_KEYS, type IPlusRow, type IStyleRow } from './lookPickerRows';
import { LockBadge, SceneThumbnail } from './lookPickerParts';
import { useTileClip } from './lookTileClips';
import SceneClip from '../plus/SceneClip';

/**
 * The picker's tiles: a scene's picture or a style's drawing, its name, and
 * under it who made it and which version is here (Ivan, 2026-11-19: "give me
 * more cues"). The cues sit where the eye already is - "New" or "Updated" on
 * the picture's corner, "Playing" on the look that is on the graph - instead
 * of in a list of words beside a 72px stamp.
 */

/**
 * Who made it, as a mark before the caption: FluidEQ's wave, the member's
 * own initial in the accent, another member's initial. The same three words
 * as the From tabs, so the tab and the tile say one thing.
 */
export function OriginMark({ row }: { row: IStyleRow | IPlusRow }) {
  const origin = originOf(row);
  if (origin === 'fluideq') {
    return (
      <svg
        className="look-picker__origin look-picker__origin--fluideq"
        viewBox={BRAND_MARK.viewBox}
        aria-hidden="true"
        focusable="false"
      >
        <path d={BRAND_MARK.path} />
      </svg>
    );
  }
  const name = 'author' in row && row.author ? row.author : '';
  return (
    <span
      className={`look-picker__origin look-picker__origin--${origin}`}
      aria-hidden="true"
    >
      {origin === 'yours' ? '' : name.slice(0, 1).toLocaleUpperCase()}
    </span>
  );
}

/** "Playing", on the picture of the look the graph is showing. */
function PlayingChip() {
  const { t } = useTranslation();
  return (
    <span className="look-picker__playing">
      <span className="library-list__playing-mark">
        <LibraryPlayingBars />
      </span>
      {t('graph.picker.playing')}
    </span>
  );
}

/**
 * What the caption under a scene says: who made it and its version, or -
 * for a version not played here yet - what its maker wrote about it, which
 * is the more useful line until it has been heard.
 */
export const useSceneCaption = (
  row: IPlusRow,
  fresh: TFreshness | undefined,
) => {
  const { t } = useTranslation();
  if (fresh === 'updated' && row.version !== undefined) {
    return {
      text: row.versionNote
        ? t('graph.version.caption', {
            version: String(row.version),
            note: row.versionNote,
          })
        : t('graph.version.captionBare', { version: String(row.version) }),
      version: undefined,
    };
  }
  let text = t('account.plus.eyebrow');
  if (row.maker === 'mine') {
    text = t('graph.member.mine');
  } else if (row.author) {
    text = t('graph.member.by', { name: row.author });
  }
  let version: string | undefined;
  if (row.latest !== undefined && row.version !== undefined) {
    version = t('graph.version.haveNewer', {
      have: String(row.version),
      version: String(row.latest),
    });
  } else if (row.version !== undefined) {
    version = t('graph.version.short', { version: String(row.version) });
  }
  return { text, version };
};

interface ISceneTileProps {
  row: IPlusRow;
  fresh: TFreshness | undefined;
  selected: boolean;
  /** The grid's one Tab stop: the chosen look, or the first. */
  tabbable: boolean;
  onChoose: (lookId: string) => void;
}

export function LookPickerSceneTile({
  row,
  fresh,
  selected,
  tabbable,
  onChoose,
}: ISceneTileProps) {
  const { t } = useTranslation();
  const caption = useSceneCaption(row, fresh);
  // The scene's published clip over its picture while the tile is in view
  // (`lookTileClips.ts`); the picture stays under it until a frame is painted.
  const [art, setArt] = useState<HTMLSpanElement | null>(null);
  const clip = useTileClip(row.thumbnail, art);
  return (
    <div className="look-picker__item">
      <button
        type="button"
        className={`look-picker__pick look-picker__tile${
          selected ? ' is-selected' : ''
        }${row.locked ? ' is-locked' : ''}`}
        aria-pressed={selected}
        tabIndex={tabbable ? 0 : -1}
        title={row.locked ? t('graph.scene.locked') : row.name}
        onClick={() => onChoose(row.id)}
      >
        <span ref={setArt} className="look-picker__art">
          <SceneThumbnail row={row} />
          {clip && <SceneClip url={clip} className="look-picker__clip" />}
          {fresh === 'new' && (
            <span className="look-picker__flag">{t('graph.version.new')}</span>
          )}
          {fresh === 'updated' && (
            <span className="look-picker__flag look-picker__flag--quiet">
              {t('graph.picker.updated')}
            </span>
          )}
          {row.locked && <LockBadge label={t('graph.scene.badge')} />}
          {selected && <PlayingChip />}
        </span>
        <span className="look-picker__name">{row.name}</span>
        <span className="look-picker__caption">
          <OriginMark row={row} />
          <span className="look-picker__caption-text">{caption.text}</span>
          {caption.version && (
            <span
              className={`look-picker__version${
                row.latest !== undefined ? ' has-newer' : ''
              }`}
            >
              {caption.version}
            </span>
          )}
        </span>
      </button>
      {/* Another member's scene: theirs to be reported, from where it is
          played. Never one's own, which has no author name here. */}
      {row.author && <GraphSceneReport lookId={row.id} name={row.name} />}
      <GraphSceneRemove lookId={row.id} name={row.name} />
    </div>
  );
}

interface IStyleTileProps {
  row: IStyleRow;
  selected: boolean;
  tabbable: boolean;
  onChoose: (lookId: string) => void;
}

/** A standard style or one the member saved: its drawing on a plate. */
export function LookPickerStyleTile({
  row,
  selected,
  tabbable,
  onChoose,
}: IStyleTileProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`look-picker__pick look-picker__tile look-picker__tile--style${
        selected ? ' is-selected' : ''
      }`}
      aria-pressed={selected}
      tabIndex={tabbable ? 0 : -1}
      title={row.name}
      onClick={() => onChoose(row.id)}
    >
      <span className="look-picker__art look-picker__art--style">
        <LookIcon
          className="look-picker__drawing"
          style={row.look.style}
          palette={row.look.palette}
          colours={row.look.colours}
        />
        {selected && <PlayingChip />}
      </span>
      <span
        className={`look-picker__name${
          row.yours ? ' graph-look-name--custom' : ''
        }`}
      >
        {row.name}
      </span>
      <span className="look-picker__caption">
        {row.yours && <OriginMark row={row} />}
        <span className="look-picker__caption-text">
          {row.yours ? t('graph.picker.yourStyle') : t(FAMILY_KEYS[row.family])}
        </span>
      </span>
    </button>
  );
}
