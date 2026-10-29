/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const bugReport = {
  'bugReport.title': '報告問題',
  'bugReport.descriptionLabel': '出了什麼問題？',
  'bugReport.descriptionPlaceholder': '你在做什麼，發生了什麼事？',
  'bugReport.reportLabel':
    '這正是將要傳送的內容。閱讀它，並刪除您不想分享的任何內容。',
  'bugReport.logsUnreadable':
    '無法讀取日誌，因此此報告沒有任何日誌。還是值得送的。',
  'bugReport.privacy':
    '帳戶名稱、路徑和電子郵件地址將自動刪除。在您按下其中一項之前，不會傳送任何內容。這個問題是公開的。',
  'bugReport.privacyWithEmail':
    '帳戶名稱、路徑和電子郵件地址將自動刪除。在您按下其中一項之前，不會傳送任何內容。該電子郵件僅傳送給開發人員；這個問題是公開的。',
  'bugReport.openIssue': '開啟 GitHub 問題',
  'bugReport.email': '私下傳送電子郵件',
  'bugReport.copy': '複製',
  'bugReport.copied': '報告已複製。',
  'bugReport.issuePaste': '已複製報告 - 將其貼上到剛剛開啟的問題中。',
  'bugReport.emailOpening': '報告已複製。開啟您的電子郵件應用程式...',
  'bugReport.emailOpened':
    '報告已複製並傳遞到您的電子郵件應用程式。檢查新電子郵件，然後傳送。',
  'bugReport.emailOpenedPartial':
    '報告已複製並傳遞到您的電子郵件應用程式。該電子郵件僅包含開頭部分 - 在傳送之前將完整的報告貼到其中。',
  'bugReport.emailNotOpened':
    '報告已複製，但無法開啟電子郵件應用程式。將其貼到電子郵件中：',
} satisfies Partial<Dictionary>;

export default bugReport;
