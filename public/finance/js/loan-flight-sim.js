/**
 * Loan file flight simulator — one synthetic loan flown from application to funding.
 * Instruments run on CalculationsEngine + calcMath (createLoanFlightSimConfig).
 * Development work by David Lane
 */
(function () {
  'use strict';

  const DTI_CEILING = 45;
  const POINTS = 100;
  const NAMES = ['Avery Sample', 'Jordan Placeholder', 'Riley Synthetic', 'Casey Demo', 'Morgan Fixture', 'Quinn Mockridge'];
  const STREETS = ['Runway Ln', 'Tailwind Ct', 'Hangar Way', 'Altimeter Dr', 'Jetstream Ave', 'Contrail Pl'];
  const STAGES = [
    { id: 'application', label: 'Application' },
    { id: 'disclosures', label: 'Disclosures' },
    { id: 'processing', label: 'Processing' },
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
    newFlight: $('lfsNewFlight'),
    pathFill: $('lfsPathFill'),
    plane: $('lfsPlane'),
    pathStops: $('lfsPathStops'),
    challenge: $('lfsChallenge'),
    stageLabel: $('lfsStageLabel'),
    stageTitle: $('lfsStageTitle'),
    brief: $('lfsBrief'),
    question: $('lfsQuestion'),
    options: $('lfsOptions'),
    feedback: $('lfsFeedback'),
    cont: $('lfsContinue'),
    report: $('lfsReport'),
    reportTitle: $('lfsReportTitle'),
    reportSummary: $('lfsReportSummary'),
    reportLog: $('lfsReportLog'),
    gseRun: $('lfsGseRun'),
    gseOut: $('lfsGseOut'),
    flyAgain: $('lfsFlyAgain'),
    fileMeta: $('lfsFileMeta')
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
  const state = { seed: 0, loan: null, stage: 0, score: 0, log: [], answered: false };

  /** Deterministic PRNG so a flight number always replays the same file. */
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

  /** One checkpoint per stage. `apply(option)` may change loan fields; `check()` decides pass/fail after. */
  function buildChallenge(index) {
    const l = state.loan;
    const rng = mulberry32(l.rngState + index * 7919);
    const ins = instruments();
    switch (STAGES[index].id) {
      case 'application':
        return {
          title: 'Pre-flight: is this an application yet?',
          brief: `${l.borrower} gave you a name, income, Social Security number, the property address and a ${money(l.loanAmount)} loan amount.`,
          question: 'Which piece of information is still missing before this counts as a TRID application?',
          options: shuffle(rng, [
            { text: 'The estimated property value', correct: true },
            { text: 'Two years of W-2s' },
            { text: 'A signed purchase contract' }
          ]),
          explain: 'Under Regulation Z an application is six items: name, income, SSN, property address, estimated property value and loan amount. Documents can be collected later, but they are not part of the six.'
        };
      case 'disclosures': {
        const due = math.addBusinessDays([l.appDate, 3, false]);
        const early = math.addBusinessDays([l.appDate, 2, false]);
        const late = math.addBusinessDays([l.appDate, 4, false]);
        return {
          title: 'Climb-out: Loan Estimate timing',
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
      case 'processing': {
        const needsMi = ins.ltv > 80;
        return {
          title: 'Cruise: read the LTV gauge',
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
      case 'underwriting':
        return {
          title: 'Turbulence: DTI over the ceiling',
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
      case 'conditions':
        return {
          title: 'Holding pattern: underwriter conditions',
          brief: `The bank statement shows a ${money(l.deposit)} deposit that is not payroll.`,
          question: 'How do you clear the condition?',
          options: shuffle(rng, [
            { text: 'Get a letter of explanation and source documents for the deposit', correct: true },
            { text: 'Drop that bank account from the file' },
            { text: 'Ignore it, since the AUS already approved' }
          ]),
          explain: 'Large deposits must be sourced and explained. Dropping an account you need for funds or reserves, or ignoring an open condition, will not clear to close.'
        };
      case 'ctc': {
        const due = math.addBusinessDays([l.closingDate, -3, true]);
        const early = math.addBusinessDays([l.closingDate, -4, true]);
        const late = math.addBusinessDays([l.closingDate, -2, true]);
        return {
          title: 'Final approach: Closing Disclosure timing',
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
      case 'funding': {
        const tiers = ['low', 'medium', 'high'];
        return {
          title: 'Touchdown: final instrument check',
          brief: `Back DTI ${ins.backDti}%, reserves ${ins.reserves} months, LTV ${ins.ltv}%.`,
          question: 'Which risk tier will the engine show at funding?',
          options: tiers.map((tier) => ({ text: tier[0].toUpperCase() + tier.slice(1), correct: ins.risk === tier })),
          explain: 'The tier adds points for DTI at 40% and 45%, reserves under 4 and 2 months, and LTV over 90% and 95%. Two points is medium; four is high.'
        };
      }
      default:
        return null;
    }
  }

  function renderPath() {
    els.pathStops.replaceChildren(
      ...STAGES.map((stage, i) => {
        const li = document.createElement('li');
        li.textContent = stage.label;
        const result = state.log[i];
        if (i === state.stage && els.report.hidden) li.classList.add('is-active');
        if (result) li.classList.add(result.passed ? 'is-pass' : 'is-fail');
        if (i === state.stage) li.setAttribute('aria-current', 'step');
        return li;
      })
    );
    const done = Math.min(state.stage, STAGES.length - 1) / (STAGES.length - 1);
    els.pathFill.style.width = `${done * 100}%`;
    els.plane.style.left = `calc(${done * 100}% - ${done * 1.1}rem)`;
  }

  let current = null;

  function renderChallenge() {
    current = buildChallenge(state.stage);
    state.answered = false;
    els.stageLabel.textContent = `Stage ${state.stage + 1} of ${STAGES.length} · ${STAGES[state.stage].label}`;
    els.stageTitle.textContent = current.title;
    els.brief.textContent = current.brief;
    els.question.textContent = current.question;
    els.feedback.hidden = true;
    els.cont.hidden = true;
    els.options.replaceChildren(
      ...current.options.map((opt, i) => {
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
    if (passed) state.score += POINTS;
    state.log[state.stage] = { stage: STAGES[state.stage].label, passed, choice: opt.text };

    els.options.querySelectorAll('.lfs-option').forEach((btn, k) => {
      btn.disabled = true;
      const o = current.options[k];
      if (k === i) btn.classList.add(passed ? 'is-right' : 'is-wrong');
      else if (o.correct) btn.classList.add('is-right');
    });
    els.feedback.hidden = false;
    els.feedback.className = `lfs-feedback ${passed ? 'is-pass' : 'is-fail'}`;
    els.feedback.textContent = `${passed ? 'Smooth air.' : 'Rough landing.'} ${note} ${current.explain}`.replace(/\s+/g, ' ').trim();
    els.score.textContent = String(state.score);
    els.cont.hidden = false;
    els.cont.innerHTML = state.stage === STAGES.length - 1
      ? 'Pilot report <i class="bi bi-flag-fill" aria-hidden="true"></i>'
      : 'Continue <i class="bi bi-arrow-right" aria-hidden="true"></i>';
    els.cont.focus();
    renderPath();
  }

  function rank(score) {
    const max = STAGES.length * POINTS;
    if (score >= max) return 'Ace underwriter';
    if (score >= max * 0.7) return 'Captain';
    if (score >= max * 0.45) return 'First officer';
    return 'Trainee';
  }

  function showReport() {
    els.challenge.hidden = true;
    els.report.hidden = false;
    state.stage = STAGES.length;
    const ins = instruments();
    els.reportTitle.textContent = `${rank(state.score)} · ${state.score} / ${STAGES.length * POINTS}`;
    els.reportSummary.textContent = `Flight LF-${state.seed} funded at ${ins.ltv}% LTV, ${ins.backDti}% back DTI and ${ins.reserves} months of reserves (${ins.risk} risk tier).`;
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
    els.gseOut.hidden = true;
    els.gseRun.disabled = false;
    renderPath();
    els.reportTitle.focus?.();
  }

  /** Synthetic scenario for POST /api/gse/analyze-scenario (no PII fields). */
  function gseScenario() {
    const l = state.loan;
    const ins = instruments();
    return {
      borrower: { creditScore: l.creditScore, firstTimeHomebuyer: l.firstTimeHomebuyer, income: readNumber('lfsIncome') },
      loan: {
        loanAmount: readNumber('lfsLoanAmount'),
        purchasePrice: readNumber('lfsPrice'),
        ltv: ins.ltv,
        cltv: ins.ltv,
        occupancy: 'primary',
        purpose: 'purchase',
        propertyType: 'singleFamily',
        units: 1,
        state: 'TX',
        county: 'Dallas'
      },
      risk: { dti: ins.backDti, reservesMonths: ins.reserves }
    };
  }

  async function runGse() {
    els.gseRun.disabled = true;
    els.gseOut.hidden = false;
    els.gseOut.textContent = 'Checking Fannie and Freddie product rules…';
    try {
      const res = await fetch('/api/gse/analyze-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gseScenario())
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error((data.errors || []).join(' ') || `HTTP ${res.status}`);
      const fits = (data.products || []).filter((p) => p.status === 'fit' || p.status === 'possible-fit');
      const s = data.summary || {};
      els.gseOut.textContent = `Best fit: ${s.bestFit || 'none'} · ${fits.length} product${fits.length === 1 ? '' : 's'} fit or possibly fit · conforming: ${s.conformingStatus || 'unknown'}. Research tool only; run AUS for a real decision.`;
    } catch (err) {
      els.gseOut.textContent = `The GSE check is unavailable right now (${err.message}). The sim score does not depend on it.`;
      els.gseRun.disabled = false;
    }
  }

  function next() {
    if (state.stage >= STAGES.length - 1) {
      showReport();
      return;
    }
    state.stage += 1;
    renderChallenge();
    els.stageTitle.focus?.();
  }

  function startFlight(seed) {
    state.seed = seed;
    state.loan = generateLoan(seed);
    state.stage = 0;
    state.score = 0;
    state.log = [];
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
    renderChallenge();
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('seed', String(seed));
      window.history.replaceState(null, '', url);
    } catch {
      /* ignore */
    }
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
    els.cont.addEventListener('click', next);
    els.newFlight.addEventListener('click', () => startFlight(randomSeed()));
    els.flyAgain.addEventListener('click', () => startFlight(randomSeed()));
    els.gseRun.addEventListener('click', runGse);
    const seed = parseInt(new URLSearchParams(window.location.search).get('seed') || '', 10);
    startFlight(Number.isFinite(seed) && seed > 0 ? seed : randomSeed());
  }

  window.LoanFlightSim = {
    generateLoan,
    getState: () => ({ seed: state.seed, stage: state.stage, score: state.score, log: state.log.slice(), instruments: instruments() }),
    answer
  };

  init();
})();
