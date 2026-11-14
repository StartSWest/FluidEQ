import { startLightingHost } from '../../../main/lighting/lightingHost';

const spawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawn(...args),
}));

describe('a lighting helper Windows refuses to start', () => {
  beforeEach(() => spawn.mockReset());

  it('reports the failure after the call returns, with the host already kept', async () => {
    spawn.mockImplementation(() => {
      throw new Error('spawn UNKNOWN');
    });
    const seen: string[] = [];
    // The caller's pattern (lightingService): the exit handler reads the
    // const it is being assigned to. Reported during the call, this threw.
    const started = startLightingHost(
      'FluidEQ-Lighting.exe',
      () => undefined,
      (detail) => seen.push(`${detail} on ${String(started.pid)}`),
    );
    expect(seen).toEqual([]);
    await Promise.resolve();
    expect(seen).toEqual(['spawn UNKNOWN on undefined']);
  });

  it('reports nothing when the helper starts', async () => {
    const on = jest.fn();
    spawn.mockReturnValue({
      pid: 7,
      stdout: { on },
      stderr: { on },
      stdin: { on, write: jest.fn(), end: jest.fn() },
      on,
      once: on,
      kill: jest.fn(),
    });
    const onExit = jest.fn();
    const started = startLightingHost(
      'FluidEQ-Lighting.exe',
      () => undefined,
      onExit,
    );
    await Promise.resolve();
    expect(started.pid).toBe(7);
    expect(onExit).not.toHaveBeenCalled();
  });
});
