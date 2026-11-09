/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A picture from the chat drawn on and attached (Ivan, 2026-11-09: "I should
 * be able to draw also on zoomed pic inside the chat and attach them to the
 * chat"): the chat's own sketch opened on the picture at the viewer's closer
 * look, its button attaching the picture through the door a pasted picture
 * comes in by. A picture's header is read before anything decodes it. Each
 * rule beside its control.
 */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import type { IZoomView } from '../../../renderer/studio/pictureZoom';
import type { IChatPicture } from '../../../renderer/studio/chat/chatPictureList';
import StudioChatPictureDraw, {
  chatPictureBytes,
} from '../../../renderer/studio/chat/StudioChatPictureDraw';
import { jpegHeader, pngHeader } from '../../utils/pictureHeaders';

const mockSketchProps: Array<Record<string, unknown>> = [];
const mockPictureIn = jest.fn();

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));
jest.mock('../../../renderer/studio/chat/StudioChatSketch', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockSketchProps.push(props);
    return <div data-testid="sketch" />;
  },
}));
jest.mock('../../../renderer/studio/chat/chatPictureIn', () => ({
  chatPictureIn: (blob: Blob) => mockPictureIn(blob),
}));

const toDataUrl = (bytes: Uint8Array, type: string) =>
  `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;

/** A Blob's bytes, read as jsdom can: its Blob has no `arrayBuffer`. */
const bytesOf = (blob: Blob) =>
  new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

const JPEG = jpegHeader(320, 180);
const SRC = toDataUrl(JPEG, 'image/jpeg');

beforeEach(() => {
  mockSketchProps.length = 0;
  mockPictureIn.mockReset();
});

describe('a chat picture’s bytes', () => {
  it('are read from a JPEG or PNG data URL', () => {
    expect(chatPictureBytes(SRC)).toEqual(JPEG);
    const png = pngHeader(240, 240);
    expect(chatPictureBytes(toDataUrl(png, 'image/png'))).toEqual(png);
  });

  it('are refused when the header says the picture decodes too large', () => {
    const bomb = jpegHeader(40000, 40000);
    expect(chatPictureBytes(toDataUrl(bomb, 'image/jpeg'))).toBeUndefined();
  });

  it('are refused from anything that is not a picture’s data URL', () => {
    expect(chatPictureBytes('https://example.com/look.jpg')).toBeUndefined();
    expect(chatPictureBytes(toDataUrl(JPEG, 'image/gif'))).toBeUndefined();
    expect(chatPictureBytes('data:image/jpeg;base64,%%%')).toBeUndefined();
  });
});

describe('a chat picture drawn on and attached', () => {
  const picture: IChatPicture = {
    key: 'k',
    name: 'Looked at the scene',
    src: SRC,
    cutOut: false,
  };
  const view: IZoomView = { scale: 3.32, x: -40, y: 12 };
  const lastSketch = () => mockSketchProps[mockSketchProps.length - 1];

  it('opens the chat’s sketch on the picture at the viewer’s closer look, to attach', () => {
    render(
      <StudioChatPictureDraw
        picture={picture}
        openingView={view}
        onBack={jest.fn()}
        onAttach={jest.fn()}
      />,
    );
    expect(screen.getByTestId('sketch')).toBeInTheDocument();
    expect(lastSketch().image).toEqual(JPEG);
    expect(lastSketch().openingView).toBe(view);
    expect(lastSketch().doneLabel).toBe('studioChat.sketch.attach');
  });

  it('attaches the drawn picture as the message box keeps a picture', async () => {
    const onAttach = jest.fn();
    const kept = new Uint8Array([1, 2, 3]);
    mockPictureIn.mockResolvedValue(kept);
    render(
      <StudioChatPictureDraw
        picture={picture}
        openingView={undefined}
        onBack={jest.fn()}
        onAttach={onAttach}
      />,
    );
    const drawn = new Uint8Array([9, 9, 9]);
    await act(async () => {
      (lastSketch().onDone as (image: Uint8Array) => void)(drawn);
    });
    // Through the door a pasted picture comes in by, never handed on raw.
    expect(mockPictureIn).toHaveBeenCalledTimes(1);
    const blob = mockPictureIn.mock.calls[0][0] as Blob;
    expect(await bytesOf(blob)).toEqual(drawn);
    expect(onAttach).toHaveBeenCalledWith(kept);
  });

  it('goes back to the viewer when the drawn picture cannot be kept', async () => {
    const onBack = jest.fn();
    const onAttach = jest.fn();
    mockPictureIn.mockResolvedValue(undefined);
    render(
      <StudioChatPictureDraw
        picture={picture}
        openingView={undefined}
        onBack={onBack}
        onAttach={onAttach}
      />,
    );
    await act(async () => {
      (lastSketch().onDone as (image: Uint8Array) => void)(new Uint8Array([1]));
    });
    expect(onAttach).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });

  it('opens no sketch on a picture whose header refuses it, and goes back', () => {
    const onBack = jest.fn();
    render(
      <StudioChatPictureDraw
        picture={{
          ...picture,
          src: toDataUrl(jpegHeader(40000, 40000), 'image/jpeg'),
        }}
        openingView={undefined}
        onBack={onBack}
        onAttach={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('sketch')).toBeNull();
    expect(onBack).toHaveBeenCalled();
  });

  it('control: a picture whose header it reads opens and nothing goes back', () => {
    const onBack = jest.fn();
    render(
      <StudioChatPictureDraw
        picture={picture}
        openingView={undefined}
        onBack={onBack}
        onAttach={jest.fn()}
      />,
    );
    expect(screen.getByTestId('sketch')).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
  });
});
