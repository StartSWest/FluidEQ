import type { ISceneCamera } from '../../common/sceneCamera';
import { SCENE_TAP_AGE_LIMIT_S } from '../../common/sceneUniformContract';
import {
  isStudioAgentShape,
  STUDIO_AGENT_MAX_SECONDS,
  STUDIO_AGENT_MIN_SECONDS,
  STUDIO_AGENT_SHAPES,
  type IStudioAgentPointer,
  type IStudioAgentTap,
  type TStudioAgentShape,
  type TStudioAgentSound,
} from '../../common/studioAgent';
import { MIN_SCENE_WAVE_HEIGHT, type ISceneWave } from '../../common/sceneWave';
import { MAX_TEMPO, MIN_TEMPO } from '../../common/sceneRhythm';
import {
  STUDIO_TEST_ACCENT_AT_S,
  STUDIO_TEST_BPM,
  STUDIO_TEST_BUILD_FROM_BEAT,
  STUDIO_TEST_CYCLE_BEATS,
  STUDIO_TEST_DROP_BEAT,
} from '../../common/studioTestMusic';

/**
 * What the Studio's look_at_scene tool may be asked (`studioTools.ts`), and
 * the check every call goes through before anything is read or drawn: a key
 * the schema does not name, a value of the wrong type or out of range, is
 * refused with the reason, so a model can correct itself and a caller cannot
 * slip anything past the schema it was shown.
 */

export interface ILookRequest {
  folder?: string;
  shape: TStudioAgentShape;
  sound: TStudioAgentSound;
  seconds?: number;
  /** The test music's tempo, when not its own. */
  tempo?: number;
  sliders: Readonly<Record<string, number>>;
  wave?: ISceneWave;
  /** As asked; kept inside the scene's own limits when it is drawn. */
  camera?: Partial<ISceneCamera>;
  pointer?: IStudioAgentPointer;
  tap?: IStudioAgentTap;
}

/** Long enough for any real folder; nothing past it is a path. */
const MAX_FOLDER_LENGTH = 1024;

const SHAPES = Object.keys(STUDIO_AGENT_SHAPES) as TStudioAgentShape[];
const SLIDER_ID = /^[a-z][a-z0-9_]{0,23}$/;

/**
 * Wide enough for any angle a caller could mean, and past what any scene
 * allows: the scene's own limits are what hold the camera in the end.
 */
const CAMERA_RANGES = {
  yaw: [-10, 10],
  pitch: [-10, 10],
  zoom: [0.01, 100],
} as const;
const POINTER_RANGES = { x: [0, 1], y: [0, 1] } as const;
const TAP_RANGES = {
  x: [0, 1],
  y: [0, 1],
  seconds: [0, SCENE_TAP_AGE_LIMIT_S],
} as const;

