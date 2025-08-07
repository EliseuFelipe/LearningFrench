import { fetchWithRetry } from './utils.js';
import { fetchVideoFolders } from './api.js';
import { setupEventListeners } from './events.js';
import { initPlayer, loadVideo } from './player.js';

console.log('main.js loaded and starting execution');

window.activeTooltipId = null;
const videosPerPage = 6;

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
  currentPage: 1,
  videos: []
};

async function validateVideos() {
  console.log('Starting validateVideos');
  appState.videos = [];
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
        appState.videos.push({ id: video.id, title: video.title, folder: video.id });
        console.log(`Validated video: ${video.id} - ${video.title}`);
      } else {
        console.warn(`Skipping video ${video.id}: Missing required SRT files (fr: ${frResponse.status}, pt: ${ptResponse.status}, en: ${enResponse.status})`);
      }
    } catch (error) {
      console.warn(`Skipping video ${video.id}: Error accessing SRT files - ${error.message}`);
    }
  }
  console.log(`Validated videos: ${JSON.stringify(appState.videos)}`);
  if (appState.videos.length === 0) {
    console.error('No valid videos found. Ensure the texts directory contains subfolders with original.fr.srt, pt.srt, and en.srt files.');
    document.getElementById('french-transcript').innerHTML = '<p class="text-red-500">Nenhum vídeo válido encontrado. Verifique se a pasta texts contém subpastas com os arquivos original.fr.srt, pt.srt e en.srt, e se o servidor está funcionando corretamente.</p>';
    document.getElementById('right-transcript').innerHTML = '<p class="text-red-500">Nenhum vídeo válido encontrado. Verifique se a pasta texts contém subpastas com os arquivos original.fr.srt, pt.srt e en.srt, e se o servidor está funcionando corretamente.</p>';
    document.getElementById('video-sidebar').innerHTML = '<p class="text-red-500 text-sm">Nenhum vídeo disponível. Verifique a pasta texts e o servidor.</p>';
    document.getElementById('catalog-grid').innerHTML = '<p class="text-red-500 text-sm">Nenhum vídeo disponível. Verifique a pasta texts e o servidor.</p>';
  } else {
    console.log('Populating sidebar and catalog');
  }
  console.log('Finished validateVideos');
}

initPlayer(appState, validateVideos, languages, videosPerPage, setupEventListeners);

console.log('main.js execution finished');