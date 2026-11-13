SD.register({
  id: "logger",
  html: String.raw`
<p class="lead">"Design a logging framework" (think a small Log4j, Logback or Python's <code>logging</code>) is a favourite LLD question because every engineer has used one and few have thought about how it works. In 60 to 90 minutes the interviewer wants to see log levels, several output destinations, pluggable formats, a registry of named loggers, and, for SDE 2, thread safety and asynchronous logging with a bounded queue. The design naturally uses Chain of Responsibility, Strategy and Singleton, and the follow-ups (what happens when the disk is slow? what if the app crashes?) test real production judgement. This page builds it end to end with runnable code in five languages.</p>

<h2>Problem statement</h2>
<p>Design a logging library that application code uses like this: <code>log = getLogger("payments")</code>, then <code>log.info("Payment captured", orderId, amount)</code>. The library must:</p>
<ul>
<li>Support levels DEBUG, INFO, WARN, ERROR and FATAL, and drop messages below a configured level.</li>
<li>Write each message to one or more destinations (console, file, an alerting channel), each with its own minimum level.</li>
<li>Format messages in different ways: a readable line for humans, JSON for machines.</li>
<li>Return the same logger for the same name, and let operators change a logger's level at runtime.</li>
<li>Be safe to call from many threads, and offer an asynchronous mode so slow disks do not slow down requests.</li>
</ul>

<div class="callout tip"><strong>Try it first</strong>Before reading on, take 10 minutes. Sketch the classes. Then answer: a request thread calls <code>log.info()</code> while the log file sits on a disk that suddenly takes 2 seconds per write. What happens to your API's latency? What would you change so it does not? And if you add a queue between the caller and the disk, what happens when the queue fills up?</div>

<details class="hint"><summary>Hint 1: Separate "where", "how" and "whether"</summary>
<p>Three things vary independently. <em>Whether</em> to log (the level threshold). <em>How</em> it looks (a formatter: plain text or JSON). <em>Where</em> it goes (a handler or appender: console, file, network). If one class does all three, every new combination needs a new class. Make each one its own small interface and compose them.</p>
</details>
<details class="hint"><summary>Hint 2: Levels form a chain</summary>
<p>A record travels past several handlers, and each decides on its own: the console shows DEBUG and up, the file keeps INFO and up, the pager only cares about ERROR. Link the handlers in a chain. Each one checks the level, writes if it should, and passes the record on. That is Chain of Responsibility.</p>
</details>
<details class="hint"><summary>Hint 3: A queue needs a policy for "full"</summary>
<p>Async logging puts records on a queue and a background worker writes them. The queue must be <em>bounded</em>, or a slow disk turns into an out-of-memory crash. When it is full you have two honest choices: block the caller (no data loss, but the app slows down) or drop the record (the app stays fast, but you lose logs). Pick one per handler and count what you drop.</p>
</details>

<h2>Requirements</h2>
<p>Good clarifying questions: Is this a library inside one process, or a central log collection service? (The second is an HLD problem.) Which outputs are needed now? Do we need structured (JSON) logs? Must logging never block the caller? Is losing some DEBUG logs under extreme load acceptable?</p>
<div class="grid-2">
<div class="card">
<h3>Functional</h3>
<ul>
<li>Levels: DEBUG &lt; INFO &lt; WARN &lt; ERROR &lt; FATAL. Each logger has a minimum level.</li>
<li>Multiple handlers (appenders) per logger, each with its own threshold and formatter.</li>
<li>Formatters: plain text line and JSON.</li>
<li>Named loggers from a registry: same name, same instance. Change a level at runtime.</li>
<li>Structured fields (key-value pairs) and context fields such as a correlation id attached to every line.</li>
<li>Async handler with a bounded queue, a block or drop policy, and a flush on shutdown.</li>
</ul>
</div>
<div class="card">
<h3>Non-functional</h3>
<ul>
<li><strong>Cheap when disabled:</strong> a DEBUG call in production should cost almost nothing.</li>
<li><strong>Thread-safe:</strong> lines from different threads never interleave mid-line.</li>
<li><strong>Low latency:</strong> in async mode the caller only pays for an enqueue (well under a microsecond).</li>
<li><strong>Bounded memory:</strong> the queue has a fixed capacity.</li>
<li><strong>No lost logs on clean shutdown:</strong> pending records are flushed.</li>
<li><strong>Extensible:</strong> new destinations and formats without changing <code>Logger</code>.</li>
<li><strong>Testable:</strong> injected clock and in-memory sinks, so tests never touch real files or real time.</li>
</ul>
</div>
</div>

<h2>How to approach the 60 to 90 minute machine-coding round</h2>
<div class="callout info"><strong>Time plan</strong>
<table>
<thead><tr><th>Minutes</th><th>What you do</th></tr></thead>
<tbody>
<tr><td>0 to 8</td><td>Clarify levels, outputs, formats, async needs. State what you skip: rolling files, network shipping, config files.</td></tr>
<tr><td>8 to 18</td><td>Draw <code>Logger</code>, <code>LogRecord</code>, <code>Handler</code> chain, <code>Formatter</code>, <code>LogManager</code>. Explain the three axes: whether, how, where.</td></tr>
<tr><td>18 to 50</td><td>Code <code>Level</code>, <code>LogRecord</code>, two formatters, the handler chain with console and memory handlers, <code>Logger</code>, <code>LogManager</code>.</td></tr>
<tr><td>50 to 70</td><td>Add the async handler: bounded queue, worker, block or drop, close that drains. Inject a clock.</td></tr>
<tr><td>70 to 90</td><td>Demo, then discuss back-pressure, crash safety, correlation ids, and Singleton pitfalls.</td></tr>
</tbody>
</table>
<p>For a 60-minute round, finish the synchronous version first and make it run. Async is the SDE 2 differentiator; a clean description of it beats half-written threading code.</p>
<p><strong>What evaluators check:</strong></p>
<ol>
<li><strong>Separation of concerns:</strong> level filter, formatter and destination are independent and composable.</li>
<li><strong>Correct level semantics:</strong> logger level and handler thresholds both apply.</li>
<li><strong>Thread safety</strong> of handlers and the registry.</li>
<li><strong>Async design:</strong> bounded queue, explicit full-queue policy, flush on shutdown.</li>
<li><strong>Testability:</strong> no real timestamps or files in the demo or tests.</li>
</ol>
</div>

<h2>Core entities</h2>
<table>
<thead><tr><th>Entity</th><th>Kind</th><th>Responsibility</th></tr></thead>
<tbody>
<tr><td><code>Level</code></td><td>Enum</td><td>DEBUG(10), INFO(20), WARN(30), ERROR(40), FATAL(50). Numbers make comparison trivial.</td></tr>
<tr><td><code>LogRecord</code></td><td>Immutable value</td><td>Timestamp, level, logger name, message, ordered list of fields. Created once, shared by all handlers.</td></tr>
<tr><td><code>Formatter</code></td><td>Interface (Strategy)</td><td><code>format(record)</code> to a string. <code>PlainFormatter</code>, <code>JsonFormatter</code>.</td></tr>
<tr><td><code>Handler</code></td><td>Abstract class (Chain of Responsibility)</td><td>Threshold, formatter, next handler. <code>handle()</code> filters and passes on; subclasses implement <code>emit()</code>.</td></tr>
<tr><td><code>ConsoleHandler</code>, <code>MemoryHandler</code></td><td>Handlers</td><td>Write to stdout, or to an in-memory list that stands in for a file in tests.</td></tr>
<tr><td><code>AsyncHandler</code></td><td>Decorator around a handler</td><td>Bounded queue plus a worker thread; BLOCK or DROP when full; <code>close()</code> drains.</td></tr>
<tr><td><code>Logger</code></td><td>Facade</td><td><code>debug/info/warn/error/fatal</code>, level check, context fields, builds the record, hands it to the chain.</td></tr>
<tr><td><code>LogManager</code></td><td>Registry (+ optional Singleton)</td><td>Name to <code>Logger</code> map, runtime level changes, shutdown.</td></tr>
<tr><td><code>Clock</code></td><td>Interface</td><td><code>nowMs()</code>. A ticking fake clock keeps demo output identical on every run.</td></tr>
</tbody>
</table>

<h2>Class diagram</h2>
<div data-diagram="classes" data-caption="A Logger builds a LogRecord and hands it to a chain of Handlers. Each Handler has a threshold and a Formatter. AsyncHandler wraps another Handler."></div>

<h2>What happens on one log call</h2>
<div data-diagram="flow" data-caption="One log.error() call. Each handler in the chain decides for itself; the async handler only enqueues."></div>
<ol class="steps">
<li><code>log.error("Payment failed", ...)</code> first compares ERROR with the logger's level. If the level is too low, it returns at once: no timestamp, no record, no string building.</li>
<li>Otherwise it reads the clock and builds one immutable <code>LogRecord</code>, adding the logger's context fields (such as a correlation id) in front of the call's own fields.</li>
<li>The record goes to the head of the handler chain. The console handler (threshold DEBUG) prints it and passes it on.</li>
<li>The file handler (threshold INFO) formats it as JSON and stores it, then passes it on.</li>
<li>The alerts handler (threshold ERROR) also keeps it. A WARN record would have skipped this handler but still reached the console and the file.</li>
</ol>

<h2>Log levels in practice</h2>
<table>
<thead><tr><th>Level</th><th>Use it for</th><th>Example</th><th>Typical production setting</th></tr></thead>
<tbody>
<tr><td>DEBUG</td><td>Detail for developers while diagnosing</td><td>"Cart details items=3 skus=..."</td><td>Off; turn on for one logger while debugging</td></tr>
<tr><td>INFO</td><td>Normal business events</td><td>"Order placed orderId=OD-1001"</td><td>On</td></tr>
<tr><td>WARN</td><td>Unexpected but handled</td><td>"Coupon expired, charged full price"</td><td>On</td></tr>
<tr><td>ERROR</td><td>A request failed</td><td>"Payment failed reason=gateway timeout"</td><td>On, and counted on dashboards</td></tr>
<tr><td>FATAL</td><td>The process cannot continue</td><td>"Cannot connect to database at startup"</td><td>On, pages the on-call engineer</td></tr>
</tbody>
</table>
<p>There are two filters, and both matter. The <strong>logger level</strong> is a cheap first gate: if <code>checkout</code> is at INFO, DEBUG calls cost one integer comparison. The <strong>handler threshold</strong> decides per destination. The demo shows the difference: after the operator switches <code>checkout</code> to DEBUG, the console shows DEBUG lines but the file still does not, because the file handler's threshold is INFO.</p>

<h2>Design patterns used and why</h2>
<h3>Chain of Responsibility: the handlers</h3>
<p>In the textbook version of this pattern, a request travels down a chain until <em>one</em> handler deals with it and stops. Logging uses the "pass-through" variant: every handler gets a chance, and each decides for itself based on its threshold. The benefits are the usual ones. The logger only knows the head of the chain. Adding a destination is linking one more node. The order is explicit (console before file before alerts).</p>
<p>Real libraries often store a <em>list</em> of handlers on each logger and loop over it (Python's <code>logging</code>, Logback's appenders). That is the same idea with a different container. Say so in the interview: it shows you understand the pattern rather than just the name. A list is easier to configure; an explicit chain makes "stop here" (for example, a filter that drops health-check logs) easy to add. See <a href="#/p/behavioral-patterns">behavioural patterns</a>.</p>
<h3>Strategy: formatters</h3>
<p>The same record can become <code>00:00:01.500 ERROR [checkout] Payment failed orderId=OD-1001</code> for a human tailing the console, or <code>{"ts":1500,"level":"ERROR","logger":"checkout",...}</code> for a log pipeline. Each handler holds a <code>Formatter</code>; swapping plain for JSON changes nothing else. A third formatter (logfmt, or a format with masking) is a new class.</p>
<h3>Decorator: the async handler</h3>
<p><code>AsyncHandler</code> wraps any other handler and adds a queue and a thread in front of it. The wrapped handler does not know it is being called from a background thread. You can wrap the file handler and leave the console handler synchronous. That is the Decorator pattern; see <a href="#/p/structural-patterns">structural patterns</a>.</p>
<h3>Registry and Singleton: getLogger(name)</h3>
<p>Code all over a codebase calls <code>getLogger("payments")</code>. They should all get the same logger, so that changing its level at runtime affects every caller. <code>LogManager</code> keeps a map from name to <code>Logger</code>, guarded by a lock (or a concurrent map), and creates loggers on first use. Real libraries also build a hierarchy from dotted names: <code>payments.upi</code> inherits its level from <code>payments</code> unless set.</p>
<p>Most libraries also expose one global manager, a Singleton, so that a class can write <code>private static final Logger log = LogManager.getLogger(...)</code> without anyone passing a manager in. The code shows the safe way to build one lazily in each language: the holder idiom in Java, a function-local static in C++, <code>sync.Once</code> in Go, double-checked locking in Python, and a module-level variable in JavaScript. See <a href="#/p/creational-patterns">creational patterns</a>.</p>
<div class="callout warn"><strong>Singleton pitfalls (say these out loud)</strong>
<ul>
<li><strong>Tests share state.</strong> One test sets a logger to DEBUG or attaches a memory handler, and the next test inherits it. Always offer a non-global <code>LogManager</code> that tests can create fresh, as the demo does.</li>
<li><strong>Hidden dependency.</strong> A class that calls a global cannot be given a different clock or handler without changing global config.</li>
<li><strong>Initialisation order.</strong> Code that logs during startup, before configuration is loaded, writes with default settings or to nowhere.</li>
<li><strong>Not really single.</strong> Two class loaders in Java, or two copies of a package in a Node <code>node_modules</code> tree, each get their own "singleton".</li>
<li><strong>Double-checked locking done wrong</strong> (without <code>volatile</code> in Java) can hand out a half-built object. Prefer the language's built-in once-only mechanism.</li>
</ul>
</div>

<h2>Structured logging and correlation ids</h2>
<p>A line like "Payment failed for order OD-1001 because gateway timeout" is easy to read but hard to query. Structured logging keeps the message short and constant ("Payment failed") and puts the variable parts in named fields (<code>orderId=OD-1001</code>, <code>reason=gateway timeout</code>). A JSON formatter writes them as keys, and a log store (Elasticsearch, Loki, CloudWatch) can then answer "all ERRORs for orderId OD-1001" or "count of reason=gateway timeout per minute" without fragile text matching.</p>
<p>A <strong>correlation id</strong> (also called a request id or trace id) is a unique id created when a request enters the system, passed to every service it touches (usually in an HTTP header like <code>X-Request-Id</code>), and attached to every log line. When a Swiggy order fails, support can search one id and see the API gateway, order service, payment service and delivery service lines for that one order, in order. In the code, <code>withFields("cid", "req-7f3a")</code> returns a child logger that adds the id to every record, which is how Go's <code>slog</code> and Uber's <code>zap</code> do it.</p>
<p>The alternative is a per-thread context, called MDC (Mapped Diagnostic Context) in Java: a filter puts the request id in a <code>ThreadLocal</code> at the start of a request and every log call on that thread picks it up. Python has <code>contextvars</code>, Node has <code>AsyncLocalStorage</code>, and Go passes a <code>context.Context</code>. Be careful with thread pools and async code: the context must be copied to the worker thread, or the id silently disappears. Logs, metrics and traces together are called observability, which has its own page later in this course.</p>
<div class="callout info"><strong>Never log secrets</strong>Card numbers, CVVs, UPI PINs, OTPs, passwords, full Aadhaar numbers and auth tokens must never reach a log. RBI and PCI-DSS rules make this a compliance issue, not just good taste. A redacting formatter or filter that masks known field names (<code>card</code>, <code>otp</code>, <code>token</code>) is a cheap, high-value addition to mention.</div>

<h2>Async logging: bounded queue, worker and back-pressure</h2>
<p>Writing to a file normally takes a few microseconds because the operating system buffers it. But disks stall, network file systems hiccup, and a remote log shipper can take hundreds of milliseconds. With synchronous logging, every request thread waits for that. Async logging moves the slow write off the request path: the caller puts the record on a queue and returns; one background worker takes records off and writes them.</p>
<figure class="svg-fig">
<svg viewBox="0 0 640 230" role="img" aria-label="Request threads put records on a bounded queue; a single worker thread writes them to the file">
<rect class="s-box" x="10" y="20" width="140" height="44" rx="10"/>
<text class="s-text" x="80" y="47" text-anchor="middle">request thread 1</text>
<rect class="s-box" x="10" y="80" width="140" height="44" rx="10"/>
<text class="s-text" x="80" y="107" text-anchor="middle">request thread 2</text>
<rect class="s-box" x="10" y="140" width="140" height="44" rx="10"/>
<text class="s-text" x="80" y="167" text-anchor="middle">request thread 3</text>
<line class="s-line" x1="150" y1="42" x2="205" y2="95" marker-end="url(#arrow)"/>
<line class="s-line" x1="150" y1="102" x2="205" y2="102" marker-end="url(#arrow)"/>
<line class="s-line" x1="150" y1="162" x2="205" y2="110" marker-end="url(#arrow)"/>
<rect class="s-accent" x="215" y="72" width="44" height="60" rx="10"/>
<rect class="s-accent" x="263" y="72" width="44" height="60" rx="10"/>
<rect class="s-accent" x="311" y="72" width="44" height="60" rx="10"/>
<rect class="s-box" x="359" y="72" width="44" height="60" rx="10"/>
<text class="s-title" x="309" y="58" text-anchor="middle">bounded queue (capacity 4)</text>
<text class="s-muted" x="309" y="155" text-anchor="middle">full? BLOCK the caller</text>
<text class="s-muted" x="309" y="175" text-anchor="middle">or DROP and count it</text>
<line class="s-line" x1="403" y1="102" x2="445" y2="102" marker-end="url(#arrow)"/>
<rect class="s-box" x="455" y="80" width="80" height="44" rx="10"/>
<text class="s-text" x="495" y="107" text-anchor="middle">worker</text>
<line class="s-line" x1="535" y1="102" x2="565" y2="102" marker-end="url(#arrow)"/>
<rect class="s-amber" x="570" y="80" width="62" height="44" rx="10"/>
<text class="s-text" x="601" y="107" text-anchor="middle">file</text>
<text class="s-muted" x="320" y="215" text-anchor="middle">close(): stop accepting, drain the queue, flush the file, then exit</text>
</svg>
<figcaption>Callers pay only for an enqueue. The queue's fixed size turns a slow disk into a clear choice: wait or drop.</figcaption>
</figure>
<h3>Why the queue must be bounded</h3>
<p>An unbounded queue looks safe: never block, never drop. But if the disk is slower than the log rate for long enough, the queue grows until the process runs out of memory and crashes, taking every buffered log with it. A bounded queue turns that hidden failure into an explicit decision. A capacity of a few thousand records (a few MB) absorbs short spikes; anything longer is a real overload and must be handled.</p>
<h3>Full queue: block or drop?</h3>
<table>
<thead><tr><th>Policy</th><th>What the caller feels</th><th>Logs lost?</th><th>Good for</th></tr></thead>
<tbody>
<tr><td>BLOCK</td><td>Waits for space. A slow disk slows the whole app (back-pressure).</td><td>No</td><td>Audit logs, payment logs, anything legally required</td></tr>
<tr><td>DROP newest</td><td>Never waits. The new record is discarded and counted.</td><td>Yes, recent ones</td><td>High-volume DEBUG/INFO, click streams</td></tr>
<tr><td>DROP oldest</td><td>Never waits. The oldest queued record is discarded.</td><td>Yes, older ones</td><td>When the latest context matters most</td></tr>
<tr><td>Hybrid</td><td>Drop DEBUG/INFO when full, block for WARN and above.</td><td>Only low-value ones</td><td>Most production services (Logback's AsyncAppender does a version of this)</td></tr>
</tbody>
</table>
<p>Whatever you choose, <strong>count the drops</strong> and expose the counter as a metric. Silent loss is the worst outcome: someone will search for a log line during an incident and wrongly conclude the event never happened.</p>
<h3>Shutdown and crashes</h3>
<p><code>close()</code> must drain the queue before the program exits, or the last few seconds of logs (often the most important ones) are lost. The code puts a "stop" marker on the queue behind every pending record (Java, Python, C++), or closes the channel (Go, where the worker keeps reading until the channel is empty), then waits for the worker to finish. Register this in a shutdown hook. A hard crash (kill -9, power loss) still loses whatever is in the queue. That is the price of async logging, and why some teams keep ERROR and FATAL synchronous.</p>
<h3>Thread safety</h3>
<ul>
<li><strong>Records are immutable</strong>, so many handlers and threads can read one record without locks.</li>
<li><strong>Format outside the lock, write inside it.</strong> Formatting is the expensive part, and it touches only the record. The lock covers only the write, so one whole line goes out at a time and lines never interleave.</li>
<li><strong>The registry</strong> uses a lock or a concurrent map so two threads asking for a new logger at once get the same instance.</li>
<li><strong>Logger levels</strong> are <code>volatile</code> or atomic, so a runtime level change is seen by every thread.</li>
<li>JavaScript has a single thread, so handlers need no locks. The JS <code>AsyncHandler</code> drains on a later tick of the event loop instead of a thread, and "block" becomes "the caller drains the backlog itself", which gives the same back-pressure and keeps order.</li>
</ul>
<p>See <a href="#/p/concurrency">concurrency</a> for bounded queues and producer-consumer in general, and <a href="#/p/message-queues">message queues</a> for the same back-pressure trade-off at system scale.</p>

<h2>Full implementation</h2>
<p>Each tab is one self-contained file that compiles and runs. A <code>MemoryHandler</code> stands in for a file so the demo writes nothing to disk, and a <code>TickingClock</code> (starts at 1 second, moves 250 ms per read) replaces real timestamps so the output is identical on every run. The drop-policy demo creates the async handler without starting its worker, which plays the part of a stuck disk: the first 3 records fill the queue and the next 2 are dropped, every time.</p>
<div data-code="full"></div>
<p>Expected output (identical in every language):</p>
<pre><code>== 1. Levels and the handler chain ==
00:00:01.000 INFO  [checkout] Cart loaded items=3
00:00:01.250 WARN  [checkout] Coupon expired code=DIWALI50
00:00:01.500 ERROR [checkout] Payment failed orderId=OD-1001 reason=gateway timeout
file (JSON, INFO+) has 3 lines, alerts (ERROR+) has 1
00:00:01.750 DEBUG [checkout] Cart details items=3
after switching checkout to DEBUG: file still has 3 lines
== 2. Structured fields and a correlation id ==
00:00:02.000 INFO  [payments] Charging card cid=req-7f3a userId=U42 amount=499
00:00:02.250 ERROR [payments] Bank said "insufficient funds" cid=req-7f3a userId=U42 code=51
file: {"ts":2000,"level":"INFO","logger":"payments","msg":"Charging card","cid":"req-7f3a","userId":"U42","amount":"499"}
file: {"ts":2250,"level":"ERROR","logger":"payments","msg":"Bank said \"insufficient funds\"","cid":"req-7f3a","userId":"U42","code":"51"}
alerts: 00:00:02.250 ERROR [payments] Bank said "insufficient funds" cid=req-7f3a userId=U42 code=51
== 3. Registry ==
same logger for 'checkout': true
default manager is a singleton: true
== 4. Async handler, block policy ==
written 6, dropped 0
first: 00:00:02.500 INFO  [worker] Processed batch n=1
last:  00:00:03.750 INFO  [worker] Processed batch n=6
== 5. Async handler, drop policy (worker paused, like a stuck disk) ==
written 3, dropped 2
  00:00:04.000 INFO  [clicks] Ad click id=1
  00:00:04.250 INFO  [clicks] Ad click id=2
  00:00:04.500 INFO  [clicks] Ad click id=3</code></pre>
<p>Things to point out when you walk through it:</p>
<ul>
<li><strong>The first DEBUG line never appears</strong> and does not even read the clock: the logger level check returns first.</li>
<li><strong>One record, three destinations, two formats.</strong> The ERROR line is printed as text, stored as JSON in the file, and stored again in the alerts sink.</li>
<li><strong>Raising checkout to DEBUG</strong> affects the console but not the file, because handler thresholds still apply.</li>
<li><strong>Context fields come first.</strong> <code>cid</code> and <code>userId</code> appear on every payments line without the caller repeating them.</li>
<li><strong>JSON escaping is real.</strong> The quotes inside "insufficient funds" become <code>\"</code>; skipping this breaks every log parser downstream.</li>
<li><strong>Block policy loses nothing</strong> (6 written, 0 dropped) even though the queue holds only 4. <strong>Drop policy</strong> keeps 3 and reports 2 dropped.</li>
<li><strong>Go has no inheritance</strong>, so its chain node wraps an <code>Appender</code> interface instead of subclassing <code>Handler</code>, and its async appender is a buffered channel plus one goroutine.</li>
</ul>

<h2>Performance details worth mentioning</h2>
<ul>
<li><strong>Do not build strings you will throw away.</strong> <code>log.debug("cart " + cart.toString())</code> builds the string even when DEBUG is off. Pass fields separately, use a lambda (<code>log.debug(() -&gt; ...)</code>), or guard with <code>if (log.isEnabled(DEBUG))</code>.</li>
<li><strong>Batch writes.</strong> The worker can take up to N records at a time and write them in one system call, which is much faster than one write per line.</li>
<li><strong>Sample noisy logs.</strong> Log 1 in 100 identical "cache miss" lines, plus a count. At Flipkart Big Billion Days traffic, full DEBUG logging can produce terabytes an hour.</li>
<li><strong>Timestamps are not free.</strong> Reading the clock and formatting a date for every line adds up; cache the formatted second and append milliseconds.</li>
</ul>

<h2>Extensibility</h2>
<div class="tabs">
<section data-tab="Rolling files">
<p>A <code>RollingFileHandler</code> starts a new file when the current one passes a size (100 MB) or a time boundary (midnight), and deletes files older than N days. It is one new handler class; nothing else changes.</p>
</section>
<section data-tab="Remote sinks">
<p>A handler that ships records to Kafka, a log collector (Fluent Bit, Vector) or a cloud service. Always wrap it in <code>AsyncHandler</code>: the network is the slowest destination of all, and it can be down.</p>
</section>
<section data-tab="Runtime config">
<p>Operators change levels without a restart: an admin endpoint calls <code>setLevel("payments", DEBUG)</code> for ten minutes during an incident. The registry plus volatile levels make this safe.</p>
</section>
<section data-tab="Filters">
<p>A <code>Filter</code> step in the chain can drop records (health-check noise), redact fields (card numbers, OTPs) or enrich them (host name, app version). It is another link in the chain, or a decorator around a handler.</p>
</section>
</div>

<h2>Common mistakes</h2>
<div class="callout warn"><strong>Things that lose marks</strong>
<ul>
<li>One class that filters, formats and writes, with an <code>if</code> for every output type.</li>
<li>An unbounded queue in the async handler, or no stated policy for a full queue.</li>
<li>No flush on shutdown, so the last logs before a crash or deploy are lost.</li>
<li>Locking around formatting as well as writing, so every thread waits for JSON encoding.</li>
<li>Building the message string before checking the level.</li>
<li>Hand-written JSON without escaping quotes and newlines.</li>
<li>A global Singleton with no way to create a fresh manager for tests.</li>
<li>Printing real timestamps in tests, so expected output can never be compared.</li>
</ul>
</div>

<div class="callout interview"><strong>Say this in the interview</strong>"I will split logging into three independent parts: whether to log, which is the level check; how it looks, which is a Formatter strategy for plain text or JSON; and where it goes, which is a Handler. Handlers form a chain of responsibility; each has its own threshold, writes if the record qualifies and passes it on. Loggers come from a LogManager registry so the same name gives the same logger and levels can change at runtime. I will offer a global default, but tests create their own manager to avoid shared state. For slow destinations I wrap a handler in an AsyncHandler: a bounded queue and one worker thread. When the queue is full it either blocks, for audit logs, or drops and counts, for high-volume logs, and close() drains the queue before exit. Context fields like a correlation id are added to every record, and the JSON formatter makes them searchable."</div>

<h2>Follow-up questions</h2>
<div class="quiz">
<details><summary>Why do we need both a logger level and a handler threshold?</summary><div>They answer different questions. The logger level is a cheap, early gate per component: if <code>checkout</code> is at INFO, a DEBUG call returns after one comparison, before any record or string is built. Handler thresholds decide per destination: the console might show DEBUG while the file keeps INFO and the pager only gets ERROR. Using only one of them forces you to choose between performance and per-destination control.</div></details>
<details><summary>Your async queue is full. What should happen?</summary><div>It depends on the log. For audit or payment logs, block the caller: no data loss, and the slowdown is a visible signal (back-pressure). For high-volume DEBUG and INFO, drop the record and increment a counter that is exported as a metric. A common hybrid drops low levels and blocks for WARN and above. Never let the queue grow without limit, because that turns a slow disk into an out-of-memory crash.</div></details>
<details><summary>How do you avoid losing logs when the application shuts down?</summary><div>On a clean shutdown, a hook calls <code>close()</code> on the handler chain. The async handler stops accepting new records, places a stop marker behind every pending record (or closes the channel), waits for the worker to write everything, then flushes and closes the underlying file. On a hard crash the queued records are lost, which is why some teams keep ERROR and FATAL logging synchronous.</div></details>
<details><summary>What are the problems with making the logger a Singleton?</summary><div>Global state leaks between tests; dependencies become hidden, so you cannot inject a fake clock or an in-memory handler; startup code may log before configuration is loaded; and "single" is not guaranteed across class loaders or duplicate packages. Keep a global default for convenience, but make <code>LogManager</code> an ordinary class that tests and libraries can create and pass around.</div></details>
<details><summary>What is a correlation id and how does it reach every log line?</summary><div>It is a unique id created when a request enters the system, sent to every downstream service in a header such as <code>X-Request-Id</code>, and attached to every log line, so one search shows the whole request across services. Inside a service it travels either as a child logger with bound fields (<code>withFields("cid", id)</code>) or in a per-request context such as Java's MDC, Python's <code>contextvars</code>, Node's <code>AsyncLocalStorage</code> or Go's <code>context.Context</code>. It must be copied explicitly when work moves to another thread.</div></details>
<details><summary>How do you make sure two threads never produce a half-mixed line?</summary><div>Make the record immutable, format it into a complete string first, and then write that string while holding the handler's lock (or let a single worker thread own the output). The lock covers only the write, so threads do not wait for each other's formatting, and every line is written whole.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
<li>Split logging into whether (levels), how (Formatter strategy) and where (Handlers), and compose them.</li>
<li>Handlers form a pass-through Chain of Responsibility; each has its own threshold. A list of appenders is the same idea.</li>
<li>A registry returns one logger per name, so levels can change at runtime. A global Singleton is convenient but must not be the only way in.</li>
<li>Async logging needs a bounded queue, an explicit full-queue policy (block or drop and count), and a close that drains.</li>
<li>Structured fields plus a correlation id turn logs into data you can query across services. Never log secrets.</li>
<li>Inject the clock and use in-memory sinks so logging code is deterministic and testable.</li>
</ul></div>
`,
  code: {
    full: {
      title: "Complete logging framework with async handler (single file, runnable)",
      java: String.raw`// Logging framework: levels, a chain of handlers, pluggable formatters,
// a registry of named loggers, structured fields and an async handler.
// Run: javac LoggerDemo.java && java LoggerDemo
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class LoggerDemo {

    enum Level {
        DEBUG(10), INFO(20), WARN(30), ERROR(40), FATAL(50);
        final int value;
        Level(int value) { this.value = value; }
    }

    record Field(String key, String value) {}

    record LogRecord(long tsMs, Level level, String logger, String message, List<Field> fields) {}

    // ---------- Injectable clock: tests never print real timestamps ----------
    interface Clock { long nowMs(); }

    static class SystemClock implements Clock {
        public long nowMs() { return System.currentTimeMillis(); }
    }

    // Starts at startMs and moves forward stepMs on every read.
    static class TickingClock implements Clock {
        private final AtomicLong t;
        private final long step;
        TickingClock(long startMs, long stepMs) { t = new AtomicLong(startMs); step = stepMs; }
        public long nowMs() { return t.getAndAdd(step); }
    }

    static String clockTime(long ms) {
        ms %= 24L * 3600 * 1000;
        return String.format("%02d:%02d:%02d.%03d", ms / 3600000, ms / 60000 % 60, ms / 1000 % 60, ms % 1000);
    }

    static String jsonString(String s) {
        StringBuilder sb = new StringBuilder("\"");
        for (char ch : s.toCharArray()) {
            if (ch == '"') sb.append("\\\"");
            else if (ch == '\\') sb.append("\\\\");
            else if (ch == '\n') sb.append("\\n");
            else if (ch < 0x20) sb.append(String.format("\\u%04x", (int) ch));
            else sb.append(ch);
        }
        return sb.append('"').toString();
    }

    // ---------- Strategy: how a record becomes a line ----------
    interface Formatter { String format(LogRecord r); }

    static class PlainFormatter implements Formatter {
        public String format(LogRecord r) {
            StringBuilder sb = new StringBuilder(String.format("%s %-5s [%s] %s", clockTime(r.tsMs()), r.level(), r.logger(), r.message()));
            for (Field f : r.fields()) sb.append(' ').append(f.key()).append('=').append(f.value());
            return sb.toString();
        }
    }

    static class JsonFormatter implements Formatter {
        public String format(LogRecord r) {
            StringJoiner sj = new StringJoiner(",", "{", "}");
            sj.add("\"ts\":" + r.tsMs());
            sj.add("\"level\":\"" + r.level() + "\"");
            sj.add("\"logger\":" + jsonString(r.logger()));
            sj.add("\"msg\":" + jsonString(r.message()));
            for (Field f : r.fields()) sj.add(jsonString(f.key()) + ":" + jsonString(f.value()));
            return sj.toString();
        }
    }

    // ---------- Chain of Responsibility: each handler filters by level, then passes on ----------
    abstract static class Handler {
        final Level threshold;
        final Formatter formatter;
        private Handler next;

        Handler(Level threshold, Formatter formatter) { this.threshold = threshold; this.formatter = formatter; }

        Handler setNext(Handler h) { next = h; return h; } // so calls chain: a.setNext(b).setNext(c)

        void handle(LogRecord r) {
            if (r.level().value >= threshold.value) emit(r);
            if (next != null) next.handle(r);
        }

        abstract void emit(LogRecord r);

        void close() { if (next != null) next.close(); }
    }

    static class ConsoleHandler extends Handler {
        ConsoleHandler(Level t, Formatter f) { super(t, f); }
        synchronized void emit(LogRecord r) { System.out.println(formatter.format(r)); } // whole lines, never interleaved
    }

    // Stands in for a file: keeps lines in memory so demos and tests stay deterministic.
    static class MemoryHandler extends Handler {
        final List<String> lines = Collections.synchronizedList(new ArrayList<>());
        MemoryHandler(Level t, Formatter f) { super(t, f); }
        void emit(LogRecord r) { lines.add(formatter.format(r)); }
    }

    // Callers only enqueue; one worker thread writes to the slow target.
    static class AsyncHandler extends Handler {
        enum Policy { BLOCK, DROP }
        private static final LogRecord STOP = new LogRecord(0, Level.FATAL, "", "", List.of());
        private final Handler target;
        private final Policy policy;
        private final BlockingQueue<LogRecord> queue; // bounded: memory can never blow up
        final AtomicInteger dropped = new AtomicInteger();
        private Thread worker;

        AsyncHandler(Handler target, int capacity, Policy policy) {
            super(target.threshold, null);
            this.target = target;
            this.policy = policy;
            this.queue = new ArrayBlockingQueue<>(capacity);
        }

        synchronized void start() {
            worker = new Thread(this::run, "log-writer");
            worker.setDaemon(true);
            worker.start();
        }

        void emit(LogRecord r) {
            if (policy == Policy.BLOCK) {
                try {
                    queue.put(r); // back-pressure: the caller waits for space
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            } else if (!queue.offer(r)) {
                dropped.incrementAndGet(); // never slow the caller down; count what we lose
            }
        }

        private void run() {
            try {
                while (true) {
                    LogRecord r = queue.take();
                    if (r == STOP) return;
                    target.emit(r);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }

        void close() {
            if (worker == null) start();
            try {
                queue.put(STOP); // queued after every pending record, so all of them are written
                worker.join();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            target.close();
            super.close();
        }
    }

    static class Logger {
        final String name;
        volatile Level level;
        private final Handler head;
        private final Clock clock;
        private final List<Field> context; // fields added to every record, e.g. a correlation id

        Logger(String name, Level level, Handler head, Clock clock, List<Field> context) {
            this.name = name; this.level = level; this.head = head; this.clock = clock; this.context = context;
        }

        Logger withFields(String... kv) {
            List<Field> ctx = new ArrayList<>(context);
            for (int i = 0; i + 1 < kv.length; i += 2) ctx.add(new Field(kv[i], kv[i + 1]));
            return new Logger(name, level, head, clock, ctx);
        }

        boolean isEnabled(Level l) { return l.value >= level.value; }

        void log(Level l, String msg, String... kv) {
            if (!isEnabled(l)) return; // cheap exit before any formatting work
            List<Field> fields = new ArrayList<>(context);
            for (int i = 0; i + 1 < kv.length; i += 2) fields.add(new Field(kv[i], kv[i + 1]));
            head.handle(new LogRecord(clock.nowMs(), l, name, msg, fields));
        }

        void debug(String m, String... kv) { log(Level.DEBUG, m, kv); }
        void info(String m, String... kv) { log(Level.INFO, m, kv); }
        void warn(String m, String... kv) { log(Level.WARN, m, kv); }
        void error(String m, String... kv) { log(Level.ERROR, m, kv); }
        void fatal(String m, String... kv) { log(Level.FATAL, m, kv); }
    }

    // Registry of named loggers: the same name always returns the same Logger.
    static class LogManager {
        private final Clock clock;
        private final Handler head;
        private final Level level;
        private final ConcurrentHashMap<String, Logger> loggers = new ConcurrentHashMap<>();

        LogManager(Clock clock, Handler head, Level level) { this.clock = clock; this.head = head; this.level = level; }

        Logger getLogger(String name) {
            return loggers.computeIfAbsent(name, n -> new Logger(n, level, head, clock, List.of()));
        }
        void setLevel(String name, Level l) { getLogger(name).level = l; }
        void shutdown() { head.close(); }

        // Process-wide instance for code that cannot be handed one. Prefer passing a LogManager in.
        // Holder idiom: the JVM creates it lazily and thread-safely on first use.
        private static class Holder {
            static final LogManager INSTANCE =
                    new LogManager(new SystemClock(), new ConsoleHandler(Level.INFO, new PlainFormatter()), Level.INFO);
        }
        static LogManager getDefault() { return Holder.INSTANCE; }
    }

    public static void main(String[] args) {
        TickingClock clock = new TickingClock(1000, 250);

        System.out.println("== 1. Levels and the handler chain ==");
        ConsoleHandler console = new ConsoleHandler(Level.DEBUG, new PlainFormatter());
        MemoryHandler file = new MemoryHandler(Level.INFO, new JsonFormatter());
        MemoryHandler alerts = new MemoryHandler(Level.ERROR, new PlainFormatter());
        console.setNext(file).setNext(alerts);
        LogManager mgr = new LogManager(clock, console, Level.INFO);
        Logger log = mgr.getLogger("checkout");
        log.debug("Cart details", "items", "3");
        log.info("Cart loaded", "items", "3");
        log.warn("Coupon expired", "code", "DIWALI50");
        log.error("Payment failed", "orderId", "OD-1001", "reason", "gateway timeout");
        System.out.printf("file (JSON, INFO+) has %d lines, alerts (ERROR+) has %d%n", file.lines.size(), alerts.lines.size());
        mgr.setLevel("checkout", Level.DEBUG);
        log.debug("Cart details", "items", "3");
        System.out.println("after switching checkout to DEBUG: file still has " + file.lines.size() + " lines");

        System.out.println("== 2. Structured fields and a correlation id ==");
        Logger req = mgr.getLogger("payments").withFields("cid", "req-7f3a", "userId", "U42");
        req.info("Charging card", "amount", "499");
        req.error("Bank said \"insufficient funds\"", "code", "51");
        int n = file.lines.size();
        for (String line : file.lines.subList(n - 2, n)) System.out.println("file: " + line);
        System.out.println("alerts: " + alerts.lines.get(alerts.lines.size() - 1));

        System.out.println("== 3. Registry ==");
        System.out.println("same logger for 'checkout': " + (mgr.getLogger("checkout") == log));
        System.out.println("default manager is a singleton: " + (LogManager.getDefault() == LogManager.getDefault()));

        System.out.println("== 4. Async handler, block policy ==");
        MemoryHandler sink = new MemoryHandler(Level.DEBUG, new PlainFormatter());
        AsyncHandler asyncBlock = new AsyncHandler(sink, 4, AsyncHandler.Policy.BLOCK);
        asyncBlock.start();
        Logger workers = new LogManager(clock, asyncBlock, Level.INFO).getLogger("worker");
        for (int i = 1; i <= 6; i++) workers.info("Processed batch", "n", String.valueOf(i));
        asyncBlock.close();
        System.out.printf("written %d, dropped %d%n", sink.lines.size(), asyncBlock.dropped.get());
        System.out.println("first: " + sink.lines.get(0));
        System.out.println("last:  " + sink.lines.get(sink.lines.size() - 1));

        System.out.println("== 5. Async handler, drop policy (worker paused, like a stuck disk) ==");
        MemoryHandler sink2 = new MemoryHandler(Level.DEBUG, new PlainFormatter());
        AsyncHandler asyncDrop = new AsyncHandler(sink2, 3, AsyncHandler.Policy.DROP);
        Logger clicks = new LogManager(clock, asyncDrop, Level.INFO).getLogger("clicks");
        for (int i = 1; i <= 5; i++) clicks.info("Ad click", "id", String.valueOf(i));
        asyncDrop.close(); // starts the worker, drains the queue, then stops
        System.out.printf("written %d, dropped %d%n", sink2.lines.size(), asyncDrop.dropped.get());
        for (String line : sink2.lines) System.out.println("  " + line);
    }
}`,
      python: String.raw`# Logging framework: levels, a chain of handlers, pluggable formatters,
# a registry of named loggers, structured fields and an async handler.
# Run: python3 main.py
import queue
import threading
import time
from enum import IntEnum


class Level(IntEnum):
    DEBUG = 10
    INFO = 20
    WARN = 30
    ERROR = 40
    FATAL = 50


class LogRecord:
    def __init__(self, ts_ms, level, logger, message, fields):
        self.ts_ms, self.level, self.logger = ts_ms, level, logger
        self.message, self.fields = message, fields  # fields: list of (key, value)


# ---------- Injectable clock: tests never print real timestamps ----------
class SystemClock:
    def now_ms(self):
        return int(time.time() * 1000)


class TickingClock:
    """Starts at start_ms and moves forward step_ms on every read."""

    def __init__(self, start_ms, step_ms):
        self.t, self.step = start_ms, step_ms
        self._lock = threading.Lock()

    def now_ms(self):
        with self._lock:
            t = self.t
            self.t += self.step
            return t


def clock_time(ms):
    ms %= 24 * 3600 * 1000
    return "%02d:%02d:%02d.%03d" % (ms // 3600000, ms // 60000 % 60, ms // 1000 % 60, ms % 1000)


def json_string(s):
    out = ['"']
    for ch in s:
        if ch == '"':
            out.append('\\"')
        elif ch == "\\":
            out.append("\\\\")
        elif ch == "\n":
            out.append("\\n")
        elif ord(ch) < 0x20:
            out.append("\\u%04x" % ord(ch))
        else:
            out.append(ch)
    out.append('"')
    return "".join(out)


# ---------- Strategy: how a record becomes a line ----------
class PlainFormatter:
    def format(self, r):
        line = "%s %-5s [%s] %s" % (clock_time(r.ts_ms), r.level.name, r.logger, r.message)
        for k, v in r.fields:
            line += " %s=%s" % (k, v)
        return line


class JsonFormatter:
    def format(self, r):
        parts = ['"ts":%d' % r.ts_ms, '"level":"%s"' % r.level.name,
                 '"logger":' + json_string(r.logger), '"msg":' + json_string(r.message)]
        for k, v in r.fields:
            parts.append(json_string(k) + ":" + json_string(v))
        return "{" + ",".join(parts) + "}"


# ---------- Chain of Responsibility: each handler filters by level, then passes on ----------
class Handler:
    def __init__(self, threshold, formatter):
        self.threshold, self.formatter = threshold, formatter
        self.next = None
        self._lock = threading.Lock()

    def set_next(self, handler):
        self.next = handler
        return handler  # so calls can be chained: a.set_next(b).set_next(c)

    def handle(self, record):
        if record.level >= self.threshold:
            self.emit(record)
        if self.next:
            self.next.handle(record)

    def emit(self, record):
        raise NotImplementedError

    def close(self):
        if self.next:
            self.next.close()


class ConsoleHandler(Handler):
    def emit(self, record):
        line = self.formatter.format(record)
        with self._lock:  # one whole line at a time, never interleaved
            print(line, flush=True)


class MemoryHandler(Handler):
    """Stands in for a file: keeps lines in memory so demos and tests stay deterministic."""

    def __init__(self, threshold, formatter):
        super().__init__(threshold, formatter)
        self.lines = []

    def emit(self, record):
        line = self.formatter.format(record)
        with self._lock:
            self.lines.append(line)


class AsyncHandler(Handler):
    """Callers only enqueue; one worker thread writes to the slow target."""

    BLOCK, DROP = "block", "drop"
    _STOP = object()

    def __init__(self, target, capacity, policy):
        super().__init__(target.threshold, None)
        self.target, self.policy = target, policy
        self.queue = queue.Queue(maxsize=capacity)  # bounded: memory can never blow up
        self.dropped = 0
        self.worker = None

    def start(self):
        self.worker = threading.Thread(target=self._run, daemon=True)
        self.worker.start()

    def emit(self, record):
        if self.policy == self.BLOCK:
            self.queue.put(record)  # back-pressure: the caller waits for space
            return
        try:
            self.queue.put_nowait(record)
        except queue.Full:
            with self._lock:
                self.dropped += 1  # never slow the caller down; count what we lose

    def _run(self):
        while True:
            record = self.queue.get()
            if record is self._STOP:
                return
            self.target.emit(record)

    def close(self):
        if self.worker is None:
            self.start()
        self.queue.put(self._STOP)  # queued after every pending record, so all of them are written
        self.worker.join()
        self.target.close()
        super().close()


class Logger:
    def __init__(self, name, level, head, clock, context=()):
        self.name, self.level, self.head, self.clock = name, level, head, clock
        self.context = list(context)  # fields added to every record, e.g. a correlation id

    def with_fields(self, **fields):
        return Logger(self.name, self.level, self.head, self.clock, self.context + list(fields.items()))

    def is_enabled(self, level):
        return level >= self.level

    def log(self, level, message, **fields):
        if not self.is_enabled(level):
            return  # cheap exit before any formatting work
        record = LogRecord(self.clock.now_ms(), level, self.name, message, self.context + list(fields.items()))
        self.head.handle(record)

    def debug(self, msg, **f): self.log(Level.DEBUG, msg, **f)
    def info(self, msg, **f): self.log(Level.INFO, msg, **f)
    def warn(self, msg, **f): self.log(Level.WARN, msg, **f)
    def error(self, msg, **f): self.log(Level.ERROR, msg, **f)
    def fatal(self, msg, **f): self.log(Level.FATAL, msg, **f)


class LogManager:
    """Registry of named loggers: the same name always returns the same Logger."""

    _default = None
    _default_lock = threading.Lock()

    def __init__(self, clock, head, level):
        self.clock, self.head, self.level = clock, head, level
        self._loggers = {}
        self._lock = threading.Lock()

    def get_logger(self, name):
        with self._lock:
            if name not in self._loggers:
                self._loggers[name] = Logger(name, self.level, self.head, self.clock)
            return self._loggers[name]

    def set_level(self, name, level):
        self.get_logger(name).level = level

    def shutdown(self):
        self.head.close()

    @classmethod
    def default(cls):
        """Process-wide instance for code that cannot be handed one. Prefer passing a LogManager in."""
        if cls._default is None:
            with cls._default_lock:
                if cls._default is None:  # double-checked: only one thread creates it
                    cls._default = LogManager(SystemClock(), ConsoleHandler(Level.INFO, PlainFormatter()), Level.INFO)
        return cls._default


def main():
    clock = TickingClock(1000, 250)

    print("== 1. Levels and the handler chain ==")
    console = ConsoleHandler(Level.DEBUG, PlainFormatter())
    file = MemoryHandler(Level.INFO, JsonFormatter())
    alerts = MemoryHandler(Level.ERROR, PlainFormatter())
    console.set_next(file).set_next(alerts)
    mgr = LogManager(clock, console, Level.INFO)
    log = mgr.get_logger("checkout")
    log.debug("Cart details", items="3")
    log.info("Cart loaded", items="3")
    log.warn("Coupon expired", code="DIWALI50")
    log.error("Payment failed", orderId="OD-1001", reason="gateway timeout")
    print("file (JSON, INFO+) has %d lines, alerts (ERROR+) has %d" % (len(file.lines), len(alerts.lines)))
    mgr.set_level("checkout", Level.DEBUG)
    log.debug("Cart details", items="3")
    print("after switching checkout to DEBUG: file still has %d lines" % len(file.lines))

    print("== 2. Structured fields and a correlation id ==")
    req = mgr.get_logger("payments").with_fields(cid="req-7f3a", userId="U42")
    req.info("Charging card", amount="499")
    req.error('Bank said "insufficient funds"', code="51")
    for line in file.lines[-2:]:
        print("file: " + line)
    print("alerts: " + alerts.lines[-1])

    print("== 3. Registry ==")
    print("same logger for 'checkout': %s" % str(mgr.get_logger("checkout") is log).lower())
    print("default manager is a singleton: %s" % str(LogManager.default() is LogManager.default()).lower())

    print("== 4. Async handler, block policy ==")
    sink = MemoryHandler(Level.DEBUG, PlainFormatter())
    async_block = AsyncHandler(sink, 4, AsyncHandler.BLOCK)
    async_block.start()
    workers = LogManager(clock, async_block, Level.INFO).get_logger("worker")
    for i in range(1, 7):
        workers.info("Processed batch", n=str(i))
    async_block.close()
    print("written %d, dropped %d" % (len(sink.lines), async_block.dropped))
    print("first: " + sink.lines[0])
    print("last:  " + sink.lines[-1])

    print("== 5. Async handler, drop policy (worker paused, like a stuck disk) ==")
    sink2 = MemoryHandler(Level.DEBUG, PlainFormatter())
    async_drop = AsyncHandler(sink2, 3, AsyncHandler.DROP)
    clicks = LogManager(clock, async_drop, Level.INFO).get_logger("clicks")
    for i in range(1, 6):
        clicks.info("Ad click", id=str(i))
    async_drop.close()  # starts the worker, drains the queue, then stops
    print("written %d, dropped %d" % (len(sink2.lines), async_drop.dropped))
    for line in sink2.lines:
        print("  " + line)


if __name__ == "__main__":
    main()`,
      cpp: String.raw`// Logging framework: levels, a chain of handlers, pluggable formatters,
// a registry of named loggers, structured fields and an async handler.
// Build: g++ -std=c++17 -pthread -o logger main.cpp && ./logger
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdio>
#include <deque>
#include <iostream>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <utility>
#include <vector>
using namespace std;

enum class Level { DEBUG = 10, INFO = 20, WARN = 30, ERROR = 40, FATAL = 50 };
const char* levelName(Level l) {
    switch (l) {
        case Level::DEBUG: return "DEBUG";
        case Level::INFO: return "INFO";
        case Level::WARN: return "WARN";
        case Level::ERROR: return "ERROR";
        default: return "FATAL";
    }
}

using Fields = vector<pair<string, string>>;

struct LogRecord {
    long long tsMs;
    Level level;
    string logger, message;
    Fields fields;
    bool stop = false; // internal marker used by AsyncHandler
};

// ---------- Injectable clock: tests never print real timestamps ----------
class Clock {
public:
    virtual ~Clock() = default;
    virtual long long nowMs() = 0;
};

class SystemClock : public Clock {
public:
    long long nowMs() override {
        return chrono::duration_cast<chrono::milliseconds>(chrono::system_clock::now().time_since_epoch()).count();
    }
};

// Starts at startMs and moves forward stepMs on every read.
class TickingClock : public Clock {
    atomic<long long> t;
    long long step;
public:
    TickingClock(long long startMs, long long stepMs) : t(startMs), step(stepMs) {}
    long long nowMs() override { return t.fetch_add(step); }
};

string clockTime(long long ms) {
    ms %= 24LL * 3600 * 1000;
    char buf[16];
    snprintf(buf, sizeof buf, "%02lld:%02lld:%02lld.%03lld", ms / 3600000, ms / 60000 % 60, ms / 1000 % 60, ms % 1000);
    return buf;
}

string jsonString(const string& s) {
    string out = "\"";
    for (char ch : s) {
        if (ch == '"') out += "\\\"";
        else if (ch == '\\') out += "\\\\";
        else if (ch == '\n') out += "\\n";
        else if ((unsigned char)ch < 0x20) {
            char buf[8];
            snprintf(buf, sizeof buf, "\\u%04x", (unsigned char)ch);
            out += buf;
        } else out += ch;
    }
    return out + "\"";
}

// ---------- Strategy: how a record becomes a line ----------
class Formatter {
public:
    virtual ~Formatter() = default;
    virtual string format(const LogRecord& r) const = 0;
};

class PlainFormatter : public Formatter {
public:
    string format(const LogRecord& r) const override {
        string lvl = levelName(r.level);
        lvl.resize(5, ' ');
        string line = clockTime(r.tsMs) + " " + lvl + " [" + r.logger + "] " + r.message;
        for (auto& [k, v] : r.fields) line += " " + k + "=" + v;
        return line;
    }
};

class JsonFormatter : public Formatter {
public:
    string format(const LogRecord& r) const override {
        string out = "{\"ts\":" + to_string(r.tsMs) + ",\"level\":\"" + levelName(r.level) + "\",\"logger\":" +
                     jsonString(r.logger) + ",\"msg\":" + jsonString(r.message);
        for (auto& [k, v] : r.fields) out += "," + jsonString(k) + ":" + jsonString(v);
        return out + "}";
    }
};

// ---------- Chain of Responsibility: each handler filters by level, then passes on ----------
class Handler {
    shared_ptr<Handler> next;
protected:
    shared_ptr<Formatter> formatter;
public:
    const Level threshold;
    Handler(Level threshold, shared_ptr<Formatter> f) : formatter(std::move(f)), threshold(threshold) {}
    virtual ~Handler() = default;

    shared_ptr<Handler> setNext(shared_ptr<Handler> h) { next = h; return h; } // so calls chain
    void handle(const LogRecord& r) {
        if ((int)r.level >= (int)threshold) emit(r);
        if (next) next->handle(r);
    }
    virtual void emit(const LogRecord& r) = 0;
    virtual void close() { if (next) next->close(); }
};

class ConsoleHandler : public Handler {
    mutex mu;
public:
    using Handler::Handler;
    void emit(const LogRecord& r) override {
        string line = formatter->format(r);
        lock_guard<mutex> g(mu); // whole lines, never interleaved
        cout << line << "\n";
    }
};

// Stands in for a file: keeps lines in memory so demos and tests stay deterministic.
class MemoryHandler : public Handler {
    mutable mutex mu;
    vector<string> lines;
public:
    using Handler::Handler;
    void emit(const LogRecord& r) override {
        string line = formatter->format(r);
        lock_guard<mutex> g(mu);
        lines.push_back(line);
    }
    vector<string> snapshot() const { lock_guard<mutex> g(mu); return lines; }
};

// Callers only enqueue; one worker thread writes to the slow target.
class AsyncHandler : public Handler {
public:
    enum class Policy { BLOCK, DROP };
private:
    shared_ptr<Handler> target;
    Policy policy;
    size_t capacity; // bounded: memory can never blow up
    deque<LogRecord> queue;
    mutex mu;
    condition_variable notEmpty, notFull;
    thread worker;

    void run() {
        while (true) {
            unique_lock<mutex> lk(mu);
            notEmpty.wait(lk, [&] { return !queue.empty(); });
            LogRecord r = std::move(queue.front());
            queue.pop_front();
            lk.unlock();
            notFull.notify_one();
            if (r.stop) return;
            target->emit(r);
        }
    }
    void push(LogRecord r) {
        { lock_guard<mutex> g(mu); queue.push_back(std::move(r)); }
        notEmpty.notify_one();
    }
public:
    atomic<int> dropped{0};

    AsyncHandler(shared_ptr<Handler> target, size_t capacity, Policy policy)
        : Handler(target->threshold, nullptr), target(std::move(target)), policy(policy), capacity(capacity) {}

    void start() { worker = thread([this] { run(); }); }

    void emit(const LogRecord& r) override {
        unique_lock<mutex> lk(mu);
        if (policy == Policy::BLOCK) {
            notFull.wait(lk, [&] { return queue.size() < capacity; }); // back-pressure: the caller waits
        } else if (queue.size() >= capacity) {
            dropped++; // never slow the caller down; count what we lose
            return;
        }
        queue.push_back(r);
        lk.unlock();
        notEmpty.notify_one();
    }

    void close() override {
        if (!worker.joinable()) start();
        LogRecord stop{};
        stop.stop = true;
        push(stop); // queued after every pending record, so all of them are written
        worker.join();
        target->close();
        Handler::close();
    }
};

class Logger {
    shared_ptr<Handler> head;
    Clock* clock;
    Fields context; // fields added to every record, e.g. a correlation id
public:
    const string name;
    atomic<Level> level;

    Logger(string name, Level level, shared_ptr<Handler> head, Clock* clock, Fields context = {})
        : head(std::move(head)), clock(clock), context(std::move(context)), name(std::move(name)), level(level) {}

    unique_ptr<Logger> withFields(const Fields& extra) const {
        Fields ctx = context;
        ctx.insert(ctx.end(), extra.begin(), extra.end());
        return make_unique<Logger>(name, level.load(), head, clock, ctx);
    }
    bool isEnabled(Level l) const { return (int)l >= (int)level.load(); }

    void log(Level l, const string& msg, const Fields& fields = {}) {
        if (!isEnabled(l)) return; // cheap exit before any formatting work
        Fields all = context;
        all.insert(all.end(), fields.begin(), fields.end());
        head->handle(LogRecord{clock->nowMs(), l, name, msg, all});
    }
    void debug(const string& m, const Fields& f = {}) { log(Level::DEBUG, m, f); }
    void info(const string& m, const Fields& f = {}) { log(Level::INFO, m, f); }
    void warn(const string& m, const Fields& f = {}) { log(Level::WARN, m, f); }
    void error(const string& m, const Fields& f = {}) { log(Level::ERROR, m, f); }
    void fatal(const string& m, const Fields& f = {}) { log(Level::FATAL, m, f); }
};

// Registry of named loggers: the same name always returns the same Logger.
class LogManager {
    Clock* clock;
    shared_ptr<Handler> head;
    Level level;
    map<string, unique_ptr<Logger>> loggers;
    mutex mu;
public:
    LogManager(Clock* clock, shared_ptr<Handler> head, Level level) : clock(clock), head(std::move(head)), level(level) {}

    Logger& getLogger(const string& name) {
        lock_guard<mutex> g(mu);
        auto& slot = loggers[name];
        if (!slot) slot = make_unique<Logger>(name, level, head, clock);
        return *slot;
    }
    void setLevel(const string& name, Level l) { getLogger(name).level = l; }
    void shutdown() { head->close(); }

    // Process-wide instance for code that cannot be handed one. Prefer passing a LogManager in.
    // A function-local static is created once, thread-safely, on first use (C++11 "magic statics").
    static LogManager& getDefault() {
        static SystemClock systemClock;
        static LogManager instance(&systemClock, make_shared<ConsoleHandler>(Level::INFO, make_shared<PlainFormatter>()),
                                   Level::INFO);
        return instance;
    }
};

int main() {
    TickingClock clock(1000, 250);
    auto plain = make_shared<PlainFormatter>();
    auto json = make_shared<JsonFormatter>();

    cout << "== 1. Levels and the handler chain ==\n";
    auto console = make_shared<ConsoleHandler>(Level::DEBUG, plain);
    auto file = make_shared<MemoryHandler>(Level::INFO, json);
    auto alerts = make_shared<MemoryHandler>(Level::ERROR, plain);
    console->setNext(file)->setNext(alerts);
    LogManager mgr(&clock, console, Level::INFO);
    Logger& log = mgr.getLogger("checkout");
    log.debug("Cart details", {{"items", "3"}});
    log.info("Cart loaded", {{"items", "3"}});
    log.warn("Coupon expired", {{"code", "DIWALI50"}});
    log.error("Payment failed", {{"orderId", "OD-1001"}, {"reason", "gateway timeout"}});
    cout << "file (JSON, INFO+) has " << file->snapshot().size() << " lines, alerts (ERROR+) has "
         << alerts->snapshot().size() << "\n";
    mgr.setLevel("checkout", Level::DEBUG);
    log.debug("Cart details", {{"items", "3"}});
    cout << "after switching checkout to DEBUG: file still has " << file->snapshot().size() << " lines\n";

    cout << "== 2. Structured fields and a correlation id ==\n";
    auto req = mgr.getLogger("payments").withFields({{"cid", "req-7f3a"}, {"userId", "U42"}});
    req->info("Charging card", {{"amount", "499"}});
    req->error("Bank said \"insufficient funds\"", {{"code", "51"}});
    auto lines = file->snapshot();
    for (size_t i = lines.size() - 2; i < lines.size(); i++) cout << "file: " << lines[i] << "\n";
    cout << "alerts: " << alerts->snapshot().back() << "\n";

    cout << "== 3. Registry ==\n";
    cout << "same logger for 'checkout': " << (&mgr.getLogger("checkout") == &log ? "true" : "false") << "\n";
    cout << "default manager is a singleton: " << (&LogManager::getDefault() == &LogManager::getDefault() ? "true" : "false") << "\n";

    cout << "== 4. Async handler, block policy ==\n";
    auto sink = make_shared<MemoryHandler>(Level::DEBUG, plain);
    auto asyncBlock = make_shared<AsyncHandler>(sink, 4, AsyncHandler::Policy::BLOCK);
    asyncBlock->start();
    LogManager workerMgr(&clock, asyncBlock, Level::INFO);
    for (int i = 1; i <= 6; i++) workerMgr.getLogger("worker").info("Processed batch", {{"n", to_string(i)}});
    asyncBlock->close();
    auto s1 = sink->snapshot();
    cout << "written " << s1.size() << ", dropped " << asyncBlock->dropped << "\n";
    cout << "first: " << s1.front() << "\n";
    cout << "last:  " << s1.back() << "\n";

    cout << "== 5. Async handler, drop policy (worker paused, like a stuck disk) ==\n";
    auto sink2 = make_shared<MemoryHandler>(Level::DEBUG, plain);
    auto asyncDrop = make_shared<AsyncHandler>(sink2, 3, AsyncHandler::Policy::DROP);
    LogManager clickMgr(&clock, asyncDrop, Level::INFO);
    for (int i = 1; i <= 5; i++) clickMgr.getLogger("clicks").info("Ad click", {{"id", to_string(i)}});
    asyncDrop->close(); // starts the worker, drains the queue, then stops
    auto s2 = sink2->snapshot();
    cout << "written " << s2.size() << ", dropped " << asyncDrop->dropped << "\n";
    for (auto& line : s2) cout << "  " << line << "\n";
    return 0;
}`,
      javascript: String.raw`// Logging framework: levels, a chain of handlers, pluggable formatters,
// a registry of named loggers, structured fields and an async handler.
// Run: node main.js
"use strict";

const Level = Object.freeze({ DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40, FATAL: 50 });
const levelName = (v) => Object.keys(Level).find((k) => Level[k] === v);

// ---------- Injectable clock: tests never print real timestamps ----------
class SystemClock {
  nowMs() { return Date.now(); }
}

// Starts at startMs and moves forward stepMs on every read.
class TickingClock {
  constructor(startMs, stepMs) { this.t = startMs; this.step = stepMs; }
  nowMs() { const t = this.t; this.t += this.step; return t; }
}

const pad = (n, w) => String(n).padStart(w, "0");
function clockTime(ms) {
  ms %= 24 * 3600 * 1000;
  return pad(Math.floor(ms / 3600000), 2) + ":" + pad(Math.floor(ms / 60000) % 60, 2) + ":" +
    pad(Math.floor(ms / 1000) % 60, 2) + "." + pad(ms % 1000, 3);
}

function jsonString(s) {
  let out = '"';
  for (const ch of s) {
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch.charCodeAt(0) < 0x20) out += "\\u" + pad(ch.charCodeAt(0).toString(16), 4);
    else out += ch;
  }
  return out + '"';
}

// ---------- Strategy: how a record becomes a line. Interface: format(record) -> string ----------
class PlainFormatter {
  format(r) {
    let line = clockTime(r.tsMs) + " " + levelName(r.level).padEnd(5) + " [" + r.logger + "] " + r.message;
    for (const [k, v] of r.fields) line += " " + k + "=" + v;
    return line;
  }
}

class JsonFormatter {
  format(r) {
    const parts = ['"ts":' + r.tsMs, '"level":"' + levelName(r.level) + '"',
      '"logger":' + jsonString(r.logger), '"msg":' + jsonString(r.message)];
    for (const [k, v] of r.fields) parts.push(jsonString(k) + ":" + jsonString(v));
    return "{" + parts.join(",") + "}";
  }
}

// ---------- Chain of Responsibility: each handler filters by level, then passes on ----------
class Handler {
  constructor(threshold, formatter) {
    this.threshold = threshold;
    this.formatter = formatter;
    this.next = null;
  }
  setNext(h) { this.next = h; return h; } // so calls chain: a.setNext(b).setNext(c)
  handle(r) {
    if (r.level >= this.threshold) this.emit(r);
    if (this.next) this.next.handle(r);
  }
  emit() { throw new Error("subclass must implement emit"); }
  async close() { if (this.next) await this.next.close(); }
}

class ConsoleHandler extends Handler {
  emit(r) { console.log(this.formatter.format(r)); } // one thread: lines can never interleave
}

// Stands in for a file: keeps lines in memory so demos and tests stay deterministic.
class MemoryHandler extends Handler {
  constructor(threshold, formatter) { super(threshold, formatter); this.lines = []; }
  emit(r) { this.lines.push(this.formatter.format(r)); }
}

// Callers only enqueue; a worker drains the queue on a later tick of the event loop.
// JavaScript has one thread, so "block" cannot pause the caller. Instead the caller
// drains the backlog itself when the queue is full ("caller runs"): same back-pressure, same order.
class AsyncHandler extends Handler {
  constructor(target, capacity, policy) {
    super(target.threshold, null);
    this.target = target;
    this.capacity = capacity; // bounded: memory can never blow up
    this.policy = policy;
    this.queue = [];
    this.dropped = 0;
    this.started = false;
    this.scheduled = false;
  }
  start() { this.started = true; this.schedule(); }
  schedule() {
    if (!this.started || this.scheduled || this.queue.length === 0) return;
    this.scheduled = true;
    setImmediate(() => { this.scheduled = false; this.drain(); });
  }
  drain() { while (this.queue.length) this.target.emit(this.queue.shift()); }
  emit(r) {
    if (this.queue.length >= this.capacity) {
      if (this.policy === AsyncHandler.DROP) { this.dropped++; return; } // count what we lose
      this.drain(); // BLOCK: the caller pays for the write, so it slows down
    }
    this.queue.push(r);
    this.schedule();
  }
  async close() {
    if (!this.started) this.start();
    await new Promise((resolve) => setImmediate(resolve)); // let any scheduled drain run first
    this.drain();
    await this.target.close();
    await super.close();
  }
}
AsyncHandler.BLOCK = "block";
AsyncHandler.DROP = "drop";

class Logger {
  constructor(name, level, head, clock, context = []) {
    Object.assign(this, { name, level, head, clock, context }); // context: fields on every record
  }
  withFields(fields) {
    return new Logger(this.name, this.level, this.head, this.clock, [...this.context, ...Object.entries(fields)]);
  }
  isEnabled(level) { return level >= this.level; }
  log(level, message, fields = {}) {
    if (!this.isEnabled(level)) return; // cheap exit before any formatting work
    const record = { tsMs: this.clock.nowMs(), level, logger: this.name, message,
      fields: [...this.context, ...Object.entries(fields)] };
    this.head.handle(record);
  }
  debug(m, f) { this.log(Level.DEBUG, m, f); }
  info(m, f) { this.log(Level.INFO, m, f); }
  warn(m, f) { this.log(Level.WARN, m, f); }
  error(m, f) { this.log(Level.ERROR, m, f); }
  fatal(m, f) { this.log(Level.FATAL, m, f); }
}

// Registry of named loggers: the same name always returns the same Logger.
let defaultManager = null;
class LogManager {
  constructor(clock, head, level) {
    Object.assign(this, { clock, head, level });
    this.loggers = new Map();
  }
  getLogger(name) {
    if (!this.loggers.has(name)) this.loggers.set(name, new Logger(name, this.level, this.head, this.clock));
    return this.loggers.get(name);
  }
  setLevel(name, level) { this.getLogger(name).level = level; }
  shutdown() { return this.head.close(); }

  // Process-wide instance for code that cannot be handed one. Prefer passing a LogManager in.
  // (A Node module is itself cached, so exporting one instance is the usual "singleton".)
  static getDefault() {
    if (!defaultManager) {
      defaultManager = new LogManager(new SystemClock(), new ConsoleHandler(Level.INFO, new PlainFormatter()), Level.INFO);
    }
    return defaultManager;
  }
}

async function main() {
  const clock = new TickingClock(1000, 250);

  console.log("== 1. Levels and the handler chain ==");
  const console_ = new ConsoleHandler(Level.DEBUG, new PlainFormatter());
  const file = new MemoryHandler(Level.INFO, new JsonFormatter());
  const alerts = new MemoryHandler(Level.ERROR, new PlainFormatter());
  console_.setNext(file).setNext(alerts);
  const mgr = new LogManager(clock, console_, Level.INFO);
  const log = mgr.getLogger("checkout");
  log.debug("Cart details", { items: "3" });
  log.info("Cart loaded", { items: "3" });
  log.warn("Coupon expired", { code: "DIWALI50" });
  log.error("Payment failed", { orderId: "OD-1001", reason: "gateway timeout" });
  console.log("file (JSON, INFO+) has " + file.lines.length + " lines, alerts (ERROR+) has " + alerts.lines.length);
  mgr.setLevel("checkout", Level.DEBUG);
  log.debug("Cart details", { items: "3" });
  console.log("after switching checkout to DEBUG: file still has " + file.lines.length + " lines");

  console.log("== 2. Structured fields and a correlation id ==");
  const req = mgr.getLogger("payments").withFields({ cid: "req-7f3a", userId: "U42" });
  req.info("Charging card", { amount: "499" });
  req.error('Bank said "insufficient funds"', { code: "51" });
  for (const line of file.lines.slice(-2)) console.log("file: " + line);
  console.log("alerts: " + alerts.lines[alerts.lines.length - 1]);

  console.log("== 3. Registry ==");
  console.log("same logger for 'checkout': " + (mgr.getLogger("checkout") === log));
  console.log("default manager is a singleton: " + (LogManager.getDefault() === LogManager.getDefault()));

  console.log("== 4. Async handler, block policy ==");
  const sink = new MemoryHandler(Level.DEBUG, new PlainFormatter());
  const asyncBlock = new AsyncHandler(sink, 4, AsyncHandler.BLOCK);
  asyncBlock.start();
  const workers = new LogManager(clock, asyncBlock, Level.INFO).getLogger("worker");
  for (let i = 1; i <= 6; i++) workers.info("Processed batch", { n: String(i) });
  await asyncBlock.close();
  console.log("written " + sink.lines.length + ", dropped " + asyncBlock.dropped);
  console.log("first: " + sink.lines[0]);
  console.log("last:  " + sink.lines[sink.lines.length - 1]);

  console.log("== 5. Async handler, drop policy (worker paused, like a stuck disk) ==");
  const sink2 = new MemoryHandler(Level.DEBUG, new PlainFormatter());
  const asyncDrop = new AsyncHandler(sink2, 3, AsyncHandler.DROP);
  const clicks = new LogManager(clock, asyncDrop, Level.INFO).getLogger("clicks");
  for (let i = 1; i <= 5; i++) clicks.info("Ad click", { id: String(i) });
  await asyncDrop.close(); // starts the worker, drains the queue, then stops
  console.log("written " + sink2.lines.length + ", dropped " + asyncDrop.dropped);
  for (const line of sink2.lines) console.log("  " + line);
}

main();`,
      go: String.raw`// Logging framework: levels, a chain of handlers, pluggable formatters,
// a registry of named loggers, structured fields and an async handler.
// Run: go run main.go
package main

import (
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type Level int

const (
	DEBUG Level = 10
	INFO  Level = 20
	WARN  Level = 30
	ERROR Level = 40
	FATAL Level = 50
)

func (l Level) String() string {
	return map[Level]string{DEBUG: "DEBUG", INFO: "INFO", WARN: "WARN", ERROR: "ERROR", FATAL: "FATAL"}[l]
}

type Field struct{ Key, Value string }

type Record struct {
	TsMs    int64
	Level   Level
	Logger  string
	Message string
	Fields  []Field
}

// ---------- Injectable clock: tests never print real timestamps ----------
type Clock interface{ NowMs() int64 }

type SystemClock struct{}

func (SystemClock) NowMs() int64 { return time.Now().UnixMilli() }

// TickingClock starts at start and moves forward step on every read.
type TickingClock struct{ t, step int64 }

func (c *TickingClock) NowMs() int64 { return atomic.AddInt64(&c.t, c.step) - c.step }

func clockTime(ms int64) string {
	ms %= 24 * 3600 * 1000
	return fmt.Sprintf("%02d:%02d:%02d.%03d", ms/3600000, ms/60000%60, ms/1000%60, ms%1000)
}

func jsonString(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for _, ch := range s {
		switch {
		case ch == '"':
			b.WriteString("\\\"")
		case ch == '\\':
			b.WriteString("\\\\")
		case ch == '\n':
			b.WriteString("\\n")
		case ch < 0x20:
			fmt.Fprintf(&b, "\\u%04x", ch)
		default:
			b.WriteRune(ch)
		}
	}
	b.WriteByte('"')
	return b.String()
}

// ---------- Strategy: how a record becomes a line ----------
type Formatter interface{ Format(r *Record) string }

type PlainFormatter struct{}

func (PlainFormatter) Format(r *Record) string {
	line := fmt.Sprintf("%s %-5s [%s] %s", clockTime(r.TsMs), r.Level, r.Logger, r.Message)
	for _, f := range r.Fields {
		line += " " + f.Key + "=" + f.Value
	}
	return line
}

type JSONFormatter struct{}

func (JSONFormatter) Format(r *Record) string {
	parts := []string{fmt.Sprintf("\"ts\":%d", r.TsMs), fmt.Sprintf("\"level\":\"%s\"", r.Level),
		"\"logger\":" + jsonString(r.Logger), "\"msg\":" + jsonString(r.Message)}
	for _, f := range r.Fields {
		parts = append(parts, jsonString(f.Key)+":"+jsonString(f.Value))
	}
	return "{" + strings.Join(parts, ",") + "}"
}

// ---------- Appenders: where a line goes ----------
type Appender interface {
	Append(r *Record)
	Close()
}

type ConsoleAppender struct {
	mu sync.Mutex
	f  Formatter
}

func (a *ConsoleAppender) Append(r *Record) {
	line := a.f.Format(r)
	a.mu.Lock() // whole lines, never interleaved
	defer a.mu.Unlock()
	fmt.Println(line)
}
func (a *ConsoleAppender) Close() {}

// MemoryAppender stands in for a file: keeps lines in memory so demos and tests stay deterministic.
type MemoryAppender struct {
	mu    sync.Mutex
	f     Formatter
	lines []string
}

func (a *MemoryAppender) Append(r *Record) {
	line := a.f.Format(r)
	a.mu.Lock()
	defer a.mu.Unlock()
	a.lines = append(a.lines, line)
}
func (a *MemoryAppender) Close() {}
func (a *MemoryAppender) Lines() []string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return append([]string(nil), a.lines...)
}

type Policy int

const (
	Block Policy = iota
	Drop
)

// AsyncAppender: callers only send on a buffered channel; one goroutine writes to the slow target.
type AsyncAppender struct {
	target  Appender
	policy  Policy
	ch      chan *Record // bounded: memory can never blow up
	dropped atomic.Int64
	wg      sync.WaitGroup
	once    sync.Once
}

func NewAsyncAppender(target Appender, capacity int, p Policy) *AsyncAppender {
	return &AsyncAppender{target: target, policy: p, ch: make(chan *Record, capacity)}
}

func (a *AsyncAppender) Start() {
	a.once.Do(func() {
		a.wg.Add(1)
		go func() {
			defer a.wg.Done()
			for r := range a.ch { // ends when the channel is closed and empty
				a.target.Append(r)
			}
		}()
	})
}

func (a *AsyncAppender) Append(r *Record) {
	if a.policy == Block {
		a.ch <- r // back-pressure: the caller waits for space
		return
	}
	select {
	case a.ch <- r:
	default:
		a.dropped.Add(1) // never slow the caller down; count what we lose
	}
}

func (a *AsyncAppender) Close() {
	a.Start()
	close(a.ch) // the worker still drains everything already buffered
	a.wg.Wait()
	a.target.Close()
}

// ---------- Chain of Responsibility: each node filters by level, then passes on ----------
// Go has no inheritance, so a node wraps an Appender instead of subclassing a Handler.
type Handler struct {
	Threshold Level
	Out       Appender
	next      *Handler
}

func (h *Handler) SetNext(n *Handler) *Handler { h.next = n; return n } // so calls chain

func (h *Handler) Handle(r *Record) {
	if r.Level >= h.Threshold {
		h.Out.Append(r)
	}
	if h.next != nil {
		h.next.Handle(r)
	}
}

func (h *Handler) Close() {
	h.Out.Close()
	if h.next != nil {
		h.next.Close()
	}
}

type Logger struct {
	Name    string
	level   atomic.Int32
	head    *Handler
	clock   Clock
	context []Field // fields added to every record, e.g. a correlation id
}

func newLogger(name string, level Level, head *Handler, clock Clock, ctx []Field) *Logger {
	l := &Logger{Name: name, head: head, clock: clock, context: ctx}
	l.level.Store(int32(level))
	return l
}

func pairs(kv []string) []Field {
	out := make([]Field, 0, len(kv)/2)
	for i := 0; i+1 < len(kv); i += 2 {
		out = append(out, Field{kv[i], kv[i+1]})
	}
	return out
}

func (l *Logger) With(kv ...string) *Logger {
	ctx := append(append([]Field{}, l.context...), pairs(kv)...)
	return newLogger(l.Name, Level(l.level.Load()), l.head, l.clock, ctx)
}

func (l *Logger) Enabled(lv Level) bool { return lv >= Level(l.level.Load()) }

func (l *Logger) Log(lv Level, msg string, kv ...string) {
	if !l.Enabled(lv) {
		return // cheap exit before any formatting work
	}
	fields := append(append([]Field{}, l.context...), pairs(kv)...)
	l.head.Handle(&Record{TsMs: l.clock.NowMs(), Level: lv, Logger: l.Name, Message: msg, Fields: fields})
}

func (l *Logger) Debug(m string, kv ...string) { l.Log(DEBUG, m, kv...) }
func (l *Logger) Info(m string, kv ...string)  { l.Log(INFO, m, kv...) }
func (l *Logger) Warn(m string, kv ...string)  { l.Log(WARN, m, kv...) }
func (l *Logger) Error(m string, kv ...string) { l.Log(ERROR, m, kv...) }
func (l *Logger) Fatal(m string, kv ...string) { l.Log(FATAL, m, kv...) }

// LogManager is a registry of named loggers: the same name always returns the same Logger.
type LogManager struct {
	mu      sync.Mutex
	clock   Clock
	head    *Handler
	level   Level
	loggers map[string]*Logger
}

func NewLogManager(clock Clock, head *Handler, level Level) *LogManager {
	return &LogManager{clock: clock, head: head, level: level, loggers: map[string]*Logger{}}
}

func (m *LogManager) GetLogger(name string) *Logger {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.loggers[name]; !ok {
		m.loggers[name] = newLogger(name, m.level, m.head, m.clock, nil)
	}
	return m.loggers[name]
}

func (m *LogManager) SetLevel(name string, lv Level) { m.GetLogger(name).level.Store(int32(lv)) }
func (m *LogManager) Shutdown()                      { m.head.Close() }

// Default is a process-wide instance for code that cannot be handed one. Prefer passing a LogManager in.
var (
	defaultOnce    sync.Once
	defaultManager *LogManager
)

func Default() *LogManager {
	defaultOnce.Do(func() { // sync.Once: created exactly once, even with many goroutines
		defaultManager = NewLogManager(SystemClock{}, &Handler{Threshold: INFO, Out: &ConsoleAppender{f: PlainFormatter{}}}, INFO)
	})
	return defaultManager
}

func main() {
	clock := &TickingClock{t: 1000, step: 250}

	fmt.Println("== 1. Levels and the handler chain ==")
	file := &MemoryAppender{f: JSONFormatter{}}
	alerts := &MemoryAppender{f: PlainFormatter{}}
	console := &Handler{Threshold: DEBUG, Out: &ConsoleAppender{f: PlainFormatter{}}}
	console.SetNext(&Handler{Threshold: INFO, Out: file}).SetNext(&Handler{Threshold: ERROR, Out: alerts})
	mgr := NewLogManager(clock, console, INFO)
	log := mgr.GetLogger("checkout")
	log.Debug("Cart details", "items", "3")
	log.Info("Cart loaded", "items", "3")
	log.Warn("Coupon expired", "code", "DIWALI50")
	log.Error("Payment failed", "orderId", "OD-1001", "reason", "gateway timeout")
	fmt.Printf("file (JSON, INFO+) has %d lines, alerts (ERROR+) has %d\n", len(file.Lines()), len(alerts.Lines()))
	mgr.SetLevel("checkout", DEBUG)
	log.Debug("Cart details", "items", "3")
	fmt.Printf("after switching checkout to DEBUG: file still has %d lines\n", len(file.Lines()))

	fmt.Println("== 2. Structured fields and a correlation id ==")
	req := mgr.GetLogger("payments").With("cid", "req-7f3a", "userId", "U42")
	req.Info("Charging card", "amount", "499")
	req.Error("Bank said \"insufficient funds\"", "code", "51")
	lines := file.Lines()
	for _, line := range lines[len(lines)-2:] {
		fmt.Println("file: " + line)
	}
	al := alerts.Lines()
	fmt.Println("alerts: " + al[len(al)-1])

	fmt.Println("== 3. Registry ==")
	fmt.Println("same logger for 'checkout':", mgr.GetLogger("checkout") == log)
	fmt.Println("default manager is a singleton:", Default() == Default())

	fmt.Println("== 4. Async handler, block policy ==")
	sink := &MemoryAppender{f: PlainFormatter{}}
	asyncBlock := NewAsyncAppender(sink, 4, Block)
	asyncBlock.Start()
	workerMgr := NewLogManager(clock, &Handler{Threshold: DEBUG, Out: asyncBlock}, INFO)
	for i := 1; i <= 6; i++ {
		workerMgr.GetLogger("worker").Info("Processed batch", "n", fmt.Sprint(i))
	}
	workerMgr.Shutdown()
	s1 := sink.Lines()
	fmt.Printf("written %d, dropped %d\n", len(s1), asyncBlock.dropped.Load())
	fmt.Println("first: " + s1[0])
	fmt.Println("last:  " + s1[len(s1)-1])

	fmt.Println("== 5. Async handler, drop policy (worker paused, like a stuck disk) ==")
	sink2 := &MemoryAppender{f: PlainFormatter{}}
	asyncDrop := NewAsyncAppender(sink2, 3, Drop)
	clickMgr := NewLogManager(clock, &Handler{Threshold: DEBUG, Out: asyncDrop}, INFO)
	for i := 1; i <= 5; i++ {
		clickMgr.GetLogger("clicks").Info("Ad click", "id", fmt.Sprint(i))
	}
	clickMgr.Shutdown() // starts the worker, drains the channel, then stops
	s2 := sink2.Lines()
	fmt.Printf("written %d, dropped %d\n", len(s2), asyncDrop.dropped.Load())
	for _, line := range s2 {
		fmt.Println("  " + line)
	}
}`,
    },
  },
  diagrams: {
    classes: String.raw`classDiagram
  class LogManager {
    -Map~String,Logger~ loggers
    -Handler head
    +getLogger(name) Logger
    +setLevel(name, level)
    +shutdown()
    +getDefault()$ LogManager
  }
  class Logger {
    +String name
    -Level level
    -List~Field~ context
    +withFields(kv) Logger
    +isEnabled(level) bool
    +log(level, msg, fields)
  }
  class LogRecord {
    +long tsMs
    +Level level
    +String logger
    +String message
    +List~Field~ fields
  }
  class Handler {
    <<abstract>>
    +Level threshold
    -Formatter formatter
    -Handler next
    +setNext(h) Handler
    +handle(record)
    +emit(record)*
    +close()
  }
  class Formatter {
    <<interface>>
    +format(record) String
  }
  class AsyncHandler {
    -BlockingQueue queue
    -Policy policy
    -Thread worker
    +int dropped
  }
  class Clock {
    <<interface>>
    +nowMs() long
  }
  LogManager *-- Logger
  Logger --> Handler
  Logger --> Clock
  Logger ..> LogRecord : creates
  Handler --> Handler : next
  Handler o-- Formatter
  Handler <|-- ConsoleHandler
  Handler <|-- MemoryHandler
  Handler <|-- AsyncHandler
  AsyncHandler o-- Handler : target
  Formatter <|.. PlainFormatter
  Formatter <|.. JsonFormatter`,
    flow: String.raw`sequenceDiagram
  participant App as Request thread
  participant L as Logger checkout
  participant C as Console DEBUG+
  participant F as File INFO+
  participant A as Alerts ERROR+
  App->>L: error("Payment failed", orderId)
  L->>L: ERROR at or above logger level?
  L->>L: build LogRecord with clock and context
  L->>C: handle(record)
  C->>C: format plain, print
  C->>F: handle(record)
  F->>F: format JSON, store
  F->>A: handle(record)
  A->>A: format plain, store
  A-->>App: return`,
  },
});
