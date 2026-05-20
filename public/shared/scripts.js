/**
 * Tool Card Animation and Interaction Scripts
 * 
 * @file       scripts.js
 * @author     David Lane
 * @version    1.0.0
 * @since      2024
 * 
 * @description
 * Provides enhanced animations and interactive effects for tool cards
 * on the main dashboard. Includes staggered card animations, ripple effects
 * on click, and smooth hover transitions for improved user experience.
 * 
 * Features:
 * - Staggered card entrance animations
 * - Ripple effect on card click interactions
 * - Smooth hover transitions
 * - Enhanced visual feedback for user interactions
 * - Zen-style radial gradient ripple effects
 * 
 * Animation Details:
 * - Cards animate in sequence with 120ms delay between each
 * - Ripple effect creates expanding circle on click
 * - Gradient-based visual feedback
 * - CSS transform and opacity transitions
 * 
 * Technical Implementation:
 * - DOMContentLoaded event listener for initialization
 * - Dynamic style injection for ripple effects
 * - Event delegation for card interactions
 * - CSS custom properties for theming
 * 
 * Usage:
 * Automatically initializes when page loads. Targets all elements
 * with '.tool-card' class.
 * 
 * ==============================================================================
 */

const LANE_FAMILY_BODY_CLASSES = [
  'lane-family-hub',
  'lane-magazine-page',
  'lane-trading-cards-page',
  'lane-tools-page',
  'lane-museum-page',
  'lane-war-page',
  'lane-memorial-page',
  'lane-historians-page',
  'lane-occ-page',
  'lane-direct-page',
  'lane-pdf-gallery-root',
  'whai-page',
  'genealogy-import-page',
  'genealogy-tree-page'
];

function isLaneFamilyPage() {
  const body = document.body;
  if (!body) return false;
  return LANE_FAMILY_BODY_CLASSES.some((cls) => body.classList.contains(cls));
}

document.addEventListener('DOMContentLoaded', () => {
  if (isLaneFamilyPage()) return;

  const cards = document.querySelectorAll('.tool-card');
  if (!cards.length) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes zenRipple {
      0% { transform: scale(0); opacity: 0.35; }
      100% { transform: scale(2.2); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  cards.forEach((card) => {
    // Subtle click ripple (sitewide hub cards only)
    card.addEventListener('click', e => {
      const r = document.createElement('div');
      r.style.position='absolute'; r.style.borderRadius='50%';
      r.style.background='radial-gradient(circle, var(--ice-glow) 0%, transparent 70%)'; 
      r.style.transform='scale(0)';
      r.style.animation='zenRipple 0.45s var(--zen-ease)';
      r.style.left=(e.clientX-card.offsetLeft)+'px';
      r.style.top=(e.clientY-card.offsetTop)+'px';
      r.style.width='24px';
      r.style.height='24px';
      r.style.pointerEvents='none';
      r.style.zIndex='10';
      card.appendChild(r);
      setTimeout(()=>r.remove(),450);
    });
  });
});

/** Pages without modern-navbar still get click-to-expand images. */
(function initLaneImageLightboxFallback() {
  function tryInit() {
    if (window.LaneImageLightbox?.bound) return;
    if (document.querySelector('modern-navbar')) return;
    if (!document.querySelector('link[href="/shared/lane-image-lightbox.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/shared/lane-image-lightbox.css';
      document.head.appendChild(link);
    }
    const run = () => window.LaneImageLightbox?.init();
    if (window.LaneImageLightbox) {
      run();
      return;
    }
    const script = document.createElement('script');
    script.src = '/shared/lane-image-lightbox.js';
    script.onload = run;
    document.head.appendChild(script);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }
})();

// ===== UNIVERSAL GOOGLE CLOUD TTS SPEECH FUNCTION =====
// Available to ALL pages in the app!
let currentAudio = null; // Track currently playing audio
let audioUnlocked = false;

function initAudioUnlock() {
  if (audioUnlocked) return;

  const unlock = async () => {
    document.removeEventListener('click', unlock, true);
    document.removeEventListener('touchstart', unlock, true);
    document.removeEventListener('keydown', unlock, true);

    try {
      const unlockAudio = new Audio(
        'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA='
      );
      unlockAudio.volume = 0;
      await unlockAudio.play();
      unlockAudio.pause();
      unlockAudio.currentTime = 0;
      audioUnlocked = true;
    } catch (error) {
      console.warn('Audio unlock skipped:', error);
    }
  };

  document.addEventListener('click', unlock, true);
  document.addEventListener('touchstart', unlock, true);
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAudioUnlock);
} else {
  initAudioUnlock();
}

async function speakWithGoogle(text, voice = 'en-US-Standard-D', options = {}) {
  try {
    // Stop any currently playing speech
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    
    // Call backend Google TTS endpoint
    const response = await fetch('/api/voice/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text, 
        voice,
        pitch: options.pitch || 0,
        speakingRate: options.speakingRate || 1.0
      })
    });
    
    const data = await response.json();
    
    if (data.success && data.audio) {
      // Convert base64 to audio and play
      const audioBlob = base64ToBlob(data.audio, 'audio/mp3');
      const audioUrl = URL.createObjectURL(audioBlob);
      
      currentAudio = new Audio(audioUrl);
      currentAudio.volume = options.volume || 0.8;
      
      // Clean up URL when done
      currentAudio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
      };
      
      try {
        await currentAudio.play();
        audioUnlocked = true;
        return true;
      } catch (playError) {
        console.warn('Audio play blocked; user interaction required.', playError);
        return speakWithBrowser(text, options);
      }
    } else {
      // Fallback to local speech if Google TTS fails
      console.warn('Google TTS not available, using fallback');
      return speakWithBrowser(text, options);
    }
  } catch (error) {
    console.error('Speech error:', error);
    return speakWithBrowser(text, options);
  }
}

// Stop current speech (ONE CLICK!) - handles ALL speech types
function stopSpeech() {
  // Stop Google TTS audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  
  // Stop browser speech synthesis (fallback)
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  console.log('🛑 All speech stopped');
}

// Helper: Convert base64 to Blob
function base64ToBlob(base64, contentType) {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  
  for (let i = 0; i < byteCharacters.length; i += 512) {
    const slice = byteCharacters.slice(i, i + 512);
    const byteNumbers = new Array(slice.length);
    
    for (let j = 0; j < slice.length; j++) {
      byteNumbers[j] = slice.charCodeAt(j);
    }
    
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  
  return new Blob(byteArrays, { type: contentType });
}

function speakWithBrowser(text, options = {}) {
  if (!('speechSynthesis' in window)) {
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.speakingRate || 1.0;
    utterance.pitch = typeof options.pitch === 'number' ? options.pitch : 1.0;
    utterance.volume = typeof options.volume === 'number' ? options.volume : 0.8;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (error) {
    console.error('Browser speech error:', error);
    return false;
  }
}

// Make functions globally available
window.speakWithGoogle = speakWithGoogle;
window.stopSpeech = stopSpeech;
