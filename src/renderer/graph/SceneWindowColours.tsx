/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { resolveSceneName } from 'common/scenePacks';
import {
  sameWindowColourSet,
  type ISceneWindowColours,
  type TSceneWindowColourRole,
} from 'common/sceneWindowColours';
import WindowColourDayStrip from '../components/WindowColourDayStrip';
import WindowColourStops from '../components/WindowColourStops';
import WindowColourSwatches from '../components/WindowColourSwatches';
import WindowColoursPreview from '../components/WindowColoursPreview';
import { useSelectedLookId } from '../utils/graphStyle';
import {
  hourOfStop,
  isWalkedByBrightness,
  isWornAsNamed,
  stopColoursAt,
  withChosenStop,
  type TWindowColourSource,
} from '../utils/sceneDayColours';
import { useTranslation } from '../utils/I18nContext';
import {
  clearChosenWindowColours,
  setChosenWindowColours,
} from '../utils/sceneWindowColourStore';
import useEditedStop from '../utils/useEditedStop';
import {
  dropWindowColourDraft,
  showWindowColourDraft,
} from '../utils/windowColourDraft';
import useSceneWindowColours from '../utils/useSceneWindowColours';

/** Whose colours each point's are, as the listener reads it here. */
const SOURCE: Record<TWindowColourSource, TranslationKey> = {
  chosen: 'graph.sceneColours.sourceYours',
  named: 'graph.sceneColours.sourceScene',
  palette: 'graph.sceneColours.sourcePalette',
  measured: 'graph.sceneColours.sourceAuto',
};

/**
 * The colours the chosen scene lends the window, under the Window colours
 * menu's modes (Ivan, 2026-11-14: "implement that", the tuning mockup): its
 * five points through the day (2026-11-18: "we need 4 breakpoints plus 100%
 * which is the white one"), each changeable for this scene on this computer,
 * the three of whichever is open, a dot on any no longer the scene's own, the
 * badge saying whose they are, the five through the day, a small window
 * painted in the open set, and "Use the scene's colours" whenever there is
 * something to undo. Pressing a point puts the scene's hour on it, and the
 * whole window follows the picker there until Accept keeps the colour or
 * Cancel puts it back. They hold in Colours, Ambient and the Backdrop alike.
 * Nothing for a look that is not a scene, or for a scene with no colours yet
 * at any point.
 */
export default function SceneWindowColours() {
  const { t, locale } = useTranslation();
  const lookId = useSelectedLookId();
  const { sides, own, chosen, names } = useSceneWindowColours(lookId);
  const [editing, setEditing] = useEditedStop();
  // A point with no set of its own starts from the blend it shows.
  const wearing =
    sides[editing]?.colours ?? stopColoursAt(sides, hourOfStop(editing));
  const ownSet =
    own[editing]?.colours ?? stopColoursAt(own, hourOfStop(editing));
  // What the picker shows while it moves: the whole window follows it
  // (`windowColourDraft.ts`), and Accept keeps the colour it settles on.
  const [draft, setDraft] = useState<ISceneWindowColours | undefined>();
  // Let go of when the scene, the point or what it wears changes, by value:
  // the lists the colours come from are rebuilt with the same colours in
  // new objects.
  const wearingKey = wearing
    ? `${lookId} ${editing} ${wearing.surface} ${wearing.accent} ${wearing.glow}`
    : `${lookId} ${editing}`;
  useEffect(() => setDraft(undefined), [wearingKey]);
  useEffect(() => {
    if (draft) {
      showWindowColourDraft({ owner: lookId, stop: editing, colours: draft });
    } else {
      dropWindowColourDraft(lookId);
    }
  }, [draft, lookId, editing]);
  // Closing the menu mid-pick is a Cancel: the window wears what is kept.
  useEffect(() => () => dropWindowColourDraft(lookId), [lookId]);

  const change = useCallback(
    (role: TSceneWindowColourRole, value: string) => {
      if (wearing) {
        // Back at what the point wears - a Cancel, or a pick returned to
        // where it started - is no draft at all: kept as one, it would
        // still count the point as chosen and change how the window walks.
        setDraft((current) => {
          const next = { ...(current ?? wearing), [role]: value };
          return sameWindowColourSet(next, wearing) ? undefined : next;
        });
      }
    },
    [wearing],
  );
  const commit = useCallback(
    (role: TSceneWindowColourRole, value: string) => {
      // Accepted as it opened, nothing is chosen: on an Automatic point it
      // would otherwise become one somebody chose, and change how the
      // window walks through the day.
      if (wearing && wearing[role] !== value) {
        setChosenWindowColours(
          lookId,
          { ...wearing, [role]: value },
          own[editing]?.colours,
          editing,
        );
      }
    },
    [lookId, wearing, own, editing],
  );

  if (!wearing) {
    return null;
  }
  const shown = draft ?? wearing;
  const isYours = Object.keys(chosen).length > 0;
  const title = names
    ? t('graph.sceneColours.title', {
        name: resolveSceneName({ names }, locale),
      })
    : t('graph.sceneColours.thisScene');
  // The cards, the strip and the small window follow the picker at the open
  // point.
  const shownSides = draft ? withChosenStop(sides, editing, draft) : sides;
  return (
    <section className="scene-window-colours" aria-label={title}>
      <div className="scene-window-colours__head">
        <span className="scene-window-colours__title">{title}</span>
        <span
          className={`scene-window-colours__badge${isYours ? ' is-yours' : ''}`}
        >
          {t(isYours ? 'graph.sceneColours.yours' : 'graph.sceneColours.own')}
        </span>
      </div>
      <WindowColourStops
        sides={shownSides}
        editing={editing}
        sourceLabel={(_stop, source) => t(SOURCE[source ?? 'measured'])}
        onEdit={setEditing}
      />
      <WindowColourSwatches
        colours={shown}
        own={ownSet}
        sides={shownSides}
        editing={editing}
        onChange={change}
        onCommit={commit}
      />
      <WindowColourDayStrip sides={shownSides} editing={editing} />
      <WindowColoursPreview
        colours={shown}
        named={draft !== undefined || isWornAsNamed(sides)}
        walk={
          isWalkedByBrightness(withChosenStop(sides, editing, shown))
            ? 'brightness'
            : 'points'
        }
      />
      <div className="scene-window-colours__actions">
        <button
          type="button"
          className="button small subtle"
          disabled={!isYours}
          onClick={() => clearChosenWindowColours(lookId)}
        >
          {t('graph.sceneColours.reset')}
        </button>
      </div>
    </section>
  );
}
