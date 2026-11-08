import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IScenePack } from 'common/scenePacks';
import {
  paletteValueOf,
  samePalette,
  type IScenePaletteValue,
} from 'common/scenePalette';
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
import { markStarterStep } from './studioStarterGuide';
import type { IStudioBaseline } from './useStudioBaseline';

/** What the last save came to, for the card's line under its sliders. */
export type TTuningSaved = 'saving' | 'saved' | 'look' | 'failed' | undefined;

type TPalettes = Record<string, IScenePaletteValue>;

interface IPending {
  params: Record<string, number>;
  /** Palettes the member changed and the scene does not have yet. */
  palettes?: TPalettes;
  /** Single colours likewise, `#rrggbb` by id. */
  colours?: Record<string, string>;
  response?: ISceneResponse;
  wave?: ISceneWave;
}

const NOTHING_PENDING: IPending = { params: {} };

const valuesOf = (pack: IScenePack | undefined) =>
  Object.fromEntries(
    (pack?.params ?? []).map((param) => [param.id, param.value]),
  );

/** The scene's palettes as it has them now, by id. */
const palettesOf = (pack: IScenePack | undefined): TPalettes =>
  Object.fromEntries(
    (pack?.palettes ?? []).map((palette) => [
      palette.id,
      paletteValueOf(palette),
    ]),
  );

/** The scene's single colours as it has them now, by id. */
const coloursOf = (pack: IScenePack | undefined): Record<string, string> =>
  Object.fromEntries(
    (pack?.colours ?? []).map((colour) => [colour.id, colour.value]),
  );

/** The pending colours the scene does not already agree with. */
const unagreedColours = (
  pending: Record<string, string> | undefined,
  agreed: Record<string, string>,
): Record<string, string> | undefined => {
  const left = Object.entries(pending ?? {}).filter(
    ([id, value]) => id in agreed && agreed[id] !== value,
  );
  return left.length ? Object.fromEntries(left) : undefined;
};

