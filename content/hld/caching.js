SD.register({
  id: "caching",
  html: String.raw`
    <p class="lead">A cache is a small, fast store that keeps copies of data you are likely to need again, so you do not have to fetch or compute it from a slower source every time. Reading from memory takes about 100 nanoseconds; a database query over the network takes 1 to 10 milliseconds or more. Caching is the cheapest way to cut latency and protect your database, but it brings hard problems: stale data, eviction, and thundering herds. Interviewers love it because almost every design needs it.</p>

    <h2>Why caching</h2>
    <ul>
      <li><strong>Lower latency</strong>: a Redis lookup takes about 0.5 ms versus 5 to 50 ms for a database query with joins.</li>
      <li><strong>Less load on the database</strong>: with a 95% hit rate, the database sees only 5% of reads. A product page on Flipkart served 100,000 times a minute becomes 5,000 DB reads.</li>
      <li><strong>Lower cost</strong>: memory is expensive per GB, but a few cache nodes are far cheaper than scaling a database to the same read throughput.</li>
      <li><strong>Absorb spikes</strong>: a viral post or a flash sale hits the same few keys; the cache handles them without the DB noticing.</li>
    </ul>
    <p>Caching works because access patterns are skewed: a small fraction of data gets most of the reads (the 80/20 rule). It works best for data that is read often and changes rarely. It works badly for write-heavy data, data that must always be exact (account balances), or data with no repeated access.</p>
    <div class="callout info"><strong>Key terms</strong><strong>Hit</strong>: data found in the cache. <strong>Miss</strong>: not found, go to the source. <strong>Hit rate</strong> = hits / total lookups. <strong>TTL</strong> (time to live): how long an entry stays before it expires. <strong>Eviction</strong>: removing entries to make room.</div>

    <h2>Where caches live</h2>
    <p>Caches exist at every layer between the user and the disk. A request that is answered earlier in the chain is cheaper and faster.</p>
    <div data-diagram="layers" data-caption="Cache layers from the client to the database. Each layer that answers stops the request going further."></div>
    <table>
      <thead><tr><th>Layer</th><th>What it caches</th><th>Example</th></tr></thead>
      <tbody>
        <tr><td>Browser / app</td><td>Static files, API responses, images</td><td><code>Cache-Control: max-age=3600</code>, ETag revalidation, app local storage</td></tr>
        <tr><td>CDN</td><td>Static assets and cacheable pages at edge locations near users</td><td>Cloudflare, Akamai, CloudFront serving Hotstar thumbnails from Chennai instead of Virginia</td></tr>
        <tr><td>Load balancer / reverse proxy</td><td>Whole HTTP responses</td><td>Nginx <code>proxy_cache</code>, Varnish</td></tr>
        <tr><td>Application in-memory</td><td>Hot objects inside the service process</td><td>Caffeine/Guava (Java), a Python dict with LRU. Fastest, but per instance and lost on restart</td></tr>
        <tr><td>Distributed cache</td><td>Shared objects across all app servers</td><td>Redis, Memcached clusters. The default answer in interviews</td></tr>
        <tr><td>Database</td><td>Pages of data and indexes in memory</td><td>MySQL InnoDB buffer pool, PostgreSQL shared buffers, OS page cache</td></tr>
      </tbody>
    </table>
    <div class="callout tip"><strong>Local vs distributed</strong>A local in-process cache has no network hop (nanoseconds) but each of 50 servers keeps its own copy, so memory is duplicated and copies go stale independently. A distributed cache is one shared copy over the network (sub-millisecond). Large systems use both: a tiny local cache for the hottest keys (a "near cache") in front of Redis.</div>

    <h2>Read strategies</h2>
    <h3>Cache-aside (lazy loading)</h3>
    <p>The application owns the logic. On a read it checks the cache; on a miss it reads the database, writes the result into the cache with a TTL, and returns it. This is the most common pattern.</p>
    <div data-diagram="aside" data-caption="Cache-aside: the app checks the cache, falls back to the database on a miss and fills the cache."></div>
    <div class="grid-2">
      <div class="card good"><strong>Pros</strong><ul><li>Only data that is actually requested gets cached</li><li>If the cache goes down, the app still works (slower) by reading the DB</li><li>Works with any cache and any database</li></ul></div>
      <div class="card bad"><strong>Cons</strong><ul><li>The first request for each key is slow (three hops)</li><li>Data can be stale until the TTL expires or the key is invalidated</li><li>Cache logic is spread through application code</li></ul></div>
    </div>
    <h3>Read-through</h3>
    <p>The application only talks to the cache. On a miss, the <em>cache itself</em> loads the data from the database (via a configured loader) and stores it. Same flow as cache-aside, but the logic lives in the cache library or provider (for example, Caffeine's <code>LoadingCache</code>, or DynamoDB Accelerator, DAX). Code is cleaner, but you depend on the cache supporting a loader for your data source.</p>

    <h2>Write strategies</h2>
    <p>When data changes, what happens to the cache? Each option trades consistency, write latency and durability.</p>
    <div class="tabs">
      <section data-tab="Write-through">
        <p>Every write goes to the cache <em>and</em> to the database synchronously, and the write succeeds only when both are done. The cache is always up to date for written keys.</p>
        <div data-diagram="wthrough" data-caption="Write-through: write the cache and the database in the same request."></div>
        <p><strong>Good</strong>: reads after writes are fresh; no data loss if the cache dies. <strong>Bad</strong>: every write pays double latency; you may cache data nobody reads. Often paired with read-through.</p>
      </section>
      <section data-tab="Write-around">
        <p>Writes go straight to the database. The cache is skipped, and the old cached entry is deleted (invalidated) so the next read loads fresh data via cache-aside.</p>
        <div data-diagram="waround" data-caption="Write-around: write the database, invalidate the cache, and let the next read refill it."></div>
        <p><strong>Good</strong>: the cache is not flooded with written-once data (logs, uploads). <strong>Bad</strong>: a read right after a write is a miss. This is the most common pairing with cache-aside in real systems.</p>
      </section>
      <section data-tab="Write-back">
        <p>Also called write-behind. Writes go only to the cache and are acknowledged immediately. The cache flushes changes to the database later, in batches or after a delay.</p>
        <div data-diagram="wback" data-caption="Write-back: acknowledge after writing the cache, persist to the database asynchronously."></div>
        <p><strong>Good</strong>: very fast writes; batches many updates (100 like-count increments become one DB write). <strong>Bad</strong>: if the cache node dies before flushing, those writes are lost; more complex. Used for counters, view counts and analytics, and inside CPUs, disks and databases themselves.</p>
      </section>
    </div>
    <table>
      <thead><tr><th>Strategy</th><th>Write latency</th><th>Read after write</th><th>Data loss risk</th><th>Use when</th></tr></thead>
      <tbody>
        <tr><td>Write-through</td><td>Higher (cache + DB)</td><td>Hit, fresh</td><td>None</td><td>Read-heavy data that must be fresh after writes (user profile)</td></tr>
        <tr><td>Write-around</td><td>DB only</td><td>Miss, then fresh</td><td>None</td><td>Data rarely read soon after writing; general default with cache-aside</td></tr>
        <tr><td>Write-back</td><td>Lowest (cache only)</td><td>Hit, fresh</td><td>Yes, unflushed writes</td><td>Write-heavy, loss-tolerant data (counters, likes, metrics)</td></tr>
      </tbody>
    </table>

    <h2>Eviction policies</h2>
    <p>Memory is limited, so when the cache is full something must go. Try the simulator to see how LRU and LFU choose differently for the same access pattern.</p>
    <div data-widget="cache-sim"></div>
    <table>
      <thead><tr><th>Policy</th><th>Evicts</th><th>Good at</th><th>Weak at</th></tr></thead>
      <tbody>
        <tr><td>LRU (least recently used)</td><td>The entry not touched for the longest time</td><td>Most workloads; recent items tend to be reused</td><td>A one-time scan of many keys flushes out the hot set</td></tr>
        <tr><td>LFU (least frequently used)</td><td>The entry with the fewest hits</td><td>Stable popularity (top products, trending hashtags)</td><td>Old items that were popular once stay too long; needs counter decay</td></tr>
        <tr><td>FIFO</td><td>The oldest inserted entry</td><td>Very simple, cheap</td><td>Ignores usage; evicts hot keys</td></tr>
        <tr><td>TTL-based</td><td>Entries whose time has expired</td><td>Bounding staleness</td><td>Not a capacity policy by itself; combine with LRU/LFU</td></tr>
        <tr><td>Random</td><td>A random entry</td><td>No bookkeeping, surprisingly decent</td><td>Can evict hot keys</td></tr>
      </tbody>
    </table>
    <p>Redis offers policies such as <code>allkeys-lru</code>, <code>allkeys-lfu</code>, <code>volatile-ttl</code> and <code>noeviction</code>. Its LRU and LFU are <em>approximate</em>: it samples a few keys and evicts the best candidate among them, which saves memory compared to a full linked list.</p>

    <h3>Code: an O(1) LRU cache</h3>
    <p>The classic interview implementation combines a <strong>hash map</strong> (key to node, for O(1) lookup) and a <strong>doubly linked list</strong> (ordered from most to least recently used, for O(1) move and remove). On <code>get</code>, move the node to the front. On <code>put</code>, insert or update at the front, and if over capacity remove the node at the tail.</p>
    <figure class="svg-fig">
      <svg viewBox="0 0 640 230">
        <rect class="s-box" x="20" y="20" width="140" height="190" rx="10"/>
        <text class="s-title" x="90" y="45" text-anchor="middle">Hash map</text>
        <rect class="s-accent" x="40" y="62" width="100" height="34" rx="10"/>
        <text class="s-text" x="90" y="84" text-anchor="middle">key 3</text>
        <rect class="s-accent" x="40" y="108" width="100" height="34" rx="10"/>
        <text class="s-text" x="90" y="130" text-anchor="middle">key 1</text>
        <rect class="s-accent" x="40" y="154" width="100" height="34" rx="10"/>
        <text class="s-text" x="90" y="176" text-anchor="middle">key 7</text>
        <rect class="s-box" x="200" y="150" width="80" height="44" rx="10"/>
        <text class="s-muted" x="240" y="177" text-anchor="middle">head</text>
        <rect class="s-green" x="300" y="150" width="70" height="44" rx="10"/>
        <text class="s-text" x="335" y="177" text-anchor="middle">3</text>
        <rect class="s-box" x="390" y="150" width="70" height="44" rx="10"/>
        <text class="s-text" x="425" y="177" text-anchor="middle">1</text>
        <rect class="s-red" x="480" y="150" width="70" height="44" rx="10"/>
        <text class="s-text" x="515" y="177" text-anchor="middle">7</text>
        <rect class="s-box" x="570" y="150" width="60" height="44" rx="10"/>
        <text class="s-muted" x="600" y="177" text-anchor="middle">tail</text>
        <line class="s-line" x1="280" y1="166" x2="298" y2="166" marker-end="url(#arrow)"/>
        <line class="s-line" x1="370" y1="166" x2="388" y2="166" marker-end="url(#arrow)"/>
        <line class="s-line" x1="460" y1="166" x2="478" y2="166" marker-end="url(#arrow)"/>
        <line class="s-line" x1="550" y1="166" x2="568" y2="166" marker-end="url(#arrow)"/>
        <line class="s-dash" x1="140" y1="79" x2="330" y2="148"/>
        <line class="s-dash" x1="140" y1="125" x2="420" y2="148"/>
        <line class="s-dash" x1="140" y1="171" x2="505" y2="148"/>
        <text class="s-muted" x="335" y="215" text-anchor="middle">most recent</text>
        <text class="s-muted" x="515" y="215" text-anchor="middle">evict next</text>
        <text class="s-muted" x="420" y="40" text-anchor="middle">map gives O(1) lookup of the node;</text>
        <text class="s-muted" x="420" y="60" text-anchor="middle">prev/next pointers give O(1) move and remove</text>
      </svg>
      <figcaption>LRU cache: the map points to list nodes; the list keeps recency order with sentinel head and tail nodes.</figcaption>
    </figure>
    <div data-code="lru"></div>
    <div class="callout tip"><strong>Shortcut in real code</strong>Java's <code>LinkedHashMap</code> with <code>accessOrder=true</code> and an overridden <code>removeEldestEntry</code>, or Python's <code>OrderedDict</code> / <code>functools.lru_cache</code>, give you LRU in a few lines. In an interview, build it by hand first, then mention these.</div>

    <h2>Invalidation and consistency</h2>
    <p>"There are only two hard things in computer science: cache invalidation and naming things." Once data is copied into a cache, the copy can go stale. Ways to keep it in check:</p>
    <ul>
      <li><strong>TTL</strong>: every entry expires after, say, 5 minutes. Simple and a safety net for every other approach. Staleness is bounded by the TTL.</li>
      <li><strong>Delete on write</strong>: after updating the database, delete the cache key. The next read reloads it. Prefer <em>delete</em> over <em>update</em>: two concurrent writers updating the cache can leave it with the older value.</li>
      <li><strong>Event-driven invalidation</strong>: capture database changes (change data capture with Debezium reading the MySQL binlog, or Kafka events) and invalidate caches from that stream. Reliable even when many services write the same table.</li>
      <li><strong>Versioned keys</strong>: put a version in the key (<code>product:42:v7</code>); a write bumps the version so old entries are simply never read again and age out.</li>
    </ul>
    <h3>The classic race</h3>
    <p>Even "update DB, then delete cache" has a race with cache-aside: reader A misses and reads the old value from the DB; writer B updates the DB and deletes the key; then A writes its <em>old</em> value into the cache. Now the cache is stale until the TTL. Mitigations: keep TTLs short, use <strong>delayed double delete</strong> (delete again after a few hundred ms), or use leases (Facebook's memcache paper: the cache hands out a token on a miss and rejects a fill whose token was invalidated by a write).</p>
    <div class="callout warn"><strong>Never cache-first for money</strong>For balances, inventory counts at checkout and payment status, read from the source of truth (or use strongly consistent stores). Caches are eventually consistent by nature. It is fine to show a cached "only 3 left" on a product page, but the final stock check at order time must hit the database.</div>

    <h2>Cache failure modes</h2>
    <h3>Cache stampede (thundering herd)</h3>
    <p>A very hot key expires. In the next few milliseconds, thousands of requests all miss and all query the database for the same value at once. The DB slows down, requests time out, and retries make it worse. Picture the IPL final score key on Hotstar expiring with 20 million viewers.</p>
    <div data-diagram="stampede" data-caption="Stampede: a hot key expires and every concurrent miss hits the database. Locking or coalescing lets only one through."></div>
    <ul>
      <li><strong>Locking (mutex)</strong>: on a miss, try to acquire a short lock in Redis (<code>SET lock:key 1 NX PX 3000</code>). The winner rebuilds the value; others wait briefly and retry the cache, or serve slightly stale data.</li>
      <li><strong>Request coalescing</strong>: within one server, concurrent misses for the same key share a single in-flight DB call (Go's <code>singleflight</code>, Caffeine's loading cache). CDNs do this too ("collapsed forwarding").</li>
      <li><strong>Jittered TTL</strong>: add randomness, for example 300 s ± 30 s, so keys loaded together do not all expire together.</li>
      <li><strong>Early (probabilistic) refresh</strong>: refresh a hot key in the background <em>before</em> it expires, e.g. when 90% of the TTL has passed, or with a probability that rises as expiry approaches. Users never see the miss.</li>
    </ul>
    <h3>Cache penetration</h3>
    <p>Requests for keys that do not exist anywhere (random product ids from a bot) always miss the cache and always hit the database. Fixes: <strong>cache the null</strong> ("not found" stored with a short TTL like 60 s), and put a <strong>Bloom filter</strong> of all valid ids in front: a compact bit array that says "definitely not present" or "maybe present", so you skip the DB for ids that cannot exist. Also validate input and rate limit.</p>
    <h3>Cache avalanche</h3>
    <p>A large part of the cache becomes empty at once: many keys share the same TTL, or a cache node or cluster restarts. The database suddenly gets the full read load. Fixes: jittered TTLs, a replicated and highly available cache (Redis replicas with Sentinel or Cluster), warming the cache before switching traffic, and circuit breakers or rate limits in front of the DB so it degrades instead of collapsing.</p>
    <h3>Hot keys</h3>
    <p>One key gets so much traffic (a celebrity profile, a flash-sale product) that the single cache shard holding it is overloaded, even though the cluster as a whole has room. Fixes: a local near cache on each app server for that key, <strong>key replication</strong> (store <code>product:42#1</code> to <code>product:42#10</code> on different shards and read a random copy), and detecting hot keys with monitoring (<code>redis-cli --hotkeys</code>).</p>
    <table>
      <thead><tr><th>Problem</th><th>Cause</th><th>Main fixes</th></tr></thead>
      <tbody>
        <tr><td>Stampede</td><td>One hot key expires</td><td>Lock, coalesce, early refresh, jitter</td></tr>
        <tr><td>Penetration</td><td>Keys that do not exist</td><td>Cache nulls, Bloom filter, validation</td></tr>
        <tr><td>Avalanche</td><td>Many keys expire or cache dies</td><td>Jitter, HA cache, warm-up, circuit breaker</td></tr>
        <tr><td>Hot key</td><td>One key overloads one shard</td><td>Local cache, replicate key, split</td></tr>
      </tbody>
    </table>

    <h2>Redis vs Memcached</h2>
    <table>
      <thead><tr><th>Feature</th><th>Redis</th><th>Memcached</th></tr></thead>
      <tbody>
        <tr><td>Data types</td><td>Strings, hashes, lists, sets, sorted sets, streams, bitmaps, HyperLogLog, geo</td><td>Strings (byte blobs) only</td></tr>
        <tr><td>Persistence</td><td>Optional (RDB snapshots, AOF log)</td><td>None, pure cache</td></tr>
        <tr><td>Replication and failover</td><td>Built in (replicas, Sentinel, Cluster)</td><td>None built in; client-side sharding</td></tr>
        <tr><td>Threading</td><td>Mostly single-threaded command execution (I/O threads optional)</td><td>Multi-threaded, scales on many cores</td></tr>
        <tr><td>Extras</td><td>Lua scripts, transactions, pub/sub, TTL per key, eviction policies</td><td>Simple get/set/delete, CAS, LRU</td></tr>
        <tr><td>Best for</td><td>Most use cases: cache, sessions, leaderboards, rate limiting, queues</td><td>Very simple, large, multi-threaded object caching</td></tr>
      </tbody>
    </table>
    <p>In an interview, default to Redis unless you have a specific reason. Facebook famously runs Memcached at huge scale; most Indian startups (Swiggy, Zomato, CRED) run Redis, often managed (AWS ElastiCache).</p>

    <h2>Common interview questions</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"Reads go through a Redis cache using cache-aside with a TTL of a few minutes plus jitter. On writes I update the database and then delete the cache key."</li>
        <li>"Expected hit rate is around 90% because the top 10% of products get most views, so the DB sees a tenth of the read traffic."</li>
        <li>"For hot keys I'll protect against stampedes with a short Redis lock or request coalescing and refresh the key before it expires."</li>
        <li>"The cache is not the source of truth: if Redis goes down we fall back to the DB with a circuit breaker to avoid overloading it."</li>
      </ul>
    </div>
    <div class="callout warn"><strong>Pitfalls</strong>Caching without a TTL; caching data that must be strongly consistent; updating instead of deleting on writes; one TTL for every key (avalanche); ignoring what happens when the cache is cold or down.</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>What is the difference between cache-aside and read-through?</summary><div>Both load data on a miss. In cache-aside the <em>application</em> checks the cache, reads the DB and fills the cache. In read-through the application only talks to the cache, and the <em>cache</em> loads from the DB through a configured loader.</div></details>
      <details><summary>You are building a "views" counter for videos that updates on every view. Which write strategy and why?</summary><div>Write-back: increment in Redis and flush to the database periodically in batches. It turns millions of DB writes into a few, and losing a handful of view counts on a crash is acceptable.</div></details>
      <details><summary>Why delete the cache key on a write rather than update it?</summary><div>With two concurrent writers, the cache updates can arrive in a different order from the DB writes, leaving the cache with the older value permanently (until TTL). Deleting is idempotent: the next read loads whatever is currently in the DB.</div></details>
      <details><summary>Bots request random product ids that do not exist and your DB load spikes. What is this and how do you fix it?</summary><div>Cache penetration. Cache "not found" results with a short TTL, and put a Bloom filter of valid ids in front so impossible ids are rejected without touching the DB. Also rate limit and validate ids.</div></details>
      <details><summary>Explain the cache stampede and two ways to prevent it.</summary><div>When a hot key expires, many concurrent requests miss together and all hit the DB. Prevent with a mutex/lock so only one request rebuilds the value, request coalescing (singleflight), jittered TTLs, or refreshing hot keys before expiry.</div></details>
      <details><summary>What are the time complexities of get and put in an LRU cache built with a hash map and doubly linked list, and why do you need both structures?</summary><div>Both are O(1). The hash map finds the node for a key in O(1); the doubly linked list lets you unlink a node and move it to the front, or remove the tail, in O(1) because each node knows its neighbours. A singly linked list could not remove a node in O(1) without its predecessor.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>Caching trades freshness for speed and DB protection; it works because access is skewed toward a hot set.</li>
      <li>Caches live at every layer: browser, CDN, reverse proxy, in-process, distributed (Redis), and inside the database.</li>
      <li>Cache-aside plus delete-on-write plus TTL is the default; write-through for fresh reads, write-back for fast, loss-tolerant writes.</li>
      <li>LRU is the default eviction policy; an O(1) LRU uses a hash map and a doubly linked list.</li>
      <li>Plan for stampedes (lock, coalesce, early refresh, jitter), penetration (null caching, Bloom filter), avalanches (jitter, HA cache) and hot keys (local cache, key replication).</li>
      <li>Default to Redis; never treat the cache as the source of truth for money or inventory.</li>
    </ul></div>
  `,
  code: {
    lru: {
      title: "O(1) LRU cache: hash map + doubly linked list",
      java: String.raw`import java.util.HashMap;
import java.util.Map;

public class Main {
    static class LRUCache<K, V> {
        private class Node {
            K key;
            V value;
            Node prev, next;
            Node(K key, V value) { this.key = key; this.value = value; }
        }

        private final int capacity;
        private final Map<K, Node> map = new HashMap<>();
        private final Node head = new Node(null, null); // sentinel: most recent side
        private final Node tail = new Node(null, null); // sentinel: least recent side

        LRUCache(int capacity) {
            if (capacity <= 0) throw new IllegalArgumentException("capacity must be positive");
            this.capacity = capacity;
            head.next = tail;
            tail.prev = head;
        }

        public synchronized V get(K key) {
            Node node = map.get(key);
            if (node == null) return null;
            moveToFront(node);
            return node.value;
        }

        public synchronized void put(K key, V value) {
            Node node = map.get(key);
            if (node != null) {
                node.value = value;
                moveToFront(node);
                return;
            }
            if (map.size() == capacity) {
                Node lru = tail.prev;
                unlink(lru);
                map.remove(lru.key);
            }
            node = new Node(key, value);
            map.put(key, node);
            addToFront(node);
        }

        private void unlink(Node n) {
            n.prev.next = n.next;
            n.next.prev = n.prev;
        }

        private void addToFront(Node n) {
            n.prev = head;
            n.next = head.next;
            head.next.prev = n;
            head.next = n;
        }

        private void moveToFront(Node n) {
            unlink(n);
            addToFront(n);
        }
    }

    public static void main(String[] args) {
        LRUCache<Integer, String> cache = new LRUCache<>(2);
        cache.put(1, "one");
        cache.put(2, "two");
        System.out.println(cache.get(1));  // one   (1 is now most recent)
        cache.put(3, "three");             // evicts 2
        System.out.println(cache.get(2));  // null
        cache.put(1, "uno");               // update, 1 most recent
        cache.put(4, "four");              // evicts 3
        System.out.println(cache.get(1) + " " + cache.get(3) + " " + cache.get(4)); // uno null four
    }
}
`,
      python: String.raw`from threading import Lock
from typing import Generic, Hashable, Optional, TypeVar

K = TypeVar("K", bound=Hashable)
V = TypeVar("V")


class _Node:
    __slots__ = ("key", "value", "prev", "next")

    def __init__(self, key=None, value=None):
        self.key = key
        self.value = value
        self.prev: Optional["_Node"] = None
        self.next: Optional["_Node"] = None


class LRUCache(Generic[K, V]):
    def __init__(self, capacity: int):
        if capacity <= 0:
            raise ValueError("capacity must be positive")
        self.capacity = capacity
        self.map: dict[K, _Node] = {}
        self.head = _Node()  # sentinel: most recent side
        self.tail = _Node()  # sentinel: least recent side
        self.head.next = self.tail
        self.tail.prev = self.head
        self.lock = Lock()

    def get(self, key: K) -> Optional[V]:
        with self.lock:
            node = self.map.get(key)
            if node is None:
                return None
            self._move_to_front(node)
            return node.value

    def put(self, key: K, value: V) -> None:
        with self.lock:
            node = self.map.get(key)
            if node is not None:
                node.value = value
                self._move_to_front(node)
                return
            if len(self.map) == self.capacity:
                lru = self.tail.prev
                self._unlink(lru)
                del self.map[lru.key]
            node = _Node(key, value)
            self.map[key] = node
            self._add_to_front(node)

    def _unlink(self, n: _Node) -> None:
        n.prev.next = n.next
        n.next.prev = n.prev

    def _add_to_front(self, n: _Node) -> None:
        n.prev = self.head
        n.next = self.head.next
        self.head.next.prev = n
        self.head.next = n

    def _move_to_front(self, n: _Node) -> None:
        self._unlink(n)
        self._add_to_front(n)


if __name__ == "__main__":
    cache: LRUCache[int, str] = LRUCache(2)
    cache.put(1, "one")
    cache.put(2, "two")
    print(cache.get(1))   # one   (1 is now most recent)
    cache.put(3, "three")  # evicts 2
    print(cache.get(2))   # None
    cache.put(1, "uno")    # update, 1 most recent
    cache.put(4, "four")   # evicts 3
    print(cache.get(1), cache.get(3), cache.get(4))  # uno None four
`,
      cpp: String.raw`#include <iostream>
#include <list>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <utility>

// std::list is a doubly linked list; splice() moves a node in O(1) without reallocating.
template <typename K, typename V>
class LRUCache {
    using Item = std::pair<K, V>;
    size_t capacity_;
    std::list<Item> items_;  // front = most recent, back = least recent
    std::unordered_map<K, typename std::list<Item>::iterator> index_;
    std::mutex mu_;

public:
    explicit LRUCache(size_t capacity) : capacity_(capacity) {
        if (capacity == 0) throw std::invalid_argument("capacity must be positive");
    }

    std::optional<V> get(const K& key) {
        std::lock_guard<std::mutex> lock(mu_);
        auto it = index_.find(key);
        if (it == index_.end()) return std::nullopt;
        items_.splice(items_.begin(), items_, it->second);  // move to front
        return it->second->second;
    }

    void put(const K& key, V value) {
        std::lock_guard<std::mutex> lock(mu_);
        auto it = index_.find(key);
        if (it != index_.end()) {
            it->second->second = std::move(value);
            items_.splice(items_.begin(), items_, it->second);
            return;
        }
        if (items_.size() == capacity_) {
            index_.erase(items_.back().first);  // evict least recent
            items_.pop_back();
        }
        items_.emplace_front(key, std::move(value));
        index_[key] = items_.begin();
    }
};

std::string show(const std::optional<std::string>& v) { return v ? *v : "null"; }

int main() {
    LRUCache<int, std::string> cache(2);
    cache.put(1, "one");
    cache.put(2, "two");
    std::cout << show(cache.get(1)) << "\n";  // one   (1 is now most recent)
    cache.put(3, "three");                     // evicts 2
    std::cout << show(cache.get(2)) << "\n";  // null
    cache.put(1, "uno");                       // update, 1 most recent
    cache.put(4, "four");                      // evicts 3
    std::cout << show(cache.get(1)) << " " << show(cache.get(3)) << " "
              << show(cache.get(4)) << "\n";   // uno null four
}
`,
      javascript: String.raw`class Node {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}

class LRUCache {
  constructor(capacity) {
    if (capacity <= 0) throw new RangeError("capacity must be positive");
    this.capacity = capacity;
    this.map = new Map();
    this.head = new Node(null, null); // sentinel: most recent side
    this.tail = new Node(null, null); // sentinel: least recent side
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key) {
    const node = this.map.get(key);
    if (node === undefined) return undefined;
    this.#moveToFront(node);
    return node.value;
  }

  put(key, value) {
    let node = this.map.get(key);
    if (node !== undefined) {
      node.value = value;
      this.#moveToFront(node);
      return;
    }
    if (this.map.size === this.capacity) {
      const lru = this.tail.prev;
      this.#unlink(lru);
      this.map.delete(lru.key);
    }
    node = new Node(key, value);
    this.map.set(key, node);
    this.#addToFront(node);
  }

  #unlink(n) {
    n.prev.next = n.next;
    n.next.prev = n.prev;
  }

  #addToFront(n) {
    n.prev = this.head;
    n.next = this.head.next;
    this.head.next.prev = n;
    this.head.next = n;
  }

  #moveToFront(n) {
    this.#unlink(n);
    this.#addToFront(n);
  }
}

const cache = new LRUCache(2);
cache.put(1, "one");
cache.put(2, "two");
console.log(cache.get(1)); // one   (1 is now most recent)
cache.put(3, "three");     // evicts 2
console.log(cache.get(2)); // undefined
cache.put(1, "uno");       // update, 1 most recent
cache.put(4, "four");      // evicts 3
console.log(cache.get(1), cache.get(3), cache.get(4)); // uno undefined four
`,
      go: String.raw`package main

import (
	"container/list"
	"fmt"
	"sync"
)

type entry[K comparable, V any] struct {
	key   K
	value V
}

// LRUCache uses container/list (a doubly linked list) plus a map from key to list element.
type LRUCache[K comparable, V any] struct {
	mu       sync.Mutex
	capacity int
	ll       *list.List // front = most recent, back = least recent
	index    map[K]*list.Element
}

func NewLRUCache[K comparable, V any](capacity int) *LRUCache[K, V] {
	if capacity <= 0 {
		panic("capacity must be positive")
	}
	return &LRUCache[K, V]{capacity: capacity, ll: list.New(), index: make(map[K]*list.Element)}
}

func (c *LRUCache[K, V]) Get(key K) (V, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.index[key]; ok {
		c.ll.MoveToFront(el)
		return el.Value.(*entry[K, V]).value, true
	}
	var zero V
	return zero, false
}

func (c *LRUCache[K, V]) Put(key K, value V) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.index[key]; ok {
		el.Value.(*entry[K, V]).value = value
		c.ll.MoveToFront(el)
		return
	}
	if c.ll.Len() == c.capacity {
		oldest := c.ll.Back()
		c.ll.Remove(oldest)
		delete(c.index, oldest.Value.(*entry[K, V]).key)
	}
	c.index[key] = c.ll.PushFront(&entry[K, V]{key, value})
}

func show(v string, ok bool) string {
	if !ok {
		return "miss"
	}
	return v
}

func main() {
	cache := NewLRUCache[int, string](2)
	cache.Put(1, "one")
	cache.Put(2, "two")
	fmt.Println(show(cache.Get(1))) // one   (1 is now most recent)
	cache.Put(3, "three")           // evicts 2
	fmt.Println(show(cache.Get(2))) // miss
	cache.Put(1, "uno")             // update, 1 most recent
	cache.Put(4, "four")            // evicts 3
	fmt.Println(show(cache.Get(1)), show(cache.Get(3)), show(cache.Get(4))) // uno miss four
}
`,
    },
  },
  diagrams: {
    layers: String.raw`flowchart LR
      B["Browser cache"] --> CDN["CDN edge"]
      CDN --> RP["Reverse proxy cache"]
      RP --> APP["App server (local cache)"]
      APP --> R[("Redis / Memcached")]
      APP --> DB[("Database (buffer pool)")]`,
    aside: String.raw`sequenceDiagram
      participant A as App
      participant C as Cache
      participant D as Database
      A->>C: GET product:42
      C-->>A: miss
      A->>D: SELECT * FROM products WHERE id = 42
      D-->>A: row
      A->>C: SET product:42 (TTL 300s)
      Note over A,C: Next read is a hit
      A->>C: GET product:42
      C-->>A: hit`,
    wthrough: String.raw`sequenceDiagram
      participant A as App
      participant C as Cache
      participant D as Database
      A->>C: write product:42
      C->>D: write row
      D-->>C: ok
      C-->>A: ok (both updated)`,
    waround: String.raw`sequenceDiagram
      participant A as App
      participant C as Cache
      participant D as Database
      A->>D: UPDATE product 42
      D-->>A: ok
      A->>C: DEL product:42
      Note over A,D: Next read misses and reloads from DB`,
    wback: String.raw`sequenceDiagram
      participant A as App
      participant C as Cache
      participant D as Database
      A->>C: write views:42 += 1
      C-->>A: ok (fast)
      A->>C: write views:42 += 1
      C-->>A: ok
      Note over C: Later, in batches
      C->>D: flush views:42
      D-->>C: ok`,
    stampede: String.raw`flowchart LR
      R1[Request 1] --> C{"Cache: key expired"}
      R2[Request 2] --> C
      R3["Request 3..N"] --> C
      C -->|"without protection: all N"| DB[(Database)]
      C -->|"with lock: only 1"| L["Lock winner rebuilds"]
      L --> DB
      L --> F["Fill cache, others read it"]`,
  },
});
