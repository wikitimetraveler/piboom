class Scenarios {
    constructor() {
        // Constructor can be used for initialization if needed
    }

    populateInputs(data) {
        // Select all input and select elements with the 'emid' attribute
        const elements = document.querySelectorAll('input[emid], select[emid]');
      
        // Loop through the elements and populate them
        elements.forEach(element => {
            // Use the value of the 'emid' attribute to match the property in the JSON object
            const key = element.getAttribute('emid');
            if (data[key] !== undefined) {
                if(element.tagName === 'SELECT') {
                    // For select elements, set the value property
                    element.value = data[key];
                } else {
                    // Handle different types of input elements if necessary
                    switch(element.type) {
                        case 'date':
                            // Convert and format date if necessary
                            element.value = data[key]; // Assuming date is in 'YYYY-MM-DD' format
                            break;
                        case 'checkbox':
                            // Check or uncheck checkbox
                            element.checked = data[key];
                            break;
                        default:
                            // For other input types, set the value directly
                            element.value = data[key];
                    }
                }
            }
        });
    }
}

function onPopulateButtonClick() {
    const scenarios = new Scenarios();
    const data = {
        'CX.FHA.SL.MIN.BAL': 0.00,
        // Assuming '1134' key is corrected to be unique
        '1134': 0.00,
        'CX.FHA.SL.UFMIP.MAX.APP': 0.00,
        'CX.FHA.SL.MIP.DUE.EXST': 222.00,
        // Other unique key for '1134' if necessary
        'CX.FHA.SL.FORBEARANCE': 'noLateCharges'
    };

    scenarios.populateInputs(data);
}
