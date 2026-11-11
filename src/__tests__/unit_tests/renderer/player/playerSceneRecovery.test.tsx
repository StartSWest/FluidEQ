/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The compact player's scene that would not build is put right from a better
 * copy, or the graph's notice says why (Ivan, 2026-11-11: "if it fails it
 * recovers"). The amp stood the free look in and said nothing; now a member's
 * look is recovered (main's side is `sceneRecovery.test.ts`) and the player
 * draws the kept copy by itself, as a new revision is a new scene to it.
 */

import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import type { IScenePack } from 'common/scenePacks';
import {
  memberVersionWouldNotBuild,
  playerLookWouldNotBuild,
} from 'renderer/graph/lookRecovery';
import type { ISceneSource } from 'renderer/graph/sceneRunnerTypes';
import PlayerAmp from 'renderer/player/PlayerAmp';
import type { TGraphScene } from 'renderer/player/useGraphScenePack';
import ScenePreview, { type TPreviewTrouble } from 'renderer/plus/ScenePreview';

const ME = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';
const MEMBER_LOOK = `member:${ME}:waveform-3d`;
const NAMES = { en: 'Waveform 3D' };

let mockScene: TGraphScene = { state: 'none' };
let mockStageProps:
  | {
      scene?: unknown;
      onTrouble: (trouble: TPreviewTrouble) => void;
      onVersionFailed?: () => void;
    }
  | undefined;
const mockRefuse = jest.fn();

jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('renderer/player/playerLayout', () => ({
  usePlayerFold: () => ({
    isFolded: false,
    fold: () => undefined,
    unfold: () => undefined,
  }),
  usePlayerShelfOpen: () => ({ isShelfOpen: true }),
  usePlayerSound: () => ({ sound: { face: 'eq', isOpen: true } }),
  usePlayerVisFull: () => false,
}));
jest.mock('renderer/player/useGraphScenePack', () => ({
  __esModule: true,
  default: () => mockScene,
}));
jest.mock('renderer/player/usePlayerHeightFloor', () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock('renderer/utils/useIsBackdrop', () => ({
  __esModule: true,
  default: () => false,
}));
jest.mock('renderer/player/useMusicDrop', () => ({
  __esModule: true,
  default: () => ({ isOver: false, dropAt: undefined }),
}));
// jsdom has no WebGL: a scene is offered here as on a machine that draws.
jest.mock('renderer/graph/sceneHealth', () => ({
  ...jest.requireActual('renderer/graph/sceneHealth'),
  isSceneRenderingAvailable: () => true,
}));
jest.mock('renderer/graph/lookRefusal', () => ({
  ...jest.requireActual('renderer/graph/lookRefusal'),
  refuseLook: (...args: unknown[]) => mockRefuse(...args),
}));
function mockStub(testId: string) {
  return {
    __esModule: true,
    default: () => <div data-testid={testId} />,
  };
}
jest.mock('renderer/player/PlayerStage', () => ({
  __esModule: true,
  default: (props: NonNullable<typeof mockStageProps>) => {
    mockStageProps = props;
    return <div data-testid="stage" data-scene={props.scene ? 'yes' : 'no'} />;
  },
}));
jest.mock('renderer/player/FoldStrip', () => mockStub('strip'));
jest.mock('renderer/player/PlayerTitleStrip', () => mockStub('title'));
jest.mock('renderer/player/PlayerHero', () => mockStub('hero'));
jest.mock('renderer/player/PlayerDock', () => mockStub('dock'));
jest.mock('renderer/player/PlayerSound', () => mockStub('sound'));
jest.mock('renderer/player/PlayerQueue', () => mockStub('queue'));
jest.mock('renderer/player/PlayerFoot', () => mockStub('foot'));
jest.mock('renderer/player/PlayerHeightGrip', () => mockStub('grip'));
jest.mock('renderer/player/PlayerIcon', () => mockStub('icon'));
let mockSource: ISceneSource | undefined;
jest.mock('renderer/graph/useSceneRunner', () => ({
  __esModule: true,
  default: (options: { source: ISceneSource }) => {
    mockSource = options.source;
    return { current: null };
  },
}));
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
}));

const pack = (revision: number) =>
  ({
    schema: 1,
    id: 'waveform-3d',
    version: revision,
    contract: 9,
    names: NAMES,
    fallbackStyle: 'skyline',
    swatch: ['#102030', '#a0b0c0'],
    source: 'vec4 sceneColour(vec2 uv) { return vec4(uv, 0.0, 1.0); }\n',
    params: [],
  }) as IScenePack;

const ready = (lookId: string, revision: number): TGraphScene => ({
  state: 'ready',
  identity: `${lookId}@${revision}`,
  lookId,
  revision: String(revision),
  pack: pack(revision),
  madeBy: 'listener',
  label: NAMES.en,
  tuning: undefined,
  wave: { height: 1, position: 0 },
});

