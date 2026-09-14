# Bingo Dnia

Prosta appka do gry w bingo z własną pulą tekstów: każdy uczestnik dostaje
raz dziennie swoją kartę 5×5, zaznacza pola i wygrywa, gdy zbierze komplet
w wierszu, kolumnie lub skosie. Bez etapu budowania — to zwykły HTML/CSS/JS,
działa bezpośrednio z GitHub Pages.

## Jak to działa

- **Logowanie**: przez konto Google (Firebase Authentication).
- **Baza danych**: Firestore (część Firebase) — pula tekstów, karty, ranking.
- **Losowanie karty**: dzieje się w przeglądarce, gdy ktoś wejdzie do appki
  i nie ma jeszcze karty na dany dzień. Nie wymaga płatnego planu Firebase.
- **Pierwszy admin**: pierwsza osoba, która się kiedykolwiek zaloguje,
  automatycznie zostaje adminem. Kolejnych adminów możesz dodać ręcznie,
  zmieniając pole `isAdmin` na `true` w dokumencie danej osoby
  w kolekcji `users` (konsola Firebase → Firestore Database).
- **Kto może się zalogować**: appka wpuszcza tylko adresy e-mail wpisane
  przez admina w panelu („Kto ma dostęp do appki”). Pierwszy admin (Ty)
  trafia na tę listę automatycznie przy pierwszym logowaniu — resztę
  uczestników musisz dopisać ręcznie, zanim spróbują się zalogować.
- **Wolne pole**: środkowe pole karty jest zawsze zaznaczone (klasyczna
  zasada bingo).
- **Wygrana**: liczy się pierwszy komplet w danym dniu na daną osobę.

## Krok 1 — załóż projekt Firebase (bezpłatnie)

1. Wejdź na [console.firebase.google.com](https://console.firebase.google.com)
   i kliknij **Dodaj projekt**. Nadaj nazwę (np. `bingo-dnia`), możesz
   wyłączyć Google Analytics — nie jest potrzebny.
2. W panelu projektu kliknij ikonę **`</>`** (Dodaj aplikację internetową),
   nadaj jej nazwę i zatwierdź. Firebase pokaże Ci obiekt konfiguracyjny
   (`firebaseConfig`) — skopiuj go.
3. Otwórz plik `firebase-config.js` w tym repozytorium i wklej tam swoje
   wartości (nadpisz placeholdery).

## Krok 2 — włącz logowanie przez Google

1. W konsoli Firebase: **Build → Authentication → Get started**.
2. Zakładka **Sign-in method** → wybierz **Google** → włącz (Enable) →
   ustaw adres e-mail wsparcia projektu → **Zapisz**.

## Krok 3 — włącz Firestore i wgraj reguły

1. **Build → Firestore Database → Create database**. Wybierz lokalizację
   (np. `eur3 (europe-west)`), tryb produkcyjny.
2. Zakładka **Rules** w Firestore → wklej całą zawartość pliku
   `firestore.rules` z tego repozytorium → **Publikuj**.

## Krok 4 — dodaj domenę GitHub Pages jako autoryzowaną

Po wdrożeniu appki (krok 5) Firebase Auth musi wiedzieć, że logowanie
może się odbywać z Twojego adresu GitHub Pages:

1. **Authentication → Settings → Authorized domains → Add domain**.
2. Wpisz swoją domenę GitHub Pages, np. `twoj-login.github.io`.

## Krok 5 — wrzuć na GitHub i włącz GitHub Pages

1. Utwórz nowe repozytorium na GitHubie i wgraj do niego wszystkie pliki
   z tego folderu (albo `git init` + `git remote add origin ...` + `git push`).
2. W repozytorium: **Settings → Pages → Source: Deploy from a branch**,
   wybierz branch `main` i folder `/ (root)` → **Save**.
3. Po chwili appka będzie dostępna pod adresem
   `https://twoj-login.github.io/nazwa-repo/`.

## Krok 6 — dodaj pierwsze teksty do puli

Zaloguj się jako pierwsza osoba (automatycznie zostajesz adminem),
wejdź w **Panel admina** i dodaj minimum **24 teksty**, następnie zatwierdź
każdy z nich przyciskiem „Zatwierdź”. Dopiero wtedy karty da się wylosować
(karta ma 25 pól, środkowe to wolne pole, więc potrzeba 24 różnych tekstów).

## Uwagi i ograniczenia

- Data dnia liczona jest wg lokalnego zegara przeglądarki każdej osoby —
  przy małej grupie w jednej strefie czasowej to nieistotne.
- Każdy uczestnik ma własną, inaczej wylosowaną kartę tego samego dnia.
- Reguły Firestore są dopasowane do małej, zaufanej grupy (znajomi/zespół) —
  nie były projektowane pod dużą, publiczną appkę.
- Jeśli chcesz, żeby admin sam mógł wpisywać teksty od razu jako zatwierdzone
  (bez etapu „oczekujące”), zmień w `app.js` w `adminAddForm` wartość
  `status: "pending"` na `status: "approved"`.

## Struktura plików

```
index.html          — struktura strony
style.css            — wygląd
app.js               — logika aplikacji (Firebase, obsługa zdarzeń)
bingo.js             — losowanie karty i sprawdzanie wygranej (bez Firebase)
firebase-config.js   — Twoja konfiguracja projektu Firebase (uzupełnij)
firestore.rules      — reguły bezpieczeństwa bazy danych
```
