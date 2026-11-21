/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useState } from 'react';
import SharedPresetImportDialog from './SharedPresetImportDialog';

/**
 * A shared preset opened from fluideq.com's page for it: the window takes
 * the link main kept (`main/presetLinks.ts`) when it starts — FluidEQ may
 * have been started by the link — and again each time main says one came,
 * and asks "Add this preset?" over whichever page is open.
 *
 * A second link while the question is up replaces the first: the question
 * is about the last page the listener pressed Open on.
 */
const PresetLinkReceiver = () => {
  const [code, setCode] = useState<string | undefined>(undefined);
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
            setCode(next);
            setArrival((count) => count + 1);
          }
          return next;
        })
        .catch(() => undefined);
    };
    take();
    return bridge.onPresetLink(take);
  }, []);

  if (!code) {
    return null;
  }
  return (
    <SharedPresetImportDialog
      key={arrival}
      mode="link"
      initialText={code}
      onClose={() => setCode(undefined)}
    />
  );
};

export default PresetLinkReceiver;
