/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  isStudioMadeKind,
  makersFor,
  makerToUse,
  STUDIO_MADE_KINDS,
  type IStudioMakers,
  type TStudioMaker,
} from '../../common/studioMakers';
import type { TAgentProject } from '../studioAgent/agentProject';
import type { IMcpTool, IMcpToolResult } from '../studioAgent/mcpProtocol';
import type { TChatAsks } from './chatAsks';

/**
 * choose_maker: who makes a picture, a set of frames or a 3D model for the
 * scene - the member's own GPT plugin, or Higgsfield on the member's own
 * account (Ivan, 2026-11-11: "que pida si quiere usar GPT o Higgsfield").
 *
 * It makes nothing and starts nothing. It looks at which of the two is in
 * the member's Claude Code now and can make this kind of thing, takes the
 * member's standing choice when there is one, puts the question to them on a
 * card when both can and nothing is chosen, and tells Claude which to use
 * and how. With neither there it says so, and that connecting one is the
 * member's to do, in Accounts: Claude is never told to install or connect
 * anything.
 */

export interface IChooseMakerDeps {
  project(): TAgentProject;
  asks: TChatAsks;
  /** The two as they are in the member's Claude Code now. */
  makers(): Promise<IStudioMakers>;
}

const SCHEMA = {
  type: 'object',
  properties: {
    what: {
      type: 'string',
      enum: [...STUDIO_MADE_KINDS],
      description:
        'What the scene needs made: "picture" (a subject, a material, a backdrop), "frames" (the drawings of an animation), or "model" (a 3D model, a .glb, for a 3D world). A scene cannot use a video or a sound: never ask for one.',
    },
    why: {
      type: 'string',
      description:
        'One plain sentence for the member, in their language, on what it is for in the scene ("a heron for the lake\'s shore"). They may be shown it when asked which maker to use.',
    },
  },
  required: ['what', 'why'],
  additionalProperties: false,
};

const text = (words: string): IMcpToolResult => ({
  content: [{ type: 'text', text: words }],
});

const failure = (words: string): IMcpToolResult => ({
  ...text(words),
  isError: true,
});

/** A plugin by the name before its marketplace: `gpt-studio@x` is gpt-studio. */
const pluginName = (makers: IStudioMakers) =>
  makers.gpt.name?.split('@')[0] ?? 'gpt-studio';

const HOW: Record<TStudioMaker, (makers: IStudioMakers) => string> = {
  gpt: (makers) =>
    `Use the member's own GPT plugin in their Claude Code (${pluginName(makers)}): its image skill. Claude Code asks the member before it runs. It works on the member's own ChatGPT plan. Have it save what it makes inside this project's art folder, look at the result, then lay it into the scene with pack_artwork - or build_sheet for the frames of an animation.`,
  higgsfield: () =>
    "Use Higgsfield, on the member's own account and credits. Load the fluideq-higgsfield skill first and follow it: say what this will cost before spending anything, wait for the member's yes on the card, download every result into this project's folder (never link to it), then pack_artwork, build_sheet, or the world's models.",
};

const NEITHER =
  'Neither of the two makers is connected in the member\'s Claude Code: no GPT plugin, and Higgsfield is not set up or not signed in. Tell the member in one line that pictures can be made once one is - Higgsfield from this chat\'s Accounts, under "Set up Higgsfield" - and draw it in the shader meanwhile. Do not install, add or sign in to anything yourself.';

/** A 3D model is Higgsfield's alone: a GPT plugin draws pictures. */
const NO_MODEL_MAKER =
  "A 3D model needs Higgsfield, and it is not connected in the member's Claude Code (a GPT plugin makes pictures, not models). Tell the member in one line that a model can be made once Higgsfield is set up from this chat's Accounts, under \"Set up Higgsfield\", and build the thing from the world's own shapes meanwhile. Do not install, add or sign in to anything yourself.";

const createChooseMakerTool = ({
  project,
  asks,
  makers,
}: IChooseMakerDeps): IMcpTool => ({
  name: 'choose_maker',
  title: 'Choose who makes it',
  description:
    "Call this BEFORE making any picture, set of animation frames or 3D model with a tool from outside FluidEQ. It answers which maker to use - the member's own GPT plugin, or Higgsfield on the member's own account - and how. When both are connected and the member has not chosen, it asks them on a card and waits. When neither is, it says so. It makes nothing itself and costs nothing. Call it once for each thing to be made; never choose a maker yourself, and never connect or install one.",
  inputSchema: SCHEMA,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  call: async (args) => {
    const { what, why } = args;
    if (
      !isStudioMadeKind(what) ||
      typeof why !== 'string' ||
      !why.trim() ||
      why.length > 300
    ) {
      return failure(
        `choose_maker needs what is to be made (${STUDIO_MADE_KINDS.join(', ')}) and one sentence of why. A scene cannot use a video or a sound.`,
      );
    }
    const open = project();
    if (!open.ok) {
      return failure(
        "This chat's project is not in FluidEQ's Studio list any more, or may not be used now: ask the member to open it in the Studio again.",
      );
    }
    const now = await makers();
    const use = makerToUse(now.choice, makersFor(what, now));
    if (use === 'none') {
      return text(what === 'model' ? NO_MODEL_MAKER : NEITHER);
    }
    // A model is never a question: only one of the two can make it.
    if (use !== 'ask' || what === 'model') {
      return text(HOW[use === 'ask' ? 'higgsfield' : use](now));
    }
    const pressed = await asks.maker(open.id, { what, why: why.trim() });
    return pressed
      ? text(HOW[pressed](now))
      : text(
          'The member said not now. Draw it in the shader instead, or ask what they would rather have. Do not ask for this again in this reply.',
        );
  },
});

export default createChooseMakerTool;
