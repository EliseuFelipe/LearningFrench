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

async function fetchWithRetry(url, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (response.ok) return response;
      console.warn(`Fetch failed for ${url}: HTTP ${response.status}, retry ${i + 1}/${retries}`);
      if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      console.warn(`Fetch error for ${url}: ${error}, retry ${i + 1}/${retries}`);
      if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

async function fetchVideoFolders() {
  try {
    const response = await fetchWithRetry('/api/videos');
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
  videos = [];
  const candidateVideos = await fetchVideoFolders();
  for (const video of candidateVideos) {
    if (!video.id || typeof video.id !== 'string') {
      console.warn(`Skipping invalid video ID: ${video.id}`);
      continue;
    }
    try {
      const frResponse = await fetchWithRetry(`texts/${video.id}/original.fr.srt`);
      const ptResponse = await fetchWithRetry(`texts/${video.id}/pt.srt`);
      const enResponse = await fetchWithRetry(`texts/${video.id}/en.srt`);
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
  if (videos.length === 0) {
    console.error('No valid videos found. Ensure the texts directory contains subfolders with original.fr.srt, pt.srt, and en.srt files.');
    document.getElementById('french-transcript').innerHTML = '<p class="text-red-500">Nenhum vídeo válido encontrado. Verifique se a pasta texts contém subpastas com os arquivos original.fr.srt, pt.srt e en.srt, e se o servidor está funcionando corretamente.</p>';
    document.getElementById('right-transcript').innerHTML = '<p class="text-red-500">Nenhum vídeo válido encontrado. Verifique se a pasta texts contém subpastas com os arquivos original.fr.srt, pt.srt e en.srt, e se o servidor está funcionando corretamente.</p>';
    document.getElementById('video-sidebar').innerHTML = '<p class="text-red-500 text-sm">Nenhum vídeo disponível. Verifique a pasta texts e o servidor.</p>';
    document.getElementById('catalog-grid').innerHTML = '<p class="text-red-500 text-sm">Nenhum vídeo disponível. Verifique a pasta texts e o servidor.</p>';
  } else {
    populateVideoSidebar();
    populateCatalog();
  }
}

function parseSRT(srt) {
  const subs = [], lines = srt.split('\n');
  let sub = null;
  for (let line of lines) {
    line = line.trim();
    if (/^\d+$/.test(line)) {
      if (sub) subs.push(sub);
      sub = { id: parseInt(line), text: '' };
    } else if (line.includes('-->')) {
      const [start, end] = line.split(' --> ').map(t => {
        const [h, m, s] = t.replace(',', '.').split(':');
        return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
      });
      sub.start = start;
      sub.end = end;
    } else if (sub) {
      sub.text += (sub.text ? '<br>' : '') + line;
    }
  }
  if (sub) subs.push(sub);
  return subs;
}

function populateTranscript(containerId, subtitles, type) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  subtitles.forEach(sub => {
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
      if (player && player.seekTo) {
        player.seekTo(sub.start, true);
        player.playVideo();
        centerHighlight();
      }
    };
    container.appendChild(p);
  });
}

async function loadSubtitles(videoId, langCode) {
  if (!videoId) {
    console.error('loadSubtitles: videoId is undefined');
    document.getElementById('french-transcript').innerHTML = '<p class="text-red-500">Erro: ID do vídeo inválido</p>';
    document.getElementById('right-transcript').innerHTML = '<p class="text-red-500">Erro: ID do vídeo inválido</p>';
    return [];
  }
  try {
    const video = videos.find(v => v.id === videoId);
    if (!video) throw new Error(`Video ${videoId} not found in validated videos`);
    const frResponse = await fetchWithRetry(`texts/${video.folder}/original.fr.srt`);
    const frText = await frResponse.text();
    const otherResponse = await fetchWithRetry(`texts/${video.folder}/${langCode}.srt`);
    const otherText = await otherResponse.text();
    let phoneticText = '';
    try {
      const phoneticResponse = await fetchWithRetry(`texts/${video.folder}/phonetic.fr.srt`);
      phoneticText = await phoneticResponse.text();
    } catch (error) {
      console.warn('Phonetic file not found or failed to load:', error.message);
    }

    const fr = parseSRT(frText);
    const other = parseSRT(otherText);
    const phonetic = phoneticText ? parseSRT(phoneticText) : [];

    console.log(`Loaded ${fr.length} French subtitles, ${other.length} ${langCode} subtitles, ${phonetic.length} phonetic subtitles`);

    populateTranscript('french-transcript', fr, 'fr');
    populateTranscript('right-transcript', other, 'right');
    document.getElementById('right-transcript-title').textContent = languages.find(l => l.code === langCode).name;

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
  const text = document.getElementById('phonetic-text');
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
  tooltip.classList.add('hidden');
  if (activeTooltipId) {
    const toggle = document.querySelector(`.phonetic-toggle[data-id="${activeTooltipId}"]`);
    if (toggle) toggle.classList.remove('active');
    activeTooltipId = null;
  }
}

function loadVideo(videoId) {
  if (!videoId) {
    console.error('loadVideo: videoId is undefined');
    document.getElementById('french-transcript').innerHTML = '<p class="text-red-500">Erro: ID do vídeo inválido</p>';
    document.getElementById('right-transcript').innerHTML = '<p class="text-red-500">Erro: ID do vídeo inválido</p>';
    return;
  }
  if (player) {
    player.destroy();
  }
  player = new YT.Player('player', {
    videoId: videoId,
    playerVars: { 'playsinline': 1 },
    events: {
      onReady: async () => {
        console.log(`YouTube player loaded video ${videoId}`);
        subtitles = await loadSubtitles(videoId, currentLanguage);
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
      onStateChange: () => requestAnimationFrame(checkTime)
    }
  });
}

function centerHighlight() {
  const frElement = document.querySelector('#french-transcript .highlight');
  const otherElement = document.querySelector('#right-transcript .highlight');
  if (frElement && otherElement) {
    const frContainer = document.getElementById('french-container');
    const rightContainer = document.getElementById('right-transcript-container');
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
  }
}

function checkTime() {
  const time = player.getCurrentTime();
  let match = subtitles.find(s => time >= s.start && time < s.end);
  if (!match && subtitles.length > 0) {
    match = subtitles.find(s => s.id === lastHighlightedId) || subtitles[0];
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
    lastHighlightedId = match.id;
    if (!isSyncing && !isUserScrolling && player.getPlayerState() === 1) {
      centerHighlight();
    }
    btn.disabled = false;
  } else {
    btn.disabled = true;
  }
  requestAnimationFrame(checkTime);
}

function syncScroll() {
  const fc = document.getElementById('french-container');
  const rc = document.getElementById('right-transcript-container');
  fc.onscroll = () => {
    if (!isSyncing) {
      isSyncing = true;
      isUserScrolling = true;
      rc.scrollTop = fc.scrollTop;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isUserScrolling = false;
        if (player.getPlayerState() === 1) {
          centerHighlight();
        }
      }, 4000);
      setTimeout(() => isSyncing = false, 50);
    }
  };
  rc.onscroll = () => {
    if (!isSyncing) {
      isSyncing = true;
      isUserScrolling = true;
      fc.scrollTop = rc.scrollTop;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isUserScrolling = false;
        if (player.getPlayerState() === 1) {
          centerHighlight();
        }
      }, 4000);
      setTimeout(() => isSyncing = false, 50);
    }
  };
}

