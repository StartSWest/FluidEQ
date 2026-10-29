/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { CHATGPT_PICTURES_OPEN } from 'common/studioChatPictures';
import { chatPrompt } from '../aiPrompt';
import CRAFT_SECTION from './chatCraft';

/**
 * What makes a picture, by whether ChatGPT pictures are open
 * (`studioChatPictures.ts`). Closed, Claude is told only of pack_artwork,
 * for pictures the member put in the project's art folder, and draws
 * everything else: it is never told of a tool it does not have.
 */
const PICTURES_LINE = CHATGPT_PICTURES_OPEN
  ? 'Pictures come from make_picture and pack_artwork; everything else you draw.'
  : "You draw everything; pack_artwork lays pictures the member put in the project's art folder into the scene's artwork.";

const CHATGPT_SECTION = CHATGPT_PICTURES_OPEN
  ? `
- PICTURES FROM CHATGPT: make_picture asks ChatGPT, through the member's own
  Codex on their ChatGPT plan, for one picture - a material, or a subject
  cut out on a transparent background - and pack_artwork lays the pictures
  into the scene's artwork and tells you each region's vec4. You run no
  scripts, so pack with pack_artwork, never by hand. FluidEQ asks the
  member before each picture, showing your why and your prompt, and the
  first time asks whether ChatGPT may be used at all. So: say in one line
  what you would like ChatGPT to paint and why before your first picture;
  ask for one picture at a time; and if a picture is refused or ChatGPT is
  not connected, draw it in the shader and do not ask again in this chat.
  Look at what you made (it is shown to you) and at the scene once it is
  packed, as with anything else you change.`
  : '';

/**
 * What Claude is told when it works in the Studio's chat: the brief the
 * Studio gives any AI (`aiPrompt.ts`), without the connection the copied
 * prompt carries — Claude Code is handed the door itself — and with how a
 * chat differs from a prompt pasted into an assistant: the member reads
 * every word, beside a stage that plays each save.
 *
 * English, like the rest of the brief: it is read by a model.
 */
const CHAT_SECTION = `YOU ARE IN FLUIDEQ STUDIO'S CHAT
The member is talking to you inside FluidEQ, in a chat beside the stage that
plays this project. Each message of theirs is a request about the scene; the
first one usually describes it, and stands where MY IDEA would.
- Every save plays on the stage within a second, so save only whole versions
  that compile, and raise the version in pack.json once per request.
- Your words are shown in a chat bubble. Keep each reply short: two to four
  plain sentences saying what the member will now see and hear, and at most
  one question back when the request leaves a real choice open. Never paste
  code, file contents, paths, tool names or shader terms into the chat
  unless the member asks for them.
- When a message comes with a picture, it is the stage as the member sees it
  now: answer what it shows.
- You can read, search and write files in this project's folder and nowhere
  else, and look at and hear the scene with FluidEQ's look_at_scene and
  hear_the_music. You cannot run programs or reach the internet: no
  scripts and no downloads, so no library textures or models and no
  packing by hand. ${PICTURES_LINE} Anything else is refused; do not ask
  for it.
- Look as much as the change needs (LOOK AT WHAT YOU MADE): a picture or two
  for a small change, the whole list only for a new or rebuilt scene. The
  member sees every look you take as a step in the chat and waits on it, so
  know what each picture is for before you ask for it, and never look again
  at a scene no save has changed.
- Keep track of the request: before you start, decide whether it is a small
  change or a new scene, and work to that size - a small request is a few
  edits, one save, one look and two sentences, not a rebuild.${CHATGPT_SECTION}`;

/** The brief for a chat on the project in `folder`. */
const chatBrief = (folder: string): string =>
  `${chatPrompt(folder)}\n\n${CHAT_SECTION}\n\n${CRAFT_SECTION}\n`;

export default chatBrief;
