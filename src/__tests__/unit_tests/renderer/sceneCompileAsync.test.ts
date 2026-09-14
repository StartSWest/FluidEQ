import {
  linkSceneProgram,
  linksSettled,
} from '../../../renderer/graph/sceneCompile';

const COMPLETION = 0x91b1;
const callbacks: FrameRequestCallback[] = [];
const gl = {
  VERTEX_SHADER: 1,
  FRAGMENT_SHADER: 2,
  LINK_STATUS: 3,
  getExtension: jest.fn(),
  createShader: jest.fn(() => ({})),
  createProgram: jest.fn(() => ({})),
  shaderSource: jest.fn(),
  compileShader: jest.fn(),
  attachShader: jest.fn(),
  linkProgram: jest.fn(),
  getProgramParameter: jest.fn(),
  getShaderParameter: jest.fn(),
  getShaderInfoLog: jest.fn(),
  getProgramInfoLog: jest.fn(),
  deleteShader: jest.fn(),
  deleteProgram: jest.fn(),
  isContextLost: () => false,
};
beforeEach(() => {
  jest.clearAllMocks();
  callbacks.length = 0;
  gl.getExtension.mockReturnValue({ COMPLETION_STATUS_KHR: COMPLETION });
  gl.getProgramParameter.mockReturnValue(false);
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

it('yields while linking and queries status only once the driver reports completion', async () => {
  const linking = linkSceneProgram(
    gl as unknown as WebGL2RenderingContext,
    'source',
    0,
  );
  expect(gl.getProgramParameter.mock.calls.map((call) => call[1])).toEqual([
    COMPLETION,
  ]);
  expect(gl.getShaderParameter).not.toHaveBeenCalled();
  expect(callbacks).toHaveLength(1);
  gl.getProgramParameter.mockReturnValue(true);
  callbacks[0](16);
  await expect(linking).resolves.toMatchObject({ ok: true });
  expect(gl.getProgramParameter.mock.calls.map((call) => call[1])).toEqual([
    COMPLETION,
    COMPLETION,
    gl.LINK_STATUS,
  ]);
  expect(gl.deleteProgram).not.toHaveBeenCalled();
});

it('gives up on an obsolete compilation, deleting its program only once the link finishes', async () => {
  const controller = new AbortController();
  const linking = linkSceneProgram(
    gl as unknown as WebGL2RenderingContext,
    'source',
    0,
    controller.signal,
  );
  controller.abort();
  await expect(linking).rejects.toMatchObject({ name: 'AbortError' });
  expect(gl.deleteShader).toHaveBeenCalledTimes(2);
  expect(window.cancelAnimationFrame).toHaveBeenCalled();
  // Deleting a program mid-link blocks the GPU process for the whole link.
  expect(gl.deleteProgram).not.toHaveBeenCalled();
  let settled = false;
  const waiting = linksSettled().then(() => {
    settled = true;
    return undefined;
  });
  await Promise.resolve();
  expect(settled).toBe(false);

  gl.getProgramParameter.mockReturnValue(true);
  callbacks[callbacks.length - 1](32);
  await waiting;
  expect(gl.deleteProgram).toHaveBeenCalledTimes(1);
  expect(settled).toBe(true);
});

it('deletes a failed program at once when its link had already finished', async () => {
  gl.getProgramParameter.mockImplementation(
    (_program: unknown, parameter: number) => parameter === COMPLETION,
  );
  gl.getShaderInfoLog.mockReturnValue('ERROR: 0:9: bad');
  const result = await linkSceneProgram(
    gl as unknown as WebGL2RenderingContext,
    'source',
    4,
  );
  expect(result).toMatchObject({ ok: false, log: 'ERROR: 0:5: bad' });
  expect(gl.deleteProgram).toHaveBeenCalledTimes(1);
  await expect(linksSettled()).resolves.toBeUndefined();
});
