/**
 * Development work by David Lane
 */
/**
 * Unified Disasters — footer date, pull sheets, and Encompass hub easter egg.
 */

      document.addEventListener('DOMContentLoaded', function () {
        var el = document.getElementById('disastersFooterDate');
        if (el) el.textContent = new Date().toLocaleDateString();

        var pullConfigs = [
          { sheetId: 'duSchemaSheet', tabId: 'duSchemaSheetTab' },
          { sheetId: 'duImpactGraphSheet', tabId: 'duImpactGraphSheetTab' },
          { sheetId: 'duHeygenSheet', tabId: 'duHeygenPullCard' }
        ];

        function setPullSheetOpen(sheetId, open) {
          var on = !!open;
          pullConfigs.forEach(function (cfg) {
            var sheet = document.getElementById(cfg.sheetId);
            var tab = document.getElementById(cfg.tabId);
            if (!sheet || !tab) return;
            var isTarget = cfg.sheetId === sheetId;
            var isOpen = on && isTarget;
            sheet.classList.toggle('du-schema-sheet--open', isOpen);
            sheet.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
            tab.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          });
          document.body.classList.toggle('du-pull-sheet-open', on);
        }

        function getOpenSheetId() {
          var open = pullConfigs.find(function (cfg) {
            var sheet = document.getElementById(cfg.sheetId);
            return sheet && sheet.classList.contains('du-schema-sheet--open');
          });
          return open ? open.sheetId : null;
        }

        pullConfigs.forEach(function (cfg) {
          var sheet = document.getElementById(cfg.sheetId);
          var tab = document.getElementById(cfg.tabId);
          if (!sheet || !tab) return;

          tab.addEventListener('click', function () {
            var isOpen = sheet.classList.contains('du-schema-sheet--open');
            setPullSheetOpen(cfg.sheetId, !isOpen);
          });

          sheet.querySelectorAll('[data-du-pull-backdrop], [data-du-pull-close]').forEach(function (el) {
            el.addEventListener('click', function () { setPullSheetOpen(cfg.sheetId, false); });
          });
        });

        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && getOpenSheetId()) setPullSheetOpen(getOpenSheetId(), false);
        });

        window.duOpenPullSheet = function (sheetId) {
          if (sheetId) setPullSheetOpen(sheetId, true);
        };

        if (location.hash === '#duHeygenStudio' || location.hash === '#duHeygenPullCard') {
          setPullSheetOpen('duHeygenSheet', true);
        } else if (location.hash === '#duImpactGraphSheet') {
          setPullSheetOpen('duImpactGraphSheet', true);
        }

        // Footer easter egg — 6 clicks on the quote opens Encompass Hub (not Worksheets).
        (function initDuEncompassHubEasterEgg() {
          var quote = document.getElementById('duSecretQuote');
          var listenBtn = document.getElementById('duDailyBriefingListenBtn');
          var stopBtn = document.getElementById('duDailyBriefingStopBtn');
          if (!quote) return;

          var clickCount = 0;
          var clickTimer = null;
          var HUB_URL = '/finance/encompass-hub.html';
          var TARGET_CLICKS = 6;
          var RESET_MS = 1400;

          function pulseQuote(el) {
            el.classList.add('du-footer-quote--pulse');
            setTimeout(function () { el.classList.remove('du-footer-quote--pulse'); }, 220);
          }

          function goToEncompassHub(el) {
            el.classList.add('du-footer-quote--unlock');
            document.body.style.transition = 'opacity 0.85s ease-out';
            document.body.style.opacity = '0';
            setTimeout(function () {
              window.location.href = HUB_URL;
            }, 850);
          }

          function registerClick(el) {
            clickCount += 1;
            pulseQuote(el);
            clearTimeout(clickTimer);
            clickTimer = setTimeout(function () { clickCount = 0; }, RESET_MS);
            if (clickCount >= TARGET_CLICKS) {
              clickCount = 0;
              clearTimeout(clickTimer);
              goToEncompassHub(el);
            }
          }

          quote.addEventListener('click', function () { registerClick(quote); });
          quote.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              registerClick(quote);
            }
          });

          // Listen + Stop in the hero also advance the same counter (pairs with footer taps).
          if (listenBtn) {
            listenBtn.addEventListener('click', function () { registerClick(quote); });
          }
          if (stopBtn) {
            stopBtn.addEventListener('click', function () { registerClick(quote); });
          }
        })();
      });
