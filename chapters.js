/* Podział aktualnej bazy na działy do nauki i pełnych testów. */
(function (root) {
  'use strict';
  const C = root.MaleKrokiContent;
  const ids = (prefix, from, to = from) => Array.from({ length: to - from + 1 }, (_, i) => `${prefix}-${String(from + i).padStart(2, '0')}`);
  const list = (prefix, ...parts) => parts.flatMap(part => Array.isArray(part) ? part : [typeof part === 'number' ? `${prefix}-${String(part).padStart(2, '0')}` : part]);
  const chapters = [
    { id: 'math-systems', subject: 'math', name: 'Systemy liczbowe dawniej i dziś', pages: '58–59, 62', description: 'Poznaj różne sposoby zapisu liczb: cyfry rzymskie, egipskie i system Majów.', items: list('math', 1, 27, 28, 30, ids('math', 32, 36)) },
    { id: 'math-large-numbers', subject: 'math', name: 'Cyfry, rzędy i wielkie liczby', pages: '58–61', description: 'Odczytuj wartość cyfr, zapisuj tysiące, miliony i jeszcze większe liczby.', items: list('math', ids('math', 2, 12), 31, 37, ids('math', 41, 45)) },
    { id: 'math-compare', subject: 'math', name: 'Oś liczbowa, porównywanie i palindromy', pages: '62–65', description: 'Ustawiaj liczby na osi, porównuj je i licz, ile liczb spełnia podany warunek. Szukaj też regularności w zapisie.', items: list('math', ids('math', 13, 17), ids('math', 38, 40), 46, 47, 49, 50, ids('math', 52, 61), 87, 88) },
    { id: 'math-add-sub', subject: 'math', name: 'Dodawanie, odejmowanie i zadania', pages: '58–59, 60–69', description: 'Ćwicz dodawanie i odejmowanie, czytanie tabel oraz rozwiązywanie zadań z treścią.', items: list('math', 22, 23, 25, 26, 48, 51, 62, ids('math', 63, 67), 86, 89) },
    { id: 'math-multiply-divide', subject: 'math', name: 'Mnożenie, dzielenie i reszta', pages: '66–69', description: 'Mnożenie i dzielenie większych liczb, kwadraty, sześciany i dzielenie z resztą.', items: list('math', ids('math', 18, 21), 24, ids('math', 68, 80)) },
    { id: 'math-money', subject: 'math', name: 'Pieniądze i zakupy', pages: '63, 67–73', description: 'Obliczaj ceny, oszczędności i kwoty zapisane w złotych oraz groszach.', items: list('math', 29, ids('math', 81, 85)) },
    { id: 'polish-writing', subject: 'polish', name: 'Piszę o sobie i opisuję', pages: '11–60', pageNote: 'zakres źródłowy', description: 'Przedstawianie się, notatki, opisy i porządkowanie wypowiedzi.', items: ids('pol', 1, 12) },
    { id: 'polish-online-safety', subject: 'polish', name: 'Bezpieczeństwo w internecie', pages: '11–60', pageNote: 'zakres źródłowy', description: 'Dane osobowe, hasła, wiadomości i bezpieczne publikowanie zdjęć.', items: ids('pol', 47, 51) },
    { id: 'polish-language', subject: 'polish', name: 'Słowa, sylaby i słowniki', pages: '11–60', pageNote: 'zakres źródłowy', description: 'Podział na sylaby, alfabet, słowniki i zapisywanie ważnych słów.', items: ids('pol', 13, 20) },
    { id: 'polish-spelling', subject: 'polish', name: 'Ortografia: ó i u', pages: '11–60', pageNote: 'zakres źródłowy', description: 'Ćwicz reguły pisowni ó i u oraz sprawdzanie wyrazów w słowniku.', items: list('pol', ids('pol', 21, 29), 52) },
    { id: 'polish-legends', subject: 'polish', name: 'Legendy i bohaterowie', pages: '11–60', pageNote: 'zakres źródłowy', description: 'Czytaj legendy, odróżniaj wydarzenia realistyczne i fantastyczne oraz opisuj bohaterów.', items: ids('pol', 30, 35) },
    { id: 'polish-poetry', subject: 'polish', name: 'Wiersze, hymn i rozumienie tekstu', pages: '11–60', pageNote: 'zakres źródłowy', description: 'Wersy, zwrotki, refren, hymn i odpowiedzi oparte na tekście.', items: ids('pol', 36, 46) },
    { id: 'english-people', subject: 'english', name: 'Opisuję siebie i innych', pages: '20–33', pageNote: 'zakres źródłowy', description: 'Cechy osób, kraje, narodowości, przedstawianie się i pytania o pochodzenie oraz wiek.', items: ids('eng', 1, 19) },
    { id: 'english-school', subject: 'english', name: 'Przybory szkolne i plecak', pages: '20–33', pageNote: 'zakres źródłowy', description: 'Nazwy przyborów, kolory, liczba pojedyncza i mnoga oraz opisywanie plecaka.', items: list('eng', ids('eng', 20, 31), 64, 65) },
    { id: 'english-be', subject: 'english', name: 'Czasownik be i krótkie odpowiedzi', pages: '20–33', pageNote: 'zakres źródłowy', description: 'Zdania twierdzące i przeczące, pytania oraz krótkie odpowiedzi z czasownikiem be.', items: list('eng', ids('eng', 32, 50), 59, 60, 66) },
    { id: 'english-money', subject: 'english', name: 'Ceny, funty i pensy', pages: '20–33', pageNote: 'zakres źródłowy', description: 'Pytaj o cenę i zapisuj kwoty w funtach oraz pensach.', items: ids('eng', 51, 54) },
    { id: 'english-animals', subject: 'english', name: 'Zwierzęta i krótkie dialogi', pages: '20–33', pageNote: 'zakres źródłowy', description: 'Czytaj informacje o zwierzętach, opisuj je i reaguj w krótkich dialogach.', items: list('eng', ids('eng', 55, 58), ids('eng', 61, 63)) },
    { id: 'nature-world', subject: 'nature', name: 'Przyroda wokół nas i zmysły', pages: '12–52', pageNote: 'zakres źródłowy', description: 'Elementy ożywione i nieożywione, człowiek w przyrodzie oraz zmysły.', items: ids('nat', 1, 16) },
    { id: 'nature-investigation', subject: 'nature', name: 'Obserwacje i doświadczenia', pages: '12–52', pageNote: 'zakres źródłowy', description: 'Pytania badawcze, hipotezy, etapy doświadczenia, bezpieczeństwo i oznaczenia substancji.', items: list('nat', ids('nat', 17, 31), 42, 47, 49) },
    { id: 'nature-tools', subject: 'nature', name: 'Mikroskop, kompas i kierunki', pages: '12–52', pageNote: 'zakres źródłowy', description: 'Przyrządy przyrodnicze, powiększanie obrazu, róża wiatrów i mapa.', items: list('nat', ids('nat', 32, 41), 48) },
    { id: 'nature-learning', subject: 'nature', name: 'Uczę się i dbam o uwagę', pages: '12–52', pageNote: 'zakres źródłowy', description: 'Miejsce do nauki, światło, przerwy, skupienie i czas przed ekranem.', items: ids('nat', 43, 46) }
  ];
  const shortNames = { 'math-systems': 'Systemy liczb.', 'math-large-numbers': 'Wielkie liczby', 'math-compare': 'Oś / porówn.', 'math-add-sub': 'Dodaj / odejmij', 'math-multiply-divide': 'Mnoż / dziel', 'math-money': 'Pieniądze', 'polish-writing': 'Pisanie / opis', 'polish-online-safety': 'Bezpieczeństwo online', 'polish-language': 'Słowa / sylaby', 'polish-spelling': 'Ortografia ó/u', 'polish-legends': 'Legendy', 'polish-poetry': 'Wiersze / hymn', 'english-people': 'Opis osób', 'english-school': 'Przybory szkolne', 'english-be': 'Czasownik be', 'english-money': 'Ceny / pieniądze', 'english-animals': 'Zwierzęta / dialogi', 'nature-world': 'Przyroda / zmysły', 'nature-investigation': 'Badania / bezpieczeństwo', 'nature-tools': 'Mikroskop / kompas', 'nature-learning': 'Nauka / skupienie' };
  for (const chapter of chapters) {
    const itemIds = new Set(chapter.items);
    delete chapter.items;
    chapter.short = shortNames[chapter.id] || chapter.name;
    C.chapters.push(chapter);
    for (const item of C.items) if (itemIds.has(item.id)) item.chapterId = chapter.id;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);

