/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  IStudioChatPackAsk,
  TStudioChatPackAnswer,
} from '../../common/studioChat';
import type { TAgentProject } from '../studioAgent/agentProject';
import type { IMcpTool } from '../studioAgent/mcpProtocol';
import createPackArtworkTool from './packArtworkTool';

/**
 * The chat's picture tool: pack_artwork lays pictures from the project's
 * `art/` folder — Higgsfield's, the member's, or the chat's own — and pieces
 * already in the scene's artwork into the one artwork image the scene
 * samples, and writes `pack.json`'s artwork lines to match. The member's
 * photo places stay where they are, with what is in them.
 *
 * Claude in the chat runs a command only once the member says yes to it
 * (`chatPermission.ts`), so this is the packing script the brief asks any
 * other AI to write for itself, with no card to answer.
 *
 * FluidEQ's own make_picture, which had ChatGPT draw through the member's
 * Codex, was switched off for 2.1 and taken out on 2026-11-11 with every
 * other GPT path: Higgsfield makes the pictures now.
 */

export interface IPictureToolsDeps {
  project(): TAgentProject;
  /** The window lays out the artwork and encodes it as WebP. */
  packInWindow(
    ask: Omit<IStudioChatPackAsk, 'id'>,
  ): Promise<TStudioChatPackAnswer | 'no-window'>;
  logger?: { info(message: string): void; warn(message: string): void };
}

export const createPictureTools = (deps: IPictureToolsDeps): IMcpTool[] => [
  createPackArtworkTool(deps),
];
