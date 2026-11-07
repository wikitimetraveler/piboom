/**
 * Crouton — Brown Cardigan Welsh Corgi × Australian Shepherd ("Cardi-Auggie")
 * Mobile Bucket Lid Scanner, Anti-Overfeeding Tracker & Fun Facts
 */

(function () {
  const STORAGE_FEEDER_KEY = 'crouton_selected_feeder_v1';
  const STORAGE_QR_URL_KEY = 'crouton_custom_qr_url_v1';

  const CROUTON_FACTS = [
    {
      id: 'cardigan-oldest',
      category: 'auggie',
      categoryLabel: '🤎 Brown Cardigan × Aussie',
      title: 'Cardigan Welsh Corgis Are Over 3,000 Years Old',
      body: 'Unlike the younger Pembroke Corgi, the Cardigan Welsh Corgi is one of the oldest herding breeds in the British Isles—brought to Cardiganshire, Wales around 1200 BC by Celtic tribes!',
    },
    {
      id: 'brown-brindle-coat',
      category: 'auggie',
      categoryLabel: '🤎 Brown Cardigan × Aussie',
      title: 'Why Crouton Has That Gorgeous Toasted Brown Coat',
      body: 'Both Cardigan Welsh Corgis (famous for brown, sable, and brindle coats) and Australian Shepherds (red/liver and copper-trimmed coats) carry rich brown pigment genes—making Crouton a literal toasted crouton!',
    },
    {
      id: 'cardigan-tail-rudder',
      category: 'auggie',
      categoryLabel: '🤎 Brown Cardigan × Aussie',
      title: 'The Cardigan Brush Tail Is a High-Speed Rudder',
      body: 'Cardigan Welsh Corgis keep their long, low-set fox brush tail! Combined with Australian Shepherd agility, they use their tail and low center of gravity as a rudder for hairpin turns.',
    },
    {
      id: 'double-herder-brain',
      category: 'auggie',
      categoryLabel: '🤎 Brown Cardigan × Aussie',
      title: 'Double Cattle-Herding Genius ("The Cardi-Auggie")',
      body: 'Cardigans were bred to drive Welsh cattle by nipping heels and ducking kicks, while Aussies managed huge American ranches. Together, Crouton has two PhDs in bossing his humans around the kitchen.',
    },
    {
      id: 'stomach-illusion',
      category: 'food',
      categoryLabel: '🥣 The Stomach Illusion',
      title: 'The Great Corgi Con: "Nobody Fed Me Today!"',
      body: 'Corgis have become legendary for convincing multiple family members that they haven’t eaten yet. Even 3 minutes after David, Tina, or Hieu gives him 1 full cup, Crouton will put on tragic Victorian orphan eyes for a second breakfast.',
    },
    {
      id: 'long-spine-portions',
      category: 'food',
      categoryLabel: '🥣 The Stomach Illusion',
      title: 'Why Strict 1-Cup Scoops @ 8 AM & 5 PM Protect His Back',
      body: 'Cardigan Welsh Corgis are a dwarf chondrodysplastic breed ("ci corrach" = dwarf dog) with a long, sturdy spine and short legs. Keeping him strictly at 1 cup at 8 AM and 1 cup at 5 PM keeps extra weight off his joints and spine!',
    },
    {
      id: 'yard-long-dog',
      category: 'folklore',
      categoryLabel: '🧚 Fairy Lore & Herding',
      title: 'Welsh Law Measured Cardigans as "A Yard-Long Dog"',
      body: 'In medieval Wales, Cardigans were locally called "Ci Llathaid"—which translates to "yard-long dog"—because from the tip of their nose to the tip of their tail, they measured roughly one Welsh yard!',
    },
    {
      id: 'fairy-war-steeds',
      category: 'folklore',
      categoryLabel: '🧚 Fairy Lore & Herding',
      title: 'Battle Steeds of the Welsh Tylwyth Teg (Fairies)',
      body: 'According to Welsh folklore, Corgis pulled fairy carriages and served as warhorses for tiny woodland warriors. The lighter fur markings across their shoulders are still called the " Fairy Saddle."',
    },
    {
      id: 'hywel-dda-laws',
      category: 'folklore',
      categoryLabel: '🧚 Fairy Lore & Herding',
      title: 'Protected by King Hywel Dda in 920 AD',
      body: 'Ancient Welsh law under King Hywel the Good placed a massive silver value on cattle-herding Corgis—declaring a good herd dog worth as much as an entire adult ox because families couldn’t farm without them!',
    },
    {
      id: 'sploot-science',
      category: 'quirks',
      categoryLabel: '🍑 Sploots, Loaf & Zoomies',
      title: 'Master of the Full Drumstick "Sploot"',
      body: 'When Crouton stretches both hind legs straight out behind him like furry drumsticks, that’s a "sploot"! Corgis have extra-flexible hip sockets and love pressing their bellies flat against cool floors.',
    },
    {
      id: 'cardigan-sonar-ears',
      category: 'quirks',
      categoryLabel: '🍑 Sploots, Loaf & Zoomies',
      title: 'Cardigan Radar Dishes Hear the Food Bucket From 3 Rooms Away',
      body: 'Cardigan Welsh Corgis have larger, more rounded ears than Pembrokes. Those radar dishes were built to hear cattle in thick Welsh fog—and today they can detect the food storage bucket lid clicking open from anywhere in the house.',
    },
    {
      id: 'fraps-and-awoos',
      category: 'quirks',
      categoryLabel: '🍑 Sploots, Loaf & Zoomies',
      title: 'FRAPs (8 PM Zoomies) & The Aussie-Corgi "Barooo"',
      body: 'Between the Cardigan bark and the Australian Shepherd "woo-woo" grumble, Cardi-Auggies have an entire vocabulary of SASS—usually followed by FRAPs (Frenetic Random Activity Periods, aka hallway zoomies).',
    },
  ];

  const state = {
    selectedFeeder: 'David',
    statusData: null,
    pendingOverridePayload: null,
    selectedFactCategory: 'all',
    spotlightIndex: 0,
  };

  function init() {
    // Restore last used feeder on this phone
    try {
      const savedFeeder = localStorage.getItem(STORAGE_FEEDER_KEY);
      if (savedFeeder && ['David', 'Tina', 'Hieu'].includes(savedFeeder)) {
        state.selectedFeeder = savedFeeder;
      }
    } catch (_) {}

    updateFeederButtonsUI();
    checkScanQueryBanner();
    startClockTicker();
    bindEvents();
    renderFactsGrid();
    renderSpotlightFact(0);
    setupQrCodeBox();
    fetchStatus();
  }

  function checkScanQueryBanner() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('scan') === '1') {
      const banner = document.getElementById('scanModeNotice');
      if (banner) banner.classList.remove('d-none');
    }
  }

  function startClockTicker() {
    const updateClock = () => {
      const el = document.getElementById('currentClockLabel');
      if (!el) return;
      const now = new Date();
      el.textContent = now.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });
    };
    updateClock();
    setInterval(updateClock, 15000);
  }

  function updateFeederButtonsUI() {
    const buttons = document.querySelectorAll('.crouton-feeder-btn');
    buttons.forEach((btn) => {
      const name = btn.getAttribute('data-feeder');
      btn.classList.toggle('active', name === state.selectedFeeder);
    });
  }

  function bindEvents() {
    // Feeder selection (David, Tina, Hieu)
    document.querySelectorAll('.crouton-feeder-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const feeder = btn.getAttribute('data-feeder') || 'David';
        state.selectedFeeder = feeder;
        try {
          localStorage.setItem(STORAGE_FEEDER_KEY, feeder);
        } catch (_) {}
        updateFeederButtonsUI();
      });
    });

    // Main meal buttons
    const btnMorning = document.getElementById('btnFeedMorning');
    if (btnMorning) {
      btnMorning.addEventListener('click', () => {
        submitFeedEntry({
          entryType: 'meal',
          mealSlot: 'morning',
          cups: 1,
          note: 'Morning 8 AM scoop (1 cup)',
        });
      });
    }

    const btnEvening = document.getElementById('btnFeedEvening');
    if (btnEvening) {
      btnEvening.addEventListener('click', () => {
        submitFeedEntry({
          entryType: 'meal',
          mealSlot: 'evening',
          cups: 1,
          note: 'Evening 5 PM scoop (1 cup)',
        });
      });
    }

    // Treat note form
    const treatForm = document.getElementById('treatForm');
    if (treatForm) {
      treatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('treatNoteInput');
        const noteText = (input ? input.value.trim() : '') || 'Treat snack';
        submitFeedEntry({
          entryType: 'treat',
          mealSlot: 'treat',
          cups: 0,
          note: noteText,
        }).then((ok) => {
          if (ok && input) input.value = '';
        });
      });
    }

    // Quick treat chips
    document.querySelectorAll('[data-quick-treat]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const label = chip.getAttribute('data-quick-treat') || 'Treat';
        const input = document.getElementById('treatNoteInput');
        if (input) input.value = label;
        submitFeedEntry({
          entryType: 'treat',
          mealSlot: 'treat',
          cups: 0,
          note: label,
        }).then((ok) => {
          if (ok && input) input.value = '';
        });
      });
    });

    // Refresh & Jump to QR
    const btnRefresh = document.getElementById('btnRefresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => fetchStatus());
    }

    const btnJumpQr = document.getElementById('btnJumpQr');
    if (btnJumpQr) {
      btnJumpQr.addEventListener('click', () => {
        const qrSec = document.getElementById('qrSection');
        if (qrSec) qrSec.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Overfeed modal actions
    const btnCancelOverfeed = document.getElementById('btnCancelOverfeed');
    if (btnCancelOverfeed) {
      btnCancelOverfeed.addEventListener('click', () => {
        state.pendingOverridePayload = null;
        hideOverfeedModal();
      });
    }

    const btnForceOverfeed = document.getElementById('btnForceOverfeed');
    if (btnForceOverfeed) {
      btnForceOverfeed.addEventListener('click', () => {
        const payload = state.pendingOverridePayload;
        state.pendingOverridePayload = null;
        hideOverfeedModal();
        if (payload) {
          submitFeedEntry({ ...payload, force: true });
        }
      });
    }

    // Facts filter & spinner
    const btnSpinFact = document.getElementById('btnSpinFact');
    if (btnSpinFact) {
      btnSpinFact.addEventListener('click', () => {
        const nextIdx = (state.spotlightIndex + 1) % CROUTON_FACTS.length;
        renderSpotlightFact(nextIdx);
      });
    }

    document.querySelectorAll('[data-fact-cat]').forEach((pill) => {
      pill.addEventListener('click', () => {
        document
          .querySelectorAll('[data-fact-cat]')
          .forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        state.selectedFactCategory = pill.getAttribute('data-fact-cat') || 'all';
        renderFactsGrid();
      });
    });

    // Print QR Sticker
    const btnPrintQrCard = document.getElementById('btnPrintQrCard');
    if (btnPrintQrCard) {
      btnPrintQrCard.addEventListener('click', () => {
        window.print();
      });
    }

    // Copy QR URL
    const btnCopyUrl = document.getElementById('btnCopyUrl');
    if (btnCopyUrl) {
      btnCopyUrl.addEventListener('click', async () => {
        const input = document.getElementById('qrUrlInput');
        if (!input) return;
        try {
          await navigator.clipboard.writeText(input.value);
          btnCopyUrl.innerHTML = '<i class="bi bi-check2"></i> Copied!';
          setTimeout(() => {
            btnCopyUrl.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
          }, 1800);
        } catch (_) {}
      });
    }
  }

  async function fetchStatus() {
    try {
      const res = await fetch('/api/corgi/status');
      const data = await res.json();
      if (data && data.success) {
        state.statusData = data;
        renderStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch Crouton status:', err);
    }
  }

  async function submitFeedEntry(options) {
    const payload = {
      fedBy: state.selectedFeeder,
      entryType: options.entryType || 'meal',
      mealSlot: options.mealSlot,
      cups: options.cups,
      note: options.note || '',
      force: Boolean(options.force),
    };

    try {
      const res = await fetch('/api/corgi/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.status === 409 && data.code === 'OVERFEED_WARNING') {
        state.pendingOverridePayload = payload;
        showOverfeedModal(data.error, data.existingEntry);
        if (data.statusSummary) {
          state.statusData = data.statusSummary;
          renderStatus(data.statusSummary);
        }
        return false;
      }

      if (!res.ok || !data.success) {
        alert(data.error || 'Could not log feeding entry.');
        return false;
      }

      state.statusData = data;
      renderStatus(data);
      return true;
    } catch (err) {
      console.error('Failed to log entry:', err);
      alert('Network error while saving Crouton feeding log.');
      return false;
    }
  }

  async function deleteEntry(id) {
    try {
      const res = await fetch(`/api/corgi/feed/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data && data.success) {
        state.statusData = data;
        renderStatus(data);
      }
    } catch (err) {
      console.error('Failed to undo entry:', err);
    }
  }

  function showOverfeedModal(message, existingEntry) {
    const modal = document.getElementById('overfeedModal');
    const msgEl = document.getElementById('overfeedModalMessage');
    if (msgEl) {
      let detail = message || 'Crouton has already been fed for this meal slot!';
      if (existingEntry && existingEntry.fedAt) {
        detail += ` (Logged at ${formatClockTime(existingEntry.fedAt)} — ${formatRelativeTime(
          existingEntry.fedAt
        )}).`;
      }
      msgEl.textContent = detail;
    }
    if (modal) modal.classList.remove('d-none');
  }

  function hideOverfeedModal() {
    const modal = document.getElementById('overfeedModal');
    if (modal) modal.classList.add('d-none');
  }

  function renderStatus(data) {
    const hero = document.getElementById('statusHeroCard');
    const badge = document.getElementById('statusBadgePill');
    const headline = document.getElementById('statusHeadline');
    const subline = document.getElementById('statusSubline');

    if (hero) {
      hero.classList.remove('status-ready', 'status-warn', 'status-stop');
      if (data.statusCode === 'READY_FOR_MEAL') {
        hero.classList.add('status-ready');
      } else if (data.statusCode === 'SLOT_ALREADY_FED') {
        hero.classList.add('status-warn');
      } else {
        hero.classList.add('status-stop');
      }
    }

    if (badge) {
      if (data.statusCode === 'READY_FOR_MEAL') {
        badge.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> OK TO SCOOP 1 CUP';
      } else if (data.statusCode === 'SLOT_ALREADY_FED') {
        badge.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i> ALREADY FED THIS MEAL';
      } else {
        badge.innerHTML = '<i class="bi bi-Octagon-fill me-1"></i> DO NOT FEED — 2 CUPS DONE';
      }
    }

    if (headline) headline.textContent = data.statusHeadline || '';
    if (subline) subline.textContent = data.statusSubline || '';

    // Last Meal Box
    const lastMealMain = document.getElementById('lastMealMainText');
    const lastMealMeta = document.getElementById('lastMealMetaText');
    if (data.lastMeal) {
      const m = data.lastMeal;
      const slotTag = m.mealSlot === 'morning' ? 'Morning (8 AM)' : 'Evening (5 PM)';
      if (lastMealMain) {
        lastMealMain.textContent = `${m.fedBy} fed ${m.cups} cup • ${formatClockTime(m.fedAt)}`;
      }
      if (lastMealMeta) {
        lastMealMeta.textContent = `${slotTag} • ${formatRelativeTime(m.fedAt)} (${formatShortDate(
          m.fedAt
        )})`;
      }
    } else {
      if (lastMealMain) lastMealMain.textContent = 'No meals logged yet';
      if (lastMealMeta) lastMealMeta.textContent = 'Scan bucket lid & tap your name below';
    }

    // Last Treat Box
    const lastTreatMain = document.getElementById('lastTreatMainText');
    const lastTreatMeta = document.getElementById('lastTreatMetaText');
    if (data.lastTreat) {
      const t = data.lastTreat;
      if (lastTreatMain) {
        lastTreatMain.textContent = `${t.note || 'Treat'} (by ${t.fedBy})`;
      }
      if (lastTreatMeta) {
        lastTreatMeta.textContent = `${formatClockTime(t.fedAt)} • ${formatRelativeTime(t.fedAt)}`;
      }
    } else {
      if (lastTreatMain) lastTreatMain.textContent = 'No treats logged yet';
      if (lastTreatMeta) lastTreatMeta.textContent = 'Add a quick note when giving treats';
    }

    // Today's 2-Cup Progress
    const today = data.today || {};
    const totalCups = Number(today.totalCups || 0);
    const goalCups = Number(today.dailyGoalCups || 2);
    const pct = Math.min(100, Math.round((totalCups / goalCups) * 100));

    const cupBadge = document.getElementById('dailyCupBadge');
    if (cupBadge) cupBadge.textContent = `${totalCups} / ${goalCups} Cups Today`;

    const bar = document.getElementById('dailyProgressBar');
    if (bar) bar.style.width = `${pct}%`;

    // Morning Slot Card & Button
    const slotMorningCard = document.getElementById('slotMorningCard');
    const slotMorningIcon = document.getElementById('slotMorningIcon');
    const slotMorningDetail = document.getElementById('slotMorningDetail');
    const btnMorning = document.getElementById('btnFeedMorning');
    const btnMorningSub = document.getElementById('btnFeedMorningSub');

    if (today.morningFed && today.morningLastEntry) {
      const entry = today.morningLastEntry;
      if (slotMorningCard) slotMorningCard.classList.add('slot-fed');
      if (slotMorningIcon) slotMorningIcon.textContent = '✅';
      if (slotMorningDetail) {
        slotMorningDetail.textContent = `Fed by ${entry.fedBy} at ${formatClockTime(entry.fedAt)} (${today.morningCups} cup)`;
      }
      if (btnMorning) btnMorning.classList.add('slot-already-done');
      if (btnMorningSub) {
        btnMorningSub.textContent = `Already fed by ${entry.fedBy} at ${formatClockTime(entry.fedAt)}`;
      }
    } else {
      if (slotMorningCard) slotMorningCard.classList.remove('slot-fed');
      if (slotMorningIcon) slotMorningIcon.textContent = '⏳';
      if (slotMorningDetail) slotMorningDetail.textContent = 'Waiting for ~8:00 AM scoop (1 cup)';
      if (btnMorning) btnMorning.classList.remove('slot-already-done');
      if (btnMorningSub) btnMorningSub.textContent = 'Tap to log 1 cup morning scoop';
    }

    // Evening Slot Card & Button
    const slotEveningCard = document.getElementById('slotEveningCard');
    const slotEveningIcon = document.getElementById('slotEveningIcon');
    const slotEveningDetail = document.getElementById('slotEveningDetail');
    const btnEvening = document.getElementById('btnFeedEvening');
    const btnEveningSub = document.getElementById('btnFeedEveningSub');

    if (today.eveningFed && today.eveningLastEntry) {
      const entry = today.eveningLastEntry;
      if (slotEveningCard) slotEveningCard.classList.add('slot-fed');
      if (slotEveningIcon) slotEveningIcon.textContent = '✅';
      if (slotEveningDetail) {
        slotEveningDetail.textContent = `Fed by ${entry.fedBy} at ${formatClockTime(entry.fedAt)} (${today.eveningCups} cup)`;
      }
      if (btnEvening) btnEvening.classList.add('slot-already-done');
      if (btnEveningSub) {
        btnEveningSub.textContent = `Already fed by ${entry.fedBy} at ${formatClockTime(entry.fedAt)}`;
      }
    } else {
      if (slotEveningCard) slotEveningCard.classList.remove('slot-fed');
      if (slotEveningIcon) slotEveningIcon.textContent = '⏳';
      if (slotEveningDetail) slotEveningDetail.textContent = 'Waiting for ~5:00 PM scoop (1 cup)';
      if (btnEvening) btnEvening.classList.remove('slot-already-done');
      if (btnEveningSub) btnEveningSub.textContent = 'Tap to log 1 cup evening scoop';
    }

    // Treats Counter Badge
    const treatsBadge = document.getElementById('treatsCountBadge');
    if (treatsBadge) {
      const count = Number(today.treatsCount || 0);
      treatsBadge.textContent = `${count} treat${count === 1 ? '' : 's'} today`;
    }

    // History List
    renderHistoryList(data.recentLogs || []);
  }

  function renderHistoryList(logs) {
    const container = document.getElementById('feedHistoryList');
    if (!container) return;

    if (!logs.length) {
      container.innerHTML =
        '<div class="text-muted small py-2">No bucket scoops or treat notes yet. Tap your name above to log Crouton’s first meal!</div>';
      return;
    }

    container.innerHTML = logs
      .slice(0, 12)
      .map((item) => {
        const isTreat = item.entryType === 'treat';
        const icon = isTreat ? '🦴' : item.mealSlot === 'morning' ? '🌅' : '🌇';
        const title = isTreat
          ? `Treat Note: ${escapeHtml(item.note || 'Treat')}`
          : `${item.mealSlot === 'morning' ? 'Morning Meal (~8 AM)' : 'Evening Meal (~5 PM)'} — ${item.cups} Cup`;
        const sub = `By <strong>${escapeHtml(item.fedBy)}</strong> • ${formatClockTime(
          item.fedAt
        )} (${formatRelativeTime(item.fedAt)})`;

        return `
          <div class="crouton-log-item">
            <div class="d-flex align-items-center gap-2">
              <div class="crouton-log-icon" aria-hidden="true">${icon}</div>
              <div>
                <div class="crouton-log-title">${title}</div>
                <div class="crouton-log-sub">${sub}</div>
              </div>
            </div>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary crouton-undo-btn"
              data-delete-id="${escapeHtml(item.id)}"
              title="Undo / delete this entry"
            >
              <i class="bi bi-trash3"></i>
            </button>
          </div>
        `;
      })
      .join('');

    container.querySelectorAll('[data-delete-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete-id');
        if (id) deleteEntry(id);
      });
    });
  }

  function renderSpotlightFact(index) {
    const safeIdx = ((index % CROUTON_FACTS.length) + CROUTON_FACTS.length) % CROUTON_FACTS.length;
    state.spotlightIndex = safeIdx;
    const fact = CROUTON_FACTS[safeIdx];

    const catEl = document.getElementById('spotlightFactCategory');
    const countEl = document.getElementById('spotlightFactCounter');
    const titleEl = document.getElementById('spotlightFactTitle');
    const bodyEl = document.getElementById('spotlightFactBody');

    if (catEl) catEl.textContent = fact.categoryLabel;
    if (countEl) countEl.textContent = `Fact ${safeIdx + 1} of ${CROUTON_FACTS.length}`;
    if (titleEl) titleEl.textContent = fact.title;
    if (bodyEl) bodyEl.textContent = fact.body;
  }

  function renderFactsGrid() {
    const grid = document.getElementById('factsGrid');
    if (!grid) return;

    const filtered =
      state.selectedFactCategory === 'all'
        ? CROUTON_FACTS
        : CROUTON_FACTS.filter((f) => f.category === state.selectedFactCategory);

    grid.innerHTML = filtered
      .map(
        (fact) => `
        <div class="col-12 col-sm-6">
          <article class="crouton-fact-card">
            <div class="small fw-bold text-uppercase mb-1" style="color: #b45309; font-size: 0.68rem;">
              ${escapeHtml(fact.categoryLabel)}
            </div>
            <h4 class="crouton-fact-card-title mb-1">${escapeHtml(fact.title)}</h4>
            <p class="crouton-fact-card-body">${escapeHtml(fact.body)}</p>
          </article>
        </div>
      `
      )
      .join('');
  }

  function setupQrCodeBox() {
    const input = document.getElementById('qrUrlInput');
    const defaultScanUrl = `${window.location.origin}/corgi/?scan=1`;
    let savedUrl = defaultScanUrl;
    try {
      const fromStorage = localStorage.getItem(STORAGE_QR_URL_KEY);
      if (fromStorage && fromStorage.startsWith('http')) {
        savedUrl = fromStorage;
      }
    } catch (_) {}

    if (input) {
      input.value = savedUrl;
      input.addEventListener('input', () => {
        const val = input.value.trim() || defaultScanUrl;
        try {
          localStorage.setItem(STORAGE_QR_URL_KEY, val);
        } catch (_) {}
        renderQrSvg(val);
      });
    }

    renderQrSvg(savedUrl);
  }

  function renderQrSvg(targetUrl) {
    const previewContainer = document.getElementById('qrSvgContainer');
    const printContainer = document.getElementById('printQrSvgContainer');
    const printUrlCaption = document.getElementById('printQrUrlCaption');

    if (printUrlCaption) {
      printUrlCaption.textContent = targetUrl;
    }

    if (typeof window.qrcode === 'function') {
      try {
        const qr = window.qrcode(0, 'M');
        qr.addData(targetUrl);
        qr.make();
        const n = qr.getModuleCount();
        const quiet = 4;
        const span = n + quiet * 2;
        let d = '';
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (qr.isDark(r, c)) {
              d += `M${c + quiet},${r + quiet}h1v1h-1z`;
            }
          }
        }
        const svgMarkup = `
          <svg viewBox="0 0 ${span} ${span}" role="img" aria-label="QR Code for Crouton's Food Bucket" shape-rendering="crispEdges">
            <rect width="${span}" height="${span}" fill="#ffffff" />
            <path d="${d}" fill="#3b1d08" />
          </svg>
        `;
        if (previewContainer) previewContainer.innerHTML = svgMarkup;
        if (printContainer) printContainer.innerHTML = svgMarkup;
        return;
      } catch (err) {
        console.warn('QR SVG generation error:', err);
      }
    }

    // Fallback image QR if offline from CDN
    const encoded = encodeURIComponent(targetUrl);
    const fallbackImg = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}" alt="Crouton Bucket QR Code" width="170" height="170" />`;
    if (previewContainer) previewContainer.innerHTML = fallbackImg;
    if (printContainer) printContainer.innerHTML = fallbackImg;
  }

  function formatClockTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function formatShortDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    if (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    ) {
      return 'Today';
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function formatRelativeTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.max(0, Math.round(diffMs / 60000));
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const hours = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    if (hours < 24) {
      return remMin > 0 ? `${hours}h ${remMin}m ago` : `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
