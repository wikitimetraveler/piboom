/**
 * Dinosaur Hall — content UI, filters, compare, quiz, deep links.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const CONTENT_URL = '/nature/data/dinosaur-content.json';

  const state = {
    content: null,
    era: 'jurassic',
    filter: 'all',
    selectedId: null,
    quizAnswers: {}
  };

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function speciesById(id) {
    return (state.content?.species || []).find((s) => s.id === id) || null;
  }

  function setGuideStatus(msg) {
    const el = document.getElementById('dhGuideStatus');
    if (el) el.textContent = msg;
  }

  function renderEras() {
    const chips = document.getElementById('dhEraChips');
    const eras = state.content?.eras || [];
    if (!chips) return;
    chips.innerHTML = eras
      .map(
        (era) =>
          `<button type="button" class="dh-chip${era.id === state.era ? ' is-active' : ''}" data-era="${esc(era.id)}">${esc(era.label)}</button>`
      )
      .join('');
    chips.querySelectorAll('[data-era]').forEach((btn) => {
      btn.addEventListener('click', () => setEra(btn.getAttribute('data-era')));
    });
    updateEraPanel();
  }

  function updateEraPanel() {
    const era = (state.content?.eras || []).find((e) => e.id === state.era);
    const panel = document.getElementById('dhEraPanel');
    if (!panel || !era) return;
    panel.hidden = false;
    const label = document.getElementById('dhEraLabel');
    const years = document.getElementById('dhEraYears');
    const summary = document.getElementById('dhEraSummary');
    if (label) label.textContent = era.label;
    if (years) years.textContent = era.years;
    if (summary) summary.textContent = era.summary;
  }

  function setEra(eraId, opts) {
    if (!eraId) return;
    state.era = eraId;
    document.querySelectorAll('#dhEraChips [data-era]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-era') === eraId);
    });
    updateEraPanel();
    window.DinosaurHallScene?.setEra?.(eraId);
    setGuideStatus(`Restaged: ${(state.content?.eras || []).find((e) => e.id === eraId)?.label || eraId}`);
    if (!opts?.skipFilterSync && (state.filter === 'triassic' || state.filter === 'jurassic' || state.filter === 'cretaceous')) {
      setFilter(eraId);
    }
    if (!opts?.silent) {
      const url = new URL(window.location.href);
      url.searchParams.set('era', eraId);
      window.history.replaceState({}, '', url);
    }
  }

  function matchesFilter(sp) {
    const f = state.filter;
    if (f === 'all') return true;
    if (f === 'not-dino') return sp.isDinosaur === false;
    if (f === 'carnivore' || f === 'herbivore') return sp.diet === f;
    if (f === 'triassic' || f === 'jurassic' || f === 'cretaceous') return sp.era === f;
    return true;
  }

  function renderSpecies() {
    const grid = document.getElementById('dhSpeciesGrid');
    if (!grid) return;
    const list = (state.content?.species || []).filter(matchesFilter);
    if (!list.length) {
      grid.innerHTML = '<p class="text-muted">No species match this filter.</p>';
      return;
    }
    grid.innerHTML = list
      .map((sp) => {
        const tags = [
          `<span class="dh-tag">${esc(sp.era)}</span>`,
          `<span class="dh-tag">${esc(sp.diet)}</span>`,
          sp.isDinosaur === false ? '<span class="dh-tag dh-tag--warn">Not a dinosaur</span>' : '',
          Array.isArray(sp.museums) && sp.museums.length ? `<span class="dh-tag">${sp.museums.length} museums</span>` : ''
        ]
          .filter(Boolean)
          .join('');
        return `<button type="button" class="dh-card${sp.id === state.selectedId ? ' is-selected' : ''}" data-species-id="${esc(sp.id)}" aria-pressed="${sp.id === state.selectedId ? 'true' : 'false'}">
          <img class="dh-card-img" src="${esc(sp.image)}" alt="" loading="lazy" onerror="this.style.display='none'"/>
          <div class="dh-card-body">
            <h3>${esc(sp.commonName)}</h3>
            <p class="dh-card-binom">${esc(sp.binomial)}</p>
            <div class="dh-card-tags">${tags}</div>
          </div>
        </button>`;
      })
      .join('');
    grid.querySelectorAll('[data-species-id]').forEach((card) => {
      card.addEventListener('click', () => selectSpecies(card.getAttribute('data-species-id')));
    });
  }

  function setFilter(filter) {
    state.filter = filter || 'all';
    document.querySelectorAll('#dhSpeciesFilters [data-filter]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-filter') === state.filter);
    });
    renderSpecies();
  }

  function selectSpecies(id, opts) {
    const sp = speciesById(id);
    if (!sp) return;
    state.selectedId = id;
    renderSpecies();
    showDetail(sp);
    if (sp.era !== state.era) {
      setEra(sp.era, { skipFilterSync: true, silent: opts?.silent });
    }
    // Restage is sync; spotlight after era switch so the mesh exists.
    requestAnimationFrame(() => {
      window.DinosaurHallScene?.spotlight?.(id, { silent: true });
    });
    setGuideStatus(`Selected: ${sp.commonName}`);
    if (!opts?.silent) {
      const url = new URL(window.location.href);
      url.searchParams.set('dino', id);
      window.history.replaceState({}, '', url);
    }
    if (!opts?.noScroll && opts?.scrollDetail !== false) {
      // Keep diorama in view — don't yank the page on every click
      document.getElementById('dhDetail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function showDetail(sp) {
    const section = document.getElementById('dhDetail');
    if (!section || !sp) return;
    section.hidden = false;
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text || '';
    };
    set('dhDetailName', sp.commonName);
    set('dhDetailBinom', sp.binomial);
    set('dhDetailNotable', sp.notable);
    set('dhDetailMyth', sp.misconception);
    set('dhDetailEvidence', sp.evidence);
    set('dhDetailEra', sp.era);
    set('dhDetailDiet', sp.diet);
    set('dhDetailLength', `${sp.lengthM} m`);
    set('dhDetailClade', sp.isDinosaur === false ? 'Not a dinosaur' : 'Dinosaur');
    set('dhDetailCredit', sp.imageCredit || 'Wikimedia Commons');
    renderMuseums(sp);
    const img = document.getElementById('dhDetailImg');
    if (img) {
      img.src = sp.image || '';
      img.alt = sp.commonName || '';
      img.onerror = () => {
        img.style.display = 'none';
      };
      img.style.display = '';
    }
  }

  function renderMuseums(sp) {
    const wrap = document.getElementById('dhDetailMuseums');
    const list = document.getElementById('dhMuseumList');
    const museums = Array.isArray(sp.museums) ? sp.museums : [];
    if (!wrap || !list) return;
    wrap.hidden = museums.length === 0;
    list.innerHTML = museums
      .map((m) => {
        const scale = m.scale === 'small' ? 'Smaller museum' : 'Large museum';
        const kind = m.kind === 'cast' ? 'Cast or historic replica' : 'Original bones';
        return `<li class="dh-museum-item">
          <a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">${esc(m.name)}</a>
          <span class="dh-museum-meta">${esc(m.place)} · ${scale} · ${kind}</span>
          <span class="dh-museum-holds">${esc(m.holds)}</span>
        </li>`;
      })
      .join('');
  }

  function fillCompareSelects() {
    const a = document.getElementById('dhCompareA');
    const b = document.getElementById('dhCompareB');
    if (!a || !b) return;
    const opts = (state.content?.species || [])
      .map((sp) => `<option value="${esc(sp.id)}">${esc(sp.commonName)} (${sp.lengthM} m)</option>`)
      .join('');
    a.innerHTML = opts;
    b.innerHTML = opts;
    a.value = 'velociraptor';
    b.value = 'tyrannosaurus';
  }

  function runCompare() {
    const idA = document.getElementById('dhCompareA')?.value;
    const idB = document.getElementById('dhCompareB')?.value;
    const spA = speciesById(idA);
    const spB = speciesById(idB);
    const result = document.getElementById('dhCompareResult');
    const bars = document.getElementById('dhCompareBars');
    const summary = document.getElementById('dhCompareSummary');
    if (!spA || !spB || !result || !bars) return;
    const max = Math.max(spA.lengthM, spB.lengthM, 1);
    bars.innerHTML = [spA, spB]
      .map(
        (sp) => `<div class="dh-compare-row">
          <div class="dh-compare-label"><span>${esc(sp.commonName)}</span><span>${sp.lengthM} m</span></div>
          <div class="dh-compare-track"><div class="dh-compare-fill" style="width:${(sp.lengthM / max) * 100}%"></div></div>
        </div>`
      )
      .join('');
    const ratio = (Math.max(spA.lengthM, spB.lengthM) / Math.min(spA.lengthM, spB.lengthM)).toFixed(1);
    if (summary) {
      summary.textContent =
        spA.lengthM === spB.lengthM
          ? `${spA.commonName} and ${spB.commonName} are about the same published length.`
          : `${spA.lengthM >= spB.lengthM ? spA.commonName : spB.commonName} is about ${ratio}× longer (field-guide estimate).`;
    }
    result.hidden = false;
  }

  function renderQuiz() {
    const board = document.getElementById('dhQuizBoard');
    const quiz = state.content?.quiz || [];
    if (!board) return;
    board.innerHTML = quiz
      .map((q, qi) => {
        const choices = (q.choices || [])
          .map(
            (c) =>
              `<button type="button" class="dh-quiz-choice" data-quiz="${esc(q.id)}" data-choice="${esc(c.id)}">${esc(c.label)}</button>`
          )
          .join('');
        return `<article class="dh-quiz-card" data-quiz-card="${esc(q.id)}">
          <h3>${qi + 1}. ${esc(q.question)}</h3>
          <div class="dh-quiz-choices">${choices}</div>
          <p class="dh-quiz-explain" id="dhExplain-${esc(q.id)}" hidden></p>
        </article>`;
      })
      .join('');
    board.querySelectorAll('.dh-quiz-choice').forEach((btn) => {
      btn.addEventListener('click', () => answerQuiz(btn.getAttribute('data-quiz'), btn.getAttribute('data-choice')));
    });
  }

  function answerQuiz(quizId, choiceId) {
    const q = (state.content?.quiz || []).find((item) => item.id === quizId);
    if (!q || state.quizAnswers[quizId]) return;
    state.quizAnswers[quizId] = choiceId;
    const card = document.querySelector(`[data-quiz-card="${quizId}"]`);
    if (!card) return;
    card.querySelectorAll('.dh-quiz-choice').forEach((btn) => {
      const cid = btn.getAttribute('data-choice');
      btn.disabled = true;
      if (cid === q.answerId) btn.classList.add('is-correct');
      else if (cid === choiceId) btn.classList.add('is-wrong');
    });
    const explain = document.getElementById(`dhExplain-${quizId}`);
    if (explain) {
      explain.hidden = false;
      explain.textContent = q.explain || '';
    }
    updateQuizScore();
  }

  function updateQuizScore() {
    const quiz = state.content?.quiz || [];
    const answered = Object.keys(state.quizAnswers).length;
    if (!answered) return;
    let correct = 0;
    quiz.forEach((q) => {
      if (state.quizAnswers[q.id] === q.answerId) correct += 1;
    });
    const score = document.getElementById('dhQuizScore');
    if (score) {
      score.hidden = false;
      score.textContent =
        answered < quiz.length
          ? `Score so far: ${correct} / ${answered} (keep going)`
          : `Final score: ${correct} / ${quiz.length}`;
    }
  }

  function bindFilters() {
    document.querySelectorAll('#dhSpeciesFilters [data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => setFilter(btn.getAttribute('data-filter')));
    });
    document.getElementById('dhCompareRun')?.addEventListener('click', runCompare);
    document.getElementById('dhDetailSpotlight')?.addEventListener('click', () => {
      if (state.selectedId) {
        window.DinosaurHallScene?.spotlight?.(state.selectedId, { silent: true });
        document.getElementById('dhHero')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  function applyDeepLinks() {
    const params = new URLSearchParams(window.location.search);
    const era = params.get('era');
    const dino = params.get('dino');
    const quiz = params.get('quiz');
    if (era && (state.content?.eras || []).some((e) => e.id === era)) {
      setEra(era, { silent: true });
    }
    if (dino && speciesById(dino)) {
      selectSpecies(dino, { silent: true, noScroll: false });
    }
    if (quiz === '1') {
      document.getElementById('dhQuiz')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function applyHeroCopy() {
    const c = state.content;
    if (!c) return;
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el && text) el.textContent = text;
    };
    set('dhKicker', c.kicker);
    set('dhTitle', c.title);
    // Keep the slim on-stage hint — long subtitle lives in onboarding below.
    set('dhOnboarding', c.onboarding);
  }

  async function boot() {
    try {
      const res = await fetch(CONTENT_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.content = await res.json();
    } catch (err) {
      console.error('Dinosaur Hall content failed', err);
      setGuideStatus('Could not load field guide data.');
      return;
    }

    applyHeroCopy();
    renderEras();
    renderSpecies();
    fillCompareSelects();
    renderQuiz();
    bindFilters();

    window.DinosaurHallScene?.init?.({
      species: state.content.species,
      eras: state.content.eras,
      era: state.era,
      onSelect(id) {
        selectSpecies(id, { silent: true, noScroll: true });
      }
    });

    applyDeepLinks();

    window.DinosaurHall = {
      setEra,
      selectSpecies,
      setFilter,
      runCompare,
      getContent: () => state.content,
      getState: () => ({ ...state })
    };

    window.dispatchEvent(new CustomEvent('dinosaur-hall-ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
