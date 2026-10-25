/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether the Studio's chat may have ChatGPT paint pictures through the
 * member's own Codex (`main/studioChat/codexPictures.ts`). Closed: FluidEQ
 * starts no Codex at all, neither to make a picture nor to ask who is signed
 * in, Claude is offered no make_picture tool, and nothing in the window
 * mentions ChatGPT pictures. The code stays, ready for the day it opens.
 *
 * Closed for 2.1 (Ivan, 2026-10-25: "yes turn off gpt pictures"): OpenAI's
 * Codex documentation says "App-server authentication has never been
 * permitted for commercial or hosted services" (learn.chatgpt.com/docs/
 * app-server, Auth endpoints), and offering a ChatGPT plan's use in a paid
 * app goes through OpenAI's own approval (developers.openai.com/siwc).
 * FluidEQ is a paid app. Opening this needs OpenAI's yes in writing first.
 *
 * Copying a prompt for another assistant, ChatGPT or Codex among them, is
 * not this: the member drives that assistant themselves.
 */
export const CHATGPT_PICTURES_OPEN: boolean = false;
