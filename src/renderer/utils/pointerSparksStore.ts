/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { createFlagSetting } from './graphStorage';

/**
 * Whether a Plus visualizer throws its sparks, petals or snow from the mouse
 * (`common/scenePointer.ts`, drawn by `ScenePointerLayer`): the Window colours
 * menu's switch, under Rainbow mode (Ivan, 2026-09-28: "the user should be
 * able to turn sparks on and off", "in the Backdrop window colours menu").
 * On in a new install (Ivan, 2026-09-29: "when the user selects a Plus viz
 * ... all switches on, rainbow mode, pointer and daylight follows
 * brightness"; for a day it started off); one answer for every visualizer,
 * kept on this computer.
 * The Studio's stage shows them whatever it says: trying them is what it is
 * for.
 */
const setting = createFlagSetting('fluideq.pointerSparks', true);

export const setPointerSparks = setting.set;

export const usePointerSparks = (): boolean =>
  useSyncExternalStore(setting.subscribe, setting.get);
