/**
 * @file This file contains the javascript for syling dark mode and audit results
 * @author David Lane
 * @date November 14, 2023
 */


// Check if dark mode preference is stored in local storage
const isDarkModeEnabled = localStorage.getItem("darkModeEnabled") === "true";

// Function to toggle dark mode
function toggleDarkMode() {
  const isDarkMode = document.body.classList.toggle("dark-mode");
  localStorage.setItem("darkModeEnabled", isDarkMode.toString());
}

// Add event listener to the dark mode toggle button
const darkModeToggle = document.getElementById("darkModeToggle");
darkModeToggle.addEventListener("click", toggleDarkMode);

// Apply dark mode if it's enabled
if (isDarkModeEnabled) {
  enableDarkMode();
}

// Function to update the audit table based on audit results
function updateAuditTable(results) {
  const tableBody = document.getElementById('auditTable').querySelector('tbody');
  
  Object.entries(results).forEach(([parameter, result]) => {
    const row = Array.from(tableBody.rows).find(row => row.cells[0].textContent.includes(parameter));
    if (row) {
      const badgeColor = getResultBadgeColor(result);
      row.cells[1].innerHTML = `<span class="badge bg-${badgeColor}">${result}</span>`;
    }
  });
}


// Function to determine badge color based on result
function getResultBadgeColor(result) {
  switch (result.toLowerCase()) {
    case 'pass':
      return 'success';
    case 'warn':
      return 'warning';
    case 'fail':
      return 'danger';
    default:
      return 'secondary'; // Handle other cases as needed
  }
}


