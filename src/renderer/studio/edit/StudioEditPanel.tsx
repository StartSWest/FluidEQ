/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  copyPath,
  pathInWords,
  pathKey,
  samePath,
  type ISceneEditThing,
  type TNodePath,
  type TTriple,
  type TWorldEditFailure,
} from 'common/sceneEdit';
import type { IScenePack } from 'common/scenePacks';
import type { TWorldNode } from 'common/sceneWorld';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import { askSceneChat, focusSceneChat } from '../chat/askSceneChat';
import { setChatDraftStage } from '../chat/chatDraftStore';
import {
  copiesIn,
  KIND_ICONS,
  KIND_NAMES,
  nodeAt,
  thingName,
} from './editNames';
import { setEditPicks } from './editPicksStore';
import markPicture from './markPicture';
import { emptyMove, type IStageEditStore } from './stageEditStore';
import { useStageEditState } from './useStageEdit';

/**
 * Edit mode's panel, down the stage's left side: every thing in the scene,
 * what can be done to the picked ones, and their numbers. On a painted
 * scene, which has no things, what marking is and the marks' own buttons.
 */

const KINDS = KIND_NAMES;

const FAILURES: Record<TWorldEditFailure, TranslationKey> = {
  closed: 'studio.edit.failure.failed',
  'no-world': 'studio.edit.failure.failed',
  mismatch: 'studio.edit.failure.mismatch',
  missing: 'studio.edit.failure.missing',
  'formula-full': 'studio.edit.failure.formula',
  refused: 'studio.edit.failure.refused',
  failed: 'studio.edit.failure.failed',
};

interface IEditNumberProps {
  /** The axis, beside the field. */
  label: string;
  /** What a screen reader calls it: the row's name and the axis. */
  name: string;
  value: number;
  /** Shown in degrees, kept in radians. */
  degrees?: boolean;
  /** The value is a formula: it follows the music. */
  follows: boolean;
  onChange: (value: number) => void;
}

const shownAs = (value: number, degrees: boolean) =>
  String(
    degrees
      ? Math.round(((value * 180) / Math.PI) * 10) / 10
      : Math.round(value * 1000) / 1000,
  );

