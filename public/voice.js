
/*
 * Space Buddies – Character Voice Narration
 * Uses browser Speech Synthesis API.
 */
(function () {
  "use strict";

  const synth = window.speechSynthesis;
  let currentUtterance = null;

  function speak(who, text) {
    if (!synth || !text) return;

    synth.cancel();

    if (window.AstroAudio?.muted) return;

    const utterance = new SpeechSynthesisUtterance(text);
    currentUtterance = utterance;
    utterance.lang = "en-US";
    utterance.volume = 0.9;

    const isPip = who === "robot" || who === "PIP";

    if (isPip) {
      utterance.pitch = 1.5;
      utterance.rate = 1.1;
    } else {
      utterance.pitch = 1.1;
      utterance.rate = 0.95;
    }

    const voices = synth.getVoices();

    const preferredVoice = isPip
      ? "Microsoft Mark - English (United States)"
       : "Google US English";

    const selectedVoice = voices.find(
      v => v.name === preferredVoice
    );

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    synth.speak(utterance);
  }

  function stop() {
    synth?.cancel();
  }

  window.AstroVoice = {
    speak,
    stop
  };
})();
