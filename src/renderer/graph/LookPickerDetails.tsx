/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import LookIcon from '../icons/LookIcon';
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
        <span>{t('library.sort.name')}</span>
        <span>{t('graph.picker.from')}</span>
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
      {styles.map((row) => (
        <div key={row.id} className="look-picker__item" role="listitem">
          <button
            type="button"
            className={`look-picker__pick look-picker__row${
              row.id === value ? ' is-selected' : ''
            }`}
            aria-pressed={row.id === value}
            tabIndex={row.id === stop ? 0 : -1}
            title={row.name}
            onClick={() => onChoose(row.id)}
          >
            <span className="look-picker__row-art look-picker__art--style">
              <LookIcon
                className="look-picker__drawing"
                style={row.look.style}
                palette={row.look.palette}
                colours={row.look.colours}
              />
            </span>
            <span className="look-picker__name">{row.name}</span>
            <span className="look-picker__cell">
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
      ))}
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
  return (
    <div className="look-picker__item" role="listitem">
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
        </span>
        <span className="look-picker__name">
          <span className="look-picker__name-text">{row.name}</span>
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
        <span className="look-picker__cell">
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
