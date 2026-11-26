import { useMemo } from 'react';
import type { TranslationKey } from 'common/i18n';
import { compileNotesFor } from 'common/sceneCompileNotes';
import { useTranslation } from '../utils/I18nContext';

/**
 * What in the newest version makes it slow to load on Windows
 * (`sceneCompileNotes.ts`), under the stage beside its problems: a warning in
 * amber, never a refusal — the scene plays all the same — with the line each
 * note is about, so the member can hand it to their AI.
 */
export default function StudioCompileNotes({
  source,
}: {
  /** The version on the stage, or none while it cannot play. */
  source: string | undefined;
}) {
  const { t } = useTranslation();
  // Read once per version: 10-30 ms for the largest official scenes.
  const notes = useMemo(
    () => (source === undefined ? [] : compileNotesFor(source)),
    [source],
  );
  if (notes.length === 0) {
    return null;
  }
  return (
    <div className="studio-problems studio-problems--advice" role="status">
      <span className="studio-problems__title">
        {t('studio.compileNote.heading')}
      </span>
      <ul className="studio-problems__list">
        {notes.map((note) => (
          <li className="studio-problem" key={`${note.code}:${note.line}`}>
            <span className="studio-problem__where">
              {t('studio.problem.line', {
                file: t('studio.file.source'),
                line: note.line,
              })}
            </span>
            <span className="studio-problem__what">
              {t(`studio.compileNote.${note.code}` as TranslationKey, {
                name: 'name' in note ? note.name : '',
                sites: 'sites' in note ? note.sites : 0,
              })}
            </span>
          </li>
        ))}
      </ul>
      <span className="studio-problems__hint">
        {t('studio.compileNote.hint')}
      </span>
    </div>
  );
}
