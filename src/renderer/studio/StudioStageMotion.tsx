/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TWallpaperMotion } from 'common/wallpaper';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';

interface IStudioStageMotionProps {
  motion: TWallpaperMotion;
  /** Nothing is playing and the scene moves to the demo song. */
  demo: boolean;
  onToggle: () => void;
}

/**
 * WHAT THE SCENE HEARS, AND THE PRESS THAT CHANGES IT, first on the stage's
 * plate (Ivan, 2026-11-09, clicking the demo song's tag: "if I click change
 * to calm that's what I want"): the music it moves to — "Playing to the demo
 * song" while nothing plays, as the tag always said, or "With the music",
 * the desktop's own words — or Calm,
 * and a press swaps one for the other (`stageMotion.ts`). The glyphs
 * are the desktop's own for the same two motions, and the demo song wears
 * the music's with the Gallery's live light on it.
 *
 * One button whose words say what is on, never a pair: the tag was what got
 * pressed, and a pair would have left that press doing nothing. Its name is
 * its words, and what a press does is its tooltip; it stands in a polite
 * live region, so a change is announced as the demo song's tag was — never
 * a second status role beside the loading card's. On a small
 * stage the words fold away with the plate's others and the glyph stays.
 */
export default function StudioStageMotion({
  motion,
  demo,
  onToggle,
}: IStudioStageMotionProps) {
  const { t } = useTranslation();
  const isCalm = motion === 'calm';
  let label = t('studio.stage.music');
  if (isCalm) {
    label = t('studio.stage.calm');
  } else if (demo) {
    label = t('studio.stage.demoSong');
  }
  const hint = t(isCalm ? 'studio.stage.toMusic' : 'studio.stage.toCalm');
  let mark = <Glyph name="music" />;
  if (isCalm) {
    mark = <Glyph name="calm" />;
  } else if (demo) {
    mark = (
      <span className="studio-stage-motion__live">
        <Glyph name="music" />
        <span className="studio-stage__demo-dot" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="studio-stage-motion" aria-live="polite">
      <button
        type="button"
        className={`studio-stage-motion__button${isCalm ? ' is-calm' : ''}`}
        aria-label={label}
        title={`${label}\n${hint}`}
        onClick={onToggle}
      >
        {mark}
        <span className="studio-stage-motion__label">{label}</span>
      </button>
    </span>
  );
}
