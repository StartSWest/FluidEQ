import type { TranslationKey } from 'common/i18n';
import type {
  IMemberSceneProblem,
  TMemberSceneFile,
} from 'common/memberScenes';
import { SCENE_DAYLIGHT_DECLARATION } from 'common/sceneDaylight';
import type { IWorldReport, TWorldNote } from 'common/worldNotes';
import { useTranslation } from '../utils/I18nContext';
import type { TStageTrouble } from './StudioStage';

const FILE_KEYS: Record<TMemberSceneFile, TranslationKey> = {
  'pack.json': 'studio.file.pack',
  source: 'studio.file.source',
  artwork: 'studio.file.artwork',
  world: 'studio.file.world',
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
      <span className="studio-problem__what">
        {t(what, { control: SCENE_DAYLIGHT_DECLARATION })}
      </span>
    </li>
  );
};

type TTranslate = ReturnType<typeof useTranslation>['t'];

/** One reason the world, or a part of it, was not drawn. */
const worldNoteText = (t: TTranslate, note: TWorldNote): string => {
  switch (note.code) {
    case 'engine-missing':
      return t('studio.worldNote.engine-missing');
    case 'engine-failed':
      return t('studio.worldNote.engine-failed', { detail: note.detail });
    case 'engine-unsupported':
      return t('studio.worldNote.engine-unsupported');
    case 'material':
      return t('studio.worldNote.material');
    case 'model-refused':
      return t('studio.worldNote.model-refused', { model: note.model });
    default:
      return t('studio.worldNote.model-unreadable', {
        model: note.model,
        detail: note.detail,
      });
  }
};

/**
 * What became of the 3D world: its shader drawn in its place, or parts of it
 * left out, each with its reason, and the driver's own words for a material.
 */
const WorldTrouble = ({ report }: { report: IWorldReport }) => {
  const { t } = useTranslation();
  const material = report.notes.find(
    (note): note is Extract<TWorldNote, { code: 'material' }> =>
      note.code === 'material',
  );
  return (
    <>
      <span className="studio-problems__title">
        {t(report.drawn ? 'studio.world.partial' : 'studio.world.heading')}
      </span>
      {report.notes.length > 0 && (
        <ul className="studio-problems__list">
          {report.notes.map((note, index) => (
            <li
              className="studio-problem"
              // A world's notes are made once per build and never reordered.
              // eslint-disable-next-line react/no-array-index-key
              key={`${note.code}:${index}`}
            >
              <span className="studio-problem__where">
                {t('studio.file.world')}
              </span>
              <span className="studio-problem__what">
                {worldNoteText(t, note)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {material && (
        <code className="studio-problems__log">{firstError(material.log)}</code>
      )}
      <span className="studio-problems__hint">{t('studio.compile.hint')}</span>
    </>
  );
};

interface IStudioProblemsProps {
  /** The newest build's, when it did not become a pack. */
  problems: readonly IMemberSceneProblem[] | undefined;
  /** What the stage reported about the version it was given. */
  trouble: TStageTrouble | undefined;
}

/**
 * What is wrong with the newest version, under the stage: the rules its files
 * break, the error the graphics driver gave for its shader, or that it was
 * too heavy for this computer to draw.
 */
export default function StudioProblems({
  problems,
  trouble,
}: IStudioProblemsProps) {
  const { t } = useTranslation();
  if (
    !problems &&
    trouble?.kind !== 'compile' &&
    trouble?.kind !== 'world' &&
    trouble?.kind !== 'heavy'
  ) {
    return null;
  }
  return (
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
      {trouble?.kind === 'world' && <WorldTrouble report={trouble.report} />}
      {trouble?.kind === 'heavy' && (
        <span className="studio-problems__hint">{t('studio.heavy.body')}</span>
      )}
    </div>
  );
}
