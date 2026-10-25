/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const insights = {
  'insights.tab': 'पसंदीदा',
  'insights.loading': 'सदस्य जो सीन पाते हैं, वे लोड हो रहे हैं',
  'insights.period': 'अवधि',
  'insights.period.week': '7 दिन',
  'insights.period.month': '30 दिन',
  'insights.period.quarter': '90 दिन',
  'insights.period.all': 'शुरू से अब तक',
  'insights.favourites.hint':
    'अवधि में जोड़ा गया या पसंद किया गया हर सीन, पहले जोड़ने की संख्या, फिर पसंद के क्रम में। आपके अपने इसमें शामिल नहीं हैं।',
  'insights.favourites.summary': '{scenes} सीन, कुल {adds} बार जोड़े गए',
  'insights.favourites.empty':
    'इस अवधि में कोई सीन न जोड़ा गया, न पसंद किया गया।',
  'insights.favourites.kinds': 'प्रकार के अनुसार जोड़े गए',
  'insights.favourites.noAdds': 'इस अवधि में अभी तक कुछ नहीं जोड़ा गया।',
  'insights.favourites.advice':
    '{count} सीन में {kind} के पास कुल जोड़ों का {share} है। {kind} के और सीन सबसे सुरक्षित दाँव हैं।',
  'insights.col.rank': 'रैंक',
  'insights.col.scene': 'सीन',
  'insights.col.adds': 'जोड़े गए',
  'insights.col.likes': 'पसंद',
  'insights.account.title': 'सीन',
  'insights.account.empty': 'अभी तक कोई सीन जोड़ा या पसंद नहीं किया गया।',
  'insights.account.added': 'जोड़े गए',
  'insights.account.liked': 'पसंद किए गए',
  'insights.account.kind': 'पसंदीदा प्रकार',
  'insights.by': '{maker} का',
  'insights.byFluidEQ': 'FluidEQ का',
  'insights.member': 'एक सदस्य',
  'insights.chip.added': '{date} को जोड़ा',
  'insights.chip.liked': 'पसंद किया',
  'insights.chip.unpublished': 'प्रकाशित नहीं',
  'insights.kind.other': 'कोई श्रेणी नहीं',
  'insights.error.offline':
    'FluidEQ अपने सर्वर तक नहीं पहुँच सका। अपना कनेक्शन जाँचें और फिर कोशिश करें।',
  'insights.error.signedOut': 'इसे देखने के लिए फिर से साइन इन करें।',
  'insights.error.server': 'यह लोड नहीं हो सका। फिर कोशिश करें।',
  'insights.error.forbidden': 'इसे सिर्फ़ FluidEQ के एडमिन देख सकते हैं।',
  'insights.error.notDeployed':
    'सर्वर में यह अभी नहीं है। यह FluidEQ के इस संस्करण के साथ आने वाले सर्वर अपडेट के साथ आएगा।',
  'insights.server.tab': 'सर्वर',
  'insights.server.loading': 'सर्वर को मापा जा रहा है',
  'insights.server.plan': 'Supabase का मुफ़्त प्लान',
  'insights.server.measured': '{time} पर मापा गया',
  'insights.server.database': 'डेटाबेस',
  'insights.server.files': 'फ़ाइलें',
  'insights.server.active': 'सक्रिय खाते, 30 दिन',
  'insights.server.activeNote': 'कुल {accounts} खाते',
  'insights.server.of': '{limit} में से',
  'insights.server.used': '{share} इस्तेमाल हुआ',
  'insights.server.requests': 'अनुरोध, पिछले 7 दिन',
  'insights.server.unlimited': 'मुफ़्त प्लान में असीमित',
  'insights.server.kind.rest': 'डेटाबेस',
  'insights.server.kind.auth': 'साइन-इन',
  'insights.server.kind.storage': 'फ़ाइलें',
  'insights.server.kind.realtime': 'लाइव',
  'insights.server.noToken': 'इस सर्वर पर अनुरोधों की गिनती चालू नहीं है।',
  'insights.server.tokenRefused': 'सर्वर अनुरोधों की गिनती नहीं पढ़ सका।',
  'insights.server.tables': 'सबसे बड़ी तालिकाएँ',
  'insights.server.buckets': 'फ़ोल्डर के हिसाब से फ़ाइलें',
  'insights.server.bucketFiles': '{count} फ़ाइलें',
  'insights.server.noFiles': 'अभी कोई फ़ाइल सहेजी नहीं गई है।',
  'insights.server.egress': 'भेजा गया डेटा',
  'insights.server.egressBody':
    'मुफ़्त प्लान में हर महीने {limit} शामिल है, और आमतौर पर यही सीमा सबसे पहले पूरी होती है: सदस्य जो भी सीन और तस्वीर डाउनलोड करते हैं, सब गिना जाता है। कोई API इसे नहीं बताता; Supabase इसे प्रोजेक्ट के Usage पेज पर दिखाता है।',
  'insights.server.openSupabase': 'Supabase खोलें',
  'insights.server.limit.warn': 'सर्वर भर रहा है',
  'insights.server.limit.full': 'सर्वर लगभग भर गया है',
  'insights.server.limit.body':
    '{what} Supabase के मुफ़्त प्लान का {share} उपयोग कर चुका है। भरने से पहले प्रोजेक्ट को भुगतान वाले प्लान पर ले जाएँ, नहीं तो FluidEQ की ऑनलाइन सुविधाएँ काम करना बंद कर देंगी।',
  'insights.server.limit.database': 'डेटाबेस',
  'insights.server.limit.files': 'फ़ाइल स्टोरेज',
  'insights.server.limit.accounts': 'सक्रिय खाते',
  'insights.server.limit.later': 'बाद में',
  'insights.server.limit.open': 'सर्वर पेज खोलें',
  'insights.server.limit.badge': 'मुफ़्त प्लान का {share} उपयोग हुआ',
  'insights.server.rules':
    'मुफ़्त प्लान की कोई अंतिम तिथि नहीं है। किसी सीमा से आगे जाने पर एक ईमेल आता है और एक रियायती अवधि शुरू होती है; अगर ऐसा जारी रहे, तो अगले महीने या अपग्रेड तक Supabase अनुरोधों का जवाब “payment required” से देता है। {days} दिन तक बिना किसी अनुरोध वाला प्रोजेक्ट रोक दिया जाता है, जिसे FluidEQ का अपना ट्रैफ़िक होने नहीं देता।',
} as const;

export default insights;
