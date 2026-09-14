import { firebaseConfig } from "./firebase-config.js";
import { generateCard, checkWin, todayKey, MIN_PHRASES_REQUIRED } from "./bingo.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
  collection, query, where, orderBy, onSnapshot, getDocs, runTransaction,
  increment, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;   // obiekt z Firebase Auth
let currentUserDoc = null; // { isAdmin, wins, displayName, email }
let unsubscribers = [];    // aktywne onSnapshot, do sprzątania

// ---------- Elementy DOM ----------
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const loginError = document.getElementById("login-error");
const userNameEl = document.getElementById("user-name");

document.getElementById("google-signin-btn").addEventListener("click", handleSignIn);
document.getElementById("signout-btn").addEventListener("click", () => signOut(auth));

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((p) => p.toggleAttribute("hidden", p.id !== `tab-${tab}`));
}

// ---------- Logowanie ----------
async function handleSignIn() {
  loginError.hidden = true;
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    loginError.textContent = "Nie udało się zalogować: " + err.message;
    loginError.hidden = false;
  }
}

onAuthStateChanged(auth, async (user) => {
  cleanupListeners();
  if (!user) {
    currentUser = null;
    currentUserDoc = null;
    loginScreen.hidden = false;
    appScreen.hidden = true;
    return;
  }
  currentUser = user;
  try {
    await ensureUserDoc(user);
  } catch (err) {
    if (err.code === "permission-denied") {
      loginError.textContent = "Ten adres e-mail nie ma dostępu do tej appki. Poproś admina, żeby dodał Cię do listy zaproszonych.";
    } else {
      loginError.textContent = "Błąd logowania: " + err.message;
    }
    loginError.hidden = false;
    await signOut(auth);
    return;
  }
  loginScreen.hidden = true;
  appScreen.hidden = false;
  userNameEl.textContent = user.displayName || user.email;
  startListeners();
});

/** Tworzy dokument users/{uid} przy pierwszym logowaniu. Pierwsza osoba w ogóle zostaje adminem. */
async function ensureUserDoc(user) {
  const userRef = doc(db, "users", user.uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) return;

  const statsRef = doc(db, "meta", "stats");

  await runTransaction(db, async (tx) => {
    const statsSnap = await tx.get(statsRef);
    const userCount = statsSnap.exists() ? (statsSnap.data().userCount || 0) : 0;
    const isFirstUser = userCount === 0;

    tx.set(userRef, {
      email: user.email,
      displayName: user.displayName || user.email,
      isAdmin: isFirstUser,
      wins: 0,
      createdAt: serverTimestamp(),
    });
    tx.set(statsRef, { userCount: userCount + 1 }, { merge: true });

    if (isFirstUser) {
      // pierwszy admin ląduje na liście dozwolonych automatycznie
      tx.set(doc(db, "allowlist", user.email), {
        addedBy: "bootstrap",
        addedAt: serverTimestamp(),
      });
    }
  });
}

// ---------- Uruchomienie nasłuchów po zalogowaniu ----------
function startListeners() {
  const userRef = doc(db, "users", currentUser.uid);
  unsubscribers.push(onSnapshot(userRef, (snap) => {
    if (!snap.exists()) return;
    currentUserDoc = snap.data();
    document.querySelectorAll(".admin-only").forEach((el) => { el.hidden = !currentUserDoc.isAdmin; });
  }));

  listenToTodaysCard();
  listenToLeaderboard();
  listenToAdminPanels();
  listenToAllowlist();
  listenToPhrasePool();
}

function cleanupListeners() {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
}

// ---------- Karta dnia ----------
const cardDateLabel = document.getElementById("card-date-label");
const cardEmptyState = document.getElementById("card-empty-state");
const cardGrid = document.getElementById("card-grid");
const drawCardBtn = document.getElementById("draw-card-btn");
const winBanner = document.getElementById("win-banner");

drawCardBtn.addEventListener("click", () => drawCardForUser(currentUser.uid));

function currentCardId(uid = currentUser.uid, dateKey = todayKey()) {
  return `${uid}_${dateKey}`;
}

function listenToTodaysCard() {
  const dateKey = todayKey();
  cardDateLabel.textContent = "Dzisiaj — " + formatDatePl(dateKey);
  const cardRef = doc(db, "cards", currentCardId(currentUser.uid, dateKey));
  unsubscribers.push(onSnapshot(cardRef, (snap) => {
    if (!snap.exists()) {
      cardEmptyState.hidden = false;
      cardGrid.hidden = true;
      winBanner.hidden = true;
      return;
    }
    renderCard(snap.data(), cardRef);
  }));
}

