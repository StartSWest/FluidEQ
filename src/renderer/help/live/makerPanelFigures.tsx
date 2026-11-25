/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type TranslationKey } from 'common/i18n';
import {
  type IKaraokeMakerToken,
  karaokeMakerLineIsSection,
  KARAOKE_ORIGINAL_LANGUAGE,
} from 'common/karaoke/makerProject';
import DialogFrame from '../../components/DialogFrame';
import MenuIcon from '../../icons/MenuIcon';
import KaraokeMakerAnalysisTools from '../../karaoke/KaraokeMakerAnalysisTools';
import KaraokeMakerLyricsSourceEditor from '../../karaoke/KaraokeMakerLyricsSourceEditor';
import KaraokeMakerLyricsWordList from '../../karaoke/KaraokeMakerLyricsWordList';
import KaraokeMakerTimingSliders from '../../karaoke/KaraokeMakerTimingSliders';
import KaraokeMakerToolIcon from '../../karaoke/KaraokeMakerToolIcon';
import KaraokeMakerWordInspector from '../../karaoke/KaraokeMakerWordInspector';
import { createKaraokeLiveValue } from '../../karaoke/karaokeLiveValue';
import { karaokeMakerLyricFocus } from '../../karaoke/makerCanvasLayout';
import useMakerSelectionDetails from '../../karaoke/useMakerSelectionDetails';
import { useTranslation } from '../../utils/I18nContext';
import Dropdown from '../../widgets/Dropdown';
import {
  HELP_MAKER_PROJECT,
  HELP_PLAYHEAD_MS,
  HELP_SONG,
} from './karaokeHelpSong';

/**
 * The Maker chapter's two panels (`helpChapters/listen.ts`): the lyrics
 * dialog and the Repair tools.
 *
 * The dialog is the app's dialog frame round the Maker's own word list,
 * word editor and lyric box, for the made-up song with "lit" picked; its
 * paste column's head is its markup, class for class, as
 * `KaraokeMakerLyricsPasteView` draws it, because that head asks whether the
 * reader's clipboard holds text. The Repair tools are their own buttons,
 * before the voice is separated, over the model memory's markup, as
 * `KaraokeMakerSpeechMemoryPanel` draws it: the panel asks the reader's
 * computer which models it holds, and here none is downloaded yet.
 */

const nothing = () => undefined;
const PLAYHEAD = createKaraokeLiveValue(HELP_PLAYHEAD_MS);
const CONTROL_ID = 'help-maker-lyrics';

const LINES = HELP_MAKER_PROJECT.lyrics.lines.filter(
  (line) => !karaokeMakerLineIsSection(line),
);
const TOKENS: IKaraokeMakerToken[] = LINES.flatMap((line) => line.tokens);
/** "lit", in "Every wave a little song": the word the stage is on. */
const PICKED = TOKENS.find(
  (token) =>
    token.startMs !== undefined &&
    token.endMs !== undefined &&
    token.startMs <= HELP_PLAYHEAD_MS &&
    token.endMs > HELP_PLAYHEAD_MS,
);
const SELECTION = PICKED && { kind: 'word' as const, id: PICKED.id };
const DRAFT = LINES.map((line) =>
  line.tokens
    .map((token, index) =>
      index > 0 && token.startsWord
        ? ` ${token.text.trim()}`
        : token.text.trim(),
    )
    .join(''),
).join('\n');
const WORD_COUNT = DRAFT.split(/\s+/).filter(Boolean).length;
const FOCUS = karaokeMakerLyricFocus(
  TOKENS.flatMap((token) => {
    const lineIndex = LINES.findIndex((line) => line.tokens.includes(token));
    const line = LINES[lineIndex];
    return token.startMs === undefined || token.endMs === undefined
      ? []
      : [
          {
            id: token.id,
            lineIndex,
            lineStartMs: line.tokens[0].startMs ?? token.startMs,
            lineEndMs: line.tokens[line.tokens.length - 1].endMs ?? token.endMs,
            startMs: token.startMs,
            endMs: token.endMs,
          },
        ];
  }),
  HELP_PLAYHEAD_MS,
);

