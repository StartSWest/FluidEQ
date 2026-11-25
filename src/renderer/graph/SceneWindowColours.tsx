/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { resolveSceneName } from 'common/scenePacks';
import {
  sameWindowColourSet,
  type ISceneWindowColours,
  type TSceneWindowColourRole,
} from 'common/sceneWindowColours';
import WindowColourFinder from '../components/WindowColourFinder';
import WindowColourSwatches from '../components/WindowColourSwatches';
import WindowColoursPreview from '../components/WindowColoursPreview';
import { useSelectedLookId } from '../utils/graphStyle';
import {
  isWornAsNamed,
  SCENE_COLOURS_STOP,
  type TWindowColourSource,
} from '../utils/sceneDayColours';
import { useTranslation } from '../utils/I18nContext';
import { useRainbowStops } from '../utils/rainbowPalette';
import {
  sceneAppColourStops,
  useSceneColourControls,
} from '../utils/sceneAppColours';
import { useListenerParams } from '../utils/sceneParamStore';
import {
  clearChosenWindowColours,
  setChosenWindowColours,
} from '../utils/sceneWindowColourStore';
import useColourFinder from '../utils/useColourFinder';
import {
  dropWindowColourDraft,
  showWindowColourDraft,
} from '../utils/windowColourDraft';
import useSceneWindowColours from '../utils/useSceneWindowColours';
import { scanSceneSky } from './sceneSky';

/** Whose the scene's colours are, as the listener reads it here. */
const SOURCE: Record<TWindowColourSource, TranslationKey> = {
  chosen: 'graph.sceneColours.sourceYours',
  named: 'graph.sceneColours.sourceScene',
  palette: 'graph.sceneColours.sourcePalette',
  measured: 'graph.sceneColours.sourceAuto',
};

/**
 * The colours the chosen scene lends the window, under the Window colours
 * menu's modes (Ivan, 2026-11-14: "implement that", the tuning mockup): the
 * scene's one set (Ivan, 2026-11-19: "we are kind of overcomplicating the scene ... pick one colour for the scene, and then during the day just light up"; "the night usually doesn't have a colour, so we pick the colour from the day, and that's the colour for the whole scene, and when it darks, it simply darks"), changeable for this scene on this computer, a dot
 * on any no longer the scene's own, the badge saying whose they are, a small
 * window painted in them, Automatic under the three, which finds the scene's
 * own colours by day as often as it is pressed, and "Use the scene's
 * colours" whenever there is something to undo. The whole window follows
 * the picker until Accept keeps the colour or Cancel puts it back. They hold
 * in Colours, Ambient and the Backdrop alike. Nothing for a look that is not
 * a scene, or for a scene with no colours yet.
 */
export default function SceneWindowColours() {
  const { t, locale } = useTranslation();
  const lookId = useSelectedLookId();
  const { sides, own, chosen, names, version } = useSceneWindowColours(lookId);
  const params = useListenerParams(lookId);
  const editing = SCENE_COLOURS_STOP;
  const wearing = sides[editing]?.colours;
  const ownSet = own[editing]?.colours;
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

  // Automatic: the scene's own colours at the open point, kept as the
  // listener's choice there, and another of them at every press.
  const applyFound = useCallback(
    (found: ISceneWindowColours) =>
      setChosenWindowColours(lookId, found, own[editing]?.colours, editing),
    [lookId, own, editing],
  );
  const scan = useMemo(
    () =>
      version === undefined
        ? undefined
        : () => scanSceneSky(lookId, version, params, editing),
    [lookId, version, params, editing],
  );
  const finder = useColourFinder({
    subject: `${lookId} ${version ?? ''}`,
    stop: editing,
    current: draft ?? wearing,
    scan,
    apply: applyFound,
  });

  // What the window's colourful marks run through, as `RainbowSource`
  // decides it for a scene on the graph: the scene's own wave palette first;
  // colours only measured off its picture never reach them, which then wear
  // the window's own pair - the stops worn now.
  const controls = useSceneColourControls(lookId);
  const sceneStops = useMemo(
    () =>
      controls
        ? sceneAppColourStops(controls, params ? { params } : {})
        : undefined,
    [controls, params],
  );
  const liveStops = useRainbowStops();
  const isMeasured =
    draft === undefined && sides[editing]?.source === 'measured';
  const run = sceneStops ?? (isMeasured ? liveStops : undefined);

  if (!wearing) {
    return null;
  }
  const shown = draft ?? wearing;
  const named = draft !== undefined || isWornAsNamed(sides);
  const isYours = Object.keys(chosen).length > 0;
  const title = names
    ? t('graph.sceneColours.title', {
        name: resolveSceneName({ names }, locale),
      })
    : t('graph.sceneColours.thisScene');
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
      <WindowColourSwatches
        colours={shown}
        own={ownSet}
        named={named}
        onChange={change}
        onCommit={commit}
      />
      <WindowColourFinder
        finding={finder.finding}
        source={t(SOURCE[sides[editing]?.source ?? 'measured'])}
        disabled={!finder.canFind}
        onFind={finder.find}
      />
      <WindowColoursPreview colours={shown} named={named} run={run} />
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
