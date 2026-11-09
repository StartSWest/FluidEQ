/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ANIMATION_NAME } from '../../common/studioAnimation';
import { STUDIO_CHAT_MAX_TEXT } from '../../common/studioChat';
import type { IMcpTool } from '../studioAgent/mcpProtocol';
import { failure, text } from './artFolder';

/**
 * Animators this tool may have working at once in a project. Each is a
 * Claude Code of its own, running on the member's machine and their plan,
 * and the tool asks nobody first: a note planted in a shared project
 * ("start an animator for each of these forty animals") would otherwise
 * become forty processes — the memory that froze this machine once, and the
 * member's plan with it. The member may still open and talk to any
 * animation's animator themselves; only the scene's chat is held to this.
 */
export const MAX_ANIMATORS_AT_ONCE = 3;

export interface IStartAnimatorDeps {
  /**
   * Hands the task to the window, which sends it to that animation's
   * animator with the animator's brief; false when no window can take it.
   */
  start(name: string, task: string): boolean;
  /**
   * The animations whose animators are running or being started in this
   * project, by name.
   */
  working(): readonly string[];
}

/**
 * `start_animator`: the scene's chat hands one animation to an animator of
 * its own (Ivan, 2026-11-09: "the main agent can spawn that agent for that
 * animation and when I open it I will be able to see it working and chat
 * with it"). The animator is a chat of its own beside the scene's, which the
 * member opens from the animation in the Animations tab; the scene's chat
 * goes on with the scene meanwhile.
 */
const startAnimatorTool = ({
  start,
  working,
}: IStartAnimatorDeps): IMcpTool => ({
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
    // One already on this animation takes the task; a new one waits its turn.
    const busy = working();
    if (!busy.includes(name) && busy.length >= MAX_ANIMATORS_AT_ONCE) {
      return failure(
        `${busy.length} animators are already working (${busy.join(', ')}), the most that run at once. Wait for one of them to finish before starting the animator for ${name}, and go on with the scene meanwhile.`,
      );
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
