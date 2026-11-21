/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useState } from 'react';
import { fromDspChainPresetFile } from '../../../../common/dsp/dspChainPresetFile';
import {
  findPresetShareCode,
  readPresetShareCode,
  type TShareCodeRead,
} from '../../../../common/presetShare/presetShareCode';

/** What a text holds, while it is being read and once it is. */
export type TSharedPresetRead =
  TShareCodeRead | { ok: false; problem: 'reading' };

/**
 * A share code's preset or a preset file's, read from whatever was pasted.
 * A text with no code may be a whole `.fluideq-dsp.json` file, which the
 * DSP page writes and the export's File tab saves.
 */
export const readSharedPreset = async (
  text: string,
): Promise<TShareCodeRead> => {
  if (!findPresetShareCode(text)) {
    const file = fromDspChainPresetFile(text);
    if (file) {
      return { ok: true, preset: file };
    }
  }
  return readPresetShareCode(text);
};

/**
 * The preset inside `text`, read again whenever it changes. Unpacking is a
 * stream and so asynchronous: an answer for a text that has changed since
 * is dropped, so a paste replacing a paste never shows the first one's.
 */
const useSharedPreset = (text: string): TSharedPresetRead | undefined => {
  const [read, setRead] = useState<TSharedPresetRead | undefined>(undefined);
  useEffect(() => {
    if (text.trim() === '') {
      setRead(undefined);
      return undefined;
    }
    let current = true;
    setRead({ ok: false, problem: 'reading' });
    readSharedPreset(text)
      .then((answer) => {
        if (current) {
          setRead(answer);
        }
        return answer;
      })
      .catch(() => {
        if (current) {
          setRead({ ok: false, problem: 'damaged' });
        }
      });
    return () => {
      current = false;
    };
  }, [text]);
  return read;
};

export default useSharedPreset;
