import { useMemo, useRef, useState } from 'react';
import { resolveSceneName } from 'common/scenePacks';
import type { IStudioState } from 'main/ipc/memberScenes';
import Glyph from '../community/Glyph';
import Chevron from '../icons/Chevron';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { type IRichPickEntry } from '../widgets/RichPick';
import {
  forgetStudioProject,
  linkStudioFolder,
  selectStudioProject,
} from './studioStore';

interface IStudioProjectsProps {
  state: IStudioState;
  /** Starts a new project; the Studio reports how that went. */
  onNewProject: () => void;
  /** Opens a scene file another member exported. */
  onOpenFile: () => void;
}

/**
 * Which project is on the bench, and everything else about projects — every
 * other one a member has worked on, starting or bringing another, and taking
 * the open one off the list — in one menu, with previous/next beside it.
 *
 * Each is named by what its scene is called, with its folder under it, so two
 * projects both called "scene" in different places can be told apart. Picking
 * one moves the watcher to it; the others are not read, compiled or drawn.
 */
export default function StudioProjects({
  state,
  onNewProject,
  onOpenFile,
}: IStudioProjectsProps) {
  const { t, locale } = useTranslation();
  const [switching, setSwitching] = useState(false);
  const picking = useRef(false);

  const entries = useMemo<IRichPickEntry[]>(
    // The server returns recency order after every selection. A fixed folder
    // order lets the arrows traverse every project instead of bouncing back.
    () =>
      [...state.projects]
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((project) => ({
          id: project.id,
          name: project.names
            ? resolveSceneName({ names: project.names }, locale)
            : project.folderName,
          hint: project.path,
          group: 'projects',
          icon: <Glyph name="folder" className="rich-pick__glyph" />,
        })),
    [state.projects, locale],
  );
  const active = entries.find((entry) => entry.id === state.activeId);
  const at = entries.findIndex((entry) => entry.id === state.activeId);
  const previous = entries[(at > 0 ? at : entries.length) - 1];
  const next = entries[(at + 1) % entries.length];
  const canStep = state.entitled && entries.length > 1 && !switching;
  const pick = async (id: string) => {
    if (picking.current || !state.entitled) {
      return;
    }
    picking.current = true;
    setSwitching(true);
    try {
      await selectStudioProject(id);
    } catch {
      /* Keep the current project; the next press can retry. */
    } finally {
      picking.current = false;
      setSwitching(false);
    }
  };

  return (
    <div className="studio-projects-nav">
      <RichPick
        className="studio-projects"
        menuClassName="studio-projects-menu"
        menuMaxHeight={520}
        disabled={!state.entitled || switching}
        entries={entries}
        groupLabel={() => t('studio.project.group')}
        activeId={state.activeId ?? ''}
        onPick={pick}
        placeholder={t(
          entries.length > 0 ? 'studio.project.none' : 'studio.project.empty',
        )}
        triggerAriaLabel={t('studio.project.label')}
        triggerTitle={active?.hint ?? t('studio.project.label')}
        placeholderIcon={<Glyph name="folder" className="rich-pick__glyph" />}
        triggerExtra={
          active && (
            <span className="studio-projects__live" aria-hidden="true" />
          )
        }
        renderFooter={(close) => (
          <>
            <button
              type="button"
              className="rich-pick__action"
              onClick={() => {
                close();
                onNewProject();
              }}
            >
              <Glyph name="studio" />
              {t('studio.project.new')}
            </button>
            <button
              type="button"
              className="rich-pick__action"
              onClick={() => {
                close();
                linkStudioFolder().catch(() => undefined);
              }}
            >
              <Glyph name="folder" />
              {t('studio.project.add')}
            </button>
            <button
              type="button"
              className="rich-pick__action"
              onClick={() => {
                close();
                onOpenFile();
              }}
            >
              <Glyph name="download" />
              {t('studio.action.import')}
            </button>
            {active && (
              <button
                type="button"
                className="rich-pick__action studio-projects__forget"
                title={t('studio.project.forgetHint')}
                onClick={() => {
                  close();
                  forgetStudioProject(active.id).catch(() => undefined);
                }}
              >
                <Glyph name="close" />
                {t('studio.project.forget', { name: active.name })}
              </button>
            )}
          </>
        )}
      />
      <button
        type="button"
        className="button small subtle studio-projects-step studio-projects-step--previous"
        aria-label={t('studio.project.previous')}
        title={
          previous
            ? `${t('studio.project.previous')}: ${previous.name}`
            : t('studio.project.previous')
        }
        disabled={!canStep}
        onClick={() => previous && pick(previous.id)}
      >
        <Chevron />
      </button>
      <button
        type="button"
        className="button small subtle studio-projects-step studio-projects-step--next"
        aria-label={t('studio.project.next')}
        title={
          next
            ? `${t('studio.project.next')}: ${next.name}`
            : t('studio.project.next')
        }
        disabled={!canStep}
        onClick={() => next && pick(next.id)}
      >
        <Chevron />
      </button>
    </div>
  );
}
