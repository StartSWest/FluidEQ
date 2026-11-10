/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { nativeImage } from 'electron';
import { measureAnimation, feetLineOf } from '../../common/animationFrames';
import { ANIMATION_NAME } from '../../common/studioAnimation';
import { readProjectAnimation } from '../memberScenes/projectAnimations';
import { pictureFromBytes } from '../safePicture';
import type { IMcpTool } from '../studioAgent/mcpProtocol';
import { composeLook, describeAnimation } from './animationLook';
import { failure, READABLE_PICTURES, text } from './artFolder';

/** The tallest a frame is shown: enough to see a hoof, small to send. */
const SHOWN_CELL = 240;
/** The widest the whole picture may be. */
const SHOWN_WIDTH = 2000;

/**
 * `look_at_animation`: an animation seen alone (Ivan, 2026-11-09: the
 * animator "will look at it and do iteration until is perfect"; the glacier
 * chat kept photographing the whole scene to see one animal in it). Read
 * from the frames the project already has, so looking costs no picture.
 */
const lookAnimationTool = (folder: string): IMcpTool => ({
  name: 'look_at_animation',
  title: 'Look at an animation',
  description:
    "See one of the project's animations (animations/<name>.json and its sheet) on its own: a picture of every frame in order and of each frame over the one before it, with the line the feet stand on, and the numbers per frame - where the feet are, how big the drawing is, how much it changes - naming any frame that floats, sinks, pops or jumps. Use it after making or changing an animation, never a picture of the whole scene, to judge the animation itself.",
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'The animation: its file name in animations/ without .json, lowercase letters, digits and hyphens.',
      },
    },
    required: ['name'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true },
  call: async (args) => {
    const name = typeof args.name === 'string' ? args.name : '';
    if (!ANIMATION_NAME.test(name)) {
      return failure(
        'Name an animation by its file in animations/, without .json: lowercase letters, digits and hyphens.',
      );
    }
    const found = await readProjectAnimation(folder, name);
    if (!found) {
      return failure(
        `There is no animation "${name}" to look at: animations/${name}.json must name a sheet picture inside the project. ${READABLE_PICTURES}`,
      );
    }
    const { animation } = found;
    const image = pictureFromBytes(found.sheet);
    const { width, height } = image.getSize();
    if (image.isEmpty() || width === 0 || height === 0) {
      return failure(
        `${animation.sheet} could not be read as a picture. ${READABLE_PICTURES}`,
      );
    }
    const measure = measureAnimation(
      { data: image.toBitmap(), width, height },
      animation,
    );
    const cell = measure.cells[0];
    if (cell.width < 1 || cell.height < 1) {
      return failure(
        `${animation.sheet} is too small for ${animation.count} frames, ${animation.columns} to a row.`,
      );
    }
    const scale = Math.min(
      1,
      SHOWN_CELL / cell.height,
      (SHOWN_WIDTH - 8 * (animation.count + 1)) /
        (animation.count * cell.width),
    );
    const shownWidth = Math.max(1, Math.round(cell.width * scale));
    const shownHeight = Math.max(1, Math.round(cell.height * scale));
    const cells = measure.cells.map((place) => ({
      data: image
        .crop(place)
        .resize({ width: shownWidth, height: shownHeight, quality: 'better' })
        .toBitmap(),
      width: shownWidth,
      height: shownHeight,
    }));
    const look = composeLook(cells, feetLineOf(measure));
    // A JPEG: the picture is opaque, and it is kept with the chat's step.
    const jpeg = nativeImage
      .createFromBitmap(Buffer.from(look.data), {
        width: look.width,
        height: look.height,
      })
      .toJPEG(86);
    return {
      content: [
        {
          type: 'image',
          data: jpeg.toString('base64'),
          mimeType: 'image/jpeg',
        },
        text(describeAnimation(animation, measure)),
      ],
    };
  },
});

export default lookAnimationTool;
