/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';
import {
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  KARAOKE_ORIGINAL_LANGUAGE,
} from '../../common/karaoke/makerProject';
import { IKaraokeMakerEditorView } from './karaokeEditorPersistence';
import { TKaraokeMakerExportFormat } from '../../common/karaoke/makerExport';
import { KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED } from './makerAi';
import { TDestructiveMakerAction } from './KaraokeMakerConfirmDialog';
import { useTranslation } from '../utils/I18nContext';
import { karaokeLanguageName } from './karaokeLanguageName';
import { KARAOKE_LANGUAGE_CODES } from './karaokeLanguageCodes';
import Dropdown from '../widgets/Dropdown';
import KaraokeMakerToolbarButton from './KaraokeMakerToolbarButton';
import KaraokeMakerTimingPopover from './KaraokeMakerTimingPopover';

/**
 * The tool strip in the header: what the next click will do.
 *
 * A hundred and ninety-two lines of the return, and the one part of the editor
 * that is purely modal — every control here arms something rather than doing
 * it. Which panel is open, which tool is held, what the timing nudge applies
 * to: all of it is state the canvas and the pointer handlers read back.
 *
 * The edit and analysis groups arrive already built. They were extracted into
 * their own components earlier and the component still assembles them, because
 * both are also reachable from the floating panels; rebuilding them here would
 * be a second copy of the same row.
 */
export interface IKaraokeMakerToolbarProps {
  toolsRef: RefObject<HTMLDivElement | null>;
  projectInputRef: RefObject<HTMLInputElement | null>;
  project: IKaraokeMakerProject;
  tokens: IKaraokeMakerToken[];
  selectedToken: IKaraokeMakerToken | undefined;

  /** Which floating panel is open, if any. */
  toolPanel: 'timing' | 'edit' | 'analysis' | undefined;
  setToolPanel: Dispatch<
    SetStateAction<'timing' | 'edit' | 'analysis' | undefined>
  >;
  toggleToolPanel: (panel: 'timing' | 'edit' | 'analysis') => void;
  /** Already built, because the floating panels show the same groups. */
  editTools: ReactNode;
  advancedAnalysisTools: ReactNode;

  /** Whether a nudge moves the whole song or only from the selected word. */
  timingScope: IKaraokeMakerEditorView['timingScope'];
  setTimingScope: Dispatch<
    SetStateAction<IKaraokeMakerEditorView['timingScope']>
  >;
  canShiftFromWord: boolean;
  wordShiftMs: number;
  shiftTimeline: (deltaMs: number) => void;

  handPanMode: boolean;
  toggleHandPanMode: () => void;

  /** Which lyric sheet is showing right now. */
  translationLanguage: string;
  /** The original's tag first, then each translation's, in the order it was
   * added. */
  translationLanguages: string[];
  setTranslationLanguage: (language: string) => void;
  /** Removes whichever translation is currently selected; a no-op target of
   * the original itself never reaches this, since the button that calls it
   * is disabled while the original is showing. */
  removeTranslation: (language: string) => void;

  exportOpen: boolean;
  setExportOpen: Dispatch<SetStateAction<boolean>>;
  exportProject: (format: TKaraokeMakerExportFormat) => Promise<void>;
  /**
   * Save the backing track, once separation has produced one.
   *
   * Undefined until then, and the entry is simply absent rather than disabled:
   * an export list is a list of things that exist, and a permanently greyed
   * row in it invites the question of what is broken.
   */
  onSaveInstrumental?: () => void;
  /** A translation target seeds an empty draft toward that language instead
   * of the original-replace flow every other caller wants. */
  openLyricsEditor: (translationTarget?: string) => void;
  setDestructiveAction: Dispatch<
    SetStateAction<TDestructiveMakerAction | undefined>
  >;
  /** Hidden while a run is going, so a second one cannot be started. */
}

