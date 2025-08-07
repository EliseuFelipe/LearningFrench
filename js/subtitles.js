import { fetchWithRetry } from './utils.js';

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

function populateTranscript(containerId, subtitles, type, player, centerHighlight) {
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

async function loadSubtitles(videoId, langCode, videos, languages, populateTranscript, player, centerHighlight) {
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
    console.error('Error loading subtitles:', error);
    document.getElementById('french-transcript').innerHTML = `<p class="text-red-500">Erro ao carregar legendas: ${error.message}</p>`;
    document.getElementById('right-transcript').innerHTML = `<p class="text-red-500">Erro ao carregar legendas: ${error.message}</p>`;
    return [];
  }
}

function showPhoneticTooltip(id, toggle) {
  console.log(`Showing phonetic tooltip for subtitle ID ${id}`);
  const subtitle = window.subtitles.find(s => s.id === id);
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
  window.activeTooltipId = id;
}

function hidePhoneticTooltip() {
  console.log('Hiding phonetic tooltip');
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