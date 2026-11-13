SD.register({
  id: "unique-id-service",
  html: String.raw`
<p class="lead">Every order on Flipkart, every payment on Razorpay and every message on WhatsApp needs an ID that no other record will ever share. On one database, <code>AUTO_INCREMENT</code> does the job. Once data is <a href="#/p/sharding">sharded</a> across many machines and written from hundreds of servers, you need a way to mint unique IDs without a single bottleneck. This problem looks small, but it tests whether you can compare several designs on concrete numbers, and whether you know the real-world failure modes: clocks that jump backwards, duplicate machine IDs and a central database that goes down.</p>

<h2>Problem statement</h2>
<p>Design a service (or library) that generates unique IDs for a large distributed system. The IDs are used as primary keys for orders, payments, messages and events across many services and data centres.</p>
<p>Assume a company the size of a large Indian e-commerce or payments platform: <strong>about 500,000 IDs per second at peak</strong> across all callers, spread over two data centres, with any single generator node expected to handle at least <strong>10,000 IDs per second</strong>. IDs must keep working for decades.</p>
<p>The <a href="#/p/unique-ids">Unique IDs</a> topic page explains each scheme in isolation. Here we put them together into a production design: choose an approach, size it, and survive failures.</p>

<div class="callout tip"><strong>Try it first</strong>Spend 15 minutes before reading on. Decide: (1) how many bits you will spend on time, machine and sequence, and how long that lasts, (2) how each generator node gets a machine number that nobody else has, (3) what your node does when the system clock jumps back 200 ms, and (4) a design that needs no clock at all. Then compare with the walkthrough.</div>

<details class="hint"><summary>Hint 1: why not UUID?</summary>
<p>A UUID is 128 bits and (v4) fully random. What does a random primary key do to a B-tree index on every insert? And does it fit in a 64-bit <code>BIGINT</code> column?</p>
</details>
<details class="hint"><summary>Hint 2: split the bits</summary>
<p>If each node puts a unique node number into its IDs, two nodes can never collide, so they never need to talk. What else would you pack into 64 bits so IDs sort roughly by time?</p>
</details>
<details class="hint"><summary>Hint 3: avoid the database on the hot path</summary>
<p>A central counter is simple and needs no clock, but one database call per ID is too slow. What if each node grabbed a thousand IDs at a time? And what if it grabbed the next thousand before running out?</p>
</details>

<h2>Requirements</h2>
<div class="grid-2">
<div class="card">
<h3>Functional</h3>
<ul>
<li><strong>nextId()</strong> returns an ID never returned before, anywhere in the system.</li>
<li><strong>Batch</strong>: <code>nextIds(n)</code> for bulk inserts.</li>
<li>IDs are <strong>64-bit integers</strong> (fit a <code>BIGINT</code> column, cheap to index, JSON-safe as strings).</li>
<li>IDs are <strong>roughly time-sorted</strong>: an ID created later is usually larger, so "latest first" can sort by ID.</li>
<li>Optional: decode an ID into its creation time (handy for debugging).</li>
</ul>
</div>
<div class="card">
<h3>Non-functional</h3>
<ul>
<li><strong>Uniqueness is absolute</strong>: a duplicate order ID is a production incident.</li>
<li><strong>Throughput</strong>: 10K+ IDs/s per node, 500K/s total at peak.</li>
<li><strong>Latency</strong>: under 1 ms in-process; a few ms if served over the network.</li>
<li><strong>No coordination on the hot path</strong>: generating one ID must not need a network call to another node.</li>
<li><strong>Highly available</strong>: if ID generation stops, every write in the company stops. Target 99.999%.</li>
<li>Nice to have: not trivially guessable (competitors should not count your daily orders).</li>
</ul>
</div>
</div>

<div class="callout interview"><strong>Say this in the interview</strong>"Let me confirm the shape of the ID. I am assuming 64-bit integers so they fit a BIGINT primary key, roughly sorted by time so recent rows cluster together in the index, and generated without a network round trip per ID. Strictly increasing order across the whole system is not required, right? Only uniqueness is absolute. That rules out a single counter and points to either Snowflake-style IDs or segment allocation."</div>

<h2>Capacity estimation</h2>
<table>
<thead><tr><th>Quantity</th><th>Arithmetic</th><th>Result</th></tr></thead>
<tbody>
<tr><td>Peak load</td><td>given</td><td><strong>500K IDs/s</strong></td></tr>
<tr><td>How long 63 bits last</td><td>2<sup>63</sup> ≈ 9.2 × 10<sup>18</sup> ÷ 500K/s ≈ 1.8 × 10<sup>13</sup> s</td><td>~585,000 years: space is never the problem</td></tr>
<tr><td>Snowflake time range</td><td>2<sup>41</sup> ms ≈ 2.2 × 10<sup>12</sup> ms ÷ 3.15 × 10<sup>10</sup> ms/yr</td><td><strong>~69.7 years</strong> from the custom epoch</td></tr>
<tr><td>Snowflake per-node ceiling</td><td>12 sequence bits = 4,096 per ms × 1,000</td><td><strong>~4.1M IDs/s per node</strong></td></tr>
<tr><td>Snowflake nodes possible</td><td>10 machine bits</td><td><strong>1,024 generators</strong></td></tr>
<tr><td>Segment mode, step 1,000</td><td>50K IDs/s per node ÷ 1,000 per segment</td><td>50 DB calls/s per node; 20 nodes = <strong>1,000 updates/s on one row</strong> (too hot)</td></tr>
<tr><td>Segment mode, step 1,000,000</td><td>1M ÷ 50K/s</td><td>one DB call every <strong>20 s</strong> per node</td></tr>
<tr><td>IDs lost per crash (segment)</td><td>at most one current + one prefetched segment</td><td>≤ 2M IDs: harmless against 2<sup>63</sup></td></tr>
</tbody>
</table>
<p>Two lessons from the numbers. First, <mark>the ID space is effectively infinite, so wasting IDs is fine</mark>; that frees us to hand out big blocks. Second, the segment size is a real design knob: too small and the central row becomes a hot spot, too large and a restart wastes more IDs and IDs from different nodes interleave less by time.</p>

<h2>API design</h2>
<p>Two delivery options (discussed in Deep dive 4): an in-process library, or a small network service. The service API:</p>
<pre><code>GET /v1/ids?type=order&amp;count=100
200 OK
{ "ids": ["1859371930224697344", "1859371930224697345", ...] }   // strings: JS loses precision above 2^53
503 Service Unavailable   node has no valid machine id or its clock went backwards

GET /v1/ids/1859371930224697344/decode          (debugging only)
{ "timestamp": "2026-11-12T10:15:02.114Z", "datacenter": 1, "worker": 7, "sequence": 0 }</code></pre>
<ul>
<li>Use gRPC internally; latency matters and callers batch.</li>
<li><code>type</code> (Leaf calls it <code>biz_tag</code>) lets segment mode keep a separate counter per business type, so order IDs and coupon IDs grow independently.</li>
<li>Always send 64-bit IDs to browsers as <strong>strings</strong>. JavaScript numbers are doubles and silently round anything above 2<sup>53</sup>; Twitter's API returns <code>id_str</code> for exactly this reason.</li>
</ul>

<h2>Data model</h2>
<p>Snowflake mode needs almost no storage, only a registry of machine IDs. Segment mode needs one tiny table.</p>
<pre><code>id_segments  (MySQL / Postgres, primary + synchronous replica)
  biz_tag      VARCHAR(64) PRIMARY KEY   -- "order", "payment", "coupon"
  max_id       BIGINT       NOT NULL     -- highest ID already handed out
  step         INT          NOT NULL     -- segment size, e.g. 1,000,000
  updated_at   TIMESTAMP

-- leasing one segment = one short transaction
UPDATE id_segments SET max_id = max_id + step WHERE biz_tag = 'order';
SELECT max_id, step FROM id_segments WHERE biz_tag = 'order';
-- this node now owns (max_id - step, max_id]

worker registry  (etcd or ZooKeeper)
  /idgen/workers/{workerId}  -&gt; { host, dc, lastTimestampMs }   bound to a lease (TTL 10 s)</code></pre>

<h2>High-level design</h2>
<h3>Choosing an approach</h3>
<p>Know the options well enough to compare them in one table. The details of each are on the <a href="#/p/unique-ids">Unique IDs</a> page.</p>
<div class="tabs">
<section data-tab="UUID v4 / v7">
<p>Generate 128 bits locally. v4 is 122 random bits; v7 (standardised in RFC 9562, 2024) puts a 48-bit millisecond timestamp first, then random bits, so it sorts by time.</p>
<ul>
<li><strong>Good</strong>: zero coordination, zero infrastructure, works offline on a phone.</li>
<li><strong>Bad</strong>: 128 bits, not 64. Double the index size on every table and every foreign key.</li>
<li><strong>Bad (v4 only)</strong>: random keys scatter inserts across a B-tree, causing page splits and cache misses. v7 fixes this.</li>
<li>Pick when 128 bits is acceptable: idempotency keys, trace IDs, client-generated IDs.</li>
</ul>
</section>
<section data-tab="DB auto-increment">
<p>Use the database counter. To remove the single point of failure, run k databases with <code>auto_increment_increment = k</code> and different offsets: with two servers one hands out odd numbers, the other even.</p>
<ul>
<li><strong>Good</strong>: simple, compact, strictly increasing per server.</li>
<li><strong>Bad</strong>: a database write per ID (a few thousand per second per server at best).</li>
<li><strong>Bad</strong>: adding a third server means changing the step on all of them carefully.</li>
</ul>
</section>
<section data-tab="Ticket server">
<p>Flickr's design: two dedicated MySQL servers whose only job is a counter, with odd/even offsets. Each call does <code>REPLACE INTO Tickets64 (stub) VALUES ('a')</code> then <code>SELECT LAST_INSERT_ID()</code>.</p>
<ul>
<li><strong>Good</strong>: separates ID generation from the business databases.</li>
<li><strong>Bad</strong>: still one network round trip and one write per ID; the two servers drift apart, so IDs are not ordered across them.</li>
</ul>
</section>
<section data-tab="Snowflake">
<p>Twitter's layout: 1 unused sign bit, <strong>41 bits</strong> of milliseconds since a custom epoch, <strong>10 bits</strong> of machine ID, <strong>12 bits</strong> of per-millisecond sequence.</p>
<ul>
<li><strong>Good</strong>: no network call per ID, ~4M IDs/s per node, time-sorted, 64 bits.</li>
<li><strong>Bad</strong>: needs a unique machine ID per node (Deep dive 1) and trusts the clock (Deep dive 2).</li>
<li><strong>Bad</strong>: leaks creation time and a rough volume signal.</li>
</ul>
</section>
<section data-tab="Segment (Leaf)">
<p>Meituan's Leaf "segment" mode: a central table stores <code>max_id</code>; each node leases a block of IDs with one <code>UPDATE</code> and hands them out from memory. A background thread fetches the next block before the current one runs out (double buffering).</p>
<ul>
<li><strong>Good</strong>: no clock dependence at all; IDs are dense and increase per node; database load is one call per block.</li>
<li><strong>Good</strong>: survives a database outage for as long as the buffered blocks last.</li>
<li><strong>Bad</strong>: only roughly time-sorted across nodes (node A may be handing out block 5 while B is on block 6); sequential numbers reveal volume (daily order count = difference of two IDs).</li>
</ul>
</section>
<section data-tab="Instagram">
<p>Generate IDs inside Postgres. Instagram split data into thousands of logical shards, each a Postgres schema with its own sequence. A PL/pgSQL function builds: <strong>41 bits</strong> time | <strong>13 bits</strong> logical shard ID | <strong>10 bits</strong> of <code>nextval(seq) % 1024</code>.</p>
<ul>
<li><strong>Good</strong>: no extra service; the shard is encoded in the ID, so you can route a lookup by ID alone.</li>
<li><strong>Bad</strong>: tied to the database; 1,024 IDs per shard per ms.</li>
</ul>
</section>
</div>

<table>
<thead><tr><th>Approach</th><th>Size</th><th>Time-sorted</th><th>Hot-path coordination</th><th>Throughput per node</th><th>Main risk</th></tr></thead>
<tbody>
<tr><td>UUID v4</td><td>128 bit</td><td>No</td><td>None</td><td>Millions/s</td><td>Index bloat, random inserts</td></tr>
<tr><td>UUID v7</td><td>128 bit</td><td>Yes (ms)</td><td>None</td><td>Millions/s</td><td>128 bits</td></tr>
<tr><td>DB auto-increment with step</td><td>64 bit</td><td>Per server</td><td>DB write per ID</td><td>~thousands/s</td><td>DB is the bottleneck</td></tr>
<tr><td>Ticket server</td><td>64 bit</td><td>Per server</td><td>Network + write per ID</td><td>~thousands/s</td><td>Ticket DB outage</td></tr>
<tr><td>Snowflake</td><td>64 bit</td><td>Yes (ms)</td><td>None</td><td>~4M/s</td><td>Clock going backwards, duplicate worker ID</td></tr>
<tr><td>Segment (Leaf)</td><td>64 bit</td><td>Roughly</td><td>One DB call per block</td><td>Millions/s</td><td>DB outage longer than the buffer</td></tr>
<tr><td>Instagram (in Postgres)</td><td>64 bit</td><td>Yes (ms)</td><td>Inside the insert</td><td>1,024 per ms per shard</td><td>Tied to DB</td></tr>
</tbody>
</table>
<div class="callout interview"><strong>Say this in the interview</strong>"I will offer two modes in one service. Snowflake is the default because it is time-sorted and needs no network call per ID; the cost is that I must manage machine IDs and clock skew carefully. Segment mode is the fallback for teams that want dense, clock-independent IDs; it calls a central database only once per block, and with double buffering a short database outage is invisible. UUID v7 is fine wherever 128 bits is acceptable."</div>

<p>Try the Snowflake layout below: change the bit split and see how the time range, machine count and per-millisecond capacity trade against each other.</p>
<div data-widget="snowflake"></div>

<h3>Architecture</h3>
<div data-diagram="arch" data-caption="ID service nodes hold leases in etcd for their worker IDs and lease ID blocks from a small MySQL table"></div>
<ol class="steps">
<li><strong>Callers</strong> (order service, payment service) use a client library that asks the ID service for a batch over gRPC and buffers it locally.</li>
<li><strong>ID service nodes</strong> are stateless apart from in-memory buffers. Each runs a Snowflake generator and a segment allocator per <code>biz_tag</code>.</li>
<li><strong>etcd / ZooKeeper</strong> assigns each node a unique worker ID through a lease, and stores its last-seen timestamp. It is used at startup and for heartbeats, never per ID.</li>
<li><strong>Segment database</strong>: one row per <code>biz_tag</code>, on a primary with a synchronous replica. Touched once per block per node.</li>
<li><strong>Monitoring</strong>: alert on clock offset, on segment buffer below threshold, and on lease renewal failures.</li>
</ol>

<h2>Deep dive 1: assigning machine IDs</h2>
<p>Snowflake is only unique if no two live nodes share a worker ID. Hard-coding IDs in config works for ten servers and fails the day someone clones a VM or Kubernetes reschedules a pod. Options, in order of robustness:</p>
<ul>
<li><strong>Static config or IP-derived</strong> (last bits of the IP address): simple, but two pods can reuse an IP or collide after masking. Avoid.</li>
<li><strong>Kubernetes StatefulSet ordinal</strong> (<code>idgen-0</code>, <code>idgen-1</code>, ...): unique and stable within one cluster; combine with a datacenter ID for multiple clusters.</li>
<li><strong>Lease from etcd or ZooKeeper</strong>: the node scans for a free slot and atomically creates <code>/idgen/workers/7</code> bound to a lease with a 10 s TTL (in ZooKeeper, an ephemeral node). It renews the lease every few seconds. If the node dies, the lease expires and the slot frees up.</li>
</ul>
<div data-diagram="lease" data-caption="Worker ID lease: claim a free slot atomically, keep it alive, and stop serving the moment the lease is in doubt"></div>
<p>The subtle part is a node that is paused (a long GC, a frozen VM) while its lease expires. Another node takes worker ID 7, then the paused node wakes up and keeps issuing IDs with ID 7: duplicates. Defences:</p>
<ol class="steps">
<li>Each node stops issuing IDs as soon as it cannot confirm its lease is still valid (local deadline = last successful renewal + TTL − safety margin).</li>
<li>A new owner waits at least one TTL plus maximum clock skew before using a slot that was just freed, and starts at a timestamp later than the <code>lastTimestampMs</code> the previous owner stored.</li>
<li>Meituan's Leaf-snowflake uses persistent sequential ZooKeeper nodes and caches its worker ID on local disk, so a ZooKeeper outage does not stop a restart.</li>
</ol>

<h2>Deep dive 2: clocks and sequence exhaustion</h2>
<h3>When the clock goes backwards</h3>
<p>Servers sync time with NTP. Usually NTP <em>slews</em> (runs the clock slightly faster or slower) but it can also <em>step</em> the clock, jumping it backwards by hundreds of milliseconds. A Snowflake node that reused a millisecond it already used could repeat (timestamp, sequence) pairs: duplicates.</p>
<div data-diagram="clock" data-caption="Clock check on every ID: equal ms uses the sequence, small backward jumps wait, big ones fail loudly"></div>
<ul>
<li><strong>Remember <code>lastTimestamp</code></strong> and compare on every call. If now &lt; last by a few milliseconds, wait it out. If by more (say &gt; 10 ms), refuse to issue IDs, return 503, alert, and let the load balancer route around this node.</li>
<li><strong>Startup check</strong>: persist <code>lastTimestamp</code> to etcd every few seconds. On restart, refuse to start until the local clock is past it. Leaf-snowflake also compares its clock with the average of other nodes' clocks before serving.</li>
<li><strong>Use a monotonic clock</strong> after startup: timestamp = wall clock at startup + elapsed monotonic time. NTP steps then cannot move it backwards (it may drift a little, which is fine for "roughly sorted").</li>
<li><strong>Leap seconds</strong>: use leap smearing (Google and AWS time services spread the extra second over hours) so the clock never repeats a second.</li>
</ul>

<h3>When the sequence runs out</h3>
<p>12 bits give 4,096 IDs per millisecond per node. That is 4M/s, far beyond our 10K/s target, but a bulk import can still burst past it.</p>
<ul>
<li><strong>Spin until the next millisecond</strong>: the standard answer. Costs at most 1 ms.</li>
<li><strong>Borrow from the future</strong>: keep issuing with timestamp + 1 and let real time catch up (Baidu's UidGenerator does something like this with a ring buffer of pre-generated IDs). Works if bursts are short.</li>
<li><strong>Re-split the bits</strong>: fewer machine bits, more sequence bits, if you run few nodes.</li>
<li><strong>Low traffic gotcha</strong>: if the sequence restarts at 0 every millisecond, quiet nodes produce IDs that end in 0 most of the time, so <code>id % 16</code> sharding puts almost everything on shard 0. Start each millisecond at a small random sequence value, or shard on a hash of the ID.</li>
</ul>

<h2>Deep dive 3: segment allocation with double buffering</h2>
<p>Segment mode removes the clock from the picture entirely. Each node keeps two buffers:</p>
<ol class="steps">
<li><strong>Startup</strong>: lease one segment with the <code>UPDATE ... SET max_id = max_id + step</code> transaction. That node now owns, say, IDs 1 to 1,000.</li>
<li><strong>Hot path</strong>: hand out the next number from memory under a lock (or an atomic counter). No I/O.</li>
<li><strong>Prefetch</strong>: when 20% of the current segment remains, a background thread leases the next segment into the second buffer.</li>
<li><strong>Swap</strong>: when the current segment runs out, switch to the second buffer instantly. Callers only wait if a burst burns through both buffers before the database replies.</li>
</ol>
<div data-diagram="segment" data-caption="Double buffering: the next segment arrives in the background, long before the current one runs out"></div>
<ul>
<li><strong>Sizing the step</strong>: aim for a segment to last minutes, not milliseconds. Leaf adjusts the step dynamically so one segment lasts about 15 minutes; when traffic doubles, the next step doubles. Long segments also mean a MySQL failover (30 s or so) passes unnoticed.</li>
<li><strong>Why prefetch early</strong>: the database call takes 2 ms on a good day and seconds during a failover. The remaining 20% is the runway that hides that latency.</li>
<li><strong>Crash</strong>: unused IDs in both buffers are lost. Fine: we showed the ID space is effectively infinite. Never try to "give them back"; that path is where duplicates come from.</li>
<li><strong>Database HA</strong>: the <code>UPDATE</code> must be durable before IDs are used, so run the segment DB with a synchronous replica (or on a consensus store). If an asynchronous replica were promoted after losing the last update, two nodes would get the same block.</li>
</ul>
<p>The code below implements the allocator: a simulated central counter, segments of 1,000 IDs, background prefetch at 20% remaining, and a lock plus condition variable so many threads can call <code>nextId</code> safely. The demo is deterministic: node A gets 1 to 2,500 using three database calls, node B starts at 3,001 because it leased the next block, and 8 concurrent workers draw 8,000 IDs with no duplicates.</p>
<div data-code="allocator"></div>

<h2>Deep dive 4: multiple data centres, and service vs library</h2>
<h3>Multiple data centres</h3>
<ul>
<li><strong>Snowflake</strong>: split the 10 machine bits into 5 bits of datacenter ID and 5 bits of worker ID (Twitter's original layout: 32 DCs × 32 workers). Each DC has its own etcd for worker leases. No cross-DC traffic at all.</li>
<li><strong>Segment mode</strong>: a single global <code>id_segments</code> row would need cross-DC writes. Instead give each DC its own row and disjoint space: DC 1 uses odd segment numbers and DC 2 even ones, or put the DC ID in the top bits.</li>
<li>Cross-DC ordering is only as good as the clocks between DCs (a few ms with NTP). "Roughly sorted" is the honest promise.</li>
<li>Never need a cross-DC call to make an ID; a DC cut off from the other must keep taking orders.</li>
</ul>

<h3>Service or library?</h3>
<table>
<thead><tr><th></th><th>Library inside each app process</th><th>Central ID service</th></tr></thead>
<tbody>
<tr><td>Latency</td><td>Nanoseconds</td><td>~1 ms network hop (batch to hide it)</td></tr>
<tr><td>Availability</td><td>No extra dependency</td><td>One more service that must be up (5 nines)</td></tr>
<tr><td>Worker IDs</td><td>One per process: 3,000 pods across 50 services blow past 1,024</td><td>Only the ID nodes need worker IDs (say 20)</td></tr>
<tr><td>Clock risk</td><td>Every app host's clock matters</td><td>Only a few, well-monitored hosts</td></tr>
<tr><td>Upgrades</td><td>Redeploy every service</td><td>Deploy one service</td></tr>
</tbody>
</table>
<p>A common middle ground: a central service that hands out <strong>batches</strong> (100 IDs or a small segment) to a thin client library, which buffers them. Callers get in-process latency for most IDs and only a few hosts need worker IDs and tight clocks.</p>
<div class="callout interview"><strong>Say this in the interview</strong>"I would run it as a small service with a smart client. The client fetches IDs in batches and buffers them, so the network hop is paid once every hundred IDs. That keeps worker IDs and clock discipline confined to about twenty well-monitored hosts instead of thousands of application pods, and lets me change the ID scheme without redeploying every team's code."</div>

<h2>Scaling and bottlenecks</h2>
<table>
<thead><tr><th>Bottleneck or failure</th><th>Fix</th></tr></thead>
<tbody>
<tr><td>Segment DB row is hot</td><td>Bigger step, dynamic step sizing, one row per <code>biz_tag</code>, batch fetches from clients.</td></tr>
<tr><td>Segment DB down</td><td>Double buffering rides out minutes; synchronous replica for failover; alert when buffers drop below a threshold.</td></tr>
<tr><td>etcd / ZooKeeper down</td><td>Running nodes keep their worker IDs until their lease deadline; new nodes cannot start. Run etcd as a 3- or 5-node cluster.</td></tr>
<tr><td>Clock jump on one node</td><td>Node refuses to serve and fails health checks; clients retry another node.</td></tr>
<tr><td>Need more than 1,024 Snowflake workers</td><td>Use the service model so only ID nodes need workers, or re-split bits.</td></tr>
<tr><td>IDs reveal business volume</td><td>Expose a different public ID (encrypted or a random token) and keep the sequential ID internal.</td></tr>
<tr><td>Time range ends (69 years after epoch)</td><td>Choose a recent custom epoch (the day you launch), not 1970.</td></tr>
</tbody>
</table>

<h2>Trade-offs</h2>
<div class="grid-2">
<div class="card good"><strong>Snowflake mode</strong>
<ul>
<li>Time-sorted, decodable, no per-ID I/O, ~4M/s per node.</li>
<li>Depends on clocks and on unique worker IDs.</li>
<li>Reveals creation time.</li>
</ul>
</div>
<div class="card good"><strong>Segment mode</strong>
<ul>
<li>No clock dependence, dense numbers, trivial to reason about.</li>
<li>Depends on a central DB (but only once per block).</li>
<li>Only roughly ordered across nodes; reveals volume.</li>
</ul>
</div>
</div>
<div class="grid-2">
<div class="card bad"><strong>What we gave up overall</strong>
<ul>
<li>Strict global ordering: impossible without a central sequencer, and not needed.</li>
<li>Gap-free IDs: crashes and restarts leave holes. Never use IDs as invoice numbers that must be contiguous.</li>
</ul>
</div>
<div class="card"><strong>When to skip all this</strong>
<ul>
<li>A single Postgres database: just use a sequence or <code>BIGSERIAL</code>.</li>
<li>128 bits acceptable: UUID v7, no service at all.</li>
</ul>
</div>
</div>

<h2>Follow-up questions</h2>
<div class="quiz">
<details><summary>A Snowflake node's clock jumps back by 2 seconds after an NTP correction. What happens in your design?</summary><div>The generator sees now &lt; lastTimestamp by 2,000 ms, which is above the wait threshold. It stops issuing IDs, returns 503, fails its health check and raises an alert. Clients retry on another node. When its clock passes lastTimestamp again (or after an operator checks NTP), it rejoins. Using a monotonic clock after startup avoids most such jumps in the first place.</div></details>
<details><summary>Why do we lose IDs in segment mode, and is that a problem?</summary><div>When a node crashes, the unused part of its current and prefetched segments is never handed out. With 2<sup>63</sup> IDs this is harmless. It only matters if the business needs gap-free numbers (legal invoice series), which should come from a separate, transactional counter, not the ID service.</div></details>
<details><summary>Two pods both believe they are worker 7. How could that happen, and how do you prevent it?</summary><div>A pod paused (GC, VM freeze) past its lease TTL while another pod claimed worker 7. Prevent it by having each node stop issuing IDs when it cannot confirm its lease before its local deadline, by making the new owner wait TTL plus maximum clock skew, and by fencing on lastTimestamp stored in etcd.</div></details>
<details><summary>How do you pick the segment size?</summary><div>Make a segment last minutes of peak traffic: at 50K IDs/s per node, 1M IDs is 20 s, so 10M or a dynamic step is better. Larger steps mean fewer DB calls and more tolerance to DB outages, at the cost of more IDs lost per crash and weaker time ordering across nodes.</div></details>
<details><summary>Can you use the Snowflake ID to shard data? Any pitfall?</summary><div>Yes, but not with <code>id % n</code> on raw IDs if the sequence often restarts at 0: low-traffic periods make most IDs share low bits and skew the shards. Hash the ID first, or randomise the starting sequence each millisecond. Instagram-style IDs instead embed the shard number in the ID.</div></details>
<details><summary>When would you choose UUID v7 instead of building this service?</summary><div>When 128-bit keys are acceptable (most new systems, especially with Postgres's native uuid type) and you do not want to run any extra infrastructure. v7 is time-ordered, so it avoids the B-tree problems of v4. You lose compactness and decodable machine IDs.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2>
<ul>
<li>Requirements first: 64-bit, roughly time-sorted, no coordination per ID, highly available. Uniqueness is absolute; ordering is approximate.</li>
<li>Snowflake (41 time + 10 machine + 12 sequence bits) gives ~4M IDs/s per node for ~69 years; its risks are clocks and duplicate worker IDs.</li>
<li>Assign worker IDs with leases (etcd/ZooKeeper) and stop serving when the lease is in doubt.</li>
<li>Handle clocks explicitly: compare with lastTimestamp, wait on small jumps, fail loudly on large ones, prefer a monotonic clock.</li>
<li>Segment allocation (Leaf) avoids clocks: lease big blocks from a DB row and prefetch the next block early (double buffering).</li>
<li>Wasted IDs are fine; duplicate IDs are not. Run it as a small service with batching clients.</li>
</ul>
</div>
`,
  code: {
    allocator: {
      title: "Segment ID allocator with double buffering (thread-safe)",
      java: String.raw`import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

/** Simulates the central table: UPDATE id_alloc SET max_id = max_id + step WHERE biz_tag = ?. */
final class CentralCounter {
    private long maxId = 0;
    private int calls = 0;

    /** Returns the half-open range [start, end). Atomic, like one DB transaction. */
    synchronized long[] nextRange(int step) {
        try { Thread.sleep(2); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        long start = maxId + 1;
        maxId += step;
        calls++;
        return new long[] {start, maxId + 1};
    }

    synchronized int calls() { return calls; }
}

/** Hands out IDs from an in-memory segment; prefetches the next one in the background. */
final class IdAllocator {
    private static final class Segment {
        long next;
        final long end; // exclusive
        Segment(long[] r) { next = r[0]; end = r[1]; }
    }

    private final CentralCounter db;
    private final int step;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition ready = lock.newCondition();
    private final ExecutorService loader = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "segment-loader");
        t.setDaemon(true);
        return t;
    });
    private Segment current;
    private Segment next;          // the second buffer
    private boolean loading;

    IdAllocator(CentralCounter db, int step) {
        this.db = db;
        this.step = step;
        this.current = new Segment(db.nextRange(step)); // first segment is fetched synchronously
    }

    long nextId() throws InterruptedException {
        lock.lock();
        try {
            while (true) {
                if (current.next < current.end) {
                    long id = current.next++;
                    // 20% left and no spare buffer yet: fetch the next segment in the background.
                    if (next == null && !loading && current.end - current.next <= step / 5) startPrefetch();
                    return id;
                }
                if (next != null) {        // swap buffers: no DB call on the hot path
                    current = next;
                    next = null;
                    continue;
                }
                if (!loading) startPrefetch(); // burst used both buffers: wait for the DB
                ready.await();
            }
        } finally {
            lock.unlock();
        }
    }

    private void startPrefetch() {
        loading = true;
        loader.submit(() -> {
            Segment s = null;
            try {
                s = new Segment(db.nextRange(step)); // slow DB call, outside our lock
            } finally {
                lock.lock();
                try {
                    if (s != null) next = s;
                    loading = false;
                    ready.signalAll();
                } finally {
                    lock.unlock();
                }
            }
        });
    }
}

public class Main {
    public static void main(String[] args) throws Exception {
        CentralCounter db = new CentralCounter();
        IdAllocator nodeA = new IdAllocator(db, 1000);

        System.out.println("node A first ids: " + nodeA.nextId() + " " + nodeA.nextId() + " " + nodeA.nextId());
        long last = 0;
        for (int i = 4; i <= 2500; i++) {
            last = nodeA.nextId();
            if (i == 1000 || i == 1001) System.out.println("node A id #" + i + " = " + last);
        }
        System.out.println("node A id #2500 = " + last + ", DB calls so far = " + db.calls());

        IdAllocator nodeB = new IdAllocator(db, 1000);
        System.out.println("node B first id = " + nodeB.nextId() + " (its own segment)");

        Set<Long> seen = ConcurrentHashMap.newKeySet();
        Thread[] workers = new Thread[8];
        for (int t = 0; t < workers.length; t++) {
            workers[t] = new Thread(() -> {
                try {
                    for (int i = 0; i < 1000; i++) seen.add(nodeA.nextId());
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            });
            workers[t].start();
        }
        for (Thread w : workers) w.join();
        System.out.println("8 workers x 1000 ids on node A: " + seen.size() + " unique");
    }
}`,
      python: String.raw`import threading
import time


class CentralCounter:
    """Simulates: UPDATE id_alloc SET max_id = max_id + step WHERE biz_tag = ?"""

    def __init__(self):
        self._max_id = 0
        self._calls = 0
        self._lock = threading.Lock()

    def next_range(self, step):
        """Return the half-open range (start, end). Atomic, like one DB transaction."""
        with self._lock:
            time.sleep(0.002)  # network + disk round trip
            start = self._max_id + 1
            self._max_id += step
            self._calls += 1
            return start, self._max_id + 1

    @property
    def calls(self):
        with self._lock:
            return self._calls


class IdAllocator:
    """Hands out IDs from an in-memory segment; prefetches the next one in the background."""

    def __init__(self, db, step):
        self._db = db
        self._step = step
        self._cond = threading.Condition()
        self._cur, self._end = db.next_range(step)  # first segment fetched synchronously
        self._spare = None                          # the second buffer: (start, end)
        self._loading = False

    def next_id(self):
        with self._cond:
            while True:
                if self._cur < self._end:
                    id_ = self._cur
                    self._cur += 1
                    # 20% left and no spare buffer yet: fetch the next segment in the background.
                    if (self._spare is None and not self._loading
                            and self._end - self._cur <= self._step // 5):
                        self._start_prefetch()
                    return id_
                if self._spare is not None:  # swap buffers: no DB call on the hot path
                    self._cur, self._end = self._spare
                    self._spare = None
                    continue
                if not self._loading:        # burst used both buffers: wait for the DB
                    self._start_prefetch()
                self._cond.wait()

    def _start_prefetch(self):
        self._loading = True
        threading.Thread(target=self._prefetch, daemon=True).start()

    def _prefetch(self):
        seg = None
        try:
            seg = self._db.next_range(self._step)  # slow DB call, outside our lock
        finally:
            with self._cond:
                if seg is not None:
                    self._spare = seg
                self._loading = False
                self._cond.notify_all()


if __name__ == "__main__":
    db = CentralCounter()
    node_a = IdAllocator(db, 1000)

    print("node A first ids:", node_a.next_id(), node_a.next_id(), node_a.next_id())
    last = 0
    for i in range(4, 2501):
        last = node_a.next_id()
        if i in (1000, 1001):
            print(f"node A id #{i} = {last}")
    print(f"node A id #2500 = {last}, DB calls so far = {db.calls}")

    node_b = IdAllocator(db, 1000)
    print(f"node B first id = {node_b.next_id()} (its own segment)")

    seen = set()
    seen_lock = threading.Lock()

    def worker():
        for _ in range(1000):
            id_ = node_a.next_id()
            with seen_lock:
                seen.add(id_)

    workers = [threading.Thread(target=worker) for _ in range(8)]
    for w in workers:
        w.start()
    for w in workers:
        w.join()
    print(f"8 workers x 1000 ids on node A: {len(seen)} unique")`,
      cpp: String.raw`#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <iostream>
#include <mutex>
#include <optional>
#include <set>
#include <thread>
#include <utility>
#include <vector>

// Simulates: UPDATE id_alloc SET max_id = max_id + step WHERE biz_tag = ?
class CentralCounter {
    std::mutex mu_;
    int64_t maxId_ = 0;
    int calls_ = 0;

public:
    // Returns the half-open range [start, end). Atomic, like one DB transaction.
    std::pair<int64_t, int64_t> nextRange(int step) {
        std::lock_guard<std::mutex> g(mu_);
        std::this_thread::sleep_for(std::chrono::milliseconds(2));  // round trip
        int64_t start = maxId_ + 1;
        maxId_ += step;
        calls_++;
        return {start, maxId_ + 1};
    }
    int calls() {
        std::lock_guard<std::mutex> g(mu_);
        return calls_;
    }
};

// Hands out IDs from an in-memory segment; prefetches the next one in the background.
class IdAllocator {
    CentralCounter& db_;
    const int step_;
    std::mutex mu_;
    std::condition_variable ready_;
    int64_t cur_, end_;                                // current segment [cur_, end_)
    std::optional<std::pair<int64_t, int64_t>> spare_; // the second buffer
    bool loading_ = false;
    std::thread loader_;

    void startPrefetch() {  // caller holds mu_
        loading_ = true;
        // The previous loader already cleared loading_ and released mu_, so it has
        // finished its work; join just reaps the thread.
        if (loader_.joinable()) loader_.join();
        loader_ = std::thread([this] {
            auto seg = db_.nextRange(step_);  // slow DB call, outside our lock
            std::lock_guard<std::mutex> g(mu_);
            spare_ = seg;
            loading_ = false;
            ready_.notify_all();
        });
    }

public:
    IdAllocator(CentralCounter& db, int step) : db_(db), step_(step) {
        auto r = db_.nextRange(step_);  // first segment fetched synchronously
        cur_ = r.first;
        end_ = r.second;
    }
    IdAllocator(const IdAllocator&) = delete;
    IdAllocator& operator=(const IdAllocator&) = delete;
    ~IdAllocator() {
        if (loader_.joinable()) loader_.join();
    }

    int64_t nextId() {
        std::unique_lock<std::mutex> lk(mu_);
        while (true) {
            if (cur_ < end_) {
                int64_t id = cur_++;
                // 20% left and no spare buffer yet: fetch the next segment in the background.
                if (!spare_ && !loading_ && end_ - cur_ <= step_ / 5) startPrefetch();
                return id;
            }
            if (spare_) {  // swap buffers: no DB call on the hot path
                cur_ = spare_->first;
                end_ = spare_->second;
                spare_.reset();
                continue;
            }
            if (!loading_) startPrefetch();  // burst used both buffers: wait for the DB
            ready_.wait(lk);
        }
    }
};

int main() {
    CentralCounter db;
    IdAllocator nodeA(db, 1000);

    int64_t a = nodeA.nextId(), b = nodeA.nextId(), c = nodeA.nextId();
    std::cout << "node A first ids: " << a << " " << b << " " << c << "\n";
    int64_t last = 0;
    for (int i = 4; i <= 2500; i++) {
        last = nodeA.nextId();
        if (i == 1000 || i == 1001) std::cout << "node A id #" << i << " = " << last << "\n";
    }
    std::cout << "node A id #2500 = " << last << ", DB calls so far = " << db.calls() << "\n";

    IdAllocator nodeB(db, 1000);
    std::cout << "node B first id = " << nodeB.nextId() << " (its own segment)\n";

    std::set<int64_t> seen;
    std::mutex seenMu;
    std::vector<std::thread> workers;
    for (int t = 0; t < 8; t++) {
        workers.emplace_back([&] {
            for (int i = 0; i < 1000; i++) {
                int64_t id = nodeA.nextId();
                std::lock_guard<std::mutex> g(seenMu);
                seen.insert(id);
            }
        });
    }
    for (auto& w : workers) w.join();
    std::cout << "8 workers x 1000 ids on node A: " << seen.size() << " unique\n";
}`,
      javascript: String.raw`// Simulates: UPDATE id_alloc SET max_id = max_id + step WHERE biz_tag = ?
class CentralCounter {
  constructor() {
    this.maxId = 0;
    this.calls = 0;
  }

  // Resolves to the half-open range [start, end). The read-modify-write runs
  // after the await with no await inside it, so it is atomic on the event loop.
  async nextRange(step) {
    await new Promise((r) => setTimeout(r, 2)); // network + disk round trip
    const start = this.maxId + 1;
    this.maxId += step;
    this.calls++;
    return { next: start, end: this.maxId + 1 };
  }
}

// Hands out IDs from an in-memory segment; prefetches the next one in the background.
// Node runs our code on one thread, so "thread-safe" here means: many concurrent
// async callers never get the same ID and never start two prefetches at once.
class IdAllocator {
  static async create(db, step) {
    const a = new IdAllocator(db, step);
    a.current = await db.nextRange(step); // first segment fetched up front
    return a;
  }

  constructor(db, step) {
    this.db = db;
    this.step = step;
    this.current = null;
    this.spare = null;     // the second buffer
    this.loading = null;   // pending prefetch promise, or null
  }

  async nextId() {
    for (;;) {
      const c = this.current;
      if (c.next < c.end) {
        const id = c.next++;
        // 20% left and no spare buffer yet: fetch the next segment in the background.
        if (!this.spare && !this.loading && c.end - c.next <= this.step / 5) this.startPrefetch();
        return id;
      }
      if (this.spare) {          // swap buffers: no DB call on the hot path
        this.current = this.spare;
        this.spare = null;
        continue;
      }
      if (!this.loading) this.startPrefetch(); // burst used both buffers: wait for the DB
      await this.loading;
    }
  }

  startPrefetch() {
    this.loading = this.db
      .nextRange(this.step)
      .then((seg) => { this.spare = seg; })
      .catch(() => { /* DB down: callers retry on the next call */ })
      .finally(() => { this.loading = null; });
  }
}

async function main() {
  const db = new CentralCounter();
  const nodeA = await IdAllocator.create(db, 1000);

  const first = [await nodeA.nextId(), await nodeA.nextId(), await nodeA.nextId()];
  console.log("node A first ids: " + first.join(" "));
  let last = 0;
  for (let i = 4; i <= 2500; i++) {
    last = await nodeA.nextId();
    if (i === 1000 || i === 1001) console.log("node A id #" + i + " = " + last);
  }
  console.log("node A id #2500 = " + last + ", DB calls so far = " + db.calls);

  const nodeB = await IdAllocator.create(db, 1000);
  console.log("node B first id = " + (await nodeB.nextId()) + " (its own segment)");

  const seen = new Set();
  const worker = async () => {
    for (let i = 0; i < 1000; i++) seen.add(await nodeA.nextId());
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log("8 workers x 1000 ids on node A: " + seen.size + " unique");
}

main();`,
      go: String.raw`package main

import (
	"fmt"
	"sync"
	"time"
)

// CentralCounter simulates: UPDATE id_alloc SET max_id = max_id + step WHERE biz_tag = ?
type CentralCounter struct {
	mu    sync.Mutex
	maxID int64
	calls int
}

// NextRange returns the half-open range [start, end). Atomic, like one DB transaction.
func (c *CentralCounter) NextRange(step int) (int64, int64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	time.Sleep(2 * time.Millisecond) // network + disk round trip
	start := c.maxID + 1
	c.maxID += int64(step)
	c.calls++
	return start, c.maxID + 1
}

func (c *CentralCounter) Calls() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.calls
}

type segment struct{ next, end int64 } // [next, end)

// IdAllocator hands out IDs from an in-memory segment and prefetches the next one
// in the background (double buffering).
type IdAllocator struct {
	db      *CentralCounter
	step    int
	mu      sync.Mutex
	ready   *sync.Cond
	current segment
	spare   *segment // the second buffer
	loading bool
}

func NewIdAllocator(db *CentralCounter, step int) *IdAllocator {
	start, end := db.NextRange(step) // first segment fetched synchronously
	a := &IdAllocator{db: db, step: step, current: segment{start, end}}
	a.ready = sync.NewCond(&a.mu)
	return a
}

func (a *IdAllocator) NextID() int64 {
	a.mu.Lock()
	defer a.mu.Unlock()
	for {
		if a.current.next < a.current.end {
			id := a.current.next
			a.current.next++
			// 20% left and no spare buffer yet: fetch the next segment in the background.
			if a.spare == nil && !a.loading && a.current.end-a.current.next <= int64(a.step/5) {
				a.startPrefetch()
			}
			return id
		}
		if a.spare != nil { // swap buffers: no DB call on the hot path
			a.current = *a.spare
			a.spare = nil
			continue
		}
		if !a.loading { // burst used both buffers: wait for the DB
			a.startPrefetch()
		}
		a.ready.Wait()
	}
}

func (a *IdAllocator) startPrefetch() { // caller holds a.mu
	a.loading = true
	go func() {
		start, end := a.db.NextRange(a.step) // slow DB call, outside our lock
		a.mu.Lock()
		a.spare = &segment{start, end}
		a.loading = false
		a.ready.Broadcast()
		a.mu.Unlock()
	}()
}

func main() {
	db := &CentralCounter{}
	nodeA := NewIdAllocator(db, 1000)

	x, y, z := nodeA.NextID(), nodeA.NextID(), nodeA.NextID()
	fmt.Println("node A first ids:", x, y, z)
	var last int64
	for i := 4; i <= 2500; i++ {
		last = nodeA.NextID()
		if i == 1000 || i == 1001 {
			fmt.Printf("node A id #%d = %d\n", i, last)
		}
	}
	fmt.Printf("node A id #2500 = %d, DB calls so far = %d\n", last, db.Calls())

	nodeB := NewIdAllocator(db, 1000)
	fmt.Printf("node B first id = %d (its own segment)\n", nodeB.NextID())

	var seenMu sync.Mutex
	seen := make(map[int64]bool)
	var wg sync.WaitGroup
	for t := 0; t < 8; t++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 1000; i++ {
				id := nodeA.NextID()
				seenMu.Lock()
				seen[id] = true
				seenMu.Unlock()
			}
		}()
	}
	wg.Wait()
	fmt.Printf("8 workers x 1000 ids on node A: %d unique\n", len(seen))
}`,
    },
  },
  diagrams: {
    arch: String.raw`flowchart LR
      OS[Order service] --> LB[Load balancer]
      PS[Payment service] --> LB
      LB --> N1["ID node 1 (worker 1)"]
      LB --> N2["ID node 2 (worker 2)"]
      LB --> N3["ID node N"]
      N1 -.->|"worker lease"| ET[("etcd cluster")]
      N2 -.->|"worker lease"| ET
      N3 -.->|"worker lease"| ET
      N1 -->|"lease segment"| DB[("Segment DB primary")]
      N2 -->|"lease segment"| DB
      DB --- RP[("Sync replica")]`,
    lease: String.raw`sequenceDiagram
      participant N as ID node
      participant E as etcd
      N->>E: grant lease (TTL 10 s)
      E-->>N: lease 42
      N->>E: txn: create /workers/7 if absent, lease 42
      E-->>N: ok, worker id = 7
      N->>E: read lastTimestampMs for 7
      N->>N: wait until clock is past it
      loop every 3 s
        N->>E: keepalive lease 42
        N->>E: store lastTimestampMs
      end
      Note over N: renewal fails past deadline
      N->>N: stop issuing IDs, return 503`,
    clock: String.raw`flowchart TB
      S["nextId()"] --> T{"now vs lastTs"}
      T -->|"later ms"| R["seq = 0, lastTs = now"]
      T -->|"same ms"| Q{"seq below 4095?"}
      Q -->|yes| I["seq + 1"]
      Q -->|no| W["spin to next ms"]
      T -->|"behind by 10 ms or less"| W2["sleep, then retry"]
      T -->|"behind by more"| F["refuse: 503 + alert"]
      R --> O["compose: time, worker, seq bits"]
      I --> O`,
    segment: String.raw`sequenceDiagram
      participant C as Caller threads
      participant A as IdAllocator
      participant L as Loader thread
      participant D as Segment DB
      C->>A: nextId() x 800
      A-->>C: 1 .. 800 from memory
      Note over A: 20% left, start prefetch
      A->>L: load next segment
      L->>D: UPDATE max_id = max_id + 1000
      D-->>L: 2000
      L-->>A: spare = [1001, 2000]
      C->>A: nextId() x 200
      A-->>C: 801 .. 1000
      C->>A: nextId()
      A->>A: swap buffers
      A-->>C: 1001`,
  },
});
