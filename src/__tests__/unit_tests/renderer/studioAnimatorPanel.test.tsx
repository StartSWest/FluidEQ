/**
 * An animation's animator in the window (`animatorChatStore.ts`,
 * `AnimatorChat`): its chat is heard on the chat's own events by its own
 * key and the scene's chat never takes them; a message to it carries the
 * animator's brief; the scene's chat starting one sends the task to it,
 * said to come from the scene's chat; and an opened animation shows it.
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  animatorChatKey,
  type TStudioChatAsk,
  type TStudioChatEntry,
} from '../../../common/studioChat';
import AnimatorChat from '../../../renderer/studio/animations/AnimatorChat';
import {
  loadAnimatorChat,
  resetAnimatorChatStore,
  sendToAnimator,
  useAnimatorChats,
  watchAnimatorStarts,
} from '../../../renderer/studio/chat/animatorChatStore';
import {
  checkStudioChat,
  resetStudioChatStore,
  useStudioChat,
} from '../../../renderer/studio/chat/studioChatStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
    locale: 'en',
  }),
}));

const PROJECT = '0f8a7c2e-1b2c-4d5e-8f90-123456789abc';
const KEY = animatorChatKey(PROJECT, 'wolf-walk');

type TEntryListener = (change: {
  projectId: string;
  entry: TStudioChatEntry;
  busy: boolean;
}) => void;
let entryListeners: TEntryListener[] = [];
type TAskListener = (change: {
  projectId: string;
  ask?: TStudioChatAsk;
}) => void;
let askListeners: TAskListener[] = [];
let startListener:
  | ((start: { projectId: string; name: string; task: string }) => void)
  | undefined;
const bridge = {
  studioChatAvailability: jest.fn(async () => ({
    state: 'ready',
    plan: 'max',
  })),
  studioAnimatorLoad: jest.fn(async (name: string) => ({
    projectId: animatorChatKey(PROJECT, name),
    entries: [] as TStudioChatEntry[],
    busy: false,
  })),
  studioAnimatorSend: jest.fn(async () => undefined),
  studioAnimatorStop: jest.fn(async () => undefined),
  onStudioChatEntry: (listener: TEntryListener) => {
    entryListeners.push(listener);
    return () => {
      entryListeners = entryListeners.filter((each) => each !== listener);
    };
  },
  onStudioChatQueue: () => () => undefined,
  onStudioChatContext: () => () => undefined,
  onStudioChatAsk: (listener: TAskListener) => {
    askListeners.push(listener);
    return () => {
      askListeners = askListeners.filter((each) => each !== listener);
    };
  },
  studioChatAnswer: jest.fn(async () => undefined),
  onStudioChatLimits: () => () => undefined,
  onStudioChatPack: () => () => undefined,
  onStudioAnimatorStart: (listener: typeof startListener) => {
    startListener = listener;
    return () => {
      startListener = undefined;
    };
  },
};

beforeAll(() => {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    get: () => ({ ipcRenderer: bridge }),
  });
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  entryListeners = [];
  askListeners = [];
  startListener = undefined;
  jest.clearAllMocks();
  resetAnimatorChatStore();
  resetStudioChatStore();
});

const tell = (projectId: string, text: string, busy: boolean) =>
  act(() => {
    entryListeners.forEach((listener) =>
      listener({
        projectId,
        entry: {
          kind: 'claude',
          id: `${projectId}-1`,
          text,
          steps: [],
          state: busy ? 'working' : 'done',
        },
        busy,
      }),
    );
  });

function Probe() {
  const { chats, busy } = useAnimatorChats();
  const { chat } = useStudioChat();
  return (
    <span data-testid="probe">
      {JSON.stringify({
        animator: chats[KEY]?.entries.map((entry) => entry.text) ?? null,
        busy: busy[KEY] ?? false,
        sceneInAnimators: busy[PROJECT] ?? null,
        scene: chat?.entries.length ?? null,
      })}
    </span>
  );
}
const probe = () => JSON.parse(screen.getByTestId('probe').textContent ?? '{}');

describe("an animator's chat in the window", () => {
  it('hears its own entries by its key, and the scene chat never takes them', async () => {
    render(<Probe />);
    await act(async () => {
      await loadAnimatorChat('wolf-walk');
    });
    tell(KEY, 'Drawing frame 5 again', true);
    expect(probe()).toMatchObject({
      animator: ['Drawing frame 5 again'],
      busy: true,
      scene: null,
    });
    // The control: the scene's own chat's entry is not the animator's.
    tell(PROJECT, 'The scene changed', true);
    expect(probe().animator).toEqual(['Drawing frame 5 again']);
    expect(probe().sceneInAnimators).toBeNull();
  });

  it("knows an animator is at work before its chat is opened, for the animation's card", () => {
    render(<Probe />);
    tell(KEY, '', true);
    expect(probe()).toMatchObject({ animator: null, busy: true });
  });

  it("sends with the animator's brief, which names its animation", async () => {
    await sendToAnimator('p1', 'wolf-walk', 'make the legs smoother');
    const [message] = bridge.studioAnimatorSend.mock.calls[0] as unknown as [
      { animation: string; text: string; brief: string },
    ];
    expect(message.animation).toBe('wolf-walk');
    expect(message.text).toBe('make the legs smoother');
    expect(message.brief).toContain(
      'YOU ARE THE ANIMATOR for the animation "wolf-walk"',
    );
    expect(message.brief).toContain('look_at_animation');
  });

  it("sends the scene chat's task to the animator it started, said to come from the scene's chat", () => {
    const stop = watchAnimatorStarts((task) => `From the scene: ${task}`);
    startListener?.({
      projectId: PROJECT,
      name: 'fox-trot',
      task: 'A fox trotting, 8 frames.',
    });
    const [message] = bridge.studioAnimatorSend.mock.calls[0] as unknown as [
      { animation: string; projectId: string; text: string; brief: string },
    ];
    expect(message).toMatchObject({
      animation: 'fox-trot',
      projectId: PROJECT,
      text: 'From the scene: A fox trotting, 8 frames.',
    });
    expect(message.brief).toContain('"fox-trot"');
    stop();
    expect(startListener).toBeUndefined();
  });
});

describe('the animator beside an opened animation', () => {
  it('opens its chat, says what it works on, and sends what the member writes to it', async () => {
    await act(async () => {
      await checkStudioChat();
    });
    render(<AnimatorChat projectId={PROJECT} name="wolf-walk" />);
    await act(async () => undefined);
    expect(bridge.studioAnimatorLoad).toHaveBeenCalledWith('wolf-walk');
    expect(
      screen.getByText('studio.animator.welcomeTitle {"name":"wolf-walk"}'),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'the tail is too stiff' },
    });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole('textbox').closest('form') as HTMLFormElement,
      );
    });
    expect(bridge.studioAnimatorSend).toHaveBeenCalledWith(
      expect.objectContaining({
        animation: 'wolf-walk',
        text: 'the tail is too stiff',
      }),
    );
  });

  it("asks its questions in its own chat, where the member answers them, and the scene's chat never shows them", async () => {
    await act(async () => {
      await checkStudioChat();
    });
    function SceneAsk() {
      const { ask } = useStudioChat();
      return <span data-testid="scene-ask">{ask?.id ?? 'none'}</span>;
    }
    render(
      <>
        <AnimatorChat projectId={PROJECT} name="wolf-walk" />
        <SceneAsk />
      </>,
    );
    await act(async () => undefined);
    const card = (projectId: string, id: string): TStudioChatAsk => ({
      id,
      projectId,
      kind: 'picture',
      why: 'The whale for the dive',
      prompt: 'A humpback, side on',
      width: 1024,
      height: 512,
      transparent: true,
    });
    const raise = (projectId: string, ask?: TStudioChatAsk) =>
      act(() => {
        askListeners.forEach((listener) => listener({ projectId, ask }));
      });
    // The control: the scene's own question stays in the scene's chat.
    raise(PROJECT, card(PROJECT, 'scene-1'));
    expect(screen.queryByText('A humpback, side on')).not.toBeInTheDocument();
    raise(PROJECT, undefined);

    raise(KEY, card(KEY, 'animator-1'));
    expect(screen.getByText('A humpback, side on')).toBeInTheDocument();
    expect(screen.getByTestId('scene-ask')).toHaveTextContent('none');
    fireEvent.click(
      screen.getByRole('button', { name: 'studioChat.ask.makeIt' }),
    );
    expect(bridge.studioChatAnswer).toHaveBeenCalledWith('animator-1', 'yes');
    // Main settles the question and takes the card down in this chat.
    raise(KEY, undefined);
    expect(screen.queryByText('A humpback, side on')).not.toBeInTheDocument();
  });

  it('says when it is at work, and stops when asked', async () => {
    await act(async () => {
      await checkStudioChat();
    });
    render(<AnimatorChat projectId={PROJECT} name="wolf-walk" />);
    await act(async () => undefined);
    tell(KEY, 'Looking at the walk', true);
    expect(
      screen.getByText('studio.animator.working {"name":"wolf-walk"}'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'studioChat.stop' }));
    expect(bridge.studioAnimatorStop).toHaveBeenCalledWith('wolf-walk');
  });
});
