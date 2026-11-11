/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import PresetsVisual from './PresetsVisual';
import ShowcaseSlide from './ShowcaseSlide';
import type { ISlideActions } from './slides';

/**
 * 2.4's sound, which its own tour listed under the visualizers' camera: the
 * factory presets at the song's own level. From 2.5 the What's New that opens
 * after an update is the sound's alone (Ivan, 2026-11-11: "for EQ only, and
 * nothing to do with the visualizer, never"), so the sound gets its slide,
 * with the rest of 2.4's sound and the app's own news under it.
 */
const ALSO: readonly TranslationKey[] = [
  'tour.v24.heroes',
  'tour.v24.sponsors',
  'tour.v24.crashes',
];

export default function SongLevelSlide({
  actions,
}: {
  actions: ISlideActions;
}) {
  const { t } = useTranslation();
  return (
    <div className="tour-release24">
      <ShowcaseSlide
        prefix="tour.level"
        onOpen={() => actions.openTab('dsp')}
        visual={<PresetsVisual />}
      />
      <section
        className="tour-slide__how dialog-frame__group tour-release24__also"
        aria-labelledby="tour-level-also"
      >
        <h4 className="tour-slide__how-title" id="tour-level-also">
          {t('tour.v24.also')}
        </h4>
        <ul className="tour-showcase__points">
          {ALSO.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
