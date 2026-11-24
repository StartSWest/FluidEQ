/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import SceneClip from '../plus/SceneClip';
import { useTranslation } from '../utils/I18nContext';
import GraphSceneRemove from './GraphSceneRemove';
import GraphSceneReport from './GraphSceneReport';
import type { TFreshness } from './lookPickerFilter';
import {
  categoryName,
  FAMILY_KEYS,
  type IPlusRow,
  type IStyleRow,
} from './lookPickerRows';
import { LockBadge, SceneThumbnail } from './lookPickerParts';
import { OriginMark, useSceneCaption } from './LookPickerTiles';
import { LookTileScope } from './LookStyleGrid';
import LookTileArt from './LookTileArt';
import useTileClip from './lookTileClips';

interface ILookPickerDetailsProps {
  value: string;
  styles: readonly IStyleRow[];
  scenes: readonly IPlusRow[];
  freshness: ReadonlyMap<string, TFreshness>;
  /** The list's one Tab stop. */
  stop: string | undefined;
  onChoose: (lookId: string) => void;
}

/**
 * The looks as the Library's Details view lays songs out: one row each, a
 * small picture, then name, maker, kind and version in columns, the chosen
 * one with the Library's mark. For finding a scene by who made it or which
 * version is here, where the grid is for finding one by its picture.
 *
 * "New", "Updated" and the lock stand in a column of their own at the end of
 * the name's, every row on one grid (`_lookPickerTiles.scss`), so they line
 * up down the list (Ivan, 2026-11-19: "align pills to the right"); after
 * each name they zig-zagged with the names' lengths. Every row has that
 * cell, empty or not, or the columns after it would slide one to the left.
 */
export default function LookPickerDetails({
  value,
  styles,
  scenes,
  freshness,
  stop,
  onChoose,
}: ILookPickerDetailsProps) {
  const { t } = useTranslation();
  return (
    <div className="look-picker__details" role="list">
      <div className="look-picker__details-head" aria-hidden="true">
        <span />
        {/* Over the name and the column of marks beside it. */}
        <span className="look-picker__head-name">{t('library.sort.name')}</span>
        <span className="look-picker__cell--from">
          {t('graph.picker.from')}
        </span>
        <span className="look-picker__cell--kind">
          {t('graph.picker.colKind')}
        </span>
        <span>{t('graph.picker.colVersion')}</span>
      </div>
      {scenes.map((row) => (
        <SceneRow
          key={row.id}
          row={row}
          fresh={freshness.get(row.id)}
          selected={row.id === value}
          tabbable={row.id === stop}
          onChoose={onChoose}
        />
      ))}
      {/* Each standard look's small picture drawn live, as the grid's are
          (`LookStyleGrid`): one loop and one sound for the whole list. */}
      <LookTileScope>
        {styles.map((row) => (
          <StyleRow
            key={row.id}
            row={row}
            selected={row.id === value}
            tabbable={row.id === stop}
            onChoose={onChoose}
          />
        ))}
      </LookTileScope>
    </div>
  );
}

function StyleRow({
  row,
  selected,
  tabbable,
  onChoose,
}: {
  row: IStyleRow;
  selected: boolean;
  tabbable: boolean;
  onChoose: (lookId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="look-picker__item" role="listitem">
      <button
        type="button"
        className={`look-picker__pick look-picker__row${
          selected ? ' is-selected' : ''
        }`}
        aria-pressed={selected}
        tabIndex={tabbable ? 0 : -1}
        title={row.name}
        onClick={() => onChoose(row.id)}
      >
        <span className="look-picker__row-art look-picker__art--style">
          <LookTileArt look={row.look} />
        </span>
        <span className="look-picker__name">{row.name}</span>
        <span className="look-picker__flags" />
        <span className="look-picker__cell look-picker__cell--from">
          <OriginMark row={row} />
          <span className="look-picker__caption-text">
            {row.yours ? t('graph.member.mine') : t('account.plus.eyebrow')}
          </span>
        </span>
        <span className="look-picker__cell look-picker__cell--kind">
          <span className="look-picker__caption-text">
            {`${t('graph.picker.styles')} · ${t(FAMILY_KEYS[row.family])}`}
          </span>
        </span>
        <span className="look-picker__cell" />
      </button>
    </div>
  );
}

function SceneRow({
  row,
  fresh,
  selected,
  tabbable,
  onChoose,
}: {
  row: IPlusRow;
  fresh: TFreshness | undefined;
  selected: boolean;
  tabbable: boolean;
  onChoose: (lookId: string) => void;
}) {
  const { t } = useTranslation();
  // The maker in its own column; the caption's version, or its note.
  const { text, version } = useSceneCaption(row, undefined);
  const note = useSceneCaption(row, fresh);
  // The scene's published clip over its picture while the pointer or the
  // focus is on the row, as on a grid tile (`lookTileClips.ts`): the whole
  // item answers, its report and remove buttons included.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const clip = useTileClip(row.thumbnail, hovered || focused);
  return (
    <div
      className="look-picker__item"
      role="listitem"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node && event.currentTarget.contains(next))) {
          setFocused(false);
        }
      }}
    >
      <button
        type="button"
        className={`look-picker__pick look-picker__row${
          selected ? ' is-selected' : ''
        }${row.locked ? ' is-locked' : ''}`}
        aria-pressed={selected}
        tabIndex={tabbable ? 0 : -1}
        title={fresh === 'updated' ? note.text : row.name}
        onClick={() => onChoose(row.id)}
      >
        <span className="look-picker__row-art">
          <SceneThumbnail row={row} />
          {clip && <SceneClip url={clip} className="look-picker__clip" />}
        </span>
        <span className="look-picker__name">
          <span className="look-picker__name-text">{row.name}</span>
        </span>
        <span className="look-picker__flags">
          {fresh === 'new' && (
            <span className="look-picker__flag">{t('graph.version.new')}</span>
          )}
          {fresh === 'updated' && (
            <span className="look-picker__flag look-picker__flag--quiet">
              {t('graph.picker.updated')}
            </span>
          )}
          {row.locked && <LockBadge label={t('graph.scene.badge')} />}
        </span>
        <span className="look-picker__cell look-picker__cell--from">
          <OriginMark row={row} />
          <span className="look-picker__caption-text">{text}</span>
        </span>
        <span className="look-picker__cell look-picker__cell--kind">
          <span className="look-picker__caption-text">
            {row.categories
              .map((category) => categoryName(t, category))
              .join(', ')}
          </span>
        </span>
        <span
          className={`look-picker__cell look-picker__version${
            row.latest !== undefined ? ' has-newer' : ''
          }`}
        >
          {version}
        </span>
      </button>
      {row.author && <GraphSceneReport lookId={row.id} name={row.name} />}
      <GraphSceneRemove lookId={row.id} name={row.name} />
    </div>
  );
}
