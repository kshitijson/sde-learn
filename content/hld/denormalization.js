SD.register({
  id: "denormalization",
  html: String.raw`
    <p class="lead">Normalisation keeps every fact in exactly one place, which makes writes simple and safe. But at scale, reads dominate (often 100 reads for every write) and stitching facts back together with joins on every request gets expensive. <strong>Denormalisation</strong> deliberately stores extra copies of data so reads become a single lookup. <strong>Read replicas</strong> attack the same problem from another angle: more copies of the whole database to spread reads. Both trade write cost and freshness for read speed, and both create the same new problem: keeping copies in sync.</p>

    <h2>Normalisation in plain words</h2>
    <p>Normalisation is a set of rules for splitting data into tables so that nothing is stored twice. The first three normal forms cover almost everything you need:</p>
    <table>
      <thead><tr><th>Form</th><th>Rule in plain words</th><th>Breaks it</th><th>Fix</th></tr></thead>
      <tbody>
        <tr><td>1NF</td><td>Each cell holds one value; no repeating groups or lists in a column</td><td><code>phones = "98200..., 98330..."</code></td><td>A separate <code>user_phones</code> table, one row per phone</td></tr>
        <tr><td>2NF</td><td>1NF, and every non-key column depends on the <em>whole</em> key (matters for composite keys)</td><td><code>order_items(order_id, product_id, qty, product_name)</code>: name depends only on <code>product_id</code></td><td>Move <code>product_name</code> to <code>products</code></td></tr>
        <tr><td>3NF</td><td>2NF, and non-key columns depend <em>only</em> on the key, not on other non-key columns</td><td><code>orders(id, user_id, user_city)</code>: city depends on the user, not the order</td><td>Keep city in <code>users</code>; join when needed</td></tr>
      </tbody>
    </table>
    <p>A quick way to remember it: every column should depend on "the key, the whole key, and nothing but the key". The benefit is <strong>no update anomalies</strong>: if a restaurant renames itself, you change one row, and every order shows the new name. See also <a href="#/p/sql-vs-nosql">SQL vs NoSQL</a>.</p>

    <h2>Why joins hurt at scale</h2>
    <p>A normalised Swiggy-style "order history" screen might join <code>orders</code>, <code>order_items</code>, <code>restaurants</code>, <code>menu_items</code> and <code>delivery_partners</code>. On one database with good indexes this is fine at 500 requests per second. It breaks down when:</p>
    <ul>
      <li><strong>Volume grows</strong>: each join touches several indexes and pages; at 50,000 reads/sec the CPU and buffer pool become the bottleneck.</li>
      <li><strong>Data is sharded</strong>: <code>orders</code> sharded by <code>user_id</code> and <code>restaurants</code> sharded by <code>restaurant_id</code> live on different machines. A join becomes a scatter-gather across the network (see <a href="#/p/sharding">Sharding</a>).</li>
      <li><strong>Data lives in different services</strong>: in microservices, the restaurant table belongs to another team's database. You cannot join at all; you must call another API.</li>
      <li><strong>Aggregates are computed on read</strong>: <code>SELECT COUNT(*) FROM likes WHERE post_id = ?</code> on a post with 10 million likes, run on every feed render, is a disaster.</li>
    </ul>

    <h2>Denormalisation techniques</h2>
    <figure class="svg-fig">
      <svg viewBox="0 0 640 260">
        <text class="s-title" x="160" y="24" text-anchor="middle">Normalised: join on every read</text>
        <rect class="s-box" x="20" y="40" width="130" height="80" rx="10"/>
        <text class="s-title" x="85" y="64" text-anchor="middle">orders</text>
        <text class="s-muted" x="85" y="86" text-anchor="middle">id, user_id,</text>
        <text class="s-muted" x="85" y="104" text-anchor="middle">restaurant_id</text>
        <rect class="s-box" x="175" y="40" width="130" height="80" rx="10"/>
        <text class="s-title" x="240" y="64" text-anchor="middle">restaurants</text>
        <text class="s-muted" x="240" y="86" text-anchor="middle">id, name,</text>
        <text class="s-muted" x="240" y="104" text-anchor="middle">logo_url</text>
        <line class="s-dash" x1="150" y1="80" x2="175" y2="80"/>
        <rect class="s-red" x="60" y="150" width="200" height="40" rx="10"/>
        <text class="s-text" x="160" y="175" text-anchor="middle">JOIN per request</text>
        <line class="s-line" x1="85" y1="120" x2="120" y2="148" marker-end="url(#arrow)"/>
        <line class="s-line" x1="240" y1="120" x2="200" y2="148" marker-end="url(#arrow)"/>
        <text class="s-muted" x="160" y="220" text-anchor="middle">one write place, slower reads</text>

        <text class="s-title" x="480" y="24" text-anchor="middle">Denormalised: copy on write</text>
        <rect class="s-accent" x="360" y="40" width="240" height="100" rx="10"/>
        <text class="s-title" x="480" y="64" text-anchor="middle">orders</text>
        <text class="s-muted" x="480" y="86" text-anchor="middle">id, user_id, restaurant_id,</text>
        <text class="s-text" x="480" y="106" text-anchor="middle">restaurant_name, logo_url</text>
        <text class="s-muted" x="480" y="126" text-anchor="middle">(copied at order time)</text>
        <rect class="s-green" x="380" y="160" width="200" height="40" rx="10"/>
        <text class="s-text" x="480" y="185" text-anchor="middle">single-table read</text>
        <line class="s-line" x1="480" y1="140" x2="480" y2="158" marker-end="url(#arrow)"/>
        <text class="s-muted" x="480" y="220" text-anchor="middle">fast reads, more storage,</text>
        <text class="s-muted" x="480" y="238" text-anchor="middle">copies to keep in sync</text>
      </svg>
      <figcaption>Normalised data is joined on every read; denormalised data copies the needed fields at write time so a read touches one table.</figcaption>
    </figure>
    <div class="tabs">
      <section data-tab="Duplicated columns">
        <p>Copy a few fields from a related table into the table you read. An order stores <code>restaurant_name</code> and <code>item_name</code> and <code>price</code> at the time of ordering.</p>
        <p>Sometimes this is not even a compromise; it is <em>correct</em>: the invoice must show the price you actually paid, not today's menu price. That is a "snapshot" copy and never needs syncing. A copy that <em>should</em> track the source (a user's display name on their posts) needs a sync strategy.</p>
      </section>
      <section data-tab="Precomputed counters">
        <p>Store <code>like_count</code>, <code>comment_count</code> and <code>follower_count</code> as columns, updated when the event happens, instead of counting rows on every read.</p>
        <pre><code>BEGIN;
INSERT INTO likes(post_id, user_id) VALUES (42, 7);
UPDATE posts SET like_count = like_count + 1 WHERE id = 42;
COMMIT;</code></pre>
        <p>For very hot posts the single counter row becomes a lock hotspot. Fixes: increment in Redis and flush in batches (write-back, see <a href="#/p/caching">Caching</a>), or keep N sharded counter rows and sum them on read.</p>
      </section>
      <section data-tab="Materialised views">
        <p>A <strong>materialised view</strong> is a query whose result the database stores as a table. PostgreSQL: <code>CREATE MATERIALIZED VIEW top_restaurants AS SELECT ...</code>, then <code>REFRESH MATERIALIZED VIEW CONCURRENTLY top_restaurants</code> on a schedule. Reads are instant; data is as fresh as the last refresh.</p>
        <p>Some databases maintain them incrementally (Oracle fast refresh, ClickHouse materialised views on insert, streaming tools like Materialize), so the view updates as base data changes.</p>
      </section>
      <section data-tab="Summary tables">
        <p>Pre-aggregate raw events into rollups: <code>daily_sales(restaurant_id, date, orders, revenue)</code> built by a nightly or hourly job from the raw orders table. A partner dashboard reads 30 rows for a month instead of scanning 300,000 orders.</p>
        <p>This is the standard approach for dashboards and reports, and is closely related to OLAP rollups (see <a href="#/p/timeseries-olap">Time-series &amp; analytics</a>).</p>
      </section>
    </div>
    <table>
      <thead><tr><th>Technique</th><th>Read gain</th><th>Write cost</th><th>Freshness</th></tr></thead>
      <tbody>
        <tr><td>Duplicated columns</td><td>Removes a join</td><td>Update every copy when source changes</td><td>Immediate if synced in the same transaction, else eventual</td></tr>
        <tr><td>Counters</td><td>O(1) instead of COUNT(*)</td><td>Extra write per event; hot-row contention</td><td>Immediate or near real time</td></tr>
        <tr><td>Materialised view</td><td>Precomputed complex query</td><td>Refresh cost</td><td>As of last refresh</td></tr>
        <tr><td>Summary table</td><td>Tiny scans for reports</td><td>Batch job</td><td>Minutes to a day behind</td></tr>
      </tbody>
    </table>

    <h2>Keeping copies in sync</h2>
    <p>Once data lives in two places (two tables, a database and a cache, a database and a search index) every write must reach both. There are two broad ways.</p>
    <h3>Dual writes (avoid)</h3>
    <p>The application writes to the database, then writes to the second store. If the process crashes between the two, or the second write fails, the copies diverge silently. Two concurrent requests can also apply their writes in different orders to each store. Retrying does not fix ordering.</p>
    <h3>Change data capture and the outbox pattern</h3>
    <p><strong>Change data capture (CDC)</strong> reads the database's own replication log (MySQL binlog, Postgres WAL) and publishes each committed change to Kafka. Debezium is the common open-source tool. Consumers update the denormalised copies, caches and search indexes. Because the log is the source, nothing committed is missed and order per row is preserved.</p>
    <p>The <strong>transactional outbox</strong> is the application-level version: in the same database transaction as the business write, insert an event row into an <code>outbox</code> table. A relay (often CDC on the outbox table) publishes it to Kafka. Either both the change and the event are committed, or neither is.</p>
    <div data-diagram="outbox" data-caption="Outbox + CDC: the business row and the event commit atomically; a relay ships events to Kafka; consumers update every copy."></div>
    <div class="callout tip"><strong>Make consumers idempotent</strong>Kafka delivery is at-least-once, so a consumer may see the same change twice. Use upserts keyed by id and a version or LSN, and ignore events older than what you already have.</div>
    <p>Same-database copies (a <code>like_count</code> in the same Postgres) can simply be updated in the same transaction. Use CDC when the copy lives in another store or another service. The pattern is also the backbone of event-driven designs and CQRS, covered below.</p>

    <h2>Read replicas</h2>
    <p>A <strong>read replica</strong> is a full copy of the database that follows the primary by replaying its log. All writes go to the primary; reads are spread across replicas. Most production MySQL and Postgres setups run one primary and 2 to 5 replicas; Amazon Aurora supports up to 15. If reads are 90% of traffic, adding four replicas roughly multiplies read capacity by five without touching the schema. More detail in <a href="#/p/replication">Replication</a>.</p>
    <div data-diagram="replicas" data-caption="One primary takes writes; replicas stream its log asynchronously and serve reads."></div>
    <h3>Replication lag</h3>
    <p>Replication is usually <strong>asynchronous</strong>: the primary commits and acknowledges the client without waiting for replicas. Replicas apply the change a little later, typically milliseconds, but seconds or minutes under heavy load, long-running queries or network trouble. During that gap a replica returns <strong>stale data</strong>.</p>
    <h3>The read-your-writes problem</h3>
    <p>A Zomato user edits their delivery address and the page reloads. The write went to the primary; the reload read hits a replica that has not caught up, and shows the old address. The user thinks the save failed and tries again. The guarantee we want is <strong>read-your-writes consistency</strong>: a user always sees their own changes (others may see them a bit later).</p>
    <div data-diagram="ryw" data-caption="Read-your-writes violation: the write lands on the primary, but the next read goes to a replica that is still behind."></div>
    <h3>Fixes</h3>
    <ol class="steps">
      <li><strong>Read from the primary after a write</strong>: for a short window (say 5 to 10 seconds) after a user writes, route that user's reads to the primary. Track it with a timestamp in the session or a cookie. Simple and very common.</li>
      <li><strong>Primary for "own" data</strong>: always read a user's own profile and settings from the primary; read other people's data from replicas. Works when own-data reads are a small share.</li>
      <li><strong>Session stickiness</strong>: pin a user's session to one replica so they at least never go backwards in time (monotonic reads). Combine with routing to the primary after writes.</li>
      <li><strong>LSN / GTID tracking</strong>: after a write, return the primary's log position (Postgres LSN, MySQL GTID) to the client. On the next read, pick a replica whose replay position is at least that value, or wait briefly for it (MySQL <code>WAIT_FOR_EXECUTED_GTID_SET</code>), or fall back to the primary. The most precise fix.</li>
      <li><strong>Update the UI optimistically</strong>: show the value the user just submitted from client state; do not re-read immediately.</li>
    </ol>
    <div class="callout warn"><strong>Replicas are not backups or failover magic</strong>A bad <code>DELETE</code> replicates to every replica within milliseconds. Promoting an async replica after the primary dies can lose the last few transactions that had not replicated. Keep point-in-time backups, and use semi-synchronous replication when losing acknowledged writes is unacceptable.</div>

    <h2>CQRS: a teaser</h2>
    <p><strong>Command Query Responsibility Segregation</strong> takes denormalisation to its logical end: use one model for writes (commands) and separate, purpose-built models for reads (queries). The write side is a normalised SQL database that validates and stores orders. CDC events build read models: an order-history document per user in MongoDB, a search index in Elasticsearch, a dashboard table in ClickHouse. Each read model is shaped exactly for one screen.</p>
    <div data-diagram="cqrs" data-caption="CQRS: a normalised write model, with events building several denormalised read models."></div>
    <p>The price is eventual consistency between sides and more moving parts, so use it only when read and write needs really diverge. It comes up with event sourcing, covered in the architecture patterns section.</p>

    <h2>Trade-offs</h2>
    <div class="grid-2">
      <div class="card good"><strong>Gains</strong><ul><li>Reads become single-table or single-key lookups</li><li>Works across shards and services where joins cannot</li><li>Read capacity scales with replicas</li></ul></div>
      <div class="card bad"><strong>Costs</strong><ul><li>More storage and more write work per change</li><li>Copies can disagree; you need a sync pipeline and idempotent consumers</li><li>Stale reads from replicas; read-your-writes needs extra routing logic</li></ul></div>
    </div>
    <p>Rule of thumb: <strong>normalise first, denormalise for measured read paths</strong>. Start with a clean schema, find the hot query, then copy only the fields it needs.</p>

    <h2>In the interview</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"The feed shows like counts on every post, so I'll store <code>like_count</code> on the post instead of counting. Hot posts get a Redis counter flushed every few seconds."</li>
        <li>"Order rows copy restaurant name and item prices at order time; that's a snapshot, so it never needs syncing."</li>
        <li>"Reads are 95% of traffic, so one primary and three async replicas. To avoid read-your-writes bugs, a user's reads go to the primary for 10 seconds after they write."</li>
        <li>"I won't dual-write to Elasticsearch. The service writes Postgres plus an outbox row in one transaction, and Debezium streams changes through Kafka to the index."</li>
      </ul>
    </div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>Explain 3NF in one sentence, with an example of a violation.</summary><div>Every non-key column depends only on the primary key, not on another non-key column. Violation: <code>orders(id, user_id, user_city)</code>, where city depends on the user, not the order.</div></details>
      <details><summary>Why is storing the item price on an order row not really a sync problem?</summary><div>It is a snapshot of a historical fact: the price paid at order time. It should never change when the menu price changes, so there is nothing to keep in sync.</div></details>
      <details><summary>What can go wrong with dual writes to a database and a search index?</summary><div>A crash or failure between the two writes leaves them inconsistent with no record to fix it; concurrent writes can be applied in different orders to the two stores. CDC or the outbox pattern fixes this by deriving the second write from the committed log.</div></details>
      <details><summary>A user changes their profile photo, refreshes, and sees the old one. What is happening and give two fixes.</summary><div>Replication lag violating read-your-writes: the read hit an async replica behind the primary. Fixes: route the user's reads to the primary for a few seconds after a write; track the write's LSN/GTID and read only from a replica that has caught up; or show the new value from client state.</div></details>
      <details><summary>Your like_count update on a viral post causes lock contention. What do you do?</summary><div>Stop updating one hot row synchronously: increment a Redis counter and flush to the DB periodically, or split into N counter rows (sharded counter) and sum on read. Accept slightly stale counts.</div></details>
      <details><summary>What is the difference between a materialised view and a summary table?</summary><div>A materialised view is a stored query result managed by the database and refreshed by it (on demand or incrementally). A summary table is a regular table you populate yourself with a batch or streaming job. Both precompute reads; the view is less code, the table gives more control.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>Normalise (1NF to 3NF) for correctness: one fact, one place, no update anomalies.</li>
      <li>Denormalise measured hot read paths: duplicated columns, counters, materialised views and summary tables.</li>
      <li>Keep copies in sync with same-transaction updates, or CDC / transactional outbox through Kafka; avoid dual writes and make consumers idempotent.</li>
      <li>Read replicas scale reads but lag; fix read-your-writes by reading from the primary after a write, sticky sessions, or LSN/GTID tracking.</li>
      <li>CQRS is the extreme form: a normalised write model feeding several purpose-built read models.</li>
    </ul></div>
  `,
  diagrams: {
    outbox: String.raw`sequenceDiagram
      participant S as Order service
      participant DB as Postgres
      participant R as CDC relay (Debezium)
      participant K as Kafka
      participant C as Consumers
      S->>DB: one transaction: INSERT order + INSERT outbox event
      DB-->>S: committed
      R->>DB: read WAL / outbox rows
      R->>K: publish OrderPlaced
      K->>C: deliver (at least once)
      Note over C: update search index, cache, read models`,
    replicas: String.raw`flowchart LR
      APP["App servers"] -->|writes| P[("Primary")]
      APP -->|reads| R1[("Replica 1")]
      APP -->|reads| R2[("Replica 2")]
      APP -->|reads| R3[("Replica 3")]
      P -.->|"async log stream"| R1
      P -.->|"async log stream"| R2
      P -.->|"async log stream"| R3`,
    ryw: String.raw`sequenceDiagram
      participant U as User
      participant P as Primary
      participant R as Replica
      U->>P: UPDATE address = "HSR Layout"
      P-->>U: ok
      U->>R: SELECT address
      R-->>U: "Koramangala" (old, lagging)
      P--)R: replicate change (arrives late)
      Note over U,R: Fix: read primary after write, or wait for LSN`,
    cqrs: String.raw`flowchart LR
      CMD["Commands: place order"] --> WM[("Write model: Postgres")]
      WM -->|CDC events| K["Kafka"]
      K --> RM1[("Order history: MongoDB")]
      K --> RM2[("Search: Elasticsearch")]
      K --> RM3[("Dashboards: ClickHouse")]
      Q["Queries"] --> RM1
      Q --> RM2
      Q --> RM3`,
  },
});
