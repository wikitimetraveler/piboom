// Global User Login System
// Popup with 5 user icons for one-time login across all pages

const USER_PASSWORDS = {
  'cosmic-turtle': 'Dufus',
  'wizened-wizard': 'Giraffe Pizza',
  'jerry-garcia': 'Fooze',
  'easy-levi': 'Zip Knot',
  'fuzz-maestro': 'Fly Dog'
};

const USERS = [
  { id: 'cosmic-turtle', name: 'The Cosmic Turtle', avatar: '/images/cosmic turtle.png', color: '#00CED1' },
  { id: 'wizened-wizard', name: 'The Wizened Wizard', avatar: '/images/genie.png', color: '#9370DB' },
  { id: 'jerry-garcia', name: 'Jerry Garcia', avatar: '/images/jerry.png', color: '#FF6347' },
  { id: 'easy-levi', name: 'Easy Rider Levi', avatar: '/images/levi.png', color: '#4682B4' },
  { id: 'fuzz-maestro', name: 'Fuzz Maestro', avatar: '/images/fuzz.png', color: '#FF8C00' }
];

// Check if logged in
function isLoggedIn() {
  return localStorage.getItem('loggedInUserId') !== null;
}

// Get logged in user
function getLoggedInUser() {
  const userId = localStorage.getItem('loggedInUserId');
  return USERS.find(u => u.id === userId) || null;
}

// Show login popup
function showLoginPopup() {
  const modal = document.createElement('div');
  modal.id = 'loginModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(8px);
  `;
  
  modal.innerHTML = `
    <div style="background: white; padding: 30px 20px; border-radius: 24px; max-width: 600px; width: 95%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5); position: relative;">
      <button onclick="closeLoginPopup()" style="position: absolute; top: 10px; right: 15px; background: none; border: none; font-size: 2.5rem; color: #999; cursor: pointer; line-height: 1; padding: 5px; z-index: 1;">×</button>
      
      <h2 style="text-align: center; color: #2c3e50; margin-bottom: 10px; font-size: 1.5rem;">
        <i class="bi-person-circle"></i> Select Your User
      </h2>
      <p style="text-align: center; color: #666; margin-bottom: 25px; font-size: 0.95rem;">Click your icon to login</p>
      
      <div id="userIconGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px; margin-bottom: 20px;">
        ${USERS.map(user => `
          <div class="login-user-card" data-user="${user.id}" onclick="selectUserForLogin('${user.id}', '${user.name}', '${user.color}')">
            <img src="${user.avatar}" alt="${user.name}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin: 0 auto; display: block; border: 4px solid ${user.color}; cursor: pointer; transition: all 0.3s ease; touch-action: manipulation;">
            <div style="text-align: center; font-size: 0.85rem; margin-top: 8px; font-weight: 600; color: #2c3e50; line-height: 1.2;">${user.name.split(' ').slice(-1)}</div>
          </div>
        `).join('')}
      </div>
      
      <div id="passwordSection" style="display: none; margin-top: 25px; padding-top: 25px; border-top: 2px solid #eee;">
        <h4 style="text-align: center; color: #2c3e50; margin-bottom: 15px;">
          Enter Password for <span id="selectedUserName" style="color: #3498db;"></span>
        </h4>
        <div style="position: relative; margin-bottom: 15px;">
          <input type="text" id="loginPasswordInput" 
                 placeholder="Enter password..." 
                 inputmode="text"
                 autocomplete="off" 
                 autocorrect="off" 
                 autocapitalize="off" 
                 spellcheck="false"
                 style="width: 100%; padding: 14px 50px 14px 14px; border: 2px solid #ddd; border-radius: 10px; font-size: 1.1rem; box-sizing: border-box; -webkit-appearance: none;">
          <button id="toggleLoginPasswordBtn" type="button"
                  style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 8px; color: #666; font-size: 1.3rem;">
            🙈
          </button>
        </div>
        <div id="loginPasswordError" style="color: #e74c3c; font-size: 0.9rem; margin-bottom: 15px; text-align: center; display: none;">
          ❌ Incorrect password
        </div>
        <div style="display: flex; gap: 10px;">
          <button onclick="closeLoginPopup()" 
                  style="flex: 1; padding: 14px; border: 2px solid #ddd; background: white; color: #666; border-radius: 12px; cursor: pointer; font-size: 1rem; font-weight: 600;">
            Cancel
          </button>
          <button id="loginSubmitBtn" onclick="submitLogin()" 
                  style="flex: 1; padding: 14px; border: none; background: #3498db; color: white; border-radius: 12px; cursor: pointer; font-size: 1rem; font-weight: 600;">
            Login
          </button>
        </div>
      </div>
      
      <button onclick="closeLoginPopup()" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 2rem; color: #999; cursor: pointer; line-height: 1;">×</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add hover effects
  const style = document.createElement('style');
  style.textContent = `
    .login-user-card:hover img {
      transform: scale(1.1);
      box-shadow: 0 8px 25px rgba(0,0,0,0.3);
    }
  `;
  document.head.appendChild(style);
}

