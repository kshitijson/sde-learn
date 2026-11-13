SD.register({
  id: "search-index",
  html: String.raw`
    <p class="lead">When a user types "black iphone case" into Flipkart, the answer comes back in about 50 ms from hundreds of millions of products, ranked by relevance, with typos forgiven and filters like brand and price on the side. A normal database cannot do that. Search engines like <strong>Elasticsearch</strong> and <strong>OpenSearch</strong> use an <strong>inverted index</strong>: a map from every word to the list of documents that contain it. This page covers analysis, query processing, ranking, Elasticsearch internals and keeping search in sync with your database.</p>

    <h2>Why LIKE '%term%' fails at scale</h2>
    <p>The first idea is plain SQL: <code>SELECT * FROM products WHERE title LIKE '%iphone%'</code>. It works with 1,000 rows and breaks in production:</p>
    <ul>
      <li><strong>No index can help.</strong> A leading wildcard gives a B-tree no place to start, so the database scans every row (see <a href="#/p/indexing">Database Indexing</a>): 100 million titles at about 200 bytes is 20 GB per query.</li>
      <li><strong>No relevance.</strong> <code>LIKE</code> answers yes or no; it cannot rank the best match first.</li>
      <li><strong>No language smarts.</strong> "phones" does not match "phone", "Mobile" does not match "mobile phone", and "iphnoe" matches nothing.</li>
      <li><strong>Substring false hits.</strong> <code>'%pen%'</code> also matches "open" and "happened".</li>
    </ul>
    <div class="callout info"><strong>Built-in full-text search</strong>MySQL has <code>FULLTEXT</code> indexes and PostgreSQL has <code>tsvector</code> with a GIN index. Both are real inverted indexes and fine for a few million rows on one machine. Move to a search engine when you need horizontal scale, relevance tuning, typo tolerance and facets together.</div>

    <h2>What an inverted index is</h2>
    <p>A normal ("forward") index maps a document to its words: product 4 → "black leather case for iphone 15". An <strong>inverted index</strong> flips it: each word maps to the documents that contain it. Like the index at the back of a textbook.</p>
    <ul>
      <li><strong>Term dictionary</strong>: the sorted list of every distinct term. Lucene (the library inside Elasticsearch, OpenSearch and Solr) compresses it into an in-memory prefix structure (an FST).</li>
      <li><strong>Posting list</strong>: for each term, the sorted list of document ids that contain it. Each entry (a <strong>posting</strong>) can also store the term frequency (how many times the term appears) and the <strong>positions</strong> (word offsets), which phrase queries need.</li>
    </ul>
    <figure class="svg-fig">
      <svg viewBox="0 0 690 330">
        <text class="s-title" x="135" y="24" text-anchor="middle">Documents</text>
        <text class="s-title" x="490" y="24" text-anchor="middle">Inverted index: term → posting list</text>
        <rect class="s-box" x="20" y="44" width="230" height="56" rx="10"/>
        <text class="s-text" x="135" y="68" text-anchor="middle">#0 Apple iPhone 15 Pro</text>
        <text class="s-muted" x="135" y="88" text-anchor="middle">Max 256GB Black</text>
        <rect class="s-box" x="20" y="116" width="230" height="56" rx="10"/>
        <text class="s-text" x="135" y="140" text-anchor="middle">#2 Apple AirPods Pro</text>
        <text class="s-muted" x="135" y="160" text-anchor="middle">with MagSafe Case</text>
        <rect class="s-box" x="20" y="188" width="230" height="56" rx="10"/>
        <text class="s-text" x="135" y="212" text-anchor="middle">#4 Black Leather Case</text>
        <text class="s-muted" x="135" y="232" text-anchor="middle">for iPhone 15</text>
        <line class="s-line" x1="256" y1="146" x2="294" y2="146" marker-end="url(#arrow)"/>
        <text class="s-muted" x="135" y="266" text-anchor="middle">analyse, then invert</text>
        <rect class="s-box" x="300" y="44" width="90" height="36" rx="10"/>
        <text class="s-text" x="345" y="67" text-anchor="middle">apple</text>
        <rect class="s-box" x="410" y="44" width="80" height="36" rx="10"/>
        <text class="s-text" x="450" y="67" text-anchor="middle">0 : {0}</text>
        <rect class="s-box" x="498" y="44" width="80" height="36" rx="10"/>
        <text class="s-text" x="538" y="67" text-anchor="middle">2 : {0}</text>
        <rect class="s-accent" x="300" y="92" width="90" height="36" rx="10"/>
        <text class="s-text" x="345" y="115" text-anchor="middle">black</text>
        <rect class="s-accent" x="410" y="92" width="80" height="36" rx="10"/>
        <text class="s-text" x="450" y="115" text-anchor="middle">0 : {6}</text>
        <rect class="s-box" x="498" y="92" width="80" height="36" rx="10"/>
        <text class="s-text" x="538" y="115" text-anchor="middle">1 : {5}</text>
        <rect class="s-accent" x="586" y="92" width="80" height="36" rx="10"/>
        <text class="s-text" x="626" y="115" text-anchor="middle">4 : {0}</text>
        <rect class="s-box" x="300" y="140" width="90" height="36" rx="10"/>
        <text class="s-text" x="345" y="163" text-anchor="middle">case</text>
        <rect class="s-box" x="410" y="140" width="80" height="36" rx="10"/>
        <text class="s-text" x="450" y="163" text-anchor="middle">2 : {5}</text>
        <rect class="s-box" x="498" y="140" width="80" height="36" rx="10"/>
        <text class="s-text" x="538" y="163" text-anchor="middle">4 : {2}</text>
        <rect class="s-accent" x="300" y="188" width="90" height="36" rx="10"/>
        <text class="s-text" x="345" y="211" text-anchor="middle">iphone</text>
        <rect class="s-accent" x="410" y="188" width="80" height="36" rx="10"/>
        <text class="s-text" x="450" y="211" text-anchor="middle">0 : {1}</text>
        <rect class="s-accent" x="498" y="188" width="80" height="36" rx="10"/>
        <text class="s-text" x="538" y="211" text-anchor="middle">4 : {4}</text>
        <rect class="s-box" x="300" y="236" width="90" height="36" rx="10"/>
        <text class="s-text" x="345" y="259" text-anchor="middle">pro</text>
        <rect class="s-box" x="410" y="236" width="80" height="36" rx="10"/>
        <text class="s-text" x="450" y="259" text-anchor="middle">0 : {3}</text>
        <rect class="s-box" x="498" y="236" width="80" height="36" rx="10"/>
        <text class="s-text" x="538" y="259" text-anchor="middle">2 : {2}</text>
        <rect class="s-box" x="586" y="236" width="80" height="36" rx="10"/>
        <text class="s-text" x="626" y="259" text-anchor="middle">5 : {3}</text>
        <text class="s-muted" x="345" y="300" text-anchor="middle">Each posting is docId : {word positions}; lists are sorted by docId.</text>
        <text class="s-title" x="345" y="322" text-anchor="middle">black AND iphone: walk both sorted lists together → docs 0 and 4</text>
      </svg>
      <figcaption>A slice of the inverted index for the product titles used in the code below. A query never touches the documents; it looks up a few terms and merges their posting lists.</figcaption>
    </figure>
    <p>Finding a term costs microseconds; the real work depends on the length of the posting lists read, not the size of the collection. Lists are stored as <strong>deltas</strong> (gaps between sorted ids) and bit-packed, so they compress very well.</p>

    <h2>The analysis pipeline</h2>
    <p>Before text goes into the index, an <strong>analyzer</strong> turns it into terms. The same analyzer must run on the query, or "Phones" in a query will never meet "phone" in the index.</p>
    <div data-diagram="analysis" data-caption="An analyzer: character filters, then a tokenizer, then a chain of token filters. The same chain runs at index time and query time."></div>
    <table>
      <thead><tr><th>Step</th><th>What it does</th><th>Example</th></tr></thead>
      <tbody>
        <tr><td>Tokenisation</td><td>Splits text into tokens on spaces and punctuation, keeping word positions</td><td>"Wi-Fi 6 router" → wi, fi, 6, router</td></tr>
        <tr><td>Lowercasing</td><td>Makes matching case-insensitive</td><td>iPhone → iphone</td></tr>
        <tr><td>Stop words</td><td>Drops very common words that carry little meaning</td><td>"case for the iphone" → case, iphone</td></tr>
        <tr><td>Stemming</td><td>Chops suffixes with rules (Porter, Snowball). Fast but crude</td><td>running → run, phones → phone, batteries → batteri</td></tr>
        <tr><td>Lemmatisation</td><td>Uses a dictionary to find the real base word. Accurate, slower</td><td>ran → run, better → good</td></tr>
        <tr><td>Synonyms</td><td>Adds or maps equivalent terms</td><td>mobile ⇄ phone, tv ⇄ television, chawal ⇄ rice</td></tr>
        <tr><td>N-grams</td><td>Emits sub-strings of each token, for partial matching</td><td>edge n-grams of "biryani": bi, bir, biry, …</td></tr>
      </tbody>
    </table>
    <p>Each step trades <strong>recall</strong> (finding everything relevant) against <strong>precision</strong> (showing only relevant things). Aggressive stemming makes "organization" match "organ"; dropping stop words breaks "The Who", so many setups keep them and let ranking down-weight them. Synonyms are usually applied at query time so the list can change without reindexing.</p>
    <div class="callout tip"><strong>text vs keyword fields</strong>In Elasticsearch, a <code>text</code> field is analyzed (for full-text search). A <code>keyword</code> field is stored as one exact term (for filters, sorting and facets: brand, category, SKU, status). A product title is often mapped as both: <code>title</code> (text) and <code>title.raw</code> (keyword).</div>
    <p>Indian search adds Hinglish ("aloo" vs "potato") and spelling variants ("biryani", "biriyani"). Teams use synonym lists mined from search logs and <strong>fuzzy matching</strong>: accept terms within an edit distance of 1 or 2, so "iphnoe" still finds "iphone".</p>

    <h2>Query processing: merging posting lists</h2>
    <p>The engine fetches each query term's posting list and combines them. Every list is sorted by doc id, so combining is a linear merge, like in merge sort.</p>
    <ul>
      <li><strong>AND</strong> (all terms must match): <strong>intersect</strong> with two pointers. Advance whichever pointer has the smaller id; emit when both are equal. Cost O(m + n). Start with the <em>rarest</em> term so the running result stays small; real engines also use <strong>skip lists</strong> to jump ahead.</li>
      <li><strong>OR</strong> (any term): <strong>union</strong> the lists. Used for ranked "best match" search, where docs matching more terms score higher.</li>
      <li><strong>Phrase query</strong> ("leather case"): first intersect to get docs with both terms, then check positions. Doc 4 has leather at position 1 and case at position 2, so 2 = 1 + 1 means they are adjacent: a match. "case made of leather" fails. A <strong>slop</strong> value allows a few words in between.</li>
    </ul>

    <h2>Ranking: TF-IDF and BM25</h2>
    <p>Matching finds 40,000 products for "phone"; ranking picks the 20 the user sees. The classic intuition:</p>
    <ul>
      <li><strong>TF (term frequency)</strong>: a doc that mentions a term more often is more likely about it. Normalise by length so long docs do not win just by being long.</li>
      <li><strong>IDF (inverse document frequency)</strong>: rare terms matter more. <code>idf = ln(N / df)</code>, where N is the number of documents and df is how many contain the term. "phone" is in almost every doc (low IDF); "magsafe" is rare (high IDF) and counts far more.</li>
    </ul>
    <p>Score of a document for a query = sum over query terms of <code>tf × idf</code>. In the demo below, "Black Leather Case for iPhone 15" (5 terms) beats "Apple iPhone 15 Pro Max 256GB Black" (7 terms) for "black iphone": both match, but the shorter title is more focused.</p>
    <p><strong>BM25</strong> (Best Matching 25) is the default in Elasticsearch since version 5.0 (2016). It fixes two things:</p>
    <ul>
      <li><strong>TF saturation</strong>: the 10th mention of "phone" adds far less than the 2nd (<code>k1</code>, default 1.2), so keyword stuffing stops paying off.</li>
      <li><strong>Tunable length normalisation</strong>: <code>b</code> (default 0.75) sets how much a longer-than-average doc is penalised.</li>
    </ul>
    <p>In product search the text score is only one signal; the final rank mixes in sales, ratings, stock, delivery speed and personalisation. Large teams re-score the top few hundred BM25 hits with an ML model (<strong>learning to rank</strong>), and many add <strong>vector search</strong> on embeddings so "something to keep tea warm" finds "thermos flask".</p>

    <h3>Code: a tiny inverted index</h3>
    <p>This builds an inverted index over six product titles. The analyzer lowercases, splits on anything that is not a letter or digit, and drops stop words. Posting lists stay sorted because doc ids are assigned in increasing order. <code>searchAnd</code> intersects sorted lists starting from the rarest term; <code>searchRanked</code> is an OR query scored with TF-IDF (term frequency divided by document length, times <code>ln(N / df)</code>).</p>
    <div data-code="invidx"></div>
    <p>Expected output (the same in all five languages):</p>
    <pre><code>Indexed 6 products, 25 distinct terms
postings(black) = [0, 1, 4]
postings(iphone) = [0, 4]
postings(pro) = [0, 2, 5]
postings(phone) = [1, 5]
AND "Black iPhone" -&gt; [0, 4]
AND "pro phone" -&gt; [5]
AND "case for the iPhone" -&gt; [4]
AND "pro xyz" -&gt; []
Ranked OR "black iphone":
  0.3584  #4 Black Leather Case for iPhone 15
  0.2560  #0 Apple iPhone 15 Pro Max 256GB Black
  0.1155  #1 Samsung Galaxy S24 Ultra Phone Black
Ranked OR "apple pro case":
  0.5781  #2 Apple AirPods Pro with MagSafe Case
  0.2560  #0 Apple iPhone 15 Pro Max 256GB Black
  0.2197  #4 Black Leather Case for iPhone 15
  0.0990  #5 Redmi Note 13 Pro Phone with Fast Charger</code></pre>

    <h2>Elasticsearch and OpenSearch architecture</h2>
    <p>Elasticsearch is a distributed server built on Apache Lucene. OpenSearch is the AWS-led fork of Elasticsearch 7.10 (2021); the architecture is the same.</p>
    <ul>
      <li><strong>Index</strong>: a named collection of JSON <strong>documents</strong> with a <strong>mapping</strong> (schema: which fields are text, keyword, number, date).</li>
      <li><strong>Shard</strong>: an index is split into <strong>primary shards</strong>; each is a complete Lucene index holding a slice of the docs. Each primary has <strong>replicas</strong> on other nodes for failover and read throughput (default: 1 primary, 1 replica).</li>
      <li><strong>Node</strong> roles: <strong>master</strong> nodes manage cluster state (which shard lives where), <strong>data</strong> nodes hold shards, and any node can <strong>coordinate</strong>: receive a request and fan it out.</li>
      <li><strong>Routing</strong>: a document goes to shard <code>hash(_routing) % number_of_primary_shards</code>, where <code>_routing</code> defaults to the document id. Because of that modulo, the primary shard count is fixed at creation; changing it means a reindex (or the split/shrink APIs). Compare <a href="#/p/consistent-hashing">Consistent Hashing</a>.</li>
    </ul>
    <div data-diagram="cluster" data-caption="An index with 3 primary shards (P) and 1 replica each (R), spread so that no primary sits on the same node as its own replica."></div>
    <p>Elastic's sizing guidance is roughly 10 to 50 GB per shard; many tiny shards waste memory (<strong>oversharding</strong>). Writes go to the primary, which forwards them to replicas (see <a href="#/p/replication">Replication</a>); reads can use either copy.</p>

    <h3>Inside a shard: segments, refresh and merges</h3>
    <figure class="svg-fig">
      <svg viewBox="0 0 680 270">
        <rect class="s-box" x="20" y="60" width="140" height="50" rx="10"/>
        <text class="s-title" x="90" y="90" text-anchor="middle">Index doc</text>
        <line class="s-line" x1="160" y1="78" x2="216" y2="50" marker-end="url(#arrow)"/>
        <line class="s-line" x1="160" y1="94" x2="216" y2="122" marker-end="url(#arrow)"/>
        <rect class="s-box" x="220" y="20" width="180" height="56" rx="10"/>
        <text class="s-text" x="310" y="44" text-anchor="middle">Memory buffer</text>
        <text class="s-muted" x="310" y="64" text-anchor="middle">not searchable yet</text>
        <rect class="s-amber" x="220" y="96" width="180" height="56" rx="10"/>
        <text class="s-text" x="310" y="120" text-anchor="middle">Translog</text>
        <text class="s-muted" x="310" y="140" text-anchor="middle">append-only, for crash recovery</text>
        <line class="s-line" x1="400" y1="48" x2="456" y2="48" marker-end="url(#arrow)"/>
        <text class="s-muted" x="428" y="38" text-anchor="middle">refresh</text>
        <rect class="s-accent" x="460" y="20" width="200" height="56" rx="10"/>
        <text class="s-text" x="560" y="44" text-anchor="middle">New small segment</text>
        <text class="s-muted" x="560" y="64" text-anchor="middle">searchable after ~1 s</text>
        <text class="s-muted" x="200" y="186" text-anchor="middle">Immutable segments pile up, one per refresh</text>
        <rect class="s-box" x="20" y="200" width="80" height="44" rx="10"/>
        <text class="s-text" x="60" y="227" text-anchor="middle">seg 1</text>
        <rect class="s-box" x="113" y="200" width="80" height="44" rx="10"/>
        <text class="s-text" x="153" y="227" text-anchor="middle">seg 2</text>
        <rect class="s-box" x="206" y="200" width="80" height="44" rx="10"/>
        <text class="s-text" x="246" y="227" text-anchor="middle">seg 3</text>
        <rect class="s-box" x="299" y="200" width="80" height="44" rx="10"/>
        <text class="s-text" x="339" y="227" text-anchor="middle">seg 4</text>
        <line class="s-dash" x1="560" y1="76" x2="345" y2="196"/>
        <line class="s-line" x1="384" y1="222" x2="456" y2="222" marker-end="url(#arrow)"/>
        <text class="s-muted" x="420" y="212" text-anchor="middle">merge</text>
        <rect class="s-green" x="460" y="196" width="200" height="56" rx="10"/>
        <text class="s-text" x="560" y="220" text-anchor="middle">One bigger segment</text>
        <text class="s-muted" x="560" y="240" text-anchor="middle">deleted docs dropped</text>
      </svg>
      <figcaption>Write path inside one shard. A document becomes searchable only when a refresh turns the buffer into a new segment; background merges keep the segment count low.</figcaption>
    </figure>
    <ol class="steps">
      <li><strong>Buffer + translog</strong>: an indexed document goes into an in-memory buffer and is appended to the <strong>translog</strong> (a write-ahead log). The ack comes once the translog is durable on primary and replicas.</li>
      <li><strong>Refresh</strong>: every <code>refresh_interval</code> (default 1 second) the buffer becomes a new <strong>segment</strong>, a small immutable inverted index, open for search. Hence <strong>near real-time (NRT)</strong>: a write is visible about 1 second later, not instantly.</li>
      <li><strong>Flush</strong>: a Lucene commit fsyncs segments to disk; the translog is trimmed.</li>
      <li><strong>Merge</strong>: a search checks every segment, so background merges combine small ones into bigger ones, like LSM compaction (see <a href="#/p/indexing">Database Indexing</a>).</li>
    </ol>
    <p>Segments are immutable, so an update is really "mark the old version deleted, index a new one", and a delete only sets a bit in a deleted-docs list. Space comes back only when merges rewrite the segment, so heavy updates are costly. For bulk loads, set <code>refresh_interval</code> to <code>-1</code> and replicas to 0, then restore.</p>

    <h3>Query then fetch: scatter and gather</h3>
    <p>Any shard might hold matches, so a search goes to one copy of every shard, in two phases:</p>
    <div data-diagram="qtf" data-caption="Query-then-fetch: shards return only ids and scores first; the coordinator merges them and then fetches just the winning documents."></div>
    <ul>
      <li><strong>Query phase</strong>: each shard returns only its top <code>from + size</code> doc ids and scores.</li>
      <li><strong>Fetch phase</strong>: the coordinator merges them into a global top list and fetches just those documents.</li>
    </ul>
    <p>Two consequences interviewers like. Latency is set by the <strong>slowest shard</strong> (tail latency). And <strong>deep pagination is expensive</strong>: page 500 at 20 per page asks every shard for 10,000 hits. Elasticsearch caps <code>from + size</code> at 10,000 by default; use <code>search_after</code> (a cursor on the last sort value) instead.</p>

    <h2>Keeping search in sync with the primary database</h2>
    <p>The search index is a <strong>derived copy</strong>; the source of truth stays in MySQL or PostgreSQL. Every change must reach the index quickly and reliably.</p>
    <div class="tabs">
      <section data-tab="Dual writes">
        <p>The application writes to the database and then to Elasticsearch in the same request.</p>
        <div class="grid-2">
          <div class="card good"><strong>Pros</strong><p>Simple. Lowest lag. No extra infrastructure.</p></div>
          <div class="card bad"><strong>Cons</strong><p>No transaction spans both. If the DB commit succeeds and the ES call fails, they silently diverge. Concurrent updates can land out of order.</p></div>
        </div>
        <p>Fine for a prototype. This is the classic dual-write problem (see <a href="#/p/transactions">Transactions</a>).</p>
      </section>
      <section data-tab="CDC (Debezium + Kafka)">
        <p><strong>Change data capture</strong>: a connector such as <strong>Debezium</strong> tails the database's own replication log (MySQL binlog, PostgreSQL WAL) and publishes each committed row change to a <strong>Kafka</strong> topic. An indexer service consumes the topic and sends <code>_bulk</code> requests to Elasticsearch.</p>
        <div class="grid-2">
          <div class="card good"><strong>Pros</strong><p>Only committed changes flow. Ordered per key (partition by product id). Kafka buffers during ES outages and allows replay.</p></div>
          <div class="card bad"><strong>Cons</strong><p>More moving parts; seconds of lag. The indexer must be idempotent and denormalise product, seller and price into one document.</p></div>
        </div>
        <p>A variant is the <strong>transactional outbox</strong>: the app writes an event row in the same DB transaction, and CDC ships that table. See <a href="#/p/message-queues">Message Queues</a>.</p>
      </section>
    </div>
    <div data-diagram="cdc" data-caption="CDC pipeline: the database stays the source of truth; search is rebuilt from its change log."></div>
    <p>Use the row's version as an <strong>external version</strong> in Elasticsearch so a late, older event is rejected, and handle delete events, or deleted products stay searchable.</p>

    <h3>Reindexing with aliases</h3>
    <p>Changing an analyzer, field type or shard count needs a full reindex. Do it with zero downtime using an <strong>alias</strong>, a stable name pointing to a real index:</p>
    <ol class="steps">
      <li>The app always queries <code>products</code>, an alias pointing to <code>products_v1</code>.</li>
      <li>Create <code>products_v2</code> with the new mapping and backfill it from the database (or the <code>_reindex</code> API). Keep the CDC consumer writing to both indexes so v2 catches up.</li>
      <li>Atomically swap the alias to <code>products_v2</code> in one <code>_aliases</code> call. Keep v1 for a quick rollback, then delete it.</li>
    </ol>
    <p>Because the index can be rebuilt from the database, losing the search cluster is an outage, not data loss. That is why search is never the primary datastore.</p>

    <h2>Typeahead vs full-text search</h2>
        <table>
      <thead><tr><th></th><th>Typeahead</th><th>Full-text search</th></tr></thead>
      <tbody>
        <tr><td>Input</td><td>A prefix: "biry"</td><td>Whole words: "chicken biryani near me"</td></tr>
        <tr><td>Latency budget</td><td>Under ~50 ms, many calls per query</td><td>100 to 300 ms, once per submit</td></tr>
        <tr><td>Returns</td><td>5 to 10 suggestions (queries, brands, categories)</td><td>Paged, faceted results</td></tr>
        <tr><td>Technique</td><td>Edge n-grams, the completion suggester (an in-memory FST), or a trie of popular queries kept in a cache like Redis</td><td>Inverted index + BM25 + business ranking</td></tr>
      </tbody>
    </table>
    <p><strong>Edge n-grams</strong> index every prefix at index time ("biryani" → b, bi, bir, …), so a prefix query becomes a plain term lookup at the cost of a bigger index. Apply them only at index time; the query "biry" stays one term.</p>

    <h2>Facets and filters</h2>
    <p>The left panel on Flipkart ("Brand: Apple (120), Samsung (340); Price: under ₹10,000 …") is built with <strong>aggregations</strong>, Elasticsearch's name for facets. A terms aggregation counts matching docs per brand; a range aggregation buckets prices.</p>
    <ul>
      <li><strong>Filter vs query</strong>: put exact conditions (in stock, brand = Apple, price &lt; 50,000) in the <code>filter</code> clause of a <code>bool</code> query. Filters do not score and are cached as bitsets. The user's words go in <code>must</code>, which scores.</li>
      <li><strong>Doc values</strong>: aggregations and sorting need "doc → value", the opposite of an inverted index. Elasticsearch keeps a columnar copy of keyword and numeric fields, like <a href="#/p/timeseries-olap">analytics databases</a>.</li>
    </ul>

    <h2>Real-world examples</h2>
    <div class="grid-3">
      <div class="card"><strong>E-commerce product search</strong><p>A Flipkart-style catalogue: hundreds of millions of listings, each denormalised from catalogue, price, stock and seller services. Relevance blends with sales and ratings; facets dominate the UI. Big Billion Days means extra replicas for read spikes.</p></div>
      <div class="card"><strong>Food delivery search</strong><p>A Swiggy-style search for "paneer" returns restaurants and dishes, only from places that deliver to you and are open now: a geo-distance filter plus availability filters plus text match, with heavy synonym and spelling work.</p></div>
      <div class="card"><strong>Log search (ELK)</strong><p><strong>E</strong>lasticsearch + <strong>L</strong>ogstash (or Beats/Fluent Bit) + <strong>K</strong>ibana. One index per day (<code>logs-2026.11.12</code>); lifecycle management moves old ones from "hot" to cheaper "warm" nodes and drops them after 30 days, a cheap whole-index delete.</p></div>
    </div>

    <h2>Trade-offs</h2>
    <div class="grid-2">
      <div class="card good"><strong>What search engines are great at</strong><ul>
        <li>Millisecond full-text queries over billions of docs</li>
        <li>Relevance ranking, typo tolerance, synonyms, phrase search</li>
        <li>Facets, filters and aggregations on the same query</li>
        <li>Horizontal scale by adding shards and replicas</li>
      </ul></div>
      <div class="card bad"><strong>What they are bad at</strong><ul>
        <li><strong>Eventual consistency</strong>: writes show up after a refresh (~1 s) plus pipeline lag; not for read-your-own-write flows like "my order"</li>
        <li>No multi-document transactions, no joins, no foreign keys</li>
        <li>Updates are expensive (delete + reinsert + merge)</li>
        <li>Memory and ops heavy (JVM heap, shard balancing)</li>
        <li>Not a primary datastore: always be able to rebuild it from the source DB</li>
      </ul></div>
    </div>
    <p>Rule of thumb: item page, cart and orders read from the database (or a <a href="#/p/caching">cache</a>); search is only for discovery. If one write must be visible at once, pass <code>refresh=wait_for</code>.</p>

    <h2>Common interview questions and pitfalls</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>"Product data lives in MySQL, the source of truth. Debezium streams the binlog into Kafka, and an indexer builds a denormalised product document and bulk-writes it into Elasticsearch, using the row version as an external version so late events can't overwrite newer ones. The index is near real-time, about 1 to 2 seconds behind, which is fine for discovery. The product page and checkout read from MySQL. Shards at 20 to 40 GB, extra replicas for sale days, and mapping changes via a new index plus an alias swap."</div>
    <ul>
      <li><strong>"How does search work?"</strong> Analyzer → terms → posting lists → intersect/union → BM25 → top-k per shard → merge → fetch.</li>
      <li><strong>"Why not just use the database?"</strong> <code>LIKE '%x%'</code> is a full scan with no ranking.</li>
      <li><strong>"A product was updated but search shows the old price."</strong> Refresh interval, CDC lag or a failed dual write. Render the price from the DB.</li>
      <li><strong>"How many shards?"</strong> From data size: 500 GB of products at about 25 GB per shard is 20 primaries, plus replicas for read QPS.</li>
    </ul>
    <div class="callout warn"><strong>Pitfalls</strong>Elasticsearch as the only copy of data; dual writes with no reconciliation; <code>text</code> where you need exact filters (use <code>keyword</code>); different analyzers at index and query time; deep pagination with <code>from</code>; too many tiny shards.</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>Why can't a B-tree index speed up <code>WHERE title LIKE '%phone%'</code>, and what structure does?</summary><div>A B-tree is sorted by prefix, so a leading wildcard means a full scan. An inverted index stores each word as a term pointing to its docs, so "phone" is one dictionary lookup plus one posting list.</div></details>
      <details><summary>Posting lists: black = [0, 1, 4, 9, 12], iphone = [0, 4, 12, 30]. Walk through <code>black AND iphone</code>.</summary><div>Two pointers. 0 = 0 → emit 0. 1 &lt; 4 → advance black. 4 = 4 → emit 4. 9 &lt; 12 → advance black. 12 = 12 → emit 12. black is exhausted → stop. Result [0, 4, 12] in O(m + n), because both lists are sorted by doc id.</div></details>
      <details><summary>How does the engine answer the phrase query "leather case" without rereading documents?</summary><div>Intersect the posting lists for leather and case, then check stored positions: a match needs position p for leather and p + 1 for case.</div></details>
      <details><summary>What two problems of plain TF-IDF does BM25 fix?</summary><div>TF saturation (k1): repeats give diminishing returns, defeating keyword stuffing. Tunable length normalisation (b): long docs are penalised relative to the average by a controlled amount.</div></details>
      <details><summary>A seller updates a price and searches 300 ms later, but sees the old price. Name the likely causes and fixes.</summary><div>The refresh interval (default 1 s) has not made the new segment searchable yet, plus CDC/Kafka lag. Render the price from the DB; if this flow must be fresh, use <code>refresh=wait_for</code> on the write.</div></details>
      <details><summary>You need to change the analyzer on a 200 GB product index without downtime. How?</summary><div>The app queries an alias. Build a new index with the new mapping, backfill it, dual-feed it from the CDC indexer until it catches up, then swap the alias atomically. Keep the old index for rollback.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li><code>LIKE '%term%'</code> is a full scan with no ranking; search needs an inverted index: term → sorted posting list of doc ids (with frequencies and positions).</li>
      <li>The same analyzer (tokenise, lowercase, stop words, stemming, synonyms) must run at index and query time; each step trades recall against precision.</li>
      <li>AND = intersect sorted lists, OR = union, phrase = intersect then check positions. Start with the rarest term.</li>
      <li>Ranking: TF-IDF (frequent here, rare overall); BM25 adds TF saturation and length normalisation; business signals go on top.</li>
      <li>Elasticsearch: index → primary/replica shards → immutable segments; ~1 s refresh makes writes searchable (near real-time); queries scatter to all shards and gather in two phases.</li>
      <li>Search is a derived, eventually consistent copy. Sync it with CDC (Debezium → Kafka → indexer), reindex behind aliases, and never make it the primary datastore.</li>
    </ul></div>
  `,

  code: {
    invidx: {
      title: "Inverted index: analyzer, AND via sorted posting-list intersection, TF-IDF ranking",
      java: String.raw`import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

public class Main {
    static final Set<String> STOP_WORDS = Set.of("a", "an", "and", "for", "in", "of", "on", "the", "to", "with");

    /** One entry in a posting list: which document, and how often the term appears in it. */
    record Posting(int docId, int tf) {}

    record Hit(int docId, double score) {}

    static class InvertedIndex {
        private final Map<String, List<Posting>> index = new TreeMap<>();
        private final List<String> docs = new ArrayList<>();
        private final List<Integer> lengths = new ArrayList<>(); // tokens per doc, after analysis

        /** Analysis pipeline: lowercase, split on non-alphanumerics, drop stop words. */
        static List<String> analyze(String text) {
            List<String> tokens = new ArrayList<>();
            for (String t : text.toLowerCase().split("[^a-z0-9]+")) {
                if (!t.isEmpty() && !STOP_WORDS.contains(t)) tokens.add(t);
            }
            return tokens;
        }

        void add(String title) {
            int docId = docs.size(); // ids grow, so every posting list stays sorted
            docs.add(title);
            List<String> tokens = analyze(title);
            lengths.add(tokens.size());
            Map<String, Integer> tf = new TreeMap<>();
            for (String t : tokens) tf.merge(t, 1, Integer::sum);
            tf.forEach((term, count) ->
                index.computeIfAbsent(term, k -> new ArrayList<>()).add(new Posting(docId, count)));
        }

        List<Integer> docIds(String term) {
            List<Integer> ids = new ArrayList<>();
            for (Posting p : index.getOrDefault(term, List.of())) ids.add(p.docId());
            return ids;
        }

        /** Two-pointer merge of two sorted lists: O(|a| + |b|). */
        static List<Integer> intersect(List<Integer> a, List<Integer> b) {
            List<Integer> out = new ArrayList<>();
            int i = 0, j = 0;
            while (i < a.size() && j < b.size()) {
                int x = a.get(i), y = b.get(j);
                if (x == y) { out.add(x); i++; j++; }
                else if (x < y) i++;
                else j++;
            }
            return out;
        }

        /** AND query: start from the rarest term so the running result stays small. */
        List<Integer> searchAnd(String query) {
            List<String> terms = new ArrayList<>(new LinkedHashSet<>(analyze(query)));
            if (terms.isEmpty()) return List.of();
            terms.sort(Comparator.comparingInt(t -> index.getOrDefault(t, List.of()).size()));
            List<Integer> result = docIds(terms.get(0));
            for (int k = 1; k < terms.size() && !result.isEmpty(); k++) {
                result = intersect(result, docIds(terms.get(k)));
            }
            return result;
        }

        double idf(String term) {
            int df = index.getOrDefault(term, List.of()).size();
            return df == 0 ? 0.0 : Math.log((double) docs.size() / df);
        }

        /** OR query ranked by TF-IDF: score = sum over terms of (tf / docLength) * ln(N / df). */
        List<Hit> searchRanked(String query) {
            Map<Integer, Double> scores = new HashMap<>();
            for (String term : new LinkedHashSet<>(analyze(query))) {
                double idf = idf(term);
                for (Posting p : index.getOrDefault(term, List.of())) {
                    double tf = (double) p.tf() / lengths.get(p.docId());
                    scores.merge(p.docId(), tf * idf, Double::sum);
                }
            }
            List<Hit> hits = new ArrayList<>();
            scores.forEach((id, s) -> hits.add(new Hit(id, s)));
            hits.sort(Comparator.comparingDouble(Hit::score).reversed().thenComparingInt(Hit::docId));
            return hits;
        }
    }

    public static void main(String[] args) {
        String[] products = {
            "Apple iPhone 15 Pro Max 256GB Black",
            "Samsung Galaxy S24 Ultra Phone Black",
            "Apple AirPods Pro with MagSafe Case",
            "OnePlus Nord Buds for the Gym",
            "Black Leather Case for iPhone 15",
            "Redmi Note 13 Pro Phone with Fast Charger",
        };
        InvertedIndex idx = new InvertedIndex();
        for (String p : products) idx.add(p);
        System.out.println("Indexed " + products.length + " products, " + idx.index.size() + " distinct terms");
        for (String t : new String[] {"black", "iphone", "pro", "phone"}) {
            System.out.println("postings(" + t + ") = " + idx.docIds(t));
        }
        for (String q : new String[] {"Black iPhone", "pro phone", "case for the iPhone", "pro xyz"}) {
            System.out.println("AND \"" + q + "\" -> " + idx.searchAnd(q));
        }
        for (String q : new String[] {"black iphone", "apple pro case"}) {
            System.out.println("Ranked OR \"" + q + "\":");
            for (Hit h : idx.searchRanked(q)) {
                System.out.printf("  %.4f  #%d %s%n", h.score(), h.docId(), products[h.docId()]);
            }
        }
    }
}`,
      python: String.raw`import math
import re

STOP_WORDS = {"a", "an", "and", "for", "in", "of", "on", "the", "to", "with"}


def analyze(text):
    """Analysis pipeline: lowercase, split on non-alphanumerics, drop stop words."""
    return [t for t in re.split(r"[^a-z0-9]+", text.lower()) if t and t not in STOP_WORDS]


def intersect(a, b):
    """Two-pointer merge of two sorted lists: O(len(a) + len(b))."""
    out, i, j = [], 0, 0
    while i < len(a) and j < len(b):
        if a[i] == b[j]:
            out.append(a[i])
            i += 1
            j += 1
        elif a[i] < b[j]:
            i += 1
        else:
            j += 1
    return out


class InvertedIndex:
    def __init__(self):
        self.index = {}    # term -> list of (doc_id, tf), sorted by doc_id
        self.docs = []
        self.lengths = []  # tokens per doc, after analysis

    def add(self, title):
        doc_id = len(self.docs)  # ids grow, so every posting list stays sorted
        self.docs.append(title)
        tokens = analyze(title)
        self.lengths.append(len(tokens))
        tf = {}
        for t in tokens:
            tf[t] = tf.get(t, 0) + 1
        for term, count in tf.items():
            self.index.setdefault(term, []).append((doc_id, count))

    def doc_ids(self, term):
        return [d for d, _ in self.index.get(term, [])]

    def search_and(self, query):
        """AND query: start from the rarest term so the running result stays small."""
        terms = list(dict.fromkeys(analyze(query)))
        if not terms:
            return []
        terms.sort(key=lambda t: len(self.index.get(t, [])))
        result = self.doc_ids(terms[0])
        for term in terms[1:]:
            if not result:
                break
            result = intersect(result, self.doc_ids(term))
        return result

    def idf(self, term):
        df = len(self.index.get(term, []))
        return math.log(len(self.docs) / df) if df else 0.0

    def search_ranked(self, query):
        """OR query ranked by TF-IDF: score = sum of (tf / docLength) * ln(N / df)."""
        scores = {}
        for term in dict.fromkeys(analyze(query)):
            idf = self.idf(term)
            for doc_id, tf in self.index.get(term, []):
                scores[doc_id] = scores.get(doc_id, 0.0) + tf / self.lengths[doc_id] * idf
        return sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))


def fmt(ids):
    return "[" + ", ".join(str(i) for i in ids) + "]"


def main():
    products = [
        "Apple iPhone 15 Pro Max 256GB Black",
        "Samsung Galaxy S24 Ultra Phone Black",
        "Apple AirPods Pro with MagSafe Case",
        "OnePlus Nord Buds for the Gym",
        "Black Leather Case for iPhone 15",
        "Redmi Note 13 Pro Phone with Fast Charger",
    ]
    idx = InvertedIndex()
    for p in products:
        idx.add(p)
    print(f"Indexed {len(products)} products, {len(idx.index)} distinct terms")
    for t in ["black", "iphone", "pro", "phone"]:
        print(f"postings({t}) = {fmt(idx.doc_ids(t))}")
    for q in ["Black iPhone", "pro phone", "case for the iPhone", "pro xyz"]:
        print(f'AND "{q}" -> {fmt(idx.search_and(q))}')
    for q in ["black iphone", "apple pro case"]:
        print(f'Ranked OR "{q}":')
        for doc_id, score in idx.search_ranked(q):
            print(f"  {score:.4f}  #{doc_id} {products[doc_id]}")


if __name__ == "__main__":
    main()`,
      cpp: String.raw`#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <map>
#include <set>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

using namespace std;

const unordered_set<string> STOP_WORDS = {"a", "an", "and", "for", "in", "of", "on", "the", "to", "with"};

// One entry in a posting list: which document, and how often the term appears in it.
struct Posting {
    int docId;
    int tf;
};

// Analysis pipeline: lowercase, split on non-alphanumerics, drop stop words.
vector<string> analyze(const string& text) {
    vector<string> tokens;
    string cur;
    auto flush = [&]() {
        if (!cur.empty() && !STOP_WORDS.count(cur)) tokens.push_back(cur);
        cur.clear();
    };
    for (char ch : text) {
        unsigned char c = static_cast<unsigned char>(ch);
        if (isalnum(c)) cur += static_cast<char>(tolower(c));
        else flush();
    }
    flush();
    return tokens;
}

// Keep the first occurrence of each term, in query order.
vector<string> distinctTerms(const string& query) {
    vector<string> out;
    set<string> seen;
    for (auto& t : analyze(query))
        if (seen.insert(t).second) out.push_back(t);
    return out;
}

// Two-pointer merge of two sorted lists: O(|a| + |b|).
vector<int> intersect(const vector<int>& a, const vector<int>& b) {
    vector<int> out;
    size_t i = 0, j = 0;
    while (i < a.size() && j < b.size()) {
        if (a[i] == b[j]) { out.push_back(a[i]); i++; j++; }
        else if (a[i] < b[j]) i++;
        else j++;
    }
    return out;
}

class InvertedIndex {
public:
    map<string, vector<Posting>> index;
    vector<string> docs;
    vector<int> lengths;  // tokens per doc, after analysis

    void add(const string& title) {
        int docId = static_cast<int>(docs.size());  // ids grow, so posting lists stay sorted
        docs.push_back(title);
        vector<string> tokens = analyze(title);
        lengths.push_back(static_cast<int>(tokens.size()));
        map<string, int> tf;
        for (auto& t : tokens) tf[t]++;
        for (auto& [term, count] : tf) index[term].push_back({docId, count});
    }

    const vector<Posting>& postings(const string& term) const {
        static const vector<Posting> empty;
        auto it = index.find(term);
        return it == index.end() ? empty : it->second;
    }

    vector<int> docIds(const string& term) const {
        vector<int> ids;
        for (auto& p : postings(term)) ids.push_back(p.docId);
        return ids;
    }

    // AND query: start from the rarest term so the running result stays small.
    vector<int> searchAnd(const string& query) const {
        vector<string> terms = distinctTerms(query);
        if (terms.empty()) return {};
        stable_sort(terms.begin(), terms.end(), [&](const string& x, const string& y) {
            return postings(x).size() < postings(y).size();
        });
        vector<int> result = docIds(terms[0]);
        for (size_t k = 1; k < terms.size() && !result.empty(); k++)
            result = intersect(result, docIds(terms[k]));
        return result;
    }

    double idf(const string& term) const {
        size_t df = postings(term).size();
        return df == 0 ? 0.0 : log(static_cast<double>(docs.size()) / static_cast<double>(df));
    }

    // OR query ranked by TF-IDF: score = sum of (tf / docLength) * ln(N / df).
    vector<pair<int, double>> searchRanked(const string& query) const {
        unordered_map<int, double> scores;
        for (auto& term : distinctTerms(query)) {
            double w = idf(term);
            for (auto& p : postings(term))
                scores[p.docId] += static_cast<double>(p.tf) / lengths[p.docId] * w;
        }
        vector<pair<int, double>> hits(scores.begin(), scores.end());
        sort(hits.begin(), hits.end(), [](const pair<int, double>& x, const pair<int, double>& y) {
            if (x.second != y.second) return x.second > y.second;
            return x.first < y.first;
        });
        return hits;
    }
};

string fmt(const vector<int>& ids) {
    string s = "[";
    for (size_t i = 0; i < ids.size(); i++) s += (i ? ", " : "") + to_string(ids[i]);
    return s + "]";
}

int main() {
    vector<string> products = {
        "Apple iPhone 15 Pro Max 256GB Black",
        "Samsung Galaxy S24 Ultra Phone Black",
        "Apple AirPods Pro with MagSafe Case",
        "OnePlus Nord Buds for the Gym",
        "Black Leather Case for iPhone 15",
        "Redmi Note 13 Pro Phone with Fast Charger",
    };
    InvertedIndex idx;
    for (auto& p : products) idx.add(p);
    printf("Indexed %zu products, %zu distinct terms\n", products.size(), idx.index.size());
    for (string t : {"black", "iphone", "pro", "phone"})
        printf("postings(%s) = %s\n", t.c_str(), fmt(idx.docIds(t)).c_str());
    for (string q : {"Black iPhone", "pro phone", "case for the iPhone", "pro xyz"})
        printf("AND \"%s\" -> %s\n", q.c_str(), fmt(idx.searchAnd(q)).c_str());
    for (string q : {"black iphone", "apple pro case"}) {
        printf("Ranked OR \"%s\":\n", q.c_str());
        for (auto& [docId, score] : idx.searchRanked(q))
            printf("  %.4f  #%d %s\n", score, docId, products[docId].c_str());
    }
    return 0;
}`,
      javascript: String.raw`const STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "on", "the", "to", "with"]);

// Analysis pipeline: lowercase, split on non-alphanumerics, drop stop words.
function analyze(text) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !STOP_WORDS.has(t));
}

// Two-pointer merge of two sorted arrays: O(a.length + b.length).
function intersect(a, b) {
  const out = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push(a[i]); i++; j++; }
    else if (a[i] < b[j]) i++;
    else j++;
  }
  return out;
}

class InvertedIndex {
  constructor() {
    this.index = new Map(); // term -> [{docId, tf}], sorted by docId
    this.docs = [];
    this.lengths = [];      // tokens per doc, after analysis
  }

  add(title) {
    const docId = this.docs.length; // ids grow, so every posting list stays sorted
    this.docs.push(title);
    const tokens = analyze(title);
    this.lengths.push(tokens.length);
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    for (const [term, count] of tf) {
      if (!this.index.has(term)) this.index.set(term, []);
      this.index.get(term).push({ docId, tf: count });
    }
  }

  postings(term) {
    return this.index.get(term) || [];
  }

  docIds(term) {
    return this.postings(term).map((p) => p.docId);
  }

  // AND query: start from the rarest term so the running result stays small.
  searchAnd(query) {
    const terms = [...new Set(analyze(query))];
    if (terms.length === 0) return [];
    terms.sort((x, y) => this.postings(x).length - this.postings(y).length);
    let result = this.docIds(terms[0]);
    for (let k = 1; k < terms.length && result.length > 0; k++) {
      result = intersect(result, this.docIds(terms[k]));
    }
    return result;
  }

  idf(term) {
    const df = this.postings(term).length;
    return df === 0 ? 0 : Math.log(this.docs.length / df);
  }

  // OR query ranked by TF-IDF: score = sum of (tf / docLength) * ln(N / df).
  searchRanked(query) {
    const scores = new Map();
    for (const term of new Set(analyze(query))) {
      const idf = this.idf(term);
      for (const p of this.postings(term)) {
        const tf = p.tf / this.lengths[p.docId];
        scores.set(p.docId, (scores.get(p.docId) || 0) + tf * idf);
      }
    }
    return [...scores].sort((x, y) => y[1] - x[1] || x[0] - y[0]);
  }
}

const fmt = (ids) => "[" + ids.join(", ") + "]";

const products = [
  "Apple iPhone 15 Pro Max 256GB Black",
  "Samsung Galaxy S24 Ultra Phone Black",
  "Apple AirPods Pro with MagSafe Case",
  "OnePlus Nord Buds for the Gym",
  "Black Leather Case for iPhone 15",
  "Redmi Note 13 Pro Phone with Fast Charger",
];
const idx = new InvertedIndex();
products.forEach((p) => idx.add(p));
console.log("Indexed " + products.length + " products, " + idx.index.size + " distinct terms");
for (const t of ["black", "iphone", "pro", "phone"]) {
  console.log("postings(" + t + ") = " + fmt(idx.docIds(t)));
}
for (const q of ["Black iPhone", "pro phone", "case for the iPhone", "pro xyz"]) {
  console.log('AND "' + q + '" -> ' + fmt(idx.searchAnd(q)));
}
for (const q of ["black iphone", "apple pro case"]) {
  console.log('Ranked OR "' + q + '":');
  for (const [docId, score] of idx.searchRanked(q)) {
    console.log("  " + score.toFixed(4) + "  #" + docId + " " + products[docId]);
  }
}`,
      go: String.raw`package main

import (
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
)

var stopWords = map[string]bool{"a": true, "an": true, "and": true, "for": true, "in": true,
	"of": true, "on": true, "the": true, "to": true, "with": true}

// Posting is one entry in a posting list: which document, and how often the term appears in it.
type Posting struct {
	DocID int
	TF    int
}

// Hit is one ranked result.
type Hit struct {
	DocID int
	Score float64
}

// analyze is the analysis pipeline: lowercase, split on non-alphanumerics, drop stop words.
func analyze(text string) []string {
	parts := strings.FieldsFunc(strings.ToLower(text), func(r rune) bool {
		return !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'))
	})
	tokens := []string{}
	for _, t := range parts {
		if !stopWords[t] {
			tokens = append(tokens, t)
		}
	}
	return tokens
}

// distinctTerms keeps the first occurrence of each term, in query order.
func distinctTerms(query string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, t := range analyze(query) {
		if !seen[t] {
			seen[t] = true
			out = append(out, t)
		}
	}
	return out
}

// intersect is a two-pointer merge of two sorted slices: O(len(a) + len(b)).
func intersect(a, b []int) []int {
	out := []int{}
	i, j := 0, 0
	for i < len(a) && j < len(b) {
		switch {
		case a[i] == b[j]:
			out = append(out, a[i])
			i++
			j++
		case a[i] < b[j]:
			i++
		default:
			j++
		}
	}
	return out
}

// InvertedIndex maps each term to a posting list sorted by doc id.
type InvertedIndex struct {
	index   map[string][]Posting
	docs    []string
	lengths []int // tokens per doc, after analysis
}

func NewInvertedIndex() *InvertedIndex {
	return &InvertedIndex{index: map[string][]Posting{}}
}

func (ix *InvertedIndex) Add(title string) {
	docID := len(ix.docs) // ids grow, so every posting list stays sorted
	ix.docs = append(ix.docs, title)
	tokens := analyze(title)
	ix.lengths = append(ix.lengths, len(tokens))
	tf := map[string]int{}
	order := []string{}
	for _, t := range tokens {
		if tf[t] == 0 {
			order = append(order, t)
		}
		tf[t]++
	}
	for _, term := range order {
		ix.index[term] = append(ix.index[term], Posting{docID, tf[term]})
	}
}

func (ix *InvertedIndex) DocIDs(term string) []int {
	ids := []int{}
	for _, p := range ix.index[term] {
		ids = append(ids, p.DocID)
	}
	return ids
}

// SearchAnd starts from the rarest term so the running result stays small.
func (ix *InvertedIndex) SearchAnd(query string) []int {
	terms := distinctTerms(query)
	if len(terms) == 0 {
		return []int{}
	}
	sort.SliceStable(terms, func(x, y int) bool {
		return len(ix.index[terms[x]]) < len(ix.index[terms[y]])
	})
	result := ix.DocIDs(terms[0])
	for k := 1; k < len(terms) && len(result) > 0; k++ {
		result = intersect(result, ix.DocIDs(terms[k]))
	}
	return result
}

func (ix *InvertedIndex) IDF(term string) float64 {
	df := len(ix.index[term])
	if df == 0 {
		return 0
	}
	return math.Log(float64(len(ix.docs)) / float64(df))
}

// SearchRanked is an OR query ranked by TF-IDF: score = sum of (tf / docLength) * ln(N / df).
func (ix *InvertedIndex) SearchRanked(query string) []Hit {
	scores := map[int]float64{}
	for _, term := range distinctTerms(query) {
		idf := ix.IDF(term)
		for _, p := range ix.index[term] {
			scores[p.DocID] += float64(p.TF) / float64(ix.lengths[p.DocID]) * idf
		}
	}
	hits := []Hit{}
	for id, s := range scores {
		hits = append(hits, Hit{id, s})
	}
	sort.Slice(hits, func(x, y int) bool {
		if hits[x].Score != hits[y].Score {
			return hits[x].Score > hits[y].Score
		}
		return hits[x].DocID < hits[y].DocID
	})
	return hits
}

func format(ids []int) string {
	parts := make([]string, len(ids))
	for i, id := range ids {
		parts[i] = strconv.Itoa(id)
	}
	return "[" + strings.Join(parts, ", ") + "]"
}

func main() {
	products := []string{
		"Apple iPhone 15 Pro Max 256GB Black",
		"Samsung Galaxy S24 Ultra Phone Black",
		"Apple AirPods Pro with MagSafe Case",
		"OnePlus Nord Buds for the Gym",
		"Black Leather Case for iPhone 15",
		"Redmi Note 13 Pro Phone with Fast Charger",
	}
	idx := NewInvertedIndex()
	for _, p := range products {
		idx.Add(p)
	}
	fmt.Printf("Indexed %d products, %d distinct terms\n", len(products), len(idx.index))
	for _, t := range []string{"black", "iphone", "pro", "phone"} {
		fmt.Printf("postings(%s) = %s\n", t, format(idx.DocIDs(t)))
	}
	for _, q := range []string{"Black iPhone", "pro phone", "case for the iPhone", "pro xyz"} {
		fmt.Printf("AND \"%s\" -> %s\n", q, format(idx.SearchAnd(q)))
	}
	for _, q := range []string{"black iphone", "apple pro case"} {
		fmt.Printf("Ranked OR \"%s\":\n", q)
		for _, h := range idx.SearchRanked(q) {
			fmt.Printf("  %.4f  #%d %s\n", h.Score, h.DocID, products[h.DocID])
		}
	}
}`,
    },
  },
  diagrams: {
    analysis: String.raw`flowchart LR
      T["Running Shoes for Men!"] --> TK["Tokenizer: Running, Shoes, for, Men"]
      TK --> LC["Lowercase: running, shoes, for, men"]
      LC --> SW["Stop words: running, shoes, men"]
      SW --> ST["Stemmer: run, shoe, men"]
      ST --> IX[("Inverted index")]`,
    cluster: String.raw`flowchart TB
      C["Client"] --> CO["Coordinating node"]
      M["Master node: cluster state"] -.-> CO
      subgraph N1["Node 1"]
        P0["P0"]
        R1["R1"]
      end
      subgraph N2["Node 2"]
        P1["P1"]
        R2["R2"]
      end
      subgraph N3["Node 3"]
        P2["P2"]
        R0["R0"]
      end
      CO --> P0
      CO --> P1
      CO --> P2
      P0 -. replicate .-> R0
      P1 -. replicate .-> R1
      P2 -. replicate .-> R2`,
    qtf: String.raw`sequenceDiagram
      participant C as Client
      participant CO as Coordinator
      participant S1 as Shard 1
      participant S2 as Shard 2
      participant S3 as Shard 3
      C->>CO: search "black iphone", size 10
      Note over CO,S3: Query phase
      CO->>S1: run query, top 10
      CO->>S2: run query, top 10
      CO->>S3: run query, top 10
      S1-->>CO: 10 ids + scores
      S2-->>CO: 10 ids + scores
      S3-->>CO: 10 ids + scores
      Note over CO: merge 30 hits, keep global top 10
      Note over CO,S3: Fetch phase
      CO->>S1: get docs 4, 17, 92
      CO->>S3: get docs 8, 51
      S1-->>CO: full documents
      S3-->>CO: full documents
      CO-->>C: 10 ranked results`,
    cdc: String.raw`flowchart LR
      App["Catalogue service"] -->|write| DB[("MySQL: source of truth")]
      DB -->|binlog| DZ["Debezium"]
      DZ --> K["Kafka topic"]
      K --> IX["Indexer: build doc, bulk write"]
      IX --> ES[("Elasticsearch")]
      U["Search page"] --> ES
      PP["Product page, checkout"] --> DB`,
  },
});
