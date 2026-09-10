import { useCallback, useEffect, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type {
  IMemberSceneProblem,
  TMemberSceneFile,
} from 'common/memberScenes';
import { resolveSceneName } from 'common/scenePacks';
import { useTranslation } from '../utils/I18nContext';
import { promptWithIdea } from './aiPrompt';
import StudioMeters from './StudioMeters';
import StudioStage, {
  type TStageDrawn,
  type TStageTrouble,
  type TStudioSize,
} from './StudioStage';
import { STUDIO_SIGNALS, type TStudioSignal } from './studioSignals';
import {
  addStudioSceneToLooks,
  showStudioFolder,
  unlinkStudioFolder,
  type IStudioView,
} from './studioStore';

const SIZES: readonly TStudioSize[] = ['graph', 'narrow', 'wide', 'full'];

const FILE_KEYS: Record<TMemberSceneFile, TranslationKey> = {
  'pack.json': 'studio.file.pack',
  source: 'studio.file.source',
  artwork: 'studio.file.artwork',
};

type TAddNotice = 'added' | 'addFailed' | 'copied' | 'copyFailed' | undefined;

const NOTICE_KEYS: Record<Exclude<TAddNotice, undefined>, TranslationKey> = {
  added: 'studio.notice.added',
  addFailed: 'studio.notice.addFailed',
  copied: 'studio.notice.copied',
  copyFailed: 'studio.notice.copyFailed',
};

/** The first driver error line, which is the one worth reading. */
const firstError = (log: string) =>
  log
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /error/i.test(line)) ?? log.trim();

const Problem = ({ problem }: { problem: IMemberSceneProblem }) => {
  const { t } = useTranslation();
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
      <span className="studio-problem__what">
        {t(`studio.problem.${problem.code}` as TranslationKey)}
      </span>
    </li>
  );
};

interface IStudioBenchProps {
  view: IStudioView;
}

/**
 * The Studio with a folder linked: the scene live on the stage, what it hears
 * beside it, and every way to test it — so the work, and the judging of it,
 * happen on one surface.
 */
