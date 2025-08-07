async function fetchWithRetry(url, retries = 3, delay = 1000) {
  console.log(`Starting fetchWithRetry for URL: ${url}, retries: ${retries}, delay: ${delay}`);
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempt ${i + 1} to fetch ${url}`);
      const response = await fetch(url, { cache: 'no-cache' });
      console.log(`Fetch response for ${url}: status ${response.status}, ok: ${response.ok}`);
      if (response.ok) return response;
      console.warn(`Fetch failed for ${url}: HTTP ${response.status}, retry ${i + 1}/${retries}`);
      if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      console.warn(`Fetch error for ${url}: ${error}, retry ${i + 1}/${retries}`);
      if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  console.error(`Failed to fetch ${url} after ${retries} retries`);
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

function truncateTitle(title) {
  const maxLength = 30;
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3) + '...';
}

export { fetchWithRetry, truncateTitle };