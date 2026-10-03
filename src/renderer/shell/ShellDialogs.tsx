/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import { PRODUCT_VERSION } from 'common/branding';
import { errorText } from 'common/errors';
import { featureTourDismissal } from 'common/featureTour';
import { SUPPORT_CONTRIBUTED_KEY } from 'common/support';
import AccountDialog from '../account/AccountDialog';
import AboutDialog from '../components/AboutDialog';
import AudioEngineDialog from '../components/AudioEngineDialog';
import AudioTroubleshooter from '../components/AudioTroubleshooter';
import BugReportDialog from '../components/BugReportDialog';
import DisclaimerGate from '../components/DisclaimerGate';
import EngineTroubleNotice from '../components/EngineTroubleNotice';
import EngineUpdateNotice from '../components/EngineUpdateNotice';
import FeatureTour from '../components/featureTour/FeatureTour';
import { featureTourFor } from '../components/featureTour/slides';
import MakerMonthNotice from '../components/MakerMonthNotice';
import MandatoryUpdateModal from '../components/MandatoryUpdateModal';
import PlusTermsNotice from '../components/PlusTermsNotice';
import PlusWelcomeDialog from '../components/PlusWelcomeDialog';
import ProcessesDialog from '../components/ProcessesDialog';
import RestartAudioDialog from '../components/RestartAudioDialog';
import SceneReviewNotice from '../components/SceneReviewNotice';
import SongEqNotice from '../components/SongEqNotice';
import SongSoundNotice from '../components/SongSoundNotice';
import SongSoundSaveNotice from '../components/SongSoundSaveNotice';
import SongSoundHost from '../audio/SongSoundHost';
import SpeechMemoryNotice from '../components/SpeechMemoryNotice';
import UpdateNotice from '../components/UpdateNotice';
import WhatsNewDialog from '../components/WhatsNewDialog';
import SceneReportHost from '../plus/SceneReportHost';
import PrereqMissingModal from '../PrereqMissingModal';
import SupportDialog from '../SupportDialog';
import { prereqBannerEngine } from '../utils/audioEngineApi';
import { resetEuphoriaMode } from '../utils/euphoriaMode';
import { useFluidEqShell } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { resetRhythmRun } from '../utils/rhythmRun';
import type { TWorkspaceTab } from '../workspaceTabs';
import { ImportNotice, RecoverableErrorNotice } from './ShellNotices';
import {
  FEATURE_TOUR_DISMISSED_KEY,
  type TShellDialogs,
} from './useShellDialogs';
import type useShellEngine from './useShellEngine';

/** What this version brought, then the standing slides. */
const TOUR_SLIDES = featureTourFor(PRODUCT_VERSION);

export interface IShellDialogsProps {
  dialogs: TShellDialogs;
  engine: ReturnType<typeof useShellEngine>;
  /**
   * No engine chosen yet. Its own name because it is answered by a dialog
   * rather than by the red banner every other blocking failure raises.
   */
  isEngineUnchosen: boolean;
  selectTopWorkspaceTab: (tab: TWorkspaceTab) => void;
}

/**
 * Everything that arrives over the workspace: the dialogs, the engine's
 * notices and the corner notices, in the order they stack.
 */
