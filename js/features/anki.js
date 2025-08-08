// js/features/anki.js
import { truncateTitle } from '../utils/utils.js';

async function initGenanki() {
  if (!window.genanki || !window.SQL || !window.saveAs || !window.JSZip) {
    console.error('Genanki dependencies not loaded. Ensure CDNs are included in index.html.');
    return false;
  }
  return true;
}

async function generateCardsFromSubtitles(subtitles, currentLanguage) {
  const cards = subtitles.map(sub => ({
    front: sub.fr,
    back: `${sub.phonetic || 'Phonetic not available'}<br>${sub[currentLanguage] || 'Translation not available'}`
  }));
  return cards;
}

async function createAnkiDeck(videoTitle, cards) {
  const model = new genanki.Model({
    name: "Basic French Flashcard",
    id: Date.now().toString(),
    fields: [
      { name: "Front" },
      { name: "Back" }
    ],
    templates: [
      {
        name: "Card 1",
        qfmt: "{{Front}}",
        afmt: "{{FrontSide}}<hr id='answer'>{{Back}}"
      }
    ]
  });

  const deck = new genanki.Deck(Date.now(), truncateTitle(videoTitle) + " French Flashcards");

  cards.forEach(card => {
    const note = new genanki.Note({
      model,
      fields: { Front: card.front, Back: card.back }
    });
    deck.addNote(note);
  });

  const ankiPackage = new genanki.Package(deck);
  return await ankiPackage.writeToBlob();
}

function renderFlashcardPreview(cards, containerId, maxPreview = 5) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';
  const previewCards = cards.slice(0, maxPreview);
  previewCards.forEach((card, index) => {
    const div = document.createElement('div');
    div.className = 'flashcard-preview p-2 border mb-2';
    div.innerHTML = `<strong>Front:</strong> ${card.front}<br><strong>Back:</strong> ${card.back}`;
    container.appendChild(div);
  });

  if (cards.length > maxPreview) {
    const showAllBtn = document.createElement('button');
    showAllBtn.textContent = 'Show All';
    showAllBtn.className = 'bg-blue-500 text-white px-4 py-2 rounded';
    showAllBtn.onclick = () => {
      container.innerHTML = '';
      cards.forEach(card => {
        const div = document.createElement('div');
        div.className = 'flashcard-preview p-2 border mb-2';
        div.innerHTML = `<strong>Front:</strong> ${card.front}<br><strong>Back:</strong> ${card.back}`;
        container.appendChild(div);
      });
      showAllBtn.remove();
    };
    container.appendChild(showAllBtn);
  }
}

async function exportToAnki(videoId, videoTitle, subtitles, currentLanguage) {
  try {
    if (!await initGenanki()) throw new Error('Genanki not initialized');
    const cards = await generateCardsFromSubtitles(subtitles, currentLanguage);
    renderFlashcardPreview(cards, 'anki-preview');

    const blob = await createAnkiDeck(videoTitle, cards);
    saveAs(blob, `${truncateTitle(videoTitle)}.apkg`);
  } catch (error) {
    console.error('Anki export error:', error);
    alert('Failed to generate Anki deck.');
  }
}

export { exportToAnki };