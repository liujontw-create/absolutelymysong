# 絕對歌感 AbsolutelyMySong

🔗 已部署：https://liujontw-create.github.io/absolutelymysong/

純前端網頁，串接指定的 Spotify 歌單，隨機播放歌曲讓玩家猜「這是誰的哪首歌」。
可選擇「從開頭播放」或「隨機精華片段」，也能選播放長度，播放時不顯示歌名／歌手，按下「翻牌」才公布答案。

玩家可以隨時到該 Spotify 歌單裡自行加歌，遊戲畫面按「重新整理歌單」即可抓到最新曲目。

網頁本身只負責選歌、計時、翻牌 UI，不會用瀏覽器本身播放音樂——而是遙控你手機或電腦上**原本就開著的 Spotify App**（或任何 Spotify Connect 喇叭）來放歌，這樣手機瀏覽器也能順暢使用。

## 需求

- 一個 **Spotify Premium** 帳號（Spotify 的播放控制 API 只支援 Premium 帳號，免費帳號會顯示錯誤）。
- 一個免費的 Spotify Developer App（下面步驟教你申請）。
- 玩遊戲時，負責放音樂的那台裝置（手機、電腦、喇叭）要有 Spotify App 開著。
- **歌單必須是登入帳號自己擁有或協作的**——Spotify 規定第三方網頁只能讀取自己擁有或協作的歌單完整曲目，別人建立、單純設成公開的歌單讀不到。想讓朋友一起挑歌，可以開啟自己歌單的「協作」功能邀請朋友加歌。

## 設定步驟

### 1. 申請 Spotify App

1. 到 [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) 登入並建立一個新 App（Create app）。
2. App 名稱、描述隨意填。**Redirect URI** 先留空，等下一步跑起來後再回來填。
3. 「Which API/SDKs are you planning to use?」勾選 **Web API**。
4. 建立後，進入 App 的 Settings，複製 **Client ID** 備用。

### 2. 在本機啟動網頁

Spotify 的登入流程要求 Redirect URI 是 `http://127.0.0.1:PORT/`（不能用 `localhost`，也不能用 `file://`）。

這個資料夾裡附了一個 `serve.ps1`，用 PowerShell 執行（不需要另外安裝 Python/Node）：

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
```

看到 `Serving ... on http://127.0.0.1:8000/` 就代表啟動成功，保持該終端機視窗開著。然後瀏覽器打開：

```
http://127.0.0.1:8000/
```

（如果你的電腦有裝 Python 或 Node，也可以改用 `python -m http.server 8000 --bind 127.0.0.1` 或 `npx serve -l 8000`，效果一樣。用手機瀏覽器開的話，手機要跟這台電腦在同一個 Wi-Fi，網址改用電腦的區網 IP，例如 `http://192.168.x.x:8000/`，並把這個網址也加進 Redirect URIs。）

### 3. 設定 Redirect URI

打開網頁後，畫面上「Redirect URI」欄位會顯示目前這個網址（例如 `http://127.0.0.1:8000/`）。
按「複製」，回到 Spotify Developer Dashboard 的 App Settings，把它貼到 **Redirect URIs**，按 Save。

### 4. 連接並開始遊戲

1. 回到網頁，貼上剛才複製的 **Client ID**，按「連接 Spotify」，用你的 Spotify 帳號登入並授權。
2. 貼上要使用的歌單連結（例如 `https://open.spotify.com/playlist/xxxxxxxx`）或純 ID——貼上後會自動載入，不用再按其他按鈕。
3. 選擇播放裝置：清單會列出目前有開 Spotify App 的裝置（手機、電腦、喇叭）。如果清單是空的，先在該裝置上用 Spotify App 隨便播一首歌讓它上線，再按「重新整理」。
4. 選擇播放方式：
   - **從開頭播放**：每首歌從 0 秒開始播。
   - **隨機精華片段**：隨機從歌曲 30%–70% 的位置開始播（Spotify API 不提供副歌時間點，這是模擬「精華片段」的近似做法）。
5. 選擇播放長度：5 / 10 / 15 / 30 秒，或「不限」（會一直播到你自己按暫停）。時間一到會自動暫停。
6. 按「開始遊戲」。畫面會顯示一張蓋牌，按「播放」開始播歌，此時不會顯示歌名／歌手。
7. 大家猜完後按「翻牌公布答案」，會顯示封面、年份、歌名、歌手。
8. 按「下一首」繼續，或「重新洗牌」重新開始整副歌單，「重新整理歌單」可抓玩家新加的歌。

## 部署到公開網址（可選）

如果不想每次都跑本機伺服器，可以把這幾個檔案（`index.html`、`style.css`、`app.js`）部署到 GitHub Pages、Vercel 等靜態網站服務，並把該服務給你的 **https** 網址一併加進 Spotify App 的 Redirect URIs（可以同時保留本機那組）。這樣手機也能直接連公開網址，不用跟電腦同一個 Wi-Fi。

## 注意事項

- Client ID 與登入 token 只存在你瀏覽器的 localStorage，不會送到任何第三方伺服器。
- 「隨機精華片段」是用歌曲總長度推算的隨機時間點，不是真正辨識副歌位置。
- 播放裝置清單來自 Spotify 的「目前上線裝置」，該裝置的 Spotify App 需要保持開著（在背景執行即可）。
