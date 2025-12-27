/**
 * MathLib
 *
 * @file        math.js
 * @author      David Lane
 * @version     1.0.0
 * @since       2024
 *
 * A library of pure mathematical functions for financial calculations.
 */
const MathLib = {
  /**
   * Sums an array of numbers.
   * @param {number[]} values - An array of numbers to sum.
   * @returns {number} The sum of the numbers.
   */
  sum(values) {
    return values.reduce((acc, value) => acc + value, 0);
  },

  /**
   * Subtracts an array of numbers from the first element.
   * @param {number[]} values - An array of numbers to subtract.
   * @returns {number} The result of the subtraction.
   */
  subtract(values) {
    if (values.length === 0) {
      return 0;
    }
    return values.reduce((acc, value) => acc - value);
  },

  /**
   * Truncates and sums an array of numbers.
   * @param {number[]} values - An array of numbers to truncate and sum.
   * @returns {number} The sum of the truncated numbers.
   */
  truncateAndSum(values) {
    return values.map(Math.trunc).reduce((acc, value) => acc + value, 0);
  },

  /**
   * Finds the minimum value in an array of numbers.
   * @param {number[]} values - An array of numbers.
   * @returns {number} The minimum value.
   */
  min(values) {
    const min = Math.min(...values);
    return isFinite(min) ? min : null;
  },

  /**
   * Calculates the maximum UFMP amount.
   * @param {number} inputValue1 - The first input value.
   * @param {number} inputValue2 - The second input value.
   * @returns {number} The maximum UFMP amount.
   */
  maxUFMPamount(inputValue1, inputValue2) {
    const adjustedValue1 = inputValue1 - Math.round(inputValue1 * inputValue2 / (1 + inputValue2) * 100) / 100;
    return Math.trunc(adjustedValue1) * inputValue2;
  },

  /**
   * Determines the new UFMIP factor based on a date.
   * @param {Date} inputDate - The input date.
   * @returns {number} The new UFMIP factor.
   */
  newUfmipFactor(inputDate) {
    const comparisonDate = new Date('2009-05-31');
    if (!inputDate || isNaN(inputDate.getTime())) {
      return 0;
    }
    return inputDate < comparisonDate ? 0.0100 : 0.0175;
  }
};