function renderCard(card, cardRef) {
  cardEmptyState.hidden = true;
  cardGrid.hidden = false;
  cardGrid.innerHTML = "";

  const win = checkWin(card.marked);
  const winningIndices = new Set(win ? win.indices : []);

  card.cells.forEach((cell, i) => {
    const btn = document.createElement("button");
    btn.className = "bingo-cell";
    if (cell.isFree) btn.classList.add("is-free");
    if (card.marked[i]) btn.classList.add("is-marked");
    if (winningIndices.has(i)) btn.classList.add("is-winning");
    btn.textContent = cell.text;
    if (!cell.isFree) {
      btn.addEventListener("click", () => toggleCell(cardRef, card, i));
    } else {
      btn.disabled = true;
    }
    cardGrid.appendChild(btn);
  });

  if (win && card.wonToday) {
    winBanner.hidden = false;
    winBanner.textContent = `🎉 Bingo! Wygrywasz dzięki: ${win.pattern}.`;
  } else {
    winBanner.hidden = true;
  }
}

async function toggleCell(cardRef, card, index) {
  const newMarked = [...card.marked];
  newMarked[index] = !newMarked[index];

  const win = checkWin(newMarked);
  const alreadyWonToday = !!card.wonToday;
  const updates = { marked: newMarked };

  if (win && !alreadyWonToday) {
    updates.wonToday = true;
    updates.winPattern = win.pattern;
  }

  await updateDoc(cardRef, updates);

  if (win && !alreadyWonToday) {
    await addDoc(collection(db, "wins"), {
      uid: currentUser.uid,
      displayName: currentUserDoc?.displayName || currentUser.displayName || currentUser.email,
      date: todayKey(),
      pattern: win.pattern,
      timestamp: serverTimestamp(),
    });
    await updateDoc(doc(db, "users", currentUser.uid), { wins: increment(1) });
  }
}

async function drawCardForUser(targetUid, dateKey = todayKey()) {
  const approvedSnap = await getDocs(query(collection(db, "phrases"), where("status", "==", "approved")));
  const approvedPhrases = approvedSnap.docs.map((d) => ({ id: d.id, text: d.data().text }));

  let card;
  try {
    card = generateCard(approvedPhrases);
  } catch (err) {
    alert(err.message);
    return;
  }

  await setDoc(doc(db, "cards", currentCardId(targetUid, dateKey)), {
    uid: targetUid,
    date: dateKey,
    cells: card.cells,
    marked: card.marked,
    wonToday: false,
    winPattern: null,
    createdAt: serverTimestamp(),
  });
}

function formatDatePl(dateKey) {
  const [y, m, d] = dateKey.split("-");
  return `${d}.${m}.${y}`;
}

// ---------- Pula tekstów (widoczna dla wszystkich, żeby nie dublować) ----------
const poolList = document.getElementById("pool-list");

function listenToPhrasePool() {
  unsubscribers.push(onSnapshot(collection(db, "phrases"), (snap) => {
    const items = snap.docs
      .map((d) => ({ text: d.data().text, status: d.data().status }))
      .sort((a, b) => a.text.localeCompare(b.text, "pl"));

    poolList.innerHTML = "";
    if (items.length === 0) {
      poolList.innerHTML = `<li class="hint-text">Pula jest jeszcze pusta.</li>`;
      return;
    }
    items.forEach((p) => {
      const li = document.createElement("li");
      const statusLabel = p.status === "approved" ? "zatwierdzony" : "oczekujący";
      const statusClass = p.status === "approved" ? "status-approved" : "status-pending";
      li.innerHTML = `<span>${escapeHtml(p.text)}</span><span class="pool-status ${statusClass}">${statusLabel}</span>`;
      poolList.appendChild(li);
    });
  }));
}

// ---------- Zaproponuj tekst ----------
const suggestForm = document.getElementById("suggest-form");
const suggestInput = document.getElementById("suggest-input");
const suggestMsg = document.getElementById("suggest-msg");

suggestForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = suggestInput.value.trim();
  if (!text) return;
  await addDoc(collection(db, "phrases"), {
    text,
    status: "pending",
    createdBy: currentUser.uid,
    createdAt: serverTimestamp(),
  });
  suggestInput.value = "";
  suggestMsg.hidden = false;
  suggestMsg.textContent = "Dodano — czeka na zatwierdzenie przez admina.";
  setTimeout(() => { suggestMsg.hidden = true; }, 3500);
});

// ---------- Ranking ----------
const boardBody = document.getElementById("board-body");

function
