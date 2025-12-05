/**
 * Tool 6 Utilities
 *
 * @file        tool6.js
 * @author      David Lane
 * @version     1.0.0
 * @since       2024
 *
 * Supports the Tool 6 automation experience by loading reference metadata,
 * allowing loan officers to inspect dropdown/borr-specific fields, and wiring
 * UI interactions for Encompass diagnostics.
 */
// Global variables
    let fieldIds = new Set();
    let dropdownFields = new Set();
    let borrSpecificFields = new Set();
    let brokerSpecificFields = new Set();
    let currentFields = [];
    let fieldLabels = {};
    let fieldCTypes = {};
    let fieldCalendars = {};
    let lastMethod = null;

    // Load reference files
    async function loadReferenceFiles() {
        try {
            // Load dropdown fields
            const dropdownResponse = await fetch('../data/dropdownFields.txt');
            const dropdownText = await dropdownResponse.text();
            dropdownFields = new Set(
                dropdownText.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
                    .map(line => line.replace(/[\[\]]/g, ''))
            );
            console.log(`Loaded ${dropdownFields.size} dropdown fields`);

            // Load borrower specific fields
            const borrResponse = await fetch('../data/borrSpecificFields.txt');
            const borrText = await borrResponse.text();
            borrSpecificFields = new Set(
                borrText.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
                    .map(line => line.replace(/[\[\]]/g, ''))
            );
            console.log(`Loaded ${borrSpecificFields.size} borrower specific fields`);

            // Initialize broker specific fields
            brokerSpecificFields = new Set([
                'BROKER.NAME',
                'BROKER.COMPANY',
                'BROKER.PHONE',
                'BROKER.EMAIL',
                'BROKER.LICENSE',
                'BROKER.ADDRESS',
                'BROKER.CITY',
                'BROKER.STATE',
                'BROKER.ZIP'
            ]);
            console.log(`Loaded ${brokerSpecificFields.size} broker specific fields`);

        } catch (error) {
            console.error('Error loading reference files:', error);
        }
    }

    function populateFieldList(fields) {
        const datalist = document.getElementById('fieldList');
        datalist.innerHTML = '';
        Array.from(fields).sort().forEach(fieldId => {
            const option = document.createElement('option');
            option.value = fieldId;
            datalist.appendChild(option);
        });
    }

    // Add milestone method mapping
    const milestoneMap = {
        "Started": "Started",
        "Application": "Started",
        "File Prep": "Application",
        "Processing": "File Prep",
        "Underwriting": "Processing",
        "Closing": "Underwriting",
        "Funding": "Closing",
        "Post Closing": "Funding",
        "Completion": "Post Closing"
    };

    function transformXML() {
        const xmlInput = document.getElementById('xmlInput').value;
        if (!xmlInput) {
            showToast('Please paste XML content first!', 'error');
            return;
        }

        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlInput, "text/xml");
            const affectedFields = xmlDoc.getElementsByTagName('AffectedField');
            const fields = new Set();
            const excludedFields = new Set();

            // First, collect all fields from AffectedField tags
            for (let field of affectedFields) {
                const entityId = field.getElementsByTagName('XRef')[0]?.getAttribute('EntityID');
                if (entityId) {
                    fields.add(entityId);
                }
            }

            // Then check AdvancedCodeDependencies and Value tags
            const advancedDeps = xmlDoc.getElementsByTagName('AdvancedCodeDependencies');
            for (let dep of advancedDeps) {
                // Check both Value tags and AffectedField tags within AdvancedCodeDependencies
                const valueElements = dep.getElementsByTagName('Value');
                const affectedFieldsInDep = dep.getElementsByTagName('AffectedField');
                
                // Handle Value tags
                for (let value of valueElements) {
                    const fieldId = value.textContent.trim();
                    if (fieldId) {
                        excludedFields.add(fieldId);
                    }
                }
                
                // Handle AffectedField tags
                for (let field of affectedFieldsInDep) {
                    const entityId = field.getElementsByTagName('XRef')[0]?.getAttribute('EntityID');
                    if (entityId) {
                        excludedFields.add(entityId);
                    }
                }
            }

            // Check AdvancedCodeXml tags for fields to exclude
            const advancedCodeXmls = xmlDoc.getElementsByTagName('AdvancedCodeXml');
            for (let xml of advancedCodeXmls) {
                const content = xml.textContent.trim();
                // Extract field IDs from the content (they appear in square brackets)
                const matches = content.match(/\[([^\]]+)\]/g);
                if (matches) {
                    matches.forEach(match => {
                        const fieldId = match.slice(1, -1); // Remove the brackets
                        if (fieldId) {
                            excludedFields.add(fieldId);
                        }
                    });
                }
            }

            // Remove excluded fields from the set
            excludedFields.forEach(field => fields.delete(field));

            // Also check for fields in Value tags outside of AdvancedCodeDependencies
            const allValues = xmlDoc.getElementsByTagName('Value');
            for (let value of allValues) {
                const fieldId = value.textContent.trim();
                if (fieldId && !fields.has(fieldId)) {
                    excludedFields.add(fieldId);
                }
            }

            // Remove any remaining excluded fields
            excludedFields.forEach(field => fields.delete(field));

            const sortedFields = Array.from(fields).sort().map(fieldId => {
                const rawFieldId = fieldId.split('#')[0].split('@')[0];
                // Find the corresponding AffectedField element
                const affectedField = Array.from(affectedFields).find(field => {
                    const xref = field.getElementsByTagName('XRef')[0];
                    return xref && xref.getAttribute('EntityID') === rawFieldId;
                });
                
                // Get the milestone from the parent RequiredField
                let method = '';
                if (affectedField) {
                    const requiredField = affectedField.closest('RequiredField');
                    if (requiredField) {
                        const milestoneXRef = requiredField.querySelector('AffectedMilestone XRef');
                        if (milestoneXRef) {
                            const milestoneName = milestoneXRef.getAttribute('EntityUID');
                            // Get the previous milestone from our milestoneMap
                            const previousMilestone = milestoneMap[milestoneName] || milestoneName;
                            method = `isDate|[Log.MS.Date.${previousMilestone}]`;
                        }
                    }
                }
                
                // If no method found, use the last method found
                if (!method) {
                    method = lastMethod ? `isDate|[Log.MS.Date.${lastMethod}]` : 'isDate|[Log.MS.Date.File Prep]';
                } else {
                    lastMethod = method.split('.').pop().replace(']', ''); // Update lastMethod when a new one is found
                }

                // Get Label, CType, and Calendar from the XML
                let label = '';
                let ctype = '';
                let calendar = '';
                
                if (affectedField) {
                    const xref = affectedField.getElementsByTagName('XRef')[0];
                    if (xref) {
                        // Get Label from EntityUID
                        label = xref.getAttribute('EntityUID') || '';
                        
                        // Only set CType for dropdown fields
                        if (dropdownFields.has(rawFieldId)) {
                            ctype = 'DropdownBox';
                        }
                        
                        // Set Calendar if it's a date field
                        calendar = label.toLowerCase().includes('date') ? 'true' : '';
                    }
                }
                
                // Handle borrower-specific fields from lookup
                if (borrSpecificFields.has(rawFieldId) && !fieldId.includes('#')) {
                    fieldId = `${fieldId}#1`;
                }
                
                return {
                    FieldID: `[${fieldId}]`,
                    Label: label,
                    CType: ctype,
                    Calendar: calendar,
                    Method: method
                };
            });

            // Update field count
            document.getElementById('fieldCount').textContent = `Fields: ${sortedFields.length}`;

            // Clear previous results
            const resultDiv = $('#result');
            resultDiv.empty();

            // Create table
            const table = $('<table>').addClass('table table-bordered').attr('id', 'resultTable');
            resultDiv.append(table);

            // Create DataTable
            const dataTable = $('#resultTable').DataTable({
                data: sortedFields.map((field, index) => ({
                    ...field,
                    Row: index + 1 // Start row numbering at 1
                })),
                columns: [
                    { data: 'Row', title: 'Row', width: '50px' },
                    { data: 'FieldID', title: 'Field ID' },
                    { data: 'Label', title: 'Label' },
                    { data: 'CType', title: 'CType' },
                    { data: 'Calendar', title: 'Calendar' },
                    { data: 'Method', title: 'Method' }
                ],
                pageLength: 10,
                lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
                dom: 'Bfrtip',
                buttons: [
                    'pageLength',
                    'copy',
                    'excel',
                    'pdf'
                ],
                order: [[0, 'asc']],
                responsive: true
            });

            // Make cells editable
            $('#resultTable tbody').on('click', 'td', function() {
                const cell = dataTable.cell(this);
                const columnIndex = cell.index().column;
                const rowIndex = cell.index().row;
                const currentValue = cell.data();
                
                // Create input element
                const input = $('<input>')
                    .addClass('form-control')
                    .val(currentValue)
                    .css({
                        'width': '100%',
                        'height': '100%',
                        'background-color': 'rgba(30, 40, 60, 0.95)',
                        'color': 'var(--ice-light)',
                        'border': '2px solid var(--ice-border)'
                    });
                
                // Replace cell content with input
                cell.data('');
                $(this).html(input);
                input.focus();
                
                // Handle input completion
                const handleInputComplete = function() {
                    const newValue = input.val();
                    cell.data(newValue);
                    
                    // If editing Row column, reorder the table
                    if (columnIndex === 0) {
                        const tableData = dataTable.data().toArray();
                        tableData.sort((a, b) => parseInt(a.Row) - parseInt(b.Row));
                        dataTable.clear();
                        dataTable.rows.add(tableData);
                        dataTable.draw();
                    }
                    
                    // Update the JSON textarea
                    const tableData = dataTable.data().toArray();
                    jsonTextarea.val(JSON.stringify(tableData, null, 2));
                };
                
                // Handle Enter key or focus loss
                input.on('keypress', function(e) {
                    if (e.which === 13) {
                        handleInputComplete();
                    }
                });
                
                input.on('blur', handleInputComplete);
            });

            // Add JSON output in an editable textarea
            const jsonContainer = $('<div>').addClass('mt-4');
            const jsonLabel = $('<label>').text('JSON Output (Editable)').addClass('form-label');
            const jsonTextarea = $('<textarea>')
                .addClass('form-control')
                .css('height', '300px')
                .val(JSON.stringify(sortedFields, null, 2));
            
            jsonContainer.append(jsonLabel);
            jsonContainer.append(jsonTextarea);
            resultDiv.append(jsonContainer);

            // Update current fields for search
            currentFields = sortedFields;
            populateFieldList(fields);

        } catch (error) {
            console.error('Error transforming XML:', error);
            showToast('Error transforming XML', 'error');
        }
    }

    // Handle field search
    document.getElementById('fieldSearch').addEventListener('input', function(e) {
        const searchValue = e.target.value;
        if (searchValue) {
            const matchingField = currentFields.find(field => 
                field.FieldID.includes(searchValue) || 
                field.Label.toLowerCase().includes(searchValue.toLowerCase())
            );
            if (matchingField) {
                console.log('Found matching field:', matchingField);
            }
        }
    });

    function copyToClipboard() {
        try {
            const jsonTextarea = $('#result textarea.form-control');
            if (!jsonTextarea.length || !jsonTextarea.val()) {
                showToast('No JSON data found! Please transform XML first.', 'error');
                return;
            }

            const text = jsonTextarea.val();
            navigator.clipboard.writeText(text)
                .then(() => {
                    showToast('Copied to clipboard!', 'success');
                })
                .catch(err => {
                    console.error('Failed to copy:', err);
                    showToast('Failed to copy to clipboard', 'error');
                });
        } catch (error) {
            console.error('Copy Error:', error);
            showToast('Error copying to clipboard: ' + error.message, 'error');
        }
    }

    function removeRowFromJSON() {
        try {
            const jsonTextarea = $('#result textarea.form-control');
            const jsonData = JSON.parse(jsonTextarea.val());
            const filteredData = jsonData.map(item => {
                const { Row, ...rest } = item;
                return rest;
            });
            jsonTextarea.val(JSON.stringify(filteredData, null, 2));
            showToast('Row element removed from JSON!');
        } catch (error) {
            showToast('Error removing Row element', 'error');
            console.error('Error:', error);
        }
    }

    function updateTableFromJSON() {
        try {
            const jsonTextarea = $('#result textarea.form-control');
            if (!jsonTextarea.length || !jsonTextarea.val()) {
                showToast('No JSON data found! Please transform XML first.', 'error');
                return;
            }

            const jsonData = JSON.parse(jsonTextarea.val());
            const table = $('#resultTable').DataTable();
            
            // Clear and update the table
            table.clear();
            table.rows.add(jsonData);
            table.draw();

            // Update the field count
            document.getElementById('fieldCount').textContent = `Fields: ${jsonData.length}`;

            showToast('Table updated from JSON successfully!', 'success');
        } catch (error) {
            console.error('Update Table Error:', error);
            showToast('Error updating table: ' + error.message, 'error');
        }
    }

    function updateJSONFromTable() {
        try {
            const table = $('#resultTable').DataTable();
            const jsonTextarea = $('#result textarea.form-control');
            
            if (!table || !jsonTextarea.length) {
                showToast('No table or textarea found!', 'error');
                return;
            }

            // Get the current table data
            const tableData = table.data().toArray();
            
            // Update the JSON textarea
            jsonTextarea.val(JSON.stringify(tableData, null, 2));

            // Update the field count
            document.getElementById('fieldCount').textContent = `Fields: ${tableData.length}`;

            showToast('JSON updated from table successfully!', 'success');
        } catch (error) {
            console.error('Update JSON Error:', error);
            showToast('Error updating JSON: ' + error.message, 'error');
        }
    }

    function removeEmptyValues() {
        try {
            const jsonTextarea = $('#result textarea.form-control');
            if (!jsonTextarea.length || !jsonTextarea.val()) {
                showToast('No JSON data found! Please transform XML first.', 'error');
                return;
            }

            const jsonData = JSON.parse(jsonTextarea.val());
            const cleanedData = jsonData.map(item => {
                const cleanedItem = {};
                Object.keys(item).forEach(key => {
                    if (item[key] !== "" && item[key] !== null && item[key] !== undefined) {
                        cleanedItem[key] = item[key];
                    }
                });
                return cleanedItem;
            });

            // Update the JSON textarea
            jsonTextarea.val(JSON.stringify(cleanedData, null, 2));

            // Update the table
            const table = $('#resultTable').DataTable();
            table.clear();
            table.rows.add(cleanedData);
            table.draw();

            // Update the field count
            document.getElementById('fieldCount').textContent = `Fields: ${cleanedData.length}`;

            showToast('Empty values removed successfully!', 'success');
        } catch (error) {
            console.error('Remove Empty Error:', error);
            showToast('Error removing empty values: ' + error.message, 'error');
        }
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', function() {
        loadReferenceFiles(); // Load reference files on startup
        document.getElementById('currentDate').textContent = new Date().toLocaleDateString();

        // Add file input handler
        document.getElementById('xmlFile').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('xmlInput').value = e.target.result;
                    showToast('XML file loaded successfully!');
                };
                reader.onerror = function() {
                    showToast('Error reading file', 'error');
                };
                reader.readAsText(file);
            }
        });
    });
