CREATE TABLE IF NOT EXISTS analytics.intent_metrics (
  timestamp DateTime64(3),
  actor_id String,
  session_id String,
  inputs_per_second Float32,
  aim_variance Float32,
  dropped_frames UInt32,
  region LowCardinality(String)
)
ENGINE = MergeTree
ORDER BY (timestamp, actor_id)
PARTITION BY toDate(timestamp);

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.intent_metrics_hourly
ENGINE = SummingMergeTree
PARTITION BY toStartOfHour(timestamp)
ORDER BY (actor_id, toStartOfHour(timestamp)) AS
SELECT
  toStartOfHour(timestamp) AS hour_bucket,
  actor_id,
  avg(inputs_per_second) AS avg_inputs,
  max(dropped_frames) AS max_drops
FROM analytics.intent_metrics
GROUP BY hour_bucket, actor_id;

