/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneEditThing } from 'common/sceneEdit';
import { useTranslation } from '../../utils/I18nContext';
import EditGlyph from './EditGlyph';

/** The badge's size, in the overlay's pixels. */
const BADGE = 24;

interface IEditLockBadgeProps {
  thing: ISceneEditThing;
  locked: boolean;
  /** The thing's name, for a screen reader. */
  name: string;
  /** The overlay's size: the badge stays inside it. */
  width: number;
  height: number;
  onToggle: () => void;
}

/**
 * The picked thing's lock, at its frame's top right corner on the stage. A
 * locked thing shows no handles, and this is where the hand looks for why:
 * one press unlocks it there, without going to the list.
 */
export default function EditLockBadge({
  thing,
  locked,
  name,
  width,
  height,
  onToggle,
}: IEditLockBadgeProps) {
  const { t } = useTranslation();
  return (
    <foreignObject
      x={Math.min(
        Math.max(thing.box[2] * width + 4 - BADGE / 2, 0),
        width - BADGE,
      )}
      y={Math.min(
        Math.max(thing.box[1] * height - 4 - BADGE / 2, 0),
        height - BADGE,
      )}
      width={BADGE}
      height={BADGE}
    >
      <button
        type="button"
        className={`studio-edit__badge${locked ? '' : ' is-free'}`}
        aria-pressed={locked}
        aria-label={`${t('studio.edit.lockShort')}: ${name}`}
        title={t(
          locked ? 'studio.edit.lockedHint' : 'studio.edit.unlockedHint',
        )}
        // The overlay under it would take the press as a pick.
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onClick={onToggle}
      >
        <EditGlyph name={locked ? 'lock' : 'unlock'} />
      </button>
    </foreignObject>
  );
}
