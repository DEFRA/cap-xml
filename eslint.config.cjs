'use strict'

const globals = require('globals')

module.exports = [
  ...require('neostandard')({}),
  {
    languageOptions: {
      parserOptions: {
        requireConfigFile: false
      }
    }
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest
      }
    }
  }
]
