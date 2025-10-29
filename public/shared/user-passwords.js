// User Password Protection System
// Simple password check to prevent accidental edits
// Not for security - just to prevent mistakes on Pi app

// Prevent redeclaration if script is loaded multiple times
if (typeof window.USER_PASSWORDS === 'undefined') {
  window.USER_PASSWORDS = {
    'cosmic-turtle': 'Dufus',
    'wizened-wizard': 'Giraffe Pizza',
    'jerry-garcia': 'Fooze',
    'easy-levi': 'Zip Knot',
    'fuzz-maestro': 'Fly Dog'
  };
}

// Session storage for verified users (expires when page closes)
if (typeof window.sessionKey === 'undefined') {
  window.sessionKey = 'verified_user_session';
}

// Check if user is verified in current session
function isUserVerifiedInSession(userId) {
  const verified = sessionStorage.getItem(window.sessionKey);
  return verified === userId;
}

// Mark user as verified for this session
function markUserVerified(userId) {
  sessionStorage.setItem(window.sessionKey, userId);
}

// Clear verification (on logout or user switch)
function clearVerification() {
  sessionStorage.removeItem(window.sessionKey);
}

// Verify user password with custom modal
async function verifyUserPassword(userId, actionDescription = 'perform this action') {
  // If already verified in this session, allow
  if (isUserVerifiedInSession(userId)) {
    return true;
  }
  
  const user = getUserById ? getUserById(userId) : null;
  const userName = user ? user.name : 'User';
  const expectedPassword = window.USER_PASSWORDS[userId];
  
  if (!expectedPassword) {
    console.error('No password configured for user:', userId);
    return false;
  }
  
  return new Promise((resolve) => {
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(5px);
    `;
    
    const userColor = user ? user.color : '#667eea';
    
    modal.innerHTML = `
      <div style="background: white; padding: 30px; border-radius: 20px; max-width: 400px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3); border-top: 5px solid ${userColor};">
        <div style="text-align: center; margin-bottom: 20px;">
          ${user ? `<img src="${user.avatar}" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid ${userColor}; margin-bottom: 10px;">` : ''}
          <h3 style="margin: 10px 0; color: #2c3e50;">Password Required</h3>
          <p style="color: #666; font-size: 0.9rem; margin: 5px 0;">Enter password for <strong style="color: ${userColor};">${userName}</strong></p>
          <p style="color: #999; font-size: 0.85rem; margin-top: 5px;">to ${actionDescription}</p>
        </div>
        
        <div style="position: relative; margin-bottom: 15px;">
          <input type="text" id="userPasswordInput" 
                 placeholder="Enter password..." 
                 inputmode="text"
                 autocomplete="off" 
                 autocorrect="off" 
                 autocapitalize="off" 
                 spellcheck="false"
                 style="width: 100%; padding: 14px 50px 14px 14px; border: 2px solid #ddd; border-radius: 10px; font-size: 1.1rem; box-sizing: border-box; -webkit-appearance: none;"
                 data-password-field="true">
          <button id="togglePasswordBtn" type="button"
                  style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 8px; color: #666; font-size: 1.3rem;"
                  title="Show/Hide Password">
            👁️
          </button>
        </div>
        
        <div style="display: flex; gap: 10px;">
          <button id="cancelPasswordBtn" 
                  style="flex: 1; padding: 12px; border: 2px solid #ddd; background: white; color: #666; border-radius: 10px; cursor: pointer; font-size: 1rem; font-weight: 600;">
            Cancel
          </button>
          <button id="submitPasswordBtn" 
                  style="flex: 1; padding: 12px; border: none; background: ${userColor}; color: white; border-radius: 10px; cursor: pointer; font-size: 1rem; font-weight: 600;">
            Verify
          </button>
        </div>
        
        <div id="passwordError" style="color: #e74c3c; font-size: 0.85rem; margin-top: 10px; text-align: center; display: none;">
          ❌ Incorrect password
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const input = document.getElementById('userPasswordInput');
    const errorDiv = document.getElementById('passwordError');
    const submitBtn = document.getElementById('submitPasswordBtn');
    const cancelBtn = document.getElementById('cancelPasswordBtn');
    const toggleBtn = document.getElementById('togglePasswordBtn');
    
    // Password masking with toggle (starts visible for mobile)
    let passwordVisible = true; // Start visible for easier mobile typing
    let actualPassword = '';
    
    // Initially show as text for mobile
    input.type = 'text';
    toggleBtn.textContent = '🙈';
    toggleBtn.title = 'Hide Password';
    
    toggleBtn.addEventListener('click', () => {
      passwordVisible = !passwordVisible;
      input.type = passwordVisible ? 'text' : 'password';
      toggleBtn.textContent = passwordVisible ? '🙈' : '👁️';
      toggleBtn.title = passwordVisible ? 'Hide Password' : 'Show Password';
    });
    
    // Focus input
    setTimeout(() => input.focus(), 100);
    
    // Handle submit
    const checkPassword = () => {
      const enteredPassword = input.value.trim();
      
      if (enteredPassword === expectedPassword) {
        // Correct password - mark as verified for session
        markUserVerified(userId);
        document.body.removeChild(modal);
        resolve(true);
      } else {
        // Wrong password
        errorDiv.style.display = 'block';
        input.value = '';
        input.style.borderColor = '#e74c3c';
        input.focus();
        
        // Shake animation
        modal.firstElementChild.style.animation = 'shake 0.5s';
        setTimeout(() => {
          modal.firstElementChild.style.animation = '';
          input.style.borderColor = '#ddd';
        }, 500);
      }
    };
    
    // Event listeners
    submitBtn.addEventListener('click', checkPassword);
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve(false);
    });
    
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        checkPassword();
      }
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
        resolve(false);
      }
    });
  });
}

// Add shake animation
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-10px); }
    75% { transform: translateX(10px); }
  }
`;
document.head.appendChild(style);

// Clear verification when user changes
window.addEventListener('userChanged', () => {
  clearVerification();
});

// Export functions
window.verifyUserPassword = verifyUserPassword;
window.clearUserVerification = clearVerification;