const KaraokeMakerToolbar = ({
  advancedAnalysisTools,
  canShiftFromWord,
  editTools,
  exportOpen,
  exportProject,
  onSaveInstrumental,
  handPanMode,
  openLyricsEditor,
  project,
  projectInputRef,
  removeTranslation,
  selectedToken,
  setDestructiveAction,
  setExportOpen,
  setTimingScope,
  setToolPanel,
  setTranslationLanguage,
  shiftTimeline,
  timingScope,
  toggleHandPanMode,
  toggleToolPanel,
  tokens,
  toolPanel,
  toolsRef,
  translationLanguage,
  translationLanguages,
  wordShiftMs,
}: IKaraokeMakerToolbarProps) => {
  const { t } = useTranslation();
  // `karaokeTranslationLanguages` puts this exact expression first in the
  // list it returns — the sentinel is only the fallback for a project that
  // never declared a language, and UltraStar imports populate a real tag
  // from `#LANGUAGE` (ultrastar.ts -> project.ts), so the bare
  // `KARAOKE_ORIGINAL_LANGUAGE` constant is not a reliable stand-in for "the
  // original" once a project has one. Every place below that needs to know
  // whether an entry *is* the original compares against this instead.
  const originalLanguage = project.lyrics.language ?? KARAOKE_ORIGINAL_LANGUAGE;
  // A concrete first guess for "Add a language", so its own paste view opens
  // with a real language already selected rather than a blank Dropdown
  // trigger — the filter field is one keystroke away from the language the
  // user actually meant. Falls back to the list's own first entry only if
  // every one of them happened to equal `originalLanguage`, which a 99-entry
  // list and one tag never does in practice.
  const defaultTranslationTarget =
    KARAOKE_LANGUAGE_CODES.find((code) => code !== originalLanguage) ??
    KARAOKE_LANGUAGE_CODES[0];
  return (
    <div ref={toolsRef} className="karaoke-maker__tools">
      <div className="karaoke-maker__tool-group">
        <KaraokeMakerToolbarButton
          icon="project"
          label={t('karaoke.maker.openProject')}
          onClick={() => projectInputRef.current?.click()}
        />
        <KaraokeMakerToolbarButton
          icon="lyrics"
          label={t('karaoke.maker.lyrics')}
          // Wrapped, not the bare reference: `openLyricsEditor` now takes an
          // optional `translationTarget`, and a button's `onClick` is a DOM
          // event handler — React calls it with the click's `MouseEvent`
          // regardless of what TypeScript declared, so a bare reference here
          // would seed the draft empty and open the dialog in translation
          // mode on every ordinary "Lyrics" click.
          onClick={() => openLyricsEditor()}
        />
        <KaraokeMakerToolbarButton
          icon="clearLyrics"
          label={t('karaoke.maker.clearLyrics')}
          danger
          disabled={!tokens.length}
          onClick={() => setDestructiveAction('lyrics')}
        />
        <KaraokeMakerToolbarButton
          icon="clearNotes"
          label={t('karaoke.maker.clearNotes')}
          danger
          disabled={!project.melody.notes.length}
          onClick={() => setDestructiveAction('notes')}
        />
        <div className="karaoke-maker__tool-cluster">
          <KaraokeMakerToolbarButton
            icon="timing"
            label={t('karaoke.maker.lyricsTiming')}
            active={toolPanel === 'timing'}
            onClick={() => toggleToolPanel('timing')}
          />
          {toolPanel === 'timing' && (
            <KaraokeMakerTimingPopover
              scope={timingScope}
              onScopeChange={setTimingScope}
              canShiftFromWord={canShiftFromWord}
              shiftMs={timingScope === 'all' ? project.meta.gapMs : wordShiftMs}
              selectedWord={selectedToken?.text}
              onShift={shiftTimeline}
              onClose={() => setToolPanel(undefined)}
            />
          )}
        </div>
        <KaraokeMakerToolbarButton
          icon="hand"
          label={t('karaoke.maker.panView')}
          active={handPanMode}
          onClick={toggleHandPanMode}
        />
      </div>

      <div className="karaoke-maker__tool-group karaoke-maker__translation-group">
        <Dropdown
          name={t('karaoke.translation.picker')}
          options={translationLanguages.map((code) => ({
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
          }))}
          value={translationLanguage}
          isDisabled={false}
          placement="down"
          handleChange={setTranslationLanguage}
        />
        <KaraokeMakerToolbarButton
          icon="remove"
          label={t('karaoke.translation.remove')}
          danger
          disabled={translationLanguage === originalLanguage}
          onClick={() => removeTranslation(translationLanguage)}
        />
        {/* Small and subtle: adding a language is not the recommended action
            on a song that already has words, the way opening the lyrics editor
            or timing a line is.

            Opens the same lyrics dialog as the button beside it: the target-
            language field inside it is what tells the dialog to seed a
            translation instead of replacing the original, so there is only
            one paste surface to wire up rather than a second dialog. This
            entry point passes a real target so that field — and the draft —
            open already aimed at a translation instead of landing on the
            same "replace the original" default the other button wants. */}
        <button
          type="button"
          className="button small subtle"
          onClick={() => openLyricsEditor(defaultTranslationTarget)}
        >
          {t('karaoke.translation.add')}
        </button>
      </div>

      <div className="karaoke-maker__tool-group karaoke-maker__wide-edit-tools">
        {editTools}
      </div>
      <div className="karaoke-maker__tool-cluster karaoke-maker__compact-edit-tools">
        <KaraokeMakerToolbarButton
          icon="edit"
          label={t('karaoke.maker.toolsEdit')}
          active={toolPanel === 'edit'}
          onClick={() => toggleToolPanel('edit')}
        />
        {toolPanel === 'edit' && (
          <div className="karaoke-maker__tool-popover karaoke-maker__action-popover">
            {editTools}
          </div>
        )}
      </div>

      {KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED && (
        <div className="karaoke-maker__tool-group karaoke-maker__wide-analysis-tools">
          <div className="karaoke-maker__tool-cluster">
            <KaraokeMakerToolbarButton
              icon="melody"
              label={t('karaoke.maker.advanced')}
              active={toolPanel === 'analysis'}
              onClick={() => toggleToolPanel('analysis')}
            />
            {toolPanel === 'analysis' && (
              <div className="karaoke-maker__tool-popover karaoke-maker__action-popover karaoke-maker__analysis-popover">
                {advancedAnalysisTools}
              </div>
            )}
          </div>
        </div>
      )}
      {KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED && (
        <div className="karaoke-maker__tool-cluster karaoke-maker__compact-analysis-tools">
          <KaraokeMakerToolbarButton
            icon="melody"
            label={t('karaoke.maker.advanced')}
            active={toolPanel === 'analysis'}
            onClick={() => toggleToolPanel('analysis')}
          />
          {toolPanel === 'analysis' && (
            <div className="karaoke-maker__tool-popover karaoke-maker__action-popover karaoke-maker__analysis-popover">
              {advancedAnalysisTools}
            </div>
          )}
        </div>
      )}

      <div className="karaoke-maker__export-wrap">
        <KaraokeMakerToolbarButton
          icon="export"
          label={t('karaoke.maker.export')}
          active={exportOpen}
          onClick={() => {
            setToolPanel(undefined);
            setExportOpen((open) => !open);
          }}
        />
        {exportOpen && (
          <div className="karaoke-maker__export-menu">
            {/* Which sheet the lyric formats will contain, said before the
                click rather than discovered in the saved file. The toolbar's
                own picker is the answer — asking again here would be a second
                control for a question already on screen — so this reports it
                instead of offering it, and only when it is not the original.
                Reuses the timing popover's own hint paragraph: the same quiet
                caption, in a sibling menu. */}
            {translationLanguage !== originalLanguage && (
              <p className="karaoke-maker__timing-hint">
                {t('karaoke.translation.exportLanguage', {
                  language: karaokeLanguageName(translationLanguage),
                })}
              </p>
            )}
            <button
              type="button"
              onClick={() => exportProject('project').catch(() => undefined)}
            >
              {t('karaoke.maker.exportProject')}
            </button>
            <button
              type="button"
              onClick={() => exportProject('ultrastar').catch(() => undefined)}
            >
              {t('karaoke.maker.exportUltraStar')}
            </button>
            <button
              type="button"
              onClick={() => exportProject('lrc').catch(() => undefined)}
            >
              {t('karaoke.maker.exportLrc')}
            </button>
            <button
              type="button"
              onClick={() => exportProject('elrc').catch(() => undefined)}
            >
              {t('karaoke.maker.exportElrc')}
            </button>
            {onSaveInstrumental && (
              <button type="button" onClick={onSaveInstrumental}>
                {t('karaoke.maker.exportInstrumental')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KaraokeMakerToolbar;
