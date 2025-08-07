// js/ui.js
function populateVideoSidebar(videos, currentVideoId, truncateTitle, attachVideoClickListeners, loadVideo, hidePhoneticTooltip) {
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
  attachVideoClickListeners('#video-sidebar [data-video]', loadVideo, hidePhoneticTooltip);
  console.log('Finished populateVideoSidebar');
}

function populateCatalog(videos, currentPage, videosPerPage, truncateTitle, attachVideoClickListeners, loadVideo, hidePhoneticTooltip) {
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
  attachVideoClickListeners('#catalog-grid [data-video]', loadVideo, hidePhoneticTooltip);
  console.log('Finished populateCatalog');
}

function centerHighlight(appState) {
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
    console.log('No match found, disabling center button');
  }
}

export { populateVideoSidebar, populateCatalog, centerHighlight, updateHighlights };