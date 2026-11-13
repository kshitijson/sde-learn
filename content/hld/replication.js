SD.register({
  id: "replication",
  html: String.raw`
    <p class="lead">Replication means keeping a copy of the same data on several machines, so the system survives a dead disk, serves more reads, and sits closer to users. It sounds simple: copy every write everywhere. The hard part is that copies take time to travel, machines fail halfway through, and the network splits. Every replication design is an answer to three questions: <em>who accepts writes</em> (one leader, many leaders, or any node), <em>when is a write "done"</em> (before or after the copies have it), and <em>what does a reader see</em> while copies disagree. This page covers single-leader, multi-leader and leaderless replication, the bugs replication lag causes, failover, and quorums.</p>

    <h2>Why replicate</h2>
    <div class="grid-2">
      <div class="card"><strong>Availability</strong><p>If the machine holding your only copy dies, the service is down until it is restored. With a replica ready, you fail over in seconds. See <a href="#/p/availability">Availability &amp; reliability</a>.</p></div>
      <div class="card"><strong>Read scaling</strong><p>Most apps read far more than they write (100:1 for a product catalogue). Five replicas can serve roughly five times the reads of one server.</p></div>
      <div class="card"><strong>Latency</strong><p>A replica in Mumbai answers Indian users in 5 ms instead of 200 ms from us-east-1. Geography is a big reason for multi-region replicas.</p></div>
      <div class="card"><strong>Durability</strong><p>A write that sits on three machines in three availability zones (AZs) survives a disk failure, a server fire or a whole AZ outage.</p></div>
    </div>
    <div class="callout info"><strong>Replication vs sharding</strong>Replication copies the <em>same</em> data to many nodes. <a href="#/p/sharding">Sharding</a> splits <em>different</em> data across nodes. Real systems do both: the data is split into shards, and each shard is replicated three times.</div>

    <h2>Single-leader replication</h2>
    <p>Also called leader-follower, primary-replica or master-slave. One node, the <strong>leader</strong>, accepts all writes. It records each change in a <strong>replication log</strong> and streams that log to the <strong>followers</strong> (replicas), which apply the changes in the same order. Reads can go to the leader or to any follower. This is the default in MySQL, PostgreSQL, MongoDB replica sets, Redis and most managed databases (RDS, Cloud SQL).</p>
    <div data-diagram="single" data-caption="Single-leader replication: all writes go to the leader, which streams its log to followers; reads can be spread across followers."></div>
    <p>Because only one node decides the order of writes, there are no write conflicts. That is the big win. The cost: the leader is a bottleneck for writes and a single point of failure until a follower is promoted.</p>

    <h3>Synchronous, asynchronous and semi-synchronous</h3>
    <p>When does the leader tell the client "your write succeeded"?</p>
    <div data-diagram="syncasync" data-caption="Follower 1 is synchronous (the leader waits for its ack); follower 2 is asynchronous (the leader does not wait)."></div>
    <table>
      <thead><tr><th>Mode</th><th>Leader acks the client when</th><th>Good</th><th>Bad</th></tr></thead>
      <tbody>
        <tr><td>Synchronous</td><td>All followers have the write</td><td>No data loss on failover; followers are always current</td><td>One slow or dead follower blocks every write. Rarely used with more than one follower</td></tr>
        <tr><td>Asynchronous</td><td>The leader has written it locally</td><td>Fastest writes; followers can be far away or slow</td><td>If the leader dies, writes not yet shipped are <strong>lost</strong>; followers lag</td></tr>
        <tr><td>Semi-synchronous</td><td>At least one follower has the write (others async)</td><td>At least two copies of every acked write, without waiting for all</td><td>A bit slower than async; if no follower answers in time, MySQL falls back to async</td></tr>
      </tbody>
    </table>
    <p>In practice: MySQL semi-sync (the leader waits for one replica to confirm it received the event, with a timeout of 10 s by default before falling back to async), PostgreSQL <code>synchronous_standby_names</code> with <code>synchronous_commit</code>, and MongoDB <code>writeConcern: { w: "majority" }</code>. Many teams run async replication inside a region and accept that a crash can lose the last few hundred milliseconds of writes. Payments companies like Razorpay or PhonePe usually want at least one synchronous copy in another AZ.</p>

    <h3>How the replication log looks</h3>
    <div class="tabs">
      <section data-tab="Statement-based">
        <p>Ship the SQL statement itself: <code>UPDATE wallet SET balance = balance - 100 WHERE user_id = 7</code>. Compact, but dangerous: <code>NOW()</code>, <code>RAND()</code> and <code>UUID()</code> give different results on each replica, and statements that depend on existing data (auto-increment, <code>UPDATE ... LIMIT</code> without an order, triggers) must run in exactly the same order. Old MySQL default; now mostly avoided.</p>
      </section>
      <section data-tab="WAL shipping">
        <p>Ship the storage engine's write-ahead log (WAL): low-level records like "bytes X to Y in disk page 4127 changed". PostgreSQL streaming replication works this way. Exact and fast, but tied to the storage format, so the leader and followers usually must run the same major version. That makes zero-downtime upgrades harder.</p>
      </section>
      <section data-tab="Logical (row-based)">
        <p>Ship row-level changes: "inserted row (id 42, name ...)", "row 42: balance changed 500 to 400", "deleted row 42". Independent of the storage engine, so followers can run a different version, and outside systems can read it. This is <strong>change data capture</strong> (CDC): Debezium reads it to feed Kafka, search indexes and caches. PostgreSQL logical replication and MySQL row-based binlog are examples.</p>
      </section>
      <section data-tab="MySQL binlog">
        <p>MySQL's binary log supports three formats: <code>STATEMENT</code>, <code>ROW</code> and <code>MIXED</code> (statement by default, row when the statement is unsafe). <code>ROW</code> has been the default since MySQL 5.7.7. With GTIDs (global transaction ids), every transaction has a unique id, so a replica knows exactly where it is and can switch to a new leader easily.</p>
      </section>
    </div>

    <h3>Adding a new follower</h3>
    <p>You cannot just copy the leader's data files while writes keep changing them, and you do not want to stop writes. The standard recipe:</p>
    <ol class="steps">
      <li>Take a consistent <strong>snapshot</strong> of the leader without locking it (InnoDB hot backup with Percona XtraBackup, <code>pg_basebackup</code>, or an EBS snapshot).</li>
      <li>Record the exact <strong>log position</strong> the snapshot matches: MySQL binlog file and offset or GTID set, PostgreSQL log sequence number (LSN).</li>
      <li>Restore the snapshot on the new node.</li>
      <li>The follower connects to the leader and asks for every change <em>after</em> that position. It applies the backlog until it has <strong>caught up</strong>, then streams changes live.</li>
    </ol>
    <p>The same "snapshot plus log position" idea is used to rebuild crashed followers, to seed a CDC pipeline, and to move data during <a href="#/p/sharding">resharding</a>.</p>

    <h2>Replication lag and the bugs it causes</h2>
    <p>With async followers, a follower may be a few milliseconds behind the leader normally, and seconds or minutes behind under heavy load, a long-running query, or a network blip. The data is <strong>eventually consistent</strong>: if writes stop, followers catch up. Until then, users see three classic anomalies.</p>
    <h3>1. Read-your-writes</h3>
    <p>A Zomato user edits their delivery address (written to the leader), the page reloads and reads from a lagging follower, and the old address is back. The user thinks the save failed and tries again.</p>
    <div data-diagram="ryw" data-caption="Read-your-writes violation: the write went to the leader, the read went to a follower that has not received it yet."></div>
    <p><strong>Fixes</strong>:</p>
    <ul>
      <li>Read anything the user can edit (their own profile, cart, settings) from the leader; other users' data from followers.</li>
      <li>For a short window after a write (say 10 to 60 seconds), route that user's reads to the leader.</li>
      <li>The client remembers the log position (LSN or GTID) of its last write; the router only uses a follower that has replayed at least that far, otherwise it waits or goes to the leader. MySQL has <code>WAIT_FOR_EXECUTED_GTID_SET</code>; PostgreSQL exposes <code>pg_last_wal_replay_lsn()</code>.</li>
    </ul>
    <h3>2. Monotonic reads</h3>
    <p>A user refreshes a comment thread twice. The first read hits a fresh follower and shows a new comment; the second hits a more lagging follower and the comment disappears. Time seems to go backwards. <strong>Fix</strong>: pin each user to one replica, for example <code>replica = hash(user_id) % replicas</code>, and fail over to another only if it dies.</p>
    <h3>3. Consistent prefix reads</h3>
    <p>Causally related writes arrive out of order. Riya asks "Is the order delivered?", Arjun answers "Yes, just now". If those two writes live on different partitions with different lag, a third user can see the answer before the question. <strong>Fix</strong>: write causally related data to the same partition (all messages of a chat in one partition, ordered there), or track causal dependencies with version vectors.</p>
    <div class="callout tip"><strong>Lag is a metric, watch it</strong>Monitor replica lag (<code>Seconds_Behind_Source</code> in MySQL, <code>pg_stat_replication.replay_lag</code> in PostgreSQL) and alert on it. Load balancers and proxies such as ProxySQL can stop sending reads to a replica whose lag crosses a threshold, like 5 seconds.</div>

    <h2>Failover: when the leader dies</h2>
    <p>Followers are easy: if one dies, it reconnects later and catches up from its last log position. Losing the leader is the hard part. <strong>Failover</strong> means promoting a follower to be the new leader and pointing all clients at it. It can be manual (an engineer runs a command) or automatic (tools like MySQL Orchestrator, Patroni for PostgreSQL, MongoDB's built-in elections, Redis Sentinel, or the cloud provider in RDS and Aurora).</p>
    <ol class="steps">
      <li><strong>Detect the failure.</strong> There is no reliable way to tell "dead" from "slow", so systems use heartbeats with a timeout: if the leader does not answer for, say, 10 to 30 seconds, it is declared dead. Too short a timeout causes needless failovers during a load spike (making things worse); too long means more downtime.</li>
      <li><strong>Choose a new leader.</strong> Usually the follower with the most up-to-date log, to lose the fewest writes. This is a consensus problem: the remaining nodes must agree on one leader. MongoDB uses a Raft-like election, etcd and Consul use Raft.</li>
      <li><strong>Reconfigure.</strong> Clients and other followers must send writes to the new leader: update DNS or a virtual IP, a service registry, or the proxy config. If the old leader comes back, it must step down and become a follower.</li>
    </ol>
    <div data-diagram="failover" data-caption="Failover with a fencing token: the old leader comes back with an older epoch and its writes are rejected."></div>
    <h3>What goes wrong</h3>
    <ul>
      <li><strong>Lost writes with async replication.</strong> The new leader may not have the old leader's last writes. When the old leader returns, its extra writes conflict, and the usual choice is to discard them. Clients were told "success" for writes that no longer exist.</li>
      <li><strong>Split brain.</strong> Two nodes both believe they are the leader, often because of a network partition rather than a crash. Both accept writes, the data diverges, and merging it later is painful or impossible.</li>
      <li><strong>Discarded writes leak into other systems.</strong> In GitHub's 2012 incident, an out-of-date MySQL follower was promoted. It reused auto-increment primary keys that the old leader had already handed out, and those ids were also stored in Redis. Rows got linked to the wrong users and some private data was shown to the wrong people.</li>
      <li><strong>Cross-region failover with unreplicated writes.</strong> In GitHub's October 2018 outage, a 43-second network break between an East Coast data centre and its hub made the orchestration tool promote MySQL primaries in a West Coast data centre. The East Coast had a few seconds of writes the West Coast never received. Failing back meant either losing those writes or reconciling them by hand; GitHub chose data integrity and ran degraded for about 24 hours.</li>
    </ul>
    <h3>Fencing tokens and quorums</h3>
    <p>Two standard protections against split brain:</p>
    <ul>
      <li><strong>Majority quorum for elections.</strong> A node becomes leader only if a majority (2 of 3, 3 of 5) votes for it. Two majorities always overlap, so two leaders cannot be elected in the same term. A leader cut off from the majority steps down.</li>
      <li><strong>Fencing tokens (epochs).</strong> Each new leader gets a number higher than every previous one (term 7, then term 8). Every write carries the token, and storage or downstream services reject any write with a token lower than the highest they have seen. A paused old leader that wakes up with token 7 is fenced off. The blunt version is STONITH, "shoot the other node in the head": power off the old leader before promoting a new one.</li>
    </ul>
    <div class="callout warn"><strong>Failover is not free</strong>Automatic failover is the right default, but it is where many outages come from: false positives from a GC pause, split brain, lost writes and clients that cache the old leader's address. Design the write path so a few seconds without a leader is acceptable (retries with <a href="#/p/message-queues">queues</a>, idempotent writes).</div>

    <h2>Multi-leader replication</h2>
    <p>More than one node accepts writes, and each leader forwards its changes to the others. The main use is <strong>multi-region</strong>: one leader per region (Mumbai, Singapore, Frankfurt), so writes are local and fast, and a region outage does not stop writes elsewhere. Other cases that are multi-leader in disguise: offline-first mobile apps (every device is a "leader" that syncs later) and collaborative editors.</p>
    <div data-diagram="multi" data-caption="Multi-leader across two regions: each region writes locally and replicates asynchronously to the other. Concurrent edits to the same row conflict."></div>
    <h3>The problem: write conflicts</h3>
    <p>If a user in Mumbai and a user in Singapore change the same row at the same time, both leaders accept the write, and each learns about the other's write later. Which one wins? Ways to resolve:</p>
    <table>
      <thead><tr><th>Approach</th><th>How</th><th>Trade-off</th></tr></thead>
      <tbody>
        <tr><td>Avoid conflicts</td><td>Route all writes for a record to its "home" region (a user's writes always go to their region)</td><td>Simplest and most common; breaks down when the home region fails or the user travels</td></tr>
        <tr><td>Last writer wins (LWW)</td><td>Each write carries a timestamp; the highest timestamp wins everywhere</td><td>Converges, but silently drops the losing write; clock skew can let an older write win</td></tr>
        <tr><td>Merge</td><td>Combine values: union of cart items, concatenation of text, keep both versions as "siblings"</td><td>No data loss, but merges can be surprising (Amazon's Dynamo cart: deleted items could reappear)</td></tr>
        <tr><td>Application-defined</td><td>Store both versions and let code or the user resolve on read or write (like a git merge conflict)</td><td>Most flexible, most work</td></tr>
        <tr><td>CRDTs</td><td>Conflict-free replicated data types: counters, sets, maps and text designed so that merging in any order gives the same result</td><td>Automatic and correct for supported types; limited data models, metadata overhead</td></tr>
      </tbody>
    </table>
    <div class="callout info"><strong>CRDT teaser</strong>A grow-only counter (G-Counter) keeps one count per replica: <code>{mumbai: 5, singapore: 3}</code>. Incrementing touches only your own slot; merging takes the max of each slot; the value is the sum (8). Any merge order gives the same answer, so there is never a conflict. Redis Enterprise Active-Active and Riak use CRDTs; collaborative editors use CRDTs or operational transformation (OT, used by Google Docs).</div>
    <p>Multi-leader is usually best avoided inside a single data centre: the conflicts and complexity are rarely worth it. Use it across regions when you truly need local writes everywhere, and keep the conflict-prone data small.</p>

    <h2>Leaderless replication (Dynamo-style)</h2>
    <p>No leader at all. The client (or a coordinator node acting for it) sends each write to several replicas in parallel and each read to several replicas in parallel. Amazon's 2007 <em>Dynamo</em> paper made this popular; Cassandra, ScyllaDB, Riak and Voldemort follow it.</p>
    <h3>Quorums: N, W and R</h3>
    <ul>
      <li><strong>N</strong>: how many replicas hold each key (replication factor), usually 3.</li>
      <li><strong>W</strong>: how many replicas must confirm a write before it counts as successful.</li>
      <li><strong>R</strong>: how many replicas must answer a read. The reader takes the value with the highest version.</li>
    </ul>
    <p>If <strong>R + W &gt; N</strong>, the set of replicas you read from and the set that acknowledged the latest write must share at least one node, so at least one response is up to date. With N = 3, W = 2, R = 2, any two readers and any two writers overlap in at least one replica.</p>
    <figure class="svg-fig">
      <svg viewBox="0 0 640 250">
        <text class="s-title" x="320" y="28" text-anchor="middle">N = 3, W = 2, R = 2: the read set and write set always overlap</text>
        <rect class="s-green" x="60" y="80" width="140" height="70" rx="10"/>
        <text class="s-text" x="130" y="110" text-anchor="middle">Replica A</text>
        <text class="s-muted" x="130" y="132" text-anchor="middle">v2 (new)</text>
        <rect class="s-accent" x="250" y="80" width="140" height="70" rx="10"/>
        <text class="s-text" x="320" y="110" text-anchor="middle">Replica B</text>
        <text class="s-muted" x="320" y="132" text-anchor="middle">v2 (new)</text>
        <rect class="s-red" x="440" y="80" width="140" height="70" rx="10"/>
        <text class="s-text" x="510" y="110" text-anchor="middle">Replica C</text>
        <text class="s-muted" x="510" y="132" text-anchor="middle">v1 (stale)</text>
        <rect class="s-dash" x="45" y="58" width="360" height="114" rx="10"/>
        <text class="s-muted" x="225" y="52" text-anchor="middle">write acked by A, B (W = 2)</text>
        <rect class="s-dash" x="235" y="68" width="360" height="94" rx="10"/>
        <text class="s-muted" x="415" y="188" text-anchor="middle">read set: B, C (R = 2)</text>
        <text class="s-text" x="415" y="212" text-anchor="middle">the read gets v2 from B and v1 from C</text>
        <text class="s-muted" x="415" y="232" text-anchor="middle">returns v2 (highest version), then repairs C</text>
      </svg>
      <figcaption>Because 2 + 2 &gt; 3, the replicas that saw the write and the replicas that answer the read share at least one node (B here).</figcaption>
    </figure>
    <p>Try it yourself. Set N, W and R, and see whether a read can miss the latest write.</p>
    <div data-widget="quorum"></div>
    <p>What the widget shows is the overlap rule: the guaranteed overlap is <code>W + R - N</code> replicas. If that is zero or negative, some choice of replicas sees only stale copies. Typical settings:</p>
    <table>
      <thead><tr><th>Setting (N = 3)</th><th>Behaviour</th></tr></thead>
      <tbody>
        <tr><td>W = 2, R = 2</td><td>Balanced quorum. Tolerates one replica down for both reads and writes. Cassandra <code>QUORUM</code>.</td></tr>
        <tr><td>W = 3, R = 1</td><td>Fast reads, but a write fails if any replica is down.</td></tr>
        <tr><td>W = 1, R = 3</td><td>Fast writes, slow and fragile reads.</td></tr>
        <tr><td>W = 1, R = 1</td><td>Fastest and most available, but reads can be stale. Cassandra <code>ONE</code>; fine for likes, views, telemetry.</td></tr>
      </tbody>
    </table>
    <p>Quorums tolerate failures without failover: with N = 3 and W = R = 2, one replica can be down and nothing notices. There is no leader election and no failover gap. The price: every read and write talks to several nodes, and the system is eventually consistent unless you choose the overlap.</p>

    <h3>Catching up stale replicas</h3>
    <ul>
      <li><strong>Read repair.</strong> When a read sees that one replica returned an older version, the coordinator writes the newer value back to it. Hot keys get fixed quickly; rarely read keys may stay stale.</li>
      <li><strong>Hinted handoff.</strong> If a target replica is down during a write, another node stores the write with a "hint" saying who it is really for, and hands it over when the owner comes back (Cassandra keeps hints for 3 hours by default).</li>
      <li><strong>Anti-entropy with Merkle trees.</strong> A background process compares replicas and copies missing data. Comparing every key would be too slow, so each replica builds a <strong>Merkle tree</strong>: leaves are hashes of key ranges, each parent is the hash of its children. Two replicas compare root hashes; if equal, the whole range matches. If not, they walk down only the branches whose hashes differ, finding the out-of-sync range after exchanging a few hashes instead of millions of keys. Cassandra's <code>nodetool repair</code> does this.</li>
    </ul>
    <div data-diagram="merkle" data-caption="Merkle tree comparison: roots differ, so compare children; only the range under H2 differs and needs syncing."></div>

    <h3>Sloppy quorums</h3>
    <p>In a strict quorum, the W writes must land on the key's N "home" replicas. During a partition, maybe fewer than W home replicas are reachable. A <strong>sloppy quorum</strong> accepts the write on any W reachable nodes, even ones outside the home set, and relies on hinted handoff to move it home later. Writes stay available, but R + W &gt; N no longer guarantees a fresh read, because the read quorum may not overlap the temporary nodes. Dynamo and Riak support sloppy quorums.</p>
    <div class="callout warn"><strong>R + W &gt; N is not "strong consistency"</strong>Even with overlapping quorums you can read stale data: with sloppy quorums; when two writes are concurrent and last-writer-wins drops one; when a write succeeded on fewer than W nodes (reported as failed) but was not rolled back; or when a node holding the new value fails and is restored from a stale copy. Quorums give a probabilistic, "usually fresh" guarantee. For linearizable reads you need consensus (Raft, Paxos) or a single leader.</div>

    <h3>Code: leaderless quorum replication</h3>
    <p>A small simulation. Each replica stores <code>(version, value)</code> per key. Before every operation a seeded random generator marks some replicas as down (10% chance each) so the output is the same every run. <code>write</code> tries replicas in random order and stops once W have acknowledged; the remaining replicas have not received the write yet, which is the worst case the quorum rule must handle. <code>read</code> asks R live replicas, returns the highest version, and does read repair. With N = 3, W = 1, R = 1 you get stale reads; with W = 2, R = 2 you never do.</p>
    <div data-code="quorum"></div>
    <p>Expected output (all five languages print the same):</p>
    <pre><code>== N=3 W=1 R=1  (R+W=2 &lt;= N) ==
round 1: write v1 acks=[1] | read [0] -&gt; - STALE
round 2: write v2 acks=[1] | read [1] -&gt; v2 fresh
round 3: write v3 acks=[2] | read [2] -&gt; v3 fresh
round 4: write v4 acks=[1] | read [2] -&gt; v3 STALE
round 5: write v5 acks=[2] | read [1] -&gt; v4 STALE
round 6: write v6 acks=[2] | read [0] -&gt; - STALE
round 7: write v7 acks=[2] | read [2] -&gt; v7 fresh
round 8: write v8 acks=[0] | read [0] -&gt; v8 fresh
stale reads: 4/8

== N=3 W=2 R=2  (R+W=4 &gt; N) ==
round 1: write v1 acks=[1,0] | read [0,2] -&gt; v1 fresh, repaired [2]
...
round 8: write v8 acks=[0,1] | read [0,1] -&gt; v8 fresh
stale reads: 0/8</code></pre>
    <p>Notice the repairs in the second run: every time a read touched a replica that missed a write, the coordinator fixed it. Real systems use timestamps (Cassandra) or vector clocks (original Dynamo, Riak) instead of a single counter, because there is no central coordinator handing out versions.</p>

    <h2>Comparing the three approaches</h2>
    <table>
      <thead><tr><th></th><th>Single-leader</th><th>Multi-leader</th><th>Leaderless</th></tr></thead>
      <tbody>
        <tr><td>Who accepts writes</td><td>One leader</td><td>Several leaders (often one per region)</td><td>Any replica; client or coordinator writes to many</td></tr>
        <tr><td>Write conflicts</td><td>None (one order)</td><td>Yes; must be resolved</td><td>Yes for concurrent writes; LWW or siblings</td></tr>
        <tr><td>Leader failure</td><td>Failover needed (seconds of no writes, risk of lost writes)</td><td>Other leaders keep accepting writes</td><td>No failover; quorum tolerates N - W nodes down</td></tr>
        <tr><td>Write scaling</td><td>Limited by one node (shard to scale)</td><td>Writes spread across regions</td><td>Writes spread across nodes</td></tr>
        <tr><td>Consistency</td><td>Strong on leader; eventual on async followers</td><td>Eventual; conflicts possible</td><td>Tunable with R and W; eventual by default</td></tr>
        <tr><td>Complexity</td><td>Lowest</td><td>Highest</td><td>Medium (repair, versioning)</td></tr>
        <tr><td>Examples</td><td>MySQL, PostgreSQL, MongoDB, Redis, Aurora</td><td>DynamoDB global tables, Cosmos DB multi-region writes, MySQL Group Replication (multi-primary), CouchDB</td><td>Cassandra, ScyllaDB, Riak, Voldemort</td></tr>
      </tbody>
    </table>

    <h2>Real systems</h2>
    <ul>
      <li><strong>MySQL and PostgreSQL</strong>: single leader with async replicas by default; semi-sync or synchronous standbys for durability. Failover through Orchestrator, Patroni, or managed services like RDS (Multi-AZ keeps a synchronous standby in another AZ).</li>
      <li><strong>Amazon Aurora</strong>: separates compute from storage. The storage layer keeps 6 copies of every piece of data across 3 AZs; a write needs 4 of 6 acknowledgements and a read quorum is 3 of 6, so it survives losing a whole AZ plus one more node. Up to 15 read replicas share the same storage, so replica lag is usually well under 100 ms, and failover typically completes in under about 30 seconds.</li>
      <li><strong>MongoDB replica sets</strong>: one primary and usually two secondaries; if the primary is unreachable for about 10 s (the default election timeout), the members elect a new one. <code>w: "majority"</code> (the default since 5.0) means an acknowledged write survives failover; with <code>w: 1</code>, unreplicated writes on a failed primary are rolled back. <code>readPreference</code> chooses primary or secondaries.</li>
      <li><strong>Cassandra</strong>: leaderless with a replication factor per keyspace (usually 3 per data centre). Each request picks a consistency level: <code>ONE</code>, <code>QUORUM</code>, <code>LOCAL_QUORUM</code> (quorum inside the local data centre, popular for multi-region), <code>ALL</code>. Conflicts resolve by last write wins per column using timestamps.</li>
      <li><strong>DynamoDB</strong>: despite the name, not leaderless like the Dynamo paper. Each partition is copied to 3 AZs with a leader elected by Paxos. Reads are eventually consistent by default (half the cost); you can ask for a strongly consistent read that goes to the leader. Global tables replicate across regions with multi-leader, last-writer-wins semantics.</li>
    </ul>

    <h2>Common interview questions</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"The database is a single leader with two followers in other AZs. One follower is semi-synchronous, so every acknowledged write exists on two machines, and failover via Patroni or RDS does not lose committed data."</li>
        <li>"Reads go to followers, except a user's reads of their own data within a minute of a write, which go to the leader. That gives read-your-writes without loading the leader with everything."</li>
        <li>"Failover uses a majority vote and fencing tokens, so an old leader that comes back cannot keep writing."</li>
        <li>"For the like counter I'd use Cassandra with replication factor 3 and consistency <code>ONE</code>: stale counts are fine. For the user's wallet I need a single leader with synchronous replication."</li>
        <li>"With N = 3, W = 2, R = 2 the read and write quorums overlap, and one node can be down without affecting either path."</li>
      </ul>
    </div>
    <div class="callout warn"><strong>Pitfalls</strong>Saying "add read replicas" without addressing lag (read-your-writes); assuming async failover loses nothing; forgetting split brain; claiming R + W &gt; N gives strong consistency; proposing multi-leader inside one data centre without a conflict strategy; confusing replication (copies, for availability and reads) with sharding (splitting, for size and write throughput).</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>Your leader uses asynchronous replication and crashes. A follower is promoted. What can go wrong?</summary><div>Writes acknowledged by the old leader but not yet shipped to the follower are lost. When the old leader returns it has extra writes that conflict with the new leader, which are usually discarded. If those writes used ids (auto-increment keys) that other systems stored, the new leader may hand out the same ids again, as in GitHub's 2012 incident. Semi-sync replication or a majority write concern prevents this.</div></details>
      <details><summary>A user updates their profile picture and on refresh sees the old one. Name the anomaly and two fixes.</summary><div>A read-your-writes (read-after-write) violation caused by replication lag. Fixes: read the user's own profile from the leader (always, or for a window after they write); or have the client send the log position of its last write and only read from a follower that has replayed past it.</div></details>
      <details><summary>What is split brain and how do fencing tokens prevent damage from it?</summary><div>Split brain is when two nodes both act as leader and accept writes, usually after a network partition or a long pause. A fencing token is a number that increases with every new leader election. Every write carries it, and storage rejects writes whose token is lower than one it has already seen, so the stale leader's writes are refused.</div></details>
      <details><summary>N = 5. Which (W, R) pairs guarantee the read overlaps the last successful write? How many failures can each tolerate?</summary><div>Any pair with W + R &gt; 5, for example W = 3, R = 3 (tolerates 2 nodes down for both reads and writes), W = 5, R = 1 (fast reads, writes fail if any node is down), or W = 1, R = 5 (fast writes, reads fail if any node is down). Writes tolerate N - W failures; reads tolerate N - R.</div></details>
      <details><summary>How do two Cassandra replicas find which data differs without comparing every key?</summary><div>Anti-entropy repair with Merkle trees. Each replica hashes its key ranges into a tree where each parent is the hash of its children. They compare root hashes and descend only into children whose hashes differ, so they find the mismatched ranges after exchanging a handful of hashes, then stream just those ranges.</div></details>
      <details><summary>Why would you choose multi-leader replication, and what is the main problem you must solve?</summary><div>For multi-region deployments where every region needs low-latency local writes and must keep accepting writes if another region fails (or for offline clients). The main problem is write conflicts when the same record is changed in two places concurrently: avoid them by routing a record's writes to one home region, or resolve with LWW, merging, application logic, or CRDTs.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>Replicate for availability, read scaling, lower latency and durability. Replication copies data; sharding splits it.</li>
      <li>Single-leader is the default: no conflicts, simple. Choose sync, async or semi-sync per how much data loss on failover you can accept.</li>
      <li>Logical (row-based) replication logs decouple versions and power change data capture.</li>
      <li>Async lag causes read-your-writes, monotonic read and consistent prefix anomalies; fix with leader reads for own data, replica pinning and keeping causal data together.</li>
      <li>Failover is risky: detect with timeouts, elect by majority, fence old leaders with epoch tokens, and remember async failover loses writes.</li>
      <li>Multi-leader suits multi-region writes but needs a conflict strategy (avoid, LWW, merge, CRDT).</li>
      <li>Leaderless uses quorums: R + W &gt; N gives overlap; read repair, hinted handoff and Merkle-tree anti-entropy fix stale replicas. It is still not linearizable.</li>
    </ul></div>
  `,
  code: {
    quorum: {
      title: "Leaderless quorum replication with read repair (seeded failures)",
      java: String.raw`import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class Main {
    /** Park-Miller generator: same sequence in every language, so output is deterministic. */
    static class Rng {
        private long state;
        Rng(long seed) { state = seed; }
        int nextInt(int bound) {
            state = state * 48271 % 2147483647L;
            return (int) (state % bound);
        }
    }

    record Versioned(int version, String value) {
        static final Versioned NONE = new Versioned(0, null);
    }

    static class Replica {
        final int id;
        boolean up = true;
        final Map<String, Versioned> store = new HashMap<>();
        Replica(int id) { this.id = id; }
        Versioned get(String key) { return store.getOrDefault(key, Versioned.NONE); }
    }

    record WriteResult(boolean ok, List<Integer> acks) {}
    record ReadResult(Versioned best, List<Integer> responders, List<Integer> repaired) {}

    static class QuorumCluster {
        final int n, w, r;
        final List<Replica> replicas = new ArrayList<>();
        final Rng rng;
        int clock = 0;                                   // coordinator-assigned versions
        final Map<String, Integer> latest = new HashMap<>(); // highest acked version, to detect stale reads

        QuorumCluster(int n, int w, int r, long seed) {
            this.n = n; this.w = w; this.r = r;
            this.rng = new Rng(seed);
            for (int i = 0; i < n; i++) replicas.add(new Replica(i));
        }

        private void rollFailures() {
            for (Replica rep : replicas) rep.up = rng.nextInt(10) >= 1; // down 10% of the time
        }

        private List<Integer> shuffled() {
            List<Integer> order = new ArrayList<>();
            for (int i = 0; i < n; i++) order.add(i);
            for (int i = n - 1; i > 0; i--) {
                int j = rng.nextInt(i + 1);
                Integer tmp = order.get(i);
                order.set(i, order.get(j));
                order.set(j, tmp);
            }
            return order;
        }

        WriteResult write(String key, String value) {
            rollFailures();
            clock++;
            List<Integer> acks = new ArrayList<>();
            for (int i : shuffled()) {
                if (acks.size() == w) break; // quorum reached; slower replicas have not got the write yet
                Replica rep = replicas.get(i);
                if (rep.up) {
                    if (rep.get(key).version() < clock) rep.store.put(key, new Versioned(clock, value));
                    acks.add(i);
                }
            }
            boolean ok = acks.size() == w;
            if (ok) latest.put(key, clock);
            return new WriteResult(ok, acks);
        }

        /** Returns null when fewer than R replicas answer. */
        ReadResult read(String key) {
            rollFailures();
            List<Integer> responders = shuffled().stream()
                    .filter(i -> replicas.get(i).up).limit(r).collect(Collectors.toList());
            if (responders.size() < r) return null;
            Versioned best = Versioned.NONE;
            for (int i : responders) {
                Versioned v = replicas.get(i).get(key);
                if (v.version() > best.version()) best = v;
            }
            List<Integer> repaired = new ArrayList<>();
            for (int i : responders) {
                if (replicas.get(i).get(key).version() < best.version()) {
                    replicas.get(i).store.put(key, best); // read repair
                    repaired.add(i);
                }
            }
            return new ReadResult(best, responders, repaired);
        }
    }

    static String fmt(List<Integer> ids) {
        return "[" + ids.stream().map(String::valueOf).collect(Collectors.joining(",")) + "]";
    }

    static void demo(int n, int w, int r, long seed) {
        System.out.printf("== N=%d W=%d R=%d  (R+W=%d %s N) ==%n", n, w, r, r + w, r + w > n ? ">" : "<=");
        QuorumCluster cluster = new QuorumCluster(n, w, r, seed);
        int stale = 0;
        for (int k = 1; k <= 8; k++) {
            String val = "v" + k;
            WriteResult wr = cluster.write("cart:42", val);
            StringBuilder line = new StringBuilder("round " + k + ": write " + val + " "
                    + (wr.ok() ? "acks" : "FAILED acks") + "=" + fmt(wr.acks()) + " | ");
            ReadResult rr = cluster.read("cart:42");
            if (rr == null) {
                line.append("read FAILED");
            } else {
                boolean isStale = rr.best().version() < cluster.latest.getOrDefault("cart:42", 0);
                if (isStale) stale++;
                String value = rr.best().value() == null ? "-" : rr.best().value();
                line.append("read ").append(fmt(rr.responders())).append(" -> ").append(value)
                    .append(isStale ? " STALE" : " fresh");
                if (!rr.repaired().isEmpty()) line.append(", repaired ").append(fmt(rr.repaired()));
            }
            System.out.println(line);
        }
        System.out.println("stale reads: " + stale + "/8\n");
    }

    public static void main(String[] args) {
        demo(3, 1, 1, 42);
        demo(3, 2, 2, 42);
    }
}
`,
      python: String.raw`from typing import Dict, List, Optional, Tuple

Versioned = Tuple[int, Optional[str]]  # (version, value); version 0 = never written


class Rng:
    """Park-Miller generator: same sequence in every language, so output is deterministic."""

    def __init__(self, seed: int):
        self.state = seed

    def next_int(self, bound: int) -> int:
        self.state = self.state * 48271 % 2147483647
        return self.state % bound


class Replica:
    def __init__(self, rid: int):
        self.id = rid
        self.up = True
        self.store: Dict[str, Versioned] = {}

    def get(self, key: str) -> Versioned:
        return self.store.get(key, (0, None))


class QuorumCluster:
    def __init__(self, n: int, w: int, r: int, seed: int):
        self.n, self.w, self.r = n, w, r
        self.replicas = [Replica(i) for i in range(n)]
        self.rng = Rng(seed)
        self.clock = 0  # coordinator-assigned versions (real systems: timestamps or vector clocks)
        self.latest: Dict[str, int] = {}  # highest acknowledged version, used only to detect stale reads

    def _roll_failures(self) -> None:
        for rep in self.replicas:
            rep.up = self.rng.next_int(10) >= 1  # each replica is down 10% of the time

    def _shuffled(self) -> List[int]:
        order = list(range(self.n))
        for i in range(self.n - 1, 0, -1):
            j = self.rng.next_int(i + 1)
            order[i], order[j] = order[j], order[i]
        return order

    def write(self, key: str, value: str) -> Tuple[bool, List[int]]:
        self._roll_failures()
        self.clock += 1
        acks: List[int] = []
        for i in self._shuffled():
            if len(acks) == self.w:
                break  # quorum reached; the slower replicas have not received the write yet
            rep = self.replicas[i]
            if rep.up:
                if rep.get(key)[0] < self.clock:
                    rep.store[key] = (self.clock, value)
                acks.append(i)
        ok = len(acks) == self.w
        if ok:
            self.latest[key] = self.clock
        return ok, acks

    def read(self, key: str) -> Optional[Tuple[Versioned, List[int], List[int]]]:
        self._roll_failures()
        responders = [i for i in self._shuffled() if self.replicas[i].up][: self.r]
        if len(responders) < self.r:
            return None  # not enough replicas answered: the read fails
        best: Versioned = (0, None)
        for i in responders:
            v = self.replicas[i].get(key)
            if v[0] > best[0]:
                best = v
        repaired = [i for i in responders if self.replicas[i].get(key)[0] < best[0]]
        for i in repaired:  # read repair: push the newest value to stale responders
            self.replicas[i].store[key] = best
        return best, responders, repaired


def fmt(ids: List[int]) -> str:
    return "[" + ",".join(str(i) for i in ids) + "]"


def demo(n: int, w: int, r: int, seed: int) -> None:
    rule = ">" if r + w > n else "<="
    print(f"== N={n} W={w} R={r}  (R+W={r + w} {rule} N) ==")
    cluster = QuorumCluster(n, w, r, seed)
    stale = 0
    for k in range(1, 9):
        val = f"v{k}"
        ok, acks = cluster.write("cart:42", val)
        line = f"round {k}: write {val} {'acks' if ok else 'FAILED acks'}={fmt(acks)} | "
        res = cluster.read("cart:42")
        if res is None:
            line += "read FAILED"
        else:
            (ver, value), responders, repaired = res
            is_stale = ver < cluster.latest.get("cart:42", 0)
            stale += is_stale
            line += f"read {fmt(responders)} -> {value or '-'} {'STALE' if is_stale else 'fresh'}"
            if repaired:
                line += f", repaired {fmt(repaired)}"
        print(line)
    print(f"stale reads: {stale}/8\n")


if __name__ == "__main__":
    demo(3, 1, 1, 42)
    demo(3, 2, 2, 42)
`,
      cpp: String.raw`#include <cstdint>
#include <iostream>
#include <optional>
#include <sstream>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

// Park-Miller generator: same sequence in every language, so output is deterministic.
class Rng {
    int64_t state_;
public:
    explicit Rng(int64_t seed) : state_(seed) {}
    int nextInt(int bound) {
        state_ = state_ * 48271 % 2147483647LL;
        return static_cast<int>(state_ % bound);
    }
};

struct Versioned {
    int version = 0;  // 0 = never written
    std::string value;
};

struct Replica {
    int id;
    bool up = true;
    std::unordered_map<std::string, Versioned> store;
    explicit Replica(int i) : id(i) {}
    Versioned get(const std::string& key) const {
        auto it = store.find(key);
        return it == store.end() ? Versioned{} : it->second;
    }
};

struct ReadResult {
    Versioned best;
    std::vector<int> responders, repaired;
};

class QuorumCluster {
    int n_, w_, r_;
    std::vector<Replica> replicas_;
    Rng rng_;
    int clock_ = 0;  // coordinator-assigned versions (real systems: timestamps or vector clocks)

    void rollFailures() {
        for (auto& rep : replicas_) rep.up = rng_.nextInt(10) >= 1;  // down 10% of the time
    }
    std::vector<int> shuffled() {
        std::vector<int> order(n_);
        for (int i = 0; i < n_; i++) order[i] = i;
        for (int i = n_ - 1; i > 0; i--) std::swap(order[i], order[rng_.nextInt(i + 1)]);
        return order;
    }

public:
    std::unordered_map<std::string, int> latest;  // highest acked version, to detect stale reads

    QuorumCluster(int n, int w, int r, int64_t seed) : n_(n), w_(w), r_(r), rng_(seed) {
        for (int i = 0; i < n; i++) replicas_.emplace_back(i);
    }

    std::pair<bool, std::vector<int>> write(const std::string& key, const std::string& value) {
        rollFailures();
        clock_++;
        std::vector<int> acks;
        for (int i : shuffled()) {
            if (static_cast<int>(acks.size()) == w_) break;  // quorum reached; slower replicas lag
            Replica& rep = replicas_[i];
            if (rep.up) {
                if (rep.get(key).version < clock_) rep.store[key] = Versioned{clock_, value};
                acks.push_back(i);
            }
        }
        bool ok = static_cast<int>(acks.size()) == w_;
        if (ok) latest[key] = clock_;
        return {ok, acks};
    }

    // Empty optional when fewer than R replicas answer.
    std::optional<ReadResult> read(const std::string& key) {
        rollFailures();
        ReadResult res;
        for (int i : shuffled())
            if (replicas_[i].up && static_cast<int>(res.responders.size()) < r_) res.responders.push_back(i);
        if (static_cast<int>(res.responders.size()) < r_) return std::nullopt;
        for (int i : res.responders) {
            Versioned v = replicas_[i].get(key);
            if (v.version > res.best.version) res.best = v;
        }
        for (int i : res.responders) {
            if (replicas_[i].get(key).version < res.best.version) {
                replicas_[i].store[key] = res.best;  // read repair
                res.repaired.push_back(i);
            }
        }
        return res;
    }
};

std::string fmt(const std::vector<int>& ids) {
    std::ostringstream out;
    out << "[";
    for (size_t i = 0; i < ids.size(); i++) out << (i ? "," : "") << ids[i];
    out << "]";
    return out.str();
}

void demo(int n, int w, int r, int64_t seed) {
    std::cout << "== N=" << n << " W=" << w << " R=" << r << "  (R+W=" << r + w
              << (r + w > n ? " > " : " <= ") << "N) ==\n";
    QuorumCluster cluster(n, w, r, seed);
    int stale = 0;
    for (int k = 1; k <= 8; k++) {
        std::string val = "v" + std::to_string(k);
        auto [ok, acks] = cluster.write("cart:42", val);
        std::string line = "round " + std::to_string(k) + ": write " + val + (ok ? " acks=" : " FAILED acks=") +
                           fmt(acks) + " | ";
        auto res = cluster.read("cart:42");
        if (!res) {
            line += "read FAILED";
        } else {
            bool isStale = res->best.version < cluster.latest["cart:42"];
            if (isStale) stale++;
            line += "read " + fmt(res->responders) + " -> " + (res->best.version ? res->best.value : "-") +
                    (isStale ? " STALE" : " fresh");
            if (!res->repaired.empty()) line += ", repaired " + fmt(res->repaired);
        }
        std::cout << line << "\n";
    }
    std::cout << "stale reads: " << stale << "/8\n\n";
}

int main() {
    demo(3, 1, 1, 42);
    demo(3, 2, 2, 42);
}
`,
      javascript: String.raw`// Park-Miller generator: same sequence in every language, so output is deterministic.
class Rng {
  constructor(seed) { this.state = seed; }
  nextInt(bound) {
    this.state = (this.state * 48271) % 2147483647; // fits in a double exactly (< 2^53)
    return this.state % bound;
  }
}

class Replica {
  constructor(id) {
    this.id = id;
    this.up = true;
    this.store = new Map(); // key -> { version, value }
  }
  get(key) { return this.store.get(key) || { version: 0, value: null }; }
}

class QuorumCluster {
  constructor(n, w, r, seed) {
    this.n = n; this.w = w; this.r = r;
    this.replicas = Array.from({ length: n }, (_, i) => new Replica(i));
    this.rng = new Rng(seed);
    this.clock = 0;           // coordinator-assigned versions (real systems: timestamps or vector clocks)
    this.latest = new Map();  // highest acknowledged version, used only to detect stale reads
  }

  rollFailures() {
    for (const rep of this.replicas) rep.up = this.rng.nextInt(10) >= 1; // down 10% of the time
  }

  shuffled() {
    const order = Array.from({ length: this.n }, (_, i) => i);
    for (let i = this.n - 1; i > 0; i--) {
      const j = this.rng.nextInt(i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  write(key, value) {
    this.rollFailures();
    this.clock++;
    const acks = [];
    for (const i of this.shuffled()) {
      if (acks.length === this.w) break; // quorum reached; slower replicas have not got the write yet
      const rep = this.replicas[i];
      if (rep.up) {
        if (rep.get(key).version < this.clock) rep.store.set(key, { version: this.clock, value });
        acks.push(i);
      }
    }
    const ok = acks.length === this.w;
    if (ok) this.latest.set(key, this.clock);
    return { ok, acks };
  }

  read(key) {
    this.rollFailures();
    const responders = this.shuffled().filter((i) => this.replicas[i].up).slice(0, this.r);
    if (responders.length < this.r) return null; // not enough replicas answered
    let best = { version: 0, value: null };
    for (const i of responders) {
      const v = this.replicas[i].get(key);
      if (v.version > best.version) best = v;
    }
    const repaired = responders.filter((i) => this.replicas[i].get(key).version < best.version);
    for (const i of repaired) this.replicas[i].store.set(key, best); // read repair
    return { best, responders, repaired };
  }
}

const fmt = (ids) => "[" + ids.join(",") + "]";

function demo(n, w, r, seed) {
  console.log(\`== N=\${n} W=\${w} R=\${r}  (R+W=\${r + w} \${r + w > n ? ">" : "<="} N) ==\`);
  const cluster = new QuorumCluster(n, w, r, seed);
  let stale = 0;
  for (let k = 1; k <= 8; k++) {
    const val = "v" + k;
    const { ok, acks } = cluster.write("cart:42", val);
    let line = \`round \${k}: write \${val} \${ok ? "acks" : "FAILED acks"}=\${fmt(acks)} | \`;
    const res = cluster.read("cart:42");
    if (res === null) {
      line += "read FAILED";
    } else {
      const isStale = res.best.version < (cluster.latest.get("cart:42") || 0);
      if (isStale) stale++;
      line += \`read \${fmt(res.responders)} -> \${res.best.value || "-"} \${isStale ? "STALE" : "fresh"}\`;
      if (res.repaired.length) line += \`, repaired \${fmt(res.repaired)}\`;
    }
    console.log(line);
  }
  console.log(\`stale reads: \${stale}/8\n\`);
}

demo(3, 1, 1, 42);
demo(3, 2, 2, 42);
`,
      go: String.raw`package main

import (
	"fmt"
	"strings"
)

// Rng is a Park-Miller generator: same sequence in every language, so output is deterministic.
type Rng struct{ state int64 }

func (g *Rng) NextInt(bound int) int {
	g.state = g.state * 48271 % 2147483647
	return int(g.state % int64(bound))
}

type Versioned struct {
	Version int
	Value   string // "" = never written
}

type Replica struct {
	ID    int
	Up    bool
	Store map[string]Versioned
}

func (r *Replica) Get(key string) Versioned { return r.Store[key] } // zero value = version 0

type QuorumCluster struct {
	N, W, R  int
	Replicas []*Replica
	rng      *Rng
	clock    int            // coordinator-assigned versions (real systems: timestamps or vector clocks)
	Latest   map[string]int // highest acknowledged version, used only to detect stale reads
}

func NewCluster(n, w, r int, seed int64) *QuorumCluster {
	c := &QuorumCluster{N: n, W: w, R: r, rng: &Rng{seed}, Latest: map[string]int{}}
	for i := 0; i < n; i++ {
		c.Replicas = append(c.Replicas, &Replica{ID: i, Up: true, Store: map[string]Versioned{}})
	}
	return c
}

func (c *QuorumCluster) rollFailures() {
	for _, rep := range c.Replicas {
		rep.Up = c.rng.NextInt(10) >= 1 // down 10% of the time
	}
}

func (c *QuorumCluster) shuffled() []int {
	order := make([]int, c.N)
	for i := range order {
		order[i] = i
	}
	for i := c.N - 1; i > 0; i-- {
		j := c.rng.NextInt(i + 1)
		order[i], order[j] = order[j], order[i]
	}
	return order
}

func (c *QuorumCluster) Write(key, value string) (bool, []int) {
	c.rollFailures()
	c.clock++
	acks := []int{}
	for _, i := range c.shuffled() {
		if len(acks) == c.W {
			break // quorum reached; slower replicas have not got the write yet
		}
		rep := c.Replicas[i]
		if rep.Up {
			if rep.Get(key).Version < c.clock {
				rep.Store[key] = Versioned{c.clock, value}
			}
			acks = append(acks, i)
		}
	}
	ok := len(acks) == c.W
	if ok {
		c.Latest[key] = c.clock
	}
	return ok, acks
}

// Read returns the newest value among R responders and repairs stale ones. ok=false if too few answered.
func (c *QuorumCluster) Read(key string) (best Versioned, responders, repaired []int, ok bool) {
	c.rollFailures()
	for _, i := range c.shuffled() {
		if c.Replicas[i].Up && len(responders) < c.R {
			responders = append(responders, i)
		}
	}
	if len(responders) < c.R {
		return best, responders, nil, false
	}
	for _, i := range responders {
		if v := c.Replicas[i].Get(key); v.Version > best.Version {
			best = v
		}
	}
	for _, i := range responders {
		if c.Replicas[i].Get(key).Version < best.Version {
			c.Replicas[i].Store[key] = best // read repair
			repaired = append(repaired, i)
		}
	}
	return best, responders, repaired, true
}

func format(ids []int) string {
	parts := make([]string, len(ids))
	for i, id := range ids {
		parts[i] = fmt.Sprint(id)
	}
	return "[" + strings.Join(parts, ",") + "]"
}

func demo(n, w, r int, seed int64) {
	rule := "<="
	if r+w > n {
		rule = ">"
	}
	fmt.Printf("== N=%d W=%d R=%d  (R+W=%d %s N) ==\n", n, w, r, r+w, rule)
	c := NewCluster(n, w, r, seed)
	stale := 0
	for k := 1; k <= 8; k++ {
		val := fmt.Sprintf("v%d", k)
		ok, acks := c.Write("cart:42", val)
		status := "acks"
		if !ok {
			status = "FAILED acks"
		}
		line := fmt.Sprintf("round %d: write %s %s=%s | ", k, val, status, format(acks))
		best, responders, repaired, readOK := c.Read("cart:42")
		if !readOK {
			line += "read FAILED"
		} else {
			value, verdict := best.Value, "fresh"
			if value == "" {
				value = "-"
			}
			if best.Version < c.Latest["cart:42"] {
				verdict = "STALE"
				stale++
			}
			line += fmt.Sprintf("read %s -> %s %s", format(responders), value, verdict)
			if len(repaired) > 0 {
				line += ", repaired " + format(repaired)
			}
		}
		fmt.Println(line)
	}
	fmt.Printf("stale reads: %d/8\n\n", stale)
}

func main() {
	demo(3, 1, 1, 42)
	demo(3, 2, 2, 42)
}
`,
    },
  },
  diagrams: {
    single: String.raw`flowchart LR
      C1[App servers] -->|writes| L[(Leader)]
      L -->|replication log| F1[(Follower 1)]
      L -->|replication log| F2[(Follower 2)]
      L -->|replication log| F3[(Follower 3)]
      C1 -.->|reads| F1
      C1 -.->|reads| F2
      C1 -.->|reads| F3`,
    syncasync: String.raw`sequenceDiagram
      participant C as Client
      participant L as Leader
      participant F1 as Follower 1 (sync)
      participant F2 as Follower 2 (async)
      C->>L: UPDATE orders SET status = 'PAID'
      L->>L: write to local log
      L->>F1: replicate
      L->>F2: replicate
      F1-->>L: ack
      L-->>C: OK (2 copies exist)
      Note over F2: applies a few ms or s later
      F2-->>L: ack`,
    ryw: String.raw`sequenceDiagram
      participant U as User
      participant L as Leader
      participant F as Follower (lagging)
      U->>L: update address = "HSR Layout"
      L-->>U: OK
      U->>F: read address
      F-->>U: "Koramangala" (old!)
      L->>F: replicate update (arrives late)`,
    failover: String.raw`sequenceDiagram
      participant A as Old leader (term 7)
      participant B as Follower B
      participant S as Storage / clients
      A->>S: write (token 7) accepted
      Note over A: network partition or long GC pause
      Note over B: no heartbeat for 10 s, majority elects B
      B->>S: write (token 8) accepted
      Note over A: wakes up, still thinks it leads
      A->>S: write (token 7)
      S-->>A: rejected, token 7 is older than 8`,
    multi: String.raw`flowchart LR
      subgraph M["Region: Mumbai"]
        UM[Users] --> LM[(Leader M)]
      end
      subgraph S["Region: Singapore"]
        US[Users] --> LS[(Leader S)]
      end
      LM <-->|async replication| LS
      LM -.-> CR{"Same row edited in both?"}
      LS -.-> CR
      CR --> RES["Resolve: LWW, merge or CRDT"]`,
    merkle: String.raw`flowchart TB
      R1["Root hash (differs)"] --> H1["H1: keys 0-499 (match)"]
      R1 --> H2["H2: keys 500-999 (differs)"]
      H2 --> H3["keys 500-749 (match)"]
      H2 --> H4["keys 750-999 (differs)"]
      H4 --> SYNC["Stream only keys 750-999"]`,
  },
});
