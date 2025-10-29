/**
 * Screen Binding Class
 * Provides binding for any HTML page and ICE loan object.
 * 
 * @author David Lane
 * @date November 14, 2023
 * @class
 */
class ScreenBindings {
  constructor() {
    /** @type {Object|null} Represents the loan object */
    this.loanObject = null;
  }

  /**
   * Asynchronously binds field values from the loan object to HTML input elements.
   * Requires the `elli.script` object to be available in the global scope.
   */
  async bindFieldValues() {
    if (!elli || !elli.script) {
      console.error("Elli script not available.");
      return;
    }

    elli.script.subscribe("loan", "change", this.onLoanChange.bind(this));
    elli.script.guest.create("", document.head);
    this.loanObject = await elli.script.getObject("loan");

    const emidValues = await this.bindInputElements();
    console.log("List of input elements with emid attribute and their values:", emidValues);
  }

  /**
   * Handles changes to the loan object.
   * @param {Object} Loan - The loan object.
   * @param {Object} changeset - Details about the changes to the loan object.
   */
  async onLoanChange(Loan, changeset) {
    console.log("Loan object changed:", changeset);
    // Additional logic for loan change handling
  }

  /**
   * Processes the loan object, updating fields based on changes.
   * If the loan object is not available, logs an error.
   */
  processLoanObject() {
    if (!this.loanObject) {
      console.error("Loan object is not available.");
      return;
    }

    const emidToValueMap = this.createEmidToValueMap();
    this.loanObject.setFields(emidToValueMap);
    this.loanObject.merge();
    this.loanObject.calculate();
  }

  /**
   * Handles input change events and sets a custom attribute to mark the field as changed.
   * @param {Event} event - The DOM event triggered by the change.
   */
  handleChange(event) {
    event.target.setAttribute("changedvalue", "Y");
    console.log(`Input with EMID '${event.target.getAttribute("emid")}' changed to: ${event.target.value}`);
  }

  /**
   * Generates HTML elements based on provided input text and inserts them into the DOM.
   * The input text should contain lines with square-bracketed identifiers.
   */
  generateElements() {
    const inputText = document.getElementById("inputValues").value;
    const htmlOutput = this.buildHtmlOutput(inputText);
    document.getElementById("outputElements").innerHTML = htmlOutput;
  }

  // Private methods

  /**
   * Binds input elements with an 'emid' attribute to corresponding values from the loan object.
   * @returns {Promise<Array>} A promise that resolves to an array of objects with emid and value properties.
   */
  async bindInputElements() {
    const inputElementsWithEmid = document.querySelectorAll("input[emid], textarea[emid]");
    const emidValues = [];

    for (const inputElement of inputElementsWithEmid) {
        const emid = inputElement.getAttribute("emid");
        try {
            let val = await this.loanObject.getField(emid);

            // If val is undefined, set it to null
            if (typeof val === "undefined") {
                val = null;
            }

            console.log(`FieldId ${emid} has value: ${val}`);

            // Only update the field if val is not null and not empty
            if (val !== null ) {
                inputElement.value = val; 
                inputElement.setAttribute("changedvalue", "N"); // Mark as unchanged
            }

            // Bind event listener for input change
            inputElement.addEventListener("change", this.handleChange.bind(this));

            // Push the emid and its value to the array
            emidValues.push({ emid, value: val });

        } catch (error) {
            console.error(`Error retrieving value for FieldId ${emid}: ${error.message}`);
        }
    }

    return emidValues;
}



  /**
   * Creates a map of EMID attributes to their corresponding input values for changed fields.
   * @returns {Object} A map of emid attributes to their values.
   */
  createEmidToValueMap() {
    const inputElements = document.querySelectorAll('input[changedvalue="Y"][emid]');
    const emidToValueMap = {};
    inputElements.forEach(input => {
      emidToValueMap[input.getAttribute("emid")] = input.value;
      input.setAttribute("changedvalue", "N");
    });
    return emidToValueMap;
  }

  /**
   * Builds HTML output based on input text with square-bracketed identifiers.
   * @param {string} inputText - The input text to process.
   * @returns {string} HTML string of generated elements.
   */
  buildHtmlOutput(inputText) {
    return inputText.split("\n")
      .flatMap(line => line.match(/\[(.*?)\]/g) || [])
      .map(match => match.replace(/\[|\]|\s/g, ""))
      .map(value => `
        <label for="${value}">Label for ${value}: </label>
        <input type="text" id="${value}" name="${value}" emid="${value}">
        <br>
      `)
      .join("");
  }
}
