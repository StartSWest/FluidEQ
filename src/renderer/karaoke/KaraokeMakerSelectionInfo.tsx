/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dispatch, Fragment, ReactNode, SetStateAction } from 'react';
import {
  IKaraokeMakerNote,
  IKaraokeMakerToken,
} from '../../common/karaoke/makerProject';
import { karaokeLeadNoteArticulation } from '../../common/karaoke/melodyArticulation';
import { midiName } from './makerCanvasGeometry';
import { useTranslation } from '../utils/I18nContext';
import useKaraokeNoteAudition from './useKaraokeNoteAudition';
import { useKaraokeMakerProject } from './useKaraokeMakerProject';
import { formatClock } from './makerFormat';
import { replaceNote, syllablesAtCutPoints } from './makerProjectEdits';
import { ISyllableSplitDraft } from './useMakerNoteEditing';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';

/**
 * The inspector beside the canvas: what is selected, and what can be done to it.
 *
 * Three panels that are really one, because only one can ever show: a word, a
 * note, or the word being cut into syllables. It was a `renderSelectionInfo`
 * closure inside the component, which is what a component looks like before it
 * is one.
 *
 * The editing operations arrive as props rather than being called here. This
 * panel decides what to offer and how to label it; the hook that owns the
 * project decides what the buttons do, and keeping that split means the panel
 * can be rendered in a test without a project behind it.
 */
export interface IKaraokeMakerSelectionInfoProps extends Pick<
  ReturnType<typeof useKaraokeMakerProject>,
  'project' | 'commit'
> {
  /** Prefix for the ids that tie each control to its label. */
  controlId: string;
  playheadMs: number;
  noteAudition: ReturnType<typeof useKaraokeNoteAudition>;

  selectedToken: IKaraokeMakerToken | undefined;
  selectedNote: IKaraokeMakerNote | undefined;
  /** The word a selected note is attached to, if it is attached to one. */
  selectedNoteToken: IKaraokeMakerToken | undefined;
  selectedNoteIds: Set<string>;

  syllableSplitDraft: ISyllableSplitDraft | undefined;
  setSyllableSplitDraft: Dispatch<
    SetStateAction<ISyllableSplitDraft | undefined>
  >;

  /**
   * The timing sliders, passed in rather than rendered here.
   *
   * The same controls appear in the lyrics dialog, which already receives them
   * this way; duplicating them so this panel could own a copy would be two
   * places to fix when a slider changes.
   */
  renderTimingSliders: (idPrefix: string) => ReactNode;
  noteKindLabel: (kind: IKaraokeMakerNote['kind']) => string;

  applySyllableSplit: () => void;
  auditionLyricsToken: (token: IKaraokeMakerToken) => void;
  deleteSelection: () => void;
  detachSelectedNotes: () => void;
  splitSelectedLyricsWord: () => void;
  toggleSyllableCutPoint: (cutPoint: number) => void;
  updateSelectedTokenTiming: (update: {
    text?: string;
    startMs?: number;
    durationMs?: number;
  }) => void;
}

