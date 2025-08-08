import { fetchWithRetry } from '../utils/utils.js';

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

function populateTranscript(containerId, subtitles, type, player, centerHighlight) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }
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
        if (window.activeTooltipId === sub.id) {
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

async function loadSubtitles(videoId, langCode, videos, languages, populateTranscript, player, centerHighlight) {
  if (!videoId) {
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

    populateTranscript('french-transcript', fr, 'fr', player, centerHighlight);
    populateTranscript('right-transcript', other, 'right', player, centerHighlight);
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
    document.getElementById('french-transcript').innerHTML = `<p class="text-red-500">Erro ao carregar legendas: ${error.message}</p>`;
    document.getElementById('right-transcript').innerHTML = `<p class="text-red-500">Erro ao carregar legendas: ${error.message}</p>`;
    return [];
  }
}

function showPhoneticTooltip(id, toggle) {
  const subtitle = window.subtitles.find(s => s.id === id);
  if (!subtitle) {
    return;
  }
  const tooltip = document.getElementById('phonetic-tooltip');
  if (!tooltip) {
    return;
  }
  const text = document.getElementById('phonetic-text');
  if (!text) {
    return;
  }
  text.innerHTML = subtitle.phonetic.replace(/\|/g, '<br>');

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
  window.activeTooltipId = id;
}

function hidePhoneticTooltip() {
  const tooltip = document.getElementById('phonetic-tooltip');
  if (tooltip) {
    tooltip.classList.add('hidden');
  }
  if (window.activeTooltipId) {
    const toggle = document.querySelector(`.phonetic-toggle[data-id="${window.activeTooltipId}"]`);
    if (toggle) toggle.classList.remove('active');
    window.activeTooltipId = null;
  }
}

export { loadSubtitles, parseSRT, populateTranscript, showPhoneticTooltip, hidePhoneticTooltip };