/** Main's answer to a recovery, and the looks it lists afterwards. */
const bridge = (recovers: boolean, listed = true) => {
  const api = {
    recoverMemberScene: jest.fn(async (_lookId: string) =>
      recovers ? { recovered: true, from: 'gallery' } : { recovered: false },
    ),
    listMemberScenes: jest.fn(async () => ({
      scenes: listed
        ? [
            {
              lookId: MEMBER_LOOK,
              authorId: ME,
              packId: 'waveform-3d',
              version: 2,
              names: NAMES,
              fallbackStyle: 'skyline',
              swatch: ['#102030', '#a0b0c0'],
              own: true,
            },
          ]
        : [],
      locked: [],
    })),
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: api },
  });
  return api;
};

const stage = () => {
  if (!mockStageProps) {
    throw new Error('the amp drew no stage');
  }
  return mockStageProps;
};

beforeEach(() => {
  mockScene = { state: 'none' };
  mockStageProps = undefined;
  mockSource = undefined;
  mockRefuse.mockClear();
});
afterEach(() => {
  Reflect.deleteProperty(window, 'electron');
});

describe('the compact player, its scene not building', () => {
  it('stands the free look in and asks for a better copy, which draws by itself', async () => {
    const api = bridge(true);
    mockScene = ready(MEMBER_LOOK, 1);
    const { rerender, getByTestId } = render(
      <PlayerAmp onOpenPage={() => undefined} />,
    );
    expect(getByTestId('stage')).toHaveAttribute('data-scene', 'yes');
    await act(async () => stage().onTrouble('compile'));
    expect(getByTestId('stage')).toHaveAttribute('data-scene', 'no');
    expect(api.recoverMemberScene).toHaveBeenCalledWith(MEMBER_LOOK);
    expect(mockRefuse).not.toHaveBeenCalled();
    // The kept copy is a new revision: the player draws it by itself.
    mockScene = ready(MEMBER_LOOK, 2);
    rerender(<PlayerAmp onOpenPage={() => undefined} />);
    expect(getByTestId('stage')).toHaveAttribute('data-scene', 'yes');
  });

  it('says why through the graph’s notice when no better copy is found', async () => {
    bridge(false);
    mockScene = ready(MEMBER_LOOK, 1);
    render(<PlayerAmp onOpenPage={() => undefined} />);
    await act(async () => stage().onTrouble('compile'));
    expect(mockRefuse).toHaveBeenCalledWith(MEMBER_LOOK, NAMES, 'compile');
  });

  it('asks nothing for a scene too heavy or a machine that cannot draw', async () => {
    const api = bridge(true);
    mockScene = ready(MEMBER_LOOK, 1);
    render(<PlayerAmp onOpenPage={() => undefined} />);
    await act(async () => stage().onTrouble('heavy'));
    await act(async () => stage().onTrouble('unavailable'));
    expect(api.recoverMemberScene).not.toHaveBeenCalled();
    expect(mockRefuse).not.toHaveBeenCalled();
  });

  it('puts right a newer version behind the one playing, for a member’s look only', async () => {
    const api = bridge(true);
    mockScene = ready('premium:aurora', 1);
    const { rerender } = render(<PlayerAmp onOpenPage={() => undefined} />);
    await act(async () => stage().onVersionFailed?.());
    expect(api.recoverMemberScene).not.toHaveBeenCalled();
    mockScene = ready(MEMBER_LOOK, 1);
    rerender(<PlayerAmp onOpenPage={() => undefined} />);
    await act(async () => stage().onVersionFailed?.());
    expect(api.recoverMemberScene).toHaveBeenCalledWith(MEMBER_LOOK);
    expect(mockRefuse).not.toHaveBeenCalled();
  });
});

describe('the player’s ask, as the graph answers it', () => {
  it('refuses one of FluidEQ’s own at once, asking nothing of main', async () => {
    const api = bridge(true);
    await playerLookWouldNotBuild('premium:aurora', NAMES);
    expect(api.recoverMemberScene).not.toHaveBeenCalled();
    expect(mockRefuse).toHaveBeenCalledWith('premium:aurora', NAMES, 'compile');
  });

  it('refuses a member’s look repaired and yet not offered here', async () => {
    bridge(true, false);
    await playerLookWouldNotBuild(MEMBER_LOOK, NAMES);
    expect(mockRefuse).toHaveBeenCalledWith(MEMBER_LOOK, NAMES, 'compile');
  });

  it('a version put right says nothing', async () => {
    const api = bridge(false);
    await memberVersionWouldNotBuild(MEMBER_LOOK);
    expect(api.recoverMemberScene).toHaveBeenCalledWith(MEMBER_LOOK);
    expect(mockRefuse).not.toHaveBeenCalled();
  });
});

describe('the preview tells its runner about versions only when asked to', () => {
  const mount = (onVersionFailed?: () => void) =>
    render(
      <ScenePreview
        identity="waveform-3d@1"
        madeBy="listener"
        pack={pack(1)}
        label={NAMES.en}
        onTrouble={() => undefined}
        onVersionFailed={onVersionFailed}
      />,
    );

  it('hands the runner a version failure for the player', () => {
    const told = jest.fn();
    mount(told);
    mockSource?.versionFailed?.('ERROR: 0:3');
    expect(told).toHaveBeenCalledTimes(1);
  });

  // The control: the gallery's preview and the rest are told nothing.
  it('hands it none anywhere else', () => {
    mount();
    expect(mockSource).toBeDefined();
    expect(mockSource?.versionFailed).toBeUndefined();
  });
});
