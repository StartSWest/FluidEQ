/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState, type CSSProperties, type ReactNode } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  pathInWords,
  pathKey,
  type TNodePath,
  type TWorldEditFailure,
} from 'common/sceneEdit';
import type { IScenePack } from 'common/scenePacks';
import type { TWorldNode } from 'common/sceneWorld';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import { askSceneChat, focusSceneChat } from '../chat/askSceneChat';
import { setChatDraftStage } from '../chat/chatDraftStore';
import { nodeAt, thingName } from './editNames';
import { setEditPicks } from './editPicksStore';
import markPicture from './markPicture';
import type { IStageEditStore } from './stageEditStore';
import StudioEditList from './StudioEditList';
import StudioEditThing from './StudioEditThing';
import { useStageEditState } from './useStageEdit';

/**
 * Edit mode's panels: every thing in the scene down the stage's left side
 * (`StudioEditList`), and what can be done to the picked ones along its
 * bottom (`StudioEditThing`). On a painted scene, which has no things, what
 * marking is and the marks' own buttons.
 */

const FAILURES: Record<TWorldEditFailure, TranslationKey> = {
  closed: 'studio.edit.failure.failed',
  'no-world': 'studio.edit.failure.failed',
  mismatch: 'studio.edit.failure.mismatch',
  missing: 'studio.edit.failure.missing',
  'formula-full': 'studio.edit.failure.formula',
  refused: 'studio.edit.failure.refused',
  failed: 'studio.edit.failure.failed',
};

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
  const [renaming, setRenaming] = useState<string>();
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
      <div className="studio-edit__dock" style={style}>
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

  const last = state.selected[state.selected.length - 1];
  const lastNode = last && nodeAt(nodes, last);

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

  return (
    <div
      className={`studio-edit__dock${state.dragging ? ' is-dragging' : ''}`}
      style={style}
    >
      {bar}
      {failure}
      {state.listOpen && (
        <StudioEditList
          store={store}
          state={state}
          nodes={nodes}
          nameOf={nameOf}
          renaming={renaming}
          setRenaming={setRenaming}
          ask={ask}
          hasPick={Boolean(last && lastNode)}
        />
      )}
      {last && lastNode && (
        <StudioEditThing
          store={store}
          state={state}
          last={last}
          lastNode={lastNode}
          name={nameOf(lastNode, last)}
          onAsk={askAbout}
          onRename={() => {
            // The name is typed in the list, which opens for it.
            store.setListOpen(true);
            setRenaming(pathKey(last));
          }}
        />
      )}
    </div>
  );
}
