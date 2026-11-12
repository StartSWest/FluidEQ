/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { copyPath, pathKey, samePath, type TNodePath } from 'common/sceneEdit';
import type { TWorldNode } from 'common/sceneWorld';
import { useTranslation } from '../../utils/I18nContext';
import EditGlyph from './EditGlyph';
import { lockedIn } from './editMarks';
import { copiesIn, KIND_ICONS, KIND_NAMES } from './editNames';
import type { IStageEditState, IStageEditStore } from './stageEditStore';

/**
 * Edit mode's list of the scene's things, down the stage's left side: a
 * tree with a row per thing, and on each row what the member works with —
 * Solo, the working Hide and the lock — and, on a thing the scene's own file
 * switches off, the press that turns it back on.
 */

interface IStudioEditListProps {
  store: IStageEditStore;
  state: IStageEditState;
  nodes: readonly TWorldNode[];
  nameOf: (node: TWorldNode, path: TNodePath) => string;
  /** The row whose name is being typed, by path. */
  renaming: string | undefined;
  setRenaming: (key: string | undefined) => void;
  /** The member's AI, asked this, or opened when there is nothing to ask. */
  ask: (text?: string) => void;
  /** Something is picked: the hint about picking has said its piece. */
  hasPick: boolean;
}

interface IRow {
  node: TWorldNode;
  path: number[];
  isCopy: boolean;
  inside: number;
}

/** What each thing the Add menu makes is, drawn as the list draws it. */
const ADDED_KINDS = {
  box: 'mesh',
  ball: 'mesh',
  light: 'light',
  group: 'group',
} as const;

/** Whether `inner` stands inside `outer`, not being it. */
const isInside = (inner: TNodePath, outer: TNodePath) =>
  inner.length > outer.length && samePath(inner.slice(0, outer.length), outer);

