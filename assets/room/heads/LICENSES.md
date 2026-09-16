# The room's heads

The three files beside this one are the head the Room renders through: a
ring of 24 directions at 0° elevation, two ears each, at 44.1, 48 and 96 kHz.
They are built by `.erb/scripts/build-room-heads.ts` and never edited by hand.

## MIT KEMAR (`small.txt`, `medium.txt`, `large.txt`)

Derived from the compact set of _HRTF Measurements of a KEMAR Dummy-Head
Microphone_, Bill Gardner and Keith Martin, MIT Media Laboratory, 1994
(https://sound.media.mit.edu/resources/KEMAR.html).

> This data is Copyright 1994 by the MIT Media Laboratory. It is provided free
> with no restrictions on use, provided the authors are cited when the data is
> used in any research or commercial application.

`medium.txt` is the measured head; `small.txt` and `large.txt` are the same
responses scaled 6% shorter and 6% longer in time, one measured head standing
in for three sizes.

## Not included

HeSuVi's virtualisation files are recordings of other companies' products
(Dolby, DTS, Razer and others) and are not used here in any form.
