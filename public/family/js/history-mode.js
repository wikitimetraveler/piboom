function initHistoryQuickNav(options = {}) {
  const selector = options.selector || '.history-quick-link[href^="#"]';
  const links = Array.from(document.querySelectorAll(selector));
  if (!links.length) return;

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  links.forEach((link) => {
    link.setAttribute('aria-current', 'false');
    link.addEventListener('click', (event) => {
      const hash = link.getAttribute('href');
      const target = hash ? document.querySelector(hash) : null;
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      setActiveLink(link);
    });
  });

  const sectionMap = links
    .map((link) => {
      const hash = link.getAttribute('href');
      const target = hash ? document.querySelector(hash) : null;
      return target ? { link, target } : null;
    })
    .filter(Boolean);
  if (!sectionMap.length) return;

  function setActiveLink(activeLink) {
    sectionMap.forEach(({ link }) => {
      const isActive = link === activeLink;
      link.classList.toggle('is-active', isActive);
      link.setAttribute('aria-current', isActive ? 'location' : 'false');
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const match = sectionMap.find(({ target }) => target === entry.target);
        if (match) setActiveLink(match.link);
      });
    },
    { rootMargin: '-30% 0px -60% 0px', threshold: 0.01 }
  );

  sectionMap.forEach(({ target }) => observer.observe(target));
  setActiveLink(sectionMap[0].link);
}
