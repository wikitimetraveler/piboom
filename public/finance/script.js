/**
 * FEMA Disaster Search Script
 *
 * @file        script.js
 * @author      David Lane
 * @version     1.0.0
 * @since       2024
 *
 * Powers the FEMA disaster lookup utility, wiring the UI to FEMA APIs, DataTables,
 * and Encompass binding helpers.
 */

const screenBindings = new ScreenBindings();
screenBindings.bindFieldValues();

document.getElementById('searchButton').addEventListener('click', async () => {
    let state = document.getElementById('state').value;
    let county = document.getElementById('county').value;
    let lat = document.getElementById('latitude').value;
    let lng = document.getElementById('longitude').value;

    if (state && county) {
        let femaDisasterDeclUrl = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries';
        let filterParams = `$count=true&$filter=state eq '${state}' and designatedArea eq '${county} (County)'`;

        try {
            let response = await fetch(`${femaDisasterDeclUrl}?${filterParams}`);
            let disasterDeclResults = await response.json();

            let currentTimestamp = new Date();
            document.getElementById('searchTimestamp').innerText = 'Last Search Performed At: ' + currentTimestamp.toLocaleString();

            let tableBody = document.querySelector('#disasterTable tbody');
            tableBody.innerHTML = '';

            if ($.fn.DataTable.isDataTable('#disasterTable')) {
                $('#disasterTable').DataTable().clear().destroy();
            }

            if (disasterDeclResults.metadata.count > 0) {
                disasterDeclResults.DisasterDeclarationsSummaries.forEach(item => {
                    let row = document.createElement('tr');
                    row.innerHTML = `
                        <td tabindex="0">${item.declarationType}</td>
                        <td tabindex="0">${item.incidentType}</td>
                        <td tabindex="0">${item.declarationTitle}</td>
                        <td tabindex="0">${item.ihProgramDeclared ? 'Yes' : 'No'}</td>
                        <td tabindex="0">${item.iaProgramDeclared ? 'Yes' : 'No'}</td>
                        <td tabindex="0">${item.paProgramDeclared ? 'Yes' : 'No'}</td>
                        <td tabindex="0">${item.hmProgramDeclared ? 'Yes' : 'No'}</td>
                        <td tabindex="0">${item.incidentBeginDate}</td>
                        <td tabindex="0">${item.incidentEndDate || 'Ongoing'}</td>
                        <td tabindex="0">${item.disasterCloseoutDate || 'N/A'}</td>
                    `;
                    tableBody.appendChild(row);
                });

                // Initialize DataTable (basic functionality)
                $('#disasterTable').DataTable({
                    order: [[7, 'desc'], [8, 'asc']],
                    paging: true,
                    searching: false,
                    autoWidth: true,
                    responsive: true
                });

                // Enable keyboard navigation for custom row selection
                setupKeyboardNavigation();
                
                // Re-attach click event handlers for YouTube integration
                $('#disasterTable tbody').off('click', 'tr').on('click', 'tr', function() {
                    console.log('Row clicked!'); // Debug log
                    const disasterName = $(this).find('td').eq(2).text();
                    let lat = document.getElementById('latitude').value;
                    let lng = document.getElementById('longitude').value;

                    console.log('Disaster name:', disasterName); // Debug log
                    console.log('Lat/Lng:', lat, lng); // Debug log

                    // Construct the YouTube search query
                    const query = `${disasterName}`;

                    // If latitude and longitude are available, perform a location-based search
                    if (lat && lng) {
                        searchYouTube(query, lat, lng, '50mi'); // Use 50-mile radius
                    } else {
                        searchYouTube(query); // Perform a standard search if lat/lng are not available
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching FEMA data:', error);
        }
    } else {
        alert('Please enter both state and county.');
    }
});

function setupKeyboardNavigation() {
    const rows = document.querySelectorAll('#disasterTable tbody tr');
    let currentRowIndex = 0;

    function highlightRow(rowIndex) {
        rows.forEach(row => row.classList.remove('highlight'));
        rows[rowIndex].classList.add('highlight');
        rows[rowIndex].focus();
        populateInputs(rows[rowIndex]);
    }

    function populateInputs(row) {
        const cells = row.children;
        document.getElementById('inputDeclarationType').value = cells[0].textContent;
        document.getElementById('inputIncidentType').value = cells[1].textContent;
        document.getElementById('inputDeclarationTitle').value = cells[2].textContent;
        document.getElementById('inputIHProgramDeclared').value = cells[3].textContent;
        document.getElementById('inputIAProgramDeclared').value = cells[4].textContent;
        document.getElementById('inputPAProgramDeclared').value = cells[5].textContent;
        document.getElementById('inputHMProgramDeclared').value = cells[6].textContent;
        document.getElementById('inputIncidentBeginDate').value = cells[7].textContent;
        document.getElementById('inputIncidentEndDate').value = cells[8].textContent;
        document.getElementById('inputDisasterCloseoutDate').value = cells[9].textContent;
    }

    rows.forEach((row, index) => {
        row.setAttribute('tabindex', '0');
        row.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown' && index < rows.length - 1) {
                currentRowIndex = index + 1;
                highlightRow(currentRowIndex);
                event.preventDefault();
            } else if (event.key === 'ArrowUp' && index > 0) {
                currentRowIndex = index - 1;
                highlightRow(currentRowIndex);
                event.preventDefault();
            }
        });
    });

    highlightRow(currentRowIndex);
}

function loadYouTubeAPI() {
    // Wait for gapi to be available
    if (typeof gapi === 'undefined') {
        console.log("Waiting for Google API to load...");
        setTimeout(loadYouTubeAPI, 500); // Faster retry
        return;
    }

    gapi.load("client", () => {
        gapi.client.init({
            apiKey: "AIzaSyDwVl1Cpi3DBIBUoCnWrLuV2oOT7mbMnNI",
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"]
        }).then(() => {
            console.log("YouTube API loaded successfully and ready!");
            window.youtubeAPIReady = true;
        }).catch(error => {
            console.error("Error loading YouTube API:", error);
            window.youtubeAPIReady = false;
        });
    });
}

// Updated searchYouTube function to accept location parameters
function searchYouTube(query, lat = null, lng = null, radius = null) {
    if (!gapi.client || !gapi.client.youtube) {
        console.error("YouTube API not loaded!");
        return;
    }

    console.log("Searching YouTube for:", query);

    // Prepare the YouTube API request parameters
    let requestParams = {
        part: "snippet",
        q: query,
        type: "video",
        maxResults: 5
    };

    // If latitude and longitude are provided, add location-based filters
    if (lat && lng && radius) {
        requestParams.location = `${lat},${lng}`;
        requestParams.locationRadius = radius;
    }

    // Perform the YouTube API search
    gapi.client.youtube.search.list(requestParams)
        .then(response => {
            const results = response.result.items;
            console.log("YouTube results:", results);
            displayYouTubeResults(results);
        })
        .catch(error => console.error("YouTube API error:", error));
}

function displayYouTubeResults(videos) {
    const youtubeResultsDiv = document.getElementById("youtubeResults");
    if (videos && videos.length > 0) {
        youtubeResultsDiv.innerHTML = videos.map(video => `
            <div class="card mb-2">
                <img src="${video.snippet.thumbnails.default.url}" class="card-img-top" alt="${video.snippet.title}">
                <div class="card-body">
                    <h5 class="card-title">${video.snippet.title}</h5>
                    <p class="card-text">${video.snippet.description}</p>
                    <a href="https://www.youtube.com/watch?v=${video.id.videoId}" target="_blank" class="btn btn-primary">Watch on YouTube</a>
                </div>
            </div>
        `).join('');
    } else {
        youtubeResultsDiv.innerHTML = '<div class="alert alert-info">No YouTube videos found for this disaster.</div>';
    }
}

// Load YouTube API immediately when script loads
loadYouTubeAPI();

// Also load when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, ensuring YouTube API is ready...");
    loadYouTubeAPI();
    
    // Check if API is ready every second for the first 10 seconds
    let attempts = 0;
    const checkInterval = setInterval(() => {
        attempts++;
        if (window.youtubeAPIReady) {
            console.log("YouTube API confirmed ready!");
            clearInterval(checkInterval);
        } else if (attempts >= 10) {
            console.warn("YouTube API failed to load after 10 attempts");
            clearInterval(checkInterval);
        } else {
            console.log(`Checking YouTube API readiness... attempt ${attempts}`);
            loadYouTubeAPI();
        }
    }, 1000);
});


