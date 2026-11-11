SD.register({
  id: "consistent-hashing",
  html: String.raw`
    <p class="lead">When you spread data across N cache or database servers, you need a rule that maps each key to a
    server. The obvious rule, <code>hash(key) % N</code>, works until N changes; then almost every key moves. Consistent
    hashing places servers and keys on a ring so that adding or removing a server moves only about 1/N of the keys. It
    powers DynamoDB, Cassandra, Discord and most distributed caches, and it shows up in nearly every SDE 2 sharding
    discussion.</p>

    <h2>Why modulo hashing fails on resize</h2>
    <p>Say you have 4 Redis servers and put each key on server <code>hash(key) % 4</code>. Traffic grows for the IPL
    final and you add a 5th. Now the rule is <code>hash(key) % 5</code>. For a key to stay put, <code>h % 4</code> must
    equal <code>h % 5</code>, which is true for only 4 of every 20 hash values. So <strong>80% of keys move</strong>.</p>
    <table>
      <thead><tr><th>Change</th><th>Keys that move with <code>% N</code></th><th>Keys that move with consistent hashing</th></tr></thead>
      <tbody>
        <tr><td>4 → 5 servers</td><td>~80%</td><td>~20% (1/5)</td></tr>
        <tr><td>10 → 11 servers</td><td>~91%</td><td>~9% (1/11)</td></tr>
        <tr><td>100 → 101 servers</td><td>~99%</td><td>~1% (1/101)</td></tr>
        <tr><td>One of 10 servers dies</td><td>~90%</td><td>~10% (only that server's keys)</td></tr>
      </tbody>
    </table>
    <p>In general, going from N to N+1 servers with modulo moves about <strong>N/(N+1)</strong> of all keys. For a cache, that
    means a sudden near-100% miss rate: every request falls through to the database at once (a <em>cache stampede</em>),
    which can take the database down. For a datastore, it means migrating almost all your data.</p>

    <h2>The hash ring</h2>
    <p>Take the output range of a hash function, for example 0 to 2<sup>32</sup> − 1, and bend it into a circle so the
    largest value wraps around to 0.</p>
    <ol class="steps">
      <li><strong>Place servers</strong>: hash each server's name (<code>hash("cache-A")</code>) to get its position on the ring.</li>
      <li><strong>Place keys</strong>: hash each key (<code>hash("user:42")</code>) onto the same ring.</li>
      <li><strong>Look up clockwise</strong>: a key belongs to the first server you meet walking clockwise from the key's position. Past the top, wrap to the start.</li>
    </ol>
    <figure class="svg-fig">
      <svg viewBox="0 0 760 340">
        <circle cx="380" cy="170" r="120" class="s-line"/>
        <text x="380" y="166" class="s-title" text-anchor="middle">hash ring</text>
        <text x="380" y="186" class="s-muted" text-anchor="middle">0 … 2^32 − 1, clockwise</text>
        <text x="380" y="40" class="s-muted" text-anchor="middle">0 / 2^32</text>
        <line x1="380" y1="44" x2="380" y2="56" class="s-line"/>

        <rect x="405" y="41" width="32" height="32" rx="10" class="s-accent"/>
        <text x="421" y="62" class="s-text" text-anchor="middle">A</text>
        <rect x="441" y="246" width="32" height="32" rx="10" class="s-accent"/>
        <text x="457" y="267" class="s-text" text-anchor="middle">B</text>
        <rect x="251" y="195" width="32" height="32" rx="10" class="s-accent"/>
        <text x="267" y="216" class="s-text" text-anchor="middle">C</text>

        <circle cx="493" cy="129" r="9" class="s-green"/>
        <text x="515" y="125" class="s-text">k1</text>
        <circle cx="498" cy="191" r="9" class="s-green"/>
        <text x="520" y="196" class="s-text">k4</text>
        <circle cx="339" cy="283" r="9" class="s-amber"/>
        <text x="330" y="312" class="s-text" text-anchor="middle">k2</text>
        <circle cx="303" cy="78" r="9" class="s-red"/>
        <text x="285" y="66" class="s-text" text-anchor="end">k3</text>

        <text x="610" y="110" class="s-text">k1, k4 → B</text>
        <text x="610" y="135" class="s-text">k2 → C</text>
        <text x="610" y="160" class="s-text">k3 → A (wraps past 0)</text>
        <text x="610" y="195" class="s-muted">each key walks clockwise</text>
        <text x="610" y="213" class="s-muted">to the next server</text>
        <text x="120" y="120" class="s-muted" text-anchor="middle">A owns arc (C, A]</text>
        <text x="120" y="145" class="s-muted" text-anchor="middle">B owns arc (A, B]</text>
        <text x="120" y="170" class="s-muted" text-anchor="middle">C owns arc (B, C]</text>
      </svg>
      <figcaption>Servers (A, B, C) and keys share one ring. Each key belongs to the next server clockwise.</figcaption>
    </figure>
    <p>Lookups are fast: keep server positions in a sorted array (or tree) and binary-search for the first position
    greater than or equal to the key's hash. That is O(log S) for S positions.</p>

    <h3>Adding and removing nodes</h3>
    <p><strong>Add server D</strong> between C and A: only keys on the arc from C to D, which used to go to A, now go to D.
    Every other key stays where it was. <strong>Remove server B</strong>: only B's keys move, to the next server clockwise
    (C). Every other server is untouched.</p>
    <div data-diagram="addNode" data-caption="Adding node D takes over part of A's arc; B and C are unaffected"></div>
    <p>Try it: add and remove nodes, change the number of virtual nodes, and watch how many keys move.</p>
    <div data-widget="hash-ring"></div>

    <h2>Virtual nodes</h2>
    <p>With only 3 points on the ring, arcs are random lengths. One server might own 50% of the ring and another 15%.
    And when a server dies, its <em>entire</em> load lands on one neighbour, which may then fall over too (a cascading
    failure).</p>
    <p><strong>Virtual nodes</strong> (vnodes) fix both: each physical server is placed on the ring many times, by hashing
    <code>"cache-A#0"</code>, <code>"cache-A#1"</code>, ... <code>"cache-A#199"</code>.</p>
    <div class="grid-2">
      <div class="card good"><strong>What vnodes give you</strong><ul>
        <li><strong>Even load</strong>: many small arcs average out. With 100–200 vnodes per server, load is typically within about 10–15% of the mean.</li>
        <li><strong>Spread-out failover</strong>: a dead server's many small arcs are picked up by many different servers.</li>
        <li><strong>Weighted capacity</strong>: a server with twice the RAM gets twice the vnodes.</li>
      </ul></div>
      <div class="card bad"><strong>What they cost</strong><ul>
        <li>More memory for the ring: S servers x V vnodes entries (1,000 x 200 = 200k entries, still tiny).</li>
        <li>Lookup is O(log(S·V)), barely slower.</li>
        <li>Rebalancing touches many small ranges, so data movement is more scattered.</li>
      </ul></div>
    </div>
    <p>Cassandra historically used 256 vnodes per node (now 16 with a smarter allocation algorithm); DynamoDB-style
    systems use similar ideas.</p>

    <h3>Code: a consistent hash ring with virtual nodes</h3>
    <p>Positions live in a sorted structure; lookup is a binary search for the first position ≥ hash(key), wrapping to
    the start. <code>getNodes(key, n)</code> walks clockwise to collect <em>n distinct</em> physical servers for
    replication. All five versions use the same hash (FNV-1a plus a mixing step) and print the same result: with 3 servers and 100 vnodes
    each, adding a 4th moves about 22% of 10,000 keys (ideal is 25%), versus 75% with modulo.</p>
    <div data-code="ring"></div>

    <h2>Replication on the ring</h2>
    <p>For durability, store each key on <strong>N</strong> servers (N = 3 is common). The key's <em>coordinator</em> is
    the first server clockwise; replicas go to the <strong>next N − 1 distinct physical servers</strong> clockwise. With
    vnodes, consecutive positions often belong to the same physical server, so you must skip those, or two "replicas"
    end up on one machine. Production systems also skip servers in the same rack or availability zone.</p>
    <div data-diagram="replication" data-caption="Key k is stored on the first 3 distinct servers clockwise (its preference list)"></div>
    <p>Dynamo calls this list of servers the <strong>preference list</strong>. Reads and writes go to it with quorum
    rules (for example write to 2 of 3, read from 2 of 3).</p>

    <h2>Trade-offs</h2>
    <table>
      <thead><tr><th>Approach</th><th>Keys moved on resize</th><th>Lookup</th><th>Balance</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td><code>hash % N</code></td><td>~N/(N+1), almost all</td><td>O(1)</td><td>Good</td><td>Fine if N never changes</td></tr>
        <tr><td>Ring, no vnodes</td><td>~1/N</td><td>O(log N)</td><td>Poor</td><td>Failover hits one neighbour</td></tr>
        <tr><td>Ring + vnodes</td><td>~1/N</td><td>O(log N·V)</td><td>Good</td><td>The usual production choice</td></tr>
        <tr><td>Rendezvous (HRW)</td><td>~1/N</td><td>O(N)</td><td>Good</td><td>No ring; simple; great for small N</td></tr>
        <tr><td>Fixed slots (Redis Cluster)</td><td>Only moved slots</td><td>O(1)</td><td>Manual / tool-driven</td><td>16,384 slots, explicitly assigned</td></tr>
      </tbody>
    </table>
    <div class="callout info"><strong>Hot keys are a separate problem</strong>Consistent hashing balances <em>many keys</em>
    across servers. It cannot help when one key (a viral tweet, a Flipkart Big Billion Days deal page) gets 100x the traffic.
    For that, use replication of the hot key, a local in-process cache, or key splitting (<code>deal:42#1</code> ...
    <code>deal:42#8</code>).</div>

    <h2>Rendezvous hashing (briefly)</h2>
    <p><strong>Rendezvous</strong> or <strong>highest random weight (HRW)</strong> hashing: for each key, compute
    <code>score = hash(key + server)</code> for every server and pick the server with the highest score. When a server
    is removed, only its keys move (each to its own second-best server, so load spreads evenly without vnodes). Adding a
    server steals roughly 1/N of keys. The cost is O(N) per lookup, which is fine for tens of servers. It is used in some
    CDNs and load balancers, and in Twitter's EventBus.</p>

    <h2>Where it is used</h2>
    <ul>
      <li><strong>Amazon Dynamo / DynamoDB</strong>: the 2007 Dynamo paper made ring + vnodes + preference lists famous.</li>
      <li><strong>Apache Cassandra / ScyllaDB</strong>: each node owns token ranges on a 64-bit ring (Murmur3 partitioner).</li>
      <li><strong>Discord</strong>: routes guilds (servers) to Elixir processes across nodes with a hash ring.</li>
      <li><strong>Memcached clients</strong> (ketama): clients hash keys onto a ring of cache servers, so adding a cache box does not wipe the whole cache.</li>
      <li><strong>CDNs and load balancers</strong>: Akamai (where the 1997 paper's authors worked), Google's Maglev, Envoy and Nginx's <code>hash ... consistent</code> keep a URL or user on the same backend for cache locality.</li>
      <li><strong>Sharded services</strong> at Indian companies, for example routing a rider's live location updates to the same in-memory shard at Ola or Rapido.</li>
    </ul>

    <h2>Interview questions and pitfalls</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>"I'll shard the cache with consistent hashing
    instead of modulo, so adding a node only remaps about 1/N of keys instead of nearly all of them. Each physical node gets
    around 150 virtual nodes for even load and so a failure spreads across many peers. For replication I take the next
    three <em>distinct</em> physical nodes clockwise, in different AZs. Lookups are a binary search over the sorted ring."</div>
    <ul>
      <li><strong>"What's the time complexity of a lookup?"</strong> O(log(S·V)) with binary search over S servers x V vnodes.</li>
      <li><strong>"Who holds the ring?"</strong> Either every client (memcached-style, config pushed via ZooKeeper/etcd) or every node via gossip (Cassandra), or a routing tier.</li>
      <li><strong>"What happens to data when a node is added?"</strong> The new node streams the ranges it now owns from their previous owners; until done, reads may fall back to the old owner.</li>
      <li><strong>Pitfall</strong>: forgetting the wrap-around (key hash greater than every server position goes to the first server).</li>
      <li><strong>Pitfall</strong>: using a poor hash (like Java's <code>String.hashCode</code>) that clusters similar names such as <code>node#1</code>, <code>node#2</code>. Use MD5, Murmur3 or xxHash.</li>
    </ul>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>You go from 9 to 10 cache servers using <code>hash % N</code>. Roughly what fraction of keys move, and why is that dangerous?</summary>
        <div>About 9/10 = 90%. Almost every cached key now maps to a different server, so the hit rate collapses and the database gets hit by nearly all traffic at once.</div></details>
      <details><summary>With consistent hashing, which keys move when you add a server?</summary>
        <div>Only keys whose hash falls on the arc between the new server's position and its predecessor; they move from the next server clockwise to the new one. That is about 1/(N+1) of the keys. All other keys stay put.</div></details>
      <details><summary>Give two reasons to use virtual nodes.</summary>
        <div>(1) Even load: many small arcs average out the random gaps between positions. (2) When a server fails, its load spreads over many servers instead of one neighbour. Bonus: weighted capacity by giving bigger machines more vnodes.</div></details>
      <details><summary>How do you choose 3 replicas for a key on a ring with virtual nodes?</summary>
        <div>Walk clockwise from the key's position and collect servers, skipping vnodes whose physical server is already chosen (and ideally servers in the same rack/AZ), until you have 3 distinct physical servers.</div></details>
      <details><summary>How would you implement the lookup efficiently?</summary>
        <div>Keep vnode positions sorted (TreeMap / std::map / sorted array). Binary-search for the first position ≥ hash(key) (ceiling / lower_bound); if none, wrap to the first entry. O(log(S·V)).</div></details>
      <details><summary>When might rendezvous hashing be a better choice than a ring?</summary>
        <div>With a small number of servers (tens), where O(N) lookup is cheap. It needs no ring or vnodes, balances load naturally, and spreads a removed server's keys evenly across all others.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li><code>hash % N</code> remaps about N/(N+1) of keys when N changes; consistent hashing remaps only about 1/N.</li>
      <li>Servers and keys hash onto one ring; a key belongs to the first server clockwise, with wrap-around.</li>
      <li>Virtual nodes give even load, spread failover and allow weighting by capacity.</li>
      <li>Replicate to the next N distinct physical servers clockwise (Dynamo's preference list).</li>
      <li>Implement with a sorted structure and binary search: O(log(S·V)) lookups.</li>
      <li>It balances many keys, not one hot key; rendezvous hashing is a simple alternative for small clusters.</li>
    </ul></div>
  `,
  code: {
    ring: {
      title: "Consistent hash ring with virtual nodes",
      java: String.raw`import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

public class ConsistentHashRing {
    private final int vnodes;
    private final TreeMap<Long, String> ring = new TreeMap<>(); // sorted: position -> physical node

    public ConsistentHashRing(int vnodes) { this.vnodes = vnodes; }

    /** FNV-1a (32-bit) followed by a murmur3-style finaliser for better spread. */
    static long hash32(String s) {
        int h = 0x811C9DC5;
        for (byte b : s.getBytes(StandardCharsets.UTF_8)) {
            h ^= (b & 0xFF);
            h *= 0x01000193;
        }
        h ^= h >>> 16;
        h *= 0x85EBCA6B;
        h ^= h >>> 13;
        h *= 0xC2B2AE35;
        h ^= h >>> 16;
        return Integer.toUnsignedLong(h); // position in [0, 2^32)
    }

    public void addNode(String node) {
        for (int i = 0; i < vnodes; i++) {
            ring.putIfAbsent(hash32(node + "#" + i), node); // rare collision: first owner keeps it
        }
    }

    public void removeNode(String node) {
        for (int i = 0; i < vnodes; i++) {
            ring.remove(hash32(node + "#" + i), node); // only if this node owns that position
        }
    }

    public String getNode(String key) {
        if (ring.isEmpty()) return null;
        Map.Entry<Long, String> e = ring.ceilingEntry(hash32(key)); // first position >= hash
        return (e != null ? e : ring.firstEntry()).getValue();       // wrap around
    }

    /** Replica set: next n DISTINCT physical nodes clockwise. */
    public List<String> getNodes(String key, int n) {
        List<String> result = new ArrayList<>();
        if (ring.isEmpty()) return result;
        // tail (>= hash) then head (< hash) = one full clockwise lap
        List<String> lap = new ArrayList<>(ring.tailMap(hash32(key), true).values());
        lap.addAll(ring.headMap(hash32(key), false).values());
        for (String node : lap) {
            if (!result.contains(node)) result.add(node);
            if (result.size() == n) break;
        }
        return result;
    }

    public static void main(String[] args) {
        ConsistentHashRing ring = new ConsistentHashRing(100);
        for (String n : new String[] {"cache-A", "cache-B", "cache-C"}) ring.addNode(n);

        Map<String, String> before = new HashMap<>();
        Map<String, Integer> counts = new TreeMap<>();
        for (int i = 0; i < 10_000; i++) {
            String key = "user:" + i;
            String node = ring.getNode(key);
            before.put(key, node);
            counts.merge(node, 1, Integer::sum);
        }
        System.out.println("load: " + counts);

        ring.addNode("cache-D");
        int moved = 0;
        for (Map.Entry<String, String> e : before.entrySet()) {
            if (!ring.getNode(e.getKey()).equals(e.getValue())) moved++;
        }
        System.out.printf("after adding cache-D, moved %d of %d keys (%.1f%%)%n",
                moved, before.size(), 100.0 * moved / before.size());
        System.out.println("replicas of user:42 -> " + ring.getNodes("user:42", 3));
    }
}`,
      python: String.raw`import bisect


def hash32(s: str) -> int:
    """FNV-1a (32-bit) followed by a murmur3-style finaliser for better spread."""
    h = 0x811C9DC5
    for b in s.encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    h ^= h >> 16
    h = (h * 0x85EBCA6B) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 0xC2B2AE35) & 0xFFFFFFFF
    h ^= h >> 16
    return h


class ConsistentHashRing:
    def __init__(self, vnodes=100):
        self.vnodes = vnodes
        self._hashes = []   # sorted positions on the ring
        self._owner = {}    # position -> physical node

    def add_node(self, node):
        for i in range(self.vnodes):
            pos = hash32(f"{node}#{i}")
            if pos in self._owner:  # rare collision: first owner keeps it
                continue
            bisect.insort(self._hashes, pos)
            self._owner[pos] = node

    def remove_node(self, node):
        for i in range(self.vnodes):
            pos = hash32(f"{node}#{i}")
            if self._owner.get(pos) == node:
                del self._owner[pos]
                self._hashes.pop(bisect.bisect_left(self._hashes, pos))

    def get_node(self, key):
        if not self._hashes:
            return None
        # First position clockwise (>= hash); wrap to index 0 past the end.
        idx = bisect.bisect_left(self._hashes, hash32(key)) % len(self._hashes)
        return self._owner[self._hashes[idx]]

    def get_nodes(self, key, n):
        """Replica set: next n DISTINCT physical nodes clockwise."""
        result = []
        if not self._hashes:
            return result
        idx = bisect.bisect_left(self._hashes, hash32(key))
        for step in range(len(self._hashes)):
            node = self._owner[self._hashes[(idx + step) % len(self._hashes)]]
            if node not in result:
                result.append(node)
                if len(result) == n:
                    break
        return result


if __name__ == "__main__":
    ring = ConsistentHashRing(vnodes=100)
    for node in ["cache-A", "cache-B", "cache-C"]:
        ring.add_node(node)

    keys = [f"user:{i}" for i in range(10_000)]
    before = {k: ring.get_node(k) for k in keys}
    counts = {}
    for node in before.values():
        counts[node] = counts.get(node, 0) + 1
    print("load:", dict(sorted(counts.items())))

    ring.add_node("cache-D")
    moved = sum(1 for k in keys if ring.get_node(k) != before[k])
    print(f"after adding cache-D, moved {moved} of {len(keys)} keys ({100 * moved / len(keys):.1f}%)")
    print("replicas of user:42 ->", ring.get_nodes("user:42", 3))`,
      cpp: String.raw`#include <algorithm>
#include <cstdint>
#include <iostream>
#include <map>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

// FNV-1a (32-bit) followed by a murmur3-style finaliser for better spread.
uint32_t hash32(const std::string& s) {
    uint32_t h = 0x811C9DC5u;
    for (unsigned char b : s) {
        h ^= b;
        h *= 0x01000193u;
    }
    h ^= h >> 16;
    h *= 0x85EBCA6Bu;
    h ^= h >> 13;
    h *= 0xC2B2AE35u;
    h ^= h >> 16;
    return h;
}

class ConsistentHashRing {
public:
    explicit ConsistentHashRing(int vnodes = 100) : vnodes_(vnodes) {}

    void addNode(const std::string& node) {
        for (int i = 0; i < vnodes_; ++i)
            ring_.emplace(hash32(node + "#" + std::to_string(i)), node);  // no-op on collision
    }

    void removeNode(const std::string& node) {
        for (int i = 0; i < vnodes_; ++i) {
            auto it = ring_.find(hash32(node + "#" + std::to_string(i)));
            if (it != ring_.end() && it->second == node) ring_.erase(it);
        }
    }

    std::optional<std::string> getNode(const std::string& key) const {
        if (ring_.empty()) return std::nullopt;
        auto it = ring_.lower_bound(hash32(key));  // first position >= hash, O(log n)
        if (it == ring_.end()) it = ring_.begin();  // wrap around
        return it->second;
    }

    // Replica set: next n DISTINCT physical nodes clockwise.
    std::vector<std::string> getNodes(const std::string& key, std::size_t n) const {
        std::vector<std::string> result;
        if (ring_.empty()) return result;
        auto it = ring_.lower_bound(hash32(key));
        for (std::size_t step = 0; step < ring_.size() && result.size() < n; ++step, ++it) {
            if (it == ring_.end()) it = ring_.begin();
            if (std::find(result.begin(), result.end(), it->second) == result.end())
                result.push_back(it->second);
        }
        return result;
    }

private:
    int vnodes_;
    std::map<uint32_t, std::string> ring_;  // sorted: position -> physical node
};

int main() {
    ConsistentHashRing ring(100);
    for (const char* n : {"cache-A", "cache-B", "cache-C"}) ring.addNode(n);

    std::vector<std::string> keys;
    for (int i = 0; i < 10000; ++i) keys.push_back("user:" + std::to_string(i));

    std::unordered_map<std::string, std::string> before;
    std::map<std::string, int> counts;
    for (const auto& k : keys) {
        before[k] = *ring.getNode(k);
        ++counts[before[k]];
    }
    std::cout << "load:";
    for (const auto& [node, c] : counts) std::cout << " " << node << "=" << c;
    std::cout << "\n";

    ring.addNode("cache-D");
    int moved = 0;
    for (const auto& k : keys)
        if (*ring.getNode(k) != before[k]) ++moved;
    std::cout << "after adding cache-D, moved " << moved << " of " << keys.size() << " keys\n";

    std::cout << "replicas of user:42 ->";
    for (const auto& n : ring.getNodes("user:42", 3)) std::cout << " " << n;
    std::cout << "\n";
}`,
      javascript: String.raw`// FNV-1a (32-bit) followed by a murmur3-style finaliser for better spread.
function hash32(str) {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(str)) {
    h ^= b;
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0; // unsigned 32-bit
}

class ConsistentHashRing {
  constructor(vnodes = 100) {
    this.vnodes = vnodes;
    this.hashes = []; // sorted positions on the ring
    this.owner = new Map(); // position -> physical node
  }

  // Index of the first position >= h (classic lower-bound binary search).
  lowerBound(h) {
    let lo = 0, hi = this.hashes.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.hashes[mid] < h) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  addNode(node) {
    for (let i = 0; i < this.vnodes; i++) {
      const pos = hash32(node + "#" + i);
      if (this.owner.has(pos)) continue; // rare collision: first owner keeps it
      this.hashes.splice(this.lowerBound(pos), 0, pos);
      this.owner.set(pos, node);
    }
  }

  removeNode(node) {
    for (let i = 0; i < this.vnodes; i++) {
      const pos = hash32(node + "#" + i);
      if (this.owner.get(pos) === node) {
        this.owner.delete(pos);
        this.hashes.splice(this.lowerBound(pos), 1);
      }
    }
  }

  getNode(key) {
    if (this.hashes.length === 0) return null;
    // First position clockwise; wrap to index 0 past the end.
    const idx = this.lowerBound(hash32(key)) % this.hashes.length;
    return this.owner.get(this.hashes[idx]);
  }

  // Replica set: next n DISTINCT physical nodes clockwise.
  getNodes(key, n) {
    const result = [];
    const len = this.hashes.length;
    const start = this.lowerBound(hash32(key));
    for (let step = 0; step < len && result.length < n; step++) {
      const node = this.owner.get(this.hashes[(start + step) % len]);
      if (!result.includes(node)) result.push(node);
    }
    return result;
  }
}

const ring = new ConsistentHashRing(100);
["cache-A", "cache-B", "cache-C"].forEach((n) => ring.addNode(n));

const keys = Array.from({ length: 10000 }, (_, i) => "user:" + i);
const before = new Map(keys.map((k) => [k, ring.getNode(k)]));
const counts = {};
for (const node of before.values()) counts[node] = (counts[node] || 0) + 1;
console.log("load:", counts);

ring.addNode("cache-D");
const moved = keys.filter((k) => ring.getNode(k) !== before.get(k)).length;
console.log("after adding cache-D, moved " + moved + " of " + keys.length + " keys (" +
  ((100 * moved) / keys.length).toFixed(1) + "%)");
console.log("replicas of user:42 ->", ring.getNodes("user:42", 3));`,
      go: String.raw`package main

import (
	"fmt"
	"slices"
	"sort"
	"strconv"
)

// hash32: FNV-1a (32-bit) followed by a murmur3-style finaliser for better spread.
func hash32(s string) uint32 {
	h := uint32(0x811C9DC5)
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= 0x01000193
	}
	h ^= h >> 16
	h *= 0x85EBCA6B
	h ^= h >> 13
	h *= 0xC2B2AE35
	h ^= h >> 16
	return h
}

type Ring struct {
	vnodes int
	hashes []uint32          // sorted positions on the ring
	owner  map[uint32]string // position -> physical node
}

func NewRing(vnodes int) *Ring {
	return &Ring{vnodes: vnodes, owner: make(map[uint32]string)}
}

// search returns the index of the first position >= h.
func (r *Ring) search(h uint32) int {
	return sort.Search(len(r.hashes), func(i int) bool { return r.hashes[i] >= h })
}

func (r *Ring) AddNode(node string) {
	for i := 0; i < r.vnodes; i++ {
		pos := hash32(node + "#" + strconv.Itoa(i))
		if _, taken := r.owner[pos]; taken {
			continue // rare collision: first owner keeps it
		}
		r.hashes = slices.Insert(r.hashes, r.search(pos), pos)
		r.owner[pos] = node
	}
}

func (r *Ring) RemoveNode(node string) {
	for i := 0; i < r.vnodes; i++ {
		pos := hash32(node + "#" + strconv.Itoa(i))
		if r.owner[pos] == node {
			delete(r.owner, pos)
			idx := r.search(pos)
			r.hashes = slices.Delete(r.hashes, idx, idx+1)
		}
	}
}

func (r *Ring) GetNode(key string) (string, bool) {
	if len(r.hashes) == 0 {
		return "", false
	}
	// First position clockwise; wrap to index 0 past the end.
	idx := r.search(hash32(key)) % len(r.hashes)
	return r.owner[r.hashes[idx]], true
}

// GetNodes returns the replica set: next n DISTINCT physical nodes clockwise.
func (r *Ring) GetNodes(key string, n int) []string {
	var result []string
	start := r.search(hash32(key))
	for step := 0; step < len(r.hashes) && len(result) < n; step++ {
		node := r.owner[r.hashes[(start+step)%len(r.hashes)]]
		if !slices.Contains(result, node) {
			result = append(result, node)
		}
	}
	return result
}

func main() {
	ring := NewRing(100)
	for _, n := range []string{"cache-A", "cache-B", "cache-C"} {
		ring.AddNode(n)
	}

	keys := make([]string, 10000)
	before := make(map[string]string)
	counts := make(map[string]int)
	for i := range keys {
		keys[i] = "user:" + strconv.Itoa(i)
		node, _ := ring.GetNode(keys[i])
		before[keys[i]] = node
		counts[node]++
	}
	fmt.Println("load:", counts) // fmt prints maps in sorted key order

	ring.AddNode("cache-D")
	moved := 0
	for _, k := range keys {
		if node, _ := ring.GetNode(k); node != before[k] {
			moved++
		}
	}
	fmt.Printf("after adding cache-D, moved %d of %d keys (%.1f%%)\n",
		moved, len(keys), 100*float64(moved)/float64(len(keys)))
	fmt.Println("replicas of user:42 ->", ring.GetNodes("user:42", 3))
}`,
    },
  },
  diagrams: {
    addNode: String.raw`flowchart LR
  subgraph Before["Before: 3 nodes"]
    direction LR
    C1[C] -->|"arc C..A: keys k3, k5"| A1[A]
    A1 -->|"arc A..B"| B1[B]
    B1 -->|"arc B..C"| C1
  end
  subgraph After["After adding D between C and A"]
    direction LR
    C2[C] -->|"arc C..D: k3 moves to D"| D2[D]
    D2 -->|"arc D..A: k5 stays on A"| A2[A]
    A2 --> B2[B]
    B2 --> C2
  end
  Before ==> After`,
    replication: String.raw`flowchart LR
  K(("key k")) -->|"walk clockwise"| V1["A vnode 17: coordinator"]
  V1 --> V2["A vnode 93: skip, same server"]
  V2 --> V3["C vnode 4: replica 2"]
  V3 --> V4["B vnode 61: replica 3"]
  V4 -.-> V5["D vnode 8: not needed"]`,
  },
});
