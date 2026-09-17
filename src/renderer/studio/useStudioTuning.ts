import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IScenePack } from 'common/scenePacks';
import {
  NEUTRAL_RESPONSE,
  RESPONSE_KEYS,
  isNeutralResponse,
  type ISceneResponse,
} from 'common/sceneResponse';
import {
  DEFAULT_SCENE_WAVE,
  isDefaultSceneWave,
  sameSceneWave,
  type ISceneWave,
} from 'common/sceneWave';
import type { ISceneTuning } from '../graph/useSceneRunner';
import type { IStudioBaseline } from './useStudioBaseline';

/** What the last save came to, for the card's line under its sliders. */
export type TTuningSaved = 'saving' | 'saved' | 'look' | 'failed' | undefined;

interface IPending {
  params: Record<string, number>;
  response?: ISceneResponse;
  wave?: ISceneWave;
}

const NOTHING_PENDING: IPending = { params: {} };

const valuesOf = (pack: IScenePack | undefined) =>
  Object.fromEntries(
    (pack?.params ?? []).map((param) => [param.id, param.value]),
  );

const sameResponse = (a: ISceneResponse, b: ISceneResponse) =>
  RESPONSE_KEYS.every((key) => Math.abs(a[key] - b[key]) < 1e-6);

/**
 * Where each control goes when Reset is pressed: the published version's
 * value for it, or — for a scene never published, and for a control the
 * published version did not have — the value the project was opened with.
 *
 * Clamped, because the two can disagree: an AI that narrowed a slider's range
 * since the scene was published would otherwise put a value outside it and
 * the slider would sit against one end showing a figure it cannot reach.
 */
const resetValues = (
  pack: IScenePack | undefined,
  published: Readonly<Record<string, number>> | undefined,
  opened: Readonly<Record<string, number>>,
): Record<string, number> =>
  Object.fromEntries(
    (pack?.params ?? []).map((param) => {
      const wanted = published?.[param.id] ?? opened[param.id] ?? param.value;
      const low = Math.min(param.min, param.max);
      const high = Math.max(param.min, param.max);
      return [param.id, Math.min(high, Math.max(low, wanted))];
    }),
  );

/**
 * The open scene's settings in the Studio: its own controls and how it
 * answers the music, live on the stage while a slider moves and written into
 * the scene's `pack.json` when it is let go — from where they reach the
 * member's look of it, an export and the gallery (see `studioSettings.ts`).
 *
 * What is on screen is the pack's values with the member's unsaved ones
 * over them. A new build of the scene lets go of every unsaved value it now
 * agrees with, so a save that lands does not make a slider jump back and
 * forward, and a value the member's AI changed in the meantime shows as the
 * AI left it.
 *
 * "Reset" goes back to the scene as it was last published — the version
 * listeners already have — so tuning a new one can always be undone to the
 * released look. With nothing published to go back to (`useStudioBaseline`),
 * it goes to the scene's own settings as the project was opened: its
 * controls where its author left them, and the response at neutral, as the
 * engine hears it.
 */
