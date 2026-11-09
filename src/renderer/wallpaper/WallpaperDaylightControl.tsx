/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { SCENE_DAYLIGHT_MAX, SCENE_DAYLIGHT_MIN } from 'common/sceneDaylight';
import {
  WALLPAPER_DAYLIGHT_SOURCES,
  type IWallpaperDaylight,
  type TWallpaperDaylightSource,
} from 'common/wallpaper';
import {
  daylightOfShade,
  useClockDaylight,
  usePageDaylight,
} from '../graph/sceneDaylight';
import { useTranslation } from '../utils/I18nContext';
import { snapPercent } from '../utils/percentSnaps';
import { useThemeShade } from '../utils/theme';
import SegmentedControl from '../widgets/SegmentedControl';
// The segmented track every closed set of choices in the app is drawn on.
import '../styles/Dsp.scss';

/** The graph's own words for the three, so the two menus read alike. */
const SOURCE_COPY: Record<
  TWallpaperDaylightSource,
  { name: TranslationKey; hint: TranslationKey }
> = {
  own: {
    name: 'graph.sceneTint.daylightSourceOwn',
    hint: 'graph.sceneTint.daylightOwnHint',
  },
  brightness: {
    name: 'graph.sceneTint.daylightSourceBrightness',
    hint: 'graph.sceneTint.daylightFollowsHint',
  },
  clock: {
    name: 'graph.sceneTint.daylightSourceClock',
    hint: 'graph.sceneTint.daylightClockHint',
  },
};

interface IWallpaperDaylightControlProps {
  value: IWallpaperDaylight;
  /**
   * A new choice: on a press of the three, and on letting go of the Daylight
   * slider — a slider's every step would be a whole background set again.
   */
  onChange: (next: IWallpaperDaylight) => void;
  /** Each step of the slider while it is held, for a picture following it. */
  onLive?: (next: IWallpaperDaylight) => void;
  /** The monitor follows the graph, and takes the graph's time of day. */
  followsGraph: boolean;
  disabled: boolean;
}

/**
 * A desktop monitor's own time of day, the graph's three choices beside a
 * Daylight slider (Ivan, 2026-11-08: "same settings we have on grahp"): set
 * by hand, the window's Brightness, or the computer's clock. Two rows of a
 * settings panel, so the Set dialog's hairlines run between them as between
 * its other settings, and a Manage row holds the same two.
 *
 * The slider moves only while the choice is Off, and otherwise shows the time
 * of day it is being given, as the graph's does: dragging Brightness moves
 * this thumb, and choosing Off leaves the scene exactly there. A monitor
 * following the graph takes the graph's time of day, so both stand dimmed
 * and say so.
 */
export default function WallpaperDaylightControl({
  value,
  onChange,
  onLive,
  followsGraph,
  disabled,
}: IWallpaperDaylightControlProps) {
  const { t } = useTranslation();
  const sliderId = useId();
  const brightness = Math.round(daylightOfShade(useThemeShade()));
  const clock = useClockDaylight();
  const graph = Math.round(usePageDaylight());
  // The value under the pointer, kept on a ref as well: a release can come
  // in the same task as the last step, before React has rendered it.
  const [held, setHeld] = useState<number>();
  const heldRef = useRef<number | undefined>(undefined);
  const given: Record<TWallpaperDaylightSource, number> = {
    own: held ?? value.daylight,
    brightness,
    clock,
  };
  const isOwn = value.source === 'own' && !followsGraph;
  const shown = followsGraph ? graph : given[value.source];
  const commit = () => {
    const last = heldRef.current;
    heldRef.current = undefined;
    setHeld(undefined);
    if (last !== undefined && last !== value.daylight) {
      onChange({ source: 'own', daylight: last });
    }
  };
  return (
    <>
      <div className="wallpaper-dialog__setting wallpaper-daylight">
        <span className="wallpaper-dialog__setting-copy">
          <span className="wallpaper-daylight__name">
            {t('wallpaper.daylight')}
          </span>
          <span>
            {t(
              followsGraph
                ? 'wallpaper.daylight.following'
                : 'wallpaper.daylight.hint',
            )}
          </span>
        </span>
        {/* "Follows", as the graph says it beside the same three: several
            languages name them as what is followed (Russian "Яркости",
            German "Nichts"), which reads only after that word. */}
        <span className="wallpaper-daylight__choice">
          <span className="wallpaper-daylight__follows" aria-hidden="true">
            {t('graph.sceneTint.daylightSource')}
          </span>
          <SegmentedControl
            name={t('wallpaper.daylight')}
            value={value.source}
            isDisabled={disabled || followsGraph}
            options={WALLPAPER_DAYLIGHT_SOURCES.map((source) => ({
              value: source,
              label: t(SOURCE_COPY[source].name),
              title: t(SOURCE_COPY[source].hint),
            }))}
            onChange={(next) => {
              const source = WALLPAPER_DAYLIGHT_SOURCES.find(
                (entry) => entry === next,
              );
              if (source) {
                // Off keeps the scene where it stands now, whatever gave it.
                onChange({
                  source,
                  daylight: source === 'own' ? shown : value.daylight,
                });
              }
            }}
          />
        </span>
      </div>
      <div
        className={`wallpaper-dialog__setting wallpaper-wave${
          isOwn ? '' : ' is-disabled'
        }`}
      >
        <label htmlFor={sliderId} title={t('graph.sceneTint.daylightHint')}>
          {t('graph.sceneTint.daylight')}
        </label>
        <input
          id={sliderId}
          type="range"
          min={SCENE_DAYLIGHT_MIN}
          max={SCENE_DAYLIGHT_MAX}
          step={1}
          value={shown}
          disabled={disabled || !isOwn}
          onChange={(event) => {
            const next = snapPercent(Number(event.target.value));
            heldRef.current = next;
            setHeld(next);
            onLive?.({ source: 'own', daylight: next });
          }}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />
        <span className="wallpaper-wave__value">
          {t('graph.scene.percent', { percent: String(shown) })}
        </span>
      </div>
    </>
  );
}
