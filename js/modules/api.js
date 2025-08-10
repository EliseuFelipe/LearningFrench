import { fetchWithRetry } from '../utils/utils.js';

async function fetchVideoFolders() {
  console.log('Starting fetchVideoFolders');  // Log inicial
  try {
    const response = await fetchWithRetry('/api/videos');
    console.log('fetchVideoFolders: Response status', response.status);  // Log status
    const data = await response.json();
    console.log('Raw /api/videos response:', JSON.stringify(data));  // Log raw data
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
    console.log('Valid video folders:', JSON.stringify(validFolders));  // Log validos
    return validFolders;
  } catch (error) {
    console.error('Error fetching video folders:', error.message);  // Log erro
    return [];
  }
}

export { fetchVideoFolders };