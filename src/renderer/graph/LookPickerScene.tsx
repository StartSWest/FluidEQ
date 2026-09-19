/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import { isUnseenSceneVersion } from '../utils/seenSceneVersions';
import GraphSceneRemove from './GraphSceneRemove';
import GraphSceneReport from './GraphSceneReport';
import { categoryName, makerName, type IPlusRow } from './lookPickerRows';
import { LockBadge, SceneThumbnail } from './lookPickerParts';

interface ILookPickerSceneProps {
  row: IPlusRow;
  selected: boolean;
  /** The column's one Tab stop: the chosen row, or the first. */
  tabbable: boolean;
  /** The first of a maker's run, when the column holds more than one maker. */
  heading: boolean;
  onChoose: (lookId: string) => void;
}

/**
 * One Plus visualizer in the look picker's second column: its picture, its
 * name, and a caption — its maker, its categories, or what changed in a
 * version not played here yet — with, beside it, the flag that reports
 * another member's scene and the button that removes it from the looks.
 */
export default function LookPickerScene({
  row,
  selected,
  tabbable,
  heading,
  onChoose,
}: ILookPickerSceneProps) {
  const { t } = useTranslation();
  // Changed since it was last played here: marked until it is played again.
  const fresh = !row.locked && isUnseenSceneVersion(row.id, row.version);
  let caption = row.author
    ? t('graph.member.by', { name: row.author })
    : row.categories.map((category) => categoryName(t, category)).join(' · ');
  if (fresh && row.version !== undefined) {
    caption = row.versionNote
      ? t('graph.version.caption', {
          version: String(row.version),
          note: row.versionNote,
        })
      : t('graph.version.captionBare', { version: String(row.version) });
  }
  return (
    <>
      {heading && (
        <p className="look-picker__group">{makerName(t, row.maker)}</p>
      )}
      <div className="look-picker__item">
        <button
          type="button"
          className={`look-picker__pick look-picker__scene${
            selected ? ' is-selected' : ''
          }${row.locked ? ' is-locked' : ''}${
            row.author ? ' look-picker__scene--reportable' : ''
          }`}
          aria-pressed={selected}
          tabIndex={tabbable ? 0 : -1}
          title={row.locked ? t('graph.scene.locked') : row.name}
          onClick={() => onChoose(row.id)}
        >
          <SceneThumbnail row={row} />
          <span className="look-picker__scene-text">
            <span className="look-picker__name">{row.name}</span>
            {caption && <span className="look-picker__caption">{caption}</span>}
          </span>
          {fresh && (
            <span className="look-picker__new">{t('graph.version.new')}</span>
          )}
          {row.locked && <LockBadge label={t('graph.scene.badge')} />}
        </button>
        {/* Another member's scene: theirs to be reported, from where it is
            played. Never one's own, which has no author name here. */}
        {row.author && <GraphSceneReport lookId={row.id} name={row.name} />}
        <GraphSceneRemove lookId={row.id} name={row.name} />
      </div>
    </>
  );
}
