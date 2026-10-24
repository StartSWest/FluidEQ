/* FluidEQ — GPL-3.0-or-later */
import createSystemVolumeCommands from '../../../main/systemVolumeCommands';

it('abandons a drag on output switch and accepts the new output immediately', () => {
  const write = jest.fn();
  const deliver = jest.fn();
  const commands = createSystemVolumeCommands(write, deliver);
  commands.accept('ready\t2');
  commands.accept('volume\t0.5000\t0\t1\t1\t73');
  const originalSession = deliver.mock.calls[0][0].sessionId;
  commands.enqueue({ kind: 'set', line: 'set 0.7 73', requestId: 'old' });
  commands.enqueue({ kind: 'set', line: 'set 0.9 73', requestId: 'queued' });
  commands.accept('volume\t-\t-\t0\t0\t74');
  expect(deliver).toHaveBeenLastCalledWith(
    expect.objectContaining({
      deviceId: '74',
      canSetLevel: false,
      canMute: false,
      sessionId: expect.not.stringMatching(originalSession),
    }),
  );
  commands.accept('applied\t-\t-\t0\t0\t74');
  expect(write.mock.calls).toEqual([['set 0.7 73']]);
  expect(deliver.mock.calls.slice(-1)[0]?.[0].appliedRequestId).toBeUndefined();
});

it('drains an old output write before acknowledging a new output drag', () => {
  const write = jest.fn();
  const deliver = jest.fn();
  const commands = createSystemVolumeCommands(write, deliver);
  commands.accept('ready\t2');
  commands.accept('volume\t0.5000\t0\t1\t1\t73');
  commands.enqueue({ kind: 'set', line: 'set 0.7 73', requestId: 'old' });
  commands.accept('volume\t0.3000\t0\t1\t1\t74');
  commands.enqueue({ kind: 'set', line: 'set 0.6 74', requestId: 'new' });
  expect(write.mock.calls).toEqual([['set 0.7 73']]);
  commands.accept('applied\t0.3000\t0\t1\t1\t74');
  expect(deliver.mock.calls.slice(-1)[0]?.[0].appliedRequestId).toBeUndefined();
  expect(write.mock.calls).toEqual([['set 0.7 73'], ['set 0.6 74']]);
  commands.accept('applied\t0.6000\t0\t1\t1\t74');
  expect(deliver).toHaveBeenLastCalledWith(
    expect.objectContaining({ level: 0.6, appliedRequestId: 'new' }),
  );
});

it('waits for the actual OS result and skips superseded drag positions', () => {
  const write = jest.fn();
  const deliver = jest.fn();
  const commands = createSystemVolumeCommands(write, deliver);
  commands.accept('ready\t2');
  commands.accept('volume\t0.5000\t0');
  deliver.mockClear();
  commands.enqueue({ kind: 'set', line: 'set 0.2000', requestId: 'first' });
  commands.enqueue({ kind: 'set', line: 'set 0.4000', requestId: 'middle' });
  commands.enqueue({ kind: 'set', line: 'set 0.8000', requestId: 'last' });
  expect(write.mock.calls).toEqual([['set 0.2000']]);
  commands.accept('volume\t0.1000\t0');
  expect(deliver).not.toHaveBeenCalled();
  commands.accept('applied\t0.2000\t0');
  expect(write.mock.calls).toEqual([['set 0.2000'], ['set 0.8000']]);
  expect(deliver).toHaveBeenLastCalledWith(
    expect.objectContaining({ appliedRequestId: 'first' }),
  );
  commands.accept('applied\t0.7969\t0'); // A driver quantizes the requested level.
  expect(deliver).toHaveBeenLastCalledWith(
    expect.objectContaining({ level: 0.7969, appliedRequestId: 'last' }),
  );
  commands.accept('volume\t0.6000\t1'); // A later taskbar/keyboard change follows normally.
  expect(deliver).toHaveBeenLastCalledWith(
    expect.objectContaining({ level: 0.6, isMuted: true }),
  );
});

it('keeps mute and level changes in user order without losing either', () => {
  const write = jest.fn();
  const commands = createSystemVolumeCommands(write, jest.fn());
  commands.accept('ready\t2');
  commands.enqueue({ kind: 'set', line: 'set 0.2000' });
  commands.enqueue({ kind: 'set', line: 'set 0.4000' });
  commands.enqueue({ kind: 'mute', line: 'mute 0' });
  commands.enqueue({ kind: 'set', line: 'set 0.7000' });
  commands.accept('applied\t0.2000\t1');
  expect(write).toHaveBeenLastCalledWith('mute 0');
  commands.accept('applied\t0.2000\t0');
  expect(write).toHaveBeenLastCalledWith('set 0.7000');
  expect(write).not.toHaveBeenCalledWith('set 0.4000');
});

it('retains the legacy protocol and changes session after helper replacement', () => {
  const write = jest.fn();
  const deliver = jest.fn();
  const commands = createSystemVolumeCommands(write, deliver);
  commands.enqueue({ kind: 'set', line: 'set 0.2000' });
  commands.accept('volume\t0.2000\t0');
  expect(deliver).toHaveBeenLastCalledWith({ level: 0.2, isMuted: false });
  commands.accept('ready\t2');
  commands.accept('volume\t0.2000\t0');
  const { sessionId } = deliver.mock.calls[1][0];
  commands.enqueue({ kind: 'set', line: 'set 0.4000', requestId: 'abandoned' });
  commands.reset();
  commands.accept('ready\t2');
  commands.accept('volume\t0.3000\t0');
  expect(deliver).toHaveBeenLastCalledWith(
    expect.objectContaining({
      level: 0.3,
      sessionId: expect.not.stringMatching(sessionId),
    }),
  );
});
