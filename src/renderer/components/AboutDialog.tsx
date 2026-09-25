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

import { useEffect, useEffectEvent, useRef } from 'react';
import {
  AUTHOR_NAME,
  BUNDLED_ENGINE,
  COPYRIGHT,
  LICENSE,
  LICENSE_DIR,
  PRODUCT_NAME,
  REPOSITORY_URL,
  ROOM_HEADS_DIR,
  TRADEMARK,
  UPSTREAM,
} from 'common/branding';
import {
  DISCLAIMER_HEADING_KEY,
  DISCLAIMER_LANGUAGE_KEY,
  DISCLAIMER_PARAGRAPH_KEYS,
} from 'common/disclaimer';
import { useTranslation } from '../utils/I18nContext';
import DialogHeader from './DialogHeader';
import AboutBrand from './AboutBrand';
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
 * The brand introduction and warranty notice are translated. The existing
 * attribution and licence sections retain their original wording.
 *
 * Those sections contain *identifiers* — a licence name, a copyright
 * line, an attribution, a trademark reservation. Translating one of those
 * changes what it names, and a mistranslated one is worse than an English one
 * because it still looks authoritative. It follows the report-a-problem dialog,
 * which is untranslated for the same reason: the text that has to be exact
 * stays in one language.
 *
 * The exception is the warranty and liability section, which is translated.
 * That is not an identifier; it is a notice a consumer has to read and accept,
 * and a term somebody cannot read is a term that in much of the world does not
 * bind them — English-only protects less there, not more. It is also the one
 * section that appears twice: a user who accepted it on first run in their own
 * language must not find a different-looking English version of it here. See
 * `common/disclaimer`.
 */
export default function AboutDialog({ onClose }: IAboutDialogProps) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape reads whichever `onClose` is current, and focus is placed once:
  // re-run with `onClose`, which the window hands over new on every render of
  // its own, this pulled focus back to Close several times a second while
  // anything played.
  const closeOnEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  });

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => closeOnEscape(event);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

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
        <DialogHeader
          eyebrow={t('about.eyebrow')}
          title={t('about.title')}
          titleId="about-title"
          closeLabel={t('support.close')}
          onClose={onClose}
          closeRef={closeRef}
        />

        <div className="about__body">
          <AboutBrand />
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

          {/* Directly under the licence, because it is what two sections of
              that licence say. Sections 15 and 16 are already in LICENSE, in
              every file header and on the installer's licence page, and in all
              three places they are in the register of a licence rather than of
              a sentence — which is a way of being present without being read.
              The same words come up on first run, from the same keys, so what
              was acknowledged and what can be re-read here are one text rather
              than two drafts.

              The one translated section in an otherwise untranslated panel,
              and the exception is deliberate. Everything else here is an
              identifier — a licence name, an attribution, a copyright line, a
              trademark reservation — and translating an identifier changes
              what it names. This is a notice a consumer has to read and
              accept, and one they cannot read is one that in much of the world
              does not bind them. It would also be indefensible to have
              somebody accept this in Spanish on first run and then find only
              an English version of it here. */}
          <section className="about__section">
            <h3>{t(DISCLAIMER_HEADING_KEY)}</h3>
            {DISCLAIMER_PARAGRAPH_KEYS.map((key) => (
              <p key={key}>{t(key, { author: AUTHOR_NAME })}</p>
            ))}
            <p className="about__aside">{t(DISCLAIMER_LANGUAGE_KEY)}</p>
          </section>

          <section className="about__section">
            <h3>Attribution</h3>
            <p>
              {PRODUCT_NAME} is written and maintained by its author. It began
              as a fork of {UPSTREAM.name}, and about a tenth of the source is
              still theirs, used under the GPL — neither an official
              continuation nor endorsed by them.
            </p>
            <p className="about__copyright">
              {COPYRIGHT}
              <br />
              Portions: {UPSTREAM.copyright}
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
              The headphone correction library is{' '}
              <a
                href="https://github.com/opra-project/OPRA"
                target="_blank"
                rel="noreferrer"
              >
                OPRA
              </a>
              , an open, community-maintained directory of product information
              and EQ compensation curves, published under CC BY-SA 4.0. What
              ships here is that dataset reshaped for the application to read,
              under the same terms; the licence and the attribution travel with
              it as <code>{LICENSE_DIR}/CC-BY-SA-4.0-LICENSE.txt</code> and{' '}
              <code>{LICENSE_DIR}/OPRA-ATTRIBUTION.txt</code>. Each curve names
              its author, and {PRODUCT_NAME} credits them where it is applied.
            </p>
            <p>
              The convolution catalogue is AutoEq, copyright © 2018–2022 Jaakko
              Pasanen, under the MIT License, whose text ships as{' '}
              <code>{LICENSE_DIR}/AutoEq-LICENSE.txt</code>. Squiglink exports
              are imported only when a user provides them and are never
              redistributed here.
            </p>
            {/* Not a licence, a citation requirement: the MIT Media
                Laboratory places no restriction on use of this data beyond
                asking that its authors be cited when it is used in a research
                or commercial application. This one is sold, so the citation is
                owed rather than offered, and a citation is the authors, the
                work and the year — which is why all three are named here
                rather than just a project name. */}
            <p>
              The Room renders through heads derived from the MIT KEMAR
              measurements —{' '}
              <a
                href="https://sound.media.mit.edu/resources/KEMAR.html"
                target="_blank"
                rel="noreferrer"
              >
                HRTF Measurements of a KEMAR Dummy-Head Microphone
              </a>
              , Bill Gardner and Keith Martin, MIT Media Laboratory, 1994. That
              data is copyright © 1994 the MIT Media Laboratory and free to use,
              provided its authors are cited wherever it is. What ships here is
              the horizontal ring of their compact set, diffuse-field equalised
              and resampled for this application; the terms and what was changed
              travel beside the files as{' '}
              <code>{ROOM_HEADS_DIR}/LICENSES.md</code>.
            </p>
          </section>

          <p className="about__footer">
            The libraries {PRODUCT_NAME} is built on are listed with their
            copyright notices in{' '}
            <code>{LICENSE_DIR}/THIRD-PARTY-NOTICES.txt</code>. The complete
            derivative-work and trademark notices install beside the application
            as <code>NOTICE.md</code> and <code>TRADEMARK.md</code>.
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
