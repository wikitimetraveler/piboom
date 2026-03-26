/**
 * Finds discovery (New find) — photos (gallery / camera / live), address + geo, AI analyze, save.
 */
(function () {
  'use strict';

  let images = []; // { id, url, caption }
  let findsAutocomplete = null;
  let cameraStream = null;

  function $(id) {
    return document.getElementById(id);
  }

  function acquisitionFromForm() {
    const priceRaw = $('pricePaid').value.trim();
    const pricePaid = priceRaw === '' ? null : Number(priceRaw);
    const latRaw = $('findLat').value.trim();
    const lngRaw = $('findLng').value.trim();
    const lat = latRaw === '' ? null : Number(latRaw);
    const lng = lngRaw === '' ? null : Number(lngRaw);
    return {
      source: $('acqSource').value.trim(),
      location: $('acqLocation').value.trim(),
      address: $('findAddress').value.trim(),
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
      placeId: $('findPlaceId').value.trim(),
      pricePaid: Number.isFinite(pricePaid) ? pricePaid : null,
      date: $('acqDate').value.trim(),
    };
  }

  function buildPayloadFromForm() {
    return {
      images: images.map((i) => ({ id: i.id, url: i.url, caption: i.caption || '' })),
      acquisition: acquisitionFromForm(),
      identification: {
        maker: $('idMaker').value.trim(),
        probableMaker: $('idProbable').value.trim(),
        signed: $('idSigned').checked,
        numbered: $('idNumbered').checked,
        edition: $('idEdition').value.trim(),
        medium: $('idMedium').value.trim(),
        visibleText: $('idVisibleText').value.trim(),
        confidence: parseFloat($('idConfidence').value) || 0,
      },
      condition: {
        overall: $('condOverall').value.trim(),
        framed: $('condFramed').checked,
        notes: $('condNotes').value.trim(),
      },
      valuation: {
        listingLow: numOrNull($('valListLow').value),
        listingHigh: numOrNull($('valListHigh').value),
        realisticLow: numOrNull($('valRealLow').value),
        realisticHigh: numOrNull($('valRealHigh').value),
        confidence: $('valConf').value.trim(),
        notes: $('valNotes').value.trim(),
      },
      notes: $('findNotes').value.trim(),
      tags: $('findTags')
        .value.split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      subcategory: $('subcategory').value.trim(),
      aiAnalysis: window.__lastAiAnalysis || { raw: null, summaryText: '', generatedAt: '' },
      voiceNotes: [],
      voiceSummary: { text: '', audioUrl: '', generatedAt: '' },
    };
  }

  function numOrNull(s) {
    const n = Number(String(s).trim());
    return Number.isFinite(n) ? n : null;
  }

  async function refreshScore() {
    const el = $('scorePreview');
    if (!el) return;
    try {
      const payload = buildPayloadFromForm();
      const data = await window.findsApi.scorePreview(payload);
      el.textContent = `Treasure score: ${data.score} (${data.scoreLabel})`;
    } catch (e) {
      el.textContent = 'Score: —';
    }
  }

  function renderThumbs() {
    const mount = $('imageThumbs');
    if (!mount) return;
    mount.innerHTML = images
      .map(
        (im, idx) => `
      <div class="d-inline-block mr-2 mb-2 position-relative" style="width:100px;">
        <img src="${im.url}" alt="" style="width:100px;height:100px;object-fit:cover;border-radius:8px;">
        <button type="button" class="btn btn-sm btn-danger position-absolute" style="top:2px;right:2px;padding:0 6px;" data-rm="${idx}">×</button>
      </div>`
      )
      .join('');
    mount.querySelectorAll('[data-rm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.getAttribute('data-rm'), 10);
        images.splice(i, 1);
        renderThumbs();
        refreshScore();
      });
    });
  }

  function readFileDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function addImageFromDataUrl(dataUrl) {
    if (images.length >= 8) {
      alert('Maximum 8 photos.');
      return;
    }
    if (dataUrl.length > 2.2 * 1024 * 1024) {
      alert('Image too large; skipped.');
      return;
    }
    images.push({
      id: crypto.randomUUID(),
      url: dataUrl,
      caption: '',
    });
    renderThumbs();
    refreshScore();
  }

  async function addFilesFromList(files) {
    if (!files?.length) return;
    for (let i = 0; i < files.length && images.length < 8; i++) {
      const f = files[i];
      if (!f.type.startsWith('image/')) continue;
      const dataUrl = await readFileDataUrl(f);
      await addImageFromDataUrl(dataUrl);
    }
  }

  function setGeoStatus(msg, kind) {
    const el = $('geoStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'ml-2 small ' + (kind === 'error' ? 'text-danger' : kind === 'ok' ? 'text-success' : 'text-muted');
  }

  function setCameraStatus(msg, kind) {
    const el = $('cameraStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'small mb-2 ' + (kind === 'error' ? 'text-danger' : 'text-muted');
  }

  function fillFromPlace(place) {
    if (!place) return;
    const addr = place.formatted_address || place.name || '';
    if (addr) $('findAddress').value = addr;
    if (place.geometry && place.geometry.location) {
      const lat = typeof place.geometry.location.lat === 'function' ? place.geometry.location.lat() : place.geometry.location.lat;
      const lng = typeof place.geometry.location.lng === 'function' ? place.geometry.location.lng() : place.geometry.location.lng;
      $('findLat').value = String(lat);
      $('findLng').value = String(lng);
    }
    $('findPlaceId').value = place.place_id || '';
  }

  function initFindsAddressAutocomplete() {
    const input = $('findAddress');
    if (!input || findsAutocomplete || !window.google || !google.maps || !google.maps.places) return;
    try {
      findsAutocomplete = new google.maps.places.Autocomplete(input, {
        fields: ['formatted_address', 'geometry', 'place_id', 'name'],
      });
      findsAutocomplete.addListener('place_changed', function () {
        fillFromPlace(findsAutocomplete.getPlace());
      });
      input.addEventListener('input', function () {
        $('findPlaceId').value = '';
        $('findLat').value = '';
        $('findLng').value = '';
      });
    } catch (err) {
      console.warn('Finds Places autocomplete:', err);
    }
  }

  function loadGoogleMaps() {
    return fetch('/api/finds/google-api-key')
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!data.apiKey) return;
        return new Promise(function (resolve) {
          window.__findsMapsInitCb = function () {
            initFindsAddressAutocomplete();
            resolve();
          };
          const script = document.createElement('script');
          script.src =
            'https://maps.googleapis.com/maps/api/js?key=' +
            encodeURIComponent(data.apiKey) +
            '&libraries=places&callback=__findsMapsInitCb';
          script.async = true;
          script.defer = true;
          document.head.appendChild(script);
        });
      })
      .catch(function () {});
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoStatus('Geolocation not available in this browser.', 'error');
      return;
    }
    setGeoStatus('Getting location…', '');
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        $('findLat').value = String(lat);
        $('findLng').value = String(lng);
        $('findPlaceId').value = '';
        const addrInput = $('findAddress');
        if (window.google && google.maps && google.maps.Geocoder) {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat: lat, lng: lng } }, function (results, status) {
            if (status === 'OK' && results && results[0] && !addrInput.value.trim()) {
              addrInput.value = results[0].formatted_address;
            } else if (!addrInput.value.trim()) {
              addrInput.value = lat.toFixed(5) + ', ' + lng.toFixed(5);
            }
            setGeoStatus('Location saved.', 'ok');
          });
        } else {
          if (!addrInput.value.trim()) {
            addrInput.value = lat.toFixed(5) + ', ' + lng.toFixed(5);
          }
          setGeoStatus('Coordinates saved. Add a Maps key for address lookup.', 'ok');
        }
      },
      function () {
        setGeoStatus('Could not read GPS. Check permissions.', 'error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
    );
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(function (t) {
        t.stop();
      });
      cameraStream = null;
    }
    const video = $('findCameraPreview');
    if (video) {
      video.srcObject = null;
      video.style.display = 'none';
    }
    const cap = $('btnCameraCapture');
    const st = $('btnCameraStop');
    if (cap) cap.disabled = true;
    if (st) st.disabled = true;
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadGoogleMaps();

    function wireFileInput(el) {
      if (!el) return;
      el.addEventListener('change', async function () {
        await addFilesFromList(el.files);
        el.value = '';
      });
    }
    wireFileInput($('imageInput'));
    wireFileInput($('imageInputCamera'));

    $('btnUseMyLocation')?.addEventListener('click', useMyLocation);

    $('btnCameraStart')?.addEventListener('click', async function () {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraStatus('Live camera not supported here. Use “Camera / take photo” instead.', 'error');
        return;
      }
      try {
        stopCamera();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        cameraStream = stream;
        const video = $('findCameraPreview');
        video.srcObject = stream;
        video.style.display = 'block';
        $('btnCameraCapture').disabled = false;
        $('btnCameraStop').disabled = false;
        setCameraStatus('Camera on. Tap Capture frame when ready.');
      } catch (e) {
        console.warn(e);
        setCameraStatus('Camera blocked or unavailable.', 'error');
      }
    });

    $('btnCameraCapture')?.addEventListener('click', async function () {
      const video = $('findCameraPreview');
      if (!video || !cameraStream || !video.videoWidth) {
        setCameraStatus('Start the live camera first.', 'error');
        return;
      }
      const canvas = $('findCameraCanvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      await addImageFromDataUrl(dataUrl);
      setCameraStatus('Frame added to photos.');
    });

    $('btnCameraStop')?.addEventListener('click', function () {
      stopCamera();
      setCameraStatus('Camera stopped.');
    });

    $('btnAnalyze')?.addEventListener('click', async () => {
      const urls = images.map((x) => x.url).slice(0, 5);
      if (!urls.length) {
        alert('Add at least one photo.');
        return;
      }
      $('analyzeStatus').textContent = 'Analyzing…';
      try {
        const notes = $('findNotes').value.trim();
        const { analysis } = await window.findsApi.analyze(urls, notes);
        if (analysis.title) $('findTitle').value = analysis.title;
        if (analysis.category) $('findCategory').value = analysis.category;
        if (analysis.subcategory) $('subcategory').value = analysis.subcategory;
        const id = analysis.identification || {};
        if (id.maker != null) $('idMaker').value = id.maker;
        if (id.probableMaker != null) $('idProbable').value = id.probableMaker;
        $('idSigned').checked = !!id.signed;
        $('idNumbered').checked = !!id.numbered;
        if (id.edition != null) $('idEdition').value = id.edition;
        if (id.medium != null) $('idMedium').value = id.medium;
        if (id.visibleText != null) $('idVisibleText').value = id.visibleText;
        if (id.confidence != null) $('idConfidence').value = String(id.confidence);
        const c = analysis.condition || {};
        if (c.overall) $('condOverall').value = c.overall;
        $('condFramed').checked = !!c.framed;
        if (c.notes) $('condNotes').value = c.notes;
        const v = analysis.valuation || {};
        if (v.listingLow != null) $('valListLow').value = v.listingLow;
        if (v.listingHigh != null) $('valListHigh').value = v.listingHigh;
        if (v.realisticLow != null) $('valRealLow').value = v.realisticLow;
        if (v.realisticHigh != null) $('valRealHigh').value = v.realisticHigh;
        if (v.confidence) $('valConf').value = v.confidence;
        if (v.notes) $('valNotes').value = v.notes;
        if (Array.isArray(analysis.tags) && analysis.tags.length) {
          $('findTags').value = analysis.tags.join(', ');
        }
        if (analysis.notes) {
          const cur = $('findNotes').value.trim();
          $('findNotes').value = cur ? `${cur}\n${analysis.notes}` : analysis.notes;
        }
        window.__lastAiAnalysis = {
          raw: analysis,
          summaryText: analysis.summaryText || '',
          generatedAt: new Date().toISOString(),
        };
        $('analyzeStatus').textContent = 'Done.';
      } catch (e) {
        $('analyzeStatus').textContent = '';
        alert(e.message || String(e));
      }
      refreshScore();
    });

    $('btnSave')?.addEventListener('click', async () => {
      const title = $('findTitle').value.trim();
      if (!title) {
        alert('Title is required.');
        return;
      }
      const payload = buildPayloadFromForm();
      try {
        const data = await window.findsApi.create({
          title,
          category: $('findCategory').value,
          status: $('findStatus').value,
          payload,
        });
        stopCamera();
        window.location.href = `/finds/detail.html?id=${data.find.id}`;
      } catch (e) {
        alert(e.message || String(e));
      }
    });

    document.querySelectorAll('.score-refresh').forEach((el) => {
      el.addEventListener('input', () => refreshScore());
      el.addEventListener('change', () => refreshScore());
    });

    refreshScore();
  });

  window.addEventListener('beforeunload', function () {
    stopCamera();
  });
})();
