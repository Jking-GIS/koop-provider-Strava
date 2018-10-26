/*
  model.js

  This file is required. It must export a class with at least one public function called `getData`

  Documentation: http://koopjs.github.io/docs/specs/provider/
*/
const request = require('request').defaults({ gzip: true, json: true })
const config = require('config')
const terraformer = require('terraformer')

function Strava (koop) {}

// Public function to return data from the
// Return: GeoJSON FeatureCollection
//
// Config parameters (config/default.json)
// req.
//
// URL path parameters:
// req.params.host (if index.js:hosts true)
// req.params.id  (if index.js:disableIdParam false)
// req.params.layer
// req.params.method
Strava.prototype.getData = function (req, callback) {
  const clientSecret = config.Strava.clientSecret
  const clientId = config.Strava.clientId
  const refreshToken = config.Strava.refreshToken

  request.post({
    url: 'https://www.strava.com/oauth/token',
    form: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    }
  }, function (err, httpResponse, body) {
    if (err) {
      console.log('request failed: ' + err)
      return
    }

    console.log(req.query)
    var polyBounds = new terraformer.Primitive({
      'type': 'Polygon',
      'coordinates': [
        [ [req.query.geometry.xmin, req.query.geometry.ymin],
          [req.query.geometry.xmin, req.query.geometry.ymax],
          [req.query.geometry.xmax, req.query.geometry.ymax],
          [req.query.geometry.xmax, req.query.geometry.ymin] ]
      ]
    })
    console.log(polyBounds)
    console.log(polyBounds.toGeographic())
    console.log(polyBounds.toMercator())

    var normalizedMin = [0, 0]
    var normalizedMax = [0, 0]
    if (req.query.geometry) {
      normalizedMin = webMercatorUtils.xyToLngLat(req.query.geometry.xmin, req.query.geometry.ymin)
      normalizedMax = webMercatorUtils.xyToLngLat(req.query.geometry.xmax, req.query.geometry.ymax)
    }
    var normalizedBounds = normalizedMin[1] + ',' +
      normalizedMin[0] + ',' +
      normalizedMax[1] + ',' +
      normalizedMax[0]
    var accessToken = body.access_token
    var requestOptions = {
      url: 'https://www.strava.com/api/v3/segments/explore',
      form: {
        activity_type: req.query.activity_type ? req.query.activity_type : 'riding',
        min_cat: req.query.min_cat ? req.query.min_cat : 0,
        max_cat: req.query.max_cat ? req.query.max_cat : 5,
        bounds: req.query.bounds ? req.query.bounds : normalizedBounds,
        access_token: accessToken
      }
    }

    // Call the remote API with our developer key
    request.get(requestOptions, (err, res, body) => {
      if (err) return callback(err)

      // translate the response into geojson
      const geojson = translate(body.segments)

      // Optional: cache data for 10 seconds at a time by setting the ttl or "Time to Live"
      // geojson.ttl = 10

      // Optional: Service metadata and geometry type
      // geojson.metadata = {
      //   title: 'Koop Sample Provider',
      //   description: `Generated from ${url}`,
      //   geometryType: 'Polygon' // Default is automatic detection in Koop
      // }

      // hand off the data to Koop
      callback(null, geojson)
    })
  })
}

function translate (input) {
  return {
    type: 'FeatureCollection',
    features: input.map(formatFeature)
  }
}

function formatFeature (inputFeature) {
  // Most of what we need to do here is extract the longitude and latitude
  const feature = {
    type: 'Feature',
    properties: inputFeature,
    geometry: {
      type: 'LineString',
      coordinates: decodePoly(inputFeature.points)
    }
  }
  // But we also want to translate a few of the date fields so they are easier to use downstream
  /* const dateFields = ['expires', 'serviceDate', 'time']
  dateFields.forEach(field => {
    feature.properties[field] = new Date(feature.properties[field]).toISOString()
  }) */
  return feature
}

function decodePoly (encodedString) {
  var codeChunks = []
  var codeChunk = []
  var coord = []

  var i; var x = 0; var y = 0
  for (i = 0; i < encodedString.length; i++) {
    codeChunk[x] = encodedString.charCodeAt(i) - 63
    if ((codeChunk[x] & 0x20) === 0x0) {
      codeChunk = codeChunk.reverse()
      var j; var codeChunkString = ''

      var zerosToAdd = 8 - ((codeChunk.length * 5) % 8)
      for (j = 0; j < zerosToAdd; j++) {
        codeChunkString = codeChunkString + '0'
      }

      for (j = 0; j < codeChunk.length; j++) {
        codeChunk[j] = codeChunk[j].toString(2)
        codeChunk[j] = '00000'.substr(codeChunk[j].length) + codeChunk[j]
        codeChunkString = codeChunkString + codeChunk[j]
      }

      var codeChunkBin = parseInt(codeChunkString, 2)
      if (codeChunkBin & 0x1) {
        codeChunkBin = ~(codeChunkBin >> 1)
        codeChunkBin = codeChunkBin - 0x1
        codeChunkBin = ~(codeChunkBin >> 1)
        codeChunkBin = codeChunkBin * -1
        codeChunkBin = codeChunkBin << 1
      } else {
        codeChunkBin = codeChunkBin >> 1
      }

      codeChunkBin = codeChunkBin / 100000
      coord[y % 2] = codeChunkBin

      if ((y % 2) === 1) {
        codeChunks[Math.floor(y / 2)] = coord.reverse()
        if (y > 1) {
          codeChunks[Math.floor(y / 2)][0] = codeChunks[Math.floor(y / 2)][0] + codeChunks[Math.floor(y / 2) - 1][0]
          codeChunks[Math.floor(y / 2)][1] = codeChunks[Math.floor(y / 2)][1] + codeChunks[Math.floor(y / 2) - 1][1]
        }
        coord = []
      }

      y++
      x = 0
      codeChunk = []
    } else {
      codeChunk[x] = codeChunk[x] & 0x1F
      x++
    }
  }

  return codeChunks
}

module.exports = Strava
