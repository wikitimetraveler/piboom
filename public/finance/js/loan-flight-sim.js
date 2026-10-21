/**
 * Loan file flight simulator — one synthetic loan, ten questions per stage.
 * Product-line questions come from the shared bank. Seen ids live in Postgres.
 * Instruments run on CalculationsEngine + calcMath (createLoanFlightSimConfig).
 * Development work by David Lane
 */
(function () {
  'use strict';

  const DTI_CEILING = 45;
  const POINTS = 10;
  const PASS_RATIO = 0.8;
  const NAMES = ['Avery Sample', 'Jordan Placeholder', 'Riley Synthetic', 'Casey Demo', 'Morgan Fixture', 'Quinn Mockridge'];
  const STREETS = ['Runway Ln', 'Tailwind Ct', 'Hangar Way', 'Altimeter Dr', 'Jetstream Ave', 'Contrail Pl'];
  const FALLBACK_STAGES = [
    { id: 'application', label: 'Application' },
    { id: 'disclosures', label: 'Disclosures' },
    { id: 'processing', label: 'Processing' },
    { id: 'product-lines', label: 'Product lines' },
    { id: 'underwriting', label: 'Underwriting' },
    { id: 'conditions', label: 'Conditions' },
    { id: 'ctc', label: 'Clear to close' },
    { id: 'funding', label: 'Funding' }
  ];

  const math = window.calcMath;
  const $ = (id) => document.getElementById(id);
  const els = {
    flightNo: $('lfsFlightNo'),
    score: $('lfsScore'),
    difficultyLabel: $('lfsDifficultyLabel'),
    meter: $('lfsMeter'),
    newFlight: $('lfsNewFlight'),
    pathFill: $('lfsPathFill'),
    plane: $('lfsPlane'),
    pathStops: $('lfsPathStops'),
    challenge: $('lfsChallenge'),
    stageLabel: $('lfsStageLabel'),
    progress: $('lfsProgress'),
    stageTitle: $('lfsStageTitle'),
    brief: $('lfsBrief'),
    question: $('lfsQuestion'),
    options: $('lfsOptions'),
    feedback: $('lfsFeedback'),
    cont: $('lfsContinue'),
    report: $('lfsReport'),
    reportTitle: $('lfsReportTitle'),
    reportSummary: $('lfsReportSummary'),
    advance: $('lfsAdvance'),
    reportLog: $('lfsReportLog'),
    flyAgain: $('lfsFlyAgain'),
    fileMeta: $('lfsFileMeta'),
    captainLine: $('lfsCaptainLine'),
    captainSpeak: $('lfsCaptainSpeak'),
    chat: $('lfsChat'),
    chatForm: $('lfsChatForm'),
    chatInput: $('lfsChatInput')
  };
  const FIELD_IDS = {
    price: 'lfsPrice',
    loanAmount: 'lfsLoanAmount',
    rate: 'lfsRate',
    term: 'lfsTerm',
    escrow: 'lfsEscrow',
    debts: 'lfsDebts',
    income: 'lfsIncome',
    assets: 'lfsAssets'
  };

  let engine = null;
  let captainLines = {};
  const state = {
    seed: 0,
    loan: null,
    stage: 0,
    qIndex: 0,
    score: 0,
    log: [],
    answered: false,
    difficulty: 1,
    maxLevel: 3,
    difficulties: [],
    units: [],
    results: [],
    unitCorrect: 0,
    clientId: '',
    source: 'file'
  };

  function clientId() {
    const key = 'lfsClientId';
    let id = '';
    try { id = localStorage.getItem(key) || ''; } catch { /* ignore */ }
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      const raw = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
      id = raw.replace(/-/g, '').slice(0, 24);
      try { localStorage.setItem(key, id); } catch { /* ignore */ }
    }
    return id;
  }

  function readSeen() {
    try { return JSON.parse(localStorage.getItem('lfsSeenIds') || '[]'); } catch { return []; }
  }

  function writeSeen(ids) {
    try { localStorage.setItem('lfsSeenIds', JSON.stringify(ids.slice(-500))); } catch { /* ignore */ }
  }

  /** Mirrors services/loan-flight-questions.js drawDeck for when Postgres is offline. */
  function drawUnit(questions, unit, difficulty, seenIds, count) {
    const seen = new Set(seenIds);
    const pool = questions.filter((q) => q.unit === unit && Number(q.difficulty) <= difficulty);
    const picked = [];
    const take = (list, recycled) => {
      for (const q of list) {
        if (!q || picked.length >= count) return;
        if (picked.some((p) => p.id === q.id)) continue;
        picked.push({ ...q, recycled });
      }
    };
    take(pool.filter((q) => Number(q.difficulty) === difficulty && !seen.has(q.id)), false);
    take(pool.filter((q) => Number(q.difficulty) < difficulty && !seen.has(q.id)), false);
    if (picked.length < count) {
      const used = new Set(picked.map((q) => q.id));
      const byId = new Map(pool.map((q) => [q.id, q]));
      take(seenIds.filter((id) => byId.has(id) && !used.has(id)).map((id) => byId.get(id)), true);
      take(pool.filter((q) => !picked.some((p) => p.id === q.id)), true);
    }
    return picked.slice(0, count);
  }

  function localDeck(bank) {
    let difficulty = 1;
    try { difficulty = Number(localStorage.getItem('lfsDifficulty')) || 1; } catch { /* ignore */ }
    const seenIds = readSeen();
    const count = bank.perUnit || 10;
    return {
      source: 'file',
      difficulty,
      maxLevel: Math.max(...(bank.difficulties || []).map((d) => d.level), 3),
      difficulties: bank.difficulties || [],
      perUnit: count,
      units: (bank.units || FALLBACK_STAGES).map((unit) => ({
        id: unit.id,
        label: unit.label,
        questions: drawUnit(bank.questions || [], unit.id, difficulty, seenIds, count)
      }))
    };
  }

  async function loadDeck(id) {
    try {
      const res = await fetch(`/api/loan-flight/deck?clientId=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.source === 'postgres' && Array.isArray(data.units)) return data;
      }
    } catch { /* file bank below */ }
    const res = await fetch('/data/loan-flight-question-bank.json');
    if (!res.ok) throw new Error('Question bank did not load');
    return localDeck(await res.json());
  }

  async function loadCaptain() {
    try {
      const res = await fetch('/data/loan-flight-heygen-demo.json');
      if (!res.ok) return;
      const data = await res.json();
      captainLines = data.lines || {};
      const note = $('lfsCaptainNote');
      if (note && data.attribution) note.textContent = data.attribution;
    } catch { /* briefing text still has a default */ }
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function between(rng, lo, hi) {
    return lo + rng() * (hi - lo);
  }

  function pickOne(rng, list) {
    return list[Math.floor(rng() * list.length) % list.length];
  }

  function shuffle(rng, list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function isoAddDays(iso, days) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function weekday(iso) {
    return new Date(`${iso}T00:00:00Z`).getUTCDay();
  }

  function fmtDate(iso) {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  }

  function money(n) {
    return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }

  function labelFor(level) {
    const found = state.difficulties.find((d) => Number(d.level) === Number(level));
    return found?.label || (level === 1 ? 'Trainee' : level === 2 ? 'First officer' : 'Captain');
  }

  function paintDifficulty(level) {
    state.difficulty = level;
    if (els.difficultyLabel) els.difficultyLabel.textContent = labelFor(level);
    if (els.meter) {
      els.meter.dataset.level = String(level);
      els.meter.setAttribute('aria-valuenow', String(level));
    }
  }

  /** Build a synthetic loan whose numbers set up every checkpoint (DTI starts above the ceiling). */
  function generateLoan(seed) {
    const rng = mulberry32(seed);
    const price = Math.round(between(rng, 320000, 640000) / 5000) * 5000;
    const downPct = pickOne(rng, [5, 10, 15, 20]);
    const loanAmount = Math.round((price * (1 - downPct / 100)) / 100) * 100;
    const rate = Math.round(between(rng, 6, 7.4) * 8) / 8;
    const term = 360;
    const escrow = Math.round((price * 0.021) / 12 + 110);
    const pi = math.monthlyPrincipalInterest([loanAmount, rate, term]);
    const housing = pi + escrow;
    const monthlyIncome = housing / between(rng, 0.27, 0.32);
    const income = Math.round((monthlyIncome * 12) / 1000) * 1000;
    const debts = Math.round((income / 12) * between(rng, 0.47, 0.51) - housing);
    const carPayment = Math.round(debts * 0.55);
    const carBalance = carPayment * Math.round(between(rng, 11, 18));
    const assets = Math.round((carBalance + housing * between(rng, 3, 6)) / 100) * 100;
    const coIncome = Math.round((income * 0.35) / 1000) * 1000;
    let appDate = isoAddDays('2026-10-05', Math.floor(between(rng, 0, 21)));
    if (weekday(appDate) === 0) appDate = isoAddDays(appDate, 1);
    if (weekday(appDate) === 6) appDate = isoAddDays(appDate, 2);
    let closingDate = isoAddDays(appDate, Math.floor(between(rng, 30, 41)));
    if (weekday(closingDate) === 0) closingDate = isoAddDays(closingDate, 1);
    return {
      seed,
      borrower: pickOne(rng, NAMES),
      address: `${100 + Math.floor(rng() * 900)} ${pickOne(rng, STREETS)}, Dallas, TX`,
      creditScore: Math.round(between(rng, 690, 780)),
      firstTimeHomebuyer: rng() < 0.5,
      price,
      downPct,
      loanAmount,
      rate,
      term,
      escrow,
      debts,
      carPayment,
      carBalance,
      income,
      coIncome,
      assets,
      deposit: Math.round(between(rng, 2500, 9500) / 50) * 50,
      appDate,
      closingDate,
      rngState: Math.floor(rng() * 1e9)
    };
  }

  function setFields(values) {
    Object.entries(values).forEach(([key, value]) => {
      const el = $(FIELD_IDS[key]);
      if (el) el.value = String(value);
    });
    engine?.recalculateAll();
    syncGauges();
  }

  function readNumber(id) {
    return Number($(id)?.value) || 0;
  }

  function instruments() {
    return {
      ltv: readNumber('lfsLtv'),
      pi: readNumber('lfsPi'),
      housing: readNumber('lfsHousing'),
      frontDti: readNumber('lfsFrontDti'),
      backDti: readNumber('lfsBackDti'),
      reserves: readNumber('lfsReserves'),
      risk: String($('lfsRisk')?.value || '')
    };
  }

  function syncGauges() {
    const ins = instruments();
    document.querySelector('[data-gauge="dti"]')?.classList.toggle('is-warn', ins.backDti > DTI_CEILING);
    document.querySelector('[data-gauge="ltv"]')?.classList.toggle('is-warn', ins.ltv > 80);
    const risk = document.querySelector('[data-gauge="risk"]');
    if (risk) risk.dataset.tier = ins.risk;
  }

  function renderFileMeta() {
    const l = state.loan;
    const rows = [
      ['Borrower', `${l.borrower} (synthetic)`],
      ['Property', l.address],
      ['Credit score', String(l.creditScore)],
      ['Down payment', `${l.downPct}%`],
      ['Application', fmtDate(l.appDate)],
      ['Closing', fmtDate(l.closingDate)]
    ];
    els.fileMeta.replaceChildren(
      ...rows.flatMap(([k, v]) => {
        const dt = document.createElement('dt');
        dt.textContent = k;
        const dd = document.createElement('dd');
        dd.textContent = v;
        return [dt, dd];
      })
    );
  }

  function materialize(q) {
    const l = state.loan;
    const rng = mulberry32(l.rngState + state.stage * 7919 + state.qIndex);
    const ins = instruments();
    if (q.bind === 'tridMissing') {
      return {
        ...q,
        brief: `${l.borrower} gave you a name, income, Social Security number, the property address and a ${money(l.loanAmount)} loan amount.`,
        question: 'Which piece of information is still missing before this counts as a TRID application?',
        options: shuffle(rng, [
          { text: 'The estimated property value', correct: true },
          { text: 'Two years of W-2s' },
          { text: 'A signed purchase contract' }
        ]),
        explain: 'Under Regulation Z an application is six items: name, income, SSN, property address, estimated property value and loan amount. Documents can be collected later, but they are not part of the six.'
      };
    }
    if (q.bind === 'leDue') {
      const due = math.addBusinessDays([l.appDate, 3, false]);
      const early = math.addBusinessDays([l.appDate, 2, false]);
      const late = math.addBusinessDays([l.appDate, 4, false]);
      return {
        ...q,
        brief: `Application received ${fmtDate(l.appDate)}. Your lender's offices are open Monday through Friday.`,
        question: 'What is the last day to deliver the Loan Estimate?',
        options: shuffle(rng, [
          { text: fmtDate(due), correct: true },
          { text: fmtDate(early) },
          { text: fmtDate(late) }
        ]),
        explain: `The Loan Estimate goes out within three business days of application. For this rule a business day is a day the lender is open, so ${fmtDate(l.appDate)} plus three open days is ${fmtDate(due)}.`
      };
    }
    if (q.bind === 'pmi') {
      const needsMi = ins.ltv > 80;
      return {
        ...q,
        brief: `${money(l.loanAmount)} on a ${money(l.price)} purchase puts LTV at ${ins.ltv}%.`,
        question: 'Does this conventional loan need private mortgage insurance?',
        options: [
          { text: 'Yes, PMI is required', correct: needsMi },
          { text: 'No PMI needed', correct: !needsMi }
        ],
        explain: needsMi
          ? `Conventional loans above 80% LTV need mortgage insurance. At ${ins.ltv}% this file does.`
          : `At ${ins.ltv}% LTV the borrower put 20% down, so conventional PMI is not required.`
      };
    }
    if (q.bind === 'dtiFix') {
      return {
        ...q,
        brief: `Back-end DTI is ${ins.backDti}% against a ${DTI_CEILING}% ceiling. Other debts include a ${money(l.carPayment)}/mo car loan with ${money(l.carBalance)} left.`,
        question: `Which fix brings DTI to ${DTI_CEILING}% or below?`,
        options: shuffle(rng, [
          {
            text: `Pay off the car loan from assets (${money(l.carBalance)})`,
            apply: () => setFields({ debts: l.debts - l.carPayment, assets: l.assets - l.carBalance })
          },
          {
            text: `Add a co-borrower earning ${money(l.coIncome)}/yr`,
            apply: () => setFields({ income: l.income + l.coIncome })
          },
          {
            text: 'Switch to a 15-year term to look stronger',
            apply: () => setFields({ term: 180 })
          }
        ]),
        check: () => instruments().backDti <= DTI_CEILING,
        assist: () => setFields({ debts: l.debts - l.carPayment, assets: l.assets - l.carBalance, term: l.term }),
        explain: 'DTI is total monthly debt over gross monthly income. Removing a payment or adding qualifying income lowers it; a shorter term raises the payment and makes it worse.'
      };
    }
    if (q.bind === 'cdDue') {
      const due = math.addBusinessDays([l.closingDate, -3, true]);
      const early = math.addBusinessDays([l.closingDate, -4, true]);
      const late = math.addBusinessDays([l.closingDate, -2, true]);
      return {
        ...q,
        brief: `Consummation is scheduled for ${fmtDate(l.closingDate)}.`,
        question: 'What is the latest day the borrower can receive the Closing Disclosure?',
        options: shuffle(rng, [
          { text: fmtDate(due), correct: true },
          { text: fmtDate(early) },
          { text: fmtDate(late) }
        ]),
        explain: `The borrower must receive the CD at least three business days before consummation. Here a business day is every day except Sundays and federal holidays, so Saturdays count: ${fmtDate(due)}. Holidays are not modeled in this sim.`
      };
    }
    if (q.bind === 'riskTier') {
      const tiers = ['low', 'medium', 'high'];
      return {
        ...q,
        brief: `Back DTI ${ins.backDti}%, reserves ${ins.reserves} months, LTV ${ins.ltv}%.`,
        question: 'Which risk tier will the engine show at funding?',
        options: tiers.map((tier) => ({ text: tier[0].toUpperCase() + tier.slice(1), correct: ins.risk === tier })),
        explain: 'The tier adds 2 points at 45% DTI and 1 point at 40%, 2 points under 2 months of reserves and 1 point under 4, and 2 points over 95% LTV and 1 point over 90%. Two points is medium; four is high.'
      };
    }
    return q;
  }

  function stages() {
    return state.units.length ? state.units : FALLBACK_STAGES;
  }

  function renderPath() {
    const list = stages();
    els.pathStops.replaceChildren(
      ...list.map((stage, i) => {
        const li = document.createElement('li');
        li.textContent = stage.label;
        const result = state.log[i];
        if (i === state.stage && els.report.hidden) li.classList.add('is-active');
        if (result) li.classList.add(result.passed ? 'is-pass' : 'is-fail');
        if (i === state.stage) li.setAttribute('aria-current', 'step');
        return li;
      })
    );
    const done = Math.min(state.stage, Math.max(list.length - 1, 1)) / Math.max(list.length - 1, 1);
    els.pathFill.style.width = `${done * 100}%`;
    els.plane.style.left = `calc(${done * 100}% - ${done * 1.1}rem)`;
  }

  let current = null;

  function renderChallenge() {
    const unit = state.units[state.stage];
    const raw = unit.questions[state.qIndex];
    current = materialize(raw);
    state.answered = false;
    const review = raw.recycled ? ' · Review' : '';
    els.stageLabel.textContent = `Stage ${state.stage + 1} of ${state.units.length} · ${unit.label}${review}`;
    els.progress.textContent = `Question ${state.qIndex + 1} of ${unit.questions.length}`;
    els.stageTitle.textContent = current.title || unit.label;
    els.brief.textContent = current.brief || '';
    els.question.textContent = current.question;
    els.feedback.hidden = true;
    els.cont.hidden = true;
    if (els.captainLine) {
      els.captainLine.textContent = captainLines[unit.id] || 'Work the question in front of you. Ask if you want a hint.';
    }
    els.options.replaceChildren(
      ...(current.options || []).map((opt, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lfs-option';
        btn.dataset.option = String(i);
        btn.textContent = opt.text;
        btn.addEventListener('click', () => answer(i));
        return btn;
      })
    );
    renderPath();
  }

  function answer(i) {
    if (state.answered || !current) return;
    state.answered = true;
    const opt = current.options[i];
    let passed;
    let note = '';
    if (typeof opt.apply === 'function') {
      opt.apply();
      passed = current.check();
      const after = instruments();
      note = passed
        ? `DTI now ${after.backDti}%.`
        : `DTI went to ${after.backDti}%. Your co-pilot paid off the car loan to keep the file flying.`;
      if (!passed) current.assist();
    } else {
      passed = Boolean(opt.correct);
    }
    if (passed) {
      state.score += POINTS;
      state.unitCorrect += 1;
    }
    state.results.push({ id: current.id, correct: passed });
    const unit = state.units[state.stage];
    if (state.qIndex === unit.questions.length - 1) {
      state.log[state.stage] = {
        stage: unit.label,
        passed: state.unitCorrect / unit.questions.length >= PASS_RATIO,
        choice: `${state.unitCorrect}/${unit.questions.length}`
      };
    }

    els.options.querySelectorAll('.lfs-option').forEach((btn, k) => {
      btn.disabled = true;
      const o = current.options[k];
      if (k === i) btn.classList.add(passed ? 'is-right' : 'is-wrong');
      else if (o.correct) btn.classList.add('is-right');
    });
    els.feedback.hidden = false;
    els.feedback.className = `lfs-feedback ${passed ? 'is-pass' : 'is-fail'}`;
    els.feedback.textContent = `${passed ? 'Smooth air.' : 'Rough landing.'} ${note} ${current.explain || ''}`.replace(/\s+/g, ' ').trim();
    els.score.textContent = String(state.score);
    els.cont.hidden = false;
    const lastUnit = state.stage === state.units.length - 1;
    const lastQ = state.qIndex === unit.questions.length - 1;
    els.cont.innerHTML = lastUnit && lastQ
      ? 'Pilot report <i class="bi bi-flag-fill" aria-hidden="true"></i>'
      : 'Continue <i class="bi bi-arrow-right" aria-hidden="true"></i>';
    els.cont.focus();
    renderPath();
  }

  function rank(score, max) {
    if (score >= max) return 'Ace underwriter';
    if (score >= max * 0.7) return 'Captain';
    if (score >= max * 0.45) return 'First officer';
    return 'Trainee';
  }

  async function showReport() {
    els.challenge.hidden = true;
    els.report.hidden = false;
    const max = Math.max(state.results.length, 1) * POINTS;
    const ins = instruments();
    const correct = state.results.filter((row) => row.correct).length;
    els.reportTitle.textContent = `${rank(state.score, max)} · ${state.score} / ${state.results.length * POINTS}`;
    els.reportSummary.textContent = `Flight LF-${state.seed} · ${correct} of ${state.results.length} on ${labelFor(state.difficulty)}. Funded at ${ins.ltv}% LTV, ${ins.backDti}% back DTI and ${ins.reserves} months of reserves (${ins.risk} risk tier).`;
    if (els.advance) els.advance.textContent = '';
    els.reportLog.replaceChildren(
      ...state.log.map((row) => {
        const li = document.createElement('li');
        li.className = row.passed ? 'is-pass' : 'is-fail';
        li.innerHTML = `<i class="bi ${row.passed ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}" aria-hidden="true"></i> `;
        const strong = document.createElement('strong');
        strong.textContent = row.stage;
        li.appendChild(strong);
        li.appendChild(document.createTextNode(` · ${row.choice}`));
        return li;
      })
    );
    renderPath();
    const seen = readSeen();
    for (const row of state.results) {
      if (!seen.includes(row.id)) seen.push(row.id);
    }
    writeSeen(seen);
    try {
      const res = await fetch('/api/loan-flight/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: state.clientId,
          difficulty: state.difficulty,
          results: state.results
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (els.advance) {
          els.advance.textContent = data.advanced
            ? `Next flight: ${data.label}. Product-line questions you have not seen are waiting.`
            : `Hold at ${data.label} until this flight clears 80%.`;
        }
      }
    } catch {
      const ratio = correct / Math.max(state.results.length, 1);
      if (ratio >= PASS_RATIO && state.difficulty < state.maxLevel) {
        paintDifficulty(state.difficulty + 1);
        try { localStorage.setItem('lfsDifficulty', String(state.difficulty)); } catch { /* ignore */ }
      }
      if (els.advance) els.advance.textContent = 'Progress is saved in this browser until the database is back.';
    }
  }

  function next() {
    const unit = state.units[state.stage];
    if (unit && state.qIndex < unit.questions.length - 1) {
      state.qIndex += 1;
      renderChallenge();
      els.stageTitle.focus?.();
      return;
    }
    if (state.stage >= state.units.length - 1) {
      showReport();
      return;
    }
    state.stage += 1;
    state.qIndex = 0;
    state.unitCorrect = 0;
    renderChallenge();
    els.stageTitle.focus?.();
  }

  function speak(text) {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    window.speechSynthesis.speak(utterance);
  }

  function addChat(role, text) {
    if (!els.chat) return;
    const line = document.createElement('p');
    line.className = role === 'user' ? 'is-user' : 'is-captain';
    line.textContent = text;
    els.chat.appendChild(line);
    els.chat.scrollTop = els.chat.scrollHeight;
  }

  async function askCaptain(message) {
    addChat('user', message);
    const revealed = Boolean(state.answered && current);
    try {
      const res = await fetch('/api/loan-flight/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: state.clientId,
          message,
          question: current?.question || '',
          options: (current?.options || []).map((o) => o.text),
          revealed,
          explain: revealed ? current?.explain || '' : '',
          instruments: instruments()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Captain is unavailable');
      addChat('captain', data.reply);
      speak(data.reply);
    } catch (err) {
    const fallback = revealed && current?.explain
      ? current.explain
      : 'I will not choose for you. Use the stage briefing and the gauges, then pick.';
      addChat('captain', err.message && err.message !== 'Failed to fetch' ? fallback : fallback);
    }
  }

  async function startFlight(seed) {
    state.seed = seed;
    state.loan = generateLoan(seed);
    state.stage = 0;
    state.qIndex = 0;
    state.score = 0;
    state.log = [];
    state.results = [];
    state.unitCorrect = 0;
    els.brief.textContent = 'Loading the question bank…';
    els.question.textContent = '';
    els.options.replaceChildren();
    let deck;
    try {
      deck = await loadDeck(state.clientId);
    } catch (err) {
      els.brief.textContent = err.message || 'The question bank did not load.';
      return;
    }
    state.source = deck.source || 'file';
    state.difficulty = Number(deck.difficulty) || 1;
    state.maxLevel = Number(deck.maxLevel) || 3;
    state.difficulties = deck.difficulties || [];
    state.units = (deck.units || []).filter((unit) => unit.questions && unit.questions.length);
    paintDifficulty(state.difficulty);
    const l = state.loan;
    setFields({
      price: l.price,
      loanAmount: l.loanAmount,
      rate: l.rate,
      term: l.term,
      escrow: l.escrow,
      debts: l.debts,
      income: l.income,
      assets: l.assets
    });
    els.flightNo.textContent = `LF-${seed}`;
    els.score.textContent = '0';
    els.challenge.hidden = false;
    els.report.hidden = true;
    renderFileMeta();
    if (!state.units.length) {
      els.brief.textContent = 'This difficulty has no questions left. Refresh and try another flight.';
      return;
    }
    renderChallenge();
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('seed', String(seed));
      window.history.replaceState(null, '', url);
    } catch { /* ignore */ }
  }

  function randomSeed() {
    return 1000 + Math.floor(Math.random() * 9000);
  }

  function init() {
    if (!math || typeof window.CalculationsEngine !== 'function') {
      els.brief.textContent = 'The calculation engine did not load. Refresh to try again.';
      return;
    }
    engine = new window.CalculationsEngine(window.createLoanFlightSimConfig());
    state.clientId = clientId();
    els.cont.addEventListener('click', next);
    els.newFlight.addEventListener('click', () => startFlight(randomSeed()));
    els.flyAgain.addEventListener('click', () => startFlight(randomSeed()));
    els.captainSpeak?.addEventListener('click', () => speak(els.captainLine?.textContent || ''));
    els.chatForm?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const text = els.chatInput.value.trim();
      if (!text) return;
      els.chatInput.value = '';
      askCaptain(text);
    });
    loadCaptain();
    const seed = parseInt(new URLSearchParams(window.location.search).get('seed') || '', 10);
    startFlight(Number.isFinite(seed) && seed > 0 ? seed : randomSeed());
  }

  window.LoanFlightSim = {
    generateLoan,
    getState: () => ({
      seed: state.seed,
      stage: state.stage,
      qIndex: state.qIndex,
      score: state.score,
      difficulty: state.difficulty,
      log: state.log.slice(),
      instruments: instruments()
    }),
    answer
  };

  init();
})();
