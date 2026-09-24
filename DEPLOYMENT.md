# 部署與連線設定

## 選擇方式

| 方式 | 規則編輯與本機測試 | 真實 API／Google 同步 |
|---|---|---|
| 本機 node server/local.mjs | 可用 | 可用，需憑證與授權 |
| Netlify 完整 Git 部署 | 可用 | Functions 隨專案部署，需憑證與授權 |
| GitHub Pages | 可用 | 需外接自己部署的後端 |
| Netlify 靜態拖曳包 | 可用 | 無 Functions，需外接後端 |

將完整專案包內容作為獨立儲存庫根目錄，直接包含 dist、server、netlify、.github、package.json、netlify.toml。不使用 Sites、資料庫或平台共用 AI Key。需要 Node.js 22+。

## 本機

執行 `node server/local.mjs` 或 Windows 的 `啟動工作台.cmd`，開啟 http://127.0.0.1:4317 。只監聽本機。

## Netlify 完整部署

1. 將完整專案推送至自己的 GitHub 儲存庫。
2. Netlify 新增專案、匯入儲存庫、選 main 分支，Base directory 留空。
3. netlify.toml 指定 Build command `npm test`、Publish directory `dist`、Functions directory `netlify/functions`、Node 22。
4. 網站的進階 AI 頁「後端來源」留空，使用同一網站的 `/.netlify/functions/relay-api`。
5. 輸入自己的 API Key，取得清單後選模型測試。

後端只呼叫固定 OpenAI、Gemini、xAI、Google Sheets 介面，不接受任意代理 URL，不使用共用 Key，不保存憑證或輸出原始供應商錯誤。回應禁止快取。

## GitHub Pages

Settings → Pages → Source 選 GitHub Actions。推送 main 觸發驗證及發布；PR 只驗證。支援 `/repository-name/` 子路徑。

API 需另將相同完整專案部署到 Netlify，然後：

1. 在 Netlify Functions 執行環境設定 `ALLOWED_ORIGINS=https://your-account.github.io`。來源不含儲存庫路徑，多個來源以逗號分隔，不接受萬用字元。
2. 重新部署後端。
3. GitHub 網頁「進階 AI → 後端連線」填 `https://your-site.netlify.app`。

後端會接收 Key 與 Google Token，僅填自己管理、信任的來源。CORS 不是登入驗證；目前每次請求以使用者提供的供應商／Google 憑證取得權限。內建服務實例內的短期限速，不是跨實例全域限流；大量公開使用另需平台流量限制與帳號管理。

## Google Cloud 管理者設定

1. 建立 Google Cloud 專案，啟用 Google Sheets API。
2. 設定 OAuth 同意畫面；測試模式加入實際使用者帳號。
3. 建立「網頁應用程式」OAuth 用戶端。將前端實際來源加入「已授權的 JavaScript 來源」，例如 `http://127.0.0.1:4317`、`https://your-site.netlify.app`、`https://your-account.github.io`。不包含路徑；localhost 是另一個需自行加入的來源。
4. 複製以 `.apps.googleusercontent.com` 結尾的公開 Client ID。不需要 Client Secret，請勿輸入密鑰。
5. 對外公開使用時，依 Google 政策完成所需審查與發布。

## 使用者同步規則

1. 步驟 1「連接 Google Sheet」或步驟 2「授權／重新讀取」，貼上試算表網址與 Client ID。
2. Google 授權選擇有編輯權的帳號。此流程請求 spreadsheets 讀寫範圍，不是每檔案限定授權；介面明示，程式只操作指定試算表。
3. 原表已有規則時，選擇載入 Google 規則或保留本機規則。授權本身不寫入。
4. 編輯後按「寫入 Google Sheet」，確認目的試算表與筆數，看到「已寫入並讀回驗證」才算成功。
5. 401 需重新授權；403 請檢查編輯權與 API 啟用；409 請重新讀取並解決資料格式／版本衝突。

第二個「Setting」分頁保留全域設定，目前以 CSV 匯出。多筆關鍵詞使用專用「Keywords」分頁 A:G：

| 規則ID | 啟用 | 關鍵詞 | 比對方式 | 回覆類型 | 顯示文字 | 網址 |
|---|---|---|---|---|---|---|
| 唯一ID | TRUE/FALSE | 一筆一個詞 | contains/exact/prefix | text/url | 回覆文字 | http(s) 網址 |

