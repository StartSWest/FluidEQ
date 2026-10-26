# FluidEQ organic campaign

An organic Facebook campaign for October 26 through December 25, 2026. It
contains 36 feed posts, 25 Stories, nine three-image guides, four double-sided
6 x 4 inch postcards and four US Letter flyers. Every creative uses the real
FluidEQ icon, illustrative EQ curves and a headphone-profile badge.

The first two days describe the current public app. Upcoming features use
future tense. November 1 is only a planning assumption for 2.1; a public
release and installer must be verified before publishing availability claims.
The campaign includes evergreen replacements in feed and Story dimensions.
The core EQ is free; optional Plus content is labeled separately. The owner
explicitly ruled out paid ads, boosts, subscriptions and purchases.

## Deliverables and rebuild

Delivery files live in the conversation's `outputs` folder under
`FluidEQ-Marketing-Kit`. The ZIP is the handoff; build previews and runtime
receipts are delivery evidence, not application source.

Use the bundled Python, Node and node_modules paths returned by Codex's
workspace-dependency tool. Create a local node_modules junction to that
bundled library directory; do not install dependencies into this repository.
Run from the repository root, in order:

1. `build_campaign.py` with bundled Python.
2. `render_campaign.py` with bundled Python.
3. `build_schedule.mjs` with bundled Node.
4. Inspect every contact sheet and each workbook tab under the build previews.
5. `package_campaign.py` with bundled Python after review.

The PDF and spreadsheet skill operation markers are run once before authoring
their respective artifact types. Postcards and flyers have 0.125 inch bleed
and explicit TrimBoxes. Their images are RGB; a print shop can supply a CMYK
press proof if needed. QR codes link to the public website. Social sizes are
1080 x 1350 for the feed and 1080 x 1920 for Stories.

The spreadsheet includes the prepared schedule, copy and a blank weekly
review. Initial posting slots are tests, not measured audience activity.
Observed clicks and reach must remain distinct from confirmed downloads.

## Publishing

Only publish to the FluidEQ Page, numeric ID `1348072861720283`, using Meta's
built-in organic scheduler. Never publish to Servio or a personal profile.
Keep promotion and ad-conversion controls off. Do not buy or connect services.
Check the visible queue before creating a post and verify its receipt after
scheduling. A prepared spreadsheet row is not evidence of a queued post.

The delivery `schedule/publishing-ledger.json` is the runtime record. It must
contain the campaign ID, date, local time, native post ID or visible queue
receipt, and screenshot evidence for each verified scheduling action. Reconcile
the workbook from that ledger after initial setup. Do not commit account data
or browser sessions. Do not send replies or invite people as part of publishing.

## Evidence and artwork

Feature copy was checked against the repository README and 2.1 CHANGELOG on
October 25, 2026, the public website and the visible FluidEQ Facebook Page.
The repository's upcoming notes do not establish public availability.

- <https://fluideq.com/>
- <https://github.com/StartSWest/FluidEQ/releases>
- <https://www.facebook.com/fluideqaudio/>
- [Meta for Business scheduling walkthrough](https://www.youtube.com/watch?v=PQjvbXyMhkM)

The three decorative backgrounds were generated with the built-in ImageGen
tool. Exact prompts are in `artwork/prompts.json`. These are decorative photos
and abstract artwork, not app screenshots, measured responses or hardware
endorsements. Existing scene and application captures come from `assets/tour`.
The FluidEQ icon is used unchanged. No customer data, credentials or music
recordings are part of this campaign.
