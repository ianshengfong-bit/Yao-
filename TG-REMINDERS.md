# Yao 的 Telegram 提醒

可提醒行政、工作、進料、出貨、人員安排、查驗與工作紀錄。相同工作出現在儀表板、行事曆或提醒中心時，不會因此重複通知。沒有日期的「待整理」筆記，需先整理成正式工作才能安排提醒。

## 如何設定

- 一般工作：填日期、時間，勾選「到工作時間時提醒」。也能選提前 1／3／7 天，或提前 1 小時。新工作的到時提醒預設勾選；未填時間時使用台灣時間 09:00，表單有提示。
- 行政工作：展開「TG 提醒」，填提醒時間，可另外選提前幾天／提前 1 小時。不填時間時只列入早上總覽，不擅自安排到時通知。
- 每週／每月固定行政事項：固定排程也能設定提醒時間。之後新增的各期工作繼承設定；已產生的工作保留自己的日期、時間與進度，可各自修改。
- 完成、封存、送審核定後停止提醒。取消「到時」、提前天數與提前一小時三種選項，即可關閉該工作的時間通知。早上總覽仍依未完成工作整理。

原有一般工作若已填有效時間，會沿用原本到時提醒的行為；明確關閉到時提醒的工作會維持關閉。

## 何時會收到

時間皆採台灣時間。雲端每分鐘檢查一次，正常約在設定時間後 0～1 分鐘，再加上處理與網路時間；Google 排程延遲或服務故障時可能更久，無法保證分鐘內送達。工作時間到之前不發送到時通知。排程短暫中斷時最多補查過去 24 小時，補發會標示延後；啟用前的舊提醒不補送。

早上 08:00 的總覽包含今天、逾期及未來 3 天的未完成工作，沒有事項則不送。Google 的 nearMinute 排程誤差為 ±15 分鐘；這與每分鐘檢查的到時通知是兩種排程。超過顯示上限時總覽附剩餘筆數，完整資料可回 Yao 查看。

網站關閉、手機休眠時，雲端排程仍可通知。相同工作、相同提醒階段與時間只送一次；改到新的時間後會按新時間通知。傳送結果不明時保留紀錄，停止自動重送以避免重複，需先確認 TG 與排程執行紀錄。

## 免費方案及資料

使用既有 Firebase Spark、GitHub Pages 與私人 Google Apps Script；不啟用 Blaze、Cloud Functions、付費 Telegram 廣播或新的付費服務。免費方案各自有額度，不能保證無限次；個人日常使用按分鐘查詢到期索引，另定期補齊原有資料索引。資料變多時降低全資料整理的頻率，避免每分鐘重讀全部工作。

機器人 Token、收件對象及登入授權只存私人 Apps Script，不可放公開 GitHub、網頁或這份說明。現行私人排程只處理已設定的單一 Yao 帳號；其他登入帳號不會自動綁定同一個 TG。

沿用原本 `items`、`adminTasks`、`adminRecurring`、`projects` 集合、登入與權限。新增提醒偏好和衍生的 `tgMinutes`／`tgScheduleVersion` 欄位，不搬移資料、不變更 Firebase Rules。雲端整理只更新兩個索引欄位，並檢查文件版本避免覆蓋同時編輯。

私人 Apps Script 的 `yaoEnableAllReminders` 啟用早上總覽和每分鐘到時檢查；`yaoPauseReminder` 暫停兩者；`yaoShowStatus` 顯示啟用及最近檢查狀態。`yaoScheduleTimedTest` 安排約兩分鐘後的通用連線測試，不新增工程工作。

## 還原

GitHub 保留完整歷史，可回到更新前的 `a52a0df4b0921c88e17eac679a2e08262aa744f3`。如要連新提醒一起回復，先暫停私人雲端排程，再還原網頁與私人 Apps Script 備份；多出的索引欄位不影響舊網頁讀取。

參考：[Google 時間觸發器](https://developers.google.com/apps-script/reference/script/clock-trigger-builder)、[Apps Script 免費帳號額度](https://developers.google.com/apps-script/guides/services/quotas)、[Firestore 額度](https://firebase.google.com/docs/firestore/quotas)、[Telegram 機器人限制](https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this)。
