import { useMemo } from 'react';
import { resolveSceneName } from 'common/scenePacks';
import type { IStudioState } from 'main/ipc/memberScenes';
import Glyph from '../community/Glyph';
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
 * the open one off the list — in the one menu, so none of it is a row of
 * buttons beside the stage.
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

  const entries = useMemo<IRichPickEntry[]>(
    () =>
      state.projects.map((project) => ({
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

  return (
    <RichPick
      className="studio-projects"
      entries={entries}
      groupLabel={() => t('studio.project.group')}
      activeId={state.activeId ?? ''}
      onPick={(id) => {
        selectStudioProject(id).catch(() => undefined);
      }}
      placeholder={t(
        entries.length > 0 ? 'studio.project.none' : 'studio.project.empty',
      )}
      triggerAriaLabel={t('studio.project.label')}
      triggerTitle={active?.hint ?? t('studio.project.label')}
      placeholderIcon={<Glyph name="folder" className="rich-pick__glyph" />}
      triggerExtra={
        active && <span className="studio-projects__live" aria-hidden="true" />
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
  );
}
