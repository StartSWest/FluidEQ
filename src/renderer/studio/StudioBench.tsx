import { useCallback, useEffect, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type {
  IMemberSceneProblem,
  TMemberSceneFile,
} from 'common/memberScenes';
import { resolveSceneName } from 'common/scenePacks';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import Glyph from '../community/Glyph';
import PaneResizer from '../components/PaneResizer';
import PlusToastStack from '../plus/PlusToastStack';
import { useTranslation } from '../utils/I18nContext';
import StudioCode, { problemLinesOf } from './StudioCode';
import StudioFoldCard from './StudioFoldCard';
import StudioMaker from './StudioMaker';
import StudioMeters from './StudioMeters';
import StudioNewProjectDialog from './StudioNewProjectDialog';
import StudioProjects from './StudioProjects';
import StudioPublishDialog from './StudioPublishDialog';
import StudioShareDialog from './StudioShareDialog';
import StudioShipCard from './StudioShipCard';
import StudioShipInspect from './StudioShipInspect';
import StudioShipLocked from './StudioShipLocked';
import StudioTestCard from './StudioTestCard';
import useStudioStageRatio from './useStudioStageRatio';
import StudioFramingDialog from './StudioFramingDialog';
import StudioPictures, { pictureName } from './StudioPictures';
import StudioSettings from './StudioSettings';
import useStudioAmbientTuning from './useStudioAmbientTuning';
import useStudioBaseline from './useStudioBaseline';
import useStudioKeep from './useStudioKeep';
import useStudioTuning from './useStudioTuning';
import useScenePictures from './useScenePictures';
import useStudioPublish from './useStudioPublish';
import useStudioSharing, { type ISharingNotice } from './useStudioSharing';
import useStudioTint from './useStudioTint';
import { DEFAULT_STUDIO_WAVE, type IStudioWave } from './studioWave';
import { createStudioReadingSettler } from './studioReading';
import { useStudioGridShown } from './studioPaper';
import useStudioSize from './useStudioSize';
import StudioStage, {
  type TStageDrawn,
  type TStageTrouble,
} from './StudioStage';
import type { TStudioSignal } from './studioSignals';
import StudioStageLoading from './StudioStageLoading';
import { linkStudioFolder, type IStudioView } from './studioStore';

const FILE_KEYS: Record<TMemberSceneFile, TranslationKey> = {
  'pack.json': 'studio.file.pack',
  source: 'studio.file.source',
  artwork: 'studio.file.artwork',
};

/** The first driver error line, which is the one worth reading. */
const firstError = (log: string) =>
  log
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /error/i.test(line)) ?? log.trim();

/**
 * A problem with the scene's picture is one the member fixes here, with a
 * photo of their own, rather than by asking their AI again.
 */
const isPictureProblem = (problem: IMemberSceneProblem) =>
  problem.file === 'artwork' &&
  (problem.code === 'missing-file' ||
    problem.code === 'bad-artwork' ||
    problem.code === 'file-too-large');

