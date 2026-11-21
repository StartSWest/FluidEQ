/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useState } from 'react';
import type { TSharePresetLinkRefusal } from '../../../../common/presetShare/sharedPresetLink';
import type { IDspCatalogEntry } from '../../../dsp/dspPresetCatalog';
import { makePresetShortLink } from './presetShareActions';

export type TPresetShortLink =
  | { state: 'off' }
  | { state: 'making' }
  | { state: 'ready'; url: string }
  | { state: 'refused'; reason: TSharePresetLinkRefusal };

/**
 * The export's short link: made once the listener wants one and the code is
 * ready, and made again only for another preset or code. The server answers
 * the same link for the same code, so turning the box off and on costs a
 * request and never a second link.
 *
 * An answer for a code that has changed since is dropped, so a slow first
 * answer can never land over a newer one.
 */
const usePresetShortLink = (
  preset: IDspCatalogEntry,
  code: string | undefined,
  wanted: boolean,
): TPresetShortLink => {
  const [link, setLink] = useState<TPresetShortLink>({ state: 'off' });
  useEffect(() => {
    if (!wanted || !code) {
      setLink({ state: 'off' });
      return undefined;
    }
    let current = true;
    setLink({ state: 'making' });
    makePresetShortLink(preset, code)
      .then((outcome) => {
        if (current) {
          setLink(
            outcome.ok
              ? { state: 'ready', url: outcome.url }
              : { state: 'refused', reason: outcome.reason },
          );
        }
        return outcome;
      })
      .catch(() => {
        if (current) {
          setLink({ state: 'refused', reason: 'offline' });
        }
      });
    return () => {
      current = false;
    };
  }, [preset, code, wanted]);
  return link;
};

export default usePresetShortLink;
