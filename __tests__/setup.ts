import "@testing-library/jest-dom";

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = originalFetch;
});

afterEach(() => {
  jest.restoreAllMocks();
});
