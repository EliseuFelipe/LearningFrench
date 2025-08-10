function populateVideoSidebar(videos, currentVideoId, truncateTitle, attachVideoClickListeners, loadVideo, hidePhoneticTooltip) {
  const sidebar = document.getElementById('video-sidebar');
  if (!sidebar) {
    return;
  }
  sidebar.innerHTML = '';
  videos.filter(v => v.id !== currentVideoId).forEach(video => {
    const titleWords = truncateTitle(video.title);
    const card = `<div class="video-card bg-white dark:bg-darkBg rounded-lg shadow-md overflow-hidden cursor-pointer" data-video="${video.id}">
      <img src="https://img.youtube.com/vi/${video.id}/0.jpg" alt="${titleWords}" class="w-full h-24 object-cover">
      <p class="text-sm font-medium text-gray-800 dark:text-darkText p-2">${titleWords}</p>
    </div>`;
    sidebar.innerHTML += card;
  });
  attachVideoClickListeners('#video-sidebar [data-video]', loadVideo, hidePhoneticTooltip);
}

function populateCatalog(videos, currentPage, videosPerPage, truncateTitle, attachVideoClickListeners, loadVideo, hidePhoneticTooltip) {
  console.log('populateCatalog called with videos:', JSON.stringify(videos), 'page:', currentPage);  // Log chamada
  const grid = document.getElementById('catalog-grid');
  if (!grid) {
    console.warn('catalog-grid not found');  // Log se DOM ausente
    return;
  }
  grid.innerHTML = '';
  if (videos.length === 0) {
    grid.innerHTML = '<p class="text-red-500 text-sm">Nenhum vídeo disponível. Verifique a pasta texts e o servidor.</p>';
    console.log('No videos: Showing error message in catalog');  // Log vazio
    return;
  }
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
  const pageInfo = document.getElementById('page-info');
  if (pageInfo) {
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
  }
  document.getElementById('first-page').disabled = currentPage === 1;
  document.getElementById('prev-page').disabled = currentPage === 1;
  document.getElementById('next-page').disabled = currentPage === totalPages;
  document.getElementById('last-page').disabled = currentPage === totalPages;
  attachVideoClickListeners('#catalog-grid [data-video]', loadVideo, hidePhoneticTooltip);
}

function centerHighlight(appState) {
  const frElement = document.querySelector('#french-transcript .highlight');
  const otherElement = document.querySelector('#right-transcript .highlight');
  if (frElement && otherElement) {
    const frContainer = document.getElementById('french-container');
    const rightContainer = document.getElementById('right-transcript-container');
    if (!frContainer || !rightContainer) {
      return;
    }
    const frRect = frElement.getBoundingClientRect();
    const rightRect = otherElement.getBoundingClientRect();
    const frContainerRect = frContainer.getBoundingClientRect();
    const rightContainerRect = rightContainer.getBoundingClientRect();
    
    const frTargetScroll = frContainer.scrollTop + frRect.top - frContainerRect.top - (frContainerRect.height - frRect.height) / 2;
    const rightTargetScroll = rightContainer.scrollTop + rightRect.top - rightContainerRect.top - (rightContainerRect.height - rightRect.height) / 2;

    appState.isSyncing = true;
    frContainer.scrollTo({ top: frTargetScroll, behavior: 'smooth' });
    rightContainer.scrollTo({ top: rightTargetScroll, behavior: 'smooth' });
    setTimeout(() => appState.isSyncing = false, 600);
  } else {
    console.log('No highlight elements found');
  }
}

function updateHighlights(match, appState) {
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
    appState.lastHighlightedId = match.id;
    if (!appState.isSyncing && !appState.isUserScrolling && appState.player && appState.player.getPlayerState() === 1) {
      centerHighlight(appState);
    }
    btn.disabled = false;
  } else {
    btn.disabled = true;
  }
}

function showSkeletons(isInitial = true) {
  // Player skeleton
  const playerDiv = document.getElementById('player');
  if (playerDiv) {
    playerDiv.innerHTML = '<div class="skeleton skeleton-player"></div>';
  }

  // Transcript skeletons (linhas de texto)
  const frTranscript = document.getElementById('french-transcript');
  if (frTranscript) {
    frTranscript.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const line = document.createElement('div');
      line.className = `skeleton skeleton-line ${i % 2 === 0 ? 'short' : ''}`;
      frTranscript.appendChild(line);
    }
  }
  const rightTranscript = document.getElementById('right-transcript');
  if (rightTranscript) {
    rightTranscript.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const line = document.createElement('div');
      line.className = `skeleton skeleton-line ${i % 2 === 0 ? 'short' : ''}`;
      rightTranscript.appendChild(line);
    }
  }

  // Sidebar skeletons (3 cards com thumbnail + título)
  const sidebar = document.getElementById('video-sidebar');
  if (sidebar) {
    sidebar.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const card = document.createElement('div');
      card.className = 'skeleton-card skeleton';
      card.innerHTML = `
        <div class="skeleton skeleton-thumbnail"></div>
        <div class="skeleton skeleton-title"></div>
      `;
      sidebar.appendChild(card);
    }
  }

  // Catalog skeletons (6 cards com thumbnail + título) – apenas na inicialização
  if (isInitial) {
    const catalogGrid = document.getElementById('catalog-grid');
    if (catalogGrid) {
      catalogGrid.innerHTML = '';
      for (let i = 0; i < 6; i++) {
        const card = document.createElement('div');
        card.className = 'skeleton-card skeleton';
        card.innerHTML = `
          <div class="skeleton skeleton-thumbnail"></div>
          <div class="skeleton skeleton-title"></div>
        `;
        catalogGrid.appendChild(card);
      }
    }
  }
}

function hideSkeletons() {
  // Limpa skeletons de todos os containers
  document.querySelectorAll('.skeleton').forEach(el => el.remove());
}

export { populateVideoSidebar, populateCatalog, centerHighlight, updateHighlights, showSkeletons, hideSkeletons };