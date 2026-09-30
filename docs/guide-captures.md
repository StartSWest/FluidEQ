# User guide capture sources

The guide uses real FluidEQ interface captures, not generated UI artwork.

- Every picture but the Plus ones was taken again from the running FluidEQ 2.0
  development window on September 29, 2026, in English, with the window's
  Brightness at the middle of its slider, so one set reads on a dark window
  and on a light one:
  - the whole-window pictures at 2560 × 1392, one pixel per CSS pixel. Online
    Media is 1776 × 1392, with the web view laid into its rectangle, because a
    picture of the window leaves that rectangle empty; it shows NASA's
    channel (United States government work, with no advertising in it),
    signed out;
  - the pictures of one part of the window — the header, the rails, a page's
    card, a dialog or a menu — cut from the same window at the same scale;
  - the Compact player from its harness, which mounts the real player and its
    stylesheets, 480 CSS pixels wide (560 for the folded strip, which gives
    up its EQ key below 520) at two device pixels each.

  The numbered boxes are each control's own rectangle, measured in the same
  window at the same moment, and live in `src/common/helpChapters/`: a new
  capture of any of these files needs its boxes measured again.

- The Share Audio picture's connection code and network addresses are
  blurred.
- `22` to `29` and `31`, the Plus pictures, are from FluidEQ 1.7 and are to
  be taken again from a window signed in to Plus.
- `02`, `07` and `10` are no longer in the guide; this repository's README
  still shows them.

The guide identifies screenshots as illustrations whose language, appearance
and control positions may differ from the installed version. Settings visible
in the examples are not recommended presets. New captures should be checked
for credentials, personal information and private media before distribution.
