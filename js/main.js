// js/main.js
import { fetchWithRetry, truncateTitle } from './utils.js';
import { loadSubtitles, parseSRT, populateTranscript, showPhoneticTooltip, hidePhoneticTooltip } from './subtitles.js';
import { fetchVideoFolders } from './api.js';
import { setupEventListeners, setupSyncScroll, attachVideoClickListeners } from './events.js';

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
    populateVideoSidebar();
    populateCatalog();
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
          centerHighlight();
        }
        setupSyncScroll(appState, centerHighlight);
        appState.currentVideoId = videoId;
        populateVideoSidebar();
        populateCatalog();
      },
      onStateChange: () => {
        console.log('Player state changed');
        requestAnimationFrame(checkTime)
      }
    }
  });
  console.log('Finished setting up player');
}

function centerHighlight() {
  console.log('Starting centerHighlight');
  const frElement = document.querySelector('#french-transcript .highlight');
  const otherElement = document.querySelector('#right-transcript .highlight');
  if (frElement && otherElement) {
    console.log('Found highlight elements');
    const frContainer = document.getElementById('french-container');
    const rightContainer = document.getElementById('right-transcript-container');
    if (!frContainer || !rightContainer) {
      console.error('Transcript containers not found');
      return;
    }
    const frRect = frElement.getBoundingClientRect();
    const rightRect = otherElement.getBoundingClientRect();
    const frContainerRect = frContainer.getBoundingClientRect();
    const rightContainerRect = rightContainer.getBoundingClientRect();
    
    const frTargetScroll = frContainer.scrollTop + frRect.top - frContainerRect.top - (frContainerRect.height - frRect.height) / 2;
    const rightTargetScroll = rightContainer.scrollTop + rightRect.top - rightContainerRect.top - (rightContainerRect.height - rightRect.height) / 2;

    appState.isSyncing = true;
    frContainer.scrollTo({ top: frTargetScroll, behavior: 'smooth' });
    rightContainer.scrollTo({ top: rightTargetScroll, behavior: 'smooth' });
    setTimeout(() => appState.isSyncing = false, 600);
  } else {
    console.log('No highlight elements found');
  }
}

function checkTime() {
  const time = appState.player ? appState.player.getCurrentTime() : 0;
  let match = appState.subtitles.find(s => time >= s.start && time < s.end);
  if (!match && appState.subtitles.length > 0) {
    match = appState.subtitles.find(s => s.id === appState.lastHighlightedId) || appState.subtitles[0];
  }
  document.querySelectorAll('.transcript-p').forEach(el => {
    if (el.classList.contains('highlight') && (!match || el.id !== `fr-${match.id}` && el.id !== `right-${match.id}`)) {
      el.classList.add('highlight-exit');
      setTimeout(() => el.classList.remove('highlight', 'highlight-exit'), 300);
    }
  });
  const btn = document.getElementById('center-highlight');
  if (match) {
    const frElement = document.getElementById(`fr-${match.id}`);
    const otherElement = document.getElementById(`right-${match.id}`);
    if (frElement) frElement.classList.add('highlight');
    if (otherElement) otherElement.classList.add('highlight');
    appState.lastHighlightedId = match.id;
    if (!appState.isSyncing && !appState.isUserScrolling && appState.player && appState.player.getPlayerState() === 1) {
      centerHighlight();
    }
    btn.disabled = false;
  } else {
    btn.disabled = true;
    console.log('No match found, disabling center button');
  }
  requestAnimationFrame(checkTime);
}

function populateVideoSidebar() {
  console.log('Starting populateVideoSidebar');
  const sidebar = document.getElementById('video-sidebar');
  if (!sidebar) {
    console.error('video-sidebar not found');
    return;
  }
  sidebar.innerHTML = '';
  videos.filter(v => v.id !== appState.currentVideoId).forEach(video => {
    const titleWords = truncateTitle(video.title);
    console.log(`Adding sidebar card for ${video.id}`);
    const card = `<div class="video-card bg-white dark:bg-darkBg rounded-lg shadow-md overflow-hidden cursor-pointer" data-video="${video.id}">
      <img src="https://img.youtube.com/vi/${video.id}/0.jpg" alt="${titleWords}" class="w-full h-24 object-cover">
      <p class="text-sm font-medium text-gray-800 dark:text-darkText p-2">${titleWords}</p>
    </div>`;
    sidebar.innerHTML += card;
  });
  attachVideoClickListeners('#video-sidebar [data-video]', loadVideo, hidePhoneticTooltip);
  console.log('Finished populateVideoSidebar');
}

function populateCatalog() {
  console.log('Starting populateCatalog');
  const grid = document.getElementById('catalog-grid');
  if (!grid) {
    console.error('catalog-grid not found');
    return;
  }
  grid.innerHTML = '';
  const totalPages = Math.ceil(videos.length / videosPerPage);
  console.log(`Total pages: ${totalPages}, currentPage: ${appState.currentPage}`);
  const start = (appState.currentPage - 1) * videosPerPage;
  const end = start + videosPerPage;
  videos.slice(start, end).forEach(video => {
    const titleWords = truncateTitle(video.title);
    console.log(`Adding catalog card for ${video.id}`);
    const div = document.createElement('div');
    div.className = 'video-card bg-white dark:bg-darkBg rounded-lg shadow-md overflow-hidden cursor-pointer';
    div.dataset.video = video.id;
    div.innerHTML = `<img src="https://img.youtube.com/vi/${video.id}/0.jpg" alt="${titleWords}" class="w-full h-32 object-cover">
      <p class="text-sm font-medium text-gray-800 dark:text-darkText p-2">${titleWords}</p>`;
    grid.appendChild(div);
  });
  const pageInfo = document.getElementById('page-info');
  if (pageInfo) {
    pageInfo.textContent = `Página ${appState.currentPage} de ${totalPages}`;
  }
  document.getElementById('first-page').disabled = appState.currentPage === 1;
  document.getElementById('prev-page').disabled = appState.currentPage === 1;
  document.getElementById('next-page').disabled = appState.currentPage === totalPages;
  document.getElementById('last-page').disabled = appState.currentPage === totalPages;
  attachVideoClickListeners('#catalog-grid [data-video]', loadVideo, hidePhoneticTooltip);
  console.log('Finished populateCatalog');
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