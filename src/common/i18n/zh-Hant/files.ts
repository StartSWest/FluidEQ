/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const files = {
  'files.title.sharePreset': '共享 EQ 預設',
  'files.title.exportDspChain': '匯出 DSP 鏈預設',
  'files.title.importEq': '匯入等化器設定',
  'files.title.importImpulse': '匯入 脈衝響應',
  'files.title.exportChain': '匯出該鏈',
  'files.title.importChain': '匯入鏈條',
  'files.title.exportKaraoke': '出口卡拉OK',
  'files.title.saveDownload': '將下載儲存到您的電腦',
  'files.save': '儲存',
  'files.type.eqPreset': 'FluidEQ 等化器預設',
  'files.type.dspChain': 'FluidEQ DSP鏈',
  'files.type.eqSettings': '等化器設定',
  'files.type.impulse': 'WAV 脈衝響應',
  'files.type.chain': 'FluidEQ鏈條',
  'files.type.scene': 'FluidEQ場景',
  'files.type.programs': '節目',
  'files.type.pictures': '圖片',
  'files.type.all': '所有檔案',
  'files.imported.profile': '從 FluidEQ 設定檔匯入 {count} 頻段。',
  'files.imported.graphicEq': '從 GraphicEQ 檔案匯入 {count} 頻段。',
  'files.imported.parametricEq':
    '從 Equalizer APO ParametricEQ 檔案匯入 {count} 頻段。',
  'files.imported.skipped':
    '{count} 頻段使用了 FluidEQ 型別的濾波器，無法編輯並被跳過。',
  'files.imported.squiglink': '從 Squiglink 匯出匯入 {count} 頻段。',
  'files.imported.squiglinkSkipped':
    '{count} 條帶無法在 FluidEQ 中編輯並被跳過。',
  'files.imported.preampKept':
    '其 {gain} dB 前級增益 被保留，因此自動歸一化已關閉。',
  'files.impulse.applied': '應用 {name}。',
  'files.chain.exported': '出口 {device} 鏈條。',
  'files.chain.imported': '鏈條是匯入的。',
  'files.chain.importedFrom': '從 {device} 匯入鏈條。',
  'files.chain.noOutput': '沒有輸出處於活動狀態，因此沒有任何內容可匯入。',
  'files.chain.notChain': '該檔案不是 FluidEQ 鏈。',
  'files.squiglink.empty': '在匯入之前貼上 Squiglink EQ 匯出。',
  'files.squiglink.tooLarge': 'EQ 匯出太大而無法匯入。',
  'files.squiglink.earsNeedBands':
    '此匯出是取樣曲線，同時覆蓋雙耳。將其應用到雙耳，或將其匯出為引數過濾器。',
  'files.squiglink.tooManyBands':
    '這將產生超過 {max} 頻段。先刪除一些帶子，或貼在雙耳上。',
  'files.squiglink.noFilters':
    '找不到 Equalizer APO 過濾器。複製從 Squiglink 匯出的 ParametricEQ 或 GraphicEQ 文字。',
  'files.eq.tooLarge': '該檔案太大，無法作為 EQ 設定。',
  'files.eq.notProfile': '該 JSON 檔案不是 FluidEQ 設定檔。',
  'files.eq.noFilters':
    '該檔案中找不到 Equalizer APO 過濾器。需要 ParametricEQ、GraphicEQ 或 FluidEQ 設定檔。',
  'files.wav.notWav': '該檔案不是 WAV 脈衝響應。',
  'files.wav.truncated': '該 WAV 檔案被截斷。',
  'files.wav.unsupported': 'Equalizer APO 不支援該 WAV 格式。',
  'files.wav.noFormat': '該 WAV 檔案沒有格式區塊。',
  'files.wav.tooLarge': '脈衝響應 太大，無法安全匯入。',
  'files.wav.rate':
    '脈衝響應 是 {rate} Hz。 Equalizer APO 需要 {rates} Hz 之一。',
  'files.wav.noChunks': '該 WAV 檔案沒有可用的格式或資料區塊。',
  'files.wav.sampleFormat': '無法安全地分析該 WAV 樣本格式。',
  'files.wav.noSamples': '此 WAV 脈衝響應 不包含樣本。',
  'files.wav.badSamples': '此 WAV 脈衝響應 包含無效樣本。',
  'files.wav.silent': '此 WAV 脈衝響應 沒有可測量的反應。',
  'files.apo.notLocated': 'Equalizer APO 未安裝或無法找到其安裝位置。',
  'files.apo.selectorMissing': '未找到 Equalizer APO 裝置設定器。',
  'files.apo.editorMissing': '未找到 Equalizer APO 設定。',
  'files.wav.tooLong': '脈衝響應 太長，無法進行安全標準化分析。',
  'files.title.exportCurves': '匯出我的曲線',
  'files.type.curveList': 'FluidEQ曲線清單',
  'files.title.exportCurveFolder': '選擇曲線的資料夾',
} satisfies Partial<Dictionary>;

export default files;
