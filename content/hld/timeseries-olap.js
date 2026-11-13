SD.register({
  id: "timeseries-olap",
  html: String.raw`
    <p class="lead">The databases behind your app (Postgres, MySQL, DynamoDB) are built to read and write a few rows at a time, very fast and very often. Analytics asks a different kind of question: "total orders per city per hour for the last 30 days" touches millions of rows but only three columns. <strong>Analytics (OLAP) databases</strong> and <strong>time-series databases</strong> store data by column, compress it heavily and scan it in bulk, answering such questions in milliseconds to seconds. They show up in interviews whenever the problem says "dashboard", "metrics", "count events" or "top K".</p>

    <h2>OLTP vs OLAP</h2>
    <p><strong>OLTP</strong> (online transaction processing) runs the business: place an order, update a wallet. <strong>OLAP</strong> (online analytical processing) analyses the business: revenue by city, funnel conversion, p99 latency per service.</p>
    <table>
      <thead><tr><th>Aspect</th><th>OLTP</th><th>OLAP</th></tr></thead>
      <tbody>
        <tr><td>Typical query</td><td>Read/write one order by id</td><td>Aggregate millions of orders by city and hour</td></tr>
        <tr><td>Rows touched per query</td><td>1 to 100</td><td>Millions to billions</td></tr>
        <tr><td>Columns touched</td><td>Most columns of a row</td><td>A few columns of a wide table</td></tr>
        <tr><td>Writes</td><td>Many small inserts/updates, transactions</td><td>Bulk or streaming appends; rare updates</td></tr>
        <tr><td>Users</td><td>Millions of end users</td><td>Analysts, dashboards, internal tools (or user-facing analytics)</td></tr>
        <tr><td>Latency goal</td><td>Milliseconds</td><td>Milliseconds to seconds (real-time OLAP) up to minutes (warehouse)</td></tr>
        <tr><td>Storage layout</td><td>Row-oriented, B-tree indexes</td><td>Column-oriented, compressed, sorted</td></tr>
        <tr><td>Examples</td><td>PostgreSQL, MySQL, Oracle, DynamoDB</td><td>ClickHouse, Druid, Pinot, BigQuery, Snowflake, Redshift</td></tr>
      </tbody>
    </table>
    <div class="callout warn"><strong>Don't run analytics on the primary</strong>A heavy <code>GROUP BY</code> over a year of orders on the production database evicts hot pages from the buffer pool and can slow checkout for everyone. At minimum, run reports on a replica; at scale, ship data to an OLAP store.</div>

    <h2>Row vs column storage</h2>
    <p>A row store writes all columns of a row together. That is perfect for "fetch order 1042" (one disk page has everything) but wasteful for "sum of amount", which must read every column of every row just to use one. A column store writes each column separately, so a query reads only the columns it needs.</p>
    <figure class="svg-fig">
      <svg viewBox="0 0 640 300">
        <text class="s-title" x="160" y="24" text-anchor="middle">Row-oriented (OLTP)</text>
        <rect class="s-accent" x="20" y="40" width="280" height="34" rx="10"/>
        <text class="s-text" x="160" y="62" text-anchor="middle">1 | Pune | 450 | 2026-11-01</text>
        <rect class="s-box" x="20" y="82" width="280" height="34" rx="10"/>
        <text class="s-text" x="160" y="104" text-anchor="middle">2 | Delhi | 320 | 2026-11-01</text>
        <rect class="s-box" x="20" y="124" width="280" height="34" rx="10"/>
        <text class="s-text" x="160" y="146" text-anchor="middle">3 | Pune | 910 | 2026-11-02</text>
        <rect class="s-box" x="20" y="166" width="280" height="34" rx="10"/>
        <text class="s-text" x="160" y="188" text-anchor="middle">4 | Pune | 275 | 2026-11-02</text>
        <text class="s-muted" x="160" y="226" text-anchor="middle">one row = one contiguous record</text>
        <text class="s-muted" x="160" y="246" text-anchor="middle">great: fetch order 1</text>
        <text class="s-muted" x="160" y="266" text-anchor="middle">wasteful: SUM(amount) reads everything</text>

        <text class="s-title" x="480" y="24" text-anchor="middle">Column-oriented (OLAP)</text>
        <rect class="s-box" x="340" y="40" width="60" height="160" rx="10"/>
        <text class="s-muted" x="370" y="60" text-anchor="middle">id</text>
        <text class="s-text" x="370" y="90" text-anchor="middle">1</text>
        <text class="s-text" x="370" y="118" text-anchor="middle">2</text>
        <text class="s-text" x="370" y="146" text-anchor="middle">3</text>
        <text class="s-text" x="370" y="174" text-anchor="middle">4</text>
        <rect class="s-box" x="410" y="40" width="70" height="160" rx="10"/>
        <text class="s-muted" x="445" y="60" text-anchor="middle">city</text>
        <text class="s-text" x="445" y="90" text-anchor="middle">Pune</text>
        <text class="s-text" x="445" y="118" text-anchor="middle">Delhi</text>
        <text class="s-text" x="445" y="146" text-anchor="middle">Pune</text>
        <text class="s-text" x="445" y="174" text-anchor="middle">Pune</text>
        <rect class="s-green" x="490" y="40" width="60" height="160" rx="10"/>
        <text class="s-muted" x="520" y="60" text-anchor="middle">amount</text>
        <text class="s-text" x="520" y="90" text-anchor="middle">450</text>
        <text class="s-text" x="520" y="118" text-anchor="middle">320</text>
        <text class="s-text" x="520" y="146" text-anchor="middle">910</text>
        <text class="s-text" x="520" y="174" text-anchor="middle">275</text>
        <rect class="s-box" x="560" y="40" width="70" height="160" rx="10"/>
        <text class="s-muted" x="595" y="60" text-anchor="middle">date</text>
        <text class="s-text" x="595" y="90" text-anchor="middle">11-01</text>
        <text class="s-text" x="595" y="118" text-anchor="middle">11-01</text>
        <text class="s-text" x="595" y="146" text-anchor="middle">11-02</text>
        <text class="s-text" x="595" y="174" text-anchor="middle">11-02</text>
        <text class="s-muted" x="485" y="226" text-anchor="middle">each column stored in its own file</text>
        <text class="s-muted" x="485" y="246" text-anchor="middle">SUM(amount) reads only the green column</text>
        <text class="s-muted" x="485" y="266" text-anchor="middle">"Pune, Delhi, Pune, Pune" compresses well</text>
      </svg>
      <figcaption>The same four orders stored by row and by column. An aggregate over one column reads a quarter of the data in the column layout, and real tables have 50 to 200 columns.</figcaption>
    </figure>
    <h3>Why column stores are so fast</h3>
    <ul>
      <li><strong>Read only needed columns</strong>: a query on 3 of 100 columns reads about 3% of the data.</li>
      <li><strong>Compression</strong>: a column holds values of one type, often repetitive. Dictionary encoding (store "Pune" once, then small integer codes), run-length encoding (sorted "Pune ×40,000"), delta encoding for timestamps, and then LZ4/ZSTD on top. Ratios of 5x to 10x or more are common, so less disk I/O and more data fits in memory.</li>
      <li><strong>Vectorised execution</strong>: instead of processing one row at a time, the engine processes a batch of thousands of values from one column in a tight loop, using SIMD CPU instructions (one instruction on 8 or 16 values). ClickHouse is famous for this.</li>
      <li><strong>Sorting and skipping</strong>: data is sorted by a key (for example <code>(city, date)</code>), and each block stores min/max values, so whole blocks that cannot match a filter are skipped.</li>
      <li><strong>Massively parallel</strong>: data is split across nodes and cores; each scans its part and partial aggregates are merged.</li>
    </ul>
    <p>The cost: inserting or updating one row touches every column file, so column stores want <strong>batched appends</strong> and dislike point updates and deletes.</p>

    <h2>Time-series databases</h2>
    <p>A <strong>time series</strong> is a sequence of (timestamp, value) points for one thing: CPU of host 12, orders per minute in Bengaluru, temperature of sensor 9. A series is identified by a metric name plus labels (tags), for example <code>http_requests_total{service="checkout", status="500"}</code>. Time-series databases (TSDBs) are tuned for this shape:</p>
    <ul>
      <li>Writes are almost all appends of recent data, at very high rates (millions of points per second across a fleet).</li>
      <li>Reads are ranges over recent time, usually aggregated: rate, average, percentiles per 1-minute window.</li>
      <li>Old data is less valuable, so it is downsampled and eventually deleted.</li>
    </ul>
    <table>
      <thead><tr><th>Database</th><th>Model</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td>Prometheus</td><td>Pulls (scrapes) metrics from targets every 15 to 60 s; PromQL queries</td><td>The default for infrastructure and service metrics with Grafana; local storage with default 15-day retention; Thanos, Cortex/Mimir or VictoriaMetrics for long-term, global storage</td></tr>
        <tr><td>InfluxDB</td><td>Push-based; measurement + tags + fields</td><td>Popular for IoT and app metrics; built-in retention and downsampling tasks</td></tr>
        <tr><td>TimescaleDB</td><td>PostgreSQL extension; "hypertables" chunked by time</td><td>Full SQL and joins with relational data; continuous aggregates and native compression</td></tr>
      </tbody>
    </table>
    <h3>Compression</h3>
    <p>Facebook's Gorilla paper showed how predictable metrics are: timestamps arrive at regular intervals, so store the <em>delta of the delta</em> (usually 0); consecutive float values are similar, so XOR each with the previous one and store only the changed bits. The result averaged about 1.37 bytes per point instead of 16. Prometheus uses a similar scheme.</p>
    <h3>Downsampling and retention</h3>
    <p>Nobody needs per-second CPU data from last year. A typical policy:</p>
    <div data-diagram="downsample" data-caption="Tiered retention: raw points are kept briefly; rolled-up aggregates live longer at lower resolution."></div>
    <p>Store min, max, sum and count for each rollup window, not just the average, so you can still compute correct averages and spot spikes after downsampling. (Percentiles cannot be merged from averages; keep histograms or sketches if you need p99 over old data.)</p>
    <h3>High cardinality: the classic trap</h3>
    <p><strong>Cardinality</strong> is the number of unique series, which is the product of the distinct values of every label. <code>http_requests{service, endpoint, status}</code> with 50 × 40 × 5 = 10,000 series is fine. Add <code>user_id</code> with 10 million users and you have 100 billion potential series: each needs its own index entry and in-memory head, and the TSDB runs out of memory. Rules: labels must have small, bounded value sets (service, region, status code). Per-user or per-order data belongs in logs, traces or an OLAP store, not in metrics labels.</p>

    <h2>OLAP databases and data warehouses</h2>
    <table>
      <thead><tr><th>System</th><th>Type</th><th>Sweet spot</th><th>Known users</th></tr></thead>
      <tbody>
        <tr><td>ClickHouse</td><td>Open-source column store (MergeTree engine)</td><td>Very fast SQL aggregates over billions of rows; logs, events, product analytics</td><td>Originally Yandex.Metrica; Cloudflare analytics, Uber logging; Zomato has written about logging on ClickHouse</td></tr>
        <tr><td>Apache Druid</td><td>Real-time OLAP, segments by time</td><td>Sub-second slice-and-dice on streaming event data with high concurrency</td><td>Netflix, Airbnb, Walmart</td></tr>
        <tr><td>Apache Pinot</td><td>Real-time OLAP, built at LinkedIn</td><td>User-facing analytics: thousands of queries/sec at low latency on fresh data</td><td>LinkedIn ("Who viewed your profile"), Uber Eats restaurant dashboards</td></tr>
        <tr><td>Google BigQuery</td><td>Serverless warehouse (Dremel)</td><td>Ad-hoc SQL over petabytes, pay per bytes scanned</td><td>Many startups and enterprises on GCP</td></tr>
        <tr><td>Snowflake</td><td>Cloud warehouse; storage separate from compute</td><td>Independent "virtual warehouses" per team scale up and down; data sharing</td><td>Enterprises on any cloud</td></tr>
        <tr><td>Amazon Redshift</td><td>MPP column-store warehouse</td><td>SQL analytics inside AWS; Redshift Spectrum queries S3 directly</td><td>AWS-heavy companies</td></tr>
      </tbody>
    </table>
    <p>Roughly: <strong>warehouses</strong> (BigQuery, Snowflake, Redshift) serve analysts and BI tools with seconds-to-minutes latency and data loaded in batches; <strong>real-time OLAP</strong> stores (ClickHouse, Druid, Pinot) ingest from Kafka within seconds and answer dashboard queries in milliseconds, including for external users.</p>

    <h2>Data lakes, ETL and ELT</h2>
    <p>A <strong>data lake</strong> is cheap object storage (S3, GCS, ADLS) holding raw and processed data as files, usually in columnar formats like <strong>Parquet</strong> or ORC. Engines like Spark, Trino/Presto and Athena query the files in place. Table formats such as <strong>Apache Iceberg</strong>, Delta Lake and Hudi add transactions, schema evolution and time travel on top, giving the "lakehouse" pattern: warehouse-like tables on lake storage.</p>
    <div class="tabs">
      <section data-tab="ETL">
        <p><strong>Extract, Transform, Load</strong>: pull data from sources, clean and reshape it in a separate processing layer (Spark, Informatica, custom jobs), then load the finished tables into the warehouse. Traditional when warehouse compute was expensive. Good when you must mask PII before it lands anywhere.</p>
      </section>
      <section data-tab="ELT">
        <p><strong>Extract, Load, Transform</strong>: load raw data into the lake or warehouse first, then transform it there with SQL (often managed with dbt). The modern default, because cloud warehouse compute is elastic and keeping raw data lets you re-run transformations when logic changes.</p>
      </section>
    </div>
    <div data-diagram="pipeline" data-caption="A typical analytics pipeline: CDC and events flow through Kafka to a real-time OLAP store and to the lake/warehouse."></div>

    <h2>Real-time analytics example: a food-delivery ops dashboard</h2>
    <p>Swiggy and Zomato run live dashboards showing orders per minute by city, average delivery time, and restaurants with rising cancellation rates, so operations teams can react during an IPL final or a Diwali rush. Restaurant partners also see their own live sales. A typical design:</p>
    <ol class="steps">
      <li>Order, payment and delivery services emit events (<code>OrderPlaced</code>, <code>OrderDelivered</code>) to Kafka, or CDC streams them from the order database.</li>
      <li>A stream processor (Flink, Spark Streaming) enriches events (add city, restaurant tier) and may pre-aggregate per minute.</li>
      <li>A real-time OLAP store (Pinot, Druid or ClickHouse) ingests from Kafka; data is queryable within seconds.</li>
      <li>Dashboards query with SQL: <code>SELECT city, COUNT(*) FROM orders WHERE ts &gt; now() - INTERVAL 15 MINUTE GROUP BY city</code>.</li>
      <li>Raw events also land in the lake for historical reports and ML.</li>
    </ol>
    <p>Uber uses Pinot this way for the Uber Eats Restaurant Manager, giving restaurant owners live insights over fresh order data, and for many internal ops dashboards.</p>

    <h2>Where it shows up in interviews</h2>
    <ul>
      <li><strong>Ad-click aggregation</strong>: billions of click events a day; "clicks per ad per minute" for billing and dashboards. Kafka → Flink windowed aggregation → OLAP store, with raw events in the lake for reconciliation.</li>
      <li><strong>Metrics and monitoring</strong>: "design Datadog" or a monitoring system: agents push or Prometheus pulls, TSDB with downsampling, retention and cardinality limits, alerting rules.</li>
      <li><strong>Dashboards and analytics features</strong>: URL shortener click stats, YouTube creator analytics, seller dashboards on Flipkart: never run these as <code>GROUP BY</code> on the OLTP database.</li>
      <li><strong>Top K / trending</strong>: trending hashtags or products over a sliding window, often with approximate counting (count-min sketch).</li>
    </ul>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"Click events go to Kafka, not to the main database. Flink aggregates per ad per minute, and the results land in Pinot so advertiser dashboards query fresh data in milliseconds."</li>
        <li>"The OLAP store is column-oriented, so a query over three columns scans only those, compressed. That's why it can aggregate billions of rows."</li>
        <li>"For metrics I'll keep raw 10-second data for 7 days, 1-minute rollups for 90 days and 1-hour rollups for 2 years, and keep labels low-cardinality: no user ids as labels."</li>
        <li>"Raw events are also written to S3 as Parquet, so we can recompute aggregates if the streaming job had a bug."</li>
      </ul>
    </div>
    <div class="callout warn"><strong>Pitfalls</strong>Running analytics on the OLTP primary; per-user labels in Prometheus; using a column store for frequent single-row updates; storing only averages after downsampling; forgetting late-arriving events in windowed counts.</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>Why does a column store answer "SUM(amount) GROUP BY city" faster than a row store?</summary><div>It reads only the <code>amount</code> and <code>city</code> columns instead of whole rows, those columns compress very well (dictionary/RLE), and the engine processes them in vectorised batches across many cores. Less I/O plus faster CPU work.</div></details>
      <details><summary>Why are column stores bad at updating a single row?</summary><div>A row's values are spread across many separately compressed column files; changing one row means rewriting parts of each. Column stores prefer batched appends and handle updates/deletes with background merges or mutations.</div></details>
      <details><summary>What is high cardinality in a time-series database and why is it dangerous?</summary><div>The number of unique series (combinations of label values). Each series costs index and memory; adding an unbounded label like <code>user_id</code> multiplies series into millions or billions and can crash the TSDB. Keep labels bounded; put per-user data in logs or OLAP.</div></details>
      <details><summary>When downsampling, why keep min, max, sum and count instead of just the average?</summary><div>Averages of averages are wrong when windows have different counts; sum and count let you compute exact averages at any coarser level. Min and max preserve spikes that averaging would hide.</div></details>
      <details><summary>ETL vs ELT: what is the difference and which is more common today?</summary><div>ETL transforms data before loading into the warehouse; ELT loads raw data first and transforms inside the warehouse/lake with SQL (e.g. dbt). ELT is the modern default because cloud compute is elastic and raw data can be reprocessed.</div></details>
      <details><summary>A seller dashboard must show live order counts to 500,000 sellers with sub-second latency. Warehouse or real-time OLAP?</summary><div>Real-time OLAP (Pinot, Druid or ClickHouse) fed from Kafka. Warehouses like BigQuery or Snowflake are built for fewer, heavier analyst queries with seconds of latency and batch-loaded data, not thousands of concurrent user-facing queries on fresh data.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>OLTP handles many small transactions on rows; OLAP scans and aggregates huge numbers of rows over a few columns.</li>
      <li>Column storage reads only needed columns, compresses well and enables vectorised, parallel scans; it dislikes point updates.</li>
      <li>Time-series DBs (Prometheus, InfluxDB, TimescaleDB) optimise appends, compression, downsampling and retention; watch label cardinality.</li>
      <li>Warehouses (BigQuery, Snowflake, Redshift) serve analysts; real-time OLAP (ClickHouse, Druid, Pinot) serves live dashboards from Kafka.</li>
      <li>Data lakes on S3 with Parquet and Iceberg hold raw data; ELT is the modern default.</li>
      <li>In interviews: events to Kafka, stream-aggregate, store in OLAP, keep raw data for reprocessing; never analytics on the primary.</li>
    </ul></div>
  `,
  diagrams: {
    downsample: String.raw`flowchart LR
      RAW["Raw: every 10 s, keep 7 days"] -->|rollup job| M1["1-minute: keep 90 days"]
      M1 -->|rollup job| H1["1-hour: keep 2 years"]
      H1 -->|expire| X(["Deleted"])`,
    pipeline: String.raw`flowchart LR
      OLTP[("Orders DB")] -->|CDC| K["Kafka"]
      SVC["Apps and services"] -->|events| K
      K --> F["Flink: enrich, window"]
      F --> RT[("Pinot / Druid / ClickHouse")]
      RT --> D["Live dashboards"]
      K --> L[("Data lake: S3 + Parquet")]
      L -->|ELT| WH[("Warehouse: BigQuery / Snowflake")]
      WH --> BI["BI reports, ML"]`,
  },
});
