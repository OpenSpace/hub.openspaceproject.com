const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  upload: {
    type: Boolean,
    required: true,
    default: true
  },
  signin: {
    type: Boolean,
    required: true,
    default: true
  },
  versions: {
    type: Array,
    required: true,
    default: [
      '0.21.2',
      '0.21.1',
      '0.21.0',
      '0.20.1',
      '0.20.0',
      '0.19.2',
      '0.19.1',
      '0.19.0',
      '0.18.2',
      '0.18.1',
      '0.18.0',
      '0.17.2'
    ]
  },
  itemTypes: {
    type: Array,
    required: true,
    default: ['asset', 'profile', 'recording', 'webpanel', 'config']
  },
  licenses: {
    type: Array,
    required: true,
    default: [
      'CC BY',
      'CC BY-SA',
      'CC BY-NC',
      'CC BY-NC-SA',
      'CC BY-ND',
      'CC BY-NC-ND',
      'CC0',
      'MIT',
      'Apache',
      'GPL',
      'LGPL',
      'BSD',
      'Proprietary'
    ]
  }
});

module.exports = mongoose.model('configs', configSchema);
