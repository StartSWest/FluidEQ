/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo, useRef } from 'react';
import {
  MAX_FREQUENCY,
  MAX_GAIN,
  MIN_FREQUENCY,
  MIN_GAIN,
  NO_GAIN_FILTER_TYPES,
  isBandEnabled,
  type IFilter,
} from '../../../common/constants';
import type { SelectionMode } from '../../../common/bandSelection';
import {
  VOICING_CURVE_ID,
  type IChartCurveData,
  type IChartPointData,
  type IEditableChartPoint,
} from '../../graph/ChartController';
import bellGainAt from '../../graph/bellDrag';
import qualityWheelEdits from '../../graph/qualityWheel';
import { getLineGainAtFrequency } from '../../graph/utils';
import { ColorEnum } from '../../styles/color';
import { useTranslation } from '../../utils/I18nContext';
import FILTER_TYPE_NAME_KEYS from '../../utils/filterTypeNames';
import { draftFiltersOf } from './presetEditBands';
import {
  editDraftBands,
  hoverDraftBand,
  nextDraftSelection,
  readPresetEditSession,
  selectDraftBands,
  usePresetEditSession,
} from './presetEditSession';

/** A handle switched off: the violet, held back. */
const PRESET_EDIT_INK_MUTED = `color-mix(in srgb, ${ColorEnum.PRESET_EDIT} 45%, transparent)`;

const roundGain = (gain: number) =>
  Math.round(Math.max(MIN_GAIN, Math.min(MAX_GAIN, gain)) * 100) / 100;

const hasGain = (filter: IFilter) =>
  !NO_GAIN_FILTER_TYPES.includes(filter.type);

interface IDrag {
  sourceId: string;
  ids: string[];
  grab: IChartPointData;
  origins: Record<string, { frequency: number; gain: number }>;
  moved: boolean;
  toggleOnRelease: boolean;
}

/**
 * The graph's handles while one of the listener's presets is open: one per
 * band of the preset's curve, standing on that curve, in its violet, and
 * moved the way Your EQ's handles move — a drag measured from the press
 * (`pointDragState` in the graph says why), Ctrl for a bell round the
 * grabbed band, Ctrl+scroll for Q, the arrows for gain. Undefined while no
 * preset is open, and the graph's own handles stand.
 */
