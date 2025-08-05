// js/main.js
import { fetchWithRetry } from './utils.js';

console.log('main.js loaded and starting execution');

let player, subtitles = [], isSyncing = false, currentLanguage = 'pt', activeTooltipId = null, currentVideoId = null;
const videosPerPage = 6;
let currentPage = 1;
let scrollTimeout = null;
let isUserScrolling = false;
let videos = [];
let lastHighlightedId = null;

const languages = [
  { code: 'pt', name: 'Português' },
  { code: 'en', name: 'English' }
];

async function fetchVideoFolders() {
  console.log('Starting fetchVideoFolders');
  try {
    const response = await fetchWithRetry('/api/videos');
    console.log('fetchVideoFolders: Response received', response);
    const data = await response.json();
    console.log('Raw /api/videos response:', JSON.stringify(data));
    if (!Array.isArray(data)) {
      console.error('Invalid /api/videos response: Expected array, got', data);
      return [];
    }
    const validFolders = data.filter(video => 
      video.id && typeof video.id === 'string' && 
      video.title && typeof video.title === 'string'
    );
    if (validFolders.length !== data.length) {
      console.warn(`Skipped ${data.length - validFolders.length} invalid video entries from /api/videos`);
    }
    console.log('Valid video folders:', validFolders);
    return validFolders;
  } catch (error) {
    console.error('Error fetching video folders:', error);
    return [];
  }
}

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

function parseSRT(srt) {
  console.log('Starting parseSRT');
  console.log(`SRT content length: ${srt.length}`);
  const subs = [], lines = srt.split('\n');
  console.log(`Number of lines: ${lines.length}`);
  let sub = null;
  for (let line of lines) {
    line = line.trim();
    console.log(`Processing line: ${line}`);
    if (/^\d+$/.test(line)) {
      if (sub) subs.push(sub);
      sub = { id: parseInt(line), text: '' };
      console.log(`New subtitle: ID ${sub.id}`);
    } else if (line.includes('-->')) {
      const [start, end] = line.split(' --> ').map(t => {
        const [h, m, s] = t.replace(',', '.').split(':');
        return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
      });
      sub.start = start;
      sub.end = end;
      console.log(`Time: ${start} --> ${end}`);
    } else if (sub) {
      sub.text += (sub.text ? '<br>' : '') + line;
      console.log(`Added text: ${line}`);
    }
  }
  if (sub) subs.push(sub);
  console.log(`Parsed ${subs.length} subtitles`);
  return subs;
}

