/**
 * Fun Home — theme toggle, interactions, and 3D hero scene
 */
(function () {
  'use strict';

  const THEME_KEY = 'funHomeTheme';
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
    document.querySelectorAll('a[href="#projects"], .fun-hero__scroll').forEach((el) => {
      el.addEventListener('click', (e) => {
        const projectsSection = document.getElementById('projects') || document.querySelector('.fun-projects');
        if (!projectsSection) return;
        e.preventDefault();
        projectsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
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
          localStorage.setItem('mortgageLinkRevealed', 'true');
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

    // Check if link was previously revealed
    try {
      if (localStorage.getItem('mortgageLinkRevealed') === 'true') {
        secretLink.style.display = 'flex';
      }
    } catch (_) {}
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

  // Three.js Hero Scene — intentional full-bleed orb (dominant visual plane)
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

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(isNarrow ? 42 : 36, width / height, 0.1, 100);
    camera.position.set(0, 0.05, isNarrow ? 5.6 : 4.6);

    const group = new THREE.Group();
    // Desktop: dominate the right half. Narrow: sit behind/above copy.
    group.position.set(isNarrow ? 0.15 : 1.55, isNarrow ? 0.55 : 0.05, 0);
    group.scale.setScalar(isNarrow ? 1.15 : 1.55);
    scene.add(group);

    function getMaterials() {
      const dark = document.body.getAttribute('data-theme') === 'dark';
      const core = new THREE.MeshPhysicalMaterial({
        color: dark ? 0x4a90a4 : 0x5aa3b5,
        emissive: dark ? 0x1a3a44 : 0x2a6070,
        emissiveIntensity: dark ? 0.4 : 0.28,
        metalness: 0.18,
        roughness: 0.32,
        transparent: true,
        opacity: 0.95,
        clearcoat: 0.7,
        clearcoatRoughness: 0.3
      });
      const ring = new THREE.MeshBasicMaterial({
        color: dark ? 0xc9a227 : 0xb8922e,
        transparent: true,
        opacity: 0.62,
        side: THREE.DoubleSide
      });
      return { core, ring };
    }

    const ORB_PALETTE = [0x3d7a8a, 0x10b981, 0x2a9bb0, 0xc9852a, 0xe85a7a];
    let mats = getMaterials();
    const detail = isNarrow ? 0 : 1;
    const orbGeom = new THREE.IcosahedronGeometry(1.15, detail);
    const orb = new THREE.Mesh(orbGeom, mats.core);
    group.add(orb);

    const ringGeom = new THREE.TorusGeometry(1.72, 0.032, 10, isNarrow ? 48 : 72);
    const ring = new THREE.Mesh(ringGeom, mats.ring);
    ring.rotation.x = Math.PI / 2.35;
    group.add(ring);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.05, 0.018, 8, isNarrow ? 40 : 64),
      new THREE.MeshBasicMaterial({
        color: 0x4a90a4,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide
      })
    );
    ring2.rotation.x = Math.PI / 2.8;
    ring2.rotation.y = 0.35;
    group.add(ring2);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xe8f4f8, 1.15);
    key.position.set(3, 4, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x4a90a4, 0.5);
    fill.position.set(-4, 1, -2);
    scene.add(fill);

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
        x: isNarrow ? 0.85 : 1.1,
        y: isNarrow ? 0.85 : 1.1,
        z: isNarrow ? 0.85 : 1.1,
        duration: 1.45,
        ease: 'power3.out',
        delay: 0.15
      });
      gsap.from(group.rotation, {
        y: -0.65,
        duration: 1.5,
        ease: 'power2.out',
        delay: 0.1
      });
    }

    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      if (!isPageVisible || !inView) return;
      const elapsed = clock.getElapsedTime();
      orb.rotation.y = elapsed * 0.2;
      orb.rotation.x = Math.sin(elapsed * 0.32) * 0.14;
      ring.rotation.z = elapsed * 0.16;
      ring2.rotation.z = -elapsed * 0.11;
      group.position.y =
        (isNarrow ? 0.55 : 0.05) + Math.sin(elapsed * 0.65) * 0.1;

      const t = (elapsed * 0.15) % ORB_PALETTE.length;
      const i0 = Math.floor(t);
      const i1 = (i0 + 1) % ORB_PALETTE.length;
      const mix = t - i0;
      const c0 = new THREE.Color(ORB_PALETTE[i0]);
      const c1 = new THREE.Color(ORB_PALETTE[i1]);
      mats.core.color.copy(c0).lerp(c1, mix);
      mats.ring.color.copy(c1).lerp(c0, mix * 0.5);

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
          mats = getMaterials();
          orb.material = mats.core;
          ring.material = mats.ring;
        }, 50);
      });
    }

    window.addEventListener('pagehide', () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      orbGeom.dispose();
      ringGeom.dispose();
      ring2.geometry.dispose();
      if (ring2.material) ring2.material.dispose();
      orb.material.dispose();
      ring.material.dispose();
      renderer.dispose();
    });
  }
  // Enhanced card interactions with GSAP
  function initEnhancedCardEffects() {
    if (typeof gsap === 'undefined' || prefersReducedMotion) return;

    const cards = document.querySelectorAll('.fun-card');
    
    cards.forEach((card, index) => {
      const icon = card.querySelector('.fun-card__icon');
      const links = card.querySelectorAll('.fun-card__link');
      
      // Stagger link animations on card hover
      card.addEventListener('mouseenter', () => {
        gsap.to(links, {
          x: 6,
          stagger: 0.05,
          duration: 0.3,
          ease: 'power2.out'
        });

        gsap.to(icon, {
          scale: 1.15,
          rotation: 5,
          duration: 0.4,
          ease: 'back.out(1.5)'
        });
      });

      card.addEventListener('mouseleave', () => {
        gsap.to(links, {
          x: 0,
          stagger: 0.03,
          duration: 0.3,
          ease: 'power2.in'
        });

        gsap.to(icon, {
          scale: 1,
          rotation: 0,
          duration: 0.4,
          ease: 'power2.inOut'
        });
      });

      // Individual link hover effects
      links.forEach(link => {
        link.addEventListener('mouseenter', () => {
          gsap.to(link, {
            x: 8,
            duration: 0.3,
            ease: 'power2.out'
          });
        });

        link.addEventListener('mouseleave', () => {
          gsap.to(link, {
            x: 6,
            duration: 0.3,
            ease: 'power2.in'
          });
        });
      });
    });
  }

  // QR tiles — absolute URLs so a phone scan opens each site directly
  function absoluteSiteUrl(path) {
    try {
      return new URL(path, window.location.origin).href;
    } catch (_) {
      return path;
    }
  }

  function mountQr(el, url, size) {
    if (!el || !url || typeof window.QRCode !== 'function') return false;
    el.innerHTML = '';
    try {
      // eslint-disable-next-line no-new
      new window.QRCode(el, {
        text: url,
        width: size,
        height: size,
        correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : undefined,
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  function initSiteQrCodes() {
    const tiles = document.querySelectorAll('.fun-scan__tile[data-scan-path]');
    if (!tiles.length) return;

    const paint = () => {
      tiles.forEach((tile) => {
        const path = tile.getAttribute('data-scan-path');
        const mount = tile.querySelector('[data-fun-qr]');
        if (!path || !mount) return;
        const url = absoluteSiteUrl(path);
        tile.setAttribute('href', url);
        tile.setAttribute('title', 'Open ' + url);
        const ok = mountQr(mount, url, 112);
        if (!ok) {
          mount.innerHTML =
            '<span class="fun-scan__qr-fallback"><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></span>';
        }
      });
    };

    if (typeof window.QRCode === 'function') {
      paint();
      return;
    }

    // CDN may still be loading (defer-friendly)
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (typeof window.QRCode === 'function' || tries > 40) {
        clearInterval(timer);
        paint();
      }
    }, 50);
  }

  // Initialize everything
  function init() {
    initThemeToggle();
    initCardEffects();
    initSmoothScroll();
    updateYear();
    initParallaxSparkles();
    initScrollAnimations();
    initCardOpen();
    initEasterEgg();
    initSecretMortgageLink();
    initSiteQrCodes();
    
    // Wait for libraries to load
    if (typeof THREE !== 'undefined') {
      initHeroScene();
    } else {
      window.addEventListener('load', () => {
        setTimeout(initHeroScene, 100);
      });
    }
    
    if (typeof gsap !== 'undefined') {
      initEnhancedCardEffects();
    } else {
      window.addEventListener('load', () => {
        setTimeout(initEnhancedCardEffects, 100);
      });
    }
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
