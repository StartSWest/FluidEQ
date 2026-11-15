/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * THE FOLDERS SHELF'S TREE, IN THE RAIL, OPENING THE WAY WINDOWS EXPLORER'S
 * NAVIGATION PANE DOES (Ivan, 2026-11-14).
 *
 * The roots somebody added, then what is inside each, one level at a time,
 * asked of the store as a branch opens (`children`) and never held whole.
 * A caret only where a folder of music lies beneath (`hasFolders`), a count
 * beside every name, and the folder the reader stands in lit — opened from
 * anywhere else (a crumb, a row, a restart) the branches above it open so it
 * is on screen.
 *
 * A press on a name stands there, opening its branch with it; a press on the
 * caret only opens or closes, as Explorer's does. The keyboard is the tree
 * pattern's: Up and Down walk what is visible, Right opens or steps in, Left
 * closes or steps out, Home and End, Enter to stand there.
 */

import {
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ILibraryRoot } from '../../common/library/types';
import type {
  ILibraryFolderItem,
  TLibraryRequest,
} from '../../common/library/query';
import { normaliseFolderPath } from '../../common/library/grouping';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { placeTrail } from './LibraryPlaceBar';
import { formatCount } from './libraryFormat';
import { useLibraryAnswer } from './useLibraryAnswer';

/**
 * Folders asked for under one parent at once — the store's page ceiling. A
 * folder holding more than that lists the first ones and a row that opens the
 * folder itself, where the shelf pages through all of them.
 */
const BRANCH_LIMIT = 500;

const ROOTS_REQUEST = {
  type: 'page',
  query: { shelf: 'roots', scope: {}, direction: 'asc' },
  offset: 0,
  limit: BRANCH_LIMIT,
} as const satisfies TLibraryRequest;

const branchRequest = (
  parent: string,
): Extract<TLibraryRequest, { type: 'page' }> => ({
  type: 'page',
  query: {
    shelf: 'children',
    scope: {},
    parent,
    sort: 'title',
    direction: 'asc',
  },
  offset: 0,
  limit: BRANCH_LIMIT,
});

const foldersOf = (
  items: readonly { kind: string }[] | undefined,
): ILibraryFolderItem[] =>
  (items ?? []).filter(
    (item): item is ILibraryFolderItem => item.kind === 'folder',
  );

interface ITreeContext {
  selected: string | undefined;
  focused: string | undefined;
  isExpanded: (path: string) => boolean;
  toggle: (path: string) => void;
  open: (path: string) => void;
  focus: (path: string) => void;
  /** The way a root is spelled on screen: as it was added, `D:\Music`. */
  rootLabel: (path: string) => string | undefined;
  offline: ReadonlySet<string>;
  locale: string;
  /** The tree pattern's keys, handled by the row that has the focus. */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

const FolderNode = ({
  folder,
  level,
  context,
}: {
  folder: ILibraryFolderItem;
  level: number;
  context: ITreeContext;
}) => {
  const path = folder.id;
  const isExpanded = folder.hasFolders === true && context.isExpanded(path);
  const isSelected = context.selected === path;
  const label = context.rootLabel(path) ?? folder.name;
  return (
    <li role="none">
      <div
        role="treeitem"
        aria-level={level}
        aria-selected={isSelected}
        aria-expanded={folder.hasFolders === true ? isExpanded : undefined}
        tabIndex={context.focused === path ? 0 : -1}
        data-path={path}
        className={`library-tree__item${isSelected ? ' is-selected' : ''}${
          context.offline.has(path) ? ' is-offline' : ''
        }`}
        style={{ '--tree-level': level - 1 } as CSSProperties}
        title={label}
        onKeyDown={context.onKeyDown}
        onClick={(event) => {
          // The caret opens and closes, as Explorer's does; standing in the
          // folder is the name's press. The keyboard reaches both through
          // the row's own keys (`onKeyDown`).
          if (
            event.target instanceof Element &&
            event.target.closest('.library-tree__caret') !== null
          ) {
            context.toggle(path);
            return;
          }
          context.open(path);
        }}
        onFocus={() => context.focus(path)}
      >
        {folder.hasFolders === true ? (
          <span
            className={`library-tree__caret${isExpanded ? ' is-open' : ''}`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 16 16">
              <path d="M6 3.5L10.5 8 6 12.5" />
            </svg>
          </span>
        ) : (
          <span className="library-tree__caret" aria-hidden="true" />
        )}
        <MenuIcon name="folder" className="library-tree__icon" />
        <span className="library-tree__name">{label}</span>
        <small className="library-tree__count">
          {formatCount(folder.trackCount, context.locale)}
        </small>
      </div>
      {isExpanded && (
        <FolderBranch parent={path} level={level + 1} context={context} />
      )}
    </li>
  );
};

const FolderBranch = ({
  parent,
  level,
  context,
}: {
  parent: string;
  level: number;
  context: ITreeContext;
}) => {
  const { t } = useTranslation();
  const answer = useLibraryAnswer(branchRequest(parent));
  const folders = foldersOf(answer?.items);
  const hidden = (answer?.total ?? 0) - folders.length;
  return (
    <ul role="group" className="library-tree__group">
      {folders.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          level={level}
          context={context}
        />
      ))}
      {hidden > 0 && (
        <li role="none">
          <button
            type="button"
            className="library-tree__more"
            style={{ '--tree-level': level - 1 } as CSSProperties}
            onClick={() => context.open(parent)}
          >
            {t('library.tree.more', {
              count: formatCount(hidden, context.locale),
            })}
          </button>
        </li>
      )}
    </ul>
  );
};

