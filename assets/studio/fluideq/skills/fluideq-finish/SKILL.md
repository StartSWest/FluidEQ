---
name: fluideq-finish
description: The steps that finish any change to a FluidEQ scene - the three views checked, motion watched, frame sheets made animations, and the update note written so it is there when the member publishes. Use at the end of every reply that changed a scene, before telling the member it is done, and whenever the member says "done?", "finish", "publish", "update notes", "what's new" or "release notes".
---

# Finishing a change to a FluidEQ scene

A change is finished when a listener would see it right everywhere and the
member can publish it without doing your part for you. Four steps, in this
order, every time something a listener could notice changed. Skip a step
only when it cannot apply, never because the change looked small.

## 1. The three views

`look_at_views` - STANDARD, ULTRA WIDE and MOBILE in one answer. Judge each.
The subject whole in all three; nothing lost off the ends of the ultra
wide; nothing black and no hard line under the Compact player's panel.
(The fluideq-views skill has what right looks like in each, and how to
carry a scene on past its panel.)

If the change touched light or colour, look again with
`sliders: { "daylight": 0 }` and with `100`: night really dark, day really
bright, in all three.

## 2. Motion

If the change was about how something moves - or added something that
moves - `watch_scene` it, cut close round the thing: the right direction,
even where it should be even, moving at all. One picture never shows this.
(The fluideq-motion skill has how to choose the frames and their spacing.)

Watch it in silence too when it should rest: `sound: "silence"`.

## 3. Animations

A sheet of frames is an animation, never a picture. If you made or changed
frames, they went through `build_sheet` (or `pose_sheet`), `look_at_animation`
has been called on the result, and the scene plays it as that animation.
If `pack_artwork` told you it found a sheet packed as a picture and made it
an animation, you have written it again with `build_sheet` and
`replace: true` with its real frame count, fps, loop and ground.
(The fluideq-animation skill has the rest.)

## 4. The update note - always last, never skipped

Write what changed into `studio-notes.json`, beside the scene, as
`"whatsNew"`.

- **One line**, at most 280 characters.
- **As a listener would say it**: "the fish now swim left and their tails
  beat with the hats", "the night sky is properly dark", "the scene fills
  the space under the player on mobile". Never the code's words - not "fixed
  the uv clamp", not a file name.
- **Everything since the version the Gallery has.** When a line is already
  there from an earlier request, fold this change into it and keep it one
  line; do not replace what it already says.
- **Change nothing else in that file.** It also holds the member's
  description. Read it, set that one key, write it back. If the file is not
  there, make it with just that key.
- **Leave `version` in pack.json alone.** FluidEQ sets it when the member
  publishes.

FluidEQ puts that line in the "What's new" box of the Publish dialog and
will not publish an update without one. By then the member has forgotten
what you changed; you have not. A reply that changed the scene and left
the note as it was is not finished.

A new scene that has never been published needs no note.

## Then answer

Two to four plain sentences: what the member will now see and hear. Not
the steps above, not the pictures, not the numbers - unless they ask.

If any step showed a fault you could not fix, say which and what it looks
like. Never say done over a view you did not look at.
