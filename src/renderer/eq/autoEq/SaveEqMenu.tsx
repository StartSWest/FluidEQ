/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import log from 'electron-log/renderer';
import MenuIcon from '../../icons/MenuIcon';
import TextInput from '../../widgets/TextInput';
import AnimatedHeight from '../../widgets/AnimatedHeight';
import { type TViewStep, viewClass } from '../../utils/viewStep';
import useHasChanged from '../../utils/useHasChanged';
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
import AutoEqEqList from './AutoEqEqList';
import { orderSavedEqs, rowStateOf } from './savedEqOrder';

/** What the menu shows: its list, Save as new EQ's form, or every saved EQ
 * to manage. */
type TView = 'menu' | 'form' | 'manage';

/** The menu lists this many; Manage has the rest. */
const SHOWN = 5;

/**
 * Save EQ, in the bands toolbar after Clear (Ivan, 2026-11-20: "maybe instead
 * of adding that there, we have it next to Clear", and "like save EQ there to
 * show a specialised menu for that only"): a menu about saved EQs and nothing
 * else. Save as new EQ opens the panel's own form in the menu's place; the
 * saved EQ that is on can be updated with what plays, Changed said beside it
 * when it differs; the newest few go on in one press; and Manage saved EQs…
 * opens every one of them in the menu itself, with the panel's own rows
 * (Ivan, 2026-11-20: "put that inside the same save EQ menu, not on auto EQ
 * menu"). Auto EQ's own Save beside its button stays the song's.
 */
const SaveEqMenu = () => {
  const { t } = useTranslation();
  const { eqs, eqById } = useSongSoundIndex();
  const live = useLiveSongSound();
  const states = useSavedEqStates(eqs);
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<TView>('menu');
  // Further in slides from the right, back to the menu from the left.
  const [step, setStep] = useState<TViewStep>();
  const go = (next: TView) => {
    setView(next);
    setStep(next === 'menu' ? 'back' : 'forward');
    if (next === 'menu') {
      setSearch('');
    }
  };
  const [search, setSearch] = useState('');
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const label = t('eq.tools.saveEq');

  const close = () => {
    setIsOpen(false);
    setView('menu');
    setStep(undefined);
    setSearch('');
  };

  // A press anywhere but the menu and its button closes it (a saved EQ's own
  // row menu is a menu too, and inside), and Escape: from the form or the
  // manage view, back to the menu; from the menu, the menu. A row's own menu
  // and its rename take their Escape first.
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
        setView('menu');
        setStep(undefined);
        setSearch('');
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (view === 'menu') {
        setIsOpen(false);
        anchor?.focus();
      } else {
        setView('menu');
        setStep('back');
        setSearch('');
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [anchor, isOpen, view]);

  const onId = states.changedId ?? states.playingId;
  const on = onId === undefined ? undefined : eqById.get(onId);
  const isChanged = on !== undefined && on.id === states.changedId;
  // The face names the saved EQ that is loaded (Ivan, 2026-11-20: "aqui debe
  // decir el EQ que esta cargado no en auto eq"), marked when what plays has
  // moved off it, and says Save EQ while none is; Auto EQ's face keeps saying
  // where the song's sound comes from. The whole of it in the tooltip, for a
  // long name cut short and for the row down to glyphs.
  let face = label;
  if (on) {
    face = on.name;
  }
  let faceTitle = label;
  if (on) {
    faceTitle = isChanged
      ? t('eq.tools.saveEqChanged', { name: on.name })
      : t('eq.tools.saveEqOn', { name: on.name });
  }
  const faceSwap = useHasChanged(on?.id ?? '') ? ' is-swap' : '';
  const shown = orderSavedEqs(eqs, states).slice(0, SHOWN);

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className={`button small subtle eq-save-trigger${faceSwap}`}
        title={faceTitle}
        aria-label={faceTitle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => {
          setView('menu');
          setStep(undefined);
          setSearch('');
          setIsOpen((open) => !open);
        }}
      >
        <span className="eq-save-trigger__glyph">
          <MenuIcon name="saveEq" className="eq-toolbar__icon" />
          {/* Changed, in the amber a change waiting wears: still there when
            the row is down to glyphs. */}
          {isChanged && (
            <span className="eq-save-trigger__changed" aria-hidden="true" />
          )}
        </span>
        {/* Hidden, never removed, where the row is down to glyphs. */}
        <span
          key={on?.id ?? 'none'}
          className="eq-toolbar__word eq-save-trigger__name"
          aria-hidden="true"
        >
          {face}
        </span>
      </button>
      <AnchoredMenu
        anchor={anchor}
        isOpen={isOpen}
        className={`band-menu eq-save-menu is-${view}`}
        ariaLabel={t('autoEq.eqs.title')}
      >
        <AnimatedHeight className="eq-save-menu__body">
          {view === 'manage' && (
            <div
              className={`eq-save-menu__form eq-save-menu__manage ${viewClass(step)}`}
            >
              <div className="eq-save-menu__head">
                <button
                  type="button"
                  className="button small subtle eq-save-menu__back"
                  aria-label={t('autoEq.manage.back')}
                  title={t('autoEq.manage.back')}
                  onClick={() => go('menu')}
                >
                  <MenuIcon name="back" />
                </button>
                <p className="band-menu__subject">{t('autoEq.eqs.title')}</p>
              </div>
              <TextInput
                value={search}
                ariaLabel={t('autoEq.eqs.search')}
                placeholder={t('autoEq.eqs.search')}
                isDisabled={false}
                errorMessage=""
                handleChange={setSearch}
                handleSubmit={setSearch}
              />
              <AutoEqEqList search={search} />
            </div>
          )}
          {view === 'form' && (
            <div className={`eq-save-menu__form ${viewClass(step)}`}>
              <p className="band-menu__subject">{t('autoEq.eqs.saveThis')}</p>
              <AutoEqSaveEqForm
                suggestedName={t('autoEq.eqs.defaultName', {
                  count: eqs.length + 1,
                })}
                onCancel={() => go('menu')}
                onSaved={close}
              />
            </div>
          )}
          {view === 'menu' && (
            <div className={`eq-save-menu__list ${viewClass(step)}`}>
              <p className="band-menu__subject">{t('autoEq.eqs.title')}</p>
              <button
                type="button"
                role="menuitem"
                disabled={!live}
                onClick={() => go('form')}
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
                onClick={() => go('manage')}
              >
                <MenuIcon name="settings" className="band-menu__icon" />
                <span>{t('autoEq.eqs.manageAll')}</span>
              </button>
            </div>
          )}
        </AnimatedHeight>
      </AnchoredMenu>
    </>
  );
};

export default SaveEqMenu;
