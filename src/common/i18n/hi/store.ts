/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const store: Partial<Dictionary> = {
  'store.credit.one': '{count} क्रेडिट',
  'store.credit.few': '{count} क्रेडिट',
  'store.credit.many': '{count} क्रेडिट',
  'store.credit.other': '{count} क्रेडिट',
  'store.credits.unit.one': 'क्रेडिट',
  'store.credits.unit.few': 'क्रेडिट',
  'store.credits.unit.many': 'क्रेडिट',
  'store.credits.unit.other': 'क्रेडिट',
  'store.credits.title': 'क्रेडिट',
  'store.credits.buyTitle': 'क्रेडिट पाएँ',
  'store.credits.lead':
    'एक क्रेडिट से एक सीन हमेशा के लिए आपका रहता है। आप एक बार भुगतान करते हैं, कुछ भी रिन्यू नहीं होता।',
  'store.credits.what':
    'हर क्रेडिट से गैलरी का एक सीन हमेशा के लिए आपका रहता है: ग्राफ़ पर, आपके डेस्कटॉप पर और आपकी लाइटों पर।',
  'store.credits.half':
    'आधा क्रेडिट इंतज़ार में है: भुगतान किए क्रेडिट से पाया गया आपका अगला सीन इसे पूरा कर देगा।',
  'store.credits.buy': 'क्रेडिट पाएँ',
  'store.credits.getFree': 'मुफ़्त क्रेडिट लें',
  'store.error.offline':
    'FluidEQ से जुड़ा नहीं जा सका। अपना कनेक्शन जाँचें और फिर कोशिश करें।',
  'store.error.signedOut':
    'अपने क्रेडिट इस्तेमाल करने के लिए फिर से साइन इन करें।',
  'store.error.unavailable': 'सीन स्टोर अभी खुला नहीं है। बाद में कोशिश करें।',
  'store.error.server':
    'हमारी तरफ़ कुछ गड़बड़ हुई। कुछ भी खर्च नहीं हुआ; थोड़ी देर में फिर कोशिश करें।',
  'store.error.unconfirmed':
    'पहले अपना ईमेल पता पुष्टि करें। कोड आपके इनबॉक्स में है।',
  'store.error.notOnSale': 'वह पैक अभी बिक्री पर नहीं है। कोई दूसरा चुनें।',
  'store.error.noCredits': 'आपके क्रेडिट खत्म हो गए हैं।',
  'store.error.alreadyOwned': 'यह सीन पहले से आपका है।',
  'store.error.gone': 'यह सीन अब गैलरी में नहीं है।',
  'store.error.negative':
    'रिफ़ंड से आपका बैलेंस शून्य से नीचे चला गया। एक पैक इसे वापस ले आता है।',
  'store.error.banned': 'यह अकाउंट सीन नहीं पा सकता।',
  'store.notice.refundedBody':
    '{name} की एक खरीद का रिफ़ंड हुआ; उससे आपकी कमाई काट ली गई।',
  'store.notice.refunded': 'एक खरीद का रिफ़ंड हुआ',
  'store.notice.restored': '{name} गैलरी में वापस आ गया है।',
  'store.notice.blockScene':
    'आप इसे {count} दिनों तक फिर से प्रकाशित नहीं कर सकेंगे।',
  'store.notice.blockAccount': 'आप {count} दिनों तक प्रकाशित नहीं कर सकेंगे।',
  'store.notice.takenDownBody':
    '{name} नियम तोड़ता है, इसलिए हमने इसे गैलरी से हटा दिया। जिन्होंने इसे खरीदा था उन्हें क्रेडिट वापस मिल गया, और उन खरीदों से आपकी कमाई काट ली गई।',
  'store.notice.takenDown': '{name} गैलरी से हट गया',
  'store.notice.returnedBody': 'इसके लिए आपका क्रेडिट लौटा दिया गया है।',
  'store.notice.returned': 'यह सीन अब उपलब्ध नहीं है।',
  'store.pack.each': '{price} प्रति सीन',
  'store.pack.best': 'सबसे अच्छी कीमत',
  'store.buy.title': '{name} हमेशा के लिए रखें?',
  'store.buy.lead':
    'यह आपका हो जाता है: ग्राफ़ पर, आपके डेस्कटॉप पर और आपकी लाइटों पर, हर उस कंप्यूटर पर जहाँ आप साइन इन करते हैं।',
  'store.buy.keep': 'हमेशा के लिए आपका, इसके बनाने वाले के हर अपडेट के साथ।',
  'store.buy.balance': 'अभी आपके पास: {credits}। इसके बाद: {after}।',
  'store.buy.final':
    'इसे पूर्ववत नहीं किया जा सकता। पुष्टि करते ही क्रेडिट खर्च हो जाता है।',
  'store.buy.buying': 'पा रहे हैं…',
  'store.buy.use': '{credits} इस्तेमाल करें',
  'store.loading': 'आपके क्रेडिट पढ़े जा रहे हैं…',
  'store.packs.title': 'आपको एक क्रेडिट चाहिए',
  'store.packs.lead':
    'हर क्रेडिट से एक सीन हमेशा के लिए आपका रहता है। एक पैक लें, और {name} बस एक क्लिक दूर है।',
  'store.packs.negative':
    'एक रिफ़ंड ने वे क्रेडिट वापस ले लिए जो आप इस्तेमाल कर चुके थे, इसलिए आपका बैलेंस {credits} है। एक पैक इसे शून्य से ऊपर ले आता है।',
  'store.packs.choose': 'एक पैक चुनें',
  'store.packs.waiting':
    'अपने ब्राउज़र में भुगतान पूरा करें। भुगतान होते ही आपके क्रेडिट यहाँ दिखेंगे।',
  'store.packs.fine':
    'Stripe के ज़रिए सुरक्षित भुगतान। एक भुगतान; कुछ भी रिन्यू नहीं होता। क्रेडिट का कोई नकद मूल्य नहीं है। भुगतान करने का मतलब है कि आप FluidEQ की शर्तों से सहमत हैं।',
  'store.packs.arrived': '{credits} आपके अकाउंट में। धन्यवाद!',
  'store.packs.again': 'भुगतान पेज फिर से खोलें',
  'store.packs.pay': '{price} चुकाएँ',
  'store.packs.none': 'अभी कोई पैक बिक्री पर नहीं है। बाद में कोशिश करें।',
  'store.cancel': 'रद्द करें',
  'store.done': 'हो गया',
  'store.starter.title': 'शुरुआत के लिए {credits} मुफ़्त',
  'store.starter.body':
    'हर अकाउंट के लिए एक बार, पुष्टि किए गए ईमेल पते के साथ।',
  'store.starter.claim': '{credits} लें',
  'store.welcome.title.one': 'आपके पास {count} मुफ़्त क्रेडिट है',
  'store.welcome.title.few': 'आपके पास {count} मुफ़्त क्रेडिट हैं',
  'store.welcome.title.many': 'आपके पास {count} मुफ़्त क्रेडिट हैं',
  'store.welcome.title.other': 'आपके पास {count} मुफ़्त क्रेडिट हैं',
  'store.welcome.claimedTitle.one': '{count} क्रेडिट आपका है',
  'store.welcome.claimedTitle.few': '{count} क्रेडिट आपके हैं',
  'store.welcome.claimedTitle.many': '{count} क्रेडिट आपके हैं',
  'store.welcome.claimedTitle.other': '{count} क्रेडिट आपके हैं',
  'store.welcome.cardTitle.one':
    '{count} मुफ़्त क्रेडिट आपका इंतज़ार कर रहा है',
  'store.welcome.cardTitle.few':
    '{count} मुफ़्त क्रेडिट आपका इंतज़ार कर रहे हैं',
  'store.welcome.cardTitle.many':
    '{count} मुफ़्त क्रेडिट आपका इंतज़ार कर रहे हैं',
  'store.welcome.cardTitle.other':
    '{count} मुफ़्त क्रेडिट आपका इंतज़ार कर रहे हैं',
  'store.welcome.cardClaimedTitle.one':
    '{count} क्रेडिट ख़र्च करने के लिए तैयार',
  'store.welcome.cardClaimedTitle.few':
    '{count} क्रेडिट ख़र्च करने के लिए तैयार',
  'store.welcome.cardClaimedTitle.many':
    '{count} क्रेडिट ख़र्च करने के लिए तैयार',
  'store.welcome.cardClaimedTitle.other':
    '{count} क्रेडिट ख़र्च करने के लिए तैयार',
  'store.welcome.eyebrow': 'FluidEQ में आपका स्वागत है',
  'store.welcome.body':
    'हर क्रेडिट से आपको {visualizers} का एक सीन हमेशा के लिए मिलता है। अभी इन्हें लें और अपने पहले सीन चुनें।',
  'store.welcome.fine':
    'हर खाते के लिए एक बार। क्रेडिट ख़र्च करने से पहले आप हर सीन को कुछ सेकंड देख सकते हैं।',
  'store.welcome.later': 'बाद में',
  'store.welcome.claimedBody':
    'अपने पहले सीन चुनें। ‘{notMine}’ चालू है, इसलिए {visualizers} में सिर्फ़ वे सीन दिखते हैं जो आपके पास नहीं हैं।',
  'store.welcome.pick': 'मेरे पहले सीन चुनें',
  'store.welcome.cardBody': 'इन्हें लें और रखने के लिए अपने पहले सीन चुनें।',
  'store.welcome.cardClaimedBody':
    'वे सीन दिख रहे हैं जो अभी आपके पास नहीं हैं। किसी को भी कुछ सेकंड देखें, फिर एक क्रेडिट में ले लें।',
  'store.welcome.gotIt': 'ठीक है',
  'store.get': 'पाएँ · {credits}',
  'store.scene.tasted':
    'यह {seconds} सेकंड की झलक थी। इसे हमेशा देखते रहने के लिए पाएँ।',
  'store.scene.locked': 'इसे यहाँ अपने संगीत पर चलते देखने के लिए पाएँ।',
  'store.scene.yours': 'हमेशा के लिए आपका',
  'store.scene.keep': 'हमेशा के लिए रखें',
  'store.scene.fine':
    'जो सीन आप पाते हैं, वह आपके अकाउंट में हमेशा के लिए आपका है। कोई उसे दोबारा नहीं बेच सकता।',
  'store.official.fine': 'FluidEQ संग्रह का हिस्सा: पाते ही हमेशा के लिए आपका।',
  'store.like.ownersOnly': '{count} पसंद। पसंद करने के लिए सीन पाएँ।',
  'store.scene.free': 'सबके लिए मुफ़्त',
  'store.error.termsOutdated':
    'शर्तें बदल गई हैं। क्रेडिट ख़रीदने से पहले नया संस्करण पढ़ने के लिए FluidEQ अपडेट करें।',
};

export default store;
