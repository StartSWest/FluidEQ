/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type ILampPicture,
  type ILampPreview,
  type ILampSceneChoice,
} from '../../common/lighting/lampSceneChoice';
import {
  LIGHTING_GRID_HEIGHT,
  LIGHTING_GRID_WIDTH,
  type ILightingFrame,
  type ILightingState,
} from '../../common/lighting/lightingModel';
import { lightingProfile } from '../../common/lighting/lightingProfiles';
import { swatchColours } from '../../common/lighting/swatchGrid';
import { framedPanel, framedPoint } from '../../common/sceneFraming';
import { NEUTRAL_RESPONSE } from '../../common/sceneResponse';
import type { IScenePack } from '../../common/scenePacks';
import { assembleFragmentSource } from '../../common/sceneUniformContract';
import { FULL_VIEW, SCENE_VIEW_VERTEX_SOURCE } from '../../common/sceneView';
import {
  startLampSceneHost,
  type ILampSceneHost,
  type ILampSceneHostEvents,
} from './lampSceneHost';
import {
  encodeAccent,
  encodeDaylight,
  encodePause,
  encodePreview,
  encodeProfile,
  encodeShow,
  type ISceneHostGrid,
  type ISceneHostScene,
  type TSceneHostFailure,
} from './sceneHostWire';

/**
 * The desk lights' scene, drawn without the window: main's half of
 * `FluidEQ-Scenes.exe`, and what `DynamicLightingLoop`, `lampScenePlay.ts`
 * and `lightingSceneClient.ts` did in the window before.
 *
 * The window says what the desk plays (`ILampSceneChoice`, kept on disk so a
 * launch in the tray lights the desk before any window has spoken); the
 * lighting settings say whether it plays at all. While both say yes the host
 * runs, is handed the scene — its program, its sliders, its framing at the
 * lamps' 16:9, its artwork as signed — and every grid it draws goes to the
 * lamps as the window's frames did. A scene the GPU will not draw lights the
 * desk with its colours, which the host does itself; one whose frames held
 * the GPU is not handed to it again this session, as the window kept it.
 */

/** A host that ends this often in one session is not started again. */
const MAX_HOST_FAILURES = 3;
/** `ambient` in a frame: the desk resting rather than following music. */
const AMBIENT_ACTIVITY = 0.05;
/** The window's refusals for the session: these, never a compile. */
const GPU_REFUSALS: ReadonlySet<TSceneHostFailure> = new Set([
  'gpu-reset',
  'too-heavy',
]);

export interface ILampScenesDeps {
  /** The host's executable; nothing where it is not built. */
  executable: string | undefined;
  /** Where Electron's ANGLE is: the folder its own executable is in. */
  angleDir: string;
  log: { warn(text: string): void };
  /** The pack of a look this account may play now, or nothing. */
  loadScene(lookId: string): IScenePack | undefined;
  /** Hear about a scene installed, updated or taken away. */
  subscribeScenes(listener: () => void): () => void;
  /** The last choice the window made, and where it is kept. */
  kept: { read(): ILampSceneChoice | null; keep(next: ILampSceneChoice): void };
  /** Each frame for the lamps (`ILightingService.frame`). */
  frame(frame: ILightingFrame): void;
  /** The lamps given back. */
  release(): void;
  /** The page's view of each frame, while the page is open. */
  preview(preview: ILampPreview): void;
  startHost?: typeof startLampSceneHost;
}

export interface ILampScenes {
  /** What the window says the desk plays now. */
  choose(choice: ILampSceneChoice): void;
  /** The lighting settings or devices changed. */
  stateChanged(state: ILightingState): void;
  /** The lighting page opened or closed: it draws what the lamps show. */
  watch(open: boolean): void;
  pid(): number | undefined;
  dispose(): void;
}

/**
 * What tells two programs apart on the host: its sliders and its shader. A
 * world is not drawn there — the host draws a world's pack by its sky — so
 * a world does not make another program here.
 */
const programKey = (pack: IScenePack): string =>
  `${pack.params.map((param) => param.id).join(',')}\n${pack.source}`;

