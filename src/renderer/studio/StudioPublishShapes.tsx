/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState, type RefObject } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { TSceneView } from '../graph/sceneView';
import { useTranslation } from '../utils/I18nContext';
import StudioStagePlayer from './StudioStagePlayer';
import StudioUltraWideFrame from './StudioUltraWideFrame';
import { PLAYER_PANEL_VIEW, ULTRA_WIDE_PANEL_VIEW } from './studioStageScreen';

/**
 * The views the publish dialog plays the scene in (Ivan, 2026-11-12: "show
 * the 3 normal, ultra wide and amp ui models in the publish screen ... we
 * need them to test it first before publishing on all modes"). Normal is the
 * picture the covers and the preview video are taken from, 16:9; Ultra wide
 * is the whole ultra-wide window with the graph framed where it stands; Amp
 * is the Compact player's whole column with the player over it.
 */
export type TPublishShape = 'normal' | 'ultra' | 'amp';

const SHAPES: readonly { shape: TPublishShape; key: TranslationKey }[] = [
  { shape: 'normal', key: 'studio.publish.shapeNormal' },
  { shape: 'ultra', key: 'studio.publish.shapeUltra' },
  { shape: 'amp', key: 'studio.publish.shapeAmp' },
];

/**
 * Whether a take of the preview clip is under way. It holds the canvas at
 * the clip's size, the Normal view's, until it ends; paused included, or a
 * stage given back mid-take would leave the take nothing to carry on with.
 */
export const isTakeRunning = (phase: string): boolean =>
  phase === 'waiting' || isTakeHolding(phase);

/** A take past waiting: it has the canvas and is recording from it. */
export function isTakeHolding(phase: string): boolean {
  return phase === 'preparing' || phase === 'recording' || phase === 'paused';
}

/** Where the scene's panel stands on the canvas in each view. */
export const viewOfShape = (shape: TPublishShape): TSceneView | undefined => {
  if (shape === 'ultra') {
    return ULTRA_WIDE_PANEL_VIEW;
  }
  return shape === 'amp' ? PLAYER_PANEL_VIEW : undefined;
};

/** The switch, above the scene so nothing on the scene covers it. */
export function StudioPublishShapeSwitch({
  shape,
  onShape,
}: {
  shape: TPublishShape;
  onShape: (shape: TPublishShape) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="studio-publish__shapes">
      <div
        className="studio-segments"
        role="group"
        aria-label={t('studio.publish.shapeChoice')}
      >
        {SHAPES.map((entry) => (
          <button
            key={entry.shape}
            type="button"
            className="studio-segment"
            aria-pressed={shape === entry.shape}
            onClick={() => onShape(entry.shape)}
          >
            {t(entry.key)}
          </button>
        ))}
      </div>
      <span className="studio-publish__shapes-hint">
        {t('studio.publish.shapeHint')}
      </span>
    </div>
  );
}

/** The element's laid-out size: a dialog that opens scaled reports its own. */
const useBoxSize = (ref: RefObject<HTMLElement | null>) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return undefined;
    }
    const observer = new ResizeObserver(() =>
      setSize({ width: node.offsetWidth, height: node.offsetHeight }),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return size;
};

/** What stands over the scene in a view: the band's frame, or the player. */
export function StudioPublishShapeOver({
  shape,
  frameRef,
}: {
  shape: TPublishShape;
  frameRef: RefObject<HTMLElement | null>;
}) {
  const { width, height } = useBoxSize(frameRef);
  if (shape === 'ultra') {
    return <StudioUltraWideFrame />;
  }
  if (shape === 'amp' && height > 0) {
    return <StudioStagePlayer width={width} height={height} />;
  }
  return null;
}
