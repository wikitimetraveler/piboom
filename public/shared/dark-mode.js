/**
 * Dark Mode Toggle System
 * 
 * @file       dark-mode.js
 * @author     David Lane
 * @version    1.0.0
 * @since      2024
 * 
 * @description
 * Global dark mode toggle system that saves user preference and applies
 * dark mode styling across all pages in the application. Uses localStorage
 * to persist the user's preference and automatically applies dark mode on
 * page load if previously enabled.
 * 
 * Features:
 * - Persistent dark mode preference via localStorage
 * - Automatic application on page load
 * - Toggle button for manual switching
 * - Custom CSS variable support for theme colors
 * - Smooth transitions between light and dark modes
 * 
 * Usage:
 * - Automatically initializes when script is loaded
 * - Dark mode preference key: 'piBoom_darkMode'
 * - Applies 'dark-mode' class to body element
 * 
 * Technical Implementation:
 * - Uses CSS custom properties (variables) for theming
 * - Injects dark mode styles into document head
 * - Event listeners for toggle functionality
 * - localStorage API for persistence
 * 
 * ==============================================================================
 */

const DARK_MODE_KEY = 'piBoom_darkMode';

// CSS for dark mode
const darkModeStyles = `
  body.dark-mode {
    --bg-primary: #1a1a2e;
    --bg-secondary: #16213e;
    --text-primary: #eee;
    --text-secondary: #bbb;
    --muted: #888;
    --border: rgba(255, 255, 255, 0.1);
    --ice-primary: #667eea;
    --ice-secondary: #764ba2;
    --ice-light: rgba(102, 126, 234, 0.1);
    --ice-glow: rgba(102, 126, 234, 0.3);
    background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
    color: var(--text-primary);
  }
  
  body.dark-mode .navbar,
  body.dark-mode .modern-navbar {
    background: rgba(26, 26, 46, 0.95) !important;
    border-bottom-color: rgba(102, 126, 234, 0.3);
  }
  
  body.dark-mode .tool-card {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(102, 126, 234, 0.2);
    color: var(--text-primary);
  }
  
  body.dark-mode .tool-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--ice-primary);
  }
  
  body.dark-mode .tool-card h3,
  body.dark-mode .tool-card p {
    color: var(--text-primary);
  }
  
  body.dark-mode .premium-accordion .card {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(102, 126, 234, 0.2);
  }
  
  body.dark-mode .premium-accordion .card-header {
    background: rgba(102, 126, 234, 0.1);
  }
  
  body.dark-mode .card-body {
    background: rgba(255, 255, 255, 0.03);
  }
  
  body.dark-mode .dropdown-menu {
    background: rgba(26, 26, 46, 0.98);
    border-color: rgba(102, 126, 234, 0.3);
  }
  
  body.dark-mode .dropdown-item {
    color: var(--text-secondary);
  }
  
  body.dark-mode .dropdown-item:hover {
    background: rgba(102, 126, 234, 0.2);
    color: white;
  }
  
  body.dark-mode .footer {
    background: linear-gradient(135deg, #0f0c29, #302b63);
    border-top-color: rgba(102, 126, 234, 0.3);
  }
  
  body.dark-mode .user-selector {
    background: rgba(255, 255, 255, 0.05) !important;
    border-color: rgba(102, 126, 234, 0.3) !important;
  }
  
  /* Dark mode toggle button */
  .dark-mode-toggle {
    position: fixed;
    bottom: 100px;
    right: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    border: none;
    color: white;
    cursor: pointer;
    z-index: 999;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
  }
  
  .dark-mode-toggle:hover {
    transform: scale(1.1) rotate(15deg);
    box-shadow: 0 6px 25px rgba(102, 126, 234, 0.6);
  }
  
  .dark-mode-toggle:active {
    transform: scale(0.95);
  }
`;

// Initialize dark mode
function initDarkMode() {
  // Add dark mode styles to page
  const styleEl = document.createElement('style');
  styleEl.id = 'darkModeStyles';
  styleEl.textContent = darkModeStyles;
  document.head.appendChild(styleEl);
  
  // Check saved preference
  const isDark = localStorage.getItem(DARK_MODE_KEY) === 'true';
  if (isDark) {
    document.body.classList.add('dark-mode');
  }
  
  // Create toggle button
  createDarkModeToggle();
}

// Create dark mode toggle button
function createDarkModeToggle() {
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'dark-mode-toggle';
  toggleBtn.innerHTML = '<i class="bi-moon-stars-fill"></i>';
  toggleBtn.title = 'Toggle Dark Mode';
  toggleBtn.onclick = toggleDarkMode;
  
  // Update icon based on current mode
  updateToggleIcon(toggleBtn);
  
  document.body.appendChild(toggleBtn);
}

// Toggle dark mode
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem(DARK_MODE_KEY, isDark);
  
  // Update toggle icon
  const toggleBtn = document.querySelector('.dark-mode-toggle');
  updateToggleIcon(toggleBtn);
  
  // Smooth transition
  document.body.style.transition = 'all 0.3s ease';
  setTimeout(() => {
    document.body.style.transition = '';
  }, 300);
}

// Update toggle icon
function updateToggleIcon(toggleBtn) {
  const isDark = document.body.classList.contains('dark-mode');
  toggleBtn.innerHTML = isDark ? 
    '<i class="bi-sun-fill"></i>' : 
    '<i class="bi-moon-stars-fill"></i>';
}

// Auto-initialize on page load
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDarkMode);
  } else {
    initDarkMode();
  }
}

// Export functions
window.initDarkMode = initDarkMode;
window.toggleDarkMode = toggleDarkMode;


