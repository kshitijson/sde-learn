SD.register({
  id: "pastebin",
  html: String.raw`
<p class="lead">Pastebin lets you paste a block of text (a stack trace, a config file, a code snippet), get back a short link like <code>paste.example.com/aZ3kQ9xL</code>, and share it. It looks like a twin of the <a href="#/p/url-shortener">URL shortener</a>, and interviewers often ask it right after. The trap is to repeat the shortener answer. The interesting differences are that the payload is up to 10 MB instead of 200 bytes, so storage is dominated by blobs; that "unlisted" pastes are protected only by the secrecy of their key; and that most pastes expire, so cleanup is a first-class feature rather than an afterthought.</p>

<h2>Problem statement</h2>
<p>Design a service like Pastebin or GitHub Gist (single file). A user submits text and gets back a unique URL. Anyone with the URL can read the paste, subject to its visibility. The user can choose:</p>
<ul>
<li>an <strong>expiry</strong>: 10 minutes, 1 hour, 1 day, 1 week, 1 month, never, or "burn after reading";</li>
<li>a <strong>visibility</strong>: <em>public</em> (listed in "recent pastes" and searchable), <em>unlisted</em> (anyone with the link) or <em>private</em> (only the logged-in owner);</li>
<li>a <strong>language</strong> for syntax highlighting, which is done in the browser.</li>
</ul>
<p>Assume <strong>5 million new pastes per day</strong>, a <strong>10:1 read-to-write ratio</strong>, an average paste of <strong>10 KB</strong>, a hard limit of <strong>10 MB</strong>, and that we keep data for up to <strong>5 years</strong>.</p>

<div class="callout tip"><strong>Try it first</strong>Before reading on, spend 15 minutes and write down: (1) the storage you need per day and over 5 years, (2) where the paste text physically lives, (3) how long the key must be so that nobody can guess an unlisted paste, and (4) how an expired paste actually gets deleted. Then list three ways this design differs from the URL shortener.</div>

<details class="hint"><summary>Hint 1: where does the text go?</summary>
<p>Ten kilobytes on average, ten megabytes at worst. Would you put a 10 MB value in a database row? What is the usual home for large, immutable, write-once blobs? And is it worth a separate network call for a 300-byte paste?</p>
</details>
<details class="hint"><summary>Hint 2: the key is a password</summary>
<p>An unlisted paste has no access check. The only thing stopping a stranger from reading it is that they do not know the key. What does that say about sequential IDs, and about how long the key must be?</p>
</details>
<details class="hint"><summary>Hint 3: who deletes expired pastes?</summary>
<p>Correctness and cleanup are two separate problems. A read can refuse an expired paste on its own. Reclaiming the bytes can happen later, in the background, and you have at least three tools for it.</p>
</details>
<details class="hint"><summary>Hint 4: popular pastes</summary>
<p>Paste content never changes after creation. What does immutability let a CDN do, and what has to happen when a paste expires or is deleted?</p>
</details>

<h2>Requirements</h2>
<div class="grid-2">
<div class="card">
<h3>Functional</h3>
<ul>
<li><strong>Create</strong> a paste (text up to 10 MB) and get a unique URL.</li>
<li><strong>Read</strong> a paste by its key, both a rendered page and a <code>/raw</code> view.</li>
<li><strong>Expiry</strong>: fixed TTL, never, or burn-after-read.</li>
<li><strong>Visibility</strong>: public, unlisted, private.</li>
<li><strong>Delete</strong> your own paste.</li>
<li>Optional: user accounts and "my pastes", a "recent public pastes" feed, abuse reporting.</li>
<li>Out of scope: editing pastes (treat them as immutable), comments, full-text search across all pastes.</li>
</ul>
</div>
<div class="card">
<h3>Non-functional</h3>
<ul>
<li><strong>Read-heavy and low latency</strong>: p99 under ~100 ms for small pastes.</li>
<li><strong>Durable</strong>: a paste must not be lost before it expires.</li>
<li><strong>Highly available</strong> reads (99.9% or better).</li>
<li><strong>Unguessable keys</strong>: unlisted pastes must not be discoverable by enumeration.</li>
<li><strong>Abuse resistant</strong>: rate limits, size limits, takedowns.</li>
<li>Expiry can be slightly late for storage purposes, but a read must <strong>never return an expired paste</strong>.</li>
</ul>
</div>
</div>

<div class="callout interview"><strong>Say this in the interview</strong>"I will treat pastes as immutable blobs with a small metadata record. The core flows are create and read; expiry and visibility are part of the core because they change how I store and serve data. Edits, comments and global search are out of scope. Reads are about ten times writes, so I will optimise the read path with a CDN and a cache. Is 5 million pastes a day and 10 KB average the right ballpark?"</div>

<h2>How it differs from the URL shortener</h2>
<p>Say this early. It shows the interviewer you are not reciting a memorised answer.</p>
<table>
<thead><tr><th>Aspect</th><th>URL shortener</th><th>Pastebin</th></tr></thead>
<tbody>
<tr><td>Payload</td><td>~200 B long URL</td><td>avg 10 KB, up to 10 MB of text</td></tr>
<tr><td>Where the payload lives</td><td>In the DB row</td><td>Metadata in DB, content in object storage (small pastes inline)</td></tr>
<tr><td>Read:write</td><td>~100:1</td><td>~10:1</td></tr>
<tr><td>Response</td><td>302 redirect</td><td>The content itself (bandwidth matters)</td></tr>
<tr><td>Key length</td><td>7 chars is enough</td><td>8+ random chars: the key is the only lock on unlisted pastes</td></tr>
<tr><td>Expiry</td><td>Optional, rare</td><td>Common; many pastes live minutes or days</td></tr>
<tr><td>Bottleneck</td><td>QPS on tiny lookups</td><td>Storage size and egress bandwidth</td></tr>
<tr><td>Abuse</td><td>Phishing links</td><td>Leaked credentials, malware payloads, doxxing</td></tr>
</tbody>
</table>

<h2>Capacity estimation</h2>
<p>Round a day to ~10<sup>5</sup> seconds for mental maths, then refine with 86,400.</p>
<table>
<thead><tr><th>Quantity</th><th>Arithmetic</th><th>Result</th></tr></thead>
<tbody>
<tr><td>Write QPS</td><td>5M / 86,400 s</td><td><strong>~58 /s</strong> (peak ×3 ≈ 175 /s)</td></tr>
<tr><td>Read QPS</td><td>58 × 10</td><td><strong>~580 /s</strong> (peak ≈ 1,750 /s)</td></tr>
<tr><td>New content per day</td><td>5M × 10 KB</td><td><strong>50 GB/day</strong></td></tr>
<tr><td>Content per year</td><td>50 GB × 365</td><td><strong>~18 TB/year</strong></td></tr>
<tr><td>Content over 5 years (nothing expires)</td><td>18.25 TB × 5</td><td><strong>~91 TB</strong> upper bound</td></tr>
<tr><td>Metadata per paste</td><td>key, owner, timestamps, size, visibility, language, blob ref</td><td>~300 B</td></tr>
<tr><td>Metadata over 5 years</td><td>5M × 365 × 5 × 300 B</td><td>9.1B rows × 300 B ≈ <strong>2.7 TB</strong></td></tr>
<tr><td>Read egress</td><td>580 /s × 10 KB</td><td>~5.8 MB/s avg, ~17 MB/s (≈ 140 Mbps) at peak</td></tr>
<tr><td>Write ingress</td><td>58 /s × 10 KB</td><td>~0.6 MB/s</td></tr>
</tbody>
</table>
<p>QPS is tiny. One well-sized server could handle it. The real numbers to respect are <mark>storage (tens of TB)</mark> and <mark>egress</mark> when a paste goes viral. In practice most pastes expire (say 60% within a month), so real storage is a fraction of 91 TB, but you design for the upper bound.</p>

<h3>Inline or blob? Do the split</h3>
<p>Paste sizes are skewed: many are a few lines, a few are huge logs. Assume 80% of pastes are under 8 KB (average 2 KB) and 20% are larger (average 42 KB). Check: 0.8 × 2 + 0.2 × 42 = 1.6 + 8.4 = 10 KB average. Then:</p>
<ul>
<li>Inline in the DB: 5M × 0.8 × 2 KB = <strong>8 GB/day</strong> (~2.9 TB/year).</li>
<li>In object storage: 5M × 0.2 × 42 KB = <strong>42 GB/day</strong>, but only 1M objects/day.</li>
</ul>
<p>So 80% of reads never touch object storage, and the store holds fewer, bigger objects, which is what it is good at. Each S3-style GET has ~20 to 50 ms time-to-first-byte and a per-request price, so skipping it for small pastes saves both.</p>

<h3>Key length</h3>
<p>Over 5 years we create 5M × 365 × 5 ≈ <strong>9.1 billion</strong> pastes. 62<sup>6</sup> = 56.8 billion would hold them, but the space would be 16% full, so one random guess in six hits <em>someone's</em> unlisted paste. That is unacceptable when the key is the only protection. With 8 characters, 62<sup>8</sup> ≈ 218 trillion, and 9.1B / 218T ≈ 0.004%: a scraper needs about 24,000 guesses per hit, and rate limits make that impractical. Go to 10 characters if pastes are sensitive.</p>

<p>Try these numbers in the estimator. Set 5M writes/day, 10:1 reads, 10 KB per item and 5 years.</p>
<div data-widget="estimator"></div>

<h2>API design</h2>
<pre><code>POST /api/v1/pastes
Authorization: Bearer &lt;token&gt;        (optional; anonymous allowed with stricter limits)
{
  "content":    "Exception in thread main ...",
  "language":   "java",                   // only a hint for client-side highlighting
  "visibility": "unlisted",               // public | unlisted | private
  "expiresIn":  "1d",                      // 10m | 1h | 1d | 1w | 1M | never | burn
  "title":      "NPE in checkout"
}
201 Created
{ "key": "aZ3kQ9xL", "url": "https://paste.example.com/aZ3kQ9xL", "expiresAt": "2026-11-12T10:00:00Z" }
413 Payload Too Large     content over 10 MB
429 Too Many Requests     over rate limit

GET  /api/v1/pastes/{key}        metadata + content (JSON), or 404 / 410
GET  /raw/{key}                  text/plain body, CDN cacheable when public/unlisted
DELETE /api/v1/pastes/{key}      owner only
GET  /api/v1/pastes?visibility=public&amp;cursor=...   recent public feed (paginated)</code></pre>
<ul>
<li>A private paste returns <strong>404 to strangers, not 403</strong>. A 403 would confirm that the key exists.</li>
<li>For large pastes, a two-step upload is better: <code>POST</code> returns a <strong>presigned upload URL</strong> and the client PUTs the text straight to object storage, then calls <code>POST /pastes/{key}/complete</code>. App servers never buffer 10 MB bodies. See <a href="#/p/object-storage">Blob / Object Storage</a>.</li>
<li>Syntax highlighting stays in the browser (Prism, highlight.js). The server stores only the <code>language</code> string. This saves CPU on every read and keeps the stored bytes and the <code>/raw</code> view identical.</li>
</ul>

<h2>Data model</h2>
<pre><code>pastes  (metadata DB: sharded MySQL/Postgres, or DynamoDB/Cassandra)
  paste_key     CHAR(8)      PRIMARY KEY
  owner_id      BIGINT       NULL          -- null = anonymous
  visibility    TINYINT                    -- 0 public, 1 unlisted, 2 private
  language      VARCHAR(32)
  title         VARCHAR(200)
  size_bytes    INT
  content       TEXT         NULL          -- inline if size &lt;= 8 KB
  blob_ref      VARCHAR(128) NULL          -- e.g. s3://pastes/2026/11/11/aZ3kQ9xL
  created_at    TIMESTAMP
  expires_at    TIMESTAMP    NULL          -- null = never
  burn_after_read BOOLEAN
  status        TINYINT                    -- active, pending_upload, taken_down

index: (owner_id, created_at)              -- "my pastes"
index: (expires_at)                        -- sweeper scans this
public_feed: (bucket by hour, created_at) -&gt; paste_key   -- only public pastes</code></pre>
<p>Exactly one of <code>content</code> and <code>blob_ref</code> is set. The access pattern is a key lookup, so either a key-value store or a sharded relational DB works. A relational DB makes the secondary indexes (owner, expiry) easy; DynamoDB gives native TTL and effortless scaling. Both are fine if you can say why. See <a href="#/p/sql-vs-nosql">SQL vs NoSQL</a>.</p>
<div data-diagram="er" data-caption="Metadata rows point to an object only when the paste is too big to keep inline"></div>

<h2>High-level design</h2>
<div data-diagram="arch" data-caption="Pastebin: metadata in a database, large content in object storage, hot reads served by the CDN"></div>
<ol class="steps">
<li><strong>CDN</strong> in front of <code>/raw/{key}</code> and the rendered page. It absorbs viral pastes and blocks oversized bodies early.</li>
<li><strong>API gateway</strong>: auth, rate limits per IP and per user, request size limit (413 above 10 MB).</li>
<li><strong>Paste service</strong> (stateless): generates the key, writes metadata, writes small content inline or large content to object storage, and serves reads.</li>
<li><strong>Cache</strong> (Redis): metadata + inline content for hot keys. Large content is not cached in Redis; the CDN handles it.</li>
<li><strong>Metadata DB</strong>, sharded by <code>hash(paste_key)</code>.</li>
<li><strong>Object storage</strong> (S3, GCS, MinIO) for content above 8 KB, with lifecycle rules for expiry.</li>
<li><strong>Cleanup workers</strong> delete expired rows and blobs; an <strong>abuse scanner</strong> consumes "paste created" events from a queue.</li>
</ol>

<div data-diagram="create" data-caption="Create: small pastes are one DB write; large ones upload the blob first, then commit metadata"></div>

<h2>Deep dive 1: content in object storage vs the database</h2>
<div class="tabs">
<section data-tab="All in the DB">
<p>Store the whole text in a <code>TEXT</code>/<code>BLOB</code> column.</p>
<ul>
<li><strong>Good</strong>: one write, one read, transactional, simplest.</li>
<li><strong>Bad</strong>: 91 TB in a database is expensive (SSD, replicated 3×, backed up). Big rows bloat the buffer pool, slow replication and backups, and a 10 MB row hurts the whole shard.</li>
</ul>
</section>
<section data-tab="All in object storage">
<p>DB holds only metadata; every paste is an object.</p>
<ul>
<li><strong>Good</strong>: cheap (about a tenth of database SSD cost per GB), 11 nines durability, lifecycle rules, direct CDN origin.</li>
<li><strong>Bad</strong>: every read is two hops (DB then S3). Tiny objects pay per-request cost and 20 to 50 ms first-byte latency for 300 bytes of text.</li>
</ul>
</section>
<section data-tab="Hybrid (recommended)">
<p>Inline if ≤ 8 KB, object storage otherwise.</p>
<ul>
<li><strong>Good</strong>: 80% of pastes are one DB read; 84% of bytes (42 of 50 GB/day) live in cheap storage.</li>
<li><strong>Bad</strong>: two code paths. Keep them behind one <code>ContentStore</code> interface so the rest of the service does not care.</li>
<li><strong>Ordering</strong> on create: upload the blob first, then commit metadata. If the DB write fails, you leave an orphan blob, which a lifecycle rule or GC job removes. The reverse order could leave a metadata row pointing at nothing.</li>
</ul>
</section>
</div>
<div class="callout interview"><strong>Say this in the interview</strong>"Metadata goes in a database because I need lookups by key, owner and expiry. Content above 8 KB goes to S3, because storing tens of terabytes of immutable blobs in a database is the wrong cost and durability trade-off. Small pastes stay inline to avoid a second network hop on most reads. I upload the blob before writing the row, so a failure leaves an orphan blob, never a dangling pointer."</div>

<h3>Optional: de-duplicate by content hash</h3>
<p>Store blobs under <code>sha256(content)</code> instead of the paste key. Identical pastes (the same popular config file) share one object. The catch is deletion: you need a reference count, and decrementing it safely across expiries is real work. Mention it, then say you would only do it if analysis showed many duplicates.</p>

<h2>Deep dive 2: key generation</h2>
<p>Reuse the thinking from the <a href="#/p/url-shortener">URL shortener</a>, but the answer changes:</p>
<ul>
<li><strong>Counter + base62</strong>: rejected. Sequential keys let anyone walk through every unlisted paste. Scrambling helps, but random is simpler.</li>
<li><strong>Hash of content</strong>: rejected. The same content gives the same key, so posting a guessed secret reveals whether it already exists, and two users' pastes would collide.</li>
<li><strong>Random 8 chars + conditional insert</strong>: chosen. Generate 8 characters from a cryptographically secure random source and insert with "fail if key exists". On conflict, retry with a new key.</li>
</ul>
<p>Why no key generation service here? At 58 writes/s and a space only 0.004% full, the chance of a collision is about 1 in 24,000 per write: roughly one retry every 7 minutes across the whole system. A conditional insert already is the uniqueness check. A KGS would add a component to protect against a problem we do not have. The shortener needed one at 1,160 writes/s with a space 5% full; here it is overkill.</p>
<div class="callout info"><strong>Say why, not just what</strong>Interviewers like it when you reuse a pattern and then explain why the numbers make a simpler choice good enough. "Same idea, different scale, different answer" is an SDE 2 signal.</div>

<h3>Code: an in-memory paste service</h3>
<p>The code below models the important ideas: random base62 keys with collision retry, small content inline and large content in a separate "blob store", lazy expiry on read, a visibility check that answers "not found" to strangers, and a sweeper. The demo uses a fixed clock and a seeded random generator so the output is reproducible. The last part uses a 1-character key (only 62 keys) to force collisions and show the retry loop. In production use <code>SecureRandom</code>, <code>secrets</code>, <code>crypto.randomInt</code> or <code>crypto/rand</code>.</p>
<div data-code="paste"></div>
<p>Expected output (the same in all five languages):</p>
<pre><code>created I7712R58 inline NV3dKMIP inline OTeWqjBt blob
t=1030 alice paste: print('hello')
t=1030 bob paste as eve: NOT FOUND
t=1030 bob paste as bob: db_password=hunter2
t=1030 carol paste: 100000 bytes
t=1060 alice paste: NOT FOUND | stored: 2
sweep at t=4600 removed: 1 | stored: 1 | blobs: 0
tiny key space: stored 30 collisions retried 9</code></pre>

<h2>Deep dive 3: the read path and the CDN</h2>
<div data-diagram="read" data-caption="Read: CDN first, then cache, then DB, then object storage only for large pastes"></div>
<ul>
<li><strong>Immutability is the gift.</strong> A paste never changes, so a CDN can cache <code>/raw/{key}</code> with no invalidation worries, except for expiry and deletion.</li>
<li><strong>Cache TTL ≤ remaining lifetime.</strong> Send <code>Cache-Control: public, max-age = min(86400, expiresAt − now)</code>. A paste expiring in 10 minutes is cached for at most 10 minutes.</li>
<li><strong>Deletes and takedowns</strong> need an explicit CDN purge by URL. Purges take seconds to propagate, so a just-deleted paste can be visible briefly at the edge. Say this trade-off out loud.</li>
<li><strong>Private pastes are never cached publicly</strong>: <code>Cache-Control: private, no-store</code>, served by the paste service after an auth check. Large private content can be streamed through, or the service returns a short-lived presigned S3 URL (60 s).</li>
<li><strong>Burn-after-read</strong> is not cacheable at all, and the read must be an atomic "fetch and delete" (a conditional delete in the DB) so two simultaneous readers cannot both see it.</li>
<li><strong>Viral paste</strong>: a 1 MB log linked from a big forum gets 5,000 reads/s. That is 5 GB/s of egress, which only a CDN should serve. Our origin sees one fetch per edge location per TTL.</li>
</ul>
<p>Read more in <a href="#/p/cdn">CDNs &amp; Edge Caching</a> and <a href="#/p/caching">Caching</a>.</p>

<h2>Deep dive 4: expiry and cleanup</h2>
<p>Split it into two problems: <strong>correctness</strong> (never serve an expired paste) and <strong>reclamation</strong> (free the storage eventually).</p>
<table>
<thead><tr><th>Technique</th><th>How</th><th>Strength</th><th>Weakness</th></tr></thead>
<tbody>
<tr><td>Lazy deletion on read</td><td>Compare <code>expires_at</code> with now on every read; return 410 and delete</td><td>Always correct; zero extra jobs</td><td>Pastes nobody reads again are never deleted</td></tr>
<tr><td>Database TTL</td><td>DynamoDB TTL, Cassandra TTL, MongoDB TTL index on <code>expires_at</code></td><td>No code; the DB removes rows in the background</td><td>Deletion is delayed (DynamoDB: often hours, up to a couple of days); does not delete S3 blobs by itself</td></tr>
<tr><td>Object lifecycle rules</td><td>Write blobs under prefixes by TTL class, e.g. <code>ttl-1d/</code>, <code>ttl-1w/</code>, <code>ttl-1M/</code>, with a rule "expire objects in <code>ttl-1d/</code> after 2 days"</td><td>Storage cleans itself; no list operations</td><td>Granularity is days; only for fixed TTL classes</td></tr>
<tr><td>Sweeper job</td><td>Every few minutes: <code>SELECT key, blob_ref FROM pastes WHERE expires_at &lt; now LIMIT 1000</code> via the expiry index, delete blob then row, repeat</td><td>Precise, handles blobs and DB together</td><td>Extra load; must be batched and throttled; needs leader election or sharding of work</td></tr>
</tbody>
</table>
<div data-diagram="expiry" data-caption="Expiry: lazy check guarantees correctness; TTL, lifecycle rules and a sweeper reclaim space"></div>
<div class="callout interview"><strong>Say this in the interview</strong>"Every read checks <code>expires_at</code>, so correctness never depends on cleanup. For space, I use the DB's native TTL for metadata, and S3 lifecycle rules for blobs by writing them under per-TTL prefixes. A small sweeper catches what those miss, for example 'never' pastes that were later deleted, and orphan blobs from failed creates. CDN max-age is capped at the remaining lifetime."</div>
<ul>
<li>Do not reuse keys of expired pastes soon. An old link in a chat should return 410, not someone else's text.</li>
<li>Run the sweeper per shard, each worker owning a set of shards, so there is no global scan and no double deletion.</li>
<li>Deleting the blob before the row is safe (the lazy check already hides it); the reverse order leaks blobs.</li>
</ul>

<h2>Deep dive 5: abuse and rate limiting</h2>
<p>Pastebin sites are a favourite place to dump leaked passwords, API keys and malware scripts. This is a real operational problem, so give it a minute.</p>
<ul>
<li><strong>Rate limits</strong> on create: e.g. 10 pastes/minute per anonymous IP, 100/minute per logged-in user, using a token bucket at the gateway. See <a href="#/p/rate-limiter">Design a Rate Limiter</a>.</li>
<li><strong>Size limits</strong> enforced at the edge (reject bodies over 10 MB before they reach app servers) and a daily byte quota per user.</li>
<li><strong>Read rate limits on 404s</strong> per IP: a scraper guessing keys produces a stream of 404s; block it.</li>
<li><strong>Async content scanning</strong>: publish a <code>paste.created</code> event to a queue; scanners look for secrets (AWS keys, GitHub tokens), malware signatures, and personal data. Matches are taken down (status flag + CDN purge) and, for leaked tokens, reported to the issuer. GitHub's secret scanning works this way.</li>
<li><strong>CAPTCHA</strong> for anonymous users after a few pastes; <strong>report button</strong> feeding a moderation queue.</li>
<li><strong>Public feed</strong> only lists public pastes and can be delayed by a few minutes so the scanner runs first.</li>
</ul>

<h2>Scaling and bottlenecks</h2>
<table>
<thead><tr><th>Bottleneck</th><th>Fix</th></tr></thead>
<tbody>
<tr><td>Metadata grows to billions of rows</td><td>Shard by <code>hash(paste_key)</code> (<a href="#/p/sharding">sharding</a>); reads are single-shard. "My pastes" uses a secondary index table keyed by owner.</td></tr>
<tr><td>Tens of TB of content</td><td>Object storage with lifecycle rules; move cold pastes older than 90 days to an infrequent-access tier.</td></tr>
<tr><td>Viral paste egress</td><td>CDN with max-age capped by expiry; request coalescing at the origin.</td></tr>
<tr><td>Large uploads tie up app servers</td><td>Presigned direct upload to object storage; app servers handle only metadata.</td></tr>
<tr><td>Hot DB shard from the public feed</td><td>Feed table bucketed by hour, cached for 30 to 60 s; it does not need to be real-time.</td></tr>
<tr><td>Region outage</td><td>Cross-region replication of object storage and DB replicas; reads can be served from the replica region.</td></tr>
<tr><td>Scraping and spam</td><td>Rate limits, 8+ char random keys, CAPTCHA, async scanning.</td></tr>
</tbody>
</table>

<h2>Trade-offs</h2>
<div class="grid-2">
<div class="card good"><strong>Choices that help</strong>
<ul>
<li>Hybrid storage: cheap for big pastes, one hop for small ones.</li>
<li>Random 8-char keys with conditional insert: unguessable and no extra service.</li>
<li>Immutable content: easy CDN caching.</li>
<li>Lazy expiry + background cleanup: correct and cheap.</li>
<li>Client-side highlighting: zero render cost on the server.</li>
</ul>
</div>
<div class="card bad"><strong>What we gave up</strong>
<ul>
<li>Two storage systems and an ordering rule between them.</li>
<li>Storage is reclaimed late (hours to days after expiry).</li>
<li>CDN purges are not instant; deleted pastes may linger at the edge for seconds.</li>
<li>No edits: changing a paste means creating a new one.</li>
<li>No dedup by default, so popular identical pastes are stored many times.</li>
</ul>
</div>
</div>

<h2>Follow-up questions</h2>
<div class="quiz">
<details><summary>Why not just reuse the URL shortener's KGS for keys?</summary><div>You could, but it is not needed. At ~58 writes/s with an 8-char random space only 0.004% full, a conditional insert collides about once per 24,000 writes. A retry is cheaper than running and monitoring a separate service. KGS pays off when writes are high and the space is filling up.</div></details>
<details><summary>How would you support editing a paste?</summary><div>Make versions immutable: each edit writes a new blob (<code>key/v2</code>) and bumps a <code>current_version</code> in metadata. The CDN caches versioned URLs forever; only the small "latest" pointer needs purging. This also gives edit history like GitHub Gist revisions.</div></details>
<details><summary>How do you implement burn-after-read correctly with two simultaneous readers?</summary><div>Make the read a conditional delete: <code>DELETE ... WHERE key = ? AND status = 'active' RETURNING content</code> (or DynamoDB <code>DeleteItem</code> with <code>ReturnValues=ALL_OLD</code> and a condition). Only one caller gets the row. Never cache such pastes at the CDN or in Redis.</div></details>
<details><summary>A paste contains a leaked AWS key. What should the system do?</summary><div>The async scanner detects it, sets status to <code>taken_down</code>, purges the CDN and cache, and notifies the cloud provider so the key gets revoked. The 404/410 is served from the status flag. Because scanning is asynchronous, the public feed delays new public pastes by a few minutes to give the scanner a head start.</div></details>
<details><summary>Can you serve large pastes without the paste service in the data path?</summary><div>Yes. For public and unlisted pastes, point the CDN at object storage (origin access restricted to the CDN). For private ones, the service checks auth and returns a presigned GET URL valid for ~60 s; the browser fetches the bytes directly.</div></details>
<details><summary>Would you compress pastes?</summary><div>Yes: text compresses 3 to 10× with gzip or zstd. Compress before storing (store <code>Content-Encoding</code> in metadata) and let the CDN serve compressed bytes to browsers that accept them. That cuts both the storage bill and egress, which are this system's real costs.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2>
<ul>
<li>5M pastes/day is only ~58 writes/s and ~580 reads/s; the hard parts are 50 GB/day of storage and egress spikes.</li>
<li>Metadata in a DB, content above ~8 KB in object storage, small pastes inline. Upload the blob before committing the row.</li>
<li>For unlisted pastes the key is the password: use 8+ random characters from a secure source. 62<sup>8</sup> ≈ 218 trillion keeps the space nearly empty.</li>
<li>Conditional insert + retry is enough at this write rate; a KGS is not needed.</li>
<li>Immutability makes CDN caching easy; cap max-age at the remaining lifetime and purge on delete. Never cache private or burn-after-read pastes publicly.</li>
<li>Expiry = lazy check for correctness + DB TTL, lifecycle rules and a sweeper for space.</li>
<li>Abuse is a first-class concern: rate limits, size limits, async secret scanning, takedowns.</li>
</ul>
</div>
`,
  code: {
    paste: {
      title: "In-memory paste service: random keys with retry, inline vs blob, lazy expiry, sweeper",
      java: String.raw`import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

enum Visibility { PUBLIC, UNLISTED, PRIVATE }

/** Tiny seeded PRNG so the demo is deterministic. Use SecureRandom in production. */
final class MinStd {
    private long state;
    MinStd(long seed) { state = seed; }
    long next() { state = state * 48271 % 2147483647L; return state; }
}

final class Paste {
    final String owner;
    final Visibility visibility;
    final long createdAt, expiresAt; // expiresAt 0 = never
    final int size;
    final String inline;             // content if small, null if it lives in the blob store

    Paste(String owner, Visibility v, long createdAt, long expiresAt, int size, String inline) {
        this.owner = owner; this.visibility = v; this.createdAt = createdAt;
        this.expiresAt = expiresAt; this.size = size; this.inline = inline;
    }
    boolean expired(long now) { return expiresAt != 0 && now >= expiresAt; }
}

final class PasteService {
    static final String ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    static final int MAX_BYTES = 10 * 1024 * 1024; // 10 MB hard limit
    static final int INLINE_LIMIT = 8 * 1024;     // <= 8 KB stays in the metadata row
    static final int MAX_RETRIES = 10;

    private final MinStd rng;
    private final int keyLength;
    final Map<String, Paste> meta = new HashMap<>();   // the "database"
    final Map<String, String> blobs = new HashMap<>(); // the "object store" (S3)
    int collisions = 0;

    PasteService(long seed, int keyLength) { this.rng = new MinStd(seed); this.keyLength = keyLength; }

    private String randomKey() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < keyLength; i++) sb.append(ALPHABET.charAt((int) (rng.next() % 62)));
        return sb.toString();
    }

    String create(String owner, String content, long ttlSeconds, Visibility v, long now) {
        int size = content.getBytes(StandardCharsets.UTF_8).length;
        if (size > MAX_BYTES) throw new IllegalArgumentException("paste too large");
        for (int i = 0; i < MAX_RETRIES; i++) {
            String key = randomKey();
            if (meta.containsKey(key)) { collisions++; continue; } // real DB: conditional insert fails
            long expiresAt = ttlSeconds > 0 ? now + ttlSeconds : 0;
            if (size <= INLINE_LIMIT) {
                meta.put(key, new Paste(owner, v, now, expiresAt, size, content));
            } else {
                blobs.put(key, content); // upload blob first, then write metadata
                meta.put(key, new Paste(owner, v, now, expiresAt, size, null));
            }
            return key;
        }
        throw new IllegalStateException("could not find a free key");
    }

    /** Returns the content, or null if missing, expired or not visible to this viewer. */
    String get(String key, String viewer, long now) {
        Paste p = meta.get(key);
        if (p == null) return null;
        if (p.expired(now)) { delete(key); return null; }            // lazy expiry on read
        if (p.visibility == Visibility.PRIVATE && !viewer.equals(p.owner)) return null; // 404, not 403
        return p.inline != null ? p.inline : blobs.get(key);
    }

    int sweep(long now) {
        List<String> expired = new ArrayList<>();
        for (Map.Entry<String, Paste> e : meta.entrySet())
            if (e.getValue().expired(now)) expired.add(e.getKey());
        for (String k : expired) delete(k);
        return expired.size();
    }

    String tier(String key) { return meta.get(key).inline != null ? "inline" : "blob"; }

    private void delete(String key) { meta.remove(key); blobs.remove(key); }
}

public class Main {
    static String show(String c) {
        if (c == null) return "NOT FOUND";
        return c.length() <= 20 ? c : c.length() + " bytes";
    }

    public static void main(String[] args) {
        PasteService svc = new PasteService(42, 8);
        long now = 1000; // fixed clock (seconds)
        String a = svc.create("alice", "print('hello')", 60, Visibility.PUBLIC, now);
        String b = svc.create("bob", "db_password=hunter2", 0, Visibility.PRIVATE, now);
        String c = svc.create("carol", "x".repeat(100000), 3600, Visibility.UNLISTED, now);
        System.out.println("created " + a + " " + svc.tier(a) + " " + b + " " + svc.tier(b) + " " + c + " " + svc.tier(c));

        System.out.println("t=1030 alice paste: " + show(svc.get(a, "anyone", 1030)));
        System.out.println("t=1030 bob paste as eve: " + show(svc.get(b, "eve", 1030)));
        System.out.println("t=1030 bob paste as bob: " + show(svc.get(b, "bob", 1030)));
        System.out.println("t=1030 carol paste: " + show(svc.get(c, "anyone", 1030)));
        System.out.println("t=1060 alice paste: " + show(svc.get(a, "anyone", 1060)) + " | stored: " + svc.meta.size());
        int removed = svc.sweep(4600);
        System.out.println("sweep at t=4600 removed: " + removed + " | stored: " + svc.meta.size() + " | blobs: " + svc.blobs.size());

        PasteService tiny = new PasteService(7, 1); // only 62 keys: forces collisions
        for (int i = 0; i < 30; i++) tiny.create("u", "paste " + i, 0, Visibility.PUBLIC, now);
        System.out.println("tiny key space: stored " + tiny.meta.size() + " collisions retried " + tiny.collisions);
    }
}`,
      python: String.raw`ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
MAX_BYTES = 10 * 1024 * 1024   # 10 MB hard limit per paste
INLINE_LIMIT = 8 * 1024       # <= 8 KB stays in the metadata row
MAX_RETRIES = 10


class MinStd:
    """Tiny seeded PRNG so the demo is deterministic. Use secrets/SecureRandom in production."""

    def __init__(self, seed):
        self.state = seed

    def next(self):
        self.state = self.state * 48271 % 2147483647
        return self.state


class Paste:
    def __init__(self, owner, visibility, created_at, expires_at, size, inline):
        self.owner = owner
        self.visibility = visibility  # "public" | "unlisted" | "private"
        self.created_at = created_at
        self.expires_at = expires_at  # 0 = never
        self.size = size
        self.inline = inline          # content if small, None if it lives in the blob store

    def expired(self, now):
        return self.expires_at != 0 and now >= self.expires_at


class PasteService:
    def __init__(self, seed, key_length):
        self.rng = MinStd(seed)
        self.key_length = key_length
        self.meta = {}    # key -> Paste        (the "database")
        self.blobs = {}   # key -> content      (the "object store", e.g. S3)
        self.collisions = 0

    def _random_key(self):
        return "".join(ALPHABET[self.rng.next() % 62] for _ in range(self.key_length))

    def create(self, owner, content, ttl_seconds, visibility, now):
        size = len(content.encode("utf-8"))
        if size > MAX_BYTES:
            raise ValueError("paste too large")
        for _ in range(MAX_RETRIES):
            key = self._random_key()
            if key in self.meta:          # in a real DB: conditional insert fails
                self.collisions += 1
                continue
            expires_at = now + ttl_seconds if ttl_seconds > 0 else 0
            if size <= INLINE_LIMIT:
                self.meta[key] = Paste(owner, visibility, now, expires_at, size, content)
            else:
                self.blobs[key] = content  # upload blob first, then write metadata
                self.meta[key] = Paste(owner, visibility, now, expires_at, size, None)
            return key
        raise RuntimeError("could not find a free key")

    def get(self, key, viewer, now):
        p = self.meta.get(key)
        if p is None:
            return None
        if p.expired(now):                # lazy expiry on read
            self._delete(key)
            return None
        if p.visibility == "private" and viewer != p.owner:
            return None                   # 404, not 403: do not leak that it exists
        return p.inline if p.inline is not None else self.blobs[key]

    def sweep(self, now):
        expired = [k for k, p in self.meta.items() if p.expired(now)]
        for k in expired:
            self._delete(k)
        return len(expired)

    def tier(self, key):
        return "inline" if self.meta[key].inline is not None else "blob"

    def _delete(self, key):
        self.meta.pop(key, None)
        self.blobs.pop(key, None)


def show(content):
    if content is None:
        return "NOT FOUND"
    return content if len(content) <= 20 else str(len(content)) + " bytes"


if __name__ == "__main__":
    svc = PasteService(seed=42, key_length=8)
    now = 1000  # fixed clock (seconds)
    a = svc.create("alice", "print('hello')", 60, "public", now)
    b = svc.create("bob", "db_password=hunter2", 0, "private", now)
    c = svc.create("carol", "x" * 100000, 3600, "unlisted", now)
    print("created", a, svc.tier(a), b, svc.tier(b), c, svc.tier(c))

    print("t=1030 alice paste:", show(svc.get(a, "anyone", 1030)))
    print("t=1030 bob paste as eve:", show(svc.get(b, "eve", 1030)))
    print("t=1030 bob paste as bob:", show(svc.get(b, "bob", 1030)))
    print("t=1030 carol paste:", show(svc.get(c, "anyone", 1030)))
    print("t=1060 alice paste:", show(svc.get(a, "anyone", 1060)), "| stored:", len(svc.meta))
    print("sweep at t=4600 removed:", svc.sweep(4600), "| stored:", len(svc.meta), "| blobs:", len(svc.blobs))

    tiny = PasteService(seed=7, key_length=1)  # only 62 keys: forces collisions
    for i in range(30):
        tiny.create("u", "paste " + str(i), 0, "public", now)
    print("tiny key space: stored", len(tiny.meta), "collisions retried", tiny.collisions)`,
      cpp: String.raw`#include <cstdint>
#include <iostream>
#include <optional>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>

enum class Visibility { Public, Unlisted, Private };

// Tiny seeded PRNG so the demo is deterministic. Use a CSPRNG in production.
class MinStd {
    int64_t state;
public:
    explicit MinStd(int64_t seed) : state(seed) {}
    int64_t next() { state = state * 48271 % 2147483647LL; return state; }
};

struct Paste {
    std::string owner;
    Visibility visibility;
    int64_t createdAt, expiresAt; // expiresAt 0 = never
    size_t size;
    std::optional<std::string> inlineContent; // set if small, empty if it lives in the blob store
    bool expired(int64_t now) const { return expiresAt != 0 && now >= expiresAt; }
};

class PasteService {
    static constexpr const char* ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    static constexpr size_t MAX_BYTES = 10 * 1024 * 1024; // 10 MB hard limit
    static constexpr size_t INLINE_LIMIT = 8 * 1024;     // <= 8 KB stays in the metadata row
    static constexpr int MAX_RETRIES = 10;

    MinStd rng;
    int keyLength;

    std::string randomKey() {
        std::string key;
        for (int i = 0; i < keyLength; i++) key += ALPHABET[rng.next() % 62];
        return key;
    }
    void remove(const std::string& key) { meta.erase(key); blobs.erase(key); }

public:
    std::unordered_map<std::string, Paste> meta;        // the "database"
    std::unordered_map<std::string, std::string> blobs; // the "object store" (S3)
    int collisions = 0;

    PasteService(int64_t seed, int keyLength) : rng(seed), keyLength(keyLength) {}

    std::string create(const std::string& owner, const std::string& content, int64_t ttlSeconds,
                       Visibility v, int64_t now) {
        size_t size = content.size(); // bytes
        if (size > MAX_BYTES) throw std::invalid_argument("paste too large");
        for (int i = 0; i < MAX_RETRIES; i++) {
            std::string key = randomKey();
            if (meta.count(key)) { collisions++; continue; } // real DB: conditional insert fails
            int64_t expiresAt = ttlSeconds > 0 ? now + ttlSeconds : 0;
            Paste p{owner, v, now, expiresAt, size, std::nullopt};
            if (size <= INLINE_LIMIT) p.inlineContent = content;
            else blobs[key] = content; // upload blob first, then write metadata
            meta.emplace(key, std::move(p));
            return key;
        }
        throw std::runtime_error("could not find a free key");
    }

    // Returns the content, or nullopt if missing, expired or not visible to this viewer.
    std::optional<std::string> get(const std::string& key, const std::string& viewer, int64_t now) {
        auto it = meta.find(key);
        if (it == meta.end()) return std::nullopt;
        if (it->second.expired(now)) { remove(key); return std::nullopt; }                // lazy expiry
        if (it->second.visibility == Visibility::Private && viewer != it->second.owner) return std::nullopt; // 404
        if (it->second.inlineContent) return it->second.inlineContent;
        return blobs.at(key);
    }

    int sweep(int64_t now) {
        std::vector<std::string> expired;
        for (const auto& [k, p] : meta) if (p.expired(now)) expired.push_back(k);
        for (const auto& k : expired) remove(k);
        return static_cast<int>(expired.size());
    }

    std::string tier(const std::string& key) const {
        return meta.at(key).inlineContent ? "inline" : "blob";
    }
};

std::string show(const std::optional<std::string>& c) {
    if (!c) return "NOT FOUND";
    return c->size() <= 20 ? *c : std::to_string(c->size()) + " bytes";
}

int main() {
    PasteService svc(42, 8);
    int64_t now = 1000; // fixed clock (seconds)
    std::string a = svc.create("alice", "print('hello')", 60, Visibility::Public, now);
    std::string b = svc.create("bob", "db_password=hunter2", 0, Visibility::Private, now);
    std::string c = svc.create("carol", std::string(100000, 'x'), 3600, Visibility::Unlisted, now);
    std::cout << "created " << a << " " << svc.tier(a) << " " << b << " " << svc.tier(b)
              << " " << c << " " << svc.tier(c) << "\n";

    std::cout << "t=1030 alice paste: " << show(svc.get(a, "anyone", 1030)) << "\n";
    std::cout << "t=1030 bob paste as eve: " << show(svc.get(b, "eve", 1030)) << "\n";
    std::cout << "t=1030 bob paste as bob: " << show(svc.get(b, "bob", 1030)) << "\n";
    std::cout << "t=1030 carol paste: " << show(svc.get(c, "anyone", 1030)) << "\n";
    std::string late = show(svc.get(a, "anyone", 1060));
    std::cout << "t=1060 alice paste: " << late << " | stored: " << svc.meta.size() << "\n";
    int removed = svc.sweep(4600);
    std::cout << "sweep at t=4600 removed: " << removed << " | stored: " << svc.meta.size()
              << " | blobs: " << svc.blobs.size() << "\n";

    PasteService tiny(7, 1); // only 62 keys: forces collisions
    for (int i = 0; i < 30; i++) tiny.create("u", "paste " + std::to_string(i), 0, Visibility::Public, now);
    std::cout << "tiny key space: stored " << tiny.meta.size() << " collisions retried " << tiny.collisions << "\n";
}`,
      javascript: String.raw`const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB hard limit
const INLINE_LIMIT = 8 * 1024;     // <= 8 KB stays in the metadata row
const MAX_RETRIES = 10;

// Tiny seeded PRNG so the demo is deterministic. Use crypto.randomInt in production.
class MinStd {
  constructor(seed) { this.state = seed; }
  next() { this.state = (this.state * 48271) % 2147483647; return this.state; } // < 2^47, exact in a double
}

class PasteService {
  constructor(seed, keyLength) {
    this.rng = new MinStd(seed);
    this.keyLength = keyLength;
    this.meta = new Map();  // key -> paste metadata  (the "database")
    this.blobs = new Map(); // key -> content         (the "object store", e.g. S3)
    this.collisions = 0;
  }

  randomKey() {
    let key = "";
    for (let i = 0; i < this.keyLength; i++) key += ALPHABET[this.rng.next() % 62];
    return key;
  }

  create(owner, content, ttlSeconds, visibility, now) {
    const size = Buffer.byteLength(content, "utf8");
    if (size > MAX_BYTES) throw new Error("paste too large");
    for (let i = 0; i < MAX_RETRIES; i++) {
      const key = this.randomKey();
      if (this.meta.has(key)) { this.collisions++; continue; } // real DB: conditional insert fails
      const expiresAt = ttlSeconds > 0 ? now + ttlSeconds : 0;   // 0 = never
      let inline = content;
      if (size > INLINE_LIMIT) { this.blobs.set(key, content); inline = null; } // blob first, then metadata
      this.meta.set(key, { owner, visibility, createdAt: now, expiresAt, size, inline });
      return key;
    }
    throw new Error("could not find a free key");
  }

  static expired(p, now) { return p.expiresAt !== 0 && now >= p.expiresAt; }

  /** Returns the content, or null if missing, expired or not visible to this viewer. */
  get(key, viewer, now) {
    const p = this.meta.get(key);
    if (!p) return null;
    if (PasteService.expired(p, now)) { this.delete(key); return null; }  // lazy expiry on read
    if (p.visibility === "private" && viewer !== p.owner) return null;   // 404, not 403
    return p.inline !== null ? p.inline : this.blobs.get(key);
  }

  sweep(now) {
    const expired = [...this.meta].filter(([, p]) => PasteService.expired(p, now)).map(([k]) => k);
    expired.forEach((k) => this.delete(k));
    return expired.length;
  }

  tier(key) { return this.meta.get(key).inline !== null ? "inline" : "blob"; }

  delete(key) { this.meta.delete(key); this.blobs.delete(key); }
}

function show(c) {
  if (c === null) return "NOT FOUND";
  return c.length <= 20 ? c : c.length + " bytes";
}

const svc = new PasteService(42, 8);
const now = 1000; // fixed clock (seconds)
const a = svc.create("alice", "print('hello')", 60, "public", now);
const b = svc.create("bob", "db_password=hunter2", 0, "private", now);
const c = svc.create("carol", "x".repeat(100000), 3600, "unlisted", now);
console.log("created", a, svc.tier(a), b, svc.tier(b), c, svc.tier(c));

console.log("t=1030 alice paste:", show(svc.get(a, "anyone", 1030)));
console.log("t=1030 bob paste as eve:", show(svc.get(b, "eve", 1030)));
console.log("t=1030 bob paste as bob:", show(svc.get(b, "bob", 1030)));
console.log("t=1030 carol paste:", show(svc.get(c, "anyone", 1030)));
console.log("t=1060 alice paste:", show(svc.get(a, "anyone", 1060)), "| stored:", svc.meta.size);
const removed = svc.sweep(4600);
console.log("sweep at t=4600 removed:", removed, "| stored:", svc.meta.size, "| blobs:", svc.blobs.size);

const tiny = new PasteService(7, 1); // only 62 keys: forces collisions
for (let i = 0; i < 30; i++) tiny.create("u", "paste " + i, 0, "public", now);
console.log("tiny key space: stored", tiny.meta.size, "collisions retried", tiny.collisions);`,
      go: String.raw`package main

import (
	"errors"
	"fmt"
	"strings"
)

const (
	alphabet    = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
	maxBytes    = 10 * 1024 * 1024 // 10 MB hard limit
	inlineLimit = 8 * 1024         // <= 8 KB stays in the metadata row
	maxRetries  = 10
)

type Visibility int

const (
	Public Visibility = iota
	Unlisted
	Private
)

// MinStd is a tiny seeded PRNG so the demo is deterministic. Use crypto/rand in production.
type MinStd struct{ state int64 }

func (m *MinStd) Next() int64 {
	m.state = m.state * 48271 % 2147483647
	return m.state
}

type Paste struct {
	Owner      string
	Visibility Visibility
	CreatedAt  int64
	ExpiresAt  int64 // 0 = never
	Size       int
	Inline     *string // content if small, nil if it lives in the blob store
}

func (p *Paste) expired(now int64) bool { return p.ExpiresAt != 0 && now >= p.ExpiresAt }

type PasteService struct {
	rng        MinStd
	keyLength  int
	meta       map[string]*Paste // the "database"
	blobs      map[string]string // the "object store" (S3)
	collisions int
}

func NewPasteService(seed int64, keyLength int) *PasteService {
	return &PasteService{rng: MinStd{seed}, keyLength: keyLength,
		meta: map[string]*Paste{}, blobs: map[string]string{}}
}

func (s *PasteService) randomKey() string {
	var b strings.Builder
	for i := 0; i < s.keyLength; i++ {
		b.WriteByte(alphabet[s.rng.Next()%62])
	}
	return b.String()
}

func (s *PasteService) Create(owner, content string, ttlSeconds int64, v Visibility, now int64) (string, error) {
	size := len(content) // Go strings are UTF-8 bytes
	if size > maxBytes {
		return "", errors.New("paste too large")
	}
	for i := 0; i < maxRetries; i++ {
		key := s.randomKey()
		if _, taken := s.meta[key]; taken { // real DB: conditional insert fails
			s.collisions++
			continue
		}
		var expiresAt int64
		if ttlSeconds > 0 {
			expiresAt = now + ttlSeconds
		}
		p := &Paste{Owner: owner, Visibility: v, CreatedAt: now, ExpiresAt: expiresAt, Size: size}
		if size <= inlineLimit {
			c := content
			p.Inline = &c
		} else {
			s.blobs[key] = content // upload blob first, then write metadata
		}
		s.meta[key] = p
		return key, nil
	}
	return "", errors.New("could not find a free key")
}

// Get returns the content, or ok=false if missing, expired or not visible to this viewer.
func (s *PasteService) Get(key, viewer string, now int64) (string, bool) {
	p, ok := s.meta[key]
	if !ok {
		return "", false
	}
	if p.expired(now) { // lazy expiry on read
		s.delete(key)
		return "", false
	}
	if p.Visibility == Private && viewer != p.Owner { // 404, not 403
		return "", false
	}
	if p.Inline != nil {
		return *p.Inline, true
	}
	return s.blobs[key], true
}

func (s *PasteService) Sweep(now int64) int {
	removed := 0
	for k, p := range s.meta { // deleting during range is safe in Go
		if p.expired(now) {
			s.delete(k)
			removed++
		}
	}
	return removed
}

func (s *PasteService) Tier(key string) string {
	if s.meta[key].Inline != nil {
		return "inline"
	}
	return "blob"
}

func (s *PasteService) delete(key string) {
	delete(s.meta, key)
	delete(s.blobs, key)
}

func show(c string, ok bool) string {
	if !ok {
		return "NOT FOUND"
	}
	if len(c) <= 20 {
		return c
	}
	return fmt.Sprintf("%d bytes", len(c))
}

func must(k string, err error) string {
	if err != nil {
		panic(err)
	}
	return k
}

func main() {
	svc := NewPasteService(42, 8)
	var now int64 = 1000 // fixed clock (seconds)
	a := must(svc.Create("alice", "print('hello')", 60, Public, now))
	b := must(svc.Create("bob", "db_password=hunter2", 0, Private, now))
	c := must(svc.Create("carol", strings.Repeat("x", 100000), 3600, Unlisted, now))
	fmt.Println("created", a, svc.Tier(a), b, svc.Tier(b), c, svc.Tier(c))

	fmt.Println("t=1030 alice paste:", show(svc.Get(a, "anyone", 1030)))
	fmt.Println("t=1030 bob paste as eve:", show(svc.Get(b, "eve", 1030)))
	fmt.Println("t=1030 bob paste as bob:", show(svc.Get(b, "bob", 1030)))
	fmt.Println("t=1030 carol paste:", show(svc.Get(c, "anyone", 1030)))
	late := show(svc.Get(a, "anyone", 1060))
	fmt.Println("t=1060 alice paste:", late, "| stored:", len(svc.meta))
	removed := svc.Sweep(4600)
	fmt.Println("sweep at t=4600 removed:", removed, "| stored:", len(svc.meta), "| blobs:", len(svc.blobs))

	tiny := NewPasteService(7, 1) // only 62 keys: forces collisions
	for i := 0; i < 30; i++ {
		must(tiny.Create("u", fmt.Sprintf("paste %d", i), 0, Public, now))
	}
	fmt.Println("tiny key space: stored", len(tiny.meta), "collisions retried", tiny.collisions)
}`,
    },
  },
  diagrams: {
    arch: String.raw`flowchart LR
      U[Users] --> CDN["CDN / Edge"]
      CDN --> GW["API gateway (auth, rate limit)"]
      GW --> PS[Paste service]
      PS --> RC[("Redis cache")]
      PS --> DB[("Metadata DB, sharded")]
      PS --> OS[("Object storage")]
      PS -->|paste.created| Q[[Queue]]
      Q --> SC[Abuse scanner]
      SW[Cleanup workers] --> DB
      SW --> OS
      CDN -.->|large public raw| OS`,
    er: String.raw`erDiagram
      USERS ||--o{ PASTES : owns
      PASTES ||--o| BLOBS : "content if > 8 KB"
      USERS {
        bigint user_id PK
        string email
      }
      PASTES {
        string paste_key PK
        bigint owner_id FK
        int visibility
        string language
        int size_bytes
        text content
        string blob_ref
        timestamp expires_at
      }
      BLOBS {
        string object_key PK
        bytes body
      }`,
    create: String.raw`sequenceDiagram
      participant C as Client
      participant P as Paste service
      participant O as Object storage
      participant D as Metadata DB
      C->>P: POST /pastes (content, ttl, visibility)
      P->>P: size check, rate limit, key = random 8 chars
      alt size <= 8 KB
        P->>D: conditional insert(key, content inline)
      else size > 8 KB
        P->>O: PUT ttl-1d/key (content)
        O-->>P: ok
        P->>D: conditional insert(key, blob_ref)
      end
      alt key already exists
        D-->>P: conflict
        P->>P: new random key, retry
      else inserted
        D-->>P: ok
      end
      P-->>C: 201 url, expiresAt`,
    read: String.raw`sequenceDiagram
      participant B as Browser
      participant E as CDN
      participant P as Paste service
      participant R as Redis
      participant D as Metadata DB
      participant O as Object storage
      B->>E: GET /raw/aZ3kQ9xL
      alt edge hit
        E-->>B: 200 text (cached)
      else edge miss
        E->>P: GET /raw/aZ3kQ9xL
        P->>R: get metadata
        R-->>P: miss
        P->>D: select by key
        D-->>P: row
        P->>P: expired? visible to viewer?
        opt blob_ref set
          P->>O: GET object
          O-->>P: content
        end
        P-->>E: 200, max-age = min(1 day, time left)
        E-->>B: 200 text
      end`,
    expiry: String.raw`flowchart TB
      R[Read request] --> C{"expires_at passed?"}
      C -->|yes| G["410 Gone + delete"]
      C -->|no| S[Serve paste]
      T["DB TTL (metadata)"] --> X[Space reclaimed]
      L["Lifecycle rule per TTL prefix (blobs)"] --> X
      W["Sweeper on expires_at index"] --> X`,
  },
});
