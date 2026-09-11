import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IScenePack } from 'common/scenePacks';
import {
  NEUTRAL_RESPONSE,
  RESPONSE_KEYS,
  isNeutralResponse,
  type ISceneResponse,
} from 'common/sceneResponse';
import type { ISceneTuning } from '../graph/useSceneRunner';

/** What the last save came to, for the card's line under its sliders. */
export type TTuningSaved = 'saving' | 'saved' | 'look' | 'failed' | undefined;

interface IPending {
  params: Record<string, number>;
  response?: ISceneResponse;
}

const NOTHING_PENDING: IPending = { params: {} };

const valuesOf = (pack: IScenePack | undefined) =>
  Object.fromEntries(
    (pack?.params ?? []).map((param) => [param.id, param.value]),
  );

const sameResponse = (a: ISceneResponse, b: ISceneResponse) =>
  RESPONSE_KEYS.every((key) => Math.abs(a[key] - b[key]) < 1e-6);

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
 * "Reset" on the scene's controls goes back to where they were when the
 * project was opened in this session; on the response, to neutral — as the
 * engine hears it.
 */
export default function useStudioTuning(
  pack: IScenePack | undefined,
  /** The open project: another starts from nothing unsaved. */
  project: string | undefined,
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
      return { params, ...(response ? { response } : {}) };
    });
  }, [pack, project]);

  const values = useMemo(
    () => ({ ...valuesOf(pack), ...pending.params }),
    [pack, pending.params],
  );
  const response = pending.response ?? pack?.response ?? NEUTRAL_RESPONSE;
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
      const send = window.electron?.ipcRenderer?.writeStudioSettings;
      if ((!Object.keys(params).length && !responseChanged) || !send) {
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

  const resetParams = useCallback(() => {
    const next = { ...pending, params: { ...opened.current.values } };
    setPending(next);
    write(next);
  }, [pending, write]);

  const resetResponse = useCallback(() => {
    const next = { ...pending, response: NEUTRAL_RESPONSE };
    setPending(next);
    write(next);
  }, [pending, write]);

  const paramsMoved = (pack?.params ?? []).some(
    (param) =>
      Math.abs(
        (opened.current.values[param.id] ?? param.value) - values[param.id],
      ) > 1e-6,
  );

  return {
    tuning,
    params: pack?.params ?? [],
    values,
    response,
    saved,
    canResetParams: paramsMoved,
    canResetResponse: !isNeutralResponse(response),
    setParam,
    setResponse,
    commit,
    resetParams,
    resetResponse,
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
