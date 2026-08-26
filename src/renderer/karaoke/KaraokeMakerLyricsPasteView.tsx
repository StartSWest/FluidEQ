/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { karaokeLanguageName } from './karaokeLanguageName';
import Dropdown from '../widgets/Dropdown';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';

/**
 * Every language a translation can target, the app's ten UI locales first.
 *
 * The same set `KaraokeMakerWizard` offers for a transcription's source
 * language — every language Whisper large-v3 was trained on — because
 * `Dropdown` has no "type a code that isn't listed" escape hatch: whatever
 * language someone wants to paste has to already be an option, or the field
 * cannot reach it. Duplicated here rather than imported from the wizard file:
 * that list is about what the local speech model recognizes, this one is
 * about what a lyric sheet can be tagged, and they read the same today only
 * because the model happens to cover what the app also ships UI text in.
 */
const TARGET_LANGUAGE_CODES = [
  ...['es', 'en', 'de', 'fr', 'it', 'pt', 'ru', 'ja', 'zh', 'hi'],
  ...(
    'af am ar as az ba be bg bn bo br bs ca cs cy da el et eu fa fi fo gl ' +
    'gu ha haw he hr ht hu hy id is jw ka kk km kn ko la lb ln lo lt lv mg ' +
    'mi mk ml mn mr ms mt my ne nl nn no oc pa pl ps ro sa sd si sk sl sn ' +
    'so sq sr su sv sw ta te tg th tk tl tr tt uk ur uz vi yi yo yue'
  ).split(' '),
];

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
  targetLanguage,
}: IKaraokeMakerLyricsPasteViewProps) => {
  const { t } = useTranslation();
  const isTranslationTarget = targetLanguage !== originalLanguage;
  const targetOptions = [
    originalLanguage,
    ...TARGET_LANGUAGE_CODES.filter((code) => code !== originalLanguage),
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
        <strong>{t('karaoke.maker.referenceLyrics')}</strong>
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
        </div>
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
      <textarea
        value={lyricsDraft}
        disabled={lyricsProcessing}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder={
          isTranslationTarget
            ? t('karaoke.translation.paste')
            : t('karaoke.maker.lyricsPlaceholder')
        }
        spellCheck
      />
    </section>
  );
};

export default KaraokeMakerLyricsPasteView;
