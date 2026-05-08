import { fetchWithRetry } from '../utils/utils.js';

async function fetchVideoFolders() {
  try {
    const response = await fetchWithRetry('/api/videos');
    const data = await response.json();
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
    return validFolders;
  } catch (error) {
    return [];
  }
}

export { fetchVideoFolders };