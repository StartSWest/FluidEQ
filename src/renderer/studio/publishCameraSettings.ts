import type { TranslationKey } from 'common/i18n';
import { SCENE_DAYLIGHT_MAX, SCENE_DAYLIGHT_MIN } from 'common/sceneDaylight';
import type { TPreviewTrouble } from '../plus/ScenePreview';
import { PERCENT_SNAPS, snapFraction } from '../utils/percentSnaps';
import type { TStudioSignal } from './studioSignals';

// The publish camera's fixed settings (`StudioPublishCamera`).

/** What the scene can hear while its cover is caught. */
export type TCameraSignal = Extract<TStudioSignal, 'live' | 'showcase'>;

export const SIGNALS: readonly {
  signal: TCameraSignal;
  key: TranslationKey;
}[] = [
  { signal: 'live', key: 'studio.publish.yourMusic' },
  { signal: 'showcase', key: 'studio.publish.demo' },
];

/**
 * Below this the scene is hearing nothing. The energy a scene is given falls
 * to zero when nothing plays and sits well above this under the quietest
 * passage of a real song.
 */
export const QUIET_LEVEL = 0.02;

/**
 * How long nothing has to be heard before the stage says so, in drawn-frame
 * time: long enough that a gap between two songs, or the moment the stage
 * opens before the music reaches it, is not mistaken for silence.
 */
export const QUIET_MS = 1500;

/** The runner's own cap on how far one frame moves the clock. */
export const MAX_FRAME_MS = 100;

export const DAYLIGHT_SPAN = SCENE_DAYLIGHT_MAX - SCENE_DAYLIGHT_MIN;
/** The quarters, marked where the Window colours slider marks them. */
export const DAYLIGHT_SNAPS = PERCENT_SNAPS.map((snap) =>
  snapFraction(snap, SCENE_DAYLIGHT_MIN, SCENE_DAYLIGHT_MAX),
);

export const TROUBLE_KEYS: Record<TPreviewTrouble, TranslationKey> = {
  heavy: 'studio.publish.stageHeavy',
  unavailable: 'studio.publish.stageUnavailable',
  compile: 'studio.publish.stageUnavailable',
};
