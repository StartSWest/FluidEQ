/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useLiveSurface } from '../utils/theme';
import {
  buildGuestGlassCss,
  buildGuestTintCss,
  GUEST_TINT_SITES,
  type IGuestTintKnowledge,
} from './guestTint';
import {
  guestTintProbe,
  MAX_KEEPS,
  parseGuestTintReport,
  type IGuestPaint,
  type IGuestTintReport,
  type TGuestKeep,
} from './guestTintProbe';
import { useGuestTintEnabled } from './guestTintPreference';

/** The part of the `<webview>` this needs. */
export interface IGuestStyleTarget extends Pick<
  HTMLElement,
  'addEventListener' | 'removeEventListener'
> {
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
  insertCSS(css: string): Promise<string>;
  removeInsertedCSS(key: string): Promise<void>;
}

/** Everything learned about a site, and how many rules its page held then. */
export interface ISiteKnowledge extends IGuestTintKnowledge {
  readonly ruleCount: number | undefined;
}

/**
 * What each site's pages have said, from the last of them that was asked. A
 * site's variables are the same on every one of its pages, so a page that has
 * just loaded is tinted from these at once and the answer from the page itself
 * only corrects them — waiting for it on every page showed each one in the
 * site's own grey first.
 */
const knownSites = new Map<string, ISiteKnowledge>();

/**
 * A site's greys, grown by what a page has just reported — or nothing if it
 * reported nothing new.
 *
 * Only ever grown. A page is asked after it has loaded, and by then it is
 * usually wearing this app's sheet: every grey the sheet changes reads back as
 * the app's own colour, so the answer leaves out exactly the greys being
 * changed. Taken as the whole list, it dropped them from the next sheet, and
 * the page went back to the site's grey with the next video — reported as the
 * colours being "erased" when a playlist moved on. A page still loading its
 * styles reports nothing at all, which did the same to every grey at once.
 * A name already known keeps the value it was first learned with for the same
 * reason: read back through the sheet, its value is the sheet's own, and taking
 * that would stop the sheet changing it and start the page flickering between
 * the two.
 */
const learnGreys = (
  known: ISiteKnowledge | undefined,
  report: IGuestTintReport,
) => {
  const greys = known?.greys ?? [];
  const names = new Set(greys.map(([name]) => name));
  const fresh = report.greys.filter(([name]) => !names.has(name));
  return fresh.length > 0 ? [...greys, ...fresh] : undefined;
};

/**
 * What each grey paints, grown the same way: a page that has loaded more of
 * the site's styles can only have found more uses, never fewer.
 */
const learnPaints = (
  known: ISiteKnowledge | undefined,
  report: IGuestTintReport,
) => {
  if (!report.paints) {
    return undefined;
  }
  const paints = new Map<string, IGuestPaint>(known?.paints);
  let isChanged = false;
  report.paints.forEach((paint, name) => {
    const before = paints.get(name);
    const text = (before?.text ?? false) || paint.text;
    const surface = (before?.surface ?? false) || paint.surface;
    if (!before || before.text !== text || before.surface !== surface) {
      paints.set(name, { text, surface });
      isChanged = true;
    }
  });
  return isChanged ? paints : undefined;
};

