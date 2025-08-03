let player, subtitles = [], isSyncing = false, currentLanguage = 'pt', activeTooltipId = null;

const languages = [
  { code: 'pt', name: 'Português' },
  { code: 'en', name: 'English' }
];

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
      p.innerHTML = `<span class="transcript-text">${s.text}</span><span class="phonetic-toggle" data-id="${s.id}" title="Mostrar pronúncia">[ɸ]</span>`;
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

async function loadSubtitles(langCode) {
  try {
    const frResponse = await fetch('texts/0001/original.fr.srt');
    if (!frResponse.ok) throw new Error(`Failed to fetch original.fr.srt: ${frResponse.status}`);
    const frText = await frResponse.text();

    const otherResponse = await fetch(`texts/0001/${langCode}.srt`);
    if (!otherResponse.ok) throw new Error(`Failed to fetch ${langCode}.srt: ${otherResponse.status}`);
    const otherText = await otherResponse.text();

    let phoneticText = '';
    try {
      const phoneticResponse = await fetch('texts/0001/phonetic.fr.srt');
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

  // Position tooltip above the toggle
  const rect = toggle.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  tooltip.style.top = `${rect.top + scrollTop - tooltipRect.height - 10}px`;
  tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltipRect.width / 2)}px`;

  // Adjust for screen edges
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

function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    videoId: '5ovh-Ux_zRs',
    playerVars: { 'playsinline': 1 },
    events: {
      onReady: async () => {
        console.log('YouTube player ready');
        subtitles = await loadSubtitles(currentLanguage);
        syncScroll();
      },
      onStateChange: () => requestAnimationFrame(checkTime)
    }
  });
}

function checkTime() {
  if (player.getPlayerState() !== 1) return;
  const time = player.getCurrentTime();
  const match = subtitles.find(s => time >= s.start && time < s.end);
  document.querySelectorAll('.transcript-p').forEach(el => el.classList.remove('highlight'));
  const btn = document.getElementById('scroll-to-highlight');
  if (match) {
    const frElement = document.getElementById(`fr-${match.id}`);
    const otherElement = document.getElementById(`right-${match.id}`);
    if (frElement) frElement.classList.add('highlight');
    if (otherElement) otherElement.classList.add('highlight');
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
      rc.scrollTop = fc.scrollTop;
      setTimeout(() => isSyncing = false, 50);
    }
  };
  rc.onscroll = () => {
    if (!isSyncing) {
      isSyncing = true;
      fc.scrollTop = rc.scrollTop;
      setTimeout(() => isSyncing = false, 50);
    }
  };
}

function scrollToHighlight(e) {
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const rect = e.currentTarget.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  e.currentTarget.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
  const frElement = document.querySelector('#french-transcript .highlight');
  const otherElement = document.querySelector('#right-transcript .highlight');
  if (frElement && otherElement) {
    isSyncing = true;
    frElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    otherElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => isSyncing = false, 50);
  }
}

document.getElementById('scroll-to-highlight').onclick = scrollToHighlight;

// Video Catalog
document.querySelectorAll('[data-video]').forEach(img => {
  img.onclick = () => {
    player.loadVideoById(img.getAttribute('data-video'));
    document.getElementById('catalog-section')?.classList.add('hidden');
    hidePhoneticTooltip();
  };
});

// Toggle Mobile Catalog
document.getElementById('toggle-catalog').onclick = () => {
  const sec = document.getElementById('catalog-section');
  sec.classList.toggle('hidden');
};

// Language Toggle
document.getElementById('language-toggle').onchange = async (e) => {
  currentLanguage = e.target.value;
  subtitles = await loadSubtitles(currentLanguage);
  syncScroll();
  hidePhoneticTooltip();
};

// Phonetic Tooltip
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

// Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
const root = document.documentElement;
const saved = localStorage.getItem('theme');
if (saved === 'dark') root.classList.add('dark');
if (saved === 'light') root.classList.remove('dark');
themeToggle.textContent = root.classList.contains('dark') ? '🌞' : '🌙';

themeToggle.onclick = () => {
  root.classList.toggle('dark');
  const isDark = root.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  themeToggle.textContent = isDark ? '🌞' : '🌙';
};