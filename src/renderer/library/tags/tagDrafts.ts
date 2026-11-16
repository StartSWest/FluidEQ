/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Edits waiting to be written: per song, only what differs from the file.
 *
 * A value typed back to what the file holds is not an edit any more and is
 * dropped, so the foot's count is the count of real changes and Save writes
 * nothing the file already says.
 */

import type {
  ITagEdit,
  ITagWriteRequest,
  ITrackTagSheet,
  TTagCoverMime,
  TTagFieldKey,
  TTagFields,
} from '../../../common/library/tagFields';

/** A picture chosen for songs, held once however many get it. */
export interface IDraftCover {
  id: string;
  bytes: Uint8Array;
  mime: TTagCoverMime;
  /** An object URL for the preview, revoked when the draft goes. */
  url: string;
  width: number;
  height: number;
}

export interface ITagDraft {
  fields: TTagFields;
  /** Raw fields by code; `''` removes one. */
  extras: Record<string, string>;
  /** `null` removes the cover; absent leaves it. */
  cover?: IDraftCover | null;
  id3v2Version?: 3 | 4;
  keepId3v1?: boolean;
}

export const emptyDraft = (): ITagDraft => ({ fields: {}, extras: {} });

/** The draft with `key` set, or dropped where it matches the file. */
export const withField = (
  draft: ITagDraft,
  sheet: ITrackTagSheet,
  key: TTagFieldKey,
  value: string,
): ITagDraft => {
  const fields = { ...draft.fields };
  if ((sheet.fields[key] ?? '') === value) {
    delete fields[key];
  } else {
    fields[key] = value;
  }
  return { ...draft, fields };
};

export const withExtra = (
  draft: ITagDraft,
  sheet: ITrackTagSheet,
  code: string,
  value: string,
): ITagDraft => {
  const extras = { ...draft.extras };
  const current = sheet.extras.find((extra) => extra.code === code)?.value;
  if ((current ?? '') === value && (current !== undefined || value === '')) {
    delete extras[code];
  } else {
    extras[code] = value;
  }
  return { ...draft, extras };
};

/** How many separate changes a draft holds, for the foot. */
export const countDraftChanges = (draft: ITagDraft | undefined): number => {
  if (draft === undefined) {
    return 0;
  }
  return (
    Object.keys(draft.fields).length +
    Object.keys(draft.extras).length +
    (draft.cover !== undefined ? 1 : 0) +
    (draft.id3v2Version !== undefined ? 1 : 0) +
    (draft.keepId3v1 !== undefined ? 1 : 0)
  );
};

export const isDraftEmpty = (draft: ITagDraft | undefined): boolean =>
  countDraftChanges(draft) === 0;

/** The value a field shows: the draft's, else the file's. */
export const shownField = (
  sheet: ITrackTagSheet,
  draft: ITagDraft | undefined,
  key: TTagFieldKey,
): string => draft?.fields[key] ?? sheet.fields[key] ?? '';

/** One song's draft as the edit main is sent. */
export const editOfDraft = (trackId: string, draft: ITagDraft): ITagEdit => {
  const extras = Object.entries(draft.extras).map(([code, value]) => ({
    code,
    value,
  }));
  let coverId: string | undefined;
  if (draft.cover === null) {
    coverId = '';
  } else if (draft.cover !== undefined) {
    coverId = draft.cover.id;
  }
  return {
    trackId,
    fields: draft.fields,
    extras: extras.length > 0 ? extras : undefined,
    coverId,
    id3v2Version: draft.id3v2Version,
    keepId3v1: draft.keepId3v1,
  };
};

/**
 * Every draft as one write: each picture sent once, and the song playing
 * now held until it ends.
 */
export const requestOfDrafts = (
  drafts: ReadonlyMap<string, ITagDraft>,
  playingTrackId: string | undefined,
): ITagWriteRequest => {
  const edits: ITagEdit[] = [];
  const covers: ITagWriteRequest['covers'] = {};
  drafts.forEach((draft, trackId) => {
    if (isDraftEmpty(draft)) {
      return;
    }
    edits.push(editOfDraft(trackId, draft));
    if (draft.cover) {
      covers[draft.cover.id] = {
        bytes: draft.cover.bytes,
        mime: draft.cover.mime,
      };
    }
  });
  return {
    edits,
    covers,
    heldTrackIds:
      playingTrackId !== undefined && drafts.has(playingTrackId)
        ? [playingTrackId]
        : [],
  };
};