const KaraokeMakerSelectionInfo = ({
  applySyllableSplit,
  auditionLyricsToken,
  commit,
  controlId,
  deleteSelection,
  detachSelectedNotes,
  noteAudition,
  noteKindLabel,
  playheadMs,
  project,
  renderTimingSliders,
  selectedNote,
  selectedNoteIds,
  selectedNoteToken,
  selectedToken,
  setSyllableSplitDraft,
  splitSelectedLyricsWord,
  syllableSplitDraft,
  toggleSyllableCutPoint,
  updateSelectedTokenTiming,
}: IKaraokeMakerSelectionInfoProps) => {
  const { t } = useTranslation();
  if (syllableSplitDraft) {
    const characters = Array.from(syllableSplitDraft.word);
    const syllables = syllablesAtCutPoints(
      syllableSplitDraft.word,
      syllableSplitDraft.cutPoints,
    );
    const characterEntries = characters.reduce<
      Array<{ character: string; cutPoint: number; key: string }>
    >((entries, character) => {
      const cutPoint = entries.length + 1;
      return [
        ...entries,
        {
          character,
          cutPoint,
          key: `${characters.slice(0, cutPoint).join('')}|${characters
            .slice(cutPoint)
            .join('')}`,
        },
      ];
    }, []);
    const syllableEntries = syllables.reduce<
      Array<{ key: string; syllable: string; showDivider: boolean }>
    >(
      (entries, syllable) => [
        ...entries,
        {
          key: `${entries.map((entry) => entry.syllable).join('')}|${syllable}`,
          syllable,
          showDivider: entries.length > 0,
        },
      ],
      [],
    );
    return (
      <div className="karaoke-maker__syllable-editor">
        <div className="karaoke-maker__syllable-editor-copy">
          <span>{t('karaoke.maker.syllableEditorEyebrow')}</span>
          <strong>
            {t('karaoke.maker.syllableEditorTitle', {
              word: syllableSplitDraft.word,
            })}
          </strong>
          <p>{t('karaoke.maker.syllableEditorHint')}</p>
        </div>
        <div
          className="karaoke-maker__syllable-cuts"
          aria-label={t('karaoke.maker.syllableEditorTitle', {
            word: syllableSplitDraft.word,
          })}
        >
          {characterEntries.map(({ character, cutPoint, key }) => (
            <Fragment key={key}>
              <span>{character}</span>
              {cutPoint < characters.length && (
                <button
                  type="button"
                  className={
                    syllableSplitDraft.cutPoints.includes(cutPoint)
                      ? 'is-cut'
                      : undefined
                  }
                  aria-pressed={syllableSplitDraft.cutPoints.includes(cutPoint)}
                  aria-label={t('karaoke.maker.syllableSplitPoint', {
                    text: characters.slice(0, cutPoint).join(''),
                  })}
                  onClick={() => toggleSyllableCutPoint(cutPoint)}
                >
                  <span />
                </button>
              )}
            </Fragment>
          ))}
        </div>
        <div className="karaoke-maker__syllable-preview">
          <span>{t('karaoke.maker.syllableEditorPreview')}</span>
          <output>
            {syllableEntries.map(({ key, syllable, showDivider }) => (
              <Fragment key={key}>
                {showDivider && <i aria-hidden="true">·</i>}
                <strong>{syllable}</strong>
              </Fragment>
            ))}
          </output>
        </div>
        <div className="karaoke-maker__syllable-actions">
          <button
            type="button"
            onClick={() => setSyllableSplitDraft(undefined)}
          >
            {t('karaoke.maker.cancel')}
          </button>
          <button
            type="button"
            className="is-primary"
            disabled={syllables.length < 2}
            onClick={applySyllableSplit}
          >
            <KaraokeMakerToolIcon name="split" />
            {t('karaoke.maker.applySyllableSplit')}
          </button>
        </div>
      </div>
    );
  }
  if (selectedNoteIds.size > 1) {
    const selectedNotes = project.melody.notes.filter((note) =>
      selectedNoteIds.has(note.id),
    );
    const hasAttachedNotes = selectedNotes.some((note) => note.tokenId);
    return (
      <div className="karaoke-maker__note-selection-inspector">
        <span>
          <strong>{selectedNoteIds.size}</strong>
          {t('karaoke.maker.notesSelected')}
        </span>
        {hasAttachedNotes && (
          <button type="button" onClick={detachSelectedNotes}>
            <KaraokeMakerToolIcon name="detach" />
            {t('karaoke.maker.detachNotes')}
          </button>
        )}
        <button type="button" onClick={deleteSelection}>
          <KaraokeMakerToolIcon name="remove" />
          {t('karaoke.maker.delete')}
        </button>
        <span className="karaoke-maker__note-link-help">
          {t('karaoke.maker.noteAttachHelp')} {t('karaoke.maker.noteCopyHelp')}
        </span>
      </div>
    );
  }
  if (selectedNote) {
    return (
      <div className="karaoke-maker__note-inspector">
        <div className="karaoke-maker__note-inspector-summary">
          <strong>{midiName(selectedNote.targetMidi)}</strong>
          <span>
            {formatClock(selectedNote.startMs)} →{' '}
            {formatClock(selectedNote.endMs)}
          </span>
          <button
            type="button"
            className="karaoke-maker__audition"
            onPointerDown={() =>
              noteAudition.play(
                selectedNote.targetMidi,
                karaokeLeadNoteArticulation(selectedNote).durationMs,
              )
            }
            onPointerUp={() => noteAudition.stop()}
            onPointerCancel={() => noteAudition.stop()}
            onPointerLeave={() => noteAudition.stop()}
            title={t('karaoke.maker.hearNote')}
          >
            ◖)) {t('karaoke.maker.hearNote')}
          </button>
        </div>
        <div
          className="karaoke-maker__kind-picker"
          aria-label={t('karaoke.maker.addNote')}
        >
          {(['normal', 'golden', 'free'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              className={selectedNote.kind === kind ? 'is-active' : undefined}
              aria-pressed={selectedNote.kind === kind}
              onClick={() =>
                commit((current) =>
                  replaceNote(current, selectedNote.id, (note) => ({
                    ...note,
                    kind,
                  })),
                )
              }
            >
              {noteKindLabel(kind)}
            </button>
          ))}
        </div>
        <div className="karaoke-maker__note-inspector-link">
          <span className="karaoke-maker__note-link">
            {selectedNoteToken
              ? t('karaoke.maker.attachedTo', {
                  word: selectedNoteToken.text,
                })
              : t('karaoke.maker.noteUnattached')}
          </span>
          {selectedNoteToken && (
            <button type="button" onClick={detachSelectedNotes}>
              <KaraokeMakerToolIcon name="detach" />
              {t('karaoke.maker.detachNotes')}
            </button>
          )}
          {selectedNoteToken && (
            <button type="button" onClick={splitSelectedLyricsWord}>
              <KaraokeMakerToolIcon name="split" />
              {t('karaoke.maker.splitWordSyllables')}
            </button>
          )}
          <span className="karaoke-maker__note-link-help">
            {t('karaoke.maker.noteAttachHelp')}{' '}
            {t('karaoke.maker.noteCopyHelp')}
          </span>
        </div>
      </div>
    );
  }
  if (selectedToken) {
    const timing =
      selectedToken.startMs === undefined
        ? t('karaoke.maker.untimed')
        : `${formatClock(selectedToken.startMs)} → ${formatClock(selectedToken.endMs ?? selectedToken.startMs)}`;
    return (
      <div className="karaoke-maker__word-inspector">
        <div className="karaoke-maker__word-inspector-identity">
          <span>{t('karaoke.maker.lyricsSelectedWord')}</span>
          <div>
            <strong className="karaoke-maker__word-inspector-title">
              {selectedToken.text}
            </strong>
            <output>{timing}</output>
          </div>
          <label htmlFor={`${controlId}-selected-word`}>
            <span>{t('karaoke.maker.wordText')}</span>
            <input
              id={`${controlId}-selected-word`}
              key={selectedToken.id}
              defaultValue={selectedToken.text}
              onBlur={(event) => {
                if (event.target.value.trim() !== selectedToken.text) {
                  updateSelectedTokenTiming({ text: event.target.value });
                }
              }}
            />
          </label>
        </div>
        {renderTimingSliders(`${controlId}-selected-word-${selectedToken.id}`)}
        <div className="karaoke-maker__word-inspector-actions">
          <button
            type="button"
            onClick={() => updateSelectedTokenTiming({ startMs: playheadMs })}
          >
            <KaraokeMakerToolIcon name="timing" />
            {t('karaoke.maker.usePlayhead')}
          </button>
          <button
            type="button"
            disabled={selectedToken.startMs === undefined}
            onClick={() => auditionLyricsToken(selectedToken)}
          >
            <KaraokeMakerToolIcon name="preview" />
            {t('karaoke.maker.playWord')}
          </button>
          <button type="button" onClick={splitSelectedLyricsWord}>
            <KaraokeMakerToolIcon name="split" />
            {t('karaoke.maker.splitWordSyllables')}
          </button>
        </div>
      </div>
    );
  }
  return <span>{t('karaoke.maker.selectHint')}</span>;
};

export default KaraokeMakerSelectionInfo;
