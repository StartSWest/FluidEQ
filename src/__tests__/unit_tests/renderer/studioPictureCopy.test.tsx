/**
 * Copying a picture from the Studio's previews (Ivan, 2026-11-09: "I need to
 * be able to copy image from previews too"): the viewer's Copy and Ctrl+C,
 * the previews' right-click menu, and the word that says how it went.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import StudioPictureCopyButton from '../../../renderer/studio/StudioPictureCopyButton';
import useStudioPictureMenu from '../../../renderer/studio/useStudioPictureMenu';

const mockCopy = jest.fn<Promise<void>, [unknown]>();
jest.mock('../../../renderer/studio/pictureClipboard', () => ({
  copyPicture: (source: unknown) => mockCopy(source),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const SOURCE = { src: 'blob:atlas' };
const REGION = { id: 'fish', x: 4, y: 8, width: 64, height: 32, rotated: true };

/** A copy the test lets finish, or fail, when it says. */
const held = () => {
  let finish: () => void = () => undefined;
  let fail: () => void = () => undefined;
  mockCopy.mockImplementationOnce(
    () =>
      new Promise<void>((resolve, reject) => {
        finish = resolve;
        fail = () => reject(new Error('the clipboard refused'));
      }),
  );
  return {
    finish: () => act(async () => finish()),
    fail: () => act(async () => fail()),
  };
};

/**
 * The word's moment ends, as its hold animation does. jsdom has no
 * AnimationEvent, so the name is put on a plain one, as the Karaoke tests do.
 */
const wordEnds = () => {
  const event = new Event('animationend', { bubbles: true });
  Object.defineProperty(event, 'animationName', {
    value: 'studio-picture-copied',
  });
  act(() => {
    screen.getByRole('status').dispatchEvent(event);
  });
};

beforeEach(() => {
  mockCopy.mockReset();
  mockCopy.mockResolvedValue(undefined);
});

describe('the viewer’s Copy', () => {
  it('copies the picture shown, says so while it works and when it is done, and goes back', async () => {
    const copy = held();
    render(<StudioPictureCopyButton source={SOURCE} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockCopy).toHaveBeenCalledWith(SOURCE);
    // From the press: a large picture takes up to a second.
    expect(button.textContent).toBe('studio.picture.copying');
    expect(button.getAttribute('aria-busy')).toBe('true');
    // A second press while it works copies nothing more.
    fireEvent.click(button);
    expect(mockCopy).toHaveBeenCalledTimes(1);

    await copy.finish();
    expect(button.textContent).toBe('studio.picture.copied');
    wordEnds();
    expect(button.textContent).toBe('studio.picture.copy');
  });

  it('says it could not copy when the clipboard refuses', async () => {
    const copy = held();
    const printed = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    render(<StudioPictureCopyButton source={SOURCE} />);
    fireEvent.click(screen.getByRole('button'));
    await copy.fail();
    expect(screen.getByRole('button').textContent).toBe(
      'studio.picture.copyFailed',
    );
    expect(printed).toHaveBeenCalledTimes(1);
  });

  it('copies on Ctrl+C, and leaves Ctrl+C to a selection or another shortcut', async () => {
    render(
      <>
        <p>rock</p>
        <StudioPictureCopyButton source={SOURCE} />
      </>,
    );
    // The control: Ctrl+Shift+C is somebody else's.
    fireEvent.keyDown(document, { key: 'c', ctrlKey: true, shiftKey: true });
    expect(mockCopy).not.toHaveBeenCalled();

    // A name selected is copied as text, as everywhere else.
    const range = document.createRange();
    range.selectNodeContents(screen.getByText('rock'));
    window.getSelection()?.addRange(range);
    fireEvent.keyDown(document, { key: 'c', ctrlKey: true });
    expect(mockCopy).not.toHaveBeenCalled();
    window.getSelection()?.removeAllRanges();

    const pressed = fireEvent.keyDown(document, { key: 'c', ctrlKey: true });
    expect(pressed).toBe(false);
    expect(mockCopy).toHaveBeenCalledWith(SOURCE);
    await act(async () => undefined);
  });
});

function Previews() {
  const { openMenu, menu } = useStudioPictureMenu();
  const [shown] = useState(SOURCE);
  return (
    <>
      <span
        data-testid="piece"
        onContextMenu={(event) => openMenu(event, { ...shown, region: REGION })}
      />
      <span data-testid="elsewhere" />
      {menu}
    </>
  );
}

describe('a preview’s right click', () => {
  it('offers Copy image, copies the piece at its size, and closes once it has said so', async () => {
    render(<Previews />);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.contextMenu(screen.getByTestId('piece'));
    const item = await screen.findByRole('menuitem');
    expect(item.textContent).toBe('studio.picture.copy');
    // Opened from the keyboard's menu key as well: Enter copies.
    expect(document.activeElement).toBe(item);

    fireEvent.click(item);
    expect(mockCopy).toHaveBeenCalledWith({ ...SOURCE, region: REGION });
    await act(async () => undefined);
    expect(screen.queryByRole('menu')).not.toBeNull();
    expect(item.textContent).toBe('studio.picture.copied');

    wordEnds();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on a press elsewhere without copying', async () => {
    render(<Previews />);
    fireEvent.contextMenu(screen.getByTestId('piece'));
    await screen.findByRole('menuitem');
    fireEvent.mouseDown(screen.getByTestId('elsewhere'));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(mockCopy).not.toHaveBeenCalled();
  });
});
