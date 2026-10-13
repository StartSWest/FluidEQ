/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const insights = {
  'insights.tab': 'पसंदीदा',
  'insights.loading': 'सदस्य जो सीन देखते हैं, वे लोड हो रहे हैं',
  'insights.period': 'अवधि',
  'insights.period.week': '7 दिन',
  'insights.period.month': '30 दिन',
  'insights.period.quarter': '90 दिन',
  'insights.period.all': 'शुरू से अब तक',
  'insights.favourites.hint':
    'अवधि में चलाया गया, जोड़ा गया या पसंद किया गया हर सीन, इस क्रम में कि कितने लोगों ने उसे चलाया, फिर स्क्रीन पर कितना समय रहा। आपकी अपनी जाँच इसमें शामिल नहीं है।',
  'insights.favourites.summary': '{scenes} सीन, कुल {time} चले',
  'insights.favourites.empty':
    'इस अवधि में कोई सीन न चलाया गया, न जोड़ा गया, न पसंद किया गया।',
  'insights.favourites.kinds': 'प्रकार के अनुसार स्क्रीन पर समय',
  'insights.favourites.noPlays': 'इस अवधि में अभी तक कुछ नहीं चला।',
  'insights.favourites.advice':
    '{count} सीन में {kind} के पास कुल देखने के समय का {share} है। {kind} के और सीन सबसे सुरक्षित दाँव हैं।',
  'insights.col.rank': 'रैंक',
  'insights.col.scene': 'सीन',
  'insights.col.people': 'लोग',
  'insights.col.time': 'समय',
  'insights.col.perPerson': 'प्रति व्यक्ति',
  'insights.col.adds': 'जोड़े गए',
  'insights.col.likes': 'पसंद',
  'insights.account.title': 'सीन',
  'insights.account.empty':
    'अभी तक कोई सीन जोड़ा, पसंद किया या चलाया नहीं गया। चलने का समय तब से गिना जाता है जब सदस्य FluidEQ का यह संस्करण चलाता है और अपडेट की गई शर्तें देख चुका होता है।',
  'insights.account.played': 'चलाए गए सीन',
  'insights.account.time': 'स्क्रीन पर',
  'insights.account.added': 'जोड़े गए',
  'insights.account.liked': 'पसंद किए गए',
  'insights.account.kind': 'पसंदीदा प्रकार',
  'insights.account.notPlayed': 'नहीं चलाया गया',
  'insights.account.days': '{days} दिन · आख़िरी बार {date}',
  'insights.by': '{maker} का',
  'insights.byFluidEQ': 'FluidEQ का',
  'insights.member': 'एक सदस्य',
  'insights.chip.added': '{date} को जोड़ा',
  'insights.chip.liked': 'पसंद किया',
  'insights.kind.other': 'कोई श्रेणी नहीं',
  'insights.time.underMinute': 'एक मिनट से कम',
  'insights.time.hoursMinutes': '{hours} {minutes}',
  'insights.error.offline':
    'FluidEQ अपने सर्वर तक नहीं पहुँच सका। अपना कनेक्शन जाँचें और फिर कोशिश करें।',
  'insights.error.signedOut': 'इसे देखने के लिए फिर से साइन इन करें।',
  'insights.error.server': 'यह लोड नहीं हो सका। फिर कोशिश करें।',
  'insights.error.forbidden': 'इसे सिर्फ़ FluidEQ के एडमिन देख सकते हैं।',
  'insights.error.notDeployed':
    'सर्वर में यह अभी नहीं है। यह FluidEQ के इस संस्करण के साथ आने वाले सर्वर अपडेट के साथ आएगा।',
} as const;

export default insights;
