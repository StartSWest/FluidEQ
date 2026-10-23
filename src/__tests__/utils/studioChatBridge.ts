/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IStudioChat } from '../../common/studioChat';

/**
 * The bridge calls the Studio's chat pane makes on arrival, answered as a
 * computer with Claude Code installed and signed in, and an empty chat for
 * the open project. Without them the pane stays on "Looking for Claude
 * Code…" and its composer is never drawn.
 */
const studioChatBridge = (projectId = '') => ({
  studioChatAvailability: jest.fn(async () => ({ state: 'ready' as const })),
  studioChatLoad: jest.fn(async (): Promise<IStudioChat> => ({
    projectId,
    entries: [],
    busy: false,
  })),
  studioChatCodex: jest.fn(async () => undefined),
});

export default studioChatBridge;
