# Karaoke translated lyrics — design

A language switcher on the karaoke lyric sheet. Pick a language the song does
not have yet, paste the lyrics in that language, and the Maker lays them over
the timing the original already has. The original stays on screen with its
word-level highlight; the translation reads underneath. Where the words do not
fit the melody, the editor says so, and the user fixes it by changing a word or
by moving the notes — both of which the Maker already does.

Date: 2026-08-25. Branch: `claude/karaokle-vocal-translation-95e45a`.

## 1. Why this exists

Two features share one mechanism.

The first is reading. A karaoke song in a language you do not speak is a
melody you can follow and words you cannot. A translation under the sung line
turns it into something you understand while it plays, and that is worth
shipping on its own — it needs no new model, no download, and no network.

The second is singing the song in another language. That is a much larger
feature, and it is not in this branch (§15). What matters here is that it
needs exactly the same thing underneath: a second set of words carrying the
first set's timing, fitted by hand to a shared melody. Building the reading
feature builds the hard, unglamorous half of the singing one, and gets it in
front of users years earlier.

The third reason is that the Maker is already the right shape for it. It is an
editor where a machine proposes and a person corrects — detected lyrics,
detected notes, aligned boundaries. A translation is one more column in a
surface that already works that way.

## 2. Scope

**In:** an alternate-language lyric sheet on the Maker project; a language
picker in the Maker and in the player; pasting or typing the translated text;
seeding each translated line's timing from the original; a per-line indicator
of how the syllables sit against the shared melody; both languages painted in
the player and in the Maker; per-language LRC and UltraStar export; a schema
version bump with the drafts that already exist on disk continuing to load.

**Out, deliberately:** machine translation of any kind — local model, cloud
call or imported translated LRC (§15); synthesising a sung vocal in the target
language (§15); deleting or replacing the original language sheet; word-level
highlight of an unfitted translation, which is not a scope cut but a
correctness one (§7); any change to how the melody is detected or stored.

## 3. Decisions already taken

| Question                    | Decision                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------- |
| How far it travels          | Full alternate: the player, the song model and both exporters carry the language   |
| Timing ownership            | Each language owns its own timings, seeded once from the original on create        |
| Later edits to the original | Do not propagate. The shared melody still does, because notes are not per-language |
| On screen                   | Both: original above with word highlight, translation below at line level          |
| Where the draft comes from  | The user pastes or types it. No translation model in this branch                   |
| The control                 | The app's `Dropdown`, never a native `<select>`                                    |
| Schema                      | `KARAOKE_MAKER_PROJECT_VERSION` 1 → 2, additive, v1 drafts load unchanged          |

## 4. What the subject actually is

The melody is already language-independent. `project.lyrics.lines` and
`project.melody.notes` are separate arrays, and nothing links a note to a
language. So the thing that must stay shared across languages is shared
already, by construction, and the thing that must differ — the words, and
where the word boundaries fall inside a line — is the only thing a translation
needs to carry.

That is the whole design in one sentence, and it is why this feature does not
require restructuring the project: a translated sheet is text plus token
timings, over a melody it does not own.

The constraint that shapes everything else is that **314 call sites across 24
files read `project.lyrics.lines`** — validation, both exporters, the canvas
painters, the aligner, the AI helpers, the keyboard handlers. Any design in
which that expression stops meaning "the sung original" is a design that
touches all of them.

## 5. Architecture

```
project.lyrics.lines          the sung original. Unchanged. 314 readers keep working.
project.lyrics.translations[] new. One IKaraokeMakerLyricSheet per added language.
project.melody.notes          shared by every language. Unchanged.

  paste text ──► distributor ──► IKaraokeMakerLyricSheet ──► project.lyrics.translations
                     ▲                                              │
              melody.notes ─────────► fit check ◄───────────────────┘
                                          │
                                          ▼
                              per-line syllable/note delta
                                    (painted, not stored)

  karaokeMakerProjectToSong(project, audio, assets, { language }) ──► IKaraokeSong ──► player, LRC, UltraStar
```

