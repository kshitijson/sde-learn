SD.register({
  id: "sql-vs-nosql",
  html: String.raw`
    <p class="lead">Almost every design interview has a moment where you say "and the data goes in…". Relational (SQL) databases store data in tables with a fixed schema, join them freely and give you ACID transactions. NoSQL databases drop some of those guarantees to get easier horizontal scaling, flexible schemas or very high write throughput. Neither is "better". The right answer depends on your data's shape, your access patterns and your consistency needs, and a good candidate can say why in two sentences.</p>

    <h2>What SQL databases give you</h2>
    <p>A <strong>relational database</strong> (PostgreSQL, MySQL, Oracle, SQL Server) stores data as <strong>tables</strong> of rows and columns. Each table has a <strong>schema</strong>: column names, types and constraints, declared up front. Rows refer to each other with <strong>foreign keys</strong>, and you combine tables at query time with <strong>joins</strong>. You ask questions in SQL, a declarative language: you say <em>what</em> you want and the query planner decides <em>how</em> to fetch it.</p>
    <div data-diagram="er" data-caption="A small e-commerce schema in the relational model. Each fact lives in one place; joins put it back together."></div>
    <h3>ACID in one line each</h3>
    <ul>
      <li><strong>Atomicity</strong>: a transaction's writes all happen or none do. Debit wallet and create order succeed together or roll back together.</li>
      <li><strong>Consistency</strong>: constraints (foreign keys, unique, check) hold before and after every transaction. You cannot create an order for a user who does not exist.</li>
      <li><strong>Isolation</strong>: concurrent transactions do not see each other's half-done work (how strictly depends on the isolation level; see <a href="#/p/transactions">Transactions &amp; isolation levels</a>).</li>
      <li><strong>Durability</strong>: once committed, the data survives a crash because it is in the write-ahead log on disk.</li>
    </ul>
    <h3>Strengths</h3>
    <ul>
      <li><strong>Ad-hoc queries</strong>: you do not have to know every question up front. A new report next quarter is just a new SQL query plus maybe an index.</li>
      <li><strong>Data integrity</strong>: the database enforces types, uniqueness and relationships, so bugs in one service cannot easily corrupt data.</li>
      <li><strong>Multi-row transactions</strong>: money movement, inventory reservation and bookings need them.</li>
      <li><strong>Mature ecosystem</strong>: 40+ years of tooling, ORMs, backups, monitoring, and engineers who already know it.</li>
    </ul>

    <h2>Why NoSQL appeared</h2>
    <p>In the late 2000s Google (Bigtable), Amazon (Dynamo) and Facebook (Cassandra) hit limits that a single relational server could not meet. "NoSQL" (often read as "not only SQL") is an umbrella for the databases that came out of that period. They share three motivations:</p>
    <div class="grid-3">
      <div class="card"><strong>Scale-out by design</strong><p>Data is partitioned across many cheap nodes from day one, with replication and rebalancing built in. Adding capacity means adding nodes, not buying a bigger box.</p></div>
      <div class="card"><strong>Flexible schema</strong><p>Documents in the same collection can have different fields. Useful when product attributes vary (a phone has RAM; a shirt has size and fabric) or the schema changes weekly.</p></div>
      <div class="card"><strong>High write throughput</strong><p>Log-structured storage (LSM trees, see <a href="#/p/indexing">Indexing</a>) turns random writes into sequential appends, so Cassandra-style stores take hundreds of thousands of writes per second per cluster easily.</p></div>
    </div>
    <p>The price: most NoSQL stores give up <strong>joins</strong> (you model data around queries instead), often give up <strong>multi-item transactions</strong> (or limit them), and many default to <strong>eventual consistency</strong>, where a read right after a write may return the old value for a short time. The four main families are key-value, document, wide-column and graph; see <a href="#/p/nosql-types">NoSQL types</a> for each one in depth.</p>

    <h2>The big comparison</h2>
    <table>
      <thead><tr><th>Aspect</th><th>SQL (relational)</th><th>NoSQL (varies by type)</th></tr></thead>
      <tbody>
        <tr><td>Data model</td><td>Tables, rows, columns, foreign keys</td><td>Key-value, documents (JSON), wide rows, graphs</td></tr>
        <tr><td>Schema</td><td>Schema-on-write: declared and enforced</td><td>Schema-on-read: the application interprets the shape</td></tr>
        <tr><td>Relationships</td><td>Joins at query time</td><td>Embedding / duplication; joins in app code or not at all</td></tr>
        <tr><td>Transactions</td><td>Full ACID across many rows and tables</td><td>Usually single-item atomicity; some offer limited multi-item (MongoDB 4.0+, DynamoDB TransactWriteItems)</td></tr>
        <tr><td>Consistency</td><td>Strong on the primary</td><td>Often eventual or tunable (Cassandra QUORUM, DynamoDB strongly consistent reads)</td></tr>
        <tr><td>Scaling</td><td>Vertical first; read replicas; sharding is manual or via a layer (Vitess, Citus)</td><td>Horizontal partitioning built in</td></tr>
        <tr><td>Query flexibility</td><td>High: any question SQL can express</td><td>Low to medium: fast for the access patterns you designed for</td></tr>
        <tr><td>Write throughput</td><td>Good (tens of thousands/sec per node with B-tree storage)</td><td>Very high with LSM-based stores</td></tr>
        <tr><td>Typical use</td><td>Orders, payments, users, bookings, inventory</td><td>Sessions, carts, feeds, chat messages, catalogues, events, IoT</td></tr>
        <tr><td>Examples</td><td>PostgreSQL, MySQL, Oracle, Aurora, CockroachDB</td><td>Redis, DynamoDB, MongoDB, Cassandra, HBase, Neo4j</td></tr>
      </tbody>
    </table>
    <div class="callout info"><strong>NewSQL</strong>"NewSQL" databases such as CockroachDB, Google Spanner, TiDB and YugabyteDB speak SQL and give ACID transactions but shard and replicate automatically. They blur the line and are a strong answer when you need both SQL and scale-out.</div>

    <h2>A decision flowchart for the interview</h2>
    <p>Do not pick a database by brand. Walk through the questions below out loud; the interviewer wants to hear the reasoning.</p>
    <div data-diagram="decide" data-caption="Picking a primary store: start from the hardest requirement (transactions, then access pattern, then scale)."></div>
    <ol class="steps">
      <li><strong>Do I need multi-row transactions or strong integrity?</strong> Payments, wallets, orders, seat booking: yes. Start with SQL.</li>
      <li><strong>Is the access pattern a simple lookup by key?</strong> Sessions, carts, feature flags, rate-limit counters: a key-value store.</li>
      <li><strong>Is it write-heavy, append-only and queried by one key plus time?</strong> Chat messages, activity logs, IoT readings: wide-column (Cassandra, ScyllaDB) or a time-series store.</li>
      <li><strong>Are records self-contained with varied fields?</strong> Product catalogue, CMS content, user profiles with optional fields: a document store.</li>
      <li><strong>Are the questions about relationships many hops deep?</strong> Friends-of-friends, fraud rings: a graph database.</li>
      <li><strong>Is it full-text search or analytics?</strong> Those are secondary stores fed from the primary: Elasticsearch (<a href="#/p/search-index">search</a>) or a column store (<a href="#/p/timeseries-olap">OLAP</a>).</li>
    </ol>
    <div class="callout tip"><strong>Default when unsure</strong>Pick PostgreSQL or MySQL. They handle far more scale than most interview problems need (a single well-tuned Postgres node handles thousands of transactions per second and terabytes of data), and you can add read replicas, caching and sharding later. Switch only when you can name the requirement that breaks it.</div>

    <h2>Common myths</h2>
    <h3>Myth 1: "NoSQL is always faster"</h3>
    <p>NoSQL is fast for the queries it was modelled for: a single-partition read in Cassandra or a <code>GetItem</code> in DynamoDB is a few milliseconds at any scale. But a query it was not modelled for may be impossible or need a full scan. A primary-key lookup in Postgres with the index in memory is also sub-millisecond on the server. Speed comes from data modelling, indexes and caching, not from the label.</p>
    <h3>Myth 2: "SQL can't scale"</h3>
    <p>Some of the largest systems on earth run on sharded relational databases:</p>
    <ul>
      <li><strong>YouTube</strong> built <strong>Vitess</strong> to shard MySQL horizontally behind a proxy layer; it later became a CNCF project. <strong>Slack</strong> moved its main datastore to Vitess, and GitHub, Square (Cash App) and others run it too.</li>
      <li><strong>Facebook</strong> stores its social graph in sharded MySQL behind TAO, a caching graph layer.</li>
      <li><strong>Flipkart</strong> runs MySQL widely for transactional systems such as orders, with sharding and replication managed by its platform teams, alongside NoSQL stores (HBase, Aerospike, Redis) where they fit.</li>
      <li><strong>Instagram</strong> scaled on sharded PostgreSQL with thousands of logical shards mapped onto fewer physical servers.</li>
      <li>Managed options like Amazon Aurora (up to 15 read replicas, 128 TiB storage) and Citus (distributed Postgres) push a single logical SQL database a long way.</li>
    </ul>
    <p>What is true: sharding SQL is <em>your</em> job (or a layer's job), and cross-shard joins and transactions become hard. See <a href="#/p/sharding">Sharding</a>.</p>
    <h3>Myth 3: "NoSQL means no schema"</h3>
    <p>The schema still exists; it moved from the database into your application code. Every reader must handle old and new document shapes. MongoDB even offers JSON Schema validation because teams wanted the guarantees back.</p>
    <h3>Myth 4: "NoSQL can't do transactions"</h3>
    <p>Many can, within limits: MongoDB has multi-document ACID transactions since 4.0, DynamoDB has transactions over up to 100 items, and Redis has <code>MULTI</code>/<code>EXEC</code> and Lua scripts. They are usually slower and more restricted than in a relational database.</p>

    <h2>Polyglot persistence: an e-commerce example</h2>
    <p>Real systems do not choose one database. <strong>Polyglot persistence</strong> means each kind of data lives in the store that suits its access pattern. Here is a typical Flipkart- or Amazon-style split:</p>
    <div data-diagram="poly" data-caption="Polyglot persistence: one source of truth per kind of data, with change events feeding search and analytics."></div>
    <table>
      <thead><tr><th>Data</th><th>Store</th><th>Why</th></tr></thead>
      <tbody>
        <tr><td>Orders, payments, inventory</td><td>PostgreSQL / MySQL</td><td>Multi-row ACID transactions: reserve stock, create order, record payment atomically</td></tr>
        <tr><td>Product catalogue</td><td>MongoDB (source) + Elasticsearch (search)</td><td>Each category has different attributes; flexible documents. Elasticsearch adds full-text search, facets and ranking</td></tr>
        <tr><td>Sessions, carts, rate limits</td><td>Redis</td><td>Key lookups in under a millisecond, TTLs built in, losing a session is tolerable</td></tr>
        <tr><td>Clickstream and sales analytics</td><td>ClickHouse (or BigQuery / Snowflake)</td><td>Column storage scans billions of rows for dashboards in seconds</td></tr>
        <tr><td>Product images</td><td>Object storage (S3) + CDN</td><td>Large blobs; see <a href="#/p/object-storage">object storage</a> and <a href="#/p/cdn">CDNs</a></td></tr>
      </tbody>
    </table>
    <p>The cost of polyglot persistence is <strong>keeping copies in sync</strong> and <strong>running more systems</strong>. Use change data capture (CDC: tailing the database's log with a tool like Debezium and publishing changes to Kafka) rather than having the app write to three databases. More on this in <a href="#/p/denormalization">Denormalisation</a>.</p>
    <div class="callout warn"><strong>Don't over-engineer</strong>Five databases for a system with 1,000 users is a red flag. In an interview, introduce a second store only when you have stated the requirement that needs it ("search with typo tolerance", "100K writes/sec of events").</div>

    <h2>Trade-offs at a glance</h2>
    <div class="grid-2">
      <div class="card good"><strong>Choose SQL when</strong><ul><li>Data is relational and integrity matters</li><li>You need transactions across rows/tables</li><li>Query patterns are unknown or will change</li><li>Scale is moderate (most systems!)</li></ul></div>
      <div class="card good"><strong>Choose NoSQL when</strong><ul><li>Access patterns are known and simple (by key, by key + time)</li><li>Write volume or data size outgrows one node</li><li>Schema varies per record</li><li>Availability matters more than immediate consistency</li></ul></div>
    </div>

    <h2>What to say in the interview</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"Orders and payments need atomic multi-row updates, so they go in PostgreSQL. I'll shard by <code>user_id</code> later if one primary can't keep up, and add read replicas for order history."</li>
        <li>"Chat messages are append-heavy, about 50K writes/sec, and always read as 'latest N messages in a conversation', so a wide-column store like Cassandra partitioned by <code>conversation_id</code> fits."</li>
        <li>"Sessions are key lookups with a TTL, so Redis."</li>
        <li>"Search goes to Elasticsearch, fed by CDC from the primary; it's not the source of truth."</li>
      </ul>
    </div>
    <div class="callout warn"><strong>Pitfalls</strong>Saying "NoSQL because it scales" without numbers; picking MongoDB for money movement without discussing transactions; forgetting that a NoSQL model must be designed from access patterns first; treating the search index or cache as the source of truth.</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>Name three things a relational database gives you that most NoSQL stores trade away.</summary><div>Joins at query time, multi-row/multi-table ACID transactions, and an enforced schema with constraints (foreign keys, unique). Also flexible ad-hoc queries.</div></details>
      <details><summary>Why might a key-value store be a poor choice for an admin dashboard showing "orders over Rs 5,000 last week by city"?</summary><div>Key-value stores only answer "get value for key". That question filters and groups on non-key fields, which would need a full scan. A SQL database (with an index) or an OLAP store is right for it.</div></details>
      <details><summary>"SQL can't scale." Give two counter-examples.</summary><div>YouTube and Slack shard MySQL with Vitess; Instagram ran sharded PostgreSQL; Facebook stores its graph in sharded MySQL; Flipkart runs MySQL for transactional systems. NewSQL databases (Spanner, CockroachDB) also scale SQL horizontally.</div></details>
      <details><summary>What is polyglot persistence and what is its main cost?</summary><div>Using different databases for different kinds of data based on access patterns (Postgres for orders, Redis for sessions, Elasticsearch for search). The main cost is operational complexity and keeping copies consistent, usually solved with CDC via Kafka.</div></details>
      <details><summary>Where does the schema go in a "schemaless" document database?</summary><div>Into the application code that reads and writes documents. Every reader must handle all historical document shapes, so you need versioning or migrations anyway.</div></details>
      <details><summary>You need SQL and ACID but also automatic horizontal scaling across regions. What category of database fits?</summary><div>NewSQL / distributed SQL: Google Spanner, CockroachDB, TiDB, YugabyteDB. They shard and replicate automatically while keeping SQL and serialisable transactions, at the cost of higher write latency (consensus round trips).</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>SQL = tables, enforced schema, joins and ACID transactions; the safe default for most data.</li>
      <li>NoSQL trades joins, multi-item transactions and sometimes consistency for scale-out, flexible schemas and high write throughput.</li>
      <li>Decide from requirements: transactions first, then access pattern, then scale numbers.</li>
      <li>"NoSQL is faster" and "SQL can't scale" are myths: Vitess, sharded Postgres and NewSQL scale SQL; NoSQL is only fast for patterns you modelled.</li>
      <li>Real systems are polyglot: a transactional source of truth plus cache, search and analytics stores fed by CDC.</li>
    </ul></div>
  `,
  diagrams: {
    er: String.raw`erDiagram
      USERS ||--o{ ORDERS : places
      ORDERS ||--|{ ORDER_ITEMS : contains
      PRODUCTS ||--o{ ORDER_ITEMS : "appears in"
      USERS {
        bigint id PK
        string name
        string email
      }
      ORDERS {
        bigint id PK
        bigint user_id FK
        decimal total
        string status
      }
      ORDER_ITEMS {
        bigint order_id FK
        bigint product_id FK
        int qty
      }
      PRODUCTS {
        bigint id PK
        string title
        decimal price
      }`,
    decide: String.raw`flowchart TB
      S([New kind of data]) --> T{"Multi-row transactions or strict integrity?"}
      T -->|yes| SQL["SQL: Postgres / MySQL"]
      T -->|no| K{"Only get/put by key?"}
      K -->|yes| KV["Key-value: Redis / DynamoDB"]
      K -->|no| W{"Huge writes, read by key + time?"}
      W -->|yes| WC["Wide-column: Cassandra / ScyllaDB"]
      W -->|no| D{"Self-contained records, varied fields?"}
      D -->|yes| DOC["Document: MongoDB"]
      D -->|no| G{"Deep relationship queries?"}
      G -->|yes| GR["Graph: Neo4j"]
      G -->|no| SQL
      SQL -.->|"scale later"| NS["Replicas, sharding, Vitess, NewSQL"]`,
    poly: String.raw`flowchart LR
      APP["E-commerce services"] --> PG[("PostgreSQL: orders, payments")]
      APP --> MG[("MongoDB: catalogue")]
      APP --> RD[("Redis: sessions, carts")]
      PG -->|CDC| KF["Kafka"]
      MG -->|CDC| KF
      KF --> ES[("Elasticsearch: search")]
      KF --> CH[("ClickHouse: analytics")]`,
  },
});
