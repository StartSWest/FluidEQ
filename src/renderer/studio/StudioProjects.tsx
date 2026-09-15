import { useCallback, useMemo, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { FLUIDEQ_CREATOR_ID } from 'common/plusGallery';
import { resolveSceneName } from 'common/scenePacks';
import type { IStudioState } from 'main/ipc/memberScenes';
import { requestAccountPanel } from '../account/accountPanel';
import Glyph, { type TCommunityGlyph } from '../community/Glyph';
import Chevron from '../icons/Chevron';
import { openGalleryPage, type IMakerRef } from '../plus/plusNavigation';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { type IRichPickEntry } from '../widgets/RichPick';
import StudioRenameProjectDialog from './StudioRenameProjectDialog';
import { forgetStudioProject, selectStudioProject } from './studioStore';

const GROUP_OWN = 'projects';
const GROUP_OFFICIAL = 'official';

/**
 * FluidEQ's page in the gallery, where each of its scenes has "Open in
 * Studio". Named as the gallery names FluidEQ on every official scene.
 */
const FLUIDEQ_MAKER: IMakerRef = {
  authorId: FLUIDEQ_CREATOR_ID,
  name: 'FluidEQ',
  handle: 'fluideq',
};

interface IMenuRow {
  glyph: TCommunityGlyph;
  label: TranslationKey;
  /** Closes the menu the row sits in; every row does, before anything else. */
  close: () => void;
}

/** A row in the menu's footer: closes the menu, then does its thing. */
function MenuAction({
  glyph,
  label,
  close,
  onPick,
}: IMenuRow & { onPick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="rich-pick__action"
      onClick={() => {
        close();
        onPick();
      }}
    >
      <Glyph name={glyph} />
      {t(label)}
    </button>
  );
}

/**
 * The same row, for something Plus would open: it says so, and goes to Plus
 * instead of doing nothing. The main process refuses the action anyway; the
 * lock is what the member is told, not what stops them.
 */
function LockedMenuAction({
  glyph,
  label,
  close,
  hint,
}: IMenuRow & { hint: TranslationKey }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="rich-pick__action is-locked"
      title={t(hint)}
      onClick={() => {
        close();
        requestAccountPanel('subscribe');
      }}
    >
      <Glyph name={glyph} />
      {t(label)}
      <Glyph name="lock" className="rich-pick__action-lock" />
    </button>
  );
}

interface IStudioProjectsProps {
  state: IStudioState;
  /** Starts a new project; the Studio reports how that went. */
  onNewProject: () => void;
  /** Opens the folder dialog; the Studio reports how that went. */
  onLinkFolder: () => void;
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
  onLinkFolder,
  onOpenFile,
}: IStudioProjectsProps) {
  const { t, locale } = useTranslation();
  const [switching, setSwitching] = useState(false);
  const picking = useRef(false);
  // The project being renamed, as it was when Rename was pressed.
  const [renaming, setRenaming] = useState<{
    id: string;
    name: string;
    path: string;
  }>();
  const closeRename = useCallback(() => setRenaming(undefined), []);

  const entries = useMemo<IRichPickEntry[]>(
    // The server returns recency order after every selection. A fixed folder
    // order lets the arrows traverse every project instead of bouncing back.
    // FluidEQ's scenes opened to look inside file after the member's own, so
    // a project called "Aurora" of theirs is never mistaken for FluidEQ's.
    () =>
      [...state.projects]
        .sort(
          (a, b) =>
            Number(Boolean(a.official)) - Number(Boolean(b.official)) ||
            a.path.localeCompare(b.path),
        )
        .map((project) => ({
          id: project.id,
          name: project.names
            ? resolveSceneName({ names: project.names }, locale)
            : project.folderName,
          hint: project.path,
          group: project.official ? GROUP_OFFICIAL : GROUP_OWN,
          icon: (
            <Glyph
              name={project.official ? 'looks' : 'folder'}
              className="rich-pick__glyph"
            />
          ),
          ...(project.locked ? { locked: t('studio.plus.lockedProject') } : {}),
        })),
    [state.projects, locale, t],
  );
  const active = entries.find((entry) => entry.id === state.activeId);
  // The arrows walk the projects the bench can hold; a locked one is in the
  // menu to be seen, and stepping onto it would only open Plus.
  const openable = entries.filter((entry) => !entry.locked);
  const at = openable.findIndex((entry) => entry.id === state.activeId);
  const previous = openable[(at > 0 ? at : openable.length) - 1];
  const next = openable[(at + 1) % openable.length];
  const canStep = openable.length > 1 && !switching;
  const pick = async (id: string) => {
    if (picking.current) {
      return;
    }
    // A locked project is Plus's to open; the main process would refuse the
    // pick, and the member is shown what opens it instead.
    if (entries.some((entry) => entry.id === id && entry.locked)) {
      requestAccountPanel('subscribe');
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
        disabled={switching}
        entries={entries}
        groupLabel={(group) =>
          t(
            group === GROUP_OFFICIAL
              ? 'studio.project.groupOfficial'
              : 'studio.project.group',
          )
        }
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
            {state.mayAddProject ? (
              <MenuAction
                glyph="studio"
                label="studio.project.new"
                close={close}
                onPick={onNewProject}
              />
            ) : (
              <LockedMenuAction
                glyph="studio"
                label="studio.project.new"
                close={close}
                hint="studio.plus.oneProject"
              />
            )}
            {state.mayAddProject ? (
              <MenuAction
                glyph="folder"
                label="studio.project.add"
                close={close}
                onPick={onLinkFolder}
              />
            ) : (
              <LockedMenuAction
                glyph="folder"
                label="studio.project.add"
                close={close}
                hint="studio.plus.oneProject"
              />
            )}
            {state.entitled ? (
              <MenuAction
                glyph="download"
                label="studio.action.import"
                close={close}
                onPick={onOpenFile}
              />
            ) : (
              <LockedMenuAction
                glyph="download"
                label="studio.action.import"
                close={close}
                hint="studio.plus.locked"
              />
            )}
            {state.entitled ? (
              <MenuAction
                glyph="looks"
                label="studio.project.inspect"
                close={close}
                onPick={() =>
                  openGalleryPage({ kind: 'maker', maker: FLUIDEQ_MAKER })
                }
              />
            ) : (
              <LockedMenuAction
                glyph="looks"
                label="studio.project.inspect"
                close={close}
                hint="studio.plus.locked"
              />
            )}
            {active &&
              state.projects.some(
                (project) => project.id === active.id && !project.official,
              ) && (
                // A FluidEQ scene opened to look inside is not renamed: it is
                // theirs to take ideas from, not the member's to keep.
                <button
                  type="button"
                  className="rich-pick__action"
                  onClick={() => {
                    close();
                    const project = state.projects.find(
                      (entry) => entry.id === active.id,
                    );
                    if (project) {
                      setRenaming({
                        id: project.id,
                        name: active.name,
                        path: project.path,
                      });
                    }
                  }}
                >
                  <Glyph name="studio" />
                  {t('studio.project.rename', { name: active.name })}
                </button>
              )}
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
      {renaming && (
        <StudioRenameProjectDialog
          id={renaming.id}
          name={renaming.name}
          path={renaming.path}
          onClose={closeRename}
        />
      )}
    </div>
  );
}
