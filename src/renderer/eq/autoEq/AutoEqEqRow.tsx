/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type AnimationEvent, Fragment, useEffect, useState } from 'react';
import log from 'electron-log/renderer';
import type { Translate } from 'common/i18n';
import { SAVED_EQ_NAME_MAX } from 'common/savedEq';
import type { ISavedEqSummary } from 'common/songSoundMemory';
import MenuIcon from '../../icons/MenuIcon';
import AnchoredMenu, { isInsideAnchoredMenu } from '../../widgets/AnchoredMenu';
import { useTranslation } from '../../utils/I18nContext';
import { countText } from '../../library/libraryFormat';
import { deleteEq, renameEq, saveEq } from '../../utils/songSoundApi';
import {
  putOnSavedEq,
  updateSavedEqWithLive,
} from '../../audio/savedEqActions';
import AutoEqMiniCurve from './AutoEqMiniCurve';
import { type TRowPhase, rowPhaseClass } from '../../utils/usePresenceList';
import { bandsLine, isToneFlat, presetLine } from './AutoEqSongHolds';

const report = (what: string) => (error: unknown) =>
  log.error(`A saved EQ could not be ${what}`, error);

/** Who follows it: "12 songs, 1 album", or nothing. */
const usedOf = (eq: ISavedEqSummary, t: Translate): string =>
  [
    eq.songCount > 0 ? countText(t, 'library.trackCount', eq.songCount) : '',
    eq.albumCount > 0 ? countText(t, 'library.albumCount', eq.albumCount) : '',
  ]
    .filter(Boolean)
    .join(', ');

/** What it holds, and who follows it, in one quiet line. */
const metaOf = (eq: ISavedEqSummary, t: Translate): string => {
  const used = usedOf(eq, t);
  return [
    eq.sound.presetId === ''
      ? t('autoEq.eqs.anyPreset')
      : presetLine(eq.sound.presetId, t),
    bandsLine(eq.sound, t),
    isToneFlat(eq.sound) ? '' : t('eq.tone'),
    used === '' ? '' : t('autoEq.eqs.usedBy', { what: used }),
  ]
    .filter(Boolean)
    .join(' · ');
};

type TRowMode = 'idle' | 'renaming' | 'deleting';

/**
 * One saved EQ in Auto EQ's panel and in Manage: its curve, its name and what
 * it holds, and the one thing to do about it — Put on, or Update once what
 * plays has moved off it. Its menu holds the rest: Rename and Delete happen
 * in the row itself, and Delete says what becomes of the songs on it.
 */
