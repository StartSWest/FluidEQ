/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  cameraKeyOfCode,
  codeOfCameraKey,
  printedKey,
  SCENE_CAMERA_ORBITS,
  type TSceneCameraKey,
  type TSceneCameraMove,
  type TSceneCameraOrbit,
} from 'common/sceneCameraControl';
import { prefersReducedMotion } from '../utils/bandReveal';
import { useTranslation } from '../utils/I18nContext';
import {
  setSceneCameraControl,
  useSceneCameraControl,
} from '../utils/sceneCameraControlStore';
import { useGraphSceneRun } from './graphScenePlace';
import type { ISceneInteraction } from './sceneInteraction';
import { CycleRow, ViewMenuIcon } from './ViewMenuCycleRow';

const MODIFIER_LABEL: Record<'ctrl' | 'alt' | 'shift', TranslationKey> = {
  ctrl: 'graph.scene.camera.key.ctrl',
  alt: 'graph.scene.camera.key.alt',
  shift: 'graph.scene.camera.key.shift',
};

const MOVE_LABEL: Record<TSceneCameraMove, TranslationKey> = {
  drag: 'graph.scene.camera.move.drag',
  move: 'graph.scene.camera.move.move',
};

const ORBIT_LABEL: Record<TSceneCameraOrbit, TranslationKey> = {
  off: 'graph.scene.camera.orbit.off',
  slow: 'graph.scene.camera.orbit.slow',
  normal: 'graph.scene.camera.orbit.normal',
};

/** The modifiers in the order a click steps through them; then a key of one's own. */
const NEXT_MODIFIER: Partial<Record<TSceneCameraKey, TSceneCameraKey>> = {
  ctrl: 'alt',
  alt: 'shift',
};

const noSubscription = () => () => undefined;

/** The orbit's next pace: off, slow, normal and back. */
const after = (orbit: TSceneCameraOrbit) =>
  SCENE_CAMERA_ORBITS[
    (SCENE_CAMERA_ORBITS.indexOf(orbit) + 1) % SCENE_CAMERA_ORBITS.length
  ];

/** Chromium's map of each key's place to what this keyboard types there. */
interface IKeyboardLayout {
  getLayoutMap(): Promise<ReadonlyMap<string, string>>;
}

/**
 * What this keyboard's layout types on each key, where the browser can say:
 * a key of one's own is chosen by its place, and is named as it is printed
 * on this keyboard - a German layout's `ö` where a US one has `;`. Read
 * once; until it arrives, or where it never does, a letter or a digit is
 * named from its code and the rest by the code itself.
 */
let layout: Promise<ReadonlyMap<string, string> | undefined> | undefined;
const readLayout = () => {
  const { keyboard } = navigator as Navigator & {
    keyboard?: IKeyboardLayout;
  };
  layout ??= keyboard
    ? keyboard.getLayoutMap().catch(() => undefined)
    : Promise.resolve(undefined);
  return layout;
};

