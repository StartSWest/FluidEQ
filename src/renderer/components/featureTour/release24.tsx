/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import CameraVisual from './CameraVisual';
import SceneControlsVisual from './SceneControlsVisual';
import ShowcaseSlide from './ShowcaseSlide';
import StudioAiVisual from './StudioAiVisual';
import StudioAnimationsVisual from './StudioAnimationsVisual';
import StudioPicturesVisual from './StudioPicturesVisual';
import StudioStageVisual from './StudioStageVisual';
import type { ISlideActions } from './slides';

/**
 * What 2.4 announces, and most of it is the Studio (Ivan, 2026-11-09: "whats
 * new very big the new studio capability and all that is posible to do with
 * it"): its animations, the pictures in its chat, its
 * stage, its AI and what a scene can hand the member to tune, then the
 * visualizers' camera on the graph and on the desktop, with the rest of the
 * release listed under that last one. Every picture is drawn from the
 * Studio's own parts and the app's own scenes.
 */
interface ISlideProps {
  actions: ISlideActions;
}

export function AnimationsSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.animations"
      onOpen={() => actions.openTab('community')}
      visual={<StudioAnimationsVisual />}
    />
  );
}

export function PicturesSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.pictures"
      onOpen={() => actions.openTab('community')}
      visual={<StudioPicturesVisual />}
    />
  );
}

export function StageSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.stage"
      onOpen={() => actions.openTab('community')}
      visual={<StudioStageVisual />}
    />
  );
}

export function StudioAiSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.ai"
      onOpen={() => actions.openTab('community')}
      visual={<StudioAiVisual />}
    />
  );
}

export function SceneControlsSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.controls"
      onOpen={() => actions.openTab('community')}
      visual={<SceneControlsVisual />}
    />
  );
}

/** The rest of 2.4, under its last slide, as 2.3's list stood under its own. */
const ALSO: readonly TranslationKey[] = [
  'tour.v24.level',
  'tour.v24.heroes',
  'tour.v24.graphSettings',
  'tour.v24.colourful',
  'tour.v24.gallery',
  'tour.v24.credits',
  'tour.v24.sponsors',
  'tour.v24.crashes',
];

export function CameraSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  return (
    <div className="tour-release24">
      <ShowcaseSlide
        prefix="tour.camera"
        onOpen={() => actions.openTab('eq')}
        visual={<CameraVisual />}
      />
      <section
        className="tour-slide__how dialog-frame__group tour-release24__also"
        aria-labelledby="tour-release24-also"
      >
        <h4 className="tour-slide__how-title" id="tour-release24-also">
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
