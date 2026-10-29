# Interface languages

The locale registry in `src/common/i18n/index.ts` is the list of supported
interface languages. Every new feature string must be supplied in **every
registered locale**, including Korean (`ko`) and Traditional Chinese
(`zh-Hant`). English is the key and placeholder contract. Missing dictionary
entries still fall back to English so a failed load does not display raw keys;
the completeness tests prevent shipping incomplete catalogs.

Simplified Chinese keeps its existing `zh` code and saved preferences.
Traditional Chinese uses the BCP 47 script tag `zh-Hant`, rather than naming
one region as the only supported audience. OS language resolution honors an
explicit script before its region; otherwise `zh-TW`, `zh-HK`, and `zh-MO`
select Traditional Chinese. Bare `zh`, `zh-CN`, and `zh-SG` stay Simplified.
Underscores, case variants, and older Windows `zh-CHS`/`zh-CHT` aliases are
accepted. Korean regional tags resolve to `ko`. Invalid or unsupported tags
fall back to English. An explicit saved preference takes precedence over the
OS language, and the picker stores the canonical app code.

Each dictionary is assembled from the same feature modules as English and
loads in its own lazy chunk. The tray and account/Forum completion pages use
the same resolver and dictionaries as the renderer. The document and each
language's native name carry their language tags for accessibility and font
fallback. Use the established system font stack; Korean joins Chinese,
Japanese, and Hindi in the existing rule that disables Latin letter spacing.

Names supplied by scene packs, gallery entries, ambient controls, projects,
and picture slots accept `zh-Hant` in addition to the existing bounded set of
two-letter keys. Unrecognized arbitrary tags remain excluded. Packs without
a localized name keep their existing English fallback. Existing signed
catalogs and third-party scenes need their owners to supply new names.

## Terminology

| English          | Korean              | Traditional Chinese |
| ---------------- | ------------------- | ------------------- |
| EQ band          | EQ 밴드             | EQ 頻段             |
| Gain             | 게인                | 增益                |
| Threshold        | 임계값              | 閾值                |
| Attack / Release | 어택 / 릴리스       | 起音 / 釋放時間     |
| Ceiling          | 출력 상한           | 輸出上限            |
| Impulse response | 임펄스 응답         | 脈衝響應            |
| Library          | 라이브러리          | 媒體庫              |
| Visualizers      | 비주얼라이저        | 視覺化效果          |
| Import / Export  | 가져오기 / 내보내기 | 匯入 / 匯出         |
| Scene credit     | 크레딧              | 點數                |

Preserve interpolation tokens, units, file formats, product names, and links.
Korean and Traditional Chinese drafts were machine-assisted, then adjusted
for interface context and audio terminology. Traditional Chinese uses Taiwan
software vocabulary; script conversion is only a cleanup step, not the
translation process.

## Independently published content

Help and What's New keep their existing illustrations and translated text.
The existing film set has no new Korean or Traditional Chinese narration.
Both use the existing English films with translated on-screen captions and
state the audio language before playback. Do not construct new localized
media URLs until the corresponding files have actually been published. The
older first-steps film has English audio and English VTT captions; its note
says so in both new languages. The offline guide export remains the existing
English edition.

The checkout/creator service and its website return pages have a separate
locale contract (`CHECKOUT_LOCALES`). The new interface languages currently
use the established English fallback at that boundary. Adding localized
checkout pages, emails, website pages, remote scene names, or narration is
separate work for their owners; an interface-language change must not claim
or silently deploy those translations.
