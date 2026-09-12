import { useEffect, useRef, useState } from 'react';
import { FIXED_BAND_SIZES } from '../../common/constants';
import {
  IBandDesign,
  MAX_BAND_DESIGN_NAME,
  MAX_BAND_DESIGNS,
  isBandDesignName,
} from '../../common/bandDesigns';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import {
  applyBandDesign,
  deleteBandDesign,
  getBandDesigns,
  saveBandDesign,
} from '../utils/bandDesignApi';
import { setFixedBand } from '../utils/equalizerApi';
import { reportError } from '../utils/logger';
import AnchoredMenu from '../widgets/AnchoredMenu';
import Chevron from '../icons/Chevron';
import MenuIcon from '../icons/MenuIcon';
import ConfirmIcon from '../icons/ConfirmIcon';
import '../styles/BandLayoutMenu.scss';

export default function BandLayoutMenu() {
  const {
    filters,
    eqBandDesign,
    refreshState,
    activeDeviceId,
    setSelectedFilterIds,
  } = useFluidEqContext();
  const { t } = useTranslation();
  const holder = useRef<HTMLSpanElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const savingName = useRef<HTMLInputElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false);
  const [designs, setDesigns] = useState<IBandDesign[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [naming, setNaming] = useState(false);
  const [deleting, setDeleting] = useState<IBandDesign>();
  const [name, setName] = useState('');
  const [failed, setFailed] = useState(false);
  const count = Object.keys(filters).length;
  const duplicate = designs.some(
    (design) =>
      design.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
  );
  const saved = designs.find((design) => design.id === eqBandDesign?.id);

  useEffect(() => {
    setOpen(false);
  }, [activeDeviceId]);
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let current = true;
    getBandDesigns()
      .then((entries) => {
        if (current) {
          setDesigns(entries);
          setLoaded(true);
        }
        return undefined;
      })
      .catch((error: unknown) => {
        reportError('Could not load band layouts', error);
        if (current) {
          setFailed(true);
        }
      });
    const outside = (event: MouseEvent) => {
      if (
        !holder.current?.contains(event.target as Node) &&
        !content.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', outside);
    return () => {
      current = false;
      window.removeEventListener('mousedown', outside);
    };
  }, [open]);
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        if (deleting) {
          setDeleting(undefined);
        } else {
          setOpen(false);
          holder.current?.querySelector('button')?.focus();
        }
      }
    };
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('keydown', escape);
    };
  }, [open, deleting]);
  useEffect(() => {
    if (deleting) {
      cancelDelete.current?.focus();
    }
  }, [deleting]);
  useEffect(() => {
    if (naming) {
      savingName.current?.focus();
    }
  }, [naming]);

  const perform = async (action: () => Promise<unknown>, close: boolean) => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await action();
      setSelectedFilterIds([]);
      await refreshState();
      setDesigns(await getBandDesigns());
      setNaming(false);
      setDeleting(undefined);
      setName('');
      if (close) {
        setOpen(false);
      }
    } catch (error) {
      reportError('Could not change band layout', error);
      setFailed(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <span
      className={`eq-mode is-subtle quick-layouts${open ? ' is-open' : ''}`}
      ref={holder}
    >
      <button
        type="button"
        className="button small subtle eq-mode__main quick-layouts__trigger"
        aria-label={t('eq.quickLayouts')}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(!open);
          setFailed(false);
          setNaming(false);
          setDeleting(undefined);
        }}
      >
        <MenuIcon name="layout" className="eq-toolbar__icon" />
        <span className="band-designs__current" title={eqBandDesign?.name}>
          {eqBandDesign?.name ?? t('eq.bandCount', { count })}
        </span>
        <Chevron />
      </button>
      <AnchoredMenu
        anchor={holder.current}
        isOpen={open}
        className="band-designs__menu"
        role="dialog"
        ariaLabel={t('eq.quickLayouts')}
        maxHeight={540}
      >
        <div ref={content} className="band-designs__content" aria-busy={busy}>
          <h3>{t('eq.layouts.builtIn')}</h3>
          <div className="band-designs__grid">
            {FIXED_BAND_SIZES.map((size) => {
              const selected = !eqBandDesign && size === count;
              return (
                <button
                  type="button"
                  key={size}
                  className={`button small${selected ? '' : ' subtle'}`}
                  aria-pressed={selected}
                  disabled={busy}
                  onClick={() => {
                    if (!selected) {
                      perform(() => setFixedBand(size), true);
                    }
                  }}
                >
                  {t('eq.bandCount', { count: size })}
                </button>
              );
            })}
          </div>
          <h3>{t('eq.layouts.saved')}</h3>
          {loaded && designs.length === 0 && (
            <p className="band-designs__hint">{t('eq.layouts.empty')}</p>
          )}
          {!loaded && !failed && (
            <p className="band-designs__hint" role="status">
              {t('eq.layouts.loading')}
            </p>
          )}
          <div className="band-designs__saved">
            {designs.map((design) => (
              <div className="band-designs__entry" key={design.id}>
                <button
                  type="button"
                  className={`button small band-designs__row${design.id === eqBandDesign?.id ? '' : ' subtle'}`}
                  aria-pressed={design.id === eqBandDesign?.id}
                  disabled={busy}
                  onClick={() =>
                    perform(() => applyBandDesign(design.id), true)
                  }
                >
                  <MenuIcon name="layout" className="eq-toolbar__icon" />
                  <span>
                    {design.name}
                    <small>
                      {t('eq.bandCount', { count: design.bands.length })}
                    </small>
                  </span>
                  {design.id === eqBandDesign?.id && (
                    <ConfirmIcon variant="accept" />
                  )}
                </button>
                <button
                  type="button"
                  className="button small subtle band-designs__delete"
                  aria-label={t('eq.layouts.deleteNamed', {
                    name: design.name,
                  })}
                  title={t('eq.layouts.deleteNamed', { name: design.name })}
                  disabled={busy}
                  onClick={() => {
                    setNaming(false);
                    setDeleting(design);
                    setFailed(false);
                  }}
                >
                  <MenuIcon name="trash" className="eq-toolbar__icon" />
                </button>
              </div>
            ))}
          </div>
          {deleting && (
            <div className="band-designs__form">
              <p className="band-designs__hint" role="alert">
                {t('eq.layouts.deleteWarning', { name: deleting.name })}
              </p>
              <div className="band-designs__actions">
                <button
                  ref={cancelDelete}
                  type="button"
                  className="button small subtle"
                  disabled={busy}
                  onClick={() => setDeleting(undefined)}
                >
                  {t('config.cancel')}
                </button>
                <button
                  type="button"
                  className="button small"
                  disabled={busy}
                  onClick={() =>
                    perform(() => deleteBandDesign(deleting.id), false)
                  }
                >
                  {t('eq.layouts.delete')}
                </button>
              </div>
            </div>
          )}
          {!deleting && naming && (
            <form
              className="band-designs__form"
              onSubmit={(event) => {
                event.preventDefault();
                if (isBandDesignName(name) && !duplicate) {
                  perform(() => saveBandDesign(name), false);
                }
              }}
            >
              <label htmlFor="band-design-name">{t('eq.layouts.name')}</label>
              <input
                ref={savingName}
                id="band-design-name"
                value={name}
                maxLength={MAX_BAND_DESIGN_NAME}
                disabled={busy}
                onChange={(event) => setName(event.target.value)}
              />
              {duplicate && (
                <p className="band-designs__hint" role="alert">
                  {t('eq.layouts.duplicate')}
                </p>
              )}
              <div className="band-designs__actions">
                <button
                  type="button"
                  className="button small subtle"
                  disabled={busy}
                  onClick={() => setNaming(false)}
                >
                  {t('config.cancel')}
                </button>
                <button
                  type="submit"
                  className="button small"
                  disabled={busy || !isBandDesignName(name) || duplicate}
                >
                  {t('config.save')}
                </button>
              </div>
            </form>
          )}
          {!deleting && !naming && (
            <div className="band-designs__actions">
              {saved && (
                <button
                  type="button"
                  className="button small subtle"
                  disabled={busy || !loaded}
                  onClick={() =>
                    perform(() => saveBandDesign(saved.name, saved.id), false)
                  }
                >
                  {t('eq.layouts.update')}
                </button>
              )}
              <button
                type="button"
                className="button small"
                disabled={busy || !loaded || designs.length >= MAX_BAND_DESIGNS}
                onClick={() => {
                  setName('');
                  setNaming(true);
                }}
              >
                <MenuIcon name="plus" className="eq-toolbar__icon" />
                {t('eq.layouts.saveNew')}
              </button>
            </div>
          )}
          {failed && (
            <p className="band-designs__error" role="alert">
              {t('eq.layouts.error')}
            </p>
          )}
        </div>
      </AnchoredMenu>
    </span>
  );
}
