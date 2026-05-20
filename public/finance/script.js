/**
 * FEMA Disaster Search Script
 *
 * @file        script.js
 * @author      David Lane
 * @version     1.0.0
 * @since       2024
 *
 * Powers the FEMA disaster lookup utility, wiring the UI to DataTables,
 * YouTube search, and Encompass binding helpers.
 */

const screenBindings = new ScreenBindings();
screenBindings.bindFieldValues();

function formatDisasterDate(value) {
    if (!value || value === 'Ongoing' || value === 'N/A') {
        return value || '';
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
        return String(value);
    }
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function yesNo(value) {
    return value ? 'Yes' : 'No';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function destroyDisasterDataTable() {
    if (typeof $ !== 'undefined' && $.fn.DataTable && $.fn.DataTable.isDataTable('#disasterTable')) {
        $('#disasterTable').DataTable().clear().destroy();
    }
}

function initDisasterDataTable() {
    if (typeof $ === 'undefined' || !$.fn.DataTable) {
        return;
    }

    destroyDisasterDataTable();

    const rowCount = document.querySelectorAll('#disasterTable tbody tr').length;
    if (rowCount === 0) {
        return;
    }

    $('#disasterTable').DataTable({
        order: [[7, 'desc'], [8, 'asc']],
        paging: true,
        pageLength: 10,
        searching: false,
        autoWidth: false,
        scrollX: true,
        columnDefs: [
            { targets: [3, 4, 5, 6], className: 'text-center', width: '4%' },
            { targets: [7, 8, 9], className: 'text-nowrap', width: '9%' },
            {
                targets: 2,
                className: 'disaster-title-cell',
                render(data) {
                    const safe = escapeHtml(data);
                    return `<span class="text-truncate d-inline-block" style="max-width:14rem" title="${safe}">${safe}</span>`;
                }
            }
        ]
    });
}

function populateDetailStrip(row) {
    if (!row) {
        return;
    }
    const cells = row.children;
    document.getElementById('inputDeclarationType').value = cells[0].textContent.trim();
    document.getElementById('inputIncidentType').value = cells[1].textContent.trim();
    document.getElementById('inputDeclarationTitle').value = cells[2].textContent.trim();
    document.getElementById('inputIHProgramDeclared').value = cells[3].textContent.trim();
    document.getElementById('inputIAProgramDeclared').value = cells[4].textContent.trim();
    document.getElementById('inputPAProgramDeclared').value = cells[5].textContent.trim();
    document.getElementById('inputHMProgramDeclared').value = cells[6].textContent.trim();
    document.getElementById('inputIncidentBeginDate').value = cells[7].textContent.trim();
    document.getElementById('inputIncidentEndDate').value = cells[8].textContent.trim();
    document.getElementById('inputDisasterCloseoutDate').value = cells[9].textContent.trim();
}

function selectDisasterRow(row) {
    document.querySelectorAll('#disasterTable tbody tr').forEach((tr) => {
        tr.classList.remove('disaster-row-selected');
    });
    if (row) {
        row.classList.add('disaster-row-selected');
        populateDetailStrip(row);
    }
}

function bindDisasterRowHandlers() {
    if (typeof $ === 'undefined') {
        return;
    }

    $('#disasterTable tbody').off('click', 'tr').on('click', 'tr', function handleDisasterRowClick() {
        selectDisasterRow(this);

        const disasterName = $(this).find('td').eq(2).text().trim();
        const lat = document.getElementById('latitude').value;
        const lng = document.getElementById('longitude').value;

        if (lat && lng) {
            searchYouTube(disasterName, lat, lng, '50mi');
        } else {
            searchYouTube(disasterName);
        }
    });
}

function setupKeyboardNavigation() {
    const rows = document.querySelectorAll('#disasterTable tbody tr');
    if (!rows.length) {
        return;
    }

    let currentRowIndex = 0;

    function highlightRow(rowIndex) {
        selectDisasterRow(rows[rowIndex]);
        rows[rowIndex].focus();
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

function buildDisasterTableRow(d) {
    const tr = document.createElement('tr');
    const title = d.declarationTitle || d.title || '';
    tr.innerHTML = `
        <td>${escapeHtml(d.declarationType || '')}</td>
        <td>${escapeHtml(d.incidentType || '')}</td>
        <td>${escapeHtml(title)}</td>
        <td>${yesNo(d.ihProgramDeclared)}</td>
        <td>${yesNo(d.iaProgramDeclared)}</td>
        <td>${yesNo(d.paProgramDeclared)}</td>
        <td>${yesNo(d.hmProgramDeclared)}</td>
        <td>${escapeHtml(formatDisasterDate(d.incidentBeginDate))}</td>
        <td>${escapeHtml(d.incidentEndDate ? formatDisasterDate(d.incidentEndDate) : (d.incidentBeginDate ? 'Ongoing' : ''))}</td>
        <td>${escapeHtml(d.disasterCloseoutDate ? formatDisasterDate(d.disasterCloseoutDate) : (d.incidentBeginDate ? 'N/A' : ''))}</td>
    `;
    return tr;
}

function refreshDisasterTableUI(disasters) {
    const tbody = document.querySelector('#disasterTable tbody');
    if (!tbody) {
        return;
    }

    destroyDisasterDataTable();
    tbody.innerHTML = '';

    (disasters || []).forEach((d) => {
        tbody.appendChild(buildDisasterTableRow(d));
    });

    initDisasterDataTable();
    bindDisasterRowHandlers();
    setupKeyboardNavigation();
}

function loadYouTubeAPI() {
    if (typeof gapi === 'undefined') {
        setTimeout(loadYouTubeAPI, 500);
        return;
    }

    gapi.load('client', () => {
        gapi.client.init({
            apiKey: 'AIzaSyDwVl1Cpi3DBIBUoCnWrLuV2oOT7mbMnNI',
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest']
        }).then(() => {
            window.youtubeAPIReady = true;
        }).catch((error) => {
            console.error('Error loading YouTube API:', error);
            window.youtubeAPIReady = false;
        });
    });
}

function searchYouTube(query, lat = null, lng = null, radius = null) {
    if (!gapi.client || !gapi.client.youtube) {
        console.error('YouTube API not loaded!');
        return;
    }

    const requestParams = {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: 5
    };

    if (lat && lng && radius) {
        requestParams.location = `${lat},${lng}`;
        requestParams.locationRadius = radius;
    }

    gapi.client.youtube.search.list(requestParams)
        .then((response) => {
            displayYouTubeResults(response.result.items);
        })
        .catch((error) => console.error('YouTube API error:', error));
}

function displayYouTubeResults(videos) {
    const youtubeResultsDiv = document.getElementById('youtubeResults');
    if (!youtubeResultsDiv) {
        return;
    }

    if (videos && videos.length > 0) {
        youtubeResultsDiv.innerHTML = videos.map((video) => `
            <div class="youtube-card">
                <img src="${video.snippet.thumbnails.default.url}" alt="${escapeHtml(video.snippet.title)}">
                <h5>${escapeHtml(video.snippet.title)}</h5>
                <p>${escapeHtml(video.snippet.description)}</p>
                <a href="https://www.youtube.com/watch?v=${video.id.videoId}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">Watch on YouTube</a>
            </div>
        `).join('');
    } else {
        youtubeResultsDiv.innerHTML = '<div class="alert alert-info mb-0">No YouTube videos found for this disaster.</div>';
    }
}

window.formatDisasterDate = formatDisasterDate;
window.destroyDisasterDataTable = destroyDisasterDataTable;
window.initDisasterDataTable = initDisasterDataTable;
window.bindDisasterRowHandlers = bindDisasterRowHandlers;
window.setupKeyboardNavigation = setupKeyboardNavigation;
window.refreshDisasterTableUI = refreshDisasterTableUI;
window.searchYouTube = searchYouTube;

loadYouTubeAPI();

document.addEventListener('DOMContentLoaded', () => {
    loadYouTubeAPI();

    let attempts = 0;
    const checkInterval = setInterval(() => {
        attempts += 1;
        if (window.youtubeAPIReady) {
            clearInterval(checkInterval);
        } else if (attempts >= 10) {
            clearInterval(checkInterval);
        } else {
            loadYouTubeAPI();
        }
    }, 1000);
});
