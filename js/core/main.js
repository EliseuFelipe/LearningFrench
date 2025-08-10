import { fetchWithRetry } from '../utils/utils.js';
import { fetchVideoFolders } from '../modules/api.js';
import { setupEventListeners } from '../modules/events.js';
import { initPlayer, loadVideo } from '../modules/player.js';


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
  appState.videos = [];
  console.log('Starting validateVideos');  // Log inicial
  const candidateVideos = await fetchVideoFolders();
  console.log('Candidate videos from API:', JSON.stringify(candidateVideos));  // Log candidates
  for (const video of candidateVideos) {
    if (!video.id || typeof video.id !== 'string') {
      console.warn(`Skipping invalid video ID: ${video.id}`);
      continue;
    }
    try {
      const frResponse = await fetchWithRetry(`texts/${video.id}/original.fr.srt`);
      const ptResponse = await fetchWithRetry(`texts/${video.id}/pt.srt`);
      const enResponse = await fetchWithRetry(`texts/${video.id}/en.srt`);
      console.log(`Validation for ${video.id}: fr=${frResponse.ok}, pt=${ptResponse.ok}, en=${enResponse.ok}`);  // Log por video
      if (frResponse.ok && ptResponse.ok && enResponse.ok) {
        appState.videos.push({ id: video.id, title: video.title, folder: video.id });
      } else {
        console.warn(`Skipping video ${video.id}: Missing required SRT files (fr: ${frResponse.status}, pt: ${ptResponse.status}, en: ${enResponse.status})`);
      }
    } catch (error) {
      console.warn(`Skipping video ${video.id}: Error accessing SRT files - ${error.message}`);
    }
  }
  console.log(`Validated videos: ${JSON.stringify(appState.videos)}`);  // Log final
  if (appState.videos.length === 0) {
    document.getElementById('french-transcript').innerHTML = '<p class="text-red-500">Nenhum vídeo válido encontrado. Verifique se a pasta texts contém subpastas com os arquivos original.fr.srt, pt.srt e en.srt, e se o servidor está funcionando corretamente.</p>';
    document.getElementById('right-transcript').innerHTML = '<p class="text-red-500">Nenhum vídeo válido encontrado. Verifique se a pasta texts contém subpastas com os arquivos original.fr.srt, pt.srt e en.srt, e se o servidor está funcionando corretamente.</p>';
    document.getElementById('video-sidebar').innerHTML = '<p class="text-red-500 text-sm">Nenhum vídeo disponível. Verifique a pasta texts e o servidor.</p>';
  }
  console.log('Finished validateVideos');
}

initPlayer(appState, validateVideos, languages, videosPerPage, setupEventListeners);