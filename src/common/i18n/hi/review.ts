/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const review = {
  'review.tab': 'मंज़ूरी के लिए',
  'review.tabCount': 'मंज़ूरी का इंतज़ार: {count}',
  'review.badge': 'आपका इंतज़ार: {count}',
  'review.hint':
    'किसी सदस्य का प्रकाशित हर सीन, और किसी सीन का हर नया संस्करण, यहाँ तब तक इंतज़ार करता है जब तक आप उसे मंज़ूर न करें। तब तक उसे कोई और नहीं देखता।',
  'review.empty.title': 'कुछ इंतज़ार में नहीं',
  'review.empty.hint':
    'सदस्य जब नए सीन या नए संस्करण प्रकाशित करते हैं, तो वे यहाँ दिखते हैं।',
  'review.kind.new': 'नया सीन',
  'review.kind.update': 'अपडेट · v{from} → v{to}',
  'review.sent': '{date} को भेजा गया',
  'review.open': 'समीक्षा करें',
  'review.back': 'जो भी इंतज़ार में है',
  'review.flag.takenDown': 'गैलरी से हटाया गया',
  'review.flag.takenDownHint':
    'गैलरी से हटाया गया: नया संस्करण मंज़ूर करने के लिए इसे “रिपोर्ट किए गए” से वापस लाएँ',
  'review.flag.reports': 'प्रकाशित संस्करण पर खुली रिपोर्टें: {count}',
  'review.note.title': 'इसके निर्माता के अनुसार नया क्या है',
  'review.note.none': 'निर्माता ने इस संस्करण के बारे में कुछ नहीं लिखा।',
  'review.sceneFailed': 'यह सीन देखने के लिए खोला नहीं जा सका।',
  'review.changed':
    'आपके देखते समय सीन बदल गया: निर्माता ने नया संस्करण भेजा या उसे वापस ले लिया। सूची में अब वही है जो इंतज़ार कर रहा है।',
  'review.approve': 'मंज़ूर करें और प्रकाशित करें',
  'review.approving': 'मंज़ूर किया जा रहा है…',
  'review.reject': 'मंज़ूर न करें',
  'review.reject.title': 'यह मंज़ूर क्यों नहीं है?',
  'review.reject.lead':
    'निर्माता को कारण बताया जाता है, और अगर आप लिखें तो आपकी पंक्ति भी।',
  'review.reject.noteLabel': 'निर्माता के लिए एक पंक्ति (वैकल्पिक)',
  'review.reject.notePlaceholder': 'जैसे: ड्रॉप पर सफ़ेद फ़्लैश बहुत तेज़ है',
  'review.reject.cancel': 'वापस',
  'review.reject.send': 'जवाब भेजें',
  'review.reject.sending': 'भेजा जा रहा है…',
  'review.reason.flashing': 'चमक या स्ट्रोब',
  'review.reason.rights': 'किसी और का काम',
  'review.reason.offensive': 'आपत्तिजनक',
  'review.reason.broken': 'चलता नहीं या बहुत भारी है',
  'review.reason.other': 'कुछ और',
  'review.done.approved': '{name} अब गैलरी में है।',
  'review.done.rejected':
    '{name} मंज़ूर नहीं हुआ। निर्माता को कारण बताया जाएगा।',
  'review.failed': 'जवाब नहीं पहुँचा। फिर से कोशिश करें।',
  'review.versionRaised': 'गैलरी में यह संस्करण या इससे नया पहले से है।',
  'review.takenDown':
    'इस बीच इसे गैलरी से हटा दिया गया, इसलिए यह नया संस्करण नहीं ले सकता। पहले इसे “रिपोर्ट किए गए” से वापस लाएँ।',
  'review.deleted':
    'इसे हमेशा के लिए मिटा दिया गया है, इसलिए यह नया संस्करण नहीं ले सकता।',
  'review.filesFailed':
    'मंज़ूर हो गया, लेकिन इसकी फ़ाइलें गैलरी तक नहीं पहुँचीं। पूरा करने के लिए “मंज़ूर करें और प्रकाशित करें” फिर से दबाएँ।',
  'review.forbidden': 'सिर्फ़ FluidEQ का एडमिन सीन मंज़ूर कर सकता है।',
  'review.fine.new':
    'मंज़ूर करने पर यह संस्करण {version} के रूप में गैलरी में आ जाता है: साइन इन किया हर व्यक्ति इसे देखता है, और Plus सदस्य इसे जोड़ सकते हैं।',
  'review.fine.update':
    'मंज़ूर करने पर जिनके पास यह सीन है, उनके लिए संस्करण {version} बदल जाता है। मंज़ूर न करने पर संस्करण {version} जैसा है वैसा रहता है।',
  'review.state.pending': 'समीक्षा में',
  'review.state.pendingUpdate': 'संस्करण {version} समीक्षा में',
  'review.state.rejected': 'मंज़ूर नहीं हुआ',
  'review.state.rejectedUpdate': 'संस्करण {version} मंज़ूर नहीं हुआ',
  'review.withdraw': 'वापस लें',
  'review.withdrawConfirm': 'समीक्षा से वापस लें?',
  'review.remove': 'हटाएँ',
  'review.removeConfirm': 'इस सूची से हटाएँ?',
  'review.withdrawn': '{name} वापस ले लिया गया।',
  'review.notice.waitingOne': 'एक सीन आपकी मंज़ूरी का इंतज़ार कर रहा है',
  'review.notice.waitingMany': '{count} सीन आपकी मंज़ूरी का इंतज़ार कर रहे हैं',
  'review.notice.waitingWho': '{name}, {maker} का',
  'review.notice.waitingNewest': 'सबसे नया: {name}, {maker} का',
  'review.notice.later': 'बाद में',
  'review.notice.review': 'अभी समीक्षा करें',
  'review.notice.approved': '{name} गैलरी में है',
  'review.notice.approvedBody':
    'यह मंज़ूर हो गया। Plus सदस्य अब इसे जोड़ सकते हैं।',
  'review.notice.approvedUpdate': '{name} का संस्करण {version} गैलरी में है',
  'review.notice.approvedUpdateBody':
    'यह मंज़ूर हो गया। जिनके पास यह सीन है, उन्हें नया संस्करण मिलेगा।',
  'review.notice.rejected': '{name} मंज़ूर नहीं हुआ',
  'review.notice.rejectedUpdate': '{name} का संस्करण {version} मंज़ूर नहीं हुआ',
  'review.notice.keepsLive':
    'जिनके पास यह है, उनके पास संस्करण {version} ही रहेगा।',
  'review.notice.gotIt': 'ठीक है',
  'review.notice.openStudio': 'स्टूडियो खोलें',
  'review.notice.openMine': 'आपके सीन',
} as const;

export default review;