const AutoEqEqRow = ({
  eq,
  state,
  canPutOn,
  phase = 'stay',
  onAnimationEnd,
}: {
  eq: ISavedEqSummary;
  /** Plays exactly, or was put on and has changed since. */
  state?: 'playing' | 'changed';
  /** Something to put it on over: the window has heard what plays. */
  canPutOn: boolean;
  /** Arriving in, or leaving, a list already on screen (`usePresenceList`). */
  phase?: TRowPhase;
  onAnimationEnd?: (event: AnimationEvent) => void;
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<TRowMode>('idle');
  const [draft, setDraft] = useState(eq.name);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const more = t('autoEq.eqs.more', { name: eq.name });
  const meta = metaOf(eq, t);

  // A press anywhere but the menu and its button closes it; Escape too,
  // caught before the panel's own Escape so only the menu closes.
  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !isInsideAnchoredMenu(event.target) &&
        !anchor?.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setMenuOpen(false);
        anchor?.focus();
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [anchor, isMenuOpen]);

  const putOn = () => {
    putOnSavedEq(eq);
  };
  const update = () => {
    updateSavedEqWithLive(eq).catch(report('updated'));
  };
  const finishRename = () => {
    const next = draft.trim();
    setMode('idle');
    if (next !== '' && next !== eq.name) {
      renameEq(eq.id, next).catch(report('renamed'));
    }
  };

  const items = [
    {
      key: 'putOn',
      icon: 'play' as const,
      label: t('autoEq.eqs.putOn'),
      run: putOn,
      isDisabled: !canPutOn,
    },
    {
      key: 'update',
      icon: 'save' as const,
      label: t('autoEq.eqs.updateWithLive'),
      run: update,
      isDisabled: !canPutOn || state === 'playing',
    },
    {
      key: 'rename',
      icon: 'pencil' as const,
      label: t('myCurves.rename'),
      run: () => {
        setDraft(eq.name);
        setMode('renaming');
      },
    },
    {
      key: 'duplicate',
      icon: 'duplicate' as const,
      label: t('myCurves.duplicate'),
      run: () => {
        saveEq(eq.name, eq.sound).catch(report('duplicated'));
      },
    },
    {
      key: 'delete',
      icon: 'trash' as const,
      label: t('myCurves.delete'),
      run: () => setMode('deleting'),
      isDanger: true,
    },
  ];

  if (mode === 'deleting') {
    const users = eq.songCount + eq.albumCount;
    return (
      <li
        className={['eq-auto-eq is-asking', rowPhaseClass(phase)]
          .filter(Boolean)
          .join(' ')}
        onAnimationEnd={onAnimationEnd}
      >
        <div className="eq-auto-eq__words">
          <strong>{t('autoEq.eqs.deleteAsk', { name: eq.name })}</strong>
          {users > 0 && (
            <span>{t('autoEq.eqs.deleteKeeps', { what: usedOf(eq, t) })}</span>
          )}
        </div>
        <div className="eq-auto-eq__actions">
          <button
            type="button"
            className="button small subtle"
            onClick={() => setMode('idle')}
          >
            {t('autoEq.eqs.cancel')}
          </button>
          <button
            type="button"
            className="button small danger"
            onClick={() => deleteEq(eq.id).catch(report('deleted'))}
          >
            {t('myCurves.delete')}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      className={[
        'eq-auto-eq',
        state === 'playing' ? 'is-playing' : undefined,
        rowPhaseClass(phase),
      ]
        .filter(Boolean)
        .join(' ')}
      onAnimationEnd={onAnimationEnd}
    >
      <AutoEqMiniCurve
        filters={eq.sound.filters}
        width={58}
        height={24}
        className="eq-auto-eq__curve"
      />
      {mode === 'renaming' ? (
        <input
          className="eq-auto-eq__rename"
          aria-label={t('autoEq.eqs.renameLabel', { name: eq.name })}
          value={draft}
          maxLength={SAVED_EQ_NAME_MAX}
          // The field is what the press opened; it takes the caret.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={finishRename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              finishRename();
            } else if (event.key === 'Escape') {
              event.stopPropagation();
              event.nativeEvent.stopImmediatePropagation();
              setMode('idle');
            }
          }}
        />
      ) : (
        <div className="eq-auto-eq__words">
          <strong>
            <span className="eq-auto-eq__name">{eq.name}</span>
            {state === 'playing' && (
              <span className="eq-auto-eq__tag is-playing">
                {t('autoEq.eqs.playing')}
              </span>
            )}
            {state === 'changed' && (
              <span className="eq-auto-eq__tag is-changed">
                {t('autoEq.state.changed')}
              </span>
            )}
          </strong>
          {/* Whole in the tooltip: a narrow panel or a long language cuts
            the line's end, which says who follows it. */}
          <span title={meta}>{meta}</span>
        </div>
      )}
      <div className="eq-auto-eq__actions">
        {state === 'changed' && (
          // Keeping what plays is the suggestion once it moved off the EQ.
          <button type="button" className="button small" onClick={update}>
            {t('autoEq.eqs.update')}
          </button>
        )}
        {state === undefined && (
          <button
            type="button"
            className="button small subtle"
            disabled={!canPutOn}
            onClick={putOn}
          >
            <MenuIcon name="playSolid" />
            {t('autoEq.eqs.putOn')}
          </button>
        )}
        <button
          ref={setAnchor}
          type="button"
          className="button small subtle eq-auto-eq__more"
          aria-label={more}
          title={more}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MenuIcon name="menu" />
        </button>
      </div>
      <AnchoredMenu
        anchor={anchor}
        isOpen={isMenuOpen}
        className="band-menu eq-auto-eq-menu"
        ariaLabel={more}
      >
        <p className="band-menu__subject">{eq.name}</p>
        {items.map((item) => (
          <Fragment key={item.key}>
            {/* Delete stands apart from what keeps the EQ. */}
            {item.isDanger && (
              <span className="band-menu__rule" role="separator" />
            )}
            <button
              type="button"
              role="menuitem"
              className={item.isDanger ? 'is-danger' : undefined}
              disabled={item.isDisabled}
              onClick={() => {
                setMenuOpen(false);
                item.run();
              }}
            >
              <MenuIcon name={item.icon} className="band-menu__icon" />
              <span>{item.label}</span>
            </button>
          </Fragment>
        ))}
      </AnchoredMenu>
    </li>
  );
};

export default AutoEqEqRow;
