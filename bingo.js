// bingo.js — czysta logika gry, bez zależności od Firebase, łatwa do przetestowania

export const GRID_SIZE = 5;
export const CENTER_INDEX = Math.floor((GRID_SIZE * GRID_SIZE) / 2); // 12 dla siatki 5x5
export const MIN_PHRASES_REQUIRED = GRID_SIZE * GRID_SIZE - 1; // 24, bo środek to wolne pole

/**
 * Losuje jedną kartę bingo z puli zatwierdzonych tekstów.
 * @param {Array<{id: string, text: string}>} approvedPhrases
 * @returns {{ cells: Array<{phraseId: string|null, text: string, isFree: boolean}>, marked: boolean[] }}
 */
export function generateCard(approvedPhrases) {
  if (approvedPhrases.length < MIN_PHRASES_REQUIRED) {
    throw new Error(
      `Za mało zatwierdzonych tekstów w puli (jest ${approvedPhrases.length}, potrzeba minimum ${MIN_PHRASES_REQUIRED}).`
    );
  }

  const shuffled = shuffle(approvedPhrases);
  const chosen = shuffled.slice(0, MIN_PHRASES_REQUIRED);

  const cells = [];
  const marked = [];
  let chosenIdx = 0;

  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    if (i === CENTER_INDEX) {
      cells.push({ phraseId: null, text: "★ WOLNE POLE", isFree: true });
      marked.push(true); // wolne pole zawsze zaznaczone
    } else {
      const phrase = chosen[chosenIdx++];
      cells.push({ phraseId: phrase.id, text: phrase.text, isFree: false });
      marked.push(false);
    }
  }

  return { cells, marked };
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Sprawdza, czy siatka zaznaczeń zawiera komplet w linii, kolumnie lub skosie.
 * @param {boolean[]} marked - tablica 25 wartości bool, indeksowana wierszami (0..24)
 * @returns {{pattern: string, indices: number[]}|null}
 */
export function checkWin(marked) {
  const n = GRID_SIZE;

  for (let r = 0; r < n; r++) {
    const indices = [];
    for (let c = 0; c < n; c++) indices.push(r * n + c);
    if (indices.every((i) => marked[i])) return { pattern: `wiersz ${r + 1}`, indices };
  }

  for (let c = 0; c < n; c++) {
    const indices = [];
    for (let r = 0; r < n; r++) indices.push(r * n + c);
    if (indices.every((i) => marked[i])) return { pattern: `kolumna ${c + 1}`, indices };
  }

  const diag1 = Array.from({ length: n }, (_, i) => i * n + i);
  if (diag1.every((i) => marked[i])) return { pattern: "skos ↘", indices: diag1 };

  const diag2 = Array.from({ length: n }, (_, i) => i * n + (n - 1 - i));
  if (diag2.every((i) => marked[i])) return { pattern: "skos ↙", indices: diag2 };

  return null;
}

/** Zwraca dzisiejszą datę w formacie YYYY-MM-DD wg lokalnego czasu przeglądarki. */
export function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