export const LOOK_SCHEMA = {
  type: 'object',
  properties: {
    folder: {
      type: 'string',
      maxLength: MAX_FOLDER_LENGTH,
      description:
        "The full path of the Studio project folder you are working in. Leave it out to look at the project FluidEQ's Studio is showing. If another project is showing, FluidEQ opens this one in the Studio first, so the member sees what you see.",
    },
    shape: {
      type: 'string',
      enum: SHAPES,
      description: `The panel's shape. wide ${STUDIO_AGENT_SHAPES.wide.width}x${STUDIO_AGENT_SHAPES.wide.height} (a window, the default), tall ${STUDIO_AGENT_SHAPES.tall.width}x${STUDIO_AGENT_SHAPES.tall.height} (a narrow column), square ${STUDIO_AGENT_SHAPES.square.width}x${STUDIO_AGENT_SHAPES.square.height}, strip ${STUDIO_AGENT_SHAPES.strip.width}x${STUDIO_AGENT_SHAPES.strip.height} (the graph above the equaliser), ribbon ${STUDIO_AGENT_SHAPES.ribbon.width}x${STUDIO_AGENT_SHAPES.ribbon.height} (the thinnest wide panel). The subject must stay whole in every one.`,
    },
    sound: {
      type: 'string',
      enum: ['music', 'silence'],
      description: `music (the default): FluidEQ's own test music, the same every time so pictures can be compared: a loud, busy song at ${STUDIO_TEST_BPM} BPM unless you give a tempo, beat 0 at 0 s. Kick on the first and third beat of each bar, snare on the second and fourth, hats on the eighths. It repeats every ${STUDIO_TEST_CYCLE_BEATS} beats: a plain bar, a bar building (uSong.y rising from beat ${STUDIO_TEST_BUILD_FROM_BEAT}), the drop on beat ${STUDIO_TEST_DROP_BEAT} (and again on beat ${STUDIO_TEST_DROP_BEAT + STUDIO_TEST_CYCLE_BEATS}), a bar after it. Its uMusicAccent moment peaks at ${STUDIO_TEST_ACCENT_AT_S} s. silence: nothing playing, to check the scene rests calmly.`,
    },
    seconds: {
      type: 'number',
      minimum: STUDIO_AGENT_MIN_SECONDS,
      maximum: STUDIO_AGENT_MAX_SECONDS,
      description:
        'How many seconds into the sound to take the picture. Leave it and beats out for the first kick after a warm-up (beat 4), the moment the gallery pictures every scene at.',
    },
    beats: {
      type: 'number',
      minimum: 1,
      maximum: 32,
      description:
        'Or the moment in beats of the test music instead of seconds, exactly on the grid: 8 is the drop, 12.5 half a beat after the first beat of a plain bar. Pictures a quarter of a beat apart show a dance step by step; each answer says where in the beat and the bar it fell.',
    },
    tempo: {
      type: 'number',
      minimum: MIN_TEMPO,
      maximum: MAX_TEMPO,
      description: `The test music at this many beats a minute instead of ${STUDIO_TEST_BPM}, to try a dance on a slow or a fast song.`,
    },
    sliders: {
      type: 'object',
      additionalProperties: { type: 'number' },
      description:
        "Values for the scene's own sliders (their ids in pack.json), for this picture only: nothing is saved. Use it to see each slider at its bottom and at its top.",
    },
    wave: {
      type: 'object',
      properties: {
        height: {
          type: 'number',
          minimum: MIN_SCENE_WAVE_HEIGHT,
          maximum: 1,
          description:
            "The member's wave height, the share of the panel it fills.",
        },
        position: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description:
            'How far the wave floor is lifted: 0 on the bottom edge, 1 at the middle.',
        },
      },
      required: ['height', 'position'],
      additionalProperties: false,
      description:
        "Where the member's wave stands (uSpectrumRect). Leave it out for the scene's own wave from pack.json, or the full panel.",
    },
    camera: {
      type: 'object',
      properties: {
        yaw: {
          type: 'number',
          description: 'Radians round the scene; 0 is the view as authored.',
        },
        pitch: {
          type: 'number',
          description:
            'Radians; above 0 raises the viewer to look down on the scene.',
        },
        zoom: { type: 'number', description: '1 as authored, in above 1.' },
      },
      additionalProperties: false,
      description:
        "The viewer's camera (uCamera) as if they had dragged the scene there, kept inside pack.json's camera limits. Leave it out for the view as authored. Look at each end of every range the scene allows.",
    },
    pointer: {
      type: 'object',
      properties: {
        x: { type: 'number', minimum: 0, maximum: 1 },
        y: { type: 'number', minimum: 0, maximum: 1 },
        pressed: { type: 'boolean' },
      },
      required: ['x', 'y'],
      additionalProperties: false,
      description:
        'The pointer resting over the panel (uPointer), in uv from the bottom-left, and whether it is held down. Leave it out for no pointer, which is how most listeners see a scene.',
    },
    tap: {
      type: 'object',
      properties: {
        x: { type: 'number', minimum: 0, maximum: 1 },
        y: { type: 'number', minimum: 0, maximum: 1 },
        seconds: { type: 'number', minimum: 0, maximum: SCENE_TAP_AGE_LIMIT_S },
      },
      required: ['x', 'y', 'seconds'],
      additionalProperties: false,
      description:
        'A tap (uTap) at x, y in uv, this many seconds before the picture: take pictures at 0.1, 0.5 and 1.5 to see what a tap does.',
    },
  },
  additionalProperties: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * `value` as an object with no key but those in `ranges` (and `extra`),
 * every one it has a number inside its range and every one in `required`
 * there; or nothing.
 */