export default function StudioBench({ view }: IStudioBenchProps) {
  const { t, locale } = useTranslation();
  const { state, pack, serial, problems } = view;
  const [signal, setSignal] = useState<TStudioSignal>('live');
  const [size, setSize] = useState<TStudioSize>('graph');
  const [trouble, setTrouble] = useState<TStageTrouble>();
  const [scale, setScale] = useState(1);
  const [addNotice, setAddNotice] = useState<TAddNotice>();
  const feed = useRef<TStageDrawn | undefined>(undefined);

  // A new version is a new chance: whatever went wrong with the last one is
  // forgotten until this one says otherwise.
  useEffect(() => {
    setTrouble(undefined);
    setAddNotice(undefined);
  }, [serial]);

  const onDrawn = useCallback<TStageDrawn>((frame, drawnScale, accent) => {
    feed.current?.(frame, drawnScale, accent);
  }, []);
  const onExitFullscreen = useCallback(() => setSize('graph'), []);

  const folderName = state.folder?.name ?? '';
  const name = pack ? resolveSceneName(pack, locale) : folderName;
  const playing = Boolean(pack) && trouble?.kind !== 'heavy';

  let status: TranslationKey = 'studio.status.waiting';
  if (pack && (problems || trouble?.kind === 'compile')) {
    status = 'studio.status.problem';
  } else if (pack) {
    status = 'studio.status.live';
  }

  let cost: TranslationKey = 'studio.cost.full';
  if (trouble?.kind === 'heavy') {
    cost = 'studio.cost.heavy';
  } else if (trouble?.kind === 'unavailable') {
    cost = 'studio.cost.unavailable';
  } else if (scale < 1) {
    cost = 'studio.cost.scaled';
  }

  const add = () => {
    addStudioSceneToLooks()
      .then((outcome) => {
        setAddNotice(outcome.ok ? 'added' : 'addFailed');
        return undefined;
      })
      .catch(() => setAddNotice('addFailed'));
  };

  const copyPrompt = () => {
    const write = navigator.clipboard?.writeText(promptWithIdea(''));
    if (!write) {
      setAddNotice('copyFailed');
      return;
    }
    write
      .then(() => setAddNotice('copied'))
      .catch(() => setAddNotice('copyFailed'));
  };

  return (
    <div className="studio-bench">
      <div className="studio-bench__top">
        <span className="studio-project" title={state.folder?.path}>
          <span className="studio-project__dot" aria-hidden="true" />
          {t('studio.watching', { folder: folderName })}
        </span>
        <span className="studio-bench__status">{t(status)}</span>
        <span className="studio-bench__top-actions">
          <button
            type="button"
            className="button small subtle"
            onClick={() => {
              showStudioFolder().catch(() => undefined);
            }}
          >
            {t('studio.action.showFolder')}
          </button>
          <button
            type="button"
            className="button small subtle"
            onClick={() => {
              unlinkStudioFolder().catch(() => undefined);
            }}
          >
            {t('studio.action.unlink')}
          </button>
        </span>
      </div>

      <div className={`studio-bench__grid studio-bench__grid--${size}`}>
        {pack && playing ? (
          <StudioStage
            identity={state.folder?.path ?? ''}
            pack={pack}
            serial={serial}
            signal={signal}
            size={size}
            onTrouble={setTrouble}
            onDrawn={onDrawn}
            onExitFullscreen={onExitFullscreen}
          />
        ) : (
          <div className="studio-stage__well studio-stage__well--empty">
            <span className="studio-stage__empty">
              {trouble?.kind === 'heavy'
                ? t('studio.cost.heavy')
                : t('studio.empty')}
            </span>
          </div>
        )}

        <div className="studio-bench__side">
          <StudioMeters feed={feed} onScale={setScale} />
          <div className="studio-card">
            <span className="studio-card__eyebrow">
              {t('studio.signals.title')}
            </span>
            <div
              className="studio-segments"
              role="group"
              aria-label={t('studio.signals.title')}
            >
              {STUDIO_SIGNALS.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  className="studio-segment"
                  aria-pressed={signal === entry}
                  onClick={() => setSignal(entry)}
                >
                  {t(`studio.signal.${entry}` as TranslationKey)}
                </button>
              ))}
            </div>
            <span className="studio-card__eyebrow">
              {t('studio.size.title')}
            </span>
            <div
              className="studio-segments"
              role="group"
              aria-label={t('studio.size.title')}
            >
              {SIZES.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  className="studio-segment"
                  aria-pressed={size === entry}
                  onClick={() => setSize(entry)}
                >
                  {t(`studio.size.${entry}` as TranslationKey)}
                </button>
              ))}
            </div>
          </div>
          <div
            className={`studio-card studio-cost studio-cost--${cost.split('.').pop()}`}
          >
            <span className="studio-cost__dot" aria-hidden="true" />
            {t(cost, { percent: Math.round(scale * 100) })}
          </div>
        </div>
      </div>

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

      <div className="studio-actions studio-actions--end">
        {addNotice && (
          <span
            className={`studio-notice${
              addNotice === 'added' || addNotice === 'copied'
                ? ' studio-notice--ok'
                : ''
            }`}
            role="status"
          >
            {t(NOTICE_KEYS[addNotice], { name })}
          </span>
        )}
        <span className="studio-actions__hint">{t('studio.signals.hint')}</span>
        <button
          type="button"
          className="button small subtle"
          onClick={copyPrompt}
        >
          {t('studio.action.copyPrompt')}
        </button>
        <button
          type="button"
          className="button small"
          onClick={add}
          disabled={!pack || Boolean(problems) || trouble !== undefined}
        >
          {t('studio.action.addToLooks')}
        </button>
      </div>
    </div>
  );
}
