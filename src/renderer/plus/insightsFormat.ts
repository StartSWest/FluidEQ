/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { LocaleCode, TranslationKey } from 'common/i18n';
import { FLUIDEQ_CREATOR_ID, isPlusCategory } from 'common/plusGallery';
import { lookIdOfScene, type ISceneLabel } from 'common/sceneTaste';
import type { TAdminFailure } from 'main/plus/adminInsightsApi';
import { categoryKey } from './GalleryParts';

/**
 * What the admin's scene pages say the same way: a time on screen, a scene's
 * name and picture, a kind, and how far off a trial's end is.
 */

/** What an admin scene page says when the server did not answer. */
export const INSIGHT_ERRORS: Record<TAdminFailure, TranslationKey> = {
  offline: 'insights.error.offline',
  'signed-out': 'insights.error.signedOut',
  server: 'insights.error.server',
  // Nothing the page sends is refused: its choices are the server's own.
  invalid: 'insights.error.server',
  forbidden: 'insights.error.forbidden',
  'not-deployed': 'insights.error.notDeployed',
};

const HOUR = 3600;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "5h 10m", "55m", "40s" — in the reader's language. Under a minute it says
 * the seconds: "under a minute" told the admin nothing about a scene put on
 * the graph moments ago (Ivan, 2026-10-12: "it need to show for how long").
 */
export const formatDuration = (
  seconds: number,
  locale: LocaleCode,
  t: (key: TranslationKey, vars?: Record<string, string>) => string,
): string => {
  const hours = Math.floor(seconds / HOUR);
  const minutes = Math.floor((seconds % HOUR) / 60);
  const unit = (value: number, kind: 'hour' | 'minute' | 'second') =>
    new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: kind,
      unitDisplay: 'narrow',
      maximumFractionDigits: 0,
    }).format(value);
  if (hours === 0 && minutes === 0) {
    return unit(Math.floor(seconds), 'second');
  }
  if (hours === 0) {
    return unit(minutes, 'minute');
  }
  return minutes === 0
    ? unit(hours, 'hour')
    : t('insights.time.hoursMinutes', {
        hours: unit(hours, 'hour'),
        minutes: unit(minutes, 'minute'),
      });
};

/** The scene's name in the reader's language, or its id when it has none. */
export const sceneLabelName = (scene: ISceneLabel, locale: LocaleCode) =>
  scene.names?.[locale] ?? scene.names?.en ?? scene.sceneId;

/** What `ScenePicture` asks a picture by, for either kind of scene. */
export const scenePictureRef = (scene: ISceneLabel) => ({
  lookId: lookIdOfScene(scene),
  authorId: scene.authorId ?? FLUIDEQ_CREATOR_ID,
  sceneId: scene.sceneId,
  version: scene.version ?? 1,
});

/** A kind's name; `other` for a scene with none or one this build lacks. */
export const kindKey = (category: string | undefined): TranslationKey =>
  category && isPlusCategory(category)
    ? categoryKey(category)
    : 'insights.kind.other';

/**
 * How far off a trial's end is, in whole calendar days of the admin's own
 * clock: 0 is today, 1 tomorrow.
 */
export const daysUntil = (at: number, now: number): number => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(at);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
};

/** "Trial ends today", "…tomorrow", "…in 3 days". */
export const trialEndKey = (
  days: number,
): { key: TranslationKey; urgent: boolean } => {
  if (days <= 0) {
    return { key: 'plus.accounts.trial.today', urgent: true };
  }
  if (days === 1) {
    return { key: 'plus.accounts.trial.tomorrow', urgent: true };
  }
  return { key: 'plus.accounts.trial.inDays', urgent: false };
};
