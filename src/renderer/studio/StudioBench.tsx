import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { TranslationKey } from 'common/i18n';
import { resolveSceneName } from 'common/scenePacks';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import PlusToastStack from '../plus/PlusToastStack';
import { useTranslation } from '../utils/I18nContext';
import StudioCode, { problemLinesOf } from './StudioCode';
import StudioMaker from './StudioMaker';
import StudioMeters from './StudioMeters';
import StudioNewProjectDialog from './StudioNewProjectDialog';
import StudioProblems from './StudioProblems';
import StudioProjects from './StudioProjects';
import StudioPublishDialog from './StudioPublishDialog';
import StudioShareDialog from './StudioShareDialog';
import StudioShipCard from './StudioShipCard';
import StudioShipInspect from './StudioShipInspect';
import StudioShipMaker from './StudioShipMaker';
import StudioDrawing from './StudioDrawing';
import StudioFramingDialog from './StudioFramingDialog';
import StudioListen from './StudioListen';
import StudioPictures, { pictureName } from './StudioPictures';
import StudioSettings from './StudioSettings';
import StudioStageArea from './StudioStageArea';
import StudioStageControls from './StudioStageControls';
import StudioStageStart from './StudioStageStart';
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
import useStudioTint from './useStudioTint';
import { useStudioGridShown } from './studioPaper';
import useStudioSize from './useStudioSize';
import StudioStage, {
  type TStageHeard,
  type TStageTrouble,
} from './StudioStage';
import type { TStudioSignal } from './studioSignals';
import StudioStageLoading from './StudioStageLoading';
import troubleHoldsBack from './stageTrouble';
import { linkStudioFolder, type IStudioView } from './studioStore';

interface IStudioBenchProps {
  view: IStudioView;
}

/**
 * The Studio: the scene live on the stage, what it hears and what to test it
 * with beside it, and how to make it under it — one surface whether a project
 * is open or not, so nothing a member saw on the first visit is gone once
 * they have a project. With none, the stage is where the first one starts
 * and everything that needs a scene waits, unlit, where it will be.
 */
