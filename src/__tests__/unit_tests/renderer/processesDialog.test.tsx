/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Processes list asks for new figures once each answer has reached a
 * frame, instead of on a one-second timer: one request in flight, the next
 * sent from `requestAnimationFrame`, so it keeps up while looked at and stops
 * by itself where no frames run. What is held here is the chain — it goes on
 * after a failed answer, and it ends when the dialog closes.
 */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import type { IAppProcess } from '../../../main/ipc/processes';
import ProcessesDialog from '../../../renderer/components/ProcessesDialog';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const ROWS: IAppProcess[] = [
  { pid: 11, role: 'window', memoryMb: 300, cpuPercent: 2 },
  {
    pid: 12,
    role: 'models',
    memoryMb: 900,
    cpuPercent: 0,
  },
];

let frames: FrameRequestCallback[];
let appProcesses: jest.Mock<Promise<IAppProcess[]>, []>;

/** Runs the frame the chain asked for, and lets its request settle. */
const nextFrame = async () => {
  const queued = frames;
  frames = [];
  await act(async () => {
    queued.forEach((callback) => callback(performance.now()));
  });
};

beforeEach(() => {
  frames = [];
  appProcesses = jest.fn(async () => ROWS);
  jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback) => frames.push(callback));
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
    frames = [];
  });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { appProcesses } },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('names the karaoke models by what they do', async () => {
  await act(async () => {
    render(<ProcessesDialog onClose={jest.fn()} />);
  });
  expect(screen.getByText('app.processes.name.models')).toBeInTheDocument();
  expect(screen.getByText('app.processes.what.models')).toBeInTheDocument();
});

it('asks again once each answer is in, one request at a time', async () => {
  await act(async () => {
    render(<ProcessesDialog onClose={jest.fn()} />);
  });
  expect(appProcesses).toHaveBeenCalledTimes(1);
  // Nothing more until the frame the answer asked for runs.
  expect(frames).toHaveLength(1);
  await nextFrame();
  expect(appProcesses).toHaveBeenCalledTimes(2);
  await nextFrame();
  expect(appProcesses).toHaveBeenCalledTimes(3);
});

it('goes on after an answer that failed', async () => {
  appProcesses.mockRejectedValueOnce(new Error('window going away'));
  await act(async () => {
    render(<ProcessesDialog onClose={jest.fn()} />);
  });
  expect(frames).toHaveLength(1);
  await nextFrame();
  expect(appProcesses).toHaveBeenCalledTimes(2);
  expect(screen.getByText('app.processes.name.models')).toBeInTheDocument();
});

it('stops asking when the dialog closes', async () => {
  let answer: (rows: IAppProcess[]) => void = () => undefined;
  appProcesses.mockImplementationOnce(
    () =>
      new Promise<IAppProcess[]>((resolve) => {
        answer = resolve;
      }),
  );
  const view = render(<ProcessesDialog onClose={jest.fn()} />);
  view.unmount();
  await act(async () => {
    answer(ROWS);
  });
  // The answer that arrived after closing asks for no frame.
  expect(frames).toHaveLength(0);
  expect(appProcesses).toHaveBeenCalledTimes(1);
});
