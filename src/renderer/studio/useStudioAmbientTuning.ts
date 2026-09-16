/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IAmbientParam } from 'common/sceneAmbient';
import type { IScenePack } from 'common/scenePacks';
import { setStudioAmbientValues } from '../ambient/ambientStore';
import type { IStudioBaseline } from './useStudioBaseline';

const valuesOf = (pack: IScenePack | undefined): Record<string, number> =>
  Object.fromEntries(
    (pack?.ambient?.params ?? []).map((param) => [param.id, param.value]),
  );

const differs = (a: number | undefined, b: number) =>
  a === undefined || Math.abs(a - b) > 1e-6;

export interface IStudioAmbientTuning {
  params: readonly IAmbientParam[];
  values: Readonly<Record<string, number>>;
  canReset: boolean;
  setValue: (id: string, value: number) => void;
  commit: () => void;
  reset: () => void;
}

/**
 * The open scene's ambient controls in the Studio (`sceneAmbient.ts`): the
 * window's elements follow them while they move (`ambientStore.ts`), and
 * letting go writes them into the scene's `pack.json` beside its own
 * controls — the same way, and through the same write, as those.
 *
 * "Reset" goes back to the scene as it was last published, and to where they
 * stood when the project was opened for a scene that never was — the same
 * thing its own controls go back to (`useStudioTuning.ts`).
 */
export default function useStudioAmbientTuning(
  pack: IScenePack | undefined,
  project: string | undefined,
  baseline: IStudioBaseline,
): IStudioAmbientTuning {
  const [pending, setPending] = useState<Record<string, number>>({});
  const opened = useRef<{ project?: string; values: Record<string, number> }>({
    values: {},
  });

  useEffect(() => {
    setPending({});
  }, [project]);

  useEffect(() => {
    if (!pack) {
      return;
    }
    if (opened.current.project !== project) {
      opened.current = { project, values: valuesOf(pack) };
    }
    // A build that agrees with an unsaved value lets it go, so a save that
    // lands does not make the slider jump back and forward.
    const agreed = valuesOf(pack);
    setPending((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([id, value]) => id in agreed && differs(agreed[id], value),
        ),
      ),
    );
  }, [pack, project]);

  const values = useMemo(
    () => ({ ...valuesOf(pack), ...pending }),
    [pack, pending],
  );

  useEffect(() => {
    setStudioAmbientValues(values);
  }, [values]);
  useEffect(() => () => setStudioAmbientValues(undefined), []);

  const setValue = useCallback((id: string, value: number) => {
    setPending((current) => ({ ...current, [id]: value }));
  }, []);

  const write = useCallback(
    (next: Record<string, number>) => {
      const agreed = valuesOf(pack);
      const changed = Object.fromEntries(
        Object.entries(next).filter(([id, value]) =>
          differs(agreed[id], value),
        ),
      );
      const send = window.electron?.ipcRenderer?.writeStudioSettings;
      if (Object.keys(changed).length === 0 || !send) {
        return;
      }
      send({ ambient: changed }).catch(() => undefined);
    },
    [pack],
  );

  const commit = useCallback(() => write(pending), [pending, write]);

  const params = pack?.ambient?.params ?? [];
  const published = baseline.settings?.ambient;
  // Every one of these is 0..1, so the published value needs no clamping the
  // way a scene's own control does.
  const atReset = Object.fromEntries(
    params.map((param) => [
      param.id,
      published?.[param.id] ?? opened.current.values[param.id] ?? param.value,
    ]),
  );

  // Not memoised: `atReset` is a fresh object on every render, so a memo
  // would be rebuilt every render anyway.
  const reset = () => {
    setPending(atReset);
    write(atReset);
  };

  return {
    params,
    values,
    canReset: params.some((param) =>
      differs(atReset[param.id], values[param.id] ?? param.value),
    ),
    setValue,
    commit,
    reset,
  };
}
