/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Typing in the Studio chat's box beside its model picker never reloads the
 * window. Ivan's did, three times (2026-11-08 00:58 and 01:31, 11-09
 * 00:33), on React's "Maximum update depth exceeded": the picker's Dropdown
 * reset its paging in an effect that every keystroke's render set off (the
 * picker builds its options inline), each run scheduling one more render;
 * React 19 counts a commit that leaves work like that behind as nested, and
 * keystrokes that arrive faster than those renders - a busy window delivers
 * its queued input in a burst - pushed the count past 50.
 *
 * A burst of input events with nothing in between, outside `act`, as the
 * window gets them: the draft store, a box typed into, and a Dropdown with
 * an inline list, as the chat's composer has them.
 */

import { render, screen } from '@testing-library/react';
import {
  resetChatDrafts,
  setChatDraftText,
  useChatDraft,
} from '../../../renderer/studio/chat/chatDraftStore';
import Dropdown from '../../../renderer/widgets/Dropdown';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

const PROJECT = 'project';

function Composer() {
  const draft = useChatDraft(PROJECT);
  return (
    <>
      <textarea
        aria-label="message"
        value={draft.text}
        onChange={(event) => setChatDraftText(PROJECT, event.target.value)}
      />
      <Dropdown
        name="model"
        // Inline, as the chat's model picker builds it: a new array of the
        // same options every render.
        options={['default', 'opus', 'sonnet'].map((value) => ({
          value,
          label: value,
          display: value,
        }))}
        value="default"
        isDisabled={false}
        handleChange={() => undefined}
      />
    </>
  );
}

const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
const wasActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
let errors: string[];
const onError = (event: ErrorEvent) => {
  errors.push(event.message);
  event.preventDefault();
};

beforeEach(() => {
  resetChatDrafts();
  errors = [];
  window.addEventListener('error', onError);
});
afterEach(() => {
  window.removeEventListener('error', onError);
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = wasActEnvironment;
});

/** One keystroke as the window delivers it: the value, then `input`. */
const type = (box: HTMLTextAreaElement, text: string) => {
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  setValue?.call(box, text);
  box.dispatchEvent(new Event('input', { bubbles: true }));
};

it('takes a burst of keystrokes without React counting them as a loop', () => {
  render(<Composer />);
  const box = screen.getByLabelText<HTMLTextAreaElement>('message');
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;

  const sentence = 'the reindeer walks wrong, its back legs jump on every step';
  for (let typed = 1; typed <= 80; typed += 1) {
    type(box, sentence.repeat(2).slice(0, typed));
  }
  // React throws inside the keystroke that passes the limit: the burst is
  // the whole test.
  expect(errors).toEqual([]);
  expect(box.value).toBe(sentence.repeat(2).slice(0, 80));
});
