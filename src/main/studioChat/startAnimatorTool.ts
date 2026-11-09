/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ANIMATION_NAME } from '../../common/studioAnimation';
import { STUDIO_CHAT_MAX_TEXT } from '../../common/studioChat';
import type { IMcpTool } from '../studioAgent/mcpProtocol';
import { failure, text } from './artFolder';

export interface IStartAnimatorDeps {
  /**
   * Hands the task to the window, which sends it to that animation's
   * animator with the animator's brief; false when no window can take it.
   */
  start(name: string, task: string): boolean;
}

/**
 * `start_animator`: the scene's chat hands one animation to an animator of
 * its own (Ivan, 2026-11-09: "the main agent can spawn that agent for that
 * animation and when I open it I will be able to see it working and chat
 * with it"). The animator is a chat of its own beside the scene's, which the
 * member opens from the animation in the Animations tab; the scene's chat
 * goes on with the scene meanwhile.
 */
const startAnimatorTool = ({ start }: IStartAnimatorDeps): IMcpTool => ({
  name: 'start_animator',
  title: 'Start the animator on an animation',
  description:
    "Hand one animation to its own animator: a separate agent with FluidEQ's animation skill, working only on animations/<name>.json and its sheet, looking at the animation alone and iterating until it is right. It makes the animation when there is none yet. The member watches it work and talks to it from the animation in the Studio's Animations tab. Use it for each animal or thing that should move frame by frame (a walk, a wing beat, a tail), then go on with the scene: place the animation in it once its file exists.",
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'The animation: lowercase letters, digits and hyphens, starting with a letter (wolf-walk). It is kept as animations/<name>.json.',
      },
      task: {
        type: 'string',
        description:
          "What the animator is to make or fix, in full: the animal, its gait, which pictures of the project to start from, where it moves in the scene and against what (ground, sky, water). The member reads it as the animator's first message.",
      },
    },
    required: ['name', 'task'],
    additionalProperties: false,
  },
  call: async (args) => {
    const name = typeof args.name === 'string' ? args.name : '';
    const task = typeof args.task === 'string' ? args.task.trim() : '';
    if (!ANIMATION_NAME.test(name)) {
      return failure(
        'Name the animation with lowercase letters, digits and hyphens, starting with a letter: wolf-walk.',
      );
    }
    if (!task || task.length > STUDIO_CHAT_MAX_TEXT) {
      return failure('Say what the animator is to make or fix.');
    }
    return start(name, task)
      ? {
          content: [
            text(
              `The animator has started on ${name}. The member can open it from the Animations tab to watch it and talk to it. Go on with the scene; place the animation once animations/${name}.json exists.`,
            ),
          ],
        }
      : failure("FluidEQ's window is not open to start the animator in.");
  },
});

export default startAnimatorTool;
