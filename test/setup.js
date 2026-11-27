'use strict'

// Silence application logging so test output stays clean. Tests that need to
// assert on logging can inspect these mocks directly, e.g.
// expect(console.log).toHaveBeenCalledWith(...)
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})
