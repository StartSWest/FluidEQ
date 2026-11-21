/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useState } from 'react';
import {
  fromDspChainPresetFile,
  type IPortableDspChain,
} from '../../../../common/dsp/dspChainPresetFile';
import {
  findPresetShareCode,
  readPresetShareCode,
  type TShareCodeProblem,
} from '../../../../common/presetShare/presetShareCode';
import { findSharedPresetId } from '../../../../common/presetShare/sharedPresetLink';

/**
 * Why a text gave no preset: the code's own reasons, and a short link's —
 * `gone` (no longer shared, or never was) and `offline` (FluidEQ's server did
 * not answer).
 */
export type TSharedPresetProblem = TShareCodeProblem | 'gone' | 'offline';

/** Who shared a preset that came by a short link, as the server says it. */
export interface ISharedPresetSource {
  id: string;
  author: string | null;
}

export type TSharedPresetAnswer =
  | { ok: true; preset: IPortableDspChain; source?: ISharedPresetSource }
  | { ok: false; problem: TSharedPresetProblem };

/** What a text holds, while it is being read and once it is. */
export type TSharedPresetRead =
  TSharedPresetAnswer | { ok: false; problem: 'reading' };

/**
 * The preset a short link names: fetched by main from FluidEQ's server
 * (`main/ipc/sharedPresetLinks.ts`), never taken from the page that sent it,
 * then read by the same strict decoder as a pasted code. The server's name
 * for it is not used: the name is the code's own, read and cleaned there.
 */
const readShortLink = async (id: string): Promise<TSharedPresetAnswer> => {
  const bridge = window.electron?.ipcRenderer;
  if (!bridge?.fetchSharedPreset) {
    return { ok: false, problem: 'offline' };
  }
  const fetched = await bridge.fetchSharedPreset(id);
  if (!fetched.ok) {
    return {
      ok: false,
      problem: fetched.problem === 'missing' ? 'gone' : 'offline',
    };
  }
  const read = await readPresetShareCode(fetched.preset.code);
  return read.ok
    ? { ...read, source: { id, author: fetched.preset.author } }
    : read;
};

/**
 * A share code's preset, a short link's or a preset file's, read from
 * whatever was pasted. A code in the text wins over a link beside it: it is
 * the whole preset and needs no network. A text with neither may be a whole
 * `.fluideq-dsp.json` file, which the DSP page writes and the export's File
 * tab saves. Links are followed only where `followLinks` says so: the
 * Import box and a link's question, never a forum post being drawn.
 */
export const readSharedPreset = async (
  text: string,
  followLinks: boolean,
): Promise<TSharedPresetAnswer> => {
  if (!findPresetShareCode(text)) {
    const id = followLinks ? findSharedPresetId(text) : undefined;
    if (id) {
      return readShortLink(id);
    }
    const file = fromDspChainPresetFile(text);
    if (file) {
      return { ok: true, preset: file };
    }
  }
  return readPresetShareCode(text);
};

/**
 * The preset inside `text`, read again whenever it changes. Unpacking is a
 * stream and a link is a request, so both are asynchronous: an answer for a
 * text that has changed since is dropped, so a paste replacing a paste never
 * shows the first one's.
 */
const useSharedPreset = (
  text: string,
  followLinks = false,
): TSharedPresetRead | undefined => {
  const [read, setRead] = useState<TSharedPresetRead | undefined>(undefined);
  useEffect(() => {
    if (text.trim() === '') {
      setRead(undefined);
      return undefined;
    }
    let current = true;
    setRead({ ok: false, problem: 'reading' });
    readSharedPreset(text, followLinks)
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
  }, [text, followLinks]);
  return read;
};

export default useSharedPreset;
