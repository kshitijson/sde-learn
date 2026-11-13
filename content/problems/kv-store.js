SD.register({
  id: "kv-store",
  html: String.raw`
<p class="lead">A key-value store does one thing: <code>put(key, value)</code> and <code>get(key)</code>. Amazon's 2007 Dynamo paper showed how to make that one thing survive data-centre failures at enormous scale, and Cassandra, Riak, ScyllaDB and (in spirit) DynamoDB all grew from it. In an interview this problem is a tour of distributed-systems ideas in one sitting: partitioning, replication, quorums, conflict resolution, failure detection and storage engines. The trick is to build it up step by step, from one machine to a cluster, and to name the trade-off you are making at every step.</p>

<h2>Problem statement</h2>
<p>Design a distributed key-value store like Amazon Dynamo or Apache Cassandra. Clients can <strong>put</strong> a value under a key, <strong>get</strong> it back, and <strong>delete</strong> it. Values are opaque blobs (the store does not look inside them), usually small: think shopping carts, user sessions, feature flags, or the "last seen" status in a chat app.</p>
<p>Assume a large internal platform, the kind Flipkart or Swiggy would run for many teams: <strong>5 billion keys</strong>, average value <strong>1 KB</strong>, <strong>100,000 writes/s</strong> and <strong>300,000 reads/s</strong> at peak, single-digit millisecond latency, and the store must keep accepting writes even when machines or a network link fail.</p>

<div class="callout tip"><strong>Try it first</strong>Spend 15 minutes before reading on. Sketch: (1) how one machine would store keys durably, (2) how you would spread 5 TB across many machines so that adding a machine moves little data, (3) how many copies of each key you keep and how many must answer a read or a write, and (4) what happens when two clients update the same key on two different replicas during a network split. Then compare with the walkthrough.</div>

<details class="hint"><summary>Hint 1: start with one box</summary>
<p>A hash map in RAM is fast but forgets everything on a crash. What can you append to disk before updating the map so that you can rebuild it? And how do you avoid replaying a year of log on every restart?</p>
</details>
<details class="hint"><summary>Hint 2: which node owns a key?</summary>
<p><code>hash(key) % numNodes</code> moves almost every key when you add one node. Look at <a href="#/p/consistent-hashing">consistent hashing</a>: what fraction of keys moves then, and how do virtual nodes fix uneven load?</p>
</details>
<details class="hint"><summary>Hint 3: tunable consistency</summary>
<p>Keep N copies. If a write waits for W of them and a read asks R of them, when is the read guaranteed to see the latest write? What do you gain by making R or W smaller?</p>
</details>
<details class="hint"><summary>Hint 4: two writers, no leader</summary>
<p>If any replica may accept a write, two replicas can accept different writes for the same key. A wall-clock timestamp picks a winner but silently loses data. What kind of version number can tell "this one replaced that one" apart from "these two happened independently"?</p>
</details>

<h2>Requirements</h2>
<div class="grid-2">
<div class="card">
<h3>Functional</h3>
<ul>
<li><strong>put(key, value)</strong>: store or overwrite a value. Keys up to ~256 B, values up to ~1 MB (most are ~1 KB).</li>
<li><strong>get(key)</strong>: return the value, or "not found".</li>
<li><strong>delete(key)</strong>.</li>
<li><strong>Tunable consistency per request</strong>: the caller can ask for "fast" (one replica) or "safe" (a quorum).</li>
<li>Optional: TTL per key (sessions expire), conditional put (compare-and-set).</li>
<li>Out of scope: secondary indexes, range scans across keys, multi-key transactions.</li>
</ul>
</div>
<div class="card">
<h3>Non-functional</h3>
<ul>
<li><strong>Highly available for writes</strong>: "add to cart" must never fail because one node is down. Target 99.99%.</li>
<li><strong>Scalable</strong>: add nodes to grow storage and throughput linearly, with no downtime.</li>
<li><strong>Low latency</strong>: p99 under ~10 ms for both reads and writes.</li>
<li><strong>Durable</strong>: an acknowledged write survives a node crash.</li>
<li><strong>Tunable consistency</strong>: eventual by default, stronger when asked.</li>
<li><strong>Decentralised</strong>: no single master whose failure stops the cluster.</li>
</ul>
</div>
</div>

<div class="callout interview"><strong>Say this in the interview</strong>"Let me pin the shape first. Simple get, put and delete on opaque values around 1 KB, no range queries and no cross-key transactions. The key quality is availability: writes should succeed even during failures, and I am willing to accept eventual consistency by default with a stronger option per request. That pushes me towards a leaderless, Dynamo-style design rather than a single-leader database. Is that the right priority?"</div>

<h2>Capacity estimation</h2>
<table>
<thead><tr><th>Quantity</th><th>Arithmetic</th><th>Result</th></tr></thead>
<tbody>
<tr><td>Raw data</td><td>5B keys × (1 KB value + ~50 B key + ~50 B metadata)</td><td><strong>~5.5 TB</strong></td></tr>
<tr><td>With replication (N = 3)</td><td>5.5 TB × 3</td><td><strong>~16.5 TB</strong></td></tr>
<tr><td>With compaction headroom</td><td>LSM stores need free space to merge files; keep disks ≤ 50% full</td><td><strong>~33 TB of SSD</strong></td></tr>
<tr><td>Nodes for storage</td><td>33 TB / 2 TB SSD per node</td><td><strong>~17 nodes</strong></td></tr>
<tr><td>Replica writes/s</td><td>100K writes × N = 3 (every replica stores every write)</td><td><strong>300K/s</strong></td></tr>
<tr><td>Replica reads/s</td><td>300K reads × R = 2 (quorum reads)</td><td><strong>600K/s</strong></td></tr>
<tr><td>Nodes for throughput</td><td>~900K replica ops/s ÷ ~20K ops/s per node</td><td><strong>~45 nodes</strong></td></tr>
<tr><td>Bloom filters per node</td><td>(16.5B replica keys ÷ 45 nodes) ≈ 370M keys × 10 bits</td><td>~460 MB of RAM (1% false positives)</td></tr>
<tr><td>Replication bandwidth</td><td>100K writes × 1.1 KB × 3</td><td>~330 MB/s cluster-wide</td></tr>
</tbody>
</table>
<p>The interesting result: <mark>throughput, not storage, sets the node count</mark>. Plan for about 50 nodes, which also leaves room to lose a few without overloading the rest.</p>

<h2>API design</h2>
<p>The client talks to any node (or uses a "smart" client library that knows the ring and goes straight to a replica). Every read returns an opaque <strong>context</strong> (the version, explained in Deep dive 2) that the client sends back with its next write.</p>
<pre><code>GET /v1/kv/{key}?consistency=QUORUM        (ONE | QUORUM | ALL)
200 OK
{ "values":  ["eyJpdGVtcyI6...", "eyJpdGVtcyI6..."],   // more than one = conflict (siblings)
  "context": "A:3,B:1" }
404 Not Found

PUT /v1/kv/{key}?consistency=QUORUM
{ "value": "eyJpdGVtcyI6...", "context": "A:3,B:1", "ttlSeconds": 86400 }
204 No Content
503 Service Unavailable    fewer than W replicas reachable

DELETE /v1/kv/{key}?consistency=QUORUM
{ "context": "A:3,B:1" }</code></pre>
<ul>
<li><code>consistency</code> maps to R or W: ONE = 1, QUORUM = ⌊N/2⌋ + 1, ALL = N.</li>
<li>A get can return <strong>several values</strong>. That is not a bug: it is how a leaderless store hands a real conflict to the application.</li>
</ul>

<h2>Data model</h2>
<p>From the outside it is just <code>key → value</code>. Inside, each stored record carries enough metadata to replicate, version and expire it:</p>
<pre><code>record
  key          bytes          -- partition key; hash(key) picks the position on the ring
  value        bytes          -- opaque to the store
  version      vector clock   -- e.g. {A:3, B:1}; or a timestamp if using last-write-wins
  tombstone    bool           -- delete = write a marker, not erase (see below)
  expires_at   timestamp?     -- optional TTL

hint (stored on a stand-in node while the real owner is down)
  target_node, key, value, version, created_at</code></pre>
<ul>
<li><strong>Deletes are tombstones.</strong> If replica C missed a delete and we simply erased the key on A and B, anti-entropy would later "repair" A and B from C and the key would come back from the dead. A tombstone is a normal write that says "deleted at version X". It is purged after a grace period (Cassandra's default <code>gc_grace_seconds</code> is 10 days) that must be longer than the longest outage you will repair.</li>
</ul>

<h2>High-level design</h2>
<h3>Step 1: a single node</h3>
<p>Before distributing anything, make one machine correct. Keep a hash map in RAM for speed, and make it durable with a <strong>write-ahead log (WAL)</strong>:</p>
<ol class="steps">
<li><strong>put</strong>: append <code>(key, value)</code> to the WAL file and <code>fsync</code>, then update the hash map, then reply. The append is sequential I/O, so it is fast even on spinning disks.</li>
<li><strong>Crash</strong>: on restart, replay the WAL from the start to rebuild the map.</li>
<li><strong>Snapshots</strong>: replaying a 500 GB log takes forever, so every few minutes write the whole map to a snapshot file, then truncate the WAL. Recovery = load the latest snapshot + replay the short WAL tail. Redis does exactly this with RDB snapshots and the AOF log.</li>
</ol>
<div data-diagram="single" data-caption="One node: append to the log first, then update memory; periodic snapshots keep recovery short"></div>
<p>The catch: the whole dataset must fit in RAM. For 5.5 TB we need either many machines or a storage engine that keeps most data on disk. We will need both, so the design has two halves: the <strong>cluster</strong> (which nodes hold which keys) and the <strong>storage engine</strong> on each node (Deep dive 4).</p>

<h3>Step 2: the cluster</h3>
<div data-diagram="arch" data-caption="A leaderless ring: any node can coordinate a request; replicas sync in the background"></div>
<ol class="steps">
<li><strong>Partitioning</strong>: nodes sit on a <a href="#/p/consistent-hashing">consistent-hashing</a> ring. A key is owned by the first node clockwise from <code>hash(key)</code>.</li>
<li><strong>Replication</strong>: the key is also copied to the next N - 1 distinct nodes clockwise. These N nodes are the key's <strong>preference list</strong>.</li>
<li><strong>Coordinator</strong>: whichever node receives the request (or the first healthy node in the preference list) acts as coordinator. It forwards the request to all N replicas and waits for W acks (writes) or R answers (reads).</li>
<li><strong>Versioning</strong>: every write carries a vector clock so replicas can tell newer data from conflicting data.</li>
<li><strong>Gossip</strong>: nodes tell each other who is alive and who owns which tokens. No central coordinator, no ZooKeeper on the request path.</li>
<li><strong>Repair</strong>: hinted handoff for short outages, read repair on every read, and Merkle-tree anti-entropy in the background for everything else.</li>
</ol>
<div data-diagram="write" data-caption="A quorum write with N = 3, W = 2: the coordinator replies after the second ack; the third replica catches up"></div>

<div class="callout interview"><strong>Say this in the interview</strong>"I will build it in layers. First one node with a write-ahead log and snapshots. Then I partition with consistent hashing and virtual nodes, replicate each key to N = 3 nodes on the ring, and use quorums R and W so each request can trade latency for consistency. Because there is no leader, I need versioning to detect conflicts, plus hinted handoff and Merkle trees to repair replicas. Membership is gossip-based so there is no single point of failure."</div>

<h2>Deep dive 1: partitioning and replication</h2>
<p>Hash the key (Cassandra uses Murmur3, a fast non-cryptographic hash) onto a ring of 2<sup>64</sup> positions. Each node owns the arc that ends at its token. Adding a node only takes keys from its clockwise neighbour, so roughly 1/n of the data moves instead of almost all of it with <code>hash % n</code>. The <a href="#/p/consistent-hashing">consistent hashing</a> page has the full story; here is what matters for the store:</p>
<ul>
<li><strong>Virtual nodes (vnodes)</strong>: each physical node takes many tokens (Cassandra 4.0 defaults to 16, older versions used 256). This evens out load, and when a node dies its data is re-replicated from many peers at once instead of from one overloaded neighbour.</li>
<li><strong>Preference list</strong>: walk clockwise and take the first N <em>distinct physical</em> nodes (skip vnodes that belong to a machine already chosen). Make it rack- or zone-aware so the three copies live in three availability zones; then losing a whole AWS zone in Mumbai still leaves two copies.</li>
</ul>
<p>Try adding and removing nodes below and watch how few keys move.</p>
<div data-widget="hash-ring"></div>
<p>Why leaderless replication instead of single-leader? With a leader per partition, a write must go to that one leader; when it dies, writes to its keys stop until failover finishes. In a leaderless design any of the N replicas can take a write, which is exactly the "always writable" property the requirements asked for. The price is conflicts, handled in Deep dive 2. See <a href="#/p/replication">Replication</a> for single-leader, multi-leader and leaderless side by side.</p>

<h2>Deep dive 2: consistency, quorums and conflicts</h2>
<h3>Tunable consistency with R and W</h3>
<p>With N replicas, a write waits for W acks and a read waits for R replies. If <strong>R + W &gt; N</strong>, every read set overlaps every write set in at least one replica, so a read sees the latest acknowledged write (as long as the replicas involved are the "real" ones, see sloppy quorum below).</p>
<table>
<thead><tr><th>Setting (N = 3)</th><th>Behaviour</th><th>Good for</th></tr></thead>
<tbody>
<tr><td>W = 2, R = 2</td><td>Overlap guaranteed; survives one replica down for both reads and writes</td><td>The sensible default</td></tr>
<tr><td>W = 1, R = 1</td><td>Fastest, most available; reads may be stale</td><td>"Last seen" status, view counters, metrics</td></tr>
<tr><td>W = 3, R = 1</td><td>Fast reads, but any one dead replica blocks writes</td><td>Read-heavy config data</td></tr>
</tbody>
</table>
<p>Latency follows from the quorum: the coordinator waits for the W-th fastest replica, not the slowest. With W = 2 of 3, one slow disk does not hurt the p99. Play with N, R and W and see when stale reads appear:</p>
<div data-widget="quorum"></div>
<div class="callout warn"><strong>Quorum is not the same as linearizable</strong>R + W &gt; N gives "read your latest acknowledged write" in the happy case, but edge cases remain: a write that failed on the quorum may still have landed on one replica and later spread; sloppy quorums break the overlap; and last-write-wins can drop a write. If you need compare-and-set or strict ordering, add a consensus protocol (Paxos or Raft) per key range, which is what DynamoDB and Cassandra's lightweight transactions do.</div>

<h3>Read repair</h3>
<p>When a quorum read gets different versions from different replicas, the coordinator returns the newest to the client and writes it back to the stale replicas in the background. Hot keys therefore fix themselves; cold keys need anti-entropy (Deep dive 3).</p>

<h3>Versioning: last-write-wins vs vector clocks</h3>
<p>Two clients add items to the same Swiggy cart through two different replicas during a network split. Which version wins?</p>
<div class="tabs">
<section data-tab="Last-write-wins (LWW)">
<p>Attach a timestamp to every write; the highest timestamp wins. Cassandra does this per column.</p>
<ul>
<li><strong>Good</strong>: simple, constant-size metadata, no conflicts ever reach the client.</li>
<li><strong>Bad</strong>: concurrent writes are <strong>silently lost</strong>. One of the two cart updates disappears.</li>
<li><strong>Bad</strong>: depends on clocks. If node A's clock is 2 seconds fast, its writes beat newer writes from B for 2 seconds.</li>
<li>Fine when values are overwritten wholesale (a session blob) or losing a racing write is acceptable.</li>
</ul>
</section>
<section data-tab="Vector clocks">
<p>Each version carries a map <code>{node → counter}</code>. The node that coordinates a write increments its own counter. Comparing two clocks gives one of four answers:</p>
<ul>
<li><strong>BEFORE / AFTER</strong>: every counter in one is ≤ the other's. The newer one simply replaces the older.</li>
<li><strong>EQUAL</strong>: same version.</li>
<li><strong>CONCURRENT</strong>: each has a counter the other lacks. Neither saw the other: a <strong>real conflict</strong>. The store keeps both as <em>siblings</em> and returns both on the next read; the application merges them (for a cart: union of items) and writes back with the merged clock.</li>
<li>Cost: clocks grow with the number of coordinators. Dynamo capped the list at about 10 entries and dropped the oldest, accepting rare false conflicts. Riak later moved to <em>dotted version vectors</em> to avoid sibling explosion.</li>
</ul>
</section>
</div>
<div data-diagram="conflict" data-caption="A partition lets A and B accept independent writes; the vector clocks show they are concurrent, so the reader merges them"></div>
<p>The code below implements a vector clock with increment, merge and compare, and replays exactly that cart story. Note how <code>merge</code> (pointwise max) followed by <code>increment</code> produces a version that dominates both siblings, so the conflict disappears on the next write.</p>
<div data-code="vclock"></div>
<div class="callout interview"><strong>Say this in the interview</strong>"I will version every write with a vector clock. If one clock dominates, the newer value replaces the older one. If they are concurrent, I keep both siblings and return them on read, and the client merges them; for a shopping cart that is a union, which is what Amazon did. If the product team prefers simplicity and can tolerate losing a racing write, last-write-wins with timestamps is the simpler choice, which is what Cassandra does."</div>

<h2>Deep dive 3: handling failures</h2>
<h3>Membership and failure detection: gossip</h3>
<p>There is no master to say who is alive. Instead, every second each node picks a random peer and exchanges its view of the cluster: each node's heartbeat counter, its tokens and its status. News spreads like a rumour, reaching all n nodes in about log<sub>2</sub>(n) rounds, so 50 nodes converge in a handful of seconds. If a node's heartbeat has not increased for a while, peers mark it <em>suspected down</em>. Cassandra uses a <em>phi accrual</em> failure detector, which outputs a suspicion level based on how late the heartbeat is compared with normal, instead of a fixed timeout.</p>
<ul>
<li>Marking a node down is local and temporary. Permanently removing a node (and moving its data) is an explicit admin action, because a 30-second network blip should not trigger terabytes of data movement.</li>
</ul>
<div data-diagram="gossip" data-caption="Gossip: each round, nodes swap heartbeat tables and keep the highest counter they have seen"></div>

<h3>Temporary failures: sloppy quorum and hinted handoff</h3>
<p>Suppose N = 3, W = 2, and two of the three replicas for a cart key are unreachable. A <strong>strict quorum</strong> rejects the write. A <strong>sloppy quorum</strong> instead writes to the next healthy nodes on the ring, outside the preference list, and counts their acks. Each stand-in stores the data with a <strong>hint</strong>: "this belongs to node C". When gossip reports C is back, the stand-in hands the data over and deletes its copy.</p>
<div data-diagram="hinted" data-caption="Sloppy quorum: D stands in for the down replica C and replays the hint when C returns"></div>
<ul>
<li>Gain: writes stay available during failures ("add to cart" never fails).</li>
<li>Cost: R + W &gt; N no longer guarantees overlap, because the W acks may have come from stand-ins that a later read does not ask. Sloppy quorum is an availability feature, not a consistency one.</li>
<li>Hints are kept only for a window (Cassandra's default is 3 hours). Longer outages are repaired by anti-entropy.</li>
</ul>

<h3>Permanent failures: anti-entropy with Merkle trees</h3>
<p>A replica that was down for a day, or lost a disk, has missing or stale keys. Comparing every key with its peer would mean shipping terabytes. Instead each node builds a <strong>Merkle tree</strong> per key range: leaves are hashes of small buckets of keys, and each parent is the hash of its children. Two replicas compare root hashes; if equal, the whole range is in sync. If not, they descend only into the children whose hashes differ, and finally exchange just the keys in the mismatched buckets.</p>
<div data-diagram="merkle" data-caption="Merkle tree comparison: only the branch with a different hash is walked and synced"></div>
<p>With a million buckets, finding one bad bucket costs about 20 hash comparisons (log<sub>2</sub> of a million) instead of comparing a million buckets. The catch: trees must be rebuilt when vnode ownership changes, and building them reads the whole range, so repairs run in the background at low priority (Cassandra's <code>nodetool repair</code>, typically scheduled weekly, within the tombstone grace period).</p>

<h2>Deep dive 4: the storage engine (write and read path)</h2>
<p>Each node must absorb thousands of writes per second and hold far more data than RAM. A B-tree updates pages in place (random I/O); write-heavy stores like Cassandra, ScyllaDB, RocksDB and HBase use an <strong>LSM tree</strong> (log-structured merge tree) instead, which turns every write into sequential I/O.</p>
<div data-diagram="lsm" data-caption="Write path on the left, read path on the right"></div>
<div class="grid-2">
<div class="card">
<h3>Write path</h3>
<ol>
<li>Append to the <strong>commit log</strong> (the WAL from Step 1) for durability.</li>
<li>Insert into the <strong>memtable</strong>, a sorted in-memory structure (skip list or red-black tree).</li>
<li>Ack the coordinator. That is it: no disk seeks.</li>
<li>When the memtable reaches a size limit (say 128 MB), flush it to disk as an immutable, sorted <strong>SSTable</strong> (sorted string table) and drop the matching commit-log segment.</li>
<li><strong>Compaction</strong> merges SSTables in the background, keeps the newest version of each key, and drops expired tombstones.</li>
</ol>
</div>
<div class="card">
<h3>Read path</h3>
<ol>
<li>Check the <strong>memtable</strong>: the newest data lives there.</li>
<li>For each SSTable, newest first, ask its <strong>Bloom filter</strong>: "might this file contain the key?" A "no" is certain, so most files are skipped without touching disk.</li>
<li>For files that say "maybe", use the sparse <strong>index</strong> to find the block, read it (often from the OS page cache or a row cache), and look up the key.</li>
<li>Merge the versions found and return the newest (or siblings).</li>
</ol>
</div>
</div>
<ul>
<li><strong>Commit log durability</strong>: fsync on every write is safest but slow. Cassandra's default is periodic fsync (every 10 s), relying on replication: losing the last few seconds on one node is fine because two other replicas have the write. Say this trade-off explicitly.</li>
<li><strong>Compaction strategy</strong>: size-tiered compaction is cheap for writes but a key may live in many files (read amplification); leveled compaction keeps reads to about one file per level at the cost of more rewriting (write amplification). That is why we kept 50% disk headroom in the estimate.</li>
<li>See <a href="#/p/indexing">Indexing</a> for B-tree vs LSM in more depth.</li>
</ul>

<h2>Scaling and bottlenecks</h2>
<table>
<thead><tr><th>Bottleneck</th><th>Fix</th></tr></thead>
<tbody>
<tr><td>Hot key (one celebrity's profile, a flash-sale product on Big Billion Days)</td><td>All N replicas of one key absorb its traffic; adding nodes does not help. Cache it in the application tier (see <a href="#/p/caching">Caching</a>), read with R = 1 from any replica, or split the key (<code>key#0..key#9</code>) and merge on read.</td></tr>
<tr><td>Adding capacity</td><td>New node picks tokens, streams data for those ranges from current owners, then gossips that it is live. Vnodes spread the streaming across many peers. Throttle streaming so it does not hurt live traffic.</td></tr>
<tr><td>Large values (10 MB blobs)</td><td>They bloat memtables and compaction. Store the blob in <a href="#/p/object-storage">object storage</a> and keep only a pointer in the KV store.</td></tr>
<tr><td>Tombstone build-up (queues modelled as keys, heavy deletes)</td><td>Reads must skip thousands of tombstones. Model data so deletes are rare, use TTLs, and compact regularly.</td></tr>
<tr><td>Multi-region (Mumbai + Singapore)</td><td>Replicate across data centres asynchronously; use LOCAL_QUORUM (quorum inside the local region) so a request never waits on a cross-region round trip of ~60 ms.</td></tr>
</tbody>
</table>

<h2>Trade-offs</h2>
<h3>Where this design sits in CAP</h3>
<p>The CAP theorem says that during a network <strong>P</strong>artition you must choose between <strong>C</strong>onsistency (every read sees the latest write, or fails) and <strong>A</strong>vailability (every request gets an answer). Partitions are not optional in a real network, so the real question is what happens when one occurs.</p>
<ul>
<li>With sloppy quorums and W = 1 or 2, this design is <strong>AP</strong>: both sides of a split keep accepting writes, and vector clocks sort it out later.</li>
<li>With strict quorums and R = W = QUORUM, the minority side of a split refuses requests: closer to <strong>CP</strong> for that request. Tunable consistency means the choice is made <em>per request</em>, not per system.</li>
<li>PACELC adds the everyday case: Else (no partition), you trade <strong>L</strong>atency against <strong>C</strong>onsistency. R = W = 1 is fast; R = W = 2 waits for one more replica.</li>
</ul>
<div class="grid-2">
<div class="card good"><strong>What we gained</strong>
<ul>
<li>Always writable: no leader to fail over, sloppy quorum during outages.</li>
<li>Linear scale-out with consistent hashing and vnodes.</li>
<li>Per-request choice of speed vs consistency.</li>
<li>Write-optimised storage: sequential I/O only.</li>
</ul>
</div>
<div class="card bad"><strong>What we gave up</strong>
<ul>
<li>Conflicts reach the application (vector clocks) or writes get lost (LWW).</li>
<li>No multi-key transactions, no range scans, no secondary indexes.</li>
<li>Operational complexity: repairs, tombstones, compaction tuning.</li>
<li>Reads are costlier than writes (memtable + many SSTables + quorum).</li>
</ul>
</div>
</div>
<table>
<thead><tr><th>System</th><th>Replication</th><th>Conflict handling</th></tr></thead>
<tbody>
<tr><td>Dynamo (2007 paper)</td><td>Leaderless, sloppy quorum</td><td>Vector clocks, client merges siblings</td></tr>
<tr><td>Cassandra / ScyllaDB</td><td>Leaderless, tunable consistency</td><td>Last-write-wins per cell (timestamps)</td></tr>
<tr><td>Riak</td><td>Leaderless</td><td>Dotted version vectors, CRDTs</td></tr>
<tr><td>DynamoDB (the AWS service)</td><td>Leader per partition with Paxos-replicated logs</td><td>LWW for normal writes; conditional writes and transactions for safety</td></tr>
</tbody>
</table>

<h2>Follow-up questions</h2>
<div class="quiz">
<details><summary>N = 3, W = 2, R = 2. One replica is down. Do reads and writes still work? What about two replicas down?</summary><div>With one down, two replicas remain, so both W = 2 and R = 2 can be met. With two down only one replica answers: strict quorum requests fail with 503. A sloppy quorum would still accept writes on stand-in nodes with hints, but reads at R = 2 may miss them.</div></details>
<details><summary>Why is a delete written as a tombstone instead of removing the key?</summary><div>If a replica missed the delete and the others simply forgot the key, read repair or anti-entropy would see the old value on the stale replica and copy it back: the key is resurrected. A tombstone is a versioned write that wins over the old value. It is purged only after a grace period longer than any repair cycle.</div></details>
<details><summary>Two vector clocks {A:2, B:1} and {A:1, B:2}. What is the relationship, and what does the merged clock look like after A writes the resolved value?</summary><div>Concurrent: each has a counter higher than the other's. Merge is pointwise max {A:2, B:2}; A then increments its own entry, giving {A:3, B:2}, which is AFTER both siblings.</div></details>
<details><summary>How does a Bloom filter speed up reads, and what happens on a false positive?</summary><div>Each SSTable has a Bloom filter of its keys. If it says "not present", the file is skipped with zero disk reads. A false positive (about 1% at 10 bits per key) only costs one wasted index lookup and block read; there are no false negatives, so correctness is never affected.</div></details>
<details><summary>How would you add strong consistency for a single key, for example a wallet balance in PhonePe?</summary><div>Quorums are not enough for compare-and-set. Run a consensus protocol (Paxos or Raft) among the key's replicas, as Cassandra's lightweight transactions do with Paxos, or use a store with a leader per partition. Expect several round trips per write, so use it only where needed. For money, many teams pick a relational database instead; see <a href="#/p/transactions">Transactions</a>.</div></details>
<details><summary>How do you detect that a node is down without a central coordinator?</summary><div>Gossip: nodes exchange heartbeat counters with random peers every second. If a node's counter stops increasing for long enough (phi accrual detector), peers mark it suspected down locally, route around it, and store hints for it. Only an operator action removes it permanently.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2>
<ul>
<li>Build it in layers: one node (WAL + memory + snapshots), then partition, then replicate, then handle conflicts and failures.</li>
<li>Consistent hashing with vnodes for partitioning; N replicas on the next distinct nodes clockwise, spread across zones.</li>
<li>R + W &gt; N gives overlapping quorums; tune R and W per request to trade latency and availability for consistency.</li>
<li>Leaderless writes need versioning: vector clocks detect concurrent writes (siblings), LWW is simpler but loses data.</li>
<li>Failures: gossip for membership, sloppy quorum + hinted handoff for short outages, Merkle-tree anti-entropy for long ones, tombstones for deletes.</li>
<li>Storage: commit log → memtable → SSTable on write; memtable → Bloom filters → SSTables on read; compaction in the background.</li>
<li>CAP: this design is AP by default and can act CP per request with strict quorums.</li>
</ul>
</div>
`,
  code: {
    vclock: {
      title: "Vector clock: increment, merge, compare, and a two-replica conflict",
      java: String.raw`import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

enum Order { BEFORE, AFTER, EQUAL, CONCURRENT }

/** A vector clock: one counter per replica that has coordinated a write. */
final class VectorClock {
    private final TreeMap<String, Long> counters = new TreeMap<>(); // sorted for stable printing

    VectorClock copy() {
        VectorClock c = new VectorClock();
        c.counters.putAll(counters);
        return c;
    }

    /** The replica that coordinates a write bumps its own counter. */
    VectorClock increment(String node) {
        counters.merge(node, 1L, Long::sum);
        return this;
    }

    /** Pointwise max: the clock of a version that has seen both histories. */
    VectorClock merge(VectorClock other) {
        for (Map.Entry<String, Long> e : other.counters.entrySet())
            counters.merge(e.getKey(), e.getValue(), Math::max);
        return this;
    }

    /** BEFORE = this is an ancestor of other; CONCURRENT = neither saw the other. */
    Order compare(VectorClock other) {
        Set<String> nodes = new TreeSet<>(counters.keySet());
        nodes.addAll(other.counters.keySet());
        boolean less = false;
        boolean greater = false;
        for (String n : nodes) {
            long a = counters.getOrDefault(n, 0L);
            long b = other.counters.getOrDefault(n, 0L);
            if (a < b) less = true;
            else if (a > b) greater = true;
        }
        if (less && greater) return Order.CONCURRENT;
        if (less) return Order.BEFORE;
        if (greater) return Order.AFTER;
        return Order.EQUAL;
    }

    @Override public String toString() {
        StringBuilder sb = new StringBuilder("{");
        for (Map.Entry<String, Long> e : counters.entrySet()) {
            if (sb.length() > 1) sb.append(", ");
            sb.append(e.getKey()).append(':').append(e.getValue());
        }
        return sb.append('}').toString();
    }
}

public class Main {
    public static void main(String[] args) {
        // 1. Client adds "milk" to the cart; replica A coordinates the write.
        VectorClock v1 = new VectorClock().increment("A");
        Set<String> cart1 = new TreeSet<>(Set.of("milk"));
        System.out.println("v1 written via A : " + v1 + " " + cart1);

        // 2. v1 replicates to B. Then the network partitions A from B.
        VectorClock atB = v1.copy();
        System.out.println("B has v1         : " + atB);

        // 3. One client adds eggs via A, another adds bread via B.
        VectorClock v2 = v1.copy().increment("A");
        Set<String> cart2 = new TreeSet<>(Set.of("milk", "eggs"));
        VectorClock v3 = atB.copy().increment("B");
        Set<String> cart3 = new TreeSet<>(Set.of("milk", "bread"));
        System.out.println("v2 written via A : " + v2 + " " + cart2);
        System.out.println("v3 written via B : " + v3 + " " + cart3);

        System.out.println("v1 vs v2 = " + v1.compare(v2)); // BEFORE: v2 can replace v1
        System.out.println("v2 vs v1 = " + v2.compare(v1)); // AFTER
        Order o = v2.compare(v3);
        System.out.println("v2 vs v3 = " + o);              // CONCURRENT: a real conflict
        if (o == Order.CONCURRENT) {
            System.out.println("conflict: keep both siblings, let the reader merge");
        }

        // 4. A reader gets both siblings, merges the carts (union) and writes back via A.
        Set<String> merged = new TreeSet<>(cart2);
        merged.addAll(cart3);
        VectorClock v4 = v2.copy().merge(v3).increment("A");
        System.out.println("v4 merged via A  : " + v4 + " " + merged);
        System.out.println("v4 vs v2 = " + v4.compare(v2) + ", v4 vs v3 = " + v4.compare(v3));
        System.out.println("v4 vs copy = " + v4.compare(v4.copy()));
    }
}`,
      python: String.raw`from enum import Enum


class Order(Enum):
    BEFORE = "BEFORE"
    AFTER = "AFTER"
    EQUAL = "EQUAL"
    CONCURRENT = "CONCURRENT"


class VectorClock:
    """One counter per replica that has coordinated a write."""

    def __init__(self, counters=None):
        self.counters = dict(counters or {})

    def copy(self):
        return VectorClock(self.counters)

    def increment(self, node):
        """The replica that coordinates a write bumps its own counter."""
        self.counters[node] = self.counters.get(node, 0) + 1
        return self

    def merge(self, other):
        """Pointwise max: the clock of a version that has seen both histories."""
        for node, value in other.counters.items():
            self.counters[node] = max(self.counters.get(node, 0), value)
        return self

    def compare(self, other):
        """BEFORE = self is an ancestor of other; CONCURRENT = neither saw the other."""
        less = greater = False
        for node in self.counters.keys() | other.counters.keys():
            a, b = self.counters.get(node, 0), other.counters.get(node, 0)
            if a < b:
                less = True
            elif a > b:
                greater = True
        if less and greater:
            return Order.CONCURRENT
        if less:
            return Order.BEFORE
        if greater:
            return Order.AFTER
        return Order.EQUAL

    def __str__(self):
        return "{" + ", ".join(f"{n}:{v}" for n, v in sorted(self.counters.items())) + "}"


def show(items):
    return "[" + ", ".join(sorted(items)) + "]"


if __name__ == "__main__":
    # 1. Client adds "milk" to the cart; replica A coordinates the write.
    v1 = VectorClock().increment("A")
    cart1 = {"milk"}
    print("v1 written via A :", v1, show(cart1))

    # 2. v1 replicates to B. Then the network partitions A from B.
    at_b = v1.copy()
    print("B has v1         :", at_b)

    # 3. One client adds eggs via A, another adds bread via B.
    v2, cart2 = v1.copy().increment("A"), {"milk", "eggs"}
    v3, cart3 = at_b.copy().increment("B"), {"milk", "bread"}
    print("v2 written via A :", v2, show(cart2))
    print("v3 written via B :", v3, show(cart3))

    print("v1 vs v2 =", v1.compare(v2).value)  # BEFORE: v2 can replace v1
    print("v2 vs v1 =", v2.compare(v1).value)  # AFTER
    o = v2.compare(v3)
    print("v2 vs v3 =", o.value)               # CONCURRENT: a real conflict
    if o is Order.CONCURRENT:
        print("conflict: keep both siblings, let the reader merge")

    # 4. A reader gets both siblings, merges the carts (union) and writes back via A.
    merged = cart2 | cart3
    v4 = v2.copy().merge(v3).increment("A")
    print("v4 merged via A  :", v4, show(merged))
    print(f"v4 vs v2 = {v4.compare(v2).value}, v4 vs v3 = {v4.compare(v3).value}")
    print("v4 vs copy =", v4.compare(v4.copy()).value)`,
      cpp: String.raw`#include <algorithm>
#include <iostream>
#include <map>
#include <set>
#include <string>

enum class Order { BEFORE, AFTER, EQUAL, CONCURRENT };

const char* name(Order o) {
    switch (o) {
        case Order::BEFORE: return "BEFORE";
        case Order::AFTER: return "AFTER";
        case Order::EQUAL: return "EQUAL";
        default: return "CONCURRENT";
    }
}

// One counter per replica that has coordinated a write. std::map keeps keys sorted.
class VectorClock {
    std::map<std::string, long> counters_;

public:
    // The replica that coordinates a write bumps its own counter.
    VectorClock& increment(const std::string& node) {
        counters_[node] += 1;
        return *this;
    }

    // Pointwise max: the clock of a version that has seen both histories.
    VectorClock& merge(const VectorClock& other) {
        for (const auto& [node, v] : other.counters_)
            counters_[node] = std::max(counters_[node], v);
        return *this;
    }

    // BEFORE = this is an ancestor of other; CONCURRENT = neither saw the other.
    Order compare(const VectorClock& other) const {
        std::set<std::string> nodes;
        for (const auto& kv : counters_) nodes.insert(kv.first);
        for (const auto& kv : other.counters_) nodes.insert(kv.first);
        bool less = false, greater = false;
        for (const auto& n : nodes) {
            long a = get(n), b = other.get(n);
            if (a < b) less = true;
            else if (a > b) greater = true;
        }
        if (less && greater) return Order::CONCURRENT;
        if (less) return Order::BEFORE;
        if (greater) return Order::AFTER;
        return Order::EQUAL;
    }

    long get(const std::string& node) const {
        auto it = counters_.find(node);
        return it == counters_.end() ? 0 : it->second;
    }

    std::string str() const {
        std::string s = "{";
        for (const auto& [node, v] : counters_) {
            if (s.size() > 1) s += ", ";
            s += node + ":" + std::to_string(v);
        }
        return s + "}";
    }
};

std::string show(const std::set<std::string>& items) {
    std::string s = "[";
    for (const auto& i : items) {
        if (s.size() > 1) s += ", ";
        s += i;
    }
    return s + "]";
}

int main() {
    // 1. Client adds "milk" to the cart; replica A coordinates the write.
    VectorClock v1;
    v1.increment("A");
    std::set<std::string> cart1{"milk"};
    std::cout << "v1 written via A : " << v1.str() << " " << show(cart1) << "\n";

    // 2. v1 replicates to B. Then the network partitions A from B.
    VectorClock atB = v1;  // copy
    std::cout << "B has v1         : " << atB.str() << "\n";

    // 3. One client adds eggs via A, another adds bread via B.
    VectorClock v2 = v1;
    v2.increment("A");
    std::set<std::string> cart2{"milk", "eggs"};
    VectorClock v3 = atB;
    v3.increment("B");
    std::set<std::string> cart3{"milk", "bread"};
    std::cout << "v2 written via A : " << v2.str() << " " << show(cart2) << "\n";
    std::cout << "v3 written via B : " << v3.str() << " " << show(cart3) << "\n";

    std::cout << "v1 vs v2 = " << name(v1.compare(v2)) << "\n";  // BEFORE
    std::cout << "v2 vs v1 = " << name(v2.compare(v1)) << "\n";  // AFTER
    Order o = v2.compare(v3);
    std::cout << "v2 vs v3 = " << name(o) << "\n";               // CONCURRENT
    if (o == Order::CONCURRENT)
        std::cout << "conflict: keep both siblings, let the reader merge\n";

    // 4. A reader gets both siblings, merges the carts (union) and writes back via A.
    std::set<std::string> merged = cart2;
    merged.insert(cart3.begin(), cart3.end());
    VectorClock v4 = v2;
    v4.merge(v3).increment("A");
    std::cout << "v4 merged via A  : " << v4.str() << " " << show(merged) << "\n";
    std::cout << "v4 vs v2 = " << name(v4.compare(v2)) << ", v4 vs v3 = " << name(v4.compare(v3)) << "\n";
    VectorClock copy = v4;
    std::cout << "v4 vs copy = " << name(v4.compare(copy)) << "\n";
}`,
      javascript: String.raw`const Order = Object.freeze({
  BEFORE: "BEFORE", AFTER: "AFTER", EQUAL: "EQUAL", CONCURRENT: "CONCURRENT",
});

// One counter per replica that has coordinated a write.
class VectorClock {
  constructor(counters = new Map()) {
    this.counters = new Map(counters);
  }

  copy() {
    return new VectorClock(this.counters);
  }

  // The replica that coordinates a write bumps its own counter.
  increment(node) {
    this.counters.set(node, (this.counters.get(node) ?? 0) + 1);
    return this;
  }

  // Pointwise max: the clock of a version that has seen both histories.
  merge(other) {
    for (const [node, v] of other.counters) {
      this.counters.set(node, Math.max(this.counters.get(node) ?? 0, v));
    }
    return this;
  }

  // BEFORE = this is an ancestor of other; CONCURRENT = neither saw the other.
  compare(other) {
    const nodes = new Set([...this.counters.keys(), ...other.counters.keys()]);
    let less = false, greater = false;
    for (const n of nodes) {
      const a = this.counters.get(n) ?? 0, b = other.counters.get(n) ?? 0;
      if (a < b) less = true;
      else if (a > b) greater = true;
    }
    if (less && greater) return Order.CONCURRENT;
    if (less) return Order.BEFORE;
    if (greater) return Order.AFTER;
    return Order.EQUAL;
  }

  toString() {
    const parts = [...this.counters.keys()].sort().map((n) => n + ":" + this.counters.get(n));
    return "{" + parts.join(", ") + "}";
  }
}

const show = (items) => "[" + [...items].sort().join(", ") + "]";

// 1. Client adds "milk" to the cart; replica A coordinates the write.
const v1 = new VectorClock().increment("A");
const cart1 = new Set(["milk"]);
console.log("v1 written via A : " + v1 + " " + show(cart1));

// 2. v1 replicates to B. Then the network partitions A from B.
const atB = v1.copy();
console.log("B has v1         : " + atB);

// 3. One client adds eggs via A, another adds bread via B.
const v2 = v1.copy().increment("A"), cart2 = new Set(["milk", "eggs"]);
const v3 = atB.copy().increment("B"), cart3 = new Set(["milk", "bread"]);
console.log("v2 written via A : " + v2 + " " + show(cart2));
console.log("v3 written via B : " + v3 + " " + show(cart3));

console.log("v1 vs v2 = " + v1.compare(v2)); // BEFORE: v2 can replace v1
console.log("v2 vs v1 = " + v2.compare(v1)); // AFTER
const o = v2.compare(v3);
console.log("v2 vs v3 = " + o);              // CONCURRENT: a real conflict
if (o === Order.CONCURRENT) console.log("conflict: keep both siblings, let the reader merge");

// 4. A reader gets both siblings, merges the carts (union) and writes back via A.
const merged = new Set([...cart2, ...cart3]);
const v4 = v2.copy().merge(v3).increment("A");
console.log("v4 merged via A  : " + v4 + " " + show(merged));
console.log("v4 vs v2 = " + v4.compare(v2) + ", v4 vs v3 = " + v4.compare(v3));
console.log("v4 vs copy = " + v4.compare(v4.copy()));`,
      go: String.raw`package main

import (
	"fmt"
	"sort"
	"strings"
)

type Order string

const (
	Before     Order = "BEFORE"
	After      Order = "AFTER"
	Equal      Order = "EQUAL"
	Concurrent Order = "CONCURRENT"
)

// VectorClock holds one counter per replica that has coordinated a write.
type VectorClock map[string]int

func (vc VectorClock) Copy() VectorClock {
	c := make(VectorClock, len(vc))
	for n, v := range vc {
		c[n] = v
	}
	return c
}

// Increment: the replica that coordinates a write bumps its own counter.
func (vc VectorClock) Increment(node string) VectorClock {
	vc[node]++
	return vc
}

// Merge takes the pointwise max: the clock of a version that has seen both histories.
func (vc VectorClock) Merge(other VectorClock) VectorClock {
	for n, v := range other {
		if v > vc[n] {
			vc[n] = v
		}
	}
	return vc
}

// Compare: Before = vc is an ancestor of other; Concurrent = neither saw the other.
func (vc VectorClock) Compare(other VectorClock) Order {
	less, greater := false, false
	check := func(n string) {
		a, b := vc[n], other[n] // missing keys read as 0
		if a < b {
			less = true
		} else if a > b {
			greater = true
		}
	}
	for n := range vc {
		check(n)
	}
	for n := range other {
		check(n)
	}
	switch {
	case less && greater:
		return Concurrent
	case less:
		return Before
	case greater:
		return After
	}
	return Equal
}

func (vc VectorClock) String() string {
	nodes := make([]string, 0, len(vc))
	for n := range vc {
		nodes = append(nodes, n)
	}
	sort.Strings(nodes)
	parts := make([]string, len(nodes))
	for i, n := range nodes {
		parts[i] = fmt.Sprintf("%s:%d", n, vc[n])
	}
	return "{" + strings.Join(parts, ", ") + "}"
}

func show(items ...string) string {
	sort.Strings(items)
	return "[" + strings.Join(items, ", ") + "]"
}

func main() {
	// 1. Client adds "milk" to the cart; replica A coordinates the write.
	v1 := VectorClock{}.Increment("A")
	fmt.Println("v1 written via A :", v1, show("milk"))

	// 2. v1 replicates to B. Then the network partitions A from B.
	atB := v1.Copy()
	fmt.Println("B has v1         :", atB)

	// 3. One client adds eggs via A, another adds bread via B.
	v2 := v1.Copy().Increment("A")
	v3 := atB.Copy().Increment("B")
	fmt.Println("v2 written via A :", v2, show("milk", "eggs"))
	fmt.Println("v3 written via B :", v3, show("milk", "bread"))

	fmt.Println("v1 vs v2 =", v1.Compare(v2)) // BEFORE: v2 can replace v1
	fmt.Println("v2 vs v1 =", v2.Compare(v1)) // AFTER
	o := v2.Compare(v3)
	fmt.Println("v2 vs v3 =", o) // CONCURRENT: a real conflict
	if o == Concurrent {
		fmt.Println("conflict: keep both siblings, let the reader merge")
	}

	// 4. A reader gets both siblings, merges the carts (union) and writes back via A.
	v4 := v2.Copy().Merge(v3).Increment("A")
	fmt.Println("v4 merged via A  :", v4, show("milk", "eggs", "bread"))
	fmt.Printf("v4 vs v2 = %s, v4 vs v3 = %s\n", v4.Compare(v2), v4.Compare(v3))
	fmt.Println("v4 vs copy =", v4.Compare(v4.Copy()))
}`,
    },
  },
  diagrams: {
    single: String.raw`flowchart LR
      C[Client] -->|"put(k, v)"| N[Node]
      N -->|"1. append + fsync"| W[("Write-ahead log")]
      N -->|"2. update"| M["In-memory hash map"]
      M -.->|"every few minutes"| S[("Snapshot file")]
      S -.->|"on restart: load"| M
      W -.->|"then replay tail"| M`,
    arch: String.raw`flowchart LR
      CL["Client / smart client"] --> CO["Coordinator (any node)"]
      subgraph Ring["Consistent-hash ring, N = 3"]
        A[Node A]
        B[Node B]
        C[Node C]
        D[Node D]
        E[Node E]
      end
      CO -->|replicate| A
      CO -->|replicate| B
      CO -->|replicate| C
      A -.-|gossip| D
      B -.-|"Merkle anti-entropy"| C
      D -.->|"hinted handoff"| C`,
    write: String.raw`sequenceDiagram
      participant Cl as Client
      participant Co as Coordinator
      participant A as Replica A
      participant B as Replica B
      participant C as Replica C
      Cl->>Co: put(cart:42, v, context)
      Co->>Co: new vector clock
      par to all N replicas
        Co->>A: write
        Co->>B: write
        Co->>C: write
      end
      A-->>Co: ack
      B-->>Co: ack
      Co-->>Cl: OK (W = 2 reached)
      C-->>Co: ack (late, ignored)`,
    conflict: String.raw`sequenceDiagram
      participant U1 as Client 1
      participant A as Replica A
      participant B as Replica B
      participant U2 as Client 2
      U1->>A: put cart [milk]
      A->>B: replicate {A:1}
      Note over A,B: network partition
      U1->>A: add eggs
      Note over A: {A:2} [milk, eggs]
      U2->>B: add bread
      Note over B: {A:1, B:1} [milk, bread]
      Note over A,B: partition heals
      U1->>A: get cart
      A-->>U1: 2 siblings (CONCURRENT)
      U1->>A: put merged, clock {A:2, B:1}
      Note over A: {A:3, B:1} [bread, eggs, milk]`,
    gossip: String.raw`flowchart LR
      subgraph R1["Round 1"]
        A1["A: A=7 B=5 C=3"] -->|"swap tables"| B1["B: A=6 B=6 C=3"]
      end
      subgraph R2["Round 2"]
        B2["B: A=7 B=6 C=3"] -->|"swap tables"| D2["D: A=6 B=4 C=3"]
      end
      R1 --> R2
      R2 --> X["C stuck at 3: suspected down"]`,
    hinted: String.raw`sequenceDiagram
      participant Co as Coordinator
      participant A as Replica A
      participant C as Replica C (down)
      participant D as Node D (next on ring)
      Co->>A: write k
      Co--xC: write k (timeout)
      Co->>D: write k + hint for C
      A-->>Co: ack
      D-->>Co: ack
      Note over Co: W = 2 met (sloppy)
      Note over C: comes back
      D->>C: replay hinted write
      C-->>D: ack
      D->>D: delete hint`,
    merkle: String.raw`flowchart TB
      R1["Root A: 9f3c"] --- L1["Left: 21aa"]
      R1 --- R1R["Right: 7b10"]
      L1 --- B1["keys 0-99: ok"]
      L1 --- B2["keys 100-199: ok"]
      R1R --- B3["keys 200-299: ok"]
      R1R --- B4["keys 300-399: DIFF"]
      B4 ==> S["Sync only keys 300-399 with replica B"]`,
    lsm: String.raw`flowchart TB
      subgraph WP["Write path"]
        W1["put"] --> CL[("Commit log")]
        CL --> MT["Memtable (sorted, RAM)"]
        MT -->|"flush when full"| SS[("SSTables on disk")]
        SS -->|"background"| CP["Compaction"]
      end
      subgraph RP["Read path"]
        G["get"] --> M2["Memtable"]
        M2 -->|miss| BF{"Bloom filter per SSTable"}
        BF -->|"maybe"| IX["Index then data block"]
        BF -->|"no: skip file"| NX["Next SSTable"]
      end`,
  },
});
