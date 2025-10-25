// Quick Actions Floating Menu (FAB)
// Always accessible shortcuts to common actions

const quickActionsHTML = `
<style>
  .fab-menu {
    position: fixed;
    bottom: 170px;
    right: 20px;
    z-index: 998;
  }
  
  .fab-main {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    border: none;
    color: white;
    cursor: pointer;
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    position: relative;
  }
  
  .fab-main:hover {
    transform: scale(1.1);
    box-shadow: 0 8px 30px rgba(102, 126, 234, 0.6);
  }
  
  .fab-main.active {
    transform: rotate(45deg);
  }
  
  .fab-actions {
    position: absolute;
    bottom: 70px;
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    opacity: 0;
    pointer-events: none;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .fab-actions.show {
    opacity: 1;
    pointer-events: all;
    bottom: 75px;
  }
  
  .fab-action {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: white;
    border: 2px solid #667eea;
    color: #667eea;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    position: relative;
  }
  
  .fab-action:hover {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    transform: scale(1.1);
  }
  
  .fab-action-label {
    position: absolute;
    right: 60px;
    white-space: nowrap;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.85rem;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }
  
  .fab-action:hover .fab-action-label {
    opacity: 1;
  }
  
  /* Dark mode support */
  body.dark-mode .fab-action {
    background: rgba(255, 255, 255, 0.1);
    border-color: #667eea;
    color: #667eea;
  }
  
  body.dark-mode .fab-action:hover {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
  }
</style>

<div class="fab-menu" id="fabMenu">
  <div class="fab-actions" id="fabActions">
    <button class="fab-action" onclick="window.location.href='/album-discovery.html'" title="Discover Albums">
      <i class="bi-disc"></i>
      <span class="fab-action-label">Discover Albums</span>
    </button>
    <button class="fab-action" onclick="window.location.href='/music-research.html'" title="Research Music">
      <i class="bi-search"></i>
      <span class="fab-action-label">Research Music</span>
    </button>
    <button class="fab-action" onclick="window.location.href='/collection.html'" title="My Collection">
      <i class="bi-collection-fill"></i>
      <span class="fab-action-label">My Collection</span>
    </button>
    <button class="fab-action" onclick="window.location.href='/song-identifier.html'" title="Identify Song">
      <i class="bi-soundwave"></i>
      <span class="fab-action-label">Identify Song</span>
    </button>
    <button class="fab-action" onclick="window.location.href='/'" title="Home">
      <i class="bi-house"></i>
      <span class="fab-action-label">Home</span>
    </button>
  </div>
  <button class="fab-main" id="fabMain">
    <i class="bi-plus-lg"></i>
  </button>
</div>
`;

// Initialize Quick Actions FAB
function initQuickActions() {
  // Add FAB to page
  const fabContainer = document.createElement('div');
  fabContainer.innerHTML = quickActionsHTML;
  document.body.appendChild(fabContainer.firstElementChild);
  
  // Setup toggle
  const fabMain = document.getElementById('fabMain');
  const fabActions = document.getElementById('fabActions');
  let isOpen = false;
  
  fabMain.addEventListener('click', () => {
    isOpen = !isOpen;
    fabMain.classList.toggle('active', isOpen);
    fabActions.classList.toggle('show', isOpen);
  });
  
  // Close on outside click
  document.addEventListener('click', (e) => {
    if (isOpen && !e.target.closest('.fab-menu')) {
      isOpen = false;
      fabMain.classList.remove('active');
      fabActions.classList.remove('show');
    }
  });
}

// Auto-initialize on page load
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuickActions);
  } else {
    initQuickActions();
  }
}

window.initQuickActions = initQuickActions;


