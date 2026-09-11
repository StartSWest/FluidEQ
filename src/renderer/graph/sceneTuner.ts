import type { IScenePack } from 'common/scenePacks';
import {
  NEUTRAL_RESPONSE,
  createResponseState,
  isNeutralResponse,
  respond,
  type ISceneResponse,
} from 'common/sceneResponse';
import { SPECTRUM_TEXELS } from 'common/sceneUniformContract';
import type { ISceneFrame } from './sceneGl';
import { createSpectrumTexels, createWaveformTexels } from './sceneUniforms';

/**
 * A scene as a member set it up, over what its pack says: values for its own
 * controls, and how it answers the music. Either may be absent, and so may
 * any one control — the pack's own value stands for what is not given.
 */
export interface ISceneTuning {
  /** By param id; one the scene does not have is ignored, each is clamped. */
  params?: Readonly<Record<string, number>>;
  response?: ISceneResponse;
}

export interface ISceneTuner {
  /**
   * The frame the scene gets: `shaped` — what it heard, test signal and all
   * — through its response, one frame of `deltaMs` on, with its controls at
   * `base` (the pack's values) and the member's `tuning` over them.
   */
  apply(
    shaped: ISceneFrame,
    deltaMs: number,
    pack: IScenePack | null,
    base: Record<string, number>,
    tuning: ISceneTuning | undefined,
  ): ISceneFrame;
  /** Forgets where the response had got to: a different scene starts clean. */
  reset(): void;
}

/**
 * One scene's tuning, frame by frame, for the runner. The response comes
 * after the test signal, so a member can see what the threshold does to a
 * bass line without hunting for one; it writes into buffers of its own, so a
 * test signal's buffers are never bent in place; and the merged control
 * values are made again only when the pack's or the member's change.
 */
export const createSceneTuner = (): ISceneTuner => {
  let state = createResponseState(SPECTRUM_TEXELS);
  const answered = {
    spectrum: createSpectrumTexels(),
    waveform: createWaveformTexels(),
  };
  let merged: {
    base: Record<string, number> | undefined;
    overrides: Readonly<Record<string, number>> | undefined;
    params: Record<string, number>;
  } = { base: undefined, overrides: undefined, params: {} };

  const paramsOf = (
    pack: IScenePack | null,
    base: Record<string, number>,
    overrides: Readonly<Record<string, number>> | undefined,
  ) => {
    if (merged.base === base && merged.overrides === overrides) {
      return merged.params;
    }
    const params = { ...base };
    pack?.params.forEach((param) => {
      const value = overrides?.[param.id];
      if (typeof value === 'number' && Number.isFinite(value)) {
        params[param.id] = Math.min(param.max, Math.max(param.min, value));
      }
    });
    merged = { base, overrides, params };
    return params;
  };

  return {
    apply: (shaped, deltaMs, pack, base, tuning) => {
      const response = tuning?.response ?? pack?.response ?? NEUTRAL_RESPONSE;
      const heard = isNeutralResponse(response)
        ? shaped
        : {
            ...shaped,
            ...respond(shaped, response, state, deltaMs, answered),
          };
      return { ...heard, params: paramsOf(pack, base, tuning?.params) };
    },
    reset: () => {
      state = createResponseState(SPECTRUM_TEXELS);
    },
  };
};