function populateTranscript(containerId, subtitles, type) {
  console.log(`Starting populateTranscript for ${containerId}, type: ${type}, subtitles count: ${subtitles.length}`);
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container ${containerId} not found in DOM`);
    return;
  }
  container.innerHTML = '';
  subtitles.forEach(sub => {
    console.log(`Creating element for sub ID ${sub.id}`);
    const p = document.createElement('p');
    p.id = `${type}-${sub.id}`;
    p.className = 'transcript-p text-gray-800 dark:text-darkText p-2 cursor-pointer';
    p.innerHTML = sub.text;
    if (type === 'fr') {
      const toggle = document.createElement('span');
      toggle.className = 'phonetic-toggle text-purple-600 dark:text-purple-400 mr-2';
      toggle.textContent = '[P]';
      toggle.dataset.id = sub.id;
      toggle.onclick = (e) => {
        e.stopPropagation();
        console.log(`Phonetic toggle clicked for ID ${sub.id}`);
        if (activeTooltipId === sub.id) {
          hidePhoneticTooltip();
        } else {
          hidePhoneticTooltip();
          showPhoneticTooltip(sub.id, toggle);
        }
      };
      p.prepend(toggle);
    }
    p.onclick = () => {
      console.log(`Transcript clicked, seeking to ${sub.start}`);
      if (player && player.seekTo) {
        player.seekTo(sub.start, true);
        player.playVideo();
        centerHighlight();
      }
    };
    container.appendChild(p);
  });
  console.log(`Finished populateTranscript for ${containerId}`);
}

async function loadSubtitles(videoId, langCode) {
  console.log(`Starting loadSubtitles for videoId: ${videoId}, lang: ${langCode}`);
  if (!videoId) {
    console.error('loadSubtitles: videoId is undefined');
    document.getElementById('french-transcript').innerHTML = '<p class="text-red-500">Erro: ID do vídeo inválido</p>';
    document.getElementById('right-transcript').innerHTML = '<p class="text-red-500">Erro: ID do vídeo inválido</p>';
    return [];
  }
  try {
    const video = videos.find(v => v.id === videoId);
    console.log(`Found video: ${JSON.stringify(video)}`);
    if (!video) throw new Error(`Video ${videoId} not found in validated videos`);
    const frResponse = await fetchWithRetry(`texts/${video.folder}/original.fr.srt`);
    const frText = await frResponse.text();
    console.log(`FR SRT text length: ${frText.length}`);
    const otherResponse = await fetchWithRetry(`texts/${video.folder}/${langCode}.srt`);
    const otherText = await otherResponse.text();
    console.log(`${langCode.toUpperCase()} SRT text length: ${otherText.length}`);
    let phoneticText = '';
    try {
      const phoneticResponse = await fetchWithRetry(`texts/${video.folder}/phonetic.fr.srt`);
      phoneticText = await phoneticResponse.text();
      console.log(`Phonetic SRT text length: ${phoneticText.length}`);
    } catch (error) {
      console.warn('Phonetic file not found or failed to load:', error.message);
    }

    const fr = parseSRT(frText);
    const other = parseSRT(otherText);
    const phonetic = phoneticText ? parseSRT(phoneticText) : [];

    console.log(`Loaded ${fr.length} French subtitles, ${other.length} ${langCode} subtitles, ${phonetic.length} phonetic subtitles`);

    populateTranscript('french-transcript', fr, 'fr');
    populateTranscript('right-transcript', other, 'right');
    const titleElement = document.getElementById('right-transcript-title');
    if (titleElement) {
      titleElement.textContent = languages.find(l => l.code === langCode).name;
    } else {
      console.error('right-transcript-title element not found');
    }

    return fr.map((s, i) => ({
      id: s.id,
      start: s.start,
      end: s.end,
      fr: s.text,
      [langCode]: other[i]?.text || '',
      phonetic: phonetic[i]?.text || 'Transcrição fonética não disponível'
    }));
  } catch (error) {
    console.error('Error loading subtitles:', error);
    document.getElementById('french-transcript').innerHTML = `<p class="text-red-500">Erro ao carregar legendas: ${error.message}</p>`;
    document.getElementById('right-transcript').innerHTML = `<p class="text-red-500">Erro ao carregar legendas: ${error.message}</p>`;
    return [];
  }
}

function showPhoneticTooltip(id, toggle) {
  console.log(`Showing phonetic tooltip for subtitle ID ${id}`);
  const subtitle = subtitles.find(s => s.id === id);
  if (!subtitle) {
    console.error(`Subtitle with ID ${id} not found`);
    return;
  }
  const tooltip = document.getElementById('phonetic-tooltip');
  if (!tooltip) {
    console.error('phonetic-tooltip element not found');
    return;
  }
  const text = document.getElementById('phonetic-text');
  if (!text) {
    console.error('phonetic-text element not found');
    return;
  }
  text.innerHTML = subtitle.phonetic.replace(/\|/g, '<br>');
  console.log(`Displaying phonetic text: ${subtitle.phonetic}`);

  const rect = toggle.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  tooltip.style.top = `${rect.top + scrollTop - tooltipRect.height - 10}px`;
  tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltipRect.width / 2)}px`;

  const viewportWidth = window.innerWidth;
  if (parseFloat(tooltip.style.left) < 10) tooltip.style.left = '10px';
  if (parseFloat(tooltip.style.left) + tooltipRect.width > viewportWidth - 10) {
    tooltip.style.left = `${viewportWidth - tooltipRect.width - 10}px`;
  }

  tooltip.classList.remove('hidden');
  toggle.classList.add('active');
  activeTooltipId = id;
}

function hidePhoneticTooltip() {
  console.log('Hiding phonetic tooltip');
  const tooltip = document.getElementById('phonetic-tooltip');
  if (tooltip) {
    tooltip.classList.add('hidden');
  }
  if (activeTooltipId) {
    const toggle = document.querySelector(`.phonetic-toggle[data-id="${activeTooltipId}"]`);
    if (toggle) toggle.classList.remove('active');
    activeTooltipId = null;
  }
}

