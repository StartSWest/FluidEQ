import { SCENE_DAYLIGHT_PARAM } from 'common/sceneDaylight';
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
  /**
   * Over the pack's response, key by key: the Studio sends all four, the
   * graph's menu only the attack and release a listener moved.
   */
  response?: Readonly<Partial<ISceneResponse>>;
}

export interface ISceneTuner {
  /**
   * The frame the scene gets: `shaped` — what it heard, test signal and all
   * — through its response, one frame of `deltaMs` on, with its controls at
   * `base` (the pack's values) and the member's `tuning` over them, and its
   * time of day at `daylight` whatever either says (`sceneDaylight.ts`).
   */
  apply(
    shaped: ISceneFrame,
    deltaMs: number,
    pack: IScenePack | null,
    base: Record<string, number>,
    tuning: ISceneTuning | undefined,
    daylight?: number,
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

  let heardThrough: {
    own: ISceneResponse | undefined;
    chosen: Readonly<Partial<ISceneResponse>> | undefined;
    response: ISceneResponse;
  } = { own: undefined, chosen: undefined, response: NEUTRAL_RESPONSE };

  /** Made again only when the pack's response or the chosen one changes. */
  const responseOf = (
    pack: IScenePack | null,
    chosen: Readonly<Partial<ISceneResponse>> | undefined,
  ) => {
    const own = pack?.response;
    if (heardThrough.own !== own || heardThrough.chosen !== chosen) {
      heardThrough = {
        own,
        chosen,
        response: { ...(own ?? NEUTRAL_RESPONSE), ...chosen },
      };
    }
    return heardThrough.response;
  };

  return {
    apply: (shaped, deltaMs, pack, base, tuning, daylight) => {
      const response = responseOf(pack, tuning?.response);
      const heard = isNeutralResponse(response)
        ? shaped
        : {
            ...shaped,
            ...respond(shaped, response, state, deltaMs, answered),
          };
      const params = paramsOf(pack, base, tuning?.params);
      // The time of day is the window's, not a setting: a member's saved
      // value or the pack's own would hold the scene at one hour whatever
      // the Brightness said. Clamped to the control's own range.
      const clock =
        daylight === undefined
          ? undefined
          : pack?.params.find((param) => param.id === SCENE_DAYLIGHT_PARAM);
      return {
        ...heard,
        params:
          clock && daylight !== undefined
            ? {
                ...params,
                [clock.id]: Math.min(clock.max, Math.max(clock.min, daylight)),
              }
            : params,
        // What the scene keeps in view on a screen of another shape, which
        // the draw frames it by (`sceneFramingView.ts`): every frame that
        // reaches a scene comes through here, the live ones and the ones a
        // picture is made from, so every place draws it framed alike.
        ...(pack?.framing ? { framing: pack.framing } : {}),
      };
    },
    reset: () => {
      state = createResponseState(SPECTRUM_TEXELS);
    },
  };
};
