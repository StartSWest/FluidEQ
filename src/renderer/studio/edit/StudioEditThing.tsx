/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  pathKey,
  samePath,
  type ISceneEditThing,
  type TNodePath,
  type TTriple,
} from 'common/sceneEdit';
import type { TWorldNode } from 'common/sceneWorld';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import EditGlyph, { type TEditGlyph } from './EditGlyph';
import { lockedIn } from './editMarks';
import {
  emptyMove,
  type IStageEditState,
  type IStageEditStore,
} from './stageEditStore';

/**
 * Edit mode's strip along the stage's bottom: the picked thing's name, what
 * can be done to it, and its numbers. Every action wears its picture and its
 * word; where the strip is narrow the words go and the pictures stay, each
 * still named by its tooltip and to a screen reader.
 */

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
  /** The thing is locked: its numbers are read, not typed. */
  locked: boolean;
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
  locked,
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
        readOnly={locked}
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

const FIELDS = [
  { field: 'position', key: 'studio.edit.place' },
  { field: 'rotation', key: 'studio.edit.turn' },
  { field: 'scale', key: 'studio.edit.size' },
] as const;

interface IActionProps {
  glyph: TEditGlyph;
  label: string;
  hint?: string;
  /** The suggested action: the loud style. Every other one is quiet. */
  loud?: boolean;
  /** Keeps its word where the others give theirs up for room. */
  keepWord?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}

function Action({
  glyph,
  label,
  hint,
  loud = false,
  keepWord = false,
  pressed,
  disabled = false,
  className = '',
  onClick,
}: IActionProps) {
  return (
    <button
      type="button"
      className={`button small${loud ? '' : ' subtle'} studio-edit__action${keepWord ? ' is-keep-word' : ''} ${className}`}
      aria-pressed={pressed}
      // The name stays when the strip is too narrow for the word.
      aria-label={label}
      title={hint ? `${label}\n${hint}` : label}
      disabled={disabled}
      onClick={onClick}
    >
      <EditGlyph name={glyph} />
      <span className="studio-edit__action-word" aria-hidden="true">
        {label}
      </span>
    </button>
  );
}

interface IStudioEditThingProps {
  store: IStageEditStore;
  state: IStageEditState;
  last: TNodePath;
  lastNode: TWorldNode;
  name: string;
  /** Opens the list with the picked thing's name ready to be typed. */
  onRename: () => void;
  onAsk: () => void;
}

export default function StudioEditThing({
  store,
  state,
  last,
  lastNode,
  name,
  onRename,
  onAsk,
}: IStudioEditThingProps) {
  const { t } = useTranslation();
  const shadowId = useId();
  // Single copies of a shoal are made by its rule: there is nothing of
  // theirs in the file to move, hide or delete.
  const nodes = store.nodesPicked();
  const onlyCopies = nodes.length === 0;
  const thing: ISceneEditThing | undefined = state.things.find((known) =>
    samePath(known.path, last),
  );
  const locked = lockedIn(state.unlocked, last);
  const allLocked = nodes.every((path) => lockedIn(state.unlocked, path));
  const hidden = state.hidden.includes(pathKey(last));

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

  const parent = (
    <Action
      glyph="parent"
      label={t('studio.edit.parent')}
      hint={t('studio.edit.parentHint')}
      onClick={store.selectParent}
    />
  );
  const lockKey: TranslationKey = locked
    ? 'studio.edit.unlock'
    : 'studio.edit.lockShort';

  return (
    <section
      className="studio-edit__thing"
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <h3 className="studio-edit__thing-name">
        {!onlyCopies && (
          <EditGlyph
            name={locked ? 'lock' : 'unlock'}
            className={`studio-edit__thing-lock${locked ? '' : ' is-free'}`}
          />
        )}
        <span>
          {state.selected.length > 1
            ? t('studio.edit.many', { count: state.selected.length })
            : name}
        </span>
      </h3>
      <div className="studio-edit__actions">
        <Action
          glyph="ask"
          label={t('studio.edit.ask')}
          loud
          keepWord
          onClick={onAsk}
        />
        <Action
          glyph="solo"
          label={t('studio.edit.solo')}
          hint={t('studio.edit.soloHint')}
          pressed={state.solo}
          onClick={() => store.setSolo(!state.solo)}
        />
        {onlyCopies ? (
          parent
        ) : (
          <>
            <Action
              glyph={locked ? 'unlock' : 'lock'}
              label={t(lockKey)}
              hint={t(
                locked ? 'studio.edit.lockedHint' : 'studio.edit.unlockedHint',
              )}
              keepWord={locked}
              className={locked ? 'studio-edit__unlock' : ''}
              onClick={() => store.lockPicked(!locked)}
            />
            <Action
              glyph="copy"
              label={t('studio.edit.copy')}
              onClick={store.copy}
            />
            {state.selected.length > 1 && (
              <Action
                glyph="group"
                label={t('studio.edit.group')}
                onClick={() => store.group(t('studio.edit.kind.group'))}
              />
            )}
            <Action
              glyph={hidden ? 'eye' : 'eye-off'}
              label={t(hidden ? 'studio.edit.show' : 'studio.edit.hide')}
              hint={t('studio.edit.hideHint')}
              onClick={() => store.hidePicked(!hidden)}
            />
            {lastNode.visible === 0 && (
              <Action
                glyph="eye"
                label={t('studio.edit.turnOn')}
                hint={t('studio.edit.turnOnHint')}
                onClick={() => store.showPicked(true)}
              />
            )}
            {last.length > 1 && parent}
            {state.selected.length === 1 && (
              <Action
                glyph="rename"
                label={t('studio.edit.rename')}
                onClick={onRename}
              />
            )}
            <Action
              glyph="delete"
              label={t('studio.edit.delete')}
              hint={allLocked ? t('studio.edit.lockedWhy') : undefined}
              disabled={allLocked}
              className="studio-edit__delete"
              onClick={store.remove}
            />
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
            <div
              key={field}
              className={`studio-edit__field${locked ? ' is-locked' : ''}`}
            >
              <span className="studio-edit__field-name">{t(key)}</span>
              {(['X', 'Y', 'Z'] as const).map((axis, index) => (
                <EditNumber
                  key={axis}
                  label={axis}
                  name={`${t(key)} ${axis}`}
                  value={thing[field][index]}
                  degrees={field === 'rotation'}
                  follows={follows[index]}
                  locked={locked}
                  onChange={(value) => change(field, index, value)}
                />
              ))}
              {follows.some(Boolean) && !locked && (
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
                          values: [...thing[field]] as [number, number, number],
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
  );
}
