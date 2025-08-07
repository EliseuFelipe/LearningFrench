import { fetchWithRetry } from '../utils/utils.js';

async function fetchVideoFolders() {
  console.log('Starting fetchVideoFolders');
  try {
    const response = await fetchWithRetry('/api/videos');
    console.log('fetchVideoFolders: Response received', response);
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

export { fetchVideoFolders };