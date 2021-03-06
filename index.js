/*
  index.js

  This file is required. It's role is to specify configuration settings.

  Documentation: http://koopjs.github.io/docs/specs/provider/
*/

// Define the provider path
// /:name/:hosts?/:disableIdParam?/FeatureServer/:layer/:method
// e.g. /sample/FeatureServer/0/query
const provider = {
  name: 'Strava',
  type: 'provider',
  version: require('./package.json').version,
  Model: require('./Strava'),
  hosts: false, // if true, also adds disableIdParam
  disableIdParam: true, // if true, adds to path and req.params
  routes: require('./routes'),
  Controller: require('./controller')
}

module.exports = provider
