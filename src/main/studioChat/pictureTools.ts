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
import { CHATGPT_PICTURES_OPEN } from '../../common/studioChatPictures';
import type { IMcpTool } from '../studioAgent/mcpProtocol';
import type { TChatAsks } from './chatAsks';
import createMakePictureTool from './makePictureTool';
import createPackArtworkTool from './packArtworkTool';

/**
 * The chat's two picture tools (Ivan, 2026-10-09: "so when we ship fluid it
 * knows how to use gpt to generate textures and images for the
 * visualizers"):
 *
 * - make_picture: ChatGPT draws one picture through the member's Codex,
 *   after the member said yes to it (`chatAsks.ts`), and it is kept in the
 *   project's `art/` folder, which the build never reads. Claude is shown it.
 * - pack_artwork: lays pictures from `art/`, and pieces already in the
 *   scene's artwork, into the one artwork image the scene samples, and writes
 *   `pack.json`'s artwork lines to match. The member's photo places stay
 *   where they are, with what is in them.
 *
 * Claude in the chat has no shell, so this is the packing script the brief
 * asks any other AI to write for itself.
 */

export interface IPictureToolsDeps {
  project(): TAgentProject;
  asks: TChatAsks;
  /** The member's Stop for the reply in progress on a project. */
  signalOf(projectId: string): AbortSignal;
  /** The window lays out the artwork and encodes it as WebP. */
  packInWindow(
    ask: Omit<IStudioChatPackAsk, 'id'>,
  ): Promise<TStudioChatPackAnswer | 'no-window'>;
  logger?: { info(message: string): void; warn(message: string): void };
}

/**
 * make_picture only while ChatGPT pictures are open (`studioChatPictures.ts`):
 * closed, Claude is never offered it, so no Codex is ever started for one.
 * pack_artwork starts nothing outside FluidEQ and stays.
 */
export const createPictureTools = (deps: IPictureToolsDeps): IMcpTool[] => [
  ...(CHATGPT_PICTURES_OPEN ? [createMakePictureTool(deps)] : []),
  createPackArtworkTool(deps),
];
