SD.register({
  id: "estimation",
  html: String.raw`
<p class="lead">Back-of-the-envelope estimation is quick, rounded arithmetic that tells you the <em>size</em> of a system before you design it: how many requests per second, how much storage, how much bandwidth, how many servers. You are not expected to be precise. You are expected to land within the right order of magnitude (10×) in about four minutes, and then use those numbers to justify your design.</p>

<h2>Why it matters</h2>
<p>A system serving 50 requests per second runs happily on one server with one PostgreSQL database. A system serving 500,000 requests per second needs load balancers, caches, replicas, sharding and probably a queue. The same prompt ("design a URL shortener") can lead to either design depending on the scale. Estimation is how you find out which one you are building, and it shows the interviewer you think in numbers, not buzzwords.</p>

<h2>The pipeline</h2>
<div data-diagram="pipeline" data-caption="The standard estimation chain. Each number feeds a design decision."></div>

<h2>Numbers worth memorising</h2>
<h3>Powers of two and data sizes</h3>
<table>
  <thead><tr><th>Power</th><th>Exact</th><th>Approx</th><th>Name</th><th>Example</th></tr></thead>
  <tbody>
    <tr><td>2<sup>10</sup></td><td>1,024</td><td>10<sup>3</sup> (thousand)</td><td>1 KB</td><td>A short JSON API response</td></tr>
    <tr><td>2<sup>20</sup></td><td>1,048,576</td><td>10<sup>6</sup> (million)</td><td>1 MB</td><td>A compressed photo</td></tr>
    <tr><td>2<sup>30</sup></td><td>~1.07 billion</td><td>10<sup>9</sup> (billion)</td><td>1 GB</td><td>An HD movie is a few GB</td></tr>
    <tr><td>2<sup>40</sup></td><td>~1.1 trillion</td><td>10<sup>12</sup></td><td>1 TB</td><td>A large single-node database</td></tr>
    <tr><td>2<sup>50</sup></td><td>~1.13 × 10<sup>15</sup></td><td>10<sup>15</sup></td><td>1 PB</td><td>A big company's photo store</td></tr>
  </tbody>
</table>
<p>Handy sizes: a <code>char</code> in ASCII is 1 byte, a UUID is 16 bytes (36 as text), a <code>long</code>/timestamp is 8 bytes, a short text row (tweet, chat message) is 100–500 bytes with metadata, a compressed image 100 KB–1 MB, a minute of 720p video ~10–20 MB.</p>

<h3>Time</h3>
<table>
  <thead><tr><th>Period</th><th>Exact seconds</th><th>Round to</th></tr></thead>
  <tbody>
    <tr><td>1 day</td><td>86,400</td><td><mark>10<sup>5</sup></mark> (overestimates by ~15%, which is a safe direction)</td></tr>
    <tr><td>1 month</td><td>~2.6 million</td><td>2.5 × 10<sup>6</sup></td></tr>
    <tr><td>1 year</td><td>~31.5 million</td><td>3 × 10<sup>7</sup></td></tr>
  </tbody>
</table>
<div class="callout tip">
<strong>The two shortcuts that do most of the work</strong>
<ul>
  <li><strong>1 million requests/day ≈ 12 requests/second</strong> (≈ 10/s with the 10<sup>5</sup> rounding).</li>
  <li><strong>1 billion requests/day ≈ 12,000 requests/second</strong> (≈ 10k/s).</li>
</ul>
</div>

<h3>What one machine can roughly do</h3>
<table>
  <thead><tr><th>Component</th><th>Ballpark capacity</th></tr></thead>
  <tbody>
    <tr><td>Stateless app server (Java/Go, simple JSON API)</td><td>1,000–10,000 req/s depending on work per request</td></tr>
    <tr><td>Redis / Memcached node</td><td>~100,000+ simple ops/s, memory 32–256 GB</td></tr>
    <tr><td>PostgreSQL / MySQL (single primary, indexed point queries)</td><td>~5,000–20,000 simple queries/s; writes lower</td></tr>
    <tr><td>Cassandra node</td><td>~10,000+ writes/s per node, scales linearly</td></tr>
    <tr><td>Kafka broker</td><td>Hundreds of MB/s, hundreds of thousands of msgs/s</td></tr>
    <tr><td>WebSocket connection server</td><td>~100k–1 M concurrent idle connections (tuned)</td></tr>
  </tbody>
</table>
<p>These are deliberately conservative. Say them as assumptions: "I'll assume one app server handles about 2,000 requests per second."</p>

<h2>How it works: the formulas</h2>
<ol class="steps">
  <li><strong>Average QPS</strong> = DAU × actions per user per day ÷ 10<sup>5</sup>. Do this separately for reads and writes.</li>
  <li><strong>Peak QPS</strong> = average × peak factor. Use 2–3× for normal daily peaks; 5–10× or more for flash events (Flipkart Big Billion Days, IPL final on JioHotstar, IRCTC Tatkal at 10 am).</li>
  <li><strong>Storage</strong> = new items per day × size per item × 365 × years × replication factor (often 3).</li>
  <li><strong>Bandwidth</strong> = QPS × payload size. Compute ingress (writes) and egress (reads) separately.</li>
  <li><strong>Cache memory</strong> (80/20 rule): about 20% of items get 80% of reads, so cache ≈ 0.2 × daily read volume (unique data), or the "hot set" such as the last 24 hours.</li>
  <li><strong>Servers</strong> = peak QPS ÷ QPS per server, then add ~30% headroom and round up for redundancy (never fewer than 2–3).</li>
</ol>

<div class="callout info">
<strong>Rounding is a feature</strong>
Write 86,400 as 10<sup>5</sup>, 365 as 400 if it helps, 1,024 as 1,000. Interviewers want to see the method and a sensible magnitude. Saying "about 12k QPS, call it 10–15k" is better than spending two minutes on long division.
</div>

<h2>Try it</h2>
<p>Play with the calculator below. Change DAU, actions per user and object size and watch how QPS, storage and bandwidth move.</p>
<div data-widget="estimator"></div>

<h2>Worked example 1: a Twitter-like service</h2>
<p><strong>Assumptions</strong> (state these out loud): 200 M DAU. Each user posts 2 tweets/day and loads their timeline 20 times/day, seeing 20 tweets per load. A tweet with metadata is ~500 bytes. 10% of tweets carry an image of ~500 KB. Keep data for 5 years.</p>
<table>
  <thead><tr><th>Quantity</th><th>Arithmetic</th><th>Result</th></tr></thead>
  <tbody>
    <tr><td>Tweets per day</td><td>200 M × 2</td><td>400 M/day</td></tr>
    <tr><td>Write QPS (avg)</td><td>4 × 10<sup>8</sup> ÷ 10<sup>5</sup></td><td>~4,000/s</td></tr>
    <tr><td>Write QPS (peak, 3×)</td><td>4,000 × 3</td><td>~12,000/s</td></tr>
    <tr><td>Timeline reads per day</td><td>200 M × 20</td><td>4 B/day</td></tr>
    <tr><td>Read QPS (avg / peak)</td><td>4 × 10<sup>9</sup> ÷ 10<sup>5</sup>; × 3</td><td>~40,000/s; ~120,000/s</td></tr>
    <tr><td>Text storage per day</td><td>400 M × 500 B</td><td>200 GB/day</td></tr>
    <tr><td>Text storage, 5 years</td><td>200 GB × 365 × 5</td><td>~365 TB (~1.1 PB with 3 replicas)</td></tr>
    <tr><td>Media per day</td><td>40 M images × 500 KB</td><td>20 TB/day</td></tr>
    <tr><td>Media, 5 years</td><td>20 TB × 1,825</td><td>~36 PB → object storage + CDN</td></tr>
    <tr><td>Egress (text only)</td><td>40,000 timelines/s × 20 tweets × 500 B</td><td>~400 MB/s average</td></tr>
    <tr><td>Cache (hot tweets)</td><td>keep last 24 h of tweets: 200 GB; 80/20 says ~20% is hot</td><td>40–200 GB → a handful of Redis nodes</td></tr>
    <tr><td>App servers</td><td>120,000 peak ÷ ~2,000 per server, + headroom</td><td>~60–80 servers</td></tr>
  </tbody>
</table>
<p><strong>What the numbers tell us:</strong> reads outnumber writes 10:1, so timelines should be precomputed or cached (see fan-out). 365 TB of text needs a sharded store. 36 PB of media must live in object storage behind a CDN, never in the database. 12k writes/s at peak is too much for one SQL primary, so shard or use a write-friendly store like Cassandra.</p>

<h2>Worked example 2: a WhatsApp-like messenger</h2>
<p><strong>Assumptions:</strong> 500 M DAU, each sends 40 messages/day. A text message with metadata is ~100 bytes. 5% of messages carry media averaging 200 KB. Half of DAU is online at peak. Messages are stored on the server until delivered, and we keep 30 days of history server-side (state this; real WhatsApp deletes after delivery).</p>
<table>
  <thead><tr><th>Quantity</th><th>Arithmetic</th><th>Result</th></tr></thead>
  <tbody>
    <tr><td>Messages per day</td><td>500 M × 40</td><td>20 B/day</td></tr>
    <tr><td>Message QPS (avg)</td><td>2 × 10<sup>10</sup> ÷ 10<sup>5</sup></td><td>~200,000/s</td></tr>
    <tr><td>Peak QPS (2×; festivals like New Year's Eve are far higher)</td><td>200k × 2</td><td>~400,000/s</td></tr>
    <tr><td>Text storage per day</td><td>2 × 10<sup>10</sup> × 100 B</td><td>2 TB/day</td></tr>
    <tr><td>Text storage, 30 days</td><td>2 TB × 30</td><td>60 TB (×3 replicas = 180 TB)</td></tr>
    <tr><td>Media per day</td><td>1 B media × 200 KB</td><td>200 TB/day → object storage with TTL</td></tr>
    <tr><td>Ingress (text)</td><td>200k/s × 100 B</td><td>~20 MB/s (tiny)</td></tr>
    <tr><td>Ingress (media)</td><td>200 TB ÷ 10<sup>5</sup> s</td><td>~2 GB/s average</td></tr>
    <tr><td>Concurrent connections at peak</td><td>500 M × 50%</td><td>250 M</td></tr>
    <tr><td>Connection servers</td><td>250 M ÷ 500k per server</td><td>~500 servers (+ headroom)</td></tr>
  </tbody>
</table>
<p><strong>What the numbers tell us:</strong> the hard part is not storage but <em>connections</em> and <em>write throughput</em>. 400k writes/s needs a horizontally scalable store (WhatsApp historically used Erlang with Mnesia; Cassandra or HBase would fit). 250 M persistent connections means a dedicated fleet of connection servers plus a lookup service mapping user → server. Text bandwidth is trivial; media bandwidth dominates and must go straight to blob storage via pre-signed URLs.</p>

<h2>Variants and shortcuts</h2>
<div class="tabs">
<section data-tab="Read-heavy">
<p>Feeds, catalogues (Flipkart product pages), URL redirects. Compute read QPS carefully, then size the cache and CDN. Writes are often small enough for one primary with replicas.</p>
</section>
<section data-tab="Write-heavy">
<p>GPS pings (Swiggy/Uber riders every 4 s), logs, metrics, chat. 1 M riders × 1 ping / 4 s = 250k writes/s. Look for append-friendly stores, batching and queues, and consider whether every write must be persisted.</p>
</section>
<section data-tab="Storage-heavy">
<p>Photos, video (YouTube: 500+ hours uploaded per minute), backups. Storage and egress bandwidth dominate cost. Separate metadata (DB) from blobs (object store), and use tiered storage for cold data.</p>
</section>
<section data-tab="Connection-heavy">
<p>Chat, live scores, multiplayer games. Count concurrent connections, not QPS. Memory per connection (~10–50 KB) × connections gives RAM needed.</p>
</section>
</div>

<h2>Real-world reference points</h2>
<ul>
  <li>WhatsApp has passed 100 billion messages per day (≈ 1.2 M/s average).</li>
  <li>UPI in India processes over 15 billion transactions a month, roughly 5,000–6,000 per second on average with much higher peaks.</li>
  <li>Google Search handles several billion queries a day, around 100k QPS average.</li>
  <li>Netflix accounts for a large share of global downstream internet traffic in the evening, which is why it built its own CDN (Open Connect).</li>
</ul>

<h2>Common pitfalls</h2>
<div class="callout interview">
<strong>Say this in the interview</strong>
"I'll assume 200 million daily users posting twice a day. That's 400 million writes a day; dividing by about 10<sup>5</sup> seconds gives roughly 4,000 writes per second, maybe 12,000 at peak. Reads are 10 times that, so this is read-heavy and I'll plan for a cache in front of the database."
</div>
<ul>
  <li>Forgetting peak. Average QPS is not what crashes your servers.</li>
  <li>Forgetting replication. Three copies triple your storage.</li>
  <li>Mixing bits and bytes. Network speeds are in bits (1 Gbps = 125 MB/s).</li>
  <li>Calculating numbers you never use. Each number should change a decision.</li>
  <li>False precision ("11,574.07 QPS"). Round to one or two significant figures.</li>
</ul>

<h2>Test yourself</h2>
<div class="quiz">
<details><summary>10 M DAU, 50 requests per user per day. What is the average and peak QPS?</summary><div>10<sup>7</sup> × 50 = 5 × 10<sup>8</sup> requests/day. ÷ 10<sup>5</sup> ≈ 5,000 QPS average (exact ≈ 5,800). With a 2–3× peak factor, ~10,000–15,000 QPS.</div></details>
<details><summary>A service stores 5 M new records a day at 1 KB each. Storage for 5 years with 3 replicas?</summary><div>5 × 10<sup>6</sup> × 1 KB = 5 GB/day. × 365 × 5 ≈ 9.1 TB. × 3 replicas ≈ 27 TB. Fits on a modest sharded cluster.</div></details>
<details><summary>How do you size a cache using the 80/20 rule?</summary><div>Assume 20% of the data serves 80% of reads. Estimate the daily read volume in unique bytes (or the hot working set, e.g. the last 24 hours), take 20% of it, and add headroom. Example: 50 GB of daily unique reads → ~10 GB cache, comfortably one or two Redis nodes.</div></details>
<details><summary>Peak is 60,000 QPS and one server handles 2,000 QPS. How many servers?</summary><div>60,000 ÷ 2,000 = 30. Add ~30% headroom and capacity to lose a zone: about 40, spread across at least 2–3 availability zones.</div></details>
<details><summary>Why is 1 Gbps not 1 GB/s?</summary><div>Network bandwidth is quoted in bits. 1 Gbps ÷ 8 = 125 MB/s. Forgetting this inflates capacity by 8×.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
  <li>One day ≈ 10<sup>5</sup> seconds; 1 M/day ≈ 12/s; 1 B/day ≈ 12k/s.</li>
  <li>Chain: DAU → requests/day → average QPS → peak QPS → storage → bandwidth → cache → servers.</li>
  <li>Use 2–3× for normal peaks and 10× for flash sales or live events.</li>
  <li>Remember replication (×3) for storage and bits vs bytes for bandwidth.</li>
  <li>Cache roughly the 20% hot set that serves 80% of reads.</li>
  <li>Round aggressively and always say what each number means for the design.</li>
</ul></div>
`,
  diagrams: {
    pipeline: String.raw`flowchart LR
      A["DAU"] --> B["Requests per day"]
      B --> C["Average QPS (÷ 10^5)"]
      C --> D["Peak QPS (× 2-10)"]
      D --> S["Servers needed"]
      B --> E["Storage per day"]
      E --> F["Storage over 5 years (× replicas)"]
      C --> G["Bandwidth (QPS × size)"]
      B --> H["Cache size (80/20)"]`,
  },
});