/** The lyrics dialog, open on the help song with one word picked. */
export const MakerLyricsDrawing = () => {
  const { t } = useTranslation();
  const { selectedToken, selectedTokenTimingControls } =
    useMakerSelectionDetails({
      selection: SELECTION,
      tokens: TOKENS,
      project: HELP_MAKER_PROJECT,
      lineEntryCapture: undefined,
      lyricLines: LINES,
      song: HELP_SONG,
    });
  const original =
    HELP_MAKER_PROJECT.lyrics.language ?? KARAOKE_ORIGINAL_LANGUAGE;
  return (
    <DialogFrame
      className="karaoke-maker__lyrics-modal"
      icon={<MenuIcon name="song" />}
      eyebrow={t('karaoke.maker.lyricsEyebrow')}
      title={t('karaoke.maker.lyricsTitle')}
      titleId="help-maker-lyrics-title"
      description={t('karaoke.maker.lyricsReferenceHint')}
      closeLabel={t('support.close')}
      onClose={nothing}
      footer={
        <div className="dialog-frame__actions">
          <button type="button" className="button small subtle">
            {t('karaoke.maker.acceptLyrics')}
          </button>
          <button type="button" className="button small subtle">
            {t('karaoke.maker.acceptAndRecordLines')}
          </button>
          <button type="button" className="button small">
            {t('karaoke.maker.detectTimingMelody')}
          </button>
        </div>
      }
    >
      <div className="karaoke-maker__lyrics-editor-body">
        <section className="karaoke-maker__lyrics-source">
          <div className="karaoke-maker__lyrics-section-head">
            <strong>{t('karaoke.maker.referenceLyrics')}</strong>
            <div className="karaoke-maker__lyrics-source-actions">
              <span>
                {t('karaoke.maker.lyricsWordCount', { count: WORD_COUNT })}
              </span>
              <button type="button">
                <KaraokeMakerToolIcon name="project" />
                <span>{t('karaoke.maker.loadLyricsFile')}</span>
              </button>
              <button type="button">
                <MenuIcon name="copyText" />
                <span>{t('edit.paste.button')}</span>
              </button>
            </div>
          </div>
          <div className="karaoke-maker__lyrics-target">
            <span>{t('karaoke.translation.target')}</span>
            <Dropdown
              name={t('karaoke.translation.target')}
              options={[
                {
                  value: original,
                  label: t('karaoke.translation.original'),
                  display: t('karaoke.translation.original'),
                },
              ]}
              value={original}
              isDisabled={false}
              placement="down"
              handleChange={nothing}
            />
          </div>
          <KaraokeMakerLyricsSourceEditor
            value={DRAFT}
            disabled={false}
            project={HELP_MAKER_PROJECT}
            onChange={nothing}
            placeholder={t('karaoke.maker.lyricsPlaceholder')}
          />
        </section>
        <KaraokeMakerLyricsWordList
          activeLyricFocus={FOCUS}
          draggedWordId={undefined}
          dropLineId={undefined}
          lyricsDraftChanged={false}
          moveLyricsEditorWord={nothing}
          previewProject={HELP_MAKER_PROJECT}
          previewTokens={TOKENS}
          selectLyricsEditorToken={nothing}
          selection={SELECTION}
          setDraggedWordId={nothing}
          setDropLineId={nothing}
          timingEditingLocked={false}
          renderLyricsModalWordInspector={() => (
            <KaraokeMakerWordInspector
              selectedToken={selectedToken}
              tokens={TOKENS}
              playhead={PLAYHEAD}
              isProcessing={false}
              controlId={CONTROL_ID}
              onMoveSelection={nothing}
              onAudition={nothing}
              onStartLineEntry={nothing}
              onTimingChange={nothing}
              renderTimingSliders={(idPrefix) => (
                <KaraokeMakerTimingSliders
                  idPrefix={idPrefix}
                  selectedTokenTimingControls={selectedTokenTimingControls}
                  updateSelectedTokenTiming={nothing}
                />
              )}
            />
          )}
        />
      </div>
    </DialogFrame>
  );
};

const MODELS: readonly TranslationKey[] = [
  'karaoke.maker.modelWhisper',
  'karaoke.maker.modelPitch',
  'karaoke.maker.modelSeparation',
];
const POLICIES = ['ask', 'auto', 'keep'] as const;

/** The Repair tools, open, before the song's voice is separated. */
export const MakerToolsDrawing = () => {
  const { t } = useTranslation();
  return (
    <div className="karaoke-maker__tool-popover karaoke-maker__action-popover karaoke-maker__analysis-popover">
      <KaraokeMakerAnalysisTools
        isAnalysing={false}
        onDetectLyrics={nothing}
        onDetectMelody={nothing}
        onRebuild={nothing}
        isUsingSongAudio
        onChooseVocalStem={nothing}
        onRemoveBackground={nothing}
      />
      <section className="karaoke-maker__memory-panel">
        <div className="karaoke-maker__memory-heading">
          <span aria-hidden="true" />
          <strong>{t('karaoke.maker.speechMemory')}</strong>
          <em>{t('karaoke.maker.speechMemoryMissing')}</em>
        </div>
        <ul className="karaoke-maker__memory-models">
          {MODELS.map((model) => (
            <li key={model}>
              <span aria-hidden="true" />
              <strong>{t(model)}</strong>
              <em>{t('karaoke.maker.speechMemoryMissing')}</em>
              <span className="karaoke-maker__memory-bytes">—</span>
            </li>
          ))}
        </ul>
        <span className="karaoke-maker__memory-label">
          {t('karaoke.maker.memoryAfterUse')}
        </span>
        <div className="karaoke-maker__memory-options" role="group">
          {POLICIES.map((policy) => (
            <button
              key={policy}
              type="button"
              className={policy === 'ask' ? 'is-active' : ''}
            >
              {t(`karaoke.maker.memoryPolicy.${policy}`)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
