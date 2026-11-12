/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useMemo, useState } from 'react';
import { MAX_VERSION_NOTE } from 'common/sceneVersionNote';
import {
  MAX_STUDIO_DESCRIPTION,
  parseStudioNotes,
  type IStudioNotes,
} from 'common/studioNotes';
import type { IProjectCodeFile } from 'main/memberScenes/projectCode';
import { useTranslation } from '../utils/I18nContext';
import { useFileMeta } from './codeFileMeta';
import jsonPieces from './jsonTokens';
import StudioCodeCard from './StudioCodeCard';
import StudioCodeEditor from './StudioCodeEditor';

const NOTHING = new Set<number>();

/** What the two fields hold: the notes' own words, as plain text. */
interface INotesText {
  description: string;
  whatsNew: string;
}

/** The notes as the file has them, or nothing for a file that is not notes. */
export const notesTextOf = (
  text: string | undefined,
): INotesText | undefined => {
  if (text === undefined) {
    return undefined;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return undefined;
  }
  const notes = parseStudioNotes(raw);
  return notes
    ? { description: notes.description, whatsNew: notes.whatsNew ?? '' }
    : undefined;
};

/** The fields as the notes' own writer takes them: an empty line is none. */
export const notesToSave = (fields: INotesText): IStudioNotes => {
  const line = fields.whatsNew.replace(/\s+/g, ' ').trim();
  return {
    description: fields.description,
    ...(line ? { whatsNew: line } : {}),
  };
};

interface IStudioCodeNotesProps {
  projectId: string;
  file: IProjectCodeFile;
  open: boolean;
  onToggle: () => void;
  /**
   * Whether the member may change this scene's notes: never in one of
   * FluidEQ's own scenes or a copy of another member's, opened to look
   * inside, where main refuses the save as well.
   */
  editable: boolean;
  /** The notes were written: the tab reads its files again. */
  onSaved: () => void;
}

/**
 * The scene's notes in the Code tab, as the two things they are (Ivan,
 * 2026-11-11: "shall we allow to edit all files? notes at least yes"): the
 * scene's description and the line about what is new, in plain text fields
 * with their real line breaks — not the JSON that holds them, where a line
 * break reads as \n. The file itself is one press away, as it is on disk.
 *
 * NOTHING IS WRITTEN UNTIL SAVE, as in Edit mode: what is typed is a draft,
 * Discard forgets it, and Save writes through the notes' own writer
 * (`studioNotes.ts` in main), which keeps what is not shown here — an
 * earlier idea an old brief carried.
 */
