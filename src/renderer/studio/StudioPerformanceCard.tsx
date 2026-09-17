/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import ScenePerformanceMenu from '../graph/ScenePerformanceMenu';
import { useTranslation } from '../utils/I18nContext';
import StudioFoldCard from './StudioFoldCard';

/**
 * How every visualizer is drawn — the frame rate, the size and its floor,
 * the scaler, the edge smoothing, the graphics card — on a card of its own
 * in the Studio.
 *
 * The very same rows as the graph's View menu, reading and writing the same
 * choice (`common/scenePerformance.ts`): a member tuning a scene on the
 * stage should not have to go to the graph to change how the stage draws
 * it, and a choice made here is the graph's and the desktop's too. Their
 * list surface is the menu's own, so the rows look and cycle exactly as
 * they do there; only its floating position is taken away, since here the
 * list stands in the card.
 */
export default function StudioPerformanceCard() {
  const { t } = useTranslation();
  return (
    <StudioFoldCard
      fold="performance"
      title={t('studio.performance.title')}
      className="studio-performance"
    >
      <span className="studio-test__hint">{t('studio.performance.hint')}</span>
      <div
        className="graph-view-menu__list studio-performance__rows"
        role="menu"
        aria-label={t('studio.performance.title')}
      >
        <ScenePerformanceMenu />
      </div>
    </StudioFoldCard>
  );
}
