async function fetchWithRetry(url, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (response.ok) return response;
      if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

function truncateTitle(title) {
  const maxLength = 30;
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3) + '...';
}

export { fetchWithRetry, truncateTitle };