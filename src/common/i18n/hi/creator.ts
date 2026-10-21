/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const creator: Partial<Dictionary> = {
  'creator.title': 'क्रिएटर भुगतान',
  'creator.badge.active': 'सक्रिय',
  'creator.badge.checking': 'जाँच जारी',
  'creator.invite':
    'गैलरी में सीन प्रकाशित करें और जब सदस्य उन्हें खरीदें तो भुगतान पाएँ: हर बिक्री का {share}%, Stripe आपके बैंक खाते में भेजता है।',
  'creator.unfinished':
    'Stripe पर आपका पंजीकरण पूरा नहीं हुआ है। जहाँ छोड़ा था, वहीं से जारी रखें।',
  'creator.newTerms':
    'क्रिएटर शर्तें बदल गई हैं। भुगतान मिलते रहने के लिए उन्हें पढ़ें और स्वीकार करें।',
  'creator.checking':
    'Stripe आपकी जानकारी जाँच रहा है। आमतौर पर कुछ मिनट लगते हैं, कभी-कभी कुछ दिन।',
  'creator.paidLine': 'अब तक आपके सीन की बिक्री: {sales}।',
  'creator.sales.one': '{count} बिक्री',
  'creator.sales.few': '{count} बिक्रियाँ',
  'creator.sales.many': '{count} बिक्रियाँ',
  'creator.sales.other': '{count} बिक्रियाँ',
  'creator.ready': 'भुगतान के लिए तैयार',
  'creator.held': 'रोकी गई राशि',
  'creator.paid': 'अब तक भुगतान',
  'creator.paidHint':
    'रिफ़ंड की स्थिति के लिए हर बिक्री {days} दिन रोकी जाती है, फिर {amount} तैयार होने पर आपके बैंक में भेजी जाती है।',
  'creator.opened':
    'Stripe का पेज आपके ब्राउज़र में खुला है। वहाँ पूरा करें; लौटने पर यह कार्ड अपडेट हो जाएगा।',
  'creator.setUp': 'भुगतान सेट करें',
  'creator.finish': 'सेटअप पूरा करें',
  'creator.readTerms': 'नई शर्तें पढ़ें',
  'creator.checkAgain': 'फिर से जाँचें',
  'creator.dashboard': 'Stripe डैशबोर्ड',
  'creator.dialog.title': 'अपने सीन से कमाएँ',
  'creator.dialog.lead':
    'Stripe आपको भुगतान करता है और आपकी पहचान, बैंक और टैक्स की जानकारी रखता है। FluidEQ उन्हें कभी नहीं देखता।',
  'creator.dialog.step1': 'यहाँ अपना देश चुनें और शर्तें स्वीकार करें।',
  'creator.dialog.step2': 'अपने ब्राउज़र में Stripe के पेज पर साइन अप करें।',
  'creator.dialog.step3': 'FluidEQ पर लौटें: आपकी कमाई यहाँ दिखेगी।',
  'creator.dialog.country': 'आप किस देश में रहते हैं',
  'creator.dialog.search': 'देश खोजें',
  'creator.dialog.choose': 'देश चुनें',
  'creator.dialog.countryHint':
    'Stripe अमेरिका, यूके, कनाडा, स्विट्ज़रलैंड और यूरोपीय आर्थिक क्षेत्र के क्रिएटर को भुगतान कर सकता है, और देश बाद में बदला नहीं जा सकता। आपका देश सूची में नहीं है? सदस्य फिर भी आपके सीन खरीद सकते हैं, और हर बिक्री पर आपको इसके बदले एक क्रेडिट मिलता है।',
  'creator.dialog.cancel': 'रद्द करें',
  'creator.dialog.go': 'स्वीकार करें और Stripe पर जाएँ',
  'creator.dialog.opening': 'Stripe खुल रहा है…',
  'creator.terms.title': 'क्रिएटर शर्तें',
  'creator.terms.share':
    'Stripe की फ़ीस के बाद आपके सीन की हर बिक्री से जो आता है, उसका {share}% आपको मिलता है। बाकी FluidEQ रखता है।',
  'creator.terms.paidCredits':
    'केवल भुगतान वाले क्रेडिट से खरीदे गए सीन ही पैसे कमाते हैं। मुफ़्त क्रेडिट और FluidEQ के अपने सीन कुछ नहीं कमाते।',
  'creator.terms.hold':
    'हर कमाई {days} दिन रोकी जाती है, ताकि रिफ़ंड या विवाद उसे अब भी रद्द कर सके। भुगतान के बाद रद्द हुई कमाई आपके अगले भुगतान से घटा दी जाती है।',
  'creator.terms.minimum':
    '{amount} या उससे अधिक तैयार होने पर FluidEQ भुगतान करता है। फिर Stripe उसे आपके अपने शेड्यूल पर आपके बैंक में भेजता है।',
  'creator.terms.stripe':
    'Stripe आपकी पहचान, बैंक और टैक्स की जानकारी माँगता है और अपनी शर्तें दिखाता है। यदि Stripe आपको भुगतान नहीं कर सकता, तो भुगतान रुक जाते हैं।',
  'creator.terms.rights':
    'आपके सीन में मौजूद हर चीज़ बेचने का अधिकार आपके पास होना चाहिए। सीन की समीक्षा अब भी होती है, और Plus शर्तें तोड़ने वाला सीन हटाया जा सकता है।',
  'creator.terms.taxes':
    'अपनी कमाई पर टैक्स आपको अपने निवास स्थान पर स्वयं घोषित करना है।',
  'creator.terms.changes':
    'ये शर्तें बदल सकती हैं। ऐप में आपको सूचित किया जाता है, और दोबारा भुगतान से पहले नई शर्तें स्वीकार करने को कहा जाता है।',
  'creator.error.signedOut':
    'अपने भुगतान प्रबंधित करने के लिए फिर से साइन इन करें।',
  'creator.error.unconfirmed':
    'पहले अपना ईमेल पता पुष्टि करें। कोड आपके इनबॉक्स में है।',
  'creator.error.offline':
    'FluidEQ से संपर्क नहीं हो सका। अपना कनेक्शन जाँचें और फिर से कोशिश करें।',
  'creator.error.unavailable':
    'क्रिएटर भुगतान अभी शुरू नहीं हुए हैं। बाद में फिर कोशिश करें।',
  'creator.error.agreementOutdated':
    'क्रिएटर शर्तें बदल गई हैं। उन्हें फिर से पढ़ें और स्वीकार करें।',
  'creator.error.country':
    'Stripe अभी उस देश के क्रिएटर को भुगतान नहीं कर सकता।',
  'creator.error.banned': 'इस खाते को सीन के लिए भुगतान नहीं किया जा सकता।',
  'creator.error.server':
    'हमारी ओर से कुछ गड़बड़ हो गई। कुछ नहीं बदला; थोड़ी देर में फिर कोशिश करें।',
  'creator.admin.tab': 'भुगतान',
  'creator.admin.plan': 'Stripe से भुगतान पाने वाले क्रिएटर',
  'creator.admin.loading': 'क्रिएटर को देय राशि पढ़ी जा रही है',
  'creator.admin.due': 'अभी देय',
  'creator.admin.creators': 'क्रिएटर: {count}',
  'creator.admin.available': 'Stripe पर उपलब्ध',
  'creator.admin.availableNote': 'जहाँ से ट्रांसफ़र होते हैं',
  'creator.admin.pending': 'अधूरे',
  'creator.admin.pendingNote': 'अगला रन इन्हें पहले पूरा करेगा',
  'creator.admin.short':
    'Stripe पर FluidEQ का उपलब्ध बैलेंस देय राशि से कम है। उससे आगे के ट्रांसफ़र विफल होंगे और अगले रन का इंतज़ार करेंगे; बैलेंस सेटल होने के बाद भुगतान करें।',
  'creator.admin.list': 'किसे भुगतान होगा',
  'creator.admin.none':
    'अभी किसी को कुछ देय नहीं है। क्रिएटर यहाँ तब दिखते हैं जब Stripe उन्हें भुगतान कर सके और उनकी पर्याप्त कमाई होल्ड अवधि पार कर चुकी हो।',
  'creator.admin.payLead':
    'सूची में सभी को भुगतान करें: कुल {amount}, Stripe के ज़रिए।',
  'creator.admin.confirm':
    'अभी {amount} भेजें? इससे FluidEQ के Stripe बैलेंस से असली पैसा जाएगा और इसे वापस नहीं किया जा सकता।',
  'creator.admin.pay': 'क्रिएटर को भुगतान करें',
  'creator.admin.payNow': 'हाँ, अभी भुगतान करें',
  'creator.admin.paying': 'भुगतान हो रहा है…',
  'creator.admin.ran': 'भुगतान हुआ: {paid}। भुगतान नहीं हुआ: {failed}।',
  'creator.admin.rules':
    'हर भुगतान केवल एक बार भेजा जाता है: बीच में रुका रन अगला रन पूरा करता है, दोबारा कभी नहीं भेजा जाता। बैंक में पैसा कब जाए, यह क्रिएटर अपने Stripe डैशबोर्ड में खुद चुनते हैं।',
};

export default creator;
