SD.register({
  id: "url-shortener",
  html: String.raw`
<p class="lead">A URL shortener turns a long link like <code>https://www.flipkart.com/big-billion-days?utm_source=app&amp;utm_campaign=bbd25</code> into something like <code>https://fk.co/6LAze</code>. When someone opens the short link, the service looks up the original and redirects the browser there. It sounds trivial, which is exactly why interviewers love it: the basic version takes five minutes, and the remaining forty minutes test whether you can reason about ID generation, read-heavy caching, sharding, and the small details (301 vs 302, expiry, abuse) that separate an SDE 1 answer from an SDE 2 answer.</p>

<h2>Problem statement</h2>
<p>Design a service like TinyURL or bit.ly. Users submit a long URL and get back a short, unique URL. Anyone who opens the short URL is redirected to the original. Users may optionally choose a custom alias (for example <code>fk.co/bbd2025</code>) and an expiry time. The business also wants click analytics: how many clicks per link, from which countries, devices and referrers.</p>
<p>Assume the scale of a large public shortener: about <strong>100 million new links per day</strong>, a <strong>100:1 read-to-write ratio</strong>, and links that must keep working for at least <strong>5 years</strong>.</p>

<div class="callout tip"><strong>Try it first</strong>Spend 15 minutes on paper before reading on. Write down: (1) how many short codes you need over 5 years and how long a code must be, (2) the two API calls, (3) one table, (4) a box diagram with a cache. Then pick a way to generate codes and list one weakness of your choice. Compare with the walkthrough below.</div>

<details class="hint"><summary>Hint 1: how long must the code be?</summary>
<p>Count the total links you will ever store (per day × days × years). Then find the smallest <em>k</em> such that 62<sup>k</sup> (digits + lowercase + uppercase) comfortably exceeds that number.</p>
</details>
<details class="hint"><summary>Hint 2: where does the load really come from?</summary>
<p>Writes are around a thousand per second. Reads are a hundred times more. The redirect path is the hot path. Think about what you can cache, and what the browser itself can cache for you.</p>
</details>
<details class="hint"><summary>Hint 3: generating codes without coordination</summary>
<p>Hashing the URL needs a collision check on every write. A global counter needs coordination. What if a separate service generated unique keys in advance and handed them out in batches, so app servers never talk to each other?</p>
</details>

<h2>Requirements</h2>
<div class="grid-2">
<div class="card">
<h3>Functional</h3>
<ul>
<li><strong>Shorten</strong>: given a long URL, return a unique short URL.</li>
<li><strong>Redirect</strong>: opening the short URL sends the user to the long URL.</li>
<li><strong>Custom alias</strong> (optional): user picks the code, if it is free.</li>
<li><strong>Expiry</strong> (optional): link stops working after a given time; default is "never" or a long default like 5 years.</li>
<li><strong>Analytics</strong> (optional, but say it): click counts by time, country, device, referrer.</li>
<li>Out of scope unless asked: user accounts UI, link editing, QR codes.</li>
</ul>
</div>
<div class="card">
<h3>Non-functional</h3>
<ul>
<li><strong>Highly available</strong> redirects: a dead short link in a marketing SMS is lost revenue. Target 99.99%.</li>
<li><strong>Low latency</strong> redirects: p99 under ~50 ms server-side.</li>
<li><strong>Codes are unique</strong> forever; two long URLs must never share a code.</li>
<li><strong>Not guessable</strong>: someone should not be able to walk through all links by incrementing a code.</li>
<li><strong>Durable</strong>: once created, a link must not be lost.</li>
<li>Analytics can be <strong>eventually consistent</strong> (a few seconds or minutes late is fine).</li>
</ul>
</div>
</div>

<div class="callout interview"><strong>Say this in the interview</strong>"Before I design, let me confirm scope. I will support shorten and redirect as the core, custom alias and expiry as optional features, and click analytics as an async add-on. Redirect is the hot path, so I will optimise for read latency and availability, and accept eventual consistency for analytics. Is 100 million new links a day the right ballpark?"</div>

<h2>Capacity estimation</h2>
<p>Use round numbers and say them out loud. One day is about 86,400 seconds; round it to <strong>~10<sup>5</sup></strong> for quick maths, then refine.</p>
<table>
<thead><tr><th>Quantity</th><th>Arithmetic</th><th>Result</th></tr></thead>
<tbody>
<tr><td>Write QPS (average)</td><td>100M / 86,400 s</td><td><strong>~1,160 /s</strong> (peak ×3 ≈ 3,500 /s)</td></tr>
<tr><td>Read QPS (average)</td><td>1,160 × 100</td><td><strong>~116,000 /s</strong> (peak ≈ 350,000 /s)</td></tr>
<tr><td>Links in 5 years</td><td>100M × 365 × 5</td><td><strong>182.5 billion</strong></td></tr>
<tr><td>Bytes per record</td><td>code 7 B + long URL ~200 B + user id, timestamps, metadata ~ 100 B, plus index/storage overhead</td><td><strong>~500 B</strong> (round up)</td></tr>
<tr><td>Total storage</td><td>182.5B × 500 B</td><td><strong>~91 TB</strong>; with 3× replication ≈ 275 TB</td></tr>
<tr><td>Write bandwidth</td><td>1,160 /s × 500 B</td><td>~0.6 MB/s (tiny)</td></tr>
<tr><td>Read bandwidth</td><td>116,000 /s × 500 B</td><td>~58 MB/s</td></tr>
<tr><td>Click events</td><td>10B clicks/day × ~100 B</td><td>~1 TB/day of analytics data</td></tr>
</tbody>
</table>

<h3>How long should the code be?</h3>
<p>With 62 characters (<code>0-9</code>, <code>a-z</code>, <code>A-Z</code>), a code of length <em>k</em> gives 62<sup>k</sup> combinations:</p>
<ul>
<li>62<sup>6</sup> = 56.8 billion: <mark>not enough</mark> for 182.5 billion links.</li>
<li>62<sup>7</sup> = 3.52 trillion: about <strong>19×</strong> what we need. Enough headroom for growth, and sparse enough that random codes are hard to guess.</li>
<li>62<sup>8</sup> = 218 trillion: overkill for this scale, one more character for every user.</li>
</ul>
<p>So pick <strong>7 characters</strong>. A 7-char base62 code needs log<sub>2</sub>(3.52 × 10<sup>12</sup>) ≈ 41.7, so <strong>42 bits</strong> of ID space.</p>

<h3>Cache memory</h3>
<p>Traffic on short links is very skewed: a link shared in a viral tweet or a Swiggy push notification gets millions of clicks in an hour, while most links are clicked a handful of times. The classic estimate uses the 80/20 rule:</p>
<ul>
<li>Upper bound: cache 20% of daily read requests: 10B × 0.2 × 500 B = <strong>1 TB</strong>. This over-counts, because many requests hit the same link.</li>
<li>Realistic: the unique hot set is maybe 20 million links a day: 20M × 500 B = <strong>10 GB</strong>. Even with 10× slack (100 GB) this fits in a small Redis cluster.</li>
</ul>
<p>Play with the widget below to see how a numeric ID turns into a base62 code and back. Notice how quickly the code grows by one character each time the ID passes a power of 62.</p>

<div data-widget="base62"></div>

<h2>API design</h2>
<h3>Create a short link</h3>
<pre><code>POST /api/v1/urls
Authorization: Bearer &lt;token&gt;      (or an API key for developers)
{
  "longUrl":   "https://www.flipkart.com/big-billion-days?utm_source=app",
  "alias":     "bbd2025",            // optional
  "expiresAt": "2026-12-31T23:59:59Z" // optional
}

201 Created
{ "code": "bbd2025", "shortUrl": "https://fk.co/bbd2025", "expiresAt": "2026-12-31T23:59:59Z" }

409 Conflict           alias already taken
400 Bad Request        invalid URL or alias
429 Too Many Requests  caller is over its rate limit</code></pre>

<h3>Redirect</h3>
<pre><code>GET /{code}

302 Found
Location: https://www.flipkart.com/big-billion-days?utm_source=app
Cache-Control: private, max-age=0

404 Not Found   unknown code
410 Gone        code existed but has expired</code></pre>

<h3>301 or 302?</h3>
<table>
<thead><tr><th></th><th>301 Moved Permanently</th><th>302 Found (or 307)</th></tr></thead>
<tbody>
<tr><td>Browser behaviour</td><td>Browser caches the redirect; next click may never reach us</td><td>Browser asks us every time</td></tr>
<tr><td>Server load</td><td>Lower</td><td>Higher (every click hits us or our CDN)</td></tr>
<tr><td>Analytics</td><td>Undercounts repeat clicks</td><td>Accurate click counts</td></tr>
<tr><td>Expiry / editing target</td><td>Hard: cached redirects keep working in old browsers</td><td>Easy: we decide at every click</td></tr>
<tr><td>SEO</td><td>Passes link equity to the target</td><td>Treated as temporary</td></tr>
</tbody>
</table>
<div class="callout interview"><strong>Say this in the interview</strong>"Because the product wants analytics and expiry, I will return 302. Each click then reaches our edge, so we can count it and refuse expired links. If the business cared only about cost and SEO, 301 would cut our read traffic, but we would lose repeat-click data and the ability to expire or change a link."</div>

<h2>Data model</h2>
<p>The access pattern is a pure key-value lookup: given a code, fetch the long URL. No joins, no range scans on the hot path. That points to a key-value or wide-column store (DynamoDB, Cassandra) or a sharded MySQL/Postgres with the code as primary key. Both work; say why you pick one.</p>
<pre><code>urls
  code         VARCHAR(16)  PRIMARY KEY     -- 7 chars generated, up to 16 for aliases
  long_url     VARCHAR(2048) NOT NULL
  user_id      BIGINT        NULL           -- null for anonymous links
  created_at   TIMESTAMP
  expires_at   TIMESTAMP     NULL           -- null = never
  is_custom    BOOLEAN

users
  user_id, email, plan, api_key_hash, created_at

clicks  (analytics store: ClickHouse / BigQuery / Druid, append-only)
  code, clicked_at, country, city, device, os, referrer, ip_hash</code></pre>
<ul>
<li>Custom aliases live in the same <code>urls</code> table, so the primary key guarantees that an alias and a generated code can never clash. Use a <strong>conditional insert</strong> (<code>INSERT</code> that fails on duplicate key, or DynamoDB <code>attribute_not_exists</code>) to claim a code atomically.</li>
<li>Do not put a <code>click_count</code> column on <code>urls</code> and increment it per click. 116K writes per second on hot rows is a recipe for lock contention. Aggregate in the analytics pipeline instead.</li>
<li>Optional index on <code>user_id</code> to list "my links"; in a KV store that is a second table keyed by user.</li>
</ul>

<div data-diagram="er" data-caption="Core entities: links belong to users, clicks are append-only events in a separate analytics store"></div>

<h2>High-level design</h2>
<div data-diagram="arch" data-caption="Write path on the left, hot redirect path in the middle, analytics off to the side"></div>
<ol class="steps">
<li><strong>Edge / CDN</strong>: terminates TLS close to the user, can serve very hot redirects from edge cache, and applies coarse IP rate limits.</li>
<li><strong>Load balancer</strong> splits traffic between two stateless services. Separating them lets the redirect service scale to 100× the shorten service.</li>
<li><strong>Shorten service</strong>: validates the URL (scheme, length, malware blocklist), takes a code from its local batch of pre-generated keys (or validates the custom alias), and writes the row.</li>
<li><strong>Key generation service (KGS)</strong>: hands out batches of unused 7-char codes.</li>
<li><strong>Redirect service</strong>: looks up the code in Redis; on a miss reads the database and fills the cache; returns 302; publishes a click event to Kafka without waiting.</li>
<li><strong>Analytics consumers</strong> read Kafka, enrich (IP → country, user-agent → device), and write to a columnar store for dashboards.</li>
</ol>

<div data-diagram="shorten" data-caption="Shorten flow: the code comes from an in-memory batch, so the write path does no coordination"></div>

<h2>Deep dive 1: generating short codes</h2>
<p>This is the heart of the problem. There are three standard approaches. Know all three, and be ready to defend one.</p>

<div class="tabs">
<section data-tab="A. Hash + truncate">
<p>Compute <code>MD5(longUrl)</code> or <code>SHA-256(longUrl)</code>, take the first 42 bits (or the first 7 base62 characters of the encoded hash), and use that as the code.</p>
<ul>
<li><strong>Good</strong>: stateless; the same long URL always gives the same code, so you get de-duplication for free.</li>
<li><strong>Bad</strong>: truncation means <strong>collisions</strong>. Before every insert you must check whether the code exists. If it does and maps to a different URL, append a salt (e.g. a counter or the user id) and hash again.</li>
<li>How bad are collisions? When the table holds <em>n</em> codes out of N = 62<sup>7</sup>, a new random code collides with probability about n / N. After 5 years, n / N = 182.5B / 3.52T ≈ 5%, so 1 in 20 writes needs a retry. Workable, but every write costs a read plus a conditional write.</li>
<li>De-duplication is often <em>not</em> wanted: two users shortening the same URL usually want separate links with separate analytics. Then you hash <code>longUrl + userId</code> and lose the free de-dup anyway.</li>
</ul>
</section>
<section data-tab="B. Counter + base62">
<p>Keep a global, ever-increasing 64-bit counter. Each new link takes the next number and encodes it in base62 (exactly what the code below does). ID 125 becomes <code>21</code>; ID 3,521,614,606,207 becomes <code>ZZZZZZZ</code>.</p>
<ul>
<li><strong>Good</strong>: zero collisions by construction; short codes; simple.</li>
<li><strong>Bad</strong>: a single counter is a bottleneck and a single point of failure. Fix: give each app server a <strong>range</strong> (say 1 million IDs) from ZooKeeper or a ticket table, like Flickr's ticket servers. A server that crashes wastes the rest of its range, which is fine with 3.5 trillion codes.</li>
<li><strong>Bad</strong>: sequential codes are <strong>guessable</strong>. Anyone can try <code>6LAze</code>, <code>6LAzf</code>, ... and scrape private links. Fix: scramble the ID with a reversible permutation (for example multiply by a large odd constant modulo 62<sup>7</sup>, or a small Feistel cipher) before encoding.</li>
</ul>
</section>
<section data-tab="C. Key generation service">
<p>A separate KGS generates random 7-char codes ahead of time and stores them in a <code>keys</code> table marked unused. Each shorten server asks for a batch (say 1,000 keys), keeps them in memory, and uses one per request.</p>
<ul>
<li><strong>Good</strong>: no collision check on the write path, no coordination between app servers, codes look random.</li>
<li>The KGS must never hand the same key to two servers: move keys from <code>unused</code> to <code>used</code> in one transaction (or <code>SELECT ... FOR UPDATE SKIP LOCKED</code>) when handing out a batch.</li>
<li>If a server crashes, its unused in-memory keys are lost. That is acceptable: we lose a few thousand codes out of trillions.</li>
<li>KGS is a dependency, so replicate it (primary + standby). Because servers hold batches, a short KGS outage does not stop writes.</li>
<li>Storage: you do not pre-generate all 3.5 trillion keys (that would be 3.5T × 7 B ≈ 24.6 TB). Generate a few billion ahead and top up in the background.</li>
</ul>
</section>
</div>

<table>
<thead><tr><th>Criterion</th><th>Hash + truncate</th><th>Counter + base62</th><th>Pre-generated keys (KGS)</th></tr></thead>
<tbody>
<tr><td>Collisions</td><td>Yes, must check and retry</td><td>None</td><td>None (KGS guarantees)</td></tr>
<tr><td>Write-path cost</td><td>Read + conditional write, retries</td><td>One write (range fetch is rare)</td><td>One write</td></tr>
<tr><td>Coordination</td><td>None</td><td>Range allocator (ZooKeeper / DB)</td><td>KGS hands out batches</td></tr>
<tr><td>Guessable?</td><td>No</td><td>Yes, unless scrambled</td><td>No</td></tr>
<tr><td>Same URL → same code</td><td>Yes (if wanted)</td><td>No</td><td>No</td></tr>
<tr><td>Extra components</td><td>None</td><td>Counter / ZooKeeper</td><td>KGS + keys DB</td></tr>
<tr><td>Best when</td><td>Small scale, de-dup needed</td><td>Simple, internal tools</td><td>Large public service</td></tr>
</tbody>
</table>

<div class="callout interview"><strong>Say this in the interview</strong>"I will use a key generation service. Codes are random, so they are not guessable, there are no collisions to handle on the write path, and each app server only talks to KGS once every thousand writes. A counter with base62 is a fine simpler option; I would just scramble the IDs so they are not sequential. Hashing is my least favourite here because at 182 billion links about 5% of writes would collide."</div>

<h3>Code: base62 and a minimal shortener</h3>
<p>The code below implements base62 encode/decode and an in-memory service with the counter approach (starting at 100,000,000 so codes are at least 5 characters), custom aliases, and expiry checked lazily on read. Note how a generated code skips over any value already claimed as a custom alias.</p>
<div data-code="shortener"></div>

<h2>Deep dive 2: the redirect path</h2>
<p>At ~116K reads/s average and ~350K at peak, the database must not see most of these reads. Layer the caches:</p>
<ol class="steps">
<li><strong>Edge cache (CDN)</strong>: for the hottest links, cache the 302 response at the edge for a short time (say 60 s). Clicks are then served from a PoP in Mumbai or Chennai without touching our servers. Analytics come from CDN logs.</li>
<li><strong>Redis</strong>: cache-aside with key = code, value = long URL plus expiry. Eviction LRU. Set the cache TTL to <code>min(1 day, expiresAt - now)</code> so a cached entry never outlives the link.</li>
<li><strong>Database</strong>: only cache misses reach it. With a 90%+ hit rate, that is ~12K reads/s at average load spread across shards.</li>
</ol>
<div data-diagram="redirect" data-caption="Redirect flow: cache-aside lookup, 302 response, and a fire-and-forget click event"></div>
<ul>
<li><strong>Negative caching</strong>: bots hammer random codes. Cache "not found" for a short time (e.g. 5 minutes), or put a Bloom filter of existing codes in front of the DB, so misses do not hit the database.</li>
<li><strong>Thundering herd</strong>: when a viral link's cache entry expires, thousands of requests miss at once. Use request coalescing (one loader per key) or refresh hot keys before they expire.</li>
<li><strong>Read replicas</strong>: links are immutable after creation, so replica lag is harmless except for the first second after creation. Read your own write from the primary, or write-through to the cache on create.</li>
</ul>

<h2>Deep dive 3: analytics without slowing redirects</h2>
<p>Never write analytics synchronously on the redirect path. A slow analytics database would make every redirect slow.</p>
<ul>
<li>The redirect service emits a small event <code>{code, ts, ip, userAgent, referrer}</code> to <strong>Kafka</strong> asynchronously (buffered producer, fire-and-forget) and returns the 302 immediately.</li>
<li>Partition Kafka by <code>code</code> so all clicks for a link land on one partition, which makes per-link aggregation easy.</li>
<li>Stream consumers (Flink, Kafka Streams, or simple consumers) enrich the event: IP → country via a GeoIP database, user agent → device. They store raw events in a columnar store (ClickHouse, BigQuery) and keep per-minute rollups for fast dashboards.</li>
<li>Delivery is at-least-once, so counts can be slightly high after a consumer restart. That is acceptable for click analytics; if exact numbers matter, de-duplicate on an event id.</li>
<li>Privacy: hash or truncate IPs before storage; Indian DPDP and EU GDPR rules both apply to click data.</li>
</ul>

<h2>Deep dive 4: expiry and cleanup</h2>
<ul>
<li><strong>Lazy check on read</strong>: the redirect service compares <code>expires_at</code> with now and returns <code>410 Gone</code> (or 404). This alone gives correct behaviour.</li>
<li><strong>Background sweeper</strong>: a daily job deletes expired rows in small batches during off-peak hours (or use the database's native TTL: DynamoDB TTL, Cassandra TTL). This reclaims storage.</li>
<li><strong>Cache</strong>: cache TTL ≤ time to expiry, so the cache never serves an expired link.</li>
<li><strong>Do not recycle codes quickly</strong>. An old code printed on a poster now pointing to someone else's page is a phishing risk. With 3.5 trillion codes, recycling is unnecessary. If you must, return codes to the KGS pool only after a long grace period.</li>
<li>Anonymous links can get a default expiry (say 1 to 2 years) to cap storage growth.</li>
</ul>

<h2>Scaling and bottlenecks</h2>
<div data-diagram="shard" data-caption="Shard by a hash of the code; the redirect service routes each lookup to exactly one shard"></div>
<table>
<thead><tr><th>Bottleneck</th><th>Fix</th></tr></thead>
<tbody>
<tr><td>91 TB does not fit on one database</td><td>Shard by <code>hash(code)</code> with consistent hashing. Every redirect is a single-shard lookup. Avoid sharding by user id: redirects do not know the user.</td></tr>
<tr><td>Hot links (one celebrity link gets 50K clicks/s)</td><td>Hot keys live in Redis and at the CDN edge. Replicate very hot keys across Redis nodes or keep a tiny in-process LRU in each redirect server.</td></tr>
<tr><td>Global users, high latency from far regions</td><td>Edge redirects at the CDN; read replicas or a multi-region KV store (DynamoDB global tables) so each region reads locally.</td></tr>
<tr><td>Abuse: spam, phishing, scripted creation</td><td>Rate limit creation per API key / IP (see the "Design a Rate Limiter" problem), check URLs against Google Safe Browsing or a blocklist, CAPTCHA for anonymous users, and a takedown flag on the row.</td></tr>
<tr><td>Code enumeration / scraping</td><td>Random or scrambled codes, rate limits on 404s per IP, and not exposing private links via sequential IDs.</td></tr>
<tr><td>KGS outage</td><td>Batches buffered on each server, KGS standby, and alarms when the unused-key pool runs low.</td></tr>
<tr><td>Kafka or analytics outage</td><td>Redirects keep working; producer buffers locally and drops events if the buffer fills. Analytics are not on the critical path.</td></tr>
</tbody>
</table>

<h2>Trade-offs</h2>
<div class="grid-2">
<div class="card good"><strong>Choices that help</strong>
<ul>
<li>Separate shorten and redirect services: each scales on its own curve.</li>
<li>KGS: no collisions, no hot coordination point on writes.</li>
<li>302 + async analytics: accurate counts without slowing redirects.</li>
<li>KV store keyed by code: one-hop reads at any scale.</li>
</ul>
</div>
<div class="card bad"><strong>What we gave up</strong>
<ul>
<li>302 means more traffic than 301; we pay for it with CDN and cache.</li>
<li>No free de-dup: the same URL shortened twice gets two codes.</li>
<li>KGS is one more service to run and monitor.</li>
<li>Analytics are eventually consistent and may slightly over-count.</li>
</ul>
</div>
</div>

<h2>Follow-up questions</h2>
<div class="quiz">
<details><summary>Why 7 characters, and when would you move to 8?</summary><div>62<sup>7</sup> ≈ 3.52 trillion versus 182.5 billion links in 5 years, about 19× headroom. Move to 8 characters if growth projections approach a meaningful fraction of the space (say 30 to 50% used), because random-code collisions and KGS pool exhaustion get worse as the space fills. Codes of different lengths can coexist, so the switch needs no migration.</div></details>
<details><summary>Two users shorten the same long URL. Same code or different?</summary><div>Usually different. Each user wants their own analytics, expiry and ability to delete. If de-dup is required (to save storage), keep a secondary index <code>hash(longUrl, userId)</code> → code and return the existing code for the same user.</div></details>
<details><summary>How do you stop someone from guessing private links?</summary><div>Random codes (KGS) or scrambled counter IDs make neighbours meaningless; 62<sup>7</sup> is sparse (5% full after 5 years), so random guesses mostly miss. Add per-IP rate limits on 404 responses and alerting on scanning patterns. For truly private links, require auth on the redirect.</div></details>
<details><summary>The analytics team wants real-time click counts per link on a dashboard. How?</summary><div>Stream processing on the Kafka topic: a Flink or Kafka Streams job keyed by code keeps per-minute counts in memory and writes them to Redis or a time-series store. The dashboard reads those. Raw events still go to the columnar store for ad-hoc queries.</div></details>
<details><summary>Your Redis cluster goes down. What happens?</summary><div>Redirects fall through to the database. At ~116K reads/s that could overload it, so protect the DB with per-shard connection limits, a small in-process LRU in each redirect server, and the CDN edge cache. Bring Redis back with warm-up from the most-clicked codes in the analytics store.</div></details>
<details><summary>How would you support link editing (change the target URL)?</summary><div>Update the row, then delete the cache key (and purge the CDN entry). This is only safe because we use 302: with 301, browsers that cached the old redirect would never see the change.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2>
<ul>
<li>Do the maths: 100M/day → ~1.2K writes/s, ~116K reads/s, 182.5B links in 5 years, ~91 TB; 62<sup>7</sup> ≈ 3.5T so 7 characters.</li>
<li>Code generation is the core decision: hash (collisions), counter + base62 (guessable unless scrambled, needs ranges), or KGS (random, collision-free, recommended at scale).</li>
<li>Redirect is the hot path: CDN edge + Redis cache-aside + KV store sharded by code. Cache negatives and guard against thundering herds.</li>
<li>302 keeps analytics and expiry possible; 301 saves load but browsers cache it forever.</li>
<li>Analytics go through Kafka asynchronously so they never slow redirects.</li>
<li>Expiry: lazy check on read + background sweep; do not recycle codes.</li>
</ul>
</div>
`,
  code: {
    shortener: {
      title: "Base62 encode/decode + in-memory shortener (custom alias, expiry)",
      java: String.raw`import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

final class Base62 {
    static final String ALPHABET =
        "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    static final int BASE = 62;

    static String encode(long n) {
        if (n < 0) throw new IllegalArgumentException("n must be non-negative");
        if (n == 0) return String.valueOf(ALPHABET.charAt(0));
        StringBuilder sb = new StringBuilder();
        while (n > 0) {
            sb.append(ALPHABET.charAt((int) (n % BASE)));
            n /= BASE;
        }
        return sb.reverse().toString();
    }

    static long decode(String s) {
        long n = 0;
        for (char ch : s.toCharArray()) {
            int idx = ALPHABET.indexOf(ch);
            if (idx < 0) throw new IllegalArgumentException("invalid character: " + ch);
            n = n * BASE + idx;
        }
        return n;
    }
}

final class Shortener {
    private record Entry(String longUrl, long expiresAt) {} // expiresAt 0 = never

    private long nextId;
    private final Map<String, Entry> store = new HashMap<>();

    Shortener(long startId) { this.nextId = startId; } // start high so codes are >= 5 chars

    /** alias may be null (auto-generate); expiresAt 0 means never. */
    String shorten(String longUrl, String alias, long expiresAt) {
        String code;
        if (alias != null) {
            if (!alias.matches("[0-9A-Za-z]{4,16}"))
                throw new IllegalArgumentException("alias must be 4-16 alphanumeric chars");
            if (store.containsKey(alias))
                throw new IllegalArgumentException("alias already taken: " + alias);
            code = alias;
        } else {
            do {
                code = Base62.encode(nextId++);
            } while (store.containsKey(code)); // a custom alias may already own it
        }
        store.put(code, new Entry(longUrl, expiresAt));
        return code;
    }

    /** Returns the long URL, or empty if unknown or expired. */
    Optional<String> resolve(String code, long now) {
        Entry e = store.get(code);
        if (e == null) return Optional.empty();
        if (e.expiresAt() != 0 && now >= e.expiresAt()) {
            store.remove(code); // lazy cleanup on read
            return Optional.empty();
        }
        return Optional.of(e.longUrl());
    }
}

public class Main {
    public static void main(String[] args) {
        System.out.println(Base62.encode(125) + " " + Base62.decode(Base62.encode(125))); // 21 125
        long max7 = 1;
        for (int i = 0; i < 7; i++) max7 *= 62;
        System.out.println(Base62.encode(max7 - 1)); // ZZZZZZZ

        Shortener s = new Shortener(100_000_000L);
        String c1 = s.shorten("https://www.flipkart.com/big-billion-days", null, 0);
        String c2 = s.shorten("https://razorpay.com/docs", "rzpdocs", 0);
        String c3 = s.shorten("https://swiggy.com/offer", null, 1000);
        System.out.println(c1 + " " + s.resolve(c1, 0).orElse("NOT FOUND"));
        System.out.println(c2 + " " + s.resolve(c2, 0).orElse("NOT FOUND"));
        System.out.println(c3 + " " + s.resolve(c3, 999).orElse("NOT FOUND"));
        System.out.println(c3 + " " + s.resolve(c3, 1000).orElse("NOT FOUND"));
        try {
            s.shorten("https://example.com", "rzpdocs", 0);
        } catch (IllegalArgumentException e) {
            System.out.println("error: " + e.getMessage());
        }
    }
}`,
      python: String.raw`import time

ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
BASE = len(ALPHABET)  # 62
INDEX = {ch: i for i, ch in enumerate(ALPHABET)}


def encode(n: int) -> str:
    """Base62-encode a non-negative integer."""
    if n < 0:
        raise ValueError("n must be non-negative")
    if n == 0:
        return ALPHABET[0]
    out = []
    while n > 0:
        n, rem = divmod(n, BASE)
        out.append(ALPHABET[rem])
    return "".join(reversed(out))


def decode(s: str) -> int:
    n = 0
    for ch in s:
        if ch not in INDEX:
            raise ValueError(f"invalid character: {ch}")
        n = n * BASE + INDEX[ch]
    return n


class Shortener:
    """In-memory URL shortener: counter + base62, custom aliases, expiry."""

    def __init__(self, start_id: int = 100_000_000):
        self._next_id = start_id          # start high so codes are >= 5 chars
        self._store = {}                  # code -> (long_url, expires_at or None)

    def shorten(self, long_url, alias=None, expires_at=None):
        if alias is not None:
            if not alias.isalnum() or not (4 <= len(alias) <= 16):
                raise ValueError("alias must be 4-16 alphanumeric chars")
            if alias in self._store:
                raise ValueError(f"alias already taken: {alias}")
            code = alias
        else:
            code = encode(self._next_id)
            self._next_id += 1
            while code in self._store:    # a custom alias may already own it
                code = encode(self._next_id)
                self._next_id += 1
        self._store[code] = (long_url, expires_at)
        return code

    def resolve(self, code, now=None):
        """Return the long URL, or None if unknown or expired."""
        now = time.time() if now is None else now
        entry = self._store.get(code)
        if entry is None:
            return None
        long_url, expires_at = entry
        if expires_at is not None and now >= expires_at:
            del self._store[code]         # lazy cleanup on read
            return None
        return long_url


if __name__ == "__main__":
    print(encode(125), decode(encode(125)))      # 21 125
    print(encode(62 ** 7 - 1))                   # ZZZZZZZ (largest 7-char code)

    s = Shortener()
    c1 = s.shorten("https://www.flipkart.com/big-billion-days")
    c2 = s.shorten("https://razorpay.com/docs", alias="rzpdocs")
    c3 = s.shorten("https://swiggy.com/offer", expires_at=1000)
    print(c1, s.resolve(c1, now=0))
    print(c2, s.resolve(c2, now=0))
    print(c3, s.resolve(c3, now=999))            # still valid
    print(c3, s.resolve(c3, now=1000) or "NOT FOUND")  # expired
    try:
        s.shorten("https://example.com", alias="rzpdocs")
    except ValueError as e:
        print("error:", e)`,
      cpp: String.raw`#include <cstdint>
#include <iostream>
#include <optional>
#include <stdexcept>
#include <string>
#include <unordered_map>

const std::string ALPHABET =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
constexpr uint64_t BASE = 62;

std::string encode(uint64_t n) {
    if (n == 0) return std::string(1, ALPHABET[0]);
    std::string out;
    while (n > 0) {
        out.insert(out.begin(), ALPHABET[n % BASE]);
        n /= BASE;
    }
    return out;
}

uint64_t decode(const std::string& s) {
    uint64_t n = 0;
    for (char ch : s) {
        auto idx = ALPHABET.find(ch);
        if (idx == std::string::npos)
            throw std::invalid_argument(std::string("invalid character: ") + ch);
        n = n * BASE + idx;
    }
    return n;
}

class Shortener {
    struct Entry {
        std::string longUrl;
        int64_t expiresAt;  // unix millis; 0 means never
    };
    uint64_t nextId_;
    std::unordered_map<std::string, Entry> store_;

    static bool validAlias(const std::string& a) {
        if (a.size() < 4 || a.size() > 16) return false;
        for (char c : a)
            if (ALPHABET.find(c) == std::string::npos) return false;
        return true;
    }

public:
    explicit Shortener(uint64_t startId = 100000000) : nextId_(startId) {}

    // alias may be empty (auto-generate); expiresAt 0 means never.
    std::string shorten(const std::string& longUrl, const std::string& alias = "",
                        int64_t expiresAt = 0) {
        std::string code = alias;
        if (!alias.empty()) {
            if (!validAlias(alias))
                throw std::invalid_argument("alias must be 4-16 alphanumeric chars");
            if (store_.count(alias))
                throw std::invalid_argument("alias already taken: " + alias);
        } else {
            do {
                code = encode(nextId_++);
            } while (store_.count(code));  // a custom alias may already own it
        }
        store_[code] = Entry{longUrl, expiresAt};
        return code;
    }

    // Returns the long URL, or nullopt if unknown or expired.
    std::optional<std::string> resolve(const std::string& code, int64_t now) {
        auto it = store_.find(code);
        if (it == store_.end()) return std::nullopt;
        if (it->second.expiresAt != 0 && now >= it->second.expiresAt) {
            store_.erase(it);  // lazy cleanup on read
            return std::nullopt;
        }
        return it->second.longUrl;
    }
};

int main() {
    std::cout << encode(125) << " " << decode(encode(125)) << "\n";  // 21 125
    uint64_t max7 = 1;
    for (int i = 0; i < 7; i++) max7 *= 62;
    std::cout << encode(max7 - 1) << "\n";  // ZZZZZZZ

    Shortener s;
    auto c1 = s.shorten("https://www.flipkart.com/big-billion-days");
    auto c2 = s.shorten("https://razorpay.com/docs", "rzpdocs");
    auto c3 = s.shorten("https://swiggy.com/offer", "", 1000);
    std::cout << c1 << " " << s.resolve(c1, 0).value_or("NOT FOUND") << "\n";
    std::cout << c2 << " " << s.resolve(c2, 0).value_or("NOT FOUND") << "\n";
    std::cout << c3 << " " << s.resolve(c3, 999).value_or("NOT FOUND") << "\n";
    std::cout << c3 << " " << s.resolve(c3, 1000).value_or("NOT FOUND") << "\n";
    try {
        s.shorten("https://example.com", "rzpdocs");
    } catch (const std::invalid_argument& e) {
        std::cout << "error: " << e.what() << "\n";
    }
}`,
      javascript: String.raw`const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE = 62n;

// BigInt keeps us exact beyond 2^53 (62^9 already exceeds it).
function encode(n) {
  let x = BigInt(n);
  if (x < 0n) throw new Error("n must be non-negative");
  if (x === 0n) return ALPHABET[0];
  let out = "";
  while (x > 0n) {
    out = ALPHABET[Number(x % BASE)] + out;
    x /= BASE;
  }
  return out;
}

function decode(s) {
  let n = 0n;
  for (const ch of s) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("invalid character: " + ch);
    n = n * BASE + BigInt(i);
  }
  return n;
}

class Shortener {
  constructor(startId = 100000000) {
    this.nextId = startId;          // start high so codes are >= 5 chars
    this.store = new Map();         // code -> { longUrl, expiresAt }
  }

  shorten(longUrl, { alias = null, expiresAt = null } = {}) {
    let code;
    if (alias !== null) {
      if (!/^[0-9A-Za-z]{4,16}$/.test(alias)) throw new Error("alias must be 4-16 alphanumeric chars");
      if (this.store.has(alias)) throw new Error("alias already taken: " + alias);
      code = alias;
    } else {
      do {
        code = encode(this.nextId++);
      } while (this.store.has(code));   // a custom alias may already own it
    }
    this.store.set(code, { longUrl, expiresAt });
    return code;
  }

  // Returns the long URL, or null if unknown or expired.
  resolve(code, now = Date.now()) {
    const e = this.store.get(code);
    if (!e) return null;
    if (e.expiresAt !== null && now >= e.expiresAt) {
      this.store.delete(code);      // lazy cleanup on read
      return null;
    }
    return e.longUrl;
  }
}

// Demo
console.log(encode(125), decode(encode(125)).toString()); // 21 125
console.log(encode(62n ** 7n - 1n));                      // ZZZZZZZ

const s = new Shortener();
const c1 = s.shorten("https://www.flipkart.com/big-billion-days");
const c2 = s.shorten("https://razorpay.com/docs", { alias: "rzpdocs" });
const c3 = s.shorten("https://swiggy.com/offer", { expiresAt: 1000 });
console.log(c1, s.resolve(c1, 0));
console.log(c2, s.resolve(c2, 0));
console.log(c3, s.resolve(c3, 999));
console.log(c3, s.resolve(c3, 1000) ?? "NOT FOUND");
try {
  s.shorten("https://example.com", { alias: "rzpdocs" });
} catch (e) {
  console.log("error:", e.message);
}`,
      go: String.raw`package main

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
)

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
const base = uint64(len(alphabet)) // 62

// Encode converts a non-negative integer to base62.
func Encode(n uint64) string {
	if n == 0 {
		return string(alphabet[0])
	}
	var buf [11]byte // 62^11 > 2^64, so 11 digits always fit
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = alphabet[n%base]
		n /= base
	}
	return string(buf[i:])
}

// Decode converts a base62 string back to an integer.
func Decode(s string) (uint64, error) {
	var n uint64
	for _, ch := range s {
		idx := strings.IndexRune(alphabet, ch)
		if idx < 0 {
			return 0, fmt.Errorf("invalid character: %c", ch)
		}
		n = n*base + uint64(idx)
	}
	return n, nil
}

type entry struct {
	longURL   string
	expiresAt int64 // unix millis; 0 means never
}

// Shortener is an in-memory URL shortener (not thread-safe; add a mutex for real use).
type Shortener struct {
	nextID uint64
	store  map[string]entry
}

var aliasRe = regexp.MustCompile("^[0-9A-Za-z]{4,16}$")

func NewShortener(startID uint64) *Shortener {
	return &Shortener{nextID: startID, store: make(map[string]entry)}
}

// Shorten stores longURL. alias may be "" (auto-generate); expiresAt 0 means never.
func (s *Shortener) Shorten(longURL, alias string, expiresAt int64) (string, error) {
	code := alias
	if alias != "" {
		if !aliasRe.MatchString(alias) {
			return "", errors.New("alias must be 4-16 alphanumeric chars")
		}
		if _, taken := s.store[alias]; taken {
			return "", fmt.Errorf("alias already taken: %s", alias)
		}
	} else {
		for {
			code = Encode(s.nextID)
			s.nextID++
			if _, taken := s.store[code]; !taken { // a custom alias may already own it
				break
			}
		}
	}
	s.store[code] = entry{longURL, expiresAt}
	return code, nil
}

// Resolve returns the long URL, or ok=false if unknown or expired.
func (s *Shortener) Resolve(code string, now int64) (string, bool) {
	e, ok := s.store[code]
	if !ok {
		return "", false
	}
	if e.expiresAt != 0 && now >= e.expiresAt {
		delete(s.store, code) // lazy cleanup on read
		return "", false
	}
	return e.longURL, true
}

func show(url string, ok bool) string {
	if !ok {
		return "NOT FOUND"
	}
	return url
}

func main() {
	n, _ := Decode(Encode(125))
	fmt.Println(Encode(125), n) // 21 125
	var max7 uint64 = 1
	for i := 0; i < 7; i++ {
		max7 *= 62
	}
	fmt.Println(Encode(max7 - 1)) // ZZZZZZZ

	s := NewShortener(100_000_000) // start high so codes are >= 5 chars
	c1, _ := s.Shorten("https://www.flipkart.com/big-billion-days", "", 0)
	c2, _ := s.Shorten("https://razorpay.com/docs", "rzpdocs", 0)
	c3, _ := s.Shorten("https://swiggy.com/offer", "", 1000)
	fmt.Println(c1, show(s.Resolve(c1, 0)))
	fmt.Println(c2, show(s.Resolve(c2, 0)))
	fmt.Println(c3, show(s.Resolve(c3, 999)))
	fmt.Println(c3, show(s.Resolve(c3, 1000)))
	if _, err := s.Shorten("https://example.com", "rzpdocs", 0); err != nil {
		fmt.Println("error:", err)
	}
}`,
    },
  },
  diagrams: {
    arch: String.raw`flowchart LR
      U[Users] --> CDN["CDN / Edge"]
      CDN --> LB[Load balancer]
      LB -->|"POST /urls"| SS[Shorten service]
      LB -->|"GET /code"| RS[Redirect service]
      SS -->|key batch| KGS["Key generation service"]
      KGS --> KDB[(Keys DB)]
      SS --> DB[("URL store, sharded")]
      RS --> RC[("Redis cache")]
      RC -.->|miss| DB
      RS -->|click event| K[[Kafka]]
      K --> AC[Analytics consumers]
      AC --> OLAP[("ClickHouse")]`,
    er: String.raw`erDiagram
      USERS ||--o{ URLS : creates
      URLS ||--o{ CLICKS : receives
      USERS {
        bigint user_id PK
        string email
        string plan
      }
      URLS {
        string code PK
        string long_url
        bigint user_id FK
        timestamp created_at
        timestamp expires_at
      }
      CLICKS {
        string code FK
        timestamp clicked_at
        string country
        string device
        string referrer
      }`,
    shorten: String.raw`sequenceDiagram
      participant C as Client
      participant S as Shorten service
      participant K as KGS
      participant D as URL store
      C->>S: POST /urls (longUrl, alias?, expiresAt?)
      S->>S: validate URL, auth, rate limit
      alt custom alias
        S->>D: conditional insert(alias)
        D-->>S: ok or duplicate (409)
      else generated code
        opt local batch empty
          S->>K: get 1000 keys
          K-->>S: keys (marked used)
        end
        S->>D: insert(code, longUrl, expiresAt)
        D-->>S: ok
      end
      S-->>C: 201 shortUrl`,
    redirect: String.raw`sequenceDiagram
      participant B as Browser
      participant R as Redirect service
      participant C as Redis
      participant D as URL store
      participant Q as Kafka
      B->>R: GET /6LAze
      R->>C: GET 6LAze
      alt cache hit
        C-->>R: longUrl, expiresAt
      else cache miss
        C-->>R: nil
        R->>D: SELECT by code
        D-->>R: row
        R->>C: SET 6LAze with TTL
      end
      R->>R: check expiry
      R--)Q: click event (async)
      R-->>B: 302 Location longUrl`,
    shard: String.raw`flowchart TB
      RS[Redirect service] --> H{"hash(code) on ring"}
      H --> S1[("Shard 1")]
      H --> S2[("Shard 2")]
      H --> S3[("Shard 3")]
      H --> SN[("Shard N")]
      S1 --- R1[(Replica)]
      S2 --- R2[(Replica)]`,
  },
});
