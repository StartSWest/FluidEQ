/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Who makes pictures, videos and 3D models for a scene when the Studio's
 * chat needs one from outside FluidEQ: Higgsfield, and nothing else (Ivan,
 * 2026-11-11: "let's remove GPT then and let's only use Higgsfield for image
 * gen, videos and everything Higgsfield can do").
 *
 * It is the member's own, on the member's own account, reached through the
 * member's own Claude Code, where Higgsfield's hosted tool server is added
 * (by FluidEQ, on the member's press) and signed in to. FluidEQ ships none
 * of it, holds no sign-in and pays for nothing.
 *
 * A member's own plugins stay their own: the chat loads whatever their
 * Claude Code has, behind the permission card (Ivan, 2026-11-10). FluidEQ
 * just names, offers and steers to Higgsfield alone.
 */

/**
 * Higgsfield in the member's own Claude Code: its hosted tool server
 * (https://mcp.higgsfield.ai/mcp), added there — by FluidEQ as `higgsfield`,
 * or by the member as a claude.ai connector, which Claude Code lists as
 * `claude.ai Higgsfield` — and signed in to with the member's own Higgsfield
 * account. Hosted, so it is always Higgsfield's newest and nothing is
 * installed on the computer.
 */
export type THiggsfieldAccount =
  /** Not added to Claude Code. */
  | { state: 'missing' }
  /** Added, and waiting for the member to sign in. */
  | { state: 'signed-out' }
  /** Added, and Claude Code could not reach it just now. */
  | { state: 'unreachable' }
  /**
   * A claude.ai connector, connected in the member's own Claude Code and
   * out of the chat's reach: a Claude Code run headless, as the chat runs
   * it, comes up with such a connector as needing sign-in and none of its
   * tools (Claude Code 2.1.321, measured 2026-11-11, while `claude mcp
   * list` said Connected). Setting it up here adds Higgsfield as a server of
   * the member's own, which a headless Claude Code reads its sign-in for.
   */
  | { state: 'connector' }
  | { state: 'ready' };
