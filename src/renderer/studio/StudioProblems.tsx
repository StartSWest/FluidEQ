import type { TranslationKey } from 'common/i18n';
import type {
  IMemberSceneProblem,
  TMemberSceneFile,
} from 'common/memberScenes';
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
      <span className="studio-problem__what">{t(what)}</span>
    </li>
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
      {trouble?.kind === 'world' && (
        <>
          <span className="studio-problems__title">
            {t('studio.world.heading')}
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
        <span className="studio-problems__hint">{t('studio.heavy.body')}</span>
      )}
    </div>
  );
}
