# LineBot + RAG

基本流程：**試算表 → 關鍵詞與回覆 → 測試與下載**。AI 與 RAG 為獨立的進階選配，預設關閉。

## 已實作

- 關鍵詞新增、編輯、停用、移除、排序；完全符合／包含／開頭符合；文字或文字＋網址回覆，第一筆命中優先。
- 本機規則測試，不依賴 AI 或 RAG。
- Google OAuth 授權後讀取、寫入指定試算表「Keywords」工作表。寫入前檢查版本，寫入後讀回驗證。
- OpenAI、Gemini、Grok：輸入自己的 Key、取得模型清單、對選定模型發送真實短文字測試，顯示回覆、延遲及用量。
- CSV 匯入、GAS 產生、Setting CSV／關鍵詞 CSV 匯出。GAS 讀取關鍵詞表，AI／RAG 開關預設 false。
- RAG 選配仍採本機文字檢索；PDF OCR、Drive 背景同步、語意向量索引尚未接通。

## 本機啟動

需要 Node.js 22+，無第三方應用依賴。

```sh
node server/local.mjs
```

Windows 亦可雙擊 `啟動工作台.cmd`，開啟 http://127.0.0.1:4317 。一般靜態伺服器不支援 API 測試或 Google 同步。

## 部署

完整專案包以本資料夾作為儲存庫根目錄；不要上傳外層其他專案。

- Netlify 完整 Git 部署：前端與 Functions 一起部署，支持真實 API。
- GitHub Pages：只發布前端；API 功能需外接自己部署的 Netlify 後端。
- 靜態拖曳包：只有介面與本機功能，沒有 Functions。

詳細步驟見 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 資料與憑證

API Key 與短效 Google Token 只留在頁面及請求記憶體，後端不記錄請求內容；不寫入 localStorage、試算表或程式匯出。重新整理需重新輸入／授權。非秘密的規則、文件與偏好保存在本機；按寫入並確認後才同步 Google。

## 驗證

```sh
node verify.mjs
node verify-deployment.mjs
node --test tests/api.test.mjs
```

外部服務自動測試使用可控制的模擬回應，不消耗真實 Key。需由使用者輸入自己的 Key、Google OAuth Client ID 並授權，才能驗證帳號實際權限、額度及雲端寫入。

LINE Webhook 簽章入口、去重、多租戶帳號、完整 OCR／RAG 背景服務尚未完成。GAS 可產生並測試規則，但未宣稱 LINE Bot 已部署上線。

## Excel 範本

網站第一步提供 `dist/templates/linebot-template.xlsx` 下載。依序為 Data、Setting、Keywords。Data 保留 Time、userid、message、AI_Response 欄名；Setting 的 B 欄可編輯，C 欄說明；Keywords 的 A:G 為可同步規則，I:J 為說明，不參與規則解析。先上傳 Drive 並另存 Google 試算表再連接。AI Key 不放入範本。舊版中文設定與規則分頁仍相容，但新範本統一使用英文分頁名稱。
