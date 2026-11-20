/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { IFilter, IFiltersMap } from '../../../common/constants';
import BandMenu, { BAND_MENU_EVENT } from '../../components/BandMenu';
import {
  addDraftBandBeside,
  editDraftBands,
  readPresetEditSession,
  removeDraftBands,
  selectDraftBands,
} from './presetEditSession';

interface IMenuAt {
  filterId: string;
  x: number;
  y: number;
}

/**
 * The band menu for the preset's bands — right-clicked on a handle on the
 * graph or on a slider in the rail — with the menu Your EQ's bands have:
 * back to 0 dB, out of the curve and back, a band beside it, delete. Its
 * ears are left out: a preset's curve plays on both. The ask travels as the
 * same window event Your EQ's does (`requestBandMenu`), and the ids never
 * meet: each answers only its own.
 */
const PresetBandMenu = ({ filters }: { filters: IFiltersMap }) => {
  const [menu, setMenu] = useState<IMenuAt | undefined>(undefined);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const { detail } = event as CustomEvent<IMenuAt | undefined>;
      const session = readPresetEditSession();
      if (
        !detail ||
        !session?.bands.some((one) => one.id === detail.filterId)
      ) {
        return;
      }
      if (!session.selectedIds.includes(detail.filterId)) {
        selectDraftBands([detail.filterId]);
      }
      setMenu(detail);
    };
    window.addEventListener(BAND_MENU_EVENT, onOpen);
    return () => window.removeEventListener(BAND_MENU_EVENT, onOpen);
  }, []);

  const filter = menu ? filters[menu.filterId] : undefined;
  if (!menu || !filter) {
    return null;
  }
  const selected = readPresetEditSession()?.selectedIds ?? [];
  const targets: IFilter[] = selected.includes(filter.id)
    ? selected.flatMap((id) => (filters[id] ? [filters[id]] : []))
    : [filter];
  const count = Object.keys(filters).length;
  return (
    <BandMenu
      key={`${menu.filterId}:${menu.x}:${menu.y}`}
      filter={filter}
      filters={targets}
      x={menu.x}
      y={menu.y}
      onReset={(bands) =>
        editDraftBands(
          bands.map((one) => ({ id: one.id, patch: { gainDb: 0 } })),
        )
      }
      onSetEnabled={(bands, isEnabled) =>
        editDraftBands(
          bands.map((one) => ({ id: one.id, patch: { enabled: isEnabled } })),
        )
      }
      onAddBeside={(band, side) => addDraftBandBeside(band.id, side)}
      onDelete={
        count > targets.length
          ? (bands) => removeDraftBands(bands.map((one) => one.id))
          : undefined
      }
      onClose={() => setMenu(undefined)}
    />
  );
};

export default PresetBandMenu;
