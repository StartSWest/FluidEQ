/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useState } from 'react';
import type { IDspVoiceModelState } from './DspDenoiseCard';

/**
 * The Voice model's download, which is a fact about the machine.
 *
 * Local rather than in the DSP store because it is not a setting and does
 * not travel to the engine: it is whether a file exists on this disk, and
 * the Denoise card is the only thing that asks.
 *
 * The bridge calls are each checked for individually: the cards are
 * rendered by tests that have no preload at all AND by ones that supply a
 * partial one, so the object being present says nothing about the method
 * being there. An absent call means the model state is simply unknown,
 * which is what `missing` already says — no separate state, and no throw
 * during a render.
 */
const useVoiceModel = () => {
  const [model, setModel] = useState<IDspVoiceModelState>({
    state: 'missing',
    fraction: 0,
  });
  const readModelState = window.electron?.ipcRenderer?.readDspDenoiseModelState;
  const downloadModel = window.electron?.ipcRenderer?.downloadDspDenoiseModel;
  const cancelModel = window.electron?.ipcRenderer?.cancelDspDenoiseModel;

  useEffect(() => {
    if (typeof readModelState !== 'function') {
      return undefined;
    }
    let cancelled = false;
    readModelState()
      .then((present) => {
        if (!cancelled && present) {
          setModel({ state: 'ready', fraction: 1 });
        }
        return present;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [readModelState]);

  const download = useCallback(() => {
    if (typeof downloadModel !== 'function') {
      return;
    }
    setModel({ state: 'downloading', fraction: 0 });
    downloadModel((received, total) => {
      setModel({
        state: 'downloading',
        fraction: total > 0 ? received / total : 0,
      });
    })
      .then((ok) => {
        // `ok` says whether the file is on disk, not whether the engine has
        // taken it (main's handler): false is a download that failed, bytes
        // that were refused, or a cancel.
        setModel(
          ok
            ? { state: 'ready', fraction: 1 }
            : { state: 'missing', fraction: 0 },
        );
        return ok;
      })
      .catch(() => setModel({ state: 'missing', fraction: 0 }));
  }, [downloadModel]);

  // The download's own answer puts the card back to `missing`.
  const cancel = useCallback(() => {
    if (typeof cancelModel === 'function') {
      cancelModel().catch(() => undefined);
    }
  }, [cancelModel]);

  return { model, download, cancel };
};

export default useVoiceModel;
