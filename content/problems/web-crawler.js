SD.register({
  id: "web-crawler",
  html: String.raw`
    <p class="lead">A web crawler (also called a spider or bot) starts from a few known URLs, downloads each page, pulls out the links, and repeats, until it has a copy of a large part of the web. Google Search, Common Crawl (the open dataset many AI models are trained on), price trackers that watch Flipkart and Amazon, and SEO tools like Ahrefs all run one. The loop fits in ten lines of code. The hard part is running it at a billion pages a month without hammering anyone's server, without downloading the same page a thousand times, and without falling into a website that generates infinite URLs.</p>

    <h2>Problem statement</h2>
    <p>Design a crawler that downloads about <strong>1 billion HTML pages per month</strong> for a search engine. Given a set of <strong>seed URLs</strong>, it should discover new pages by following links, store the raw HTML for an indexing pipeline (see <a href="#/p/search-index">search index</a>), and keep revisiting pages so the copy stays fresh. It must obey <code>robots.txt</code>, never overload a website, and avoid storing duplicate content.</p>

    <div class="callout tip"><strong>Try it first</strong>Spend 15 minutes before reading on. Sketch: (1) the loop from "take a URL" to "new URLs added", (2) the data structure that decides which URL to fetch next while making sure no single host gets more than one request every few seconds, (3) how you know you have already seen a URL among billions, and (4) how you split the work across 20 machines.</div>

    <details class="hint"><summary>Hint 1: the frontier is the heart</summary>
      <p>The list of "URLs still to download" is called the <strong>URL frontier</strong>. A plain FIFO queue gives you breadth-first search, but it fetches 50 URLs from the same site in a row. Think about splitting it into <em>one queue per host</em> and remembering when each host may be contacted next.</p>
    </details>
    <details class="hint"><summary>Hint 2: two kinds of duplicates</summary>
      <p>The same URL can appear in many forms (<code>HTTP://Site.com:80/a#top</code> and <code>http://site.com/a</code>), so normalise before checking a <em>URL seen-set</em>. Different URLs can also hold the same content (mirrors, print versions), so check a <em>content fingerprint</em> after download too.</p>
    </details>
    <details class="hint"><summary>Hint 3: partition by host, not by URL</summary>
      <p>If two machines both fetch from <code>flipkart.com</code>, neither can enforce the politeness delay alone. Assign each host to exactly one worker with <a href="#/p/consistent-hashing">consistent hashing</a>; workers forward discovered links to the owner of that link's host.</p>
    </details>

    <h2>Requirements</h2>
    <div class="grid-2">
      <div class="card">
        <h3>Functional</h3>
        <ul>
          <li>Start from seed URLs; fetch pages over HTTP/HTTPS; extract and follow links.</li>
          <li>Store raw HTML plus metadata (status, headers, fetch time, checksum) for downstream indexing.</li>
          <li>Obey <code>robots.txt</code> rules for our user agent.</li>
          <li>Skip duplicate URLs and duplicate or near-duplicate content.</li>
          <li>Recrawl pages based on how often they change.</li>
          <li>Extensible: add new content types (PDF, images) or processors (language detection, link spam scoring) without redesign.</li>
        </ul>
      </div>
      <div class="card">
        <h3>Non-functional</h3>
        <ul>
          <li><strong>Scale</strong>: ~1B pages/month, growing; horizontally scalable.</li>
          <li><strong>Politeness</strong>: at most one open connection per host and a delay between requests (seconds, not milliseconds).</li>
          <li><strong>Freshness</strong>: news homepages within minutes to hours; the long tail within weeks.</li>
          <li><strong>Robustness</strong>: survive malformed HTML, slow servers, spider traps and machine crashes without losing the frontier.</li>
          <li><strong>Priority</strong>: crawl important pages first; the web is effectively infinite, so we never finish.</li>
        </ul>
      </div>
    </div>
    <div class="callout info"><strong>Out of scope (say it out loud)</strong>Indexing and ranking, rendering JavaScript-heavy pages in a headless browser (mention it as an add-on fetcher), and crawling behind logins. Clarify with the interviewer whether we crawl only HTML or also images and PDFs.</div>

    <h2>Capacity estimation</h2>
    <p>Assumptions: <strong>1B pages/month</strong>, average HTML size <strong>100 KB</strong>, about <strong>50 links per page</strong>, metadata about <strong>500 bytes</strong> per URL, compression ratio about <strong>4:1</strong> for HTML, and peak traffic 2× the average.</p>
    <table>
      <thead><tr><th>Quantity</th><th>Arithmetic</th><th>Result</th></tr></thead>
      <tbody>
        <tr><td>Seconds in a month</td><td>30 × 86,400</td><td>≈ 2.6M s</td></tr>
        <tr><td>Fetch rate</td><td>1B ÷ 2.6M s</td><td>≈ 400 pages/s (800/s peak)</td></tr>
        <tr><td>Download bandwidth</td><td>400 × 100 KB</td><td>40 MB/s ≈ 320 Mbps (≈ 650 Mbps peak)</td></tr>
        <tr><td>Raw HTML per month</td><td>1B × 100 KB</td><td>100 TB (≈ 25 TB compressed)</td></tr>
        <tr><td>Keep 12 monthly snapshots</td><td>25 TB × 12</td><td>≈ 300 TB in object storage</td></tr>
        <tr><td>Links extracted</td><td>400 pages/s × 50</td><td>20,000 URL checks/s</td></tr>
        <tr><td>Known URLs after a year</td><td>assume ~10B distinct URLs discovered</td><td>10B</td></tr>
        <tr><td>Metadata DB</td><td>10B × 500 B</td><td>5 TB (before replication)</td></tr>
        <tr><td>Bloom filter for URL seen-set</td><td>10B × ~10 bits (1% false positives)</td><td>≈ 12.5 GB</td></tr>
        <tr><td>Concurrent fetches</td><td>800/s peak × ~2 s per fetch (Little's law)</td><td>≈ 1,600 connections in flight</td></tr>
      </tbody>
    </table>
    <p>Three things stand out. The <strong>fetch rate is modest</strong>: one async-IO machine can hold a thousand connections. The <strong>URL seen-check is the hot path</strong>: about 50 links per page means 20K checks/s, 50× the fetch rate. And <strong>storage dominates cost</strong>: hundreds of terabytes of HTML, which belongs in <a href="#/p/object-storage">object storage</a>, not a database.</p>
    <div data-widget="estimator"></div>
    <div class="callout interview"><strong>Say this in the interview</strong>"A billion pages a month is only about 400 fetches a second, so bandwidth and CPU are manageable with ten or so machines. The real problems are politeness, because those 400 per second must be spread over millions of hosts; dedup, because we check 20,000 URLs a second against a set of billions; and storage, about 25 TB of compressed HTML every month."</div>

    <h2>API design</h2>
    <p>A crawler has no public API. It has an internal control plane for the search team and a contract with downstream consumers.</p>
    <table>
      <thead><tr><th>Interface</th><th>Purpose</th></tr></thead>
      <tbody>
        <tr><td><code>POST /v1/seeds</code></td><td>Add seed URLs with a priority: <code>{urls: [...], priority: HIGH}</code></td></tr>
        <tr><td><code>PUT /v1/hosts/{host}/policy</code></td><td>Override per-host settings: max rate, crawl budget, block entirely</td></tr>
        <tr><td><code>GET /v1/stats</code></td><td>Fetch rate, error rate by status code, frontier size, queue depth per worker</td></tr>
        <tr><td>Kafka topic <code>crawl.pages</code></td><td>Event per fetched page: <code>{url, fetch_time, status, object_key, content_hash}</code> for the indexer (see <a href="#/p/message-queues">message queues</a>)</td></tr>
      </tbody>
    </table>

    <h2>Data model</h2>
    <table>
      <thead><tr><th>Store</th><th>Key</th><th>Columns / content</th><th>Technology</th></tr></thead>
      <tbody>
        <tr><td><code>urls</code></td><td><code>url_hash</code> (64-bit)</td><td><code>url, host, depth, priority, status, last_fetch, next_fetch, etag, last_modified, content_hash, simhash, change_count, fetch_count</code></td><td>Cassandra / Bigtable / HBase, partitioned by host hash</td></tr>
        <tr><td><code>hosts</code></td><td><code>host</code></td><td><code>robots_rules, robots_fetched_at, crawl_delay, ip, dns_expires_at, error_rate, pages_this_cycle</code></td><td>Same store + in-memory cache on the owning worker</td></tr>
        <tr><td>Raw pages</td><td><code>crawl_id/worker/file_no.warc.gz</code></td><td>Many pages appended into large WARC files (the standard web-archive format), with an index of <code>url → (file, offset, length)</code></td><td>S3 / GCS / HDFS</td></tr>
        <tr><td>Content fingerprints</td><td><code>content_hash</code></td><td>First URL that had this content</td><td>Key-value store; simhash in a separate index (see below)</td></tr>
        <tr><td>Frontier</td><td>per worker</td><td>Front and back queues; head in memory, tail spilled to local disk</td><td>Custom, checkpointed</td></tr>
      </tbody>
    </table>
    <p>Why pack pages into big files? Object stores charge per request and dislike billions of tiny objects. Packing 100 KB pages into 1 GB WARC files cuts the object count 10,000×. Common Crawl publishes its crawls this way.</p>

    <h2>High-level design</h2>
    <div data-diagram="arch" data-caption="Crawler architecture: frontier, fetchers, two dedup checks, storage and the recrawl loop."></div>
    <ol class="steps">
      <li><strong>Seed URLs</strong> enter the frontier: popular domains, sitemaps, URLs submitted by site owners, and the previous crawl's best pages.</li>
      <li><strong>URL frontier</strong> decides what to fetch next: high-priority first, and never two requests to the same host too close together.</li>
      <li><strong>Fetcher</strong> checks the <strong>robots.txt cache</strong>, resolves the host through the <strong>DNS cache</strong>, and downloads the page with timeouts and a size cap.</li>
      <li><strong>Content-seen check</strong> computes a checksum and a simhash. Duplicates are recorded in metadata but not parsed again.</li>
      <li><strong>Storage</strong>: raw HTML goes to object storage; status, headers and fingerprints go to the metadata DB; an event goes to Kafka for the indexer.</li>
      <li><strong>Parser and link extractor</strong> pulls <code>&lt;a href&gt;</code> links, resolves them against the page URL, and runs them through the <strong>normaliser and filters</strong> (scheme, length, file type, trap rules).</li>
      <li><strong>URL-seen check</strong> drops URLs already known. New ones go back to the frontier with depth + 1.</li>
      <li><strong>Recrawl scheduler</strong> re-queues known URLs when their <code>next_fetch</code> time arrives.</li>
    </ol>

    <h2>Deep dive 1: the URL frontier (Mercator design)</h2>
    <p>The frontier has two jobs that pull in different directions: <strong>priority</strong> (fetch important pages first) and <strong>politeness</strong> (spread requests to one host over time). The classic answer comes from Mercator, a crawler built at the Compaq (formerly DEC) Systems Research Center in 1999, and is described in the Manning, Raghavan and Schütze IR textbook. It splits the frontier in two.</p>
    <div data-diagram="frontier" data-caption="Mercator frontier: front queues handle priority, back queues handle politeness, a heap says which host is ready."></div>
    <div class="grid-2">
      <div class="card">
        <h3>Front queues: priority</h3>
        <p>F queues, one per priority level. A prioritiser assigns each URL a level from signals such as PageRank of the linking page, how often the page changed before, and site quality. A biased selector pulls from high-priority queues more often, but still occasionally from low ones so nothing starves.</p>
      </div>
      <div class="card">
        <h3>Back queues: politeness</h3>
        <p>B queues, each holding URLs for <strong>exactly one host</strong>. A table maps host → back queue. A min-heap holds, for each back queue, the earliest time its host may be contacted again. A fetcher thread pops the heap top, waits if needed, fetches one URL, and pushes the host back with time <code>now + delay</code>.</p>
      </div>
    </div>
    <p>When a back queue empties, the selector pulls URLs from the front queues until it finds one whose host has no back queue yet, and gives that host the empty queue. URLs for hosts that already have a queue are appended to that queue. Mercator's rule of thumb was about three times as many back queues as fetcher threads, so a thread nearly always finds a ready host.</p>
    <h3>How long is the delay?</h3>
    <ul>
      <li><strong>Fixed</strong>: 1 to 10 seconds per host. Simple and safe.</li>
      <li><strong>Adaptive</strong>: Mercator waited about <strong>10× the time the last fetch took</strong>. A server that answers in 50 ms gets a request every 0.5 s; one that takes 2 s (probably struggling) gets one every 20 s.</li>
      <li><strong>Server signals</strong>: back off sharply on <code>429</code> or <code>503</code> and honour <code>Retry-After</code>. <code>Crawl-delay</code> in robots.txt is non-standard (Google ignores it, Bing honours it), but honouring it is cheap goodwill.</li>
      <li><strong>Per IP, not only per host</strong>: thousands of small sites share one IP on shared hosting. Limiting per host alone could still flood that one server.</li>
    </ul>
    <div class="callout interview"><strong>Say this in the interview</strong>"I split the frontier like Mercator: front queues by priority, back queues by host, and a heap keyed by each host's next allowed fetch time. Priority decides <em>which</em> URLs enter the back queues; the heap decides <em>when</em> each host can be hit. That gives one connection per host and a delay of about ten times the last response time."</div>

    <h2>Deep dive 2: the fetch path, robots.txt and DNS</h2>
    <div data-diagram="fetch" data-caption="One fetch: robots check and DNS from cache, conditional GET, content check, store, parse, reschedule the host."></div>
    <h3>robots.txt cache</h3>
    <p><code>robots.txt</code> lives at the root of each host and lists paths that crawlers must not fetch, per user agent. The format was standardised as RFC 9309 in 2022.</p>
    <ul>
      <li>Fetch it <strong>before the first page</strong> of a host, parse it once, and cache the rules on the worker that owns the host. Re-fetch roughly every 24 hours (Google's documented cache period, and RFC 9309 also recommends not caching longer than 24 hours).</li>
      <li>Status matters: <code>404</code> means no rules (all allowed); a <code>5xx</code> or unreachable server means "assume everything is disallowed" for now.</li>
      <li>Apply rules at <strong>enqueue time</strong> too, so disallowed URLs never fill the frontier.</li>
      <li>Identify yourself: a clear user agent like <code>ExampleBot/1.0 (+https://example.com/bot)</code> so site owners can block or contact you.</li>
    </ul>
    <h3>DNS resolver cache</h3>
    <p>DNS is a well-known crawler bottleneck: a lookup can take tens to hundreds of milliseconds, and standard library resolvers often block. Fixes: a local caching resolver on each worker (respect TTLs, add a floor of a few minutes), asynchronous lookups, and <strong>prefetching</strong>: resolve a host when its URL enters the back queue, so the answer is ready by the time it is fetched. See <a href="#/p/url-to-page">what happens when you type a URL</a> for the lookup itself.</p>
    <h3>Fetcher hygiene</h3>
    <ul>
      <li>Timeouts on connect (5 s) and total download (30 s); a maximum body size (say 10 MB); follow at most 5 redirects, and treat each redirect target as a new URL through the seen-check.</li>
      <li>Conditional GET: send <code>If-None-Match</code> (ETag) or <code>If-Modified-Since</code>. A <code>304 Not Modified</code> costs a few hundred bytes instead of 100 KB.</li>
      <li>Async IO (Netty, asyncio, Go goroutines) so one machine holds thousands of slow connections.</li>
    </ul>

    <h2>Deep dive 3: URL normalisation and the seen-set</h2>
    <p>The same page hides behind many spellings. Without normalisation the crawler downloads it again and again. Typical rules:</p>
    <table>
      <thead><tr><th>Rule</th><th>Before</th><th>After</th></tr></thead>
      <tbody>
        <tr><td>Lower-case scheme and host</td><td><code>HTTPS://News.Example/a</code></td><td><code>https://news.example/a</code></td></tr>
        <tr><td>Drop default port</td><td><code>http://site.in:80/a</code></td><td><code>http://site.in/a</code></td></tr>
        <tr><td>Drop fragment</td><td><code>/a#comments</code></td><td><code>/a</code></td></tr>
        <tr><td>Resolve relative links and dot segments</td><td><code>./index.html</code> on <code>/world</code></td><td><code>/index.html</code></td></tr>
        <tr><td>Remove tracking parameters</td><td><code>?utm_source=home&amp;id=7</code></td><td><code>?id=7</code></td></tr>
        <tr><td>Sort query parameters</td><td><code>?b=2&amp;a=1</code></td><td><code>?a=1&amp;b=2</code></td></tr>
        <tr><td>Reject non-web schemes</td><td><code>mailto:</code>, <code>javascript:</code></td><td>dropped</td></tr>
      </tbody>
    </table>
    <p>Pages can also declare the preferred URL with <code>&lt;link rel="canonical"&gt;</code>; respect it as a strong hint. Do not lower-case the path: on most servers <code>/About</code> and <code>/about</code> are different.</p>
    <h3>The URL seen-set at 10B URLs</h3>
    <table>
      <thead><tr><th>Option</th><th>Memory for 10B URLs</th><th>Catch</th></tr></thead>
      <tbody>
        <tr><td>Hash set of full URLs (~80 B each)</td><td>~800 GB+</td><td>Too big for RAM; fine as a sharded DB lookup but slow at 20K/s</td></tr>
        <tr><td>Set of 64-bit URL hashes</td><td>80 GB + overhead</td><td>Exact (collisions are negligible); shard across workers by host</td></tr>
        <tr><td><strong>Bloom filter</strong>, 1% false positives</td><td>~12.5 GB</td><td>No false negatives, but 1% of new URLs are wrongly skipped</td></tr>
      </tbody>
    </table>
    <p>A Bloom filter is a bit array plus k hash functions: "definitely not seen" or "probably seen". A 1% false-positive rate means 1 in 100 new URLs is never crawled. For a search engine that is usually acceptable, because important pages are linked from many places and get many chances. A common hybrid: Bloom filter in front, and on "probably seen", confirm with the exact hash in the metadata DB only for high-priority URLs. Because hosts are partitioned, each worker keeps only its share of the filter.</p>

    <h2>Deep dive 4: content dedup, traps and freshness</h2>
    <h3>Exact and near-duplicate content</h3>
    <p>A large share of the web is duplicated: mirrors, <code>http</code> and <code>https</code> copies, printer-friendly pages, the same product listed under ten category URLs. Two checks after download:</p>
    <ul>
      <li><strong>Exact</strong>: hash the body (MD5, SHA-1 or a fast 64-bit hash) and look it up. Same hash, same bytes: store a pointer, do not parse or index again.</li>
      <li><strong>Near-duplicate</strong>: pages that differ only in a timestamp, ad or session ID have different hashes. <strong>SimHash</strong> (Charikar, 2002) builds a 64-bit fingerprint from the page's word features so that similar pages get fingerprints that differ in only a few bits. Google's 2007 paper by Manku, Jain and Das Sarma used 64-bit simhashes and treated pages within a Hamming distance of 3 as near-duplicates. To search fast, they split each fingerprint into blocks and index by block, so a lookup only scans candidates that match one block exactly.</li>
    </ul>
    <h3>Spider traps and depth limits</h3>
    <p>A <strong>spider trap</strong> is a site, accidental or malicious, that generates infinite URLs: a calendar with a "next month" link forever, session IDs added to every link, or relative links that build <code>/a/b/a/b/a/b/...</code>. Defences:</p>
    <ul>
      <li><strong>Max depth</strong> from the seed (for example 15 hops) and a <strong>max URL length</strong> (around 2,000 characters).</li>
      <li><strong>Per-host crawl budget</strong>: at most N pages per host per cycle, scaled by site importance. A trap then wastes only that host's budget.</li>
      <li><strong>Pattern rules</strong>: repeated path segments, too many query parameters, known session-ID parameter names (<code>sid</code>, <code>PHPSESSID</code>).</li>
      <li><strong>Content dedup</strong> also helps: trap pages are often near-identical.</li>
    </ul>
    <h3>Recrawl scheduling and freshness</h3>
    <div data-diagram="recrawl" data-caption="Lifecycle of a URL: the recrawl interval adapts to how often the page actually changes."></div>
    <p>Pages change at very different rates. The Times of India homepage changes every few minutes; a 2015 blog post almost never. Store a <code>next_fetch</code> per URL and adapt it: if the content changed since the last fetch, halve the interval; if not, double it, within bounds such as 1 hour to 30 days. Weight by importance, since a stale popular page hurts more than a stale obscure one. Sitemaps with <code>&lt;lastmod&gt;</code>, RSS feeds and push protocols such as IndexNow let sites tell you what changed. Recrawls go through the same frontier, so they obey politeness too.</p>

    <h3>Core algorithm: a single-process crawler</h3>
    <p>The code below is the crawler core over an in-memory fake web (a map from URL to its raw links), with a simulated clock so the output is deterministic. It normalises URLs, keeps a seen-set, applies robots.txt disallow rules and a max depth, and uses per-host FIFO back queues with a min-heap of "host ready at" times: each host may be fetched again only 3 simulated seconds after its previous fetch finished. The fake web includes an endless calendar trap.</p>
    <div data-code="crawler"></div>
    <p>Read the output: <code>news.example</code> is fetched at t=0, then <code>blog.example</code> at t=1 instead of a second news page, because news is not allowed again until t=4. The normaliser turns <code>HTTPS://News.Example:443/index.html#top</code> into one canonical URL, removes <code>utm_source</code>, sorts <code>?b=2&amp;a=1</code>, and drops <code>mailto:</code>. Ten links are thrown away as duplicates, <code>/admin</code> and <code>/private</code> are blocked by robots rules, and the calendar trap stops at depth 3. Within each host the order is breadth-first.</p>

    <h2>Distributed crawling</h2>
    <p>At 400 to 800 pages/s, plus parsing and 20K URL checks/s, we want roughly 10 to 20 worker machines, each running its own frontier, fetchers and parser. The key decision is how to split the work.</p>
    <div data-diagram="dist" data-caption="Each host is owned by one worker. Links to other workers' hosts are forwarded in batches."></div>
    <ul>
      <li><strong>Partition by host</strong>, using <a href="#/p/consistent-hashing">consistent hashing</a> on the host name (or on the registered domain, so <code>m.flipkart.com</code> and <code>www.flipkart.com</code> land together). The owner holds that host's back queue, politeness timer, robots rules, DNS entry and seen-set shard. No cross-machine coordination per fetch.</li>
      <li><strong>Forward links in batches</strong>: a parser that finds a link for a host it does not own buffers it and sends batches of a few thousand to the owner every second or so. Most links are to the same site, so most stay local.</li>
      <li><strong>Membership changes</strong>: when a worker joins or dies, consistent hashing moves only about 1/N of hosts. Their frontier state must be recoverable, so each worker checkpoints its queues to disk or a durable log.</li>
      <li><strong>Hot hosts</strong>: a site like Wikipedia has billions of URLs but one politeness limit, so one worker is enough.</li>
    </ul>
    <div data-widget="hash-ring"></div>

    <h2>BFS vs DFS (and why neither, exactly)</h2>
    <table>
      <thead><tr><th></th><th>BFS (FIFO queue)</th><th>DFS (stack)</th></tr></thead>
      <tbody>
        <tr><td>Order</td><td>All pages 1 hop from seeds, then 2 hops...</td><td>Follow one chain of links as deep as it goes</td></tr>
        <tr><td>Page quality</td><td>Finds well-linked, important pages early (Najork and Wiener, 2001, found BFS yields high-quality pages first)</td><td>Can spend hours deep in one unimportant site</td></tr>
        <tr><td>Spider traps</td><td>Depth limit stops them naturally</td><td>Falls straight into infinite paths</td></tr>
      </tbody>
    </table>
    <p>Real crawlers use <strong>BFS with priority on top</strong>: front queues reorder by importance, back queues add politeness. "BFS" is the textbook answer; "prioritised BFS with per-host queues" is the production one.</p>

    <h2>Scaling &amp; bottlenecks</h2>
    <ul>
      <li><strong>Frontier size</strong>: billions of pending URLs do not fit in RAM. Keep each queue's head in memory and spill the tail to local disk (as Mercator did).</li>
      <li><strong>Crash recovery</strong>: checkpoint frontier and seen-set periodically; on restart, re-fetching a few minutes of pages is cheaper than losing the frontier.</li>
      <li><strong>Extensibility</strong>: Mercator used pluggable <em>protocol modules</em> (HTTP, FTP) and <em>processing modules</em> (link extractor, statistics). Model fetchers and processors as interfaces so adding PDF parsing or a headless-Chrome fetcher for JavaScript sites is a new plugin, not a rewrite.</li>
    </ul>

    <h2>Trade-offs</h2>
    <table>
      <thead><tr><th>Decision</th><th>Choice</th><th>What we give up</th></tr></thead>
      <tbody>
        <tr><td>URL seen-set</td><td>Bloom filter</td><td>~1% of new URLs never crawled (false positives)</td></tr>
        <tr><td>Partitioning</td><td>By host via consistent hashing</td><td>Uneven load when hosts differ hugely in size; cross-worker link forwarding</td></tr>
        <tr><td>Politeness</td><td>One connection per host, adaptive delay</td><td>Large sites crawl slowly unless they grant a higher rate</td></tr>
        <tr><td>Order</td><td>Prioritised BFS</td><td>Need a priority signal (PageRank-like) that is itself expensive to compute</td></tr>
        <tr><td>Near-dup detection</td><td>64-bit simhash, distance ≤ 3</td><td>Some false matches on template-heavy sites; some missed near-duplicates</td></tr>
      </tbody>
    </table>

    <h2>Follow-up questions</h2>
    <div class="quiz">
      <details><summary>Your crawler gets an angry email: you sent 50 requests/s to a small Indian e-commerce site. What went wrong and how do you fix it?</summary><div>Probably politeness was enforced per host but the site serves many hostnames (<code>shop1.site.in</code>, <code>shop2.site.in</code>) on one IP, or it was split across workers. Fix: key politeness on registered domain and on IP, make one worker own each domain, use adaptive delays (10× response time), back off on 429/503, and offer a contact URL in the user agent.</div></details>
      <details><summary>How do you decide which of 10B known URLs to fetch this month with a budget of 1B?</summary><div>Score each URL: importance (PageRank or inbound links), predicted change rate, time since last fetch, and site quality. Pages that are both important and likely changed come first. New URLs from important pages get a boost. Low-quality hosts get small per-host budgets.</div></details>
      <details><summary>Why partition by host instead of by hash of the full URL?</summary><div>Politeness, robots.txt and DNS are all per host. If URLs of one host spread over 20 workers, all 20 would need to coordinate their timers per request. With host ownership, one worker holds all of that state locally. The cost is forwarding cross-host links, which are a minority.</div></details>
      <details><summary>A Bloom filter says a URL is "probably seen" but it is actually new. What happens and is that okay?</summary><div>The URL is skipped. At 1% false positives, 1 in 100 new URLs is lost. It is acceptable because important pages have many inbound links and are seen through other paths and future recrawls; for high-priority URLs you can confirm with an exact lookup. Lower the rate by adding bits (about 14.4 bits per item for 0.1%).</div></details>
      <details><summary>How do you detect a spider trap automatically?</summary><div>Watch per-host signals: pages fetched per hour way above the host's usual, URLs getting longer, repeated path segments, many pages with near-identical simhash, very deep links. Cap depth, URL length and per-host budget; flag hosts that hit the budget for review.</div></details>
      <details><summary>How would you keep a news site's homepage fresh within 5 minutes without crawling everything every 5 minutes?</summary><div>Adaptive per-URL intervals: frequently changing, high-importance pages converge to a short interval while static pages back off to weeks. Use RSS, sitemaps with lastmod, or IndexNow pings as triggers. Use conditional GET so unchanged polls cost almost nothing, and give these URLs a high-priority front queue.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>1B pages/month is only <strong>~400 fetches/s</strong>; the hard parts are politeness, dedup and storage, not raw speed.</li>
      <li>The <strong>Mercator frontier</strong>: front queues for priority, back queues (one host each) for politeness, a heap of next-allowed times.</li>
      <li><strong>Two dedup layers</strong>: normalised URL seen-set (Bloom filter or hash set) before fetch; checksum and <strong>simhash</strong> after fetch.</li>
      <li><strong>robots.txt and DNS are per-host caches</strong>, refreshed about daily and per TTL; 5xx on robots.txt means "do not crawl yet".</li>
      <li>Defend against <strong>spider traps</strong> with depth limits, URL length limits, per-host budgets and pattern rules.</li>
      <li><strong>Freshness</strong> comes from adaptive recrawl intervals and conditional GETs, not from recrawling everything.</li>
      <li><strong>Distribute by host</strong> with consistent hashing; store raw HTML as large compressed files in object storage, metadata in a wide-column DB.</li>
    </ul></div>
  `,
  code: {
    crawler: {
      title: "Single-process crawler: normalisation, politeness heap, seen-set, robots, max depth",
      java: String.raw`import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.Set;

public class Crawler {
    static final int DELAY = 3;      // politeness: seconds between two fetches to the same host
    static final int FETCH_TIME = 1; // simulated seconds one fetch takes
    static final int MAX_DEPTH = 3;
    static final int MAX_PAGES = 50;

    // The fake web: page URL -> raw links exactly as they appear in its HTML.
    static final Map<String, List<String>> WEB = Map.ofEntries(
        Map.entry("https://news.example/index.html", List.of("/world", "/sports?utm_source=home",
            "http://blog.example/post/1", "/admin/login", "mailto:editor@news.example", "world#comments")),
        Map.entry("https://news.example/world",
            List.of("/world/india", "./index.html", "https://shop.example/cal/2026/01")),
        Map.entry("https://news.example/sports", List.of("../sports", "/sports/cricket", "/world")),
        Map.entry("https://news.example/world/india", List.of("/world", "http://BLOG.example:80/post/2")),
        Map.entry("https://news.example/sports/cricket", List.of()),
        Map.entry("http://blog.example/", List.of("/post/1", "/post/2", "/tag/travel?b=2&a=1")),
        Map.entry("http://blog.example/post/1", List.of("/", "/private/drafts")),
        Map.entry("http://blog.example/post/2", List.of("1", "/post/3")),
        Map.entry("http://blog.example/tag/travel?a=1&b=2", List.of("/post/2")),
        // A spider trap: an endless calendar, each month links to the next.
        Map.entry("https://shop.example/cal/2026/01", List.of("/cal/2026/02")),
        Map.entry("https://shop.example/cal/2026/02", List.of("/cal/2026/03")),
        Map.entry("https://shop.example/cal/2026/03", List.of("/cal/2026/04")));
    static final Map<String, List<String>> ROBOTS =
        Map.of("news.example", List.of("/admin"), "blog.example", List.of("/private")); // Disallow prefixes

    /** Split a normalised URL into {origin, path, query}. */
    static String[] splitUrl(String url) {
        int i = url.indexOf('/', url.indexOf("://") + 3);
        int q = url.indexOf('?', i);
        if (q < 0) return new String[]{url.substring(0, i), url.substring(i), ""};
        return new String[]{url.substring(0, i), url.substring(i, q), url.substring(q + 1)};
    }

    /** Return a canonical absolute URL, or null if the link should be ignored. */
    static String normalise(String link, String base) {
        int hash = link.indexOf('#');
        link = (hash >= 0 ? link.substring(0, hash) : link).trim();
        if (link.isEmpty()) return null;
        if (!link.contains("://")) {
            int slash = link.indexOf('/');
            if (link.startsWith("//")) {
                if (base == null) return null;
                link = base.substring(0, base.indexOf(':')) + ":" + link;
            } else if ((slash < 0 ? link : link.substring(0, slash)).contains(":")) {
                return null; // mailto:, javascript:, tel:
            } else if (base == null) {
                return null;
            } else {
                String[] b = splitUrl(base);
                link = link.startsWith("/") ? b[0] + link : b[0] + b[1].substring(0, b[1].lastIndexOf('/') + 1) + link;
            }
        }
        int sep = link.indexOf("://");
        String scheme = link.substring(0, sep).toLowerCase();
        String rest = link.substring(sep + 3);
        if (!scheme.equals("http") && !scheme.equals("https")) return null;
        int cut = rest.length();
        for (char ch : new char[]{'/', '?'}) {
            int j = rest.indexOf(ch);
            if (j >= 0 && j < cut) cut = j;
        }
        String host = rest.substring(0, cut).toLowerCase();
        String tail = rest.substring(cut);
        if ((scheme.equals("http") && host.endsWith(":80")) || (scheme.equals("https") && host.endsWith(":443"))) {
            host = host.substring(0, host.lastIndexOf(':'));
        }
        if (host.isEmpty()) return null;
        int qi = tail.indexOf('?');
        String path = qi < 0 ? tail : tail.substring(0, qi);
        String query = qi < 0 ? "" : tail.substring(qi + 1);
        Deque<String> out = new ArrayDeque<>();
        for (String seg : path.split("/")) {
            if (seg.isEmpty() || seg.equals(".")) continue;
            if (seg.equals("..")) out.pollLast();
            else out.addLast(seg);
        }
        String clean = "/" + String.join("/", out);
        if (path.endsWith("/") && !out.isEmpty()) clean += "/";
        List<String> params = new ArrayList<>();
        for (String p : query.split("&")) {
            if (!p.isEmpty() && !p.startsWith("utm_")) params.add(p);
        }
        Collections.sort(params);
        return scheme + "://" + host + clean + (params.isEmpty() ? "" : "?" + String.join("&", params));
    }

    static String hostOf(String url) {
        int start = url.indexOf("://") + 3;
        return url.substring(start, url.indexOf('/', start));
    }

    record Item(String url, int depth) {}
    record Entry(int ready, int seq, String host) {}

    int now = 0;
    int seq = 0;
    final Set<String> seen = new HashSet<>();
    final Map<String, Deque<Item>> queues = new HashMap<>(); // host -> FIFO: the back queues
    final PriorityQueue<Entry> heap = new PriorityQueue<>( // one entry per non-empty host queue
        (a, b) -> a.ready() != b.ready() ? Integer.compare(a.ready(), b.ready()) : Integer.compare(a.seq(), b.seq()));
    final Set<String> scheduled = new HashSet<>();
    final Map<String, Integer> lastDone = new HashMap<>(); // host -> time its last fetch finished
    int fetched, duplicate, invalid, robotsSkip, depthSkip;

    void push(int ready, String host) {
        heap.add(new Entry(ready, seq++, host));
        scheduled.add(host);
    }

    void admit(String url, int depth) {
        if (!seen.add(url)) {
            duplicate++;
            return;
        }
        String host = hostOf(url);
        String path = splitUrl(url)[1];
        for (String p : ROBOTS.getOrDefault(host, List.of())) {
            if (path.startsWith(p)) {
                robotsSkip++;
                System.out.printf("         skip robots.txt  %s%n", url);
                return;
            }
        }
        if (depth > MAX_DEPTH) {
            depthSkip++;
            System.out.printf("         skip depth %d    %s%n", depth, url);
            return;
        }
        queues.computeIfAbsent(host, h -> new ArrayDeque<>()).addLast(new Item(url, depth));
        if (!scheduled.contains(host)) {
            Integer last = lastDone.get(host);
            push(last == null ? now : Math.max(now, last + DELAY), host);
        }
    }

    void crawl(List<String> seeds) {
        for (String s : seeds) {
            String u = normalise(s, null);
            if (u == null) invalid++;
            else admit(u, 0);
        }
        while (!heap.isEmpty() && fetched < MAX_PAGES) {
            Entry e = heap.poll();
            scheduled.remove(e.host());
            now = Math.max(now, e.ready());
            Item it = queues.get(e.host()).pollFirst();
            List<String> links = WEB.get(it.url());
            System.out.printf("t=%3ds  d%d  GET %s%s%n", now, it.depth(), it.url(), links == null ? "  -> 404" : "");
            now += FETCH_TIME;
            lastDone.put(e.host(), now);
            fetched++;
            if (!queues.get(e.host()).isEmpty()) push(now + DELAY, e.host());
            for (String link : links == null ? List.<String>of() : links) {
                String v = normalise(link, it.url());
                if (v == null) invalid++;
                else admit(v, it.depth() + 1);
            }
        }
        System.out.printf("done at t=%ds: fetched=%d duplicate=%d invalid=%d robots=%d depth=%d%n",
            now, fetched, duplicate, invalid, robotsSkip, depthSkip);
    }

    public static void main(String[] args) {
        new Crawler().crawl(List.of("HTTPS://News.Example:443/index.html#top", "http://blog.example"));
    }
}
`,
      python: String.raw`import heapq
from collections import deque

DELAY = 3       # politeness: seconds between two fetches to the same host
FETCH_TIME = 1  # simulated seconds one fetch takes
MAX_DEPTH = 3
MAX_PAGES = 50

# The fake web: page URL -> raw links exactly as they appear in its HTML.
WEB = {
    "https://news.example/index.html": [
        "/world", "/sports?utm_source=home", "http://blog.example/post/1",
        "/admin/login", "mailto:editor@news.example", "world#comments"],
    "https://news.example/world": [
        "/world/india", "./index.html", "https://shop.example/cal/2026/01"],
    "https://news.example/sports": ["../sports", "/sports/cricket", "/world"],
    "https://news.example/world/india": ["/world", "http://BLOG.example:80/post/2"],
    "https://news.example/sports/cricket": [],
    "http://blog.example/": ["/post/1", "/post/2", "/tag/travel?b=2&a=1"],
    "http://blog.example/post/1": ["/", "/private/drafts"],
    "http://blog.example/post/2": ["1", "/post/3"],
    "http://blog.example/tag/travel?a=1&b=2": ["/post/2"],
    # A spider trap: an endless calendar, each month links to the next.
    "https://shop.example/cal/2026/01": ["/cal/2026/02"],
    "https://shop.example/cal/2026/02": ["/cal/2026/03"],
    "https://shop.example/cal/2026/03": ["/cal/2026/04"],
}
ROBOTS = {"news.example": ["/admin"], "blog.example": ["/private"]}  # Disallow prefixes


def split_url(url):
    """Split a normalised URL into (origin, path, query)."""
    i = url.index("/", url.index("://") + 3)
    q = url.find("?", i)
    if q < 0:
        return url[:i], url[i:], ""
    return url[:i], url[i:q], url[q + 1:]


def normalise(link, base):
    """Return a canonical absolute URL, or None if the link should be ignored."""
    link = link.split("#", 1)[0].strip()
    if not link:
        return None
    if "://" not in link:
        if link.startswith("//"):
            if base is None:
                return None
            link = base[:base.index(":")] + ":" + link
        elif ":" in link.split("/", 1)[0]:
            return None  # mailto:, javascript:, tel:
        elif base is None:
            return None
        else:
            origin, path, _ = split_url(base)
            if link.startswith("/"):
                link = origin + link
            else:
                link = origin + path[:path.rindex("/") + 1] + link
    scheme, rest = link.split("://", 1)
    scheme = scheme.lower()
    if scheme not in ("http", "https"):
        return None
    cut = len(rest)
    for ch in "/?":
        j = rest.find(ch)
        if 0 <= j < cut:
            cut = j
    host, tail = rest[:cut].lower(), rest[cut:]
    if (scheme == "http" and host.endswith(":80")) or (scheme == "https" and host.endswith(":443")):
        host = host[:host.rindex(":")]
    if not host:
        return None
    path, _, query = tail.partition("?")
    out = []
    for seg in path.split("/"):
        if seg in ("", "."):
            continue
        if seg == "..":
            if out:
                out.pop()
        else:
            out.append(seg)
    clean = "/" + "/".join(out)
    if path.endswith("/") and out:
        clean += "/"
    params = sorted(p for p in query.split("&") if p and not p.startswith("utm_"))
    return scheme + "://" + host + clean + ("?" + "&".join(params) if params else "")


def host_of(url):
    start = url.index("://") + 3
    return url[start:url.index("/", start)]


class Crawler:
    def __init__(self):
        self.now = 0
        self.seq = 0
        self.seen = set()
        self.queues = {}      # host -> deque of (url, depth): the back queues
        self.heap = []        # (ready_time, seq, host): one entry per non-empty host queue
        self.scheduled = set()
        self.last_done = {}   # host -> time its last fetch finished
        self.stats = {"fetched": 0, "duplicate": 0, "invalid": 0, "robots": 0, "depth": 0}

    def admit(self, url, depth):
        if url in self.seen:
            self.stats["duplicate"] += 1
            return
        self.seen.add(url)
        host = host_of(url)
        path = split_url(url)[1]
        if any(path.startswith(p) for p in ROBOTS.get(host, [])):
            self.stats["robots"] += 1
            print(f"         skip robots.txt  {url}")
            return
        if depth > MAX_DEPTH:
            self.stats["depth"] += 1
            print(f"         skip depth {depth}    {url}")
            return
        self.queues.setdefault(host, deque()).append((url, depth))
        if host not in self.scheduled:
            ready = max(self.now, self.last_done[host] + DELAY) if host in self.last_done else self.now
            self.push(ready, host)

    def push(self, ready, host):
        heapq.heappush(self.heap, (ready, self.seq, host))
        self.seq += 1
        self.scheduled.add(host)

    def crawl(self, seeds):
        for s in seeds:
            u = normalise(s, None)
            if u is None:
                self.stats["invalid"] += 1
            else:
                self.admit(u, 0)
        while self.heap and self.stats["fetched"] < MAX_PAGES:
            ready, _, host = heapq.heappop(self.heap)
            self.scheduled.discard(host)
            self.now = max(self.now, ready)
            url, depth = self.queues[host].popleft()
            links = WEB.get(url)
            print(f"t={self.now:>3}s  d{depth}  GET {url}" + ("" if links is not None else "  -> 404"))
            self.now += FETCH_TIME
            self.last_done[host] = self.now
            self.stats["fetched"] += 1
            if self.queues[host]:
                self.push(self.now + DELAY, host)
            for link in links or []:
                v = normalise(link, url)
                if v is None:
                    self.stats["invalid"] += 1
                else:
                    self.admit(v, depth + 1)
        s = self.stats
        print(f"done at t={self.now}s: fetched={s['fetched']} duplicate={s['duplicate']} "
              f"invalid={s['invalid']} robots={s['robots']} depth={s['depth']}")


if __name__ == "__main__":
    Crawler().crawl(["HTTPS://News.Example:443/index.html#top", "http://blog.example"])
`,
      cpp: String.raw`#include <algorithm>
#include <cctype>
#include <cstdio>
#include <deque>
#include <map>
#include <optional>
#include <queue>
#include <set>
#include <sstream>
#include <string>
#include <tuple>
#include <vector>

using namespace std;

const int DELAY = 3;      // politeness: seconds between two fetches to the same host
const int FETCH_TIME = 1; // simulated seconds one fetch takes
const int MAX_DEPTH = 3;
const int MAX_PAGES = 50;

// The fake web: page URL -> raw links exactly as they appear in its HTML.
const map<string, vector<string>> WEB = {
    {"https://news.example/index.html", {"/world", "/sports?utm_source=home", "http://blog.example/post/1",
                                         "/admin/login", "mailto:editor@news.example", "world#comments"}},
    {"https://news.example/world", {"/world/india", "./index.html", "https://shop.example/cal/2026/01"}},
    {"https://news.example/sports", {"../sports", "/sports/cricket", "/world"}},
    {"https://news.example/world/india", {"/world", "http://BLOG.example:80/post/2"}},
    {"https://news.example/sports/cricket", {}},
    {"http://blog.example/", {"/post/1", "/post/2", "/tag/travel?b=2&a=1"}},
    {"http://blog.example/post/1", {"/", "/private/drafts"}},
    {"http://blog.example/post/2", {"1", "/post/3"}},
    {"http://blog.example/tag/travel?a=1&b=2", {"/post/2"}},
    // A spider trap: an endless calendar, each month links to the next.
    {"https://shop.example/cal/2026/01", {"/cal/2026/02"}},
    {"https://shop.example/cal/2026/02", {"/cal/2026/03"}},
    {"https://shop.example/cal/2026/03", {"/cal/2026/04"}},
};
const map<string, vector<string>> ROBOTS = {{"news.example", {"/admin"}}, {"blog.example", {"/private"}}};

static bool startsWith(const string& s, const string& p) { return s.compare(0, p.size(), p) == 0; }
static bool endsWith(const string& s, const string& p) {
    return s.size() >= p.size() && s.compare(s.size() - p.size(), p.size(), p) == 0;
}
static string lower(string s) {
    for (char& c : s) c = static_cast<char>(tolower(static_cast<unsigned char>(c)));
    return s;
}
static vector<string> split(const string& s, char sep) {
    vector<string> parts;
    string cur;
    istringstream in(s);
    while (getline(in, cur, sep)) parts.push_back(cur);
    if (!s.empty() && s.back() == sep) parts.push_back("");
    return parts;
}
static string trim(const string& s) {
    size_t a = s.find_first_not_of(" \t\r\n");
    if (a == string::npos) return "";
    size_t b = s.find_last_not_of(" \t\r\n");
    return s.substr(a, b - a + 1);
}

// Split a normalised URL into origin, path and query.
static tuple<string, string, string> splitUrl(const string& url) {
    size_t i = url.find('/', url.find("://") + 3);
    size_t q = url.find('?', i);
    if (q == string::npos) return {url.substr(0, i), url.substr(i), ""};
    return {url.substr(0, i), url.substr(i, q - i), url.substr(q + 1)};
}

// Return a canonical absolute URL, or nullopt if the link should be ignored.
optional<string> normalise(string link, const optional<string>& base) {
    link = trim(link.substr(0, link.find('#')));
    if (link.empty()) return nullopt;
    if (link.find("://") == string::npos) {
        if (startsWith(link, "//")) {
            if (!base) return nullopt;
            link = base->substr(0, base->find(':')) + ":" + link;
        } else if (link.substr(0, link.find('/')).find(':') != string::npos) {
            return nullopt; // mailto:, javascript:, tel:
        } else if (!base) {
            return nullopt;
        } else {
            auto [origin, path, query] = splitUrl(*base);
            link = startsWith(link, "/") ? origin + link : origin + path.substr(0, path.rfind('/') + 1) + link;
        }
    }
    size_t sep = link.find("://");
    string scheme = lower(link.substr(0, sep)), rest = link.substr(sep + 3);
    if (scheme != "http" && scheme != "https") return nullopt;
    size_t cut = min(rest.find_first_of("/?"), rest.size());
    string host = lower(rest.substr(0, cut)), tail = rest.substr(cut);
    if ((scheme == "http" && endsWith(host, ":80")) || (scheme == "https" && endsWith(host, ":443")))
        host = host.substr(0, host.rfind(':'));
    if (host.empty()) return nullopt;
    size_t qi = tail.find('?');
    string path = qi == string::npos ? tail : tail.substr(0, qi);
    string query = qi == string::npos ? "" : tail.substr(qi + 1);
    vector<string> out;
    for (const string& seg : split(path, '/')) {
        if (seg.empty() || seg == ".") continue;
        if (seg == "..") {
            if (!out.empty()) out.pop_back();
        } else {
            out.push_back(seg);
        }
    }
    string clean;
    for (const string& seg : out) clean += "/" + seg;
    if (clean.empty()) clean = "/";
    else if (endsWith(path, "/")) clean += "/";
    vector<string> params;
    for (const string& p : split(query, '&'))
        if (!p.empty() && !startsWith(p, "utm_")) params.push_back(p);
    sort(params.begin(), params.end());
    string res = scheme + "://" + host + clean;
    for (size_t i = 0; i < params.size(); i++) res += (i == 0 ? "?" : "&") + params[i];
    return res;
}

static string hostOf(const string& url) {
    size_t start = url.find("://") + 3;
    return url.substr(start, url.find('/', start) - start);
}

class Crawler {
    using Entry = tuple<int, int, string>; // ready time, seq, host
    int now = 0, seq = 0;
    set<string> seen;
    map<string, deque<pair<string, int>>> queues; // host -> FIFO of (url, depth): the back queues
    priority_queue<Entry, vector<Entry>, greater<>> heap; // one entry per non-empty host queue
    set<string> scheduled;
    map<string, int> lastDone; // host -> time its last fetch finished
    int fetched = 0, duplicate = 0, invalid = 0, robotsSkip = 0, depthSkip = 0;

    void push(int ready, const string& host) {
        heap.emplace(ready, seq++, host);
        scheduled.insert(host);
    }

    void admit(const string& url, int depth) {
        if (!seen.insert(url).second) {
            duplicate++;
            return;
        }
        string host = hostOf(url);
        string path = get<1>(splitUrl(url));
        auto r = ROBOTS.find(host);
        if (r != ROBOTS.end()) {
            for (const string& p : r->second) {
                if (startsWith(path, p)) {
                    robotsSkip++;
                    printf("         skip robots.txt  %s\n", url.c_str());
                    return;
                }
            }
        }
        if (depth > MAX_DEPTH) {
            depthSkip++;
            printf("         skip depth %d    %s\n", depth, url.c_str());
            return;
        }
        queues[host].emplace_back(url, depth);
        if (!scheduled.count(host)) {
            auto last = lastDone.find(host);
            push(last == lastDone.end() ? now : max(now, last->second + DELAY), host);
        }
    }

public:
    void crawl(const vector<string>& seeds) {
        for (const string& s : seeds) {
            auto u = normalise(s, nullopt);
            if (u) admit(*u, 0);
            else invalid++;
        }
        while (!heap.empty() && fetched < MAX_PAGES) {
            auto [ready, ignored, host] = heap.top();
            heap.pop();
            scheduled.erase(host);
            now = max(now, ready);
            auto [url, depth] = queues[host].front();
            queues[host].pop_front();
            auto page = WEB.find(url);
            printf("t=%3ds  d%d  GET %s%s\n", now, depth, url.c_str(), page == WEB.end() ? "  -> 404" : "");
            now += FETCH_TIME;
            lastDone[host] = now;
            fetched++;
            if (!queues[host].empty()) push(now + DELAY, host);
            if (page == WEB.end()) continue;
            for (const string& link : page->second) {
                auto v = normalise(link, url);
                if (v) admit(*v, depth + 1);
                else invalid++;
            }
        }
        printf("done at t=%ds: fetched=%d duplicate=%d invalid=%d robots=%d depth=%d\n", now, fetched, duplicate,
               invalid, robotsSkip, depthSkip);
    }
};

int main() {
    Crawler().crawl({"HTTPS://News.Example:443/index.html#top", "http://blog.example"});
    return 0;
}
`,
      javascript: String.raw`const DELAY = 3;      // politeness: seconds between two fetches to the same host
const FETCH_TIME = 1; // simulated seconds one fetch takes
const MAX_DEPTH = 3;
const MAX_PAGES = 50;

// The fake web: page URL -> raw links exactly as they appear in its HTML.
const WEB = new Map([
  ["https://news.example/index.html", ["/world", "/sports?utm_source=home", "http://blog.example/post/1",
    "/admin/login", "mailto:editor@news.example", "world#comments"]],
  ["https://news.example/world", ["/world/india", "./index.html", "https://shop.example/cal/2026/01"]],
  ["https://news.example/sports", ["../sports", "/sports/cricket", "/world"]],
  ["https://news.example/world/india", ["/world", "http://BLOG.example:80/post/2"]],
  ["https://news.example/sports/cricket", []],
  ["http://blog.example/", ["/post/1", "/post/2", "/tag/travel?b=2&a=1"]],
  ["http://blog.example/post/1", ["/", "/private/drafts"]],
  ["http://blog.example/post/2", ["1", "/post/3"]],
  ["http://blog.example/tag/travel?a=1&b=2", ["/post/2"]],
  // A spider trap: an endless calendar, each month links to the next.
  ["https://shop.example/cal/2026/01", ["/cal/2026/02"]],
  ["https://shop.example/cal/2026/02", ["/cal/2026/03"]],
  ["https://shop.example/cal/2026/03", ["/cal/2026/04"]],
]);
const ROBOTS = new Map([["news.example", ["/admin"]], ["blog.example", ["/private"]]]); // Disallow prefixes

/** Split a normalised URL into [origin, path, query]. */
function splitUrl(url) {
  const i = url.indexOf("/", url.indexOf("://") + 3);
  const q = url.indexOf("?", i);
  if (q < 0) return [url.slice(0, i), url.slice(i), ""];
  return [url.slice(0, i), url.slice(i, q), url.slice(q + 1)];
}

/** Return a canonical absolute URL, or null if the link should be ignored. */
function normalise(link, base) {
  link = link.split("#")[0].trim();
  if (!link) return null;
  if (!link.includes("://")) {
    if (link.startsWith("//")) {
      if (base === null) return null;
      link = base.slice(0, base.indexOf(":")) + ":" + link;
    } else if (link.split("/")[0].includes(":")) {
      return null; // mailto:, javascript:, tel:
    } else if (base === null) {
      return null;
    } else {
      const [origin, path] = splitUrl(base);
      link = link.startsWith("/") ? origin + link : origin + path.slice(0, path.lastIndexOf("/") + 1) + link;
    }
  }
  const sep = link.indexOf("://");
  const scheme = link.slice(0, sep).toLowerCase();
  const rest = link.slice(sep + 3);
  if (scheme !== "http" && scheme !== "https") return null;
  let cut = rest.length;
  for (const ch of "/?") {
    const j = rest.indexOf(ch);
    if (j >= 0 && j < cut) cut = j;
  }
  let host = rest.slice(0, cut).toLowerCase();
  const tail = rest.slice(cut);
  if ((scheme === "http" && host.endsWith(":80")) || (scheme === "https" && host.endsWith(":443"))) {
    host = host.slice(0, host.lastIndexOf(":"));
  }
  if (!host) return null;
  const qi = tail.indexOf("?");
  const path = qi < 0 ? tail : tail.slice(0, qi);
  const query = qi < 0 ? "" : tail.slice(qi + 1);
  const out = [];
  for (const seg of path.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  let clean = "/" + out.join("/");
  if (path.endsWith("/") && out.length) clean += "/";
  const params = query.split("&").filter((p) => p && !p.startsWith("utm_")).sort();
  return scheme + "://" + host + clean + (params.length ? "?" + params.join("&") : "");
}

function hostOf(url) {
  const start = url.indexOf("://") + 3;
  return url.slice(start, url.indexOf("/", start));
}

/** Tiny binary min-heap ordered by [readyTime, seq]. */
class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  less(x, y) { return x[0] !== y[0] ? x[0] < y[0] : x[1] < y[1]; }
  push(e) {
    const a = this.a;
    a.push(e);
    for (let i = a.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (!this.less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

class Crawler {
  constructor() {
    this.now = 0;
    this.seq = 0;
    this.seen = new Set();
    this.queues = new Map();   // host -> array of [url, depth]: the back queues
    this.heap = new MinHeap(); // [readyTime, seq, host]: one entry per non-empty host queue
    this.scheduled = new Set();
    this.lastDone = new Map(); // host -> time its last fetch finished
    this.stats = { fetched: 0, duplicate: 0, invalid: 0, robots: 0, depth: 0 };
  }

  admit(url, depth) {
    if (this.seen.has(url)) { this.stats.duplicate++; return; }
    this.seen.add(url);
    const host = hostOf(url);
    const path = splitUrl(url)[1];
    if ((ROBOTS.get(host) || []).some((p) => path.startsWith(p))) {
      this.stats.robots++;
      console.log(\`         skip robots.txt  \${url}\`);
      return;
    }
    if (depth > MAX_DEPTH) {
      this.stats.depth++;
      console.log(\`         skip depth \${depth}    \${url}\`);
      return;
    }
    if (!this.queues.has(host)) this.queues.set(host, []);
    this.queues.get(host).push([url, depth]);
    if (!this.scheduled.has(host)) {
      const ready = this.lastDone.has(host) ? Math.max(this.now, this.lastDone.get(host) + DELAY) : this.now;
      this.push(ready, host);
    }
  }

  push(ready, host) {
    this.heap.push([ready, this.seq++, host]);
    this.scheduled.add(host);
  }

  crawl(seeds) {
    for (const s of seeds) {
      const u = normalise(s, null);
      if (u === null) this.stats.invalid++;
      else this.admit(u, 0);
    }
    while (this.heap.size && this.stats.fetched < MAX_PAGES) {
      const [ready, , host] = this.heap.pop();
      this.scheduled.delete(host);
      this.now = Math.max(this.now, ready);
      const [url, depth] = this.queues.get(host).shift(); // fine for a demo; use a real deque at scale
      const links = WEB.get(url);
      console.log(\`t=\${String(this.now).padStart(3)}s  d\${depth}  GET \${url}\` + (links ? "" : "  -> 404"));
      this.now += FETCH_TIME;
      this.lastDone.set(host, this.now);
      this.stats.fetched++;
      if (this.queues.get(host).length) this.push(this.now + DELAY, host);
      for (const link of links || []) {
        const v = normalise(link, url);
        if (v === null) this.stats.invalid++;
        else this.admit(v, depth + 1);
      }
    }
    const s = this.stats;
    console.log(\`done at t=\${this.now}s: fetched=\${s.fetched} duplicate=\${s.duplicate} \` +
      \`invalid=\${s.invalid} robots=\${s.robots} depth=\${s.depth}\`);
  }
}

new Crawler().crawl(["HTTPS://News.Example:443/index.html#top", "http://blog.example"]);
`,
      go: String.raw`package main

import (
	"container/heap"
	"fmt"
	"sort"
	"strings"
)

const (
	delay     = 3 // politeness: seconds between two fetches to the same host
	fetchTime = 1 // simulated seconds one fetch takes
	maxDepth  = 3
	maxPages  = 50
)

// web is the fake web: page URL -> raw links exactly as they appear in its HTML.
var web = map[string][]string{
	"https://news.example/index.html": {"/world", "/sports?utm_source=home", "http://blog.example/post/1",
		"/admin/login", "mailto:editor@news.example", "world#comments"},
	"https://news.example/world":             {"/world/india", "./index.html", "https://shop.example/cal/2026/01"},
	"https://news.example/sports":            {"../sports", "/sports/cricket", "/world"},
	"https://news.example/world/india":       {"/world", "http://BLOG.example:80/post/2"},
	"https://news.example/sports/cricket":    {},
	"http://blog.example/":                   {"/post/1", "/post/2", "/tag/travel?b=2&a=1"},
	"http://blog.example/post/1":             {"/", "/private/drafts"},
	"http://blog.example/post/2":             {"1", "/post/3"},
	"http://blog.example/tag/travel?a=1&b=2": {"/post/2"},
	// A spider trap: an endless calendar, each month links to the next.
	"https://shop.example/cal/2026/01": {"/cal/2026/02"},
	"https://shop.example/cal/2026/02": {"/cal/2026/03"},
	"https://shop.example/cal/2026/03": {"/cal/2026/04"},
}

var robots = map[string][]string{"news.example": {"/admin"}, "blog.example": {"/private"}} // Disallow prefixes

// splitURL splits a normalised URL into origin, path and query.
func splitURL(url string) (string, string, string) {
	start := strings.Index(url, "://") + 3
	i := start + strings.Index(url[start:], "/")
	q := strings.Index(url[i:], "?")
	if q < 0 {
		return url[:i], url[i:], ""
	}
	return url[:i], url[i : i+q], url[i+q+1:]
}

// normalise returns a canonical absolute URL, or ok=false if the link should be ignored.
func normalise(link, base string) (string, bool) {
	link = strings.TrimSpace(strings.SplitN(link, "#", 2)[0])
	if link == "" {
		return "", false
	}
	if !strings.Contains(link, "://") {
		switch {
		case strings.HasPrefix(link, "//"):
			if base == "" {
				return "", false
			}
			link = base[:strings.Index(base, ":")] + ":" + link
		case strings.Contains(strings.SplitN(link, "/", 2)[0], ":"):
			return "", false // mailto:, javascript:, tel:
		case base == "":
			return "", false
		default:
			origin, path, _ := splitURL(base)
			if strings.HasPrefix(link, "/") {
				link = origin + link
			} else {
				link = origin + path[:strings.LastIndex(path, "/")+1] + link
			}
		}
	}
	sep := strings.Index(link, "://")
	scheme, rest := strings.ToLower(link[:sep]), link[sep+3:]
	if scheme != "http" && scheme != "https" {
		return "", false
	}
	cut := len(rest)
	if j := strings.IndexAny(rest, "/?"); j >= 0 {
		cut = j
	}
	host, tail := strings.ToLower(rest[:cut]), rest[cut:]
	if (scheme == "http" && strings.HasSuffix(host, ":80")) || (scheme == "https" && strings.HasSuffix(host, ":443")) {
		host = host[:strings.LastIndex(host, ":")]
	}
	if host == "" {
		return "", false
	}
	path, query := tail, ""
	if qi := strings.Index(tail, "?"); qi >= 0 {
		path, query = tail[:qi], tail[qi+1:]
	}
	var out []string
	for _, seg := range strings.Split(path, "/") {
		switch seg {
		case "", ".":
		case "..":
			if len(out) > 0 {
				out = out[:len(out)-1]
			}
		default:
			out = append(out, seg)
		}
	}
	clean := "/" + strings.Join(out, "/")
	if strings.HasSuffix(path, "/") && len(out) > 0 {
		clean += "/"
	}
	var params []string
	for _, p := range strings.Split(query, "&") {
		if p != "" && !strings.HasPrefix(p, "utm_") {
			params = append(params, p)
		}
	}
	sort.Strings(params)
	res := scheme + "://" + host + clean
	if len(params) > 0 {
		res += "?" + strings.Join(params, "&")
	}
	return res, true
}

func hostOf(url string) string {
	start := strings.Index(url, "://") + 3
	return url[start : start+strings.Index(url[start:], "/")]
}

type item struct {
	url   string
	depth int
}

type entry struct {
	ready, seq int
	host       string
}

// readyHeap orders hosts by (ready time, insertion seq).
type readyHeap []entry

func (h readyHeap) Len() int { return len(h) }
func (h readyHeap) Less(i, j int) bool {
	if h[i].ready != h[j].ready {
		return h[i].ready < h[j].ready
	}
	return h[i].seq < h[j].seq
}
func (h readyHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }
func (h *readyHeap) Push(x any)   { *h = append(*h, x.(entry)) }
func (h *readyHeap) Pop() any {
	old := *h
	e := old[len(old)-1]
	*h = old[:len(old)-1]
	return e
}

type crawler struct {
	now, seq                                           int
	seen                                               map[string]bool
	queues                                             map[string][]item // host -> FIFO of pages: the back queues
	ready                                              readyHeap         // one entry per non-empty host queue
	scheduled                                          map[string]bool
	lastDone                                           map[string]int // host -> time its last fetch finished
	fetched, duplicate, invalid, robotsSkip, depthSkip int
}

func newCrawler() *crawler {
	return &crawler{seen: map[string]bool{}, queues: map[string][]item{},
		scheduled: map[string]bool{}, lastDone: map[string]int{}}
}

func (c *crawler) push(ready int, host string) {
	heap.Push(&c.ready, entry{ready, c.seq, host})
	c.seq++
	c.scheduled[host] = true
}

func (c *crawler) admit(url string, depth int) {
	if c.seen[url] {
		c.duplicate++
		return
	}
	c.seen[url] = true
	host := hostOf(url)
	_, path, _ := splitURL(url)
	for _, p := range robots[host] {
		if strings.HasPrefix(path, p) {
			c.robotsSkip++
			fmt.Printf("         skip robots.txt  %s\n", url)
			return
		}
	}
	if depth > maxDepth {
		c.depthSkip++
		fmt.Printf("         skip depth %d    %s\n", depth, url)
		return
	}
	c.queues[host] = append(c.queues[host], item{url, depth})
	if !c.scheduled[host] {
		ready := c.now
		if last, ok := c.lastDone[host]; ok {
			ready = max(c.now, last+delay)
		}
		c.push(ready, host)
	}
}

func (c *crawler) crawl(seeds []string) {
	for _, s := range seeds {
		if u, ok := normalise(s, ""); ok {
			c.admit(u, 0)
		} else {
			c.invalid++
		}
	}
	for c.ready.Len() > 0 && c.fetched < maxPages {
		e := heap.Pop(&c.ready).(entry)
		delete(c.scheduled, e.host)
		c.now = max(c.now, e.ready)
		it := c.queues[e.host][0]
		c.queues[e.host] = c.queues[e.host][1:]
		links, found := web[it.url]
		note := ""
		if !found {
			note = "  -> 404"
		}
		fmt.Printf("t=%3ds  d%d  GET %s%s\n", c.now, it.depth, it.url, note)
		c.now += fetchTime
		c.lastDone[e.host] = c.now
		c.fetched++
		if len(c.queues[e.host]) > 0 {
			c.push(c.now+delay, e.host)
		}
		for _, link := range links {
			if v, ok := normalise(link, it.url); ok {
				c.admit(v, it.depth+1)
			} else {
				c.invalid++
			}
		}
	}
	fmt.Printf("done at t=%ds: fetched=%d duplicate=%d invalid=%d robots=%d depth=%d\n",
		c.now, c.fetched, c.duplicate, c.invalid, c.robotsSkip, c.depthSkip)
}

func main() {
	newCrawler().crawl([]string{"HTTPS://News.Example:443/index.html#top", "http://blog.example"})
}
`,
    },
  },
  diagrams: {
    arch: String.raw`flowchart LR
  SEED["Seed URLs"] --> FR
  subgraph FR["URL frontier"]
    PRI["Prioritiser"] --> FQ[["Front queues by priority"]]
    FQ --> BS["Back-queue selector"]
    BS --> BQ[["Back queues, one host each"]]
    BQ --> HP[("Heap: host ready times")]
  end
  HP --> F["Fetchers"]
  F --> DNS[("DNS cache")]
  F --> RB[("robots.txt cache")]
  F --> WEB(("The web"))
  F --> CD{"Content seen?"}
  CD -- new --> OS[("Object storage: raw HTML")]
  CD -- new --> P["Parser and link extractor"]
  CD -- dup --> META
  P --> N["URL normaliser and filters"]
  N --> US{"URL seen?"}
  US -- new --> PRI
  F --> META[("Metadata DB")]
  RS["Recrawl scheduler"] --> PRI
  META --> RS`,
    frontier: String.raw`flowchart TB
  IN["New or due URL"] --> PZ["Prioritiser: PageRank, freshness, site quality"]
  PZ --> F1[["Front queue 1: high"]]
  PZ --> F2[["Front queue 2: medium"]]
  PZ --> F3[["Front queue F: low"]]
  F1 --> SEL["Biased selector: pick high more often"]
  F2 --> SEL
  F3 --> SEL
  SEL --> MAP[("Host to back-queue table")]
  MAP --> B1[["Back queue: flipkart.com"]]
  MAP --> B2[["Back queue: wikipedia.org"]]
  MAP --> B3[["Back queue: blog.example"]]
  B1 --> H[("Min-heap of earliest next fetch time per back queue")]
  B2 --> H
  B3 --> H
  H --> T["Fetcher thread takes the ready host, fetches one URL, puts host back at now + delay"]`,
    fetch: String.raw`sequenceDiagram
  participant FR as Frontier
  participant FE as Fetcher
  participant RC as robots cache
  participant D as DNS cache
  participant S as Web server
  participant CS as Content seen
  participant OS as Object storage
  participant P as Parser
  FR->>FE: next URL for host news.example
  FE->>RC: allowed? /world
  RC-->>FE: yes, rules cached 24 h
  FE->>D: resolve news.example
  D-->>FE: 203.0.113.7 from cache
  FE->>S: GET /world with If-None-Match etag
  S-->>FE: 200 OK, 85 KB HTML
  FE->>CS: checksum and simhash
  CS-->>FE: new content
  FE->>OS: put raw HTML, gzip
  FE->>P: parse
  P->>FR: 42 new normalised URLs after seen-check
  FE->>FR: host ready again at now + delay`,
    recrawl: String.raw`stateDiagram-v2
  [*] --> Discovered
  Discovered --> Queued: passes filters and seen-check
  Queued --> Fetched: host ready
  Fetched --> Changed: new checksum
  Fetched --> Unchanged: 304 or same checksum
  Changed --> Scheduled: interval halves
  Unchanged --> Scheduled: interval doubles
  Scheduled --> Queued: next_fetch reached
  Fetched --> Gone: 404 or 410 repeatedly
  Gone --> [*]`,
    dist: String.raw`flowchart LR
  subgraph W1["Worker 1: hosts A to F on the ring"]
    F1["Frontier + fetchers"] --> P1["Parser"]
  end
  subgraph W2["Worker 2"]
    F2["Frontier + fetchers"] --> P2["Parser"]
  end
  subgraph W3["Worker 3"]
    F3["Frontier + fetchers"] --> P3["Parser"]
  end
  P1 -- "links for W2 hosts, batched" --> F2
  P2 -- "links for W3 hosts" --> F3
  P3 -- "links for W1 hosts" --> F1
  ZK[("Coordinator: ring membership")] -.-> W1
  ZK -.-> W2
  ZK -.-> W3
  W1 --> OS[("Shared object storage")]
  W2 --> OS
  W3 --> OS`,
  },
});
