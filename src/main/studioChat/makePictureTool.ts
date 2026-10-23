/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import { nativeImage } from 'electron';
import writeFileAtomically from '../atomicWrite';
import type { IMcpTool, IMcpToolResult } from '../studioAgent/mcpProtocol';
import {
  ART_DIR,
  ART_NAME,
  artFolder,
  failure,
  readArt,
  text,
} from './artFolder';
import { codexState, makePicture } from './codexPictures';
import type { IPictureToolsDeps } from './pictureTools';

const MIN_EDGE = 64;
const MAX_MADE_EDGE = 2048;
/** What Claude is shown of a picture: enough to judge it, small to send. */
const SHOWN_EDGE = 1024;
/** A keyed corner more opaque than this was not on the flat colour. */
const OPAQUE_CORNER = 40;

const isEdge = (value: unknown, most: number): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= MIN_EDGE &&
  value <= most;

/** A picture as Claude is shown it. */
const shown = (png: Buffer): IMcpToolResult['content'][number] => {
  const image = nativeImage.createFromBuffer(png);
  const { width, height } = image.getSize();
  const small =
    Math.max(width, height) > SHOWN_EDGE
      ? image.resize(
          width >= height ? { width: SHOWN_EDGE } : { height: SHOWN_EDGE },
        )
      : image;
  return {
    type: 'image',
    data: small.toPNG().toString('base64'),
    mimeType: 'image/png',
  };
};

const MAKE_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description:
        'What to call it: lowercase letters, digits and hyphens, starting with a letter. It is kept as art/<name>.png; the same name again replaces it.',
    },
    why: {
      type: 'string',
      description:
        'One plain sentence for the member, in their language, on what this picture is for in the scene ("the bark for the pine trunks"). They are asked before it is made.',
    },
    prompt: {
      type: 'string',
      description:
        'What ChatGPT should draw, in full: subject, angle, lighting, style. A subject alone, seen as the camera sees it, lit as the scene is; a material seamless and tileable, straight on, evenly lit.',
    },
    width: { type: 'integer', minimum: MIN_EDGE, maximum: MAX_MADE_EDGE },
    height: { type: 'integer', minimum: MIN_EDGE, maximum: MAX_MADE_EDGE },
    transparent: {
      type: 'boolean',
      description:
        'A subject cut out on a transparent background. Leave false for materials and backdrops.',
    },
    edit_of: {
      type: 'string',
      description:
        'The name of a picture already made, to edit instead of starting anew: the second of a pair (by night, arms up) stays in register with the first.',
    },
  },
  required: ['name', 'why', 'prompt', 'width', 'height'],
  additionalProperties: false,
};