// Select user for login
let selectedLoginUserId = null;
let selectedUserColor = null;

function selectUserForLogin(userId, userName, userColor) {
  selectedLoginUserId = userId;
  selectedUserColor = userColor;
  
  // Show password section
  document.getElementById('passwordSection').style.display = 'block';
  document.getElementById('selectedUserName').textContent = userName;
  document.getElementById('selectedUserName').style.color = userColor;
  document.getElementById('loginSubmitBtn').style.background = userColor;
  
  // Focus password input
  setTimeout(() => {
    document.getElementById('loginPasswordInput').focus();
  }, 100);
  
  // Add highlight to selected user
  document.querySelectorAll('.login-user-card').forEach(card => {
    card.style.opacity = card.dataset.user === userId ? '1' : '0.5';
  });
}

// Submit login
function submitLogin() {
  const password = document.getElementById('loginPasswordInput').value.trim();
  const errorDiv = document.getElementById('loginPasswordError');
  
  if (password === USER_PASSWORDS[selectedLoginUserId]) {
    // Correct password - login user
    localStorage.setItem('loggedInUserId', selectedLoginUserId);
    localStorage.setItem('currentUserId', selectedLoginUserId);
    
    // Close modal
    closeLoginPopup();
    
    // Reload page to show logged-in state
    window.location.reload();
  } else {
    // Wrong password
    errorDiv.style.display = 'block';
    document.getElementById('loginPasswordInput').value = '';
    document.getElementById('loginPasswordInput').style.borderColor = '#e74c3c';
    
    setTimeout(() => {
      document.getElementById('loginPasswordInput').style.borderColor = '#ddd';
    }, 1000);
  }
}

// Close login popup
function closeLoginPopup() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    document.body.removeChild(modal);
  }
}

// Logout
function logout() {
  if (confirm('Logout? You will need to login again.')) {
    localStorage.removeItem('loggedInUserId');
    localStorage.removeItem('currentUserId');
    sessionStorage.clear();
    window.location.reload();
  }
}

// Update navbar to show current user
function updateNavbarUserDisplay() {
  const user = getLoggedInUser();
  const navUserBtn = document.getElementById('navUserBtn');
  
  if (navUserBtn && user) {
    navUserBtn.innerHTML = `
      <img src="${user.avatar}" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid ${user.color}; margin-right: 8px; vertical-align: middle;">
      ${user.name}
    `;
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  updateNavbarUserDisplay();
  
  // Listen for Enter key in password field
  document.addEventListener('keypress', (e) => {
    if (e.target.id === 'loginPasswordInput' && e.key === 'Enter') {
      submitLogin();
    }
  });
  
  // Toggle password visibility in login popup
  document.addEventListener('click', (e) => {
    if (e.target.id === 'toggleLoginPasswordBtn') {
      const input = document.getElementById('loginPasswordInput');
      const btn = e.target;
      
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
        btn.title = 'Hide Password';
      } else {
        input.type = 'password';
        btn.textContent = '👁️';
        btn.title = 'Show Password';
      }
    }
  });
});

// Export functions
window.showLoginPopup = showLoginPopup;
window.selectUserForLogin = selectUserForLogin;
window.submitLogin = submitLogin;
window.closeLoginPopup = closeLoginPopup;
window.logout = logout;
window.isLoggedIn = isLoggedIn;
window.getLoggedInUser = getLoggedInUser;
window.updateNavbarUserDisplay = updateNavbarUserDisplay;

