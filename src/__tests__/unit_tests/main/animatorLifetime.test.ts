/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An animator's Claude Code stays up after its reply, 350-400 MB each. Past
 * three in a project or five on the machine, the one used longest ago is
 * ended (`animatorLifetime.ts`), never one mid-reply; its thread stays on
 * disk and the next message resumes it.
 */

import { animatorChatKey } from '../../../common/studioChat';
import {
  animatorsIn,
  createAnimatorLifetime,
  idleAnimatorsToEnd,
  MAX_ANIMATORS,
  MAX_ANIMATORS_PER_PROJECT,
  type IRunningAnimator,
} from '../../../main/studioChat/animatorLifetime';

const animator = (
  project: string,
  name: string,
  used: number,
  busy = false,
): IRunningAnimator => ({
  key: animatorChatKey(project, name),
  project,
  busy,
  used,
});

describe('which idle animators are ended', () => {
  it('none while every limit holds', () => {
    expect(
      idleAnimatorsToEnd([
        animator('a', 'wolf', 1),
        animator('a', 'fox', 2),
        animator('a', 'bird', 3),
      ]),
    ).toEqual([]);
  });

  it('the oldest idle past three in a project', () => {
    const wolf = animator('a', 'wolf', 1);
    expect(
      idleAnimatorsToEnd([
        wolf,
        animator('a', 'fox', 4),
        animator('a', 'bird', 3),
        animator('a', 'deer', 5),
      ]),
    ).toEqual([wolf.key]);
  });

  it('never one in the middle of a reply, however old', () => {
    const wolf = animator('a', 'wolf', 1, true);
    const bird = animator('a', 'bird', 3);
    expect(
      idleAnimatorsToEnd([
        wolf,
        animator('a', 'fox', 2, true),
        bird,
        animator('a', 'deer', 5, true),
      ]),
    ).toEqual([bird.key]);
    // All four busy: none ends, and the limit waits for a reply to finish.
    expect(
      idleAnimatorsToEnd([
        wolf,
        animator('a', 'fox', 2, true),
        animator('a', 'bird', 3, true),
        animator('a', 'deer', 5, true),
      ]),
    ).toEqual([]);
  });

  it('the oldest idle past five on the machine, across projects', () => {
    const running = [
      animator('a', 'wolf', 1),
      animator('a', 'fox', 7),
      animator('b', 'whale', 2),
      animator('b', 'gull', 6),
      animator('c', 'moth', 3),
      animator('c', 'bat', 5),
    ];
    expect(idleAnimatorsToEnd(running)).toEqual([running[0].key]);
    expect(MAX_ANIMATORS).toBeLessThan(running.length);
    expect(MAX_ANIMATORS_PER_PROJECT).toBeGreaterThanOrEqual(2);
  });
});

describe('the lifetime as the chat runs it', () => {
  it('ends the animator used longest ago when a fourth comes up, and resumes nothing itself', () => {
    const running = new Set<string>();
    const busy = new Set<string>();
    const ended: string[] = [];
    const lifetime = createAnimatorLifetime({
      running: () => [...running],
      isBusy: (key) => busy.has(key),
      end: (key) => {
        ended.push(key);
        running.delete(key);
      },
    });
    const scene = 'project-a';
    // The scene's own chat is never one of them.
    running.add(scene);
    ['wolf', 'fox', 'bird'].forEach((name) => {
      const key = animatorChatKey(scene, name);
      lifetime.used(key);
      running.add(key);
    });
    // The wolf is spoken to again: the fox is now the one used longest ago.
    lifetime.used(animatorChatKey(scene, 'wolf'));
    const deer = animatorChatKey(scene, 'deer');
    lifetime.used(deer);
    running.add(deer);
    busy.add(deer);
    lifetime.trim();
    expect(ended).toEqual([animatorChatKey(scene, 'fox')]);
    expect(running.has(scene)).toBe(true);
    // The control: within the limits, a trim ends nothing.
    lifetime.trim();
    expect(ended).toHaveLength(1);
  });

  it('reads a project’s animators apart from its scene chat and other projects', () => {
    const keys = [
      'project-a',
      animatorChatKey('project-a', 'wolf'),
      animatorChatKey('project-a', 'fox'),
      animatorChatKey('project-b', 'whale'),
    ];
    expect(
      animatorsIn('project-a', keys, (key) => key.endsWith('fox')),
    ).toEqual({ live: ['wolf', 'fox'], working: ['fox'] });
  });
});