/**
 * The scene as the host draws it: the window's program text, the pack's
 * sliders and response, and its framing worked out at 16:9, the shape of
 * every size the lamps are drawn at (`frameOf` in `sceneFramingView.ts`).
 */
export const hostSceneOf = (
  pack: IScenePack,
  guarded: boolean,
): ISceneHostScene => {
  const picture = pack.framing
    ? framedPanel(FULL_VIEW, 16, 9, pack.framing)
    : FULL_VIEW;
  const [bandLeft, bandFloor] = framedPoint(FULL_VIEW, picture, 0, 0);
  const [bandRight, bandCeiling] = framedPoint(FULL_VIEW, picture, 1, 1);
  return {
    guarded,
    response: pack.response ?? NEUTRAL_RESPONSE,
    params: pack.params.map(({ id, value, min, max }) => ({
      id,
      value,
      min,
      max,
    })),
    vertexSource: SCENE_VIEW_VERTEX_SOURCE,
    fragmentSource: assembleFragmentSource(pack).source,
    view: [picture[0], picture[1], picture[2], picture[3]],
    spectrumRect: [bandLeft, bandRight, bandFloor, bandCeiling],
    ...(pack.artwork
      ? {
          artwork: {
            width: pack.artwork.width,
            height: pack.artwork.height,
            webp: Uint8Array.from(Buffer.from(pack.artwork.data, 'base64')),
          },
        }
      : {}),
  };
};