The switcher changes a **view**, not the project. `lyrics.lines` is never
reassigned, never swapped, never shadowed. Choosing a language selects which
sheet the painter and the exporter read; the project's spine does not move.

## 6. The data model — `src/common/karaoke/makerProject/model.ts`

```ts
/**
 * One language's words for a song.
 *
 * No notes here. The melody is shared across every language and already lives
 * in `project.melody`; languages differ only in the words and in where the
 * word boundaries fall, so a sheet carries tokens and nothing else.
 */
export interface IKaraokeMakerLyricSheet {
  language: string;
  source: TKaraokeMakerSource;
  lines: IKaraokeMakerLine[];
}
```

added to the project as:

```ts
lyrics: {
  language?: string;                        // unchanged: the original
  source: TKaraokeMakerSource;              // unchanged
  lines: IKaraokeMakerLine[];               // unchanged: the sung original
  translations?: IKaraokeMakerLyricSheet[]; // new, optional, additive
}
```

`TKaraokeMakerSource` gains one member, `'translation-seed'`, and that member
joins the array in `karaokeMakerSourceIsAutomatic` (`model.ts:165`). The text
is user-authored but the timings were derived from the original, and derived
timings must stay replaceable by the fit tools. Marking them `'manual'` would
tell the aligner never to touch a timing no human ever chose.

`safeSource` in `project.ts` accepts the new member, and the parse guard grows
a `translations` branch that sanitises each sheet with the same line and token
sanitisers the original already goes through — length caps included, since this
text arrives by paste.

**Persistence.** `KARAOKE_MAKER_PROJECT_VERSION` goes to 2. `project.ts:212`
rejects any version that is not current, so the alternative would be leaving
the version at 1 and having an older build silently drop a user's translations
on its next save. A refusal the user can see beats data loss they cannot.
Migration is the empty case: a v1 draft has no `translations` key and is
already a valid v2.

## 7. Seeding — the distributor

New module, `src/common/karaoke/makerProject/translationSeed.ts`, pure and
testable, taking the original's lines plus pasted text and returning a sheet.

1. Split the pasted text into non-empty lines.
2. Walk the original's lines. **Section lines** (`karaokeMakerLineIsSection`)
   are structure, not lyrics: they copy through verbatim and consume no pasted
   line.
3. Match the remaining lines **by index**. Counts must agree; see §9 for what
   happens when they do not.
4. Each translated line inherits its partner's `startMs` and `endMs`.
5. Tokenise with `karaokeMakerLineTokens`, which already knows that Chinese and
   Japanese do not put spaces between tokens — relevant here in a way it is not
   for the original, because a translation _target_ may be an unspaced script
   even when the source is not.
6. Split each token with `splitKaraokeWordSyllables(word, targetLanguage)` and
   distribute the line's span across the line's total syllable count,
   proportionally, to get each token's `startMs`/`endMs`.
7. Leave `timingLocked` unset on every token.

Step 7 is the contract that makes the manual fixing work: the existing comment
on that field reads _"user-authored timing that automatic alignment must never
replace"_, so the first time the user drags a boundary in the translation their
timing is protected from everything that runs afterwards. Nothing new is needed
for this; it just must not be fought.

The seed is **plausible and never correct**. Proportional syllable division
assumes every syllable takes equal time, which no singer has ever done. It
exists to put the words near their notes so the user is correcting rather than
starting.

**Why word-level highlight of an unfitted translation is wrong, not just
rough.** Word order differs between languages. Highlighting the third word of a
Spanish line at the moment the third English word was sung is incorrect more
often than it is right, and it is confidently incorrect, which is worse than
showing nothing. A sheet the user has not fitted therefore reports
`timingPrecision: 'line'`, and the painter draws no per-word highlight for it.
As the user fits syllables the precision rises to `'word'` and `'syllable'`,
which the player already understands.

## 8. The fit check

Also in `translationSeed.ts`, and painted rather than stored: for each line,
count the syllables in the translated line, count the notes in `melody.notes`
that overlap that line's span, and report the delta.