/** The pending palettes the scene does not already agree with. */
const unagreed = (
  pending: TPalettes | undefined,
  agreed: TPalettes,
): TPalettes | undefined => {
  const left = Object.entries(pending ?? {}).filter(
    ([id, value]) => id in agreed && !samePalette(agreed[id], value),
  );
  return left.length ? Object.fromEntries(left) : undefined;
};

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
  const opened = useRef<{
    project?: string;
    values: Record<string, number>;
    palettes: TPalettes;
    colours: Record<string, string>;
    wave?: ISceneWave;
  }>({
    values: {},
    palettes: {},
    colours: {},
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
      opened.current = {
        project,
        values: valuesOf(pack),
        palettes: palettesOf(pack),
        colours: coloursOf(pack),
        ...(pack.wave ? { wave: pack.wave } : {}),
      };
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
      const palettes = unagreed(current.palettes, palettesOf(pack));
      const colours = unagreedColours(current.colours, coloursOf(pack));
      return {
        params,
        ...(palettes ? { palettes } : {}),
        ...(colours ? { colours } : {}),
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
  const palettes = useMemo(
    () => ({ ...palettesOf(pack), ...pending.palettes }),
    [pack, pending.palettes],
  );
  const colours = useMemo(
    () => ({ ...coloursOf(pack), ...pending.colours }),
    [pack, pending.colours],
  );
  const tuning = useMemo<ISceneTuning>(
    () => ({ params: values, response, palettes, colours }),
    [values, response, palettes, colours],
  );

  const setParam = useCallback(
    (id: string, value: number) => {
      // "Move a dial", on a new project's guide (`studioStarterGuide.ts`).
      markStarterStep(project, 'dial');
      setPending((current) => ({
        ...current,
        params: { ...current.params, [id]: value },
      }));
    },
    [project],
  );

  /** A palette as the member has it now: on the stage at once, saved on commit. */
  const setPalette = useCallback(
    (id: string, value: IScenePaletteValue) => {
      markStarterStep(project, 'dial');
      setPending((current) => ({
        ...current,
        palettes: { ...current.palettes, [id]: value },
      }));
    },
    [project],
  );

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
      const palettes = unagreed(next.palettes, palettesOf(pack));
      const colours = unagreedColours(next.colours, coloursOf(pack));
      const send = window.electron?.ipcRenderer?.writeStudioSettings;
      if (
        (!Object.keys(params).length &&
          !responseChanged &&
          !waveChanged &&
          !palettes &&
          !colours) ||
        !send
      ) {
        return;
      }
      setSaved('saving');
      send({
        ...(Object.keys(params).length ? { params } : {}),
        ...(palettes ? { palettes } : {}),
        ...(colours ? { colours } : {}),
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
  // Where Reset puts the wave: the published version's, else the one the
  // project was opened with — not the pack's own, which is whatever the last
  // save wrote, so Reset would have had nothing to go back to the moment a
  // wave was saved. The same rule the controls follow.
  const waveAtReset =
    published?.wave ?? opened.current.wave ?? DEFAULT_SCENE_WAVE;

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

  // Where a palette's Reset puts it: the published version's colours, else
  // the ones the project was opened with - the scene's own, before the
  // member's edits - the same rule the controls follow.
  const paletteAtReset = (id: string): IScenePaletteValue | undefined =>
    published?.palettes?.[id] ??
    opened.current.palettes[id] ??
    palettesOf(pack)[id];

  const resetPalette = (id: string) => {
    const back = paletteAtReset(id);
    if (!back) {
      return;
    }
    const next = { ...pending, palettes: { ...pending.palettes, [id]: back } };
    setPending(next);
    write(next);
  };

  /** A choice picked: on the stage and saved in one go, as a let-go is. */
  const chooseParam = (id: string, value: number) => {
    markStarterStep(project, 'dial');
    const next = { ...pending, params: { ...pending.params, [id]: value } };
    setPending(next);
    write(next);
  };

  /** A palette changed and saved in one go: a preset, a reverse, a stop removed. */
  const choosePalette = (id: string, value: IScenePaletteValue) => {
    const next = { ...pending, palettes: { ...pending.palettes, [id]: value } };
    setPending(next);
    write(next);
  };

  /** A single colour as the member picks it: on the stage at once. */
  const setColour = (id: string, value: string) => {
    markStarterStep(project, 'dial');
    setPending((current) => ({
      ...current,
      colours: { ...current.colours, [id]: value },
    }));
  };

  /** A single colour settled: on the stage and saved. */
  const chooseColour = (id: string, value: string) => {
    const next = { ...pending, colours: { ...pending.colours, [id]: value } };
    setPending(next);
    write(next);
  };

  // Where a colour's Reset puts it: the published version's, else the one
  // the project was opened with, as the other controls go.
  const colourAtReset = (id: string): string | undefined =>
    published?.colours?.[id] ??
    opened.current.colours[id] ??
    coloursOf(pack)[id];

  const resetColour = (id: string) => {
    const back = colourAtReset(id);
    if (back) {
      chooseColour(id, back);
    }
  };

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
    /** The scene's palettes, and their colours as the member has them. */
    paletteParams: pack?.palettes ?? [],
    palettes,
    canResetPalette: (id: string) => {
      const back = paletteAtReset(id);
      return back !== undefined && palettes[id] !== undefined
        ? !samePalette(back, palettes[id])
        : false;
    },
    setPalette,
    choosePalette,
    resetPalette,
    /** The scene's single colours, and their values as the member has them. */
    colourParams: pack?.colours ?? [],
    colours,
    canResetColour: (id: string) => {
      const back = colourAtReset(id);
      return back !== undefined && colours[id] !== undefined
        ? back !== colours[id]
        : false;
    },
    setColour,
    chooseColour,
    resetColour,
    response,
    wave,
    saved,
    canResetParams: paramsMoved,
    canResetResponse: !sameResponse(response, responseAtReset),
    canResetWave: !sameSceneWave(wave, waveAtReset),
    /** The published version Reset goes back to, when there is one. */
    publishedVersion: baseline.version,
    setParam,
    chooseParam,
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
