/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  codeOfCameraKey,
  printedKey,
  type TSceneCameraKey,
} from 'common/sceneCameraControl';
import { useTranslation } from '../utils/I18nContext';
import { useSceneCameraControl } from '../utils/sceneCameraControlStore';

/**
 * The camera's key as the viewer sees it written: the View menu's row, and
 * every place that tells somebody which key moves a 3D scene - the gallery's
 * label and its list of gestures - so the two never name different keys.
 */

const MODIFIER_LABEL: Record<'ctrl' | 'alt' | 'shift', TranslationKey> = {
  ctrl: 'graph.scene.camera.key.ctrl',
  alt: 'graph.scene.camera.key.alt',
  shift: 'graph.scene.camera.key.shift',
};

/** Chromium's map of each key's place to what this keyboard types there. */
interface IKeyboardLayout {
  getLayoutMap(): Promise<ReadonlyMap<string, string>>;
}

/**
 * What this keyboard's layout types on each key, where the browser can say:
 * a key of one's own is chosen by its place, and is named as it is printed
 * on this keyboard - a German layout's `ö` where a US one has `;`. Read
 * once; until it arrives, or where it never does, a letter or a digit is
 * named from its code and the rest by the code itself.
 */
let layout: Promise<ReadonlyMap<string, string> | undefined> | undefined;
const readLayout = () => {
  const { keyboard } = navigator as Navigator & {
    keyboard?: IKeyboardLayout;
  };
  layout ??= keyboard
    ? keyboard.getLayoutMap().catch(() => undefined)
    : Promise.resolve(undefined);
  return layout;
};

export const useKeyboardLayout = () => {
  const [map, setMap] = useState<ReadonlyMap<string, string>>();
  useEffect(() => {
    let live = true;
    readLayout()
      .then((found) => {
        // Nothing to say where the browser cannot read the layout.
        if (live && found) {
          setMap(found);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return map;
};

/** `key` as it is written on the keyboard, or by name for a modifier. */
export const cameraKeyName = (
  key: TSceneCameraKey,
  t: (key: TranslationKey) => string,
  keyboardLayout: ReadonlyMap<string, string> | undefined,
): string => {
  const code = codeOfCameraKey(key);
  if (code === undefined) {
    return t(MODIFIER_LABEL[key as 'ctrl' | 'alt' | 'shift']);
  }
  return keyboardLayout?.get(code)?.toUpperCase() ?? printedKey(code) ?? code;
};

/** The viewer's camera key, written, followed as they change it. */
export const useCameraKeyName = (): string => {
  const { t } = useTranslation();
  const { key } = useSceneCameraControl();
  return cameraKeyName(key, t, useKeyboardLayout());
};
