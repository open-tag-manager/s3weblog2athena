# s3weblog2athena

This product make prefer file name format for Athena partition.

Copyright

see ./LICENSE

## Motivation

Want you analyze S3 web log? However, S3 web log format is not prefer for AWS Athena.
Because all of the Object is created to same prefix.

```
2016-11-01-23-23-48-AAAAAAAAAAAAAAAA
2016-11-01-23-24-12-AAAAAAAAAAAAAAAA
2016-11-01-23-24-28-AAAAAAAAAAAAAAAA
2016-11-01-23-25-04-AAAAAAAAAAAAAAAA
2016-11-01-23-25-08-AAAAAAAAAAAAAAAA
...
```

By using this product, you can change Object prefix to Athena friendly one!

```
year=2016/month=11/day=1/2016-11-01-23-23-48-AAAAAAAAAAAAAAAA
year=2016/month=11/day=1/2016-11-01-23-24-12-AAAAAAAAAAAAAAAA
year=2016/month=11/day=1/2016-11-01-23-24-28-AAAAAAAAAAAAAAAA
year=2016/month=11/day=1/2016-11-01-23-25-04-AAAAAAAAAAAAAAAA
year=2016/month=11/day=1/2016-11-01-23-25-08-AAAAAAAAAAAAAAAA
...
```

## Table on AWS Athena

Make Athena table by suing following DDL:

NOTE: replace `${TableName}`, `${BucketName}`, `${Prefix}`

```
CREATE EXTERNAL TABLE IF NOT EXISTS ${TableName} (
`bucket_owner` string,
`bucket` string,
`datetime` string,
`remote_ip` string,
`requester` string,
`request_id` string,
`operation` string,
`key` string,
`request_uri` string,
`http_status` string,
`error_code` string,
`bytes_sent` string,
`object_size` string,
`total_time` string,
`turn_around_time` string,
`referrer` string,
`user_agent` string,
`version_id` string
 )
 PARTITIONED BY (year int, month int, day int)
 ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.RegexSerDe'
 WITH SERDEPROPERTIES (
 'serialization.format' = '1',
 'input.regex' = '^([^ ]+) ([^ ]+) \\[(.*)\\] ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ["](.*)["] ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ["](.*)["] ["](.*)["] ([^ ]+)$'
 ) LOCATION 's3://${BucketName}/${Prefix}/'
 TBLPROPERTIES ('has_encrypted_data'='false');
```

## Reformat S3 WebLog data for Athena

### Prepare bucket for Athena

Prepare bucket to save formatted data.

### Copy file by Batch (local)

```
docker build -t s3weblog2athena:latest .
```

```
docker run \
  -e 'AWS_PROFILE=profile' \
  -e 'FROM_S3_BUCKET=bucketname' \
  -e 'FROM_S3_PREFIX=from/' \
  [-e 'FROM_KEY_STARTS_WITH=from/2016-11-'] \
  [-e 'MODE=cloudfront'] \
  -e 'TO_S3_BUCKET=s3://bucketname/prefix/' \
  -it -v ~/.aws:/root/.aws s3weblog2athena:latest
```

It allows you to execute on AWS Batch by pushing to Amazon ECR.

You can use MODE environment variable to transform CloudFront log.

### Copy file by AWS Lambda

Install serverless on your environment:

```
npm install -g serverless
npm install -g yarn
```

Copy `config/sample.yml` to `config/prod.yml` and configure it.

```
# target bucket (write only)
TO_S3_BUCKET: 'bucketname'
# target bucket prefix
TO_S3_PREFIX: 'target/'
# source bucket (read only)
FROM_S3_BUCKET: 'frombucketname'
# SNS ARN to get putObject event from S3
SNS_ARN: 'arn:aws:sns:region:xxxxx'
# Choose MODE from s3 or cloudfront
MODE: 's3'
```

Then you can deploy.

NOTE: The following command will make CloudFormation Stack. It includes Bucket creation, Role creation,
SNS subscription configuration, Log configuration and Lambda configuration.
Please make sure your IAM role.

```
yarn install
AWS_PROFILE=profile sls deploy --stage prod
```

## Query

You need make partition before you execute query. It allows you to load all partitions automatically by using following command:


```
MSCK REPAIR TABLE ${tableName}
```

Then you can get query result. Please make sure the query includes partition keys to reduce data scan. 
 (Partition keys: `year`, `month`, `day`)

```
SELECT * FROM ${tableName} WHERE year = 2016 AND month = 11 AND day = 1 LIMIT 10;
```
