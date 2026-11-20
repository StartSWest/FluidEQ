/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import log from 'electron-log/renderer';
import MenuIcon from '../../icons/MenuIcon';
import AnchoredMenu, { isInsideAnchoredMenu } from '../../widgets/AnchoredMenu';
import { useTranslation } from '../../utils/I18nContext';
import { useSongSoundIndex } from '../../audio/songSoundIndex';
import { useLiveSongSound } from '../../audio/songSoundSession';
import {
  putOnSavedEq,
  updateSavedEqWithLive,
  useSavedEqStates,
} from '../../audio/savedEqActions';
import AutoEqMiniCurve from './AutoEqMiniCurve';
import AutoEqSaveEqForm from './AutoEqSaveEqForm';
import { orderSavedEqs, rowStateOf } from './AutoEqSavedEqs';
import { requestAutoEqOpen } from './autoEqOpen';

/** The menu lists this many; Manage has the rest. */
const SHOWN = 5;

/**
 * Save EQ, in the bands toolbar after Clear (Ivan, 2026-11-20: "maybe instead
 * of adding that there, we have it next to Clear", and "like save EQ there to
 * show a specialised menu for that only"): a menu about saved EQs and nothing
 * else. Save as new EQ opens the panel's own form in the menu's place; the
 * saved EQ that is on can be updated with what plays, Changed said beside it
 * when it differs; the newest few go on in one press; and Manage holds them
 * all, in Auto EQ's panel. Auto EQ's own Save beside its button stays the
 * song's.
 */
const SaveEqMenu = () => {
  const { t } = useTranslation();
  const { eqs, eqById } = useSongSoundIndex();
  const live = useLiveSongSound();
  const states = useSavedEqStates(eqs);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const label = t('eq.tools.saveEq');

  const close = () => {
    setIsOpen(false);
    setIsSaving(false);
  };

  // A press anywhere but the menu and its button closes it, and Escape:
  // from the form, back to the menu; from the menu, the menu.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !isInsideAnchoredMenu(event.target) &&
        !anchor?.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsSaving(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        setIsOpen(false);
        anchor?.focus();
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [anchor, isOpen, isSaving]);

  const onId = states.changedId ?? states.playingId;
  const on = onId === undefined ? undefined : eqById.get(onId);
  const isChanged = on !== undefined && on.id === states.changedId;
  const shown = orderSavedEqs(eqs, states).slice(0, SHOWN);

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className="button small subtle eq-save-trigger"
        title={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => {
          setIsSaving(false);
          setIsOpen((open) => !open);
        }}
      >
        <MenuIcon name="saveEq" className="eq-toolbar__icon" />
        {/* Hidden, never removed, where the row is down to glyphs. */}
        <span className="eq-toolbar__word">{label}</span>
      </button>
      <AnchoredMenu
        anchor={anchor}
        isOpen={isOpen}
        className={`band-menu eq-save-menu${isSaving ? ' is-form' : ''}`}
        ariaLabel={t('autoEq.eqs.title')}
      >
        {isSaving ? (
          <div className="eq-save-menu__form">
            <p className="band-menu__subject">{t('autoEq.eqs.saveThis')}</p>
            <AutoEqSaveEqForm
              suggestedName={t('autoEq.eqs.defaultName', {
                count: eqs.length + 1,
              })}
              onCancel={() => setIsSaving(false)}
              onSaved={close}
            />
          </div>
        ) : (
          <>
            <p className="band-menu__subject">{t('autoEq.eqs.title')}</p>
            <button
              type="button"
              role="menuitem"
              disabled={!live}
              onClick={() => setIsSaving(true)}
            >
              <MenuIcon name="plus" className="band-menu__icon" />
              <span>{t('autoEq.eqs.saveNew')}</span>
            </button>
            {on && (
              <button
                type="button"
                role="menuitem"
                className="eq-save-menu__update"
                disabled={!isChanged}
                onClick={() => {
                  close();
                  updateSavedEqWithLive(on).catch((error: unknown) =>
                    log.error('A saved EQ could not be updated', error),
                  );
                }}
              >
                <MenuIcon name="save" className="band-menu__icon" />
                <span>{t('autoEq.eqs.updateNamed', { name: on.name })}</span>
                <span
                  className={`eq-auto-eq__tag ${
                    isChanged ? 'is-changed' : 'is-playing'
                  }`}
                >
                  {isChanged
                    ? t('autoEq.state.changed')
                    : t('autoEq.eqs.playing')}
                </span>
              </button>
            )}
            <span className="band-menu__rule" role="separator" />
            {shown.length === 0 && (
              <p className="eq-save-menu__empty">{t('autoEq.eqs.empty')}</p>
            )}
            {shown.map((eq) => {
              const state = rowStateOf(eq, states);
              return (
                <button
                  key={eq.id}
                  type="button"
                  role="menuitem"
                  className="eq-save-menu__eq"
                  aria-label={t('autoEq.eqs.putOnNamed', { name: eq.name })}
                  disabled={!live}
                  onClick={() => {
                    close();
                    putOnSavedEq(eq);
                  }}
                >
                  <AutoEqMiniCurve
                    filters={eq.sound.filters}
                    width={44}
                    height={18}
                    className="eq-save-menu__curve"
                  />
                  <span className="eq-save-menu__name">{eq.name}</span>
                  {state === 'playing' ? (
                    <span className="eq-auto-eq__tag is-playing">
                      {t('autoEq.eqs.playing')}
                    </span>
                  ) : (
                    <span className="eq-save-menu__put">
                      {t('autoEq.eqs.putOn')}
                    </span>
                  )}
                </button>
              );
            })}
            <span className="band-menu__rule" role="separator" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                requestAutoEqOpen('eqs');
              }}
            >
              <MenuIcon name="settings" className="band-menu__icon" />
              <span>{t('autoEq.eqs.manageAll')}</span>
            </button>
          </>
        )}
      </AnchoredMenu>
    </>
  );
};

export default SaveEqMenu;