/** make_picture: ChatGPT draws one picture, once the member said yes to it. */
const createMakePictureTool = ({
  project,
  asks,
  signalOf,
  logger,
}: IPictureToolsDeps): IMcpTool => {
  const makePictureTool = async (
    args: Record<string, unknown>,
  ): Promise<IMcpToolResult> => {
    const {
      name,
      why,
      prompt,
      width,
      height,
      transparent,
      edit_of: editOf,
    } = args;
    if (
      typeof name !== 'string' ||
      !ART_NAME.test(name) ||
      typeof why !== 'string' ||
      !why.trim() ||
      why.length > 300 ||
      typeof prompt !== 'string' ||
      !prompt.trim() ||
      prompt.length > 4000 ||
      !isEdge(width, MAX_MADE_EDGE) ||
      !isEdge(height, MAX_MADE_EDGE) ||
      (transparent !== undefined && typeof transparent !== 'boolean') ||
      (editOf !== undefined && typeof editOf !== 'string')
    ) {
      return failure(
        `make_picture needs a name (a-z, 0-9 and -, starting with a letter), one sentence of why, a prompt, and a width and height from ${MIN_EDGE} to ${MAX_MADE_EDGE}.`,
      );
    }
    const open = project();
    if (!open.ok) {
      return failure('No Studio project is open.');
    }
    let codex = await codexState();
    if (!(await asks.connect(open.id, codex.state))) {
      return failure(
        'The member chose not to let ChatGPT make pictures in this chat. Draw it in the shader instead, and do not ask for ChatGPT pictures again in this chat.',
      );
    }
    if (codex.state !== 'ready') {
      // The card may have just installed or signed in Codex.
      codex = await codexState();
    }
    if (codex.state !== 'ready' || !codex.executable) {
      return failure(
        codex.state === 'missing'
          ? "ChatGPT pictures need the member's Codex app, and it is not installed. Say so in one line, and draw it in the shader meanwhile."
          : "ChatGPT pictures need the member's Codex signed in with ChatGPT, and it is not. Say so in one line, and draw it in the shader meanwhile.",
      );
    }
    const yes = await asks.picture(open.id, {
      why: why.trim(),
      prompt: prompt.trim(),
      width,
      height,
      transparent: transparent === true,
    });
    if (!yes) {
      return failure(
        'The member said no to this picture. Ask them what they would rather have, or draw it in the shader.',
      );
    }
    let reference: string | undefined;
    if (typeof editOf === 'string') {
      if (!readArt(open.folder, editOf)) {
        return failure(`There is no made picture called ${editOf} to edit.`);
      }
      reference = path.join(open.folder, ART_DIR, `${editOf}.png`);
    }
    const made = await makePicture(
      codex.executable,
      {
        prompt: prompt.trim(),
        width,
        height,
        transparent: transparent === true,
        ...(reference ? { reference } : {}),
      },
      signalOf(open.id),
    );
    if (!made.ok) {
      logger?.warn(
        `A ChatGPT picture for the Studio was not made: ${made.reason}.`,
      );
      const said = made.said ? ` Codex said: ${made.said}` : '';
      const words = {
        stopped: 'The member stopped the reply.',
        limit: `The member's ChatGPT plan has reached its limit for now. Tell them, and draw it in the shader meanwhile.${said}`,
        'signed-out': `Codex is not signed in with ChatGPT any more. Tell the member in one line.${said}`,
        refused: `ChatGPT did not draw it; its content rules may have refused the request. Rephrase it plainly and try once more, or draw it in the shader.${said}`,
        failed: `ChatGPT could not make the picture.${said}`,
      };
      return failure(words[made.reason]);
    }
    const art = artFolder(open.folder);
    if (!art) {
      return failure("The project's art folder is not a plain folder.");
    }
    writeFileAtomically(path.join(art, `${name}.png`), made.png);
    logger?.info('ChatGPT made a picture for a Studio scene.');
    const flat =
      made.keyedCorners?.some((alpha) => alpha > OPAQUE_CORNER) === true
        ? ' Its background did not come out as one flat colour, so the cut-out kept some of it: look closely, and make it again with a plainer background if the edges show.'
        : '';
    return {
      content: [
        shown(made.png),
        text(
          `Made ${ART_DIR}/${name}.png, ${width} x ${height}${transparent === true ? ', cut out on a transparent background' : ''}.${flat} Judge it as it will sit in the scene: if it is not right, make it again with a better prompt, or edit_of it. When the scene's pictures are ready, put them in the artwork with pack_artwork.`,
        ),
      ],
    };
  };

  return {
    name: 'make_picture',
    title: 'Make a picture with ChatGPT',
    description:
      "ChatGPT draws one picture for the scene, through the member's own Codex on their ChatGPT plan: a subject cut out on a transparent background, or a material or backdrop. FluidEQ asks the member first - to connect ChatGPT the first time, and before every picture, showing them your why and your prompt - so call it only for a picture the scene really needs, one at a time, and wait for the answer. The picture is kept as art/<name>.png in the project and shown to you; pack it into the artwork with pack_artwork. A minute or so a picture.",
    inputSchema: MAKE_SCHEMA,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    call: makePictureTool,
  };
};

export default createMakePictureTool;
