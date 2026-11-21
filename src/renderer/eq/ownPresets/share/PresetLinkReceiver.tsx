/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useState } from 'react';
import { sharedPresetPageUrl } from '../../../../common/presetShare/sharedPresetLink';
import SharedPresetImportDialog from './SharedPresetImportDialog';

/**
 * A shared preset opened from fluideq.com's page for it: the window takes
 * the id main kept (`main/presetLinks.ts`) when it starts — FluidEQ may have
 * been started by the link — and again each time main says one came, and
 * asks "Add this preset?" over whichever page is open. The preset itself is
 * fetched by main from FluidEQ's server, by id (`useSharedPreset`).
 *
 * A second link while the question is up replaces the first, never stacks
 * behind it: the question is about the last page the listener pressed Open
 * on.
 */
const PresetLinkReceiver = () => {
  const [id, setId] = useState<string | undefined>(undefined);
  // Keyed by arrival, so a new link opens a fresh question.
  const [arrival, setArrival] = useState(0);

  useEffect(() => {
    const bridge = window.electron?.ipcRenderer;
    if (!bridge?.takePresetLink) {
      return undefined;
    }
    const take = () => {
      bridge
        .takePresetLink()
        .then((next) => {
          if (next) {
            setId(next);
            setArrival((count) => count + 1);
          }
          return next;
        })
        .catch(() => undefined);
    };
    take();
    return bridge.onPresetLink(take);
  }, []);

  if (!id) {
    return null;
  }
  return (
    <SharedPresetImportDialog
      key={arrival}
      mode="link"
      initialText={sharedPresetPageUrl(id)}
      onClose={() => setId(undefined)}
    />
  );
};

export default PresetLinkReceiver;
