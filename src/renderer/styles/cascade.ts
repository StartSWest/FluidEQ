/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * EVERY STYLESHEET THE WINDOW HAS, IN THE ORDER THE CASCADE READS THEM.
 *
 * Imported first by `index.tsx`, ahead of everything else, so this list and
 * nothing else decides the order: a production build writes the sheets into
 * `style.css` in the order they are first reached, and development injects a
 * `<style>` for each in the order its module first runs — both of which are
 * this list now. A component importing its own sheet as well is harmless: by
 * then the sheet has already been placed.
 *
 * It exists because most pages are fetched on demand (`workspacePages.ts`).
 * Reached only through a page, a sheet would travel in that page's chunk and
 * arrive after everything else — last in the cascade, where it wins every tie
 * it used to lose. Rules of equal weight here settle a lot of those ties
 * (`Rainbow.scss` beating `App.scss` without `!important` is one written down),
 * so a page opened second would have drawn the rest of the window differently
 * from a page opened first. Held here, every sheet is loaded at the start, as
 * it always was, and only the code arrives later.
 *
 * The order is the one the window was built with on 2026-09-25, when the
 * sheets were still reached through the pages: the production `style.css`
 * came out byte for byte the same with this list as without it. A new sheet
 * goes where it should cascade — next to the sheets whose rules it answers —
 * and `stylesheetCascade.test.ts` fails for one that is imported anywhere in
 * the renderer and missing here.
 */
import './ConfigInspector.scss';
import './RichPick.scss';
import './Games.scss';
import './App.scss';
import './Rainbow.scss';
// The header's logo and name ("Signal"): over `.brand-mark`, and with
// Rainbow mode's own turn for them.
import './SignalBrand.scss';
import './BandMenu.scss';
import './ArrowButton.scss';
import './NumberInput.scss';
import './RangeInput.scss';
import './Slider.scss';
import './FrequencyBand.scss';
import './MainContent.scss';
import './MultiSelect.scss';
import './Spinner.scss';
import './Button.scss';
import './Dropdown.scss';
import './List.scss';
import './TextInput.scss';
import './Knob.scss';
import './Switch.scss';
import './GenreNotes.scss';
import './VoicingQuickPick.scss';
import './ActiveLayers.scss';
import './LatencyReadout.scss';
import './GameModeSwitch.scss';
import './EngineStrip.scss';
import './TitleRate.scss';
import './SongEqBadge.scss';
import './NowPlayingBar.scss';
import './SongEqSaveSwitch.scss';
import './Dsp.scss';
import './EqModeSelect.scss';
import './BandLayoutMenu.scss';
import './RestartAudioDialog.scss';
import './SupportPet.scss';
import './MemoryTrace.scss';
import './ShareScore.scss';
import './RhythmGame.scss';
import './Support.scss';
import './DialogHeader.scss';
import './LeaderboardName.scss';
import './SceneHands.scss';
import './ScenePreview.scss';
import './SceneBand.scss';
import './PlusTerms.scss';
import './LeaderboardCard.scss';
import './AccountForms.scss';
import './SignOutConfirm.scss';
import './PlusTrial.scss';
import './About.scss';
import './Account.scss';
import './LeaderboardGuide.scss';
import './LeaderboardStanding.scss';
import './AccountDeletion.scss';
import './Admin.scss';
import './PlusGifts.scss';
import './PlusToastStack.scss';
import './GalleryModeration.scss';
import './Review.scss';
import './Gallery.scss';
import './PlusWelcome.scss';
import './WallpaperMonitors.scss';
import './WallpaperControls.scss';
import './Studio.scss';
import './StudioControls.scss';
import './Lighting.scss';
import './StudioCode.scss';
import './LiveFigure.scss';
import './StudioMeters.scss';
import './StudioDialogs.scss';
import './StudioStage.scss';
import './StudioPublish.scss';
import './StudioPictures.scss';
import './StudioPictureLightbox.scss';
import './PaneResizer.scss';
import './StudioLocked.scss';
import './StudioMaker.scss';
import './CommunityRail.scss';
import './Community.scss';
import './Leaderboard.scss';
import './PlusRail.scss';
import './ForumLoading.scss';
import './Forum.scss';
import './ForumList.scss';
import './ForumThread.scss';
import './ForumPost.scss';
import './ForumProse.scss';
import './ForumComposer.scss';
import './Processes.scss';
import './Modal.scss';
import './BugReport.scss';
import './AudioTroubleshooter.scss';
import './SideBar.scss';
import './VideoBrowser.scss';
import './LibraryStageArt.scss';
import './LibraryFolderArt.scss';
import './LibraryCoverFlow.scss';
import './Library.scss';
import './LibraryPlaceBar.scss';
import './LibrarySections.scss';
import './Karaoke.scss';
import './LookDesigner.scss';
import './SceneUpdateNotice.scss';
import './GraphSceneRemove.scss';
import './LookPicker.scss';
import './GraphTheme.scss';
import './PresetsBar.scss';
import './SidebarSection.scss';
import './AutoEQ.scss';
import './EqCurveChart.scss';
import './SquiglinkImport.scss';
import './AutoEQPanel.scss';
import './DeviceProfiles.scss';
import './ExtraOutputs.scss';
import './DriverPicker.scss';
import './WaveformVisualizer.scss';
import './Convolution.scss';
import './LabelledKnob.scss';
import './DspRoom.scss';
import './LanguagePicker.scss';
import './ActionsMenu.scss';
// The theme's slider in the player's menu, after the preference rows' own
// rules.
import './ThemeShade.scss';
import './UpdateNotice.scss';
import './SpeechMemoryNotice.scss';
import './SongEqNotice.scss';
import './PlusTermsNotice.scss';
import './SceneReviewNotice.scss';
import './PlusMemberWelcome.scss';
import './OverlayCard.scss';
import './WhatsNew.scss';
import './FeatureTour.scss';
import './HelpGuide.scss';
import './PlayerIcon.scss';
import './ToneKnob.scss';
import './WindowModeSwitch.scss';
import './MiniPlayer.scss';
import './RemoteAudio.scss';
import './Euphoria.scss';
import './ScenePulse.scss';
import './SceneAmbient.scss';
import './SceneCover.scss';
import './EngineTroubleNotice.scss';
import './EngineUpdateNotice.scss';
import './AudioEngineDialog.scss';
// After the window's own sheets: the tooltip layer is installed by
// `index.tsx` once the whole tree is imported, and its bubble floats over
// every surface. The crash screen stays last of all.
import './Tooltip.scss';
import './ErrorBoundary.scss';
