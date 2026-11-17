/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useState } from 'react';
import { resolveSceneName } from 'common/scenePacks';
import type {
  ISceneWindowColours,
  TSceneWindowColourRole,
} from 'common/sceneWindowColours';
import WindowColourSwatches from '../components/WindowColourSwatches';
import WindowColoursPreview from '../components/WindowColoursPreview';
import { useSelectedLookId } from '../utils/graphStyle';
import { useTranslation } from '../utils/I18nContext';
import {
  clearChosenWindowColours,
  setChosenWindowColours,
} from '../utils/sceneWindowColourStore';
import useSceneWindowColours from '../utils/useSceneWindowColours';

/**
 * The colours the chosen scene lends the window, under the Window colours
 * menu's modes (Ivan, 2026-11-14: "implement that", the tuning mockup): the
 * three, each changeable for this scene on this computer, a dot on any that
 * is no longer the scene's own, the badge saying whose they are, a small
 * window painted in them as the picker moves, and "Use the scene's colours"
 * whenever there is something to undo. They hold in Colours, Ambient and the
 * Backdrop alike. Nothing for a look that is not a scene, or for a scene not
 * yet measured, which has no colours to start from.
 */
export default function SceneWindowColours() {
  const { t, locale } = useTranslation();
  const lookId = useSelectedLookId();
  const { own, chosen, named, names } = useSceneWindowColours(lookId);
  const wearing = chosen ?? own;
  // What the picker shows while it moves: the small window follows it at
  // once, and the window itself takes the colour the picker settles on.
  const [draft, setDraft] = useState<ISceneWindowColours | undefined>();
  // Let go of when the scene or what it wears changes, by value: the lists
  // the colours come from are rebuilt with the same colours in new objects.
  const wearingKey = wearing
    ? `${lookId} ${wearing.surface} ${wearing.accent} ${wearing.glow}`
    : lookId;
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
        setChosenWindowColours(lookId, { ...wearing, [role]: value }, own);
      }
    },
    [lookId, wearing, own],
  );

  if (!wearing) {
    return null;
  }
  const shown = draft ?? wearing;
  const isYours = chosen !== undefined;
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
        own={own}
        onChange={change}
        onCommit={commit}
      />
      <WindowColoursPreview
        colours={shown}
        named={
          draft !== undefined || chosen !== undefined || named !== undefined
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
