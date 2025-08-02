let player, subtitles = [], isSyncing = false;

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
    p.innerHTML = s.text;
    p.onclick = () => { player.seekTo(s.start, true); player.playVideo(); };
    el.appendChild(p);
  }
}

async function loadSubtitles() {
  try {
    const frText = await (await fetch('texts/0001/original.fr.srt')).text();
    const ptText = await (await fetch('texts/0001/pt.srt')).text();
    const fr = parseSRT(frText);
    const pt = parseSRT(ptText);
    populateTranscript('french-transcript', fr, 'fr');
    populateTranscript('portuguese-transcript', pt, 'pt');
    return fr.map((s, i) => ({ id: s.id, start: s.start, end: s.end, fr: s.text, pt: pt[i]?.text || '' }));
  } catch (error) {
    console.error('Error loading subtitles:', error);
    return [];
  }
}

function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    videoId: '5ovh-Ux_zRs',
    playerVars: { 'playsinline': 1 },
    events: {
      onReady: async () => {
        subtitles = await loadSubtitles();
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
    const ptElement = document.getElementById(`pt-${match.id}`);
    if (frElement) frElement.classList.add('highlight');
    if (ptElement) ptElement.classList.add('highlight');
    btn.disabled = false;
  } else {
    btn.disabled = true;
  }
  requestAnimationFrame(checkTime);
}

function syncScroll() {
  const fc = document.getElementById('french-container');
  const pc = document.getElementById('portuguese-container');
  fc.onscroll = () => !isSyncing && (isSyncing = true, pc.scrollTop = fc.scrollTop, setTimeout(() => isSyncing = false, 50));
  pc.onscroll = () => !isSyncing && (isSyncing = true, fc.scrollTop = pc.scrollTop, setTimeout(() => isSyncing = false, 50));
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
  const ptElement = document.querySelector('#portuguese-transcript .highlight');
  if (frElement && ptElement) {
    isSyncing = true;
    frElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ptElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => isSyncing = false, 50);
  }
}

document.getElementById('scroll-to-highlight').onclick = scrollToHighlight;

// Video Catalog
document.querySelectorAll('[data-video]').forEach(img => {
  img.onclick = () => {
    player.loadVideoById(img.getAttribute('data-video'));
    document.getElementById('catalog-section')?.classList.add('hidden');
  };
});

// Toggle Mobile Catalog
document.getElementById('toggle-catalog').onclick = () => {
  const sec = document.getElementById('catalog-section');
  sec.classList.toggle('hidden');
};

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
