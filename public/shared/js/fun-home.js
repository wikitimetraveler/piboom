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

  /** Desert-sky twinkle field across the full hero top. */
  function initDesertStarfield() {
    const host = document.getElementById('funHeroStars');
    if (!host || host.childElementCount) return;
    const count = window.matchMedia('(max-width: 991.98px)').matches ? 42 : 72;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
      const star = document.createElement('span');
      star.className = 'fun-hero__star';
      const bright = Math.random() > 0.72;
      if (bright) star.classList.add('fun-hero__star--bright');
      if (bright && Math.random() > 0.55) star.classList.add('fun-hero__star--flare');
      star.style.left = (Math.random() * 100).toFixed(2) + '%';
      star.style.top = (Math.random() * 78).toFixed(2) + '%';
      star.style.setProperty('--twinkle-delay', (Math.random() * 5).toFixed(2) + 's');
      star.style.setProperty('--twinkle-dur', (2.2 + Math.random() * 3.8).toFixed(2) + 's');
      frag.appendChild(star);
    }
    host.appendChild(frag);
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

  // Three.js Hero Scene — cinematic zen glass crystal
  function makeZenEnvMap(renderer) {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.HemisphereLight(0xffffff, 0x102028, 1.8));
    envScene.add(new THREE.AmbientLight(0xf4fbff, 0.45));
    const panels = [
      { color: 0xffffff, pos: [0, 8, 1], scale: 10 },
      { color: 0xe8f4f8, pos: [-6, 5, 4], scale: 7 },
      { color: 0x4a90a4, pos: [7, 2, 3], scale: 8 },
      { color: 0xc8ab57, pos: [-5, 1, 6], scale: 6 },
      { color: 0x7ec8b8, pos: [3, -5, 5], scale: 7 },
      { color: 0xd8eef4, pos: [0, 2, -8], scale: 9 },
      { color: 0xfff6d6, pos: [5, 6, -3], scale: 5 }
    ];
    panels.forEach((p) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(p.scale, p.scale),
        new THREE.MeshBasicMaterial({ color: p.color, side: THREE.DoubleSide })
      );
      mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
      mesh.lookAt(0, 0, 0);
      envScene.add(mesh);
    });
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(envScene, 0.02).texture;
    pmrem.dispose();
    return envTex;
  }

  function initHeroScene() {
    if (typeof THREE === 'undefined') return;

    const canvas = document.getElementById('heroCanvas');
    if (!canvas) return;

    const stage = canvas.parentElement;
    const hero = canvas.closest('.fun-hero') || stage;
    let width = stage.clientWidth || 420;
    let height = stage.clientHeight || 420;
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
    renderer.toneMappingExposure = 1.42;

    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 40);
    camera.position.set(0, 0.05, 5.4);

    const envMap = makeZenEnvMap(renderer);

    const group = new THREE.Group();
    group.position.set(0, 0, 0);
    group.scale.setScalar(1);
    scene.add(group);

    function getMaterials() {
      const dark = document.body.getAttribute('data-theme') === 'dark';
      const core = new THREE.MeshStandardMaterial({
        color: dark ? 0x6eb3c4 : 0x8ec5d4,
        metalness: 0.42,
        roughness: 0.18,
        envMap: envMap,
        envMapIntensity: dark ? 1.8 : 1.45,
        flatShading: true,
        emissive: dark ? 0x163844 : 0x2a6070,
        emissiveIntensity: 0.35
      });
      const glass = new THREE.MeshPhysicalMaterial({
        color: dark ? 0xc5e6ee : 0xeef8fb,
        metalness: 0.05,
        roughness: 0.06,
        transmission: 0.42,
        thickness: 1.1,
        ior: 1.45,
        transparent: true,
        opacity: 0.55,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        envMap: envMap,
        envMapIntensity: dark ? 1.6 : 1.3
      });
      const ring = new THREE.MeshStandardMaterial({
        color: dark ? 0xf0d478 : 0xc8ab57,
        metalness: 1,
        roughness: 0.16,
        envMap: envMap,
        envMapIntensity: 1.35
      });
      const ice = new THREE.MeshStandardMaterial({
        color: dark ? 0xb7e0ea : 0x9fd0dc,
        metalness: 0.72,
        roughness: 0.18,
        envMap: envMap,
        envMapIntensity: 1.05
      });
      const rim = new THREE.LineBasicMaterial({
        color: dark ? 0xf4fbff : 0xffffff,
        transparent: true,
        opacity: dark ? 0.55 : 0.48
      });
      const heart = new THREE.MeshStandardMaterial({
        color: dark ? 0x1f5a68 : 0x3d8fa4,
        emissive: dark ? 0x5aa3b5 : 0x7eb8c6,
        emissiveIntensity: dark ? 1.35 : 0.95,
        roughness: 0.28,
        metalness: 0.15
      });
      const halo = new THREE.MeshBasicMaterial({
        color: dark ? 0x4a90a4 : 0x8ec5d4,
        transparent: true,
        opacity: dark ? 0.16 : 0.13,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide
      });
      const sparkle = new THREE.PointsMaterial({
        color: dark ? 0xf4fbff : 0xffffff,
        size: isNarrow ? 0.045 : 0.038,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      });
      const shard = new THREE.MeshPhysicalMaterial({
        color: dark ? 0xc8ab57 : 0xe8d48a,
        metalness: 0.85,
        roughness: 0.12,
        transmission: 0.35,
        thickness: 0.4,
        envMap: envMap,
        envMapIntensity: 1.2,
        clearcoat: 0.8
      });
      return { core, glass, ring, ice, rim, heart, halo, sparkle, shard };
    }

    let mats = getMaterials();
    const orbGeom = new THREE.IcosahedronGeometry(1.12, 0);
    const orb = new THREE.Mesh(orbGeom, mats.core);
    group.add(orb);

    const glassGeom = new THREE.IcosahedronGeometry(1.2, 1);
    const glassShell = new THREE.Mesh(glassGeom, mats.glass);
    group.add(glassShell);

    const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), mats.heart);
    group.add(heart);

    const edgeGeom = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.08, 0), 1);
    const facets = new THREE.LineSegments(edgeGeom, mats.rim);
    group.add(facets);

    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.55, 40, 40), mats.halo);
    group.add(halo);

    const ringGeom = new THREE.TorusGeometry(1.38, 0.038, 14, isNarrow ? 64 : 96);
    const ring = new THREE.Mesh(ringGeom, mats.ring);
    ring.rotation.x = Math.PI / 2.2;
    group.add(ring);

    const ring2Geom = new THREE.TorusGeometry(1.58, 0.016, 12, isNarrow ? 48 : 80);
    const ring2 = new THREE.Mesh(ring2Geom, mats.ice);
    ring2.rotation.x = Math.PI / 2.85;
    ring2.rotation.y = 0.55;
    group.add(ring2);

    const ring3Geom = new THREE.TorusGeometry(1.76, 0.01, 10, isNarrow ? 40 : 64);
    const ring3 = new THREE.Mesh(ring3Geom, mats.ring.clone());
    ring3.material.opacity = 0.85;
    ring3.material.transparent = true;
    ring3.rotation.x = Math.PI / 1.7;
    ring3.rotation.z = 0.4;
    group.add(ring3);

    const shardGeom = new THREE.OctahedronGeometry(0.09, 0);
    const shards = new THREE.Group();
    const shardCount = isNarrow ? 6 : 10;
    for (let i = 0; i < shardCount; i++) {
      const shard = new THREE.Mesh(shardGeom, mats.shard);
      const a = (i / shardCount) * Math.PI * 2;
      shard.position.set(Math.cos(a) * 1.62, Math.sin(a * 1.7) * 0.22, Math.sin(a) * 1.62);
      shard.userData.angle = a;
      shards.add(shard);
    }
    group.add(shards);

    const sparkCount = isNarrow ? 40 : 96;
    const sparkPos = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount; i++) {
      const r = 1.35 + Math.random() * 0.55;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      sparkPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      sparkPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      sparkPos[i * 3 + 2] = r * Math.cos(phi);
    }
    const sparkGeom = new THREE.BufferGeometry();
    sparkGeom.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkles = new THREE.Points(sparkGeom, mats.sparkle);
    group.add(sparkles);

    scene.add(new THREE.AmbientLight(0xffffff, 0.28));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x152028, 0.95));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(3.2, 4.2, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x4a90a4, 0.7);
    fill.position.set(-4, 0.8, -2);
    scene.add(fill);
    const rimLight = new THREE.DirectionalLight(0xc8ab57, 0.85);
    rimLight.position.set(-2.5, 3.2, -4);
    scene.add(rimLight);
    const spark = new THREE.PointLight(0xffffff, 2.2, 10, 2);
    spark.position.set(1.4, 1.6, 2.4);
    scene.add(spark);
    const coreLight = new THREE.PointLight(0x7eb8c6, 1.6, 6, 2);
    group.add(coreLight);

    renderer.render(scene, camera);
    document.body.classList.add('fun-home--webgl');

    let animationFrameId = null;
    let isPageVisible = true;
    let inView = true;
    const sync =
      (window.WebGpuGlobe && typeof window.WebGpuGlobe.ensureHeroSync === 'function'
        ? window.WebGpuGlobe.ensureHeroSync()
        : null) ||
      (window.FunHomeHeroSync =
        window.FunHomeHeroSync || {
          t0: performance.now(),
          spinRate: 0.18,
          lookX: 0,
          lookY: 0,
          targetX: 0,
          targetY: 0,
        });
    let parallaxX = 0;
    let parallaxY = 0;

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
      io.observe(stage);
    }

    const onPointerMove = (e) => {
      const rect = hero.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      sync.targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.35;
      sync.targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.22;
    };
    hero.addEventListener('pointermove', onPointerMove);

    const onHeroActivate = (e) => {
      if (e.target.closest('a, button, details, summary')) return;
      const crystal = document.getElementById('heroCrystalPane');
      if (crystal) crystal.click();
    };
    hero.addEventListener('click', onHeroActivate);

    if (typeof gsap !== 'undefined') {
      const startScale = 0.72;
      gsap.from(group.scale, {
        x: startScale,
        y: startScale,
        z: startScale,
        duration: 1.55,
        ease: 'power3.out',
        delay: 0.08
      });
    }

    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      if (!isPageVisible || !inView) return;
      if (!prefersReducedMotion) {
      const elapsed = (performance.now() - sync.t0) / 1000;
      const spin = sync.spinRate || 0.18;
      sync.lookX += (sync.targetX - sync.lookX) * 0.06;
      sync.lookY += (sync.targetY - sync.lookY) * 0.06;
      parallaxX = sync.lookX;
      parallaxY = sync.lookY;

      orb.rotation.y = elapsed * spin;
      orb.rotation.x = Math.sin(elapsed * 0.2) * 0.12;
      glassShell.rotation.copy(orb.rotation);
      facets.rotation.copy(orb.rotation);
      heart.rotation.y = -elapsed * 0.55;
      heart.rotation.z = elapsed * 0.2;
      ring.rotation.z = elapsed * 0.16;
      ring2.rotation.z = -elapsed * 0.11;
      ring3.rotation.y = elapsed * 0.09;
      sparkles.rotation.y = elapsed * 0.05;
      halo.scale.setScalar(1 + Math.sin(elapsed * 1.4) * 0.03);

      shards.children.forEach((shard, i) => {
        const a = shard.userData.angle + elapsed * 0.35;
        shard.position.set(Math.cos(a) * 1.62, Math.sin(a * 1.7 + elapsed) * 0.22, Math.sin(a) * 1.62);
        shard.rotation.x = elapsed * 0.8 + i;
        shard.rotation.y = elapsed * 1.1;
      });

      spark.position.x = Math.cos(elapsed * 0.55) * 1.15;
      spark.position.y = 0.9 + Math.sin(elapsed * 0.7) * 0.35;
      spark.position.z = 1.6 + Math.sin(elapsed * 0.55) * 0.4;

      group.position.x = parallaxX * 0.18;
      group.position.y = Math.sin(elapsed * 0.55) * 0.04 - parallaxY * 0.14;
      group.rotation.x = parallaxY * 0.18;
      group.rotation.y = parallaxX * 0.22;
      }

      renderer.render(scene, camera);
    }
    animate();

    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        width = stage.clientWidth || 420;
        height = stage.clientHeight || 420;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 992 ? 1.5 : 2));
        renderer.setSize(width, height);
      }, 100);
    });

    const themeToggle = document.getElementById('funThemeToggle');
    const onTheme = () => {
      setTimeout(() => {
        mats.core.dispose();
        mats.glass.dispose();
        mats.ring.dispose();
        mats.ice.dispose();
        mats.rim.dispose();
        mats.heart.dispose();
        mats.halo.dispose();
        mats.sparkle.dispose();
        mats.shard.dispose();
        if (ring3.material) ring3.material.dispose();
        mats = getMaterials();
        orb.material = mats.core;
        glassShell.material = mats.glass;
        ring.material = mats.ring;
        ring2.material = mats.ice;
        ring3.material = mats.ring.clone();
        ring3.material.transparent = true;
        ring3.material.opacity = 0.85;
        facets.material = mats.rim;
        heart.material = mats.heart;
        halo.material = mats.halo;
        sparkles.material = mats.sparkle;
        shards.children.forEach((s) => {
          s.material = mats.shard;
        });
      }, 50);
    };
    if (themeToggle) themeToggle.addEventListener('click', onTheme);

    window.addEventListener('pagehide', () => {
      document.body.classList.remove('fun-home--webgl');
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      hero.removeEventListener('pointermove', onPointerMove);
      hero.removeEventListener('click', onHeroActivate);
      orbGeom.dispose();
      glassGeom.dispose();
      ringGeom.dispose();
      ring2Geom.dispose();
      ring3Geom.dispose();
      edgeGeom.dispose();
      shardGeom.dispose();
      sparkGeom.dispose();
      heart.geometry.dispose();
      halo.geometry.dispose();
      if (ring3.material) ring3.material.dispose();
      orb.material.dispose();
      glassShell.material.dispose();
      ring.material.dispose();
      ring2.material.dispose();
      facets.material.dispose();
      heart.material.dispose();
      halo.material.dispose();
      sparkles.material.dispose();
      mats.shard.dispose();
      if (envMap && envMap.dispose) envMap.dispose();
      renderer.dispose();
    });
  }

  function startThreeHero() {
    const boot = () => {
      try {
        initHeroScene();
      } catch (err) {
        console.warn('Hero crystal failed', err);
        document.body.classList.remove('fun-home--webgl');
      }
    };
    if (typeof THREE !== 'undefined') {
      window.requestAnimationFrame(boot);
      return;
    }
    const script = document.createElement('script');
    script.src = '/vendor/three.r160.min.js';
    script.onload = () => window.requestAnimationFrame(boot);
    script.onerror = () => console.warn('Three.js failed to load');
    document.head.appendChild(script);
  }

  function initGlobeEnlarge(mounts) {
    const panes = document.querySelectorAll('.fun-hero__pane--planet, .fun-hero__pane--crystal');
    if (!panes.length) return;
    const crater =
      (window.WebGpuGlobe && window.WebGpuGlobe.LANE_CRATER) || {
        lat: -9.5,
        lon: 132.36,
      };

    panes.forEach((pane) => {
      pane.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const body = pane.getAttribute('data-body');
        const already = pane.classList.contains('is-enlarged');
        const moonApi = mounts && mounts.moon;
        const moonZoomed = moonApi && moonApi._laneZoomed;

        panes.forEach((other) => other.classList.remove('is-enlarged'));
        pane.classList.add('is-enlarged');
        window.dispatchEvent(new Event('resize'));

        if (body !== 'moon' || !moonApi) return;
        if (already && moonZoomed) {
          if (typeof moonApi.clearLook === 'function') moonApi.clearLook();
          moonApi._laneZoomed = false;
          return;
        }
        if (typeof moonApi.lookAt === 'function') {
          moonApi.lookAt(crater.lat, crater.lon, 2.35);
          moonApi._laneZoomed = true;
        }
      });
    });
  }

  /** Apply compressed radius scale + ring pane class from WebGpuGlobe.BODIES. */
  function applyPlanetScales(Globe) {
    if (!Globe || typeof Globe.resolveBody !== 'function') return;
    const ids = Globe.HERO_BODIES || [];
    ids.forEach((id) => {
      const spec = Globe.resolveBody(id);
      const pane = document.getElementById(spec.paneId || '');
      if (!pane) return;
      const scale =
        typeof Globe.visualScale === 'function'
          ? Globe.visualScale(spec.radiusKm)
          : 1;
      pane.style.setProperty('--planet-scale', String(scale));
      pane.setAttribute('data-scale', String(scale));
      if (spec.rings) pane.classList.add('fun-hero__pane--ringed');
      else pane.classList.remove('fun-hero__pane--ringed');
    });
  }

  function ensureHeroSunGlow() {
    const stage = document.querySelector('.fun-hero__stage');
    if (!stage || stage.querySelector('.fun-hero__sun')) return;
    const sun = document.createElement('div');
    sun.className = 'fun-hero__sun';
    sun.setAttribute('aria-hidden', 'true');
    stage.insertBefore(sun, stage.firstChild);
  }

  async function startNasaGlobe() {
    document.body.classList.add('fun-home--solar-system');
    ensureHeroSunGlow();

    const Globe = window.WebGpuGlobe;
    const mounts = {};
    applyPlanetScales(Globe);
    initGlobeEnlarge(mounts);
    if (!Globe || !window.WebGpuRuntime) return;

    if (typeof Globe.ensureHeroSync === 'function') {
      const sync = Globe.ensureHeroSync();
      if (Globe.DEFAULT_SUN_DIR) sync.sunDir = { ...Globe.DEFAULT_SUN_DIR };
    }

    const ids = Globe.HERO_BODIES || ['earth', 'moon', 'mars'];
    try {
      for (let i = 0; i < ids.length; i += 1) {
        const spec = typeof Globe.resolveBody === 'function' ? Globe.resolveBody(ids[i]) : { id: ids[i] };
        const canvas = document.getElementById(spec.canvasId || '');
        const pane = document.getElementById(spec.paneId || '');
        if (pane) pane.hidden = false;
        if (!canvas) continue;
        const mounted = await Globe.mount({
          canvas: canvas,
          body: spec.id || ids[i],
          getNight: () => document.body.getAttribute('data-theme') === 'dark',
          prefersReducedMotion: prefersReducedMotion,
        });
        if (mounted && typeof mounted.resize === 'function') mounted.resize();
        if (mounted) mounts[spec.id || ids[i]] = mounted;
      }
      window.dispatchEvent(new Event('resize'));
    } catch (err) {
      console.warn('WebGPU NASA globe failed', err);
    }
  }

  function startHeroWhenReady() {
    startThreeHero();
    startNasaGlobe();
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
    initDesertStarfield();
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
