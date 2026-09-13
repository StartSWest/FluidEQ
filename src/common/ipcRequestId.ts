/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The number a window sends with a request it waits on, and main hands back
 * beside the reply.
 *
 * Replies travel on named channels, and every request waiting on a channel
 * hears every reply sent to it; this is what tells a reply which of them it
 * answers. Nothing but a positive safe integer counts, so an argument some
 * other message happens to carry in that position is never taken for one.
 */
const isRequestId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export default isRequestId;
