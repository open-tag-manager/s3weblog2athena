'use strict';

const {S3} = require('aws-sdk');
const task = require('promise-util-task');

const parseS3EventRecord = (record) => {
  if (!record.s3) {
    throw new Error('Invalid event. You need to set s3 event.');
  }
  if (record.eventName !== 'ObjectCreated:Put') {
    throw new Error('Invalid event. You need to set s3 Put event.');
  }
  let s3record = record.s3;

  return {bucket: s3record.bucket.name, fileKey: s3record.object.key};
};

exports.copyFile = (event, context, callback) => {
  if (!process.env.TO_S3_BUCKET) {
    throw new Error('Set TO_S3_BUCKET');
  }

  const outputInfo = process.env.TO_S3_BUCKET.match(/^s3:\/\/([^\/]+)\/?(.*)$/);

  if (!outputInfo) {
    throw new Error('Invalid TO_S3_BUCKET format, set s3://${bucketname}/${prefix}/');
  }

  const s3 = new S3();

  if (!(event.Records instanceof Array && event.Records.length >= 1)) {
    throw new Error('Invalid event. You need set valid event.');
  }

  const files = [];

  for (let record of event.Records) {
    if (record.EventSource === 'aws:sns') {
      let s3EeventRecord = JSON.parse(record.Sns.Message);
      for (let snsRecord of s3EeventRecord.Records) {
        files.push(parseS3EventRecord(snsRecord));
      }

      continue;
    }

    if (record.eventSource === 'aws:s3') {
      files.push(parseS3EventRecord(record));
      continue;
    }

    if (record.bucket) {
      files.push(record);
    }
  }

  task.limit((files.map((_file) => {
    const file = _file;
    return () => {
      console.log({message: 'Copy file from', file: file});

      let pattern = /([0-9]{4})-([0-9]{2})-([0-9]{2})-([0-9]{2})-[0-9]{2}-[0-9]{2}-[0-9A-F]{16}$/
      if (process.env.MODE === 'cloudfront') {
        pattern = /[A-Z0-9]+\.([0-9]{4})-([0-9]{2})-([0-9]{2})-[0-9]{2}\.[a-z0-9]+\.gz$/
      }

      const matched = file.fileKey.match(pattern);

      if (!matched) {
        console.log({message: 'File format is invalid', file: file});
        return Promise.resolve();
      }

      const year = parseInt(matched[1]);
      const month = parseInt(matched[2]);
      const day = parseInt(matched[3]);

      return s3.copyObject({
        Bucket: outputInfo[1],
        CopySource: `${file.bucket}/${file.fileKey}`,
        Key: `${outputInfo[2]}year=${year}/month=${month}/day=${day}/${matched[0]}`
      }).promise();
    };
  })), 30).then(() => {
    callback(null, 'Complete.')
  });
};
