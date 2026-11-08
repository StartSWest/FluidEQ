/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Claude's words in the chat (`ChatText.tsx`), and its fenced code drawn as
 * a block to copy (Ivan, 2026-11-07: "add formatted block on chat like for
 * copying"): the block whole with its blank lines, its language and a copy
 * button that copies exactly the code; a block still being written drawn as
 * one; and nothing in a reply ever read as HTML.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ChatText from '../../../renderer/studio/chat/ChatText';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

const writeText = jest.fn(async () => undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
});

const CODE =
  'uniform float uBass;\n\nvoid main() {\n  gl_FragColor = vec4(uBass);\n}';

it('draws a fenced block whole, with its language, and copies exactly its code', async () => {
  const { container } = render(
    <ChatText
      text={`Here it is:\n\n\`\`\`glsl\n${CODE}\n\`\`\`\n\nThen run \`npm run check\`.`}
    />,
  );
  const blocks = container.querySelectorAll('.studio-chat__code');
  expect(blocks).toHaveLength(1);
  expect(blocks[0].querySelector('figcaption')).toHaveTextContent('glsl');
  // The blank line inside stays inside: one block, not two paragraphs.
  expect(blocks[0].querySelector('pre')?.textContent).toBe(CODE);
  expect(screen.getByText('Here it is:').closest('p')).not.toBeNull();
  // Inline code is still inline, in its paragraph.
  expect(screen.getByText('npm run check').closest('p')).not.toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'studioChat.copy' }));
  });
  expect(writeText).toHaveBeenCalledWith(CODE);
  expect(
    screen.getByRole('button', { name: 'studioChat.copied' }),
  ).toBeInTheDocument();
});

it('draws a block still being written as a block, to the end of what has come', () => {
  const { container } = render(
    <ChatText text={'Writing:\n\n```js\nconst a = 1;\n\nconst b'} />,
  );
  expect(container.querySelector('.studio-chat__code pre')?.textContent).toBe(
    'const a = 1;\n\nconst b',
  );
  expect(container.querySelectorAll('p')).toHaveLength(1);
});

it('keeps a reply as text: markup in it is never drawn as HTML', () => {
  const { container } = render(
    <ChatText
      text={'```html\n<img src=x onerror=alert(1)>\n```\n\n<b>hi</b>'}
    />,
  );
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('b')).toBeNull();
  expect(container.querySelector('pre')).toHaveTextContent(
    '<img src=x onerror=alert(1)>',
  );
});
