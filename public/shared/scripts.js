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
      } catch (playError) {
        console.warn('Audio play blocked; user interaction required.', playError);
        return false;
      }
      return true;
    } else {
      // Fallback to local speech if Google TTS fails
      console.warn('Google TTS not available, using fallback');
      return false;
    }
  } catch (error) {
    console.error('Speech error:', error);
    return false;
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

// Make functions globally available
window.speakWithGoogle = speakWithGoogle;
window.stopSpeech = stopSpeech;
