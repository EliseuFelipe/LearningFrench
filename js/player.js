import { loadSubtitles, populateTranscript, hidePhoneticTooltip } from './subtitles.js';
import { setupSyncScroll, attachVideoClickListeners } from './events.js';
import { populateVideoSidebar, populateCatalog, centerHighlight, updateHighlights } from './ui.js';
import { truncateTitle } from './utils.js';

function initPlayer(appState, validateVideos, languages, videosPerPage, setupEventListeners) {
  console.log('Dynamically loading YouTube IFrame API');
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  checkYouTubeAPI();

  function onYouTubeIframeAPIReady() {
    console.log('YouTube IFrame API ready');
    validateVideos().then(() => {
      setupEventListeners(appState, { loadSubtitles, populateTranscript, centerHighlight, populateCatalog, languages, videosPerPage, videos: appState.videos });
      if (appState.videos.length > 0) {
        appState.currentVideoId = appState.videos[0].id;
        console.log(`Loading first valid video: ${appState.currentVideoId}`);
        loadVideo(appState.currentVideoId, appState, languages, videosPerPage);
      } else {
        console.error('No valid videos found, skipping video load');
      }
    });
  }

  window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
}

function loadVideo(videoId, appState, languages, videosPerPage) {
  console.log(`Starting loadVideo for ${videoId}`);
  if (!videoId) {
    console.error('loadVideo: videoId is undefined');
    document.getElementById('french-transcript').innerHTML = '<p class="text-red-500">Erro: ID do vídeo inválido</p>';
    document.getElementById('right-transcript').innerHTML = '<p class="text-red-500">Erro: ID do vídeo inválido</p>';
    return;
  }
  if (appState.player) {
    console.log('Destroying existing player');
    appState.player.destroy();
  }
  if (typeof YT === 'undefined' || !YT.Player) {
    console.error('YouTube API not loaded');
    return;
  }
  appState.player = new YT.Player('player', {
    videoId: videoId,
    playerVars: { 'playsinline': 1 },
    events: {
      onReady: async () => {
        console.log(`YouTube player loaded video ${videoId}`);
        appState.subtitles = await loadSubtitles(videoId, appState.currentLanguage, appState.videos, languages, populateTranscript, appState.player, () => centerHighlight(appState));
        window.subtitles = appState.subtitles;
        console.log(`Subtitles loaded: ${appState.subtitles.length}`);
        if (appState.subtitles.length > 0) {
          const firstSub = appState.subtitles[0];
          document.getElementById(`fr-${firstSub.id}`)?.classList.add('highlight');
          document.getElementById(`right-${firstSub.id}`)?.classList.add('highlight');
          appState.lastHighlightedId = firstSub.id;
          document.getElementById('center-highlight').disabled = false;
          centerHighlight(appState);
        }
        setupSyncScroll(appState, () => centerHighlight(appState));
        appState.currentVideoId = videoId;
        populateVideoSidebar(appState.videos, appState.currentVideoId, truncateTitle, attachVideoClickListeners, (vid) => loadVideo(vid, appState, languages, videosPerPage), hidePhoneticTooltip);
        populateCatalog(appState.videos, appState.currentPage, videosPerPage, truncateTitle, attachVideoClickListeners, (vid) => loadVideo(vid, appState, languages, videosPerPage), hidePhoneticTooltip);
      },
      onStateChange: () => {
        console.log('Player state changed');
        requestAnimationFrame(() => checkTime(appState));
      }
    }
  });
  console.log('Finished setting up player');
}

function checkTime(appState) {
  const time = appState.player ? appState.player.getCurrentTime() : 0;
  let match = appState.subtitles.find(s => time >= s.start && time < s.end);
  if (!match && appState.subtitles.length > 0) {
    match = appState.subtitles.find(s => s.id === appState.lastHighlightedId) || appState.subtitles[0];
  }
  updateHighlights(match, appState);
  requestAnimationFrame(() => checkTime(appState));
}

// Updated YT API check with retry to avoid false warning
function checkYouTubeAPI(retries = 5, delay = 500) {
  console.log('Checking if YT API is loaded');
  if (typeof YT !== 'undefined') {
    console.log('YT API is available');
  } else if (retries > 0) {
    console.log(`YT API not ready yet, retrying in ${delay}ms...`);
    setTimeout(() => checkYouTubeAPI(retries - 1, delay), delay);
  } else {
    console.error('YT API not defined after retries. Make sure the YouTube IFrame API script is included and loads correctly.');
  }
}

export { initPlayer, loadVideo };