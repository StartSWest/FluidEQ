/** @jest-environment node */
import { EventEmitter } from 'events';
import type { IpcMainInvokeEvent } from 'electron';
import withRendererOperation from '../../../main/rendererOperation';

it('cancels work owned by the previous document and releases listeners', async () => {
  const frame = { isDestroyed: () => false };
  const sender = Object.assign(new EventEmitter(), {
    mainFrame: frame,
    isDestroyed: () => false,
  });
  const event = { sender, senderFrame: frame } as unknown as IpcMainInvokeEvent;
  const result = withRendererOperation(event, async (assertCurrent, signal) => {
    assertCurrent();
    sender.emit('did-start-navigation', {}, '#tab', true, true);
    expect(signal.aborted).toBe(false);
    sender.emit('did-start-navigation', {}, 'child', false, false);
    expect(signal.aborted).toBe(false);
    sender.emit('did-start-navigation', {}, 'about:blank', false, true);
    expect(signal.aborted).toBe(true);
    assertCurrent();
    return 'unreachable';
  });
  await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  expect(sender.eventNames()).toEqual([]);
  await expect(
    withRendererOperation(event, async (assertCurrent) => {
      assertCurrent();
      return 'new document works';
    }),
  ).resolves.toBe('new document works');
});
