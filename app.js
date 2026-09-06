(() => {
  "use strict";

  const SCOPES = [
    "user-read-playback-state",
    "user-modify-playback-state",
    "playlist-read-private",
    "playlist-read-collaborative",
  ].join(" ");

  const LS_KEYS = {
    clientId: "ams.clientId",
    codeVerifier: "ams.codeVerifier",
    accessToken: "ams.accessToken",
    refreshToken: "ams.refreshToken",
    expiresAt: "ams.expiresAt",
    grantedScope: "ams.grantedScope",
  };

  const redirectUri = window.location.origin + window.location.pathname;

  // ---------- DOM ----------
  const el = (id) => document.getElementById(id);

  const setupSection = el("setupSection");
  const playlistSection = el("playlistSection");
  const gameSection = el("gameSection");

  const redirectUriDisplay = el("redirectUriDisplay");
  const copyRedirectBtn = el("copyRedirectBtn");
  const clientIdInput = el("clientIdInput");
  const connectBtn = el("connectBtn");
  const setupError = el("setupError");
  const logoutBtn = el("logoutBtn");

  const playlistInput = el("playlistInput");
  const playlistError = el("playlistError");
  const playlistLoading = el("playlistLoading");
  const playlistInfo = el("playlistInfo");
  const playlistCover = el("playlistCover");
  const playlistName = el("playlistName");
  const playlistCount = el("playlistCount");
  const deviceSelect = el("deviceSelect");
  const deviceDropdown = el("deviceDropdown");
  const refreshDevicesBtn = el("refreshDevicesBtn");
  const deviceError = el("deviceError");
  const modeSelect = el("modeSelect");
  const durationSelect = el("durationSelect");
  const startGameBtn = el("startGameBtn");

  const progressCounter = el("progressCounter");
  const reloadPlaylistBtn = el("reloadPlaylistBtn");
  const flipCard = el("flipCard");
  const vinyl = el("vinyl");
  const revealCover = el("revealCover");
  const revealYear = el("revealYear");
  const revealTitle = el("revealTitle");
  const revealArtist = el("revealArtist");
  const playBtn = el("playBtn");
  const replayBtn = el("replayBtn");
  const pauseBtn = el("pauseBtn");
  const revealBtn = el("revealBtn");
  const nextBtn = el("nextBtn");
  const reshuffleBtn = el("reshuffleBtn");
  const endGameBtn = el("endGameBtn");
  const gameStatus = el("gameStatus");

  redirectUriDisplay.value = redirectUri;

  copyRedirectBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      copyRedirectBtn.textContent = "已複製";
      setTimeout(() => (copyRedirectBtn.textContent = "複製"), 1500);
    } catch {
      redirectUriDisplay.select();
    }
  });

  // ---------- PKCE helpers ----------
  function randomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => chars[b % chars.length]).join("");
  }

  async function sha256Base64Url(input) {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  function extractPlaylistId(input) {
    const trimmed = input.trim();
    const urlMatch = trimmed.match(/playlist[/:]([a-zA-Z0-9]+)/);
    if (urlMatch) return urlMatch[1].split("?")[0];
    return trimmed;
  }

  // ---------- Auth ----------
  async function startAuth() {
    const clientId = clientIdInput.value.trim();
    if (!clientId) {
      showError(setupError, "請先輸入 Client ID");
      return;
    }
    localStorage.setItem(LS_KEYS.clientId, clientId);

    const verifier = randomString(64);
    localStorage.setItem(LS_KEYS.codeVerifier, verifier);
    const challenge = await sha256Base64Url(verifier);

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      code_challenge_method: "S256",
      code_challenge: challenge,
      scope: SCOPES,
      show_dialog: "true",
    });
    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async function exchangeCodeForToken(code) {
    const clientId = localStorage.getItem(LS_KEYS.clientId);
    const verifier = localStorage.getItem(LS_KEYS.codeVerifier);
    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error("換取 token 失敗，請確認 Client ID 與 Redirect URI 是否正確設定。");
    const json = await res.json();
    storeTokens(json);
  }

  async function refreshAccessToken() {
    const clientId = localStorage.getItem(LS_KEYS.clientId);
    const refreshToken = localStorage.getItem(LS_KEYS.refreshToken);
    if (!refreshToken) throw new Error("no refresh token");
    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error("refresh failed");
    const json = await res.json();
    storeTokens(json);
  }

  function storeTokens(json) {
    localStorage.setItem(LS_KEYS.accessToken, json.access_token);
    if (json.refresh_token) localStorage.setItem(LS_KEYS.refreshToken, json.refresh_token);
    const expiresAt = Date.now() + json.expires_in * 1000 - 60000;
    localStorage.setItem(LS_KEYS.expiresAt, String(expiresAt));
    if (json.scope) {
      localStorage.setItem(LS_KEYS.grantedScope, json.scope);
      const granted = new Set(json.scope.split(" "));
      const missing = SCOPES.split(" ").filter((s) => !granted.has(s));
      if (missing.length) {
        console.warn("Spotify 授權缺少下列權限，請登出後重新連接：", missing.join(", "));
      }
    }
  }

  async function getValidToken() {
    const expiresAt = Number(localStorage.getItem(LS_KEYS.expiresAt) || 0);
    if (Date.now() > expiresAt) {
      await refreshAccessToken();
    }
    return localStorage.getItem(LS_KEYS.accessToken);
  }

  function isLoggedIn() {
    return !!localStorage.getItem(LS_KEYS.refreshToken);
  }

  function logout() {
    Object.values(LS_KEYS).forEach((k) => localStorage.removeItem(k));
    window.location.href = redirectUri;
  }

  // ---------- Spotify Web API ----------
  async function spotifyFetch(path, options = {}) {
    const token = await getValidToken();
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
    return res;
  }

  async function spotifyErrorMessage(res) {
    try {
      const json = await res.json();
      if (json?.error?.message) return `${json.error.message}（狀態碼 ${res.status}）`;
    } catch {
      // response body wasn't JSON; fall through
    }
    return `HTTP 錯誤 ${res.status}`;
  }

  async function fetchPlaylist(playlistId) {
    const res = await spotifyFetch(`/playlists/${playlistId}?fields=name,images,tracks.total`);
    if (!res.ok) throw new Error(`找不到歌單：${await spotifyErrorMessage(res)}`);
    return res.json();
  }

  async function fetchAllTracks(playlistId) {
    // Spotify's Feb 2026 Development Mode changes removed GET /playlists/{id}/tracks;
    // the replacement is /items, with each entry's track object renamed from "track" to "item".
    let tracks = [];
    let url = `/playlists/${playlistId}/items?limit=100`;
    while (url) {
      const res = await spotifyFetch(url);
      if (!res.ok) throw new Error(`讀取歌單曲目失敗：${await spotifyErrorMessage(res)}`);
      const json = await res.json();
      for (const entry of json.items) {
        const track = entry.item;
        if (track && track.track && track.id && track.uri) {
          tracks.push(track);
        }
      }
      url = json.next ? json.next.replace("https://api.spotify.com/v1", "") : null;
    }
    return tracks;
  }

  // ---------- Spotify Connect device control ----------
  // Instead of embedding a Web Playback SDK player (unreliable on mobile browsers),
  // this remote-controls whichever Spotify app/speaker is already active via Spotify Connect.
  let selectedDeviceId = null;

  async function fetchDevices() {
    const res = await spotifyFetch("/me/player/devices");
    if (!res.ok) throw new Error(`讀取播放裝置失敗：${await spotifyErrorMessage(res)}`);
    const json = await res.json();
    return json.devices || [];
  }

  async function loadDevices() {
    deviceError.hidden = true;
    refreshDevicesBtn.disabled = true;
    try {
      const devices = await fetchDevices();
      deviceDropdown.innerHTML = "";
      if (devices.length === 0) {
        showError(deviceError, "找不到可用的裝置，請先在手機或電腦打開 Spotify App（播放任何一首歌讓它上線），再按重新整理。");
        startGameBtn.hidden = true;
        selectedDeviceId = null;
        return;
      }
      for (const d of devices) {
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = `${d.name}${d.is_active ? "（使用中）" : ""}`;
        deviceDropdown.appendChild(opt);
      }
      const active = devices.find((d) => d.is_active) || devices[0];
      deviceDropdown.value = active.id;
      selectedDeviceId = active.id;
      maybeEnableStart();
    } catch (e) {
      showError(deviceError, e.message);
    } finally {
      refreshDevicesBtn.disabled = false;
    }
  }

  deviceDropdown.addEventListener("change", () => {
    selectedDeviceId = deviceDropdown.value;
  });

  async function playTrackAt(uri, positionMs) {
    if (!selectedDeviceId) {
      setStatus("請先選擇播放裝置。");
      return false;
    }
    const res = await spotifyFetch(`/me/player/play?device_id=${selectedDeviceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uris: [uri], position_ms: positionMs }),
    });
    if (res.ok) return true;
    const detail = await spotifyErrorMessage(res);
    if (res.status === 403) {
      setStatus("此功能需要 Spotify Premium 帳號才能播放完整歌曲。");
    } else if (res.status === 404) {
      setStatus("裝置已離線，請按「重新整理」重新選擇播放裝置。");
    } else {
      setStatus("播放失敗：" + detail);
    }
    return false;
  }

  async function pausePlayback() {
    if (!selectedDeviceId) return;
    await spotifyFetch(`/me/player/pause?device_id=${selectedDeviceId}`, { method: "PUT" });
  }

  // ---------- Game state ----------
  let allTracks = [];
  let queue = [];
  let currentTrack = null;
  let currentStartMs = 0;
  let currentPlaylistId = null;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function computeStartMs(track, mode) {
    const dur = track.duration_ms;
    if (mode === "intro" || !dur) return 0;
    const low = dur * 0.3;
    const high = dur * 0.7;
    return Math.floor(low + Math.random() * (high - low));
  }

  function currentMode() {
    return document.querySelector('input[name="playMode"]:checked').value;
  }

  function currentDurationSec() {
    return Number(document.querySelector('input[name="playDuration"]:checked').value);
  }

  let autoPauseTimer = null;

  function clearAutoPauseTimer() {
    if (autoPauseTimer) {
      clearTimeout(autoPauseTimer);
      autoPauseTimer = null;
    }
  }

  function armAutoPauseTimer() {
    clearAutoPauseTimer();
    const seconds = currentDurationSec();
    if (seconds > 0) {
      autoPauseTimer = setTimeout(() => {
        autoPauseTimer = null;
        pausePlayback();
        vinyl.classList.remove("spinning");
      }, seconds * 1000);
    }
  }

  function updateProgressCounter() {
    const played = allTracks.length - queue.length;
    progressCounter.textContent = `已播放 ${played} / 共 ${allTracks.length} 首`;
  }

  function resetCardToHidden() {
    flipCard.classList.remove("revealed");
    vinyl.classList.remove("spinning");
    nextBtn.hidden = true;
    revealBtn.disabled = false;
    playBtn.disabled = false;
  }

  function drawNextTrack() {
    if (queue.length === 0) {
      setStatus("整副歌單已經播完了！可以按「重新洗牌」再玩一次。");
      currentTrack = null;
      playBtn.disabled = true;
      replayBtn.disabled = true;
      pauseBtn.disabled = true;
      revealBtn.disabled = true;
      updateProgressCounter();
      return;
    }
    currentTrack = queue.pop();
    currentStartMs = computeStartMs(currentTrack, currentMode());
    resetCardToHidden();
    playBtn.disabled = false;
    replayBtn.disabled = false;
    pauseBtn.disabled = false;
    updateProgressCounter();
    setStatus("按「播放」開始猜歌！");
  }

  async function onPlay() {
    if (!currentTrack) return;
    playBtn.disabled = true;
    const ok = await playTrackAt(currentTrack.uri, currentStartMs);
    playBtn.disabled = false;
    if (ok) {
      vinyl.classList.add("spinning");
      armAutoPauseTimer();
    }
  }

  async function onReplay() {
    if (!currentTrack) return;
    const ok = await playTrackAt(currentTrack.uri, currentStartMs);
    if (ok) {
      vinyl.classList.add("spinning");
      armAutoPauseTimer();
    }
  }

  async function onPause() {
    clearAutoPauseTimer();
    await pausePlayback();
    vinyl.classList.remove("spinning");
  }

  function onReveal() {
    if (!currentTrack) return;
    clearAutoPauseTimer();
    const t = currentTrack;
    revealCover.src = t.album?.images?.[0]?.url || "";
    revealTitle.textContent = t.name;
    revealArtist.textContent = (t.artists || []).map((a) => a.name).join(", ");
    const year = t.album?.release_date ? t.album.release_date.slice(0, 4) : "?";
    revealYear.textContent = year;
    flipCard.classList.add("revealed");
    revealBtn.disabled = true;
    nextBtn.hidden = false;
  }

  function onNext() {
    clearAutoPauseTimer();
    drawNextTrack();
  }

  function onReshuffle() {
    queue = shuffle(allTracks);
    playBtn.disabled = false;
    replayBtn.disabled = false;
    pauseBtn.disabled = false;
    drawNextTrack();
  }

  async function onReloadPlaylist() {
    if (!currentPlaylistId) return;
    setStatus("重新載入歌單中…");
    try {
      allTracks = await fetchAllTracks(currentPlaylistId);
      queue = shuffle(allTracks);
      updateProgressCounter();
      setStatus("歌單已更新，共 " + allTracks.length + " 首歌。");
    } catch (e) {
      setStatus(e.message);
    }
  }

  function onEndGame() {
    clearAutoPauseTimer();
    pausePlayback();
    gameSection.hidden = true;
    playlistSection.hidden = false;
  }

  // ---------- UI wiring ----------
  function setStatus(msg) {
    gameStatus.textContent = msg;
  }

  function showError(node, msg) {
    node.textContent = msg;
    node.hidden = false;
  }

  connectBtn.addEventListener("click", startAuth);
  logoutBtn.addEventListener("click", logout);

  let tracksLoaded = false;

  function maybeEnableStart() {
    startGameBtn.hidden = !(tracksLoaded && selectedDeviceId);
  }

  async function loadPlaylistFromInput() {
    playlistError.hidden = true;
    const raw = playlistInput.value.trim();
    if (!raw) return;
    const playlistId = extractPlaylistId(raw);
    tracksLoaded = false;
    startGameBtn.hidden = true;
    playlistInfo.hidden = true;
    playlistLoading.hidden = false;
    try {
      const info = await fetchPlaylist(playlistId);
      const tracks = await fetchAllTracks(playlistId);
      if (tracks.length === 0) {
        showError(playlistError, "這個歌單目前沒有歌曲。");
        return;
      }
      currentPlaylistId = playlistId;
      allTracks = tracks;

      playlistCover.src = info.images?.[0]?.url || "";
      playlistName.textContent = info.name;
      playlistCount.textContent = `${tracks.length} 首歌`;
      playlistInfo.hidden = false;
      deviceSelect.hidden = false;
      modeSelect.hidden = false;
      durationSelect.hidden = false;
      tracksLoaded = true;
      maybeEnableStart();
      if (!selectedDeviceId) loadDevices();
    } catch (e) {
      showError(playlistError, e.message);
    } finally {
      playlistLoading.hidden = true;
    }
  }

  let playlistInputTimer = null;
  playlistInput.addEventListener("input", () => {
    clearTimeout(playlistInputTimer);
    playlistInputTimer = setTimeout(loadPlaylistFromInput, 600);
  });

  refreshDevicesBtn.addEventListener("click", loadDevices);

  startGameBtn.addEventListener("click", () => {
    queue = shuffle(allTracks);
    playlistSection.hidden = true;
    gameSection.hidden = false;
    drawNextTrack();
  });

  playBtn.addEventListener("click", onPlay);
  replayBtn.addEventListener("click", onReplay);
  pauseBtn.addEventListener("click", onPause);
  revealBtn.addEventListener("click", onReveal);
  nextBtn.addEventListener("click", onNext);
  reshuffleBtn.addEventListener("click", onReshuffle);
  endGameBtn.addEventListener("click", onEndGame);
  reloadPlaylistBtn.addEventListener("click", onReloadPlaylist);

  // ---------- Boot ----------
  async function boot() {
    const savedClientId = localStorage.getItem(LS_KEYS.clientId);
    if (savedClientId) clientIdInput.value = savedClientId;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const authError = urlParams.get("error");

    if (authError) {
      showError(setupError, "Spotify 授權失敗：" + authError);
      window.history.replaceState({}, "", redirectUri);
    }

    if (code) {
      try {
        await exchangeCodeForToken(code);
        window.history.replaceState({}, "", redirectUri);
      } catch (e) {
        showError(setupError, e.message);
        window.history.replaceState({}, "", redirectUri);
      }
    }

    if (isLoggedIn()) {
      setupSection.hidden = true;
      playlistSection.hidden = false;
      logoutBtn.hidden = false;
      loadDevices();
    }
  }

  boot();
})();
