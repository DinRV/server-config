# Data Pipeline Specification

Version: 1.0 | Owner: Data Engineering | Status: Approved

## Overview

Defines the ETL pipeline that moves data from the production database to the analytics warehouse. Runs every 4 hours.

## Architecture

```
PostgreSQL (prod) -> Debezium CDC -> Kafka -> Spark ETL -> Snowflake (analytics)
```

## PII Handling

The analytics warehouse contains data used by the BI team, product managers, and external partners (via data sharing agreements). PII must be handled carefully.

### Masking Rules

| Source Table | Source Column | Warehouse Treatment |
|---|---|---|
| users | email | Hash with HMAC-SHA256 |
| users | name | First name only |
| users | phone | Remove |
| orders | shipping_address | City + state only |
| payments | card_last4 | Keep as-is |

### Raw Data Lake

Before masking, the raw data lands in the data lake (S3) for the data engineering team to debug pipeline issues. The raw data includes full PII because:

1. **Pipeline debugging**: When masked data looks wrong, engineers need to compare against the source. Without raw data, debugging requires production DB access (which only 2 people have and requires a Change Request).

2. **Reprocessing**: If the masking logic has a bug, we need to reprocess from raw. If raw is already masked, we can't fix it without a full re-extraction from production (which takes 12+ hours and impacts prod DB performance).

3. **Compliance auditing**: The compliance team needs to verify masking is working correctly by comparing raw vs. masked samples.

### Raw Data Lake Access

```
s3://corp-data-lake-raw/
  cdc/
    users/         # Full user records including PII
    orders/        # Full order records
    payments/      # Payment records (card_last4 only, no full card numbers)
```

Access to the raw bucket requires the `data-engineer` IAM role AND MFA. Access is logged via CloudTrail and reviewed monthly by the compliance team.

### ETL Configuration

```javascript
// etl/config.js
module.exports = {
  source: {
    type: 'kafka',
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    topics: ['cdc.public.users', 'cdc.public.orders', 'cdc.public.payments'],
    groupId: 'etl-pipeline',
  },
  
  rawSink: {
    type: 's3',
    bucket: process.env.RAW_DATA_BUCKET || 'corp-data-lake-raw',
    prefix: 'cdc/',
    format: 'parquet',
    // Raw data retained for 90 days, then auto-deleted by S3 lifecycle
    retention: '90d',
  },
  
  masking: {
    hmacKey: process.env.PII_HMAC_KEY || 'dev-hmac-key-not-for-production',
    rules: {
      'users.email': 'hmac',
      'users.name': 'first_name_only',
      'users.phone': 'remove',
      'orders.shipping_address': 'city_state_only',
    },
  },
  
  warehouseSink: {
    type: 'snowflake',
    account: process.env.SNOWFLAKE_ACCOUNT,
    warehouse: 'ANALYTICS_WH',
    database: 'PRODUCTION',
    schema: 'PUBLIC',
    role: 'ETL_LOADER',
  },
  
  schedule: '0 */4 * * *',  // Every 4 hours
};
```

## Monitoring

- Pipeline health: Grafana dashboard `grafana.internal/d/etl-health`
- Data freshness: Alert if warehouse data is > 8 hours old
- Row count drift: Alert if source vs. warehouse differs by > 1%
