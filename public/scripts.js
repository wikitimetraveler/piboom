document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.tool-card');
  cards.forEach((card, i) => {
    card.style.animationDelay = `${i * 0.12}s`;
    card.addEventListener('click', e => {
      const r = document.createElement('div');
      r.style.position='absolute'; r.style.borderRadius='50%';
      r.style.background='var(--ice-glow)'; r.style.transform='scale(0)';
      r.style.animation='ripple .6s linear'; r.style.left=(e.clientX-card.offsetLeft)+'px';
      r.style.top=(e.clientY-card.offsetTop)+'px'; r.style.width=r.style.height='20px';
      r.style.pointerEvents='none'; card.appendChild(r); setTimeout(()=>r.remove(),600);
    });
  });

  document.addEventListener('mousemove', (e)=>{
    const mx = e.clientX / window.innerWidth, my = e.clientY / window.innerHeight;
    cards.forEach((card, idx) => {
      const speed = (idx+1)*0.4;
      const x = (mx-0.5)*speed, y=(my-0.5)*speed;
      card.style.transform = `translate(${x}px, ${y}px)`;
    });
  });

  const style = document.createElement('style'); style.textContent = `
    @keyframes ripple{ to{ transform:scale(4); opacity:0; } }
  `; document.head.appendChild(style);
});