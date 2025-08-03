let player, subtitles = [], isSyncing = false, currentLanguage = 'pt', activeTooltipId = null, currentVideoId = '5ovh-Ux_zRs';
const videosPerPage = 6;
let currentPage = 1;
let scrollTimeout = null;
let isUserScrolling = false;

const candidateVideos = [
  { id: '5ovh-Ux_zRs', title: 'Mais comment font-ils pour apprendre une langue?', folder: '5ovh-Ux_zRs' },
  { id: 'DnTzsWM_gbQ', title: 'New French Learning Video', folder: 'DnTzsWM_gbQ' } // Replace with actual YouTube title
];

let videos = [];

const languages = [
  { code: 'pt', name: 'Português' },
  { code: 'en', name: 'English' }
];

async function validateVideos() {
  videos = [];
  for (const video of candidateVideos) {
    try {
      const frResponse = await fetch(`texts/${video.folder}/original.fr.srt`);
      const ptResponse = await fetch(`texts/${video.folder}/pt.srt`);
      const enResponse = await fetch(`texts/${video.folder}/en.srt`);
      if (frResponse.ok && ptResponse.ok && enResponse.ok) {
        videos.push(video);
        console.log(`Validated video: ${video.id}`);
      } else {
        console.warn(`Skipping video ${video.id}: Missing required SRT files`);
      }
    } catch (error) {
      console.warn(`Skipping video ${video.id}: Error accessing SRT files`, error);
    }
  }
  if (videos.length === 0) {
    console.error('No valid videos found');
    document.getElementById('french-transcript').innerHTML = '<p class="text-red-500">Nenhum vídeo válido encontrado</p>';
    document.getElementById('right-transcript').innerHTML = '<p class="text-red-500">Nenhum vídeo válido encontrado</p>';
  }
  populateVideoSidebar();
  populateCatalog();
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

function populateTranscript(id, subs, prefix) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  for (const s of subs) {
    const p = document.createElement('p');
    p.className = 'transcript-p';
    p.id = `${prefix}-${s.id}`;
    if (prefix === 'fr') {
      p.innerHTML = `<span class="transcript-text">${s.text}</span><span class="phonetic-toggle" data-id="${s.id}" title="Mostrar pronúncia">[P]</span>`;
      p.querySelector('.transcript-text').onclick = () => {
        console.log(`Seeking to ${s.start} for subtitle ${s.id}`);
        player.seekTo(s.start, true);
        player.playVideo();
      };
      const toggle = p.querySelector('.phonetic-toggle');
      if (toggle) {
        toggle.onclick = () => {
          console.log(`Toggling phonetic tooltip for subtitle ${s.id}`);
          if (activeTooltipId === s.id) {
            hidePhoneticTooltip();
          } else {
            showPhoneticTooltip(s.id, toggle);
          }
        };
      }
    } else {
      p.innerHTML = s.text;
      p.onclick = () => {
        console.log(`Seeking to ${s.start} for subtitle ${s.id}`);
        player.seekTo(s.start, true);
        player.playVideo();
      };
    }
    el.appendChild(p);
  }
}

async function loadSubtitles(videoId, langCode) {
  try {
    const video = videos.find(v => v.id === videoId);
    if (!video) throw new Error(`Video ${videoId} not found in validated videos`);
    const frResponse = await fetch(`texts/${video.folder}/original.fr.srt`);
    if (!frResponse.ok) throw new Error(`Failed to fetch original.fr.srt: ${frResponse.status}`);
    const frText = await frResponse.text();

    const otherResponse = await fetch(`texts/${video.folder}/${langCode}.srt`);
    if (!otherResponse.ok) throw new Error(`Failed to fetch ${langCode}.srt: ${frResponse.status}`);
    const otherText = await otherResponse.text();

    let phoneticText = '';
    try {
      const phoneticResponse = await fetch(`texts/${video.folder}/phonetic.fr.srt`);
      if (!phoneticResponse.ok) throw new Error(`Failed to fetch phonetic.fr.srt: ${phoneticResponse.status}`);
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
    document.getElementById('french-transcript').innerHTML = '<p class="text-red-500">Erro ao carregar legendas</p>';
    document.getElementById('right-transcript').innerHTML = '<p class="text-red-500">Erro ao carregar legendas</p>';
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
  if (player.getPlayerState() !== 1) return;
  const time = player.getCurrentTime();
  const match = subtitles.find(s => time >= s.start && time < s.end);
  document.querySelectorAll('.transcript-p').forEach(el => {
    if (el.classList.contains('highlight')) {
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
    if (!isSyncing && !isUserScrolling) {
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
      }, 4000); // 4-second inactivity delay
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
      }, 4000); // 4-second inactivity delay
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

function populateVideoSidebar() {
  const sidebar = document.getElementById('video-sidebar');
  sidebar.innerHTML = '';
  videos.filter(v => v.id !== currentVideoId).forEach(video => {
    const titleWords = video.title.split(' ').slice(0, 5).join(' ');
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
    const titleWords = video.title.split(' ').slice(0, 5).join(' ');
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
      loadVideo(currentVideoId);
    } else {
      console.error('No valid videos found');
      document.getElementById('french-transcript').innerHTML = '<p class="text-red-500">Nenhum vídeo válido encontrado</p>';
      document.getElementById('right-transcript').innerHTML = '<p class="text-red-500">Nenhum vídeo válido encontrado</p>';
    }
  });
}