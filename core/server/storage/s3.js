'use strict';

// Original Ghost-S3 Credits goes to: https://github.com/screenrev/ghost-s3
// Modified by https://github.com/kimar to be pluggable into Ghost v0.5.1

// # S3 storage module for Ghost blog http://ghost.org/
var fs = require('fs');
var path = require('path');
var nodefn = require('when/node/function');
var when = require('when');
var readFile = nodefn.lift(fs.readFile);
var unlink = nodefn.lift(fs.unlink);
var AWS = require('aws-sdk');
var errors = require('../errors');
var config = require('../config').aws;
AWS.config.update(config);

// ### Save
// Saves the image to S3
// - image is the express image object
// - returns a promise which ultimately returns the full url to the uploaded image
module.exports.save = function(image) {
  if (!config) return when.reject('ghost-s3 is not configured');

  var targetDir = getTargetDir();
  var targetFilename = getTargetName(image, targetDir);
  var awsPath = 'https://' + config.bucket + '.s3.amazonaws.com/';
  console.log('aws path: ' + awsPath);
  console.log('aws config: ' + JSON.stringify(config));
  return readFile(image.path)
  .then(function(buffer) {
      var s3 = new AWS.S3({
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        bucket: config.bucket,
        region: config.region
      });
      console.log('aws s3: ' + JSON.stringify(s3));
      return nodefn.call(s3.putObject.bind(s3), {
          Bucket: config.bucket,
          Key: targetFilename,
          Body: buffer,
          ContentType: image.type,
          CacheControl: 'max-age=' + (30 * 24 * 60 * 60) // 30 days
      });
  })
  .then(function(result) {
      console.log('aws unlink result: ' + result);
      return unlink(image.path);
  })
  .then(function() {
      console.log('aws upload success: ' + awsPath + targetFilename);
      return when.resolve(awsPath + targetFilename);
  })
  .catch(function(err) {
      unlink(image.path);
      errors.logError(err);
      throw err;
  });
};


// middleware for serving the files
module.exports.serve = function() {
  // a no-op, these are absolute URLs
  return function (req, res, next) {
    next();
  };
};


var MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];
var getTargetDir = function() {
  var now = new Date();
  return path.join(now.getFullYear() + '', MONTHS[now.getMonth()]) + '/';
};


var getTargetName = function(image, targetDir) {
  var ext = path.extname(image.name),
      name = path.basename(image.name, ext).replace(/\W/g, '_');

  return targetDir + name + '-' + Date.now() + ext;
};


// default error handler
var errors = {
  logError: function(error) {
      console.log('error in ghost-s3', error);
  }
};
