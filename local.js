'use strict';

const {S3} = require('aws-sdk');
const s3 = new S3();
const _ = require('lodash');
const handler = require('./handler');

let files = [];

const listS3Objects = (params, options = {}) => {
  return s3.listObjectsV2(params).promise().then((result) => {
    let keys = result.Contents.map((obj) => {
      return {bucket: params.Bucket, fileKey: obj.Key};
    });

    keys = _.reject(keys, (key) => {
      return key.fileKey.match(/\/$/);
    });
    if (options.startsWith) {
      keys = _.filter(keys, (key) => {
        return key.fileKey.startsWith(options.startsWith);
      });
    }
    if (options.pattern) {
      let regex = new RegExp(options.pattern);
      keys = _.filter(keys, (key) => {
        return key.fileKey.match(regex);
      });
    }

    files = files.concat(keys);

    if (result.IsTruncated) {
      let p = _.clone(params);
      p.StartAfter = _.last(result.Contents).Key;
      return listS3Objects(p, options);
    }
  });
};


listS3Objects({
  Bucket: process.env.FROM_S3_BUCKET,
  Prefix: process.env.FROM_S3_PREFIX
}, {
  startsWith: process.env.FROM_KEY_STARTS_WITH,
  pattern: process.env.FROM_KEY_PATTERN
}).then(() => {
  handler.copyFile({Records: files}, {}, (err, result) => {
    console.log(result);
  })
});
