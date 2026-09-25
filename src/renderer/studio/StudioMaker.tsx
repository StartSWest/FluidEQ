import { useEffect, useId, useRef, useState } from 'react';
import type { IStudioAgentDoor } from 'common/studioAgent';
import type { IStudioProject } from 'main/ipc/memberScenes';
import useProjectIdea from './useProjectIdea';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { AI_IDEAS, promptWithIdea } from './aiPrompt';
import type { IPromptConnection } from './aiPromptConnect';
import { showStudioFolder } from './studioStore';
import StudioAgentLink from './StudioAgentLink';
import {
  openStudioAgentDoorForPrompt,
  useStudioAgentDoor,
} from './studioAgentDoorStore';
import { markStudioAgentWorking } from './studioAgentSession';
import { shownKey } from './studioAgentSetup';
import { MAX_IDEA_LENGTH } from './studioIdea';
import { selectAll, useStudioCopy } from './useStudioCopy';

/** What the prompt needs of the door: its address and key, while it is open. */
const connectionOf = (
  door: IStudioAgentDoor | undefined,
): IPromptConnection | undefined =>
  door?.open && door.url && door.key
    ? { url: door.url, key: door.key }
    : undefined;

interface IStudioMakerProps {
  /** The open project; none before the first one. */
  project?: IStudioProject;
}

/**
 * How a scene gets made, in the order it happens: say what it should be,
 * open the project's folder in your AI assistant, paste the prompt — the
 * assistant writes the scene into the folder and every save plays on the
 * stage. The same card with a project open and without one, so the examples
 * and the prompt are never somewhere a member has already left.
 *
 * The idea is a field of its own. An example fills it and can be edited
 * there; copying reads it and never changes it.
 */
