/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import type { TSceneStanding } from 'common/sceneReviewStanding';
import type { IProjectPublished } from 'main/memberScenes/publishedRecords';

/**
 * What the gallery said about the open project (`useStudioBaseline`):
 * still being asked, could not be asked (signed out, offline, a scene
 * opened to look inside), nothing published, or the version people have.
 */
export type TGalleryAnswer =
  | { state: 'asking' }
  | { state: 'unknown' }
  | { state: 'none' }
  | { state: 'live'; version: number };

/**
 * What the bar's Publish says about the bench (Ivan, 2026-11-25: "Should be
 * Publish ... so Publish is the main stage"): `changes`, the bench has
 * changes people do not have, and Publish is loud with a light running round
 * it; `ready`, nothing of it is in the gallery yet, and Publish is loud and
 * still; `quiet` otherwise - what people have is what is here, or the review
 * has the newest version, or its answer has to be read first.
 */
export type TPublishCall = 'quiet' | 'ready' | 'changes';

/** The mark in front of the sentence: never the colour alone. */
export type TVersionLineMark =
  'live' | 'changed' | 'off' | 'review' | 'refused' | 'none';

export interface IVersionLine {
  key: TranslationKey;
  vars: Record<string, number>;
  mark: TVersionLineMark;
  /** The review refused the newest version: its reason is one press away. */
  seeWhy: boolean;
  /** How loudly the bar's Publish asks to be pressed (`TPublishCall`). */
  publish: TPublishCall;
}

interface IVersionLineInput {
  /** The project file's own number. */
  version: number;
  gallery: TGalleryAnswer;
  /** What was last published from this folder on this computer. */
  record: IProjectPublished | undefined;
  /** The review's word on the newest version sent. */
  standing: TSceneStanding | undefined;
  /** A scene opened to look inside: never this member's to publish. */
  inspecting: boolean;
}

const line = (
  key: TranslationKey,
  vars: Record<string, number>,
  mark: TVersionLineMark,
  extra: Partial<Pick<IVersionLine, 'seeWhy' | 'publish'>> = {},
): IVersionLine => ({
  key,
  vars,
  mark,
  seeWhy: extra.seeWhy ?? false,
  publish: extra.publish ?? 'quiet',
});

/**
 * The one sentence beside the project in the Studio's bar: what people have
 * in the gallery and what is on the bench, in words (Ivan, 2026-11-25: "I
 * don't know whether the thing is new or is changes"). It replaced a "v21"
 * chip that meant the gallery's version, a "Looks v21 ✓" chip that meant the
 * member's own copy, and "Updated from your last save", which was about the
 * stage and read as something new arriving.
 *
 * `'asking'` while the gallery is still being asked: the bar keeps the line's
 * room meanwhile, and saying "not published" before the answer is exactly the
 * claim the old chip made about published scenes while offline.
 */
export const studioVersionLine = ({
  version,
  gallery,
  record,
  standing,
  inspecting,
}: IVersionLineInput): IVersionLine | 'asking' => {
  if (inspecting) {
    return line('studio.line.inspect', { version }, 'none');
  }
  if (gallery.state === 'asking') {
    return 'asking';
  }
  if (gallery.state === 'unknown') {
    return line('studio.line.unknown', {}, 'off');
  }
  const live = gallery.state === 'live' ? gallery.version : undefined;
  // The review speaks only of a version newer than the one people have: an
  // older word is about a version the gallery has already moved past.
  if (standing && (live === undefined || standing.version > live)) {
    if (standing.kind === 'rejected') {
      return live === undefined
        ? line(
            'studio.line.firstRejected',
            { version: standing.version },
            'refused',
            { seeWhy: true },
          )
        : line(
            'studio.line.rejected',
            { version: standing.version, live },
            'refused',
            { seeWhy: true },
          );
    }
    return live === undefined
      ? line('studio.line.firstReview', { version: standing.version }, 'review')
      : line(
          'studio.line.review',
          { version: standing.version, live },
          'review',
        );
  }
  if (live === undefined) {
    return line('studio.line.unpublished', {}, 'off', { publish: 'ready' });
  }
  if (record?.version === live) {
    return record.unchanged
      ? line('studio.line.same', { version: live }, 'live')
      : line('studio.line.changed', { version: live }, 'changed', {
          publish: 'changes',
        });
  }
  // No record here of the version people have: it went out from another
  // computer, or from this one before the records were kept, or it is one of
  // FluidEQ's own scenes, published by the account that publishes those.
  // Which, nothing here can say, and the folder cannot be compared with it;
  // the sentence says only that (it said "from another computer" of scenes
  // published from this very one).
  if (record === undefined || record.version < live) {
    return line('studio.line.elsewhere', { version: live }, 'live');
  }
  // A newer version went out from here and the review has not said anything
  // about it yet: what people have is all that is known.
  return line('studio.line.inGallery', { version: live }, 'live');
};