export default function StudioCodeNotes({
  projectId,
  file,
  open,
  onToggle,
  editable,
  onSaved,
}: IStudioCodeNotesProps) {
  const { t } = useTranslation();
  const id = useId();
  const saved = useMemo(() => notesTextOf(file.text), [file.text]);
  const [draft, setDraft] = useState<INotesText>();
  /** The file's text the draft began from: another write since is said. */
  const [draftFrom, setDraftFrom] = useState<string>();
  const [showFile, setShowFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const meta = useFileMeta(file.text, file.bytes);

  const shown = draft ?? saved;
  const changed =
    draft !== undefined &&
    saved !== undefined &&
    (draft.description !== saved.description ||
      draft.whatsNew !== saved.whatsNew);
  const changedOutside =
    changed && draftFrom !== undefined && draftFrom !== file.text;

  const edit = (patch: Partial<INotesText>) => {
    if (!saved) {
      return;
    }
    setFailed(false);
    if (!draft) {
      setDraftFrom(file.text);
    }
    setDraft({ ...(draft ?? saved), ...patch });
  };
  const discard = () => {
    setDraft(undefined);
    setFailed(false);
  };
  const save = () => {
    if (!draft || saving) {
      return;
    }
    setSaving(true);
    const write = window.electron?.ipcRenderer?.saveStudioNotes;
    (write ? write(projectId, notesToSave(draft)) : Promise.resolve(false))
      .then((ok) => {
        if (ok) {
          setDraft(undefined);
          onSaved();
        } else {
          setFailed(true);
        }
        return undefined;
      })
      .catch(() => setFailed(true))
      .finally(() => setSaving(false));
  };

  // Notes that cannot be read as notes are shown as the file, and never
  // offered as fields that would write over what is there.
  const asFields = !showFile && shown !== undefined;

  return (
    <StudioCodeCard
      file={file.file}
      kind={file.role}
      open={open}
      onToggle={onToggle}
      meta={meta}
      actions={
        open ? (
          <>
            {changed && (
              <span className="studio-code__state is-dirty">
                <span className="studio-code__dot" aria-hidden="true" />
                {t('studio.notes.unsaved')}
              </span>
            )}
            {editable && changed && (
              <>
                <button
                  type="button"
                  className="button small"
                  disabled={saving}
                  onClick={save}
                >
                  {t('studio.edit.save')}
                </button>
                <button
                  type="button"
                  className="button small subtle"
                  disabled={saving}
                  onClick={discard}
                >
                  {t('studio.edit.discard')}
                </button>
              </>
            )}
            {saved !== undefined && (
              <button
                type="button"
                className="button small subtle"
                aria-pressed={showFile}
                onClick={() => setShowFile(!showFile)}
              >
                {t('studio.notes.showFile')}
              </button>
            )}
            {(!editable || !asFields) && (
              <span
                className="studio-code__view-only"
                title={t('studio.code.viewOnlyHint')}
              >
                {t('studio.code.viewOnly')}
              </span>
            )}
          </>
        ) : undefined
      }
    >
      {failed && (
        <p className="studio-notes__problem" role="alert">
          {t('studio.notes.saveFailed')}
        </p>
      )}
      {changedOutside && (
        <p className="studio-notes__problem" role="status">
          {t('studio.notes.changedOutside')}
        </p>
      )}
      {asFields && (
        <div className="studio-notes">
          <label className="studio-notes__field" htmlFor={`${id}-description`}>
            <span className="studio-notes__name">
              {t('studio.notes.description')}
              <span className="studio-notes__count">
                {t('studio.notes.count', {
                  count: shown.description.length,
                  max: MAX_STUDIO_DESCRIPTION,
                })}
              </span>
            </span>
            <span className="studio-notes__hint">
              {t('studio.notes.descriptionHint')}
            </span>
            <textarea
              id={`${id}-description`}
              className="studio-notes__text"
              value={shown.description}
              maxLength={MAX_STUDIO_DESCRIPTION}
              rows={6}
              readOnly={!editable}
              onChange={(event) => edit({ description: event.target.value })}
            />
          </label>
          <label className="studio-notes__field" htmlFor={`${id}-whats-new`}>
            <span className="studio-notes__name">
              {t('studio.notes.whatsNew')}
              <span className="studio-notes__count">
                {t('studio.notes.count', {
                  count: shown.whatsNew.length,
                  max: MAX_VERSION_NOTE,
                })}
              </span>
            </span>
            <span className="studio-notes__hint">
              {t('studio.notes.whatsNewHint')}
            </span>
            {/* One line, as the published note is: a line break has no
                place in it, so the field takes none. */}
            <input
              id={`${id}-whats-new`}
              type="text"
              className="studio-notes__text is-line"
              value={shown.whatsNew}
              maxLength={MAX_VERSION_NOTE}
              readOnly={!editable}
              onChange={(event) => edit({ whatsNew: event.target.value })}
            />
          </label>
        </div>
      )}
      {!asFields && file.text !== undefined && (
        <StudioCodeEditor
          text={file.text}
          label={t('studio.code.label', { file: file.file })}
          pieces={jsonPieces}
          wrong={NOTHING}
          added={NOTHING}
          removedAbove={NOTHING}
        />
      )}
    </StudioCodeCard>
  );
}
