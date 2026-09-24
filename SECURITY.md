# 風險檢查紀錄

檢查日期：2026-09-24。對象：前端、GAS 生成器、API 後端、GitHub Pages 發布及 Excel 範本。本次為程式檢視與針對性測試，不是獨立滲透測試或零風險保證；未用有效使用者憑證進行雲端資料寫入。

## 已修正

| 問題 | 影響 | 處理 |
|---|---|---|
| 聊天建議按鈕直接插入關鍵詞 | 惡意文字可能破壞 HTML 屬性或插入標籤 | 文字與屬性均作 HTML 編碼，加入回歸測試 |
| CSV 僅處理引號，未處理公式前綴 | Excel 可能將外部文字解析成公式 | 公式型前綴加單引號；記錄原文差異限制 |
| 步驟二 API 完成後只刷新 models 頁 | 結果仍顯示處理中，容易引發重複操作 | settings 頁也刷新成功或失敗結果 |
| GitHub Pages 未設定後端仍送出請求 | 測試無法成功，容易誤認已連線 | 發送前明確提示需要後端，不傳送 Key |

## 已有保護與限制

- Key／Google Token 不寫入 localStorage、工作表、匯出 GAS 或版本庫；只在記憶體及請求內使用。這不等於無法遭受 XSS、惡意擴充套件或不可信後端竊取。
- 供應商地址固定、拒絕 upstream redirect、請求逾時、回傳錯誤不包含供應商原始訊息；模型選擇不等於權限及可用性已確認。
- Google 同步有欄位、規則 ID、網址與筆數驗證，採 RAW 寫入、版本比對及讀回驗證。A:G 是取代寫入；讀檢寫不是原子交易，仍可能有競爭條件。
- CORS 僅限制瀏覽器來源，不是登入驗證。每實例每 IP 限流不是全域防濫用；公開大量使用前仍需平台流量限制、帳號隔離與監控。
- API 請求大小有上限，但雲端 request body 先讀入記憶體；另依賴平台的傳輸大小與流量限制。

## 尚存的重要風險

| 風險 | 目前狀態與必要處理 |
|---|---|
| LINE 公開入口 | 尚未提供簽章驗證、去重與使用者資料授權，不可把現有 GAS 函式直接視為完整公開 Bot |
| AI／RAG 內容可信度 | 可能有錯誤、提示注入及敏感內容外洩；Prompt 不構成權限邊界。正式 RAG 需文件存取權限、來源追溯及輸出審查 |
| Google OAuth 權限 | spreadsheets 範圍不是限單檔；目前程式限定指定 ID，但 token 本身權限更廣 |
| 第三方後端與資料保留 | 自訂後端可見 Key／Token，代管平台及供應商紀錄不受本專案控制 |
| 本機資料與共享來源 | 規則、文件與偏好存於 localStorage；GitHub Pages 同一帳號不同儲存庫共用 origin，不是彼此隔離的敏感資料環境 |
| HTML 安全政策 | 未實作嚴格 CSP；GitHub Pages 不會套用 Netlify 的 _headers。程式語法檢查目前使用 new Function 但不執行生成內容 |
| 費用與服務限制 | 模型測試可能計費；沒有跨平台費用硬上限，需在供應商與主機設定配額 |
| 功能成熟度 | OCR、Drive 自動更新、向量索引未完成；Setting 尚未自動匯入網頁，Data 尚未自動記錄對話 |

## 驗證方式

`node verify.mjs`、`node verify-deployment.mjs`、`node --test tests/api.test.mjs`、`node tests/template-compatibility.mjs`。另檢查線上作者資訊、免責區塊、架構圖與下載資源。測試中的供應商與 Google 回應以模擬資料為主。

## 參考

- [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection)
- [OWASP HTML 輸出編碼](https://devguide.owasp.org/en/04-design/02-web-app-checklist/04-encode-escape-data/)
- [OWASP LLM Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)

維護者：[profchwu](https://github.com/profchwu)。漏洞回報請勿公開任何憑證或私人資料。
