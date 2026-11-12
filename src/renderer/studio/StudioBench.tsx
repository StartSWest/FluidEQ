import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { memberLookId } from 'common/memberScenes';
import { resolveSceneName } from 'common/scenePacks';
import { useAccount } from '../account/accountStore';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import PlusToastStack from '../plus/PlusToastStack';
import { setGraphLook } from '../utils/graphStyle';
import { useTranslation } from '../utils/I18nContext';
import StudioChat from './chat/StudioChat';
import StudioChatColumn from './chat/StudioChatColumn';
import useStageCapture from './chat/useStageCapture';
import { useStudioChat } from './chat/studioChatStore';
import StudioCode, { problemLinesOf } from './StudioCode';
import { useCodeDraft } from './codeDraftStore';
import StudioMeters from './StudioMeters';
import StudioNewProjectDialog from './StudioNewProjectDialog';
import StudioProblems, {
  FILE_KEYS,
  firstErrorLine,
  STUDIO_PROBLEMS_ID,
} from './StudioProblems';
import { prefersReducedMotion } from '../utils/bandReveal';
import StudioProjects from './StudioProjects';
import SceneReviewMark from '../plus/SceneReviewMark';
import StudioPublishDialog from './StudioPublishDialog';
import StudioShareDialog from './StudioShareDialog';
import StudioShipCard from './StudioShipCard';
import StudioShipInspect from './StudioShipInspect';
import StudioShipMemberCopy from './StudioShipMemberCopy';
import StudioDrawing from './StudioDrawing';
import StudioFramingDialog from './StudioFramingDialog';
import Glyph from '../community/Glyph';
import StudioFullscreenPanes from './StudioFullscreenPanes';
import StudioListen from './StudioListen';
import StudioAnimations from './animations/StudioAnimations';
import useStudioAnimations from './animations/useStudioAnimations';
import StudioPictures, { pictureName } from './StudioPictures';
import StudioSettings from './StudioSettings';
import StudioStageArea from './StudioStageArea';
import StudioStageControls from './StudioStageControls';
import StudioStageStart from './StudioStageStart';
import StudioStarterLabels from './StudioStarterLabels';
import StudioStarterLabelsToggle from './StudioStarterLabelsToggle';
import { studioBenchCost, studioBenchStatus } from './studioBenchStatus';
import { useStarterLabelsShown } from './studioStarterGuide';
import useStudioStarter from './useStudioStarter';
import StudioTune from './StudioTune';
import StudioVersion from './StudioVersion';
import StudioWork, { type TStudioWorkTab } from './StudioWork';
import useStudioBenchLayout from './useStudioBenchLayout';
import useStudioAmbientTuning from './useStudioAmbientTuning';
import useStudioBaseline from './useStudioBaseline';
import useStudioKeep from './useStudioKeep';
import useStudioTuning from './useStudioTuning';
import useScenePictures from './useScenePictures';
import useStudioPublish from './useStudioPublish';
import useStudioReading from './useStudioReading';
import useStudioSharing, { type ISharingNotice } from './useStudioSharing';
import useStudioPreviewFile from './useStudioPreviewFile';
import useStudioAppColours from './useStudioAppColours';
import useStudioTint from './useStudioTint';
import { useStudioGridShown } from './studioPaper';
import useStudioSize from './useStudioSize';
import useFullscreenPanes from './useFullscreenPanes';
import useStageViewForAgent from './useStageViewForAgent';
import { useStageMotion } from './stageMotion';
import type { TStageHeard, TStageTrouble } from './StudioStage';
import StudioStageSound from './StudioStageSound';
import type { TStudioSignal } from './studioSignals';
import StudioStageLoading from './StudioStageLoading';
import troubleHoldsBack from './stageTrouble';
import unfitReason from './unfitReason';
import type { IStudioColours, IStudioPalettes } from './StudioSettings';
import { linkStudioFolder, type IStudioView } from './studioStore';

