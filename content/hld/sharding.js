SD.register({
  id: "sharding",
  html: String.raw`
    <p class="lead">Sharding (also called horizontal partitioning) splits one large dataset across many database servers, so each server stores and serves only a slice. You shard when the data no longer fits on one machine or when one machine cannot keep up with the writes. Reads can be scaled with <a href="#/p/replication">replicas</a> and <a href="#/p/caching">caches</a>, but every replica still has to apply every write; sharding is how you scale writes and storage. The price is real: picking the wrong shard key gives you hot shards, cross-shard queries get slow, joins and transactions across shards get hard, and moving data later is a project of its own. This page is about making those choices well.</p>

    <h2>Why shard</h2>
    <ul>
      <li><strong>Data size.</strong> A single PostgreSQL or MySQL server is comfortable up to a few TB. If Razorpay stores 500 million payments a month at about 2 KB each, that is 1 TB a month: one box will not hold years of it, and backups, index rebuilds and schema changes on a 30 TB table take days.</li>
      <li><strong>Write throughput.</strong> A well-tuned primary handles roughly 5,000 to 20,000 write transactions per second, depending on hardware and row size. Replicas do not help, because every replica repeats every write. A flash sale doing 100,000 order writes per second needs the writes split across machines.</li>
      <li><strong>Blast radius and locality.</strong> If one of 16 shards fails, 1/16 of users are affected, not all. Shards can also be placed in the region where their users live.</li>
    </ul>
    <div class="callout tip"><strong>Shard last, not first</strong>Sharding adds permanent complexity. Before sharding, try in order: better indexes and queries (see <a href="#/p/indexing">Indexing</a>), a cache, read replicas, a bigger machine (vertical scaling; servers with 1 to 2 TB RAM exist), archiving old data, and splitting unrelated tables into separate databases. In an interview, show you know when sharding is actually needed, using <a href="#/p/estimation">back-of-envelope numbers</a>.</div>
    <div data-diagram="overview" data-caption="A sharded database: a router uses the shard key and a shard map to send each query to the right shard; each shard is itself replicated."></div>

    <h2>Vertical vs horizontal partitioning</h2>
    <figure class="svg-fig">
      <svg viewBox="0 0 640 270">
        <text class="s-title" x="160" y="26" text-anchor="middle">Vertical: split columns</text>
        <rect class="s-accent" x="30" y="45" width="120" height="150" rx="10"/>
        <text class="s-text" x="90" y="75" text-anchor="middle">user_id</text>
        <text class="s-text" x="90" y="100" text-anchor="middle">name</text>
        <text class="s-text" x="90" y="125" text-anchor="middle">email</text>
        <text class="s-muted" x="90" y="160" text-anchor="middle">small, hot</text>
        <rect class="s-box" x="170" y="45" width="120" height="150" rx="10"/>
        <text class="s-text" x="230" y="75" text-anchor="middle">user_id</text>
        <text class="s-text" x="230" y="100" text-anchor="middle">bio</text>
        <text class="s-text" x="230" y="125" text-anchor="middle">settings</text>
        <text class="s-muted" x="230" y="160" text-anchor="middle">large, cold</text>
        <text class="s-muted" x="160" y="225" text-anchor="middle">same rows, different columns</text>
        <text class="s-muted" x="160" y="245" text-anchor="middle">on different servers</text>
        <line class="s-dash" x1="320" y1="40" x2="320" y2="250"/>
        <text class="s-title" x="480" y="26" text-anchor="middle">Horizontal: split rows</text>
        <rect class="s-green" x="360" y="45" width="240" height="44" rx="10"/>
        <text class="s-text" x="480" y="72" text-anchor="middle">Shard 0: users 1 to 1M</text>
        <rect class="s-amber" x="360" y="98" width="240" height="44" rx="10"/>
        <text class="s-text" x="480" y="125" text-anchor="middle">Shard 1: users 1M to 2M</text>
        <rect class="s-box" x="360" y="151" width="240" height="44" rx="10"/>
        <text class="s-text" x="480" y="178" text-anchor="middle">Shard 2: users 2M to 3M</text>
        <text class="s-muted" x="480" y="225" text-anchor="middle">same columns, different rows</text>
        <text class="s-muted" x="480" y="245" text-anchor="middle">this is sharding</text>
      </svg>
      <figcaption>Vertical partitioning moves columns (or whole tables) to different servers; horizontal partitioning, i.e. sharding, moves rows.</figcaption>
    </figure>
    <p><strong>Vertical partitioning</strong> splits by columns or by feature: user profiles in one database, orders in another, payments in a third (this is what happens naturally with microservices), or wide rarely-read columns moved into a side table. It is easy and often the first step, but each piece is still bounded by one machine. <strong>Horizontal partitioning</strong> keeps the schema identical on every shard and puts different rows on different servers, chosen by a <strong>shard key</strong> (also called a partition key). That is what "sharding" means.</p>

    <h2>Sharding strategies</h2>
    <p>Use the widget to compare the three main strategies on the same keys, including what happens with a hot key. Then read the details below.</p>
    <div data-widget="sharding"></div>
    <div class="tabs">
      <section data-tab="Range-based">
        <p>Each shard owns a contiguous range of the key: A to F, G to M; or order dates January, February. A small table maps ranges to shards, and ranges are split when they grow too big.</p>
        <p><strong>Good</strong>: range queries are efficient (all orders between two dates, all names starting with "S") because neighbours live together. Ranges can be split and moved easily. Used by HBase, Bigtable, Spanner, CockroachDB, TiDB and MongoDB ranged shard keys.</p>
        <p><strong>Bad</strong>: skew. If the key is a timestamp or an auto-increment id, <em>every</em> new write lands in the last range, so one shard is on fire while the rest idle. Popular ranges (names starting with "S" in India) also get more data.</p>
      </section>
      <section data-tab="Hash-based">
        <p>Apply a hash function to the key and use the hash to pick a shard: <code>shard = hash(user_id) % 16</code>. A good hash spreads keys evenly even when the keys themselves are sequential.</p>
        <p><strong>Good</strong>: even distribution of data and load; no need to know the key distribution in advance. Used by Cassandra, DynamoDB, Redis Cluster (16,384 hash slots), Citus and MongoDB hashed shard keys.</p>
        <p><strong>Bad</strong>: range queries must ask every shard, since neighbouring keys are scattered. And a naive <code>hash % number_of_servers</code> breaks when the number of servers changes: going from 3 to 4 servers moves about 75% of keys. Fix that with <a href="#/p/consistent-hashing">consistent hashing</a> or with fixed logical shards (below).</p>
      </section>
      <section data-tab="Directory-based">
        <p>A lookup service stores the mapping explicitly: <code>merchant 1234 -&gt; shard 7</code>. The router asks the directory (heavily cached) where a key lives.</p>
        <p><strong>Good</strong>: total flexibility. Move one big tenant to a dedicated shard, rebalance individual keys, or place keys by any rule. Common in multi-tenant SaaS (a large customer gets its own database).</p>
        <p><strong>Bad</strong>: the directory is an extra hop and a critical dependency: if it is down or wrong, nothing works. It must be replicated, cached and kept consistent during moves.</p>
      </section>
      <section data-tab="Geo-based">
        <p>Shard by location: Indian users' data in the Mumbai region, European users' in Frankfurt. Usually a top-level split, with hash sharding inside each region.</p>
        <p><strong>Good</strong>: low latency for users near their data, and data residency compliance (RBI requires payment data of Indian users to be stored in India; GDPR in Europe). Uber and Swiggy-style apps naturally partition by city.</p>
        <p><strong>Bad</strong>: uneven sizes (Bengaluru vs a small town), and users who travel or interact across regions cause cross-shard work.</p>
      </section>
    </div>
    <table>
      <thead><tr><th>Strategy</th><th>Distribution</th><th>Range queries</th><th>Adding shards</th><th>Typical use</th></tr></thead>
      <tbody>
        <tr><td>Range</td><td>Can be skewed (sequential keys)</td><td>Efficient</td><td>Split a range, move it</td><td>Time series, ordered scans, Bigtable/HBase/Spanner</td></tr>
        <tr><td>Hash</td><td>Even</td><td>Scatter to all shards</td><td>Consistent hashing or logical shards</td><td>User data, key-value lookups, Cassandra/DynamoDB</td></tr>
        <tr><td>Directory</td><td>Whatever you decide</td><td>Depends on placement</td><td>Update the directory, move data</td><td>Multi-tenant SaaS, big customers on dedicated shards</td></tr>
        <tr><td>Geo</td><td>Follows population</td><td>Within a region</td><td>Add a region or sub-shard</td><td>Latency and data residency</td></tr>
      </tbody>
    </table>
    <div class="callout info"><strong>Compound keys give you both</strong>Cassandra and DynamoDB keys have two parts: a <em>partition key</em> that is hashed to pick the node, and a <em>clustering/sort key</em> that keeps rows sorted inside the partition. With <code>PRIMARY KEY ((user_id), created_at)</code>, users are spread evenly, and one user's timeline is a fast range scan on one node.</div>

    <h2>Choosing a shard key</h2>
    <p>The most important decision, and the hardest to change later. A good shard key has:</p>
    <ol class="steps">
      <li><strong>High cardinality.</strong> Many distinct values. Sharding by <code>country</code> gives at most ~200 shards and one giant India shard; <code>user_id</code> has hundreds of millions of values.</li>
      <li><strong>Even distribution.</strong> Data and traffic spread evenly. Avoid keys where a few values dominate (status, gender, a single huge tenant) or that are monotonic under range sharding (timestamps).</li>
      <li><strong>Matches the main query pattern.</strong> The most frequent queries should include the shard key so they hit exactly one shard. "Get user's orders" wants orders sharded by <code>user_id</code>; "get order by id" works if the order id embeds the shard (see <a href="#/p/unique-ids">Unique IDs</a>).</li>
      <li><strong>Keeps related data together.</strong> Rows you join or update in one transaction should share the key, so that work stays on one shard.</li>
    </ol>
    <h3>Examples</h3>
    <table>
      <thead><tr><th>App</th><th>Good shard key</th><th>Why</th><th>Watch out for</th></tr></thead>
      <tbody>
        <tr><td>Social app (Instagram-like)</td><td><code>user_id</code></td><td>Profile, posts, followers of one user on one shard; most queries are "for this user"</td><td>Celebrities with 500M followers (hot keys); feeds that read from many users</td></tr>
        <tr><td>Payments (Razorpay-like)</td><td><code>merchant_id</code></td><td>Merchant dashboards, settlements and reports all filter by merchant</td><td>A few huge merchants produce a large share of payments; give them dedicated shards (directory) or sub-shard by <code>(merchant_id, month)</code></td></tr>
        <tr><td>Food delivery (Swiggy-like)</td><td><code>customer_id</code> for order history, plus a copy keyed by <code>restaurant_id</code></td><td>Customers read "my orders"; restaurants read "incoming orders". One key cannot serve both</td><td>Sharding orders by restaurant alone makes a popular biryani place a hot shard at 1 pm; sharding by order_id alone makes both views scatter-gather</td></tr>
        <tr><td>Chat (Discord-like)</td><td><code>(channel_id, time bucket)</code></td><td>Messages of a channel are read together and in time order</td><td>A huge channel grows forever, so the time bucket (e.g. 10 days) caps partition size</td></tr>
      </tbody>
    </table>
    <p>When one key cannot serve two important access patterns, the standard answer is to store the data twice, each copy sharded by a different key (<a href="#/p/denormalization">denormalisation</a>), kept in sync with change data capture or events.</p>

    <h2>Hot keys and the celebrity problem</h2>
    <p>Even with perfect hashing, a single key can be hot: one celebrity's post getting a million likes a minute, one flash-sale product, or one huge merchant during a Big Billion Days sale. All of that traffic hits the one shard that owns the key; adding more shards does not help, because the key cannot be split by hashing.</p>
    <div data-diagram="hotkey" data-caption="Key salting: one hot key is split into N sub-keys on different shards; writes pick one at random, reads gather all N."></div>
    <ul>
      <li><strong>Key salting (splitting the key).</strong> Append a suffix: <code>likes:post42#0</code> to <code>likes:post42#9</code>. Each write picks a random suffix, so ten shards share the load. Reads must fetch all ten and sum them. Only do this for keys known to be hot; it makes every read ten times more expensive.</li>
      <li><strong>Split hot partitions.</strong> Range-sharded systems split a hot range into smaller ranges on different nodes (Bigtable, HBase, CockroachDB do this automatically). DynamoDB's adaptive capacity isolates hot items onto their own partitions. Each DynamoDB partition still has limits of about 3,000 reads and 1,000 writes per second, so a single item cannot exceed those.</li>
      <li><strong>Cache hot reads.</strong> Put the hot key in a cache, even an in-process one per app server, so the shard sees only a fraction of reads. See the hot keys section of <a href="#/p/caching">Caching</a>.</li>
      <li><strong>Buffer hot writes.</strong> Aggregate counter increments in memory or a queue and write one batched update per second instead of thousands.</li>
      <li><strong>Treat whales differently.</strong> Give the largest tenants dedicated shards (directory-based), or handle celebrities separately (fan-out on read for celebrities, as in the <a href="#/p/news-feed">news feed</a> design).</li>
    </ul>

    <h2>Cross-shard queries and joins</h2>
    <p>A query that includes the shard key goes to one shard. A query that does not, for example "all orders above Rs 50,000 today" when orders are sharded by customer, must go to every shard. This is <strong>scatter-gather</strong>: the router sends the query to all shards in parallel, each returns its partial result, and the router merges, sorts, and applies the final limit.</p>
    <div data-diagram="scatter" data-caption="Scatter-gather: the router fans the query out to every shard, then merges the partial results. Latency equals the slowest shard."></div>
    <p>Scatter-gather works, but its cost grows with the number of shards: 64 shards means 64 queries, and the response is as slow as the slowest shard (tail latency). For <code>ORDER BY amount DESC LIMIT 10</code>, each shard returns its own top 10 and the router merges them; for deep pagination (page 1,000) each shard must return 10,000 rows. Ways to avoid it:</p>
    <ul>
      <li><strong>Denormalise</strong> so the needed data lives together: store the restaurant name inside the order row rather than joining to a restaurants table on another shard.</li>
      <li><strong>Reference tables</strong>: small, rarely changing tables (cities, currencies, plans) are copied to every shard so joins stay local. Citus calls these reference tables.</li>
      <li><strong>Co-location</strong>: shard related tables by the same key (orders and order_items both by <code>customer_id</code>) so their joins are local. Vitess and Citus both support this.</li>
      <li><strong>Global secondary indexes or a separate read store</strong>: maintain another copy organised for that query (a GSI, a <a href="#/p/search-index">search index</a> in Elasticsearch, or an analytics warehouse for reports). See <a href="#/p/timeseries-olap">OLAP</a> for reporting workloads.</li>
    </ul>

    <h2>Secondary indexes: local vs global</h2>
    <p>The primary key finds the shard. But how do you look up by another column, like orders by <code>restaurant_id</code> when sharded by <code>customer_id</code>?</p>
    <div data-diagram="indexes" data-caption="Local index: each shard indexes only its own rows, so a lookup asks every shard. Global index: the index is sharded by the indexed value, so a lookup asks one index shard."></div>
    <table>
      <thead><tr><th></th><th>Local (document-partitioned)</th><th>Global (term-partitioned)</th></tr></thead>
      <tbody>
        <tr><td>Where the index lives</td><td>On each shard, covering only that shard's rows</td><td>In its own partitions, sharded by the indexed value</td></tr>
        <tr><td>Writes</td><td>Cheap: row and index entry on the same shard, same transaction</td><td>A write may touch another partition; usually updated asynchronously</td></tr>
        <tr><td>Reads by indexed column</td><td>Scatter-gather to all shards</td><td>One index partition, then fetch rows</td></tr>
        <tr><td>Consistency</td><td>Index always matches the data</td><td>Index can lag the data (eventually consistent)</td></tr>
        <tr><td>Examples</td><td>MongoDB and Cassandra secondary indexes, Elasticsearch shards, DynamoDB local secondary indexes (LSI)</td><td>DynamoDB global secondary indexes (GSI), a separately maintained lookup table</td></tr>
      </tbody>
    </table>

    <h2>Cross-shard transactions</h2>
    <p>Moving Rs 500 from a wallet on shard 3 to a wallet on shard 9 needs both updates to succeed or both to fail. A single database transaction cannot span shards. Options:</p>
    <ul>
      <li><strong>Avoid it with the shard key.</strong> Put everything a transaction touches on one shard (all of a merchant's ledger rows by <code>merchant_id</code>). This is the best answer whenever possible.</li>
      <li><strong>Two-phase commit (2PC).</strong> A coordinator asks every shard to prepare, then tells all to commit. Correct but slow, and participants can block if the coordinator dies mid-way. Some databases do this internally (Spanner, CockroachDB, Vitess's optional 2PC mode).</li>
      <li><strong>Sagas.</strong> Split the operation into local steps, each with a compensating action (debit shard 3, then credit shard 9; if the credit fails, refund shard 3). Eventually consistent but scalable. Payments and order flows commonly use this, usually driven by a <a href="#/p/message-queues">queue</a> and idempotent steps. Sagas and the outbox pattern get a page of their own in Distributed Systems.</li>
    </ul>
    <p>Single-shard ACID behaviour is covered in <a href="#/p/transactions">Transactions &amp; isolation</a>.</p>

    <h2>Resharding: adding capacity later</h2>
    <p>Data grows, so you will need more shards. Moving data while serving traffic is the hardest operational part of sharding.</p>
    <h3>Pre-split: many logical shards, few physical nodes</h3>
    <p>Do not map keys straight to servers. Map keys to a fixed, large number of <strong>logical shards</strong> (say 1,024), and keep a small table mapping logical shards to <strong>physical nodes</strong>. The key-to-logical-shard mapping never changes. When you add a server, you move some logical shards to it and update the table. Each move is a whole unit (often one database or schema per logical shard), so it is easy to copy and verify.</p>
    <div data-diagram="logical" data-caption="16 logical shards on 3 nodes; adding node D moves 4 whole logical shards. hash(key) % 16 never changes, only the shard map does."></div>
    <p>Instagram used thousands of logical shards (PostgreSQL schemas) on a small number of physical servers; Pinterest started with 4,096 virtual shards across a handful of MySQL machines. Redis Cluster's 16,384 hash slots and Citus's shard count work the same way. Pick the logical count much larger than the number of nodes you will ever need, because changing it later means rehashing everything.</p>

    <h3>Online migration with double writes</h3>
    <p>Moving a shard (or a whole table to a new sharded cluster) without downtime:</p>
    <div data-diagram="migration" data-caption="Online shard migration: copy, catch up from the change log, verify, switch reads, switch writes, clean up."></div>
    <ol class="steps">
      <li><strong>Copy</strong> a consistent snapshot of the source shard to the target, noting the log position (the same trick as adding a <a href="#/p/replication">replica</a>).</li>
      <li><strong>Catch up</strong> by replaying the change log (binlog or WAL via CDC) from that position, so the target trails the source by seconds.</li>
      <li><strong>Double write</strong> (optional, at the application level): write to both old and new locations, so the new one stays current even without CDC.</li>
      <li><strong>Verify</strong>: compare row counts and checksums; shadow-read from the new location and compare results.</li>
      <li><strong>Switch reads</strong> to the target, then <strong>switch writes</strong>: briefly pause writes for that shard (a second or two), let the target catch the last changes, flip the shard map, resume.</li>
      <li><strong>Clean up</strong> the old copy after a safety period.</li>
    </ol>
    <h3>Tools that do this for you</h3>
    <ul>
      <li><strong>Vitess</strong> (built at YouTube, used by Slack, GitHub, PlanetScale): sits in front of MySQL. VTGate routes queries using "vindexes" (the sharding function), and the Reshard and MoveTables workflows use VReplication to copy and catch up, then switch traffic with a short write pause.</li>
      <li><strong>Citus</strong> (PostgreSQL extension): <code>create_distributed_table('orders', 'customer_id')</code> hash-shards a table (32 shards by default), supports co-located and reference tables, and can rebalance shards to new nodes online.</li>
      <li><strong>MongoDB</strong>: <code>mongos</code> routers, config servers holding the chunk map, and a balancer that moves chunks between shards; since 5.0, <code>reshardCollection</code> can even change the shard key online.</li>
      <li><strong>DynamoDB, Cassandra, Spanner, CockroachDB</strong>: partitioning and rebalancing are automatic; you only choose a good key.</li>
    </ul>

    <h2>Code: shard router with logical shards</h2>
    <p>The router hashes each key (FNV-1a, a simple hash that gives the same value in every language) to one of 16 logical shards and looks up the physical node in a shard map. <code>addNode</code> moves whole logical shards from the busiest nodes to the new one and counts the keys that moved. For comparison it also counts how many keys a naive <code>hash % nodes</code> scheme would have moved. <code>scatterGather</code> runs a query that has no shard key on every node and merges the results.</p>
    <div data-code="router"></div>
    <p>Output (identical in all five languages):</p>
    <pre><code>16 logical shards on 3 nodes
keys per node: node-A=361 node-B=321 node-C=318
get order:42 -&gt; shard 1 on node-B, amount 598
add node-D: moved shards [0, 3, 1, 2], 244 of 1000 keys moved
naive hash % nodes (3 -&gt; 4) would move 744 of 1000 keys
keys per node: node-A=243 node-B=256 node-C=257 node-D=244
get order:42 -&gt; shard 1 on node-D, amount 598
scatter-gather amount &gt;= 995: asked 4 nodes, 5 matches
  order:284 = 996
  order:321 = 999
  order:605 = 995
  order:642 = 998
  order:963 = 997</code></pre>
    <p>Adding the fourth node moved only 24% of keys (the minimum needed to give it a fair share), while <code>hash % nodes</code> would have moved 74%. Note that order:42 still lives in logical shard 1; only the node owning shard 1 changed.</p>

    <h2>Trade-offs at a glance</h2>
    <div class="grid-2">
      <div class="card good"><strong>What sharding gives you</strong><ul><li>Storage and write throughput that grow with the number of nodes</li><li>Smaller per-shard data: faster backups, index builds and schema changes</li><li>Failure of one shard affects only part of the users</li><li>Data can live near its users</li></ul></div>
      <div class="card bad"><strong>What it costs</strong><ul><li>Queries without the shard key become scatter-gather</li><li>Joins and transactions across shards are hard or impossible</li><li>Hot keys still overload one shard</li><li>Resharding, routing, monitoring and unique ids need extra machinery</li></ul></div>
    </div>

    <h2>Common interview questions</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"At 50,000 writes per second and 40 TB, one primary won't do, so I'll shard. The shard key is <code>user_id</code> because almost every query is 'for this user', and it has high cardinality."</li>
        <li>"I'll hash <code>user_id</code> into 1,024 logical shards mapped onto 16 physical MySQL clusters, so adding capacity means moving logical shards, not rehashing. Each shard is a leader with two replicas."</li>
        <li>"Restaurant-side queries don't have <code>customer_id</code>, so I'll keep a second copy of orders sharded by <code>restaurant_id</code>, fed by CDC, instead of scatter-gather on every request."</li>
        <li>"For celebrity posts I'll salt the like counter across 10 sub-keys and cache the total, so one shard doesn't take all the writes."</li>
        <li>"I'll keep transactions single-shard by design; the one cross-shard flow, wallet transfers, uses a saga with idempotent steps."</li>
      </ul>
    </div>
    <div class="callout warn"><strong>Pitfalls</strong>Sharding before you need to; using <code>hash % N</code> on physical servers; picking a low-cardinality or monotonic key (country, status, created_at with range sharding); forgetting how queries without the shard key will run; ignoring hot keys; assuming cross-shard joins and transactions work like a single database; no plan for resharding.</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>Why does sharding scale writes when read replicas do not?</summary><div>Every replica holds the full dataset and must apply every write, so adding replicas adds read capacity but not write capacity. Each shard holds only its slice and applies only the writes for that slice, so N shards can absorb roughly N times the writes.</div></details>
      <details><summary>You range-shard an orders table by <code>created_at</code>. What goes wrong?</summary><div>All new orders have the latest timestamp, so every insert lands on the shard owning the newest range. That shard is overloaded while others sit idle (a write hot spot). Use a hashed key (e.g. hash of order or customer id), or a compound key like <code>(hash(customer_id), created_at)</code>.</div></details>
      <details><summary>Going from 4 to 5 servers with <code>hash(key) % servers</code>, roughly what fraction of keys move? How do you avoid it?</summary><div>About 80% (a key stays only if <code>h % 4 == h % 5</code>, which is true for about 1 in 5 keys). Avoid it with consistent hashing, or with a fixed number of logical shards mapped to nodes through a table, so only the logical shards reassigned to the new node move (about 1/5 of the data).</div></details>
      <details><summary>Orders are sharded by <code>customer_id</code>. The restaurant app needs "all live orders for restaurant R". Give two designs.</summary><div>(1) Scatter-gather with a local secondary index on <code>restaurant_id</code> on every shard: simple, but costs a query per shard on every request. (2) Keep a second copy (or a global secondary index) of live orders sharded by <code>restaurant_id</code>, updated asynchronously from the main writes via CDC or events: one-shard reads, slight lag. For a high-traffic restaurant dashboard, (2) is usually right.</div></details>
      <details><summary>A celebrity's post gets 200,000 likes per minute and its shard is overloaded. What do you do?</summary><div>Split the counter with key salting: <code>likes:post#0</code> to <code>#N</code> on different shards, each like increments a random sub-key, and reads sum them (cached for a few seconds). Optionally buffer increments in memory and flush in batches. Adding more shards alone does not help because one key always maps to one shard.</div></details>
      <details><summary>Describe how to move a shard to a new server without downtime.</summary><div>Snapshot the source and record its log position; restore on the target; replay the change log (CDC) from that position until it is nearly caught up; optionally double-write; verify with counts and checksums or shadow reads; switch reads; briefly pause writes, let the target apply the last changes, flip the shard map, resume writes; delete the old copy later. Vitess and MongoDB automate this.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>Shard to scale storage and writes; try indexes, caching, replicas and bigger machines first.</li>
      <li>Horizontal partitioning splits rows by a shard key; vertical partitioning splits columns or features.</li>
      <li>Range sharding keeps ranges fast but hot-spots on sequential keys; hash sharding spreads load but scatters range queries; directory sharding is flexible but adds a lookup dependency; geo sharding serves latency and data residency.</li>
      <li>A good shard key has high cardinality, even spread, matches the main queries and keeps transactional data together.</li>
      <li>Hot keys need salting, caching, batching or dedicated shards; more shards do not fix them.</li>
      <li>Avoid cross-shard queries and transactions by design: co-locate, denormalise, use reference tables, global indexes and sagas.</li>
      <li>Pre-split into many logical shards mapped to fewer nodes, and migrate online with snapshot, change-log catch-up and a short cutover.</li>
    </ul></div>
  `,
  code: {
    router: {
      title: "Shard router: logical shards, rebalance, scatter-gather",
      java: String.raw`import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.IntPredicate;
import java.util.stream.Collectors;

public class Main {
    static final int LOGICAL_SHARDS = 16;

    /** 32-bit FNV-1a hash, returned as a non-negative long: stable across languages and runs. */
    static long fnv1a(String key) {
        long h = 2166136261L;
        for (byte b : key.getBytes(StandardCharsets.UTF_8)) {
            h ^= (b & 0xff);
            h = (h * 16777619L) & 0xFFFFFFFFL;
        }
        return h;
    }

    record Result(String key, int value) {}

    static class ShardRouter {
        final List<String> nodes = new ArrayList<>();
        final String[] shardToNode = new String[LOGICAL_SHARDS];       // logical shard -> physical node
        final Map<String, Map<Integer, Map<String, Integer>>> data = new LinkedHashMap<>(); // node -> shard -> rows

        ShardRouter(List<String> initial) {
            nodes.addAll(initial);
            for (int s = 0; s < LOGICAL_SHARDS; s++) shardToNode[s] = initial.get(s % initial.size());
            for (String n : initial) data.put(n, new HashMap<>());
        }

        static int shardOf(String key) { return (int) (fnv1a(key) % LOGICAL_SHARDS); }
        String nodeOf(String key) { return shardToNode[shardOf(key)]; }

        void put(String key, int value) {
            int s = shardOf(key);
            data.get(shardToNode[s]).computeIfAbsent(s, x -> new HashMap<>()).put(key, value);
        }

        Integer get(String key) {
            int s = shardOf(key);
            return data.get(shardToNode[s]).getOrDefault(s, Map.of()).get(key);
        }

        int shardCount(String node) {
            int c = 0;
            for (String n : shardToNode) if (n.equals(node)) c++;
            return c;
        }

        /** Moves whole logical shards from the busiest nodes to the new one until it has its fair share. */
        int addNode(String newNode, List<Integer> moved) {
            nodes.add(newNode);
            data.put(newNode, new HashMap<>());
            int target = LOGICAL_SHARDS / nodes.size();
            int keysMoved = 0;
            while (shardCount(newNode) < target) {
                String donor = nodes.get(0);
                for (String n : nodes.subList(0, nodes.size() - 1))
                    if (shardCount(n) > shardCount(donor)) donor = n;
                int shard = 0;
                while (!shardToNode[shard].equals(donor)) shard++; // donor's lowest-numbered shard
                Map<String, Integer> rows = data.get(donor).remove(shard);
                if (rows == null) rows = new HashMap<>();
                data.get(newNode).put(shard, rows); // in production: copy, catch up, then flip the map
                shardToNode[shard] = newNode;
                moved.add(shard);
                keysMoved += rows.size();
            }
            return keysMoved;
        }

        /** Sends the query to every node (in parallel in real life), then merges the partial results. */
        List<Result> scatterGather(IntPredicate pred) {
            List<Result> results = new ArrayList<>();
            for (String node : nodes)
                for (Map<String, Integer> rows : data.get(node).values())
                    rows.forEach((k, v) -> { if (pred.test(v)) results.add(new Result(k, v)); });
            results.sort((a, b) -> a.key().compareTo(b.key()));
            return results;
        }

        String keyCounts() {
            return nodes.stream()
                .map(n -> n + "=" + data.get(n).values().stream().mapToInt(Map::size).sum())
                .collect(Collectors.joining(" "));
        }
    }

    public static void main(String[] args) {
        ShardRouter router = new ShardRouter(List.of("node-A", "node-B", "node-C"));
        List<String> keys = new ArrayList<>();
        for (int i = 1; i <= 1000; i++) {
            keys.add("order:" + i);
            router.put("order:" + i, i * 7919 % 1000); // order amount in rupees
        }
        System.out.println(LOGICAL_SHARDS + " logical shards on " + router.nodes.size() + " nodes");
        System.out.println("keys per node: " + router.keyCounts());
        show(router, "order:42");

        List<Integer> moved = new ArrayList<>();
        int keysMoved = router.addNode("node-D", moved);
        System.out.println("add node-D: moved shards " + moved + ", " + keysMoved + " of " + keys.size() + " keys moved");
        long naive = keys.stream().filter(k -> fnv1a(k) % 3 != fnv1a(k) % 4).count();
        System.out.println("naive hash % nodes (3 -> 4) would move " + naive + " of " + keys.size() + " keys");
        System.out.println("keys per node: " + router.keyCounts());
        show(router, "order:42");

        List<Result> hits = router.scatterGather(amount -> amount >= 995);
        System.out.println("scatter-gather amount >= 995: asked " + router.nodes.size() + " nodes, " + hits.size() + " matches");
        for (Result r : hits) System.out.println("  " + r.key() + " = " + r.value());
    }

    static void show(ShardRouter router, String k) {
        System.out.println("get " + k + " -> shard " + ShardRouter.shardOf(k) + " on " + router.nodeOf(k)
            + ", amount " + router.get(k));
    }
}
`,
      python: String.raw`from typing import Callable, Dict, List, Tuple

LOGICAL_SHARDS = 16


def fnv1a(key: str) -> int:
    """32-bit FNV-1a hash: stable across languages and runs (unlike Python's hash())."""
    h = 2166136261
    for b in key.encode():
        h ^= b
        h = (h * 16777619) & 0xFFFFFFFF
    return h


class ShardRouter:
    def __init__(self, nodes: List[str]):
        self.nodes = list(nodes)
        # shard map: logical shard -> physical node. This small table is all a router needs.
        self.shard_to_node = [nodes[s % len(nodes)] for s in range(LOGICAL_SHARDS)]
        # data[node][shard] = {key: value}; keys stay grouped by logical shard so a shard moves as a unit
        self.data: Dict[str, Dict[int, Dict[str, int]]] = {n: {} for n in nodes}

    @staticmethod
    def shard_of(key: str) -> int:
        return fnv1a(key) % LOGICAL_SHARDS

    def node_of(self, key: str) -> str:
        return self.shard_to_node[self.shard_of(key)]

    def put(self, key: str, value: int) -> None:
        s = self.shard_of(key)
        self.data[self.shard_to_node[s]].setdefault(s, {})[key] = value

    def get(self, key: str):
        s = self.shard_of(key)
        return self.data[self.shard_to_node[s]].get(s, {}).get(key)

    def shard_count(self, node: str) -> int:
        return sum(1 for n in self.shard_to_node if n == node)

    def add_node(self, new_node: str) -> Tuple[List[int], int]:
        """Move whole logical shards from the busiest nodes to the new one until it has its fair share."""
        self.nodes.append(new_node)
        self.data[new_node] = {}
        target = LOGICAL_SHARDS // len(self.nodes)
        moved: List[int] = []
        keys_moved = 0
        while self.shard_count(new_node) < target:
            donor = max(self.nodes[:-1], key=self.shard_count)  # first node wins ties
            shard = self.shard_to_node.index(donor)             # donor's lowest-numbered shard
            rows = self.data[donor].pop(shard, {})
            self.data[new_node][shard] = rows  # in production: copy, catch up, then flip the map
            self.shard_to_node[shard] = new_node
            moved.append(shard)
            keys_moved += len(rows)
        return moved, keys_moved

    def scatter_gather(self, pred: Callable[[int], bool]) -> Tuple[int, List[Tuple[str, int]]]:
        """Send the query to every node (in parallel in real life), then merge the partial results."""
        results: List[Tuple[str, int]] = []
        for node in self.nodes:
            for rows in self.data[node].values():
                results.extend((k, v) for k, v in rows.items() if pred(v))
        results.sort()
        return len(self.nodes), results

    def key_counts(self) -> str:
        return " ".join(f"{n}={sum(len(r) for r in self.data[n].values())}" for n in self.nodes)


if __name__ == "__main__":
    router = ShardRouter(["node-A", "node-B", "node-C"])
    keys = [f"order:{i}" for i in range(1, 1001)]
    for i, k in enumerate(keys, start=1):
        router.put(k, i * 7919 % 1000)  # order amount in rupees
    print(f"{LOGICAL_SHARDS} logical shards on {len(router.nodes)} nodes")
    print("keys per node:", router.key_counts())
    print(f"get order:42 -> shard {router.shard_of('order:42')} on {router.node_of('order:42')}, amount {router.get('order:42')}")

    moved, keys_moved = router.add_node("node-D")
    print(f"add node-D: moved shards {moved}, {keys_moved} of {len(keys)} keys moved")
    naive = sum(1 for k in keys if fnv1a(k) % 3 != fnv1a(k) % 4)
    print(f"naive hash % nodes (3 -> 4) would move {naive} of {len(keys)} keys")
    print("keys per node:", router.key_counts())
    print(f"get order:42 -> shard {router.shard_of('order:42')} on {router.node_of('order:42')}, amount {router.get('order:42')}")

    queried, hits = router.scatter_gather(lambda amount: amount >= 995)
    print(f"scatter-gather amount >= 995: asked {queried} nodes, {len(hits)} matches")
    for k, v in hits:
        print(f"  {k} = {v}")
`,
      cpp: String.raw`#include <algorithm>
#include <cstdint>
#include <functional>
#include <iostream>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

constexpr int LOGICAL_SHARDS = 16;

// 32-bit FNV-1a hash: stable across languages and runs (std::hash is not).
uint32_t fnv1a(const std::string& key) {
    uint32_t h = 2166136261u;
    for (unsigned char b : key) {
        h ^= b;
        h *= 16777619u;  // unsigned overflow wraps at 32 bits
    }
    return h;
}

using Rows = std::unordered_map<std::string, int>;

class ShardRouter {
public:
    std::vector<std::string> nodes;

    explicit ShardRouter(const std::vector<std::string>& initial) : nodes(initial) {
        for (int s = 0; s < LOGICAL_SHARDS; s++) shardToNode_.push_back(initial[s % initial.size()]);
        for (const auto& n : initial) data_[n];
    }

    static int shardOf(const std::string& key) { return static_cast<int>(fnv1a(key) % LOGICAL_SHARDS); }
    const std::string& nodeOf(const std::string& key) const { return shardToNode_[shardOf(key)]; }

    void put(const std::string& key, int value) {
        int s = shardOf(key);
        data_[shardToNode_[s]][s][key] = value;
    }

    int get(const std::string& key) {  // -1 if missing
        int s = shardOf(key);
        auto& rows = data_[shardToNode_[s]][s];
        auto it = rows.find(key);
        return it == rows.end() ? -1 : it->second;
    }

    int shardCount(const std::string& node) const {
        return static_cast<int>(std::count(shardToNode_.begin(), shardToNode_.end(), node));
    }

    // Moves whole logical shards from the busiest nodes to the new one until it has its fair share.
    int addNode(const std::string& newNode, std::vector<int>& moved) {
        nodes.push_back(newNode);
        data_[newNode];
        int target = LOGICAL_SHARDS / static_cast<int>(nodes.size());
        int keysMoved = 0;
        while (shardCount(newNode) < target) {
            std::string donor = nodes[0];
            for (size_t i = 0; i + 1 < nodes.size(); i++)
                if (shardCount(nodes[i]) > shardCount(donor)) donor = nodes[i];
            int shard = 0;
            while (shardToNode_[shard] != donor) shard++;  // donor's lowest-numbered shard
            Rows rows = std::move(data_[donor][shard]);
            data_[donor].erase(shard);
            keysMoved += static_cast<int>(rows.size());
            data_[newNode][shard] = std::move(rows);  // in production: copy, catch up, then flip the map
            shardToNode_[shard] = newNode;
            moved.push_back(shard);
        }
        return keysMoved;
    }

    // Sends the query to every node (in parallel in real life), then merges the partial results.
    std::vector<std::pair<std::string, int>> scatterGather(const std::function<bool(int)>& pred) {
        std::vector<std::pair<std::string, int>> results;
        for (const auto& node : nodes)
            for (const auto& [shard, rows] : data_[node])
                for (const auto& [k, v] : rows)
                    if (pred(v)) results.emplace_back(k, v);
        std::sort(results.begin(), results.end());
        return results;
    }

    std::string keyCounts() {
        std::string out;
        for (const auto& n : nodes) {
            size_t total = 0;
            for (const auto& [shard, rows] : data_[n]) total += rows.size();
            out += (out.empty() ? "" : " ") + n + "=" + std::to_string(total);
        }
        return out;
    }

private:
    std::vector<std::string> shardToNode_;                                // logical shard -> physical node
    std::unordered_map<std::string, std::unordered_map<int, Rows>> data_;  // node -> shard -> rows
};

int main() {
    ShardRouter router({"node-A", "node-B", "node-C"});
    std::vector<std::string> keys;
    for (int i = 1; i <= 1000; i++) {
        keys.push_back("order:" + std::to_string(i));
        router.put(keys.back(), i * 7919 % 1000);  // order amount in rupees
    }
    auto show = [&](const std::string& k) {
        std::cout << "get " << k << " -> shard " << ShardRouter::shardOf(k) << " on " << router.nodeOf(k)
                  << ", amount " << router.get(k) << "\n";
    };
    std::cout << LOGICAL_SHARDS << " logical shards on " << router.nodes.size() << " nodes\n";
    std::cout << "keys per node: " << router.keyCounts() << "\n";
    show("order:42");

    std::vector<int> moved;
    int keysMoved = router.addNode("node-D", moved);
    std::cout << "add node-D: moved shards [";
    for (size_t i = 0; i < moved.size(); i++) std::cout << (i ? ", " : "") << moved[i];
    std::cout << "], " << keysMoved << " of " << keys.size() << " keys moved\n";
    int naive = 0;
    for (const auto& k : keys)
        if (fnv1a(k) % 3 != fnv1a(k) % 4) naive++;
    std::cout << "naive hash % nodes (3 -> 4) would move " << naive << " of " << keys.size() << " keys\n";
    std::cout << "keys per node: " << router.keyCounts() << "\n";
    show("order:42");

    auto hits = router.scatterGather([](int amount) { return amount >= 995; });
    std::cout << "scatter-gather amount >= 995: asked " << router.nodes.size() << " nodes, " << hits.size()
              << " matches\n";
    for (const auto& [k, v] : hits) std::cout << "  " << k << " = " << v << "\n";
}
`,
      javascript: String.raw`const LOGICAL_SHARDS = 16;

// 32-bit FNV-1a hash: stable across languages and runs.
function fnv1a(key) {
  let h = 2166136261;
  for (const b of Buffer.from(key, "utf8")) {
    h ^= b;
    h = Math.imul(h, 16777619) >>> 0; // 32-bit multiply, kept unsigned
  }
  return h >>> 0;
}

class ShardRouter {
  constructor(nodes) {
    this.nodes = [...nodes];
    // shard map: logical shard -> physical node. This small table is all a router needs.
    this.shardToNode = Array.from({ length: LOGICAL_SHARDS }, (_, s) => nodes[s % nodes.length]);
    // data[node] = Map(shard -> Map(key -> value)); a logical shard moves as a unit
    this.data = new Map(nodes.map((n) => [n, new Map()]));
  }

  static shardOf(key) { return fnv1a(key) % LOGICAL_SHARDS; }
  nodeOf(key) { return this.shardToNode[ShardRouter.shardOf(key)]; }

  put(key, value) {
    const s = ShardRouter.shardOf(key);
    const shards = this.data.get(this.shardToNode[s]);
    if (!shards.has(s)) shards.set(s, new Map());
    shards.get(s).set(key, value);
  }

  get(key) {
    const s = ShardRouter.shardOf(key);
    const rows = this.data.get(this.shardToNode[s]).get(s);
    return rows ? rows.get(key) : undefined;
  }

  shardCount(node) { return this.shardToNode.filter((n) => n === node).length; }

  // Move whole logical shards from the busiest nodes to the new one until it has its fair share.
  addNode(newNode) {
    this.nodes.push(newNode);
    this.data.set(newNode, new Map());
    const target = Math.floor(LOGICAL_SHARDS / this.nodes.length);
    const moved = [];
    let keysMoved = 0;
    while (this.shardCount(newNode) < target) {
      let donor = this.nodes[0];
      for (const n of this.nodes.slice(0, -1)) if (this.shardCount(n) > this.shardCount(donor)) donor = n;
      const shard = this.shardToNode.indexOf(donor); // donor's lowest-numbered shard
      const rows = this.data.get(donor).get(shard) || new Map();
      this.data.get(donor).delete(shard);
      this.data.get(newNode).set(shard, rows); // in production: copy, catch up, then flip the map
      this.shardToNode[shard] = newNode;
      moved.push(shard);
      keysMoved += rows.size;
    }
    return { moved, keysMoved };
  }

  // Send the query to every node (in parallel in real life), then merge the partial results.
  scatterGather(pred) {
    const results = [];
    for (const node of this.nodes)
      for (const rows of this.data.get(node).values())
        for (const [k, v] of rows) if (pred(v)) results.push([k, v]);
    results.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return { queried: this.nodes.length, results };
  }

  keyCounts() {
    return this.nodes
      .map((n) => n + "=" + [...this.data.get(n).values()].reduce((sum, rows) => sum + rows.size, 0))
      .join(" ");
  }
}

const router = new ShardRouter(["node-A", "node-B", "node-C"]);
const keys = Array.from({ length: 1000 }, (_, i) => "order:" + (i + 1));
keys.forEach((k, i) => router.put(k, ((i + 1) * 7919) % 1000)); // order amount in rupees
const show = (k) =>
  console.log(\`get \${k} -> shard \${ShardRouter.shardOf(k)} on \${router.nodeOf(k)}, amount \${router.get(k)}\`);

console.log(\`\${LOGICAL_SHARDS} logical shards on \${router.nodes.length} nodes\`);
console.log("keys per node:", router.keyCounts());
show("order:42");

const { moved, keysMoved } = router.addNode("node-D");
console.log(\`add node-D: moved shards [\${moved.join(", ")}], \${keysMoved} of \${keys.length} keys moved\`);
const naive = keys.filter((k) => fnv1a(k) % 3 !== fnv1a(k) % 4).length;
console.log(\`naive hash % nodes (3 -> 4) would move \${naive} of \${keys.length} keys\`);
console.log("keys per node:", router.keyCounts());
show("order:42");

const { queried, results } = router.scatterGather((amount) => amount >= 995);
console.log(\`scatter-gather amount >= 995: asked \${queried} nodes, \${results.length} matches\`);
for (const [k, v] of results) console.log(\`  \${k} = \${v}\`);
`,
      go: String.raw`package main

import (
	"fmt"
	"sort"
	"strings"
)

const LogicalShards = 16

// fnv1a is the 32-bit FNV-1a hash: stable across languages and runs.
func fnv1a(key string) uint32 {
	h := uint32(2166136261)
	for i := 0; i < len(key); i++ {
		h ^= uint32(key[i])
		h *= 16777619 // wraps at 32 bits
	}
	return h
}

type KV struct {
	Key   string
	Value int
}

type ShardRouter struct {
	Nodes       []string
	shardToNode []string                          // logical shard -> physical node
	data        map[string]map[int]map[string]int // node -> shard -> key -> value
}

func NewShardRouter(nodes []string) *ShardRouter {
	r := &ShardRouter{Nodes: append([]string{}, nodes...), data: map[string]map[int]map[string]int{}}
	for s := 0; s < LogicalShards; s++ {
		r.shardToNode = append(r.shardToNode, nodes[s%len(nodes)])
	}
	for _, n := range nodes {
		r.data[n] = map[int]map[string]int{}
	}
	return r
}

func ShardOf(key string) int                    { return int(fnv1a(key) % LogicalShards) }
func (r *ShardRouter) NodeOf(key string) string { return r.shardToNode[ShardOf(key)] }

func (r *ShardRouter) Put(key string, value int) {
	s := ShardOf(key)
	shards := r.data[r.shardToNode[s]]
	if shards[s] == nil {
		shards[s] = map[string]int{}
	}
	shards[s][key] = value
}

func (r *ShardRouter) Get(key string) (int, bool) {
	s := ShardOf(key)
	v, ok := r.data[r.shardToNode[s]][s][key] // reading a nil inner map is safe in Go
	return v, ok
}

func (r *ShardRouter) shardCount(node string) int {
	c := 0
	for _, n := range r.shardToNode {
		if n == node {
			c++
		}
	}
	return c
}

// AddNode moves whole logical shards from the busiest nodes to the new one until it has its fair share.
func (r *ShardRouter) AddNode(newNode string) (moved []int, keysMoved int) {
	r.Nodes = append(r.Nodes, newNode)
	r.data[newNode] = map[int]map[string]int{}
	target := LogicalShards / len(r.Nodes)
	for r.shardCount(newNode) < target {
		donor := r.Nodes[0]
		for _, n := range r.Nodes[:len(r.Nodes)-1] {
			if r.shardCount(n) > r.shardCount(donor) {
				donor = n
			}
		}
		shard := 0
		for r.shardToNode[shard] != donor { // donor's lowest-numbered shard
			shard++
		}
		rows := r.data[donor][shard]
		delete(r.data[donor], shard)
		r.data[newNode][shard] = rows // in production: copy, catch up, then flip the map
		r.shardToNode[shard] = newNode
		moved = append(moved, shard)
		keysMoved += len(rows)
	}
	return moved, keysMoved
}

// ScatterGather sends the query to every node (in parallel in real life), then merges the results.
func (r *ShardRouter) ScatterGather(pred func(int) bool) (int, []KV) {
	var results []KV
	for _, node := range r.Nodes {
		for _, rows := range r.data[node] {
			for k, v := range rows {
				if pred(v) {
					results = append(results, KV{k, v})
				}
			}
		}
	}
	sort.Slice(results, func(i, j int) bool { return results[i].Key < results[j].Key })
	return len(r.Nodes), results
}

func (r *ShardRouter) KeyCounts() string {
	parts := []string{}
	for _, n := range r.Nodes {
		total := 0
		for _, rows := range r.data[n] {
			total += len(rows)
		}
		parts = append(parts, fmt.Sprintf("%s=%d", n, total))
	}
	return strings.Join(parts, " ")
}

func main() {
	router := NewShardRouter([]string{"node-A", "node-B", "node-C"})
	var keys []string
	for i := 1; i <= 1000; i++ {
		k := fmt.Sprintf("order:%d", i)
		keys = append(keys, k)
		router.Put(k, i*7919%1000) // order amount in rupees
	}
	show := func(k string) {
		v, _ := router.Get(k)
		fmt.Printf("get %s -> shard %d on %s, amount %d\n", k, ShardOf(k), router.NodeOf(k), v)
	}
	fmt.Printf("%d logical shards on %d nodes\n", LogicalShards, len(router.Nodes))
	fmt.Println("keys per node:", router.KeyCounts())
	show("order:42")

	moved, keysMoved := router.AddNode("node-D")
	ids := make([]string, len(moved))
	for i, s := range moved {
		ids[i] = fmt.Sprint(s)
	}
	fmt.Printf("add node-D: moved shards [%s], %d of %d keys moved\n", strings.Join(ids, ", "), keysMoved, len(keys))
	naive := 0
	for _, k := range keys {
		if fnv1a(k)%3 != fnv1a(k)%4 {
			naive++
		}
	}
	fmt.Printf("naive hash %% nodes (3 -> 4) would move %d of %d keys\n", naive, len(keys))
	fmt.Println("keys per node:", router.KeyCounts())
	show("order:42")

	queried, hits := router.ScatterGather(func(amount int) bool { return amount >= 995 })
	fmt.Printf("scatter-gather amount >= 995: asked %d nodes, %d matches\n", queried, len(hits))
	for _, kv := range hits {
		fmt.Printf("  %s = %d\n", kv.Key, kv.Value)
	}
}
`,
    },
  },
  diagrams: {
    overview: String.raw`flowchart LR
      APP[App servers] --> R["Router (shard key to shard)"]
      R --> MAP[("Shard map")]
      R --> S0
      R --> S1
      R --> S2
      subgraph S0["Shard 0: users A"]
        L0[(Leader)] --> F0[(Replica)]
      end
      subgraph S1["Shard 1: users B"]
        L1[(Leader)] --> F1[(Replica)]
      end
      subgraph S2["Shard 2: users C"]
        L2[(Leader)] --> F2[(Replica)]
      end`,
    hotkey: String.raw`flowchart LR
      W["Likes on post 42"] --> P{"pick random 0..9"}
      P --> K0["likes:42#0 on shard 1"]
      P --> K1["likes:42#1 on shard 5"]
      P --> K9["likes:42#9 on shard 12"]
      K0 --> SUM["Read: sum all 10, cache total"]
      K1 --> SUM
      K9 --> SUM`,
    scatter: String.raw`sequenceDiagram
      participant C as Client
      participant R as Router
      participant A as Shard A
      participant B as Shard B
      participant D as Shard C
      C->>R: orders with amount > 50000, top 10
      par fan out
        R->>A: same query, LIMIT 10
        R->>B: same query, LIMIT 10
        R->>D: same query, LIMIT 10
      end
      A-->>R: 10 rows
      B-->>R: 10 rows
      D-->>R: 7 rows
      R->>R: merge, sort, keep top 10
      R-->>C: 10 rows`,
    indexes: String.raw`flowchart TB
      subgraph LOCAL["Local index: ask every shard"]
        Q1["restaurant_id = 7"] --> SA["Shard A: rows + index"]
        Q1 --> SB["Shard B: rows + index"]
        Q1 --> SC["Shard C: rows + index"]
      end
      subgraph GLOBAL["Global index: ask one index partition"]
        Q2["restaurant_id = 7"] --> IX["Index partition for 7"]
        IX --> RA["Shard A row"]
        IX --> RC["Shard C row"]
      end`,
    logical: String.raw`flowchart LR
      K["hash(key) % 16"] --> LS["Logical shards 0-15"]
      LS --> MAP{"Shard map"}
      MAP -->|"6, 9, 12, 15"| A[(Node A)]
      MAP -->|"4 shards"| B[(Node B)]
      MAP -->|"4 shards"| C[(Node C)]
      MAP -->|"0, 1, 2, 3 moved here"| D[(New node D)]`,
    migration: String.raw`flowchart LR
      A["1. Snapshot + log position"] --> B["2. Replay change log"]
      B --> C["3. Double write (optional)"]
      C --> D["4. Verify checksums"]
      D --> E["5. Switch reads"]
      E --> F["6. Short write pause, flip map"]
      F --> G["7. Delete old copy"]`,
  },
});
