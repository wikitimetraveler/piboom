/**
 * FHA Streamline Calculations
 *
 * @file        fhaStreamlineCalculations.js
 * @author      David Lane
 * @version     1.0.0
 * @since       2024
 *
 * Core calculation engine backing the FHA Streamline worksheet, wiring DOM
 * inputs to reusable math helpers and keeping results in sync with user edits.
 */
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
    result.value = MathLib.sum(values);
  }

  subtractInputs(inputs, result) {
    if (!inputs || !result) return;
    const values = this.getNumericValues(inputs);
    result.value = MathLib.subtract(values);
  }

  truncateAndSumInputs(inputs, result) {
    if (!inputs || !result) return;
    const values = this.getNumericValues(inputs);
    result.value = MathLib.truncateAndSum(values);
  }

  minInputs(inputs, result) {
    if (!inputs || !result) return;
    const values = this.getNumericValues(inputs);
    const min = MathLib.min(values);
    result.value = min === null ? '' : min;
  }

  maxUFMPamount(inputs, result) {
    if (!inputs || !result) return;
    const [inputValue1, inputValue2] =  this.getNumericValues(inputs);
    result.value = MathLib.maxUFMPamount(inputValue1, inputValue2);
  }

  newUfmipFactor(inputs, result) {
    if (!inputs || !result) return;
    const inputDate = new Date(inputs[0].value);
    result.value = MathLib.newUfmipFactor(inputDate);
  }
}