const Problem = ({ problem }: { problem: IMemberSceneProblem }) => {
  const { t } = useTranslation();
  const what: TranslationKey =
    problem.file === 'artwork' && problem.code === 'missing-file'
      ? 'studio.picture.missing'
      : (`studio.problem.${problem.code}` as TranslationKey);
  return (
    <li className="studio-problem">
      <span className="studio-problem__where">
        {problem.line
          ? t('studio.problem.line', {
              file: t(FILE_KEYS[problem.file]),
              line: problem.line,
            })
          : t(FILE_KEYS[problem.file])}
      </span>
      <span className="studio-problem__what">{t(what)}</span>
    </li>
  );
};

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
  const [wave, setWave] = useState<IStudioWave>(DEFAULT_STUDIO_WAVE);
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

  // What the frames cost, under the cost line: the GPU's own time for a
  // frame, the rate they are drawn at, and the size the controller has the
  // scene at — what Automatic is doing, which nothing else on the stage
  // says. Written to the element straight from the frame callback, never
  // through React, and settled first (`studioReading.ts`) so the figures can
  // be read instead of blurring.
  const readingRef = useRef<HTMLSpanElement>(null);
  const lastReading = useRef('');
  const settler = useRef(createStudioReadingSettler());
  const onDrawn = useCallback<TStageDrawn>(
    (frame, drawnScale, accent, heard, report) => {
      feed.current?.(frame, drawnScale, accent, heard, report);
      const settled = settler.current.frame(report);
      const fps = String(settled.fps);
      const size = String(settled.size);
      const reading =
        settled.costMs === undefined
          ? t('studio.cost.readingRate', { fps, size })
          : t('studio.cost.reading', {
              ms: settled.costMs.toFixed(1),
              fps,
              size,
            });
      if (reading !== lastReading.current && readingRef.current) {
        lastReading.current = reading;
        readingRef.current.textContent = reading;
      }
    },
    [t],
  );

  const project = state.projects.find((entry) => entry.id === state.activeId);
  const stageArea = useRef<HTMLDivElement>(null);
  const stageShape = useStudioStageRatio(stageArea);
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
  useStudioTint(pack, state.activeId, serial, playing);

  let status: TranslationKey = 'studio.status.waiting';
  if (pack && (problems || trouble?.kind === 'compile')) {
    status = 'studio.status.problem';
  } else if (pack) {
    status = 'studio.status.live';
  }

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

  const keeping = useStudioKeep(name, wave, setNotice);

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
  // the folding card around them is the same for all three.
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
      <div className="studio-stage__well studio-stage__well--start">
        <span className="studio-stage__start-mark" aria-hidden="true">
          <Glyph name="studio" />
        </span>
        <span className="studio-stage__start-title">
          {t('studio.stage.startTitle')}
        </span>
        <span className="studio-stage__start-body">
          {t('studio.stage.startBody')}
        </span>
        <span className="studio-stage__start-actions">
          <button type="button" className="button small" onClick={newProject}>
            <Glyph name="studio" />
            {t('studio.project.new')}
          </button>
          <button
            type="button"
            className="button small subtle"
            onClick={linkFolder}
          >
            <Glyph name="folder" />
            {t('studio.project.add')}
          </button>
        </span>
      </div>
    );
  } else if (pack && playing && pausedForPublish) {
    stage = <div className="studio-stage__well studio-stage__well--empty" />;
  } else if (pack && playing) {
    stage = (
      <StudioStage
        key={`stage:${state.activeId}`}
        identity={state.activeId ?? ''}
        pack={pack}
        serial={serial}
        signal={signal}
        size={size}
        wave={wave}
        isGridShown={isGridShown}
        tuning={tuner.tuning}
        onTrouble={setTrouble}
        onDrawn={onDrawn}
        onExitFullscreen={exitFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />
    );
  }

  return (
    <div className="studio-bench">
      <div className="studio-bench__top">
        <StudioProjects
          state={state}
          onNewProject={newProject}
          onLinkFolder={linkFolder}
          onOpenFile={sharing.openFile}
        />
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
          <div
            ref={stageArea}
            className="studio-bench__stage"
            style={stageShape.style}
          >
            {stage}
            {/* The graph's divider, to try the scene on a taller or shorter
                graph. Only at the graph's size: the others are fixed panels. */}
            {project && size === 'graph' && (
              <PaneResizer
                ariaLabel={t('studio.stage.resize')}
                valuePercent={stageShape.resizer.valuePercent}
                onStart={stageShape.resizer.onStart}
                onDrag={stageShape.resizer.onDrag}
                onEnd={stageShape.resizer.onEnd}
              />
            )}
            {(problems ||
              trouble?.kind === 'compile' ||
              trouble?.kind === 'heavy') && (
              <div className="studio-problems" role="alert">
                {problems && (
                  <>
                    <span className="studio-problems__title">
                      {t('studio.problem.heading')}
                    </span>
                    <ul className="studio-problems__list">
                      {problems.map((problem) => (
                        <Problem
                          key={`${problem.code}:${problem.file}:${problem.line ?? 0}`}
                          problem={problem}
                        />
                      ))}
                    </ul>
                    {problems.some(isPictureProblem) && (
                      <span className="studio-problems__hint">
                        {t('studio.picture.hint')}
                      </span>
                    )}
                  </>
                )}
                {trouble?.kind === 'compile' && (
                  <>
                    <span className="studio-problems__title">
                      {t('studio.compile.heading')}
                    </span>
                    <code className="studio-problems__log">
                      {firstError(trouble.log)}
                    </code>
                    <span className="studio-problems__hint">
                      {t('studio.compile.hint')}
                    </span>
                  </>
                )}
                {trouble?.kind === 'heavy' && (
                  <span className="studio-problems__hint">
                    {t('studio.heavy.body')}
                  </span>
                )}
              </div>
            )}
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
          </div>

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
            wave={wave}
            onWave={setWave}
            idle={!(pack && playing)}
            cost={cost}
            percent={Math.round(scale * 100)}
          />
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
          <StudioFoldCard
            fold="ship"
            title={t('studio.ship.title')}
            className="studio-ship-card"
          >
            {shipCard}
          </StudioFoldCard>
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
