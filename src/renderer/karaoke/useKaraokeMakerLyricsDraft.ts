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

import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  IKaraokeMakerProject,
  karaokeMakerLineIsSection,
  karaokeMakerNeedsSpaceBetween,
  makerLinesFromPlainText,
} from '../../common/karaoke/makerProject';

/**
 * The project's words as one editable block of text.
 *
 * The editor works in plain text — one line per lyric line — because that is
 * what somebody can paste in from anywhere. Rebuilt from the project rather
 * than stored beside it, so there is no second copy to fall out of step.
 */
export const plainLyrics = (project: IKaraokeMakerProject): string =>
  project.lyrics.lines
    .map((line) =>
      line.tokens.reduce((text, token) => {
        const spaced =
          text !== '' &&
          token.startsWord !== false &&
          karaokeMakerNeedsSpaceBetween(text, token.text);
        return `${text}${spaced ? ' ' : ''}${token.text.trim()}`;
      }, ''),
    )
    .join('\n');

/**
 * Two lyric texts are the same if they differ only in whitespace.
 *
 * A byte comparison would call a trailing space an edit and offer to re-detect
 * every timing in the song for it. The BOM is stripped for the same reason:
 * it arrives on files saved by Windows editors and is invisible to the person
 * who saved them.
 */
export const normalizedLyricsText = (value: string): string =>
  value
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('\n');

/**
 * The lyric editor's text, and whether it still matches the project.
 *
 * Small, and separated from the analysis it triggers on purpose. Detecting
 * timings is a long asynchronous job with progress, cancellation and its own
 * failure modes; this is a textarea and two derived numbers. They were adjacent
 * in the component and are not the same subject.
 *
 * `draftChanged` is what decides whether the editor offers to re-detect, so it
 * compares normalized text — see `normalizedLyricsText` for why a byte
 * comparison would offer that far too often.
 *
 * `onDraftChange` fires on every text change, from any source. `draft` has
 * exactly one setter here — `setDraft`, which `openEditor` also calls rather
 * than touching the underlying state directly — so a translation's stale
 * line-count mismatch can be cleared once, beside that one set, instead of
 * wrapped again by every caller that changes the text (a textarea's
 * `onChange`, but just as much a file load or a fresh open): a wrapper
 * anywhere else is a path that can be added later and forget to call it.
 */
export const useKaraokeMakerLyricsDraft = (
  project: IKaraokeMakerProject,
  onDraftChange?: () => void,
) => {
  const projectText = plainLyrics(project);
  const previousProjectTextRef = useRef(projectText);
  const [isOpen, setOpen] = useState(false);
  const [draft, setDraftValue] = useState(projectText);
  const [fileName, setFileName] = useState<string>();
  const [workflowActive, setWorkflowActive] = useState(false);
  // Which language a fresh open should seed the paste view toward.
  // Undefined is the original-replace flow every open used before Task 8;
  // "Add a language" is the one caller that passes a real tag, so its own
  // click seeds an empty draft aimed at a translation instead of landing on
  // the same default "replace the original" every other entry point uses.
  const [target, setTarget] = useState<string>();

  const setDraft = useCallback<Dispatch<SetStateAction<string>>>(
    (value) => {
      setDraftValue(value);
      onDraftChange?.();
    },
    [onDraftChange],
  );

  useEffect(() => {
    const previousProjectText = previousProjectTextRef.current;
    previousProjectTextRef.current = projectText;
    // A structured word edit owns the draft only while the textarea still
    // mirrors the project. If the user has typed a new lyric sheet, preserve
    // that unsaved text; otherwise keep the two views synchronized so moving
    // one timed word never turns into a destructive whole-lyrics replacement.
    setDraft((current) =>
      normalizedLyricsText(current) ===
      normalizedLyricsText(previousProjectText)
        ? projectText
        : current,
    );
    // `setDraft` is a callback, not the raw state setter, so it is a real
    // dependency here — syncing the draft to a changed project is a text
    // change like any other, and has to clear a stale line-count mismatch
    // with it. Stable in practice: its own dependency is memoized upstream.
  }, [projectText, setDraft]);

  const draftWordCount = useMemo(
    () =>
      makerLinesFromPlainText(draft)
        .filter((line) => !karaokeMakerLineIsSection(line))
        .reduce((count, line) => count + line.tokens.length, 0),
    [draft],
  );

  const draftChanged =
    normalizedLyricsText(draft) !== normalizedLyricsText(projectText);

  /**
   * Re-seed from the project and open.
   *
   * Takes the project rather than closing over it because the caller reads it
   * from a ref — the editor can be opened from a keyboard shortcut whose
   * handler was built several renders ago.
   *
   * `translationTarget` seeds toward a translation instead of the original:
   * an empty draft (there is nothing to pre-fill a translation with) and the
   * target the paste view's field should open on.
   */
  const openEditor = (
    current: IKaraokeMakerProject,
    translationTarget?: string,
  ) => {
    setDraft(translationTarget ? '' : plainLyrics(current));
    setFileName(undefined);
    setTarget(translationTarget);
    setOpen(true);
  };

  return {
    isOpen,
    setOpen,
    draft,
    setDraft,
    fileName,
    setFileName,
    workflowActive,
    setWorkflowActive,
    draftWordCount,
    draftChanged,
    target,
    openEditor,
  };
};
