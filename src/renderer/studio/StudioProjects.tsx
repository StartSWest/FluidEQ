import { useCallback, useMemo, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { FLUIDEQ_CREATOR_ID } from 'common/plusGallery';
import { resolveSceneName } from 'common/scenePacks';
import type { IStudioProject, IStudioState } from 'main/ipc/memberScenes';
import Glyph, { type TCommunityGlyph } from '../community/Glyph';
import Chevron from '../icons/Chevron';
import MenuIcon from '../icons/MenuIcon';
import { openGalleryPage, type IMakerRef } from '../plus/plusNavigation';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { type IRichPickEntry } from '../widgets/RichPick';
import StudioRenameProjectDialog from './StudioRenameProjectDialog';
import SceneReviewBadge from '../plus/SceneReviewBadge';
import { useStudioChat, type TStudioChatWork } from './chat/studioChatStore';
import { forgetStudioProject, selectStudioProject } from './studioStore';
import useProjectsReleased, {
  type TProjectRelease,
} from './useProjectsReleased';

const GROUP_OWN = 'projects';
const GROUP_OFFICIAL = 'official';
const GROUP_MEMBER = 'member';

/** Where a project files in the list: the member's own first. */
const groupOf = (project: IStudioProject) => {
  if (project.member) {
    return GROUP_MEMBER;
  }
  return project.official ? GROUP_OFFICIAL : GROUP_OWN;
};
const GROUP_ORDER = [GROUP_OWN, GROUP_OFFICIAL, GROUP_MEMBER];

const GLYPH_OF: Record<string, TCommunityGlyph> = {
  [GROUP_OWN]: 'folder',
  [GROUP_OFFICIAL]: 'looks',
  [GROUP_MEMBER]: 'person',
};

const GROUP_LABELS: Record<string, TranslationKey> = {
  [GROUP_OWN]: 'studio.project.group',
  [GROUP_OFFICIAL]: 'studio.project.groupOfficial',
  [GROUP_MEMBER]: 'studio.project.groupMember',
};

/** What a project's row says its chat is doing, ahead of its folder. */
const WORK_LABEL: Record<TStudioChatWork, TranslationKey> = {
  working: 'studio.project.aiWorking',
  waiting: 'studio.project.aiWaiting',
  replied: 'studio.project.aiReplied',
};

/** Where a project stands in the gallery, when its AI is not at it. */
const RELEASE_LABEL: Record<TProjectRelease, TranslationKey> = {
  published: 'studio.project.published',
  review: 'studio.project.inReview',
};

const RELEASE_HINT: Record<TProjectRelease, TranslationKey> = {
  published: 'studio.project.publishedHint',
  review: 'studio.project.inReviewHint',
};

/** What the picker's own button says about the other scenes' chats. */
const NEWS_LABEL: Record<TStudioChatWork, TranslationKey> = {
  working: 'studio.project.aiWorkingElsewhere',
  waiting: 'studio.project.aiWaitingElsewhere',
  replied: 'studio.project.aiRepliedElsewhere',
};

/** Which news the button carries: what needs the member most comes first. */
const NEWS_ORDER: readonly TStudioChatWork[] = [
  'waiting',
  'replied',
  'working',
];

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
  const { work } = useStudioChat();
  const releaseOf = useProjectsReleased(state.projects);
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
    // Scenes opened to look inside file after the member's own, FluidEQ's
    // and then other members', so a project called "Aurora" of theirs is
    // never mistaken for somebody else's.
    () =>
      [...state.projects]
        .sort(
          (a, b) =>
            GROUP_ORDER.indexOf(groupOf(a)) - GROUP_ORDER.indexOf(groupOf(b)) ||
            a.path.localeCompare(b.path),
        )
        .map((project) => {
          const doing = work[project.id];
          // An AI at work on it says so instead: the scene is changing.
          const release = doing ? undefined : releaseOf(project);
          // The review's word on it stands beside whatever else is said. A
          // version in review says so by its icon alone (below), so the
          // review's own pending icon would only say it twice.
          const mark =
            groupOf(project) !== GROUP_OWN || release === 'review' ? null : (
              <SceneReviewBadge sceneId={project.sceneId} />
            );
          let trailing;
          if (doing) {
            trailing = (
              <span className={`studio-projects__state is-${doing}`}>
                {t(WORK_LABEL[doing])}
              </span>
            );
          } else if (release === 'review') {
            // The icon alone at the row's end, its words on a hover and to a
            // screen reader (Ivan, 2026-11-12: "just keep the icon at the end,
            // and the hover says it"). As a word it wrapped onto a second
            // line on a narrow picker and made the row taller than the rest.
            trailing = (
              <span
                className="scene-review-mark scene-review-mark--pending"
                role="img"
                aria-label={t(RELEASE_LABEL.review)}
                title={t(RELEASE_HINT.review)}
              >
                <MenuIcon name="pending" />
              </span>
            );
          } else if (release) {
            trailing = (
              <span
                className={`studio-projects__state is-${release}`}
                title={t(RELEASE_HINT[release])}
              >
                {t(RELEASE_LABEL[release])}
              </span>
            );
          }
          return {
            id: project.id,
            name: project.names
              ? resolveSceneName({ names: project.names }, locale)
              : project.folderName,
            hint: project.path,
            group: groupOf(project),
            icon: (
              <Glyph
                name={GLYPH_OF[groupOf(project)] ?? 'folder'}
                className="rich-pick__glyph"
              />
            ),
            ...(trailing || mark
              ? {
                  trailing: (
                    <>
                      {mark}
                      {trailing}
                    </>
                  ),
                }
              : {}),
          };
        }),
    [state.projects, locale, work, t, releaseOf],
  );
  // Another scene's chat with news: one waiting on the member first, then a
  // reply, then one at work.
  const elsewhere = Object.entries(work)
    .filter(([id]) => id !== state.activeId)
    .map(([, doing]) => doing);
  const news = NEWS_ORDER.find((doing) => elsewhere.includes(doing));
  const active = entries.find((entry) => entry.id === state.activeId);
  const at = entries.findIndex((entry) => entry.id === state.activeId);
  const previous = entries[(at > 0 ? at : entries.length) - 1];
  const next = entries[(at + 1) % entries.length];
  const canStep = entries.length > 1 && !switching;
  const pick = async (id: string) => {
    if (picking.current) {
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
        groupLabel={(group) => t(GROUP_LABELS[group] ?? 'studio.project.group')}
        activeId={state.activeId ?? ''}
        onPick={pick}
        placeholder={t(
          entries.length > 0 ? 'studio.project.none' : 'studio.project.empty',
        )}
        triggerAriaLabel={
          news
            ? `${t('studio.project.label')} · ${t(NEWS_LABEL[news])}`
            : t('studio.project.label')
        }
        triggerTitle={
          news
            ? `${active?.hint ?? t('studio.project.label')}\n${t(NEWS_LABEL[news])}`
            : (active?.hint ?? t('studio.project.label'))
        }
        placeholderIcon={<Glyph name="folder" className="rich-pick__glyph" />}
        triggerExtra={
          <>
            {active && (
              <span className="studio-projects__live" aria-hidden="true" />
            )}
            {news && (
              <span
                className={`studio-projects__news is-${news}`}
                aria-hidden="true"
              />
            )}
          </>
        }
        renderFooter={(close) => (
          <>
            {state.mayAddProject && (
              <>
                <MenuAction
                  glyph="studio"
                  label="studio.project.new"
                  close={close}
                  onPick={onNewProject}
                />
                <MenuAction
                  glyph="folder"
                  label="studio.project.add"
                  close={close}
                  onPick={onLinkFolder}
                />
              </>
            )}
            <MenuAction
              glyph="download"
              label="studio.action.import"
              close={close}
              onPick={onOpenFile}
            />
            {/* FluidEQ's own scenes open to look inside once they are this
                account's; their maker page is where each one says so. */}
            <MenuAction
              glyph="looks"
              label="studio.project.inspect"
              close={close}
              onPick={() =>
                openGalleryPage({ kind: 'maker', maker: FLUIDEQ_MAKER })
              }
            />
            {active &&
              state.projects.some(
                (project) =>
                  project.id === active.id && groupOf(project) === GROUP_OWN,
              ) && (
                // A scene opened to look inside, FluidEQ's or another
                // member's, is not renamed: it is there to take ideas from,
                // not the member's to keep.
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