function EditNumber({
  label,
  name,
  value,
  degrees = false,
  follows,
  onChange,
}: IEditNumberProps) {
  const text = shownAs(value, degrees);
  const [draft, setDraft] = useState<string>();
  // What was typed gives way to the thing's own number once that changes.
  useEffect(() => setDraft(undefined), [text]);
  const commit = () => {
    const typed = draft === undefined ? NaN : Number(draft.replace(',', '.'));
    if (draft !== undefined && Number.isFinite(typed) && draft !== text) {
      onChange(degrees ? (typed * Math.PI) / 180 : typed);
    } else {
      setDraft(undefined);
    }
  };
  return (
    <div className={`studio-edit__number${follows ? ' is-following' : ''}`}>
      <span aria-hidden="true">{label}</span>
      <input
        type="text"
        aria-label={name}
        inputMode="decimal"
        value={draft ?? text}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

interface IStudioEditPanelProps {
  store: IStageEditStore;
  pack: IScenePack;
  projectId: string;
  /** The stage's picture as it stands, for the marks to be drawn on. */
  capture?: () => Promise<Uint8Array | undefined>;
  /** Edit mode's plate, which heads the panels while Edit is on. */
  bar: ReactNode;
  style?: CSSProperties;
}

const FIELDS = [
  { field: 'position', key: 'studio.edit.place', fallback: 0 },
  { field: 'rotation', key: 'studio.edit.turn', fallback: 0 },
  { field: 'scale', key: 'studio.edit.size', fallback: 1 },
] as const;

export default function StudioEditPanel({
  store,
  pack,
  projectId,
  capture,
  bar,
  style,
}: IStudioEditPanelProps) {
  const { t } = useTranslation();
  const state = useStageEditState(store);
  const [find, setFind] = useState('');
  const [renaming, setRenaming] = useState<string>();
  const [adding, setAdding] = useState(false);
  /** Which rows the member opened or closed, by path; the rest as they start. */
  const [open, setOpen] = useState<Readonly<Record<string, boolean>>>({});
  const shadowId = useId();
  // How much of the stage's edges the panels take, told to the stage so it
  // can stand the scene in the room that is left (Ivan, 2026-11-11: "the
  // floating panes on the side and bottom don't help because the scene that
  // part can't be seen"). Measured, never assumed: the plate wraps, the
  // strip grows with what is picked and every language is its own width.
  const dockRef = useRef<HTMLDivElement>(null);
  const hasList = state.listOpen;
  const hasPick = state.selected.length > 0;
  useLayoutEffect(() => {
    const dock = dockRef.current;
    if (!dock) {
      return undefined;
    }
    const measure = () => {
      const height = (selector: string) =>
        dock.querySelector<HTMLElement>(selector)?.offsetHeight ?? 0;
      const panel = dock.querySelector<HTMLElement>('.studio-edit__panel');
      const gap = 8;
      const strip = height('.studio-edit__thing');
      store.setInsets({
        top: height('.studio-edit__bar') + gap,
        left: panel ? panel.offsetWidth + gap : 0,
        bottom: strip > 0 ? strip + gap : 0,
      });
    };
    const watch = new ResizeObserver(measure);
    watch.observe(dock);
    Array.from(dock.children).forEach((child) => watch.observe(child));
    measure();
    return () => watch.disconnect();
  }, [store, hasList, hasPick]);
  useEffect(
    () => () => store.setInsets({ left: 0, top: 0, bottom: 0 }),
    [store],
  );
  const nodes = pack.world?.nodes;

  const nameOf = (node: TWorldNode, path: TNodePath) =>
    thingName(node, path, t);

  const ask = (text?: string) => {
    if (text !== undefined) {
      askSceneChat(projectId, text).catch(() => undefined);
    } else {
      focusSceneChat();
    }
  };

  const failure = state.failure && (
    <div role="alert">
      <button
        type="button"
        className="studio-edit__failure"
        onClick={store.clearFailure}
      >
        <Glyph name="alert" />
        <span>{t(FAILURES[state.failure])}</span>
      </button>
    </div>
  );

  if (!nodes) {
    const sendMarks = async () => {
      const shot = await capture?.();
      const marked = shot && (await markPicture(shot, state.marks));
      if (!marked) {
        return;
      }
      setChatDraftStage(projectId, marked);
      setEditPicks(
        projectId,
        state.marks.map((mark, index) => ({
          label: String(index + 1),
          where: `mark ${String(index + 1)} on the attached picture, ${
            mark.kind === 'pin' ? 'a spot' : 'the boxed area'
          }`,
        })),
      );
      focusSceneChat();
    };
    return (
      <div ref={dockRef} className="studio-edit__dock" style={style}>
        {bar}
        <aside className="studio-edit__panel">
          <h3>{t('studio.edit.flat.title')}</h3>
          <p>{t('studio.edit.flat.body')}</p>
          <div className="studio-edit__actions" role="group">
            <button
              type="button"
              className="button small subtle"
              aria-pressed={state.markTool === 'pin'}
              onClick={() => store.setMarkTool('pin')}
            >
              {t('studio.edit.flat.pin')}
            </button>
            <button
              type="button"
              className="button small subtle"
              aria-pressed={state.markTool === 'box'}
              onClick={() => store.setMarkTool('box')}
            >
              {t('studio.edit.flat.box')}
            </button>
          </div>
          <div className="studio-edit__actions">
            <button
              type="button"
              className="button small"
              disabled={state.marks.length === 0 || !capture}
              onClick={() => {
                sendMarks().catch(() => undefined);
              }}
            >
              {t('studio.edit.flat.send')}
            </button>
            <button
              type="button"
              className="button small subtle"
              disabled={state.marks.length === 0}
              onClick={store.clearMarks}
            >
              {t('studio.edit.flat.clear')}
            </button>
          </div>
          <p className="studio-edit__aside">
            {t('studio.edit.flat.rebuildWhy')}
          </p>
          <button
            type="button"
            className="button small subtle"
            onClick={() => ask(t('studio.edit.flat.rebuildDraft'))}
          >
            {t('studio.edit.flat.rebuild')}
          </button>
        </aside>
      </div>
    );
  }

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
  const rows: {
    node: TWorldNode;
    path: number[];
    isCopy: boolean;
    inside: number;
  }[] = [];
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
  const lastNode = last && nodeAt(nodes, last);
  // Single copies of a shoal are made by its rule: there is nothing of
  // theirs in the file to move, hide or delete.
  const onlyCopies = store.nodesPicked().length === 0;
  const thing: ISceneEditThing | undefined = state.things.find(
    (known) => last !== undefined && samePath(known.path, last),
  );

  const askAbout = () => {
    setEditPicks(
      projectId,
      state.selected.flatMap((path) => {
        const node = nodeAt(nodes, path);
        return node
          ? [{ label: nameOf(node, path), where: pathInWords(path) }]
          : [];
      }),
    );
    ask();
  };

  const change = (
    field: 'position' | 'rotation' | 'scale',
    axis: number,
    value: number,
  ) => {
    if (!thing) {
      return;
    }
    const move = emptyMove(thing.path);
    const now = thing[field][axis];
    const parts = [0, 1, 2].map((at) => {
      if (field === 'scale') {
        return at === axis && Math.abs(now) > 1e-6 ? value / now : 1;
      }
      return at === axis ? value - now : 0;
    }) as unknown as TTriple;
    store.nudge({ ...move, [field]: parts });
  };

  return (
    <div
      ref={dockRef}
      className={`studio-edit__dock${state.dragging ? ' is-dragging' : ''}`}
      style={style}
    >
      {bar}
      {failure}
      {state.listOpen && (
        <aside
          className="studio-edit__panel"
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <header className="studio-edit__head">
            <h3>{t('studio.edit.list.title')}</h3>
            <button
              type="button"
              className="button small"
              aria-expanded={adding}
              onClick={() => setAdding(!adding)}
            >
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
              <li className="studio-edit__aside">
                {t('studio.edit.list.empty')}
              </li>
            )}
            {rows.map(({ node, path, isCopy, inside }) => {
              const key = pathKey(path);
              const hidden = node.visible === 0;
              const locked = state.locked.includes(key);
              const name = nameOf(node, path);
              return (
                <li
                  key={key}
                  className={`studio-edit__row${isPicked(path) ? ' is-picked' : ''}${hidden ? ' is-hidden' : ''}${state.hovered && pathKey(state.hovered.path) === key ? ' is-over' : ''}`}
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
                      {node.name !== undefined && !isCopy && (
                        <small>
                          {inside > node.children.length
                            ? `${t(KINDS[node.type])} · ${String(inside - node.children.length)}`
                            : t(KINDS[node.type])}
                        </small>
                      )}
                    </button>
                  )}
                  {!isCopy && (
                    <>
                      <button
                        type="button"
                        className="studio-edit__flag"
                        aria-pressed={locked}
                        aria-label={`${t('studio.edit.lock')}: ${name}`}
                        title={t('studio.edit.lock')}
                        onClick={() =>
                          // On one of several picked things, all of them.
                          isPicked(path) && state.selected.length > 1
                            ? store.lockPicked(!locked)
                            : store.toggleLock(path)
                        }
                      >
                        <Glyph name="lock" />
                      </button>
                      <button
                        type="button"
                        className="studio-edit__flag"
                        aria-pressed={hidden}
                        aria-label={`${t('studio.edit.hide')}: ${name}`}
                        title={t('studio.edit.hide')}
                        onClick={() =>
                          isPicked(path) && state.selected.length > 1
                            ? store.showPicked(hidden)
                            : store.send([
                                { kind: 'show', path, shown: hidden },
                              ])
                        }
                      >
                        <svg
                          viewBox="0 0 16 16"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path d="M1.5 8S4 3.6 8 3.6 14.5 8 14.5 8 12 12.4 8 12.4 1.5 8 1.5 8zM2.5 13.5l11-11" />
                        </svg>
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {!(last && lastNode) && (
            <p className="studio-edit__aside">{t('studio.edit.hint')}</p>
          )}
        </aside>
      )}
      {last && lastNode && (
        <section
          className="studio-edit__thing"
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <h3 className="studio-edit__thing-name">
            {state.selected.length > 1
              ? t('studio.edit.many', { count: state.selected.length })
              : nameOf(lastNode, last)}
          </h3>
          <div className="studio-edit__actions">
            <button type="button" className="button small" onClick={askAbout}>
              {t('studio.edit.ask')}
            </button>
            <button
              type="button"
              className="button small subtle"
              aria-pressed={state.solo}
              title={t('studio.edit.soloHint')}
              onClick={() => store.setSolo(!state.solo)}
            >
              {t('studio.edit.solo')}
            </button>
            {onlyCopies ? (
              <button
                type="button"
                className="button small subtle"
                title={t('studio.edit.parentHint')}
                onClick={store.selectParent}
              >
                {t('studio.edit.parent')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="button small subtle"
                  onClick={store.copy}
                >
                  {t('studio.edit.copy')}
                </button>
                {state.selected.length > 1 && (
                  <button
                    type="button"
                    className="button small subtle"
                    onClick={() => store.group(t('studio.edit.kind.group'))}
                  >
                    {t('studio.edit.group')}
                  </button>
                )}
                <button
                  type="button"
                  className="button small subtle"
                  onClick={() => store.showPicked(lastNode.visible === 0)}
                >
                  {t(
                    lastNode.visible === 0
                      ? 'studio.edit.show'
                      : 'studio.edit.hide',
                  )}
                </button>
                <button
                  type="button"
                  className="button small subtle"
                  aria-pressed={state.locked.includes(pathKey(last))}
                  onClick={() =>
                    store.lockPicked(!state.locked.includes(pathKey(last)))
                  }
                >
                  {t('studio.edit.lockShort')}
                </button>
                {last.length > 1 && (
                  <button
                    type="button"
                    className="button small subtle"
                    title={t('studio.edit.parentHint')}
                    onClick={store.selectParent}
                  >
                    {t('studio.edit.parent')}
                  </button>
                )}
                {state.selected.length === 1 && (
                  <button
                    type="button"
                    className="button small subtle"
                    onClick={() => {
                      // The name is typed in the list, which opens for it.
                      store.setListOpen(true);
                      setRenaming(pathKey(last));
                    }}
                  >
                    {t('studio.edit.rename')}
                  </button>
                )}
                <button
                  type="button"
                  className="button small subtle studio-edit__delete"
                  onClick={store.remove}
                >
                  {t('studio.edit.delete')}
                </button>
              </>
            )}
          </div>
          {onlyCopies && (
            <p className="studio-edit__aside">{t('studio.edit.copyNote')}</p>
          )}
          {thing &&
            !onlyCopies &&
            FIELDS.map(({ field, key }) => {
              const follows = lastNode[field].map(
                (part) => typeof part === 'string',
              );
              return (
                <div key={field} className="studio-edit__field">
                  <span className="studio-edit__field-name">{t(key)}</span>
                  {(['X', 'Y', 'Z'] as const).map((axis, index) => (
                    <EditNumber
                      key={axis}
                      label={axis}
                      name={`${t(key)} ${axis}`}
                      value={thing[field][index]}
                      degrees={field === 'rotation'}
                      follows={follows[index]}
                      onChange={(value) => change(field, index, value)}
                    />
                  ))}
                  {follows.some(Boolean) && (
                    <span className="studio-edit__follows">
                      <button
                        type="button"
                        aria-label={`${t('studio.edit.follows')}: ${t('studio.edit.stay')}`}
                        title={`${t('studio.edit.follows')}\n${t('studio.edit.stay')}: ${t('studio.edit.stayHint')}`}
                        onClick={() =>
                          store.send([
                            {
                              kind: 'pin',
                              path: [...last],
                              field,
                              values: [...thing[field]] as [
                                number,
                                number,
                                number,
                              ],
                            },
                          ])
                        }
                      >
                        <Glyph name="pin" />
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          {!onlyCopies &&
            lastNode.type !== 'light' &&
            lastNode.type !== 'group' && (
              <label className="studio-edit__check" htmlFor={shadowId}>
                <input
                  id={shadowId}
                  type="checkbox"
                  checked={lastNode.castShadow}
                  onChange={(event) =>
                    store.send([
                      {
                        kind: 'shadow',
                        path: [...last],
                        cast: event.target.checked,
                      },
                    ])
                  }
                />
                {t('studio.edit.shadow')}
              </label>
            )}
        </section>
      )}
    </div>
  );
}