const readNumbers = <K extends string>(
  value: unknown,
  ranges: Readonly<Record<K, readonly [number, number]>>,
  required: readonly NoInfer<K>[],
  extra: readonly string[] = [],
): Partial<Record<K, number>> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const known = (key: string): key is K =>
    Object.prototype.hasOwnProperty.call(ranges, key);
  const keys = Object.keys(value);
  if (
    keys.some((key) => !known(key) && !extra.includes(key)) ||
    required.some((key) => !keys.includes(key))
  ) {
    return undefined;
  }
  const read: Partial<Record<K, number>> = {};
  const fine = keys.every((key) => {
    if (!known(key)) {
      return true;
    }
    const field = value[key];
    const [low, high] = ranges[key];
    if (!isNumber(field) || field < low || field > high) {
      return false;
    }
    read[key] = field;
    return true;
  });
  return fine ? read : undefined;
};

const readCamera = (value: unknown): Partial<ISceneCamera> | undefined => {
  const read = readNumbers(value, CAMERA_RANGES, []);
  if (!read) {
    return undefined;
  }
  return {
    ...(read.yaw === undefined ? {} : { yaw: read.yaw }),
    ...(read.pitch === undefined ? {} : { pitch: read.pitch }),
    ...(read.zoom === undefined ? {} : { zoom: read.zoom }),
  };
};

const readPointer = (value: unknown): IStudioAgentPointer | undefined => {
  const read = readNumbers(value, POINTER_RANGES, ['x', 'y'], ['pressed']);
  if (
    !read ||
    read.x === undefined ||
    read.y === undefined ||
    !isRecord(value) ||
    (value.pressed !== undefined && typeof value.pressed !== 'boolean')
  ) {
    return undefined;
  }
  return { x: read.x, y: read.y, pressed: value.pressed === true };
};

const readTap = (value: unknown): IStudioAgentTap | undefined => {
  const read = readNumbers(value, TAP_RANGES, ['x', 'y', 'seconds']);
  if (
    !read ||
    read.x === undefined ||
    read.y === undefined ||
    read.seconds === undefined
  ) {
    return undefined;
  }
  return { x: read.x, y: read.y, seconds: read.seconds };
};