interface IStudioBenchProps {
  view: IStudioView;
  /** Brings the EQ page and its graph forward, for Play on the graph. */
  onShowGraph: () => void;
}

/**
 * The Studio: the scene live on the stage, the work on it in tabs under it,
 * and the chat with Claude that makes it in a pane the bench's whole height
 * beside it (Ivan, 2026-10-09, the redesign around the chat) — one surface
 * whether a project is open or not, so nothing a member saw on the first
 * visit is gone once they have a project. With none, the stage is where the
 * first one starts and everything that needs a scene waits, unlit, where it
 * will be.
 */
export default function StudioBench({ view, onShowGraph }: IStudioBenchProps) {
  const { t, locale } = useTranslation();
  const { state, pack, serial, problems } = view;
  const [signal, setSignal] = useState<TStudioSignal>('live');
  const {
    size,
    preview,
    hasPlayerParts,
    exitFullscreen,
    toggleFullscreen,
    togglePreview,
    togglePlayerParts,
  } = useStudioSize();
  const fullPanes = useFullscreenPanes(size === 'full');
  useStageViewForAgent(preview);
  const { motion, toggleMotion } = useStageMotion();
  const isGridShown = useStudioGridShown();
  // A Code tab file's unsaved draft, once main has built it, plays in place
  // of what is saved (`codeDraftStore.ts`). Each draft is a version of its
  // own to the stage, numbered below zero so it never meets a saved one.
  const codeDraft = useCodeDraft(state.activeId);
  const stageSerial = codeDraft ? -codeDraft.serial : serial;
  const [stageProblem, setStageProblem] = useState<{
    identity?: string;
    serial: number;
    value: TStageTrouble;
  }>();
  const trouble =
    stageProblem?.identity === state.activeId &&
    stageProblem?.serial === stageSerial
      ? stageProblem.value
      : undefined;
  const setTrouble = useCallback(
    (value: TStageTrouble) =>
      setStageProblem({
        identity: state.activeId,
        serial: stageSerial,
        value,
      }),
    [state.activeId, stageSerial],
  );
  const [scale, setScale] = useState(1);
  const [notice, setNotice] = useState<ISharingNotice>();
  const [naming, setNaming] = useState(false);
  const feed = useRef<TStageHeard | undefined>(undefined);
  // The bench on screen: the window's colour is the Studio's only then, and
  // the sound panel folded while it is.
  const benchRef = useRef<HTMLDivElement>(null);
  const { isWide } = useStudioBenchLayout(benchRef);
  // Full screen fills the screen with the grid, not the stage alone, so the
  // work pane and the chat can stand over the scene (Ivan, 2026-11-11).
  const gridRef = useRef<HTMLDivElement>(null);
  const sharing = useStudioSharing();
  const picture = useScenePictures(t('studio.picture.files'), view);
  const animations = useStudioAnimations(view);
  // How many times this bench has published, so the scene just published
  // becomes what Reset goes back to without reopening the project.
  const [publications, setPublications] = useState(0);
  const baseline = useStudioBaseline(state.activeId, publications);
  const tuner = useStudioTuning(pack, state.activeId, baseline);
  const ambient = useStudioAmbientTuning(pack, state.activeId, baseline);
  const colourControls: IStudioColours = {
    params: tuner.colourParams,
    values: tuner.colours,
    canReset: tuner.canResetColour,
    onChange: tuner.setColour,
    onCommit: tuner.chooseColour,
    onReset: tuner.resetColour,
  };
  const palettes: IStudioPalettes = {
    params: tuner.paletteParams,
    values: tuner.palettes,
    canReset: tuner.canResetPalette,
    onChange: tuner.setPalette,
    onCommit: tuner.choosePalette,
    onReset: tuner.resetPalette,
  };

  // A new version is a new chance: whatever went wrong with the last one is
  // forgotten until this one says otherwise.
  useEffect(() => {
    setStageProblem(undefined);
    setNotice(undefined);
  }, [stageSerial, state.activeId]);

  const project = state.projects.find((entry) => entry.id === state.activeId);
  const folderName = project?.folderName;
  const name = pack ? resolveSceneName(pack, locale) : (folderName ?? '');
  const playing = Boolean(pack) && trouble?.kind !== 'heavy';
  const accountId = useAccount().identity?.id;
  const lookId = pack && accountId ? memberLookId(accountId, pack.id) : '';
  const starter = useStudioStarter(state.activeId, pack?.id, view.source?.text);
  const { readingRef, stageReadingRef, onHeard, onDrawn } = useStudioReading(
    [feed, starter.hear],
    setScale,
  );
  const labelsShown = useStarterLabelsShown();
  // A publication lands on the graph (Ivan, 2026-10-21: "after publishing an
  // scene it needs to show in grahp"): main keeps what went out in the looks,
  // and the graph is set to it here.
  const onPublished = useCallback(() => {
    setPublications((count) => count + 1);
    if (lookId) {
      setGraphLook(lookId);
    }
  }, [lookId]);
  const publishing = useStudioPublish(view, playing, name, onPublished);
  const unfit = !pack || Boolean(problems) || troubleHoldsBack(trouble);
  // Why, in plain words, for the controls that wait on it (`unfitReason.ts`).
  const unfitWhy = unfitReason(problems, trouble);
  const unfitWords =
    unfitWhy &&
    t(unfitWhy.key, unfitWhy.file ? { file: t(FILE_KEYS[unfitWhy.file]) } : {});
  // The problem list under the stage, brought into view and given the
  // keyboard, from the line that says why a control is off.
  const showProblems = useCallback(() => {
    const list = document.getElementById(STUDIO_PROBLEMS_ID);
    list?.scrollIntoView({
      block: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
    list?.focus({ preventScroll: true });
  }, []);
  // The Publish dialog plays the scene itself, so the stage behind it stops:
  // two copies of one scene would halve what a slow machine can give either.
  const pausedForPublish = publishing.draft !== undefined;
  // Held here as well as by whichever stage is playing, because the stage and
  // the dialog's hand over in one commit, releases before claims: without
  // this the capture would close and reopen, and the dialog's scene would
  // start on a gap in the music.
  useLiveAudioCapture(playing);
  useStudioTint(pack, state.activeId, serial, playing, benchRef);
  useStudioAppColours(pack, tuner.tuning, benchRef);
  // A picture of the scene beside its files, so the member's AI can look at
  // what it just made. Not while the Publish dialog has the stage: it is
  // drawing the same scene for a cover at that moment.
  useStudioPreviewFile(
    pack,
    state.activeId,
    serial,
    playing && !pausedForPublish,
  );

  const chatBusy = useStudioChat().chat?.busy === true;
  const stageCapture = useStageCapture(playing ? pack : undefined, tuner.wave);

  const status = studioBenchStatus({
    chatBusy,
    hasPack: Boolean(pack),
    hasProblems: Boolean(problems),
    trouble,
  });
  const version = pack?.version;
  const cost = studioBenchCost(trouble, playing, scale);

  const newProject = () => setNaming(true);
  const closeNaming = useCallback(() => setNaming(false), []);

  const keeping = useStudioKeep(name, tuner.wave, setNotice, onShowGraph);

  // "Open a folder…" from the bar and from the empty stage.
  const linkFolder = () => {
    linkStudioFolder().catch(() => undefined);
  };

  // Where keeping, publishing and sending go: a scene opened to look inside,
  // FluidEQ's or another member's, says what it is for instead. Three of
  // them, chosen here, rather than one with flags; each stands at the end of
  // the bar.
  let shipCard;
  if (project?.official) {
    shipCard = <StudioShipInspect />;
  } else if (project?.member) {
    shipCard = (
      <StudioShipMemberCopy
        maker={project.member.maker}
        version={project.member.version}
      />
    );
  } else {
    shipCard = (
      <StudioShipCard
        unfit={unfit}
        onAdd={keeping.add}
        onPlay={keeping.play}
        publishing={publishing.preparing}
        onPublish={publishing.begin}
        exporting={sharing.exporting}
        onExport={sharing.startExport}
        onSetDesktop={keeping.setDesktop}
        settingDesktop={keeping.settingDesktop}
        unfitReason={unfitWords}
        onShowProblems={showProblems}
      />
    );
  }

  let stage = (
    <div className="studio-stage__well studio-stage__well--empty">
      <span className="studio-stage__empty">
        {trouble?.kind === 'heavy' ? t('studio.cost.heavy') : t('studio.empty')}
      </span>
    </div>
  );
  if (project && !pack && !problems) {
    stage = (
      <div className="studio-stage__well">
        <div className={`studio-stage studio-stage--${size}`} aria-busy="true">
          <StudioStageLoading name={name} />
        </div>
      </div>
    );
  } else if (!project) {
    stage = (
      <StudioStageStart onNewProject={newProject} onLinkFolder={linkFolder} />
    );
  } else if (pack && playing && pausedForPublish) {
    stage = <div className="studio-stage__well studio-stage__well--empty" />;
  } else if (pack && playing) {
    // `percent` goes across on every render rather than being paired with
    // `cost` through a spread: the stage reads it only beside `cost`, so there
    // is nothing to keep them together for, and a spread is what the lint rule
    // here exists to refuse — it hides which props a component is really given.
    stage = (
      <StudioStageSound
        key={`stage:${state.activeId}`}
        identity={state.activeId ?? ''}
        pack={codeDraft?.pack ?? pack}
        serial={stageSerial}
        signal={signal}
        size={size}
        preview={preview}
        hasPlayerParts={hasPlayerParts}
        motion={motion}
        onToggleMotion={toggleMotion}
        wave={tuner.wave}
        isGridShown={isGridShown}
        tuning={tuner.tuning}
        cost={cost}
        percent={Math.round(scale * 100)}
        readingRef={stageReadingRef}
        onTrouble={setTrouble}
        onHeard={onHeard}
        onDrawn={onDrawn}
        onExitFullscreen={exitFullscreen}
        onToggleFullscreen={toggleFullscreen}
        fullscreenRef={gridRef}
        captureRef={stageCapture.live}
        controls={
          <>
            <StudioStageControls
              isFullscreen={size === 'full'}
              onFullscreen={toggleFullscreen}
              preview={preview}
              onPreview={togglePreview}
              hasPlayerParts={hasPlayerParts}
              onPlayerParts={togglePlayerParts}
              panes={
                size === 'full'
                  ? {
                      pane: fullPanes.pane,
                      chat: fullPanes.chat,
                      onPane: fullPanes.togglePane,
                      onChat: fullPanes.toggleChat,
                    }
                  : undefined
              }
            />
            {starter.untouched && <StudioStarterLabelsToggle />}
          </>
        }
        labels={
          starter.untouched &&
          labelsShown && <StudioStarterLabels feed={starter.labels} />
        }
      />
    );
  }

  const idle = !(pack && playing);
  // The chat beside the stage, or the first tab under it when the bench is
  // too narrow for the column: one live copy of it either way.
  const panels: Partial<Record<TStudioWorkTab, ReactNode>> = {
    ...(isWide
      ? {}
      : {
          chat: (
            <StudioChat
              project={project}
              version={version}
              captureStage={stageCapture.capture}
            />
          ),
        }),
    // What the scene hears and what to test it with: a tab of its own since
    // the chat took the column beside the stage.
    hears: (
      <div
        className="studio-work__hears"
        role="group"
        aria-label={t('studio.test.title')}
      >
        <StudioListen signal={signal} onSignal={setSignal} idle={idle} />
        <StudioMeters feed={feed} response={tuner.response} />
      </div>
    ),
    tune: (
      <StudioTune
        wave={tuner.wave}
        onWave={tuner.setWave}
        onWaveCommit={tuner.commit}
        onWaveReset={tuner.resetWave}
        canResetWave={tuner.canResetWave}
        idle={idle}
        settings={
          <StudioSettings
            params={tuner.params}
            values={tuner.values}
            response={tuner.response}
            saved={tuner.saved}
            idle={idle}
            canResetParams={tuner.canResetParams}
            canResetResponse={tuner.canResetResponse}
            publishedVersion={tuner.publishedVersion}
            onParam={tuner.setParam}
            onChoose={tuner.chooseParam}
            onResponse={tuner.setResponse}
            onCommit={tuner.commit}
            onResetParams={tuner.resetParams}
            onResetResponse={tuner.resetResponse}
            ambient={ambient}
            palettes={palettes}
            colours={colourControls}
          />
        }
      />
    ),
    drawing: (
      <StudioDrawing
        cost={cost}
        percent={Math.round(scale * 100)}
        readingRef={readingRef}
      />
    ),
  };
  if (project) {
    panels.code = (
      <StudioCode
        key={project.id}
        projectId={project.id}
        source={view.source}
        editable={!project.official && !project.member}
        // A compile failure is of whatever the stage was handed: the draft
        // while one plays, which the file being edited answers for, else
        // what is saved.
        problemLines={problemLinesOf(
          problems,
          trouble?.kind === 'compile' && !codeDraft ? trouble.log : undefined,
        )}
        compile={
          trouble?.kind === 'compile' && codeDraft
            ? {
                lines: problemLinesOf(undefined, trouble.log),
                message: firstErrorLine(trouble.log),
              }
            : undefined
        }
      />
    );
  }
  // Offered for every project, as Animations is: a scene with no picture yet
  // gets a tab that says how to ask for one, never no tab at all.
  if (project) {
    panels.pictures = (
      <StudioPictures
        pictures={picture.pictures}
        previews={picture.previews}
        busy={
          picture.opening ??
          (picture.saving ? picture.session?.picture.id : undefined)
        }
        onOpen={picture.open}
      />
    );
  }
  // Offered for every project, none made yet included: the tab says how
  // to ask for one.
  if (project && animations) {
    panels.animations = (
      <StudioAnimations projectId={project.id} animations={animations} />
    );
  }
  const problemCount =
    (problems?.length ?? 0) + (trouble?.kind === 'compile' ? 1 : 0);

  return (
    <div className="studio-bench" ref={benchRef}>
      <div className="studio-bench__top">
        <StudioProjects
          state={state}
          onNewProject={newProject}
          onLinkFolder={linkFolder}
          onOpenFile={sharing.openFile}
        />
        {/* Beside the scene it belongs to and ahead of the status sentence:
            the number is a property of the scene, and after a sentence it
            read as a trailing afterthought. */}
        {project && version !== undefined && (
          <StudioVersion
            version={version}
            published={tuner.publishedVersion}
            // Known only for the version this folder published itself: one
            // published from another computer has no record here to compare.
            changed={
              project.published &&
              project.published.version === tuner.publishedVersion
                ? !project.published.unchanged
                : undefined
            }
            look={state.look}
          />
        )}
        {/* What the review said of it, beside its name and number, until it
            is sent again (`SceneReviewMark`). Here and not in the ship row,
            which is one row by design and full in German at the narrowest
            window. */}
        {project && !project.official && !project.member && (
          <SceneReviewMark sceneId={project.sceneId} />
        )}
        {project && (
          <span
            className={`studio-bench__status is-${status.split('.').pop()}`}
          >
            <span className="studio-bench__lamp" aria-hidden="true" />
            {t(status)}
          </span>
        )}
        {/* In the bar, so what an action says is in view wherever the page
            was left when it was pressed. */}
        <PlusToastStack<ISharingNotice>
          sources={{
            picture: picture.notice,
            sharing: sharing.notice,
            publishing: publishing.notice,
            bench: notice,
          }}
          text={(entry) => t(entry.key, entry.vars)}
        />
        {project && <div className="studio-bench__ship">{shipCard}</div>}
      </div>

      <div
        ref={gridRef}
        className={`studio-bench__grid studio-bench__grid--${size}${isWide ? '' : ' is-single'}${size === 'full' ? ` is-full${fullPanes.pane ? ' is-pane-out' : ''}${fullPanes.chat && isWide ? ' is-chat-out' : ''}` : ''}`}
        style={
          size === 'full'
            ? ({
                '--studio-full-pane': `${fullPanes.height * 100}%`,
              } as CSSProperties)
            : undefined
        }
      >
        {/* The stage stays put and the work changes under it (layout A, Ivan
            2026-09-27): one long page under the stage took the scene off the
            screen exactly while it was being made. */}
        <div className="studio-bench__main">
          <StudioStageArea
            stage={stage}
            resizable={project !== undefined && size === 'graph'}
          >
            <StudioProblems problems={problems} trouble={trouble} />
          </StudioStageArea>
          <StudioWork
            panels={panels}
            badges={{
              code: { badge: problemCount, isAlert: true },
              pictures: {
                badge:
                  picture.pictures?.kind === 'atlas'
                    ? picture.pictures.pictures.length
                    : undefined,
              },
              animations: { badge: animations?.length || undefined },
            }}
            end={
              size === 'full' ? (
                // The pane folds from its own row, as the chat does from its
                // head (Ivan, 2026-11-12: "un collapse al bottom pane too").
                <button
                  type="button"
                  className="studio-chat__icon"
                  aria-label={t('studio.size.hidePane')}
                  title={`${t('studio.size.hidePane')} (Ctrl+J)`}
                  onClick={fullPanes.togglePane}
                >
                  <Glyph name="pane-collapse" />
                </button>
              ) : undefined
            }
          />
        </div>

        {size === 'full' && (
          <StudioFullscreenPanes
            gridRef={gridRef}
            pane={fullPanes.pane}
            hasChatColumn={isWide}
            height={fullPanes.height}
            onHeight={fullPanes.setHeight}
          />
        )}
        {isWide && (
          <StudioChatColumn
            project={project}
            version={version}
            captureStage={stageCapture.capture}
            fullScreen={
              size === 'full' ? { onHide: fullPanes.toggleChat } : undefined
            }
          />
        )}
      </div>

      {naming && (
        <StudioNewProjectDialog
          root={state.projectsRoot}
          onClose={closeNaming}
        />
      )}

      {picture.session && picture.pictures?.kind === 'atlas' && (
        <StudioFramingDialog
          name={pictureName(
            picture.session.picture,
            picture.pictures.pictures.findIndex(
              (entry) => entry.id === picture.session?.picture.id,
            ),
            locale,
            t,
          )}
          session={picture.session}
          saving={picture.saving}
          onSave={picture.save}
          onAnother={picture.another}
          onCancel={picture.cancel}
        />
      )}

      {sharing.askTerms && (
        <StudioShareDialog
          running={sharing.exporting}
          onAgree={sharing.agreeAndExport}
          onCancel={sharing.cancelTerms}
        />
      )}

      {publishing.draft && pack && (
        <StudioPublishDialog
          identity={state.activeId ?? ''}
          pack={pack}
          name={name}
          draft={publishing.draft}
          running={publishing.publishing}
          phase={publishing.phase}
          tuning={tuner.tuning}
          onCapture={publishing.capture}
          onChoose={publishing.choose}
          onPublish={publishing.publish}
          onCancel={publishing.requestCancel}
        />
      )}
    </div>
  );
}
