/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import sceneNeonCity from '../../../../assets/tour/scene-neon-city.jpg';
import lookHorizon from '../../../../assets/tour/look-horizon.jpg';
import lookTowers from '../../../../assets/tour/look-towers.jpg';
import lookLedWall from '../../../../assets/tour/look-ledwall.jpg';
import lookSynthwave from '../../../../assets/tour/look-synthwave.jpg';

/**
 * The visualizer engine's slide: a Plus scene that is a 3D world, and four of
 * 2.0's new looks as the graph draws them on the graphics card.
 *
 * The looks are photographs of the real graph, each with its name in the
 * picker on the graph's own bar — which is where a look is chosen — taken at
 * Brightness 50% from the whole-app harness (`scratchpad/tour-shots`,
 * `shoot-looks.mjs`); retake them when the graph changes. The picker of the
 * first is ringed: that is the place the slide sends the reader to.
 */

const LOOKS: { id: string; src: string; name: TranslationKey }[] = [
  { id: 'synthwave', src: lookSynthwave, name: 'graph.styleName.synthwave' },
  { id: 'horizon', src: lookHorizon, name: 'graph.styleName.horizon' },
  { id: 'towers', src: lookTowers, name: 'graph.styleName.towers' },
  { id: 'ledwall', src: lookLedWall, name: 'graph.styleName.ledwall' },
];

/**
 * The four looks' names as the picker gives them, for the words that name
 * them: `{synthwave}`, `{horizon}`, `{towers}`, `{ledwall}`.
 */
export const lookNames = (t: (key: TranslationKey) => string) =>
  Object.fromEntries(LOOKS.map((look) => [look.id, t(look.name)]));

export default function VisualizerEngineVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="gpu-visual"
      role="img"
      aria-label={t('tour.gpu.imageAlt', lookNames(t))}
    >
      <span className="gpu-visual__world">
        <img src={sceneNeonCity} alt="" width={960} height={540} />
        <span className="gpu-visual__chips">
          <span className="gpu-visual__chip">{t('tour.scene.neonCity')}</span>
          <span className="gpu-visual__chip is-plus">
            {t('graph.scene.badge')}
          </span>
          <span className="gpu-visual__chip is-world">
            {t('tour.gpu.world')}
          </span>
        </span>
      </span>
      <ul className="gpu-visual__looks">
        {LOOKS.map((look, index) => (
          <li key={look.id} className="gpu-visual__look">
            <span className="gpu-visual__shot">
              <img src={look.src} alt="" width={640} height={320} />
              {index === 0 && <span className="gpu-visual__ring" />}
            </span>
            <span className="gpu-visual__name">{t(look.name)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
