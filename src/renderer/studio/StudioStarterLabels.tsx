/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, type MutableRefObject } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { ISceneFrame } from '../graph/sceneGl';
import { useTranslation } from '../utils/I18nContext';
import type { TStageHeard } from './StudioStage';
import '../styles/StudioStarter.scss';

interface IStarterPart {
  key: string;
  name: TranslationKey;
  /** What the part of the starter does with it. */
  does: TranslationKey;
  /** Which edge of the stage, and which row: the top, the orb's, the floor. */
  side: 'left' | 'right';
  row: 'sky' | 'orb' | 'floor';
  value: (frame: ISceneFrame) => number;
}

/**
 * Each part of the starter and what it listens to, in the order the scene's
 * own comments number them. The rows stand at the heights of the parts they
 * name in `studioStarterSource.ts`: the sky at the top, the orb's middle at
 * 0.6 of the panel, the floor under 0.26.
 */
const PARTS: readonly IStarterPart[] = [
  {
    key: 'mids',
    name: 'studio.meter.mid',
    does: 'studioStarter.label.mids',
    side: 'left',
    row: 'sky',
    value: (frame) => frame.bands[1],
  },
  {
    key: 'treble',
    name: 'studio.meter.treble',
    does: 'studioStarter.label.treble',
    side: 'right',
    row: 'sky',
    value: (frame) => frame.bands[2],
  },
  {
    key: 'bass',
    name: 'studio.meter.bass',
    does: 'studioStarter.label.bass',
    side: 'left',
    row: 'orb',
    value: (frame) => frame.bands[0],
  },
  {
    key: 'spectrum',
    name: 'studioStarter.spectrum',
    does: 'studioStarter.label.spectrum',
    side: 'right',
    row: 'orb',
    value: (frame) => frame.level,
  },
  {
    key: 'beat',
    name: 'studio.meter.beat',
    does: 'studioStarter.label.beat',
    side: 'left',
    row: 'floor',
    value: (frame) => frame.rhythm?.kick ?? frame.beat,
  },
  {
    key: 'drop',
    name: 'studio.meter.drop',
    does: 'studioStarter.label.drop',
    side: 'right',
    row: 'floor',
    value: (frame) => frame.rhythm?.drop ?? 0,
  },
];

interface IStudioStarterLabelsProps {
  /** Handed every frame the stage makes, the moment it is made. */
  feed: MutableRefObject<TStageHeard | undefined>;
}

/**
 * Over the starter scene on the stage, while its text is still the
 * starter's: each part named with what it listens to, and a bar moving with
 * that part of the music — the music map, live, on the picture itself
 * rather than in a tab beside it. The bars are written straight from the
 * frame callback, never through React, as the meters are.
 */
export default function StudioStarterLabels({
  feed,
}: IStudioStarterLabelsProps) {
  const { t } = useTranslation();
  const bars = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    feed.current = (frame) => {
      PARTS.forEach((part) => {
        const bar = bars.current.get(part.key);
        if (bar) {
          const value = Math.min(1, Math.max(0, part.value(frame)));
          bar.style.transform = `scaleX(${value})`;
        }
      });
    };
    return () => {
      feed.current = undefined;
    };
  }, [feed]);

  return (
    <div className="studio-starter-labels" aria-hidden="true">
      {PARTS.map((part) => (
        <span
          key={part.key}
          className={`studio-starter-label is-${part.key} is-${part.side} is-${part.row}`}
        >
          <b className="studio-starter-label__name">{t(part.name)}</b>
          <span className="studio-starter-label__does">{t(part.does)}</span>
          <span className="studio-starter-label__track">
            <i
              ref={(element) => {
                if (element) {
                  bars.current.set(part.key, element);
                } else {
                  bars.current.delete(part.key);
                }
              }}
            />
          </span>
        </span>
      ))}
    </div>
  );
}
