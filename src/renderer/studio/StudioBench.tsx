import { useCallback, useEffect, useRef, useState } from 'react';
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
import StudioShipLocked from './StudioShipLocked';
import StudioShipSection from './StudioShipSection';
import StudioTestCard from './StudioTestCard';
import StudioFramingDialog from './StudioFramingDialog';
import StudioPictures, { pictureName } from './StudioPictures';
import StudioSettings from './StudioSettings';
import StudioStageArea from './StudioStageArea';
import StudioStageStart from './StudioStageStart';
import StudioVersion from './StudioVersion';
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
  type TStageDrawn,
  type TStageTrouble,
} from './StudioStage';
import type { TStudioSignal } from './studioSignals';
import StudioStageLoading from './StudioStageLoading';
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
  const { size, choose, exitFullscreen, toggleFullscreen } = useStudioSize();
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
  // The bench on screen: the window's colour is the Studio's only then.
  const benchRef = useRef<HTMLDivElement>(null);
  const feed = useRef<TStageDrawn | undefined>(undefined);
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

  const { readingRef, stageReadingRef, onDrawn } = useStudioReading(feed);

  const project = state.projects.find((entry) => entry.id === state.activeId);
  const folderName = project?.folderName;
  const name = pack ? resolveSceneName(pack, locale) : (folderName ?? '');
  const playing = Boolean(pack) && trouble?.kind !== 'heavy';
  const onPublished = useCallback(
    () => setPublications((count) => count + 1),
    [],
  );
  const publishing = useStudioPublish(view, playing, name, onPublished);
  const unfit = !pack || Boolean(problems) || trouble !== undefined;
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
  if (pack && (problems || trouble?.kind === 'compile')) {
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
  // inside says what it is for instead; without Plus the same actions are
  // shown locked. Three insides, chosen here, rather than one with two flags;
  // the card around them (`StudioShipSection`) is the same for all three.
  let shipCard = <StudioShipLocked />;
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
        wave={tuner.wave}
        isGridShown={isGridShown}
        tuning={tuner.tuning}
        cost={cost}
        percent={Math.round(scale * 100)}
        readingRef={stageReadingRef}
        onTrouble={setTrouble}
        onDrawn={onDrawn}
        onExitFullscreen={exitFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />
    );
  }

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
        {project && <span className="studio-bench__status">{t(status)}</span>}
        {/* In the pinned bar, so what an action says is in view wherever the
            page was scrolled to when it was pressed. */}
        <PlusToastStack<ISharingNotice>
          sources={{
            picture: picture.notice,
            sharing: sharing.notice,
            publishing: publishing.notice,
            bench: notice,
          }}
          text={(entry) => t(entry.key, entry.vars)}
        />
      </div>

      <div className={`studio-bench__grid studio-bench__grid--${size}`}>
        {/* The stage's pane, scrolled apart from the side column so tuning
            down that column keeps the scene in view. */}
        <div className="studio-bench__main">
          <StudioStageArea
            stage={stage}
            resizable={project !== undefined && size === 'graph'}
          >
            <StudioProblems problems={problems} trouble={trouble} />
            {project && (
              <StudioPictures
                pictures={picture.pictures}
                previews={picture.previews}
                busy={
                  picture.opening ??
                  (picture.saving ? picture.session?.picture.id : undefined)
                }
                onOpen={picture.open}
              />
            )}
            {project && (
              <StudioCode
                key={project.id}
                source={view.source}
                problemLines={problemLinesOf(
                  problems,
                  trouble?.kind === 'compile' ? trouble.log : undefined,
                )}
              />
            )}
          </StudioStageArea>

          <div className="studio-bench__maker">
            <StudioMaker key={project?.id ?? 'draft'} project={project} />
          </div>
        </div>

        <div className="studio-bench__side">
          <StudioMeters
            feed={feed}
            onScale={setScale}
            response={tuner.response}
          />
          <StudioTestCard
            readingRef={readingRef}
            signal={signal}
            onSignal={setSignal}
            size={size}
            onSize={choose}
            wave={tuner.wave}
            onWave={tuner.setWave}
            onWaveCommit={tuner.commit}
            onWaveReset={tuner.resetWave}
            canResetWave={tuner.canResetWave}
            idle={!(pack && playing)}
            cost={cost}
            percent={Math.round(scale * 100)}
            settings={
              <StudioSettings
                params={tuner.params}
                values={tuner.values}
                response={tuner.response}
                saved={tuner.saved}
                idle={!(pack && playing)}
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
          <StudioShipSection>{shipCard}</StudioShipSection>
        </div>
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
