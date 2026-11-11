SD.register({
  id: "message-queues",
  html: String.raw`
    <p class="lead">A message queue lets one service hand work to another without waiting for it to finish.
    The producer drops a message into a broker (Kafka, RabbitMQ, SQS) and moves on; consumers pick it up when
    they are ready. This one idea gives you loose coupling, absorbs traffic spikes, and lets many teams react to
    the same event. It also brings new problems: duplicates, ordering, and poison messages. Interviewers probe
    exactly those.</p>

    <h2>Sync vs async communication</h2>
    <p>In <strong>synchronous</strong> communication (REST, gRPC) the caller waits for the reply. If you place an
    order on Swiggy and the order service calls payment, then notification, then analytics, one after another,
    the user waits for all of them. Worse, if the analytics service is down, the order fails.</p>
    <p>In <strong>asynchronous</strong> communication the order service writes one event,
    <code>OrderPlaced</code>, to a queue and returns. Each downstream service consumes it at its own pace.</p>
    <div data-diagram="syncAsync" data-caption="Synchronous chain (top) vs one event fanned out asynchronously (bottom)"></div>
    <div class="grid-2">
      <div class="card good"><strong>What async buys you</strong>
        <ul>
          <li><strong>Decoupling</strong>: the producer does not know who consumes.</li>
          <li><strong>Spike absorption</strong>: a 10x burst at 8 pm dinner rush sits in the queue instead of crushing the DB.</li>
          <li><strong>Fault isolation</strong>: if notifications are down, orders still go through; messages wait.</li>
          <li><strong>Independent scaling</strong>: add consumers only where the work is heavy.</li>
        </ul>
      </div>
      <div class="card bad"><strong>What it costs you</strong>
        <ul>
          <li><strong>Eventual consistency</strong>: the email may arrive a few seconds later.</li>
          <li><strong>Duplicates and reordering</strong> you must design for.</li>
          <li><strong>Harder debugging</strong>: a request is now spread across many hops (use trace IDs).</li>
          <li>One more piece of infrastructure to run and monitor.</li>
        </ul>
      </div>
    </div>
    <div class="callout tip"><strong>Rule of thumb</strong>Keep the user-facing critical path synchronous only for
    what the user must see right now (for example, "payment authorised"). Push everything else (emails, analytics,
    search indexing, loyalty points) to a queue.</div>

    <h2>What it is: point-to-point vs pub/sub</h2>
    <p>Three roles: a <strong>producer</strong> publishes messages, a <strong>broker</strong> stores them durably,
    and a <strong>consumer</strong> reads and processes them. There are two delivery models.</p>
    <figure class="svg-fig">
      <svg viewBox="0 0 760 270">
        <text x="190" y="24" class="s-title" text-anchor="middle">Point-to-point (work queue)</text>
        <rect x="20" y="105" width="100" height="50" rx="10" class="s-box"/>
        <text x="70" y="135" class="s-text" text-anchor="middle">Producer</text>
        <rect x="150" y="105" width="110" height="50" rx="10" class="s-accent"/>
        <text x="205" y="135" class="s-text" text-anchor="middle">Queue</text>
        <rect x="290" y="45" width="90" height="40" rx="10" class="s-box"/>
        <text x="335" y="70" class="s-text" text-anchor="middle">Worker 1</text>
        <rect x="290" y="110" width="90" height="40" rx="10" class="s-box"/>
        <text x="335" y="135" class="s-text" text-anchor="middle">Worker 2</text>
        <rect x="290" y="175" width="90" height="40" rx="10" class="s-box"/>
        <text x="335" y="200" class="s-text" text-anchor="middle">Worker 3</text>
        <line x1="120" y1="130" x2="148" y2="130" class="s-line" marker-end="url(#arrow)"/>
        <line x1="260" y1="122" x2="288" y2="68" class="s-line" marker-end="url(#arrow)"/>
        <line x1="260" y1="130" x2="288" y2="130" class="s-line" marker-end="url(#arrow)"/>
        <line x1="260" y1="138" x2="288" y2="192" class="s-line" marker-end="url(#arrow)"/>
        <text x="200" y="250" class="s-muted" text-anchor="middle">each message goes to exactly ONE worker</text>

        <text x="575" y="24" class="s-title" text-anchor="middle">Publish / subscribe</text>
        <rect x="400" y="105" width="100" height="50" rx="10" class="s-box"/>
        <text x="450" y="135" class="s-text" text-anchor="middle">Order svc</text>
        <rect x="530" y="105" width="100" height="50" rx="10" class="s-accent"/>
        <text x="580" y="135" class="s-text" text-anchor="middle">Topic</text>
        <rect x="655" y="45" width="95" height="40" rx="10" class="s-green"/>
        <text x="702" y="70" class="s-text" text-anchor="middle">Payment</text>
        <rect x="655" y="110" width="95" height="40" rx="10" class="s-green"/>
        <text x="702" y="135" class="s-text" text-anchor="middle">Notify</text>
        <rect x="655" y="175" width="95" height="40" rx="10" class="s-green"/>
        <text x="702" y="200" class="s-text" text-anchor="middle">Analytics</text>
        <line x1="500" y1="130" x2="528" y2="130" class="s-line" marker-end="url(#arrow)"/>
        <line x1="630" y1="122" x2="653" y2="68" class="s-line" marker-end="url(#arrow)"/>
        <line x1="630" y1="130" x2="653" y2="130" class="s-line" marker-end="url(#arrow)"/>
        <line x1="630" y1="138" x2="653" y2="192" class="s-line" marker-end="url(#arrow)"/>
        <text x="575" y="250" class="s-muted" text-anchor="middle">every subscriber gets its OWN copy</text>
      </svg>
      <figcaption>Work queue: competing consumers share the load. Pub/sub: each subscriber sees every message.</figcaption>
    </figure>
    <ul>
      <li><strong>Point-to-point</strong> (work queue): use for jobs like "resize this image" or "send this SMS". Add workers to go faster.</li>
      <li><strong>Pub/sub</strong>: use for events like "order placed" that several independent teams care about.</li>
    </ul>
    <p>Kafka combines both: every <em>consumer group</em> gets every message (pub/sub), and inside one group the
    partitions are split among members (work queue).</p>

    <h2>How Kafka works (interview depth)</h2>
    <p>Kafka is a distributed, append-only <strong>log</strong>. Messages are not deleted when read; consumers just
    remember how far they have read.</p>
    <h3>Topics, partitions and offsets</h3>
    <ul>
      <li>A <strong>topic</strong> is a named stream, like <code>orders</code>.</li>
      <li>A topic is split into <strong>partitions</strong>. Each partition is an ordered, append-only log stored on one broker (plus replicas). Partitions are the unit of parallelism.</li>
      <li>Every message in a partition gets an increasing <strong>offset</strong> (0, 1, 2, ...). A consumer commits the offset it has processed, so after a crash it resumes from there.</li>
      <li>The producer picks the partition with <code>hash(key) % partitions</code>. Same key, same partition.</li>
    </ul>
    <div data-diagram="kafka" data-caption="A topic with 3 partitions consumed by two independent consumer groups"></div>
    <h3>Consumer groups</h3>
    <p>Each partition is read by <strong>at most one consumer per group</strong>. With 3 partitions and 3 consumers,
    each consumer gets one partition. Add a 4th consumer and it sits idle. So the partition count caps your
    parallelism: pick it generously (for example 12 to 48) at topic creation, because adding partitions later
    changes the key-to-partition mapping. When consumers join or leave, the group <strong>rebalances</strong>
    partitions among members.</p>
    <h3>Ordering</h3>
    <p>Kafka guarantees order <strong>only within a partition</strong>, never across a whole topic. If all events for
    order #123 must be processed in order (<code>CREATED</code> then <code>PAID</code> then <code>DELIVERED</code>),
    use <code>orderId</code> as the message key. Different orders still run in parallel on different partitions.</p>
    <h3>Retention</h3>
    <p>Messages stay for a configured time or size (for example 7 days), whether or not anyone read them. This
    allows <strong>replay</strong>: a new analytics service can start from offset 0 and rebuild its data. A
    <em>compacted</em> topic keeps only the latest value per key, which is useful for "current state" streams.</p>
    <h3>Replication and ISR</h3>
    <p>Each partition has one <strong>leader</strong> and N-1 <strong>followers</strong> (replication factor 3 is
    the norm). Producers and consumers talk to the leader. Followers that are fully caught up form the
    <strong>ISR</strong> (in-sync replicas). If the leader dies, a member of the ISR becomes leader, so no
    acknowledged write is lost.</p>
    <table>
      <thead><tr><th>Producer <code>acks</code></th><th>Meaning</th><th>Risk</th></tr></thead>
      <tbody>
        <tr><td><code>acks=0</code></td><td>Fire and forget</td><td>Lose messages silently</td></tr>
        <tr><td><code>acks=1</code></td><td>Leader wrote it</td><td>Lost if the leader dies before followers copy it</td></tr>
        <tr><td><code>acks=all</code> + <code>min.insync.replicas=2</code></td><td>All ISR members wrote it</td><td>Durable; slightly higher latency</td></tr>
      </tbody>
    </table>
    <div class="callout info"><strong>Why Kafka is fast</strong>Sequential disk appends, batching, compression, the OS
    page cache, and zero-copy transfer from disk to socket. A modest cluster handles millions of messages per second.</div>

    <h2>RabbitMQ: smart broker, routing first</h2>
    <p>RabbitMQ is a classic message broker (AMQP protocol). Producers never write to a queue directly; they publish
    to an <strong>exchange</strong>, which routes messages to queues through <strong>bindings</strong>. Once a
    consumer acknowledges a message, it is deleted.</p>
    <div data-diagram="rabbit" data-caption="A topic exchange routing by pattern on the routing key"></div>
    <table>
      <thead><tr><th>Exchange type</th><th>Routes to</th><th>Example</th></tr></thead>
      <tbody>
        <tr><td>Direct</td><td>Queues whose binding key equals the routing key</td><td><code>sms</code> to the SMS queue</td></tr>
        <tr><td>Topic</td><td>Pattern match (<code>*</code> one word, <code>#</code> many)</td><td><code>order.*.blr</code></td></tr>
        <tr><td>Fanout</td><td>Every bound queue</td><td>Broadcast cache invalidation</td></tr>
        <tr><td>Headers</td><td>Match on message headers</td><td>Rarely used</td></tr>
      </tbody>
    </table>
    <p>RabbitMQ pushes messages to consumers. The <strong>prefetch</strong> count limits how many unacknowledged
    messages one consumer holds, which is a simple form of backpressure.</p>

    <h2>Amazon SQS: managed and simple</h2>
    <p>SQS is a fully managed queue: no brokers to run, near-unlimited throughput. Consumers <strong>poll</strong>
    (use long polling, up to 20 s, to cut empty responses). The key idea is the <strong>visibility timeout</strong>:
    a received message is hidden, not deleted. If the consumer deletes it in time, it is gone. If the consumer
    crashes, the message reappears and someone else processes it.</p>
    <div data-diagram="sqs" data-caption="Visibility timeout: a crashed consumer's message becomes visible again"></div>
    <ul>
      <li><strong>Standard queue</strong>: at-least-once, best-effort ordering, nearly unlimited throughput.</li>
      <li><strong>FIFO queue</strong>: strict order per <em>message group id</em> and deduplication within 5 minutes, at lower throughput.</li>
      <li>Set the visibility timeout above your worst-case processing time (for example 6x the p99), or you get duplicates.</li>
      <li>SQS + SNS gives pub/sub: SNS fans one message out to many SQS queues.</li>
    </ul>

    <h2>Delivery semantics</h2>
    <table>
      <thead><tr><th>Guarantee</th><th>How it happens</th><th>Good for</th></tr></thead>
      <tbody>
        <tr><td><strong>At-most-once</strong></td><td>Ack (commit offset) <em>before</em> processing. Crash = message lost.</td><td>Metrics, logs where loss is fine</td></tr>
        <tr><td><strong>At-least-once</strong></td><td>Ack <em>after</em> processing. Crash after work but before ack = redelivered.</td><td>The default for almost everything</td></tr>
        <tr><td><strong>Exactly-once</strong></td><td>Kafka transactions + idempotent producer, within Kafka only. End to end, you fake it with at-least-once + idempotent consumers.</td><td>Payments, ledgers, counters</td></tr>
      </tbody>
    </table>
    <div class="callout warn"><strong>Exactly-once is (mostly) a myth across systems</strong>Once a consumer calls an
    external system (a bank API, an email provider), the broker cannot make that side effect happen exactly once. What
    you build is <em>effectively-once</em>: at-least-once delivery plus idempotent processing.</div>
    <h3>Idempotent consumers</h3>
    <p>An operation is <strong>idempotent</strong> if doing it twice has the same effect as doing it once. Ways to get there:</p>
    <ol class="steps">
      <li>Give every message a unique id (for example <code>eventId</code> or <code>orderId + type</code>).</li>
      <li>Keep a <code>processed_messages</code> table with a unique constraint on that id.</li>
      <li>In <strong>one DB transaction</strong>, insert the id and apply the business change. A duplicate fails the insert and is skipped.</li>
      <li>Or make the write naturally idempotent: <code>UPDATE orders SET status='PAID' WHERE id=123</code> is safe to repeat; <code>balance = balance + 100</code> is not.</li>
    </ol>
    <p>Razorpay-style payment APIs expose an <strong>idempotency key</strong> header for the same reason.</p>
    <div class="callout info"><strong>The dual-write problem</strong>"Save order to DB, then publish to Kafka" can fail
    halfway. The <strong>transactional outbox</strong> pattern fixes it: write the event into an <code>outbox</code> table
    in the same DB transaction as the order, and let a relay (or CDC tool like Debezium) publish it.</div>

    <h2>Dead-letter queues and retries</h2>
    <p>A <strong>poison message</strong> (bad JSON, a deleted user) fails every time. Retrying forever blocks the
    queue or burns CPU. So:</p>
    <ul>
      <li>Retry with <strong>exponential backoff and jitter</strong> (1 s, 2 s, 4 s ...) for transient errors.</li>
      <li>After N attempts (say 5), move it to a <strong>dead-letter queue (DLQ)</strong>. SQS does this with a redrive policy; RabbitMQ with a dead-letter exchange; in Kafka you publish to a <code>orders.DLQ</code> topic yourself.</li>
      <li>Alert on DLQ depth, fix the bug, then <strong>redrive</strong> messages back to the main queue.</li>
    </ul>

    <h2>Backpressure</h2>
    <p><strong>Backpressure</strong> means a slow consumer can signal "slow down" instead of being overwhelmed.
    A queue is a buffer, and every buffer must be bounded or it eventually eats all memory or disk.</p>
    <ul>
      <li><strong>Bounded queues</strong>: producers block or get an error when full (see the code below).</li>
      <li><strong>Pull-based consumers</strong> (Kafka, SQS) naturally read only what they can handle; the backlog shows up as <strong>consumer lag</strong>, the gap between the latest offset and the committed offset. Alert on it and autoscale on it.</li>
      <li><strong>Load shedding</strong>: under extreme load, drop low-priority work (analytics) before high-priority work (payments).</li>
    </ul>
    <h3>Code: a bounded producer–consumer queue</h3>
    <p>The heart of every broker is a thread-safe bounded buffer. Producers block when it is full (backpressure),
    workers block when it is empty, and closing the queue lets workers drain and exit cleanly.</p>
    <div data-code="boundedQueue"></div>

    <h2>Kafka vs RabbitMQ vs SQS</h2>
    <table>
      <thead><tr><th></th><th>Kafka</th><th>RabbitMQ</th><th>SQS</th></tr></thead>
      <tbody>
        <tr><td>Model</td><td>Distributed log</td><td>Smart broker, queues</td><td>Managed queue</td></tr>
        <tr><td>After consume</td><td>Kept until retention ends</td><td>Deleted on ack</td><td>Deleted on delete call</td></tr>
        <tr><td>Replay</td><td>Yes (reset offset)</td><td>No</td><td>No</td></tr>
        <tr><td>Ordering</td><td>Per partition</td><td>Per queue (single consumer)</td><td>FIFO queues only, per group</td></tr>
        <tr><td>Throughput</td><td>Millions/s</td><td>Tens of thousands/s per node</td><td>Practically unlimited (standard)</td></tr>
        <tr><td>Routing</td><td>By topic and key only</td><td>Rich (exchanges)</td><td>None (use SNS for fan-out)</td></tr>
        <tr><td>Delivery</td><td>Pull</td><td>Push (with prefetch)</td><td>Pull (long polling)</td></tr>
        <tr><td>Ops effort</td><td>High (or use MSK / Confluent)</td><td>Medium</td><td>None</td></tr>
        <tr><td>Pick it for</td><td>Event streaming, analytics, many consumers, replay</td><td>Task queues, complex routing, per-message acks</td><td>Simple decoupling on AWS</td></tr>
      </tbody>
    </table>

    <h2>Real-world example: order placed</h2>
    <p>At Swiggy or Flipkart, placing an order triggers a cascade. The order service saves the order and emits one
    <code>OrderPlaced</code> event keyed by <code>orderId</code>. Each team owns a consumer group.</p>
    <div data-diagram="orderFlow" data-caption="One OrderPlaced event drives payment, notifications, analytics and more"></div>
    <ul>
      <li><strong>Payment</strong> confirms the charge and emits <code>PaymentSucceeded</code> or <code>PaymentFailed</code>, which the order service consumes (a choreographed saga).</li>
      <li><strong>Notification</strong> sends push / SMS / email; a slow SMS vendor never slows checkout.</li>
      <li><strong>Analytics</strong> streams into a data lake for dashboards; it can replay a week of events after a bug fix.</li>
      <li><strong>Restaurant / seller</strong> service alerts the kitchen or warehouse.</li>
    </ul>
    <p>LinkedIn (where Kafka was born), Uber, Netflix and Flipkart run Kafka at trillions of messages per day.
    Zomato and Swiggy use Kafka for order events and real-time delivery-partner location streams.</p>

    <h2>Interview questions and pitfalls</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>"I'll put a Kafka topic between the order
    service and its downstream consumers, keyed by <code>orderId</code> so events for one order stay ordered. Delivery is
    at-least-once, so every consumer is idempotent using the event id with a unique constraint. Failures retry with
    backoff and land in a DLQ after five attempts. I'll alert on consumer lag and DLQ depth."</div>
    <ul>
      <li><strong>"How do you guarantee ordering?"</strong> Per key, via partitioning. Global order needs a single partition, which kills throughput, so challenge the requirement.</li>
      <li><strong>"What if the consumer crashes mid-way?"</strong> The offset was not committed (or the visibility timeout expires), so the message is redelivered. Hence idempotency.</li>
      <li><strong>"How many partitions?"</strong> Target throughput / per-consumer throughput, with headroom. For 50k msgs/s at 2k msgs/s per consumer: at least 25, so pick 32 or 48.</li>
      <li><strong>Pitfall</strong>: using a queue for a request that needs an immediate answer (like a login check). Queues are for work that can happen later.</li>
      <li><strong>Pitfall</strong>: a hot key (one celebrity restaurant) overloading one partition. Mitigate by splitting the key or adding a suffix where order does not matter.</li>
    </ul>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>A Kafka topic has 6 partitions and your consumer group has 10 consumers. What happens?</summary>
        <div>Only 6 consumers get a partition; 4 sit idle. A partition is consumed by at most one member of a group. To use all 10, increase partitions (aware that the key-to-partition mapping changes).</div></details>
      <details><summary>Why does Kafka keep messages after they are consumed, and why is that useful?</summary>
        <div>It is a log, not a queue: consumers track their own offsets. Retention lets new consumers start from the beginning, lets you replay after a bug fix, and lets many groups read the same data independently.</div></details>
      <details><summary>Your SQS consumer takes 90 s for some jobs but the visibility timeout is 30 s. What goes wrong?</summary>
        <div>The message becomes visible again after 30 s while still being processed, so a second consumer picks it up: duplicate processing. Raise the timeout above worst-case processing time, or extend it with <code>ChangeMessageVisibility</code> as a heartbeat.</div></details>
      <details><summary>How do you make "credit Rs 100 cashback" safe under at-least-once delivery?</summary>
        <div>Store the event id in a processed-events table with a unique constraint and apply the credit in the same transaction. A redelivered message fails the unique insert and is skipped. Never apply a bare <code>balance + 100</code> without that guard.</div></details>
      <details><summary>When would you pick RabbitMQ over Kafka?</summary>
        <div>For task queues needing per-message acks, priorities, delayed messages or rich routing (topic/headers exchanges) at moderate scale, where replay is not needed. Kafka wins for high-throughput event streams, many consumer groups and replay.</div></details>
      <details><summary>What is a dead-letter queue and what should you do with it?</summary>
        <div>A separate queue where messages go after N failed attempts, so poison messages do not block or loop forever. Alert on its depth, inspect and fix the cause, then redrive the messages to the main queue.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>Queues decouple services, absorb spikes and isolate failures, at the cost of eventual consistency.</li>
      <li>Point-to-point splits work among workers; pub/sub gives every subscriber its own copy.</li>
      <li>Kafka = partitioned, replicated log. Order is per partition, parallelism is capped by partition count, retention allows replay.</li>
      <li>RabbitMQ routes with exchanges and deletes on ack; SQS hides messages with a visibility timeout.</li>
      <li>Assume at-least-once delivery and make consumers idempotent. "Exactly-once" end to end is idempotency in disguise.</li>
      <li>Bound every queue, watch consumer lag, retry with backoff, and park poison messages in a DLQ.</li>
    </ul></div>
  `,
  code: {
    boundedQueue: {
      title: "Bounded producer–consumer queue with worker threads",
      java: String.raw`import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

public class Main {
    /** A blocking FIFO queue with a fixed capacity (the core of any broker). */
    static class BoundedQueue<T> {
        private final ArrayDeque<T> items = new ArrayDeque<>();
        private final int capacity;
        private final ReentrantLock lock = new ReentrantLock();
        private final Condition notFull = lock.newCondition();
        private final Condition notEmpty = lock.newCondition();
        private boolean closed = false;

        BoundedQueue(int capacity) { this.capacity = capacity; }

        /** Blocks while the queue is full: this is backpressure. */
        void put(T item) throws InterruptedException {
            lock.lock();
            try {
                while (items.size() == capacity && !closed) notFull.await();
                if (closed) throw new IllegalStateException("queue closed");
                items.addLast(item);
                notEmpty.signal();
            } finally {
                lock.unlock();
            }
        }

        /** Blocks while empty. Returns null once closed and fully drained. */
        T take() throws InterruptedException {
            lock.lock();
            try {
                while (items.isEmpty() && !closed) notEmpty.await();
                if (items.isEmpty()) return null;
                T item = items.removeFirst();
                notFull.signal();
                return item;
            } finally {
                lock.unlock();
            }
        }

        void close() {
            lock.lock();
            try {
                closed = true;
                notEmpty.signalAll();
                notFull.signalAll();
            } finally {
                lock.unlock();
            }
        }
    }

    static final class Order {
        final int id, amount;
        Order(int id, int amount) { this.id = id; this.amount = amount; }
    }

    public static void main(String[] args) throws InterruptedException {
        BoundedQueue<Order> queue = new BoundedQueue<>(5);
        List<Thread> workers = new ArrayList<>();

        for (int w = 1; w <= 3; w++) {
            final int workerId = w;
            Thread t = new Thread(() -> {
                try {
                    Order o;
                    while ((o = queue.take()) != null) {
                        Thread.sleep(10); // simulate work (call payment service, etc.)
                        System.out.printf("worker-%d processed order %d (Rs %d)%n", workerId, o.id, o.amount);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            });
            workers.add(t);
            t.start();
        }

        for (int i = 1; i <= 12; i++) {
            queue.put(new Order(i, i * 100)); // blocks whenever 5 orders are waiting
        }

        queue.close(); // no more orders; workers drain what is left and exit
        for (Thread t : workers) t.join();
        System.out.println("all orders processed");
    }
}`,
      python: String.raw`import threading
import time
from collections import deque


class BoundedQueue:
    """A blocking FIFO queue with a fixed capacity (the core of any broker)."""

    def __init__(self, capacity):
        self._items = deque()
        self._capacity = capacity
        self._lock = threading.Lock()
        self._not_full = threading.Condition(self._lock)
        self._not_empty = threading.Condition(self._lock)
        self._closed = False

    def put(self, item):
        """Blocks while the queue is full: this is backpressure."""
        with self._not_full:
            while len(self._items) == self._capacity and not self._closed:
                self._not_full.wait()
            if self._closed:
                raise RuntimeError("queue closed")
            self._items.append(item)
            self._not_empty.notify()

    def take(self):
        """Blocks while empty. Returns None once closed and fully drained."""
        with self._not_empty:
            while not self._items and not self._closed:
                self._not_empty.wait()
            if not self._items:
                return None
            item = self._items.popleft()
            self._not_full.notify()
            return item

    def close(self):
        with self._lock:
            self._closed = True
            self._not_empty.notify_all()
            self._not_full.notify_all()


def worker(worker_id, queue):
    while (order := queue.take()) is not None:
        time.sleep(0.01)  # simulate work (call payment service, etc.)
        print(f"worker-{worker_id} processed order {order['id']} (Rs {order['amount']})")


if __name__ == "__main__":
    queue = BoundedQueue(capacity=5)
    workers = [threading.Thread(target=worker, args=(w, queue)) for w in range(1, 4)]
    for t in workers:
        t.start()

    for i in range(1, 13):  # producer: blocks whenever 5 orders are waiting
        queue.put({"id": i, "amount": i * 100})

    queue.close()  # no more orders; workers drain what is left and exit
    for t in workers:
        t.join()
    print("all orders processed")`,
      cpp: String.raw`#include <chrono>
#include <condition_variable>
#include <deque>
#include <iostream>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <thread>
#include <vector>

// A blocking FIFO queue with a fixed capacity (the core of any broker).
template <typename T>
class BoundedQueue {
public:
    explicit BoundedQueue(std::size_t capacity) : capacity_(capacity) {}

    // Blocks while the queue is full: this is backpressure.
    void put(T item) {
        std::unique_lock<std::mutex> lock(mu_);
        notFull_.wait(lock, [&] { return items_.size() < capacity_ || closed_; });
        if (closed_) throw std::runtime_error("queue closed");
        items_.push_back(std::move(item));
        notEmpty_.notify_one();
    }

    // Blocks while empty. Returns std::nullopt once closed and drained.
    std::optional<T> take() {
        std::unique_lock<std::mutex> lock(mu_);
        notEmpty_.wait(lock, [&] { return !items_.empty() || closed_; });
        if (items_.empty()) return std::nullopt;
        T item = std::move(items_.front());
        items_.pop_front();
        notFull_.notify_one();
        return item;
    }

    void close() {
        std::lock_guard<std::mutex> lock(mu_);
        closed_ = true;
        notEmpty_.notify_all();
        notFull_.notify_all();
    }

private:
    std::deque<T> items_;
    std::size_t capacity_;
    std::mutex mu_;
    std::condition_variable notFull_, notEmpty_;
    bool closed_ = false;
};

struct Order {
    int id;
    int amount;
};

int main() {
    BoundedQueue<Order> queue(5);
    std::mutex printMu;
    std::vector<std::thread> workers;

    for (int w = 1; w <= 3; ++w) {
        workers.emplace_back([&queue, &printMu, w] {
            while (auto order = queue.take()) {
                std::this_thread::sleep_for(std::chrono::milliseconds(10));  // simulate work
                std::lock_guard<std::mutex> lock(printMu);
                std::cout << "worker-" << w << " processed order " << order->id
                          << " (Rs " << order->amount << ")\n";
            }
        });
    }

    for (int i = 1; i <= 12; ++i) queue.put(Order{i, i * 100});  // blocks when 5 are waiting

    queue.close();  // no more orders; workers drain the rest and exit
    for (auto& t : workers) t.join();
    std::cout << "all orders processed\n";
}`,
      javascript: String.raw`// Bounded async queue. JavaScript is single-threaded, so "workers" are
// async functions that interleave on the event loop while awaiting I/O.
class BoundedQueue {
  constructor(capacity) {
    this.capacity = capacity;
    this.items = [];
    this.waitingTakers = []; // resolvers for consumers waiting on an empty queue
    this.waitingPutters = []; // resolvers for producers waiting on a full queue
    this.closed = false;
  }

  // Resolves only when there is room: this is backpressure.
  async put(item) {
    while (this.items.length >= this.capacity && !this.closed) {
      await new Promise((resolve) => this.waitingPutters.push(resolve));
    }
    if (this.closed) throw new Error("queue closed");
    this.items.push(item);
    const taker = this.waitingTakers.shift();
    if (taker) taker();
  }

  // Resolves with the next item, or null once closed and drained.
  async take() {
    while (this.items.length === 0 && !this.closed) {
      await new Promise((resolve) => this.waitingTakers.push(resolve));
    }
    if (this.items.length === 0) return null;
    const item = this.items.shift();
    const putter = this.waitingPutters.shift();
    if (putter) putter();
    return item;
  }

  close() {
    this.closed = true;
    this.waitingTakers.splice(0).forEach((wake) => wake());
    this.waitingPutters.splice(0).forEach((wake) => wake());
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function worker(id, queue) {
  let order;
  while ((order = await queue.take()) !== null) {
    await sleep(10); // simulate work (call payment service, etc.)
    console.log("worker-" + id + " processed order " + order.id + " (Rs " + order.amount + ")");
  }
}

async function main() {
  const queue = new BoundedQueue(5);
  const workers = [1, 2, 3].map((id) => worker(id, queue));

  for (let i = 1; i <= 12; i++) {
    await queue.put({ id: i, amount: i * 100 }); // waits whenever 5 orders are queued
  }

  queue.close(); // no more orders; workers drain the rest and exit
  await Promise.all(workers);
  console.log("all orders processed");
}

main();`,
      go: String.raw`package main

import (
	"fmt"
	"sync"
	"time"
)

type Order struct {
	ID     int
	Amount int
}

func worker(id int, orders <-chan Order, wg *sync.WaitGroup) {
	defer wg.Done()
	// range keeps receiving until the channel is closed AND drained.
	for o := range orders {
		time.Sleep(10 * time.Millisecond) // simulate work (call payment service, etc.)
		fmt.Printf("worker-%d processed order %d (Rs %d)\n", id, o.ID, o.Amount)
	}
}

func main() {
	// A buffered channel IS a bounded, thread-safe FIFO queue in Go.
	// Sending blocks when 5 items are waiting: built-in backpressure.
	orders := make(chan Order, 5)

	var wg sync.WaitGroup
	for w := 1; w <= 3; w++ {
		wg.Add(1)
		go worker(w, orders, &wg)
	}

	for i := 1; i <= 12; i++ {
		orders <- Order{ID: i, Amount: i * 100}
	}

	close(orders) // no more orders; workers drain the rest and exit
	wg.Wait()
	fmt.Println("all orders processed")
}`,
    },
  },
  diagrams: {
    syncAsync: String.raw`flowchart LR
  subgraph Sync["Synchronous: user waits for every call"]
    U1[User] --> O1[Order svc] --> P1[Payment] --> N1[Notify] --> A1[Analytics]
  end
  subgraph Async["Asynchronous: publish once, return fast"]
    U2[User] --> O2[Order svc] --> Q[("Queue / topic")]
    Q --> P2[Payment]
    Q --> N2[Notify]
    Q --> A2[Analytics]
  end`,
    kafka: String.raw`flowchart LR
  Prod["Producer: key = orderId"] --> P0["Partition 0: offsets 0..812"]
  Prod --> P1["Partition 1: offsets 0..790"]
  Prod --> P2["Partition 2: offsets 0..805"]
  subgraph G1["Group: payment-svc"]
    C1[Consumer 1]
    C2[Consumer 2]
  end
  subgraph G2["Group: analytics"]
    C3[Consumer A]
  end
  P0 --> C1
  P1 --> C1
  P2 --> C2
  P0 --> C3
  P1 --> C3
  P2 --> C3`,
    rabbit: String.raw`flowchart LR
  Pub[Producer] -->|"routing key: order.placed.blr"| X{{"Topic exchange"}}
  X -->|"order.placed.*"| Q1[(Payment queue)]
  X -->|"order.#"| Q2[(Audit queue)]
  X -.->|"order.cancelled.*"| Q3[(Refund queue)]
  Q1 --> W1[Payment worker]
  Q2 --> W2[Audit worker]
  Q3 --> W3[Refund worker]`,
    sqs: String.raw`sequenceDiagram
  participant A as Consumer A
  participant Q as SQS queue
  participant B as Consumer B
  A->>Q: ReceiveMessage
  Q-->>A: msg 42 (hidden for 30 s)
  Note over A: crashes before DeleteMessage
  Note over Q: 30 s pass, msg 42 visible again
  B->>Q: ReceiveMessage
  Q-->>B: msg 42 (receive count 2)
  B->>B: process
  B->>Q: DeleteMessage(42)
  Note over Q: gone for good`,
    orderFlow: String.raw`flowchart LR
  App[Customer app] --> OS[Order service]
  OS --> DB[(Orders DB + outbox)]
  DB -->|"relay / CDC"| K[("Kafka: orders topic")]
  K --> Pay[Payment group]
  K --> Notif[Notification group]
  K --> Ana[Analytics group]
  K --> Rest[Restaurant group]
  Pay -->|PaymentSucceeded| K2[("payments topic")]
  K2 --> OS
  Notif --> SMS["SMS / push vendors"]
  Ana --> Lake[(Data lake)]
  Notif -.->|"after 5 failures"| DLQ[(orders.DLQ)]`,
  },
});
