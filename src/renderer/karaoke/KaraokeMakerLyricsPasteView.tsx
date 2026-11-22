/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject, useRef } from 'react';
import { IKaraokeMakerProject } from '../../common/karaoke/makerProject';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import usePasteIntoField from '../utils/usePasteIntoField';
import karaokeLanguageName from './karaokeLanguageName';
import KARAOKE_LANGUAGE_CODES from './karaokeLanguageCodes';
import Dropdown from '../widgets/Dropdown';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';
import KaraokeMakerLyricsSourceEditor from './KaraokeMakerLyricsSourceEditor';

/**
 * The paste view: the textarea you paste words into, and — since Task 8 —
 * which language they are in.
 *
 * Half of `KaraokeMakerLyricsDialog`'s two views (see that file for why they
 * were split apart, and for how `targetLanguage` decides between replacing
 * the original and adding a translation once the textarea is confirmed).
 */
export interface IKaraokeMakerLyricsPasteViewProps {
  lyricsDraft: string;
  onDraftChange: (value: string) => void;
  lyricsProcessing: boolean;
  lyricsFileName: string | undefined;
  draftLyricsWordCount: number;
  lyricsInputRef: RefObject<HTMLInputElement | null>;
  /** The draft reconciled against the project: the editor highlights against it. */
  previewProject: IKaraokeMakerProject;

  /** The project's own language tag, or the sentinel for "never declared". */
  originalLanguage: string;
  targetLanguage: string;
  onTargetLanguageChange: (language: string) => void;
}

const KaraokeMakerLyricsPasteView = ({
  draftLyricsWordCount,
  lyricsDraft,
  lyricsFileName,
  lyricsInputRef,
  lyricsProcessing,
  onDraftChange,
  onTargetLanguageChange,
  originalLanguage,
  previewProject,
  targetLanguage,
}: IKaraokeMakerLyricsPasteViewProps) => {
  const { t } = useTranslation();
  const isTranslationTarget = targetLanguage !== originalLanguage;
  // Lyrics come from somewhere else almost always: the box's own Paste, in
  // the Maker's face beside Load lyrics file (`usePasteIntoField`).
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const pasteIn = usePasteIntoField(boxRef);
  const targetOptions = [
    originalLanguage,
    ...KARAOKE_LANGUAGE_CODES.filter((code) => code !== originalLanguage),
  ].map((code) => ({
    value: code,
    label:
      code === originalLanguage
        ? t('karaoke.translation.original')
        : karaokeLanguageName(code),
    display:
      code === originalLanguage ? (
        t('karaoke.translation.original')
      ) : (
        // `lang` so Chromium picks the right face per script: the Han
        // characters are not the same shapes drawn Chinese or Japanese.
        <span lang={code}>{karaokeLanguageName(code)}</span>
      ),
  }));

  return (
    <section className="karaoke-maker__lyrics-source">
      <div className="karaoke-maker__lyrics-section-head">
        {/* A translation is named by its language: both columns said
            "Reference lyrics", the box being typed into and the song's own
            lines beside it. */}
        <strong lang={isTranslationTarget ? targetLanguage : undefined}>
          {isTranslationTarget
            ? karaokeLanguageName(targetLanguage)
            : t('karaoke.maker.referenceLyrics')}
        </strong>
        <div className="karaoke-maker__lyrics-source-actions">
          <span title={lyricsFileName}>
            {lyricsFileName ??
              t('karaoke.maker.lyricsWordCount', {
                count: draftLyricsWordCount,
              })}
          </span>
          <button
            type="button"
            disabled={lyricsProcessing}
            onClick={() => lyricsInputRef.current?.click()}
          >
            <KaraokeMakerToolIcon name="project" />
            <span>{t('karaoke.maker.loadLyricsFile')}</span>
          </button>
          <button
            type="button"
            disabled={lyricsProcessing || !pasteIn.hasText}
            title={t('edit.paste.hint')}
            onMouseDown={pasteIn.keepFieldFocus}
            onClick={pasteIn.paste}
          >
            <MenuIcon name="copyText" />
            <span>{t('edit.paste.button')}</span>
          </button>
        </div>
        {/* In the head, on a line of its own: the column's rows are fixed
            (head, language, box) and a fourth would take the box's. */}
        {pasteIn.noteKey !== undefined && (
          <p className="karaoke-maker__lyrics-paste-note" role="status">
            {t(pasteIn.noteKey)}
          </p>
        )}
      </div>
      <div className="karaoke-maker__lyrics-target">
        <span>{t('karaoke.translation.target')}</span>
        <Dropdown
          name={t('karaoke.translation.target')}
          options={targetOptions}
          value={targetLanguage}
          isDisabled={lyricsProcessing}
          isFilterable
          placement="down"
          handleChange={onTargetLanguageChange}
        />
      </div>
      <KaraokeMakerLyricsSourceEditor
        textareaRef={boxRef}
        value={lyricsDraft}
        disabled={lyricsProcessing}
        project={previewProject}
        onChange={onDraftChange}
        placeholder={
          isTranslationTarget
            ? t('karaoke.translation.paste')
            : t('karaoke.maker.lyricsPlaceholder')
        }
      />
    </section>
  );
};

export default KaraokeMakerLyricsPasteView;
