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
      
      if (theme === 'dark') {
        icon.className = 'bi bi-moon-stars-fill';
        label.textContent = 'Dark';
      } else {
        icon.className = 'bi bi-sun-fill';
        label.textContent = 'Zen';
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

  // Smooth scroll for hero scroll indicator
  function initSmoothScroll() {
    const scrollIndicator = document.querySelector('.fun-hero__scroll');
    if (!scrollIndicator) return;

    scrollIndicator.addEventListener('click', () => {
      const projectsSection = document.querySelector('.fun-projects');
      if (projectsSection) {
        projectsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
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

  // Keyboard navigation enhancement
  function initKeyboardNav() {
    const cards = document.querySelectorAll('.fun-card');
    
    cards.forEach(card => {
      const links = card.querySelectorAll('.fun-card__link');
      
      // Make card focusable
      if (links.length > 0) {
        card.setAttribute('tabindex', '0');
        
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            links[0].click();
          }
        });
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

  // Three.js Hero Scene
  function initHeroScene() {
    if (typeof THREE === 'undefined' || prefersReducedMotion) return;

    const canvas = document.getElementById('heroCanvas');
    if (!canvas) return;

    const container = canvas.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);

    // Setup scene and camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 0, 8);

    // Create geometric group
    const group = new THREE.Group();
    scene.add(group);

    // Materials for different theme
    function getMaterial() {
      const theme = document.body.getAttribute('data-theme');
      if (theme === 'dark') {
        return new THREE.MeshPhongMaterial({
          color: 0x8b5cf6,
          emissive: 0x4c1d95,
          emissiveIntensity: 0.3,
          shininess: 100,
          transparent: true,
          opacity: 0.85
        });
      } else {
        return new THREE.MeshPhongMaterial({
          color: 0x10b981,
          emissive: 0x065f46,
          emissiveIntensity: 0.2,
          shininess: 80,
          transparent: true,
          opacity: 0.9
        });
      }
    }

    // Create main geometry - torus knot
    const geometry1 = new THREE.TorusKnotGeometry(1, 0.3, 100, 16);
    const mesh1 = new THREE.Mesh(geometry1, getMaterial());
    mesh1.position.set(-1.5, 0.5, 0);
    group.add(mesh1);

    // Create secondary geometry - octahedron
    const geometry2 = new THREE.OctahedronGeometry(0.8, 0);
    const mesh2 = new THREE.Mesh(geometry2, getMaterial());
    mesh2.position.set(1.5, -0.5, -1);
    group.add(mesh2);

    // Create tertiary geometry - dodecahedron
    const geometry3 = new THREE.DodecahedronGeometry(0.6, 0);
    const mesh3 = new THREE.Mesh(geometry3, getMaterial());
    mesh3.position.set(0, -1.5, 1);
    group.add(mesh3);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0x8b5cf6, 1);
    directionalLight1.position.set(5, 5, 5);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0x10b981, 0.6);
    directionalLight2.position.set(-5, 3, -5);
    scene.add(directionalLight2);

    const pointLight = new THREE.PointLight(0x06b6d4, 1, 10);
    pointLight.position.set(0, 2, 3);
    scene.add(pointLight);

    // Animation state
    let animationFrameId = null;
    let isPageVisible = true;
    const clock = new THREE.Clock();

    // Handle page visibility
    document.addEventListener('visibilitychange', () => {
      isPageVisible = !document.hidden;
    });

    // Entrance animation with GSAP
    if (typeof gsap !== 'undefined') {
      gsap.from(group.position, {
        y: 3,
        duration: 1.5,
        ease: 'power3.out',
        delay: 0.3
      });

      gsap.from(group.rotation, {
        x: -Math.PI / 2,
        duration: 1.2,
        ease: 'power2.out',
        delay: 0.3
      });

      gsap.from(group.scale, {
        x: 0.5,
        y: 0.5,
        z: 0.5,
        duration: 1.2,
        ease: 'back.out(1.5)',
        delay: 0.5
      });
    }

    // Animation loop
    function animate() {
      if (!isPageVisible) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Rotate geometries
      mesh1.rotation.x += delta * 0.3;
      mesh1.rotation.y += delta * 0.2;
      
      mesh2.rotation.x += delta * 0.4;
      mesh2.rotation.z += delta * 0.3;
      
      mesh3.rotation.y += delta * 0.5;
      mesh3.rotation.z += delta * 0.2;

      // Gentle group rotation
      group.rotation.y = Math.sin(elapsed * 0.2) * 0.1;
      group.rotation.x = Math.cos(elapsed * 0.15) * 0.05;

      // Floating animation
      mesh1.position.y = 0.5 + Math.sin(elapsed * 0.8) * 0.2;
      mesh2.position.y = -0.5 + Math.cos(elapsed * 0.6) * 0.15;
      mesh3.position.y = -1.5 + Math.sin(elapsed * 0.7) * 0.1;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    }

    animate();

    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      }, 100);
    });

    // Handle theme change
    const themeToggle = document.getElementById('funThemeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        setTimeout(() => {
          const newMaterial = getMaterial();
          mesh1.material.dispose();
          mesh2.material.dispose();
          mesh3.material.dispose();
          mesh1.material = newMaterial;
          mesh2.material = newMaterial.clone();
          mesh3.material = newMaterial.clone();
        }, 50);
      });
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      geometry1.dispose();
      geometry2.dispose();
      geometry3.dispose();
      mesh1.material.dispose();
      mesh2.material.dispose();
      mesh3.material.dispose();
      renderer.dispose();
    });

    // Mouse interaction - subtle parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    document.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    function updateMouseParallax() {
      targetX += (mouseX * 0.5 - targetX) * 0.05;
      targetY += (mouseY * 0.3 - targetY) * 0.05;
      
      group.rotation.y += (targetX - group.rotation.y) * 0.05;
      group.rotation.x += (targetY - group.rotation.x) * 0.05;

      requestAnimationFrame(updateMouseParallax);
    }

    updateMouseParallax();
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

  // Initialize everything
  function init() {
    initThemeToggle();
    initCardEffects();
    initSmoothScroll();
    updateYear();
    initParallaxSparkles();
    initScrollAnimations();
    initKeyboardNav();
    initEasterEgg();
    initSecretMortgageLink();
    
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
            icon.className = 'bi bi-moon-stars-fill';
            label.textContent = 'Dark';
          } else {
            icon.className = 'bi bi-sun-fill';
            label.textContent = 'Zen';
          }
        }
        try {
          localStorage.setItem(THEME_KEY, theme);
        } catch (_) {}
      }
    }
  };

})();