const LibraryFolderTree = ({
  roots,
  openFolderPath,
  onOpenFolder,
}: {
  roots: readonly ILibraryRoot[];
  /** The folder the reader stands in, lit and kept in view. */
  openFolderPath: string | undefined;
  onOpenFolder: (folderPath: string) => void;
}) => {
  const { t, locale } = useTranslation();
  const rootsAnswer = useLibraryAnswer(ROOTS_REQUEST);
  const rootFolders = foldersOf(rootsAnswer?.items);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [focused, setFocused] = useState<string | undefined>(openFolderPath);
  const treeRef = useRef<HTMLUListElement>(null);

  // The branches above the folder the reader stands in open, wherever the
  // reader got there from. Added, never replacing: the branches they opened
  // by hand stay open.
  useEffect(() => {
    if (openFolderPath === undefined) {
      return;
    }
    const above = placeTrail(openFolderPath, roots).slice(0, -1);
    if (above.length === 0) {
      return;
    }
    setExpanded((current) => {
      if (above.every((path) => current.has(path))) {
        return current;
      }
      const next = new Set(current);
      above.forEach((path) => next.add(path));
      return next;
    });
  }, [openFolderPath, roots]);

  const labels = useMemo(
    () =>
      new Map(roots.map((root) => [normaliseFolderPath(root.path), root.path])),
    [roots],
  );
  const offline = useMemo(
    () =>
      new Set(
        roots
          .filter((root) => root.isOffline)
          .map((root) => normaliseFolderPath(root.path)),
      ),
    [roots],
  );

  const toggle = useCallback((path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const open = useCallback(
    (path: string) => {
      setFocused(path);
      setExpanded((current) =>
        current.has(path) ? current : new Set(current).add(path),
      );
      onOpenFolder(path);
    },
    [onOpenFolder],
  );

  const context: ITreeContext = {
    selected: openFolderPath,
    // Tab lands on the lit folder, or the first root when none is.
    focused: focused ?? openFolderPath ?? rootFolders[0]?.id,
    isExpanded: (path) => expanded.has(path),
    toggle,
    open,
    focus: setFocused,
    rootLabel: (path) => labels.get(path),
    offline,
    locale,
    // Read when a key lands, by which time the handler below exists.
    onKeyDown: (event) => onKeyDown(event),
  };

  /** The visible rows, top to bottom, read off the tree as drawn. */
  const visibleItems = () =>
    Array.from(
      treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [],
    );

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const items = visibleItems();
    const at = items.findIndex((item) => item === document.activeElement);
    if (at < 0) {
      return;
    }
    const item = items[at];
    const path = item.dataset.path ?? '';
    const isOpen = item.getAttribute('aria-expanded') === 'true';
    const canOpen = item.hasAttribute('aria-expanded');
    const moveTo = (index: number) => {
      const target = items[Math.max(0, Math.min(items.length - 1, index))];
      target?.focus();
    };
    const level = Number(item.getAttribute('aria-level'));
    switch (event.key) {
      case 'ArrowDown':
        moveTo(at + 1);
        break;
      case 'ArrowUp':
        moveTo(at - 1);
        break;
      case 'Home':
        moveTo(0);
        break;
      case 'End':
        moveTo(items.length - 1);
        break;
      case 'ArrowRight':
        if (canOpen && !isOpen) {
          toggle(path);
        } else if (isOpen) {
          moveTo(at + 1);
        }
        break;
      case 'ArrowLeft':
        if (isOpen) {
          toggle(path);
        } else {
          // Out to the folder this one sits in: the nearest row above it one
          // level up.
          for (let index = at - 1; index >= 0; index -= 1) {
            if (Number(items[index].getAttribute('aria-level')) < level) {
              moveTo(index);
              break;
            }
          }
        }
        break;
      case 'Enter':
      case ' ':
        open(path);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <ul
      ref={treeRef}
      role="tree"
      aria-label={t('library.browse.folder')}
      className="library-tree"
    >
      {rootFolders.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          level={1}
          context={context}
        />
      ))}
    </ul>
  );
};

export default LibraryFolderTree;
