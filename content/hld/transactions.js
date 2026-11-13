SD.register({
  id: "transactions",
  html: String.raw`
    <p class="lead">A transaction groups several database operations into one all-or-nothing unit. When you send ₹500 on PhonePe, money must leave your account <em>and</em> arrive in the other one; never just one of the two. Transactions give you that guarantee, summed up as ACID. The hard part is concurrency: thousands of transactions run at once, and the <strong>isolation level</strong> decides which strange interleavings you can see. This page covers ACID, the five classic anomalies, isolation levels, MVCC, and how to choose between pessimistic and optimistic locking.</p>

    <h2>What a transaction is</h2>
    <p>A transaction starts with <code>BEGIN</code>, runs some reads and writes, and ends with either <code>COMMIT</code> (make everything permanent) or <code>ROLLBACK</code> (undo everything). Other sessions should see either all of it or none of it.</p>
    <pre><code>BEGIN;
UPDATE accounts SET balance = balance - 500 WHERE id = 'asha';
UPDATE accounts SET balance = balance + 500 WHERE id = 'ravi';
INSERT INTO ledger (from_id, to_id, amount) VALUES ('asha', 'ravi', 500);
COMMIT;</code></pre>
    <p>If the server crashes after the first <code>UPDATE</code>, the database undoes it on restart. If the application detects a problem (insufficient balance, a failed check), it issues <code>ROLLBACK</code>.</p>

    <h2>ACID with a bank transfer</h2>
    <p>Asha sends ₹500 to Ravi, both in the same bank's database.</p>
    <div class="grid-2">
      <div class="card"><strong>Atomicity</strong><p>All or nothing. Either the debit, the credit and the ledger row all happen, or none do. Implemented with an <strong>undo log</strong>: the database records old values so it can roll back a half-done transaction.</p></div>
      <div class="card"><strong>Consistency</strong><p>The transaction moves the database from one valid state to another. Rules such as "balance ≥ 0", foreign keys and unique constraints hold before and after. Total money in the system stays the same. Partly enforced by the database (constraints), partly by your code.</p></div>
      <div class="card"><strong>Isolation</strong><p>Concurrent transactions do not see each other's half-done work. Another transaction never sees ₹500 gone from Asha but not yet with Ravi. How strict this is depends on the isolation level.</p></div>
      <div class="card"><strong>Durability</strong><p>Once <code>COMMIT</code> returns, the data survives crashes and power loss. Implemented with a <strong>write-ahead log</strong> (WAL; InnoDB calls it the redo log) that is flushed to disk with <code>fsync</code> before the commit is acknowledged, and often replicated to another machine.</p></div>
    </div>
    <div class="callout info"><strong>Two different "C"s</strong>The C in ACID (valid state, constraints) is not the C in the CAP theorem (every replica returns the latest write). Do not mix them up in an interview.</div>
    <div class="callout warn"><strong>Real UPI spans systems</strong>A real UPI payment from an HDFC account to an SBI account touches two banks' databases and NPCI in between, so one database transaction cannot cover it. Across services you need distributed patterns (sagas, the outbox pattern, idempotency keys, reconciliation). ACID transactions are the building block <em>inside</em> each service.</div>

    <h2>Isolation anomalies</h2>
    <p>If transactions ran one after another (serially) there would be no problems, but that is far too slow. Running them concurrently allows these anomalies. Each diagram shows two transactions, T1 and T2, interleaving in time from top to bottom.</p>

    <h3>1. Dirty read</h3>
    <p>T2 reads data that T1 has written but not committed. If T1 rolls back, T2 acted on a value that never existed.</p>
    <div data-diagram="dirty" data-caption="Dirty read: T2 sees an uncommitted balance that is later rolled back."></div>

    <h3>2. Non-repeatable read</h3>
    <p>T1 reads the same row twice and gets different values, because T2 committed an update in between. A report that reads a balance at the start and end of a calculation gets inconsistent numbers.</p>
    <div data-diagram="nonrepeat" data-caption="Non-repeatable read: the same SELECT returns different values inside one transaction."></div>

    <h3>3. Phantom read</h3>
    <p>T1 runs a query with a condition twice, and the <em>set</em> of matching rows changes because T2 inserted (or deleted) a row that matches. A non-repeatable read is about one row changing; a phantom is about rows appearing or disappearing.</p>
    <div data-diagram="phantom" data-caption="Phantom: a new row matching T1's condition appears between two identical queries."></div>

    <h3>4. Lost update</h3>
    <p>Two transactions read the same value, both modify it in application code, and both write it back. The second write overwrites the first, and one update is silently lost. This is the classic stock counter bug.</p>
    <div data-diagram="lost" data-caption="Lost update: two buyers each read stock = 10 and write 9; the correct value is 8."></div>

    <h3>5. Write skew</h3>
    <p>Two transactions read the <em>same</em> data, make a decision based on it, and then write <em>different</em> rows. Neither overwrote the other, yet together they break a rule. Classic example: a hospital requires at least one doctor on call. Two doctors are on call; both feel ill and request leave at the same moment.</p>
    <div data-diagram="skew" data-caption="Write skew: each transaction sees two doctors on call and takes itself off; afterwards nobody is on call."></div>
    <p>The same pattern hits double-booking: two users both check "is meeting room 4 free at 3 pm?", both see yes, and both insert a booking row. No row was updated twice, so row locks on existing rows do not help.</p>

    <h2>Isolation levels</h2>
    <p>The SQL standard defines four levels. Higher levels prevent more anomalies but allow less concurrency (more blocking or more aborted transactions).</p>
    <table>
      <thead><tr><th>Level</th><th>Dirty read</th><th>Non-repeatable read</th><th>Phantom</th><th>Lost update</th><th>Write skew</th></tr></thead>
      <tbody>
        <tr><td>Read Uncommitted</td><td>Possible</td><td>Possible</td><td>Possible</td><td>Possible</td><td>Possible</td></tr>
        <tr><td>Read Committed</td><td>Prevented</td><td>Possible</td><td>Possible</td><td>Possible</td><td>Possible</td></tr>
        <tr><td>Repeatable Read</td><td>Prevented</td><td>Prevented</td><td>Possible by the standard; prevented for plain reads in Postgres and InnoDB</td><td>Postgres: prevented (aborts). MySQL: possible</td><td>Possible</td></tr>
        <tr><td>Serializable</td><td>Prevented</td><td>Prevented</td><td>Prevented</td><td>Prevented</td><td>Prevented</td></tr>
      </tbody>
    </table>
    <table>
      <thead><tr><th>Database</th><th>Default level</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td>PostgreSQL</td><td>Read Committed</td><td>Its Repeatable Read is <strong>snapshot isolation</strong>. Serializable uses SSI (Serializable Snapshot Isolation): it detects dangerous patterns and aborts one transaction with a serialization error, which you must retry.</td></tr>
        <tr><td>MySQL InnoDB</td><td>Repeatable Read</td><td>Plain <code>SELECT</code>s read a snapshot; locking reads and writes use the current row and <strong>next-key locks</strong> (a row lock plus a lock on the gap before it) to block phantom inserts. Serializable turns plain SELECTs into shared-locking reads.</td></tr>
        <tr><td>Oracle, SQL Server</td><td>Read Committed</td><td>Oracle's "Serializable" is actually snapshot isolation.</td></tr>
      </tbody>
    </table>
    <div class="callout tip"><strong>Snapshot isolation</strong>Each transaction reads from a consistent snapshot of the database taken when it started. It prevents dirty reads, non-repeatable reads and read phantoms, and Postgres also aborts lost updates under it. But it still allows <strong>write skew</strong>, because the two transactions write different rows and never conflict. Only true Serializable (or explicit locking) stops write skew.</div>

    <h2>MVCC: how databases avoid read locks</h2>
    <p><strong>Multi-Version Concurrency Control</strong> keeps several versions of a row instead of overwriting it. Writers create a new version; readers pick the version that was committed as of their snapshot. The big win: <em>readers never block writers and writers never block readers</em>.</p>
    <figure class="svg-fig">
      <svg viewBox="0 0 680 250">
        <text class="s-title" x="340" y="28" text-anchor="middle">Row: account 'asha'</text>
        <rect class="s-box" x="40" y="50" width="260" height="70" rx="10"/>
        <text class="s-text" x="170" y="78" text-anchor="middle">v1: balance = 1000</text>
        <text class="s-muted" x="170" y="102" text-anchor="middle">created by tx 100, ended by tx 105</text>
        <rect class="s-green" x="380" y="50" width="260" height="70" rx="10"/>
        <text class="s-text" x="510" y="78" text-anchor="middle">v2: balance = 500</text>
        <text class="s-muted" x="510" y="102" text-anchor="middle">created by tx 105 (committed)</text>
        <line class="s-line" x1="300" y1="85" x2="377" y2="85" marker-end="url(#arrow)"/>
        <rect class="s-amber" x="40" y="160" width="260" height="60" rx="10"/>
        <text class="s-text" x="170" y="186" text-anchor="middle">Tx 103 (snapshot before 105)</text>
        <text class="s-muted" x="170" y="206" text-anchor="middle">sees v1: 1000</text>
        <rect class="s-accent" x="380" y="160" width="260" height="60" rx="10"/>
        <text class="s-text" x="510" y="186" text-anchor="middle">Tx 110 (snapshot after 105)</text>
        <text class="s-muted" x="510" y="206" text-anchor="middle">sees v2: 500</text>
        <line class="s-dash" x1="170" y1="158" x2="170" y2="122"/>
        <line class="s-dash" x1="510" y1="158" x2="510" y2="122"/>
      </svg>
      <figcaption>MVCC: an update creates a new row version. Each transaction reads the newest version committed before its snapshot, so old readers keep a stable view without locking.</figcaption>
    </figure>
    <ul>
      <li><strong>PostgreSQL</strong> stores every version in the table itself, tagged with <code>xmin</code> (creating transaction) and <code>xmax</code> (deleting transaction). <code>VACUUM</code> later removes versions no transaction can see.</li>
      <li><strong>MySQL InnoDB</strong> updates the row in place and keeps older versions in the <strong>undo log</strong>; readers rebuild the old version by following undo records. A purge thread cleans up.</li>
      <li><strong>When the snapshot is taken</strong>: at Read Committed, each <em>statement</em> gets a fresh snapshot (hence non-repeatable reads). At Repeatable Read, the whole <em>transaction</em> uses one snapshot.</li>
    </ul>
    <div class="callout warn"><strong>Long transactions hurt</strong>A transaction left open for an hour (a forgotten session, a slow batch job) forces the database to keep every old version since it started. Postgres tables bloat and InnoDB's undo log grows ("history list length"), slowing everyone. Keep transactions short.</div>

    <h2>Locking: pessimistic vs optimistic</h2>
    <p>MVCC handles reads, but two writers changing the same data still need coordination. There are two philosophies.</p>
    <div class="tabs">
      <section data-tab="Pessimistic">
        <p>Assume conflicts will happen, so lock first. <code>SELECT ... FOR UPDATE</code> takes an exclusive row lock; other transactions that try to lock or update the same row wait until you commit.</p>
        <pre><code>BEGIN;
SELECT stock FROM inventory WHERE sku = 'IPHONE16' FOR UPDATE;  -- others wait here
-- app checks stock &gt; 0
UPDATE inventory SET stock = stock - 1 WHERE sku = 'IPHONE16';
COMMIT;  -- lock released</code></pre>
        <p><strong>Good</strong>: no wasted work; simple to reason about. <strong>Bad</strong>: waiting threads hold DB connections; risk of deadlocks; slow if the lock is held across network calls. Variants: <code>FOR SHARE</code> (shared lock), <code>NOWAIT</code> (fail immediately) and <code>SKIP LOCKED</code> (skip rows others hold: great for job queues).</p>
      </section>
      <section data-tab="Optimistic">
        <p>Assume conflicts are rare, so do not lock. Read the row with a <strong>version</strong> number, compute, and write back only if the version is unchanged (compare-and-set). If another transaction got there first, zero rows are updated: re-read and retry.</p>
        <pre><code>SELECT seat_status, version FROM seats WHERE show_id = 7 AND seat_no = 'F12';
-- returns AVAILABLE, version 3
UPDATE seats SET seat_status = 'HELD', held_by = 'u42', version = 4
WHERE show_id = 7 AND seat_no = 'F12' AND version = 3;
-- 1 row updated: you won. 0 rows: someone else won, show "seat taken"</code></pre>
        <p><strong>Good</strong>: no locks held, no deadlocks, works across HTTP requests (JPA's <code>@Version</code>, DynamoDB conditional writes, etcd/Redis <code>WATCH</code>). <strong>Bad</strong>: under heavy contention most attempts fail and retry, wasting work.</p>
      </section>
      <section data-tab="Atomic update">
        <p>Often the best answer is neither: push the check into a single conditional statement, and let the database's own row lock do the work for a few microseconds.</p>
        <pre><code>UPDATE inventory SET stock = stock - 1
WHERE sku = 'IPHONE16' AND stock &gt; 0;
-- 1 row updated: order placed. 0 rows: sold out.</code></pre>
        <p>No read-modify-write in the app, no lost update, no retry loop. Works at any isolation level because the UPDATE always reads the latest committed row.</p>
      </section>
    </div>
    <div data-diagram="occ" data-caption="Optimistic concurrency: both read version 3; the first commit bumps it to 4, so the second UPDATE matches 0 rows and must retry."></div>

    <h3>When to use which</h3>
    <table>
      <thead><tr><th>Scenario</th><th>Contention</th><th>Good choice</th><th>Why</th></tr></thead>
      <tbody>
        <tr><td>Flipkart Big Billion Days: 50,000 buyers hit "Buy" on one phone SKU at 12:00</td><td>Very high on one row</td><td>Atomic conditional UPDATE (or short pessimistic lock); often a Redis counter or queue in front to shed load</td><td>With optimistic locking, only one of thousands of concurrent attempts wins each round; the rest retry and hammer the DB (a retry storm)</td></tr>
        <tr><td>BookMyShow: users pick specific seats for a show</td><td>Low per seat (few people want the exact same seat at the same second)</td><td>Optimistic: conditional update from AVAILABLE to HELD with a 10-minute <code>held_until</code></td><td>Conflicts are rare and the loser just sees "seat taken"; no locks are held while the user pays</td></tr>
        <tr><td>Moving money between two accounts</td><td>Medium</td><td>Pessimistic <code>FOR UPDATE</code> on both rows in a fixed order, or Serializable with retry</td><td>Correctness matters more than throughput; locking in id order prevents deadlocks</td></tr>
        <tr><td>Editing a wiki page or a user profile form</td><td>Low, long think time</td><td>Optimistic with a version column</td><td>You cannot hold a DB lock while a human types for 5 minutes</td></tr>
      </tbody>
    </table>
    <div class="callout tip"><strong>Rule of thumb</strong>Low contention or long think time: optimistic. High contention on a hot row: pessimistic or a single atomic statement. Never hold a database lock across a network call to a payment gateway or another service.</div>

    <h3>Code: optimistic concurrency control</h3>
    <p>An in-memory accounts table with a version per row. <code>transfer()</code> reads both rows and their versions without locking, then commits both writes only if neither version changed; otherwise it re-reads and retries. Eight threads (goroutines in Go, async workers in JavaScript) run thousands of random transfers at once. The conflict count varies run to run, but the total money is always conserved. Remove the version check and the total drifts.</p>
    <div data-code="occ"></div>

    <h2>Deadlocks</h2>
    <p>A <strong>deadlock</strong> happens when two transactions each hold a lock the other needs. T1 transfers Asha → Ravi and locks Asha's row first; at the same time T2 transfers Ravi → Asha and locks Ravi's row first. Now each waits for the other forever.</p>
    <div data-diagram="deadlock" data-caption="Deadlock: T1 holds A and wants B; T2 holds B and wants A. The database detects the cycle and aborts one."></div>
    <ul>
      <li><strong>Detection</strong>: databases build a "waits-for" graph and look for cycles. InnoDB detects them immediately and rolls back the transaction that has done the least work; Postgres checks after <code>deadlock_timeout</code> (1 second by default). The victim gets an error and should <strong>retry</strong>.</li>
      <li><strong>Prevention</strong>: always lock rows in a consistent order (for transfers, lock the smaller account id first), keep transactions short, touch as few rows as possible, and set lock timeouts.</li>
    </ul>

    <h2>Real-world examples</h2>
    <ul>
      <li><strong>Razorpay / PhonePe ledgers</strong>: double-entry ledger rows (one debit, one credit) written in one transaction, so the sum of all entries is always zero. Payment state changes use conditional updates (<code>WHERE status = 'PENDING'</code>) so a callback processed twice does nothing the second time.</li>
      <li><strong>Flipkart inventory</strong>: atomic decrements with a <code>stock &gt; 0</code> guard; reservation rows with expiry when a user enters checkout.</li>
      <li><strong>BookMyShow</strong>: seat holds with a TTL, released by a background job or on payment failure.</li>
      <li><strong>Job queues in Postgres</strong>: workers use <code>SELECT ... FOR UPDATE SKIP LOCKED LIMIT 10</code> so each picks different jobs without blocking.</li>
    </ul>

    <h2>Common interview questions and pitfalls</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"Placing an order decrements stock with <code>UPDATE ... SET stock = stock - 1 WHERE id = ? AND stock &gt; 0</code> and checks the affected row count. It is atomic, so two buyers can never both take the last unit."</li>
        <li>"For seat booking I'll use optimistic locking: a conditional update from AVAILABLE to HELD with an expiry. Conflicts are rare, and the loser gets a clear 'seat taken' message."</li>
        <li>"Postgres defaults to Read Committed, which allows lost updates and write skew, so for the transfer I'll lock both rows with <code>FOR UPDATE</code> in id order or run it as Serializable and retry on serialization failures."</li>
        <li>"I'll keep transactions short and never call external services inside one."</li>
      </ul>
    </div>
    <div class="callout warn"><strong>Pitfalls</strong>Reading a value, changing it in code and writing it back without a lock or version check (lost update); assuming Repeatable Read prevents write skew; holding locks while waiting on a payment gateway; not retrying on deadlock or serialization errors; thinking a single-database transaction can span microservices.</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>Explain the four letters of ACID using a money transfer.</summary><div><strong>Atomicity</strong>: debit and credit both happen or neither does (undo log). <strong>Consistency</strong>: constraints such as balance ≥ 0 hold and total money is unchanged. <strong>Isolation</strong>: other transactions never see the money missing from one account but not yet in the other. <strong>Durability</strong>: once committed, the transfer survives a crash (WAL flushed to disk).</div></details>
      <details><summary>What is the difference between a non-repeatable read and a phantom read?</summary><div>A non-repeatable read is the <em>same row</em> returning a different value when read twice. A phantom is the <em>set of rows</em> matching a condition changing (rows inserted or deleted by another transaction) between two identical queries.</div></details>
      <details><summary>Two doctors both go off call at the same moment, leaving nobody on call, even under snapshot isolation. What anomaly is this and how do you prevent it?</summary><div>Write skew: both read the same rows, decide based on them, and write different rows. Prevent it with Serializable isolation (Postgres SSI aborts one), or by explicitly locking the rows read (<code>SELECT ... FOR UPDATE</code> on all on-call doctors for that shift), or by turning the rule into a constraint.</div></details>
      <details><summary>What are the default isolation levels of PostgreSQL and MySQL InnoDB?</summary><div>PostgreSQL: Read Committed. MySQL InnoDB: Repeatable Read (with next-key locks for locking reads and writes).</div></details>
      <details><summary>Why is optimistic locking a poor fit for a flash-sale stock counter, but a good fit for seat booking?</summary><div>In a flash sale thousands of requests hit the same row at once; with optimistic locking only one wins each round and the rest retry, multiplying load. An atomic conditional UPDATE or a short lock serialises them cheaply. In seat booking each seat is wanted by few people at the same instant, so conflicts are rare, retries are cheap, and no locks are held while the user pays.</div></details>
      <details><summary>How does a database resolve a deadlock, and how do you avoid one in a transfer service?</summary><div>It detects a cycle in the waits-for graph and aborts one transaction (the victim), which should retry. Avoid it by always acquiring row locks in the same order, for example lock the lower account id first, and by keeping transactions short.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>A transaction is all-or-nothing; ACID = undo log (A), constraints (C), isolation level (I), WAL with fsync (D).</li>
      <li>Know the five anomalies: dirty read, non-repeatable read, phantom, lost update, write skew.</li>
      <li>Isolation levels trade safety for concurrency; Postgres defaults to Read Committed, MySQL InnoDB to Repeatable Read; only Serializable stops write skew.</li>
      <li>MVCC keeps row versions so reads never block writes; long transactions cause bloat.</li>
      <li>Pessimistic (<code>FOR UPDATE</code>) for hot rows and money; optimistic (version column) for low contention and long think time; atomic conditional UPDATE for counters.</li>
      <li>Prevent deadlocks with consistent lock ordering and short transactions; always retry on deadlock and serialization errors.</li>
    </ul></div>
  `,
  code: {
    occ: {
      title: "Optimistic concurrency control: versioned rows, compare-and-set commit, retry loop",
      java: String.raw`import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    record Row(long balance, long version) {}

    /** One intended write: "set balance, but only if the row is still at expectedVersion". */
    record Write(String id, long expectedVersion, long newBalance) {}

    /** In-memory table of versioned rows. Each method is atomic (like one SQL statement). */
    static class AccountStore {
        private final Map<String, Row> rows = new HashMap<>();

        synchronized void create(String id, long balance) { rows.put(id, new Row(balance, 0)); }

        synchronized Row read(String id) { return rows.get(id); }

        /** Validate every version, then apply all writes, or apply nothing. */
        synchronized boolean commit(List<Write> writes) {
            for (Write w : writes) {
                if (rows.get(w.id()).version() != w.expectedVersion()) return false; // someone else won
            }
            for (Write w : writes) rows.put(w.id(), new Row(w.newBalance(), w.expectedVersion() + 1));
            return true;
        }

        synchronized long total() {
            return rows.values().stream().mapToLong(Row::balance).sum();
        }
    }

    static final AtomicInteger conflicts = new AtomicInteger();

    /** Optimistic transfer: read without locks, commit only if nothing changed, else retry. */
    static boolean transfer(AccountStore db, String from, String to, long amount) {
        while (true) {
            Row a = db.read(from);
            Row b = db.read(to);
            if (a.balance() < amount) return false;          // business rule: no overdraft
            Thread.yield();                                   // widen the race window for the demo
            boolean ok = db.commit(List.of(
                    new Write(from, a.version(), a.balance() - amount),
                    new Write(to, b.version(), b.balance() + amount)));
            if (ok) return true;
            conflicts.incrementAndGet();                      // stale read: re-read and retry
        }
    }

    public static void main(String[] args) throws InterruptedException {
        AccountStore db = new AccountStore();
        String[] ids = {"asha", "ravi", "meera", "kabir"};
        for (String id : ids) db.create(id, 1000);
        System.out.println("total before: " + db.total());

        AtomicInteger done = new AtomicInteger();
        Thread[] workers = new Thread[8];
        for (int t = 0; t < workers.length; t++) {
            final int seed = t;
            workers[t] = new Thread(() -> {
                Random rnd = new Random(seed);
                for (int i = 0; i < 2000; i++) {
                    String from = ids[rnd.nextInt(ids.length)];
                    String to = ids[rnd.nextInt(ids.length)];
                    if (from.equals(to)) continue;
                    if (transfer(db, from, to, 1 + rnd.nextInt(50))) done.incrementAndGet();
                }
            });
            workers[t].start();
        }
        for (Thread w : workers) w.join();

        System.out.println("total after:  " + db.total() + " (money conserved: " + (db.total() == 4000) + ")");
        System.out.println("transfers committed: " + done.get() + ", conflicts retried: " + conflicts.get());
    }
}
`,
      python: String.raw`import random
import threading
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class Row:
    balance: int
    version: int


class AccountStore:
    """In-memory table of versioned rows. Each method is atomic (like one SQL statement)."""

    def __init__(self):
        self._rows = {}
        self._lock = threading.Lock()

    def create(self, account_id, balance):
        with self._lock:
            self._rows[account_id] = Row(balance, 0)

    def read(self, account_id):
        with self._lock:
            return self._rows[account_id]

    def commit(self, writes):
        """writes: list of (id, expected_version, new_balance). All apply or none."""
        with self._lock:
            if any(self._rows[i].version != v for i, v, _ in writes):
                return False  # someone else committed first
            for i, v, bal in writes:
                self._rows[i] = Row(bal, v + 1)
            return True

    def total(self):
        with self._lock:
            return sum(r.balance for r in self._rows.values())


conflicts = 0
counter_lock = threading.Lock()


def transfer(db, src, dst, amount):
    """Optimistic transfer: read without locks, commit only if nothing changed, else retry."""
    global conflicts
    while True:
        a, b = db.read(src), db.read(dst)
        if a.balance < amount:
            return False                      # business rule: no overdraft
        time.sleep(0)                         # yield to other threads: widen the race window
        if db.commit([(src, a.version, a.balance - amount),
                      (dst, b.version, b.balance + amount)]):
            return True
        with counter_lock:
            conflicts += 1                    # stale read: re-read and retry


def worker(db, ids, seed, done):
    rnd = random.Random(seed)
    for _ in range(2000):
        src, dst = rnd.choice(ids), rnd.choice(ids)
        if src != dst and transfer(db, src, dst, rnd.randint(1, 50)):
            done.append(1)  # list.append is thread-safe in CPython


if __name__ == "__main__":
    db = AccountStore()
    ids = ["asha", "ravi", "meera", "kabir"]
    for i in ids:
        db.create(i, 1000)
    print("total before:", db.total())

    done = []
    threads = [threading.Thread(target=worker, args=(db, ids, s, done)) for s in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    print(f"total after:  {db.total()} (money conserved: {db.total() == 4000})")
    print(f"transfers committed: {len(done)}, conflicts retried: {conflicts}")
`,
      cpp: String.raw`#include <atomic>
#include <iostream>
#include <mutex>
#include <random>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

struct Row {
    long balance;
    long version;
};

// One intended write: "set balance, but only if the row is still at expectedVersion".
struct Write {
    std::string id;
    long expectedVersion;
    long newBalance;
};

// In-memory table of versioned rows. Each method is atomic (like one SQL statement).
class AccountStore {
public:
    void create(const std::string& id, long balance) {
        std::lock_guard<std::mutex> g(mu_);
        rows_[id] = {balance, 0};
    }
    Row read(const std::string& id) {
        std::lock_guard<std::mutex> g(mu_);
        return rows_.at(id);
    }
    // Validate every version, then apply all writes, or apply nothing.
    bool commit(const std::vector<Write>& writes) {
        std::lock_guard<std::mutex> g(mu_);
        for (const auto& w : writes)
            if (rows_.at(w.id).version != w.expectedVersion) return false;  // someone else won
        for (const auto& w : writes) rows_[w.id] = {w.newBalance, w.expectedVersion + 1};
        return true;
    }
    long total() {
        std::lock_guard<std::mutex> g(mu_);
        long sum = 0;
        for (const auto& [id, row] : rows_) sum += row.balance;
        return sum;
    }

private:
    std::mutex mu_;
    std::unordered_map<std::string, Row> rows_;
};

std::atomic<int> conflicts{0};

// Optimistic transfer: read without locks, commit only if nothing changed, else retry.
bool transfer(AccountStore& db, const std::string& from, const std::string& to, long amount) {
    while (true) {
        Row a = db.read(from);
        Row b = db.read(to);
        if (a.balance < amount) return false;     // business rule: no overdraft
        std::this_thread::yield();                // widen the race window for the demo
        if (db.commit({{from, a.version, a.balance - amount}, {to, b.version, b.balance + amount}}))
            return true;
        ++conflicts;                              // stale read: re-read and retry
    }
}

int main() {
    AccountStore db;
    const std::vector<std::string> ids = {"asha", "ravi", "meera", "kabir"};
    for (const auto& id : ids) db.create(id, 1000);
    std::cout << "total before: " << db.total() << "\n";

    std::atomic<int> done{0};
    std::vector<std::thread> workers;
    for (int t = 0; t < 8; ++t) {
        workers.emplace_back([&, t] {
            std::mt19937 rnd(t);
            std::uniform_int_distribution<int> pick(0, 3), amt(1, 50);
            for (int i = 0; i < 2000; ++i) {
                const auto& from = ids[pick(rnd)];
                const auto& to = ids[pick(rnd)];
                if (from != to && transfer(db, from, to, amt(rnd))) ++done;
            }
        });
    }
    for (auto& w : workers) w.join();

    std::cout << "total after:  " << db.total() << " (money conserved: "
              << (db.total() == 4000 ? "true" : "false") << ")\n";
    std::cout << "transfers committed: " << done << ", conflicts retried: " << conflicts << "\n";
}
`,
      javascript: String.raw`// JavaScript runs one piece of code at a time, so we simulate concurrency with async
// "workers" that pause (await) between reading and committing, letting others interleave.

class AccountStore {
  constructor() { this.rows = new Map(); }

  create(id, balance) { this.rows.set(id, { balance, version: 0 }); }

  read(id) { return { ...this.rows.get(id) }; } // a snapshot copy, like a SELECT

  // writes: [{ id, expectedVersion, newBalance }]. All apply or none.
  commit(writes) {
    if (writes.some((w) => this.rows.get(w.id).version !== w.expectedVersion)) return false;
    for (const w of writes) this.rows.set(w.id, { balance: w.newBalance, version: w.expectedVersion + 1 });
    return true;
  }

  total() { let s = 0; for (const r of this.rows.values()) s += r.balance; return s; }
}

const pause = () => new Promise((resolve) => setTimeout(resolve, Math.random() < 0.5 ? 0 : 1));
let conflicts = 0;

// Optimistic transfer: read without locks, commit only if nothing changed, else retry.
async function transfer(db, from, to, amount) {
  for (;;) {
    const a = db.read(from);
    const b = db.read(to);
    if (a.balance < amount) return false;   // business rule: no overdraft
    await pause();                          // other workers run here: the race window
    const ok = db.commit([
      { id: from, expectedVersion: a.version, newBalance: a.balance - amount },
      { id: to, expectedVersion: b.version, newBalance: b.balance + amount },
    ]);
    if (ok) return true;
    conflicts++;                            // stale read: re-read and retry
  }
}

async function worker(db, ids, counter) {
  for (let i = 0; i < 200; i++) {
    const from = ids[Math.floor(Math.random() * ids.length)];
    const to = ids[Math.floor(Math.random() * ids.length)];
    if (from !== to && (await transfer(db, from, to, 1 + Math.floor(Math.random() * 50)))) counter.done++;
  }
}

async function main() {
  const db = new AccountStore();
  const ids = ["asha", "ravi", "meera", "kabir"];
  ids.forEach((id) => db.create(id, 1000));
  console.log("total before: " + db.total());

  const counter = { done: 0 };
  await Promise.all(Array.from({ length: 8 }, () => worker(db, ids, counter)));

  console.log("total after:  " + db.total() + " (money conserved: " + (db.total() === 4000) + ")");
  console.log("transfers committed: " + counter.done + ", conflicts retried: " + conflicts);
}

main();
`,
      go: String.raw`package main

import (
	"fmt"
	"math/rand"
	"runtime"
	"sync"
	"sync/atomic"
)

type Row struct {
	Balance int64
	Version int64
}

// Write means "set balance, but only if the row is still at ExpectedVersion".
type Write struct {
	ID              string
	ExpectedVersion int64
	NewBalance      int64
}

// AccountStore is an in-memory table of versioned rows. Each method is atomic.
type AccountStore struct {
	mu   sync.Mutex
	rows map[string]Row
}

func (s *AccountStore) Create(id string, balance int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.rows[id] = Row{Balance: balance}
}

func (s *AccountStore) Read(id string) Row {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.rows[id]
}

// Commit validates every version, then applies all writes, or applies nothing.
func (s *AccountStore) Commit(writes []Write) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, w := range writes {
		if s.rows[w.ID].Version != w.ExpectedVersion {
			return false // someone else committed first
		}
	}
	for _, w := range writes {
		s.rows[w.ID] = Row{Balance: w.NewBalance, Version: w.ExpectedVersion + 1}
	}
	return true
}

func (s *AccountStore) Total() int64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	var sum int64
	for _, r := range s.rows {
		sum += r.Balance
	}
	return sum
}

var conflicts atomic.Int64

// transfer is optimistic: read without locks, commit only if nothing changed, else retry.
func transfer(db *AccountStore, from, to string, amount int64) bool {
	for {
		a, b := db.Read(from), db.Read(to)
		if a.Balance < amount {
			return false // business rule: no overdraft
		}
		runtime.Gosched() // widen the race window for the demo
		if db.Commit([]Write{
			{from, a.Version, a.Balance - amount},
			{to, b.Version, b.Balance + amount},
		}) {
			return true
		}
		conflicts.Add(1) // stale read: re-read and retry
	}
}

func main() {
	db := &AccountStore{rows: map[string]Row{}}
	ids := []string{"asha", "ravi", "meera", "kabir"}
	for _, id := range ids {
		db.Create(id, 1000)
	}
	fmt.Println("total before:", db.Total())

	var done atomic.Int64
	var wg sync.WaitGroup
	for t := 0; t < 8; t++ {
		wg.Add(1)
		go func(seed int64) {
			defer wg.Done()
			rnd := rand.New(rand.NewSource(seed))
			for i := 0; i < 2000; i++ {
				from, to := ids[rnd.Intn(len(ids))], ids[rnd.Intn(len(ids))]
				if from != to && transfer(db, from, to, 1+rnd.Int63n(50)) {
					done.Add(1)
				}
			}
		}(int64(t))
	}
	wg.Wait()

	fmt.Printf("total after:  %d (money conserved: %v)\n", db.Total(), db.Total() == 4000)
	fmt.Printf("transfers committed: %d, conflicts retried: %d\n", done.Load(), conflicts.Load())
}
`,
    },
  },
  diagrams: {
    dirty: String.raw`sequenceDiagram
      participant T1
      participant DB as Database
      participant T2
      T1->>DB: UPDATE balance = 500 (was 1000)
      T2->>DB: SELECT balance
      DB-->>T2: 500 (uncommitted!)
      T1->>DB: ROLLBACK
      Note over T2: T2 acted on 500, but the real balance is 1000`,
    nonrepeat: String.raw`sequenceDiagram
      participant T1
      participant DB as Database
      participant T2
      T1->>DB: SELECT balance
      DB-->>T1: 1000
      T2->>DB: UPDATE balance = 500
      T2->>DB: COMMIT
      T1->>DB: SELECT balance
      DB-->>T1: 500 (changed within T1)`,
    phantom: String.raw`sequenceDiagram
      participant T1
      participant DB as Database
      participant T2
      T1->>DB: SELECT COUNT(*) FROM bookings WHERE show = 7
      DB-->>T1: 3
      T2->>DB: INSERT booking for show 7
      T2->>DB: COMMIT
      T1->>DB: SELECT COUNT(*) FROM bookings WHERE show = 7
      DB-->>T1: 4 (a phantom row appeared)`,
    lost: String.raw`sequenceDiagram
      participant T1
      participant DB as Database
      participant T2
      T1->>DB: SELECT stock
      DB-->>T1: 10
      T2->>DB: SELECT stock
      DB-->>T2: 10
      T1->>DB: UPDATE stock = 9
      T1->>DB: COMMIT
      T2->>DB: UPDATE stock = 9
      T2->>DB: COMMIT
      Note over DB: stock = 9, but two units were sold`,
    skew: String.raw`sequenceDiagram
      participant T1 as T1 (Dr Rao)
      participant DB as Database
      participant T2 as T2 (Dr Iyer)
      T1->>DB: SELECT COUNT(*) on call
      DB-->>T1: 2, so I can leave
      T2->>DB: SELECT COUNT(*) on call
      DB-->>T2: 2, so I can leave
      T1->>DB: UPDATE Rao SET on_call = false
      T2->>DB: UPDATE Iyer SET on_call = false
      T1->>DB: COMMIT
      T2->>DB: COMMIT
      Note over DB: 0 doctors on call, the rule is broken`,
    occ: String.raw`sequenceDiagram
      participant A as User A
      participant DB as Database
      participant B as User B
      A->>DB: SELECT status, version (AVAILABLE, 3)
      B->>DB: SELECT status, version (AVAILABLE, 3)
      A->>DB: UPDATE ... SET HELD, version 4 WHERE version = 3
      DB-->>A: 1 row updated, seat held
      B->>DB: UPDATE ... SET HELD, version 4 WHERE version = 3
      DB-->>B: 0 rows updated
      Note over B: Re-read: seat taken, pick another`,
    deadlock: String.raw`sequenceDiagram
      participant T1
      participant DB as Database
      participant T2
      T1->>DB: lock row Asha
      T2->>DB: lock row Ravi
      T1->>DB: lock row Ravi (waits for T2)
      T2->>DB: lock row Asha (waits for T1)
      Note over DB: Cycle detected
      DB-->>T2: ERROR deadlock, rolled back
      DB-->>T1: lock granted, continues`,
  },
});