export default function StudioMaker({ project }: IStudioMakerProps) {
  const { t } = useTranslation();
  const ideaId = useId();
  const notes = useProjectIdea(project);
  const { idea } = notes;
  const [promptShown, setPromptShown] = useState(false);
  const promptRef = useRef<HTMLPreElement>(null);
  const pathRef = useRef<HTMLSpanElement>(null);
  // The folder FluidEQ made and is watching, named in the prompt so the
  // member's AI writes into it rather than guessing at one of its own.
  const folder = project?.path;
  const connection = connectionOf(useStudioAgentDoor());
  // The copy carries the door's connection so the AI connects itself (Ivan:
  // "they just copy the prompt once and that's it"); what the Studio shows of
  // it has the key cut short, as the card shows it.
  const whole = promptWithIdea(idea, folder, connection);
  const shown = promptWithIdea(
    idea,
    folder,
    connection && { ...connection, key: shownKey(connection.key) },
  );
  const prompt = useStudioCopy(whole, promptRef);
  const path = useStudioCopy(project?.path ?? '', pathRef);

  // The door is asked for first, and opened unless the member switched it
  // off; the copy carries whatever it answers, and the prompt without a
  // connection when there is no answer to wait for.
  const copyPrompt = () => {
    notes.save();
    // The member handing the project to their AI: from here the Studio hears
    // the music for it (`useSongListening.ts`).
    markStudioAgentWorking();
    openStudioAgentDoorForPrompt()
      .catch(() => undefined)
      .then((door) => {
        prompt.copyText(
          promptWithIdea(idea, folder, door ? connectionOf(door) : connection),
        );
        return undefined;
      })
      .catch(() => undefined);
  };

  // A refused copy of the prompt opens it, so there is something to select.
  useEffect(() => {
    if (prompt.refused) {
      setPromptShown(true);
    }
  }, [prompt.refused]);
  useEffect(() => {
    if (prompt.refused && promptShown) {
      selectAll(promptRef.current);
    }
  }, [prompt.refused, promptShown]);

  return (
    <section className="studio-maker" aria-labelledby={`${ideaId}-title`}>
      <h3 id={`${ideaId}-title`} className="studio-maker__title">
        <Glyph name="studio" />
        {t('studio.maker.title')}
      </h3>
      {notes.failed && <p role="alert">{t('studio.notes.failed')}</p>}
      <ol className="studio-maker__steps">
        <li className="studio-maker__step">
          <span className="studio-maker__number" aria-hidden="true">
            1
          </span>
          <div className="studio-maker__body">
            <label htmlFor={ideaId} className="studio-maker__step-title">
              {t('studio.maker.describe')}
            </label>
            <textarea
              id={ideaId}
              className="studio-maker__idea"
              rows={3}
              maxLength={MAX_IDEA_LENGTH}
              value={idea}
              placeholder={t('studio.maker.placeholder')}
              disabled={notes.loading}
              onBlur={notes.save}
              onChange={(event) => notes.update(event.target.value)}
            />
            <div
              className="studio-maker__examples"
              role="group"
              aria-label={t('studio.maker.examples')}
            >
              <span className="studio-maker__examples-label">
                {t('studio.maker.examples')}
              </span>
              {AI_IDEAS.map((entry) => {
                const text = t(entry.idea);
                const chosen = idea.trim() === text;
                return (
                  <button
                    key={entry.label}
                    type="button"
                    className="studio-idea"
                    aria-pressed={chosen}
                    title={text}
                    onClick={() => notes.update(chosen ? '' : text)}
                  >
                    {t(entry.label)}
                  </button>
                );
              })}
            </div>
          </div>
        </li>

        <li className="studio-maker__step">
          <span className="studio-maker__number" aria-hidden="true">
            2
          </span>
          <div className="studio-maker__body">
            <span className="studio-maker__step-title">
              {t('studio.maker.openTitle')}
            </span>
            <span className="studio-maker__step-text">
              {project
                ? t('studio.maker.openBody')
                : t('studio.maker.openNoProject')}
            </span>
            {project && (
              <div className="studio-maker__row">
                <span className="studio-maker__path" title={project.path}>
                  <Glyph name="folder" />
                  <span ref={pathRef} className="studio-maker__path-text">
                    <bdi>{project.path}</bdi>
                  </span>
                </span>
                <button
                  type="button"
                  className="button small subtle"
                  onClick={path.copy}
                >
                  <Glyph name={path.done ? 'check' : 'copy'} />
                  {t(
                    path.done
                      ? 'studio.maker.pathCopied'
                      : 'studio.maker.copyPath',
                  )}
                </button>
                <button
                  type="button"
                  className="button small subtle"
                  onClick={() => {
                    showStudioFolder().catch(() => undefined);
                  }}
                >
                  {t('studio.action.showFolder')}
                </button>
              </div>
            )}
            {path.refused && (
              <p className="studio-notice" role="status">
                {t('studio.maker.pathCopyFailed')}
              </p>
            )}
          </div>
        </li>

        <li className="studio-maker__step">
          <span className="studio-maker__number" aria-hidden="true">
            3
          </span>
          <div className="studio-maker__body">
            <span className="studio-maker__step-title">
              {t('studio.maker.pasteTitle')}
            </span>
            <span className="studio-maker__step-text">
              {t('studio.maker.pasteBody')}
            </span>
            <div className="studio-maker__row">
              <button
                type="button"
                className="button small studio-maker__copy"
                onClick={copyPrompt}
              >
                <Glyph name={prompt.done ? 'check' : 'copy'} />
                {t(
                  prompt.done
                    ? 'studio.maker.copied'
                    : 'studio.action.copyPrompt',
                )}
              </button>
              <button
                type="button"
                className="button small subtle"
                aria-expanded={promptShown}
                onClick={() => setPromptShown((shown) => !shown)}
              >
                {t(
                  promptShown
                    ? 'studio.maker.hidePrompt'
                    : 'studio.maker.showPrompt',
                )}
              </button>
            </div>
            {prompt.refused && (
              <p className="studio-notice" role="status">
                {t('studio.notice.copyFailed')}
              </p>
            )}
            {promptShown && (
              <pre
                ref={promptRef}
                className="studio-prompt"
                role="region"
                // A scrolling box must take focus, or a keyboard cannot
                // scroll it (WCAG 2.1.1); the region role and label say
                // what it is.
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
                aria-label={t('studio.prompt.label')}
              >
                {/* Whole only when the clipboard refused and Ctrl+C is the
                    way it gets copied. */}
                {prompt.refused ? whole : shown}
              </pre>
            )}
          </div>
        </li>
      </ol>
      <StudioAgentLink />
    </section>
  );
}