That is the whole feature the user asked for — _"user sees the errors and
replaces the words so they match"_ — and it needs no model, no audio and no
synthesis. It is also the fastest possible feedback: it updates as they type.

Two fixes are available for a mismatch and both already exist in the Maker:
change the words, or change the notes. When a line runs one syllable long,
splitting a held note in two (`splitKaraokeMakerWordIntoSyllables`,
`karaokeMakerTokenBoundaryLimits`) is often better than hunting for a shorter
word — which is what people who localise songs actually do.

## 9. Reading a chosen language

`karaokeMakerProjectToSong` gains an optional third parameter:

```ts
karaokeMakerProjectToSong(project, audioAsset, sourceAssets, { language });
```

With no options it returns exactly what it returns today — the original — which
is the regression guard under every existing caller. With a language it swaps
that sheet's lines into `IKaraokeSong.lines` and sets `meta.language`.

`makerExport.ts` and `makerExportUltraStar.ts` take the same option. UltraStar
carries one `#LANGUAGE` header, so a translated export is a separate file
describing itself as that language, which is what an UltraStar player expects.
LRC has no language header at all; the exported file is simply the translated
sheet.

`validateKaraokeMakerProject` continues to validate the original. A translation
is not required to be complete — an empty one is a normal intermediate state —
so it contributes warnings, never errors.

## 10. UI — the Maker

**Both lyric surfaces are canvas, not DOM.** `KaraokeLyrics.tsx` paints into
`<canvas className="karaoke-lyrics__canvas">` and the Maker paints through
`makerCanvas/paintLyrics.ts`. Adding a second row of text is therefore a paint
pass with a re-budgeted line height, not a CSS row, and it is the largest piece
of work in this branch.

It is also a defect this project has shipped before, in this exact shape: three
waveforms crushed into a 27px strip. **The translation row takes its own
measured height out of the lane budget**: the lane grows to make room, and only
where it cannot grow — the small window size — do the original's rows step down
to a smaller size, never the translation's. Verified in the running window
(§14), because no test can see it.

The picker is `widgets/Dropdown`, in `KaraokeMakerToolbar.tsx`, on the toolbar
and not inside a popover: results and controls belong on the surface where the
work happens. `LanguagePicker.tsx` records why a native `<select>` was tried
here and removed — it "refuse[d] to look like anything else in the app" — and
that decision carries. Two rules come with reusing the pattern: each language
**names itself** (`Español`, not `Spanish`), because someone looking for their
language cannot necessarily read the one the app is in; and each option carries
`lang` so Chromium resolves the right face per script.

Pasting reuses `KaraokeMakerLyricsDialog`, which is already "paste words in,
then see how they landed", with a target language on it. Its own doc comment
admits to 245 lines of JSX in a single return and calls itself the largest
thing in the component, so the seam gets taken here rather than deferred: the
paste view and the word-list view separate as part of this work.
`KaraokeMaker.tsx` is 2294 lines and holds the switcher state through an
extracted hook, not another `useState` on the pile.

When counts disagree, the dialog shows both numbers and renders the original's
numbered lines beside the textarea so they can be lined up. This is the error
that will happen on nearly every first paste; it is a working surface, not an
alert.

## 11. UI — the player

The same `Dropdown`, beside the lyrics rather than inside the transport menu. A
language switched while singing cannot be two clicks deep.

The painter draws the original at its existing sizes with word highlight
intact, and the translated line underneath, quieter and smaller, at line level
until the sheet is fitted. A song with no translations paints exactly as it
does today and shows no picker.

## 12. i18n

Language _names_ come from `Intl.DisplayNames`, which Chromium provides, asked
for the endonym. Hand-writing a name table would mean one list per locale — ten
lists to drift apart — for a string the platform already knows.

Everything else — the picker's label and aria text, the dialog's target-language
field, the count-mismatch message with its two numbers, the empty state, the
fit indicator's label — is new user-facing text and ships in all ten locales in
the same commit.

## 13. Files

**New**

- `src/common/karaoke/makerProject/translationSeed.ts` — the distributor and the
  fit check. Pure.
