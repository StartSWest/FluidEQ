/**
 * An animation's animator is a chat of its own beside the scene's
 * (`chatTargets.ts`, `animatorHandlers.ts`, `startAnimatorTool.ts`): its own
 * key, so a message for one never reaches the other; only the open
 * project's; and the scene's chat can start one.
 */
import {
  animatorChatKey,
  chatAnimationOf,
  chatProjectOf,
} from '../../../common/studioChat';
import registerAnimatorHandlers from '../../../main/studioChat/animatorHandlers';
import { createChatTargets } from '../../../main/studioChat/chatTargets';
import { stepOf } from '../../../main/studioChat/chatStream';
import startAnimatorTool from '../../../main/studioChat/startAnimatorTool';
import type { TAgentProject } from '../../../main/studioAgent/agentProject';

const PROJECT = '0f8a7c2e-1b2c-4d5e-8f90-123456789abc';
const open: TAgentProject = {
  ok: true,
  id: PROJECT,
  folder: 'C:/Scenes/glacier',
} as TAgentProject;

describe("an animator chat's key", () => {
  it('names its project and its animation, and the scene chat names neither', () => {
    const key = animatorChatKey(PROJECT, 'wolf-walk');
    expect(key).not.toBe(PROJECT);
    expect(chatProjectOf(key)).toBe(PROJECT);
    expect(chatAnimationOf(key)).toBe('wolf-walk');
    expect(chatProjectOf(PROJECT)).toBe(PROJECT);
    expect(chatAnimationOf(PROJECT)).toBeUndefined();
  });
});

describe('the chat an action is on', () => {
  const targets = createChatTargets(() => open);

  it("is the scene's own, or an animator's in the same folder under a key of its own", () => {
    expect(targets.sceneChat()).toEqual({
      key: PROJECT,
      folder: open.ok ? open.folder : '',
    });
    expect(targets.animatorChat('wolf-walk')).toEqual({
      key: animatorChatKey(PROJECT, 'wolf-walk'),
      folder: 'C:/Scenes/glacier',
    });
  });

  it('is no chat at all for a name that is not one', () => {
    expect(targets.animatorChat('../escape')).toBeUndefined();
    expect(targets.animatorChat(undefined)).toBeUndefined();
    // A message for an animator with no name never falls back to the scene's.
    expect(targets.animatorOf({ text: 'hi' })).toBeUndefined();
  });

  it('is no chat when the message was meant for a project no longer open', () => {
    expect(
      targets.animatorOf({ animation: 'wolf-walk', projectId: 'another' }),
    ).toBeUndefined();
    expect(
      targets.animatorOf({ animation: 'wolf-walk', projectId: PROJECT }),
    ).toEqual({
      key: animatorChatKey(PROJECT, 'wolf-walk'),
      folder: 'C:/Scenes/glacier',
    });
  });

  it('is no chat with no project open', () => {
    const none = createChatTargets((): TAgentProject => ({
      ok: false,
      reason: 'none-open',
    }));
    expect(none.sceneChat()).toBeUndefined();
    expect(none.animatorChat('wolf-walk')).toBeUndefined();
  });
});

describe("the animators' channels", () => {
  it('are their own, and take a message back by name and id', () => {
    const channels = new Map<string, (arg: unknown) => unknown>();
    const unqueue = jest.fn();
    registerAnimatorHandlers({
      handle: (channel, _refused, listener) => {
        channels.set(channel, listener);
      },
      load: jest.fn(),
      send: jest.fn(),
      retry: jest.fn(),
      sendNow: jest.fn(),
      stop: jest.fn(),
      unqueue,
      restore: jest.fn(() => ({ ok: true }) as const),
    });
    expect([...channels.keys()].sort()).toEqual([
      'studio-animator-load',
      'studio-animator-restore',
      'studio-animator-retry',
      'studio-animator-send',
      'studio-animator-send-now',
      'studio-animator-stop',
      'studio-animator-unqueue',
    ]);
    channels.get('studio-animator-unqueue')?.({
      animation: 'wolf-walk',
      id: 'q1',
    });
    expect(unqueue).toHaveBeenCalledWith('wolf-walk', 'q1');
    channels.get('studio-animator-unqueue')?.({ animation: 'wolf-walk' });
    expect(unqueue).toHaveBeenCalledTimes(1);
    // A reply's version, brought back in the animator's own chat.
    expect(
      channels.get('studio-animator-restore')?.({
        animation: 'wolf-walk',
        entryId: 'r1',
      }),
    ).toEqual({ ok: true });
    expect(
      channels.get('studio-animator-restore')?.({ animation: 'wolf-walk' }),
    ).toEqual({
      ok: false,
      reason: 'failed',
    });
  });
});

describe("the scene's chat starting an animator", () => {
  it('hands the window the animation and the task', async () => {
    const start = jest.fn(() => true);
    const tool = startAnimatorTool({ start });
    const result = await tool.call({
      name: 'wolf-walk',
      task: ' A grey wolf walking right, 8 frames. ',
    });
    expect(result.isError).toBeUndefined();
    expect(start).toHaveBeenCalledWith(
      'wolf-walk',
      'A grey wolf walking right, 8 frames.',
    );
    expect(JSON.stringify(result.content)).toContain('wolf-walk');
  });

  it('refuses a name or a task it cannot use, and says when no window can take it', async () => {
    const start = jest.fn(() => true);
    const tool = startAnimatorTool({ start });
    expect((await tool.call({ name: 'Wolf Walk', task: 'x' })).isError).toBe(
      true,
    );
    expect((await tool.call({ name: 'wolf-walk', task: '  ' })).isError).toBe(
      true,
    );
    expect(start).not.toHaveBeenCalled();
    const closed = startAnimatorTool({ start: () => false });
    expect(
      (await closed.call({ name: 'wolf-walk', task: 'walk' })).isError,
    ).toBe(true);
  });

  it('shows in the chat as the animator started on that animation', () => {
    expect(
      stepOf('1', 'mcp__fluideq__start_animator', { name: 'wolf-walk' }),
    ).toEqual({
      id: '1',
      kind: 'animator',
      file: 'wolf-walk',
      state: 'running',
    });
  });
});
