/* FluidEQ — GPL-3.0-or-later */

import { useRef, useState } from 'react';
import type { ErrorDescription } from '../../common/errors';
import { useFluidEqLayers, useFluidEqShell } from '../utils/FluidEqContext';
import { pickDspPreset } from '../utils/equalizerApi';
import { readOutputEditor } from '../utils/outputEditor';

/**
 * Put a preset on: its tone into the main EQ, its rack into the rack.
 *
 * The core decides and writes it (`common/dsp/presetPick.ts`,
 * `main/presetPicks.ts`) — the same rules it follows for a game's sound and
 * at a switch of engine, so the hold Equalizer APO puts on a quick pick's
 * rack is kept in one place. The window then reads back what plays.
 *
 * `quick` is a pick made for the whole machine — the equaliser page's picker
 * and a game's sound. Under Equalizer APO, which has no rack, that leaves the
 * rack off until the FluidEQ Engine is chosen. The DSP page's own picker sets
 * the rack either way: under APO that page is the Library player's rack.
 */
export const useDspPresetSelection = (quick = false) => {
  const { setGlobalError } = useFluidEqLayers();
  const { refreshState } = useFluidEqShell();
  const [selecting, setSelecting] = useState(false);
  const selection = useRef(0);
  const apply = async (id: string) => {
    selection.current += 1;
    const revision = selection.current;
    setSelecting(true);
    try {
      await pickDspPreset(
        id,
        quick,
        readOutputEditor().editor?.device.id ?? '',
      );
      await refreshState({ adoptRack: true });
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      if (revision === selection.current) {
        setSelecting(false);
      }
    }
  };
  return { apply, selecting };
};