const usePresetEditPoints = (
  chartData: readonly IChartCurveData[],
): IEditableChartPoint[] | undefined => {
  const { t } = useTranslation();
  const session = usePresetEditSession();
  const drag = useRef<IDrag | undefined>(undefined);
  const bands = session?.bands;
  const selectedIds = session?.selectedIds;
  const hoveredId = session?.hoveredId;

  return useMemo(() => {
    if (!bands || !selectedIds) {
      return undefined;
    }
    const filters = draftFiltersOf(bands);
    const curve = chartData.find((one) => one.id === VOICING_CURVE_ID)?.line
      .points;

    const move = (id: string, point: IChartPointData, isBell: boolean) => {
      const held = drag.current;
      const current = readPresetEditSession();
      if (!held || held.sourceId !== id || !current) {
        return;
      }
      const now = draftFiltersOf(current.bands);
      const frequencyDelta =
        Math.max(MIN_FREQUENCY, Math.min(MAX_FREQUENCY, Math.round(point.x))) -
        held.grab.x;
      const gainDelta = roundGain(point.y) - held.grab.y;
      if (point.x !== held.grab.x || point.y !== held.grab.y) {
        held.moved = true;
      }
      const tip = held.origins[held.sourceId];
      const tipFilter = now[held.sourceId];
      const bell =
        isBell && held.ids.length > 1 && tip && tipFilter
          ? { centre: tip.frequency, quality: tipFilter.quality }
          : undefined;
      editDraftBands(
        held.ids.flatMap((one) => {
          const origin = held.origins[one];
          const filter = now[one];
          if (!origin || !filter) {
            return [];
          }
          const frequency = bell
            ? origin.frequency
            : Math.round(
                Math.max(
                  MIN_FREQUENCY,
                  Math.min(MAX_FREQUENCY, origin.frequency + frequencyDelta),
                ),
              );
          const step = bell
            ? bellGainAt(origin.frequency, bell.centre, bell.quality, gainDelta)
            : gainDelta;
          return [
            {
              id: one,
              patch: {
                frequency,
                ...(hasGain(filter)
                  ? { gainDb: roundGain(origin.gain + step) }
                  : {}),
              },
            },
          ];
        }),
      );
    };

    const press = (id: string, mode: SelectionMode, grab: IChartPointData) => {
      const current = readPresetEditSession();
      if (!current) {
        return;
      }
      const toggleOnRelease =
        mode === 'toggle' &&
        current.selectedIds.length > 1 &&
        current.selectedIds.includes(id);
      const ids = toggleOnRelease
        ? [...current.selectedIds]
        : nextDraftSelection(id, mode);
      const now = draftFiltersOf(current.bands);
      drag.current = {
        sourceId: id,
        ids,
        grab,
        origins: Object.fromEntries(
          ids.flatMap((one) =>
            now[one]
              ? [[one, { frequency: now[one].frequency, gain: now[one].gain }]]
              : [],
          ),
        ),
        moved: false,
        toggleOnRelease,
      };
      selectDraftBands(ids);
    };

    const release = (id: string) => {
      const held = drag.current;
      if (held?.sourceId !== id) {
        return;
      }
      drag.current = undefined;
      // A Ctrl-click that never became a drag: the toggle it held back.
      if (held.toggleOnRelease && !held.moved) {
        selectDraftBands(nextDraftSelection(id, 'toggle'));
      }
    };

    const stepGain = (id: string, direction: number) => {
      const current = readPresetEditSession();
      if (!current) {
        return;
      }
      const now = draftFiltersOf(current.bands);
      const ids = current.selectedIds.includes(id) ? current.selectedIds : [id];
      editDraftBands(
        ids.flatMap((one) =>
          now[one] && hasGain(now[one])
            ? [
                {
                  id: one,
                  patch: { gainDb: roundGain(now[one].gain + direction) },
                },
              ]
            : [],
        ),
      );
    };

    const wheel = (id: string, direction: number) => {
      const current = readPresetEditSession();
      if (!current) {
        return;
      }
      editDraftBands(
        qualityWheelEdits(
          draftFiltersOf(current.bands),
          current.selectedIds,
          id,
          direction,
        ).map((edit) => ({ id: edit.id, patch: { quality: edit.quality } })),
      );
    };

    return Object.values(filters).map((filter) => ({
      id: filter.id,
      name: t(FILTER_TYPE_NAME_KEYS[filter.type]),
      parameters: {
        frequency: filter.frequency,
        gain: filter.gain,
        quality: filter.quality,
      },
      color: ColorEnum.PRESET_EDIT,
      mutedColor: PRESET_EDIT_INK_MUTED,
      // On the preset's own line, where its handle belongs; where it has no
      // line yet (every band off), where the band itself sits.
      data: {
        x: filter.frequency,
        y: curve
          ? getLineGainAtFrequency(curve, filter.frequency)
          : filter.gain,
      },
      selected: selectedIds.includes(filter.id),
      hovered: hoveredId === filter.id,
      isEnabled: isBandEnabled(filter),
      isLocked: false,
      onSelect: (mode: SelectionMode, grab: IChartPointData) =>
        press(filter.id, mode, grab),
      onHover: (isHovered: boolean) =>
        hoverDraftBand(isHovered ? filter.id : ''),
      onChange: (point: IChartPointData, isBell: boolean) =>
        move(filter.id, point, isBell),
      onCommit: () => release(filter.id),
      onQualityWheel: (direction: number) => wheel(filter.id, direction),
      onGainStep: (direction: number) => stepGain(filter.id, direction),
    }));
  }, [bands, chartData, hoveredId, selectedIds, t]);
};

export default usePresetEditPoints;
