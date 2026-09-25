import {
  STUDIO_AGENT_SHAPES,
  type IStudioAgentDrawAsk,
  type TStudioAgentDrawAnswer,
} from 'common/studioAgent';
import { drawForAgentInWorker } from '../graph/sceneStillClient';
import { studioSpectrumRect } from './studioWave';

/**
 * The window's half of the member's AI looking at its scene: main has read
 * the project from its folder and checked it, and this draws it, off screen,
 * in the scene still worker — the same drawing the gallery's pictures and
 * the preview file come from, never a copy of whatever the stage shows.
 *
 * The page's visibility decides how the shader is waited for. A covered or
 * minimised window gets no animation frames, and the member is, by the
 * nature of this, usually looking at their AI rather than at FluidEQ.
 */
export const drawForAgent = async (
  ask: IStudioAgentDrawAsk,
): Promise<TStudioAgentDrawAnswer> => {
  const { width, height } = STUDIO_AGENT_SHAPES[ask.shape];
  const spectrumRect = studioSpectrumRect(ask.pack, ask.wave);
  const reply = await drawForAgentInWorker({
    pack: ask.pack,
    width,
    height,
    sound: ask.sound,
    ...(ask.seconds === undefined ? {} : { seconds: ask.seconds }),
    ...(ask.tempo === undefined ? {} : { tempo: ask.tempo }),
    spectrumRect,
    unseen: document.visibilityState === 'hidden',
    ...(ask.camera
      ? { camera: [ask.camera.yaw, ask.camera.pitch, ask.camera.zoom] }
      : {}),
    ...(ask.pointer ? { pointer: ask.pointer } : {}),
    ...(ask.tap ? { tap: ask.tap } : {}),
  });
  if (!reply) {
    return { ok: false, reason: 'unavailable' };
  }
  if (reply.refused) {
    return { ok: false, reason: reply.refused };
  }
  if (reply.log !== undefined) {
    return { ok: false, reason: 'compile', log: reply.log };
  }
  if (reply.hopeless) {
    return { ok: false, reason: 'too-heavy' };
  }
  if (
    !reply.image ||
    reply.drawMs === undefined ||
    reply.renderWidth === undefined ||
    reply.renderHeight === undefined ||
    reply.moment === undefined
  ) {
    // No context, or an artwork that would not decode: nothing about the
    // shader, and nothing it could change.
    return { ok: false, reason: 'unavailable' };
  }
  return {
    ok: true,
    image: new Uint8Array(await reply.image.arrayBuffer()),
    width,
    height,
    drawMs: reply.drawMs,
    renderWidth: reply.renderWidth,
    renderHeight: reply.renderHeight,
    spectrumRect,
    moment: reply.moment,
  };
};
