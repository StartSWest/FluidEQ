import { useMemo } from 'react';
import { resolveSceneName } from 'common/scenePacks';
import type { IStudioState } from 'main/ipc/memberScenes';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { type IRichPickEntry } from '../widgets/RichPick';
import {
  createStudioStarter,
  linkStudioFolder,
  selectStudioProject,
} from './studioStore';

interface IStudioProjectsProps {
  state: IStudioState;
  /** The starter could not be written: the chosen folder already has a scene. */
  onStarterExists: () => void;
}

/**
 * Which project is on the bench, and every other one a member has worked on,
 * with the two ways to start another under the list.
 *
 * Each is named by what its scene is called, with its folder under it, so two
 * projects both called "scene" in different places can be told apart. Picking
 * one moves the watcher to it; the others are not read, compiled or drawn.
 */
export default function StudioProjects({
  state,
  onStarterExists,
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
      placeholder={t('studio.project.none')}
      triggerAriaLabel={t('studio.project.label')}
      triggerTitle={active?.hint ?? t('studio.project.label')}
      placeholderIcon={<Glyph name="folder" className="rich-pick__glyph" />}
      triggerExtra={
        <span className="studio-projects__live" aria-hidden="true" />
      }
      renderFooter={(close) => (
        <>
          <button
            type="button"
            className="rich-pick__action"
            onClick={() => {
              close();
              createStudioStarter()
                .then((outcome) => {
                  if (outcome === 'exists') {
                    onStarterExists();
                  }
                  return undefined;
                })
                .catch(() => undefined);
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
        </>
      )}
    />
  );
}
