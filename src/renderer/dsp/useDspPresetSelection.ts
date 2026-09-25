/* FluidEQ — GPL-3.0-or-later */

import { useRef, useState } from 'react';
import type { IDspSettings } from '../../common/dsp/chain';
import type { ErrorDescription } from '../../common/errors';
import { useFluidEqLayers } from '../utils/FluidEqContext';
import { setVoicing as setVoicingApi } from '../utils/equalizerApi';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
import { resolveDspPreset, resolveDspPresetCurve } from './dspPresetCatalog';
import { holdRackForApo, releaseRackHold } from './rackHeldForApo';
import { dspPresetVoicing } from '../../common/dsp/presetVoicing';

/**
 * Put a preset on: its tone into the main EQ, its rack into the rack.
 *
 * The tone is the Preset layer, played by either engine after everything
 * else and drawn on the EQ page (`presetCurve.ts`), so a preset sounds the
 * same through both. A preset with no tone of its own, and None, take the
 * layer away rather than leaving the last preset's curve under a new rack;
 * so does any other voicing, the one tonal layer this replaces.
 *
 * `quick` is a pick made for the whole machine — the equaliser page's picker
 * and a game's sound. Under Equalizer APO, which has no rack, that leaves the
 * rack off and says so (`rackHeldForApo.ts`), and a switch to the FluidEQ
 * Engine puts it on (`RackFollowsEngine`). The DSP page's own picker sets the
 * rack either way: under APO that page is the Library player's rack.
 */
export const useDspPresetSelection = (
  current: IDspSettings,
  onChange: (next: IDspSettings) => void,
  onCommit: () => void,
  quick = false,
) => {
  const { voicing, setVoicing, setGlobalError } = useFluidEqLayers();
  // Read at the press, from the answer the window keeps current. Asking main
  // on mount instead ran the engine helper again every time a picker holding
  // this mounted — the equaliser's toolbar, the DSP page's bar, a game's row —
  // and a mount's answer is no fresher at the press than the window's.
  const status = useKnownAudioEngineStatus();
  const [selecting, setSelecting] = useState(false);
  const selection = useRef(0);
  const apply = async (id: string) => {
    const next = resolveDspPreset(id, current);
    if (!next) {
      return;
    }
    selection.current += 1;
    const revision = selection.current;
    try {
      const curve = resolveDspPresetCurve(id);
      if (curve) {
        setSelecting(true);
        const layer = dspPresetVoicing(id, curve);
        await setVoicingApi(layer.profileId, 1, curve);
        if (revision !== selection.current) {
          return;
        }
        setVoicing(layer);
      } else if (voicing?.profileId || voicing?.apoOverride) {
        setSelecting(true);
        await setVoicingApi('', 1);
        if (revision !== selection.current) {
          return;
        }
        setVoicing({ profileId: '', intensity: 1 });
      }
      if (quick && status?.engine === 'apo' && id !== 'none') {
        holdRackForApo(next.presetId);
        onChange({ ...next, enabled: false, gameMode: false });
      } else {
        releaseRackHold();
        onChange(next);
      }
      onCommit();
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
