class FhaStreamlineCalculations {
  constructor(config) {
    this.groups = config.groups;
    this.inputElements = {};
    this.initializeGroups();
  }

  initializeGroups() {
    this.groups.forEach(group => {
      const inputElements = group.inputIds.map(id => document.getElementById(id));
      const resultElement = document.getElementById(group.resultId);

      if (!inputElements.every(element => element) || !resultElement) {
        console.error('Invalid group configuration:', group);
        return;
      }

      this.inputElements[group.resultId] = { inputs: inputElements, result: resultElement }
      const debouncedUpdate = this.debounce(() => this.updateResult(group.calculation, group.resultId), 50);

      inputElements.forEach(input => {
        input.addEventListener('input', debouncedUpdate);
      });
    });
  }

  debounce(func, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  }

  getNumericValues(inputs) {
    return inputs.map(input => parseFloat(input.value) || 0);
  }

  extractDateValues(inputs) {
    return inputs.map(input => new Date(input.value));
  }

  updateResult(calculation, resultId) {
    const group = this.inputElements[resultId];
    if (group && typeof this[calculation] === 'function') {
      try {
        this[calculation](group.inputs, group.result);
      } catch (error) {
        console.error('Error during calculation:', calculation, error);
      }
    }
  }

  recalculateAll() {
    this.groups.forEach(group => {
      this.updateResult(group.calculation, group.resultId);
    });
  }

  sumInputs(inputs, result) {
    if (!inputs || !result) return;
    const values = this.getNumericValues(inputs);
    const total = values.reduce((acc, value) => acc + value, 0);
    result.value = total;
  }

  subtractInputs(inputs, result) {
    if (!inputs || !result) return;
    const values = this.getNumericValues(inputs);
    const total = values.reduce((acc, value) => acc - value);
    result.value = total;
  }

  truncateAndSumInputs(inputs, result) {
    if (!inputs || !result) return;
    const truncatedValues = this.getNumericValues(inputs).map(Math.trunc);
    const total = truncatedValues.reduce((acc, value) => acc + value, 0);
    result.value = total;
  }

  minInputs(inputs, result) {
    if (!inputs || !result) return;
    const values = this.getNumericValues(inputs);
    const min = Math.min(...values);
    result.value = isFinite(min) ? min : '';
  }

  maxUFMPamount(inputs, result) {
    if (!inputs || !result) return;
    const [inputValue1, inputValue2] =  this.getNumericValues(inputs);
    const adjustedValue1 = inputValue1 - Math.round(inputValue1 * inputValue2 / (1 + inputValue2) * 100) / 100;
    result.value = Math.trunc(adjustedValue1) * inputValue2;
  }

  newUfmipFactor(inputs, result) {
    if (!inputs || !result) return;

    // Define the date to compare against (January 1, 2024)
    const comparisonDate = new Date('2009-05-31');

    // Get the input date value
    const inputDateValue = inputs[0].value;

    // Check if the input date is empty or invalid
    if (!inputDateValue || isNaN(Date.parse(inputDateValue))) {
        result.value = 0;
        return;
    }

    // Convert the input date to a Date object
    const inputDateObj = new Date(inputDateValue);

    // Check if the input date is before or after January 1, 2024
    const isBeforeComparisonDate = inputDateObj < comparisonDate;

    // Set the result based on the date comparison
    result.value = isBeforeComparisonDate ? .0100 : .0175;
}

  }

