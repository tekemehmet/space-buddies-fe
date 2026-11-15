const startButton = document.getElementById("startButton");
const welcomeScreen = document.getElementById("welcomeScreen");
const storyScreen = document.getElementById("storyScreen");
const storyEnd = document.getElementById("storyEnd");
const playAgainButton = document.getElementById("playAgainButton");
const backButton = document.getElementById("backButton");

const soundToggle = document.getElementById("soundToggle");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Sound on/off button (remembered between visits)
function showSoundState() {
  const muted = window.AstroAudio ? window.AstroAudio.muted : false;
  soundToggle.setAttribute("aria-pressed", String(!muted));
  soundToggle.setAttribute("aria-label", muted ? "Sound off" : "Sound on");
  soundToggle.classList.toggle("is-muted", muted);
}
soundToggle.addEventListener("click", () => {
  if (!window.AstroAudio) return;
  window.AstroAudio.setMuted(!window.AstroAudio.muted);
  if (window.AstroChat) window.AstroChat.setMuted(window.AstroAudio.muted); // also silences explorer answers
  showSoundState();
});
showSoundState();
if (window.AstroChat && window.AstroAudio) window.AstroChat.setMuted(window.AstroAudio.muted);

function startStory() {
  // (story.js hides the end card itself once the screen is covered, so "Play again" doesn't flash)
  storyScreen.hidden = false;
  if (window.AstroStory) window.AstroStory.start();
}

startButton.addEventListener("click", async () => {
  if (welcomeScreen.classList.contains("is-launching")) return;

  welcomeScreen.classList.add("is-launching");
  startButton.disabled = true;

  // Wake the sound up (needs a click) with a whoosh for the warp
  if (window.AstroAudio) {
    window.AstroAudio.start();
    window.AstroAudio.sfx("whoosh");
  }

  // Warp transition on the welcome screen (falls back to a short pause if 3D isn't available)
  if (window.astroScene) {
    await window.astroScene.launch();
  } else {
    await wait(800);
  }

  startStory();
});

playAgainButton.addEventListener("click", () => {
  if (window.AstroAudio) window.AstroAudio.start();
  startStory();
});

backButton.addEventListener("click", () => {
  if (window.AstroStory) window.AstroStory.stop();
  if (window.AstroAudio) window.AstroAudio.stop();
  storyScreen.hidden = true;
  storyEnd.hidden = true;

  welcomeScreen.classList.remove("is-launching");
  startButton.disabled = false;

  if (window.astroScene) {
    window.astroScene.resume();
    window.astroScene.reset();
  }

  startButton.focus();
});