const useKeyboardLayout = () => {
  const [map, setMap] = useState<ReadonlyMap<string, string>>();
  useEffect(() => {
    let live = true;
    readLayout()
      .then((found) => {
        // Nothing to say where the browser cannot read the layout.
        if (live && found) {
          setMap(found);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return map;
};

/** Whether the graph's scene can be turned now, followed as it changes. */
const useTurns = (interaction: ISceneInteraction | undefined) =>
  useSyncExternalStore(
    interaction ? interaction.subscribe : noSubscription,
    () => interaction?.turns() ?? false,
  );

/** And whether it turns all the way round, which is where it can circle. */
const useTurnsRound = (interaction: ISceneInteraction | undefined) =>
  useSyncExternalStore(
    interaction ? interaction.subscribe : noSubscription,
    () => interaction?.turnsRound() ?? false,
  );

/**
 * How a 3D scene's camera is moved (`common/sceneCameraControl.ts`), in the
 * View menu beside the scene's own controls, and only while the scene on the
 * graph is one that can be turned: elsewhere the choice changes nothing to
 * look at. Two rows that cycle as the drawing rows do. The key steps through
 * Ctrl, Alt and Shift and then waits for any other key, pressed as a
 * shortcut is recorded (Esc stops waiting); the way steps between holding the
 * key and dragging, and holding it and moving the mouse alone.
 *
 * Shift is offered and said plainly: over a scene that turns it is the
 * scene's, so Shift and a drag there turns rather than adding bands to the
 * selection (a more specific gesture winning, as Ctrl's does today). A key of
 * one's own is the scene's over the scene and its usual self everywhere else.
 */
export default function SceneCameraMenu() {
  const { t } = useTranslation();
  const run = useGraphSceneRun();
  const turns = useTurns(run?.interaction);
  const turnsRound = useTurnsRound(run?.interaction);
  const { key, move, follow, orbit } = useSceneCameraControl();
  const [recording, setRecording] = useState(false);
  const keyboardLayout = useKeyboardLayout();

  useEffect(() => {
    if (!recording) {
      return undefined;
    }
    // Captured at the window, before the menu's own keys (Esc closes it, the
    // arrows move through it) and every shortcut of the window's.
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape') {
        setRecording(false);
        return;
      }
      // A key that may not be the camera's is not taken, and the wait goes on.
      const next = cameraKeyOfCode(event.code);
      if (next) {
        setSceneCameraControl({ key: next });
        setRecording(false);
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () =>
      window.removeEventListener('keydown', onKey, { capture: true });
  }, [recording]);

  if (!turns) {
    return null;
  }
  // Read as the menu is drawn: the window's own Motion switch, or Windows'.
  const calm = prefersReducedMotion();

  const code = codeOfCameraKey(key);
  let keyValue: string;
  if (recording) {
    keyValue = t('graph.scene.camera.key.press');
  } else if (code === undefined) {
    keyValue = t(MODIFIER_LABEL[key as 'ctrl' | 'alt' | 'shift']);
  } else {
    keyValue =
      keyboardLayout?.get(code)?.toUpperCase() ?? printedKey(code) ?? code;
  }

  let report: string | undefined;
  if (recording) {
    report = t('graph.scene.camera.key.pressNote');
  } else if (key === 'shift') {
    report = t('graph.scene.camera.key.shiftNote');
  } else if (code !== undefined) {
    report = t('graph.scene.camera.key.ownNote');
  }

  const onCycleKey = () => {
    if (recording) {
      setRecording(false);
      setSceneCameraControl({ key: 'ctrl' });
      return;
    }
    const next = NEXT_MODIFIER[key];
    if (next) {
      setSceneCameraControl({ key: next });
    } else if (key === 'shift') {
      setRecording(true);
    } else {
      setSceneCameraControl({ key: 'ctrl' });
    }
  };

  return (
    <>
      {/* The cycling row's own shape, with the key in the chip the menu's
        shortcuts wear (Ctrl+W, Space): it is a key, and reads as one.
        Waiting for a key, the row says so in words. */}
      <button
        type="button"
        role="menuitem"
        title={t('graph.scene.camera.keyHint')}
        className={report ? 'graph-view-menu__row--reported' : undefined}
        onClick={onCycleKey}
      >
        <ViewMenuIcon>
          {/* A key cap. */}
          <path d="M2.5 3.5h11v9h-11z" />
          <path d="M5 10h6" />
        </ViewMenuIcon>
        <span>{t('graph.scene.camera.key')}</span>
        {recording ? (
          <span className="graph-view-menu__value">{keyValue}</span>
        ) : (
          <kbd>{keyValue}</kbd>
        )}
        {report && <span className="graph-view-menu__report">{report}</span>}
      </button>
      <CycleRow
        hint="graph.scene.camera.moveHint"
        label="graph.scene.camera.move"
        value={t(MOVE_LABEL[move])}
        // A turn round a centre.
        icon={
          <>
            <path d="M13 8a5 5 0 1 1-1.5-3.6" />
            <path d="M11.8 1.8v2.8H9" />
          </>
        }
        onCycle={() =>
          setSceneCameraControl({ move: move === 'drag' ? 'move' : 'drag' })
        }
      />
      <CycleRow
        hint="graph.scene.camera.followHint"
        label="graph.scene.camera.follow"
        value={t(
          follow
            ? 'graph.scene.camera.follow.on'
            : 'graph.scene.camera.follow.off',
        )}
        note={follow && calm ? t('graph.scene.camera.calmNote') : undefined}
        // A pointer, and the arc the view leans along after it.
        icon={
          <>
            <path d="M5.5 4.5l5 4-2.3.4 1.3 2.6-1.2.6-1.3-2.6-1.5 1.6z" />
            <path d="M2 12.5c1.5 1.4 3.5 2 5.5 2" />
          </>
        }
        onCycle={() => setSceneCameraControl({ follow: !follow })}
      />
      {/* Only where the scene can go all the way round: elsewhere a circle
        would be a sway, which is another motion and not what was asked. */}
      {turnsRound && (
        <CycleRow
          hint="graph.scene.camera.orbitHint"
          label="graph.scene.camera.orbit"
          value={t(ORBIT_LABEL[orbit])}
          note={
            orbit !== 'off' && calm
              ? t('graph.scene.camera.calmNote')
              : undefined
          }
          // A path round a centre, with the camera on it.
          icon={
            <>
              <ellipse cx="8" cy="8.5" rx="6" ry="3.2" />
              <circle cx="8" cy="8.5" r="1" />
              <path d="M12.6 5.4l1.4.4-.5 1.4" />
            </>
          }
          onCycle={() => setSceneCameraControl({ orbit: after(orbit) })}
        />
      )}
    </>
  );
}