export const createLampScenes = (deps: ILampScenesDeps): ILampScenes => {
  const startHost = deps.startHost ?? startLampSceneHost;
  let choice = deps.kept.read();
  let state: ILightingState | undefined;
  let host: ILampSceneHost | undefined;
  let failures = 0;
  let lit = false;
  let pageOpen = false;
  let disposed = false;
  /** Each show's look and program, by the id the host answers with. */
  const shows = new Map<number, { lookId: string; key?: string }>();
  let showsMade = 0;
  /** The show asked for last, and what it was made from. */
  let shown: { id: number; identity: string; guarded: boolean } | undefined;
  /** The look in the picture: the one asked for, once it has linked. */
  let drawn: string | undefined;
  /** Programs whose frames held the GPU: for the session, as in the window. */
  const refused = new Set<string>();
  /** What the host was last told, so only a change is sent. */
  let told: { [key: string]: string } = {};
  /** A drawn frame waiting for its picture, while the page is open. */
  let waiting: ILightingFrame | undefined;

  const wanted = (): boolean =>
    !disposed &&
    deps.executable !== undefined &&
    failures < MAX_HOST_FAILURES &&
    state !== undefined &&
    state.supported &&
    state.settings.enabled &&
    choice?.scene != null;

  const tell = (topic: string, value: string, message: () => Uint8Array) => {
    if (host && told[topic] !== value) {
      told[topic] = value;
      host.send(message());
    }
  };

  const show = () => {
    const scene = choice?.scene;
    if (!host || !scene) {
      return;
    }
    showsMade += 1;
    const id = showsMade;
    const colours = swatchColours(scene.swatch);
    const pack = deps.loadScene(scene.lookId);
    const key = pack ? programKey(pack) : undefined;
    shows.set(id, { lookId: scene.lookId, key });
    shown = { id, identity: scene.identity, guarded: scene.guarded };
    // No pack, or one whose frames held the GPU: its colours light the desk.
    host.send(
      pack && key && !refused.has(key)
        ? encodeShow(id, colours, hostSceneOf(pack, scene.guarded))
        : encodeShow(id, colours),
    );
  };

  const tellAll = () => {
    if (!host || !choice || !state) {
      return;
    }
    const profile = lightingProfile(
      state.settings.profiles,
      choice.scene?.lookId,
    );
    const { accent, daylight, paused } = choice;
    tell('accent', accent.join(), () => encodeAccent(accent));
    tell('daylight', JSON.stringify(daylight), () => encodeDaylight(daylight));
    tell('pause', String(paused), () => encodePause(paused));
    tell('profile', `${profile.idle}:${profile.idleSpeed}`, () =>
      encodeProfile(profile.idle === 'hold', profile.idleSpeed),
    );
    tell('preview', String(pageOpen), () => encodePreview(pageOpen));
    const { scene } = choice;
    if (
      scene &&
      (shown === undefined ||
        shown.identity !== scene.identity ||
        shown.guarded !== scene.guarded)
    ) {
      show();
    }
  };

  const toLamps = (grid: ISceneHostGrid): ILightingFrame => ({
    width: LIGHTING_GRID_WIDTH,
    height: LIGHTING_GRID_HEIGHT,
    rgb: grid.rgb,
    level: grid.level,
    beat: grid.beat,
    bass: grid.bass,
    mid: grid.mid,
    treble: grid.treble,
    deltaMs: grid.deltaMs,
    sceneId: drawn ?? choice?.scene?.lookId,
    timeSeconds: grid.timeSeconds,
    activity: grid.activity,
    ambient: grid.activity < AMBIENT_ACTIVITY,
  });

  const previewWithout = () => {
    if (waiting) {
      deps.preview({ frame: waiting });
      waiting = undefined;
    }
  };

  const events: ILampSceneHostEvents = {
    grid: (grid) => {
      if (!wanted()) {
        return;
      }
      const frame = toLamps(grid);
      lit = true;
      deps.frame(frame);
      if (!pageOpen) {
        return;
      }
      // A picture follows a frame drawn from the scene; one dropped on the
      // way leaves its frame to be shown without one.
      previewWithout();
      if (grid.drawn) {
        waiting = frame;
      } else {
        deps.preview({ frame });
      }
    },
    picture: (width, height, rgb) => {
      if (!waiting || !pageOpen) {
        return;
      }
      const picture: ILampPicture = { width, height, rgb };
      deps.preview({ frame: waiting, picture });
      waiting = undefined;
    },
    loaded: (id) => {
      drawn = shows.get(id)?.lookId;
    },
    failed: (id, reason, words) => {
      // The scene being drawn (0) or the one asked for: its colours now.
      const failedShow = id === 0 ? undefined : shows.get(id);
      const key =
        failedShow?.key ??
        [...shows.values()].find((entry) => entry.lookId === drawn)?.key;
      drawn = undefined;
      if (GPU_REFUSALS.has(reason) && key) {
        refused.add(key);
      }
      if (reason !== 'lost') {
        deps.log.warn(
          `The desk lights' scene could not be drawn (${reason}): ${words}`,
        );
        return;
      }
      // Not the scene's doing: asked for again, which builds a new context.
      shown = undefined;
      tellAll();
    },
    exited: (expected, said) => {
      host = undefined;
      told = {};
      shown = undefined;
      drawn = undefined;
      waiting = undefined;
      shows.clear();
      if (expected) {
        return;
      }
      failures += 1;
      deps.log.warn(
        `The desk lights' scene host stopped (${failures} of ${MAX_HOST_FAILURES})${said ? `: ${said}` : '.'}`,
      );
      reconcile();
    },
  };

  const reconcile = () => {
    if (!wanted()) {
      if (host) {
        const stopping = host;
        host = undefined;
        told = {};
        shown = undefined;
        stopping.stop();
      }
      if (lit) {
        lit = false;
        deps.release();
      }
      return;
    }
    if (!host && deps.executable) {
      host = startHost({
        executable: deps.executable,
        angleDir: deps.angleDir,
        events,
      });
    }
    tellAll();
  };

  const stopScenes = deps.subscribeScenes(() => {
    // A new version of the scene, or the scene taken away: shown afresh.
    if (host && choice?.scene) {
      show();
    }
  });

  return {
    choose: (next) => {
      choice = next;
      deps.kept.keep(next);
      reconcile();
    },
    stateChanged: (next) => {
      state = next;
      reconcile();
    },
    watch: (open) => {
      pageOpen = open;
      if (!open) {
        waiting = undefined;
      }
      reconcile();
    },
    pid: () => host?.pid(),
    dispose: () => {
      disposed = true;
      stopScenes();
      reconcile();
    },
  };
};