function loadVideo(videoId) {
  console.log(`Starting loadVideo for ${videoId}`);
  if (!videoId) {
    console.error('loadVideo: videoId is undefined');
    document.getElementById('french-transcript').innerHTML = '<p class="text-red-500">Erro: ID do vídeo inválido</p>';
    document.getElementById('right-transcript').innerHTML = '<p class="text-red-500">Erro: ID do vídeo inválido</p>';
    return;
  }
  if (player) {
    console.log('Destroying existing player');
    player.destroy();
  }
  if (typeof YT === 'undefined' || !YT.Player) {
    console.error('YouTube API not loaded');
    return;
  }
  player = new YT.Player('player', {
    videoId: videoId,
    playerVars: { 'playsinline': 1 },
    events: {
      onReady: async () => {
        console.log(`YouTube player loaded video ${videoId}`);
        subtitles = await loadSubtitles(videoId, currentLanguage);
        console.log(`Subtitles loaded: ${subtitles.length}`);
        if (subtitles.length > 0) {
          const firstSub = subtitles[0];
          document.getElementById(`fr-${firstSub.id}`)?.classList.add('highlight');
          document.getElementById(`right-${firstSub.id}`)?.classList.add('highlight');
          lastHighlightedId = firstSub.id;
          document.getElementById('center-highlight').disabled = false;
          centerHighlight();
        }
        syncScroll();
        currentVideoId = videoId;
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

    isSyncing = true;
    frContainer.scrollTo({ top: frTargetScroll, behavior: 'smooth' });
    rightContainer.scrollTo({ top: rightTargetScroll, behavior: 'smooth' });
    setTimeout(() => isSyncing = false, 600);
  } else {
    console.log('No highlight elements found');
  }
}

function checkTime() {
  console.log('Checking time');
  const time = player ? player.getCurrentTime() : 0;
  console.log(`Current time: ${time}`);
  let match = subtitles.find(s => time >= s.start && time < s.end);
  if (!match && subtitles.length > 0) {
    match = subtitles.find(s => s.id === lastHighlightedId) || subtitles[0];
    console.log(`Fallback match: ${match ? match.id : 'none'}`);
  }
  document.querySelectorAll('.transcript-p').forEach(el => {
    if (el.classList.contains('highlight') && (!match || el.id !== `fr-${match.id}` && el.id !== `right-${match.id}`)) {
      el.classList.add('highlight-exit');
      setTimeout(() => el.classList.remove('highlight', 'highlight-exit'), 300);
      console.log(`Removing highlight from ${el.id}`);
    }
  });
  const btn = document.getElementById('center-highlight');
  if (match) {
    const frElement = document.getElementById(`fr-${match.id}`);
    const otherElement = document.getElementById(`right-${match.id}`);
    if (frElement) frElement.classList.add('highlight');
    if (otherElement) otherElement.classList.add('highlight');
    lastHighlightedId = match.id;
    console.log(`Highlighting ${match.id}`);
    if (!isSyncing && !isUserScrolling && player && player.getPlayerState() === 1) {
      centerHighlight();
    }
    if (btn) btn.disabled = false;
  } else {
    if (btn) btn.disabled = true;
    console.log('No match found, disabling center button');
  }
  requestAnimationFrame(checkTime);
}

function syncScroll() {
  console.log('Setting up syncScroll');
  const fc = document.getElementById('french-container');
  const rc = document.getElementById('right-transcript-container');
  if (!fc || !rc) {
    console.error('Sync scroll containers not found');
    return;
  }
  fc.onscroll = () => {
    console.log('French container scrolled');
    if (!isSyncing) {
      isSyncing = true;
      isUserScrolling = true;
      rc.scrollTop = fc.scrollTop;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isUserScrolling = false;
        if (player && player.getPlayerState() === 1) {
          centerHighlight();
        }
      }, 4000);
      setTimeout(() => isSyncing = false, 50);
    }
  };
  rc.onscroll = () => {
    console.log('Right container scrolled');
    if (!isSyncing) {
      isSyncing = true;
      isUserScrolling = true;
      fc.scrollTop = rc.scrollTop;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isUserScrolling = false;
        if (player && player.getPlayerState() === 1) {
          centerHighlight();
        }
      }, 4000);
      setTimeout(() => isSyncing = false, 50);
    }
  };
}

function handleCenterHighlight(e) {
  console.log('Center highlight button clicked');
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const rect = e.currentTarget.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  e.currentTarget.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
  clearTimeout(scrollTimeout);
  isUserScrolling = false;
  centerHighlight();
}

function truncateTitle(title) {
  const maxLength = 30;
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3) + '...';
}

function populateVideoSidebar() {
  console.log('Starting populateVideoSidebar');
  const sidebar = document.getElementById('video-sidebar');
  if (!sidebar) {
    console.error('video-sidebar not found');
    return;
  }
  sidebar.innerHTML = '';
  videos.filter(v => v.id !== currentVideoId).forEach(video => {
    const titleWords = truncateTitle(video.title);
    console.log(`Adding sidebar card for ${video.id}`);
    const card = `<div class="video-card bg-white dark:bg-darkBg rounded-lg shadow-md overflow-hidden cursor-pointer" data-video="${video.id}">
      <img src="https://img.youtube.com/vi/${video.id}/0.jpg" alt="${titleWords}" class="w-full h-24 object-cover">
      <p class="text-sm font-medium text-gray-800 dark:text-darkText p-2">${titleWords}</p>
    </div>`;
    sidebar.innerHTML += card;
  });
  document.querySelectorAll('[data-video]').forEach(img => {
    img.onclick = () => {
      console.log(`Sidebar video clicked: ${img.getAttribute('data-video')}`);
      loadVideo(img.getAttribute('data-video'));
      hidePhoneticTooltip();
    };
  });
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
  console.log(`Total pages: ${totalPages}, currentPage: ${currentPage}`);
  const start = (currentPage - 1) * videosPerPage;
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
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
  }
  document.getElementById('first-page').disabled = currentPage === 1;
  document.getElementById('prev-page').disabled = currentPage === 1;
  document.getElementById('next-page').disabled = currentPage === totalPages;
  document.getElementById('last-page').disabled = currentPage === totalPages;
  document.querySelectorAll('#catalog-grid [data-video]').forEach(img => {
    img.onclick = () => {
      console.log(`Catalog video clicked: ${img.getAttribute('data-video')}`);
      loadVideo(img.getAttribute('data-video'));
      hidePhoneticTooltip();
    };
  });
  console.log('Finished populateCatalog');
}

