// Multi-User System for piBoom Collections
// 5 users with their own collections, all can view all

const USERS = [
  {
    id: 'cosmic-turtle',
    name: 'The Cosmic Turtle',
    avatar: '/images/cosmic turtle.png',
    color: '#00CED1', // turquoise
    description: 'Cosmic explorer of sound'
  },
  {
    id: 'wizened-wizard',
    name: 'The Wizened Wizard',
    avatar: '/images/steven.png',
    color: '#9370DB', // medium purple
    description: 'Master of musical mysteries'
  },
  {
    id: 'jerry-garcia',
    name: 'Jerry Garcia',
    avatar: '/images/jerry.png',
    color: '#FF6347', // tomato red
    description: 'Grateful for great tunes'
  },
  {
    id: 'easy-levi',
    name: 'Easy Rider Levi',
    avatar: '/images/levi.png',
    color: '#4682B4', // steel blue
    description: 'Biker hippie trucker'
  },
  {
    id: 'fuzz-maestro',
    name: 'Fuzz Maestro',
    avatar: '/images/fuzz.png',
    color: '#FF8C00', // dark orange
    description: 'Keeper of the fuzz'
  }
];

// Get current user from localStorage or default to The Cosmic Turtle
function getCurrentUser() {
  const savedUserId = localStorage.getItem('currentUserId');
  // Default to The Cosmic Turtle (first user)
  const user = USERS.find(u => u.id === savedUserId) || USERS[0];
  return user;
}

// Set current user
function setCurrentUser(userId) {
  localStorage.setItem('currentUserId', userId);
  window.dispatchEvent(new CustomEvent('userChanged', { detail: { userId } }));
}

// Get user by ID
function getUserById(userId) {
  return USERS.find(u => u.id === userId);
}

// Get all users
function getAllUsers() {
  return USERS;
}

// Create user selector HTML
function createUserSelector(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const currentUser = getCurrentUser();
  const viewMode = localStorage.getItem('viewMode') || 'single';
  const showAllOption = options.showAllOption !== false; // default true
  
  let html = `
    <div class="user-selector" style="background: rgba(30, 30, 30, 0.9); padding: 20px; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); margin-bottom: 20px; border: 1px solid rgba(212, 175, 55, 0.3);">
      <h5 style="margin-bottom: 15px; color: #d4af37; font-weight: 300; letter-spacing: 2px; text-transform: uppercase; font-size: 1rem;">
        <i class="bi-person-circle"></i> ${options.title || 'Select User'}
      </h5>
      <div class="user-avatars" style="display: flex; gap: 15px; flex-wrap: wrap; align-items: center;">
  `;
  
  // Add "All Users" option for viewing collections
  if (showAllOption) {
    const isAllActive = viewMode === 'all';
    const borderColor = isAllActive ? '#d4af37' : 'rgba(212, 175, 55, 0.3)';
    const boxShadow = isAllActive ? '0 0 20px rgba(212, 175, 55, 0.5)' : 'none';
    
    html += `
      <div class="user-avatar-wrapper" style="text-align: center;">
        <div class="user-avatar all-users ${isAllActive ? 'active' : ''}" 
             onclick="selectUser('all')"
             style="width: 70px; height: 70px; border-radius: 50%; border: 3px solid ${borderColor}; cursor: pointer; overflow: hidden; position: relative; background: rgba(212, 175, 55, 0.2); display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; box-shadow: ${boxShadow};">
          <i class="bi-people-fill" style="font-size: 2rem; color: #d4af37;"></i>
        </div>
        <div style="font-size: 0.75rem; margin-top: 5px; font-weight: ${isAllActive ? '600' : '400'}; color: ${isAllActive ? '#d4af37' : '#b0b0b0'};">All Users</div>
      </div>
    `;
  }
  
  // Add each user
  USERS.forEach(user => {
    const isActive = viewMode !== 'all' && currentUser.id === user.id;
    html += `
      <div class="user-avatar-wrapper" style="text-align: center;">
        <div class="user-avatar ${isActive ? 'active' : ''}" 
             onclick="selectUser('${user.id}')"
             style="width: 70px; height: 70px; border-radius: 50%; border: 3px solid ${isActive ? '#d4af37' : 'rgba(212, 175, 55, 0.3)'}; cursor: pointer; overflow: hidden; position: relative; transition: all 0.3s ease; box-shadow: ${isActive ? '0 0 20px rgba(212, 175, 55, 0.5)' : 'none'};">
          <img src="${user.avatar}" alt="${user.name}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
        <div style="font-size: 0.75rem; margin-top: 5px; font-weight: ${isActive ? '600' : '300'}; color: ${isActive ? '#d4af37' : '#b0b0b0'}; letter-spacing: 1px;">${user.name.split(' ').pop()}</div>
      </div>
    `;
  });
  
  html += `
      </div>
      <div class="current-user-info" style="margin-top: 15px; padding: 12px; background: rgba(212, 175, 55, 0.1); border-radius: 4px; border-left: 4px solid #d4af37;">
        <strong style="color: #d4af37; font-weight: 300; letter-spacing: 1px;">${viewMode === 'all' ? 'Viewing All Users' : currentUser.name}</strong>
        <div style="font-size: 0.85rem; color: #b0b0b0; margin-top: 3px; font-style: italic;">${viewMode === 'all' ? 'All collections combined' : currentUser.description}</div>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

// Select user handler - free browsing, no password needed for viewing
async function selectUser(userId) {
  if (userId === 'all') {
    localStorage.setItem('viewMode', 'all');
    localStorage.removeItem('currentUserId');
    window.location.reload();
    return;
  }
  
  // Free browsing - just change the view without password
  // Password will be required when user tries to ADD/EDIT/DELETE
  localStorage.setItem('viewMode', 'single');
  setCurrentUser(userId);
  
  // Reload the page to apply changes
  window.location.reload();
}

// Export for use in other scripts
window.USERS = USERS;
window.getCurrentUser = getCurrentUser;
window.setCurrentUser = setCurrentUser;
window.getUserById = getUserById;
window.getAllUsers = getAllUsers;
window.createUserSelector = createUserSelector;
window.selectUser = selectUser;