export default function StudioEditList({
  store,
  state,
  nodes,
  nameOf,
  renaming,
  setRenaming,
  ask,
  hasPick,
}: IStudioEditListProps) {
  const { t } = useTranslation();
  const [find, setFind] = useState('');
  const [adding, setAdding] = useState(false);
  /** Which rows the member opened or closed, by path; the rest as they start. */
  const [open, setOpen] = useState<Readonly<Record<string, boolean>>>({});

  const wanted = find.trim().toLowerCase();
  /**
   * The scene as a tree: a group's parts under it, and under a node that
   * draws many copies — a shoal's fish — each copy by its number. A group
   * starts open and a shoal closed, ninety rows being a lot to open on;
   * a shoal opens by itself when one of its copies is picked on the stage.
   */
  const isOpen = (key: string, node: TWorldNode) =>
    // Whatever holds a picked thing is open: picked on the stage, its row
    // has to be there to be seen.
    state.selected.some(
      (path) => path.length > 1 && pathKey(path).startsWith(`${key}.`),
    ) ||
    (open[key] ?? node.type !== 'instances');
  const rows: IRow[] = [];
  const walk = (list: readonly TWorldNode[], above: readonly number[]) => {
    list.forEach((node, index) => {
      const path = [...above, index];
      const copies = copiesIn(node);
      if (!wanted || nameOf(node, path).toLowerCase().includes(wanted)) {
        rows.push({
          node,
          path,
          isCopy: false,
          inside: node.children.length + copies,
        });
      }
      // A search looks inside everything, but not through every copy.
      if (wanted) {
        walk(node.children, path);
      } else if (isOpen(pathKey(path), node)) {
        walk(node.children, path);
        for (let copy = 0; copy < copies; copy += 1) {
          rows.push({
            node,
            path: copyPath(path, copy),
            isCopy: true,
            inside: 0,
          });
        }
      }
    });
  };
  walk(nodes, []);

  const isPicked = (path: TNodePath) =>
    state.selected.some((known) => samePath(known, path));
  const last = state.selected[state.selected.length - 1];
  /**
   * A press on a row, as every list of files takes one: alone it picks the
   * row, with Ctrl it adds or drops it, with Shift it picks the run from
   * the last one picked to it.
   */
  const pickRow = (
    path: number[],
    event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
  ) => {
    const from = last ? rows.findIndex((row) => samePath(row.path, last)) : -1;
    const to = rows.findIndex((row) => samePath(row.path, path));
    if (event.shiftKey && from >= 0 && to >= 0) {
      const run = rows
        .slice(Math.min(from, to), Math.max(from, to) + 1)
        .map((row) => row.path);
      // The pressed one last: it is the one the numbers show.
      store.selectMany([
        ...run.filter((known) => !samePath(known, path)),
        path,
      ]);
    } else {
      store.select(path, event.ctrlKey || event.metaKey);
    }
  };
  /** On one of several picked things, all of them; else that one alone. */
  const onPicked = (path: TNodePath) =>
    isPicked(path) && state.selected.length > 1;

  const soloFlag = (path: number[], name: string) => {
    // What Solo shows is what is picked; its rows say so wherever they are,
    // and so does every row holding one, open or closed.
    const soloed = state.solo && isPicked(path);
    const holds =
      state.solo &&
      !soloed &&
      state.selected.some((known) => isInside(known, path));
    let soloTitle: TranslationKey = 'studio.edit.soloHint';
    if (soloed) {
      soloTitle = 'studio.edit.soloOn';
    } else if (holds) {
      soloTitle = 'studio.edit.soloInside';
    }
    return (
      <button
        type="button"
        className={`studio-edit__flag studio-edit__flag--solo${holds ? ' is-inside' : ''}`}
        aria-pressed={soloed}
        aria-label={`${t('studio.edit.solo')}: ${name}`}
        title={t(soloTitle)}
        onClick={() => {
          if (soloed) {
            store.setSolo(false);
          } else {
            store.select(path, false);
            store.setSolo(true);
          }
        }}
      >
        <EditGlyph name="solo" />
      </button>
    );
  };

  return (
    <aside
      className="studio-edit__panel"
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <header className="studio-edit__head">
        <h3>{t('studio.edit.list.title')}</h3>
        <button
          type="button"
          className="button small studio-edit__add"
          aria-expanded={adding}
          onClick={() => setAdding(!adding)}
        >
          <EditGlyph name="add" />
          {t('studio.edit.add')}
        </button>
      </header>
      {adding && (
        <div className="studio-edit__menu" role="menu">
          {(
            [
              ['box', 'studio.edit.add.box'],
              ['ball', 'studio.edit.add.ball'],
              ['light', 'studio.edit.add.light'],
              ['group', 'studio.edit.add.group'],
            ] as const
          ).map(([shape, key]) => (
            <button
              key={shape}
              type="button"
              role="menuitem"
              onClick={() => {
                store.add(shape, t(key));
                setAdding(false);
              }}
            >
              <svg
                className="studio-edit__kind"
                viewBox="0 0 16 16"
                aria-hidden="true"
                focusable="false"
              >
                <path d={KIND_ICONS[ADDED_KINDS[shape]]} />
              </svg>
              {t(key)}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className="is-ask"
            onClick={() => {
              ask(t('studio.edit.add.askDraft'));
              setAdding(false);
            }}
          >
            <EditGlyph name="ask" className="studio-edit__kind" />
            {t('studio.edit.add.ask')}
          </button>
        </div>
      )}
      <input
        type="search"
        className="studio-edit__find"
        value={find}
        placeholder={t('studio.edit.list.find')}
        aria-label={t('studio.edit.list.find')}
        onChange={(event) => setFind(event.target.value)}
      />
      <ul className="studio-edit__list">
        {rows.length === 0 && (
          <li className="studio-edit__aside">{t('studio.edit.list.empty')}</li>
        )}
        {rows.map(({ node, path, isCopy, inside }) => {
          const key = pathKey(path);
          // Off in the scene's own file, which only a change turns back on;
          // hidden by the member, which is only while they work.
          const off = node.visible === 0;
          const hidden = state.hidden.includes(key);
          const locked = lockedIn(state.unlocked, path);
          const ownLock = state.ownLock.includes(key);
          const name = nameOf(node, path);
          return (
            <li
              key={key}
              className={`studio-edit__row${isPicked(path) ? ' is-picked' : ''}${off || hidden ? ' is-hidden' : ''}${state.hovered && pathKey(state.hovered.path) === key ? ' is-over' : ''}`}
              style={{ paddingLeft: wanted ? 0 : (path.length - 1) * 12 }}
              onPointerEnter={() => store.hoverOn(path)}
              onPointerLeave={() => store.hoverOn(undefined)}
            >
              {inside > 0 && !wanted ? (
                <button
                  type="button"
                  className="studio-edit__fold"
                  aria-expanded={isOpen(key, node)}
                  aria-label={`${t(isOpen(key, node) ? 'studio.edit.collapse' : 'studio.edit.expand')}: ${name}`}
                  onClick={() =>
                    setOpen({ ...open, [key]: !isOpen(key, node) })
                  }
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M5.5 3.5L10.5 8l-5 4.5" />
                  </svg>
                </button>
              ) : (
                <span className="studio-edit__fold" aria-hidden="true" />
              )}
              {renaming === key ? (
                <input
                  className="studio-edit__rename"
                  defaultValue={node.name ?? ''}
                  aria-label={t('studio.edit.rename')}
                  maxLength={64}
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- the field replaces the row the member just asked to rename
                  autoFocus
                  onBlur={(event) => {
                    const typed = event.target.value.trim();
                    if (typed !== (node.name ?? '')) {
                      store.send([{ kind: 'rename', path, name: typed }]);
                    }
                    setRenaming(undefined);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === 'Escape') {
                      event.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="studio-edit__name"
                  aria-pressed={isPicked(path)}
                  title={name}
                  onClick={(event) => pickRow(path, event)}
                  onDoubleClick={() => {
                    if (!isCopy) {
                      setRenaming(key);
                    }
                  }}
                >
                  <svg
                    className="studio-edit__kind"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d={KIND_ICONS[node.type]} />
                  </svg>
                  <span>{name}</span>
                  {off && !isCopy ? (
                    <small className="is-off">
                      {t('studio.edit.offInScene')}
                    </small>
                  ) : (
                    node.name !== undefined &&
                    !isCopy && (
                      <small>
                        {inside > node.children.length
                          ? `${t(KIND_NAMES[node.type])} · ${String(inside - node.children.length)}`
                          : t(KIND_NAMES[node.type])}
                      </small>
                    )
                  )}
                </button>
              )}
              {off && !isCopy && (
                <button
                  type="button"
                  className="studio-edit__flag studio-edit__flag--on"
                  aria-label={`${t('studio.edit.turnOn')}: ${name}`}
                  title={t('studio.edit.turnOnHint')}
                  onClick={() =>
                    onPicked(path)
                      ? store.showPicked(true)
                      : store.send([{ kind: 'show', path, shown: true }])
                  }
                >
                  <EditGlyph name="eye" />
                </button>
              )}
              {soloFlag(path, name)}
              {!isCopy && (
                <>
                  <button
                    type="button"
                    className="studio-edit__flag studio-edit__flag--hide"
                    aria-pressed={hidden}
                    aria-label={`${t('studio.edit.hide')}: ${name}`}
                    title={t('studio.edit.hideHint')}
                    onClick={() =>
                      onPicked(path)
                        ? store.hidePicked(!hidden)
                        : store.toggleHidden(path)
                    }
                  >
                    <EditGlyph name={hidden ? 'eye-off' : 'eye'} />
                  </button>
                  <button
                    type="button"
                    className={`studio-edit__flag studio-edit__flag--lock${locked ? '' : ' is-free'}${ownLock ? '' : ' is-inherited'}`}
                    aria-pressed={locked}
                    aria-label={`${t('studio.edit.lockShort')}: ${name}`}
                    title={t(
                      locked
                        ? 'studio.edit.lockedHint'
                        : 'studio.edit.unlockedHint',
                    )}
                    onClick={() =>
                      onPicked(path)
                        ? store.lockPicked(!locked)
                        : store.toggleLock(path)
                    }
                  >
                    <EditGlyph name={locked ? 'lock' : 'unlock'} />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {!hasPick && (
        <p className="studio-edit__aside">
          {t('studio.edit.hint')} {t('studio.edit.panHint')}
        </p>
      )}
    </aside>
  );
}
