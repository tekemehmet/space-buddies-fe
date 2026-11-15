/*
 * Astro Adventures – "Ask PIP" chat
 *
 * Kids ask questions about the Forgotten Explorer they just found. PIP radios the
 * question to the Space Buddies backend (POST <apiBaseUrl>/api/chat), and the explorer
 * answers in its own words, with NASA sources and (if available) a recorded voice.
 *
 * Request:  { explorer_id: "lunar-module" | "lunar-rover" | …, question: string (3–1000 chars) }
 * Response: { explorer_id, explorer_name, answer, sources: [{chunk_id, title, url}], audio_base64, audio_error }
 *
 * window.AstroChat = {
 *   open({ explorerId, onState })  – show the chat; resolves when the player goes back to the mission.
 *                                    onState(state) keeps PIP in sync: "listening" | "thinking" | "speaking" | "oops"
 *   close()
 *   setMuted(bool)                  – the sound button also silences answers
 * }
 */
(function () {
  "use strict";

  
const EXPLORERS = {
  "lunar-module": {
    short: "Eagle",
    title: "Apollo 11 Lunar Module Eagle",
    chips: [
      "How did Eagle land on the Moon?",
      "What was it like inside Eagle?",
      "Why did Eagle's upper section fly away?"
    ],
  },

  "lunar-rover": {
    short: "the Lunar Roving Vehicle",
    title: "Apollo 15 Lunar Roving Vehicle",
    chips: [
      "How fast could the lunar rover travel?",
      "How was the lunar rover powered?",
      "Why did the lunar rover have mesh wheels?"
    ],
  },

  "spirit": {
    short: "Spirit",
    title: "Spirit Mars Rover",
    chips: [
      "What did Spirit discover on Mars?",
      "How did Spirit travel across Mars?",
      "Why did Spirit's mission end?"
    ],
  },

  "opportunity": {
    short: "Opportunity",
    title: "Opportunity Mars Rover",
    chips: [
      "How did Opportunity survive so long on Mars?",
      "What evidence of water did Opportunity find?",
      "What happened during Opportunity's final days?"
    ],
  },

  "insight": {
    short: "InSight",
    title: "InSight Mars Lander",
    chips: [
      "How did InSight detect marsquakes?",
      "What did InSight discover inside Mars?",
      "Why did InSight stop working?"
    ],
  },

  "ingenuity": {
    short: "Ingenuity",
    title: "Ingenuity Mars Helicopter",
    chips: [
      "How did Ingenuity fly in the thin Martian atmosphere?",
      "What was Ingenuity's greatest achievement?",
      "Why did Ingenuity's mission end?"
    ],
  },
};

  const MIN_LEN = 3, MAX_LEN = 1000;
  const TIMEOUT_MS = 45000;

  const el = {
    panel: document.getElementById("chatPanel"),
    title: document.getElementById("chatTitle"),
    status: document.getElementById("chatStatus"),
    log: document.getElementById("chatLog"),
    chips: document.getElementById("chatChips"),
    form: document.getElementById("chatForm"),
    input: document.getElementById("chatInput"),
    send: document.getElementById("chatSend"),
    done: document.getElementById("chatDone"),
  };

  let session = null; // { explorerId, info, onState, resolve, busy, audio, speakTimer, controller }
  let muted = false;

  const setState = (state, text) => {
    if (!session) return;
    el.panel.dataset.state = state;
    el.status.textContent = text;
    try { if (session.onState) session.onState(state); } catch (e) { /* the 3D side should never break the chat */ }
  };

  const scrollDown = () => { el.log.scrollTop = el.log.scrollHeight; };

  function bubble(who, label) {
    const msg = document.createElement("div");
    msg.className = `chat-msg chat-${who}`;
    if (label) {
      const name = document.createElement("div");
      name.className = "chat-name";
      name.textContent = label;
      msg.appendChild(name);
    }
    const body = document.createElement("div");
    body.className = "chat-body";
    msg.appendChild(body);
    el.log.appendChild(msg);
    scrollDown();
    return { msg, body };
  }

  function pipSays(text) {
    bubble("pip", "PIP").body.textContent = text;
    scrollDown();
  }

  const safeUrl = (url) => {
    try {
      const u = new URL(url);
      return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
    } catch (e) { return null; }
  };

  // The answer, with [1]-style markers turned into little links to the NASA sources
  function explorerSays(data) {
    const { msg, body } = bubble("explorer", `${data.explorer_name || session.info.title} (through PIP's radio)`);
    const sources = Array.isArray(data.sources) ? data.sources : [];
    String(data.answer || "").split(/(\[\d+\])/).forEach((part) => {
      const m = /^\[(\d+)\]$/.exec(part);
      if (!m) { body.appendChild(document.createTextNode(part)); return; }
      const src = sources[Number(m[1]) - 1];
      const href = src && safeUrl(src.url);
      const sup = document.createElement("sup");
      if (href) {
        const a = document.createElement("a");
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = m[1];
        a.title = src.title || "NASA source";
        sup.appendChild(a);
      } else sup.textContent = m[1];
      body.appendChild(sup);
    });
    const listed = sources.map((s, i) => ({ s, i, href: safeUrl(s.url) })).filter((x) => x.href);
    if (listed.length) {
      const box = document.createElement("details");
      box.className = "chat-sources";
      const sum = document.createElement("summary");
      sum.textContent = "NASA sources";
      box.appendChild(sum);
      const ol = document.createElement("ol");
      listed.forEach(({ s, i, href }) => {
        const li = document.createElement("li");
        li.value = i + 1;
        const a = document.createElement("a");
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = s.title || href;
        li.appendChild(a);
        ol.appendChild(li);
      });
      box.appendChild(ol);
      msg.appendChild(box);
    }
    scrollDown();
    return msg;
  }

  function stopSpeaking() {
    if (!session) return;
    if (session.audio) { session.audio.pause(); session.audio = null; }
    clearTimeout(session.speakTimer);
    el.log.querySelectorAll(".is-speaking").forEach((m) => m.classList.remove("is-speaking"));
  }

  // PIP talks while the answer plays (or for a reading-length moment when there's no sound)
  function speak(msg, data) {
    stopSpeaking();
    msg.classList.add("is-speaking");
    setState("speaking", `${capital(session.info.short)} is answering through PIP…`);
    const finish = () => {
      if (!session) return;
      msg.classList.remove("is-speaking");
      session.audio = null;
      setState("listening", "PIP is listening. Ask another question!");
    };
    const words = String(data.answer || "").split(/\s+/).length;
    if (data.audio_base64 && !muted) {
      const audio = new Audio("data:audio/mpeg;base64," + data.audio_base64);
      session.audio = audio;
      audio.onended = finish;
      audio.onerror = finish;
      audio.play().catch(finish);
    } else {
      session.speakTimer = setTimeout(finish, Math.min(9000, Math.max(2500, words * 280)));
    }
  }

  const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function setBusy(busy) {
    if (!session) return;
    session.busy = busy;
    el.input.disabled = busy;
    el.send.disabled = busy;
    el.chips.querySelectorAll("button").forEach((b) => { b.disabled = busy; });
  }

  async function ask(question) {
    if (!session || session.busy) return;
    const q = question.trim();
    if (q.length < MIN_LEN) { pipSays("Beep! Can you tell me a little more? Type at least 3 letters."); return; }
    if (q.length > MAX_LEN) { pipSays("Whoa, that's a long one! Can you make it a bit shorter?"); return; }
    stopSpeaking();
    bubble("you", "You").body.textContent = q;
    scrollDown();
    el.input.value = "";

    const base = String((window.ASTRO_CONFIG && window.ASTRO_CONFIG.apiBaseUrl) || "").replace(/\/+$/, "");
    if (!base) {
      setState("oops", "PIP's space radio isn't connected yet.");
      pipSays("Beep-boop… my space radio isn't connected yet! (Grown-ups: add the backend address to config.js.)");
      return;
    }

    setBusy(true);
    setState("thinking", `PIP is radioing ${session.info.short}…`);
    const dots = bubble("pip", "PIP");
    dots.msg.classList.add("chat-typing");
    dots.body.innerHTML = '<span></span><span></span><span></span>';
    const mine = session;
    const controller = new AbortController();
    mine.controller = controller;
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(base + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ explorer_id: mine.explorerId, question: q }),
        signal: controller.signal,
      });
      if (session !== mine) return;
      dots.msg.remove();
      if (res.status === 429) {
        setState("oops", "PIP's radio needs a short rest.");
        pipSays("Whoa, so many great questions! My radio needs a little rest. Try again in a minute.");
        return;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (session !== mine) return;
      if (window.AstroAudio) window.AstroAudio.sfx("chirp");
      speak(explorerSays(data), data);
    } catch (err) {
      if (session !== mine) return;
      dots.msg.remove();
      console.warn("Astro Adventures chat: request failed", err);
      setState("oops", "PIP can't reach mission control.");
      // The backend only answers pages served from http://localhost:5173 (its CORS settings).
      // Opened as a file, or from another address, the browser blocks every answer.
      const okPage = /^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(location.origin);
      if (!okPage && err instanceof TypeError) {
        pipSays("Beep… my radio can't get through from this page. (Grown-ups: start the game with “node tools/serve.mjs” and open http://localhost:5173.)");
      } else {
        pipSays("Beep… I can't reach mission control right now. Let's try again in a moment!");
      }
    } finally {
      clearTimeout(timer);
      if (session === mine) setBusy(false);
      if (session === mine && !el.input.disabled) el.input.focus({ preventScroll: true });
    }
  }

  function open({ explorerId, onState } = {}) {
    close();
    const info = EXPLORERS[explorerId] || { short: "the explorer", title: "Forgotten Explorer", chips: [] };
    return new Promise((resolve) => {
      session = { explorerId, info, onState, resolve, busy: false, audio: null, speakTimer: 0, controller: null };
      el.title.textContent = "Ask PIP about " + info.title;
      el.log.textContent = "";
      el.chips.textContent = "";
      info.chips.forEach((text) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chat-chip";
        b.textContent = text;
        b.addEventListener("click", () => ask(text));
        el.chips.appendChild(b);
      });
      el.panel.hidden = false;
      setBusy(false);
      pipSays(`Beep-boop! Ask me anything about ${info.short}. I'll radio it and pass on your question!`);
      setState("listening", "PIP is listening…");
      el.input.focus({ preventScroll: true });
    });
  }

  function close() {
    if (!session) return;
    const s = session;
    stopSpeaking();
    if (s.controller) s.controller.abort();
    session = null;
    el.panel.hidden = true;
    s.resolve();
  }

  el.form.addEventListener("submit", (e) => { e.preventDefault(); ask(el.input.value); });
  el.done.addEventListener("click", close);
  // Keys typed in the chat belong to the chat (not to the story's "Space = next")
  el.panel.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") close(); });
  el.panel.addEventListener("click", (e) => e.stopPropagation());

  window.AstroChat = {
    open,
    close,
    setMuted(m) {
      muted = !!m;
      if (muted && session && session.audio) { session.audio.pause(); session.audio.onended && session.audio.onended(); }
    },
  };
})();
