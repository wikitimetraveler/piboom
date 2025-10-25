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
    <div class="user-selector" style="background: linear-gradient(135deg, rgba(102,126,234,0.08), rgba(118,75,162,0.08)); backdrop-filter: blur(10px); padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); margin-bottom: 25px; border: 1px solid rgba(135, 206, 250, 0.2);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h5 style="margin: 0; color: #667eea; font-weight: 600; font-size: 0.95rem;">
          ${options.title || 'Select User'}
        </h5>
        <div style="font-size: 0.85rem; color: #999; font-weight: 500;">
          ${viewMode === 'all' ? '👥 All Collections' : '👤 ' + currentUser.name.split(' ').pop()}
        </div>
      </div>
      <div class="user-avatars" style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center; justify-content: center;">
  `;
  
  // Add "All Users" option for viewing collections
  if (showAllOption) {
    const isAllActive = viewMode === 'all';
    const borderColor = isAllActive ? '#d4af37' : 'rgba(212, 175, 55, 0.3)';
    const boxShadow = isAllActive ? '0 0 20px rgba(212, 175, 55, 0.5)' : 'none';
    
    html += `
      <div class="user-avatar-wrapper" style="text-align: center; position: relative;">
        <div class="user-avatar all-users ${isAllActive ? 'active' : ''}" 
             onclick="selectUser('all')"
             style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid ${isAllActive ? '#667eea' : 'rgba(135, 206, 250, 0.3)'}; cursor: pointer; overflow: hidden; position: relative; background: linear-gradient(135deg, rgba(102,126,234,0.15), rgba(118,75,162,0.15)); display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; box-shadow: ${isAllActive ? '0 0 20px rgba(102, 126, 234, 0.5)' : '0 2px 8px rgba(0,0,0,0.1)'};">
          <i class="bi-people-fill" style="font-size: 1.5rem; color: ${isAllActive ? '#667eea' : '#999'};"></i>
        </div>
      </div>
    `;
  }
  
  // Add each user
  USERS.forEach(user => {
    const isActive = viewMode !== 'all' && currentUser.id === user.id;
    html += `
      <div class="user-avatar-wrapper" style="text-align: center; position: relative;" title="${user.name} - ${user.description}">
        <div class="user-avatar ${isActive ? 'active' : ''}" 
             onclick="selectUser('${user.id}')"
             style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid ${isActive ? user.color : 'rgba(255,255,255,0.3)'}; cursor: pointer; overflow: hidden; position: relative; transition: all 0.3s ease; box-shadow: ${isActive ? '0 0 20px ' + user.color + '80' : '0 2px 8px rgba(0,0,0,0.1)'}; background: white;">
          <img src="${user.avatar}" alt="${user.name}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
      </div>
    `;
  });
  
  html += `
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

