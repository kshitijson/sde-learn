SD.register({
  id: "lru-cache-lld",
  html: String.raw`
<p class="lead">"Design an LRU cache" is the most popular short machine-coding question. It shows up as LeetCode 146 in DSA rounds and as a 45 to 60 minute LLD round at Amazon, Flipkart, Swiggy, PhonePe and Microsoft. The core trick is small: a hash map for O(1) lookup plus a doubly linked list for O(1) reordering. A strong answer adds a pluggable eviction policy, an eviction listener, per-entry TTL with a testable clock, a thread-safety story, and an LFU follow-up. This page covers all of it, with runnable code in five languages.</p>

<h2>Problem statement</h2>
<p>Build an in-memory key-value cache with a fixed capacity. When the cache is full and a new key arrives, it must throw out the <mark>least recently used</mark> entry: the one that nobody has read or written for the longest time. Both <code>get(key)</code> and <code>put(key, value)</code> must run in O(1) time on average.</p>
<p>LRU (Least Recently Used) works because of <em>temporal locality</em>: data used recently is likely to be used again soon. A Swiggy user who just opened a restaurant menu will probably open it again in minutes. See <a href="#/p/caching">Caching</a> for where caches sit in a real system. In a DSA round the interviewer only wants the two methods. In an LLD round they want a small, extensible library. Ask which one you are in.</p>

<div class="callout tip"><strong>Try it first</strong>Before reading on, take 10 minutes. Which data structure gives you O(1) lookup by key? Which gives you O(1) "move this item to the front" and O(1) "remove the item at the back"? How do you connect the two so that a key lookup lands you directly on the list item? Sketch <code>get</code> and <code>put</code> as 4 or 5 lines of pseudocode each.</div>

<details class="hint"><summary>Hint 1: Why not just a hash map with timestamps?</summary>
<p>You can store <code>key → (value, lastUsedAt)</code>. Reads and writes are O(1), but eviction scans every entry for the oldest timestamp: O(n). A min-heap on timestamp gets eviction to O(log n), but every <code>get</code> changes a timestamp, so every access becomes O(log n) too. You need a structure that keeps recency order for free.</p>
</details>
<details class="hint"><summary>Hint 2: A list ordered by recency</summary>
<p>Keep entries in a linked list: most recently used at the front, least recently used at the back. On every access, move the entry to the front. To evict, cut the back. Both are O(1) <em>if</em> you already hold a pointer to the node and the list is doubly linked, so you can unlink a node without walking to find its predecessor.</p>
</details>
<details class="hint"><summary>Hint 3: Glue them with a map of pointers</summary>
<p>Store <code>key → node</code> in the hash map, and keep the key inside the node too. The map takes you to the node in O(1). The node's <code>prev</code> and <code>next</code> pointers let you unlink it in O(1). When you evict the tail node, read its key to delete it from the map. Add two dummy <em>sentinel</em> nodes, <code>head</code> and <code>tail</code>, so you never write "if this is the first node" special cases.</p>
</details>

<h2>Requirements</h2>
<p>Clarify before you code: Is capacity in entries or bytes? Does updating a key count as a use? Do callers need to know when something is evicted? Will many threads call the cache at once?</p>
<div class="grid-2">
<div class="card">
<h3>Functional</h3>
<ul>
<li><code>get(key)</code> returns the value or a miss, and marks the key as most recently used.</li>
<li><code>put(key, value)</code> inserts or updates. On insert into a full cache, evict the least recently used key first.</li>
<li>Fixed <strong>capacity</strong> in number of entries, set at construction, at least 1.</li>
<li><strong>Generic</strong> keys and values: <code>Cache&lt;K, V&gt;</code>, not just <code>int → int</code>.</li>
<li><strong>Eviction listener:</strong> callers can register callbacks that run when an entry is removed, with the reason (capacity or expiry).</li>
<li><strong>Optional per-entry TTL</strong> (time to live): <code>put(key, value, ttl)</code>. An expired entry behaves like a miss.</li>
<li>Optional: <code>delete(key)</code>, <code>size()</code>, hit and miss counters.</li>
</ul>
</div>
<div class="card">
<h3>Non-functional</h3>
<ul>
<li><strong>O(1)</strong> average time for <code>get</code>, <code>put</code>, <code>delete</code> and eviction.</li>
<li><strong>Extensible:</strong> swapping LRU for LFU or FIFO must not touch the cache class.</li>
<li><strong>Testable:</strong> time is injected through a <code>Clock</code> interface, so TTL tests do not call <code>sleep()</code>.</li>
<li><strong>Thread safety</strong> as a follow-up: correct under many concurrent callers, with a plan for when one lock becomes the bottleneck.</li>
<li><strong>Memory:</strong> O(capacity). No unbounded side structures.</li>
</ul>
</div>
</div>

<h2>How to approach the machine-coding round</h2>
<div class="callout info"><strong>Time plan for a 45 to 60 minute round</strong>
<table>
<thead><tr><th>Minutes</th><th>What you do</th></tr></thead>
<tbody>
<tr><td>0 to 5</td><td>Clarify: capacity unit, update counts as use, TTL needed, listener needed, threads. Say what you will skip.</td></tr>
<tr><td>5 to 10</td><td>Draw the map plus list picture and the class list: <code>Cache</code>, <code>EvictionPolicy</code>, <code>LruPolicy</code>, <code>EvictionListener</code>, <code>Clock</code>.</td></tr>
<tr><td>10 to 35</td><td>Code the linked list helpers first (<code>addAfterHead</code>, <code>unlink</code>), then the policy, then the cache, then <code>main</code>.</td></tr>
<tr><td>35 to 45</td><td>Run the demo. Test capacity 1, updating an existing key, getting a missing key, and an entry expiring.</td></tr>
<tr><td>45 to 60</td><td>Discuss thread safety, lock striping, and LFU. This is where SDE 2 candidates earn the extra marks.</td></tr>
</tbody>
</table>
<p><strong>What evaluators check:</strong></p>
<ol>
<li><strong>Correct O(1) structure</strong> on the first try, with no O(n) list scan hiding in <code>remove</code>.</li>
<li><strong>Pointer hygiene:</strong> sentinels, a single <code>unlink</code> helper, and no forgotten <code>map.remove</code> on eviction.</li>
<li><strong>Separation of concerns:</strong> the cache stores values, the policy decides who leaves. Listeners and the clock are injected.</li>
<li><strong>Edge cases:</strong> updating an existing key does not evict anything, capacity 1 works, expired entries are not returned.</li>
<li><strong>Concurrency awareness:</strong> knowing that <code>get</code> is also a write.</li>
</ol>
</div>

<h2>The core idea: hash map plus doubly linked list</h2>
<figure class="svg-fig">
<svg viewBox="0 0 680 290">
  <rect class="s-box" x="130" y="16" width="420" height="98" rx="10"/>
  <text class="s-muted" x="340" y="36" text-anchor="middle">HashMap: key → node (O(1) lookup)</text>
  <rect class="s-accent" x="150" y="50" width="100" height="44" rx="10"/>
  <text class="s-title" x="200" y="77" text-anchor="middle">key 3</text>
  <rect class="s-accent" x="290" y="50" width="100" height="44" rx="10"/>
  <text class="s-title" x="340" y="77" text-anchor="middle">key 4</text>
  <rect class="s-accent" x="430" y="50" width="100" height="44" rx="10"/>
  <text class="s-title" x="480" y="77" text-anchor="middle">key 1</text>
  <line class="s-line" x1="200" y1="94" x2="200" y2="176" marker-end="url(#arrow)"/>
  <line class="s-line" x1="340" y1="94" x2="340" y2="176" marker-end="url(#arrow)"/>
  <line class="s-line" x1="480" y1="94" x2="480" y2="176" marker-end="url(#arrow)"/>
  <rect class="s-box" x="20" y="180" width="90" height="56" rx="10"/>
  <text class="s-title" x="65" y="213" text-anchor="middle">HEAD</text>
  <rect class="s-green" x="150" y="180" width="100" height="56" rx="10"/>
  <text class="s-title" x="200" y="204" text-anchor="middle">3</text>
  <text class="s-muted" x="200" y="224" text-anchor="middle">THREE</text>
  <rect class="s-box" x="290" y="180" width="100" height="56" rx="10"/>
  <text class="s-title" x="340" y="204" text-anchor="middle">4</text>
  <text class="s-muted" x="340" y="224" text-anchor="middle">four</text>
  <rect class="s-red" x="430" y="180" width="100" height="56" rx="10"/>
  <text class="s-title" x="480" y="204" text-anchor="middle">1</text>
  <text class="s-muted" x="480" y="224" text-anchor="middle">one</text>
  <rect class="s-box" x="570" y="180" width="90" height="56" rx="10"/>
  <text class="s-title" x="615" y="213" text-anchor="middle">TAIL</text>
  <line class="s-line" x1="110" y1="198" x2="148" y2="198" marker-end="url(#arrow)"/>
  <line class="s-line" x1="150" y1="220" x2="112" y2="220" marker-end="url(#arrow)"/>
  <line class="s-line" x1="250" y1="198" x2="288" y2="198" marker-end="url(#arrow)"/>
  <line class="s-line" x1="290" y1="220" x2="252" y2="220" marker-end="url(#arrow)"/>
  <line class="s-line" x1="390" y1="198" x2="428" y2="198" marker-end="url(#arrow)"/>
  <line class="s-line" x1="430" y1="220" x2="392" y2="220" marker-end="url(#arrow)"/>
  <line class="s-line" x1="530" y1="198" x2="568" y2="198" marker-end="url(#arrow)"/>
  <line class="s-line" x1="570" y1="220" x2="532" y2="220" marker-end="url(#arrow)"/>
  <text class="s-muted" x="200" y="262" text-anchor="middle">most recently used</text>
  <text class="s-muted" x="480" y="262" text-anchor="middle">least recently used</text>
  <text class="s-muted" x="480" y="280" text-anchor="middle">(evicted next)</text>
  <text class="s-muted" x="65" y="262" text-anchor="middle">sentinel</text>
  <text class="s-muted" x="615" y="262" text-anchor="middle">sentinel</text>
</svg>
<figcaption>The map finds a node in O(1). The doubly linked list keeps recency order: front is most recent, back is least recent. HEAD and TAIL are dummy sentinel nodes that never hold data, so insert and unlink never need "is this the first node?" checks.</figcaption>
</figure>
<p>The hash map answers "where is key 4?" in O(1). The list answers "who is oldest?" in O(1): always the node just before <code>TAIL</code>. The glue is that the map stores a <em>pointer to the list node</em>, so you never walk the list.</p>
<p>Why <em>doubly</em> linked? Unlinking a node changes its predecessor's <code>next</code>. A singly linked list would need a walk to find the predecessor. With <code>prev</code>, unlinking is two assignments: <code>node.prev.next = node.next</code> and <code>node.next.prev = node.prev</code>.</p>
<p>Why keep the <em>key</em> inside the node? Eviction starts from the list (<code>TAIL.prev</code>), and you then must delete that key from the map. Forgetting this is one of the most common bugs in the round.</p>

<h3>Walkthrough: every operation is a few pointer moves</h3>
<p>Capacity 3. The snapshots show the list from most recent (left) to least recent (right).</p>
<div class="tabs">
<section data-tab="get (hit)">
<ol class="steps">
<li>Look up the key in the map. Found node 1.</li>
<li>Unlink node 1 from its place: point its neighbours at each other.</li>
<li>Insert node 1 right after <code>HEAD</code>. It is now the most recent.</li>
<li>Return its value.</li>
</ol>
<pre><code>before: HEAD ⇄ 3 ⇄ 2 ⇄ 1 ⇄ TAIL
get(1)
after:  HEAD ⇄ 1 ⇄ 3 ⇄ 2 ⇄ TAIL</code></pre>
<p>A miss touches nothing. With TTL, a node that exists but has expired is removed from both structures, the listener fires with <code>EXPIRED</code>, and the call reports a miss.</p>
</section>
<section data-tab="put (new key)">
<ol class="steps">
<li>The key is not in the map, and the cache has room (size 2, capacity 3).</li>
<li>Create a node holding the key and the value.</li>
<li>Insert it after <code>HEAD</code>, and add <code>key → node</code> to the map.</li>
</ol>
<pre><code>before: HEAD ⇄ 2 ⇄ 1 ⇄ TAIL
put(3, "three")
after:  HEAD ⇄ 3 ⇄ 2 ⇄ 1 ⇄ TAIL</code></pre>
</section>
<section data-tab="put (cache full)">
<ol class="steps">
<li>The key is new and the cache is full (size 3, capacity 3).</li>
<li>The victim is <code>TAIL.prev</code>: node 2. Unlink it.</li>
<li>Read the key from the victim node and delete it from the map.</li>
<li>Tell the eviction listeners: <code>onEvict(2, "two", CAPACITY)</code>.</li>
<li>Now insert the new key as in a normal put.</li>
</ol>
<pre><code>before: HEAD ⇄ 1 ⇄ 3 ⇄ 2 ⇄ TAIL
put(4, "four")         evicts 2
after:  HEAD ⇄ 4 ⇄ 1 ⇄ 3 ⇄ TAIL</code></pre>
<p>Order matters: evict <em>before</em> inserting. If you insert first, size briefly hits 4 and, worse, if capacity is 1 you might evict the entry you just added.</p>
</section>
<section data-tab="put (existing key)">
<ol class="steps">
<li>The key is already in the map. This is an update, not an insert.</li>
<li>Replace the value (and the expiry time, if a TTL was given).</li>
<li>Move the node to the front, exactly like a <code>get</code>.</li>
<li><strong>Do not evict.</strong> The size did not change.</li>
</ol>
<pre><code>before: HEAD ⇄ 4 ⇄ 1 ⇄ 3 ⇄ TAIL
put(3, "THREE")        no eviction
after:  HEAD ⇄ 3 ⇄ 4 ⇄ 1 ⇄ TAIL</code></pre>
<p>A classic bug is to check "is the cache full?" before checking "does the key exist?". Then updating key 3 in a full cache wrongly evicts key 1.</p>
</section>
</div>

<h2>The library answer, and when it is accepted</h2>
<p>Most languages ship a hash map that remembers order. Java's <code>LinkedHashMap</code> has an <em>access-order</em> mode plus a <code>removeEldestEntry</code> hook. Python's <code>OrderedDict</code> has <code>move_to_end</code> and <code>popitem(last=False)</code>. A JavaScript <code>Map</code> iterates in insertion order, so delete-then-set moves a key to the end. Go has <code>container/list</code>. C++ has none, so its answer is <code>std::list</code> plus <code>std::unordered_map</code>, with <code>list::splice</code> to move a node in O(1).</p>
<div data-code="library"></div>
<div class="grid-2">
<div class="card good"><strong>Accepted when</strong><p>The interviewer says "use whatever you like", or the cache is a small part of a bigger design (say, a rate limiter that keeps an LRU of user buckets). In production, a tested library (Caffeine in Java, <code>functools.lru_cache</code> in Python) beats a hand-rolled list.</p></div>
<div class="card bad"><strong>Not accepted when</strong><p>The question <em>is</em> the LRU cache. Write <code>extends LinkedHashMap</code> and expect "nice, now do it without that". Ask up front: "I know <code>LinkedHashMap</code> does this. Shall I use it, or build the list myself?"</p></div>
</div>

<h2>Core entities</h2>
<table>
<thead><tr><th>Entity</th><th>Kind</th><th>Responsibility</th></tr></thead>
<tbody>
<tr><td><code>Cache&lt;K, V&gt;</code></td><td>Service</td><td>Stores entries, enforces capacity and TTL, counts hits and misses, notifies listeners. Knows nothing about recency.</td></tr>
<tr><td><code>Entry&lt;V&gt;</code></td><td>Value object</td><td>The value plus its expiry time (0 means never).</td></tr>
<tr><td><code>EvictionPolicy&lt;K&gt;</code></td><td>Interface (Strategy)</td><td>Tracks keys and picks a victim: <code>keyAdded</code>, <code>keyAccessed</code>, <code>keyRemoved</code>, <code>evict</code>.</td></tr>
<tr><td><code>LruPolicy&lt;K&gt;</code></td><td>Strategy</td><td>Hash map of key to node plus a doubly linked list with sentinels. Victim is the tail.</td></tr>
<tr><td><code>EvictionListener&lt;K, V&gt;</code></td><td>Interface (Observer)</td><td><code>onEvict(key, value, cause)</code>. Used for metrics, logging, or write-back to a database.</td></tr>
<tr><td><code>RemovalCause</code></td><td>Enum</td><td><code>CAPACITY</code> or <code>EXPIRED</code>. Easy to add <code>EXPLICIT</code> or <code>REPLACED</code> later.</td></tr>
<tr><td><code>Clock</code></td><td>Interface</td><td><code>nowMillis()</code>. A system clock in production, a <code>ManualClock</code> in tests.</td></tr>
</tbody>
</table>
<p>The key design choice: the policy keeps its <em>own</em> key-to-node map, separate from the cache's key-to-entry map. That costs a second hash map, but the cache never touches a linked list, so <code>LfuPolicy</code> or <code>FifoPolicy</code> drops in without editing <code>Cache</code>. For raw speed, store the value inside the node and use one map, as the library and thread-safe versions do. Both are O(1). State the trade-off.</p>

<h2>Class diagram</h2>
<div data-diagram="classes" data-caption="The cache depends only on interfaces. Dotted arrows with hollow heads mean 'implements'."></div>

<h2>Design patterns used and why</h2>
<h3>Strategy: the eviction policy</h3>
<p>Strategy means "put interchangeable algorithms behind one interface and choose one at runtime". LRU is not always best: a nightly report that reads every product once flushes an LRU cache full of hot data. LFU (Least Frequently Used) protects popular keys; FIFO is cheaper. Each is one new class, and <code>Cache</code> stays closed for modification (the open/closed principle).</p>
<p>The interface is shaped by events: "key added", "key used", "key removed", "give me a victim". LRU moves a node on use, LFU bumps a counter, FIFO ignores <code>keyAccessed</code> entirely.</p>

<h3>Observer: the eviction listener</h3>
<p>Observer means "objects subscribe to an event and get called when it happens". Many parties care when an entry leaves: a metrics counter (a high eviction rate means the cache is too small), a logger, or a write-back hook that saves a dirty value to MySQL. The cache calls each registered <code>EvictionListener</code> with the key, value and cause. Caffeine calls this a <code>RemovalListener</code>. Listeners run inline (inside the lock, in the thread-safe version), so they must be fast; slow work goes to a queue.</p>

<h3>Dependency injection: the clock</h3>
<p>If the cache calls <code>System.currentTimeMillis()</code> directly, the only way to test expiry is <code>sleep(5000)</code>: slow and flaky. Instead the cache takes a <code>Clock</code>. Production passes a system clock; tests pass a <code>ManualClock</code> and call <code>advance(3000)</code>.</p>

<h2>Full implementation</h2>
<p>Each tab is one self-contained file that compiles and runs. The cache is generic, the eviction policy is injected, listeners are registered at runtime, and TTL uses an injected clock. Expired entries are removed lazily, when someone reads them.</p>
<div data-code="full"></div>
<p>Expected output (identical in every language):</p>
<pre><code>== LRU basics (capacity 3) ==
put 1, 2, 3
order (LRU first): 1 -&gt; 2 -&gt; 3
get(1) = one
order (LRU first): 2 -&gt; 3 -&gt; 1
put 4
  [evicted] 2=two (CAPACITY)
order (LRU first): 3 -&gt; 1 -&gt; 4
get(2) = miss
put 3 = THREE (update, no eviction)
order (LRU first): 1 -&gt; 4 -&gt; 3
== TTL with a manual clock ==
put 5 = five with ttl 5000 ms
  [evicted] 1=one (CAPACITY)
order (LRU first): 4 -&gt; 3 -&gt; 5
t=3000 get(5) = five
  [evicted] 5=five (EXPIRED)
t=6000 get(5) = miss
get(3) = THREE
order (LRU first): 4 -&gt; 3
size = 2, hits = 3, misses = 2</code></pre>
<p>Things to point out when you walk the interviewer through it:</p>
<ul>
<li><strong>Update before eviction check.</strong> <code>put</code> handles "key exists" first, so updating key 3 in a full cache evicts nothing.</li>
<li><strong>Lazy expiry.</strong> An expired entry holds its slot until someone reads it or it drifts to the tail. That keeps every call O(1). If memory is tight, add a background sweeper, or sample a few TTL keys several times a second, as Redis does.</li>
<li><strong>A miss is not an exception.</strong> <code>get</code> returns <code>null</code>, <code>None</code>, <code>undefined</code>, an empty <code>std::optional</code>, or Go's <code>(value, ok)</code>.</li>
<li><strong>Memory per entry.</strong> Key, value, two pointers, an expiry and map overhead: roughly 80 to 100 bytes on top of the data in Java. Budget about 100 MB for 1 million small entries.</li>
</ul>

<h2>Thread safety</h2>
<p>Put this cache behind a web server and 200 request threads call it at once. Thread A is halfway through unlinking node 4 while thread B inserts after <code>HEAD</code>, and a <code>prev</code> pointer ends up aimed at a node no longer in the list. A later eviction follows it and deletes the wrong key, or loops forever.</p>
<div class="callout warn"><strong>The trap: get() is a write</strong>Many candidates reach for a read-write lock so that many readers can <code>get</code> in parallel. It does not work here. Every <code>get</code> moves a node to the front of the list, which is a write to shared pointers. With a read lock, two readers can relink the same neighbours at the same time. For a plain LRU, use one exclusive lock around the map <em>and</em> the list together. Using a <code>ConcurrentHashMap</code> for the map alone does not help either, because the list is still unprotected and the two structures must change together.</div>
<p>The version below wraps every operation in one lock: <code>ReentrantLock</code> in Java (<code>synchronized</code> works too), <code>threading.Lock</code> in Python, <code>std::mutex</code> with <code>std::lock_guard</code> in C++, <code>sync.Mutex</code> in Go. The demo runs 8 threads doing 20,000 random operations each, then checks that the map and the list still agree. The C++ build passes ThreadSanitizer and the Go build passes <code>go run -race</code>.</p>
<p>JavaScript runs your code on one thread, so a synchronous <code>get</code> never interleaves and needs no lock. Its real hazard is <code>await</code>: two requests miss on the same key and both call the slow database. The fix, <em>single flight</em>, caches the in-flight <code>Promise</code> so the second caller waits on the first load.</p>
<div data-code="threadsafe"></div>
<p>Expected output: Java, Python, C++ and Go print the same four lines; JavaScript prints its own deterministic lines.</p>
<pre><code>8 threads x 20000 ops finished
size = 100 (capacity 100)
map and list agree: true
every value matches its key: true</code></pre>
<p>In Python the GIL (Global Interpreter Lock) does <em>not</em> make this safe. It makes single bytecodes atomic, but "unlink, relink, update the dict" is dozens of bytecodes, and a thread switch can land between any two.</p>

<h3>When one lock is not enough: lock striping</h3>
<p>One lock handles a few hundred thousand operations per second, since each critical section is a handful of pointer moves. When profiling shows threads queueing on it, use <mark>lock striping</mark>: split the cache into N segments (often 16 or 64), each a full LRU with its own lock and capacity/N slots, and route keys by <code>hash(key) % N</code>.</p>
<ul>
<li><strong>Cost:</strong> eviction becomes approximate LRU. Each segment evicts its own oldest entry, which may not be the globally oldest. For a cache, nobody notices.</li>
<li><strong>Hot keys</strong> still contend. One viral product during Flipkart's Big Billion Days lands on one stripe however many you have.</li>
<li><strong>Real libraries:</strong> Guava's cache uses segments (<code>concurrencyLevel</code>). Caffeine buffers reads and replays them in batches, so <code>get</code> barely locks. Redis is single-threaded and uses <em>approximate</em> LRU: sample 5 keys, evict the oldest.</li>
</ul>
<div class="callout interview"><strong>Say this in the interview</strong>"Every get reorders the list, so even reads are writes. I will guard the map and the list with one mutex, which is simple and correct, and each critical section is only a few pointer moves. If the lock becomes hot, I will stripe the cache into 16 segments by key hash, each with its own lock and its own LRU list. That gives approximate global LRU, which is fine for a cache. Listeners run inside the lock, so they must be fast, and anything slow goes to a queue."</div>

<h2>Try it: LRU vs LFU</h2>
<p>Feed the same access pattern to both policies and watch which keys survive. Try a pattern where one key is used constantly and a burst of one-off keys passes through. LRU lets the burst push the popular key out; LFU keeps it.</p>
<div data-widget="cache-sim"></div>

<h2>Follow-up: design an LFU cache in O(1)</h2>
<p>LFU evicts the key with the <em>fewest</em> uses, breaking ties by least recent use. It is LeetCode 460. A count per key plus a scan is O(n); a min-heap on count is O(log n) per access. The O(1) version uses <mark>frequency buckets</mark>.</p>
<figure class="svg-fig">
<svg viewBox="0 0 680 270">
  <rect class="s-box" x="20" y="40" width="170" height="200" rx="10"/>
  <text class="s-title" x="105" y="66" text-anchor="middle">key → node</text>
  <text class="s-text" x="105" y="98" text-anchor="middle">A (freq 5)</text>
  <text class="s-text" x="105" y="126" text-anchor="middle">B (freq 2)</text>
  <text class="s-text" x="105" y="154" text-anchor="middle">C (freq 5)</text>
  <text class="s-text" x="105" y="182" text-anchor="middle">D (freq 1)</text>
  <text class="s-text" x="105" y="210" text-anchor="middle">E (freq 1)</text>
  <text class="s-muted" x="275" y="28" text-anchor="middle">minFreq = 1</text>
  <rect class="s-amber" x="230" y="40" width="90" height="44" rx="10"/>
  <text class="s-title" x="275" y="67" text-anchor="middle">freq 1</text>
  <rect class="s-box" x="370" y="40" width="80" height="44" rx="10"/>
  <text class="s-title" x="410" y="67" text-anchor="middle">E</text>
  <rect class="s-red" x="500" y="40" width="80" height="44" rx="10"/>
  <text class="s-title" x="540" y="67" text-anchor="middle">D</text>
  <line class="s-line" x1="320" y1="62" x2="368" y2="62" marker-end="url(#arrow)"/>
  <line class="s-line" x1="450" y1="62" x2="498" y2="62" marker-end="url(#arrow)"/>
  <text class="s-muted" x="630" y="58" text-anchor="middle">evict</text>
  <text class="s-muted" x="630" y="74" text-anchor="middle">this one</text>
  <rect class="s-accent" x="230" y="110" width="90" height="44" rx="10"/>
  <text class="s-title" x="275" y="137" text-anchor="middle">freq 2</text>
  <rect class="s-box" x="370" y="110" width="80" height="44" rx="10"/>
  <text class="s-title" x="410" y="137" text-anchor="middle">B</text>
  <line class="s-line" x1="320" y1="132" x2="368" y2="132" marker-end="url(#arrow)"/>
  <rect class="s-accent" x="230" y="180" width="90" height="44" rx="10"/>
  <text class="s-title" x="275" y="207" text-anchor="middle">freq 5</text>
  <rect class="s-box" x="370" y="180" width="80" height="44" rx="10"/>
  <text class="s-title" x="410" y="207" text-anchor="middle">C</text>
  <rect class="s-box" x="500" y="180" width="80" height="44" rx="10"/>
  <text class="s-title" x="540" y="207" text-anchor="middle">A</text>
  <line class="s-line" x1="320" y1="202" x2="368" y2="202" marker-end="url(#arrow)"/>
  <line class="s-line" x1="450" y1="202" x2="498" y2="202" marker-end="url(#arrow)"/>
  <text class="s-muted" x="440" y="256" text-anchor="middle">each bucket is its own LRU list: most recent on the left, oldest on the right</text>
</svg>
<figcaption>O(1) LFU. A map from key to node, a map from frequency to a doubly linked list of nodes with that frequency, and a minFreq counter. The victim is the oldest node in the minFreq bucket (D here).</figcaption>
</figure>
<p>Three structures:</p>
<ol class="steps">
<li><strong><code>keyToNode</code>:</strong> key → node, where the node holds the key, the value and its current frequency.</li>
<li><strong><code>freqToList</code>:</strong> frequency → a doubly linked list (with sentinels) of all nodes at that frequency, in LRU order. This handles the tie-break for free.</li>
<li><strong><code>minFreq</code>:</strong> the smallest frequency that currently has any node.</li>
</ol>
<p>The operations:</p>
<ul>
<li><strong><code>get(key)</code>:</strong> find the node. Unlink it from bucket <code>f</code> and push it to the front of bucket <code>f + 1</code>. If bucket <code>f</code> is now empty and <code>f == minFreq</code>, set <code>minFreq = f + 1</code>. All O(1).</li>
<li><strong><code>put(new key)</code> when full:</strong> evict the tail of bucket <code>minFreq</code>, delete it from <code>keyToNode</code>. Then insert the new node into bucket 1 and set <code>minFreq = 1</code>. A brand-new key always has the lowest possible frequency, so this reset is always right.</li>
<li><strong><code>put(existing key)</code>:</strong> update the value and treat it as a <code>get</code>.</li>
</ul>
<p><code>minFreq</code> never needs a search: a new key resets it to 1, and a <code>get</code> can only raise it by one, when it empties the minimum bucket.</p>
<p>Here LFU is just another <code>EvictionPolicy</code>: <code>keyAdded</code> puts a node in bucket 1, <code>keyAccessed</code> moves it up, <code>evict</code> pops the oldest node of <code>minFreq</code>. <code>Cache</code> does not change. Say so out loud: it is the payoff of Strategy.</p>
<div class="callout info"><strong>LFU in practice</strong>Pure LFU keeps last week's hot key forever and evicts new keys before they prove themselves. Redis's <code>allkeys-lfu</code> uses a small counter that decays over time; Caffeine's W-TinyLFU adds a frequency sketch and a small LRU window for new arrivals.</div>

<h2>Complexity</h2>
<table>
<thead><tr><th>Approach</th><th>get</th><th>put</th><th>evict</th><th>Notes</th></tr></thead>
<tbody>
<tr><td>Hash map + timestamps</td><td>O(1)</td><td>O(1)</td><td>O(n)</td><td>Scan for the oldest timestamp on every eviction.</td></tr>
<tr><td>Hash map + min-heap on time</td><td>O(log n)</td><td>O(log n)</td><td>O(log n)</td><td>Every access re-keys a heap entry.</td></tr>
<tr><td>Hash map + singly linked list</td><td>O(n)</td><td>O(n)</td><td>O(n)</td><td>Unlinking needs the predecessor, which needs a walk.</td></tr>
<tr><td><strong>Hash map + doubly linked list</strong></td><td><strong>O(1)</strong></td><td><strong>O(1)</strong></td><td><strong>O(1)</strong></td><td>The standard answer. O(capacity) memory.</td></tr>
<tr><td><code>LinkedHashMap</code> / <code>OrderedDict</code> / JS <code>Map</code></td><td>O(1)</td><td>O(1)</td><td>O(1)</td><td>Same structure, built in.</td></tr>
<tr><td>LFU with frequency buckets</td><td>O(1)</td><td>O(1)</td><td>O(1)</td><td>Two maps, one list per frequency, a <code>minFreq</code> counter.</td></tr>
<tr><td>Thread-safe, one lock</td><td>O(1)</td><td>O(1)</td><td>O(1)</td><td>Plus waiting time under contention. Stripe the lock when it gets hot.</td></tr>
</tbody>
</table>
<p>All O(1) figures are average case, since hash map operations are O(1) on average.</p>

<h2>Common mistakes</h2>
<div class="callout warn"><strong>Things that lose marks</strong>
<ul>
<li>Using the language's built-in linked list and calling <code>list.remove(node)</code>. In Java, <code>LinkedList.remove(Object)</code> walks the list, so it is O(n).</li>
<li>Forgetting to store the key in the node, so the tail cannot be removed from the map.</li>
<li>Checking capacity before checking whether the key exists, so updates evict innocent keys.</li>
<li>Not moving a node to the front on <code>put</code> of an existing key.</li>
<li>No sentinels, and a forest of <code>if (node == head)</code> branches with an off-by-one in one of them.</li>
<li>A read-write lock where <code>get</code> takes the read lock.</li>
<li>Calling the system clock directly inside the cache, so TTL cannot be tested without sleeping.</li>
<li>Throwing an exception on a cache miss.</li>
</ul>
</div>

<div class="callout interview"><strong>Say this in the interview</strong>"I need O(1) lookup and O(1) recency updates, so I will combine a hash map from key to node with a doubly linked list ordered by recency, with sentinel head and tail nodes. Get moves the node to the front. Put on a new key evicts the tail if full, then inserts at the front. The node stores its key so eviction can clean the map. I will put the eviction choice behind an EvictionPolicy interface so LFU can drop in, notify removal listeners as observers, and inject a clock for TTL so tests are deterministic. I know LinkedHashMap does this in access-order mode. Happy to use it if you prefer."</div>

<h2>Follow-up questions</h2>
<div class="quiz">
<details><summary>Why a doubly linked list and not a singly linked one?</summary><div>To unlink a node in O(1) you must update its predecessor's <code>next</code> pointer. A singly linked list only knows successors, so finding the predecessor means walking from the head, which is O(n). With a <code>prev</code> pointer, unlinking is two assignments. (There is a trick that stores the predecessor in the map instead, but it is fiddly and easy to get wrong under pressure.)</div></details>
<details><summary>Capacity is 1. Walk through put(1), put(2), get(1).</summary><div><code>put(1)</code>: the cache is empty, so insert node 1. <code>put(2)</code>: key 2 is new and the cache is full, so evict the tail (node 1), remove it from the map, notify listeners, then insert node 2. <code>get(1)</code>: not in the map, a miss. This catches implementations that insert before evicting, since they would evict the entry just added.</div></details>
<details><summary>Can you use a ReadWriteLock so that many threads can get() at once?</summary><div>Not for a plain LRU. Every <code>get</code> moves the node to the front, which writes shared pointers, so it needs the exclusive lock. To make reads cheaper, stripe the cache into segments, or do what Caffeine does: buffer reads and apply the reordering later in batches.</div></details>
<details><summary>How would you add a "max size in bytes" limit instead of a count?</summary><div>Give each entry a weight via a <code>Weigher</code> function the caller passes in, and track the total. After each insert, evict from the tail in a loop until the total fits. Reject a single value bigger than the whole limit. Caffeine calls this <code>maximumWeight</code>.</div></details>
<details><summary>Expired entries are only removed when someone reads them. Is that a problem?</summary><div>It can waste memory, but stale entries drift to the tail and leave first, so it is usually fine. If memory is tight, add active expiry: a background sweeper, Redis-style sampling of TTL keys, or a min-heap or timing wheel ordered by expiry time.</div></details>
<details><summary>Turn this into a distributed cache for 50 application servers. What changes?</summary><div>It becomes an HLD problem. Either each server keeps a small local LRU (fast, but copies go stale), or all share a Redis or Memcached cluster sharded with consistent hashing. Then discuss invalidation, replication, hot keys and node failure. Your single-node LRU is what runs inside each shard.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
<li>LRU in O(1) = a hash map from key to node plus a doubly linked list in recency order, with sentinel head and tail.</li>
<li>The node must store its key, so evicting the tail can also delete it from the map.</li>
<li>Handle "key exists" before "cache full", and evict before inserting.</li>
<li>Strategy for the eviction policy, Observer for removal listeners, an injected clock for TTL. LFU then drops in as one new class.</li>
<li>Know the library answer (<code>LinkedHashMap</code>, <code>OrderedDict</code>, JS <code>Map</code>) and ask whether you may use it.</li>
<li>Even <code>get</code> is a write, so use one exclusive lock, and stripe the cache into segments when that lock gets hot.</li>
<li>O(1) LFU uses frequency buckets, each an LRU list, plus a <code>minFreq</code> counter that never needs a search.</li>
</ul></div>
`,
  code: {
    library: {
      title: "The library answer (LeetCode 146 style, capacity 2)",
      java: String.raw`// The "library answer": LinkedHashMap in access order does the linked-list work for you.
// Run: javac LibraryLru.java && java LibraryLru
import java.util.LinkedHashMap;
import java.util.Map;

public class LibraryLru {

    static class LRUCache<K, V> extends LinkedHashMap<K, V> {
        private static final long serialVersionUID = 1L;
        private final int capacity;

        LRUCache(int capacity) {
            super(16, 0.75f, true); // true = access order: get() moves the entry to the end
            this.capacity = capacity;
        }

        @Override
        protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
            return size() > capacity; // called after every put; true drops the LRU entry
        }
    }

    public static void main(String[] args) {
        LRUCache<Integer, Integer> c = new LRUCache<>(2);
        c.put(1, 1);
        c.put(2, 2);
        System.out.println("get(1) = " + c.getOrDefault(1, -1));
        c.put(3, 3); // evicts 2
        System.out.println("get(2) = " + c.getOrDefault(2, -1));
        c.put(4, 4); // evicts 1
        System.out.println("get(1) = " + c.getOrDefault(1, -1));
        System.out.println("get(3) = " + c.getOrDefault(3, -1));
        System.out.println("get(4) = " + c.getOrDefault(4, -1));
    }
}`,
      python: String.raw`# The "library answer": OrderedDict keeps insertion order and can move a key to the end in O(1).
# Run: python3 lib.py
from collections import OrderedDict


class LRUCache:
    def __init__(self, capacity: int) -> None:
        self.capacity = capacity
        self.data: OrderedDict = OrderedDict()

    def get(self, key, default=-1):
        if key not in self.data:
            return default
        self.data.move_to_end(key)  # most recently used goes to the end
        return self.data[key]

    def put(self, key, value) -> None:
        if key in self.data:
            self.data.move_to_end(key)
        self.data[key] = value
        if len(self.data) > self.capacity:
            self.data.popitem(last=False)  # drop the first = least recently used


# For memoising a pure function, the standard library already has it:
#   from functools import lru_cache
#   @lru_cache(maxsize=1024)
#   def fetch_profile(user_id): ...

c = LRUCache(2)
c.put(1, 1)
c.put(2, 2)
print(f"get(1) = {c.get(1)}")
c.put(3, 3)  # evicts 2
print(f"get(2) = {c.get(2)}")
c.put(4, 4)  # evicts 1
print(f"get(1) = {c.get(1)}")
print(f"get(3) = {c.get(3)}")
print(f"get(4) = {c.get(4)}")`,
      cpp: String.raw`// C++ has no LRU container, so the "library answer" is std::list + std::unordered_map.
// list::splice moves a node to the front in O(1) without copying it.
// Build: g++ -std=c++17 -Wall -Wextra lib.cpp -o lib && ./lib
#include <iostream>
#include <list>
#include <unordered_map>
#include <utility>

class LRUCache {
    size_t capacity_;
    std::list<std::pair<int, int>> order_; // front = most recently used
    std::unordered_map<int, std::list<std::pair<int, int>>::iterator> map_;

public:
    explicit LRUCache(size_t capacity) : capacity_(capacity) {}

    int get(int key) {
        auto it = map_.find(key);
        if (it == map_.end()) return -1;
        order_.splice(order_.begin(), order_, it->second);
        return it->second->second;
    }

    void put(int key, int value) {
        auto it = map_.find(key);
        if (it != map_.end()) {
            it->second->second = value;
            order_.splice(order_.begin(), order_, it->second);
            return;
        }
        if (map_.size() == capacity_) {
            map_.erase(order_.back().first);
            order_.pop_back();
        }
        order_.emplace_front(key, value);
        map_[key] = order_.begin();
    }
};

int main() {
    LRUCache c(2);
    c.put(1, 1);
    c.put(2, 2);
    std::cout << "get(1) = " << c.get(1) << "\n";
    c.put(3, 3); // evicts 2
    std::cout << "get(2) = " << c.get(2) << "\n";
    c.put(4, 4); // evicts 1
    std::cout << "get(1) = " << c.get(1) << "\n";
    std::cout << "get(3) = " << c.get(3) << "\n";
    std::cout << "get(4) = " << c.get(4) << "\n";
}`,
      javascript: String.raw`// The "library answer": a JS Map iterates keys in insertion order.
// Delete + set moves a key to the end; the first key is the least recently used.
// Run: node lib.js
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return -1;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  put(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      this.map.delete(this.map.keys().next().value); // oldest key
    }
  }
}

const c = new LRUCache(2);
c.put(1, 1);
c.put(2, 2);
console.log("get(1) = " + c.get(1));
c.put(3, 3); // evicts 2
console.log("get(2) = " + c.get(2));
c.put(4, 4); // evicts 1
console.log("get(1) = " + c.get(1));
console.log("get(3) = " + c.get(3));
console.log("get(4) = " + c.get(4));`,
      go: String.raw`// The "library answer" in Go: container/list (a doubly linked list) + a map.
// Run: go run main.go
package main

import (
	"container/list"
	"fmt"
)

type entry struct{ key, value int }

type LRUCache struct {
	capacity int
	order    *list.List // front = most recently used
	items    map[int]*list.Element
}

func NewLRUCache(capacity int) *LRUCache {
	return &LRUCache{capacity: capacity, order: list.New(), items: map[int]*list.Element{}}
}

func (c *LRUCache) Get(key int) int {
	el, ok := c.items[key]
	if !ok {
		return -1
	}
	c.order.MoveToFront(el)
	return el.Value.(*entry).value
}

func (c *LRUCache) Put(key, value int) {
	if el, ok := c.items[key]; ok {
		el.Value.(*entry).value = value
		c.order.MoveToFront(el)
		return
	}
	if c.order.Len() == c.capacity {
		lru := c.order.Back()
		c.order.Remove(lru)
		delete(c.items, lru.Value.(*entry).key)
	}
	c.items[key] = c.order.PushFront(&entry{key, value})
}

func main() {
	c := NewLRUCache(2)
	c.Put(1, 1)
	c.Put(2, 2)
	fmt.Println("get(1) =", c.Get(1))
	c.Put(3, 3) // evicts 2
	fmt.Println("get(2) =", c.Get(2))
	c.Put(4, 4) // evicts 1
	fmt.Println("get(1) =", c.Get(1))
	fmt.Println("get(3) =", c.Get(3))
	fmt.Println("get(4) =", c.Get(4))
}`,
    },
    full: {
      title: "Generic LRU cache with eviction policy, listeners and TTL (single file, runnable)",
      java: String.raw`// Generic LRU cache with a pluggable eviction policy, eviction listeners and per-entry TTL.
// Run: javac LruCacheDemo.java && java LruCacheDemo
import java.util.*;

public class LruCacheDemo {

    // ---------- Time is injected so tests (and this demo) control it ----------
    interface Clock { long nowMillis(); }

    static class ManualClock implements Clock {
        private long now = 0;
        public long nowMillis() { return now; }
        void advance(long ms) { now += ms; }
    }

    enum RemovalCause { CAPACITY, EXPIRED }

    // ---------- Observer: told whenever the cache drops an entry ----------
    interface EvictionListener<K, V> { void onEvict(K key, V value, RemovalCause cause); }

    // ---------- Strategy: decides WHICH key to drop ----------
    interface EvictionPolicy<K> {
        void keyAdded(K key);
        void keyAccessed(K key);
        void keyRemoved(K key);
        K evict(); // choose a victim, forget it, return it
    }

    // LRU = hash map (key -> node) + doubly linked list (recency order). Every method is O(1).
    static class LruPolicy<K> implements EvictionPolicy<K> {
        private static final class Node<K> {
            final K key;
            Node<K> prev, next;
            Node(K key) { this.key = key; }
        }

        private final Map<K, Node<K>> nodes = new HashMap<>();
        private final Node<K> head = new Node<>(null); // head.next = most recently used
        private final Node<K> tail = new Node<>(null); // tail.prev = least recently used

        LruPolicy() { head.next = tail; tail.prev = head; }

        public void keyAdded(K key) {
            Node<K> n = new Node<>(key);
            nodes.put(key, n);
            addAfterHead(n);
        }

        public void keyAccessed(K key) {
            Node<K> n = nodes.get(key);
            if (n == null) return;
            unlink(n);
            addAfterHead(n);
        }

        public void keyRemoved(K key) {
            Node<K> n = nodes.remove(key);
            if (n != null) unlink(n);
        }

        public K evict() {
            if (tail.prev == head) throw new IllegalStateException("nothing to evict");
            Node<K> lru = tail.prev;
            unlink(lru);
            nodes.remove(lru.key);
            return lru.key;
        }

        List<K> keysLruFirst() {
            List<K> out = new ArrayList<>();
            for (Node<K> n = tail.prev; n != head; n = n.prev) out.add(n.key);
            return out;
        }

        private void addAfterHead(Node<K> n) {
            n.prev = head;
            n.next = head.next;
            head.next.prev = n;
            head.next = n;
        }

        private void unlink(Node<K> n) {
            n.prev.next = n.next;
            n.next.prev = n.prev;
            n.prev = null;
            n.next = null;
        }
    }

    // ---------- The cache: storage + TTL + listeners. Knows nothing about LRU. ----------
    static class Cache<K, V> {
        private static final class Entry<V> {
            final V value;
            final long expiresAt; // 0 = never expires
            Entry(V value, long expiresAt) { this.value = value; this.expiresAt = expiresAt; }
        }

        private final int capacity;
        private final Map<K, Entry<V>> store = new HashMap<>();
        private final EvictionPolicy<K> policy;
        private final Clock clock;
        private final List<EvictionListener<K, V>> listeners = new ArrayList<>();
        private int hits = 0, misses = 0;

        Cache(int capacity, EvictionPolicy<K> policy, Clock clock) {
            if (capacity < 1) throw new IllegalArgumentException("capacity must be >= 1");
            this.capacity = capacity;
            this.policy = policy;
            this.clock = clock;
        }

        void addListener(EvictionListener<K, V> l) { listeners.add(l); }

        // Returns the value, or null on a miss (absent or expired).
        V get(K key) {
            Entry<V> e = store.get(key);
            if (e == null) { misses++; return null; }
            if (isExpired(e)) {
                remove(key, e, RemovalCause.EXPIRED);
                misses++;
                return null;
            }
            policy.keyAccessed(key);
            hits++;
            return e.value;
        }

        void put(K key, V value) { put(key, value, 0); }

        void put(K key, V value, long ttlMillis) {
            long expiresAt = ttlMillis > 0 ? clock.nowMillis() + ttlMillis : 0;
            if (store.containsKey(key)) {             // update: replace value, mark as used
                store.put(key, new Entry<>(value, expiresAt));
                policy.keyAccessed(key);
                return;
            }
            if (store.size() >= capacity) {           // full: ask the policy who goes
                K victim = policy.evict();
                Entry<V> old = store.remove(victim);
                notifyListeners(victim, old.value, RemovalCause.CAPACITY);
            }
            store.put(key, new Entry<>(value, expiresAt));
            policy.keyAdded(key);
        }

        boolean delete(K key) {
            if (store.remove(key) == null) return false;
            policy.keyRemoved(key);
            return true;
        }

        int size() { return store.size(); }
        int hits() { return hits; }
        int misses() { return misses; }

        private boolean isExpired(Entry<V> e) {
            return e.expiresAt > 0 && clock.nowMillis() >= e.expiresAt;
        }

        private void remove(K key, Entry<V> e, RemovalCause cause) {
            store.remove(key);
            policy.keyRemoved(key);
            notifyListeners(key, e.value, cause);
        }

        private void notifyListeners(K key, V value, RemovalCause cause) {
            for (EvictionListener<K, V> l : listeners) l.onEvict(key, value, cause);
        }
    }

    // ---------- Demo ----------
    static void printOrder(LruPolicy<Integer> policy) {
        StringJoiner sj = new StringJoiner(" -> ");
        for (Integer k : policy.keysLruFirst()) sj.add(String.valueOf(k));
        System.out.println("order (LRU first): " + sj);
    }

    static String show(String v) { return v == null ? "miss" : v; }

    public static void main(String[] args) {
        ManualClock clock = new ManualClock();
        LruPolicy<Integer> policy = new LruPolicy<>();
        Cache<Integer, String> cache = new Cache<>(3, policy, clock);
        cache.addListener((k, v, cause) -> System.out.println("  [evicted] " + k + "=" + v + " (" + cause + ")"));

        System.out.println("== LRU basics (capacity 3) ==");
        System.out.println("put 1, 2, 3");
        cache.put(1, "one");
        cache.put(2, "two");
        cache.put(3, "three");
        printOrder(policy);
        System.out.println("get(1) = " + show(cache.get(1)));
        printOrder(policy);
        System.out.println("put 4");
        cache.put(4, "four");
        printOrder(policy);
        System.out.println("get(2) = " + show(cache.get(2)));
        System.out.println("put 3 = THREE (update, no eviction)");
        cache.put(3, "THREE");
        printOrder(policy);

        System.out.println("== TTL with a manual clock ==");
        System.out.println("put 5 = five with ttl 5000 ms");
        cache.put(5, "five", 5000);
        printOrder(policy);
        clock.advance(3000);
        System.out.println("t=3000 get(5) = " + show(cache.get(5)));
        clock.advance(3000);
        String v = cache.get(5);
        System.out.println("t=6000 get(5) = " + show(v));
        System.out.println("get(3) = " + show(cache.get(3)));
        printOrder(policy);
        System.out.println("size = " + cache.size() + ", hits = " + cache.hits() + ", misses = " + cache.misses());
    }
}`,
      python: String.raw`# Generic LRU cache with a pluggable eviction policy, eviction listeners and per-entry TTL.
# Run: python3 lru.py
from __future__ import annotations

import enum
from abc import ABC, abstractmethod
from typing import Callable, Dict, Generic, Hashable, List, Optional, TypeVar

K = TypeVar("K", bound=Hashable)
V = TypeVar("V")


# ---------- Time is injected so tests (and this demo) control it ----------
class Clock(ABC):
    @abstractmethod
    def now_millis(self) -> int: ...


class ManualClock(Clock):
    def __init__(self) -> None:
        self._now = 0

    def now_millis(self) -> int:
        return self._now

    def advance(self, ms: int) -> None:
        self._now += ms


class RemovalCause(enum.Enum):
    CAPACITY = "CAPACITY"
    EXPIRED = "EXPIRED"


# ---------- Observer: any callable (key, value, cause) ----------
EvictionListener = Callable[[K, V, RemovalCause], None]


# ---------- Strategy: decides WHICH key to drop ----------
class EvictionPolicy(ABC, Generic[K]):
    @abstractmethod
    def key_added(self, key: K) -> None: ...

    @abstractmethod
    def key_accessed(self, key: K) -> None: ...

    @abstractmethod
    def key_removed(self, key: K) -> None: ...

    @abstractmethod
    def evict(self) -> K: ...


class _Node:
    __slots__ = ("key", "prev", "next")

    def __init__(self, key=None) -> None:
        self.key = key
        self.prev: Optional[_Node] = None
        self.next: Optional[_Node] = None


class LruPolicy(EvictionPolicy[K]):
    """Hash map (key -> node) + doubly linked list (recency order). Every method is O(1)."""

    def __init__(self) -> None:
        self._nodes: Dict[K, _Node] = {}
        self._head = _Node()  # head.next = most recently used
        self._tail = _Node()  # tail.prev = least recently used
        self._head.next = self._tail
        self._tail.prev = self._head

    def key_added(self, key: K) -> None:
        node = _Node(key)
        self._nodes[key] = node
        self._add_after_head(node)

    def key_accessed(self, key: K) -> None:
        node = self._nodes.get(key)
        if node is None:
            return
        self._unlink(node)
        self._add_after_head(node)

    def key_removed(self, key: K) -> None:
        node = self._nodes.pop(key, None)
        if node is not None:
            self._unlink(node)

    def evict(self) -> K:
        lru = self._tail.prev
        if lru is self._head:
            raise RuntimeError("nothing to evict")
        self._unlink(lru)
        del self._nodes[lru.key]
        return lru.key

    def keys_lru_first(self) -> List[K]:
        out, node = [], self._tail.prev
        while node is not self._head:
            out.append(node.key)
            node = node.prev
        return out

    def _add_after_head(self, node: _Node) -> None:
        node.prev = self._head
        node.next = self._head.next
        self._head.next.prev = node
        self._head.next = node

    @staticmethod
    def _unlink(node: _Node) -> None:
        node.prev.next = node.next
        node.next.prev = node.prev
        node.prev = node.next = None


# ---------- The cache: storage + TTL + listeners. Knows nothing about LRU. ----------
class _Entry(Generic[V]):
    __slots__ = ("value", "expires_at")

    def __init__(self, value: V, expires_at: int) -> None:
        self.value = value
        self.expires_at = expires_at  # 0 = never expires


class Cache(Generic[K, V]):
    def __init__(self, capacity: int, policy: EvictionPolicy[K], clock: Clock) -> None:
        if capacity < 1:
            raise ValueError("capacity must be >= 1")
        self._capacity = capacity
        self._store: Dict[K, _Entry[V]] = {}
        self._policy = policy
        self._clock = clock
        self._listeners: List[EvictionListener] = []
        self.hits = 0
        self.misses = 0

    def add_listener(self, listener: EvictionListener) -> None:
        self._listeners.append(listener)

    def get(self, key: K) -> Optional[V]:
        """Returns the value, or None on a miss (absent or expired)."""
        entry = self._store.get(key)
        if entry is None:
            self.misses += 1
            return None
        if self._is_expired(entry):
            self._remove(key, entry, RemovalCause.EXPIRED)
            self.misses += 1
            return None
        self._policy.key_accessed(key)
        self.hits += 1
        return entry.value

    def put(self, key: K, value: V, ttl_millis: int = 0) -> None:
        expires_at = self._clock.now_millis() + ttl_millis if ttl_millis > 0 else 0
        if key in self._store:  # update: replace value, mark as used
            self._store[key] = _Entry(value, expires_at)
            self._policy.key_accessed(key)
            return
        if len(self._store) >= self._capacity:  # full: ask the policy who goes
            victim = self._policy.evict()
            old = self._store.pop(victim)
            self._notify(victim, old.value, RemovalCause.CAPACITY)
        self._store[key] = _Entry(value, expires_at)
        self._policy.key_added(key)

    def delete(self, key: K) -> bool:
        if self._store.pop(key, None) is None:
            return False
        self._policy.key_removed(key)
        return True

    def __len__(self) -> int:
        return len(self._store)

    def _is_expired(self, entry: _Entry[V]) -> bool:
        return entry.expires_at > 0 and self._clock.now_millis() >= entry.expires_at

    def _remove(self, key: K, entry: _Entry[V], cause: RemovalCause) -> None:
        del self._store[key]
        self._policy.key_removed(key)
        self._notify(key, entry.value, cause)

    def _notify(self, key: K, value: V, cause: RemovalCause) -> None:
        for listener in self._listeners:
            listener(key, value, cause)


# ---------- Demo ----------
def print_order(policy: LruPolicy) -> None:
    print("order (LRU first): " + " -> ".join(str(k) for k in policy.keys_lru_first()))


def show(v: Optional[str]) -> str:
    return "miss" if v is None else v


def main() -> None:
    clock = ManualClock()
    policy: LruPolicy[int] = LruPolicy()
    cache: Cache[int, str] = Cache(3, policy, clock)
    cache.add_listener(lambda k, v, cause: print(f"  [evicted] {k}={v} ({cause.value})"))

    print("== LRU basics (capacity 3) ==")
    print("put 1, 2, 3")
    cache.put(1, "one")
    cache.put(2, "two")
    cache.put(3, "three")
    print_order(policy)
    print("get(1) = " + show(cache.get(1)))
    print_order(policy)
    print("put 4")
    cache.put(4, "four")
    print_order(policy)
    print("get(2) = " + show(cache.get(2)))
    print("put 3 = THREE (update, no eviction)")
    cache.put(3, "THREE")
    print_order(policy)

    print("== TTL with a manual clock ==")
    print("put 5 = five with ttl 5000 ms")
    cache.put(5, "five", ttl_millis=5000)
    print_order(policy)
    clock.advance(3000)
    print("t=3000 get(5) = " + show(cache.get(5)))
    clock.advance(3000)
    v = cache.get(5)
    print("t=6000 get(5) = " + show(v))
    print("get(3) = " + show(cache.get(3)))
    print_order(policy)
    print(f"size = {len(cache)}, hits = {cache.hits}, misses = {cache.misses}")


if __name__ == "__main__":
    main()`,
      cpp: String.raw`// Generic LRU cache with a pluggable eviction policy, eviction listeners and per-entry TTL.
// Build: g++ -std=c++17 -Wall -Wextra lru.cpp -o lru && ./lru
#include <cstdint>
#include <functional>
#include <iostream>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>

// ---------- Time is injected so tests (and this demo) control it ----------
class Clock {
public:
    virtual ~Clock() = default;
    virtual int64_t nowMillis() const = 0;
};

class ManualClock : public Clock {
    int64_t now_ = 0;
public:
    int64_t nowMillis() const override { return now_; }
    void advance(int64_t ms) { now_ += ms; }
};

enum class RemovalCause { CAPACITY, EXPIRED };
const char* toString(RemovalCause c) { return c == RemovalCause::CAPACITY ? "CAPACITY" : "EXPIRED"; }

// ---------- Observer: any callable (key, value, cause) ----------
template <typename K, typename V>
using EvictionListener = std::function<void(const K&, const V&, RemovalCause)>;

// ---------- Strategy: decides WHICH key to drop ----------
template <typename K>
class EvictionPolicy {
public:
    virtual ~EvictionPolicy() = default;
    virtual void keyAdded(const K& key) = 0;
    virtual void keyAccessed(const K& key) = 0;
    virtual void keyRemoved(const K& key) = 0;
    virtual K evict() = 0; // choose a victim, forget it, return it
};

// LRU = hash map (key -> node) + doubly linked list (recency order). Every method is O(1).
template <typename K>
class LruPolicy : public EvictionPolicy<K> {
    struct Node {
        K key{};
        Node* prev = nullptr;
        Node* next = nullptr;
    };
    std::unordered_map<K, std::unique_ptr<Node>> nodes_; // owns the nodes
    Node head_;                                            // head_.next = most recently used
    Node tail_;                                            // tail_.prev = least recently used

    void addAfterHead(Node* n) {
        n->prev = &head_;
        n->next = head_.next;
        head_.next->prev = n;
        head_.next = n;
    }
    static void unlink(Node* n) {
        n->prev->next = n->next;
        n->next->prev = n->prev;
        n->prev = n->next = nullptr;
    }

public:
    LruPolicy() { head_.next = &tail_; tail_.prev = &head_; }
    LruPolicy(const LruPolicy&) = delete;            // nodes point at head_/tail_, so no copies
    LruPolicy& operator=(const LruPolicy&) = delete;

    void keyAdded(const K& key) override {
        auto node = std::make_unique<Node>();
        node->key = key;
        addAfterHead(node.get());
        nodes_[key] = std::move(node);
    }
    void keyAccessed(const K& key) override {
        auto it = nodes_.find(key);
        if (it == nodes_.end()) return;
        unlink(it->second.get());
        addAfterHead(it->second.get());
    }
    void keyRemoved(const K& key) override {
        auto it = nodes_.find(key);
        if (it == nodes_.end()) return;
        unlink(it->second.get());
        nodes_.erase(it);
    }
    K evict() override {
        if (tail_.prev == &head_) throw std::logic_error("nothing to evict");
        Node* lru = tail_.prev;
        K key = lru->key;
        unlink(lru);
        nodes_.erase(key); // frees the node
        return key;
    }
    std::vector<K> keysLruFirst() const {
        std::vector<K> out;
        for (const Node* n = tail_.prev; n != &head_; n = n->prev) out.push_back(n->key);
        return out;
    }
};

// ---------- The cache: storage + TTL + listeners. Knows nothing about LRU. ----------
template <typename K, typename V>
class Cache {
    struct Entry {
        V value;
        int64_t expiresAt; // 0 = never expires
    };
    size_t capacity_;
    std::unordered_map<K, Entry> store_;
    EvictionPolicy<K>& policy_;
    const Clock& clock_;
    std::vector<EvictionListener<K, V>> listeners_;
    int hits_ = 0, misses_ = 0;

    bool isExpired(const Entry& e) const { return e.expiresAt > 0 && clock_.nowMillis() >= e.expiresAt; }
    void notify(const K& key, const V& value, RemovalCause cause) {
        for (auto& l : listeners_) l(key, value, cause);
    }

public:
    Cache(size_t capacity, EvictionPolicy<K>& policy, const Clock& clock)
        : capacity_(capacity), policy_(policy), clock_(clock) {
        if (capacity < 1) throw std::invalid_argument("capacity must be >= 1");
    }

    void addListener(EvictionListener<K, V> l) { listeners_.push_back(std::move(l)); }

    // Returns the value, or nullopt on a miss (absent or expired).
    std::optional<V> get(const K& key) {
        auto it = store_.find(key);
        if (it == store_.end()) { ++misses_; return std::nullopt; }
        if (isExpired(it->second)) {
            V value = std::move(it->second.value);
            store_.erase(it);
            policy_.keyRemoved(key);
            notify(key, value, RemovalCause::EXPIRED);
            ++misses_;
            return std::nullopt;
        }
        policy_.keyAccessed(key);
        ++hits_;
        return it->second.value;
    }

    void put(const K& key, V value, int64_t ttlMillis = 0) {
        int64_t expiresAt = ttlMillis > 0 ? clock_.nowMillis() + ttlMillis : 0;
        auto it = store_.find(key);
        if (it != store_.end()) {                    // update: replace value, mark as used
            it->second = Entry{std::move(value), expiresAt};
            policy_.keyAccessed(key);
            return;
        }
        if (store_.size() >= capacity_) {            // full: ask the policy who goes
            K victim = policy_.evict();
            auto vit = store_.find(victim);
            V old = std::move(vit->second.value);
            store_.erase(vit);
            notify(victim, old, RemovalCause::CAPACITY);
        }
        store_.emplace(key, Entry{std::move(value), expiresAt});
        policy_.keyAdded(key);
    }

    bool remove(const K& key) {
        if (store_.erase(key) == 0) return false;
        policy_.keyRemoved(key);
        return true;
    }

    size_t size() const { return store_.size(); }
    int hits() const { return hits_; }
    int misses() const { return misses_; }
};

// ---------- Demo ----------
void printOrder(const LruPolicy<int>& policy) {
    std::string s;
    for (int k : policy.keysLruFirst()) s += (s.empty() ? "" : " -> ") + std::to_string(k);
    std::cout << "order (LRU first): " << s << "\n";
}

std::string show(const std::optional<std::string>& v) { return v ? *v : "miss"; }

int main() {
    ManualClock clock;
    LruPolicy<int> policy;
    Cache<int, std::string> cache(3, policy, clock);
    cache.addListener([](const int& k, const std::string& v, RemovalCause cause) {
        std::cout << "  [evicted] " << k << "=" << v << " (" << toString(cause) << ")\n";
    });

    std::cout << "== LRU basics (capacity 3) ==\n";
    std::cout << "put 1, 2, 3\n";
    cache.put(1, "one");
    cache.put(2, "two");
    cache.put(3, "three");
    printOrder(policy);
    std::cout << "get(1) = " << show(cache.get(1)) << "\n";
    printOrder(policy);
    std::cout << "put 4\n";
    cache.put(4, "four");
    printOrder(policy);
    std::cout << "get(2) = " << show(cache.get(2)) << "\n";
    std::cout << "put 3 = THREE (update, no eviction)\n";
    cache.put(3, "THREE");
    printOrder(policy);

    std::cout << "== TTL with a manual clock ==\n";
    std::cout << "put 5 = five with ttl 5000 ms\n";
    cache.put(5, "five", 5000);
    printOrder(policy);
    clock.advance(3000);
    std::cout << "t=3000 get(5) = " << show(cache.get(5)) << "\n";
    clock.advance(3000);
    auto v = cache.get(5);
    std::cout << "t=6000 get(5) = " << show(v) << "\n";
    std::cout << "get(3) = " << show(cache.get(3)) << "\n";
    printOrder(policy);
    std::cout << "size = " << cache.size() << ", hits = " << cache.hits() << ", misses = " << cache.misses() << "\n";
}`,
      javascript: String.raw`// Generic LRU cache with a pluggable eviction policy, eviction listeners and per-entry TTL.
// Run: node lru.js

// ---------- Time is injected so tests (and this demo) control it ----------
class ManualClock {
  constructor() { this.now = 0; }
  nowMillis() { return this.now; }
  advance(ms) { this.now += ms; }
}

const RemovalCause = Object.freeze({ CAPACITY: "CAPACITY", EXPIRED: "EXPIRED" });

// ---------- Strategy: decides WHICH key to drop ----------
// Interface (duck-typed): keyAdded(key), keyAccessed(key), keyRemoved(key), evict() -> key

// LRU = hash map (key -> node) + doubly linked list (recency order). Every method is O(1).
class LruPolicy {
  constructor() {
    this.nodes = new Map();
    this.head = { key: null, prev: null, next: null }; // head.next = most recently used
    this.tail = { key: null, prev: null, next: null }; // tail.prev = least recently used
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  keyAdded(key) {
    const node = { key, prev: null, next: null };
    this.nodes.set(key, node);
    this.#addAfterHead(node);
  }

  keyAccessed(key) {
    const node = this.nodes.get(key);
    if (!node) return;
    this.#unlink(node);
    this.#addAfterHead(node);
  }

  keyRemoved(key) {
    const node = this.nodes.get(key);
    if (!node) return;
    this.nodes.delete(key);
    this.#unlink(node);
  }

  evict() {
    const lru = this.tail.prev;
    if (lru === this.head) throw new Error("nothing to evict");
    this.#unlink(lru);
    this.nodes.delete(lru.key);
    return lru.key;
  }

  keysLruFirst() {
    const out = [];
    for (let n = this.tail.prev; n !== this.head; n = n.prev) out.push(n.key);
    return out;
  }

  #addAfterHead(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  #unlink(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
    node.prev = node.next = null;
  }
}

// ---------- The cache: storage + TTL + listeners. Knows nothing about LRU. ----------
class Cache {
  constructor(capacity, policy, clock) {
    if (!(capacity >= 1)) throw new RangeError("capacity must be >= 1");
    this.capacity = capacity;
    this.store = new Map(); // key -> { value, expiresAt } (expiresAt 0 = never)
    this.policy = policy;
    this.clock = clock;
    this.listeners = []; // Observer: functions (key, value, cause)
    this.hits = 0;
    this.misses = 0;
  }

  addListener(fn) { this.listeners.push(fn); }

  // Returns the value, or undefined on a miss (absent or expired).
  get(key) {
    const e = this.store.get(key);
    if (!e) { this.misses++; return undefined; }
    if (this.#isExpired(e)) {
      this.#remove(key, e, RemovalCause.EXPIRED);
      this.misses++;
      return undefined;
    }
    this.policy.keyAccessed(key);
    this.hits++;
    return e.value;
  }

  put(key, value, ttlMillis = 0) {
    const expiresAt = ttlMillis > 0 ? this.clock.nowMillis() + ttlMillis : 0;
    if (this.store.has(key)) {                  // update: replace value, mark as used
      this.store.set(key, { value, expiresAt });
      this.policy.keyAccessed(key);
      return;
    }
    if (this.store.size >= this.capacity) {      // full: ask the policy who goes
      const victim = this.policy.evict();
      const old = this.store.get(victim);
      this.store.delete(victim);
      this.#notify(victim, old.value, RemovalCause.CAPACITY);
    }
    this.store.set(key, { value, expiresAt });
    this.policy.keyAdded(key);
  }

  delete(key) {
    if (!this.store.delete(key)) return false;
    this.policy.keyRemoved(key);
    return true;
  }

  get size() { return this.store.size; }

  #isExpired(e) { return e.expiresAt > 0 && this.clock.nowMillis() >= e.expiresAt; }

  #remove(key, e, cause) {
    this.store.delete(key);
    this.policy.keyRemoved(key);
    this.#notify(key, e.value, cause);
  }

  #notify(key, value, cause) {
    for (const fn of this.listeners) fn(key, value, cause);
  }
}

// ---------- Demo ----------
const printOrder = (policy) => console.log("order (LRU first): " + policy.keysLruFirst().join(" -> "));
const show = (v) => (v === undefined ? "miss" : v);

function main() {
  const clock = new ManualClock();
  const policy = new LruPolicy();
  const cache = new Cache(3, policy, clock);
  cache.addListener((k, v, cause) => console.log("  [evicted] " + k + "=" + v + " (" + cause + ")"));

  console.log("== LRU basics (capacity 3) ==");
  console.log("put 1, 2, 3");
  cache.put(1, "one");
  cache.put(2, "two");
  cache.put(3, "three");
  printOrder(policy);
  console.log("get(1) = " + show(cache.get(1)));
  printOrder(policy);
  console.log("put 4");
  cache.put(4, "four");
  printOrder(policy);
  console.log("get(2) = " + show(cache.get(2)));
  console.log("put 3 = THREE (update, no eviction)");
  cache.put(3, "THREE");
  printOrder(policy);

  console.log("== TTL with a manual clock ==");
  console.log("put 5 = five with ttl 5000 ms");
  cache.put(5, "five", 5000);
  printOrder(policy);
  clock.advance(3000);
  console.log("t=3000 get(5) = " + show(cache.get(5)));
  clock.advance(3000);
  const v = cache.get(5);
  console.log("t=6000 get(5) = " + show(v));
  console.log("get(3) = " + show(cache.get(3)));
  printOrder(policy);
  console.log("size = " + cache.size + ", hits = " + cache.hits + ", misses = " + cache.misses);
}

main();`,
      go: String.raw`// Generic LRU cache with a pluggable eviction policy, eviction listeners and per-entry TTL.
// Run: go run main.go   (Go 1.18+ for generics)
package main

import (
	"fmt"
	"strings"
)

// ---------- Time is injected so tests (and this demo) control it ----------
type Clock interface{ NowMillis() int64 }

type ManualClock struct{ now int64 }

func (c *ManualClock) NowMillis() int64 { return c.now }
func (c *ManualClock) Advance(ms int64) { c.now += ms }

type RemovalCause string

const (
	Capacity RemovalCause = "CAPACITY"
	Expired  RemovalCause = "EXPIRED"
)

// ---------- Observer: told whenever the cache drops an entry ----------
type EvictionListener[K comparable, V any] func(key K, value V, cause RemovalCause)

// ---------- Strategy: decides WHICH key to drop ----------
type EvictionPolicy[K comparable] interface {
	KeyAdded(key K)
	KeyAccessed(key K)
	KeyRemoved(key K)
	Evict() K // choose a victim, forget it, return it
}

// LRU = hash map (key -> node) + doubly linked list (recency order). Every method is O(1).
type node[K comparable] struct {
	key        K
	prev, next *node[K]
}

type LruPolicy[K comparable] struct {
	nodes map[K]*node[K]
	head  *node[K] // head.next = most recently used
	tail  *node[K] // tail.prev = least recently used
}

func NewLruPolicy[K comparable]() *LruPolicy[K] {
	p := &LruPolicy[K]{nodes: map[K]*node[K]{}, head: &node[K]{}, tail: &node[K]{}}
	p.head.next = p.tail
	p.tail.prev = p.head
	return p
}

func (p *LruPolicy[K]) KeyAdded(key K) {
	n := &node[K]{key: key}
	p.nodes[key] = n
	p.addAfterHead(n)
}

func (p *LruPolicy[K]) KeyAccessed(key K) {
	if n, ok := p.nodes[key]; ok {
		p.unlink(n)
		p.addAfterHead(n)
	}
}

func (p *LruPolicy[K]) KeyRemoved(key K) {
	if n, ok := p.nodes[key]; ok {
		delete(p.nodes, key)
		p.unlink(n)
	}
}

func (p *LruPolicy[K]) Evict() K {
	lru := p.tail.prev
	if lru == p.head {
		panic("nothing to evict")
	}
	p.unlink(lru)
	delete(p.nodes, lru.key)
	return lru.key
}

func (p *LruPolicy[K]) KeysLruFirst() []K {
	var out []K
	for n := p.tail.prev; n != p.head; n = n.prev {
		out = append(out, n.key)
	}
	return out
}

func (p *LruPolicy[K]) addAfterHead(n *node[K]) {
	n.prev = p.head
	n.next = p.head.next
	p.head.next.prev = n
	p.head.next = n
}

func (p *LruPolicy[K]) unlink(n *node[K]) {
	n.prev.next = n.next
	n.next.prev = n.prev
	n.prev, n.next = nil, nil
}

// ---------- The cache: storage + TTL + listeners. Knows nothing about LRU. ----------
type entry[V any] struct {
	value     V
	expiresAt int64 // 0 = never expires
}

type Cache[K comparable, V any] struct {
	capacity     int
	store        map[K]entry[V]
	policy       EvictionPolicy[K]
	clock        Clock
	listeners    []EvictionListener[K, V]
	Hits, Misses int
}

func NewCache[K comparable, V any](capacity int, policy EvictionPolicy[K], clock Clock) *Cache[K, V] {
	if capacity < 1 {
		panic("capacity must be >= 1")
	}
	return &Cache[K, V]{capacity: capacity, store: map[K]entry[V]{}, policy: policy, clock: clock}
}

func (c *Cache[K, V]) AddListener(l EvictionListener[K, V]) { c.listeners = append(c.listeners, l) }

// Get returns the value and true, or the zero value and false on a miss (absent or expired).
func (c *Cache[K, V]) Get(key K) (V, bool) {
	var zero V
	e, ok := c.store[key]
	if !ok {
		c.Misses++
		return zero, false
	}
	if c.isExpired(e) {
		delete(c.store, key)
		c.policy.KeyRemoved(key)
		c.notify(key, e.value, Expired)
		c.Misses++
		return zero, false
	}
	c.policy.KeyAccessed(key)
	c.Hits++
	return e.value, true
}

func (c *Cache[K, V]) Put(key K, value V) { c.PutWithTTL(key, value, 0) }

func (c *Cache[K, V]) PutWithTTL(key K, value V, ttlMillis int64) {
	var expiresAt int64
	if ttlMillis > 0 {
		expiresAt = c.clock.NowMillis() + ttlMillis
	}
	if _, ok := c.store[key]; ok { // update: replace value, mark as used
		c.store[key] = entry[V]{value, expiresAt}
		c.policy.KeyAccessed(key)
		return
	}
	if len(c.store) >= c.capacity { // full: ask the policy who goes
		victim := c.policy.Evict()
		old := c.store[victim]
		delete(c.store, victim)
		c.notify(victim, old.value, Capacity)
	}
	c.store[key] = entry[V]{value, expiresAt}
	c.policy.KeyAdded(key)
}

func (c *Cache[K, V]) Delete(key K) bool {
	if _, ok := c.store[key]; !ok {
		return false
	}
	delete(c.store, key)
	c.policy.KeyRemoved(key)
	return true
}

func (c *Cache[K, V]) Len() int { return len(c.store) }

func (c *Cache[K, V]) isExpired(e entry[V]) bool {
	return e.expiresAt > 0 && c.clock.NowMillis() >= e.expiresAt
}

func (c *Cache[K, V]) notify(key K, value V, cause RemovalCause) {
	for _, l := range c.listeners {
		l(key, value, cause)
	}
}

// ---------- Demo ----------
func printOrder(p *LruPolicy[int]) {
	parts := []string{}
	for _, k := range p.KeysLruFirst() {
		parts = append(parts, fmt.Sprint(k))
	}
	fmt.Println("order (LRU first): " + strings.Join(parts, " -> "))
}

func show(v string, ok bool) string {
	if !ok {
		return "miss"
	}
	return v
}

func main() {
	clock := &ManualClock{}
	policy := NewLruPolicy[int]()
	cache := NewCache[int, string](3, policy, clock)
	cache.AddListener(func(k int, v string, cause RemovalCause) {
		fmt.Printf("  [evicted] %d=%s (%s)\n", k, v, cause)
	})

	fmt.Println("== LRU basics (capacity 3) ==")
	fmt.Println("put 1, 2, 3")
	cache.Put(1, "one")
	cache.Put(2, "two")
	cache.Put(3, "three")
	printOrder(policy)
	fmt.Println("get(1) = " + show(cache.Get(1)))
	printOrder(policy)
	fmt.Println("put 4")
	cache.Put(4, "four")
	printOrder(policy)
	fmt.Println("get(2) = " + show(cache.Get(2)))
	fmt.Println("put 3 = THREE (update, no eviction)")
	cache.Put(3, "THREE")
	printOrder(policy)

	fmt.Println("== TTL with a manual clock ==")
	fmt.Println("put 5 = five with ttl 5000 ms")
	cache.PutWithTTL(5, "five", 5000)
	printOrder(policy)
	clock.Advance(3000)
	fmt.Println("t=3000 get(5) = " + show(cache.Get(5)))
	clock.Advance(3000)
	v, ok := cache.Get(5)
	fmt.Println("t=6000 get(5) = " + show(v, ok))
	fmt.Println("get(3) = " + show(cache.Get(3)))
	printOrder(policy)
	fmt.Printf("size = %d, hits = %d, misses = %d\n", cache.Len(), cache.Hits, cache.Misses)
}`,
    },
    threadsafe: {
      title: "Thread-safe LRU with a stress test",
      java: String.raw`// Thread-safe LRU cache: one ReentrantLock guards the map AND the list together.
// Run: javac ThreadSafeLruDemo.java && java ThreadSafeLruDemo
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;

public class ThreadSafeLruDemo {

    static class ConcurrentLruCache<K, V> {
        private static final class Node<K, V> {
            final K key;
            V value;
            Node<K, V> prev, next;
            Node(K key, V value) { this.key = key; this.value = value; }
        }

        private final int capacity;
        private final Map<K, Node<K, V>> map = new HashMap<>();
        private final Node<K, V> head = new Node<>(null, null); // most recent after head
        private final Node<K, V> tail = new Node<>(null, null); // least recent before tail
        // Even get() moves a node, so it is a WRITE. A ReadWriteLock would not help here.
        private final ReentrantLock lock = new ReentrantLock();

        ConcurrentLruCache(int capacity) {
            this.capacity = capacity;
            head.next = tail;
            tail.prev = head;
        }

        V get(K key) {
            lock.lock();
            try {
                Node<K, V> n = map.get(key);
                if (n == null) return null;
                unlink(n);
                addAfterHead(n);
                return n.value;
            } finally {
                lock.unlock();
            }
        }

        void put(K key, V value) {
            lock.lock();
            try {
                Node<K, V> n = map.get(key);
                if (n != null) {
                    n.value = value;
                    unlink(n);
                    addAfterHead(n);
                    return;
                }
                if (map.size() >= capacity) {
                    Node<K, V> lru = tail.prev;
                    unlink(lru);
                    map.remove(lru.key);
                }
                n = new Node<>(key, value);
                map.put(key, n);
                addAfterHead(n);
            } finally {
                lock.unlock();
            }
        }

        int size() {
            lock.lock();
            try { return map.size(); } finally { lock.unlock(); }
        }

        // Walks the list and checks it matches the map exactly.
        boolean isConsistent() {
            lock.lock();
            try {
                int count = 0;
                for (Node<K, V> n = head.next; n != tail; n = n.next) {
                    if (map.get(n.key) != n || n.next.prev != n) return false;
                    count++;
                }
                return count == map.size();
            } finally {
                lock.unlock();
            }
        }

        boolean allValuesMatch() {
            lock.lock();
            try {
                for (Node<K, V> n : map.values()) if (!n.key.equals(n.value)) return false;
                return true;
            } finally {
                lock.unlock();
            }
        }

        private void addAfterHead(Node<K, V> n) {
            n.prev = head;
            n.next = head.next;
            head.next.prev = n;
            head.next = n;
        }

        private void unlink(Node<K, V> n) {
            n.prev.next = n.next;
            n.next.prev = n.prev;
        }
    }

    public static void main(String[] args) throws InterruptedException {
        final int threads = 8, opsPerThread = 20_000, keySpace = 500, capacity = 100;
        ConcurrentLruCache<Integer, Integer> cache = new ConcurrentLruCache<>(capacity);
        List<Thread> workers = new ArrayList<>();
        for (int t = 0; t < threads; t++) {
            final int seed = t + 1;
            Thread w = new Thread(() -> {
                int x = seed;
                for (int i = 0; i < opsPerThread; i++) {
                    x = (x * 1103515245 + 12345) & 0x7fffffff; // tiny deterministic random
                    int key = x % keySpace;
                    if (i % 2 == 0) cache.put(key, key);
                    else cache.get(key);
                }
            });
            workers.add(w);
            w.start();
        }
        for (Thread w : workers) w.join();

        System.out.println(threads + " threads x " + opsPerThread + " ops finished");
        System.out.println("size = " + cache.size() + " (capacity " + capacity + ")");
        System.out.println("map and list agree: " + cache.isConsistent());
        System.out.println("every value matches its key: " + cache.allValuesMatch());
    }
}`,
      python: String.raw`# Thread-safe LRU cache: one threading.Lock guards the dict AND the list together.
# The GIL makes single bytecodes atomic, not "unlink node + relink node + update dict".
# Run: python3 ts.py
import threading
from typing import Dict, Generic, Hashable, Optional, TypeVar

K = TypeVar("K", bound=Hashable)
V = TypeVar("V")


class _Node:
    __slots__ = ("key", "value", "prev", "next")

    def __init__(self, key=None, value=None):
        self.key, self.value = key, value
        self.prev = self.next = None


class ConcurrentLruCache(Generic[K, V]):
    def __init__(self, capacity: int) -> None:
        self._capacity = capacity
        self._map: Dict[K, _Node] = {}
        self._head, self._tail = _Node(), _Node()  # MRU after head, LRU before tail
        self._head.next, self._tail.prev = self._tail, self._head
        # Even get() moves a node, so it is a write. One plain lock is the right tool.
        self._lock = threading.Lock()

    def get(self, key: K) -> Optional[V]:
        with self._lock:
            node = self._map.get(key)
            if node is None:
                return None
            self._unlink(node)
            self._add_after_head(node)
            return node.value

    def put(self, key: K, value: V) -> None:
        with self._lock:
            node = self._map.get(key)
            if node is not None:
                node.value = value
                self._unlink(node)
                self._add_after_head(node)
                return
            if len(self._map) >= self._capacity:
                lru = self._tail.prev
                self._unlink(lru)
                del self._map[lru.key]
            node = _Node(key, value)
            self._map[key] = node
            self._add_after_head(node)

    def size(self) -> int:
        with self._lock:
            return len(self._map)

    def is_consistent(self) -> bool:
        """Walks the list and checks it matches the dict exactly."""
        with self._lock:
            count, node = 0, self._head.next
            while node is not self._tail:
                if self._map.get(node.key) is not node or node.next.prev is not node:
                    return False
                count += 1
                node = node.next
            return count == len(self._map)

    def all_values_match(self) -> bool:
        with self._lock:
            return all(n.key == n.value for n in self._map.values())

    def _add_after_head(self, node: _Node) -> None:
        node.prev, node.next = self._head, self._head.next
        self._head.next.prev = node
        self._head.next = node

    @staticmethod
    def _unlink(node: _Node) -> None:
        node.prev.next = node.next
        node.next.prev = node.prev


def main() -> None:
    threads, ops_per_thread, key_space, capacity = 8, 20_000, 500, 100
    cache: ConcurrentLruCache[int, int] = ConcurrentLruCache(capacity)

    def worker(seed: int) -> None:
        x = seed
        for i in range(ops_per_thread):
            x = (x * 1103515245 + 12345) & 0x7FFFFFFF  # tiny deterministic random
            key = x % key_space
            if i % 2 == 0:
                cache.put(key, key)
            else:
                cache.get(key)

    workers = [threading.Thread(target=worker, args=(t + 1,)) for t in range(threads)]
    for w in workers:
        w.start()
    for w in workers:
        w.join()

    print(f"{threads} threads x {ops_per_thread} ops finished")
    print(f"size = {cache.size()} (capacity {capacity})")
    print(f"map and list agree: {str(cache.is_consistent()).lower()}")
    print(f"every value matches its key: {str(cache.all_values_match()).lower()}")


if __name__ == "__main__":
    main()`,
      cpp: String.raw`// Thread-safe LRU cache: one std::mutex guards the map AND the list together.
// Build: g++ -std=c++17 -Wall -Wextra -pthread ts.cpp -o ts && ./ts
#include <iostream>
#include <list>
#include <mutex>
#include <optional>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>

template <typename K, typename V>
class ConcurrentLruCache {
    using Item = std::pair<K, V>;
    size_t capacity_;
    std::list<Item> order_;                                        // front = most recent
    std::unordered_map<K, typename std::list<Item>::iterator> map_;
    mutable std::mutex mu_; // even get() splices the list, so every call needs it

public:
    explicit ConcurrentLruCache(size_t capacity) : capacity_(capacity) {}

    std::optional<V> get(const K& key) {
        std::lock_guard<std::mutex> guard(mu_);
        auto it = map_.find(key);
        if (it == map_.end()) return std::nullopt;
        order_.splice(order_.begin(), order_, it->second); // O(1) move to front
        return it->second->second;
    }

    void put(const K& key, V value) {
        std::lock_guard<std::mutex> guard(mu_);
        auto it = map_.find(key);
        if (it != map_.end()) {
            it->second->second = std::move(value);
            order_.splice(order_.begin(), order_, it->second);
            return;
        }
        if (map_.size() >= capacity_) {
            map_.erase(order_.back().first);
            order_.pop_back();
        }
        order_.emplace_front(key, std::move(value));
        map_[key] = order_.begin();
    }

    size_t size() const {
        std::lock_guard<std::mutex> guard(mu_);
        return map_.size();
    }

    // Checks the list and the map describe exactly the same entries.
    bool isConsistent() const {
        std::lock_guard<std::mutex> guard(mu_);
        if (order_.size() != map_.size()) return false;
        for (auto it = order_.begin(); it != order_.end(); ++it) {
            auto m = map_.find(it->first);
            if (m == map_.end() || m->second != it) return false;
        }
        return true;
    }

    bool allValuesMatch() const {
        std::lock_guard<std::mutex> guard(mu_);
        for (const auto& item : order_)
            if (item.first != item.second) return false;
        return true;
    }
};

int main() {
    const int threads = 8, opsPerThread = 20000, keySpace = 500;
    const size_t capacity = 100;
    ConcurrentLruCache<int, int> cache(capacity);

    std::vector<std::thread> workers;
    for (int t = 0; t < threads; t++) {
        workers.emplace_back([&cache, t] {
            unsigned x = static_cast<unsigned>(t + 1);
            for (int i = 0; i < opsPerThread; i++) {
                x = (x * 1103515245u + 12345u) & 0x7fffffffu; // tiny deterministic random
                int key = static_cast<int>(x % keySpace);
                if (i % 2 == 0) cache.put(key, key);
                else cache.get(key);
            }
        });
    }
    for (auto& w : workers) w.join();

    std::cout << threads << " threads x " << opsPerThread << " ops finished\n";
    std::cout << "size = " << cache.size() << " (capacity " << capacity << ")\n";
    std::cout << std::boolalpha;
    std::cout << "map and list agree: " << cache.isConsistent() << "\n";
    std::cout << "every value matches its key: " << cache.allValuesMatch() << "\n";
}`,
      javascript: String.raw`// "Thread-safe" LRU in JavaScript: no lock needed, but watch out for await.
// Run: node ts.js
//
// Node runs your JavaScript on ONE thread (the event loop). A synchronous get() or put()
// always finishes before any other code runs, so the map and the order can never be seen
// half-updated. Worker threads do not share normal objects, so they cannot race on it either.
//
// The real trap is async code: two callers both miss, both await a slow loader (DB, HTTP),
// and both load the same key. Fix it with "single flight": cache the in-flight Promise.

class LruCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map(); // Map keeps insertion order: first key = least recently used
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    this.map.delete(key); // move to the end = most recently used
    this.map.set(key, value);
    return value;
  }

  put(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.capacity) this.map.delete(this.map.keys().next().value);
    this.map.set(key, value);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Broken: check, then await, then act. Both callers pass the check before either one fills it.
async function getOrLoadNaive(cache, key, loader) {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = await loader(key);
  cache.put(key, value);
  return value;
}

// Fixed: store the Promise itself, synchronously, before the first await.
async function getOrLoadSingleFlight(cache, key, loader) {
  let p = cache.get(key);
  if (p === undefined) {
    p = loader(key).catch((err) => {
      cache.map.delete(key); // do not cache failures
      throw err;
    });
    cache.put(key, p);
  }
  return p;
}

async function main() {
  console.log("JavaScript runs get/put on one thread, so they never interleave. No lock needed.");
  console.log("The async trap: two callers miss at once and both call the slow loader.");

  let calls = 0;
  const loader = async (key) => { calls++; await sleep(10); return "user-" + key; };

  const naive = new LruCache(100);
  await Promise.all([getOrLoadNaive(naive, 42, loader), getOrLoadNaive(naive, 42, loader)]);
  console.log("naive: loader called " + calls + " times");

  calls = 0;
  const safe = new LruCache(100);
  const [a, b] = await Promise.all([
    getOrLoadSingleFlight(safe, 42, loader),
    getOrLoadSingleFlight(safe, 42, loader),
  ]);
  console.log("single-flight: loader called " + calls + " time, both got " + a + " and " + b);
}

main();`,
      go: String.raw`// Thread-safe LRU cache: one sync.Mutex guards the map AND the list together.
// Run: go run -race main.go
package main

import (
	"container/list"
	"fmt"
	"sync"
)

type item[K comparable, V any] struct {
	key   K
	value V
}

type ConcurrentLruCache[K comparable, V any] struct {
	mu       sync.Mutex // even Get moves an element, so a RWMutex would not help
	capacity int
	order    *list.List // front = most recent
	items    map[K]*list.Element
}

func NewConcurrentLruCache[K comparable, V any](capacity int) *ConcurrentLruCache[K, V] {
	return &ConcurrentLruCache[K, V]{capacity: capacity, order: list.New(), items: map[K]*list.Element{}}
}

func (c *ConcurrentLruCache[K, V]) Get(key K) (V, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.items[key]; ok {
		c.order.MoveToFront(el)
		return el.Value.(*item[K, V]).value, true
	}
	var zero V
	return zero, false
}

func (c *ConcurrentLruCache[K, V]) Put(key K, value V) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.items[key]; ok {
		el.Value.(*item[K, V]).value = value
		c.order.MoveToFront(el)
		return
	}
	if len(c.items) >= c.capacity {
		lru := c.order.Back()
		c.order.Remove(lru)
		delete(c.items, lru.Value.(*item[K, V]).key)
	}
	c.items[key] = c.order.PushFront(&item[K, V]{key, value})
}

func (c *ConcurrentLruCache[K, V]) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.items)
}

// IsConsistent checks the list and the map describe exactly the same entries.
func (c *ConcurrentLruCache[K, V]) IsConsistent() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.order.Len() != len(c.items) {
		return false
	}
	for el := c.order.Front(); el != nil; el = el.Next() {
		if c.items[el.Value.(*item[K, V]).key] != el {
			return false
		}
	}
	return true
}

func main() {
	const threads, opsPerThread, keySpace, capacity = 8, 20000, 500, 100
	cache := NewConcurrentLruCache[int, int](capacity)

	var wg sync.WaitGroup
	for t := 0; t < threads; t++ {
		wg.Add(1)
		go func(seed uint32) {
			defer wg.Done()
			x := seed
			for i := 0; i < opsPerThread; i++ {
				x = (x*1103515245 + 12345) & 0x7fffffff // tiny deterministic random
				key := int(x % keySpace)
				if i%2 == 0 {
					cache.Put(key, key)
				} else {
					cache.Get(key)
				}
			}
		}(uint32(t + 1))
	}
	wg.Wait()

	allMatch := true
	for k := 0; k < keySpace; k++ {
		if v, ok := cache.Get(k); ok && v != k {
			allMatch = false
		}
	}
	fmt.Printf("%d threads x %d ops finished\n", threads, opsPerThread)
	fmt.Printf("size = %d (capacity %d)\n", cache.Len(), capacity)
	fmt.Printf("map and list agree: %v\n", cache.IsConsistent())
	fmt.Printf("every value matches its key: %v\n", allMatch)
}`,
    },
  },
  diagrams: {
    classes: String.raw`classDiagram
  class Cache~K,V~ {
    -int capacity
    -Map~K,Entry~ store
    -EvictionPolicy policy
    -Clock clock
    -List~EvictionListener~ listeners
    +get(K key) V
    +put(K key, V value)
    +put(K key, V value, long ttl)
    +delete(K key) bool
    +size() int
  }
  class Entry~V~ {
    +V value
    +long expiresAt
  }
  class EvictionPolicy~K~ {
    <<interface>>
    +keyAdded(K key)
    +keyAccessed(K key)
    +keyRemoved(K key)
    +evict() K
  }
  class LruPolicy~K~ {
    -Map~K,Node~ nodes
    -Node head
    -Node tail
  }
  class LfuPolicy~K~ {
    -Map~K,Node~ nodes
    -Map~int,List~ freqToList
    -int minFreq
  }
  class Node~K~ {
    +K key
    +Node prev
    +Node next
  }
  class EvictionListener~K,V~ {
    <<interface>>
    +onEvict(K key, V value, RemovalCause cause)
  }
  class RemovalCause {
    <<enumeration>>
    CAPACITY
    EXPIRED
  }
  class Clock {
    <<interface>>
    +nowMillis() long
  }
  class SystemClock
  class ManualClock {
    +advance(long ms)
  }
  Cache *-- Entry
  Cache o-- EvictionPolicy
  Cache o-- Clock
  Cache o-- EvictionListener
  EvictionPolicy <|.. LruPolicy
  EvictionPolicy <|.. LfuPolicy
  LruPolicy *-- Node
  Clock <|.. SystemClock
  Clock <|.. ManualClock
  EvictionListener ..> RemovalCause`,
  },
});
