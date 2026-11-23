import type { TranslationKey } from 'common/i18n';
import { SCENE_DAYLIGHT_MAX, SCENE_DAYLIGHT_MIN } from 'common/sceneDaylight';
import type { TPreviewTrouble } from '../plus/ScenePreview';
import { PERCENT_SNAPS, snapFraction } from '../utils/percentSnaps';

// The publish camera's fixed settings (`StudioPublishCamera`).

/**
 * The hour the dialog opens on, halfway from night to full day (Ivan,
 * 2026-11-23: "it will start at 50%, but they can use 0 if they want it").
 * It used to open on the window's own hour, so a cover shot at night was
 * the default for anybody working after dark.
 */
export const DAYLIGHT_START = 50;

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
