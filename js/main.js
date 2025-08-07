// js/main.js
import { fetchWithRetry, truncateTitle } from './utils.js';
import { loadSubtitles, parseSRT, populateTranscript, showPhoneticTooltip, hidePhoneticTooltip } from './subtitles.js';
import { fetchVideoFolders } from './api.js';
import { setupEventListeners, setupSyncScroll, attachVideoClickListeners } from './events.js';
import { populateVideoSidebar, populateCatalog, centerHighlight, updateHighlights } from './ui.js';

console.log('main.js loaded and starting execution');

// Define the callback first
window.onYouTubeIframeAPIReady = function() {
  console.log('YouTube IFrame API ready');
  validateVideos().then(() => {
    setupEventListeners(appState, { loadSubtitles, populateTranscript, centerHighlight, populateCatalog, languages, videosPerPage, videos });
    if (videos.length > 0) {
      appState.currentVideoId = videos[0].id;
      console.log(`Loading first valid video: ${appState.currentVideoId}`);
      loadVideo(appState.currentVideoId);
    } else {
      console.error('No valid videos found, skipping video load');
    }
  });
};

// Dynamically load the YouTube API script after setting the callback
console.log('Dynamically loading YouTube IFrame API');
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

window.activeTooltipId = null;
const videosPerPage = 6;
let videos = [];

const languages = [
  { code: 'pt', name: 'Português' },
  { code: 'en', name: 'English' }
];

let appState = {
  player: null,
  subtitles: [],
  isSyncing: false,
  currentLanguage: 'pt',
  currentVideoId: null,
  scrollTimeout: null,
  isUserScrolling: false,
  lastHighlightedId: null,
  currentPage: 1
};

async function validateVideos() {
  console.log('Starting validateVideos');
  videos = [];
  const candidateVideos = await fetchVideoFolders();
  console.log(`Candidate videos: ${JSON.stringify(candidateVideos)}`);
  for (const video of candidateVideos) {
    console.log(`Validating video: ${JSON.stringify(video)}`);
    if (!video.id || typeof video.id !== 'string') {
      console.warn(`Skipping invalid video ID: ${video.id}`);
      continue;
    }
    try {
      console.log(`Fetching SRT files for video ${video.id}`);
      const frResponse = await fetchWithRetry(`texts/${video.id}/original.fr.srt`);
      console.log(`FR SRT response: status ${frResponse.status}`);
      const ptResponse = await fetchWithRetry(`texts/${video.id}/pt.srt`);
      console.log(`PT SRT response: status ${ptResponse.status}`);
      const enResponse = await fetchWithRetry(`texts/${video.id}/en.srt`);
      console.log(`EN SRT response: status ${enResponse.status}`);
      if (frResponse.ok && ptResponse.ok && enResponse.ok) {
        videos.push({ id: video.id, title: video.title, folder: video.id });
        console.log(`Validated video: ${video.id} - ${video.title}`);
      } else {
        console.warn(`Skipping video ${video.id}: Missing required SRT files (fr: ${frResponse.status}, pt: ${ptResponse.status}, en: ${enResponse.status})`);
      }
    } catch (error) {
      console.warn(`Skipping video ${video.id}: Error accessing SRT files - ${error.message}`);
    }
  }
  console.log(`Validated videos: ${JSON.stringify(videos)}`);
  if (videos.length === 0) {
    console.error('No valid videos found. Ensure the texts directory contains subfolders with original.fr.srt, pt.srt, and en.srt files.');
    document.getElementById('french-transcript').innerHTML = '<p class="text-red-500">Nenhum vídeo válido encontrado. Verifique se a pasta texts contém subpastas com os arquivos original.fr.srt, pt.srt e en.srt, e se o servidor está funcionando corretamente.</p>';
    document.getElementById('right-transcript').innerHTML = '<p class="text-red-500">Nenhum vídeo válido encontrado. Verifique se a pasta texts contém subpastas com os arquivos original.fr.srt, pt.srt e en.srt, e se o servidor está funcionando corretamente.</p>';
    document.getElementById('video-sidebar').innerHTML = '<p class="text-red-500 text-sm">Nenhum vídeo disponível. Verifique a pasta texts e o servidor.</p>';
    document.getElementById('catalog-grid').innerHTML = '<p class="text-red-500 text-sm">Nenhum vídeo disponível. Verifique a pasta texts e o servidor.</p>';
  } else {
    console.log('Populating sidebar and catalog');
    populateVideoSidebar(videos, appState.currentVideoId, truncateTitle, attachVideoClickListeners, loadVideo, hidePhoneticTooltip);
    populateCatalog(videos, appState.currentPage, videosPerPage, truncateTitle, attachVideoClickListeners, loadVideo, hidePhoneticTooltip);
  }
  console.log('Finished validateVideos');
}

function loadVideo(videoId) {
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
        appState.subtitles = await loadSubtitles(videoId, appState.currentLanguage, videos, languages, populateTranscript, appState.player, centerHighlight);
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
        setupSyncScroll(appState, centerHighlight);
        appState.currentVideoId = videoId;
        populateVideoSidebar(videos, appState.currentVideoId, truncateTitle, attachVideoClickListeners, loadVideo, hidePhoneticTooltip);
        populateCatalog(videos, appState.currentPage, videosPerPage, truncateTitle, attachVideoClickListeners, loadVideo, hidePhoneticTooltip);
      },
      onStateChange: () => {
        console.log('Player state changed');
        requestAnimationFrame(checkTime)
      }
    }
  });
  console.log('Finished setting up player');
}

function checkTime() {
  const time = appState.player ? appState.player.getCurrentTime() : 0;
  let match = appState.subtitles.find(s => time >= s.start && time < s.end);
  if (!match && appState.subtitles.length > 0) {
    match = appState.subtitles.find(s => s.id === appState.lastHighlightedId) || appState.subtitles[0];
  }
  updateHighlights(match, appState);
  requestAnimationFrame(checkTime);
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

checkYouTubeAPI();

console.log('main.js execution finished');