const centerHighlightBtn = document.getElementById('center-highlight');
if (centerHighlightBtn) {
  centerHighlightBtn.onclick = handleCenterHighlight;
} else {
  console.error('center-highlight button not found');
}

const languageToggle = document.getElementById('language-toggle');
if (languageToggle) {
  languageToggle.onchange = async (e) => {
    console.log(`Language changed to ${e.target.value}`);
    currentLanguage = e.target.value;
    subtitles = await loadSubtitles(currentVideoId, currentLanguage);
    if (subtitles.length > 0) {
      const match = subtitles.find(s => s.id === lastHighlightedId) || subtitles[0];
      document.getElementById(`fr-${match.id}`)?.classList.add('highlight');
      document.getElementById(`right-${match.id}`)?.classList.add('highlight');
      lastHighlightedId = match.id;
      document.getElementById('center-highlight').disabled = false;
      centerHighlight();
    }
    syncScroll();
    hidePhoneticTooltip();
  };
} else {
  console.error('language-toggle not found');
}

const firstPageBtn = document.getElementById('first-page');
if (firstPageBtn) {
  firstPageBtn.onclick = () => {
    console.log('First page clicked');
    currentPage = 1;
    populateCatalog();
  };
} else {
  console.error('first-page button not found');
}

const prevPageBtn = document.getElementById('prev-page');
if (prevPageBtn) {
  prevPageBtn.onclick = () => {
    console.log('Prev page clicked');
    if (currentPage > 1) {
      currentPage--;
      populateCatalog();
    }
  };
} else {
  console.error('prev-page button not found');
}

const nextPageBtn = document.getElementById('next-page');
if (nextPageBtn) {
  nextPageBtn.onclick = () => {
    console.log('Next page clicked');
    if (currentPage < Math.ceil(videos.length / videosPerPage)) {
      currentPage++;
      populateCatalog();
    }
  };
} else {
  console.error('next-page button not found');
}

const lastPageBtn = document.getElementById('last-page');
if (lastPageBtn) {
  lastPageBtn.onclick = () => {
    console.log('Last page clicked');
    currentPage = Math.ceil(videos.length / videosPerPage);
    populateCatalog();
  };
} else {
  console.error('last-page button not found');
}

document.addEventListener('click', (e) => {
  if (!document.getElementById('phonetic-tooltip').classList.contains('hidden') &&
      !e.target.closest('#phonetic-tooltip') &&
      !e.target.classList.contains('phonetic-toggle')) {
    console.log('Click outside tooltip, hiding');
    hidePhoneticTooltip();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.getElementById('phonetic-tooltip').classList.contains('hidden')) {
    console.log('Escape key pressed, hiding tooltip');
    hidePhoneticTooltip();
  }
});

const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
  const root = document.documentElement;
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    root.classList.add('dark');
    themeToggle.textContent = 'Claro';
  } else {
    root.classList.remove('dark');
    themeToggle.textContent = 'Escuro';
  }

  themeToggle.onclick = () => {
    console.log('Theme toggle clicked');
    root.classList.toggle('dark');
    const isDark = root.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggle.textContent = isDark ? 'Claro' : 'Escuro';
  };
} else {
  console.error('theme-toggle not found');
}

window.onYouTubeIframeAPIReady = function() {
  console.log('YouTube IFrame API ready');
  validateVideos().then(() => {
    if (videos.length > 0) {
      currentVideoId = videos[0].id;
      console.log(`Loading first valid video: ${currentVideoId}`);
      loadVideo(currentVideoId);
    } else {
      console.error('No valid videos found, skipping video load');
    }
  });
};

console.log('Checking if YT API is loaded');
if (typeof YT === 'undefined') {
  console.error('YT API not defined. Make sure the YouTube IFrame API script is included in HTML.');
} else {
  console.log('YT API is available');
}

console.log('main.js execution finished');