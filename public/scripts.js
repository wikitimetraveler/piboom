document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.tool-card');
  cards.forEach((card, i) => {
    card.style.animationDelay = `${i * 0.12}s`;
    
    // Enhanced click interaction with zen ripple
    card.addEventListener('click', e => {
      const r = document.createElement('div');
      r.style.position='absolute'; r.style.borderRadius='50%';
      r.style.background='radial-gradient(circle, var(--ice-glow) 0%, transparent 70%)'; 
      r.style.transform='scale(0)';
      r.style.animation='zenRipple .8s var(--zen-ease)'; 
      r.style.left=(e.clientX-card.offsetLeft)+'px';
      r.style.top=(e.clientY-card.offsetTop)+'px'; 
      r.style.width=r.style.height='30px';
      r.style.pointerEvents='none'; 
      r.style.zIndex='10';
      card.appendChild(r); 
      setTimeout(()=>r.remove(),800);
    });

    // Zen hover effects
    card.addEventListener('mouseenter', () => {
      card.style.animationPlayState = 'paused';
      card.querySelector('.card-icon').style.animationPlayState = 'paused';
    });

    card.addEventListener('mouseleave', () => {
      card.style.animationPlayState = 'running';
      card.querySelector('.card-icon').style.animationPlayState = 'running';
    });
  });

  // Enhanced zen mouse movement with smoother, more subtle effects
  document.addEventListener('mousemove', (e)=>{
    const mx = e.clientX / window.innerWidth, my = e.clientY / window.innerHeight;
    cards.forEach((card, idx) => {
      const speed = (idx+1)*0.05; // Much reduced speed to prevent layout issues
      const x = (mx-0.5)*speed, y=(my-0.5)*speed;
      const rotation = (mx-0.5)*0.1; // Very subtle rotation
      card.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
      card.style.transition = 'transform 0.1s var(--zen-ease)';
    });
  });

  const style = document.createElement('style'); style.textContent = `
    @keyframes ripple{ to{ transform:scale(4); opacity:0; } }
    @keyframes zenRipple{ 
      0%{ transform:scale(0); opacity:0.8; }
      50%{ transform:scale(1.5); opacity:0.4; }
      100%{ transform:scale(3); opacity:0; }
    }
  `; document.head.appendChild(style);
});