export default function useStudioTuning(
  pack: IScenePack | undefined,
  /** The open project: another starts from nothing unsaved. */
  project: string | undefined,
  /** What Reset goes back to, when the scene has been published. */
  baseline: IStudioBaseline,
) {
  const [pending, setPending] = useState<IPending>(NOTHING_PENDING);
  const [saved, setSaved] = useState<TTuningSaved>();
  const opened = useRef<{ project?: string; values: Record<string, number> }>({
    values: {},
  });

  useEffect(() => {
    setPending(NOTHING_PENDING);
    setSaved(undefined);
  }, [project]);

  useEffect(() => {
    if (!pack) {
      return;
    }
    if (opened.current.project !== project) {
      opened.current = { project, values: valuesOf(pack) };
    }
    const agreed = valuesOf(pack);
    const packResponse = pack.response ?? NEUTRAL_RESPONSE;
    setPending((current) => {
      const params = Object.fromEntries(
        Object.entries(current.params).filter(
          ([id, value]) => id in agreed && Math.abs(agreed[id] - value) > 1e-6,
        ),
      );
      const response =
        current.response && !sameResponse(current.response, packResponse)
          ? current.response
          : undefined;
      const packWave = pack.wave ?? DEFAULT_SCENE_WAVE;
      const wave =
        current.wave && !sameSceneWave(current.wave, packWave)
          ? current.wave
          : undefined;
      return {
        params,
        ...(response ? { response } : {}),
        ...(wave ? { wave } : {}),
      };
    });
  }, [pack, project]);

  const values = useMemo(
    () => ({ ...valuesOf(pack), ...pending.params }),
    [pack, pending.params],
  );
  const response = pending.response ?? pack?.response ?? NEUTRAL_RESPONSE;
  // Where the scene wants the wave: the member's unsaved choice, else what
  // the scene carries, else the graph's own full height on the bottom.
  const wave = pending.wave ?? pack?.wave ?? DEFAULT_SCENE_WAVE;
  const tuning = useMemo<ISceneTuning>(
    () => ({ params: values, response }),
    [values, response],
  );

  const setParam = useCallback((id: string, value: number) => {
    setPending((current) => ({
      ...current,
      params: { ...current.params, [id]: value },
    }));
  }, []);

  const setWave = useCallback(
    (next: ISceneWave) => setPending((current) => ({ ...current, wave: next })),
    [],
  );

  const setResponse = useCallback(
    (key: keyof ISceneResponse, value: number) => {
      setPending((current) => ({
        ...current,
        response: {
          ...(current.response ?? pack?.response ?? NEUTRAL_RESPONSE),
          [key]: value,
        },
      }));
    },
    [pack],
  );

  /** Writes what differs from the scene now; nothing when nothing does. */
  const write = useCallback(
    (next: IPending) => {
      const agreed = valuesOf(pack);
      const params = Object.fromEntries(
        Object.entries(next.params).filter(
          ([id, value]) => Math.abs((agreed[id] ?? value) - value) > 1e-6,
        ),
      );
      const packResponse = pack?.response ?? NEUTRAL_RESPONSE;
      const responseChanged =
        next.response !== undefined &&
        !sameResponse(next.response, packResponse);
      const packWave = pack?.wave ?? DEFAULT_SCENE_WAVE;
      const waveChanged =
        next.wave !== undefined && !sameSceneWave(next.wave, packWave);
      const send = window.electron?.ipcRenderer?.writeStudioSettings;
      if (
        (!Object.keys(params).length && !responseChanged && !waveChanged) ||
        !send
      ) {
        return;
      }
      setSaved('saving');
      send({
        ...(Object.keys(params).length ? { params } : {}),
        ...(responseChanged && next.response
          ? {
              response: isNeutralResponse(next.response) ? null : next.response,
            }
          : {}),
        // The full height on the bottom is what the graph does anyway: a
        // scene that asks for it asks for nothing, and says nothing.
        ...(waveChanged && next.wave
          ? {
              wave: isDefaultSceneWave(next.wave) ? null : next.wave,
            }
          : {}),
      })
        .then((outcome) => {
          if (outcome.written === 'failed') {
            setSaved('failed');
            return undefined;
          }
          setSaved(outcome.lookUpdated ? 'look' : 'saved');
          return undefined;
        })
        .catch(() => setSaved('failed'));
    },
    [pack],
  );

  const commit = useCallback(() => write(pending), [pending, write]);

  const published = baseline.settings;
  // Recomputed every render rather than memoised: it reads the values the
  // project was opened with, which live in a ref that a memo cannot watch,
  // and it is at most eight numbers.
  const paramsAtReset = resetValues(
    pack,
    published?.params,
    opened.current.values,
  );
  const responseAtReset = published?.response ?? NEUTRAL_RESPONSE;
  const waveAtReset = published?.wave ?? pack?.wave ?? DEFAULT_SCENE_WAVE;

  const resetParams = useCallback(() => {
    const next = { ...pending, params: { ...paramsAtReset } };
    setPending(next);
    write(next);
  }, [pending, paramsAtReset, write]);

  const resetResponse = useCallback(() => {
    const next = { ...pending, response: responseAtReset };
    setPending(next);
    write(next);
  }, [pending, responseAtReset, write]);

  const resetWave = useCallback(() => {
    const next = { ...pending, wave: waveAtReset };
    setPending(next);
    write(next);
  }, [pending, waveAtReset, write]);

  const paramsMoved = (pack?.params ?? []).some(
    (param) =>
      Math.abs((paramsAtReset[param.id] ?? param.value) - values[param.id]) >
      1e-6,
  );

  return {
    tuning,
    params: pack?.params ?? [],
    values,
    response,
    wave,
    saved,
    canResetParams: paramsMoved,
    canResetResponse: !sameResponse(response, responseAtReset),
    canResetWave: !sameSceneWave(wave, waveAtReset),
    /** The published version Reset goes back to, when there is one. */
    publishedVersion: baseline.version,
    setParam,
    setResponse,
    setWave,
    commit,
    resetParams,
    resetResponse,
    resetWave,
  };
}

/** The line a save leaves under the sliders. */
export const SAVED_KEYS: Record<
  Exclude<TTuningSaved, undefined>,
  TranslationKey
> = {
  saving: 'studio.settings.saving',
  saved: 'studio.settings.saved',
  look: 'studio.settings.savedLook',
  failed: 'studio.settings.failed',
};
