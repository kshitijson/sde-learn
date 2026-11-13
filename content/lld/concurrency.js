SD.register({
  id: "concurrency",
  html: String.raw`
    <p class="lead">Concurrency means several pieces of work make progress at the same time and share some state: two users booking the last seat, four threads bumping one counter, a payment worker and a refund worker touching the same wallet. When that sharing is not controlled you get bugs that pass every unit test, appear once in a million requests, and lose real money. This page covers the toolkit an SDE 2 is expected to know cold: threads versus coroutines, race conditions, locks, atomics, deadlock, producer-consumer, thread pools and the memory model, plus the concurrency follow-ups that LLD interviewers ask after you draw your class diagram.</p>

    <h2>Why it matters in an LLD round</h2>
    <p>Most low-level design problems (<a href="#/p/parking-lot">parking lot</a>, BookMyShow, <a href="#/p/splitwise">Splitwise</a>, <a href="#/p/elevator">elevator</a>, <a href="#/p/logger">logger</a>, <a href="#/p/lru-cache-lld">LRU cache</a>) end with the same question: <em>"Now 1,000 requests hit this at once. What breaks?"</em> The interviewer wants three things:</p>
    <ol class="steps">
      <li><strong>Spot the shared mutable state</strong>: which objects are read and written by more than one thread (the spot map, the seat status, the counter).</li>
      <li><strong>Name the bug</strong>: lost update, check-then-act, deadlock, or stale read.</li>
      <li><strong>Pick the smallest correct fix</strong>: an atomic, a lock with the right scope, a concurrent collection, or a design that avoids sharing entirely.</li>
    </ol>
    <p>Concurrency is not the same as <strong>parallelism</strong>. Concurrency is about <em>structure</em>: many tasks in progress, interleaved. Parallelism is about <em>execution</em>: tasks literally running at the same instant on different CPU cores. A single-core machine can be concurrent but not parallel. Node.js is concurrent (thousands of open requests) on one thread. Race conditions need only concurrency, not parallelism.</p>

    <h2>Processes, threads and coroutines</h2>
    <p>A <strong>process</strong> is a running program with its own private memory (address space). Two processes cannot see each other's variables; they talk through pipes, sockets or shared files. A <strong>thread</strong> is a unit of execution inside a process. All threads of a process share the heap (objects, globals) but each has its own stack (local variables, call frames) and program counter. That shared heap is both why threads are cheap to communicate through and why they are dangerous.</p>
    <div data-diagram="model" data-caption="One process, many threads: the heap is shared (danger zone), each thread has its own stack (safe)."></div>
    <p>A <strong>coroutine</strong> (also called a green thread, fibre, goroutine or async task) is a lighter unit scheduled by the language runtime instead of the OS. An OS thread costs about 1 MB of stack reservation and a few microseconds per context switch; a goroutine starts at about 2 KB and switches in nanoseconds. That is why a Go server can hold 100,000 goroutines but a Java server with classic threads tops out around a few thousand.</p>
    <table>
      <thead><tr><th>Language</th><th>Main model</th><th>What runs in parallel</th><th>Notes for interviews</th></tr></thead>
      <tbody>
        <tr><td>Java</td><td>OS threads (<code>Thread</code>, <code>ExecutorService</code>); <strong>virtual threads</strong> since Java 21</td><td>Yes, on all cores</td><td>Virtual threads are cheap (millions possible) and park on blocking I/O without holding an OS thread. Rich toolkit: <code>synchronized</code>, <code>ReentrantLock</code>, <code>AtomicInteger</code>, <code>ConcurrentHashMap</code>, <code>BlockingQueue</code>.</td></tr>
        <tr><td>Python</td><td><code>threading</code>, <code>asyncio</code>, <code>multiprocessing</code></td><td>Threads: not for Python bytecode (the <strong>GIL</strong>, Global Interpreter Lock, lets one thread run Python at a time). Processes: yes</td><td>Threads help for I/O-bound work (the GIL is released while waiting on the network). Use <code>multiprocessing</code> for CPU-bound work. The GIL does <em>not</em> make <code>x += 1</code> safe: it is several bytecodes and a switch can happen between them. Python 3.13+ has an optional free-threaded build without the GIL.</td></tr>
        <tr><td>C++</td><td><code>std::thread</code>, <code>std::async</code>, C++20 coroutines</td><td>Yes</td><td>A data race is <strong>undefined behaviour</strong>, not just a wrong number. Tools: <code>std::mutex</code>, <code>std::shared_mutex</code>, <code>std::atomic</code>, <code>std::condition_variable</code>, <code>std::scoped_lock</code>.</td></tr>
        <tr><td>JavaScript</td><td>Single-threaded <strong>event loop</strong>; <code>async</code>/<code>await</code>; Worker threads</td><td>Only with Workers (Node <code>worker_threads</code>, browser Web Workers), which share nothing by default</td><td>No two lines of your JS run at the same instant, so <code>count++</code> is safe. But every <code>await</code> is a point where other tasks run, so check-then-act across an <code>await</code> still races.</td></tr>
        <tr><td>Go</td><td><strong>Goroutines</strong> scheduled over a few OS threads; <strong>channels</strong></td><td>Yes (up to <code>GOMAXPROCS</code> cores)</td><td>Motto: "Do not communicate by sharing memory; share memory by communicating." Still has <code>sync.Mutex</code>, <code>sync.RWMutex</code>, <code>sync/atomic</code>, <code>sync.Once</code>. Run tests with <code>-race</code> to catch data races.</td></tr>
      </tbody>
    </table>
    <div class="callout tip"><strong>Which to use when</strong>I/O-bound work (calling APIs, databases): threads, virtual threads, goroutines or async all work; async and goroutines scale to the most open connections. CPU-bound work (image resizing, hashing): real parallelism, so threads in Java/C++/Go, processes in Python, Workers in JS, sized to the number of cores.</div>

    <h2>Race conditions and critical sections</h2>
    <p>A <strong>race condition</strong> is a bug where the result depends on the timing of threads. A <strong>critical section</strong> is a piece of code that touches shared state and must not be run by two threads at once. Almost every race you will meet in an interview is one of two shapes.</p>

    <h3>Shape 1: read-modify-write (lost update)</h3>
    <p><code>count++</code> looks like one step but the CPU does three: read <code>count</code> into a register, add 1, write it back. If two threads both read 5 before either writes, both write 6. Two increments happened; one was lost.</p>
    <div data-diagram="lost" data-caption="Lost update: both threads read 5, both write 6. The counter should be 7."></div>
    <p>Step through it yourself. Run the two threads with no lock and watch updates disappear, then switch to a lock (the second thread waits) and to an atomic (the CPU does read-add-write as one indivisible instruction).</p>
    <div data-widget="race"></div>
    <p>The same bug in real systems: two app servers both read a product's stock as 10, both sell one, both write 9. Ten units of stock, eleven orders. Likes counters, wallet balances, view counts and rate-limiter counters all have this shape.</p>

    <h3>Shape 2: check-then-act</h3>
    <p>You check a condition, then act on it, but the condition can change in between. Classic example: booking the last seat.</p>
    <ol class="steps">
      <li>Asha's request checks: seat A7 is free.</li>
      <li>Ravi's request checks: seat A7 is free.</li>
      <li>Asha's request marks A7 booked and charges her.</li>
      <li>Ravi's request marks A7 booked and charges him. Two tickets, one seat.</li>
    </ol>
    <p>Other examples: "if the key is not in the map, put it" (two threads both insert), lazy initialisation of a singleton (two instances created), "if balance &gt;= amount, debit" (overdraft). The fix is always to make the check and the act <strong>one atomic step</strong>: hold a lock across both, use an atomic operation like <code>putIfAbsent</code> or compare-and-swap, or push the check into the database with a conditional update (<code>UPDATE seats SET status='BOOKED' WHERE id=7 AND status='FREE'</code>, then check the affected row count).</p>
    <p>The code below shows both shapes. Java, Python, C++ and Go run four workers that increment a counter with no protection, with a lock, and with an atomic. JavaScript cannot lose a <code>count++</code> (one thread), so it shows the check-then-act race across an <code>await</code> instead, fixed with a small async mutex.</p>
    <div data-code="race"></div>
    <div class="callout warn"><strong>"It printed the right answer" proves nothing</strong>A racy program can pass 999 runs and fail on the 1,000th, or only on a 64-core production box. Races are found by reasoning about interleavings and by tools: Go's <code>-race</code>, C++ ThreadSanitizer (<code>-fsanitize=thread</code>), Java's jcstress. Never argue "it worked in testing".</div>

    <h2>Locks and other synchronisers</h2>
    <h3>Mutex (lock)</h3>
    <p>A <strong>mutex</strong> (mutual exclusion lock) lets only one thread at a time hold it. Others that call <code>lock()</code> block until it is released. Wrap the whole critical section, and always release in a <code>finally</code> / <code>defer</code> / RAII guard so an exception cannot leave it locked forever. Keep the critical section small: never do network calls or slow I/O while holding a lock, because every other thread queues behind you.</p>
    <h3>Reentrant lock</h3>
    <p>A <strong>reentrant</strong> lock can be acquired again by the thread that already holds it (it keeps a hold count). This matters when a synchronised method calls another synchronised method on the same object. Java's <code>synchronized</code> and <code>ReentrantLock</code> and Python's <code>threading.RLock</code> are reentrant. Go's <code>sync.Mutex</code>, C++ <code>std::mutex</code> and Python's plain <code>Lock</code> are not: locking twice from the same thread deadlocks with itself. <code>ReentrantLock</code> also gives you <code>tryLock(timeout)</code>, fairness and multiple condition variables, which <code>synchronized</code> does not.</p>
    <h3>Read-write lock</h3>
    <p>A <strong>read-write lock</strong> allows many readers at once or one writer alone. Perfect for read-heavy data such as a config map read 10,000 times a second and updated once a minute, or a product catalogue cache. Java <code>ReentrantReadWriteLock</code>, C++ <code>std::shared_mutex</code>, Go <code>sync.RWMutex</code>. It is not free: it costs more than a plain mutex per acquire, and with steady readers a writer can starve unless the lock is fair. If reads are short, a plain mutex is often just as fast.</p>
    <h3>Semaphore</h3>
    <p>A <strong>semaphore</strong> holds N permits. <code>acquire()</code> takes one (blocking if none are left); <code>release()</code> returns one. A mutex is roughly a semaphore with one permit. Use it to <em>limit</em> concurrency rather than to protect data: allow at most 20 threads to use the database connection pool at once, at most 5 concurrent calls to a slow partner API (Razorpay calling a bank gateway with a strict limit), or at most 3 parallel downloads in a mobile app.</p>
    <h3>Condition variable</h3>
    <p>A <strong>condition variable</strong> lets a thread sleep until some condition on shared state becomes true, without spinning. A consumer waits on "queue not empty"; a producer, after adding an item, signals it. Rules: always wait while holding the associated lock, always re-check the condition in a <code>while</code> loop (wake-ups can be spurious, and another thread may have grabbed the item first), and signal after changing the state. Java has <code>wait()</code>/<code>notifyAll()</code> and <code>Condition.await()</code>/<code>signal()</code>; C++ <code>std::condition_variable</code>; Python <code>threading.Condition</code>; Go uses channels instead in most code.</p>
    <table>
      <thead><tr><th>Tool</th><th>Guarantees</th><th>Typical use</th></tr></thead>
      <tbody>
        <tr><td>Mutex</td><td>One holder at a time</td><td>Protect a compound update (move a parking spot from free to taken and record the ticket)</td></tr>
        <tr><td>Reentrant lock</td><td>Same thread can re-acquire</td><td>Nested synchronised calls; <code>tryLock</code> with timeout</td></tr>
        <tr><td>Read-write lock</td><td>Many readers or one writer</td><td>Read-mostly caches, config, routing tables</td></tr>
        <tr><td>Semaphore(N)</td><td>At most N holders</td><td>Connection pools, throttling calls to a dependency</td></tr>
        <tr><td>Condition variable</td><td>Sleep until state changes</td><td>Blocking queues, "wait until elevator reaches floor"</td></tr>
        <tr><td>Atomic variable</td><td>Single-variable update is indivisible</td><td>Counters, flags, ID generators, sequence numbers</td></tr>
      </tbody>
    </table>

    <h2>Atomics and compare-and-swap</h2>
    <p>An <strong>atomic</strong> variable is updated by a single CPU instruction that no other core can interrupt halfway. <code>AtomicInteger.incrementAndGet()</code>, <code>std::atomic&lt;int&gt;::fetch_add</code> and Go's <code>atomic.Int64.Add</code> fix the counter race with no lock at all, and they are 5 to 10 times cheaper than a contended mutex.</p>
    <p>The building block under all of them is <strong>compare-and-swap (CAS)</strong>: "set the value to <em>new</em> only if it is still <em>expected</em>; tell me whether it worked". You build any single-variable update as a retry loop:</p>
    <ol class="steps">
      <li>Read the current value, say 5.</li>
      <li>Compute the new value, 6.</li>
      <li>CAS(expected = 5, new = 6). If another thread changed it to 6 in the meantime, the CAS fails.</li>
      <li>On failure, go back to step 1 and retry with the fresh value.</li>
    </ol>
    <p>This is <strong>optimistic concurrency</strong>: assume no conflict, detect it, retry. The same idea shows up in databases as a version column (<code>UPDATE ... SET qty = 9, version = 4 WHERE id = 42 AND version = 3</code>), covered in <a href="#/p/transactions">transactions</a>. Lock-free structures such as Java's <code>ConcurrentLinkedQueue</code> are built from CAS loops.</p>
    <div class="callout info"><strong>Limits of atomics</strong>An atomic protects <em>one</em> variable. If an invariant spans two fields (debit one account and credit another, or decrement free spots and add a ticket), two separate atomics are not enough: another thread can see the state between them. Use a lock or a transaction. Also watch for the <strong>ABA problem</strong>: a value goes A to B and back to A, so a CAS succeeds even though things changed. Fix it with a version stamp (Java <code>AtomicStampedReference</code>).</div>

    <h2>Deadlock, livelock and starvation</h2>
    <p>A <strong>deadlock</strong> is when two or more threads each hold a lock and wait for a lock that another one holds, so none can ever proceed. The textbook case is a bank transfer: thread 1 runs <code>transfer(A, B)</code> and locks A then B; thread 2 runs <code>transfer(B, A)</code> and locks B then A. Each grabs its first lock and waits forever for the second.</p>
    <figure class="svg-fig">
      <svg viewBox="0 0 600 300">
        <rect class="s-box" x="40" y="40" width="160" height="56" rx="10"/><text class="s-title" x="120" y="73" text-anchor="middle">Thread 1</text>
        <rect class="s-red" x="400" y="40" width="160" height="56" rx="10"/><text class="s-title" x="480" y="73" text-anchor="middle">Lock B</text>
        <rect class="s-red" x="40" y="204" width="160" height="56" rx="10"/><text class="s-title" x="120" y="237" text-anchor="middle">Lock A</text>
        <rect class="s-box" x="400" y="204" width="160" height="56" rx="10"/><text class="s-title" x="480" y="237" text-anchor="middle">Thread 2</text>
        <line class="s-line" x1="200" y1="68" x2="396" y2="68" marker-end="url(#arrow)"/>
        <text class="s-text" x="300" y="58" text-anchor="middle">waits for</text>
        <line class="s-line" x1="480" y1="96" x2="480" y2="200" marker-end="url(#arrow)"/>
        <text class="s-text" x="470" y="154" text-anchor="end">held by</text>
        <line class="s-line" x1="400" y1="232" x2="204" y2="232" marker-end="url(#arrow)"/>
        <text class="s-text" x="300" y="222" text-anchor="middle">waits for</text>
        <line class="s-line" x1="120" y1="204" x2="120" y2="100" marker-end="url(#arrow)"/>
        <text class="s-text" x="130" y="154">held by</text>
        <text class="s-muted" x="300" y="150" text-anchor="middle">a cycle of waiting:</text>
        <text class="s-muted" x="300" y="168" text-anchor="middle">nobody can move</text>
        <text class="s-muted" x="300" y="290" text-anchor="middle">T1 holds A, wants B. T2 holds B, wants A.</text>
      </svg>
      <figcaption>Deadlock is a cycle in the wait-for graph. Break any edge of the cycle and it cannot happen.</figcaption>
    </figure>
    <h3>The four Coffman conditions</h3>
    <p>Deadlock can happen only when all four hold at once. Remove any one and deadlock is impossible.</p>
    <table>
      <thead><tr><th>Condition</th><th>Meaning</th><th>How to break it</th></tr></thead>
      <tbody>
        <tr><td>Mutual exclusion</td><td>A resource can be held by only one thread</td><td>Use lock-free atomics or immutable data where possible</td></tr>
        <tr><td>Hold and wait</td><td>A thread holds one lock while waiting for another</td><td>Acquire all locks at once (C++ <code>std::scoped_lock(a, b)</code>), or release what you hold before waiting</td></tr>
        <tr><td>No preemption</td><td>A lock cannot be taken away from its holder</td><td><code>tryLock(timeout)</code>: give up, release everything, back off, retry</td></tr>
        <tr><td>Circular wait</td><td>A cycle of threads each waiting for the next</td><td><strong>Global lock ordering</strong>: always lock in the same order (for example by account ID)</td></tr>
      </tbody>
    </table>
    <p><strong>Lock ordering</strong> is the answer interviewers want first: sort the resources by a stable key (account ID, seat ID, spot ID) and always lock in that order. Then no cycle can form. <strong>tryLock with timeout</strong> is the backup when you cannot know the order in advance; add random back-off so the threads do not keep colliding. Databases detect deadlocks for you: MySQL InnoDB finds the cycle and rolls back one transaction, so your code must be ready to retry.</p>
    <div data-code="deadlock"></div>
    <h3>Livelock and starvation</h3>
    <p><strong>Livelock</strong>: threads are not blocked, they keep running, but make no progress. Two people in a corridor who both step aside the same way, again and again. In code: two threads that each <code>tryLock</code>, fail, release, and retry in perfect lockstep. Fix with random back-off (the same trick Ethernet and retry policies use).</p>
    <p><strong>Starvation</strong>: one thread never gets the resource because others keep winning. A writer that never gets a read-write lock because readers keep arriving, or a low-priority job that never gets a worker. Fix with fair locks (FIFO hand-off, <code>new ReentrantLock(true)</code>), bounded queues, or ageing priorities. Fairness costs throughput, so use it only where starvation is a real risk.</p>

    <h2>Producer-consumer with a bounded queue</h2>
    <p>Producers create work, consumers process it, and a queue between them decouples their speeds. This is the most reused concurrency pattern: the <a href="#/p/logger">logger</a> that writes to disk on a background thread, an order service handing jobs to email workers, and, scaled across machines, <a href="#/p/message-queues">message queues</a> such as Kafka and SQS.</p>
    <div data-diagram="pc" data-caption="Producers block when the buffer is full; consumers block when it is empty."></div>
    <p>The queue must be <strong>bounded</strong>. An unbounded queue hides a slow consumer until memory runs out and the process crashes. A bounded queue gives <strong>back-pressure</strong>: when it is full, producers wait (or the request is rejected), which pushes the slowdown back to the caller, where it can be seen and handled. The implementation needs one lock and two conditions: "not full" (producers wait on it) and "not empty" (consumers wait on it). Shutting down needs a signal too: a <em>poison pill</em> (a special item meaning "stop") or closing the queue, as Go does with <code>close(ch)</code>.</p>
    <div data-code="pc"></div>

    <h2>Thread pools and executors</h2>
    <p>Why not start a new thread for every request? Each OS thread reserves about 1 MB of stack and costs tens of microseconds to create. At 5,000 requests per second during a Swiggy dinner rush, a thread per request means thousands of threads, gigabytes of stack, and a CPU busy switching between them instead of working. Worse, there is no upper limit, so a spike takes the server down.</p>
    <p>A <strong>thread pool</strong> keeps a fixed set of worker threads and a task queue. You submit tasks; idle workers pick them up. Threads are reused, concurrency is capped, and a full queue gives you a clear overload signal.</p>
    <div data-diagram="pool" data-caption="Thread pool: a bounded queue in front of a fixed set of reusable workers."></div>
    <ul>
      <li><strong>Sizing</strong>: for CPU-bound work, about the number of cores (8 cores, 8 threads). For I/O-bound work, <code>cores × (1 + wait time / compute time)</code>: if a task waits 90 ms on a database and computes 10 ms, 8 cores can use about 80 threads.</li>
      <li><strong>Rejection policy</strong>: when the queue is full, reject with an error (HTTP 429/503), run the task on the caller's thread (natural back-pressure), or drop the oldest. Decide explicitly; never use an unbounded queue in production.</li>
      <li><strong>Isolation (bulkheads)</strong>: give slow dependencies their own pool so one hanging partner API cannot eat every thread in the service.</li>
      <li><strong>Languages</strong>: Java <code>ExecutorService</code> / <code>ThreadPoolExecutor</code> (and <code>Executors.newVirtualThreadPerTaskExecutor()</code>, where a thread per task becomes fine again because virtual threads are cheap), Python <code>concurrent.futures.ThreadPoolExecutor</code> / <code>ProcessPoolExecutor</code>, Go a fixed number of goroutines reading one channel (or a semaphore channel to cap concurrency), Node's libuv pool for file and DNS work.</li>
    </ul>

    <h2>Visibility, the memory model and the simplest fixes</h2>
    <p>Races are not only about interleaving. CPUs keep values in per-core caches and compilers reorder instructions, so a write by one thread may <em>never become visible</em> to another without synchronisation. The classic bug: a worker loops on <code>while (!stopped)</code> and never stops because it keeps reading a cached <code>false</code>. Each language's <strong>memory model</strong> defines <strong>happens-before</strong> rules: an unlock happens-before the next lock of the same mutex, a write to a <code>volatile</code> (Java) or atomic variable happens-before a later read of it, and starting or joining a thread is also a happens-before edge. If two accesses to the same variable (one a write) are not ordered by happens-before, you have a data race. Java <code>volatile</code> fixes <em>visibility</em> and ordering, not atomicity: <code>volatileCount++</code> still loses updates.</p>
    <p>The cheapest way to be thread-safe is to not share mutable state at all:</p>
    <div class="grid-3">
      <div class="card"><strong>Immutability</strong><p>Objects that cannot change after construction (Java records with final fields, Python frozen dataclasses, Go values passed by copy) can be shared by any number of threads with no locks. To "change" one, build a new copy and swap a reference atomically.</p></div>
      <div class="card"><strong>Thread confinement</strong><p>Only one thread ever touches the data: a local variable, a <code>ThreadLocal</code> formatter, or an actor/event loop that owns its state. Node's event loop and Redis's single command thread are confinement at system scale.</p></div>
      <div class="card"><strong>Concurrent collections</strong><p>Let experts write the locking: <code>ConcurrentHashMap.computeIfAbsent</code>, <code>LongAdder</code> for hot counters, <code>BlockingQueue</code>, Go channels, Python <code>queue.Queue</code>.</p></div>
    </div>

    <h2>Concurrency follow-ups in LLD rounds</h2>
    <p>These come up again and again. Have a one-line answer and the trade-off ready for each.</p>
    <table>
      <thead><tr><th>Scenario</th><th>The race</th><th>Good answer</th></tr></thead>
      <tbody>
        <tr><td><a href="#/p/parking-lot">Parking lot</a> spot allocation</td><td>Two entry gates find the same free spot and both assign it (check-then-act)</td><td>Take the spot from a per-level/per-size <code>BlockingQueue</code> or <code>ConcurrentLinkedQueue</code> of free spots (<code>poll()</code> is atomic), or lock per floor rather than one global lock. Return it on exit.</td></tr>
        <tr><td>BookMyShow seat selection</td><td>Two users pick the same seat; both pay</td><td>Temporary <strong>seat lock</strong> with a TTL (say 10 minutes) set atomically: in memory a <code>ConcurrentHashMap.putIfAbsent(seatId, hold)</code>; across servers Redis <code>SET seat:show42:A7 user NX EX 600</code> or a DB conditional update. Lock multiple seats in sorted order. Confirm on payment; expiry frees it.</td></tr>
        <tr><td><a href="#/p/rate-limiter">Rate limiter</a> counters</td><td>Read count, compare, increment: two requests both pass at 99/100</td><td>Atomic increment then compare (<code>AtomicLong</code>, Redis <code>INCR</code>), or a per-user lock around the token bucket refill-and-take; Lua script in Redis for multi-step logic.</td></tr>
        <tr><td>Singleton (logger, config)</td><td>Two threads see <code>instance == null</code> and both construct</td><td>Eager init, a language-level guarantee (Java holder class or enum, C++ function-local static, Go <code>sync.Once</code>), or double-checked locking with a <code>volatile</code> field.</td></tr>
        <tr><td><a href="#/p/splitwise">Splitwise</a> / wallet balances</td><td>Concurrent expense adds overwrite each other's balance updates</td><td>Lock the involved users in ID order, or keep an append-only ledger and compute balances from it.</td></tr>
        <tr><td><a href="#/p/lru-cache-lld">LRU cache</a></td><td>A <code>get</code> also mutates (moves to front), so readers race too</td><td>One mutex around get and put, or segment the cache (N shards, each with its own lock) to cut contention.</td></tr>
      </tbody>
    </table>
    <h3>Double-checked locking, done right</h3>
    <p>The naive lazy singleton (<code>if (instance == null) instance = new X();</code>) races. Locking every call is correct but slow. <strong>Double-checked locking</strong> checks once without the lock (fast path), then locks and checks again before creating. In Java the field <em>must</em> be <code>volatile</code>; otherwise another thread can see a non-null reference to an object whose constructor has not finished, because the write of the reference can be reordered before the writes of its fields. Each language has a simpler idiom, shown below.</p>
    <div data-code="singleton"></div>

    <div class="callout interview"><strong>Say this in the interview</strong>"The shared mutable state here is the seat map. Booking is check-then-act, so I need the check and the update to be atomic. Inside one server I use <code>putIfAbsent</code> on a <code>ConcurrentHashMap</code> keyed by seat ID, with a hold expiry. Since we run many servers, the real source of truth is a conditional update in the database or a Redis <code>SET NX EX</code>. If a booking spans several seats I lock them in sorted seat-ID order to avoid deadlock, and I keep the critical section free of payment calls."</div>
    <div class="callout warn"><strong>Common pitfalls</strong>
      <ul>
        <li>Making every method <code>synchronized</code>: correct but serialises the whole system. Lock the smallest scope, or use finer-grained locks (per spot, per seat, per account).</li>
        <li>Holding a lock across I/O (DB call, HTTP call, payment): throughput collapses to one request at a time.</li>
        <li>Forgetting that an in-process lock does nothing across multiple servers. For that you need DB constraints, conditional updates or a distributed lock.</li>
        <li>Assuming Python's GIL or JavaScript's single thread removes all races: check-then-act across an <code>await</code> or a GIL switch still breaks.</li>
      </ul>
    </div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>Why is <code>count++</code> not thread-safe, and what are two fixes?</summary><div>It is three steps (read, add, write). Two threads can both read the same value and both write value + 1, losing one update. Fix with a mutex around the increment, or an atomic (<code>AtomicInteger.incrementAndGet</code>, <code>std::atomic::fetch_add</code>, <code>atomic.Int64.Add</code>). For very hot counters, Java's <code>LongAdder</code> spreads the count over cells to cut contention.</div></details>
      <details><summary>Node.js is single-threaded. Can it still have race conditions?</summary><div>Yes. No two lines run at the same instant, so <code>count++</code> is safe, but an <code>await</code> between a check and an act lets other requests run. "If seats &gt; 0, await save, seats--" can oversell. And with several Node processes or servers behind a load balancer, they share a database, so the classic races come back at that level.</div></details>
      <details><summary>List the four Coffman conditions and the usual way to prevent deadlock in code.</summary><div>Mutual exclusion, hold and wait, no preemption, circular wait. All four are needed. The usual fix is to break circular wait with a global lock order (always lock resources sorted by ID). Alternatives: acquire all locks at once, or <code>tryLock</code> with a timeout and back-off (breaks no preemption).</div></details>
      <details><summary>When would you use a semaphore instead of a mutex?</summary><div>When you want to allow up to N concurrent users of a resource rather than exactly one: capping concurrent DB connections at 20, or concurrent calls to a rate-limited partner API at 5. A mutex protects data; a semaphore limits concurrency.</div></details>
      <details><summary>Why must a producer-consumer queue be bounded?</summary><div>If producers are faster than consumers, an unbounded queue grows until the process runs out of memory, and the slowdown is invisible until the crash. A bounded queue blocks or rejects producers when full, giving back-pressure and a clear overload signal.</div></details>
      <details><summary>In double-checked locking in Java, why must the instance field be <code>volatile</code>?</summary><div>Without it the JVM and CPU may reorder the write of the reference before the constructor's field writes. Another thread on the unlocked fast path could see a non-null instance that is only partly built. <code>volatile</code> creates a happens-before edge so the fully constructed object is visible. The holder-class idiom or an enum avoids the issue entirely.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>Races need shared <em>mutable</em> state. First ask whether you can avoid sharing: immutability, confinement, or message passing.</li>
      <li>The two race shapes are read-modify-write (lost updates) and check-then-act (double booking). Fix by making the whole step atomic.</li>
      <li>Atomics and CAS for single variables; locks for invariants that span several fields; transactions or conditional updates across servers.</li>
      <li>Read-write locks for read-heavy data, semaphores to cap concurrency, condition variables (or channels) to wait for state changes.</li>
      <li>Deadlock needs all four Coffman conditions; global lock ordering is the standard fix, <code>tryLock</code> with back-off the fallback.</li>
      <li>Use bounded queues and thread pools, never a thread per request with unbounded queues; size pools by CPU vs I/O work.</li>
      <li>Visibility is a separate problem from atomicity: <code>volatile</code>/atomics/locks create happens-before; <code>volatile</code> alone does not make <code>++</code> safe.</li>
    </ul></div>
  `,
  code: {
    race: {
      title: "Lost updates: no lock vs lock vs atomic (JS: check-then-act across await)",
      java: String.raw`import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;

public class RaceDemo {
    static final int THREADS = 4, PER_THREAD = 100_000;
    static final int EXPECTED = THREADS * PER_THREAD;

    static int unsafeCount = 0;                       // shared, unprotected
    static int lockedCount = 0;                       // guarded by lock
    static final ReentrantLock lock = new ReentrantLock();
    static final AtomicInteger atomicCount = new AtomicInteger();

    static void runWorkers(Runnable body) throws InterruptedException {
        Thread[] ts = new Thread[THREADS];
        for (int i = 0; i < THREADS; i++) { ts[i] = new Thread(body); ts[i].start(); }
        for (Thread t : ts) t.join();
    }

    public static void main(String[] args) throws InterruptedException {
        // 1. No protection: count++ is read, add, write. Updates get lost.
        runWorkers(() -> { for (int i = 0; i < PER_THREAD; i++) unsafeCount++; });

        // 2. Mutex: only one thread inside the critical section at a time.
        runWorkers(() -> {
            for (int i = 0; i < PER_THREAD; i++) {
                lock.lock();
                try { lockedCount++; } finally { lock.unlock(); }
            }
        });

        // 3. Atomic: one indivisible CPU instruction (CAS / fetch-and-add), no lock.
        runWorkers(() -> { for (int i = 0; i < PER_THREAD; i++) atomicCount.incrementAndGet(); });

        System.out.println("expected : " + EXPECTED);
        System.out.println("no lock  : " + (unsafeCount == EXPECTED
                ? "correct this time (luck, not safety)"
                : "WRONG, lost " + (EXPECTED - unsafeCount) + " updates"));
        System.out.println("lock     : " + lockedCount);
        System.out.println("atomic   : " + atomicCount.get());
    }
}
`,
      python: String.raw`import threading
import time

THREADS, PER_THREAD = 4, 1_000
EXPECTED = THREADS * PER_THREAD


class Counter:
    def __init__(self):
        self.value = 0
        self.lock = threading.Lock()

    def unsafe_increment(self):
        current = self.value      # 1. read
        time.sleep(0)             # let another thread run here (the GIL can switch at any bytecode)
        self.value = current + 1  # 2. write back, possibly over someone else's update

    def safe_increment(self):
        with self.lock:           # read and write happen as one critical section
            current = self.value
            time.sleep(0)
            self.value = current + 1


def run_workers(fn):
    def work():
        for _ in range(PER_THREAD):
            fn()
    threads = [threading.Thread(target=work) for _ in range(THREADS)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()


unsafe, safe = Counter(), Counter()
run_workers(unsafe.unsafe_increment)
run_workers(safe.safe_increment)

print("expected :", EXPECTED)
if unsafe.value == EXPECTED:
    print("no lock  : correct this time (luck, not safety)")
else:
    print("no lock  : WRONG, lost", EXPECTED - unsafe.value, "updates")
print("lock     :", safe.value)
`,
      cpp: String.raw`#include <atomic>
#include <iostream>
#include <mutex>
#include <thread>
#include <vector>

constexpr int THREADS = 4, PER_THREAD = 100000;
constexpr int EXPECTED = THREADS * PER_THREAD;

// volatile only stops the compiler merging the loop into one add.
// It does NOT make the increment atomic. This is a data race (undefined
// behaviour in C++): shown for teaching only.
volatile int unsafeCount = 0;
int lockedCount = 0;
std::mutex mtx;
std::atomic<int> atomicCount{0};

template <typename F>
void runWorkers(F body) {
    std::vector<std::thread> ts;
    for (int i = 0; i < THREADS; ++i) ts.emplace_back(body);
    for (auto& t : ts) t.join();
}

int main() {
    runWorkers([] { for (int i = 0; i < PER_THREAD; ++i) unsafeCount = unsafeCount + 1; });

    runWorkers([] {
        for (int i = 0; i < PER_THREAD; ++i) {
            std::lock_guard<std::mutex> guard(mtx);   // unlocks automatically (RAII)
            ++lockedCount;
        }
    });

    runWorkers([] { for (int i = 0; i < PER_THREAD; ++i) atomicCount.fetch_add(1); });

    std::cout << "expected : " << EXPECTED << "\n";
    if (unsafeCount == EXPECTED)
        std::cout << "no lock  : correct this time (luck, not safety)\n";
    else
        std::cout << "no lock  : WRONG, lost " << (EXPECTED - unsafeCount) << " updates\n";
    std::cout << "lock     : " << lockedCount << "\n";
    std::cout << "atomic   : " << atomicCount.load() << "\n";
}
`,
      javascript: String.raw`// JS runs on one thread, so count++ can never lose an update.
// But "check, await something, then act" still races: other tasks run at every await.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let seatsLeft = 1;
const booked = [];

async function bookUnsafe(user) {
  if (seatsLeft > 0) {        // check
    await sleep(10);          // e.g. await db.save(...): the other request runs now
    seatsLeft--;              // act, based on a stale check
    booked.push(user);
  }
}

// A tiny async mutex: each caller waits for the previous holder's release().
class Mutex {
  constructor() { this.tail = Promise.resolve(); }
  lock() {
    let release;
    const next = new Promise((resolve) => (release = resolve));
    const acquired = this.tail.then(() => release);
    this.tail = this.tail.then(() => next);
    return acquired;          // resolves to the release function
  }
}

const mutex = new Mutex();

async function bookSafe(user) {
  const release = await mutex.lock();
  try {
    if (seatsLeft > 0) {      // check and act are now one critical section
      await sleep(10);
      seatsLeft--;
      booked.push(user);
    }
  } finally {
    release();
  }
}

async function main() {
  seatsLeft = 1; booked.length = 0;
  await Promise.all([bookUnsafe("asha"), bookUnsafe("ravi")]);
  console.log("no lock : booked [" + booked.join(", ") + "], seatsLeft = " + seatsLeft); // both booked, -1

  seatsLeft = 1; booked.length = 0;
  await Promise.all([bookSafe("asha"), bookSafe("ravi")]);
  console.log("lock    : booked [" + booked.join(", ") + "], seatsLeft = " + seatsLeft); // only asha, 0
}

main();
`,
      go: String.raw`package main

import (
	"fmt"
	"sync"
	"sync/atomic"
)

const workers, perWorker = 4, 100000
const expected = workers * perWorker

func runWorkers(body func()) {
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			body()
		}()
	}
	wg.Wait()
}

func main() {
	// 1. No protection: a data race ("go run -race" reports this line).
	unsafeCount := 0
	runWorkers(func() {
		for i := 0; i < perWorker; i++ {
			unsafeCount++
		}
	})

	// 2. Mutex around the critical section.
	var mu sync.Mutex
	lockedCount := 0
	runWorkers(func() {
		for i := 0; i < perWorker; i++ {
			mu.Lock()
			lockedCount++
			mu.Unlock()
		}
	})

	// 3. Atomic add, no lock.
	var atomicCount atomic.Int64
	runWorkers(func() {
		for i := 0; i < perWorker; i++ {
			atomicCount.Add(1)
		}
	})

	fmt.Println("expected :", expected)
	if unsafeCount == expected {
		fmt.Println("no lock  : correct this time (luck, not safety)")
	} else {
		fmt.Println("no lock  : WRONG, lost", expected-unsafeCount, "updates")
	}
	fmt.Println("lock     :", lockedCount)
	fmt.Println("atomic   :", atomicCount.Load())
}
`,
    },
    deadlock: {
      title: "Bank transfer: consistent lock order prevents deadlock",
      java: String.raw`import java.util.concurrent.locks.ReentrantLock;

public class LockOrdering {
    static class Account {
        final int id;
        int balance;
        final ReentrantLock lock = new ReentrantLock();
        Account(int id, int balance) { this.id = id; this.balance = balance; }
    }

    // DEADLOCKING version (do not do this):
    //   from.lock.lock(); to.lock.lock();
    //   Thread 1: transfer(A, B) holds A, waits for B.
    //   Thread 2: transfer(B, A) holds B, waits for A.  Both wait forever.

    // FIX: always lock the account with the smaller id first (one global order).
    static void transfer(Account from, Account to, int amount) {
        Account first = from.id < to.id ? from : to;
        Account second = from.id < to.id ? to : from;
        first.lock.lock();
        try {
            second.lock.lock();
            try {
                if (from.balance >= amount) {
                    from.balance -= amount;
                    to.balance += amount;
                }
            } finally {
                second.lock.unlock();
            }
        } finally {
            first.lock.unlock();
        }
    }

    public static void main(String[] args) throws InterruptedException {
        Account a = new Account(1, 1000), b = new Account(2, 1000);
        Thread t1 = new Thread(() -> { for (int i = 0; i < 10_000; i++) transfer(a, b, 1); });
        Thread t2 = new Thread(() -> { for (int i = 0; i < 10_000; i++) transfer(b, a, 1); });
        t1.start(); t2.start();
        t1.join(); t2.join();
        System.out.println("finished, no deadlock");
        System.out.println("total = " + (a.balance + b.balance) + " (money is conserved)");
    }
}
`,
      python: String.raw`import threading


class Account:
    def __init__(self, id, balance):
        self.id = id
        self.balance = balance
        self.lock = threading.Lock()


# DEADLOCKING version (do not do this):
#   with from_acc.lock, to_acc.lock: ...
#   Thread 1: transfer(a, b) holds a, waits for b.
#   Thread 2: transfer(b, a) holds b, waits for a.  Both wait forever.

def transfer(from_acc, to_acc, amount):
    # FIX: always lock the smaller id first, whatever the direction.
    first, second = sorted((from_acc, to_acc), key=lambda acc: acc.id)
    with first.lock:
        with second.lock:
            if from_acc.balance >= amount:
                from_acc.balance -= amount
                to_acc.balance += amount


a, b = Account(1, 1000), Account(2, 1000)


def a_to_b():
    for _ in range(10_000):
        transfer(a, b, 1)


def b_to_a():
    for _ in range(10_000):
        transfer(b, a, 1)


t1, t2 = threading.Thread(target=a_to_b), threading.Thread(target=b_to_a)
t1.start(); t2.start()
t1.join(); t2.join()
print("finished, no deadlock")
print("total =", a.balance + b.balance, "(money is conserved)")
`,
      cpp: String.raw`#include <iostream>
#include <mutex>
#include <thread>

struct Account {
    int id;
    int balance;
    std::mutex m;
};

// DEADLOCKING version (do not do this):
//   std::lock_guard<std::mutex> g1(from.m);
//   std::lock_guard<std::mutex> g2(to.m);
//   Thread 1: transfer(a, b) holds a, waits for b.
//   Thread 2: transfer(b, a) holds b, waits for a.  Both wait forever.

void transfer(Account& from, Account& to, int amount) {
    // FIX: lock the smaller id first. (std::scoped_lock lk(from.m, to.m) also
    // avoids deadlock: it locks several mutexes with a built-in avoidance algorithm.)
    Account& first = from.id < to.id ? from : to;
    Account& second = from.id < to.id ? to : from;
    std::lock_guard<std::mutex> g1(first.m);
    std::lock_guard<std::mutex> g2(second.m);
    if (from.balance >= amount) {
        from.balance -= amount;
        to.balance += amount;
    }
}

int main() {
    Account a{1, 1000, {}}, b{2, 1000, {}};
    std::thread t1([&] { for (int i = 0; i < 10000; ++i) transfer(a, b, 1); });
    std::thread t2([&] { for (int i = 0; i < 10000; ++i) transfer(b, a, 1); });
    t1.join();
    t2.join();
    std::cout << "finished, no deadlock\n";
    std::cout << "total = " << a.balance + b.balance << " (money is conserved)\n";
}
`,
      javascript: String.raw`// Async code can deadlock too: two tasks each holding one async lock and awaiting the other.
// Node then just exits with the work silently unfinished (no error).
class Mutex {
  constructor() { this.tail = Promise.resolve(); }
  lock() {
    let release;
    const next = new Promise((resolve) => (release = resolve));
    const acquired = this.tail.then(() => release);
    this.tail = this.tail.then(() => next);
    return acquired;
  }
}

class Account {
  constructor(id, balance) { this.id = id; this.balance = balance; this.mutex = new Mutex(); }
}

// DEADLOCKING version (do not do this):
//   const r1 = await from.mutex.lock(); await tick(); const r2 = await to.mutex.lock();
//   Task 1: transfer(a, b) holds a, waits for b.
//   Task 2: transfer(b, a) holds b, waits for a.  Neither promise ever resolves.

const tick = () => new Promise((resolve) => setImmediate(resolve));

async function transfer(from, to, amount) {
  // FIX: always lock the smaller id first.
  const [first, second] = from.id < to.id ? [from, to] : [to, from];
  const releaseFirst = await first.mutex.lock();
  try {
    await tick();                       // let the other task run between the two locks
    const releaseSecond = await second.mutex.lock();
    try {
      if (from.balance >= amount) {
        from.balance -= amount;
        to.balance += amount;
      }
    } finally {
      releaseSecond();
    }
  } finally {
    releaseFirst();
  }
}

async function main() {
  const a = new Account(1, 1000), b = new Account(2, 1000);
  const run = async (from, to) => { for (let i = 0; i < 1000; i++) await transfer(from, to, 1); };
  await Promise.all([run(a, b), run(b, a)]);
  console.log("finished, no deadlock");
  console.log("total = " + (a.balance + b.balance) + " (money is conserved)");
}

main();
`,
      go: String.raw`package main

import (
	"fmt"
	"sync"
)

type Account struct {
	id      int
	balance int
	mu      sync.Mutex
}

// DEADLOCKING version (do not do this):
//   from.mu.Lock(); to.mu.Lock()
//   Goroutine 1: transfer(a, b) holds a, waits for b.
//   Goroutine 2: transfer(b, a) holds b, waits for a.
//   Go aborts with "all goroutines are asleep - deadlock!" only if EVERY goroutine is stuck;
//   in a server with other goroutines it just hangs.

func transfer(from, to *Account, amount int) {
	// FIX: always lock the smaller id first.
	first, second := from, to
	if to.id < from.id {
		first, second = to, from
	}
	first.mu.Lock()
	defer first.mu.Unlock()
	second.mu.Lock()
	defer second.mu.Unlock()
	if from.balance >= amount {
		from.balance -= amount
		to.balance += amount
	}
}

func main() {
	a := &Account{id: 1, balance: 1000}
	b := &Account{id: 2, balance: 1000}
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		for i := 0; i < 10000; i++ {
			transfer(a, b, 1)
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < 10000; i++ {
			transfer(b, a, 1)
		}
	}()
	wg.Wait()
	fmt.Println("finished, no deadlock")
	fmt.Println("total =", a.balance+b.balance, "(money is conserved)")
}
`,
    },
    pc: {
      title: "Producer-consumer with a bounded buffer (capacity 3)",
      java: String.raw`import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;

public class ProducerConsumer {
    static final int POISON = -1;   // special item meaning "no more work"

    public static void main(String[] args) throws InterruptedException {
        BlockingQueue<Integer> queue = new ArrayBlockingQueue<>(3); // bounded

        Thread producer = new Thread(() -> {
            try {
                for (int i = 1; i <= 10; i++) {
                    queue.put(i);              // blocks while the queue is full
                }
                queue.put(POISON);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });

        int[] sum = {0};
        Thread consumer = new Thread(() -> {
            try {
                while (true) {
                    int item = queue.take();   // blocks while the queue is empty
                    if (item == POISON) break;
                    Thread.sleep(5);           // simulate slow work: producer will block
                    sum[0] += item;
                    System.out.println("consumed " + item);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });

        producer.start();
        consumer.start();
        producer.join();
        consumer.join();
        System.out.println("done, sum = " + sum[0]);
    }
}
`,
      python: String.raw`import queue
import threading
import time

buffer = queue.Queue(maxsize=3)   # bounded: put() blocks when full
POISON = None                     # special item meaning "no more work"
total = 0


def producer():
    for i in range(1, 11):
        buffer.put(i)             # blocks while full
    buffer.put(POISON)


def consumer():
    global total
    while True:
        item = buffer.get()       # blocks while empty
        if item is POISON:
            break
        time.sleep(0.005)         # simulate slow work: producer will block
        total += item             # only this thread writes total: confinement
        print("consumed", item)


p = threading.Thread(target=producer)
c = threading.Thread(target=consumer)
p.start(); c.start()
p.join(); c.join()
print("done, sum =", total)
`,
      cpp: String.raw`#include <chrono>
#include <condition_variable>
#include <iostream>
#include <mutex>
#include <optional>
#include <queue>
#include <thread>

class BoundedQueue {
public:
    explicit BoundedQueue(size_t capacity) : capacity_(capacity) {}

    void put(int item) {
        std::unique_lock<std::mutex> lk(m_);
        notFull_.wait(lk, [&] { return q_.size() < capacity_; }); // re-checks after every wake-up
        q_.push(item);
        notEmpty_.notify_one();
    }

    // Returns nothing once the queue is closed and drained.
    std::optional<int> take() {
        std::unique_lock<std::mutex> lk(m_);
        notEmpty_.wait(lk, [&] { return !q_.empty() || closed_; });
        if (q_.empty()) return std::nullopt;
        int item = q_.front();
        q_.pop();
        notFull_.notify_one();
        return item;
    }

    void close() {
        std::lock_guard<std::mutex> lk(m_);
        closed_ = true;
        notEmpty_.notify_all();
    }

private:
    std::mutex m_;
    std::condition_variable notFull_, notEmpty_;
    std::queue<int> q_;
    size_t capacity_;
    bool closed_ = false;
};

int main() {
    BoundedQueue buffer(3);
    int sum = 0;

    std::thread producer([&] {
        for (int i = 1; i <= 10; ++i) buffer.put(i);   // blocks while full
        buffer.close();
    });
    std::thread consumer([&] {
        while (auto item = buffer.take()) {            // blocks while empty
            std::this_thread::sleep_for(std::chrono::milliseconds(5));
            sum += *item;
            std::cout << "consumed " << *item << "\n";
        }
    });

    producer.join();
    consumer.join();
    std::cout << "done, sum = " << sum << "\n";
}
`,
      javascript: String.raw`// Bounded async queue: put() waits while full, take() waits while empty.
class AsyncBoundedQueue {
  constructor(capacity) {
    this.capacity = capacity;
    this.items = [];
    this.waitingTakers = [];   // resolvers of take() calls waiting for an item
    this.waitingPutters = [];  // resolvers of put() calls waiting for space
    this.closed = false;
  }

  async put(item) {
    while (this.items.length >= this.capacity) {
      await new Promise((resolve) => this.waitingPutters.push(resolve));
    }
    this.items.push(item);
    const taker = this.waitingTakers.shift();
    if (taker) taker();
  }

  async take() {
    while (this.items.length === 0) {
      if (this.closed) return undefined;
      await new Promise((resolve) => this.waitingTakers.push(resolve));
    }
    const item = this.items.shift();
    const putter = this.waitingPutters.shift();
    if (putter) putter();
    return item;
  }

  close() {
    this.closed = true;
    this.waitingTakers.splice(0).forEach((wake) => wake());
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const buffer = new AsyncBoundedQueue(3);
  let sum = 0;

  const producer = (async () => {
    for (let i = 1; i <= 10; i++) await buffer.put(i);
    buffer.close();
  })();

  const consumer = (async () => {
    for (;;) {
      const item = await buffer.take();
      if (item === undefined) break;
      await sleep(5);                 // slow consumer: producer waits on a full buffer
      sum += item;
      console.log("consumed " + item);
    }
  })();

  await Promise.all([producer, consumer]);
  console.log("done, sum = " + sum);
}

main();
`,
      go: String.raw`package main

import (
	"fmt"
	"time"
)

func main() {
	buffer := make(chan int, 3) // buffered channel = bounded blocking queue
	done := make(chan int)

	go func() { // producer
		for i := 1; i <= 10; i++ {
			buffer <- i // blocks while the buffer is full
		}
		close(buffer) // tells the consumer there is no more work
	}()

	go func() { // consumer
		sum := 0
		for item := range buffer { // blocks while empty; ends after close
			time.Sleep(5 * time.Millisecond)
			sum += item
			fmt.Println("consumed", item)
		}
		done <- sum
	}()

	fmt.Println("done, sum =", <-done)
}
`,
    },
    singleton: {
      title: "Thread-safe lazy singleton",
      java: String.raw`import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public class ConfigDemo {
    static final AtomicInteger constructed = new AtomicInteger();

    static final class Config {
        // volatile is REQUIRED: without it another thread may see a half-built object.
        private static volatile Config instance;

        private Config() { constructed.incrementAndGet(); }

        static Config getInstance() {
            Config local = instance;              // 1st check, no lock (fast path)
            if (local == null) {
                synchronized (Config.class) {
                    local = instance;             // 2nd check, under the lock
                    if (local == null) {
                        local = new Config();
                        instance = local;
                    }
                }
            }
            return local;
        }
    }
    // Simpler alternatives: "enum Config { INSTANCE }" or a static holder class.

    public static void main(String[] args) throws InterruptedException {
        Set<Config> seen = ConcurrentHashMap.newKeySet();
        Thread[] ts = new Thread[8];
        for (int i = 0; i < ts.length; i++) {
            ts[i] = new Thread(() -> seen.add(Config.getInstance()));
            ts[i].start();
        }
        for (Thread t : ts) t.join();
        System.out.println("distinct instances: " + seen.size());
        System.out.println("constructor calls : " + constructed.get());
    }
}
`,
      python: String.raw`import threading


class Config:
    _instance = None
    _lock = threading.Lock()
    constructed = 0

    def __init__(self):
        Config.constructed += 1   # only ever runs inside the lock below

    @classmethod
    def get_instance(cls):
        if cls._instance is None:            # 1st check, no lock (fast path)
            with cls._lock:
                if cls._instance is None:    # 2nd check, under the lock
                    cls._instance = cls()
        return cls._instance
# Simplest Pythonic alternative: create one object at module import time (imports run once).


seen = set()
seen_lock = threading.Lock()


def worker():
    inst = Config.get_instance()
    with seen_lock:
        seen.add(id(inst))


threads = [threading.Thread(target=worker) for _ in range(8)]
for t in threads:
    t.start()
for t in threads:
    t.join()
print("distinct instances:", len(seen))
print("constructor calls :", Config.constructed)
`,
      cpp: String.raw`#include <atomic>
#include <iostream>
#include <mutex>
#include <set>
#include <thread>
#include <vector>

std::atomic<int> constructed{0};

class Config {
public:
    // Since C++11 a function-local static is initialised exactly once, thread-safely
    // ("magic statics"). No double-checked locking needed.
    static Config& instance() {
        static Config inst;
        return inst;
    }
    Config(const Config&) = delete;
    Config& operator=(const Config&) = delete;

private:
    Config() { constructed.fetch_add(1); }
};

int main() {
    std::set<const Config*> seen;
    std::mutex seenMutex;
    std::vector<std::thread> ts;
    for (int i = 0; i < 8; ++i) {
        ts.emplace_back([&] {
            const Config* p = &Config::instance();
            std::lock_guard<std::mutex> g(seenMutex);
            seen.insert(p);
        });
    }
    for (auto& t : ts) t.join();
    std::cout << "distinct instances: " << seen.size() << "\n";
    std::cout << "constructor calls : " << constructed.load() << "\n";
}
`,
      javascript: String.raw`// One thread, so a plain "if (!instance) instance = new Config()" is safe when the
// constructor is synchronous. The race appears when initialisation is ASYNC:
// two callers both see "not loaded yet" and both start loading.
let constructed = 0;

class Config {
  static async load() {
    await new Promise((resolve) => setTimeout(resolve, 10)); // e.g. read a remote config
    constructed++;
    return new Config();
  }
}

// Fix: cache the PROMISE, not the result. Every caller awaits the same load.
let instancePromise = null;
function getConfig() {
  if (!instancePromise) instancePromise = Config.load();
  return instancePromise;
}

async function main() {
  const callers = Array.from({ length: 8 }, () => getConfig());
  const results = await Promise.all(callers);
  console.log("distinct instances: " + new Set(results).size);
  console.log("constructor calls : " + constructed);
}

main();
`,
      go: String.raw`package main

import (
	"fmt"
	"sync"
	"sync/atomic"
)

type Config struct{ name string }

var (
	instance    *Config
	once        sync.Once // runs the init function exactly once, even under concurrency
	constructed atomic.Int32
)

func GetConfig() *Config {
	once.Do(func() {
		constructed.Add(1)
		instance = &Config{name: "app-config"}
	})
	return instance
}

func main() {
	var wg sync.WaitGroup
	var mu sync.Mutex
	seen := map[*Config]bool{}
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c := GetConfig()
			mu.Lock()
			seen[c] = true
			mu.Unlock()
		}()
	}
	wg.Wait()
	fmt.Println("distinct instances:", len(seen))
	fmt.Println("constructor calls :", constructed.Load())
}
`,
    },
  },
  diagrams: {
    model: String.raw`flowchart TB
      subgraph P["Process (own address space)"]
        H[("Shared heap: objects, globals")]
        T1["Thread 1: own stack + PC"]
        T2["Thread 2: own stack + PC"]
        T3["Thread 3: own stack + PC"]
        T1 <--> H
        T2 <--> H
        T3 <--> H
      end
      P2["Another process (separate memory)"]
      P <-. "pipes, sockets" .-> P2`,
    lost: String.raw`sequenceDiagram
      participant T1 as Thread 1
      participant C as count (in memory)
      participant T2 as Thread 2
      T1->>C: read count
      C-->>T1: 5
      T2->>C: read count
      C-->>T2: 5
      Note over T1: compute 5 + 1
      Note over T2: compute 5 + 1
      T1->>C: write 6
      T2->>C: write 6
      Note over C: Expected 7, got 6: one update lost`,
    pc: String.raw`flowchart LR
      P1[Producer 1] -->|"put (waits if full)"| Q[["Bounded queue, capacity N"]]
      P2[Producer 2] -->|put| Q
      Q -->|"take (waits if empty)"| C1[Consumer 1]
      Q -->|take| C2[Consumer 2]
      Q -->|take| C3[Consumer 3]`,
    pool: String.raw`flowchart LR
      R["Incoming requests"] --> S{"Queue full?"}
      S -->|no| Q[["Task queue (bounded)"]]
      S -->|yes| X["Reject: 429 / 503 or run on caller"]
      Q --> W1[Worker 1]
      Q --> W2[Worker 2]
      Q --> W3["Worker N"]
      W1 --> D[("DB / services")]
      W2 --> D
      W3 --> D`,
  },
});
