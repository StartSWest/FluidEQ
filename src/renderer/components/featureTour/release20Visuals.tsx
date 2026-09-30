/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../../utils/I18nContext';
import TitlebarCorner from './TitlebarCorner';
import lookBackdrop from '../../../../assets/tour/look-backdrop.jpg';
import lookWindowColours from '../../../../assets/tour/look-window-colours.jpg';
import graphAnalyzer from '../../../../assets/tour/graph-analyzer.jpg';
import graphAnalysisList from '../../../../assets/tour/graph-analysis-list.jpg';
import studioMain from '../../../../assets/tour/studio-main.jpg';
import studioMeters from '../../../../assets/tour/studio-meters.jpg';

/**
 * The photographed pictures of 2.0's What's New: the window's new look, the
 * graph's measuring views and the Studio.
 *
 * Each is the running window itself, because what each shows is only seen in
 * the real thing: the Backdrop is a scene behind every pane, the Analyzer is a
 * song's live spectrum with its peaks over it, and the Studio is a scene
 * playing on its stage. The drawings they replaced were sent back as not
 * realistic enough (Ivan, 2026-09-30: "a better more realistic picture").
 *
 * All from the running window with Brightness at half, like the Help
 * pictures. Retake them when the window changes; each size below is the
 * file's own, so the picture holds its place before it loads.
 */

// ---------------------------------------------------------------------------
// The new look: the window on the Backdrop, and the Window colours menu that
// put the visualizer there, cut from the same window.

/**
 * At 2560 x 1392 on 2026-09-29: the EQ page with Aurora on the Backdrop, and
 * its Window colours menu cut out at the size the window draws it (Ivan,
 * 2026-09-28: "the number 1 take full picture if the app in backdrop mode").
 */
const WINDOW_PHOTO = { width: 1400, height: 761 };
const MENU_PHOTO = { width: 301, height: 473 };

/** FluidEQ on the Backdrop, and the menu that put the visualizer there. */
export function LookVisual() {
  const { t } = useTranslation();
  return (
    <div className="tour-photo" role="img" aria-label={t('tour.look.imageAlt')}>
      <TitlebarCorner
        ringed="actions"
        label={t('graph.sceneTint.brightness')}
      />
      <div className="tour-photo__stage">
        <img
          className="tour-photo__main"
          src={lookBackdrop}
          alt=""
          width={WINDOW_PHOTO.width}
          height={WINDOW_PHOTO.height}
        />
        <img
          className="tour-photo__card tour-photo__card--menu"
          src={lookWindowColours}
          alt=""
          width={MENU_PHOTO.width}
          height={MENU_PHOTO.height}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The graph's measuring views: the Analyzer on a playing song, and the look
// picker's Analysis list cut from the same window.

/**
 * At 1440 x 1500, two pixels per CSS pixel, on 2026-09-30: the EQ page's graph
 * card on the Analyzer with a song playing, and the picker's Styles column
 * filtered to Analysis, down to its tenth view. The window was taken tall so
 * the graph is drawn about as tall as the slide gives it; at the window's
 * usual width it came out three times as wide as tall. The picker lists
 * twelve views, which the slide's words count ("seven more"): a thirteenth
 * means retaking the list as well as changing the words.
 */
const GRAPH_PHOTO = { width: 1400, height: 859 };
const LIST_PHOTO = { width: 489, height: 747 };

/** The Analyzer on a playing song, and the picker's Analysis list over it. */
export function GraphViewsVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="tour-photo"
      role="img"
      aria-label={t('tour.graph.imageAlt')}
    >
      <div className="tour-photo__stage">
        <img
          className="tour-photo__main"
          src={graphAnalyzer}
          alt=""
          width={GRAPH_PHOTO.width}
          height={GRAPH_PHOTO.height}
        />
        <img
          className="tour-photo__card tour-photo__card--list"
          src={graphAnalysisList}
          alt=""
          width={LIST_PHOTO.width}
          height={LIST_PHOTO.height}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The Studio: a scene on its stage, the three steps that make one with an AI,
// and what the scene hears of the song; then the two ways in, which are offers
// and not controls on that page.

/**
 * At 2560 x 1392 on 2026-09-30, a song playing: the Studio with Alpine on its
 * stage and its Make with AI tab open, cut above the "Let your AI see the
 * stage" card so the three steps end the picture, and its "What it hears now"
 * card cut from the column beside it.
 */
const STUDIO_PHOTO = { width: 1400, height: 869 };
const METERS_PHOTO = { width: 260, height: 572 };

/** The Studio making Alpine, and the trial and the month a scene earns. */
export function StudioVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="tour-photo"
      role="img"
      aria-label={t('tour.studio.imageAlt')}
    >
      <div className="tour-photo__stage">
        <img
          className="tour-photo__main"
          src={studioMain}
          alt=""
          width={STUDIO_PHOTO.width}
          height={STUDIO_PHOTO.height}
        />
        <img
          className="tour-photo__card tour-photo__card--meters"
          src={studioMeters}
          alt=""
          width={METERS_PHOTO.width}
          height={METERS_PHOTO.height}
        />
        <span className="tour-photo__offers">
          <span className="tour-photo__offer">{t('trial.offer.title')}</span>
          <span className="tour-photo__offer is-earned">
            {t('tour.studio.earned')}
          </span>
        </span>
      </div>
    </div>
  );
}
