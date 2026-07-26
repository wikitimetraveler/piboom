/**
 * Sparkle Fall Effect
 * Animated sparkles falling across the entire page
 * Honors prefers-reduced-motion and pauses when tab is hidden
 */

class SparkleFall {
  constructor(options = {}) {
    this.options = {
      particleCount: options.particleCount || 60,
      colors: options.colors || ['#FFD700', '#FFF', '#FFE4B5', '#FFFFE0', '#F0E68C'],
      minSize: options.minSize || 2,
      maxSize: options.maxSize || 6,
      minSpeed: options.minSpeed || 0.5,
      maxSpeed: options.maxSpeed || 2.5,
      twinkleSpeed: options.twinkleSpeed || 0.05,
      sway: options.sway || 0.3,
      ...options
    };

    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.animationId = null;
    this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isVisible = !document.hidden;

    this.init();
  }

  init() {
    // Don't animate if user prefers reduced motion
    if (this.isReducedMotion) {
      this.renderStaticSparkles();
      return;
    }

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '9999';
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.resize();

    // Create particles
    this.createParticles();

    // Event listeners
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

    // Start animation
    this.animate();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
  }

  createParticles() {
    this.particles = [];
    for (let i = 0; i < this.options.particleCount; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle(respawn = false) {
    const size = this.random(this.options.minSize, this.options.maxSize);
    return {
      x: this.random(0, window.innerWidth),
      y: respawn ? -size : this.random(-window.innerHeight, window.innerHeight),
      size: size,
      speed: this.random(this.options.minSpeed, this.options.maxSpeed),
      color: this.options.colors[Math.floor(Math.random() * this.options.colors.length)],
      opacity: this.random(0.3, 1),
      twinkle: this.random(0, Math.PI * 2),
      swayOffset: this.random(0, Math.PI * 2),
      swayAmplitude: this.random(10, 30)
    };
  }

  random(min, max) {
    return Math.random() * (max - min) + min;
  }

  updateParticle(particle) {
    // Fall down
    particle.y += particle.speed;

    // Sway side to side
    particle.swayOffset += this.options.sway * 0.02;
    const sway = Math.sin(particle.swayOffset) * particle.swayAmplitude;
    particle.x += sway * 0.01;

    // Twinkle
    particle.twinkle += this.options.twinkleSpeed;
    particle.opacity = 0.5 + Math.sin(particle.twinkle) * 0.5;

    // Reset when off screen
    if (particle.y > window.innerHeight + particle.size) {
      const newParticle = this.createParticle(true);
      Object.assign(particle, newParticle);
    }
  }

  drawParticle(particle) {
    this.ctx.save();
    this.ctx.globalAlpha = particle.opacity;
    this.ctx.fillStyle = particle.color;

    // Draw sparkle as a diamond/star shape
    this.ctx.beginPath();
    const x = particle.x;
    const y = particle.y;
    const size = particle.size;

    // 4-pointed star
    this.ctx.moveTo(x, y - size);
    this.ctx.lineTo(x + size * 0.3, y - size * 0.3);
    this.ctx.lineTo(x + size, y);
    this.ctx.lineTo(x + size * 0.3, y + size * 0.3);
    this.ctx.lineTo(x, y + size);
    this.ctx.lineTo(x - size * 0.3, y + size * 0.3);
    this.ctx.lineTo(x - size, y);
    this.ctx.lineTo(x - size * 0.3, y - size * 0.3);
    this.ctx.closePath();
    this.ctx.fill();

    // Add glow
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = particle.color;
    this.ctx.fill();

    this.ctx.restore();
  }

  animate() {
    if (!this.isVisible) return;

    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    this.particles.forEach(particle => {
      this.updateParticle(particle);
      this.drawParticle(particle);
    });

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  handleVisibilityChange() {
    this.isVisible = !document.hidden;
    if (this.isVisible && !this.isReducedMotion) {
      this.animate();
    } else {
      this.pause();
    }
  }

  pause() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  renderStaticSparkles() {
    // For users with prefers-reduced-motion, show a few static sparkles
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9999';
    container.setAttribute('aria-hidden', 'true');

    for (let i = 0; i < 20; i++) {
      const sparkle = document.createElement('div');
      sparkle.style.position = 'absolute';
      sparkle.style.left = this.random(0, 100) + '%';
      sparkle.style.top = this.random(0, 100) + '%';
      sparkle.style.width = '4px';
      sparkle.style.height = '4px';
      sparkle.style.background = this.options.colors[Math.floor(Math.random() * this.options.colors.length)];
      sparkle.style.borderRadius = '50%';
      sparkle.style.opacity = this.random(0.3, 0.7);
      container.appendChild(sparkle);
    }

    document.body.appendChild(container);
  }

  dispose() {
    this.pause();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    window.removeEventListener('resize', () => this.resize());
    document.removeEventListener('visibilitychange', () => this.handleVisibilityChange());
  }
}

// Auto-initialize if data-sparkle-fall attribute exists on body
if (document.body.hasAttribute('data-sparkle-fall')) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.sparkleInstance = new SparkleFall();
    });
  } else {
    window.sparkleInstance = new SparkleFall();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (window.sparkleInstance) {
      window.sparkleInstance.dispose();
    }
  });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SparkleFall;
}