export default function StudioBench({ view }: IStudioBenchProps) {
  const { t, locale } = useTranslation();
  const { state, pack, serial, problems } = view;
  const [signal, setSignal] = useState<TStudioSignal>('live');
  const { size, isPlayer, exitFullscreen, toggleFullscreen, togglePlayer } =
    useStudioSize();
  const isGridShown = useStudioGridShown();
  const [stageProblem, setStageProblem] = useState<{
    identity?: string;
    serial: number;
    value: TStageTrouble;
  }>();
  const trouble =
    stageProblem?.identity === state.activeId && stageProblem?.serial === serial
      ? stageProblem.value
      : undefined;
  const setTrouble = useCallback(
    (value: TStageTrouble) =>
      setStageProblem({ identity: state.activeId, serial, value }),
    [state.activeId, serial],
  );
  const [scale, setScale] = useState(1);
  const [notice, setNotice] = useState<ISharingNotice>();
  const [naming, setNaming] = useState(false);
  const feed = useRef<TStageHeard | undefined>(undefined);
  // The bench on screen: the window's colour is the Studio's only then, and
  // the sound panel folded while it is.
  const benchRef = useRef<HTMLDivElement>(null);
  const { isWide } = useStudioBenchLayout(benchRef);
  const sharing = useStudioSharing();
  const picture = useScenePictures(t('studio.picture.files'), view);
  // How many times this bench has published, so the scene just published
  // becomes what Reset goes back to without reopening the project.
  const [publications, setPublications] = useState(0);
  const baseline = useStudioBaseline(state.activeId, publications);
  const tuner = useStudioTuning(pack, state.activeId, baseline);
  const ambient = useStudioAmbientTuning(pack, state.activeId, baseline);

  // A new version is a new chance: whatever went wrong with the last one is
  // forgotten until this one says otherwise.
  useEffect(() => {
    setStageProblem(undefined);
    setNotice(undefined);
  }, [serial, state.activeId]);

  const { readingRef, stageReadingRef, onHeard, onDrawn } = useStudioReading(
    feed,
    setScale,
  );

  const project = state.projects.find((entry) => entry.id === state.activeId);
  const folderName = project?.folderName;
  const name = pack ? resolveSceneName(pack, locale) : (folderName ?? '');
  const playing = Boolean(pack) && trouble?.kind !== 'heavy';
  const onPublished = useCallback(
    () => setPublications((count) => count + 1),
    [],
  );
  const publishing = useStudioPublish(view, playing, name, onPublished);
  const unfit = !pack || Boolean(problems) || troubleHoldsBack(trouble);
  // The Publish dialog plays the scene itself, so the stage behind it stops:
  // two copies of one scene would halve what a slow machine can give either.
  const pausedForPublish = publishing.draft !== undefined;
  // Held here as well as by whichever stage is playing, because the stage and
  // the dialog's hand over in one commit, releases before claims: without
  // this the capture would close and reopen, and the dialog's scene would
  // start on a gap in the music.
  useLiveAudioCapture(playing);
  useStudioTint(pack, state.activeId, serial, playing, benchRef);
  // A picture of the scene beside its files, so the member's AI can look at
  // what it just made. Not while the Publish dialog has the stage: it is
  // drawing the same scene for a cover at that moment.
  useStudioPreviewFile(
    pack,
    state.activeId,
    serial,
    playing && !pausedForPublish,
  );

  let status: TranslationKey = 'studio.status.waiting';
  if (
    pack &&
    (problems ||
      trouble?.kind === 'compile' ||
      (trouble?.kind === 'world' && troubleHoldsBack(trouble)))
  ) {
    status = 'studio.status.problem';
  } else if (pack) {
    status = 'studio.status.live';
  }

  const version = pack?.version;

  let cost: TranslationKey | undefined;
  if (trouble?.kind === 'heavy') {
    cost = 'studio.cost.heavy';
  } else if (trouble?.kind === 'unavailable') {
    cost = 'studio.cost.unavailable';
  } else if (playing) {
    cost = scale < 1 ? 'studio.cost.scaled' : 'studio.cost.full';
  }

  const newProject = () => setNaming(true);
  const closeNaming = useCallback(() => setNaming(false), []);

  const keeping = useStudioKeep(name, tuner.wave, setNotice);

  // "Open a folder…" from the bar and from the empty stage: without Plus a
  // folder of several scenes puts the first on the bench and lists the rest
  // locked, and the member is told so.
  const linkFolder = () => {
    linkStudioFolder()
      .then((outcome) => {
        if (outcome === 'one-opened') {
          setNotice({ ok: true, key: 'studio.plus.oneFolder' });
        }
        return undefined;
      })
      .catch(() => undefined);
  };

  // Where keeping, publishing and sending go: a FluidEQ scene opened to look
  // inside says what it is for instead; without Plus — which on the bench
  // means a maker — Publish stays open and the rest are shown locked. Three
  // of them, chosen here, rather than one with two flags; each stands at the
  // end of the bar.
  let shipCard = (
    <StudioShipMaker
      unfit={unfit}
      publishing={publishing.preparing}
      onPublish={publishing.begin}
    />
  );
  if (project?.official) {
    shipCard = <StudioShipInspect />;
  } else if (state.entitled) {
    shipCard = (
      <StudioShipCard
        unfit={unfit}
        onAdd={keeping.add}
        publishing={publishing.preparing}
        onPublish={publishing.begin}
        exporting={sharing.exporting}
        onExport={sharing.startExport}
        onSetDesktop={keeping.setDesktop}
        settingDesktop={keeping.settingDesktop}
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
      <StudioStage
        key={`stage:${state.activeId}`}
        identity={state.activeId ?? ''}
        pack={pack}
        serial={serial}
        signal={signal}
        size={size}
        isPlayer={isPlayer}
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
        controls={
          <StudioStageControls
            isFullscreen={size === 'full'}
            onFullscreen={toggleFullscreen}
            isPlayer={isPlayer}
            onPlayer={togglePlayer}
          />
        }
      />
    );
  }

  const idle = !(pack && playing);
  // "What it hears" beside the stage, or a tab under it when the bench is too
  // narrow for the column: one live copy of the meters either way.
  const listening = (
    <>
      <StudioListen signal={signal} onSignal={setSignal} idle={idle} />
      <StudioMeters feed={feed} response={tuner.response} />
    </>
  );
  const panels: Partial<Record<TStudioWorkTab, ReactNode>> = {
    make: <StudioMaker key={project?.id ?? 'draft'} project={project} />,
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
            onResponse={tuner.setResponse}
            onCommit={tuner.commit}
            onResetParams={tuner.resetParams}
            onResetResponse={tuner.resetResponse}
            ambient={ambient}
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
        source={view.source}
        problemLines={problemLinesOf(
          problems,
          trouble?.kind === 'compile' ? trouble.log : undefined,
        )}
      />
    );
  }
  if (project && picture.pictures && picture.pictures.kind !== 'none') {
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
  if (!isWide) {
    panels.hears = <div className="studio-work__hears">{listening}</div>;
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
          <StudioVersion version={version} published={tuner.publishedVersion} />
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
        className={`studio-bench__grid studio-bench__grid--${size}${isWide ? '' : ' is-single'}`}
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
            }}
          />
        </div>

        {isWide && (
          <aside
            className="studio-bench__side"
            aria-label={t('studio.test.title')}
          >
            {listening}
          </aside>
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
          tuning={tuner.tuning}
          onCapture={publishing.capture}
          onChoose={publishing.choose}
          onPublish={publishing.publish}
          onCancel={publishing.cancel}
        />
      )}
    </div>
  );
}
