SD.register({
  id: "nosql-types",
  html: String.raw`
    <p class="lead">"NoSQL" is not one thing. It is four main families of databases, each built around a different data model: <strong>key-value</strong>, <strong>document</strong>, <strong>wide-column</strong> and <strong>graph</strong>, with search engines and time-series stores often grouped alongside. Each family is excellent at a few access patterns and poor at the rest. In an interview, naming the family and explaining <em>why its data model fits your queries</em> is worth far more than naming a product.</p>

    <h2>The four data models at a glance</h2>
    <figure class="svg-fig">
      <svg viewBox="0 0 640 430">
        <rect class="s-box" x="10" y="10" width="305" height="200" rx="10"/>
        <text class="s-title" x="162" y="36" text-anchor="middle">Key-value</text>
        <rect class="s-accent" x="30" y="56" width="110" height="34" rx="10"/>
        <text class="s-text" x="85" y="78" text-anchor="middle">session:9f2</text>
        <rect class="s-box" x="170" y="56" width="125" height="34" rx="10"/>
        <text class="s-muted" x="232" y="77" text-anchor="middle">opaque blob</text>
        <line class="s-line" x1="140" y1="73" x2="168" y2="73" marker-end="url(#arrow)"/>
        <rect class="s-accent" x="30" y="104" width="110" height="34" rx="10"/>
        <text class="s-text" x="85" y="126" text-anchor="middle">cart:u17</text>
        <rect class="s-box" x="170" y="104" width="125" height="34" rx="10"/>
        <text class="s-muted" x="232" y="125" text-anchor="middle">{items: [...]}</text>
        <line class="s-line" x1="140" y1="121" x2="168" y2="121" marker-end="url(#arrow)"/>
        <text class="s-muted" x="162" y="170" text-anchor="middle">get / put / delete by key only</text>
        <text class="s-muted" x="162" y="190" text-anchor="middle">Redis, DynamoDB, Aerospike</text>

        <rect class="s-box" x="325" y="10" width="305" height="200" rx="10"/>
        <text class="s-title" x="477" y="36" text-anchor="middle">Document</text>
        <rect class="s-accent" x="345" y="50" width="265" height="110" rx="10"/>
        <text class="s-text" x="360" y="72">{ _id: "p42",</text>
        <text class="s-text" x="372" y="92">title: "Redmi 13",</text>
        <text class="s-text" x="372" y="112">specs: { ram: "8GB" },</text>
        <text class="s-text" x="372" y="132">reviews: [ {...}, {...} ] }</text>
        <text class="s-muted" x="477" y="180" text-anchor="middle">nested JSON, query and index any field</text>
        <text class="s-muted" x="477" y="198" text-anchor="middle">MongoDB, Couchbase, Firestore</text>

        <rect class="s-box" x="10" y="220" width="305" height="200" rx="10"/>
        <text class="s-title" x="162" y="246" text-anchor="middle">Wide-column</text>
        <rect class="s-amber" x="25" y="262" width="80" height="110" rx="10"/>
        <text class="s-text" x="65" y="312" text-anchor="middle">conv:42</text>
        <text class="s-muted" x="65" y="330" text-anchor="middle">partition</text>
        <rect class="s-green" x="115" y="262" width="185" height="32" rx="10"/>
        <text class="s-text" x="207" y="283" text-anchor="middle">ts 1000 | asha | hi!</text>
        <rect class="s-green" x="115" y="301" width="185" height="32" rx="10"/>
        <text class="s-text" x="207" y="322" text-anchor="middle">ts 1005 | ravi | hey</text>
        <rect class="s-green" x="115" y="340" width="185" height="32" rx="10"/>
        <text class="s-text" x="207" y="361" text-anchor="middle">ts 1010 | asha | dinner?</text>
        <text class="s-muted" x="162" y="392" text-anchor="middle">rows sorted by clustering key</text>
        <text class="s-muted" x="162" y="410" text-anchor="middle">Cassandra, ScyllaDB, HBase, Bigtable</text>

        <rect class="s-box" x="325" y="220" width="305" height="200" rx="10"/>
        <text class="s-title" x="477" y="246" text-anchor="middle">Graph</text>
        <line class="s-line" x1="390" y1="300" x2="477" y2="275"/>
        <line class="s-line" x1="390" y1="300" x2="440" y2="360"/>
        <line class="s-line" x1="477" y1="275" x2="560" y2="310"/>
        <line class="s-line" x1="440" y1="360" x2="560" y2="310"/>
        <circle class="s-accent" cx="390" cy="300" r="22"/>
        <text class="s-text" x="390" y="305" text-anchor="middle">Asha</text>
        <circle class="s-accent" cx="477" cy="275" r="22"/>
        <text class="s-text" x="477" y="280" text-anchor="middle">Ravi</text>
        <circle class="s-accent" cx="440" cy="360" r="22"/>
        <text class="s-text" x="440" y="365" text-anchor="middle">Meera</text>
        <circle class="s-red" cx="560" cy="310" r="22"/>
        <text class="s-text" x="560" y="315" text-anchor="middle">Card</text>
        <text class="s-muted" x="510" y="282" text-anchor="middle">FOLLOWS</text>
        <text class="s-muted" x="477" y="404" text-anchor="middle">nodes + edges; traverse hops</text>
      </svg>
      <figcaption>The four NoSQL data models. Each one makes a different kind of query cheap.</figcaption>
    </figure>
    <table>
      <thead><tr><th>Family</th><th>Model</th><th>Great at</th><th>Bad at</th><th>Examples</th></tr></thead>
      <tbody>
        <tr><td>Key-value</td><td>Key → opaque value</td><td>Sub-ms get/put, caching, sessions, counters</td><td>Any query not by key; relationships</td><td>Redis, DynamoDB, Aerospike, Memcached</td></tr>
        <tr><td>Document</td><td>Key → JSON document with nested fields</td><td>Self-contained entities with varied fields; secondary indexes on fields</td><td>Many-to-many relationships, cross-document joins</td><td>MongoDB, Couchbase, Firestore</td></tr>
        <tr><td>Wide-column</td><td>Partition key → sorted rows (clustering key)</td><td>Huge write volume; "by key, ordered by time" reads; multi-region</td><td>Ad-hoc queries, aggregates, joins, strong transactions</td><td>Cassandra, ScyllaDB, HBase, Bigtable</td></tr>
        <tr><td>Graph</td><td>Nodes and edges with properties</td><td>Multi-hop traversals: friends-of-friends, fraud rings, recommendations</td><td>Bulk scans, very high write volume, easy sharding</td><td>Neo4j, Amazon Neptune, JanusGraph</td></tr>
      </tbody>
    </table>

    <h2>Key-value stores</h2>
    <p>The simplest model: a giant distributed hash map. You <code>put(key, value)</code> and <code>get(key)</code>; the database does not look inside the value. Because a lookup is just "hash the key, go to the owning node", they are the fastest and easiest to scale (see <a href="#/p/consistent-hashing">consistent hashing</a>).</p>
    <ul>
      <li><strong>Redis</strong>: in-memory, sub-millisecond, with rich value types (lists, sets, sorted sets, hashes). Used as a cache, session store, rate limiter, leaderboard. See <a href="#/p/caching">Caching</a>.</li>
      <li><strong>DynamoDB</strong>: Amazon's managed store with single-digit-millisecond reads at any scale. Strictly it is key-value <em>plus</em>: a table has a <strong>partition key</strong> and optional <strong>sort key</strong>, so you can query a range of items in one partition, much like wide-column.</li>
      <li><strong>Aerospike</strong>: flash-optimised key-value store popular in Indian fintech and ad-tech. PhonePe has publicly described using Aerospike for low-latency, high-throughput lookups.</li>
    </ul>
    <div class="grid-2">
      <div class="card good"><strong>Strengths</strong><ul><li>Fastest lookups, simplest scaling</li><li>Predictable latency at any size</li><li>TTLs built in (sessions, OTPs)</li></ul></div>
      <div class="card bad"><strong>Weaknesses</strong><ul><li>No query by value or range across keys (except DynamoDB sort keys / secondary indexes)</li><li>You must know the key</li><li>Redis memory is expensive per GB</li></ul></div>
    </div>

    <h2>Document stores</h2>
    <p>Each record is a <strong>document</strong>, usually JSON (MongoDB stores BSON, a binary JSON). Documents in a collection can have different fields, nest objects and arrays, and you can index and query any field. The guiding idea is <strong>store together what you read together</strong>: a product with its specs and top reviews is one document, so one read renders the page.</p>
    <ul>
      <li><strong>MongoDB</strong>: the most popular. Secondary indexes, an aggregation pipeline, replica sets, built-in sharding, multi-document transactions since 4.0. Max document size 16 MB.</li>
      <li><strong>Couchbase</strong>: document store with a built-in memory-first cache layer and SQL-like N1QL queries; used where low-latency reads matter.</li>
    </ul>
    <div class="grid-2">
      <div class="card good"><strong>Strengths</strong><ul><li>Flexible schema: product catalogues, CMS, user profiles</li><li>One read fetches a whole entity (no joins)</li><li>Rich queries and indexes on nested fields</li></ul></div>
      <div class="card bad"><strong>Weaknesses</strong><ul><li>Many-to-many data leads to duplication or app-side joins</li><li>Unbounded arrays inside a document grow until they hit size limits</li><li>Transactions exist but are slower than a relational database's</li></ul></div>
    </div>
    <div class="callout tip"><strong>Embed or reference?</strong>Embed when the child is read with the parent and is bounded (an address inside a user). Reference (store an id) when the child is large, unbounded or shared (a user's 50,000 orders, or an author shared by many books).</div>

    <h2>Wide-column stores</h2>
    <p>Wide-column stores come from Google's Bigtable paper (2006) and Amazon's Dynamo paper (2007). Despite the name, think of them as a <strong>two-level map</strong>: <code>partition key → (clustering key → columns)</code>.</p>
    <ul>
      <li>The <strong>partition key</strong> is hashed to choose which nodes store the data. All rows with the same partition key live together on the same replicas.</li>
      <li>The <strong>clustering key</strong> sorts rows <em>inside</em> a partition on disk. So "the latest 50 messages in conversation 42" is one seek plus a sequential read.</li>
    </ul>
    <h3>Why writes are so fast: the LSM write path</h3>
    <p>Cassandra, ScyllaDB and HBase use a <strong>log-structured merge tree</strong> (LSM). A write is appended to a commit log (sequential disk I/O) and inserted into an in-memory sorted table (memtable), then acknowledged. When the memtable fills, it is flushed as an immutable sorted file (SSTable). Background <strong>compaction</strong> merges SSTables. No random disk writes on the hot path, so a single node handles tens of thousands of writes per second. Details in <a href="#/p/indexing">Indexing: B-trees &amp; LSM trees</a>.</p>
    <div data-diagram="lsm" data-caption="LSM write path: append to the commit log, insert into the memtable, ack. Flushes and compaction happen in the background."></div>
    <h3>Query-first modelling</h3>
    <p>In SQL you model the <em>entities</em> and write any query later. In Cassandra you model the <em>queries</em>: one table per access pattern, and the same data is often written to several tables. A query must name the full partition key; you can only filter or range on clustering columns, in order. There are no joins and secondary indexes are limited, so if a query does not fit a table, you build another table.</p>
    <h3>Worked example: messages by conversation, ordered by time</h3>
    <p>Access pattern: "show the latest 50 messages in a conversation, then page backwards". A busy group chat could have millions of messages, and a single Cassandra partition should stay well under about 100 MB, so we add a <strong>time bucket</strong> to the partition key.</p>
    <pre><code>CREATE TABLE messages_by_conversation (
  conversation_id  uuid,
  bucket           int,        -- e.g. day number, bounds partition size
  message_id       timeuuid,   -- time-ordered and unique
  sender_id        bigint,
  body             text,
  PRIMARY KEY ((conversation_id, bucket), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);

-- latest page
SELECT * FROM messages_by_conversation
 WHERE conversation_id = ? AND bucket = ? LIMIT 50;

-- older page: continue from the last message_id seen
SELECT * FROM messages_by_conversation
 WHERE conversation_id = ? AND bucket = ? AND message_id &lt; ? LIMIT 50;</code></pre>
    <ul>
      <li><code>(conversation_id, bucket)</code> is the composite partition key: one conversation-day lives on one set of replicas.</li>
      <li><code>message_id</code> is the clustering key, stored newest first, so "latest 50" is a sequential read with no sort.</li>
      <li>If a bucket is empty, the client steps back to the previous bucket. A query by sender would need a second table, <code>messages_by_sender</code>.</li>
    </ul>
    <p>This is very close to what Discord did: its messages table was partitioned by <code>(channel_id, bucket)</code> with a Snowflake <code>message_id</code> as the clustering key.</p>
    <h3>Code: a tiny in-memory wide-column store</h3>
    <p>The sketch below captures the core idea: a hash map from partition key to a <strong>sorted map</strong> of clustering key to value. <code>put</code> is an upsert, <code>range</code> reads a sorted slice of one partition, and <code>latest</code> walks it backwards. Real stores add replication, the LSM path and compaction, but the query shape is the same.</p>
    <div data-code="widecol"></div>
    <div class="grid-2">
      <div class="card good"><strong>Strengths</strong><ul><li>Massive write throughput, linear scale by adding nodes</li><li>No single leader (Cassandra/Scylla): any replica accepts writes; multi-datacenter replication built in</li><li>Tunable consistency per query (ONE, QUORUM, ALL); see <a href="#/p/replication">Replication</a></li></ul></div>
      <div class="card bad"><strong>Weaknesses</strong><ul><li>Must know queries up front; changing them means new tables and backfills</li><li>No joins, weak aggregates, limited transactions (lightweight transactions are slow)</li><li>Hot or huge partitions hurt; deletes create tombstones that slow reads</li></ul></div>
    </div>
    <h3>Real-world: Discord, Cassandra to ScyllaDB</h3>
    <p>Discord moved messages from MongoDB to Cassandra in 2017. By 2022 it stored trillions of messages on a 177-node Cassandra cluster that suffered from garbage-collection pauses and hot partitions (busy servers pinned whole nodes). It migrated to <strong>ScyllaDB</strong>, a C++ rewrite of Cassandra with a shard-per-core design and no JVM garbage collector, ending up on 72 nodes with p99 read latency dropping from roughly 40 to 125 ms to about 15 ms. They also added a Rust "data services" layer that coalesces concurrent requests for the same hot channel.</p>
    <p>Other users: Netflix and Apple run some of the largest Cassandra fleets; HBase (wide-column on top of Hadoop's HDFS) powered Facebook Messages in 2010 and is used at Flipkart and PhonePe for large datasets; Google uses Bigtable for Search, Maps and Gmail.</p>

    <h2>Graph databases</h2>
    <p>A graph database stores <strong>nodes</strong> (people, accounts, devices) and <strong>edges</strong> (FOLLOWS, PAID, USED_DEVICE), both with properties. Each node points directly at its neighbours ("index-free adjacency"), so walking a hop costs the same no matter how big the graph is. In SQL, every hop is another self-join, and four-hop queries become slow and painful to write.</p>
    <div data-diagram="fraud" data-caption="A fraud ring: accounts that look unrelated share a device and a card. A graph query finds the cluster in a few hops."></div>
    <pre><code>// Neo4j Cypher: accounts within 3 hops of a flagged account via shared devices or cards
MATCH (bad:Account {flagged: true})-[:USED|PAID_WITH*1..3]-(other:Account)
RETURN DISTINCT other.id</code></pre>
    <ul>
      <li><strong>Use for</strong>: social graphs (mutual friends, "people you may know"), fraud rings in payments and lending, recommendations, knowledge graphs, network/IT dependency maps.</li>
      <li><strong>Avoid for</strong>: simple CRUD, heavy write volume, analytics over every node. Graphs are also hard to shard because edges cross partitions.</li>
      <li>At very large scale, companies often build graph <em>layers</em> over other stores: Facebook's TAO sits on sharded MySQL; LinkedIn built its own in-memory graph service.</li>
    </ul>

    <h2>Two more families you will hear about</h2>
    <div class="grid-2">
      <div class="card"><strong>Search engines</strong><p>Elasticsearch and OpenSearch store documents in an <strong>inverted index</strong> (word → list of documents) for full-text search, fuzzy matching, filters and facets. Almost always a secondary index fed from the primary database. See <a href="#/p/search-index">Search &amp; inverted indexes</a>.</p></div>
      <div class="card"><strong>Time-series stores</strong><p>Prometheus, InfluxDB and TimescaleDB are optimised for (series, timestamp, value) data: append-only writes, compression, downsampling and retention. See <a href="#/p/timeseries-olap">Time-series &amp; analytics databases</a>.</p></div>
    </div>

    <h2>Real company usage</h2>
    <table>
      <thead><tr><th>Company</th><th>Store</th><th>What for</th></tr></thead>
      <tbody>
        <tr><td>Discord</td><td>Cassandra → ScyllaDB</td><td>Trillions of chat messages, partitioned by channel and time bucket</td></tr>
        <tr><td>Uber</td><td>Schemaless / Docstore (on MySQL), Cassandra, Redis</td><td>Trips and other entities in an append-friendly document layer built on sharded MySQL</td></tr>
        <tr><td>Swiggy, Zomato</td><td>Redis, DynamoDB</td><td>Hot lookups (restaurant serviceability, sessions, caches); Zomato has written about moving its billing platform to DynamoDB</td></tr>
        <tr><td>PhonePe</td><td>Aerospike, HBase</td><td>Low-latency key-value lookups and large transaction history datasets</td></tr>
        <tr><td>Amazon</td><td>DynamoDB</td><td>Shopping cart and many retail services; the original Dynamo paper was about the cart</td></tr>
        <tr><td>Netflix</td><td>Cassandra</td><td>Viewing history and many high-write services across regions</td></tr>
      </tbody>
    </table>

    <h2>Choosing in an interview</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"The access pattern is 'get the user's session by token', so a key-value store: Redis with a 30-minute TTL."</li>
        <li>"Messages are written 50K/sec and read as 'latest 50 in a conversation'. I'll use Cassandra with partition key <code>(conversation_id, day_bucket)</code> and clustering key <code>message_id</code> descending, so each page is one partition read."</li>
        <li>"Catalogue items have category-specific attributes, so documents in MongoDB, with Elasticsearch for search."</li>
        <li>"For fraud I need multi-hop queries over shared devices and cards; a graph database like Neo4j fits that analysis, while payments themselves stay in SQL."</li>
      </ul>
    </div>
    <div class="callout warn"><strong>Pitfalls</strong>Choosing Cassandra and then needing ad-hoc filters; partition keys with low cardinality (all of one day's data on one partition) or unbounded growth; forgetting that Cassandra reads are cheapest when they hit exactly one partition; using a graph DB as the primary store for everything.</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>What is the difference between a partition key and a clustering key in Cassandra?</summary><div>The partition key is hashed to decide which nodes store the row; all rows with the same partition key live together. The clustering key sorts rows within that partition on disk, enabling efficient range queries and ordering inside the partition.</div></details>
      <details><summary>Why add a time bucket to the partition key for chat messages?</summary><div>Without it, a busy conversation's partition grows forever, becoming a hot, huge partition that slows reads, repair and compaction. Bucketing by day or week caps partition size and spreads data across nodes.</div></details>
      <details><summary>Why are writes in Cassandra cheap?</summary><div>Writes are appended to a commit log (sequential I/O) and inserted into an in-memory memtable, then acknowledged. Sorted SSTables are flushed and compacted in the background, so there are no random disk writes or read-before-write on the hot path.</div></details>
      <details><summary>Your product catalogue has 5,000 categories with different attributes. Which family fits and why?</summary><div>A document store: each product is a self-contained document with whatever fields its category needs, read in one go, with indexes on common fields. Pair it with a search engine for full-text and faceted search.</div></details>
      <details><summary>When does a graph database beat SQL?</summary><div>When queries traverse relationships several hops deep with variable length (friends-of-friends, fraud rings, shortest paths). Each hop in SQL is a join; in a graph DB it is following a pointer, so cost depends on the neighbourhood size, not table size.</div></details>
      <details><summary>Discord moved from Cassandra to ScyllaDB. What problems motivated it?</summary><div>JVM garbage-collection pauses causing latency spikes, hot partitions from very busy channels overloading nodes, and heavy operational toil (compaction, repairs) on a 177-node cluster. ScyllaDB's C++ shard-per-core design gave lower and steadier latency on 72 nodes.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>Key-value: get/put by key, fastest and simplest (Redis, DynamoDB). Document: self-contained JSON entities with flexible fields (MongoDB).</li>
      <li>Wide-column: partition key picks the node, clustering key sorts rows inside it; LSM storage makes writes cheap (Cassandra, ScyllaDB, HBase).</li>
      <li>Graph: nodes and edges for multi-hop traversals like social graphs and fraud rings (Neo4j).</li>
      <li>NoSQL modelling is query-first: list access patterns, then design one table per pattern, duplicating data as needed.</li>
      <li>Bound partition sizes (time buckets) and avoid hot partitions; that is where wide-column designs fail in practice.</li>
    </ul></div>
  `,
  code: {
    widecol: {
      title: "In-memory wide-column store: partition key → sorted rows",
      java: String.raw`import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;

public class Main {
    // A toy wide-column store: partition key -> (clustering key -> value), sorted by clustering key.
    // Like Cassandra: the partition key picks the node, the clustering key orders rows inside the partition.
    static class WideColumnStore {
        private final Map<String, TreeMap<Long, String>> partitions = new HashMap<>();

        public synchronized void put(String partitionKey, long clusteringKey, String value) {
            partitions.computeIfAbsent(partitionKey, k -> new TreeMap<>()).put(clusteringKey, value); // upsert
        }

        // Rows with from <= clusteringKey < to, in ascending order. One partition, one sorted slice.
        public synchronized List<Map.Entry<Long, String>> range(String partitionKey, long from, long to) {
            TreeMap<Long, String> rows = partitions.get(partitionKey);
            if (rows == null) return List.of();
            return new ArrayList<>(rows.subMap(from, true, to, false).entrySet());
        }

        // The newest n rows, newest first (like CLUSTERING ORDER BY ts DESC ... LIMIT n).
        public synchronized List<Map.Entry<Long, String>> latest(String partitionKey, int n) {
            TreeMap<Long, String> rows = partitions.get(partitionKey);
            List<Map.Entry<Long, String>> out = new ArrayList<>();
            if (rows == null) return out;
            NavigableMap<Long, String> desc = rows.descendingMap();
            for (Map.Entry<Long, String> e : desc.entrySet()) {
                if (out.size() == n) break;
                out.add(e);
            }
            return out;
        }
    }

    public static void main(String[] args) {
        WideColumnStore store = new WideColumnStore();
        store.put("conv:42", 1000, "asha: hi!");
        store.put("conv:42", 1020, "ravi: see you at 8");
        store.put("conv:42", 1005, "ravi: hey asha");      // arrives out of order, stored sorted
        store.put("conv:42", 1010, "asha: dinner tonight?");
        store.put("conv:7", 1003, "meera: invoice sent");  // different partition

        System.out.println("range [1005, 1020) in conv:42");
        for (var e : store.range("conv:42", 1005, 1020)) System.out.println("  " + e.getKey() + " " + e.getValue());
        System.out.println("latest 2 in conv:42");
        for (var e : store.latest("conv:42", 2)) System.out.println("  " + e.getKey() + " " + e.getValue());
        System.out.println("conv:99 rows: " + store.range("conv:99", 0, Long.MAX_VALUE).size());
    }
}
`,
      python: String.raw`from bisect import bisect_left, insort
from threading import Lock


class WideColumnStore:
    """partition key -> rows kept sorted by clustering key (like a Cassandra partition)."""

    def __init__(self):
        self._partitions: dict[str, tuple[list[int], dict[int, str]]] = {}
        self._lock = Lock()

    def put(self, partition_key: str, clustering_key: int, value: str) -> None:
        with self._lock:
            keys, values = self._partitions.setdefault(partition_key, ([], {}))
            if clustering_key not in values:
                insort(keys, clustering_key)  # keep clustering keys sorted
            values[clustering_key] = value  # upsert

    def range(self, partition_key: str, start: int, end: int) -> list[tuple[int, str]]:
        """Rows with start <= clustering_key < end, ascending."""
        with self._lock:
            if partition_key not in self._partitions:
                return []
            keys, values = self._partitions[partition_key]
            i, j = bisect_left(keys, start), bisect_left(keys, end)
            return [(k, values[k]) for k in keys[i:j]]

    def latest(self, partition_key: str, n: int) -> list[tuple[int, str]]:
        """Newest n rows, newest first."""
        with self._lock:
            if partition_key not in self._partitions:
                return []
            keys, values = self._partitions[partition_key]
            return [(k, values[k]) for k in reversed(keys[-n:])] if n > 0 else []


if __name__ == "__main__":
    store = WideColumnStore()
    store.put("conv:42", 1000, "asha: hi!")
    store.put("conv:42", 1020, "ravi: see you at 8")
    store.put("conv:42", 1005, "ravi: hey asha")  # arrives out of order, stored sorted
    store.put("conv:42", 1010, "asha: dinner tonight?")
    store.put("conv:7", 1003, "meera: invoice sent")  # different partition

    print("range [1005, 1020) in conv:42")
    for ts, msg in store.range("conv:42", 1005, 1020):
        print(f"  {ts} {msg}")
    print("latest 2 in conv:42")
    for ts, msg in store.latest("conv:42", 2):
        print(f"  {ts} {msg}")
    print("conv:99 rows:", len(store.range("conv:99", 0, 2**63 - 1)))
`,
      cpp: String.raw`#include <cstdint>
#include <iostream>
#include <limits>
#include <map>
#include <mutex>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

// partition key -> std::map (a sorted tree) of clustering key -> value.
class WideColumnStore {
    std::unordered_map<std::string, std::map<int64_t, std::string>> partitions_;
    std::mutex mu_;

public:
    using Row = std::pair<int64_t, std::string>;

    void put(const std::string& partitionKey, int64_t clusteringKey, std::string value) {
        std::lock_guard<std::mutex> lock(mu_);
        partitions_[partitionKey][clusteringKey] = std::move(value);  // upsert
    }

    // Rows with from <= clusteringKey < to, ascending.
    std::vector<Row> range(const std::string& partitionKey, int64_t from, int64_t to) {
        std::lock_guard<std::mutex> lock(mu_);
        std::vector<Row> out;
        auto p = partitions_.find(partitionKey);
        if (p == partitions_.end()) return out;
        auto& rows = p->second;
        for (auto it = rows.lower_bound(from); it != rows.end() && it->first < to; ++it)
            out.emplace_back(it->first, it->second);
        return out;
    }

    // Newest n rows, newest first.
    std::vector<Row> latest(const std::string& partitionKey, size_t n) {
        std::lock_guard<std::mutex> lock(mu_);
        std::vector<Row> out;
        auto p = partitions_.find(partitionKey);
        if (p == partitions_.end()) return out;
        for (auto it = p->second.rbegin(); it != p->second.rend() && out.size() < n; ++it)
            out.emplace_back(it->first, it->second);
        return out;
    }
};

int main() {
    WideColumnStore store;
    store.put("conv:42", 1000, "asha: hi!");
    store.put("conv:42", 1020, "ravi: see you at 8");
    store.put("conv:42", 1005, "ravi: hey asha");  // arrives out of order, stored sorted
    store.put("conv:42", 1010, "asha: dinner tonight?");
    store.put("conv:7", 1003, "meera: invoice sent");  // different partition

    std::cout << "range [1005, 1020) in conv:42\n";
    for (const auto& [ts, msg] : store.range("conv:42", 1005, 1020)) std::cout << "  " << ts << " " << msg << "\n";
    std::cout << "latest 2 in conv:42\n";
    for (const auto& [ts, msg] : store.latest("conv:42", 2)) std::cout << "  " << ts << " " << msg << "\n";
    std::cout << "conv:99 rows: "
              << store.range("conv:99", 0, std::numeric_limits<int64_t>::max()).size() << "\n";
}
`,
      javascript: String.raw`// partition key -> array of [clusteringKey, value] kept sorted by clusteringKey.
class WideColumnStore {
  constructor() {
    this.partitions = new Map();
  }

  // First index whose clustering key is >= key (binary search).
  static #lowerBound(rows, key) {
    let lo = 0, hi = rows.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (rows[mid][0] < key) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  put(partitionKey, clusteringKey, value) {
    if (!this.partitions.has(partitionKey)) this.partitions.set(partitionKey, []);
    const rows = this.partitions.get(partitionKey);
    const i = WideColumnStore.#lowerBound(rows, clusteringKey);
    if (i < rows.length && rows[i][0] === clusteringKey) rows[i][1] = value; // upsert
    else rows.splice(i, 0, [clusteringKey, value]);
  }

  // Rows with from <= clusteringKey < to, ascending.
  range(partitionKey, from, to) {
    const rows = this.partitions.get(partitionKey) ?? [];
    const i = WideColumnStore.#lowerBound(rows, from);
    const j = WideColumnStore.#lowerBound(rows, to);
    return rows.slice(i, j);
  }

  // Newest n rows, newest first.
  latest(partitionKey, n) {
    const rows = this.partitions.get(partitionKey) ?? [];
    return n > 0 ? rows.slice(-n).reverse() : [];
  }
}

const store = new WideColumnStore();
store.put("conv:42", 1000, "asha: hi!");
store.put("conv:42", 1020, "ravi: see you at 8");
store.put("conv:42", 1005, "ravi: hey asha"); // arrives out of order, stored sorted
store.put("conv:42", 1010, "asha: dinner tonight?");
store.put("conv:7", 1003, "meera: invoice sent"); // different partition

console.log("range [1005, 1020) in conv:42");
for (const [ts, msg] of store.range("conv:42", 1005, 1020)) console.log(\`  \${ts} \${msg}\`);
console.log("latest 2 in conv:42");
for (const [ts, msg] of store.latest("conv:42", 2)) console.log(\`  \${ts} \${msg}\`);
console.log("conv:99 rows:", store.range("conv:99", 0, Number.MAX_SAFE_INTEGER).length);
`,
      go: String.raw`package main

import (
	"fmt"
	"math"
	"sort"
	"sync"
)

type Row struct {
	Key   int64
	Value string
}

// WideColumnStore maps a partition key to rows kept sorted by clustering key.
type WideColumnStore struct {
	mu         sync.RWMutex
	partitions map[string][]Row
}

func NewWideColumnStore() *WideColumnStore {
	return &WideColumnStore{partitions: make(map[string][]Row)}
}

func lowerBound(rows []Row, key int64) int {
	return sort.Search(len(rows), func(i int) bool { return rows[i].Key >= key })
}

func (s *WideColumnStore) Put(partitionKey string, clusteringKey int64, value string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rows := s.partitions[partitionKey]
	i := lowerBound(rows, clusteringKey)
	if i < len(rows) && rows[i].Key == clusteringKey {
		rows[i].Value = value // upsert
		return
	}
	rows = append(rows, Row{})
	copy(rows[i+1:], rows[i:])
	rows[i] = Row{clusteringKey, value}
	s.partitions[partitionKey] = rows
}

// Range returns rows with from <= clusteringKey < to, ascending.
func (s *WideColumnStore) Range(partitionKey string, from, to int64) []Row {
	s.mu.RLock()
	defer s.mu.RUnlock()
	rows := s.partitions[partitionKey]
	i, j := lowerBound(rows, from), lowerBound(rows, to)
	return append([]Row(nil), rows[i:j]...)
}

// Latest returns the newest n rows, newest first.
func (s *WideColumnStore) Latest(partitionKey string, n int) []Row {
	s.mu.RLock()
	defer s.mu.RUnlock()
	rows := s.partitions[partitionKey]
	var out []Row
	for i := len(rows) - 1; i >= 0 && len(out) < n; i-- {
		out = append(out, rows[i])
	}
	return out
}

func main() {
	store := NewWideColumnStore()
	store.Put("conv:42", 1000, "asha: hi!")
	store.Put("conv:42", 1020, "ravi: see you at 8")
	store.Put("conv:42", 1005, "ravi: hey asha") // arrives out of order, stored sorted
	store.Put("conv:42", 1010, "asha: dinner tonight?")
	store.Put("conv:7", 1003, "meera: invoice sent") // different partition

	fmt.Println("range [1005, 1020) in conv:42")
	for _, r := range store.Range("conv:42", 1005, 1020) {
		fmt.Printf("  %d %s\n", r.Key, r.Value)
	}
	fmt.Println("latest 2 in conv:42")
	for _, r := range store.Latest("conv:42", 2) {
		fmt.Printf("  %d %s\n", r.Key, r.Value)
	}
	fmt.Println("conv:99 rows:", len(store.Range("conv:99", 0, math.MaxInt64)))
}
`,
    },
  },
  diagrams: {
    lsm: String.raw`flowchart LR
      W([Write]) --> CL["Commit log (append)"]
      W --> MT["Memtable (sorted, in memory)"]
      MT -->|ack| C([Client])
      MT -->|"flush when full"| S1["SSTable 1"]
      MT -.-> S2["SSTable 2"]
      S1 --> CP["Compaction merges"]
      S2 --> CP
      CP --> S3["Bigger SSTable"]`,
    fraud: String.raw`flowchart LR
      A1(("Account A")) -->|USED| D1["Device X"]
      A2(("Account B")) -->|USED| D1
      A2 -->|PAID_WITH| C1["Card 4421"]
      A3(("Account C")) -->|PAID_WITH| C1
      A3 -->|USED| D2["Device Y"]
      A4(("Account D")) -->|USED| D2`,
  },
});
