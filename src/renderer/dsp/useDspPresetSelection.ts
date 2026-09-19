/* FluidEQ — GPL-3.0-or-later */

import { useRef, useState } from 'react';
import type { IDspSettings } from '../../common/dsp/chain';
import type { ErrorDescription } from '../../common/errors';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { setVoicing as setVoicingApi } from '../utils/equalizerApi';
import { resolveDspPreset } from './dspPresetCatalog';
import { useAudioEngineStatus } from '../utils/useAudioEngineStatus';
import { dspPresetVoicing } from '../../common/dsp/presetVoicing';

/** Retire the old tonal layer before loading its replacement DSP sound. */
export const useDspPresetSelection = (
  current: IDspSettings,
  onChange: (next: IDspSettings) => void,
  onCommit: () => void,
  quick = false,
) => {
  const { voicing, setVoicing, setGlobalError } = useFluidEqContext();
  const { status } = useAudioEngineStatus();
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
      if (quick && status?.engine === 'apo' && id !== 'none') {
        setSelecting(true);
        const layer = dspPresetVoicing(id, next.eq);
        await setVoicingApi(layer.profileId, 1, next.eq);
        if (revision !== selection.current) {
          return;
        }
        setVoicing(layer);
        onChange({ ...next, enabled: false, gameMode: false });
        onCommit();
        return;
      }
      if (voicing?.profileId || voicing?.apoOverride) {
        setSelecting(true);
        await setVoicingApi('', 1);
        if (revision !== selection.current) {
          return;
        }
        setVoicing({ profileId: '', intensity: 1 });
      }
      onChange(next);
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