順序即優先順序。不存在則建表；原表格式不相容拒絕覆寫。RAW 寫入讓文字不被解釋為公式；移除本機規則再同步會清除舊規則內容，其他工作表不變。最多 100 筆。

版本比較與讀回驗證不是跨管理者的原子鎖定，請避免多人同時修改。偵測衝突時停止，不自動重試覆寫。

## API Key 測試

選供應商 → 貼 Key → 取得模型清單 → 選模型 → 送出一次文字測試。可直接輸入模型名稱，不依賴 RAG。清單成功不等於測試通過；需真正收到文字才顯示成功。部分模型不支援文字測試，不代表整把 Key 無效。

固定提示要求回覆 OK，輸出上限 512 tokens，可能計费。沒有自動重試或全模型輪詢。空輸出、401、403、429、逾時皆有明確狀態。Key 不寫入本機永久儲存、CSV 或 GAS，重新整理需重填。

網頁測試成功不等於 GAS／LINE 部署成功。若選配 GAS AI 回答，需另外在 GAS 指令碼屬性設定 `AI_API_KEY`；網頁的 Key 不會自動傳入程式。

## 驗收與範圍

執行 `npm test`，或 README 的三個 node 驗證命令。測試使用外部模擬回應；使用者需在部署後用自己的帳號做真正連線驗收。

LINE Webhook 簽章入口、事件去重與使用者資料權限、PDF OCR、語意向量 RAG 背景同步尚未完成。GAS 有規則回覆及選配 AI／RAG 函式，不提供未驗證的公開 doPost。

## 官方參考

- Google 授權：https://developers.google.com/identity/oauth2/web/guides/use-token-model
- GitHub Pages：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- Netlify Functions：https://docs.netlify.com/build/functions/get-started/
- OpenAI：https://developers.openai.com/api/docs/guides/text
- Gemini：https://ai.google.dev/api/models
- xAI：https://docs.x.ai/developers/rest-api-reference/inference/chat-completions

## 全網頁模式（管理者設定一次）

使用者不需安裝 Node.js。管理者將此儲存庫匯入 Netlify，建置會自動部署網站與 Functions。Netlify 網站使用同源 API，無需每位使用者輸入後端網址。

若保留 GitHub Pages 入口，在 GitHub Actions 的 Repository variables 設定 PUBLIC_API_ORIGIN 為你的 Netlify HTTPS 網站來源；Netlify 的 ALLOWED_ORIGINS 設為 https://profchwu.github.io。重新執行 GitHub 部署後，所有使用者自動使用該後端。

PUBLIC_GOOGLE_CLIENT_ID 是可公開的 Google Web OAuth 用戶端 ID。可設定於 Netlify 建置環境或 GitHub Repository variables，建置會放入公開 site-config.js。管理者仍需啟用 Sheets API、設定 OAuth 同意畫面、允許實際網站來源與完成所需審查。不可把 Client Secret、API Key 或 Google Token 放入這些 PUBLIC 變數。

網站配置好後，一般使用者只需開啟網址、輸入自己的模型 Key、授權 Google 帳號。不代表完整 LINE／OCR／向量 RAG 已完成。

## Cloudflare Workers 全網頁部署

將 GitHub 的 profchwu/linebotrag 匯入 Workers，名稱 linebotrag，根目錄為儲存庫根。建置命令 `npm run build && npm test`，部署命令 `npx wrangler deploy`。wrangler.jsonc 包含 nodejs_compat、dist 靜態資源與 ASSETS binding。API 不會回退到靜態 HTML。

使用 Workers 網址時前後端同源，不必設定 PUBLIC_API_ORIGIN。ALLOWED_ORIGINS 已允許既有 GitHub Pages 來源。若要 GitHub 網站自動連入此 Worker，再將實際 Worker 網址設為 GitHub Repository variable PUBLIC_API_ORIGIN 並重新部署 Pages。

`/api/health` 僅回傳服務狀態，不驗證模型或 Google 權限。PUBLIC_GOOGLE_CLIENT_ID 為建置時公開配置，仍需 Google Cloud 管理者設定同意畫面及允許的網站來源。Cloudflare 部署不會自動建立 Google OAuth 專案。