- `src/renderer/karaoke/useMakerTranslations.ts` — switcher state and the
  add/remove operations, extracted so `KaraokeMaker.tsx` does not grow.

**Changed**

- `makerProject/model.ts` — `IKaraokeMakerLyricSheet`, `translations`,
  `'translation-seed'`, version 2.
- `makerProject/project.ts` — parse guard, `safeSource`, version check.
- `makerProject/song.ts` — the `{ language }` option on `projectToSong`.
- `makerExport.ts`, `makerExportUltraStar.ts` — the same option.
- `KaraokeMakerToolbar.tsx` — the picker.
- `KaraokeMakerLyricsDialog.tsx` — target language, mismatch surface, and the
  split into paste view and word-list view.
- `makerCanvas/paintLyrics.ts` — the second row, with its own height budget.
- `KaraokeLyrics.tsx` — the second row and the player's picker.
- `KaraokeMaker.tsx` — wiring only; state lives in the new hook.
- Ten locale files under `src/common/i18n/*/karaoke.ts`.

## 14. Testing

Run after the change is on screen and Ivan is satisfied with it, per the house
order — not during.

- **The distributor gets hand-computed boundary assertions.** A known line, a
  known span, syllable counts worked out by hand, and the exact millisecond
  boundaries asserted. This project has already lost a day to a null test that
  passed perfectly because the code under it returned zero for every input; a
  proportional distributor fails the same way and would pass the same way.
  A positive control is not optional here.
- Section lines survive a paste and consume no pasted line.
- A count mismatch is reported with both counts and produces no sheet — it is
  never absorbed by truncating or padding.
- Unspaced-script target: a Japanese translation tokenises per character and
  distributes without inventing spaces.
- **Regression guard:** `karaokeMakerProjectToSong(project, assets)` with no
  options produces output identical to today's. That is the net under all 314
  call sites.
- v2 round-trips through JSON with its translations; a v1 draft loads clean
  with none.
- Per-language LRC and UltraStar export, including the `#LANGUAGE` header.
- Adding a duplicate language, or the original's own language, is rejected.

## 15. Risks, and what only a real launch can confirm

Tests query by role. They cannot see size, colour, placement or taste, and
every UI defect that shipped in this project passed the whole suite. These go
to CDP on `127.0.0.1:9222` against the running window:

- **The translation row's height in both canvas lanes.** Probe the painted
  pixels, not the intent. This is the 27px strip waiting to happen.
- Whether the `Dropdown` in the Maker toolbar and in the player matches the
  controls beside it — computed styles read in the live window, not reasoned
  about.
- The whole thing at the small window size the responsive screenshots cover,
  where a second row of text has the least room to be added.
- Whether a translated line at line-level precision reads as deliberately quiet
  or as broken.

Two risks that are not visual:

- **The line-count mismatch is the feature's first impression.** Nearly every
  first paste will hit it. If that surface is an alert rather than a place to
  work, the feature will read as fussy and be abandoned there.
- **The seed's quality sets the amount of manual work.** Proportional syllable
  division may land far enough off on melismatic songs that fixing by hand is
  slower than typing timings from scratch. That is measurable on a real song
  before any of the UI is built, and is worth measuring early.

## 16. Follow-ups, not in this branch

- **A machine draft.** A local translation model downloaded on demand, a cloud
  call for people who opt in, or importing an existing translated LRC. The data
  model above accommodates all three without changing: they only produce the
  text that is pasted today.
- **Singing it.** A synthesised guide vocal in the target language, riding the
  existing guide-vocal fader over the instrumental. The route that fits an edit
  loop is a small permissive ONNX TTS forced onto the shared note lane, re-sung
  one line at a time; heavier score-driven synthesis cannot answer fast enough
  to sit inside an edit. This depends on the fit check in §8 having produced
  syllables that actually line up, which is why it comes after.
- **Making a translation the primary sheet**, so it can be edited by the tools
  that currently assume the original. Blocked on the 314 call sites, and worth
  doing only if users ask to author _in_ the translation rather than fit it.
