/* Bez zależności, kont, reklam i analityki. */
(function () {
  'use strict';
  const { items, categories } = MaleKrokiContent;
  MaleKrokiContent.books ||= [];
  const legacyNarnia = MaleKrokiContent.chapters.filter(chapter => /^narnia-\d{2}$/.test(chapter.id));
  if (legacyNarnia.length && !MaleKrokiContent.books.some(book => book.id === 'narnia-book')) {
    MaleKrokiContent.books.push({ id: 'narnia-book', subject: 'polish', name: 'Opowieści z Narnii. Lew, czarownica i stara szafa', description: 'Poznaj całą lekturę, jej bohaterów, wydarzenia, miejsca, motywy i rozdziały.', study: legacyNarnia.find(chapter => chapter.study?.general)?.study.general || {} });
    legacyNarnia.forEach(chapter => { chapter.bookId = 'narnia-book'; });
  }
  const C = MaleKrokiCore, V = MaleKrokiVisuals, e = V.escape;
  const main = document.getElementById('main');
  const byId = new Map(items.map(item => [item.id, item]));
  const PREFIX = 'male-kroki-v1:';
  let storageOK = true, speaking = null, speechVoices = [], currentView = 'home', libraryCategory = 'all', librarySearch = '', homeSubject = 'polish';
  let knownBuildVersion = null, updatePending = false, updateReloading = false;
  function read(key) { try { return localStorage.getItem(PREFIX + key); } catch { storageOK = false; return null; } }
  function write(key, value) {
    try { if (value === null) localStorage.removeItem(PREFIX + key); else localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
    catch { storageOK = false; }
    document.getElementById('storage-notice').hidden = storageOK;
  }
  function readProgress() {
    try {
      const value = JSON.parse(read('progress'));
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
      return Object.fromEntries(Object.entries(value).filter(([id, val]) => byId.has(id) && val && typeof val.ok === 'boolean' && typeof val.review === 'boolean').map(([id, val]) => [id, { ok: val.ok, review: val.review }]));
    } catch { return {}; }
  }
  let progress = readProgress();
  let session = C.restore(read('session'), items);
  const getAnswers = id => byId.get(id).answers;
  const categoryOf = item => categories.find(c => c.id === item.category);
  const chapterOf = item => MaleKrokiContent.chapters.find(c => c.id === item?.chapterId);
  const chapterItems = chapter => items.filter(item => item.chapterId === chapter.id);
  const pageLabel = chapter => chapter?.pages ? `${chapter.pageNote ? `${chapter.pageNote}: ` : 'strony '}${chapter.pageNote ? 's. ' : ''}${chapter.pages}` : '';
  const questionCount = count => `${count} ${count === 1 ? 'pytanie' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'pytania' : 'pytań'}`;
  const reviewIds = () => items.filter(x => progress[x.id]?.review).map(x => x.id);
  const learned = list => list.filter(x => progress[x.id]?.ok).length;
  function save() { if (session) write('session', session); }
  function stopAudio() {
    speaking = null;
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch { /* Czytanie jest dodatkiem. */ }
  }
  function draw(html, view) {
    stopAudio(); currentView = view; main.innerHTML = html;
    document.body.dataset.view = view;
    document.querySelectorAll('[data-shell-view]').forEach(button => {
      const target = button.dataset.shellView;
      const active = target === 'home' ? view === 'home' : target === 'book' ? ['book', 'chapter'].includes(view) : ['library', 'item'].includes(view) || ['session', 'results'].includes(view);
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    main.focus({ preventScroll: true }); window.scrollTo(0, 0);
    applyPendingUpdate();
  }
  function applyPendingUpdate() {
    if (!updatePending || updateReloading || !(currentView === 'home' || (currentView === 'results' && session?.stage === 'done'))) return;
    updateReloading = true;
    window.location.reload();
  }
  async function checkForUpdate() {
    try {
      const response = await fetch(`./version.json?check=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const { version } = await response.json();
      if (typeof version !== 'string' || !version) return;
      if (knownBuildVersion && version !== knownBuildVersion) {
        updatePending = true;
        const status = document.getElementById('offline-status');
        if (status) status.textContent = 'Jest dostępna aktualizacja. Wczytam ją po zakończeniu tej sesji.';
        applyPendingUpdate();
      }
      knownBuildVersion = version;
    } catch { /* Serwer może być chwilowo niedostępny podczas aktualizacji. */ }
  }
  const action = (label, name, cls = '', extra = '') => `<button class="btn ${cls}" data-action="${name}" ${extra}>${label}</button>`;
  const MIXED_QUIZ_LENGTH = 15;
  const MATH_QUIZ_LENGTH = 30;
  const SUBJECT_QUIZ_LENGTH = 25;
  const MATH_STARTER_IDS = ['math-03', 'math-04', 'math-89', 'math-06', 'math-07', 'math-08', 'math-14', 'math-15', 'math-50', 'math-22', 'math-54', 'math-78'];
  const isMath = item => item?.category === 'math';
  const subjectOf = item => item?.subject || categories.find(c => c.id === item?.category)?.subject || (isMath(item) ? 'math' : item?.category === 'english' ? 'english' : item?.category === 'nature' ? 'nature' : 'polish');
  function syncScopeSelectors() {
    const names = { math: 'Matematyka', polish: 'Język polski', english: 'Język angielski', nature: 'Przyroda' };
    const books = MaleKrokiContent.books || [];
    for (const [subjectId, scopeId] of [['learn-subject', 'learn-length'], ['quiz-subject', 'quiz-length']]) {
      const subject = document.getElementById(subjectId), scope = document.getElementById(scopeId);
      if (!subject || !scope) continue;
      const selected = scope.value;
      const chosenSubject = subject.value;
      const total = items.filter(item => chosenSubject === 'all' || subjectOf(item) === chosenSubject).length;
      const groups = chosenSubject === 'all' ? ['math', 'polish', 'english', 'nature'] : [chosenSubject];
      const options = [`<option value="all">Całość · ${questionCount(total)}</option>`];
      for (const group of groups) {
        const chapters = MaleKrokiContent.chapters.filter(chapter => chapter.subject === group && chapterItems(chapter).length);
        const regular = chapters.filter(chapter => !chapter.bookId);
        const regularOptions = regular.map(chapter => `<option value="${e(chapter.id)}">${e(chapter.short || chapter.name)} · ${questionCount(chapterItems(chapter).length)}</option>`).join('');
        if (regularOptions) options.push(chosenSubject === 'all' ? `<optgroup label="${e(names[group])}">${regularOptions}</optgroup>` : regularOptions);
        const subjectBooks = books.filter(book => book.subject === group);
        if (subjectBooks.length) {
          const bookOptions = subjectBooks.map(book => {
            const bookChapters = chapters.filter(chapter => chapter.bookId === book.id);
            const bookItems = items.filter(item => bookChapters.some(chapter => chapter.id === item.chapterId));
            const wholeBook = `<option value="book:${e(book.id)}">${e(book.name)} · całość · ${questionCount(bookItems.length)}</option>`;
            const chapterOptions = bookChapters.map(chapter => `<option value="${e(chapter.id)}">↳ ${e(chapter.short || chapter.name)} · ${questionCount(chapterItems(chapter).length)}</option>`).join('');
            return wholeBook + chapterOptions;
          }).join('');
          options.push(`<optgroup label="${e(names[group])} · Lektury">${bookOptions}</optgroup>`);
        }
      }
      scope.innerHTML = options.join('');
      scope.value = [...scope.options].some(option => option.value === selected) ? selected : 'all';
    }
  }
  function startSelection(mode, subject, scopeId) {
    if (scopeId.startsWith('book:')) return startBook(mode, scopeId.slice(5));
    const chapter = scopeId === 'all' ? null : MaleKrokiContent.chapters.find(value => value.id === scopeId && (subject === 'all' || value.subject === subject));
    if (chapter) {
      const ids = chapterItems(chapter).map(item => item.id);
      if (ids.length) return start(mode, chapter.subject, 'all', ids, false, mode === 'quiz');
    }
    start(mode, subject, 'all');
  }
  function startBook(mode, bookId) {
    const book = (MaleKrokiContent.books || []).find(value => value.id === bookId);
    if (!book) return home();
    const chapterIds = new Set(MaleKrokiContent.chapters.filter(chapter => chapter.bookId === book.id).map(chapter => chapter.id));
    const ids = items.filter(item => chapterIds.has(item.chapterId)).map(item => item.id);
    if (!ids.length) return bookPage(book.id);
    start(mode, book.subject, 'all', ids, false, mode === 'quiz');
  }
  // Tymczasowy, zawężony zakres przygotowany na prośbę opiekuna.
  // Pozostaje aktywny także po dodaniu kolejnych materiałów; usuń wyłącznie na wyraźną prośbę opiekuna.
  function startMathTeacherScope(mode) {
    const originalIds = new Set([
      'math-02', 'math-03', 'math-04', 'math-05', 'math-06', 'math-07', 'math-08', 'math-09', 'math-10', 'math-11', 'math-12',
      'math-13', 'math-14', 'math-15', 'math-18', 'math-19', 'math-20', 'math-21', 'math-23', 'math-24',
      'math-31', 'math-37', 'math-38', 'math-41', 'math-42', 'math-43', 'math-44', 'math-45', 'math-46', 'math-47',
      'math-57', 'math-58', 'math-59', 'math-60', 'math-61', 'math-62', 'math-63', 'math-64', 'math-65', 'math-66', 'math-67',
      'math-68', 'math-69', 'math-70', 'math-71', 'math-75', 'math-76', 'math-77', 'math-86'
    ]);
    const addedIds = /^math-new-(?:00[1-9]|0[1-3][0-9]|040|14[5-8])$/;
    const ids = items.filter(item => originalIds.has(item.id) || addedIds.test(item.id)).map(item => item.id);
    if (!ids.length) return home();
    start(mode, 'math', 'all', ids, false, mode === 'quiz');
  }
  function home() {
    save();
    const count = learned(items), reviews = reviewIds().length;
    const unfinished = session && session.stage !== 'done';
    const subjectMeta = [
      { id: 'math', name: 'Matematyka', mark: '+ −', hint: 'Zadania i liczby' },
      { id: 'polish', name: 'Język polski', mark: 'Aa', hint: 'Czytanie i lektury' },
      { id: 'english', name: 'Angielski', mark: 'Ab', hint: 'Słówka i zdania' },
      { id: 'nature', name: 'Przyroda', mark: '❋', hint: 'Świat wokół nas' }
    ];
    const subjectCards = subjectMeta.map(subject => {
      const total = items.filter(item => subjectOf(item) === subject.id).length;
      const active = homeSubject === subject.id;
      return `<button class="subject-tile${active ? ' active' : ''}" type="button" data-action="home-subject" data-id="${e(subject.id)}" aria-pressed="${active}"><span class="subject-mark" aria-hidden="true">${e(subject.mark)}</span><span class="subject-copy"><strong>${e(subject.name)}</strong><small>${e(subject.hint)}</small></span><span class="subject-count">${questionCount(total)}</span></button>`;
    }).join('');
    const visibleChapters = MaleKrokiContent.chapters.filter(chapter => !chapter.bookId && (homeSubject === 'all' || chapter.subject === homeSubject));
    const topicCards = visibleChapters.map((chapter, i) => {
      const list = chapterItems(chapter), n = learned(list);
      return `<button class="topic" data-action="category" data-id="${e(chapter.id)}" style="--topic:${categories.find(c => c.id === list[0]?.category)?.color || '#47715e'}"><span class="topic-index" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><strong>${e(chapter.name)}</strong><small>${questionCount(list.length)}${chapter.pages ? ` · ${e(pageLabel(chapter))}` : ''}</small><div class="progress-track"><span style="width:${list.length ? n / list.length * 100 : 0}%"></span></div><small>${n} przećwiczonych poprawnie</small></button>`;
    }).join('');
    const visibleBooks = (MaleKrokiContent.books || []).filter(book => homeSubject === 'all' || book.subject === homeSubject);
    const featuredBook = (MaleKrokiContent.books || []).find(book => book.id === 'narnia-book') || (MaleKrokiContent.books || [])[0];
    const featuredChapters = featuredBook ? MaleKrokiContent.chapters.filter(chapter => chapter.bookId === featuredBook.id) : [];
    const featuredChapterIds = new Set(featuredChapters.map(chapter => chapter.id));
    const featuredItems = featuredBook ? items.filter(item => featuredChapterIds.has(item.chapterId)) : [];
    const heroAction = featuredBook && featuredItems.length ? `<button class="btn full" data-action="book" data-id="${e(featuredBook.id)}">${learned(featuredItems) ? 'Kontynuuj lekturę' : 'Poznaj lekturę'} <span aria-hidden="true">→</span></button>` : '';
    const resumePanel = session?.stage === 'done' ? `<aside class="resume">${action('Zobacz ostatni wynik →', 'resume', 'secondary')}</aside>` : unfinished ? `<aside class="resume"><p><strong>Twój mały krok czeka.</strong><br>Ukończono ${C.summary(session).completed} z ${session.ids.length} pytań. Możesz wrócić do sesji.</p>${action('Kontynuuj →', 'resume', 'secondary')}</aside>` : '';
    const bookCards = visibleBooks.map(book => {
      const chapters = MaleKrokiContent.chapters.filter(chapter => chapter.bookId === book.id);
      const chapterIds = new Set(chapters.map(chapter => chapter.id));
      const list = items.filter(item => chapterIds.has(item.chapterId));
      if (!list.length) return '';
      const completed = learned(list);
      return `<button class="book-shelf-card" data-action="book" data-id="${e(book.id)}"><span class="book-shelf-visual" aria-hidden="true">${V.narniaScene()}</span><span class="book-shelf-mark" aria-hidden="true">▤</span><span class="book-shelf-copy"><span class="eyebrow">JĘZYK POLSKI · LEKTURY</span><strong>${e(book.name)}</strong><small>Cała lektura · ${questionCount(list.length)} · ${chapters.length} rozdziałów</small><span class="book-progress"><i style="width:${list.length ? completed / list.length * 100 : 0}%"></i></span></span><span class="book-shelf-arrow" aria-hidden="true">→</span></button>`;
    }).join('');
    const bookShelf = bookCards ? `<section class="book-shelf"><div class="section-label"><h2>Lektury</h2><span>Wiedza i ćwiczenia z całej książki</span></div><div class="book-shelf-list">${bookCards}</div></section>` : '';
    const subjectName = subjectMeta.find(subject => subject.id === homeSubject)?.name || 'Wszystkie przedmioty';
    const visibleItems = items.filter(item => homeSubject === 'all' || subjectOf(item) === homeSubject);
    const visibleLearned = learned(visibleItems);
    draw(`
      <section class="hero expedition-hero" aria-labelledby="home-title"><div class="hero-copy"><p class="eyebrow">KLASA 4 · TWOJA MAPA</p><h1 id="home-title">Witaj, uczniu!<br><em>Dokąd dziś?</em></h1><p class="intro">Wybierz przedmiot, wróć do lektury albo poćwicz cały materiał we własnym tempie.</p><div class="hero-actions">${heroAction}<a class="btn secondary" href="#subject-browse-title">Wybierz przedmiot</a></div><div class="meta-row"><span><i class="dot" aria-hidden="true"></i>${items.length} zagadnień</span><span>Bez pośpiechu</span><span>Własne schematy</span></div></div><div class="hero-map" role="img" aria-label="Kolorowa mapa odkryć z górami, rzeką i ścieżką">${V.discoveryMap()}<span class="map-caption">Wybierz swój kolejny przystanek</span></div></section>
      <section class="subject-browse" id="subject-browse" aria-labelledby="subject-browse-title"><div class="section-label"><h2 id="subject-browse-title">Przedmioty</h2><button class="text-button" data-action="home-subject" data-id="all" aria-pressed="${homeSubject === 'all'}">${homeSubject === 'all' ? 'Wszystkie wybrane' : 'Wszystkie przedmioty'}</button></div><div class="subject-grid">${subjectCards}</div></section>
      ${bookShelf}${resumePanel}
      <section class="practice-block" aria-labelledby="practice-title"><div class="section-label"><h2 id="practice-title">Jak chcesz się uczyć?</h2><span>Wybierz swój sposób</span></div>
        <div class="path-grid"><section class="path-card primary"><div class="card-top"><span class="small-icon" aria-hidden="true">Aa</span><span class="badge">POLECANE NA POCZĄTEK</span></div><p class="step-label">01 / ODKRYWAM</p><h2>Uczę się krok po kroku</h2><p>Wybierz przedmiot, a potem cały materiał lub konkretny dział.</p><div class="settings"><div class="field"><label for="learn-subject">Przedmiot</label><select id="learn-subject"><option value="all" ${homeSubject === 'all' ? 'selected' : ''}>Wszystkie przedmioty</option><option value="math" ${homeSubject === 'math' ? 'selected' : ''}>Matematyka</option><option value="polish" ${homeSubject === 'polish' ? 'selected' : ''}>Język polski</option><option value="english" ${homeSubject === 'english' ? 'selected' : ''}>Język angielski</option><option value="nature" ${homeSubject === 'nature' ? 'selected' : ''}>Przyroda</option></select></div><div class="field"><label for="learn-length">Dział / zakres</label><select id="learn-length"><option value="all">Całość</option></select></div></div>${action('Zaczynam naukę <span aria-hidden="true">→</span>', 'start-learn')}<div class="math-starter">${action('Matematyka od podstaw · do 3 zadań', 'start-math-basics', 'secondary')}</div></section>
        <section class="path-card"><div class="card-top"><span class="small-icon" aria-hidden="true">✓</span><span class="badge">BEZ LIMITU CZASU</span></div><p class="step-label">02 / SPRAWDZAM</p><h2>Test z jednego przedmiotu</h2><p>Wybierz przedmiot, a potem sprawdź się z całości lub wybranego działu.</p><div class="settings"><div class="field"><label for="quiz-subject">Przedmiot</label><select id="quiz-subject"><option value="math" ${homeSubject === 'math' || homeSubject === 'all' ? 'selected' : ''}>Matematyka</option><option value="polish" ${homeSubject === 'polish' ? 'selected' : ''}>Język polski</option><option value="english" ${homeSubject === 'english' ? 'selected' : ''}>Język angielski</option><option value="nature" ${homeSubject === 'nature' ? 'selected' : ''}>Przyroda</option></select></div><div class="field"><label for="quiz-length">Dział / zakres</label><select id="quiz-length"><option value="all">Całość</option></select></div></div>${action('Rozpocznij test →', 'start-subject-quiz')}<div class="wide-actions">${action(`Test mieszany · ${MIXED_QUIZ_LENGTH} pytań`, 'start-quiz', 'secondary')}</div><p class="micro">Przy każdym dziale podajemy liczbę dostępnych pytań.</p></section></div>
      </section>
      <details class="teacher-range-drawer"><summary>Zakres od nauczyciela · Matematyka</summary><section class="teacher-range" aria-labelledby="teacher-range-title"><p class="eyebrow">ZAKRES OD NAUCZYCIELA · MATEMATYKA</p><h2 id="teacher-range-title">System dziesiątkowy, porównywanie i rachunki pamięciowe</h2><p>Możesz przećwiczyć wyłącznie te trzy zagadnienia: zapis i wartość cyfr w dużych liczbach, porównywanie liczb oraz liczenie w pamięci.</p><div class="teacher-range-actions">${action('Uczę się tego zakresu →', 'start-teacher-learn')}${action('Testuję tylko ten zakres →', 'start-teacher-quiz', 'secondary')}</div></section></details>
      <section class="topic-section"><div class="section-label"><h2>${homeSubject === 'all' ? 'Działy i zagadnienia' : `Tematy · ${e(subjectName)}`}</h2><span>Poprawnie przećwiczone: ${visibleLearned} / ${visibleItems.length}</span></div>${topicCards ? `<section class="topics" aria-label="Działy nauki">${topicCards}</section>` : '<p class="empty">W tym przedmiocie nie ma jeszcze osobnych działów.</p>'}</section>
      <div class="bottom-strip"><p>${reviews ? `Do spokojnej powtórki: <strong>${reviews}</strong>. Każda próba pomaga w nauce.` : 'Każdy temat możesz otworzyć także w biblioteczce.'}</p><div>${reviews ? `<button class="text-button" data-action="review">Powtarzam trudniejsze (${reviews}) →</button> · ` : ''}<button class="text-button" data-action="library">Biblioteczka ${items.length} tematów →</button> · <button class="text-button" data-action="materials">Jak dodajemy zdjęcia i materiały →</button></div></div>`, 'home');
    syncScopeSelectors();
  }  function materials() {
    draw(`<div class="parent-content"><div class="back-row"><button class="text-button" data-action="home">← Menu główne</button></div><p class="eyebrow">NOWE MATERIAŁY DO NAUKI</p><h1>Zdjęcie tutaj,<br>nowe ćwiczenia w aplikacji.</h1><p>Wklej lub dołącz zdjęcia stron w tej rozmowie. Odczytam ich treść, ustalę przedmiot, rozdział i numery stron, a następnie przygotuję przystępne objaśnienia oraz różne zadania i testy.</p><h2>Najpierw uzgodnimy zakres pytań</h2><p>Po analizie zdjęć zaproponuję liczbę pytań dla każdego działu i podtematu oraz sumę dla całości. Dobiorę ją tak, by przećwiczyć wszystkie ważne pojęcia i umiejętności w różnych przykładach. Zapytam, czy akceptujesz ten zakres, czy chcesz zmienić liczbę. Dopiero potem dodam uzgodniony zestaw.</p><h2>Jak dodaję materiał</h2><ul><li>Przypiszę go do matematyki, polskiego, angielskiego albo przyrody.</li><li>Zapiszę nazwę rozdziału oraz numery stron podane lub widoczne na zdjęciach.</li><li>Ułożę lekcje w dotychczasowym stylu: prosta teoria, kroki rozwiązania, pytania i odpowiedzi.</li><li>Po dodaniu ćwiczenia pojawią się w działach i w teście z całości przedmiotu.</li></ul><p>Jeśli rozdziału lub numerów stron nie widać, nie będę ich zgadywać. Możesz dopisać nazwę przedmiotu, rozdziału i stron.</p><p class="chip">Materiały w biblioteczce: ${items.length}</p></div>`, 'materials');
  }
  function chapterPage(chapterId) {
    const chapter = MaleKrokiContent.chapters.find(value => value.id === chapterId);
    const parentBook = chapter?.bookId ? (MaleKrokiContent.books || []).find(book => book.id === chapter.bookId) : null;
    const selectedItems = chapter ? chapterItems(chapter) : [];
    if (!chapter || !selectedItems.length) return home();
    const ids = JSON.stringify(selectedItems.map(item => item.id));
    const subjectNames = { math: 'Matematyka', polish: 'Język polski', english: 'Język angielski', nature: 'Przyroda' };
    const study = chapter.study;
    const list = values => Array.isArray(values) && values.length ? `<ul>${values.map(value => `<li>${e(value)}</li>`).join('')}</ul>` : '';
    const studyHtml = study ? `<details class="chapter-study"><summary>Przeczytaj omówienie i plan rozdziału</summary><div class="chapter-study-body"><h2>Krótko</h2><p>${e(study.summary || '')}</p><h2>Dokładniejsze omówienie</h2><p>${e(study.detail || '')}</p><h2>Najważniejsze wydarzenia</h2>${list(study.events)}<h2>Bohaterowie</h2>${list(study.characters)}<h2>Miejsca</h2>${list(study.places)}<h2>Trudniejsze pojęcia</h2>${list(study.vocabulary)}<h2>Pytania do namysłu</h2>${list(study.questions)}<p>${e(study.thinking || '')}</p><h2>Powiązanie z innymi rozdziałami</h2><p>${e(study.connections || '')}</p>${study.general ? `<h2>O całej lekturze</h2><p>${e(study.general.overview)}</p><h3>Główne postacie i ich cechy</h3>${list(study.general.characters)}<h3>Relacje między bohaterami</h3>${list(study.general.relationships)}<h3>Chronologia w skrócie</h3>${list(study.general.chronology)}<h3>Świat i miejsca akcji</h3><p>${e(study.general.setting)}</p><h3>Motywy</h3>${list(study.general.themes)}<h3>Symbole</h3>${list(study.general.symbols)}<h3>Narrator</h3><p>${e(study.general.narrator)}</p><h3>Typowe zagadnienia szkolne</h3>${list(study.general.school)}</div>` : '</div>'}<p class="micro">Źródło fabuły: ${e(study.source || '')}. Numery stron zależą od wydania.</p></details>` : '';
    draw(`<div class="session-wrap"><div class="back-row"><button class="text-button" data-action="${parentBook ? 'book' : 'home'}" ${parentBook ? `data-id="${e(parentBook.id)}"` : ''}>${parentBook ? '← Wróć do lektury' : '← Menu główne'}</button></div><p class="eyebrow">${parentBook ? 'LEKTURA · ROZDZIAŁ' : 'DZIAŁ WIEDZY'}</p><h1>${e(chapter.name)}</h1><p class="page-heading">${e(subjectNames[chapter.subject] || '')}${chapter.pages ? ` · ${e(pageLabel(chapter))}` : ''} · ${questionCount(selectedItems.length)}</p><p>${e(chapter.description || 'Ucz się i sprawdzaj wiedzę z tego zakresu.')}</p>${studyHtml}<div class="path-grid"><section class="path-card primary"><span class="small-icon">Aa</span><p class="step-label">ODKRYWAM</p><h2>Uczę się z działu</h2><p>Przejdź spokojnie przez wszystkie objaśnienia i ćwiczenia w tym dziale.</p>${action('Nauka z działu →','start-chapter-learn','','data-ids="'+e(ids)+'" data-subject="'+chapter.subject+'"')}</section><section class="path-card"><span class="small-icon">✓</span><p class="step-label">SPRAWDZAM</p><h2>Test z działu</h2><p>Losowa kolejność pytań z całego działu.</p>${action('Test z działu →','start-chapter-quiz','secondary','data-ids="'+e(ids)+'" data-subject="'+chapter.subject+'"')}</section></div><p class="micro">W tym dziale jest ${questionCount(selectedItems.length)}. Możesz też przejrzeć pojedyncze lekcje w biblioteczce.</p><button class="text-button" data-action="library" data-chapter="${e(chapter.id)}">Otwórz biblioteczkę →</button></div>`, 'chapter');
  }
  function bookPage(bookId) {
    const book = (MaleKrokiContent.books || []).find(value => value.id === bookId);
    if (!book) return home();
    const chapters = MaleKrokiContent.chapters.filter(chapter => chapter.bookId === book.id);
    const chapterIds = new Set(chapters.map(chapter => chapter.id));
    const bookItems = items.filter(item => chapterIds.has(item.chapterId));
    if (!bookItems.length) return home();
    const study = book.study || {};
    const learnedCount = learned(bookItems);
    const progress = Math.round(learnedCount / bookItems.length * 100);
    const list = values => Array.isArray(values) && values.length ? `<ul>${values.map(value => `<li>${e(value)}</li>`).join('')}</ul>` : '';
    const studyHtml = `<details class="chapter-study book-study" open><summary>Notatki o całej lekturze</summary><div class="chapter-study-body"><h2>O czym jest książka?</h2><p>${e(study.overview || book.description)}</p><h2>Bohaterowie</h2>${list(study.characters)}<h2>Relacje między bohaterami</h2>${list(study.relationships)}<h2>Chronologia wydarzeń</h2>${list(study.chronology)}<h2>Świat i miejsca akcji</h2><p>${e(study.setting || '')}</p><h2>Motywy</h2>${list(study.themes)}<h2>Symbole</h2>${list(study.symbols)}<h2>Narrator</h2><p>${e(study.narrator || '')}</p><h2>Ważne zagadnienia szkolne</h2>${list(study.school)}</div></details>`;
    const chapterCards = chapters.map((chapter, i) => {
      const chapterItemsList = chapterItems(chapter), done = learned(chapterItemsList);
      return `<button class="topic chapter-topic" data-action="category" data-id="${e(chapter.id)}" style="--topic:${categories.find(c => c.id === chapterItemsList[0]?.category)?.color || '#47715e'}"><span class="topic-index" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><strong>${e(chapter.name)}</strong><small>${questionCount(chapterItemsList.length)}</small><div class="progress-track"><span style="width:${chapterItemsList.length ? done / chapterItemsList.length * 100 : 0}%"></span></div><small>${done} przećwiczonych</small></button>`;
    }).join('');
    draw(`<div class="session-wrap book-page"><div class="back-row"><button class="text-button" data-action="home">← Wróć</button></div><nav class="book-trail" aria-label="Ścieżka nauki"><button data-action="home">Język polski</button><span aria-hidden="true">›</span><button data-action="home">Lektury</button><span aria-hidden="true">›</span><strong>${e(book.name)}</strong></nav><section class="book-overview"><div class="book-art" role="img" aria-label="Zaśnieżony las Narnii z latarnią i starą szafą">${V.narniaScene()}</div><div class="book-overview-copy"><p class="eyebrow">LEKTURA · CAŁA KSIĄŻKA</p><h1>${e(book.name)}</h1><p>${e(book.description || '')}</p><div class="book-progress-label"><span>Twój postęp</span><strong>${learnedCount} z ${bookItems.length} pytań</strong></div><div class="book-progress"><i style="width:${progress}%"></i></div><small>${chapters.length} rozdziałów</small></div></section><section class="book-actions" aria-label="Nauka i test"><button class="btn full" data-action="start-book-learn" data-id="${e(book.id)}">Uczę się z całej lektury <span aria-hidden="true">→</span></button><button class="btn secondary full" data-action="start-book-quiz" data-id="${e(book.id)}">Test z całej lektury <span aria-hidden="true">→</span></button></section><section class="book-notes">${studyHtml}</section><section class="chapter-list"><div class="section-label"><h2>Rozdziały</h2><span>Możesz też uczyć się osobno z każdego</span></div><section class="topics" aria-label="Rozdziały lektury">${chapterCards}</section></section></div>`, 'book');
  }  function start(mode, subject = 'all', length = 10, ids = null, preserveOrder = false, showQuestion = false) {
    let pool = ids || items.filter(item => subject === 'all' || subjectOf(item) === subject).map(item => item.id);
    if (!pool.length) return home();
    if (!preserveOrder) pool = C.shuffle(pool);
    const limit = length === 'all' ? pool.length : Number(length);
    session = C.createSession(pool.slice(0, limit), mode, Math.random, { preserveOrder });
    C.advance(session, getAnswers);
    if (showQuestion) session.stage = 'question';
    save(); renderSession();
  }
  function startMathBasics() {
    const remaining = MATH_STARTER_IDS.filter(id => !progress[id]?.ok || progress[id]?.review);
    const pool = remaining.length ? remaining : MATH_STARTER_IDS;
    start('learn', 'math', 3, pool, true);
  }
  function progressHeader() {
    const stats = C.summary(session);
    const subjects = new Set(session.ids.map(id => subjectOf(byId.get(id))));
    const names = { math: 'matematyki', polish: 'polskiego', english: 'angielskiego', nature: 'przyrody' };
    const subjectName = subjects.size === 1 ? names[[...subjects][0]] : null;
    const chapterIds = new Set(session.ids.map(id => byId.get(id)?.chapterId));
    const chapter = chapterIds.size === 1 ? MaleKrokiContent.chapters.find(c => c.id === [...chapterIds][0]) : null;
    const chapterName = chapter ? ` · ${chapter.name}${chapter.pages ? `, ${pageLabel(chapter)}` : ''}` : '';
    const label = session.mode === 'learn' ? `Nauka${subjectName ? ' · ' + subjectName : ''}${chapterName}` :
      subjectName ? `Test z ${subjectName}${chapterName}` : 'Test mieszany';
    const currentChapter = chapterOf(byId.get(session.current));
    const resultIds = Object.keys(session.results);
    if (session.stage === 'feedback' && resultIds.at(-1) === session.current) resultIds.pop();
    const previousChapter = resultIds.length ? chapterOf(byId.get(resultIds.at(-1))) : null;
    const chapterIntro = session.mode === 'learn' && currentChapter?.description && currentChapter.id !== previousChapter?.id
      ? `<aside class="chapter-intro"><strong>${e(currentChapter.name)}.</strong> ${e(currentChapter.description)}</aside>` : '';
    return `<div class="session-top"><button class="text-button" data-action="home">← Menu <span class="sr-only">(postęp zostanie zapisany)</span></button><span>${e(label)} · ukończono ${stats.completed} z ${stats.total}</span></div><div class="progress-track session-progress" role="progressbar" aria-label="Ukończone pytania" aria-valuemin="0" aria-valuemax="${stats.total}" aria-valuenow="${stats.completed}"><span style="width:${100 * stats.completed / stats.total}%"></span></div>${chapterIntro}`;
  }
  const voiceKey = voice => `${voice.lang}|${voice.voiceURI}`;
  function voiceOptionMarkup(selected) {
    const voices = speechVoices.filter(voice => /^en(?:-|_)/i.test(voice.lang));
    const options = voices.map(voice => `<option value="${e(voiceKey(voice))}" ${voiceKey(voice) === selected ? 'selected' : ''}>${e(voice.name)} · ${e(voice.lang)}</option>`).join('');
    return `<option value="auto" ${selected === 'auto' ? 'selected' : ''}>Automatyczny · English UK</option>${options || '<option value="" disabled>Brak zainstalowanego głosu angielskiego</option>'}`;
  }
  function refreshSpeechVoices() {
    try { speechVoices = window.speechSynthesis?.getVoices?.() || []; } catch { speechVoices = []; }
    const picker = main.querySelector('#english-voice');
    if (picker) {
      let selected = picker.value || 'auto';
      if (selected !== 'auto' && !speechVoices.some(voice => voiceKey(voice) === selected)) selected = 'auto';
      picker.innerHTML = voiceOptionMarkup(selected);
      picker.value = selected;
    }
  }
  function englishVoicePicker() {
    let selected = 'auto';
    try { selected = JSON.parse(read('english-voice')) || 'auto'; } catch { selected = 'auto'; }
    if (selected !== 'auto' && !speechVoices.some(voice => voiceKey(voice) === selected)) selected = 'auto';
    return `<label class="voice-picker">Głos angielski <select id="english-voice">${voiceOptionMarkup(selected)}</select></label>`;
  }
  function audioButton(label, lang, text = '') {
    return `<button class="text-button" data-action="audio" data-lang="${lang}" data-text="${e(text)}" data-label="${e(label)}">▷ ${label}</button>`;
  }
  function audioControl(item, englishQuestion = false) {
    if (item?.category === 'english') {
      const controls = audioButton(englishQuestion ? 'Posłuchaj angielskiego' : 'Posłuchaj wymowy', 'en-GB', item.speechText || item.question);
      return `<div class="audio-row">${controls}${englishQuestion ? '' : audioButton('Posłuchaj wyjaśnienia po polsku', 'pl-PL', item.theory)}${englishVoicePicker()}<span class="audio-status" id="audio-status" role="status"></span></div>`;
    }
    return `<div class="audio-row">${audioButton('Posłuchaj wyjaśnienia', 'pl-PL')}<span class="audio-status" id="audio-status" role="status"></span></div>`;
  }
  function renderSession() {
    if (!session) return home();
    if (session.stage === 'done') return results();
    const item = byId.get(session.current), cat = categoryOf(item);
    const math = isMath(item);
    const showingExample = math && (session.stage === 'theory' || session.stage === 'recall');
    let content = '';
    if (showingExample) {
      content = `<h1>${e(item.title)}</h1><p class="theory">${e(item.theory)}</p>${V.render(item)}${audioControl(item)}<div class="actions">${action('Rozwiąż podobne zadanie →', 'question')}${session.stage === 'theory' && !session.reviewing ? action('Odłóż na koniec', 'skip', 'ghost') : ''}</div>`;
    } else if (session.stage === 'theory') {
      content = `<h1>${e(item.title)}</h1>${audioControl(item)}<p class="theory">${e(item.theory)}</p>${V.render(item)}<p class="recall-hint">Przyjrzyj się schematowi. Za chwilę schowamy wyjaśnienie i spróbujesz przypomnieć je sobie własnymi słowami.</p><div class="actions">${session.reviewing ? '<span class="micro">Wracamy do odłożonych pytań — już ich nie odkładamy.</span>' : action('Odkładam na koniec', 'skip', 'ghost')}${action('Rozumiem — sprawdzam pamięć →', 'recall')}</div>`;
    } else if (session.stage === 'recall') {
      content = `<div class="recall-panel"><div class="memory-symbol" aria-hidden="true">?</div><p class="eyebrow">CHWILA DLA PAMIĘCI</p><h1>Teraz Twoimi słowami</h1><p>${e(item.recall)}</p><small>Powiedz odpowiedź na głos lub w myślach. Nie musisz jej wpisywać.</small></div><div class="actions">${action('Potrzebuję przypomnienia', 'back-theory', 'ghost')}${action('Przechodzę do pytania →', 'question')}</div>`;
    } else {
      const answered = session.stage === 'feedback';
      const hint = math && session.mode === 'learn' && !answered
        ? `<details class="math-hint"><summary>Zobacz przykład z tablicy</summary>${V.render(item)}</details>` : '';
      const instruction = math ? 'Wybierz jedną odpowiedź.' :
        `Wybierz jedną odpowiedź. ${session.mode === 'learn' ? 'Wyjaśnienie jest teraz schowane.' : 'Masz tyle czasu, ile potrzebujesz.'}`;
      const audio = answered && !math ? audioControl(item, item.category === 'english') : '';
      content = `<h1${math ? ' class="math-question"' : ''}>${e(item.question)}</h1><p class="micro">${instruction}</p>${audio}${hint}<div class="answers">${session.order.map((original, i) => {
        let cls = '', state = '';
        if (answered && original === item.correct) { cls = 'correct'; state = '✓ Poprawna'; }
        else if (answered && original === session.choice) { cls = 'wrong'; state = 'Twoja'; }
        return `<button class="answer ${cls}" data-action="answer" data-index="${original}" ${answered ? 'disabled' : ''}><span class="answer-letter" aria-hidden="true">${String.fromCharCode(65 + i)}</span><span>${e(item.answers[original])}</span>${state ? `<span class="answer-state">${state}</span>` : ''}</button>`;
      }).join('')}</div>`;
      if (answered && math) {
        const correct = session.results[item.id];
        const label = correct ? 'Tak, to poprawna odpowiedź.' : 'Zobacz poprawną odpowiedź.';
        content += `<div class="feedback math-feedback ${correct ? '' : 'error'}" role="status"><strong>${label}</strong><p class="board-answer">${e(item.answers[item.correct])}</p>${V.boardSteps(item.solution)}</div><div class="actions">${action('Następny krok →', 'next')}</div>`;
      } else if (answered) {
        const correct = session.results[item.id];
        content += `<div class="feedback ${correct ? '' : 'error'}" role="status"><strong>${correct ? 'Tak, właśnie tak!' : 'Jeszcze to poćwiczymy. To część nauki.'}</strong><p>${correct ? '' : `Poprawna odpowiedź: <strong>${e(item.answers[item.correct])}</strong>. `}${e(item.feedback || item.theory)}</p></div>${correct ? '' : V.render(item)}<div class="actions">${action('Następny krok →', 'next')}</div>`;
      }
    }
    const heading = ['question', 'recall'].includes(session.stage) ? (chapterOf(item)?.name || 'Ćwiczenie') : item.title;
    draw(`<div class="session-wrap">${progressHeader()}<article class="lesson"><div class="session-header"><p class="eyebrow">${e(cat?.short || 'Materiał')} · ${e(heading)}</p><span class="chip">${showingExample ? 'Przykład' : session.stage === 'theory' ? 'Poznaję' : session.stage === 'recall' ? 'Przypominam' : 'Ćwiczę'}</span></div>${content}</article></div>`, 'session');
  }
  function submitAnswer(index) {
    if (!session) return;
    const item = byId.get(session.current);
    if (!C.answer(session, index, item.correct)) return;
    const ok = session.results[item.id];
    progress[item.id] = { ok: ok || Boolean(progress[item.id]?.ok), review: !ok };
    write('progress', progress); save(); renderSession();
  }
  function results() {
    const s = C.summary(session);
    draw(`<div class="session-wrap"><div class="back-row"><button class="text-button" data-action="home">← Menu</button></div><section class="lesson"><div class="result-heading"><p class="eyebrow">TWÓJ DZISIEJSZY KROK</p><h1>${s.correct === s.total ? 'Dobra robota!' : 'Kolejny krok za Tobą.'}</h1><div class="result-score">${s.correct}<small>poprawne odpowiedzi · z ${s.total}</small></div><p>${s.wrong.length ? 'Wiesz już, które zagadnienia warto spokojnie powtórzyć.' : 'Wszystkie odpowiedzi w tej sesji były poprawne. Możesz zrobić przerwę lub odkryć kolejny temat.'}</p></div><h3>Co dziś ćwiczyłaś?</h3><ul class="results-list">${session.ids.map(id => `<li class="${session.results[id] ? 'good' : ''}"><span class="status-word">${session.results[id] ? '✓ Poprawnie' : '↻ Do powtórki'}</span>${e(byId.get(id).title)}</li>`).join('')}</ul><div class="wide-actions">${s.wrong.length ? action(`Powtarzam trudniejsze (${s.wrong.length})`, 'retry') : action('Kolejny mały krok', 'new-learn')}${action('Wracam do menu', 'home', 'secondary')}</div><p class="micro">Wynik dotyczy tej sesji. Powtórka zaczyna nową sesję i nie zmienia tego wyniku.</p></section></div>`, 'results');
  }
  function library() {
    const books = MaleKrokiContent.books || [];
    const regularChapters = MaleKrokiContent.chapters.filter(chapter => !chapter.bookId);
    const regularOptions = regularChapters.map(chapter => `<option value="${e(chapter.id)}" ${chapter.id === libraryCategory ? 'selected' : ''}>${e(chapter.name)} · ${questionCount(chapterItems(chapter).length)}</option>`).join('');
    const bookOptions = books.map(book => {
      const bookChapters = MaleKrokiContent.chapters.filter(chapter => chapter.bookId === book.id);
      const bookItems = items.filter(item => bookChapters.some(chapter => chapter.id === item.chapterId));
      const wholeBook = `<option value="book:${e(book.id)}" ${libraryCategory === `book:${book.id}` ? 'selected' : ''}>${e(book.name)} · całość · ${questionCount(bookItems.length)}</option>`;
      const chapterOptions = bookChapters.map(chapter => `<option value="${e(chapter.id)}" ${chapter.id === libraryCategory ? 'selected' : ''}>↳ ${e(chapter.name)} · ${questionCount(chapterItems(chapter).length)}</option>`).join('');
      return wholeBook + chapterOptions;
    }).join('');
    draw(`<div class="back-row"><button class="text-button" data-action="home">← Menu</button></div><div class="page-heading"><p class="eyebrow">TWOJA BIBLIOTECZKA</p><h1>Do którego tematu wrócimy?</h1><p>Otwórz dowolny temat, obejrzyj schemat i przypomnij sobie wyjaśnienie.</p></div><div class="library-toolbar"><div class="field"><label for="library-search">Szukam tematu lub słowa</label><input type="search" id="library-search" value="${e(librarySearch)}" placeholder="Na przykład: sylaby, liczby, legenda" autocomplete="off"></div><div class="field"><label for="library-category">Dział wiedzy</label><select id="library-category"><option value="all">Wszystkie działy</option>${regularOptions ? `<optgroup label="Działy wiedzy">${regularOptions}</optgroup>` : ''}${bookOptions ? `<optgroup label="Język polski · Lektury">${bookOptions}</optgroup>` : ''}</select></div></div><p id="library-count" class="micro" role="status"></p><div id="library-list" class="library-list"></div>`, 'library');
    updateLibrary();
  }
  function updateLibrary() {
    const query = librarySearch.toLocaleLowerCase('pl').trim();
    const selectedBook = libraryCategory.startsWith('book:') ? (MaleKrokiContent.books || []).find(book => `book:${book.id}` === libraryCategory) : null;
    const bookChapterIds = selectedBook ? new Set(MaleKrokiContent.chapters.filter(chapter => chapter.bookId === selectedBook.id).map(chapter => chapter.id)) : null;
    const found = items.filter(x => (libraryCategory === 'all' || (selectedBook ? bookChapterIds.has(x.chapterId) : x.chapterId === libraryCategory)) && (x.title + ' ' + x.theory + ' ' + x.question).toLocaleLowerCase('pl').includes(query));
    document.getElementById('library-count').textContent = `Znaleziono: ${found.length} z ${items.length} tematów`;
    document.getElementById('library-list').innerHTML = found.length ? found.map(x => `<button class="library-item" data-action="open-item" data-id="${x.id}"><small>${e(chapterOf(x)?.name || 'Materiał')}</small><strong>${e(x.title)}</strong><span>${progress[x.id]?.review ? '↻ Do powtórki' : progress[x.id]?.ok ? '✓ Przećwiczone poprawnie' : 'Odkryj temat →'}</span></button>`).join('') : '<p class="empty">Nie znalazłam takiego tematu. Spróbuj krótszego słowa lub wybierz wszystkie działy.</p>';
  }
  let libraryItem = null;
  function openItem(id) {
    const item = byId.get(id); if (!item) return;
    libraryItem = item;
    const chapter = chapterOf(item) || categoryOf(item);
    draw(`<div class="session-wrap"><div class="back-row"><button class="text-button" data-action="library">← Biblioteczka</button></div><article class="lesson"><p class="eyebrow">${e(chapter?.name || chapter?.chapter || chapter?.short || 'Materiał')}${chapter?.pages ? ` · ${e(pageLabel(chapter))}` : ''}</p><h1>${e(item.title)}</h1>${audioControl(item)}<p class="theory">${e(item.theory)}</p>${V.render(item)}${isMath(item) ? '' : `<p class="recall-hint">${e(item.recall)}</p>`}<div class="actions">${action(isMath(item) ? 'Rozwiąż podobne zadanie →' : 'Ćwiczę ten temat →', 'practice-item')}${action('Wracam do biblioteczki', 'library', 'secondary')}</div></article></div>`, 'item');
  }
  function parent() {
    save();
    draw(`<div class="parent-content"><button class="text-button" data-action="home">← Menu</button><p class="eyebrow">DLA RODZICA LUB OPIEKUNA</p><h1>Spokojna nauka.<br>Jasne zasady.</h1><p>To autorska pomoc do nauki matematyki, języka polskiego, angielskiego i przyrody. Nowe działy opracowano na podstawie zdjęć podręcznika przekazanych przez opiekuna.</p><h2>Jak korzystać</h2><ul><li>Wybierzcie dział lub cały przedmiot. Po kilku minutach można zrobić przerwę.</li><li>W matematyce dziecko ogląda przykład na tablicy i rozwiązuje podobne zadanie. W pozostałych działach teoria poprzedza przypomnienie z pamięci.</li><li>Odkładane tematy wracają na końcu sesji. W drugiej kolejce nie można odkładać ich ponownie.</li><li>Po błędzie odpowiedź i wyjaśnienie pozostają na ekranie tak długo, jak potrzeba. Trudniejsze tematy czekają w powtórkach.</li><li>„Przećwiczone poprawnie” oznacza co najmniej jedną poprawną odpowiedź. Nie jest diagnozą trwałego opanowania wiedzy.</li></ul><h2>Treści i ilustracje</h2><p>Baza zawiera ${items.length} zagadnień w ${MaleKrokiContent.chapters.length} działach. Każdy dział można przejść w nauce lub w teście jako całość.</p><details><summary>Źródła do sprawdzenia zakresu</summary><ul><li>Polski: zdjęcia stron 11–60; angielski: zdjęcia stron 20–33; przyroda: zdjęcia stron 12–52 przekazane przez opiekuna.</li><li>Matematyka: baza z poprzedniej wersji i dodatkowe zadania na podstawie zdjęć podręcznika.</li></ul><p>Zakres i ograniczenia opisano w pliku SOURCES.md.</p></details><h2>Prywatność i zapis</h2><p>Nie ma kont, formularzy danych dziecka, reklam ani analityki. Postęp i bieżąca sesja są zapisywane tylko w pamięci tej przeglądarki. Nie synchronizują się między urządzeniami. Tryb prywatny lub wyczyszczenie danych strony może usunąć zapis.</p><h2>Czytanie na głos i internet</h2><p>Do angielskiego można wybrać dostępny głos English; polski głos nie jest używany do odczytu angielskich słów. Dostępność i jakość wymowy zależą od systemowego syntezatora oraz wybranego głosu. Dla polskich wyjaśnień używany jest głos polski, jeśli jest dostępny. Niektóre głosy potrzebują internetu.</p><p>Ilustracje i czcionki nie są pobierane z obcych serwerów. Do pierwszego otwarcia potrzebne jest połączenie z internetem; po zapisaniu plików przez przeglądarkę aplikacja może działać offline. Linki do źródeł wymagają internetu.</p><h2>Wyczyść postęp</h2><p>Ta opcja usuwa lokalne odpowiedzi, powtórki i zapisaną sesję z tej przeglądarki.</p><details id="reset-section"><summary>Chcę wyczyścić lokalne postępy</summary><p>Usunięcie nie ma funkcji cofania.</p>${action('Usuwam postępy i sesję', 'clear-progress', 'ghost')}</details><p class="micro">Cztery przedmioty · klasa 4.</p></div>`, 'parent');
  }  function audio(button) {
    const status = document.getElementById('audio-status');
    if (!status || !button) return;
    if (speaking) { stopAudio(); status.textContent = 'Czytanie zatrzymane.'; main.querySelectorAll('[data-action="audio"]').forEach(b => { b.textContent = '▷ ' + b.dataset.label; }); return; }
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) { status.textContent = 'Ta przeglądarka nie obsługuje czytania na głos.'; return; }
    const item = currentView === 'item' ? libraryItem : byId.get(session?.current);
    const lang = button.dataset.lang || 'pl-PL';
    const text = button.dataset.text || (isMath(item) ? [item.theory, ...item.visual.steps, item.visual.caption].filter(Boolean).join(' ') : item?.theory);
    if (!text) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang; utterance.rate = lang.startsWith('en') ? 0.78 : 0.88;
      refreshSpeechVoices();
      const voices = lang.startsWith('en') ? speechVoices.filter(v => /^en(?:-|_)/i.test(v.lang)) : speechVoices.filter(v => /^pl(?:-|_)/i.test(v.lang));
      const preferred = main.querySelector('#english-voice')?.value || 'auto';
      const voice = lang.startsWith('en')
        ? (preferred === 'auto' ? voices.find(v => /^en[-_]GB$/i.test(v.lang)) || voices[0] : voices.find(v => voiceKey(v) === preferred))
        : voices.find(v => /^pl[-_]PL$/i.test(v.lang)) || voices[0];
      if (lang.startsWith('en') && !voice) { status.textContent = 'Brak głosu angielskiego. Zainstaluj głos English w urządzeniu, a potem odśwież aplikację.'; return; }
      if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
      utterance.onstart = () => { if (speaking === utterance) status.textContent = 'Czytam…'; };
      const finish = message => { if (speaking === utterance) { speaking = null; if (document.contains(status)) { status.textContent = message; button.textContent = '▷ ' + button.dataset.label; } } };
      utterance.onend = () => finish('Koniec czytania.');
      utterance.onerror = () => finish('Odsłuch jest niedostępny. Tekst pozostaje na ekranie.');
      speaking = utterance; button.textContent = '■ Zatrzymaj czytanie';
      status.textContent = voice ? `Głos: ${voice.name} (${voice.lang})` : 'Przygotowuję głos systemowy…';
      window.speechSynthesis.speak(utterance);
    } catch { stopAudio(); status.textContent = 'Nie udało się uruchomić czytania na tym urządzeniu.'; button.textContent = '▷ ' + button.dataset.label; }
  }
  document.getElementById('home').addEventListener('click', home);
  document.getElementById('help').addEventListener('click', parent);
  document.getElementById('nav-start').addEventListener('click', home);
  document.getElementById('nav-books').addEventListener('click', () => bookPage('narnia-book'));
  document.getElementById('nav-exercises').addEventListener('click', library);
  main.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]'); if (!button || button.disabled) return;
    switch (button.dataset.action) {
      case 'home': home(); break;
      case 'materials': materials(); break;
      case 'resume': renderSession(); break;
      case 'start-learn': startSelection('learn', document.getElementById('learn-subject').value, document.getElementById('learn-length').value); break;
      case 'start-math-basics': startMathBasics(); break;
      case 'start-teacher-learn': startMathTeacherScope('learn'); break;
      case 'start-teacher-quiz': startMathTeacherScope('quiz'); break;
      case 'start-quiz': start('quiz', 'all', MIXED_QUIZ_LENGTH); break;
      case 'start-math-quiz': start('quiz', 'math', MATH_QUIZ_LENGTH); break;
      case 'start-subject-quiz': startSelection('quiz', document.getElementById('quiz-subject').value, document.getElementById('quiz-length').value); break;
      case 'start-chapter-learn': start('learn', button.dataset.subject, 'all', JSON.parse(button.dataset.ids)); break;
      case 'start-chapter-quiz': start('quiz', button.dataset.subject, 'all', JSON.parse(button.dataset.ids), false, true); break;
      case 'start-book-learn': startBook('learn', button.dataset.id); break;
      case 'start-book-quiz': startBook('quiz', button.dataset.id); break;
      case 'start-polish-quiz': start('quiz', 'polish', SUBJECT_QUIZ_LENGTH); break;
      case 'start-english-quiz': start('quiz', 'english', SUBJECT_QUIZ_LENGTH); break;
      case 'start-nature-quiz': start('quiz', 'nature', SUBJECT_QUIZ_LENGTH); break;
      case 'new-learn': start('learn'); break;
      case 'home-subject': homeSubject = button.dataset.id || 'all'; home(); break;
      case 'category': chapterPage(button.dataset.id); break;
      case 'book': bookPage(button.dataset.id); break;
      case 'library':
        if (currentView !== 'item') { libraryCategory = button.dataset.chapter || 'all'; librarySearch = ''; }
        library();
        break;
      case 'open-item': openItem(button.dataset.id); break;
      case 'practice-item': start('learn', 'all', 'all', [libraryItem.id], true, isMath(libraryItem)); break;
      case 'review': start('learn', 'all', 'all', reviewIds()); break;
      case 'retry': { const wrong = C.summary(session).wrong; start('learn', 'all', 'all', wrong); break; }
      case 'skip': if (C.skip(session, getAnswers)) { save(); renderSession(); } break;
      case 'recall': if (session?.stage === 'theory') { session.stage = 'recall'; save(); renderSession(); } break;
      case 'back-theory': if (session?.stage === 'recall') { session.stage = 'theory'; save(); renderSession(); } break;
      case 'question': if (session?.stage === 'recall' || (session?.stage === 'theory' && isMath(byId.get(session.current)))) { session.stage = 'question'; save(); renderSession(); } break;
      case 'answer': submitAnswer(Number(button.dataset.index)); break;
      case 'next': if (session?.stage === 'feedback') { C.advance(session, getAnswers); save(); renderSession(); } break;
      case 'audio': audio(button); break;
      case 'clear-progress': progress = {}; session = null; write('progress', null); write('session', null); home(); break;
    }
  });
  main.addEventListener('input', event => { if (event.target.id === 'library-search') { librarySearch = event.target.value; updateLibrary(); } });
  main.addEventListener('change', event => {
    if (['learn-subject', 'quiz-subject'].includes(event.target.id)) syncScopeSelectors();
    if (event.target.id === 'library-category') { libraryCategory = event.target.value; updateLibrary(); }
    if (event.target.id === 'english-voice') write('english-voice', event.target.value);
  });
  window.addEventListener('pagehide', () => { save(); stopAudio(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); stopAudio(); } });
  function offline() {
    const label = document.getElementById('offline-status');
    label.textContent = 'Aplikacja sprawdza aktualizacje automatycznie.';
    checkForUpdate();
    window.setInterval(checkForUpdate, 45_000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkForUpdate();
    });
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration('./').then(registration => {
        const worker = registration?.active || registration?.waiting || registration?.installing;
        if (worker?.scriptURL === new URL('./sw.js', document.baseURI).href) return registration.unregister();
      }).catch(() => {});
    }
  }
  refreshSpeechVoices();
  try { window.speechSynthesis?.addEventListener?.('voiceschanged', refreshSpeechVoices); } catch { /* Głosy są dodatkiem zależnym od urządzenia. */ }
  home(); document.getElementById('storage-notice').hidden = storageOK; offline();
})();








