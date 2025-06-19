import '@testing-library/jest-dom';

// Suppress console errors from JSDOM network issues and React act warnings
const originalError = console.error;
console.error = (...args: any[]) => {
  // Suppress specific network-related errors and React act warnings
  if (
    args[0]?.toString().includes('AggregateError') ||
    args[0]?.toString().includes('xhr-utils.js') ||
    args[0]?.toString().includes('XMLHttpRequest-impl.js') ||
    args[0]?.toString().includes('was not wrapped in act') ||
    args[0]?.toString().includes('When testing, code that causes React state updates')
  ) {
    return;
  }
  originalError(...args);
};