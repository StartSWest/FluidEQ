/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ANIMATION_NAME,
  readStudioAnimation,
  type IStudioAnimation,
  type TAnimationGround,
} from 'common/studioAnimation';
import type { IGrid } from 'common/sheetGrid';
import { viewOf, type IViewedAnimation } from '../useStudioAnimations';
import {
  decodeImport,
  gridFrames,
  type IDecodedImport,
  type TDecodeRefusal,
} from './importDecode';
import {
  animationNameFrom,
  importKindOf,
  type IChosenFile,
  type TImportKind,
  type TImportRefusal,
} from './importFiles';
import { composeSheet, type IComposedSheet } from './importSheet';
import { importTiming, type IImportTiming } from './importTiming';

/**
 * An import in the Animations tab, from the files chosen to the
 * animations ready to add: each one's name, whether it is added, whether it
 * loops, and the speed and ground the member left its preview on - what is
 * seen playing is what is added.
 */

export interface IImportClipChoice {
  name: string;
  include: boolean;
  loop: boolean;
  /** The preview's speed, once the member has played it; the file's otherwise. */
  fps?: number;
  ground?: TAnimationGround;
}

export type TImportState =
  | { phase: 'reading'; file: string }
  | { phase: 'refused'; refusal: TImportRefusal | TDecodeRefusal }
  | {
      phase: 'ready';
      kind: TImportKind['kind'];
      decoded: IDecodedImport;
      choices: IImportClipChoice[];
    };

/** What a scene's animation is when nothing says otherwise. */
const DEFAULTS: IStudioAnimation = (() => {
  const read = readStudioAnimation('animation', { sheet: 'art/animation.png' });
  if (!read) {
    throw new Error('the default animation did not read');
  }
  return read;
})();

/**
 * The file the animation is named after. A sequence's frames are numbered
 * (walk_01.png, walk_02.png): its name is theirs without the number.
 */
const nameSourceOf = (kind: TImportKind) =>
  kind.kind === 'sequence'
    ? kind.pictures[0].name.replace(/[\s_.-]*\d+(\.[^.]*)?$/, '$1')
    : kind.picture.name;

/** The first file read, as the member named it, for what is said of it. */
const firstFileOf = (kind: TImportKind) =>
  kind.kind === 'sequence' ? kind.pictures[0].name : kind.picture.name;

/** A clip's frames as the scene plays them: its cells and its speed. */
export const clipTiming = (
  decoded: IDecodedImport,
  clip: number,
): IImportTiming | undefined => {
  const found = decoded.clips[clip];
  return found
    ? importTiming(
        found.order,
        decoded.frames.map(({ duration }) => duration),
      )
    : undefined;
};

/** The animation as it would be written for `choice`. */
export const clipAnimation = (
  choice: IImportClipChoice,
  timing: IImportTiming,
  sheet: IComposedSheet,
): IStudioAnimation | undefined =>
  readStudioAnimation(
    ANIMATION_NAME.test(choice.name) ? choice.name : 'animation',
    {
      sheet: `art/${choice.name}.png`,
      count: sheet.count,
      columns: sheet.layout.columns,
      fps: choice.fps ?? timing.fps,
      loop: choice.loop,
      ground: choice.ground ?? DEFAULTS.ground,
    },
  );

/** A still sheet's frames again, for the grid the member set. */
export const regrid = (
  decoded: IDecodedImport,
  grid: IGrid,
  count: number,
): IDecodedImport => {
  const frames = gridFrames(
    decoded.image.width,
    decoded.image.height,
    grid,
    count,
  );
  return {
    ...decoded,
    frames,
    clips: [{ name: '', order: frames.map((_, index) => index) }],
    width: frames[0].source.w,
    height: frames[0].source.h,
    grid,
  };
};

export default function useAnimationImport(
  files: readonly IChosenFile[],
  /** The scene's animations' names, which an import never takes. */
  taken: ReadonlySet<string>,
) {
  const kind = useMemo(() => importKindOf(files), [files]);
  // Read when the files are decoded: a name the member then types is
  // checked against the names where it is typed.
  const takenRef = useRef(taken);
  takenRef.current = taken;
  const [state, setState] = useState<TImportState>(() =>
    'refused' in kind
      ? { phase: 'refused', refusal: kind }
      : { phase: 'reading', file: firstFileOf(kind) },
  );

  useEffect(() => {
    if ('refused' in kind) {
      return undefined;
    }
    let live = true;
    let decoded: IDecodedImport | undefined;
    decodeImport(kind)
      .then((result) => {
        if ('refused' in result) {
          if (live) {
            setState({ phase: 'refused', refusal: result });
          }
          return undefined;
        }
        decoded = result;
        if (!live) {
          result.close();
          return undefined;
        }
        const base = nameSourceOf(kind);
        const names = new Set(takenRef.current);
        const choices = result.clips.map(({ name }) => {
          const chosen = animationNameFrom(
            name ? `${base.replace(/\.[^.]*$/, '')}-${name}` : base,
            names,
          );
          names.add(chosen);
          return { name: chosen, include: true, loop: DEFAULTS.loop };
        });
        setState({ phase: 'ready', kind: kind.kind, decoded: result, choices });
        return undefined;
      })
      .catch(() => {
        if (live) {
          setState({
            phase: 'refused',
            refusal: { refused: 'unreadable', file: firstFileOf(kind) },
          });
        }
      });
    return () => {
      live = false;
      decoded?.close();
    };
  }, [kind]);

  return { state, setState };
}

/** The preview of one clip: its sheet laid out and measured as the tab would. */
export const usePreview = (
  decoded: IDecodedImport | undefined,
  clip: number,
  choice: IImportClipChoice | undefined,
): { viewed?: IViewedAnimation; timing?: IImportTiming } => {
  const timing = useMemo(
    () => (decoded ? clipTiming(decoded, clip) : undefined),
    [decoded, clip],
  );
  const sheet = useMemo(
    () => (decoded && timing ? composeSheet(decoded, timing.cells) : undefined),
    [decoded, timing],
  );
  const [bitmap, setBitmap] = useState<ImageBitmap>();
  useEffect(() => {
    if (!sheet) {
      setBitmap(undefined);
      return undefined;
    }
    let live = true;
    let made: ImageBitmap | undefined;
    createImageBitmap(sheet.canvas)
      .then((result) => {
        made = result;
        if (live) {
          setBitmap(result);
        } else {
          result.close();
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      live = false;
      made?.close();
    };
  }, [sheet]);
  // Loop and the name shape the animation; speed and ground are the
  // preview's own, so they are left out and it does not start over.
  const loop = choice?.loop ?? DEFAULTS.loop;
  const viewed = useMemo(() => {
    if (!bitmap || !sheet || !timing) {
      return undefined;
    }
    const animation = clipAnimation(
      { name: 'preview', include: true, loop },
      timing,
      sheet,
    );
    return animation ? viewOf(animation, bitmap) : undefined;
  }, [bitmap, sheet, timing, loop]);
  return { viewed, timing };
};
