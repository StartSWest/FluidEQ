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
 * Off in a new install until the listener turns it on (Ivan, 2026-09-28:
 * "sparks get disabled by default in new installation"); one answer for
 * every visualizer, kept on this computer.
 * The Studio's stage shows them whatever it says: trying them is what it is
 * for.
 */
const setting = createFlagSetting('fluideq.pointerSparks', false);

export const setPointerSparks = setting.set;

export const usePointerSparks = (): boolean =>
  useSyncExternalStore(setting.subscribe, setting.get);
