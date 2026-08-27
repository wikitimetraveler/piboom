/**
 * Fun Home — theme toggle, interactions, and 3D hero scene
 */
(function () {
  'use strict';

  const THEME_KEY = 'funHomeTheme';
  const WORK_REVEAL_KEY = 'mortgageLinkRevealed';
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Theme toggle
  function initThemeToggle() {
    const btn = document.getElementById('funThemeToggle');
    if (!btn) return;

    const body = document.body;
    const icon = btn.querySelector('i');
    const label = btn.querySelector('span');

    function applyTheme(theme) {
      body.setAttribute('data-theme', theme);

      // Button shows the destination theme (what a click will switch to)
      if (theme === 'dark') {
        icon.className = 'bi bi-sun-fill';
        label.textContent = 'Zen';
        btn.setAttribute('aria-label', 'Switch to zen theme');
      } else {
        icon.className = 'bi bi-moon-stars-fill';
        label.textContent = 'Dark';
        btn.setAttribute('aria-label', 'Switch to dark theme');
      }

      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (_) {}
    }

    function toggleTheme() {
      const current = body.getAttribute('data-theme');
      const next = current === 'zen' ? 'dark' : 'zen';
      applyTheme(next);
    }

    btn.addEventListener('click', toggleTheme);

    // Load saved theme
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'zen') {
        applyTheme(saved);
      } else {
        // Default to zen
        applyTheme('zen');
      }
    } catch (_) {
      applyTheme('zen');
    }
  }

  // Card hover effects
  function initCardEffects() {
    const cards = document.querySelectorAll('.fun-card');
    
    cards.forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.setProperty('--card-scale', '1.02');
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--card-scale', '1');
      });
    });
  }

  // Smooth scroll for hero CTA / legacy scroll indicator
  function initSmoothScroll() {
    document.querySelectorAll('a[href="#projects"], .fun-hero__scroll, .fun-hero__scroll-cue').forEach((el) => {
      el.addEventListener('click', (e) => {
        const projectsSection = document.getElementById('projects') || document.querySelector('.fun-projects');
        if (!projectsSection) return;
        e.preventDefault();
        projectsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function initHeaderScroll() {
    const header = document.querySelector('.fun-header');
    if (!header) return;
    const onScroll = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 12);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Update year
  function updateYear() {
    const yearEl = document.getElementById('funYear');
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }
  }

  // Parallax sparkles on scroll
  function initParallaxSparkles() {
    const sparkles = document.querySelectorAll('.sparkle');
    if (!sparkles.length) return;

    let ticking = false;

    function updateSparkles() {
      const scrollY = window.pageYOffset;
      
      sparkles.forEach((sparkle, index) => {
        const speed = 0.3 + (index * 0.1);
        const yPos = -(scrollY * speed);
        sparkle.style.transform = `translateY(${yPos}px)`;
      });

      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateSparkles);
        ticking = true;
      }
    });
  }

  // Add subtle animation to cards on scroll into view
  function initScrollAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, observerOptions);

    const cards = document.querySelectorAll('.fun-card');
    cards.forEach(card => {
      observer.observe(card);
    });
  }

  // Click / keyboard: same as the primary Enter / open button
  function initCardOpen() {
    const cards = document.querySelectorAll('.fun-card');

    cards.forEach((card) => {
      const primary = card.querySelector('.fun-card__link--primary');
      if (!primary) return;

      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'link');
      card.setAttribute(
        'aria-label',
        primary.textContent.replace(/\s+/g, ' ').trim()
      );
      card.classList.add('fun-card--clickable');

      const openLikeButton = () => {
        primary.click();
      };

      card.addEventListener('click', (e) => {
        // Leave Enter button, More, and nested links alone
        if (e.target.closest('a, button, summary, details')) return;
        openLikeButton();
      });

      card.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (e.target !== card) return;
        e.preventDefault();
        openLikeButton();
      });
    });
  }

  function isFunHomeLoggedIn() {
    if (typeof window.isLoggedIn === 'function') return !!window.isLoggedIn();
    try {
      return localStorage.getItem('loggedInUserId') !== null;
    } catch (_) {
      return false;
    }
  }

  function renderFunAuthButton() {
    const btn = document.getElementById('funAuthBtn');
    if (!btn) return null;

    if (isFunHomeLoggedIn()) {
      const user = typeof window.getLoggedInUser === 'function' ? window.getLoggedInUser() : null;
      const name = user && user.name ? user.name.split(' ').slice(-1)[0] : 'Account';
      btn.classList.add('fun-auth-btn--out');
      btn.setAttribute('aria-label', 'Log out as ' + name);
      btn.innerHTML =
        (user && user.avatar
          ? '<img class="fun-auth-btn__avatar" src="' + user.avatar + '" alt="" />'
          : '<i class="bi bi-person-check" aria-hidden="true"></i>') +
        '<span>' + name + ' · Log out</span>';
    } else {
      btn.classList.remove('fun-auth-btn--out');
      btn.setAttribute('aria-label', 'Log in');
      btn.innerHTML =
        '<i class="bi bi-box-arrow-in-right" aria-hidden="true"></i><span>Log in</span>';
    }
    return btn;
  }

  function initFunAuthButton() {
    const btn = document.getElementById('funAuthBtn');
    if (!btn) return;

    renderFunAuthButton();
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      if (isFunHomeLoggedIn()) {
        if (typeof window.logout === 'function') window.logout();
        return;
      }
      if (typeof window.showLoginPopup === 'function') {
        window.showLoginPopup();
      }
    });

    window.addEventListener('user-logged-in', renderFunAuthButton);
    window.addEventListener('pageshow', renderFunAuthButton);
    window.addEventListener('focus', renderFunAuthButton);
    window.addEventListener('storage', (event) => {
      if (!event.key || event.key === 'loggedInUserId' || event.key === 'currentUserId') {
        renderFunAuthButton();
      }
    });
  }

  // Secret 5-click mechanism to reveal mortgage work link
  function initSecretMortgageLink() {
    const sparkle = document.getElementById('secretSparkle');
    const secretLink = document.getElementById('secretMortgageLink');
    if (!sparkle || !secretLink) return;

    let clickCount = 0;
    let resetTimer = null;
    const CLICK_TIMEOUT = 3000; // Reset after 3 seconds of no clicks
    const REQUIRED_CLICKS = 5;

    sparkle.style.cursor = 'pointer';

    sparkle.addEventListener('click', (e) => {
      e.preventDefault();
      clickCount++;

      // Add click animation
      sparkle.classList.remove('clicking');
      void sparkle.offsetWidth; // Force reflow
      sparkle.classList.add('clicking');

      // Clear existing reset timer
      if (resetTimer) {
        clearTimeout(resetTimer);
      }

      // Check if we've reached the required clicks
      if (clickCount >= REQUIRED_CLICKS) {
        // Reveal the secret link!
        secretLink.style.display = 'flex';
        
        // Optional: Save to localStorage so it stays revealed
        try {
          localStorage.setItem(WORK_REVEAL_KEY, 'true');
        } catch (_) {}

        // Console message
        console.log('🔓 Secret mortgage work link revealed!');
        
        // Reset click count
        clickCount = 0;
      } else {
        // Set timer to reset click count
        resetTimer = setTimeout(() => {
          clickCount = 0;
        }, CLICK_TIMEOUT);

        // Give subtle feedback on progress
        if (clickCount === 3) {
          console.log('🤔 Keep clicking...');
        }
      }
    });

    function syncSecretMortgageVisibility() {
      try {
        if (isFunHomeLoggedIn() || localStorage.getItem(WORK_REVEAL_KEY) === 'true') {
          secretLink.style.display = 'flex';
        }
      } catch (_) {
        if (isFunHomeLoggedIn()) secretLink.style.display = 'flex';
      }
    }

    syncSecretMortgageVisibility();
    window.addEventListener('user-logged-in', syncSecretMortgageVisibility);
    window.addEventListener('pageshow', syncSecretMortgageVisibility);
  }

  // Easter egg: Konami code for extra sparkles
  function initEasterEgg() {
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIndex = 0;

    document.addEventListener('keydown', (e) => {
      if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++;
        
        if (konamiIndex === konamiCode.length) {
          activateExtraSparkles();
          konamiIndex = 0;
        }
      } else {
        konamiIndex = 0;
      }
    });
  }

  function activateExtraSparkles() {
    const hero = document.querySelector('.fun-hero');
    if (!hero) return;

    // Create extra sparkles
    for (let i = 0; i < 20; i++) {
      const sparkle = document.createElement('span');
      sparkle.className = 'sparkle';
      sparkle.textContent = ['✦', '✧', '★', '✨', '⭐'][Math.floor(Math.random() * 5)];
      sparkle.style.left = Math.random() * 100 + '%';
      sparkle.style.top = Math.random() * 100 + '%';
      sparkle.style.fontSize = (Math.random() * 2 + 1) + 'rem';
      sparkle.style.animationDelay = Math.random() * 3 + 's';
      sparkle.style.animationDuration = (Math.random() * 4 + 3) + 's';
      
      const sparklesContainer = document.querySelector('.fun-hero__sparkles');
      if (sparklesContainer) {
        sparklesContainer.appendChild(sparkle);
        
        // Remove after animation
        setTimeout(() => {
          sparkle.remove();
        }, 8000);
      }
    }

    // Log to console
    console.log('✨ Extra sparkles activated! ✨');
  }

  // Three.js Hero Scene — faceted zen glass crystal (CSS orb is fallback only)
  function makeZenEnvMap(renderer) {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.HemisphereLight(0xf4fbff, 0x163040, 1.35));
    const panels = [
      { color: 0xffffff, pos: [0, 5, 0] },
      { color: 0x4a90a4, pos: [5, 1, 2] },
      { color: 0xc8ab57, pos: [-4, 2, 3] },
      { color: 0x7ec8b8, pos: [2, -3, 4] },
      { color: 0xd8eef4, pos: [-2, 1, -5] }
    ];
    panels.forEach((p) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(7, 7),
        new THREE.MeshBasicMaterial({ color: p.color, side: THREE.DoubleSide })
      );
      mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
      mesh.lookAt(0, 0, 0);
      envScene.add(mesh);
    });
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(envScene, 0.06).texture;
    pmrem.dispose();
    return envTex;
  }

  function initHeroScene() {
    if (typeof THREE === 'undefined' || prefersReducedMotion) return;

    const canvas = document.getElementById('heroCanvas');
    if (!canvas) return;

    const container = canvas.parentElement;
    let width = container.clientWidth;
    let height = container.clientHeight;
    const isNarrow = window.matchMedia('(max-width: 991.98px)').matches;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isNarrow ? 1.5 : 2));
    renderer.setSize(width, height);
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(isNarrow ? 40 : 32, width / height, 0.1, 100);
    camera.position.set(0, 0.08, isNarrow ? 4.6 : 3.7);

    const envMap = makeZenEnvMap(renderer);

    const group = new THREE.Group();
    group.position.set(isNarrow ? 0 : 1.45, isNarrow ? 0.42 : 0.04, 0);
    group.scale.setScalar(isNarrow ? 1.28 : 1.72);
    scene.add(group);

    function getMaterials() {
      const dark = document.body.getAttribute('data-theme') === 'dark';
      const core = new THREE.MeshPhysicalMaterial({
        color: dark ? 0x8ec5d4 : 0xc5e6ee,
        metalness: 0.05,
        roughness: 0.06,
        transmission: 0.88,
        thickness: 1.55,
        ior: 1.48,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        envMap: envMap,
        envMapIntensity: dark ? 1.7 : 1.35,
        attenuationColor: dark ? 0x3d7a8a : 0x4a90a4,
        attenuationDistance: 2.4,
        specularIntensity: 1,
        iridescence: 0.12,
        iridescenceIOR: 1.3
      });
      const ring = new THREE.MeshStandardMaterial({
        color: dark ? 0xe8c96a : 0xc8ab57,
        metalness: 0.92,
        roughness: 0.22,
        envMap: envMap,
        envMapIntensity: 1.1
      });
      const rim = new THREE.LineBasicMaterial({
        color: dark ? 0xeaf6fa : 0xffffff,
        transparent: true,
        opacity: dark ? 0.42 : 0.38
      });
      const heart = new THREE.MeshStandardMaterial({
        color: dark ? 0x2a6070 : 0x4a90a4,
        emissive: dark ? 0x4a90a4 : 0x7eb8c6,
        emissiveIntensity: dark ? 0.95 : 0.65,
        roughness: 0.4,
        metalness: 0.1
      });
      return { core, ring, rim, heart };
    }

    let mats = getMaterials();
    const detail = isNarrow ? 1 : 2;
    const orbGeom = new THREE.IcosahedronGeometry(1.12, detail);
    const orb = new THREE.Mesh(orbGeom, mats.core);
    group.add(orb);

    const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), mats.heart);
    group.add(heart);

    const edgeGeom = new THREE.EdgesGeometry(orbGeom, 18);
    const facets = new THREE.LineSegments(edgeGeom, mats.rim);
    group.add(facets);

    const ringGeom = new THREE.TorusGeometry(1.58, 0.038, 12, isNarrow ? 64 : 96);
    const ring = new THREE.Mesh(ringGeom, mats.ring);
    ring.rotation.x = Math.PI / 2.28;
    group.add(ring);

    const ring2Geom = new THREE.TorusGeometry(1.92, 0.016, 10, isNarrow ? 48 : 80);
    const ring2 = new THREE.Mesh(
      ring2Geom,
      new THREE.MeshStandardMaterial({
        color: 0x9fd0dc,
        metalness: 0.55,
        roughness: 0.28,
        envMap: envMap,
        envMapIntensity: 0.8,
        transparent: true,
        opacity: 0.85
      })
    );
    ring2.rotation.x = Math.PI / 2.7;
    ring2.rotation.y = 0.38;
    group.add(ring2);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    scene.add(new THREE.HemisphereLight(0xf4fbff, 0x1a3040, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.55);
    key.position.set(2.8, 3.6, 4.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x4a90a4, 0.55);
    fill.position.set(-3.4, 0.6, -1.8);
    scene.add(fill);
    const spark = new THREE.PointLight(0xffffff, 1.4, 8, 2);
    spark.position.set(1.2, 1.4, 2.2);
    scene.add(spark);
    document.body.classList.add('fun-home--webgl');

    let animationFrameId = null;
    let isPageVisible = true;
    let inView = true;
    const clock = new THREE.Clock();

    document.addEventListener('visibilitychange', () => {
      isPageVisible = !document.hidden;
    });

    if (typeof IntersectionObserver === 'function') {
      const io = new IntersectionObserver(
        (entries) => {
          inView = entries.some((en) => en.isIntersecting);
        },
        { threshold: 0.05 }
      );
      io.observe(container);
    }

    if (typeof gsap !== 'undefined') {
      gsap.from(group.scale, {
        x: isNarrow ? 0.72 : 1.15,
        y: isNarrow ? 0.72 : 1.15,
        z: isNarrow ? 0.72 : 1.15,
        duration: 1.35,
        ease: 'power3.out',
        delay: 0.12
      });
      gsap.from(group.rotation, {
        y: -0.85,
        duration: 1.45,
        ease: 'power2.out',
        delay: 0.08
      });
    }

    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      if (!isPageVisible || !inView) return;
      const elapsed = clock.getElapsedTime();
      orb.rotation.y = elapsed * 0.16;
      orb.rotation.x = Math.sin(elapsed * 0.22) * 0.08;
      facets.rotation.copy(orb.rotation);
      heart.rotation.y = -elapsed * 0.22;
      ring.rotation.z = elapsed * 0.14;
      ring2.rotation.z = -elapsed * 0.09;
      spark.position.x = Math.cos(elapsed * 0.4) * 1.5;
      spark.position.z = 2.1 + Math.sin(elapsed * 0.4) * 0.6;
      group.position.y =
        (isNarrow ? 0.42 : 0.04) + Math.sin(elapsed * 0.5) * 0.07;

      renderer.render(scene, camera);
    }
    animate();

    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        width = container.clientWidth;
        height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 992 ? 1.5 : 2));
        renderer.setSize(width, height);
      }, 100);
    });

    const themeToggle = document.getElementById('funThemeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        setTimeout(() => {
          mats.core.dispose();
          mats.ring.dispose();
          mats.rim.dispose();
          mats.heart.dispose();
          mats = getMaterials();
          orb.material = mats.core;
          ring.material = mats.ring;
          facets.material = mats.rim;
          heart.material = mats.heart;
        }, 50);
      });
    }

    window.addEventListener('pagehide', () => {
      document.body.classList.remove('fun-home--webgl');
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      orbGeom.dispose();
      ringGeom.dispose();
      ring2Geom.dispose();
      edgeGeom.dispose();
      heart.geometry.dispose();
      if (ring2.material) ring2.material.dispose();
      orb.material.dispose();
      ring.material.dispose();
      facets.material.dispose();
      heart.material.dispose();
      if (envMap && envMap.dispose) envMap.dispose();
      renderer.dispose();
    });
  }

  function startHeroWhenReady() {
    if (prefersReducedMotion) return;
    if (typeof THREE !== 'undefined') {
      initHeroScene();
      return;
    }
    let tries = 0;
    const wait = window.setInterval(() => {
      tries += 1;
      if (typeof THREE !== 'undefined') {
        window.clearInterval(wait);
        initHeroScene();
      } else if (tries > 40) {
        window.clearInterval(wait);
      }
    }, 50);
  }

  /** Unit Tests / Condition Manager chips — only when logged in. */
  function syncGatedFeatured() {
    const show = isFunHomeLoggedIn();
    document.querySelectorAll('[data-gated-featured]').forEach((el) => {
      el.hidden = !show;
    });
  }

  function initGatedFeatured() {
    if (!document.querySelector('[data-gated-featured]')) return;
    syncGatedFeatured();
    window.addEventListener('storage', syncGatedFeatured);
    window.addEventListener('user-logged-in', syncGatedFeatured);
    window.addEventListener('user-logged-out', syncGatedFeatured);
    window.addEventListener('pageshow', syncGatedFeatured);
    window.addEventListener('focus', syncGatedFeatured);
  }

  // Initialize everything
  function init() {
    initThemeToggle();
    initCardEffects();
    initSmoothScroll();
    initHeaderScroll();
    updateYear();
    initParallaxSparkles();
    initScrollAnimations();
    initCardOpen();
    initEasterEgg();
    initFunAuthButton();
    initSecretMortgageLink();
    initGatedFeatured();

    startHeroWhenReady();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose theme API for potential external use
  window.FunHome = {
    getTheme: function() {
      return document.body.getAttribute('data-theme');
    },
    setTheme: function(theme) {
      if (theme === 'zen' || theme === 'dark') {
        document.body.setAttribute('data-theme', theme);
        const btn = document.getElementById('funThemeToggle');
        if (btn) {
          const icon = btn.querySelector('i');
          const label = btn.querySelector('span');
          if (theme === 'dark') {
            icon.className = 'bi bi-sun-fill';
            label.textContent = 'Zen';
          } else {
            icon.className = 'bi bi-moon-stars-fill';
            label.textContent = 'Dark';
          }
        }
        try {
          localStorage.setItem(THEME_KEY, theme);
        } catch (_) {}
      }
    }
  };

})();
