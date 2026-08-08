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

import { useEffect, useRef } from 'react';
import {
  BUNDLED_ENGINE,
  COPYRIGHT,
  LICENSE,
  LICENSE_DIR,
  PRODUCT_NAME,
  PRODUCT_VERSION,
  REPOSITORY_URL,
  TRADEMARK,
  UPSTREAM,
} from 'common/branding';
import { useTranslation } from '../utils/I18nContext';
import BrandMark from '../icons/BrandMark';
import '../styles/About.scss';

interface IAboutDialogProps {
  onClose: () => void;
}

/**
 * Who made this, under what licence, and what else is inside it.
 *
 * The app had no answer to any of those questions from inside the app. That is
 * a real gap rather than a formality: FluidEQ is a modified version of somebody
 * else's GPL program, it installs a second GPL program alongside itself, and it
 * carries a name its author does not license with the code. All three of those
 * are things a user is entitled to be told without going to look for a
 * repository.
 *
 * Deliberately not translated. Every string here is a legal statement — a
 * licence name, a copyright line, an attribution, a trademark reservation — and
 * a mistranslated one is worse than an English one, because it still looks
 * authoritative. It follows the report-a-problem dialog, which is untranslated
 * for the same reason: the text that has to be exact stays in one language.
 */
export default function AboutDialog({ onClose }: IAboutDialogProps) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="about-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="about"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
      >
        <div className="about__header">
          <div>
            <span className="eyebrow">About</span>
            <h2 id="about-title">{PRODUCT_NAME}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="about__close"
            aria-label={t('support.close')}
            onClick={onClose}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>

        <div className="about__body">
          {/* The version is the shipped one, not a literal: it comes from the
              same place the installer takes its own version number from, so
              what this panel claims and what a user actually has cannot
              disagree. */}
          <div className="about__identity">
            <BrandMark />
            <div>
              <p className="about__name">
                {PRODUCT_NAME}
                {PRODUCT_VERSION && (
                  <span className="about__version">v{PRODUCT_VERSION}</span>
                )}
              </p>
              <p className="about__tagline">{t('app.tagline')}</p>
            </div>
          </div>

          <section className="about__section">
            <h3>License</h3>
            <p>
              {PRODUCT_NAME} is free software under the {LICENSE.name}. You may
              run it, study it, change it and pass it on. A modified version you
              distribute has to offer its own source under the same licence.
            </p>
            <p>
              <a href={LICENSE.url} target="_blank" rel="noreferrer">
                Read the full licence text
              </a>
              <span className="about__aside">
                {' '}
                — it also ships with this copy, as <code>{LICENSE.path}</code>.
              </span>
            </p>
          </section>

          <section className="about__section">
            <h3>Attribution</h3>
            <p>
              {PRODUCT_NAME} is a modified version of {UPSTREAM.name}, a
              system-wide parametric equalizer interface by the {UPSTREAM.name}{' '}
              Dev Team. It is not an official continuation and is not endorsed
              by them.
            </p>
            <p className="about__copyright">
              {UPSTREAM.copyright}
              <br />
              {PRODUCT_NAME} modifications: {COPYRIGHT}
            </p>
            <p>
              <a href={UPSTREAM.url} target="_blank" rel="noreferrer">
                {UPSTREAM.name} on GitHub
              </a>
            </p>
          </section>

          <section className="about__section">
            <h3>Trademark</h3>
            <p>{TRADEMARK.notice}</p>
            <p>{TRADEMARK.additionalTerm}</p>
          </section>

          <section className="about__section">
            <h3>{BUNDLED_ENGINE.name}</h3>
            <p>
              {BUNDLED_ENGINE.name} is the audio engine that does the actual
              filtering. It is a separate program by {BUNDLED_ENGINE.author},
              licensed under the {BUNDLED_ENGINE.license}, and its installer is
              bundled here and run unmodified. {PRODUCT_NAME} includes none of
              its code and never loads it: the two are separate programs that
              exchange text configuration files.
            </p>
            <p>
              Its licence ships as <code>{BUNDLED_ENGINE.licensePath}</code>,
              and because its installer is distributed here, the corresponding
              source for the exact bundled version is published with every{' '}
              {PRODUCT_NAME} release.
            </p>
            <p>
              <a href={BUNDLED_ENGINE.url} target="_blank" rel="noreferrer">
                {BUNDLED_ENGINE.name} project page
              </a>
            </p>
          </section>

          <section className="about__section">
            <h3>Bundled data</h3>
            <p>
              The headphone correction library is generated from AutoEq,
              copyright © 2018–2022 Jaakko Pasanen, under the MIT License. Its
              licence text ships as{' '}
              <code>{LICENSE_DIR}/AutoEq-LICENSE.txt</code>. Measurements
              fetched on demand from GadgetryTech / Squiglink stay the property
              of whoever published them and are never redistributed here.
            </p>
          </section>

          <p className="about__footer">
            The complete derivative-work, third-party and trademark notices are{' '}
            <code>NOTICE.md</code> and <code>TRADEMARK.md</code> in the source.
            <br />
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
              {REPOSITORY_URL}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