function handleCenterHighlight(e) {
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
  const sidebar = document.getElementById('video-sidebar');
  sidebar.innerHTML = '';
  videos.filter(v => v.id !== currentVideoId).forEach(video => {
    const titleWords = truncateTitle(video.title);
    const card = `<div class="video-card bg-white dark:bg-darkBg rounded-lg shadow-md overflow-hidden cursor-pointer" data-video="${video.id}">
      <img src="https://img.youtube.com/vi/${video.id}/0.jpg" alt="${titleWords}" class="w-full h-24 object-cover">
      <p class="text-sm font-medium text-gray-800 dark:text-darkText p-2">${titleWords}</p>
    </div>`;
    sidebar.innerHTML += card;
  });
  document.querySelectorAll('[data-video]').forEach(img => {
    img.onclick = () => {
      loadVideo(img.getAttribute('data-video'));
      hidePhoneticTooltip();
    };
  });
}

function populateCatalog() {
  const grid = document.getElementById('catalog-grid');
  grid.innerHTML = '';
  const totalPages = Math.ceil(videos.length / videosPerPage);
  const start = (currentPage - 1) * videosPerPage;
  const end = start + videosPerPage;
  videos.slice(start, end).forEach(video => {
    const titleWords = truncateTitle(video.title);
    const div = document.createElement('div');
    div.className = 'video-card bg-white dark:bg-darkBg rounded-lg shadow-md overflow-hidden cursor-pointer';
    div.dataset.video = video.id;
    div.innerHTML = `<img src="https://img.youtube.com/vi/${video.id}/0.jpg" alt="${titleWords}" class="w-full h-32 object-cover">
      <p class="text-sm font-medium text-gray-800 dark:text-darkText p-2">${titleWords}</p>`;
    grid.appendChild(div);
  });
  document.getElementById('page-info').textContent = `Página ${currentPage} de ${totalPages}`;
  document.getElementById('first-page').disabled = currentPage === 1;
  document.getElementById('prev-page').disabled = currentPage === 1;
  document.getElementById('next-page').disabled = currentPage === totalPages;
  document.getElementById('last-page').disabled = currentPage === totalPages;
  document.querySelectorAll('#catalog-grid [data-video]').forEach(img => {
    img.onclick = () => {
      loadVideo(img.getAttribute('data-video'));
      hidePhoneticTooltip();
    };
  });
}

document.getElementById('center-highlight').onclick = handleCenterHighlight;

document.getElementById('language-toggle').onchange = async (e) => {
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

document.getElementById('first-page').onclick = () => {
  currentPage = 1;
  populateCatalog();
};

document.getElementById('prev-page').onclick = () => {
  if (currentPage > 1) {
    currentPage--;
    populateCatalog();
  }
};

document.getElementById('next-page').onclick = () => {
  if (currentPage < Math.ceil(videos.length / videosPerPage)) {
    currentPage++;
    populateCatalog();
  }
};

document.getElementById('last-page').onclick = () => {
  currentPage = Math.ceil(videos.length / videosPerPage);
  populateCatalog();
};

document.addEventListener('click', (e) => {
  if (!document.getElementById('phonetic-tooltip').classList.contains('hidden') &&
      !e.target.closest('#phonetic-tooltip') &&
      !e.target.classList.contains('phonetic-toggle')) {
    hidePhoneticTooltip();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.getElementById('phonetic-tooltip').classList.contains('hidden')) {
    hidePhoneticTooltip();
  }
});

const themeToggle = document.getElementById('theme-toggle');
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
  root.classList.toggle('dark');
  const isDark = root.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  themeToggle.textContent = isDark ? 'Claro' : 'Escuro';
};

function onYouTubeIframeAPIReady() {
  validateVideos().then(() => {
    if (videos.length > 0) {
      currentVideoId = videos[0].id;
      console.log(`Loading first valid video: ${currentVideoId}`);
      loadVideo(currentVideoId);
    } else {
      console.error('No valid videos found, skipping video load');
    }
  });
}