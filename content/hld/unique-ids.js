SD.register({
  id: "unique-ids",
  html: String.raw`
    <p class="lead">Every order, tweet, payment and message needs an ID. On one database, an auto-increment column is
    enough. Across hundreds of servers creating 100,000 records a second, you need IDs that are unique without a central
    bottleneck, ideally sortable by time and small enough to fit in 64 bits. This page walks through the options, from
    auto-increment to UUIDs to Twitter's Snowflake, and how to pick one in an interview.</p>

    <h2>Requirements first</h2>
    <p>Before choosing a scheme, pin down what the ID must do. A typical interview set:</p>
    <table>
      <thead><tr><th>Requirement</th><th>Why it matters</th></tr></thead>
      <tbody>
        <tr><td><strong>Globally unique</strong></td><td>Two servers must never hand out the same ID, even under failures.</td></tr>
        <tr><td><strong>Roughly sortable by time</strong></td><td>"Newest first" feeds and pagination can sort by ID alone. Inserts land at the end of a B-tree index, which keeps writes fast.</td></tr>
        <tr><td><strong>64-bit</strong></td><td>Fits in a <code>BIGINT</code>; indexes are half the size of 128-bit UUIDs, so more of them fit in RAM.</td></tr>
        <tr><td><strong>High throughput, low latency</strong></td><td>10k+ IDs/s per node, generated locally with no network hop.</td></tr>
        <tr><td><strong>Highly available</strong></td><td>ID generation must not be a single point of failure.</td></tr>
        <tr><td>Not guessable (sometimes)</td><td>Public IDs like <code>/invoice/1001</code> let attackers enumerate <code>/invoice/1002</code>.</td></tr>
      </tbody>
    </table>

    <h2>Option 1: database auto-increment</h2>
    <p>Let the database assign <code>1, 2, 3, ...</code>. Simple, compact, perfectly ordered.</p>
    <ul>
      <li><strong>Problem</strong>: one primary handles every insert; it is a write bottleneck and a single point of failure.</li>
      <li>Once you <strong>shard</strong>, each shard counts from 1, so IDs collide across shards.</li>
      <li>IDs leak business data: a competitor creating two orders a day apart learns your daily order volume.</li>
    </ul>
    <h3>Multi-master with a step</h3>
    <p>Run <em>k</em> database servers and give each a different starting offset with the same step <em>k</em>
    (MySQL <code>auto_increment_increment = k</code>, <code>auto_increment_offset = i</code>). With k = 3: server 1 gives
    1, 4, 7; server 2 gives 2, 5, 8; server 3 gives 3, 6, 9.</p>
    <ul>
      <li>Scales writes k times and survives one server dying.</li>
      <li>IDs are no longer time-ordered across servers (a busy server races ahead).</li>
      <li>Adding a server means changing the step everywhere: painful.</li>
    </ul>

    <h2>Option 2: UUID</h2>
    <p>A <strong>UUID</strong> is a 128-bit value, usually written as 36 characters like
    <code>3f2b8c1e-9d4a-4f7b-b6e2-1c0a5d9e7f31</code>. Every server makes them locally; no coordination at all.</p>
    <div class="grid-2">
      <div class="card"><strong>UUID v4 (random)</strong>
        <p>122 random bits. Collision odds are negligible: you would need about 2.7 quintillion IDs for a 50% chance of one collision.</p>
        <p><strong>Downside</strong>: completely random, so not sortable, and inserts land on random B-tree pages, causing page splits and cache misses. Write throughput on MySQL/InnoDB tables keyed by UUID v4 drops sharply as the table grows.</p>
      </div>
      <div class="card"><strong>UUID v7 (time-ordered, RFC 9562)</strong>
        <p>First 48 bits are the Unix time in milliseconds, the rest mostly random. Still 128 bits and coordination-free, but now sorts by creation time and appends to the index like a sequence.</p>
        <p>The modern default when 128 bits is acceptable. Postgres 18 has <code>uuidv7()</code> built in.</p>
      </div>
    </div>
    <p>Main UUID cost: 16 bytes instead of 8, in every primary key, every foreign key and every index entry.</p>

    <h2>Option 3: ticket server (Flickr)</h2>
    <p>Flickr centralised ID generation in a tiny dedicated MySQL database whose only job is to hand out numbers.</p>
    <pre><code>REPLACE INTO Tickets64 (stub) VALUES ('a');
SELECT LAST_INSERT_ID();</code></pre>
    <p>The table holds one row; each <code>REPLACE</code> bumps the auto-increment counter. For availability they ran
    <strong>two</strong> ticket servers, one giving odd and one giving even numbers (the step trick again), with
    clients round-robining between them.</p>
    <div data-diagram="ticket" data-caption="Two ticket servers hand out odd and even IDs; app servers batch-fetch ranges"></div>
    <ul>
      <li><strong>Pros</strong>: 64-bit numeric IDs, simple, works with any language.</li>
      <li><strong>Cons</strong>: a network hop per ID, and the ticket servers are a central dependency.</li>
      <li><strong>Improvement: range allocation</strong>. Each app server grabs a block of 1,000 IDs at a time (<code>UPDATE seq SET next = next + 1000</code>) and hands them out from memory. One DB call per 1,000 IDs. A crash only wastes the rest of a block. Many Indian fintechs use this "segment" approach (Meituan's open-source Leaf is a well-known implementation).</li>
    </ul>

    <h2>Option 4: Snowflake (Twitter)</h2>
    <p>Twitter needed tens of thousands of tweet IDs per second, sortable, 64-bit, with no coordination per ID. Snowflake
    packs three things into one 64-bit integer:</p>
    <figure class="svg-fig">
      <svg viewBox="0 0 760 170">
        <rect x="20" y="40" width="40" height="56" rx="10" class="s-box"/>
        <text x="40" y="74" class="s-text" text-anchor="middle">0</text>
        <rect x="64" y="40" width="380" height="56" rx="10" class="s-accent"/>
        <text x="254" y="74" class="s-text" text-anchor="middle">timestamp (ms since custom epoch)</text>
        <rect x="448" y="40" width="140" height="56" rx="10" class="s-green"/>
        <text x="518" y="74" class="s-text" text-anchor="middle">machine id</text>
        <rect x="592" y="40" width="148" height="56" rx="10" class="s-amber"/>
        <text x="666" y="74" class="s-text" text-anchor="middle">sequence</text>
        <text x="40" y="28" class="s-muted" text-anchor="middle">1 bit</text>
        <text x="254" y="28" class="s-muted" text-anchor="middle">41 bits</text>
        <text x="518" y="28" class="s-muted" text-anchor="middle">10 bits</text>
        <text x="666" y="28" class="s-muted" text-anchor="middle">12 bits</text>
        <text x="40" y="122" class="s-muted" text-anchor="middle">sign</text>
        <text x="254" y="122" class="s-muted" text-anchor="middle">2^41 ms ≈ 69.7 years</text>
        <text x="518" y="122" class="s-muted" text-anchor="middle">1,024 generators</text>
        <text x="666" y="122" class="s-muted" text-anchor="middle">4,096 IDs per ms</text>
        <text x="380" y="155" class="s-muted" text-anchor="middle">id = (ts &lt;&lt; 22) | (machine &lt;&lt; 12) | sequence</text>
      </svg>
      <figcaption>Snowflake bit layout. The timestamp sits in the high bits, so larger IDs are (roughly) newer.</figcaption>
    </figure>
    <ul>
      <li><strong>Sign bit (1)</strong>: always 0 so the ID stays positive in signed 64-bit types (Java <code>long</code>).</li>
      <li><strong>Timestamp (41)</strong>: milliseconds since a <strong>custom epoch</strong> (say 1 Jan 2024), not 1970. Starting from your own launch date gives you the full 69.7 years of range from that point.</li>
      <li><strong>Machine id (10)</strong>: unique per generator process. Often split as 5 bits datacenter + 5 bits worker.</li>
      <li><strong>Sequence (12)</strong>: a counter that resets every millisecond, so one generator can issue 4,096 IDs in the same ms.</li>
    </ul>
    <p>Try it: change the inputs and watch the bits.</p>
    <div data-widget="snowflake"></div>

    <h3>Capacity maths</h3>
    <ul>
      <li>Lifetime: 2<sup>41</sup> ms = 2,199,023,255,552 ms ≈ 69.7 years from the custom epoch.</li>
      <li>Per generator: 4,096 IDs/ms = about <strong>4.1 million IDs/s</strong>.</li>
      <li>Whole cluster: 1,024 generators x 4.1M ≈ <strong>4.2 billion IDs/s</strong>. Twitter peaks at hundreds of thousands of tweets/s, so there is plenty of headroom.</li>
      <li>Need more machines but fewer IDs per ms? Move bits: 13 machine bits + 9 sequence bits gives 8,192 machines at 512 IDs/ms each.</li>
    </ul>

    <h3>Assigning machine ids</h3>
    <p>Two generators with the same machine id <em>will</em> produce duplicates. Options: static config per host; a
    coordination service (ZooKeeper / etcd) where each instance claims a free id as an ephemeral node on startup;
    or derive it from the pod ordinal in a Kubernetes StatefulSet.</p>
    <div data-diagram="snowflakeArch" data-caption="Each service instance embeds a generator; only startup touches the coordinator"></div>

    <h3>Clock skew: the hard part</h3>
    <p>Snowflake trusts the local clock. NTP (network time protocol) sometimes moves the clock <em>backwards</em> to
    correct drift. If the clock goes from 1000 ms back to 995 ms, the generator could re-issue IDs it already gave out
    at 995–1000 ms. Handling:</p>
    <ol class="steps">
      <li>Remember <code>lastTimestamp</code>. If <code>now &lt; lastTimestamp</code>, the clock went backwards.</li>
      <li>Small drift (a few ms): wait (spin or sleep) until the clock catches up.</li>
      <li>Large drift: refuse to generate and raise an alert; take the node out of rotation. Never silently continue.</li>
      <li>Configure NTP to <strong>slew</strong> (gradually speed up or slow down the clock) instead of stepping it.</li>
    </ol>
    <p>Also: if 4,096 IDs are used up within one ms, the generator waits for the next millisecond (sequence rollover).</p>
    <div class="callout info"><strong>"Roughly" sortable</strong>IDs from different machines in the same millisecond are
    ordered by machine id, not by true creation order, and clocks on different machines differ by a few ms. That is
    fine for feeds and pagination ("k-sorted"), but do not use Snowflake IDs to decide which of two concurrent writes won.</div>

    <h3>Code: a thread-safe Snowflake generator</h3>
    <p>Custom epoch, sequence rollover (wait for next ms), and clock-backwards handling (tolerate up to 5 ms, otherwise
    fail loudly). The demo checks that 200,000 IDs generated concurrently are all unique.</p>
    <div data-code="snowflake"></div>

    <h2>Option 5: ULID</h2>
    <p>A <strong>ULID</strong> is 128 bits: 48-bit millisecond timestamp + 80 random bits, encoded as 26 characters of
    Crockford base32, like <code>01J0Z3K8M4X6Q2N9R7T5V1W3YB</code>. It sorts lexicographically by time as a string,
    is URL-safe and needs no coordination. It is essentially a friendlier-looking cousin of UUID v7, popular in
    JavaScript and Go ecosystems.</p>

    <h2>Comparison</h2>
    <table>
      <thead><tr><th>Scheme</th><th>Size</th><th>Sortable</th><th>Coordination</th><th>Throughput</th><th>Main drawback</th></tr></thead>
      <tbody>
        <tr><td>DB auto-increment</td><td>64-bit</td><td>Yes (strict)</td><td>Single DB</td><td>Limited by one primary</td><td>Bottleneck, SPOF, breaks with sharding</td></tr>
        <tr><td>Multi-master + step</td><td>64-bit</td><td>No (per server only)</td><td>Config</td><td>k x one DB</td><td>Hard to add servers</td></tr>
        <tr><td>UUID v4</td><td>128-bit</td><td>No</td><td>None</td><td>Unlimited</td><td>Big, random index inserts</td></tr>
        <tr><td>UUID v7 / ULID</td><td>128-bit</td><td>Yes (ms)</td><td>None</td><td>Unlimited</td><td>Twice the size of 64-bit</td></tr>
        <tr><td>Ticket server (+ ranges)</td><td>64-bit</td><td>Mostly</td><td>Central DB</td><td>High with batching</td><td>Central dependency</td></tr>
        <tr><td>Snowflake</td><td>64-bit</td><td>Yes (k-sorted)</td><td>Machine id only</td><td>4M/s per node</td><td>Clock skew, machine id management</td></tr>
      </tbody>
    </table>

    <h2>Real-world examples</h2>
    <ul>
      <li><strong>Twitter/X</strong>: Snowflake for tweet IDs; you can decode a tweet's creation time from its ID.</li>
      <li><strong>Discord</strong>: Snowflake with epoch 2015-01-01 for messages, users and channels.</li>
      <li><strong>Instagram</strong>: Snowflake-like IDs generated inside Postgres (41-bit time, 13-bit logical shard id, 10-bit per-shard sequence), so the shard is encoded in the ID itself.</li>
      <li><strong>Sony's Sonyflake</strong> and <strong>Baidu UidGenerator</strong>: variants with different bit splits.</li>
      <li><strong>Payments</strong> (Razorpay-style <code>pay_29QQoUBi66xm2f</code>): a type prefix plus a random/time-based base62 body, so IDs are self-describing and not enumerable.</li>
    </ul>

    <h2>Interview questions and pitfalls</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>"I want 64-bit, time-sortable IDs generated
    locally, so I'll use Snowflake: 41 bits of milliseconds from a custom epoch gives about 70 years, 10 bits of machine
    id gives 1,024 generators assigned via ZooKeeper at startup, and 12 bits of sequence gives 4,096 IDs per ms per node.
    If the clock moves backwards slightly I wait it out; if it jumps a lot I stop issuing and alert. If 128 bits were
    acceptable, UUID v7 would avoid the machine-id management entirely."</div>
    <ul>
      <li><strong>Pitfall</strong>: sending 64-bit IDs to JavaScript as numbers. JS numbers are exact only up to 2<sup>53</sup>, so the last digits get corrupted. Send them as strings (Twitter returns <code>id_str</code> for this reason).</li>
      <li><strong>Pitfall</strong>: reusing a machine id after a quick restart while the clock went backwards. Persist the last timestamp, or wait a few ms on startup.</li>
      <li><strong>Follow-up</strong>: "URL shortener IDs?" Short codes need a compact counter (ticket server ranges or Snowflake), then base62-encoded.</li>
    </ul>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>Why is UUID v4 a poor primary key for a large MySQL (InnoDB) table?</summary>
        <div>InnoDB clusters rows by primary key in a B-tree. Random keys insert into random pages, causing page splits, fragmentation and cache misses; and every secondary index carries the 16-byte key. Time-ordered keys (auto-increment, Snowflake, UUID v7) append at the end instead.</div></details>
      <details><summary>How many years does a 41-bit millisecond timestamp last, and why use a custom epoch?</summary>
        <div>2<sup>41</sup> ms ≈ 69.7 years. Counting from 1970 would waste 50+ years already gone; a custom epoch (your launch date) gives the full range from now.</div></details>
      <details><summary>What is the maximum ID rate of one Snowflake generator, and what happens when it is exceeded?</summary>
        <div>4,096 IDs per millisecond (12-bit sequence), about 4.1 million per second. When the sequence wraps within the same ms, the generator waits until the next millisecond.</div></details>
      <details><summary>The server clock jumps back 2 seconds. What should your Snowflake generator do?</summary>
        <div>Refuse to issue IDs (throw / return an error) and alert, because continuing could duplicate IDs issued in that 2-second window. For a drift of a few ms it can simply wait until the clock passes the last timestamp.</div></details>
      <details><summary>How does the ticket-server approach avoid a network call per ID?</summary>
        <div>Range (segment) allocation: each app server reserves a block, say 1,000 IDs, in one DB update and serves them from memory, fetching the next block when it runs low (often in the background).</div></details>
      <details><summary>Snowflake vs UUID v7: when would you choose each?</summary>
        <div>Snowflake when you need 64-bit IDs (compact indexes, numeric keys, existing BIGINT columns) and can manage machine ids. UUID v7 when 128 bits is fine and you want zero coordination; both are time-sortable.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>Start from requirements: unique, sortable, size, throughput, availability, guessability.</li>
      <li>Auto-increment does not scale past one primary; multi-master steps help but lose time ordering.</li>
      <li>UUID v4 is coordination-free but random and 128-bit; UUID v7 and ULID fix ordering.</li>
      <li>Ticket servers centralise numbering; range allocation removes the per-ID network hop.</li>
      <li>Snowflake = 1 + 41 + 10 + 12 bits: ~70 years, 1,024 nodes, 4,096 IDs/ms each, generated locally.</li>
      <li>Snowflake's weak spots are clock skew and machine id assignment; handle both explicitly.</li>
    </ul></div>
  `,
  code: {
    snowflake: {
      title: "Thread-safe Snowflake ID generator",
      java: String.raw`import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** 64-bit IDs: 1 sign | 41 timestamp ms | 10 machine | 12 sequence. */
public class Snowflake {
    private static final long EPOCH_MS = 1704067200000L; // 2024-01-01 00:00:00 UTC
    private static final int MACHINE_BITS = 10;
    private static final int SEQUENCE_BITS = 12;
    private static final long MAX_MACHINE_ID = (1L << MACHINE_BITS) - 1; // 1023
    private static final long MAX_SEQUENCE = (1L << SEQUENCE_BITS) - 1;  // 4095
    private static final int MACHINE_SHIFT = SEQUENCE_BITS;               // 12
    private static final int TIMESTAMP_SHIFT = SEQUENCE_BITS + MACHINE_BITS; // 22
    private static final long MAX_BACKWARD_MS = 5; // tolerate tiny NTP corrections

    private final long machineId;
    private long lastMs = -1L;
    private long sequence = 0L;

    public Snowflake(long machineId) {
        if (machineId < 0 || machineId > MAX_MACHINE_ID)
            throw new IllegalArgumentException("machineId must be in [0, 1023]");
        this.machineId = machineId;
    }

    public synchronized long nextId() {
        long now = System.currentTimeMillis();
        if (now < lastMs) { // clock moved backwards
            long drift = lastMs - now;
            if (drift > MAX_BACKWARD_MS)
                throw new IllegalStateException("clock moved back " + drift + " ms; refusing to issue IDs");
            now = waitUntilAfter(lastMs - 1); // wait it out
        }
        if (now == lastMs) {
            sequence = (sequence + 1) & MAX_SEQUENCE;
            if (sequence == 0) now = waitUntilAfter(lastMs); // 4096 IDs used this ms: next ms
        } else {
            sequence = 0;
        }
        lastMs = now;
        return ((now - EPOCH_MS) << TIMESTAMP_SHIFT) | (machineId << MACHINE_SHIFT) | sequence;
    }

    private static long waitUntilAfter(long ms) {
        long now = System.currentTimeMillis();
        while (now <= ms) now = System.currentTimeMillis();
        return now;
    }

    public static String parse(long id) {
        long ts = (id >> TIMESTAMP_SHIFT) + EPOCH_MS;
        long machine = (id >> MACHINE_SHIFT) & MAX_MACHINE_ID;
        long seq = id & MAX_SEQUENCE;
        return id + " -> time=" + ts + " machine=" + machine + " seq=" + seq;
    }

    public static void main(String[] args) throws InterruptedException {
        Snowflake gen = new Snowflake(42);
        for (int i = 0; i < 3; i++) System.out.println(parse(gen.nextId()));

        // 4 threads x 50,000 IDs: all must be unique.
        Set<Long> seen = ConcurrentHashMap.newKeySet();
        Thread[] threads = new Thread[4];
        for (int t = 0; t < threads.length; t++) {
            threads[t] = new Thread(() -> {
                for (int i = 0; i < 50_000; i++) seen.add(gen.nextId());
            });
            threads[t].start();
        }
        for (Thread t : threads) t.join();
        System.out.println("generated 200000 unique " + seen.size());
    }
}`,
      python: String.raw`import threading
import time


class Snowflake:
    """64-bit IDs: 1 sign | 41 timestamp ms | 10 machine | 12 sequence."""

    EPOCH_MS = 1704067200000  # custom epoch: 2024-01-01 00:00:00 UTC
    MACHINE_BITS = 10
    SEQUENCE_BITS = 12
    MAX_MACHINE_ID = (1 << MACHINE_BITS) - 1   # 1023
    MAX_SEQUENCE = (1 << SEQUENCE_BITS) - 1    # 4095
    MACHINE_SHIFT = SEQUENCE_BITS              # 12
    TIMESTAMP_SHIFT = SEQUENCE_BITS + MACHINE_BITS  # 22
    MAX_BACKWARD_MS = 5  # tolerate tiny NTP corrections by waiting

    def __init__(self, machine_id):
        if not 0 <= machine_id <= self.MAX_MACHINE_ID:
            raise ValueError("machine_id must be in [0, 1023]")
        self.machine_id = machine_id
        self.last_ms = -1
        self.sequence = 0
        self._lock = threading.Lock()

    @staticmethod
    def _now_ms():
        return time.time_ns() // 1_000_000

    def _wait_until_after(self, ms):
        now = self._now_ms()
        while now <= ms:
            now = self._now_ms()
        return now

    def next_id(self):
        with self._lock:
            now = self._now_ms()
            if now < self.last_ms:  # clock moved backwards
                drift = self.last_ms - now
                if drift > self.MAX_BACKWARD_MS:
                    raise RuntimeError(f"clock moved back {drift} ms; refusing to issue IDs")
                now = self._wait_until_after(self.last_ms - 1)  # wait it out
            if now == self.last_ms:
                self.sequence = (self.sequence + 1) & self.MAX_SEQUENCE
                if self.sequence == 0:  # 4096 IDs used this ms: wait for the next ms
                    now = self._wait_until_after(self.last_ms)
            else:
                self.sequence = 0
            self.last_ms = now
            return ((now - self.EPOCH_MS) << self.TIMESTAMP_SHIFT) \
                | (self.machine_id << self.MACHINE_SHIFT) | self.sequence

    @classmethod
    def parse(cls, id_):
        return {
            "timestamp_ms": (id_ >> cls.TIMESTAMP_SHIFT) + cls.EPOCH_MS,
            "machine_id": (id_ >> cls.MACHINE_SHIFT) & cls.MAX_MACHINE_ID,
            "sequence": id_ & cls.MAX_SEQUENCE,
        }


if __name__ == "__main__":
    gen = Snowflake(machine_id=42)
    for _ in range(3):
        i = gen.next_id()
        print(i, gen.parse(i))

    # 4 threads x 50,000 IDs: all must be unique.
    ids, ids_lock = [], threading.Lock()

    def work():
        local = [gen.next_id() for _ in range(50_000)]
        with ids_lock:
            ids.extend(local)

    threads = [threading.Thread(target=work) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    print("generated", len(ids), "unique", len(set(ids)))`,
      cpp: String.raw`#include <chrono>
#include <cstdint>
#include <iostream>
#include <mutex>
#include <stdexcept>
#include <string>
#include <thread>
#include <unordered_set>
#include <vector>

// 64-bit IDs: 1 sign | 41 timestamp ms | 10 machine | 12 sequence.
class Snowflake {
public:
    static constexpr int64_t kEpochMs = 1704067200000LL;  // 2024-01-01 00:00:00 UTC
    static constexpr int kMachineBits = 10;
    static constexpr int kSequenceBits = 12;
    static constexpr int64_t kMaxMachineId = (1LL << kMachineBits) - 1;  // 1023
    static constexpr int64_t kMaxSequence = (1LL << kSequenceBits) - 1;  // 4095
    static constexpr int kMachineShift = kSequenceBits;                  // 12
    static constexpr int kTimestampShift = kSequenceBits + kMachineBits;  // 22
    static constexpr int64_t kMaxBackwardMs = 5;  // tolerate tiny NTP corrections

    explicit Snowflake(int64_t machineId) : machineId_(machineId) {
        if (machineId < 0 || machineId > kMaxMachineId)
            throw std::invalid_argument("machineId must be in [0, 1023]");
    }

    int64_t nextId() {
        std::lock_guard<std::mutex> lock(mu_);
        int64_t now = nowMs();
        if (now < lastMs_) {  // clock moved backwards
            int64_t drift = lastMs_ - now;
            if (drift > kMaxBackwardMs)
                throw std::runtime_error("clock moved back " + std::to_string(drift) + " ms");
            now = waitUntilAfter(lastMs_ - 1);  // wait it out
        }
        if (now == lastMs_) {
            sequence_ = (sequence_ + 1) & kMaxSequence;
            if (sequence_ == 0) now = waitUntilAfter(lastMs_);  // 4096 used: next ms
        } else {
            sequence_ = 0;
        }
        lastMs_ = now;
        return ((now - kEpochMs) << kTimestampShift) | (machineId_ << kMachineShift) | sequence_;
    }

    static void parse(int64_t id) {
        std::cout << id << " -> time=" << ((id >> kTimestampShift) + kEpochMs)
                  << " machine=" << ((id >> kMachineShift) & kMaxMachineId)
                  << " seq=" << (id & kMaxSequence) << "\n";
    }

private:
    static int64_t nowMs() {
        using namespace std::chrono;
        return duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
    }
    static int64_t waitUntilAfter(int64_t ms) {
        int64_t now = nowMs();
        while (now <= ms) now = nowMs();
        return now;
    }

    const int64_t machineId_;
    int64_t lastMs_ = -1;
    int64_t sequence_ = 0;
    std::mutex mu_;
};

int main() {
    Snowflake gen(42);
    for (int i = 0; i < 3; ++i) Snowflake::parse(gen.nextId());

    // 4 threads x 50,000 IDs: all must be unique.
    std::vector<std::vector<int64_t>> perThread(4);
    std::vector<std::thread> threads;
    for (int t = 0; t < 4; ++t)
        threads.emplace_back([&gen, &perThread, t] {
            for (int i = 0; i < 50000; ++i) perThread[t].push_back(gen.nextId());
        });
    for (auto& th : threads) th.join();

    std::unordered_set<int64_t> unique;
    for (auto& v : perThread) unique.insert(v.begin(), v.end());
    std::cout << "generated 200000 unique " << unique.size() << "\n";
}`,
      javascript: String.raw`// 64-bit IDs: 1 sign | 41 timestamp ms | 10 machine | 12 sequence.
// Numbers lose precision above 2^53, so the ID is built with BigInt.
// JS runs one thread per event loop, so nextId() cannot be interleaved;
// with worker_threads, give each worker its own machineId.
class Snowflake {
  static EPOCH_MS = 1704067200000n; // 2024-01-01 00:00:00 UTC
  static MAX_MACHINE_ID = (1n << 10n) - 1n; // 1023 (10 bits)
  static MAX_SEQUENCE = (1n << 12n) - 1n; // 4095 (12 bits)
  static MACHINE_SHIFT = 12n;
  static TIMESTAMP_SHIFT = 22n;
  static MAX_BACKWARD_MS = 5n; // tolerate tiny NTP corrections

  constructor(machineId) {
    const id = BigInt(machineId);
    if (id < 0n || id > Snowflake.MAX_MACHINE_ID) throw new RangeError("machineId must be in [0, 1023]");
    this.machineId = id;
    this.lastMs = -1n;
    this.sequence = 0n;
  }

  static nowMs() {
    return BigInt(Date.now());
  }

  static waitUntilAfter(ms) {
    let now = Snowflake.nowMs();
    while (now <= ms) now = Snowflake.nowMs();
    return now;
  }

  nextId() {
    let now = Snowflake.nowMs();
    if (now < this.lastMs) { // clock moved backwards
      const drift = this.lastMs - now;
      if (drift > Snowflake.MAX_BACKWARD_MS) throw new Error("clock moved back " + drift + " ms");
      now = Snowflake.waitUntilAfter(this.lastMs - 1n); // wait it out
    }
    if (now === this.lastMs) {
      this.sequence = (this.sequence + 1n) & Snowflake.MAX_SEQUENCE;
      if (this.sequence === 0n) now = Snowflake.waitUntilAfter(this.lastMs); // 4096 used: next ms
    } else {
      this.sequence = 0n;
    }
    this.lastMs = now;
    return ((now - Snowflake.EPOCH_MS) << Snowflake.TIMESTAMP_SHIFT) |
      (this.machineId << Snowflake.MACHINE_SHIFT) | this.sequence;
  }

  static parse(id) {
    return {
      timestampMs: Number((id >> Snowflake.TIMESTAMP_SHIFT) + Snowflake.EPOCH_MS),
      machineId: Number((id >> Snowflake.MACHINE_SHIFT) & Snowflake.MAX_MACHINE_ID),
      sequence: Number(id & Snowflake.MAX_SEQUENCE),
    };
  }
}

const gen = new Snowflake(42);
for (let i = 0; i < 3; i++) {
  const id = gen.nextId();
  console.log(id.toString(), Snowflake.parse(id)); // send IDs to clients as strings
}
const ids = new Set();
for (let i = 0; i < 200000; i++) ids.add(gen.nextId());
console.log("generated 200000 unique", ids.size);`,
      go: String.raw`package main

import (
	"fmt"
	"sync"
	"time"
)

// 64-bit IDs: 1 sign | 41 timestamp ms | 10 machine | 12 sequence.
const (
	epochMs        int64 = 1704067200000 // 2024-01-01 00:00:00 UTC
	machineBits          = 10
	sequenceBits         = 12
	maxMachineID   int64 = 1<<machineBits - 1         // 1023
	maxSequence    int64 = 1<<sequenceBits - 1        // 4095
	machineShift         = sequenceBits               // 12
	timestampShift       = sequenceBits + machineBits // 22
	maxBackwardMs  int64 = 5                          // tolerate tiny NTP corrections
)

type Snowflake struct {
	mu        sync.Mutex
	machineID int64
	lastMs    int64
	sequence  int64
}

func NewSnowflake(machineID int64) (*Snowflake, error) {
	if machineID < 0 || machineID > maxMachineID {
		return nil, fmt.Errorf("machineID must be in [0, %d]", maxMachineID)
	}
	return &Snowflake{machineID: machineID, lastMs: -1}, nil
}

func nowMs() int64 { return time.Now().UnixMilli() }

func waitUntilAfter(ms int64) int64 {
	now := nowMs()
	for now <= ms {
		now = nowMs()
	}
	return now
}

func (s *Snowflake) NextID() (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := nowMs()
	if now < s.lastMs { // clock moved backwards
		drift := s.lastMs - now
		if drift > maxBackwardMs {
			return 0, fmt.Errorf("clock moved back %d ms; refusing to issue IDs", drift)
		}
		now = waitUntilAfter(s.lastMs - 1) // wait it out
	}
	if now == s.lastMs {
		s.sequence = (s.sequence + 1) & maxSequence
		if s.sequence == 0 { // 4096 IDs used this ms: wait for the next ms
			now = waitUntilAfter(s.lastMs)
		}
	} else {
		s.sequence = 0
	}
	s.lastMs = now
	return (now-epochMs)<<timestampShift | s.machineID<<machineShift | s.sequence, nil
}

func Parse(id int64) (timestampMs, machineID, sequence int64) {
	return id>>timestampShift + epochMs, id >> machineShift & maxMachineID, id & maxSequence
}

func main() {
	gen, err := NewSnowflake(42)
	if err != nil {
		panic(err)
	}
	for i := 0; i < 3; i++ {
		id, _ := gen.NextID()
		ts, m, seq := Parse(id)
		fmt.Printf("%d -> time=%d machine=%d seq=%d\n", id, ts, m, seq)
	}

	// 4 goroutines x 50,000 IDs: all must be unique.
	var (
		wg   sync.WaitGroup
		mu   sync.Mutex
		seen = make(map[int64]struct{})
	)
	for g := 0; g < 4; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			local := make([]int64, 0, 50000)
			for i := 0; i < 50000; i++ {
				id, err := gen.NextID()
				if err != nil {
					panic(err)
				}
				local = append(local, id)
			}
			mu.Lock()
			for _, id := range local {
				seen[id] = struct{}{}
			}
			mu.Unlock()
		}()
	}
	wg.Wait()
	fmt.Println("generated 200000 unique", len(seen))
}`,
    },
  },
  diagrams: {
    ticket: String.raw`flowchart LR
  A1[App server 1] --> T1["Ticket DB 1: odd IDs"]
  A1 --> T2["Ticket DB 2: even IDs"]
  A2[App server 2] --> T1
  A2 --> T2
  A3[App server 3] --> T1
  A3 --> T2`,
    snowflakeArch: String.raw`flowchart LR
  ZK[("ZooKeeper / etcd")]
  subgraph S1["Order service pod 1"]
    G1["Snowflake gen: machine 7"]
  end
  subgraph S2["Order service pod 2"]
    G2["Snowflake gen: machine 8"]
  end
  G1 -.->|"claim id at startup"| ZK
  G2 -.->|"claim id at startup"| ZK
  G1 --> DB[(Orders DB)]
  G2 --> DB`,
  },
});
