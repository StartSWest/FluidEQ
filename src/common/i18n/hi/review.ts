/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const review = {
  'review.sent': '{date} को भेजा गया',
  'review.reason.flashing': 'चमक या स्ट्रोब',
  'review.reason.rights': 'किसी और का काम',
  'review.reason.offensive': 'आपत्तिजनक',
  'review.reason.broken': 'चलता नहीं या बहुत भारी है',
  'review.reason.other': 'कुछ और',
  'review.state.pending': 'समीक्षा में',
  'review.state.pendingUpdate': 'संस्करण {version} समीक्षा में',
  'review.state.rejected': 'मंज़ूर नहीं हुआ',
  'review.state.rejectedUpdate': 'संस्करण {version} मंज़ूर नहीं हुआ',
  'review.withdraw': 'वापस लें',
  'review.withdrawConfirm': 'समीक्षा से वापस लें?',
  'review.remove': 'हटाएँ',
  'review.removeConfirm': 'इस सूची से हटाएँ?',
  'review.withdrawn': '{name} वापस ले लिया गया।',
  'review.notice.approved': '{name} गैलरी में है',
  'review.notice.approvedBody':
    'यह स्वीकृत हो गया। अब यह आपके लिए हर जगह मुफ़्त चलता है, और कोई भी इसे ले सकता है।',
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
