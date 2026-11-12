/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import EditGlyph, { type TEditGlyph } from './EditGlyph';
import type { TEditSide } from './editMath';
import type { IStageEditStore, TEditTool } from './stageEditStore';
import { useStageEditState } from './useStageEdit';

/**
 * Edit mode's plate, in the stage's top left corner: the switch, and beside
 * it — only while it is on — the tools. The plate's own drawn buttons
 * (`.studio-stage__bar`), each named by its tooltip.
 */

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    {path}
  </svg>
);

const TOOLS: readonly {
  tool: TEditTool;
  key: TranslationKey;
  art: ReactNode;
}[] = [
  {
    tool: 'move',
    key: 'studio.edit.tool.move',
    art: icon(
      <path d="M8 1.8v12.4M1.8 8h12.4M8 1.8L6 3.8M8 1.8l2 2M8 14.2l-2-2M8 14.2l2-2M1.8 8l2-2M1.8 8l2 2M14.2 8l-2-2M14.2 8l-2 2" />,
    ),
  },
  {
    tool: 'turn',
    key: 'studio.edit.tool.turn',
    art: icon(<path d="M13.2 8a5.2 5.2 0 1 1-1.6-3.8M13.4 2.2v2.6h-2.6" />),
  },
  {
    tool: 'size',
    key: 'studio.edit.tool.size',
    art: icon(
      <path d="M2.5 9.5v4h4M13.5 6.5v-4h-4M2.5 13.5l4.2-4.2M13.5 2.5L9.3 6.7" />,
    ),
  },
];

const SIDES: readonly {
  side: TEditSide;
  key: TranslationKey;
  glyph: TEditGlyph;
}[] = [
  { side: 'top', key: 'studio.edit.view.top', glyph: 'view-top' },
  { side: 'front', key: 'studio.edit.view.front', glyph: 'view-front' },
  { side: 'side', key: 'studio.edit.view.side', glyph: 'view-side' },
];

interface IStudioEditBarProps {
  store: IStageEditStore;
  is3d: boolean;
  /** Whether the stage is tall enough to open with the list of things. */
  roomy: boolean;
  /** Heading Edit mode's panels (`.studio-edit__dock`), not on its own. */
  isDocked?: boolean;
  /** Where the plate stands when the grid's ruled plot is over the stage. */
  style?: React.CSSProperties;
}

