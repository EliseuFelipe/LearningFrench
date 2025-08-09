import { loadSubtitles, populateTranscript, hidePhoneticTooltip } from './subtitles.js';
import { setupSyncScroll, attachVideoClickListeners } from './events.js';
import { populateVideoSidebar, populateCatalog, centerHighlight, updateHighlights } from './ui.js';
import { truncateTitle } from '../utils/utils.js';

function initPlayer(appState, validateVideos, languages, videosPerPage, setupEventListeners) {
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  checkYouTubeAPI();

  function onYouTubeIframeAPIReady() {
    validateVideos().then(() => {
      setupEventListeners(appState, { loadSubtitles, populateTranscript, centerHighlight, populateCatalog, languages, videosPerPage, videos: appState.videos });
      if (appState.videos.length > 0) {
        appState.currentVideoId = appState.videos[0].id;
        loadVideo(appState.currentVideoId, appState, languages, videosPerPage);
      } else {
        console.error('No valid videos found, skipping video load');
      }
    });
  }

  window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
}

function loadVideo(videoId, appState, languages, videosPerPage) {
  if (!videoId) {
    document.getElementById('french-transcript').innerHTML = '<p class="text-red-500">Erro: ID do vídeo inválido</p>';
    document.getElementById('right-transcript').innerHTML = '<p class="text-red-500">Erro: ID do vídeo inválido</p>';
    return;
  }
  if (appState.player) {
    appState.player.destroy();
  }
  if (typeof YT === 'undefined' || !YT.Player) {
    return;
  }
  appState.player = new YT.Player('player', {
    videoId: videoId,
    playerVars: {
      'playsinline': 1,
      'rel': 0,          // Limita recomendações a vídeos do mesmo canal (não remove completamente devido a políticas do YouTube)
      'modestbranding': 1 // Remove o logo do YouTube para uma aparência mais clean
    },
    events: {
      onReady: async () => {
        appState.subtitles = await loadSubtitles(videoId, appState.currentLanguage, appState.videos, languages, populateTranscript, appState.player, () => centerHighlight(appState));
        window.subtitles = appState.subtitles;
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
        requestAnimationFrame(() => checkTime(appState));
      }
    }
  });
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

function checkYouTubeAPI(retries = 5, delay = 500) {
  if (typeof YT !== 'undefined') {
    console.log('YT API is available');
  } else if (retries > 0) {
    setTimeout(() => checkYouTubeAPI(retries - 1, delay), delay);
  } else {
    console.error('YT API not defined after retries. Make sure the YouTube IFrame API script is included and loads correctly.');
  }
}

export { initPlayer, loadVideo };