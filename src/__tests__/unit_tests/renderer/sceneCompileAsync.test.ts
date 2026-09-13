import { linkSceneProgram } from '../../../renderer/graph/sceneCompile';

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

it('cancels an obsolete compilation and releases its GPU objects', async () => {
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
  expect(gl.deleteProgram).toHaveBeenCalledTimes(1);
  expect(window.cancelAnimationFrame).toHaveBeenCalled();
});
