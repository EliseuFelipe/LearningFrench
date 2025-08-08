import { hidePhoneticTooltip } from './subtitles.js';

function handleCenterHighlight(e, appState, centerHighlight) {
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const rect = e.currentTarget.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  e.currentTarget.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
  clearTimeout(appState.scrollTimeout);
  appState.isUserScrolling = false;
  centerHighlight();
}

function setupSyncScroll(appState, centerHighlight) {
  const fc = document.getElementById('french-container');
  const rc = document.getElementById('right-transcript-container');
  fc.onscroll = () => {
    if (!appState.isSyncing) {
      appState.isSyncing = true;
      appState.isUserScrolling = true;
      rc.scrollTop = fc.scrollTop;
      clearTimeout(appState.scrollTimeout);
      appState.scrollTimeout = setTimeout(() => {
        appState.isUserScrolling = false;
        if (appState.player && appState.player.getPlayerState() === 1) {
          centerHighlight();
        }
      }, 4000);
      setTimeout(() => appState.isSyncing = false, 50);
    }
  };
  rc.onscroll = () => {
    if (!appState.isSyncing) {
      appState.isSyncing = true;
      appState.isUserScrolling = true;
      fc.scrollTop = rc.scrollTop;
      clearTimeout(appState.scrollTimeout);
      appState.scrollTimeout = setTimeout(() => {
        appState.isUserScrolling = false;
        if (appState.player && appState.player.getPlayerState() === 1) {
          centerHighlight();
        }
      }, 4000);
      setTimeout(() => appState.isSyncing = false, 50);
    }
  };
}

function attachVideoClickListeners(selector, loadVideo, hidePhoneticTooltip) {
  document.querySelectorAll(selector).forEach(img => {
    img.onclick = () => {
      loadVideo(img.getAttribute('data-video'));
      hidePhoneticTooltip();
    };
  });
}

function setupEventListeners(appState, deps) {
  const { loadSubtitles, populateTranscript, centerHighlight, populateCatalog, languages, videosPerPage, videos } = deps;

  const centerHighlightBtn = document.getElementById('center-highlight');
  if (centerHighlightBtn) {
    centerHighlightBtn.onclick = (e) => handleCenterHighlight(e, appState, centerHighlight);
  } else {
    console.error('center-highlight button not found');
  }

  const languageToggle = document.getElementById('language-toggle');
  if (languageToggle) {
    languageToggle.onchange = async (e) => {
      appState.currentLanguage = e.target.value;
      appState.subtitles = await loadSubtitles(appState.currentVideoId, appState.currentLanguage, videos, languages, populateTranscript, appState.player, centerHighlight);
      window.subtitles = appState.subtitles;
      if (appState.subtitles.length > 0) {
        const match = appState.subtitles.find(s => s.id === appState.lastHighlightedId) || appState.subtitles[0];
        document.getElementById(`fr-${match.id}`)?.classList.add('highlight');
        document.getElementById(`right-${match.id}`)?.classList.add('highlight');
        appState.lastHighlightedId = match.id;
        document.getElementById('center-highlight').disabled = false;
        centerHighlight();
      }
      setupSyncScroll(appState, centerHighlight);
      hidePhoneticTooltip();
    };
  } else {
    console.error('language-toggle not found');
  }

  const firstPageBtn = document.getElementById('first-page');
  if (firstPageBtn) {
    firstPageBtn.onclick = () => {
      appState.currentPage = 1;
      populateCatalog();
    };
  } else {
    console.error('first-page button not found');
  }

  const prevPageBtn = document.getElementById('prev-page');
  if (prevPageBtn) {
    prevPageBtn.onclick = () => {
      if (appState.currentPage > 1) {
        appState.currentPage--;
        populateCatalog();
      }
    };
  } else {
    console.error('prev-page button not found');
  }

  const nextPageBtn = document.getElementById('next-page');
  if (nextPageBtn) {
    nextPageBtn.onclick = () => {
      if (appState.currentPage < Math.ceil(videos.length / videosPerPage)) {
        appState.currentPage++;
        populateCatalog();
      }
    };
  } else {
    console.error('next-page button not found');
  }

  const lastPageBtn = document.getElementById('last-page');
  if (lastPageBtn) {
    lastPageBtn.onclick = () => {
      appState.currentPage = Math.ceil(videos.length / videosPerPage);
      populateCatalog();
    };
  } else {
    console.error('last-page button not found');
  }

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
      root.classList.toggle('dark');
      const isDark = root.classList.contains('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      themeToggle.textContent = isDark ? 'Claro' : 'Escuro';
    };
  } else {
    console.error('theme-toggle not found');
  }
}

export { setupEventListeners, setupSyncScroll, attachVideoClickListeners };