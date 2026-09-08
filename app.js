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
    recentPlaylists: "ams.recentPlaylists",
  };

  const MAX_RECENT_PLAYLISTS = 5;

  const redirectUri = window.location.origin + window.location.pathname;

  // ---------- DOM ----------
  const el = (id) => document.getElementById(id);

  const landingSection = el("landingSection");
  const landingStartBtn = el("landingStartBtn");
  const scrollCueBtn = el("scrollCueBtn");
  const rulesSection = el("rulesSection");
  const privacySection = el("privacySection");
  const setupSection = el("setupSection");
  const playlistSection = el("playlistSection");
  const gameSection = el("gameSection");

  const redirectUriDisplay = el("redirectUriDisplay");
  const copyRedirectBtn = el("copyRedirectBtn");
  const clientIdInput = el("clientIdInput");
  const connectBtn = el("connectBtn");
  const setupError = el("setupError");
  const logoutBtn = el("logoutBtn");
  const qrSection = el("qrSection");
  const qrCanvas = el("qrCanvas");

  const playlistInput = el("playlistInput");
  const recentPlaylists = el("recentPlaylists");
  const recentPlaylistsList = el("recentPlaylistsList");
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
  const advancedOptions = el("advancedOptions");
  const yearFrom = el("yearFrom");
  const yearTo = el("yearTo");
  const artistSearch = el("artistSearch");
  const selectAllArtistsBtn = el("selectAllArtistsBtn");
  const deselectAllArtistsBtn = el("deselectAllArtistsBtn");
  const artistChecklist = el("artistChecklist");
  const filterCount = el("filterCount");
  const teamModeToggle = el("teamModeToggle");
  const startGameBtn = el("startGameBtn");
  const backToHomeBtn = el("backToHomeBtn");

  const progressCounter = el("progressCounter");
  const sessionTimer = el("sessionTimer");
  const roundTimer = el("roundTimer");
  const hostPeek = el("hostPeek");
  const quizmasterModeToggle = el("quizmasterModeToggle");
  const scoreboard = el("scoreboard");
  const teamAScoreBtn = el("teamAScoreBtn");
  const teamAResetBtn = el("teamAResetBtn");
  const teamBScoreBtn = el("teamBScoreBtn");
  const teamBResetBtn = el("teamBResetBtn");
  const soloScore = el("soloScore");
  const soloScoreBtn = el("soloScoreBtn");
  const soloScoreResetBtn = el("soloScoreResetBtn");
  const reloadPlaylistBtn = el("reloadPlaylistBtn");
  const gestureToggleBtn = el("gestureToggleBtn");
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
  const extendBtn = el("extendBtn");
  const finishBtn = el("finishBtn");
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

  // Encodes the Client ID into a URL so a phone can scan it instead of typing it in.
  function renderClientIdQr() {
    const clientId = clientIdInput.value.trim();
    if (!clientId || typeof QRCode === "undefined") {
      qrSection.hidden = true;
      return;
    }
    const url = `${redirectUri}?client_id=${encodeURIComponent(clientId)}`;
    qrCanvas.innerHTML = "";
    new QRCode(qrCanvas, { text: url, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M });
    qrSection.hidden = false;
  }

  clientIdInput.addEventListener("input", renderClientIdQr);

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
      if (res.status === 403) {
        throw new Error("這個歌單讀不到完整曲目——Spotify 規定只能讀取你自己擁有或協作的歌單。請改用你自己建立的歌單，或請歌單擁有者把它設為協作歌單並邀請你加入。");
      }
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

  // Resumes from wherever playback was paused, instead of restarting the snippet.
  async function resumePlayback() {
    if (!selectedDeviceId) return false;
    const res = await spotifyFetch(`/me/player/play?device_id=${selectedDeviceId}`, { method: "PUT" });
    return res.ok;
  }

  // ---------- Game state ----------
  let allTracks = [];
  let activeTracks = [];
  let queue = [];
  let currentTrack = null;
  let currentStartMs = 0;
  let currentPlaylistId = null;

  // ---------- Advanced filters (year range + artist checklist) ----------
  let artistCheckedMap = new Map();

  function trackYear(track) {
    const y = track.album?.release_date ? parseInt(track.album.release_date.slice(0, 4), 10) : null;
    return Number.isNaN(y) ? null : y;
  }

  function initYearRangeIfEmpty(tracks) {
    let min = null;
    let max = null;
    for (const t of tracks) {
      const y = trackYear(t);
      if (y === null) continue;
      if (min === null || y < min) min = y;
      if (max === null || y > max) max = y;
    }
    if (min === null) return;
    yearFrom.placeholder = String(min);
    yearTo.placeholder = String(max);
    if (!yearFrom.value) yearFrom.value = min;
    if (!yearTo.value) yearTo.value = max;
  }

  function renderArtistChecklist(tracks) {
    const uniqueArtists = new Map();
    for (const t of tracks) {
      for (const a of t.artists || []) {
        if (a.id && !uniqueArtists.has(a.id)) uniqueArtists.set(a.id, a.name);
      }
    }
    const nextMap = new Map();
    for (const id of uniqueArtists.keys()) {
      nextMap.set(id, artistCheckedMap.has(id) ? artistCheckedMap.get(id) : true);
    }
    artistCheckedMap = nextMap;

    const sorted = Array.from(uniqueArtists.entries()).sort((a, b) => a[1].localeCompare(b[1], "zh-Hant"));
    artistChecklist.innerHTML = "";
    for (const [id, name] of sorted) {
      const label = document.createElement("label");
      label.className = "artist-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = artistCheckedMap.get(id);
      cb.addEventListener("change", () => {
        artistCheckedMap.set(id, cb.checked);
        updateFilterCount();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(" " + name));
      artistChecklist.appendChild(label);
    }
    updateFilterCount();
  }

  function setAllArtists(checked) {
    artistChecklist.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = checked;
    });
    for (const id of artistCheckedMap.keys()) artistCheckedMap.set(id, checked);
    updateFilterCount();
  }

  selectAllArtistsBtn.addEventListener("click", () => setAllArtists(true));
  deselectAllArtistsBtn.addEventListener("click", () => setAllArtists(false));

  artistSearch.addEventListener("input", () => {
    const q = artistSearch.value.trim().toLowerCase();
    artistChecklist.querySelectorAll(".artist-item").forEach((label) => {
      const name = label.textContent.trim().toLowerCase();
      label.hidden = q.length > 0 && !name.includes(q);
    });
  });

  yearFrom.addEventListener("input", updateFilterCount);
  yearTo.addEventListener("input", updateFilterCount);

  function getFilteredTracks() {
    const yFrom = yearFrom.value ? parseInt(yearFrom.value, 10) : null;
    const yTo = yearTo.value ? parseInt(yearTo.value, 10) : null;
    return allTracks.filter((t) => {
      const y = trackYear(t);
      if (yFrom !== null && (y === null || y < yFrom)) return false;
      if (yTo !== null && (y === null || y > yTo)) return false;
      const artists = t.artists || [];
      return artists.length === 0 || artists.some((a) => artistCheckedMap.get(a.id) !== false);
    });
  }

  function updateFilterCount() {
    filterCount.textContent = `符合條件：${getFilteredTracks().length} / ${allTracks.length} 首`;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Advanced option: cap how many rounds a game runs, independent of how many
  // tracks pass the year/artist filters. 0 (or no selection) means unlimited.
  function getQuestionCountLimit() {
    const checked = document.querySelector('input[name="totalQuestions"]:checked');
    return checked ? Number(checked.value) : 0;
  }

  // Shuffles the filtered pool and applies the total-question-count cap,
  // updating both activeTracks (used for the progress counter's total) and
  // the draw queue together so they stay consistent.
  function buildRoundQueue(filtered) {
    const shuffled = shuffle(filtered);
    const limit = getQuestionCountLimit();
    const capped = limit > 0 ? shuffled.slice(0, limit) : shuffled;
    activeTracks = capped;
    queue = capped.slice();
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

  function scheduleAutoPause(seconds) {
    clearAutoPauseTimer();
    if (seconds > 0) {
      autoPauseTimer = setTimeout(() => {
        autoPauseTimer = null;
        pausePlayback();
        vinyl.classList.remove("spinning");
        stopRoundTimer();
        stopSessionTimer();
      }, seconds * 1000);
    }
  }

  function armAutoPauseTimer() {
    scheduleAutoPause(currentDurationSec());
  }

  // ---------- Timers (count only while actually playing) ----------
  function formatSeconds(ms, decimals) {
    return (ms / 1000).toFixed(decimals);
  }

  let roundElapsedMs = 0;
  let roundRunning = false;
  let roundStartedAt = 0;
  let roundInterval = null;

  function renderRoundTimer() {
    const total = roundElapsedMs + (roundRunning ? Date.now() - roundStartedAt : 0);
    roundTimer.textContent = formatSeconds(total, 1) + "s";
  }

  function startRoundTimer() {
    if (roundRunning) return;
    roundRunning = true;
    roundStartedAt = Date.now();
    roundInterval = setInterval(renderRoundTimer, 100);
  }

  function stopRoundTimer() {
    if (!roundRunning) return;
    roundElapsedMs += Date.now() - roundStartedAt;
    roundRunning = false;
    clearInterval(roundInterval);
    roundInterval = null;
    renderRoundTimer();
  }

  function resetRoundTimer() {
    stopRoundTimer();
    roundElapsedMs = 0;
    renderRoundTimer();
  }

  let sessionElapsedMs = 0;
  let sessionRunning = false;
  let sessionStartedAt = 0;
  let sessionInterval = null;

  function renderSessionTimer() {
    const total = sessionElapsedMs + (sessionRunning ? Date.now() - sessionStartedAt : 0);
    const totalSec = Math.floor(total / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    sessionTimer.textContent = `${m}:${String(s).padStart(2, "0")}`;
  }

  function startSessionTimer() {
    if (sessionRunning) return;
    sessionRunning = true;
    sessionStartedAt = Date.now();
    sessionInterval = setInterval(renderSessionTimer, 500);
  }

  function stopSessionTimer() {
    if (!sessionRunning) return;
    sessionElapsedMs += Date.now() - sessionStartedAt;
    sessionRunning = false;
    clearInterval(sessionInterval);
    sessionInterval = null;
    renderSessionTimer();
  }

  function resetSessionTimer() {
    stopSessionTimer();
    sessionElapsedMs = 0;
    renderSessionTimer();
  }

  // ---------- Quizmaster peek (advanced option, off by default) ----------
  function updateHostPeek() {
    const hostModeOn = quizmasterModeToggle.checked || teamModeToggle.checked;
    // The pause button doubles as the "buzz stop" control in host mode, so it
    // gets enlarged and put in a vivid color regardless of whether a track is
    // currently loaded.
    pauseBtn.classList.toggle("host-emphasis", hostModeOn);

    if (hostModeOn && currentTrack) {
      const artists = (currentTrack.artists || []).map((a) => a.name).join(", ");
      hostPeek.textContent = `${artists} — ${currentTrack.name}`;
      hostPeek.hidden = false;
    } else {
      hostPeek.hidden = true;
      hostPeek.textContent = "";
    }
  }

  // ---------- Team scoreboard (small group mode) ----------
  function setScore(btn, value) {
    btn.textContent = String(Math.max(0, value));
  }

  teamAScoreBtn.addEventListener("click", () => setScore(teamAScoreBtn, Number(teamAScoreBtn.textContent) + 1));
  teamBScoreBtn.addEventListener("click", () => setScore(teamBScoreBtn, Number(teamBScoreBtn.textContent) + 1));
  teamAResetBtn.addEventListener("click", () => setScore(teamAScoreBtn, 0));
  teamBResetBtn.addEventListener("click", () => setScore(teamBScoreBtn, 0));

  // ---------- Solo correct-answer tally (individual mode, no teams) ----------
  soloScoreBtn.addEventListener("click", () => setScore(soloScoreBtn, Number(soloScoreBtn.textContent) + 1));
  soloScoreResetBtn.addEventListener("click", () => setScore(soloScoreBtn, 0));

  quizmasterModeToggle.addEventListener("change", updateHostPeek);
  teamModeToggle.addEventListener("change", updateHostPeek);

  function updateProgressCounter() {
    const played = activeTracks.length - queue.length;
    progressCounter.textContent = `已播放 ${played} / 共 ${activeTracks.length} 首`;
  }

  function resetCardToHidden() {
    flipCard.classList.remove("revealed");
    vinyl.classList.remove("spinning");
    nextBtn.disabled = false;
    revealBtn.disabled = false;
    playBtn.disabled = false;
    facingState = "up";
    resetRoundTimer();
  }

  function drawNextTrack() {
    if (queue.length === 0) {
      setStatus("整副歌單已經播完了！可以按「重新洗牌」再玩一次。");
      currentTrack = null;
      playBtn.disabled = true;
      replayBtn.disabled = true;
      pauseBtn.disabled = true;
      revealBtn.disabled = true;
      nextBtn.disabled = true;
      updateProgressCounter();
      updateHostPeek();
      return;
    }
    currentTrack = queue.pop();
    currentStartMs = computeStartMs(currentTrack, currentMode());
    resetCardToHidden();
    playBtn.disabled = false;
    replayBtn.disabled = false;
    pauseBtn.disabled = false;
    updateProgressCounter();
    updateHostPeek();
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
      startRoundTimer();
      startSessionTimer();
    }
  }

  async function onReplay() {
    if (!currentTrack) return;
    const ok = await playTrackAt(currentTrack.uri, currentStartMs);
    if (ok) {
      vinyl.classList.add("spinning");
      armAutoPauseTimer();
      startRoundTimer();
      startSessionTimer();
    }
  }

  async function onPause() {
    clearAutoPauseTimer();
    await pausePlayback();
    vinyl.classList.remove("spinning");
    stopRoundTimer();
    stopSessionTimer();
  }

  function onReveal() {
    if (!currentTrack) return;
    const t = currentTrack;
    revealCover.src = t.album?.images?.[0]?.url || "";
    revealTitle.textContent = t.name;
    revealArtist.textContent = (t.artists || []).map((a) => a.name).join(", ");
    const year = t.album?.release_date ? t.album.release_date.slice(0, 4) : "?";
    revealYear.textContent = year;
    flipCard.classList.add("revealed");
    revealBtn.disabled = true;
    stopRoundTimer();
  }

  async function onNext() {
    clearAutoPauseTimer();
    await pausePlayback();
    vinyl.classList.remove("spinning");
    stopRoundTimer();
    stopSessionTimer();
    drawNextTrack();
  }

  // If paused, resumes from wherever it was paused (does not restart the snippet).
  // Returns whether playback is now active either way.
  async function ensurePlaying() {
    if (vinyl.classList.contains("spinning")) return true;
    const ok = await resumePlayback();
    if (ok) {
      vinyl.classList.add("spinning");
      startRoundTimer();
      startSessionTimer();
      return true;
    }
    setStatus("接續播放失敗，請改按「播放」重新開始。");
    return false;
  }

  async function onExtend() {
    if (!currentTrack) return;
    if (!(await ensurePlaying())) return;
    scheduleAutoPause(10);
  }

  async function onFinishPlaying() {
    if (!currentTrack) return;
    clearAutoPauseTimer();
    await ensurePlaying();
  }

  function onReshuffle() {
    const filtered = getFilteredTracks();
    if (filtered.length === 0) {
      setStatus("篩選條件太嚴格，沒有符合的歌曲，請回到上一頁調整年份或歌手篩選。");
      return;
    }
    buildRoundQueue(filtered);
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
      renderArtistChecklist(allTracks);
      const filtered = getFilteredTracks();
      if (filtered.length === 0) {
        setStatus("歌單已更新，但目前的篩選條件沒有符合的歌曲，請調整年份或歌手篩選。");
        return;
      }
      buildRoundQueue(filtered);
      updateProgressCounter();
      setStatus("歌單已更新，共 " + allTracks.length + " 首歌。");
    } catch (e) {
      setStatus(e.message);
    }
  }

  function onEndGame() {
    clearAutoPauseTimer();
    pausePlayback();
    stopRoundTimer();
    stopSessionTimer();
    gameSection.hidden = true;
    playlistSection.hidden = false;
  }

  // ---------- Phone flip gesture (face-down = play, face-up = reveal) ----------
  // Only fires while the card is still hidden; once revealed, next/replay go back to buttons.
  const FLIP_DOWN_THRESHOLD = 120;
  const FLIP_UP_THRESHOLD = 60;
  let facingState = "up";
  let gestureEnabled = false;

  function handleOrientation(event) {
    if (event.beta === null || event.beta === undefined) return;
    const tilt = Math.abs(event.beta);
    if (facingState !== "down" && tilt > FLIP_DOWN_THRESHOLD) {
      facingState = "down";
      if (currentTrack && !flipCard.classList.contains("revealed")) onPlay();
    } else if (facingState !== "up" && tilt < FLIP_UP_THRESHOLD) {
      facingState = "up";
      if (currentTrack && !flipCard.classList.contains("revealed")) onReveal();
    }
  }

  async function enableFlipGesture() {
    if (typeof DeviceOrientationEvent === "undefined") {
      setStatus("這個裝置不支援翻面手勢。");
      return;
    }
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== "granted") {
          setStatus("未取得動作與方向存取權限，翻面手勢無法使用。");
          return;
        }
      } catch (e) {
        setStatus("無法啟用翻面手勢：" + e.message);
        return;
      }
    }
    window.addEventListener("deviceorientation", handleOrientation);
    gestureEnabled = true;
    facingState = "up";
    gestureToggleBtn.classList.add("active");
    gestureToggleBtn.title = "翻面手勢已啟用（再按一次關閉）";
  }

  function disableFlipGesture() {
    window.removeEventListener("deviceorientation", handleOrientation);
    gestureEnabled = false;
    gestureToggleBtn.classList.remove("active");
    gestureToggleBtn.title = "啟用手機翻面手勢";
  }

  gestureToggleBtn.addEventListener("click", () => {
    if (gestureEnabled) {
      disableFlipGesture();
    } else {
      enableFlipGesture();
    }
  });

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

  // ---------- Recently used playlists (localStorage only, most-recent-first) ----------
  function getRecentPlaylists() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEYS.recentPlaylists) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function saveRecentPlaylist(entry) {
    const list = getRecentPlaylists().filter((p) => p.id !== entry.id);
    list.unshift(entry);
    localStorage.setItem(LS_KEYS.recentPlaylists, JSON.stringify(list.slice(0, MAX_RECENT_PLAYLISTS)));
  }

  function renderRecentPlaylists() {
    const list = getRecentPlaylists();
    recentPlaylistsList.innerHTML = "";
    list.forEach((p) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "recent-playlist-chip";
      chip.title = p.name;
      chip.setAttribute("aria-label", p.name);
      const img = document.createElement("img");
      img.src = p.cover || "";
      img.alt = "";
      chip.appendChild(img);
      chip.addEventListener("click", () => {
        playlistInput.value = `https://open.spotify.com/playlist/${p.id}`;
        loadPlaylistFromInput();
      });
      recentPlaylistsList.appendChild(chip);
    });
    recentPlaylists.hidden = list.length === 0;
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

      const coverUrl = info.images?.[0]?.url || "";
      playlistCover.src = coverUrl;
      playlistName.textContent = info.name;
      playlistCount.textContent = `${tracks.length} 首歌`;
      saveRecentPlaylist({ id: playlistId, name: info.name, cover: coverUrl });
      renderRecentPlaylists();
      playlistInfo.hidden = false;
      deviceSelect.hidden = false;
      modeSelect.hidden = false;
      durationSelect.hidden = false;
      initYearRangeIfEmpty(tracks);
      renderArtistChecklist(tracks);
      advancedOptions.hidden = false;
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
    const filtered = getFilteredTracks();
    if (filtered.length === 0) {
      showError(playlistError, "篩選條件太嚴格，沒有符合的歌曲，請調整年份或歌手篩選。");
      return;
    }
    buildRoundQueue(filtered);
    resetSessionTimer();
    scoreboard.hidden = !teamModeToggle.checked;
    soloScore.hidden = teamModeToggle.checked;
    setScore(teamAScoreBtn, 0);
    setScore(teamBScoreBtn, 0);
    setScore(soloScoreBtn, 0);
    playlistSection.hidden = true;
    gameSection.hidden = false;
    drawNextTrack();
  });

  playBtn.addEventListener("click", onPlay);
  replayBtn.addEventListener("click", onReplay);
  pauseBtn.addEventListener("click", onPause);
  revealBtn.addEventListener("click", onReveal);
  extendBtn.addEventListener("click", onExtend);
  finishBtn.addEventListener("click", onFinishPlaying);
  nextBtn.addEventListener("click", onNext);
  reshuffleBtn.addEventListener("click", onReshuffle);
  endGameBtn.addEventListener("click", onEndGame);
  reloadPlaylistBtn.addEventListener("click", onReloadPlaylist);

  // ---------- Landing page ----------
  landingStartBtn.addEventListener("click", () => {
    landingSection.hidden = true;
    if (isLoggedIn()) {
      playlistSection.hidden = false;
      loadDevices();
    } else {
      setupSection.hidden = false;
    }
  });

  scrollCueBtn.addEventListener("click", () => {
    rulesSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Just a visibility switch back to the landing page — stays logged in, keeps
  // whatever playlist/device state was already set up.
  backToHomeBtn.addEventListener("click", () => {
    setupSection.hidden = true;
    playlistSection.hidden = true;
    landingSection.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Fold-reveal panels (rules, privacy) unfold as the visitor scrolls to them and
  // fold back closed if they scroll away, instead of a one-shot reveal.
  function initFoldReveal(target) {
    if (!target) return;
    if (typeof IntersectionObserver === "undefined") {
      target.classList.add("unfolded");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          target.classList.toggle("unfolded", entry.isIntersecting);
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(target);
  }

  // ---------- Boot ----------
  async function boot() {
    const savedClientId = localStorage.getItem(LS_KEYS.clientId);
    if (savedClientId) clientIdInput.value = savedClientId;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const authError = urlParams.get("error");
    const scannedClientId = urlParams.get("client_id");

    if (scannedClientId) {
      clientIdInput.value = scannedClientId;
      localStorage.setItem(LS_KEYS.clientId, scannedClientId);
      window.history.replaceState({}, "", redirectUri);
    }

    renderClientIdQr();
    renderRecentPlaylists();
    initFoldReveal(rulesSection);
    initFoldReveal(privacySection);

    if (authError) {
      showError(setupError, "Spotify 授權失敗：" + authError);
      window.history.replaceState({}, "", redirectUri);
    }

    let returningFromAuth = false;
    if (code) {
      try {
        await exchangeCodeForToken(code);
        returningFromAuth = true;
        window.history.replaceState({}, "", redirectUri);
      } catch (e) {
        showError(setupError, e.message);
        window.history.replaceState({}, "", redirectUri);
      }
    }

    if (isLoggedIn()) {
      logoutBtn.hidden = false;
    }

    if (returningFromAuth && isLoggedIn()) {
      // Coming straight back from Spotify's consent screen — skip the landing page.
      landingSection.hidden = true;
      playlistSection.hidden = false;
      loadDevices();
    }
  }

  boot();
})();