export default function StudioEditBar({
  store,
  is3d,
  roomy,
  isDocked = false,
  style,
}: IStudioEditBarProps) {
  const { t } = useTranslation();
  const state = useStageEditState(store);
  const press = (
    name: string,
    hint: string | undefined,
    pressed: boolean | undefined,
    onClick: () => void,
    art: ReactNode,
    disabled = false,
  ) => (
    <button
      key={name}
      type="button"
      className="studio-stage-controls__button"
      aria-label={name}
      title={hint ? `${name}\n${hint}` : name}
      aria-pressed={pressed}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onClick();
        }
      }}
    >
      {art}
    </button>
  );
  return (
    <div
      className={`studio-stage__bar studio-edit__bar${isDocked ? ' is-docked' : ''}`}
      style={style}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={`studio-edit__switch${state.on ? ' is-on' : ''}`}
        aria-pressed={state.on}
        title={`${t('studio.edit.switch')}\n${t('studio.edit.switchHint')}`}
        onClick={() => {
          // On a short stage the list would cover the scene: closed there
          // until it is asked for.
          if (!state.on) {
            store.setListOpen(roomy);
          }
          store.setOn(!state.on);
        }}
      >
        {icon(
          <path d="M3 13l.6-2.9 7.3-7.3a1.2 1.2 0 0 1 1.7 0l.6.6a1.2 1.2 0 0 1 0 1.7L5.9 12.4zM9.6 4.1l2.3 2.3" />,
        )}
        <span>{t('studio.edit.switch')}</span>
      </button>
      {state.on &&
        is3d &&
        press(
          t('studio.edit.list.title'),
          undefined,
          state.listOpen,
          () => store.setListOpen(!state.listOpen),
          icon(
            <path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.1M2.5 8h.1M2.5 12h.1" />,
          ),
        )}
      {state.on && is3d && (
        <>
          <div className="studio-stage-controls" role="group">
            {TOOLS.map(({ tool, key, art }) =>
              press(
                t(key),
                undefined,
                state.tool === tool,
                () => store.setTool(tool),
                art,
              ),
            )}
            {press(
              t('studio.edit.snap'),
              t('studio.edit.snapHint'),
              state.snap,
              () => store.setSnap(!state.snap),
              icon(
                <path d="M3 3v5a5 5 0 0 0 10 0V3h-3v5a2 2 0 0 1-4 0V3zM3 5.4h3M10 5.4h3" />,
              ),
            )}
          </div>
          <div className="studio-stage-controls" role="group">
            {press(
              t('studio.edit.view.free'),
              t('studio.edit.view.freeHint'),
              state.freeView,
              () => store.setFreeView(!state.freeView),
              icon(
                <path d="M1.5 8S4 3.6 8 3.6 14.5 8 14.5 8 12 12.4 8 12.4 1.5 8 1.5 8zM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
              ),
            )}
            {state.freeView &&
              SIDES.map(({ side, key, glyph }) => (
                <button
                  key={side}
                  type="button"
                  className="studio-edit__word"
                  onClick={() => store.viewFrom(side)}
                >
                  <EditGlyph name={glyph} />
                  {t(key)}
                </button>
              ))}
            {state.freeView && (
              <button
                type="button"
                className="studio-edit__word"
                title={t('studio.edit.view.keepHint')}
                onClick={store.keepView}
              >
                <EditGlyph name="keep-view" />
                {t('studio.edit.view.keep')}
              </button>
            )}
          </div>
        </>
      )}
      {state.on && (
        <div className="studio-stage-controls" role="group">
          {press(
            t('studio.edit.freeze'),
            t('studio.edit.freezeHint'),
            state.frozen,
            () => store.setFrozen(!state.frozen),
            icon(<path d="M5.2 3.2v9.6M10.8 3.2v9.6" />),
          )}
          {is3d &&
            press(
              t('studio.edit.undo'),
              'Ctrl+Z',
              undefined,
              store.undo,
              icon(
                <path d="M5.5 3.5L2.5 6.5l3 3M2.8 6.5h6.4a3.6 3.6 0 0 1 0 7.2H6.5" />,
              ),
              !state.canUndo,
            )}
          {is3d &&
            press(
              t('studio.edit.redo'),
              'Ctrl+Y',
              undefined,
              store.redo,
              icon(
                <path d="M10.5 3.5l3 3-3 3M13.2 6.5H6.8a3.6 3.6 0 0 0 0 7.2h2.7" />,
              ),
              !state.canRedo,
            )}
        </div>
      )}
      {/* Nothing reaches the scene's files until Save: what has changed is
          counted here, beside the two ways out of it, whether Edit is on or
          has been switched off with changes still unsaved. */}
      {is3d && state.changes > 0 && (
        <div className="studio-edit__unsaved" role="group">
          <span role="status">
            {state.saving
              ? t('studio.edit.saving')
              : t('studio.edit.unsaved', { count: state.changes })}
          </span>
          <button
            type="button"
            className="studio-edit__save"
            title={`${t('studio.edit.saveHint')}\nCtrl+S`}
            disabled={state.saving}
            onClick={store.save}
          >
            <EditGlyph name="save" />
            {t('studio.edit.save')}
          </button>
          <button
            type="button"
            className="studio-edit__word"
            title={t('studio.edit.discardHint')}
            disabled={state.saving}
            onClick={store.discard}
          >
            <EditGlyph name="discard" />
            {t('studio.edit.discard')}
          </button>
        </div>
      )}
    </div>
  );
}
