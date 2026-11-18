/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { resolveSceneName } from 'common/scenePacks';
import type {
  ISceneWindowColours,
  TSceneWindowColourRole,
} from 'common/sceneWindowColours';
import WindowColourDayStrip from '../components/WindowColourDayStrip';
import WindowColourSwatches from '../components/WindowColourSwatches';
import WindowColourTimes from '../components/WindowColourTimes';
import WindowColoursPreview from '../components/WindowColoursPreview';
import { useSelectedLookId } from '../utils/graphStyle';
import {
  isWornAsNamed,
  type TWindowColourSource,
  type TWindowTime,
} from '../utils/sceneDayColours';
import { followPickedSurface } from '../utils/theme';
import { useTranslation } from '../utils/I18nContext';
import {
  clearChosenWindowColours,
  setChosenWindowColours,
} from '../utils/sceneWindowColourStore';
import useEditedTime from '../utils/useEditedTime';
import useSceneWindowColours from '../utils/useSceneWindowColours';

/** Whose colours each time's are, as the listener reads it here. */
const SOURCE: Record<TWindowColourSource, TranslationKey> = {
  chosen: 'graph.sceneColours.sourceYours',
  named: 'graph.sceneColours.sourceScene',
  palette: 'graph.sceneColours.sourcePalette',
  measured: 'graph.sceneColours.sourceAuto',
};

const otherTime = (time: TWindowTime): TWindowTime =>
  time === 'night' ? 'day' : 'night';

/**
 * The colours the chosen scene lends the window, under the Window colours
 * menu's modes (Ivan, 2026-11-14: "implement that", the tuning mockup): its
 * night's and its day's (2026-11-18, the night and day editing mockup), each
 * changeable for this scene on this computer, the three of whichever is
 * open, a dot on any no longer the scene's own, the badge saying whose they
 * are, the two through the day, a small window painted in the open set as
 * the picker moves, and "Use the scene's colours" whenever there is
 * something to undo. They hold in Colours, Ambient and the Backdrop alike.
 * Nothing for a look that is not a scene, or for a scene with no colours yet
 * at either time.
 */
export default function SceneWindowColours() {
  const { t, locale } = useTranslation();
  const lookId = useSelectedLookId();
  const { sides, own, chosen, names } = useSceneWindowColours(lookId);
  const [editing, setEditing] = useEditedTime();
  // A time with no colours yet starts from the other time's.
  const wearing = sides[editing]?.colours ?? sides[otherTime(editing)]?.colours;
  const ownSet = own[editing]?.colours ?? own[otherTime(editing)]?.colours;
  // What the picker shows while it moves: the small window follows it at
  // once, and the window itself takes the colour the picker settles on.
  const [draft, setDraft] = useState<ISceneWindowColours | undefined>();
  // Let go of when the scene, the time or what it wears changes, by value:
  // the lists the colours come from are rebuilt with the same colours in
  // new objects.
  const wearingKey = wearing
    ? `${lookId} ${editing} ${wearing.surface} ${wearing.accent} ${wearing.glow}`
    : `${lookId} ${editing}`;
  useEffect(() => setDraft(undefined), [wearingKey]);

  const change = useCallback(
    (role: TSceneWindowColourRole, value: string) => {
      if (wearing) {
        setDraft((current) => ({ ...(current ?? wearing), [role]: value }));
      }
    },
    [wearing],
  );
  const commit = useCallback(
    (role: TSceneWindowColourRole, value: string) => {
      if (wearing) {
        setChosenWindowColours(
          lookId,
          { ...wearing, [role]: value },
          ownSet,
          editing,
        );
        if (role === 'surface') {
          followPickedSurface(value);
        }
      }
    },
    [lookId, wearing, ownSet, editing],
  );

  if (!wearing) {
    return null;
  }
  const shown = draft ?? wearing;
  const isYours = chosen.night !== undefined || chosen.day !== undefined;
  const title = names
    ? t('graph.sceneColours.title', {
        name: resolveSceneName({ names }, locale),
      })
    : t('graph.sceneColours.thisScene');
  // The strip and the small window follow the picker on the open time.
  const night = editing === 'night' ? shown : (sides.night?.colours ?? shown);
  const day = editing === 'day' ? shown : (sides.day?.colours ?? night);
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
      <WindowColourTimes
        sides={sides}
        editing={editing}
        sourceLabel={(_time, source) => t(SOURCE[source ?? 'measured'])}
        onEdit={setEditing}
      />
      <WindowColourSwatches
        colours={shown}
        own={ownSet}
        onChange={change}
        onCommit={commit}
      />
      <WindowColourDayStrip night={night} day={day} />
      <WindowColoursPreview
        colours={shown}
        named={draft !== undefined || isWornAsNamed(sides)}
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