/** The rules that write text in a grey, gathered from every page asked. */
const learnKeeps = (
  known: ISiteKnowledge | undefined,
  report: IGuestTintReport,
) => {
  if (!report.keeps) {
    return undefined;
  }
  const keeps = [...(known?.keeps ?? [])];
  const seen = new Set(keeps.map(([selector, name]) => `${name} ${selector}`));
  const fresh: TGuestKeep[] = report.keeps.filter(([selector, name]) => {
    const key = `${name} ${selector}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  const room = MAX_KEEPS - keeps.length;
  return fresh.length > 0 && room > 0
    ? [...keeps, ...fresh.slice(0, room)]
    : undefined;
};

/**
 * The site as known after a page's answer, and whether its stylesheet has to
 * be built again: only when a grey, a use or a rule was learned, not when the
 * page merely counted its rules.
 */
export const learnSite = (
  known: ISiteKnowledge | undefined,
  report: IGuestTintReport,
): { site: ISiteKnowledge; isNew: boolean } => {
  const greys = learnGreys(known, report);
  const paints = learnPaints(known, report);
  const keeps = learnKeeps(known, report);
  return {
    site: {
      greys: greys ?? known?.greys ?? [],
      paints: paints ?? known?.paints ?? new Map(),
      keeps: keeps ?? known?.keeps ?? [],
      ruleCount: report.ruleCount ?? known?.ruleCount,
    },
    isNew: greys !== undefined || paints !== undefined || keeps !== undefined,
  };
};

/**
 * Takes a sheet back out of the guest. Wrapped both ways, as everywhere in the
 * player: a tag that has lost its web contents THROWS rather than rejecting,
 * and a sheet from a document that has since been replaced is simply gone.
 */
const takeOut = (view: IGuestStyleTarget, key: string) => {
  try {
    view.removeInsertedCSS(key).catch(() => undefined);
  } catch {
    // Detached; the sheet went with the document.
  }
};

/**
 * Puts the Media page in the interface's colour while the user wants it, and
 * keeps it there through every page, every scene's tint and every theme.
 *
 * A new colour goes in before the old one comes out, so a change of tint never
 * shows the site's own grey in between; the old sheet is taken out once the
 * new one is known to be in.
 */
export const useGuestTint = (
  webviewRef: RefObject<IGuestStyleTarget | null>,
  siteId: string | undefined,
  pageToken: number,
  isGuestReady: boolean,
  /** A scene plays behind the page: glass instead of colour. */
  isOverScene: boolean,
) => {
  const isEnabled = useGuestTintEnabled();
  // The window's floor, which is what the Media page stands on: the panes
  // lost their fills and the page's frame with them, so tinted from the pane
  // colour the site was a slab of lighter slate in the middle of a dark
  // window (Ivan, 2026-09-26: "fix the color also"). Its cards are lifted
  // toward white with a fifth of the accent in it, as the app's own cards
  // carry the accent, rather than toward a grey.
  const ground = useLiveSurface('--surface-base', '#05080c');
  const accent = useLiveSurface('--accent-light', '#a1fcff');
  // Only a plain hex goes into another site's page: it has none of this
  // document's properties to resolve anything else against.
  const lift = /^#[0-9a-f]{6}$/i.test(accent)
    ? `color-mix(in srgb, #ffffff 80%, ${accent})`
    : '#ffffff';
  const site =
    siteId !== undefined && siteId in GUEST_TINT_SITES ? siteId : undefined;
  const isActive = isEnabled && isGuestReady && site !== undefined;
  // Bumped when a page answers, so the stylesheet is built again from it.
  const [, setAnswers] = useState(0);

  useEffect(() => {
    const view = webviewRef.current;
    if (!view || !isActive || site === undefined) {
      return undefined;
    }
    let isCurrent = true;
    const ask = () => {
      const before = knownSites.get(site);
      try {
        view
          .executeJavaScript(
            guestTintProbe(
              before?.ruleCount,
              (before?.greys ?? []).map(([name]) => name),
            ),
          )
          .then((raw) => {
            if (!isCurrent) {
              return undefined;
            }
            const learned = learnSite(
              knownSites.get(site),
              parseGuestTintReport(raw),
            );
            knownSites.set(site, learned.site);
            if (learned.isNew) {
              setAnswers((count) => count + 1);
            }
            return undefined;
          })
          .catch(() => undefined);
      } catch {
        // No web contents to ask.
      }
    };
    ask();
    // Asked again once the page has finished loading, when its styles are in:
    // the first page after a launch has nothing remembered to fall back on.
    view.addEventListener('did-stop-loading', ask);
    return () => {
      isCurrent = false;
      view.removeEventListener('did-stop-loading', ask);
    };
  }, [isActive, pageToken, site, webviewRef]);

  const known = site !== undefined ? knownSites.get(site) : undefined;
  let css: string | undefined;
  if (isActive && known) {
    css = isOverScene
      ? buildGuestGlassCss(site, ground, known, lift)
      : buildGuestTintCss(site, ground, known, lift);
  }

  const liveKey = useRef<string | undefined>(undefined);
  useEffect(() => {
    const view = webviewRef.current;
    if (!view) {
      return undefined;
    }
    if (css === undefined) {
      const key = liveKey.current;
      liveKey.current = undefined;
      if (key !== undefined) {
        takeOut(view, key);
      }
      return undefined;
    }
    let isSuperseded = false;
    try {
      view
        .insertCSS(css)
        .then((inserted) => {
          if (isSuperseded) {
            takeOut(view, inserted);
            return undefined;
          }
          const previous = liveKey.current;
          liveKey.current = inserted;
          if (previous !== undefined) {
            takeOut(view, previous);
          }
          return undefined;
        })
        .catch(() => undefined);
    } catch {
      // No web contents to put it in.
    }
    return () => {
      isSuperseded = true;
    };
    // The page is in the dependencies as well as the sheet: a new document
    // needs the sheet put in again even when it is the same sheet.
  }, [css, pageToken, webviewRef]);

  useEffect(
    () => () => {
      const view = webviewRef.current;
      const key = liveKey.current;
      liveKey.current = undefined;
      if (view && key !== undefined) {
        takeOut(view, key);
      }
    },
    [webviewRef],
  );
};