/** The request, or the one-line reason it is not one. */
export const readLookRequest = (
  args: Record<string, unknown>,
): ILookRequest | string => {
  const unknownKey = Object.keys(args).find(
    (key) => !Object.prototype.hasOwnProperty.call(LOOK_SCHEMA.properties, key),
  );
  if (unknownKey !== undefined) {
    return `There is no argument called ${JSON.stringify(unknownKey.slice(0, 40))}.`;
  }
  const {
    folder,
    shape,
    sound,
    seconds,
    beats,
    tempo,
    sliders,
    wave,
    camera,
    pointer,
    tap,
  } = args;
  if (
    folder !== undefined &&
    (typeof folder !== 'string' ||
      folder.length === 0 ||
      folder.length > MAX_FOLDER_LENGTH ||
      folder.includes('\0'))
  ) {
    return 'folder must be the full path of a project folder.';
  }
  if (shape !== undefined && !isStudioAgentShape(shape)) {
    return `shape must be one of ${SHAPES.join(', ')}.`;
  }
  if (sound !== undefined && sound !== 'music' && sound !== 'silence') {
    return 'sound must be music or silence.';
  }
  if (
    seconds !== undefined &&
    (!isNumber(seconds) ||
      seconds < STUDIO_AGENT_MIN_SECONDS ||
      seconds > STUDIO_AGENT_MAX_SECONDS)
  ) {
    return `seconds must be a number from ${STUDIO_AGENT_MIN_SECONDS} to ${STUDIO_AGENT_MAX_SECONDS}.`;
  }
  if (
    tempo !== undefined &&
    (!isNumber(tempo) || tempo < MIN_TEMPO || tempo > MAX_TEMPO)
  ) {
    return `tempo must be a number of beats a minute from ${MIN_TEMPO} to ${MAX_TEMPO}.`;
  }
  const beatS = 60 / (isNumber(tempo) ? tempo : STUDIO_TEST_BPM);
  let moment = isNumber(seconds) ? seconds : undefined;
  if (beats !== undefined) {
    if (seconds !== undefined) {
      return 'give seconds or beats, not both.';
    }
    if (
      !isNumber(beats) ||
      beats * beatS < STUDIO_AGENT_MIN_SECONDS ||
      beats * beatS > STUDIO_AGENT_MAX_SECONDS
    ) {
      return `beats must fall from ${STUDIO_AGENT_MIN_SECONDS} to ${STUDIO_AGENT_MAX_SECONDS} seconds into the music: at this tempo, from ${Math.ceil(STUDIO_AGENT_MIN_SECONDS / beatS)} to ${Math.floor(STUDIO_AGENT_MAX_SECONDS / beatS)}.`;
    }
    moment = beats * beatS;
  }
  const values: Record<string, number> = {};
  if (sliders !== undefined) {
    if (!isRecord(sliders)) {
      return 'sliders must be an object of slider ids and numbers.';
    }
    const entries = Object.entries(sliders);
    if (entries.length > 8) {
      return 'sliders must name at most 8 of the scene sliders, each with a number.';
    }
    const fine = entries.every(([id, value]) => {
      if (!SLIDER_ID.test(id) || !isNumber(value)) {
        return false;
      }
      values[id] = value;
      return true;
    });
    if (!fine) {
      return 'sliders must name at most 8 of the scene sliders, each with a number.';
    }
  }
  let chosenWave: ISceneWave | undefined;
  if (wave !== undefined) {
    if (
      !isRecord(wave) ||
      Object.keys(wave).some((key) => key !== 'height' && key !== 'position') ||
      !isNumber(wave.height) ||
      !isNumber(wave.position) ||
      wave.height < MIN_SCENE_WAVE_HEIGHT ||
      wave.height > 1 ||
      wave.position < 0 ||
      wave.position > 1
    ) {
      return `wave must be { "height": ${MIN_SCENE_WAVE_HEIGHT} to 1, "position": 0 to 1 }.`;
    }
    chosenWave = { height: wave.height, position: wave.position };
  }
  const chosenCamera = camera === undefined ? undefined : readCamera(camera);
  if (camera !== undefined && !chosenCamera) {
    return 'camera must be { "yaw": radians, "pitch": radians, "zoom": a factor }, any of them.';
  }
  const chosenPointer =
    pointer === undefined ? undefined : readPointer(pointer);
  if (pointer !== undefined && !chosenPointer) {
    return 'pointer must be { "x": 0 to 1, "y": 0 to 1, "pressed": true or false }.';
  }
  const chosenTap = tap === undefined ? undefined : readTap(tap);
  if (tap !== undefined && !chosenTap) {
    return `tap must be { "x": 0 to 1, "y": 0 to 1, "seconds": 0 to ${SCENE_TAP_AGE_LIMIT_S} }.`;
  }
  return {
    ...(typeof folder === 'string' ? { folder } : {}),
    shape: isStudioAgentShape(shape) ? shape : 'wide',
    sound: sound === 'silence' ? 'silence' : 'music',
    ...(moment === undefined ? {} : { seconds: moment }),
    ...(isNumber(tempo) ? { tempo } : {}),
    sliders: values,
    ...(chosenWave ? { wave: chosenWave } : {}),
    ...(chosenCamera ? { camera: chosenCamera } : {}),
    ...(chosenPointer ? { pointer: chosenPointer } : {}),
    ...(chosenTap ? { tap: chosenTap } : {}),
  };
};
