/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import {
  MAX_GAIN,
  MIN_GAIN,
  MIN_NUM_FILTERS,
  NO_GAIN_FILTER_TYPES,
} from '../../../common/constants';
import { selectionModeFromEvent } from '../../../common/bandSelection';
import BandLevels from '../../components/BandLevels';
import FrequencyBand, {
  type IBandSelectEvent,
  type TBandDensity,
} from '../../components/FrequencyBand';
import OverflowArrow from '../../components/OverflowArrow';
import qualityWheelEdits from '../../graph/qualityWheel';
import { ColorEnum } from '../../styles/color';
import type { IBandColor } from '../../utils/bandColors';
import { useTranslation } from '../../utils/I18nContext';
import { useOverflowScroll } from '../../utils/useOverflowScroll';
import { attachRail } from '../bandsRail';
import useBandRowPlacement from '../useBandRowPlacement';
import {
  EQ_SCALE_MARKS,
  eqScaleLabel,
  eqScaleMarkClass,
} from '../eqScaleMarks';
import { draftFiltersOf } from './presetEditBands';
import {
  editDraftBands,
  hoverDraftBand,
  nextDraftSelection,
  readPresetEditSession,
  selectDraftBands,
  usePresetEditSession,
} from './presetEditSession';
import PresetBandMenu from './PresetBandMenu';

/** Every slider in the preset's violet, the graph's handles' ink. */
const PRESET_BAND_INK: IBandColor = {
  color: ColorEnum.PRESET_EDIT,
  muted: `color-mix(in srgb, ${ColorEnum.PRESET_EDIT} 62%, transparent)`,
  track: `color-mix(in srgb, ${ColorEnum.PRESET_EDIT} 26%, transparent)`,
};

/** As many bands as the EQ page's own rail draws at each width. */
const densityOf = (count: number): TBandDensity => {
  if (count <= 6) {
    return 'full';
  }
  return count <= 15 ? 'compact' : 'dense';
};

/**
 * The preset's bands as sliders, under the graph where Your EQ's stand,
 * while one of the listener's presets is open: the same band, slider, scale
 * and level light as Your EQ's rail, every one in the preset's violet (Add
 * band is in the strip above). Your EQ's bands are not here and nothing
 * here touches them.
 */
const PresetCurveRail = () => {
  const { t } = useTranslation();
  const session = usePresetEditSession();
  const bands = session?.bands;
  const filters = useMemo(() => draftFiltersOf(bands ?? []), [bands]);
  const sorted = useMemo(
    () => Object.values(filters).sort((a, b) => a.frequency - b.frequency),
    [filters],
  );
  const density = densityOf(sorted.length);
  const canScroll = useOverflowScroll(sorted.length);
  const [row, setRow] = useState<HTMLDivElement | null>(null);
  // Placed across the rail as Your EQ's bands are, or a row that scrolls.
  const isPlaced = useBandRowPlacement(row, sorted.length);

  // A slider moved: its band, or every selected band by the same step when
  // it is one of them, as Your EQ's sliders move a selection.
  const setGain = useCallback(async (id: string, gain: number) => {
    const current = readPresetEditSession();
    const moved = current?.bands.find((one) => one.id === id);
    if (!current || !moved) {
      return;
    }
    const step = gain - moved.band.gainDb;
    const ids =
      current.selectedIds.length > 1 && current.selectedIds.includes(id)
        ? current.selectedIds
        : [id];
    editDraftBands(
      current.bands
        .filter(
          (one) =>
            ids.includes(one.id) &&
            !NO_GAIN_FILTER_TYPES.includes(
              one.band.type as (typeof NO_GAIN_FILTER_TYPES)[number],
            ),
        )
        .map((one) => ({
          id: one.id,
          patch: {
            gainDb: one.id === id ? gain : one.band.gainDb + step,
          },
        })),
    );
  }, []);
  const previewGain = useCallback(
    (id: string, gain: number) => {
      setGain(id, gain).catch(() => undefined);
    },
    [setGain],
  );
  const resetGain = useCallback(
    (id: string) => editDraftBands([{ id, patch: { gainDb: 0 } }]),
    [],
  );
  const select = useCallback(
    (id: string, event: IBandSelectEvent) =>
      selectDraftBands(nextDraftSelection(id, selectionModeFromEvent(event))),
    [],
  );
  const wheelQuality = useCallback((id: string, direction: 1 | -1) => {
    const current = readPresetEditSession();
    editDraftBands(
      qualityWheelEdits(
        draftFiltersOf(current?.bands ?? []),
        current?.selectedIds ?? [],
        id,
        direction,
      ).map((edit) => ({ id: edit.id, patch: { quality: edit.quality } })),
    );
  }, []);
  const hover = useCallback(
    (id: string, isHovered: boolean) => hoverDraftBand(isHovered ? id : ''),
    [],
  );

  if (!session) {
    return null;
  }
  return (
    <div
      className={`main-content main-content--${density}${
        isPlaced ? ' is-placed' : ''
      } own-preset-rail`}
      role="group"
      aria-label={t('eq.own.curveBands', { name: session.name })}
    >
      <PresetBandMenu filters={filters} />
      <BandLevels row={row} />
      <div className="bands-rail" ref={attachRail}>
        {!isPlaced && canScroll.canScrollBack && (
          <OverflowArrow
            direction="back"
            onPress={() => canScroll.scrollBy(-1)}
          />
        )}
        <div
          className="bands-rail__viewport"
          ref={canScroll.ref}
          onScroll={canScroll.onScroll}
        >
          <div
            ref={setRow}
            className={`bands bands--${density}${isPlaced ? ' is-placed' : ''}`}
            style={{ '--band-count': sorted.length } as CSSProperties}
          >
            {sorted.map((filter) => (
              <FrequencyBand
                key={filter.id}
                filter={filter}
                density={density}
                flatLayout
                isSelected={session.selectedIds.includes(filter.id)}
                isHovered={session.hoveredId === filter.id}
                isMinSliderCount={sorted.length <= MIN_NUM_FILTERS}
                onSelect={select}
                onQualityWheel={wheelQuality}
                onHover={hover}
                onGainChange={setGain}
                onGainPreview={previewGain}
                onGainReset={resetGain}
                ink={PRESET_BAND_INK}
              />
            ))}
          </div>
        </div>
        {!isPlaced && canScroll.canScrollForward && (
          <OverflowArrow
            direction="forward"
            onPress={() => canScroll.scrollBy(1)}
          />
        )}
      </div>
      <div className="eq-scale" aria-hidden="true">
        {EQ_SCALE_MARKS.map((gain) => (
          <span
            key={gain}
            className={`eq-scale__mark${eqScaleMarkClass(gain)}`}
            style={
              {
                '--at': (MAX_GAIN - gain) / (MAX_GAIN - MIN_GAIN),
              } as CSSProperties
            }
          >
            {eqScaleLabel(gain)}
          </span>
        ))}
      </div>
    </div>
  );
};

export default PresetCurveRail;
