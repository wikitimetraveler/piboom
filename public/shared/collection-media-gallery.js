/**
 * Shared multi-photo / video slideshow for collection pages.
 * Vanilla JS; include collection-media-gallery.css.
 */
(function (global) {
  var MAX_FILES = 10;
  var MAX_BYTES = 6 * 1024 * 1024;

  function inferVideo(url) {
    if (!url || typeof url !== 'string') return false;
    if (/^data:video\//i.test(url)) return true;
    return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url);
  }

  function normalizeCollectionMedia(row, legacyKey) {
    if (!row) return [];
    var raw = row.media_gallery;
    if (raw) {
      var g = typeof raw === 'string' ? (function () {
        try { return JSON.parse(raw); } catch (e) { return []; }
      })() : raw;
      if (Array.isArray(g) && g.length) {
        return g.filter(function (m) { return m && m.url; }).map(function (m) {
          var vid = m.type === 'video' || inferVideo(m.url);
          return { type: vid ? 'video' : 'image', url: m.url, caption: m.caption || '' };
        });
      }
    }
    var camel = row.mediaGallery;
    if (camel) {
      var cg = typeof camel === 'string' ? (function () {
        try { return JSON.parse(camel); } catch (e) { return []; }
      })() : camel;
      if (Array.isArray(cg) && cg.length) {
        return cg.filter(function (m) { return m && m.url; }).map(function (m) {
          var vid = m.type === 'video' || inferVideo(m.url);
          return { type: vid ? 'video' : 'image', url: m.url, caption: m.caption || '' };
        });
      }
    }
    if (legacyKey === 'photos' && row.photos != null) {
      var p = typeof row.photos === 'string' ? (function () {
        try { return JSON.parse(row.photos); } catch (e) { return []; }
      })() : row.photos;
      if (Array.isArray(p) && p.length) {
        return p.map(function (item) {
          var url = typeof item === 'string' ? item : (item && item.url);
          if (!url) return null;
          return { type: inferVideo(url) ? 'video' : 'image', url: url };
        }).filter(Boolean);
      }
    }
    var legacy = legacyKey ? row[legacyKey] : null;
    if (legacy) return [{ type: inferVideo(legacy) ? 'video' : 'image', url: legacy }];
    return [];
  }

  function mountCollectionSlideshow(container, items, opts) {
    if (!container) return;
    opts = opts || {};
    container.innerHTML = '';
    var merged = (items && items.length) ? items.slice() : [];
    if (!merged.length) {
      container.innerHTML = '<div class="collection-media-empty">' + (opts.emptyText || 'No photos or videos') + '</div>';
      return;
    }
    var index = 0;
    var wrap = document.createElement('div');
    wrap.className = 'collection-media-root' + (opts.compact ? ' collection-media-root--compact' : '');

    var viewport = document.createElement('div');
    viewport.className = 'collection-media-viewport';

    var stage = document.createElement('div');
    stage.className = 'collection-media-stage';

    function renderSlide(i) {
      stage.innerHTML = '';
      var m = merged[i];
      if (!m) return;
      if (m.type === 'video' || inferVideo(m.url)) {
        var v = document.createElement('video');
        v.setAttribute('src', m.url);
        v.setAttribute('controls', '');
        v.setAttribute('playsinline', '');
        v.className = 'collection-media-video';
        stage.appendChild(v);
      } else {
        var img = document.createElement('img');
        img.src = m.url;
        img.alt = m.caption || '';
        img.className = 'collection-media-img lane-lightbox-ignore';
        img.setAttribute('data-lane-lightbox-ignore', '1');
        stage.appendChild(img);
      }
    }

    function updateDots() {
      dots.innerHTML = '';
      merged.forEach(function (_, di) {
        var d = document.createElement('button');
        d.type = 'button';
        d.className = 'collection-media-dot' + (di === index ? ' active' : '');
        d.setAttribute('aria-label', 'Slide ' + (di + 1));
        d.onclick = function () {
          index = di;
          renderSlide(index);
          updateDots();
          if (opts.onSlideChange) opts.onSlideChange(index);
        };
        dots.appendChild(d);
      });
    }

    function go(delta) {
      index = (index + delta + merged.length) % merged.length;
      renderSlide(index);
      updateDots();
      if (opts.onSlideChange) opts.onSlideChange(index);
    }

    var prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'collection-media-nav collection-media-prev';
    prev.setAttribute('aria-label', 'Previous');
    prev.innerHTML = '\u2039';
    prev.onclick = function () { go(-1); };

    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'collection-media-nav collection-media-next';
    next.setAttribute('aria-label', 'Next');
    next.innerHTML = '\u203A';
    next.onclick = function () { go(1); };

    var dots = document.createElement('div');
    dots.className = 'collection-media-dots';

    viewport.appendChild(prev);
    viewport.appendChild(stage);
    viewport.appendChild(next);
    wrap.appendChild(viewport);
    if (merged.length > 1) wrap.appendChild(dots);

    container.appendChild(wrap);

    renderSlide(0);
    if (merged.length > 1) updateDots();

    if (opts.autoplayMs && merged.length > 1) {
      var timer = setInterval(function () { go(1); }, opts.autoplayMs);
      wrap.addEventListener('mouseenter', function () { clearInterval(timer); timer = null; });
    }
  }

  function renderSingleMedia(container, item, alt) {
    if (!container || !item || !item.url) return;
    container.innerHTML = '';
    if (item.type === 'video' || inferVideo(item.url)) {
      var v = document.createElement('video');
      v.src = item.url;
      v.controls = true;
      v.playsInline = true;
      v.className = 'collection-media-video collection-media-video--fill';
      container.appendChild(v);
    } else {
      var img = document.createElement('img');
      img.src = item.url;
      img.alt = alt || '';
      img.className = 'collection-media-img collection-media-img--fill lane-lightbox-ignore';
      img.setAttribute('data-lane-lightbox-ignore', '1');
      container.appendChild(img);
    }
  }

  function filesToMediaItems(fileList, maxFiles, maxBytes) {
    var files = Array.prototype.slice.call(fileList || [], 0, maxFiles || MAX_FILES);
    var limit = maxBytes != null ? maxBytes : MAX_BYTES;
    return Promise.all(files.map(function (f) {
      if (f.size > limit) return Promise.resolve(null);
      return new Promise(function (resolve, reject) {
        var r = new FileReader();
        r.onload = function () {
          var isVid = f.type.indexOf('video/') === 0;
          resolve({ type: isVid ? 'video' : 'image', url: r.result });
        };
        r.onerror = reject;
        r.readAsDataURL(f);
      });
    })).then(function (arr) { return arr.filter(Boolean); });
  }

  global.CollectionMediaGallery = {
    normalizeCollectionMedia: normalizeCollectionMedia,
    mountCollectionSlideshow: mountCollectionSlideshow,
    renderSingleMedia: renderSingleMedia,
    filesToMediaItems: filesToMediaItems,
    inferVideo: inferVideo,
    MAX_FILES: MAX_FILES,
    MAX_BYTES: MAX_BYTES
  };
})(typeof window !== 'undefined' ? window : globalThis);