const ShellDialogs = ({
  dialogs,
  engine,
  isEngineUnchosen,
  selectTopWorkspaceTab,
}: IShellDialogsProps) => {
  const { globalError, isBlockingError, isLoading, setGlobalError } =
    useFluidEqShell();
  const { t } = useTranslation();
  const { engineStatus } = engine;
  const {
    showBugReport,
    setShowBugReport,
    showAbout,
    setShowAbout,
    showTroubleshooter,
    setShowTroubleshooter,
    showFeatureTour,
    setShowFeatureTour,
    whatsNewScope,
    setWhatsNewScope,
  } = dialogs;
  return (
    <>
      {/* Only a genuinely fatal condition takes the screen. Anything else is
          reported without touching the editor: a preset that failed to save
          is no reason to hide an equalizer that is still working. */}
      {showBugReport && (
        <BugReportDialog onClose={() => setShowBugReport(false)} />
      )}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      {/* The repairs are the same handlers the menu calls directly. Passed
          in rather than imported there, so there is one definition of what
          "reinstall Equalizer APO" does — including the confirmation and the
          restart advice that follows it. */}
      {/* No creature in the corner while the header is away. The bar comes
          back the moment the pointer reaches an edge — see the reveal in
          GraphTheme — and the creature comes back with it, in the bar where
          it lives. A second copy of it floating over the picture was a
          piece of chrome that the mode exists to get rid of. */}
      {showTroubleshooter && (
        <AudioTroubleshooter
          engine={engineStatus?.engine ?? null}
          onClose={() => setShowTroubleshooter(false)}
          onRestartAudio={engine.handleRestartWindowsAudio}
          onReconfigure={engine.handleConfigureEqualizerApo}
          onReinstallApo={engine.handleReinstallApo}
          onEnableEngine={engine.handleTroubleshootEnableEngine}
          onRemoveEngineFromOutput={engine.handleTroubleshootRemoveEngine}
        />
      )}
      {/* No engine chosen at all is a question, not a fault: the same dialog
          the menu opens, without a way out of it, because there is nothing
          behind it that works until it is answered. `engineStatus` is
          undefined only while main's first answer is in flight, and the
          loading screen covers that. */}
      {isEngineUnchosen
        ? engineStatus && (
            <AudioEngineDialog
              status={engineStatus}
              onApply={engine.handleApplyAudioEngine}
            />
          )
        : globalError &&
          isBlockingError && (
            <PrereqMissingModal
              key={dialogs.prereqNonce}
              engine={prereqBannerEngine(globalError.code, engineStatus)}
              isLoading={isLoading}
              onRetry={engine.handlePrereqRetry}
              onInstallFluid={engine.handleInstallFluidEngine}
              errorMsg={errorText(globalError, t).title}
              actionMsg={errorText(globalError, t).action}
            />
          )}
      {/* Never beside the blocking copy of itself: two identical dialogs
          stacked, one of which cannot be closed, is the worst possible way
          to ask a question once. */}
      {engine.showEngineDialog && !isEngineUnchosen && engineStatus && (
        <AudioEngineDialog
          status={engineStatus}
          onApply={engine.handleApplyAudioEngine}
          onCancel={engine.closeEngineDialog}
          onApoAction={engine.handleApoAction}
        />
      )}
      {engine.audioRestart.isOpen && !engine.suppressAudioNotices && (
        <RestartAudioDialog
          phase={engine.audioRestart.phase}
          outcome={engine.audioRestart.outcome}
          onRestart={engine.audioRestart.run}
          onClose={engine.audioRestart.close}
        />
      )}
      {/* Steps aside for the two dialogs its own buttons open, and for
          the ones that take the whole window: whatever it says can wait
          until they are answered, and it is still true afterwards. */}
      <EngineTroubleNotice
        trouble={engine.engineTrouble}
        isHidden={
          engine.suppressAudioNotices ||
          engine.isTryingSlots ||
          engine.audioRestart.isOpen ||
          engine.showEngineDialog ||
          isEngineUnchosen ||
          Boolean(globalError && isBlockingError)
        }
        onRestartAudio={engine.handleRestartWindowsAudio}
        onUseApo={engine.handleOpenEngineDialog}
        onTryAnotherSlot={engine.handleTryAnotherSlot}
        onInstallEngine={engine.handleInstallEngineForTrouble}
        reopenCount={engine.engineAskCount}
      />
      {/* Waits for the same things, for the troubleshooter, and for the
          tour and the release notes that open on the first launch after an
          update — the launch this is most likely to have something to say
          on. Two panels arriving together on first run read as a
          malfunction. */}
      <EngineUpdateNotice
        update={engine.engineUpdate}
        isHidden={
          engine.audioRestart.isOpen ||
          engine.showEngineDialog ||
          isEngineUnchosen ||
          Boolean(globalError && isBlockingError) ||
          showTroubleshooter ||
          showFeatureTour ||
          whatsNewScope !== null
        }
      />
      {globalError && !isBlockingError && (
        <RecoverableErrorNotice
          error={globalError}
          onDismiss={() => setGlobalError(undefined)}
        />
      )}
      {dialogs.importNotice && (
        <ImportNotice
          summary={dialogs.importNotice}
          onDismiss={() => dialogs.setImportNotice('')}
        />
      )}
      {/* Bottom left, opposite the failure notices, so two things arriving
          at once do not land on top of each other. */}
      <UpdateNotice />
      {/* Here rather than in the Karaoke tab that owns the model: the idle
          timer that raises it runs for as long as the model is loaded, and
          asking inside a tab nobody is looking at held the RAM until the
          user happened to come back. */}
      <SpeechMemoryNotice />
      {/* Here for the same reason: the song that was just matched can start
          playing while the user is on any tab, and the loaned curve is
          already audible before this ever draws. */}
      <SongEqNotice />
      {/* And the song's own sound: put on by whichever song settles, on
          whatever tab is open. Its host beside it, because it reads every
          band and every position a player reports, and redraws only itself. */}
      <SongSoundHost />
      <SongSoundNotice />
      <SongSoundSaveNotice />
      {/* Here too: the terms promise that the app tells a member when they
          change, and a member need never open the Plus tab to use Plus. */}
      <PlusTermsNotice />
      {/* Here for the same reason: a scene waiting for the admin, or a
          maker's scene approved or not, is news on whichever tab is open. */}
      <SceneReviewNotice />
      {/* The week's warning before a maker's earned Plus runs out. Beside
          the review news, because it is the same kind of thing: something
          about their scenes that can land on any tab. */}
      <MakerMonthNotice />
      {/* A scene reported from the looks: the menu it was asked from
          closes under the dialog, so the dialog lives here. */}
      <SceneReportHost />
      {/* The one moment a membership turning on is marked. Here rather than
          in the Plus tab, because paying is done from the account panel and
          the answer can land with any tab open. */}
      <PlusWelcomeDialog />
      {showFeatureTour && (
        <FeatureTour
          version={PRODUCT_VERSION}
          slides={TOUR_SLIDES}
          onClose={(dontShowAgain) => {
            const dismissal = featureTourDismissal(
              PRODUCT_VERSION,
              dontShowAgain,
            );
            if (dismissal) {
              localStorage.setItem(FEATURE_TOUR_DISMISSED_KEY, dismissal);
            } else {
              localStorage.removeItem(FEATURE_TOUR_DISMISSED_KEY);
            }
            setShowFeatureTour(false);
          }}
          // The whole history, on top of the tour: someone who followed
          // the link asked to read, not to be told the headline again.
          onShowReleaseNotes={() => setWhatsNewScope('all')}
          isCovered={whatsNewScope !== null}
          onOpenTab={(tab) => {
            // Landing on the tab is not being done with the tour: the tick
            // was not offered a chance, so it counts as left unticked.
            localStorage.removeItem(FEATURE_TOUR_DISMISSED_KEY);
            setShowFeatureTour(false);
            selectTopWorkspaceTab(tab);
          }}
        />
      )}
      {whatsNewScope && (
        <WhatsNewDialog
          scope={whatsNewScope}
          onClose={() => setWhatsNewScope(null)}
        />
      )}
      {dialogs.showProcessesDialog && (
        <ProcessesDialog
          onClose={() => dialogs.setShowProcessesDialog(false)}
        />
      )}

      {dialogs.accountDialogPage !== undefined && (
        <AccountDialog
          initialPage={dialogs.accountDialogPage}
          onClose={() => dialogs.setAccountDialogPage(undefined)}
        />
      )}

      {dialogs.showSupportDialog && (
        <SupportDialog
          // Opens on top rather than replacing this one. Reading the
          // notes is a detour from deciding whether to contribute, not a
          // departure from it — closing them should put you back where you
          // were, not leave you staring at the workspace.
          onShowReleaseNotes={() => setWhatsNewScope('all')}
          isCovered={whatsNewScope !== null}
          hasContributed={dialogs.hasContributed}
          onContributed={() => {
            localStorage.setItem(SUPPORT_CONTRIBUTED_KEY, 'true');
            dialogs.setHasContributed(true);
          }}
          // Development only — the button that calls this is compiled out of
          // a release build. Both halves have to go: the badge is what gates
          // the game, and a run left standing would keep the whole window in
          // euphoria mode for a creature that no longer has anything to
          // celebrate.
          onResetContribution={() => {
            localStorage.removeItem(SUPPORT_CONTRIBUTED_KEY);
            dialogs.setHasContributed(false);
            resetRhythmRun();
            // The unlock goes too. Leaving it would put a working euphoria
            // switch on the titlebar of an install that has just been reset
            // to never having earned one.
            resetEuphoriaMode();
          }}
          onClose={() => dialogs.setShowSupportDialog(false)}
        />
      )}
      {/* Last, and in this order, because these two are the only things that
          arrive over the top of the workspace on their own.

          The acknowledgement is second, and therefore in front. It is the
          only one of the pair that cannot be dismissed, and a gate drawn
          underneath a dialog it is holding focus away from is a window
          nobody can use: its focus lock would keep pulling focus out of the
          update notice, and its Escape handler would eat the key that
          notice closes on. Front-most is the only place a lock belongs. */}
      <MandatoryUpdateModal />
      <DisclaimerGate />
    </>
  );
};

export default ShellDialogs;
