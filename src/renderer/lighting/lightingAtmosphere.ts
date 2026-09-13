/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import { getEaseFactor } from 'common/smoothing';
import { SCENE_TIME_WRAP_S } from 'common/sceneUniformContract';
import type { ILightingProfile } from 'common/lighting/lightingProfiles';
import type { IHeardFrame } from './lightingListener';
import type { ILightingSceneFrame } from './lightingSceneMessages';

/** Silence changes the movement, not ownership of the desk. Audio still clocks it. */
export const createLightingAtmosphere = () => {
  let activity = 0;
  let timeSeconds = 0;
  return (
    heard: IHeardFrame,
    profile: ILightingProfile,
  ): ILightingSceneFrame => {
    const { frame, silent } = heard;
    activity +=
      ((silent ? 0 : 1) - activity) *
      getEaseFactor(frame.deltaMs, silent ? 900 : 180);
    const idleSpeed = profile.idle === 'hold' ? 0 : profile.idleSpeed * 0.55;
    timeSeconds =
      (timeSeconds +
        (frame.deltaMs / 1000) * (idleSpeed + (1 - idleSpeed) * activity)) %
      SCENE_TIME_WRAP_S;
    const breathe =
      profile.idle === 'hold' ? 0.5 : 0.5 + 0.5 * Math.sin(timeSeconds * 0.55);
    const resting = 0.08 + breathe * 0.04;
    const blend = (level: number, idle: number) =>
      level * activity + idle * (1 - activity);
    return {
      ...frame,
      timeSeconds,
      activity,
      level: blend(frame.level, resting),
      beat: frame.beat * activity,
      bands: [
        blend(frame.bands[0], resting * 0.8),
        blend(frame.bands[1], resting),
        blend(frame.bands[2], resting * 0.65),
      ],
    };
  };
};
