SD.register({
  id: "latency-throughput",
  html: String.raw`
<p class="lead"><strong>Latency</strong> is how long one request takes, from send to response: "the Swiggy home screen loads in 180 ms". <strong>Throughput</strong> is how many requests the system completes per unit of time: "the order service handles 5,000 orders per second". They are related but not the same, and improving one can hurt the other. Knowing the difference, and knowing roughly how long common operations take, lets you reason about performance in any design.</p>

<h2>What it is</h2>
<p>Picture a highway. <strong>Latency</strong> is how long it takes one car to drive from Pune to Mumbai. <strong>Throughput</strong> is how many cars arrive in Mumbai per hour. Adding lanes raises throughput but does not make any one car faster. Raising the speed limit lowers latency and also raises throughput a little. A traffic jam increases both the time per car and, past a point, reduces cars per hour.</p>
<div class="grid-2">
<div class="card">
<h3>Latency</h3>
<ul>
  <li>Unit: time (ms, µs).</li>
  <li>What a single user feels.</li>
  <li>Measured as a distribution: p50, p95, p99.</li>
  <li>Improve with: caching, fewer hops, data closer to the user, faster algorithms.</li>
</ul>
</div>
<div class="card">
<h3>Throughput</h3>
<ul>
  <li>Unit: work per time (req/s, MB/s, msgs/s).</li>
  <li>What the system can sustain.</li>
  <li>Limited by the slowest stage (the bottleneck).</li>
  <li>Improve with: more machines, parallelism, batching, async processing.</li>
</ul>
</div>
</div>
<p>Two related terms: <strong>bandwidth</strong> is the maximum possible data rate of a link (a 1 Gbps NIC), while throughput is what you actually achieve. <strong>Response time</strong> as seen by the user = network latency + queueing time + service (processing) time.</p>

<h2>Where the time goes in one request</h2>
<div data-diagram="path" data-caption="A typical API call. Every hop adds latency; the user feels the sum."></div>
<p>For a user in Bengaluru hitting servers in Mumbai, the network round trip alone is ~20–30 ms. A new HTTPS connection costs extra round trips for TCP and TLS handshakes, which is why connection reuse and HTTP/2 matter. Inside the data centre, each service call adds ~0.5–1 ms of network time plus the work itself.</p>

<h2>Percentiles and tail latency</h2>
<p>Averages lie. If 99 requests take 10 ms and one takes 5 seconds, the average is ~60 ms, which describes nobody. Instead, latency is reported as <strong>percentiles</strong>:</p>
<ul>
  <li><strong>p50 (median)</strong>: half of requests are faster than this. The "typical" experience.</li>
  <li><strong>p95</strong>: 95% are faster; 1 in 20 is slower.</li>
  <li><strong>p99</strong>: 99% are faster; 1 in 100 is slower. This is the <strong>tail</strong>.</li>
  <li><strong>p99.9</strong>: 1 in 1,000. Matters at huge scale or for the most valuable users.</li>
</ul>
<figure class="svg-fig">
<svg viewBox="0 0 720 260" role="img" aria-label="Latency histogram with a long right tail and p50, p95, p99 markers">
  <text class="s-title" x="360" y="22" text-anchor="middle">Latency distribution of 1 million requests</text>
  <line class="s-line" x1="50" y1="210" x2="690" y2="210" marker-end="url(#arrow)"/>
  <line class="s-line" x1="50" y1="210" x2="50" y2="40"/>
  <text class="s-muted" x="40" y="60" text-anchor="end" transform="rotate(-90 40 60)">requests</text>
  <rect class="s-box" x="70" y="170" width="34" height="40" rx="4"/>
  <rect class="s-box" x="108" y="90" width="34" height="120" rx="4"/>
  <rect class="s-accent" x="146" y="55" width="34" height="155" rx="4"/>
  <rect class="s-box" x="184" y="85" width="34" height="125" rx="4"/>
  <rect class="s-box" x="222" y="130" width="34" height="80" rx="4"/>
  <rect class="s-box" x="260" y="160" width="34" height="50" rx="4"/>
  <rect class="s-amber" x="298" y="180" width="34" height="30" rx="4"/>
  <rect class="s-amber" x="336" y="190" width="34" height="20" rx="4"/>
  <rect class="s-red" x="400" y="196" width="34" height="14" rx="4"/>
  <rect class="s-red" x="480" y="200" width="34" height="10" rx="4"/>
  <rect class="s-red" x="600" y="203" width="34" height="7" rx="4"/>
  <line class="s-dash" x1="163" y1="40" x2="163" y2="210"/>
  <text class="s-text" x="163" y="36" text-anchor="middle">p50 = 40 ms</text>
  <line class="s-dash" x1="315" y1="70" x2="315" y2="210"/>
  <text class="s-text" x="315" y="66" text-anchor="middle">p95 = 120 ms</text>
  <line class="s-dash" x1="497" y1="110" x2="497" y2="210"/>
  <text class="s-text" x="497" y="106" text-anchor="middle">p99 = 400 ms</text>
  <text class="s-muted" x="560" y="160" text-anchor="middle">the long tail</text>
  <text class="s-muted" x="370" y="236" text-anchor="middle">latency →  (GC pauses, cache misses, retries, slow disks live out here)</text>
</svg>
<figcaption>Most requests are fast, but the tail can be 10× slower than the median. SLOs are usually written on p95 or p99, not the average.</figcaption>
</figure>

<h3>Why the tail matters more than you think</h3>
<p>Modern pages fan out. A Flipkart product page might call 30–50 services (price, stock, offers, reviews, delivery estimate). The page is only as fast as the <em>slowest</em> call. If each backend has a 1% chance of being slow (its p99), then a request that waits on 100 backends is slow with probability 1 − 0.99<sup>100</sup> ≈ <mark>63%</mark>. The rare tail of each service becomes the common case for the user. This is "tail latency amplification", described in Google's paper <em>The Tail at Scale</em>.</p>
<p>Common causes of tail latency: garbage-collection pauses, cache misses, noisy neighbours on shared hosts, a slow disk, lock contention, retries, and queueing when a server is near full load.</p>
<p>Mitigations: <strong>hedged requests</strong> (send a duplicate request after p95 time and take whichever returns first), timeouts with fallbacks, reducing fan-out, keeping utilisation below ~70%, and isolating slow work into separate pools.</p>

<h2>Little's law</h2>
<p>Little's law links the two ideas with one simple formula, valid for any stable system:</p>
<div class="callout info">
<strong>L = λ × W</strong>
<strong>L</strong> = average number of requests in the system (concurrency), <strong>λ</strong> (lambda) = throughput (arrival rate), <strong>W</strong> = average time each request spends in the system (latency).
</div>
<p><strong>Example 1: sizing a thread pool.</strong> Razorpay's payment API gets 2,000 requests/s and each takes 250 ms (mostly waiting on the bank). Concurrency = 2,000 × 0.25 = <strong>500 requests in flight</strong>. With 10 servers you need ~50 concurrent workers per server, plus headroom.</p>
<p><strong>Example 2: the effect of a slow dependency.</strong> If the bank slows down and latency becomes 2 s, in-flight requests jump to 2,000 × 2 = 4,000. If your servers only have 1,000 threads, requests queue up, latency rises further, and the system can collapse. This is why timeouts and circuit breakers matter.</p>
<p><strong>Example 3: database connections.</strong> 5,000 queries/s at 4 ms each needs only 5,000 × 0.004 = 20 concurrent connections. A pool of 200 connections is wasteful and can hurt the database.</p>

<h2>Latency numbers every programmer should know</h2>
<p>These classic numbers (popularised by Jeff Dean and Peter Norvig) are approximate and hardware keeps changing, but the <em>ratios</em> are what you should remember: memory is ~1,000× faster than SSD, which is ~100× faster than spinning disk, and crossing continents costs more than almost anything inside a data centre.</p>
<table>
  <thead><tr><th>Operation</th><th>Time</th><th>Rough feel</th></tr></thead>
  <tbody>
    <tr><td>L1 cache reference</td><td>~1 ns</td><td>Instant</td></tr>
    <tr><td>Branch mispredict</td><td>~3–5 ns</td><td></td></tr>
    <tr><td>L2 cache reference</td><td>~4–7 ns</td><td></td></tr>
    <tr><td>Mutex lock/unlock</td><td>~20–25 ns</td><td></td></tr>
    <tr><td>Main memory (RAM) reference</td><td>~100 ns</td><td>100× L1</td></tr>
    <tr><td>Compress 1 KB with Snappy</td><td>~2–3 µs</td><td></td></tr>
    <tr><td>Send 1 KB over a 1 Gbps network</td><td>~10 µs</td><td></td></tr>
    <tr><td>Read 4 KB randomly from SSD</td><td>~20–150 µs</td><td>~1,000× RAM</td></tr>
    <tr><td>Read 1 MB sequentially from memory</td><td>~10–250 µs</td><td></td></tr>
    <tr><td>Round trip within the same data centre</td><td>~0.5 ms</td><td>Each microservice hop</td></tr>
    <tr><td>Redis GET over the network (same DC)</td><td>~0.5–1 ms</td><td></td></tr>
    <tr><td>Read 1 MB sequentially from SSD</td><td>~1 ms</td><td></td></tr>
    <tr><td>Disk (HDD) seek</td><td>~10 ms</td><td>Avoid random disk I/O on hot paths</td></tr>
    <tr><td>Read 1 MB sequentially from HDD</td><td>~20 ms</td><td></td></tr>
    <tr><td>Round trip Mumbai ↔ Singapore</td><td>~60 ms</td><td></td></tr>
    <tr><td>Round trip Mumbai ↔ US East</td><td>~200 ms</td><td>A user notices this</td></tr>
    <tr><td>Round trip California ↔ Netherlands</td><td>~150 ms</td><td>Speed of light is the limit</td></tr>
  </tbody>
</table>
<p>Explore the scale visually; each step is often 10–100× the previous one.</p>
<div data-widget="latency"></div>

<div class="callout tip">
<strong>Rules of thumb these numbers give you</strong>
<ul>
  <li>Reading from a remote cache (~1 ms) is still ~10× faster than a typical DB query that touches disk (~5–10 ms).</li>
  <li>An in-process cache (~100 ns) is ~10,000× faster than a network call. Use it for tiny, hot, rarely changing data (config, feature flags).</li>
  <li>Sequential I/O is far faster than random I/O. That is why Kafka and LSM-tree databases append to logs.</li>
  <li>You cannot beat physics across continents. Serve users from a nearby region or CDN edge.</li>
</ul>
</div>

<h2>Reduce latency vs increase throughput</h2>
<table>
  <thead><tr><th>Goal</th><th>Techniques</th><th>Example</th></tr></thead>
  <tbody>
    <tr><td rowspan="5"><strong>Lower latency</strong></td><td>Cache hot data in memory</td><td>Swiggy caches restaurant menus in Redis</td></tr>
    <tr><td>Move data closer to users (CDN, edge, regional deploys)</td><td>Netflix Open Connect boxes inside Indian ISPs</td></tr>
    <tr><td>Reduce hops and round trips; reuse connections</td><td>Batch 10 lookups in one call; keep-alive, HTTP/2</td></tr>
    <tr><td>Do work asynchronously; return early</td><td>Send order confirmation email via a queue, not inline</td></tr>
    <tr><td>Better indexes, algorithms, denormalised reads</td><td>Precomputed home feed instead of a 5-table join</td></tr>
    <tr><td rowspan="4"><strong>Higher throughput</strong></td><td>Scale horizontally (more servers, more partitions)</td><td>Add Kafka partitions and consumers</td></tr>
    <tr><td>Batch work</td><td>Write 500 GPS pings in one DB call</td></tr>
    <tr><td>Parallelise and pipeline</td><td>Process image thumbnails on a worker pool</td></tr>
    <tr><td>Remove the bottleneck stage</td><td>Read replicas to offload the primary DB</td></tr>
  </tbody>
</table>

<h3>The trade-off</h3>
<p>Batching is the classic tension. Waiting to collect 500 messages before writing raises throughput hugely but adds latency for the first message in the batch. Kafka producers expose exactly this knob (<code>linger.ms</code> and <code>batch.size</code>). Similarly, running servers at 95% utilisation maximises throughput per rupee but queueing makes latency explode; most teams target 50–70% utilisation for latency-sensitive services.</p>

<h2>Common interview questions and pitfalls</h2>
<div class="callout interview">
<strong>Say this in the interview</strong>
"I'll target p99 under 200 ms for the read API. Since the page fans out to several services, the tail of each one adds up, so I'll put a cache in front of the slow ones, set tight timeouts with fallbacks, and keep fan-out small. For write throughput, I'll batch location pings through a queue, which adds a second of delay but that's fine for tracking."
</div>
<ul>
  <li>Quoting averages instead of percentiles.</li>
  <li>Assuming more servers fixes latency. It fixes throughput; a slow query is still slow on 100 servers.</li>
  <li>Ignoring network round trips across regions.</li>
  <li>Forgetting that queueing near full utilisation makes latency spike.</li>
</ul>

<h2>Test yourself</h2>
<div class="quiz">
<details><summary>A service has p50 = 20 ms and p99 = 900 ms. Which number should worry you, and why?</summary><div>The p99. One in 100 requests takes almost a second, and if a page calls this service many times or fans out, most users will hit that tail. Investigate GC pauses, slow queries, lock contention or a struggling dependency.</div></details>
<details><summary>Using Little's law: 3,000 req/s with 200 ms average latency. How many requests are in flight?</summary><div>L = λW = 3,000 × 0.2 = 600 concurrent requests. Size thread pools and connection pools accordingly, with headroom.</div></details>
<details><summary>A page fans out to 50 services, each with a 1% chance of a slow response. What fraction of page loads will be slow?</summary><div>1 − 0.99<sup>50</sup> ≈ 1 − 0.605 ≈ 40%. Tail latency amplification means the rare slow case becomes common.</div></details>
<details><summary>Does adding more app servers reduce latency?</summary><div>Only if latency was caused by queueing on overloaded servers. Otherwise no: each request still does the same work. More servers increase throughput. To cut per-request latency, cache, reduce hops, or speed up the slow step.</div></details>
<details><summary>Why is batching good for throughput but bad for latency?</summary><div>Batching amortises fixed overhead (network round trip, disk sync) across many items, so more items per second get processed. But items wait for the batch to fill or a timer to fire, so each item's individual latency rises.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
  <li>Latency = time per request; throughput = requests per unit time. They are tuned with different tools.</li>
  <li>Report latency as percentiles. The tail (p99) dominates user experience when requests fan out.</li>
  <li>Little's law, L = λW, sizes thread pools and connection pools and explains cascading slowdowns.</li>
  <li>Memorise the ratios: RAM ~100 ns, same-DC round trip ~0.5 ms, disk seek ~10 ms, cross-continent ~150 ms.</li>
  <li>Cut latency with caching, locality and fewer hops; raise throughput with parallelism, batching and scaling out.</li>
  <li>Keep utilisation well below 100%, or queueing will blow up latency.</li>
</ul></div>
`,
  diagrams: {
    path: String.raw`sequenceDiagram
      participant U as User (Bengaluru)
      participant L as Load balancer (Mumbai)
      participant A as App server
      participant C as Redis
      participant D as Database
      U->>L: HTTPS request (~25 ms RTT)
      L->>A: forward (~0.5 ms)
      A->>C: GET menu (~1 ms)
      C-->>A: miss
      A->>D: SQL query (~5-10 ms)
      D-->>A: rows
      A-->>L: JSON response
      L-->>U: response`,
  },
});
