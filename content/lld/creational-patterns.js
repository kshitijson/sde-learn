SD.register({
  id: "creational-patterns",
  html: String.raw`
<p class="lead">Creational patterns answer one question: who creates this object, and how? Calling <code>new</code> everywhere ties your code to concrete classes, scatters setup logic, and makes testing painful. The five classic creational patterns (Singleton, Factory Method, Abstract Factory, Builder and Prototype) each move object creation to one sensible place. This page explains each one with a real product example, a class diagram, runnable code in five languages, and an honest note on when the pattern is overkill.</p>

<h2>Why creation needs a pattern at all</h2>
<p>A design pattern is a named, reusable solution to a problem that keeps coming up in object-oriented design. The names come from the 1994 "Gang of Four" book (four authors: Gamma, Helm, Johnson, Vlissides). The value of the names is mostly communication: saying "the payment gateways come from an abstract factory" tells another engineer the whole shape of your code in one sentence.</p>
<p>Creation becomes a problem in three situations:</p>
<ul>
<li><strong>The caller should not know the concrete class.</strong> A Swiggy order service wants "something that can send a notification". Whether that is SMS or WhatsApp depends on the user's settings, not on the order service.</li>
<li><strong>Construction is complicated.</strong> An HTTP request with a URL, method, ten optional headers, a body, a timeout and a retry count. A constructor with eight parameters is a bug waiting to happen.</li>
<li><strong>There must be exactly one, or exactly a copy.</strong> One connection pool per process. Or a new campaign that starts as a copy of last year's Diwali campaign.</li>
</ul>
<p>Each pattern below fixes one of these. Keep the <a href="#/p/solid">SOLID principles</a> in mind while reading: most creational patterns exist to support dependency inversion ("depend on interfaces, not on concrete classes") and the open/closed principle ("add new types without editing old code").</p>

<div class="callout info"><strong>Quick map</strong>
<table>
<thead><tr><th>Pattern</th><th>One-line intent</th></tr></thead>
<tbody>
<tr><td>Singleton</td><td>Ensure a class has one instance and give a global way to reach it.</td></tr>
<tr><td>Factory Method / Simple Factory</td><td>Let one method decide which concrete class to create, so callers only see an interface.</td></tr>
<tr><td>Abstract Factory</td><td>Create whole families of related objects that must be used together.</td></tr>
<tr><td>Builder</td><td>Construct a complex object step by step, with readable optional fields and one validation point.</td></tr>
<tr><td>Prototype</td><td>Create new objects by copying a configured existing one.</td></tr>
</tbody>
</table>
</div>

<h2>Singleton</h2>
<p><strong>Intent:</strong> make sure a class has exactly one instance in the process, and provide one access point to it.</p>
<h3>The problem it solves</h3>
<p>Think of the PhonePe payments service. At startup it reads configuration (gateway timeouts, the AWS region, feature flags) and creates an HTTP connection pool to the bank switch. Creating the pool is expensive (hundreds of TCP and TLS handshakes) and having two pools would double the open connections. Every class that needs config or the pool should get the <em>same</em> object. Other classic candidates are a logger, an ID generator, a metrics registry and a cache client.</p>
<div data-diagram="singleton" data-caption="Singleton: a private constructor and a static access point. The arrow from PaymentService shows the better alternative: receive the instance instead of fetching it."></div>
<h3>How it works</h3>
<ol class="steps">
<li>Make the constructor private so nobody else can call <code>new</code>.</li>
<li>Keep the single instance in a static field (or a module-level variable).</li>
<li>Expose a static <code>getInstance()</code> that returns it, creating it the first time if you want lazy creation.</li>
<li>Make that first creation thread-safe. This is the part interviewers probe.</li>
</ol>
<h3>Thread-safe creation, language by language</h3>
<p>The naive version is <code>if (instance == null) instance = new X();</code>. Two threads can both see <code>null</code> and both create an instance. This is the same check-then-act race described in <a href="#/p/concurrency">Concurrency Basics</a>. Each language has an idiomatic fix:</p>
<div class="tabs">
<section data-tab="Java">
<p><strong>Holder idiom</strong> (best lazy option): put the instance in a private static nested class. The JVM loads that class only on the first <code>getInstance()</code> call, and class loading is thread-safe by specification. No locks, no <code>volatile</code>.</p>
<p><strong>Enum singleton</strong>: <code>enum IdGenerator { INSTANCE; }</code>. Joshua Bloch's <em>Effective Java</em> calls this the best way, because it is also safe against reflection and serialization creating a second copy.</p>
<p><strong>Double-checked locking</strong>: check, lock, check again. It only works if the field is <code>volatile</code>; without it, another thread can see a half-constructed object. Know it for interviews, but prefer the holder idiom.</p>
</section>
<section data-tab="Python">
<p>A <strong>module is already a singleton</strong>. Python runs a module's top-level code once, on first import, under the import lock. Write <code>config = AppConfig()</code> in <code>config.py</code> and every <code>from config import config</code> gets the same object. For lazy creation, use a module-level function with a <code>threading.Lock</code> and a double check. Avoid metaclass tricks unless you really need them.</p>
</section>
<section data-tab="C++">
<p><strong>Meyers singleton</strong>: return a reference to a function-local <code>static</code>. Since C++11 the standard guarantees that a local static is initialised exactly once even when many threads call the function together. Delete the copy constructor and assignment so nobody makes a second copy by accident. For non-static lazy members, <code>std::call_once</code> with a <code>std::once_flag</code> does the same job.</p>
</section>
<section data-tab="Go">
<p>Go has no classes or private constructors. Use an unexported package-level variable and <code>sync.Once</code>: <code>once.Do(func() { instance = load() })</code> runs the function exactly once, and other callers wait until it finishes. Go 1.21 added <code>sync.OnceValue</code>, which wraps this into one line. A plain package-level <code>var</code> initialised at startup is also a singleton, because package initialisation is single-threaded.</p>
</section>
<section data-tab="JavaScript">
<p>Node and browsers cache each ES or CommonJS module after the first import, so <code>export default new AppConfig()</code> gives every importer the same object. JavaScript runs your code on one thread, so there is no creation race. A class with a <code>static #instance</code> field also works when you want the explicit <code>getInstance()</code> style.</p>
</section>
</div>
<div data-code="singleton"></div>
<h3>Why Singleton is often an anti-pattern</h3>
<p>Singleton is the most famous pattern and also the most criticised. The class itself is fine. The trouble is the global <code>getInstance()</code> call sprinkled through the code base.</p>
<div class="grid-2">
<div class="card bad"><strong>Problems</strong>
<ul>
<li><strong>Hidden global state.</strong> Any class can call <code>AppConfig.getInstance()</code>. You cannot see a class's dependencies by reading its constructor.</li>
<li><strong>Hard to test.</strong> Tests share one instance, so one test's changes leak into the next. You cannot pass in a fake.</li>
<li><strong>Tight coupling.</strong> Code is bound to one concrete class forever.</li>
<li><strong>"Only one" rarely stays true.</strong> One database becomes a primary and a replica. One lot becomes 50 lots (see <a href="#/p/parking-lot">Parking Lot</a>).</li>
</ul>
</div>
<div class="card good"><strong>The fix: dependency injection</strong>
<ul>
<li>Create one instance at startup (in <code>main</code> or a DI container).</li>
<li>Pass it into constructors that need it: <code>new PaymentService(config)</code>.</li>
<li>You still have "one instance" in practice, but dependencies are visible and tests can pass a fake.</li>
<li>Spring beans are singletons by default in exactly this way: the container makes one, and injects it. No <code>getInstance()</code> anywhere.</li>
</ul>
</div>
</div>
<h3>When to use it, and when it is overkill</h3>
<p>Use a singleton for things that are truly process-wide and mostly stateless or read-only: a logger, a metrics registry, a loaded config, a connection pool. Even then, prefer creating it once and injecting it. It is overkill (and harmful) for business objects like <code>ParkingLot</code>, <code>Cart</code> or <code>UserService</code>: there is no physical reason they must be unique, and you will want several in tests.</p>
<h3>In LLD rounds and real libraries</h3>
<ul>
<li><code>java.lang.Runtime.getRuntime()</code> is a textbook eager singleton.</li>
<li><code>java.util.Calendar.getInstance()</code> is <em>not</em> a singleton, despite the name. It returns a new calendar each time, chosen by locale. It is a static factory method. Interviewers like this trap.</li>
<li>Python's <code>logging.getLogger("payments")</code> returns the same logger for the same name: a keyed singleton, sometimes called a multiton.</li>
<li>In machine-coding rounds, if you make <code>ParkingLot</code> or <code>Elevator</code> controller a singleton, say why and mention the testing cost. That earns more than the singleton itself.</li>
</ul>

<h2>Factory Method and Simple Factory</h2>
<p><strong>Intent:</strong> move the decision "which concrete class do I create?" into one method, so the rest of the code works only with an interface.</p>
<h3>The problem it solves</h3>
<p>Swiggy sends order updates by SMS, email, app push and WhatsApp. Without a factory, every place that sends a message has a block like <code>if (channel == "sms") new SmsSender() else if (channel == "email") ...</code>. Adding WhatsApp means finding and editing every one of those blocks. With a factory, that decision lives in exactly one place, and callers just ask for "a sender for this channel".</p>
<p>The term "factory" covers three related ideas. People mix them up, so be precise:</p>
<table>
<thead><tr><th>Name</th><th>What it is</th><th>Example</th></tr></thead>
<tbody>
<tr><td>Static factory method</td><td>A static method used instead of a constructor. Can cache, return a subtype, or have a descriptive name.</td><td><code>Integer.valueOf(42)</code>, <code>List.of(...)</code>, <code>Calendar.getInstance()</code></td></tr>
<tr><td>Simple factory</td><td>One class or function with a <code>create(type)</code> method that picks the concrete class. Not an official GoF pattern, but the most common in real code.</td><td><code>NotificationFactory.create("sms")</code></td></tr>
<tr><td>Factory Method (GoF)</td><td>A base class defines a workflow and calls an abstract <code>createX()</code> method. Each subclass overrides it to decide the concrete product.</td><td><code>Collection.iterator()</code>: each collection creates its own iterator</td></tr>
</tbody>
</table>
<div data-diagram="factory" data-caption="Simple factory (left) picks a sender from a registry. Factory Method (right) lets each OrderNotifier subclass decide which sender to create."></div>
<h3>How it works</h3>
<p>The simple factory below keeps a registry: a map from channel name to a small function that builds the sender. Adding WhatsApp is one new class and one <code>register()</code> line, and no existing <code>if</code> chain is edited. That is the open/closed principle in action. Unknown channels fail loudly with a clear error instead of silently returning <code>null</code>.</p>
<p>The Factory Method part shows the GoF version. <code>OrderNotifier</code> owns the workflow (build the message, send it) and leaves one step, <code>createSender()</code>, to subclasses. In Go, which has no inheritance, the same idea is a struct that holds a constructor function.</p>
<div data-code="factory"></div>
<h3>When to use it, and when it is overkill</h3>
<p>Use a factory when the concrete class depends on runtime data (user preference, config, request type), when construction has steps you do not want repeated, or when you want to swap in fakes for tests. It is overkill when there is exactly one implementation and no realistic second one. Writing <code>UserFactory.create()</code> that only does <code>new User()</code> adds a file and nothing else. Add the factory when the second type actually arrives.</p>
<h3>In LLD rounds and real libraries</h3>
<ul>
<li>Machine-coding problems are full of it: <code>VehicleFactory</code> in <a href="#/p/parking-lot">Parking Lot</a>, <code>PieceFactory</code> in chess, a <code>PaymentMethodFactory</code> in <a href="#/p/vending-machine">Vending Machine</a>, an <code>ExpenseSplitFactory</code> (equal, exact, percent) in <a href="#/p/splitwise">Splitwise</a>.</li>
<li>Java: <code>Calendar.getInstance()</code>, <code>NumberFormat.getInstance(locale)</code>, <code>DriverManager.getConnection(url)</code> (the URL decides which JDBC driver), SLF4J's <code>LoggerFactory.getLogger()</code>.</li>
<li>Go: constructor functions like <code>http.NewRequest</code> and <code>errors.New</code> are static factories by convention. <code>database/sql</code> picks a driver by name, the same registry idea as our factory.</li>
<li>Python: <code>logging.getLogger</code>, and <code>json.loads</code> creating dicts, lists or numbers depending on input.</li>
</ul>

<h2>Abstract Factory</h2>
<p><strong>Intent:</strong> provide one interface for creating a <em>family</em> of related objects, so that objects from different families are never mixed.</p>
<h3>The problem it solves</h3>
<p>An Indian e-commerce company like Flipkart or Myntra uses Razorpay for Indian customers and Stripe for international ones. Each provider needs several cooperating objects: a gateway to charge, a refund client, a webhook signature verifier. A Razorpay payment id means nothing to Stripe's refund API. If the code creates these objects one by one, a single wrong <code>new</code> mixes families and you get refunds failing in production. An abstract factory hands out the whole matching set from one place.</p>
<p>The same shape appears in UI themes (a light theme creates light buttons, light checkboxes, light dialogs; a dark theme creates the dark set) and in multi-cloud code (an AWS factory creates S3 storage and SQS queues; a GCP factory creates GCS storage and Pub/Sub).</p>
<div data-diagram="abstractFactory" data-caption="Each concrete factory creates one consistent family. CheckoutService only knows the interfaces."></div>
<h3>How it works</h3>
<ol class="steps">
<li>Define an interface for each product: <code>PaymentGateway</code>, <code>RefundService</code>.</li>
<li>Define the abstract factory with one creation method per product: <code>createGateway()</code>, <code>createRefundService()</code>.</li>
<li>Write one concrete factory per family: <code>RazorpayFactory</code>, <code>StripeFactory</code>. Each returns only its own family's products.</li>
<li>Pick the factory once, at startup or per request (by country here), and pass it to the client. The client never names a concrete product.</li>
</ol>
<div data-code="abstractFactory"></div>
<h3>Factory Method vs Abstract Factory</h3>
<p>Factory Method creates <em>one</em> product and is usually one overridable method. Abstract Factory creates <em>several related</em> products and is a whole object you pass around. In practice an abstract factory is often a group of factory methods on one interface. If interviewers ask the difference, "one product vs a family that must match" is the crisp answer.</p>
<h3>When to use it, and when it is overkill</h3>
<p>Use it when you truly have two or more families and mixing them is a bug. It is overkill with a single product type (a plain factory is enough) or a single family (just use the classes). A weakness to mention: adding a new <em>product</em> to every family (say a <code>PayoutService</code>) means editing the factory interface and every concrete factory. Adding a new <em>family</em> (PayU) is easy.</p>
<h3>In LLD rounds and real libraries</h3>
<ul>
<li>Java: <code>javax.xml.parsers.DocumentBuilderFactory</code>, and JDBC, where a <code>Connection</code> from one driver creates matching <code>Statement</code> and <code>PreparedStatement</code> objects. Swing's look-and-feel classes create a full matching widget set.</li>
<li>In rounds it fits "support multiple payment providers", "support light and dark UI", or a <a href="#/p/notification-system">notification system</a> where each vendor needs a client plus a delivery-report parser.</li>
</ul>

<h2>Builder</h2>
<p><strong>Intent:</strong> build a complex object step by step through readable named calls, then validate once and produce an immutable result.</p>
<h3>The problem it solves</h3>
<p>Consider an HTTP request in a Swiggy partner integration: a required URL, and optional method, headers, body, timeout and retry count. Or a Flipkart order with 15 optional fields: coupon, gift wrap, delivery slot, GST invoice details, and so on. Two bad options exist without a builder:</p>
<ul>
<li><strong>Telescoping constructors:</strong> <code>Request(url)</code>, <code>Request(url, method)</code>, <code>Request(url, method, body)</code>, <code>Request(url, method, body, timeout, retries)</code>... A call like <code>new Request(u, "POST", b, 2000, 3)</code> is unreadable, and swapping two <code>int</code> arguments compiles fine and silently breaks.</li>
<li><strong>Setters on a mutable object:</strong> readable, but the object is half-built between calls, nothing checks that the combination is valid, and it cannot be immutable.</li>
</ul>
<p>A builder gives named, chainable calls (a <em>fluent API</em>) like <code>.method("POST").timeoutMs(2000).retries(3)</code>, defaults for everything optional, and a single <code>build()</code> that checks the whole object, for example "a GET request cannot have a body".</p>
<div data-diagram="builder" data-caption="Builder: required fields go in the builder's constructor, optional ones through chainable methods, and build() validates and creates the immutable request."></div>
<h3>How it works</h3>
<ol class="steps">
<li>The product (<code>HttpRequest</code>) has a private constructor and final fields. It can only be made by its builder.</li>
<li>Required values go into <code>newBuilder(url)</code>, so you cannot forget them.</li>
<li>Each optional setter stores the value and returns the builder itself, so calls chain.</li>
<li><code>build()</code> checks cross-field rules, then creates the product. Once built, it cannot change.</li>
</ol>
<div class="tabs">
<section data-tab="Java / C++ / JS">
<p>A classic builder class. In Java it is usually a static nested <code>Builder</code> with access to the product's private constructor. In C++ each setter returns <code>Builder&amp;</code>. In JavaScript, setters return <code>this</code>, and the final object is frozen with <code>Object.freeze</code>. Many JavaScript codebases skip the builder and pass an options object (<code>fetch(url, { method, headers })</code>), which works because JavaScript has object literals with named keys.</p>
</section>
<section data-tab="Python">
<p>Python has keyword arguments with defaults, so <code>HttpRequest(url, method="POST", timeout_ms=2000)</code> already solves telescoping constructors. A frozen <code>@dataclass</code> plus <code>__post_init__</code> validation is often all you need. A fluent builder is still useful when the object is assembled across many steps or functions, which the code shows.</p>
</section>
<section data-tab="Go: functional options">
<p>Go has no overloading and no default arguments. The idiom is <em>functional options</em>: <code>NewRequest(url, WithMethod("POST"), WithTimeout(2*time.Second))</code>. Each option is a function that modifies the config. The constructor applies defaults, then each option, then validates. You will see this in gRPC (<code>grpc.Dial(addr, grpc.WithInsecure())</code>), Zap and many other Go libraries.</p>
</section>
</div>
<div data-code="builder"></div>
<h3>When to use it, and when it is overkill</h3>
<p>Use a builder when an object has four or more parameters, several of them optional, or rules that span fields. It is overkill for a <code>Point(x, y)</code> or any class with two or three required fields: a plain constructor is clearer. In languages with named arguments (Python, Kotlin) reach for those first.</p>
<h3>In LLD rounds and real libraries</h3>
<ul>
<li><code>java.net.http.HttpRequest.newBuilder()</code>, OkHttp's <code>Request.Builder</code>, Protocol Buffers' generated builders, Lombok's <code>@Builder</code>, and <code>Stream.builder()</code>.</li>
<li><code>StringBuilder</code> is a looser cousin: it builds a string step by step through chained <code>append()</code> calls, then <code>toString()</code> produces the immutable result. The point there is performance (no new string per append) more than readability.</li>
<li>In rounds: building a <code>Pizza</code> or <code>Burger</code> with toppings, an <code>Order</code> in food delivery, a search <code>Query</code> with filters, or a <code>LogRecord</code> with many optional fields in the <a href="#/p/logger">logger</a> problem.</li>
</ul>

<h2>Prototype</h2>
<p><strong>Intent:</strong> create new objects by copying an existing, already-configured object instead of building from scratch.</p>
<h3>The problem it solves</h3>
<p>Zomato's marketing team set up a "Diwali Dhamaka" campaign: discount percentage, target cities, eligible restaurants, budget caps, time windows and creative assets. For Pune they want the same campaign with one city changed. Rebuilding it field by field is slow and error-prone, and the original may have been built from a database load plus a dozen rules. Copying the configured object and tweaking the copy is simpler. The same idea powers "duplicate this slide", "duplicate this Jira ticket", and spawning 50 identical enemies in a game.</p>
<p>Prototype also helps when code holds an object only through an interface. If you have a <code>Campaign</code> reference that might really be a <code>FlashSale</code>, you cannot write <code>new FlashSale(...)</code> because you do not know the type. A virtual <code>clone()</code> asks the object to copy itself, keeping its real type.</p>
<div data-diagram="prototype" data-caption="Each class knows how to copy itself. The registry stores configured prototypes and hands out copies."></div>
<h3>Shallow vs deep copy: the real interview question</h3>
<p>A <strong>shallow copy</strong> copies the fields of the object. If a field is a reference to a list or map, the copy points at the <em>same</em> list. Edit the copy's cities and the original's cities change too. A <strong>deep copy</strong> also copies everything those references point to, so the two objects share nothing mutable.</p>
<table>
<thead><tr><th>Language</th><th>Shallow</th><th>Deep</th></tr></thead>
<tbody>
<tr><td>Java</td><td><code>Object.clone()</code> default, or copying references</td><td>Copy constructor that makes <code>new ArrayList&lt;&gt;(other.cities)</code></td></tr>
<tr><td>Python</td><td><code>copy.copy(obj)</code></td><td><code>copy.deepcopy(obj)</code></td></tr>
<tr><td>C++</td><td>Default copy when members are pointers or <code>shared_ptr</code></td><td>Value members (like <code>std::vector</code>) copy deeply by default; for pointers, write <code>clone()</code></td></tr>
<tr><td>JavaScript</td><td><code>{...obj}</code>, <code>Object.assign</code></td><td><code>structuredClone(obj)</code> (drops the class, so methods are lost) or a hand-written <code>clone()</code></td></tr>
<tr><td>Go</td><td><code>c2 := *c1</code> (slices and maps are still shared)</td><td>Copy each slice and map: <code>slices.Clone</code>, <code>maps.Clone</code></td></tr>
</tbody>
</table>
<p>Immutable values such as strings and numbers are safe to share, so "deep" only needs to go as far as mutable state. In Java, prefer a copy constructor over <code>Cloneable</code>: <em>Effective Java</em> explains that <code>Cloneable</code> is a broken interface (it has no <code>clone()</code> method, and <code>Object.clone()</code> is shallow and skips constructors).</p>
<div data-code="prototype"></div>
<h3>When to use it, and when it is overkill</h3>
<p>Use Prototype when objects are expensive or complicated to configure and you often need near-copies, or when you need to copy objects whose concrete type you do not know. It is overkill for small objects that are cheap to construct, and dangerous when the object holds resources like open files or sockets, which should not be copied at all.</p>
<h3>In LLD rounds and real libraries</h3>
<ul>
<li>Java's <code>Object.clone()</code> and copy constructors like <code>new ArrayList&lt;&gt;(other)</code>. Python's <code>copy</code> module. Go's <code>slices.Clone</code> and <code>maps.Clone</code>.</li>
<li>JavaScript's prototype chain shares the name but is a different idea: objects inherit behaviour from a prototype object; they are not copies of it.</li>
<li>Spring's <code>prototype</code> bean scope means "a new instance per request to the container", which is closer to a factory than to cloning.</li>
<li>In rounds: duplicating a document in a file system, cloning a board state to try a move in chess or <a href="#/p/tic-tac-toe">tic-tac-toe</a>, or copying a template ticket.</li>
</ul>

<h2>Choosing between them</h2>
<table>
<thead><tr><th>Pattern</th><th>Use when</th><th>Main benefit</th><th>Main cost</th><th>Overkill when</th></tr></thead>
<tbody>
<tr><td>Singleton</td><td>One shared resource per process (config, pool, logger)</td><td>One instance, easy access</td><td>Hidden global state, hard to test</td><td>Business objects; anything you might want two of</td></tr>
<tr><td>Simple Factory</td><td>Concrete type depends on runtime data</td><td>One place to add types</td><td>One more class</td><td>Only one implementation exists</td></tr>
<tr><td>Factory Method</td><td>A base workflow, subclasses pick the product</td><td>Extend by subclassing</td><td>Class per variant</td><td>Composition with a function would do</td></tr>
<tr><td>Abstract Factory</td><td>Families of products that must match</td><td>Families never mix</td><td>New product type edits every factory</td><td>Only one family or one product</td></tr>
<tr><td>Builder</td><td>Many optional fields, cross-field rules</td><td>Readable, validated, immutable</td><td>Extra builder class</td><td>Two or three required fields</td></tr>
<tr><td>Prototype</td><td>Expensive setup, near-copies, unknown concrete type</td><td>Fast, type-preserving copies</td><td>Getting deep copy right</td><td>Cheap objects; objects holding resources</td></tr>
</tbody>
</table>

<div class="callout warn"><strong>Common mistakes</strong>
<ul>
<li>Making everything a singleton "because there is only one". Most machine-coding services should be created in <code>main</code> and injected.</li>
<li>Lazy singletons without thread safety, or double-checked locking without <code>volatile</code> in Java.</li>
<li>A factory with a giant <code>switch</code> that is copied into three places. The point is one place.</li>
<li>A builder whose <code>build()</code> does no validation. Then it is just a verbose constructor.</li>
<li>Cloning with a shallow copy and then mutating a shared list.</li>
<li>Naming a class <code>SomethingFactory</code> when it only wraps <code>new</code>. Patterns should solve a problem you have today.</li>
</ul>
</div>

<div class="callout interview"><strong>Say this in the interview</strong>"Vehicle creation depends on input, so I will put it behind a small factory with a registry, which keeps the parking lot closed for modification when we add EVs. The ticket has many optional fields, so I will use a builder that validates in <code>build()</code>. I am not making the lot a singleton: I will create one instance in <code>main</code> and inject it, which gives one instance without global state and keeps it testable. If we needed a lazy singleton in Java I would use the holder idiom or an enum."</div>

<h2>Test yourself</h2>
<div class="quiz">
<details><summary>Two threads call a lazy getInstance() at the same moment. What can go wrong, and how do you fix it in Java?</summary><div>Both can see the field as <code>null</code> and both construct an instance, so you get two, and one thread may keep using the "lost" one. Fixes: the holder idiom (lazy, thread-safe via class loading), an enum singleton, an eagerly created <code>static final</code> field, or double-checked locking with a <code>volatile</code> field. In Go use <code>sync.Once</code>; in C++ a function-local static.</div></details>
<details><summary>Is Calendar.getInstance() a singleton?</summary><div>No. It returns a new <code>Calendar</code> each time, picking the concrete subclass (usually <code>GregorianCalendar</code>) from the locale and time zone. It is a static factory method. The name <code>getInstance</code> is misleading.</div></details>
<details><summary>What is the difference between Factory Method and Abstract Factory?</summary><div>Factory Method creates one product, through a method that subclasses override (or a function you pass in). Abstract Factory is an object with several creation methods that produce a family of related products which must be used together, such as a Razorpay gateway plus a Razorpay refund client. Swapping the factory swaps the whole family.</div></details>
<details><summary>Why is a builder better than a constructor with 8 parameters? How would you do it in Go?</summary><div>Named calls are readable, optional fields get defaults, two <code>int</code> arguments cannot be silently swapped, and <code>build()</code> validates cross-field rules once and returns an immutable object. In Go, use functional options: <code>NewRequest(url, WithMethod("POST"), WithRetries(3))</code>, where each option is a <code>func(*Request)</code>.</div></details>
<details><summary>You copy a Campaign, change the copy's city list, and the original changes too. Why?</summary><div>The copy was shallow: it copied the reference to the list, so both objects point to the same list. Fix it with a deep copy that creates a new list (copy constructor in Java, <code>copy.deepcopy</code> in Python, <code>slices.Clone</code> in Go, a hand-written <code>clone()</code> in C++ and JavaScript).</div></details>
<details><summary>Your teammate wants to make UserService a singleton with getInstance(). What do you suggest?</summary><div>Create one <code>UserService</code> at startup and inject it into the classes that need it (constructor injection, or a DI container such as Spring, which makes it a singleton-scoped bean). You keep one instance, but dependencies are visible, tests can pass fakes, and you are not stuck if you later need two configurations.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
<li>Creational patterns move "which class, and how to set it up" into one place, so callers depend on interfaces.</li>
<li>Singleton: thread-safe creation is the interview detail (holder idiom or enum, module, Meyers static, <code>sync.Once</code>). Prefer creating once and injecting.</li>
<li>Simple factory with a registry is the everyday workhorse. Factory Method lets subclasses choose the product. Abstract Factory keeps whole families consistent.</li>
<li>Builder fixes telescoping constructors and validates in <code>build()</code>. In Go use functional options; in Python, keyword arguments often suffice.</li>
<li>Prototype copies configured objects. Know shallow vs deep copy in your language.</li>
<li>Do not add a pattern before the problem it solves exists. Saying when a pattern is overkill impresses interviewers.</li>
</ul></div>
`,
  code: {
    singleton: {
      title: "Thread-safe singleton, and the injected alternative",
      java: String.raw`import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicLong;

public class Main {

    // Option 1: holder idiom. Lazy and thread-safe without any lock.
    // The JVM initialises Holder only on the first getInstance() call,
    // and class initialisation is guaranteed to happen exactly once.
    static final class AppConfig {
        private final Map<String, String> values = new HashMap<>();

        private AppConfig() {
            System.out.println("Loading config (runs once)");
            values.put("payment.timeoutMs", "3000");
            values.put("region", "ap-south-1");
        }

        private static final class Holder {
            private static final AppConfig INSTANCE = new AppConfig();
        }

        static AppConfig getInstance() {
            return Holder.INSTANCE;
        }

        String get(String key) {
            return values.get(key);
        }
    }

    // Option 2: enum singleton. Also safe against reflection and serialization.
    enum IdGenerator {
        INSTANCE;
        private final AtomicLong next = new AtomicLong(1);

        long nextId() {
            return next.getAndIncrement();
        }
    }

    // Option 3 (usually best): no getInstance() inside business code.
    // Create one object at startup and pass it in. Tests can pass a fake.
    static final class PaymentService {
        private final AppConfig config;

        PaymentService(AppConfig config) {
            this.config = config;
        }

        String describe() {
            return "PaymentService timeout=" + config.get("payment.timeoutMs") + "ms";
        }
    }

    public static void main(String[] args) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(8);
        Set<AppConfig> configs = ConcurrentHashMap.newKeySet();
        Set<Long> ids = ConcurrentHashMap.newKeySet();
        List<Future<?>> tasks = new ArrayList<>();
        for (int i = 0; i < 100; i++) {
            tasks.add(pool.submit(() -> {
                configs.add(AppConfig.getInstance());
                for (int j = 0; j < 10; j++) {
                    ids.add(IdGenerator.INSTANCE.nextId());
                }
            }));
        }
        for (Future<?> t : tasks) {
            t.get();
        }
        pool.shutdown();

        System.out.println("Distinct AppConfig objects seen by 100 tasks: " + configs.size());
        System.out.println("Region: " + AppConfig.getInstance().get("region"));
        System.out.println(ids.size() + " unique IDs from 1000 calls");

        AppConfig config = AppConfig.getInstance(); // fetched once, in main
        PaymentService payments = new PaymentService(config); // injected
        System.out.println(payments.describe());
    }
}
`,
      python: String.raw`import threading
from concurrent.futures import ThreadPoolExecutor


class AppConfig:
    def __init__(self):
        print("Loading config (runs once)")
        self._values = {"payment.timeout_ms": "3000", "region": "ap-south-1"}

    def get(self, key):
        return self._values.get(key)


# Idiomatic Python singleton: a module-level instance. In config.py write
#     config = AppConfig()
# Python runs a module's top-level code once (on first import, under the
# import lock), so every "from config import config" gets the same object.
#
# Below is the lazy version, for when creation is expensive and may not be needed.
_config = None
_config_lock = threading.Lock()


def get_config():
    global _config
    if _config is None:  # fast path: no lock once created
        with _config_lock:
            if _config is None:  # re-check: another thread may have won
                _config = AppConfig()
    return _config


class _IdGenerator:
    def __init__(self):
        self._next = 1
        self._lock = threading.Lock()

    def next_id(self):
        with self._lock:
            value = self._next
            self._next += 1
            return value


id_generator = _IdGenerator()  # module-level singleton


class PaymentService:
    """Preferred style: receive the config instead of reaching for a global."""

    def __init__(self, config):
        self._config = config

    def describe(self):
        return "PaymentService timeout=" + self._config.get("payment.timeout_ms") + "ms"


def task(_):
    cfg = get_config()
    ids = [id_generator.next_id() for _ in range(10)]
    return id(cfg), ids


if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(task, range(100)))

    configs = {cfg_id for cfg_id, _ in results}
    all_ids = {i for _, ids in results for i in ids}
    print(f"Distinct AppConfig objects seen by 100 tasks: {len(configs)}")
    print(f"Region: {get_config().get('region')}")
    print(f"{len(all_ids)} unique IDs from 1000 calls")

    payments = PaymentService(get_config())  # injected
    print(payments.describe())
`,
      cpp: String.raw`#include <atomic>
#include <iostream>
#include <map>
#include <memory>
#include <mutex>
#include <set>
#include <string>
#include <thread>
#include <vector>

// Meyers singleton: a function-local static. Since C++11 the compiler
// guarantees it is initialised exactly once, even if many threads call
// instance() at the same moment.
class AppConfig {
public:
    static AppConfig& instance() {
        static AppConfig config;
        return config;
    }
    AppConfig(const AppConfig&) = delete;
    AppConfig& operator=(const AppConfig&) = delete;

    std::string get(const std::string& key) const {
        auto it = values_.find(key);
        return it == values_.end() ? "" : it->second;
    }

private:
    AppConfig() {
        std::cout << "Loading config (runs once)\n";
        values_["payment.timeoutMs"] = "3000";
        values_["region"] = "ap-south-1";
    }
    std::map<std::string, std::string> values_;
};

class IdGenerator {
public:
    static IdGenerator& instance() {
        static IdGenerator gen;
        return gen;
    }
    IdGenerator(const IdGenerator&) = delete;
    IdGenerator& operator=(const IdGenerator&) = delete;
    long nextId() { return next_.fetch_add(1); }

private:
    IdGenerator() = default;
    std::atomic<long> next_{1};
};

// Preferred: depend on a reference you are given, not on AppConfig::instance().
class PaymentService {
public:
    explicit PaymentService(const AppConfig& config) : config_(config) {}
    std::string describe() const {
        return "PaymentService timeout=" + config_.get("payment.timeoutMs") + "ms";
    }

private:
    const AppConfig& config_;
};

int main() {
    std::mutex mu;
    std::set<const AppConfig*> configs;
    std::set<long> ids;
    std::vector<std::thread> threads;

    for (int t = 0; t < 100; t++) {
        threads.emplace_back([&] {
            const AppConfig* cfg = &AppConfig::instance();
            std::vector<long> local;
            for (int j = 0; j < 10; j++) local.push_back(IdGenerator::instance().nextId());
            std::lock_guard<std::mutex> lock(mu);
            configs.insert(cfg);
            ids.insert(local.begin(), local.end());
        });
    }
    for (auto& th : threads) th.join();

    std::cout << "Distinct AppConfig objects seen by 100 tasks: " << configs.size() << "\n";
    std::cout << "Region: " << AppConfig::instance().get("region") << "\n";
    std::cout << ids.size() << " unique IDs from 1000 calls\n";

    auto payments = std::make_unique<PaymentService>(AppConfig::instance()); // injected
    std::cout << payments->describe() << "\n";
    return 0;
}
`,
      javascript: String.raw`// Idiomatic JS singleton: a module. In config.js write
//     module.exports = new AppConfig();   (or: export default new AppConfig())
// Node caches every module after the first require/import, so all importers
// share one object. JS runs your code on one thread, so there is no creation race.

class AppConfig {
  static #instance = null;
  #values;

  constructor() {
    if (AppConfig.#instance) throw new Error("Use AppConfig.getInstance()");
    console.log("Loading config (runs once)");
    this.#values = new Map([
      ["payment.timeoutMs", "3000"],
      ["region", "ap-south-1"],
    ]);
  }

  static getInstance() {
    if (!AppConfig.#instance) AppConfig.#instance = new AppConfig();
    return AppConfig.#instance;
  }

  get(key) {
    return this.#values.get(key);
  }
}

// A closure-based singleton: the counter is private to the IIFE.
const idGenerator = (() => {
  let next = 1;
  return Object.freeze({ nextId: () => next++ });
})();

// Preferred style: receive the config instead of reaching for a global.
class PaymentService {
  constructor(config) {
    this.config = config;
  }
  describe() {
    return "PaymentService timeout=" + this.config.get("payment.timeoutMs") + "ms";
  }
}

async function task() {
  await Promise.resolve(); // interleave tasks like concurrent requests
  const cfg = AppConfig.getInstance();
  const ids = [];
  for (let j = 0; j < 10; j++) ids.push(idGenerator.nextId());
  return { cfg, ids };
}

async function main() {
  const results = await Promise.all(Array.from({ length: 100 }, () => task()));
  const configs = new Set(results.map((r) => r.cfg));
  const ids = new Set(results.flatMap((r) => r.ids));
  console.log("Distinct AppConfig objects seen by 100 tasks: " + configs.size);
  console.log("Region: " + AppConfig.getInstance().get("region"));
  console.log(ids.size + " unique IDs from 1000 calls");

  const payments = new PaymentService(AppConfig.getInstance()); // injected
  console.log(payments.describe());
}

main();
`,
      go: String.raw`package main

import (
	"fmt"
	"sync"
	"sync/atomic"
)

type AppConfig struct {
	values map[string]string
}

func (c *AppConfig) Get(key string) string { return c.values[key] }

var (
	configOnce sync.Once
	config     *AppConfig
)

// GetConfig creates the config on first use. sync.Once runs the function
// exactly once; other callers block until it has finished.
// (Go 1.21+: var GetConfig = sync.OnceValue(loadConfig) does the same.)
func GetConfig() *AppConfig {
	configOnce.Do(func() {
		fmt.Println("Loading config (runs once)")
		config = &AppConfig{values: map[string]string{
			"payment.timeoutMs": "3000",
			"region":            "ap-south-1",
		}}
	})
	return config
}

// A package-level variable is also a singleton: package init is single-threaded.
var lastID atomic.Int64

func NextID() int64 { return lastID.Add(1) }

// Preferred style: receive the config instead of calling GetConfig() inside.
type PaymentService struct{ cfg *AppConfig }

func NewPaymentService(cfg *AppConfig) *PaymentService { return &PaymentService{cfg: cfg} }

func (p *PaymentService) Describe() string {
	return "PaymentService timeout=" + p.cfg.Get("payment.timeoutMs") + "ms"
}

func main() {
	var wg sync.WaitGroup
	var mu sync.Mutex
	configs := map[*AppConfig]bool{}
	ids := map[int64]bool{}

	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			cfg := GetConfig()
			local := make([]int64, 0, 10)
			for j := 0; j < 10; j++ {
				local = append(local, NextID())
			}
			mu.Lock()
			defer mu.Unlock()
			configs[cfg] = true
			for _, id := range local {
				ids[id] = true
			}
		}()
	}
	wg.Wait()

	fmt.Println("Distinct AppConfig objects seen by 100 tasks:", len(configs))
	fmt.Println("Region:", GetConfig().Get("region"))
	fmt.Println(len(ids), "unique IDs from 1000 calls")

	payments := NewPaymentService(GetConfig()) // injected
	fmt.Println(payments.Describe())
}
`,
    },
    factory: {
      title: "Simple factory with a registry, plus Factory Method",
      java: String.raw`import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.function.Supplier;

public class Main {

    interface NotificationSender {
        void send(String to, String message);
    }

    static final class SmsSender implements NotificationSender {
        public void send(String to, String message) {
            System.out.println("  [SMS to " + to + "] " + message);
        }
    }

    static final class EmailSender implements NotificationSender {
        public void send(String to, String message) {
            System.out.println("  [Email to " + to + "] " + message);
        }
    }

    static final class PushSender implements NotificationSender {
        public void send(String to, String message) {
            System.out.println("  [Push to " + to + "] " + message);
        }
    }

    static final class WhatsAppSender implements NotificationSender {
        public void send(String to, String message) {
            System.out.println("  [WhatsApp to " + to + "] " + message);
        }
    }

    // Simple factory: the only place that maps a channel name to a class.
    // Adding a channel = one new class + one register() call. No if-chains.
    static final class NotificationFactory {
        private final Map<String, Supplier<NotificationSender>> registry = new LinkedHashMap<>();

        void register(String channel, Supplier<NotificationSender> creator) {
            registry.put(channel.toLowerCase(Locale.ROOT), creator);
        }

        NotificationSender create(String channel) {
            Supplier<NotificationSender> creator = registry.get(channel.toLowerCase(Locale.ROOT));
            if (creator == null) {
                throw new IllegalArgumentException("Unknown channel: " + channel);
            }
            return creator.get();
        }
    }

    // Factory Method (GoF): the base class owns the workflow and leaves
    // one step, createSender(), for subclasses to decide.
    abstract static class OrderNotifier {
        protected abstract NotificationSender createSender();

        final void orderPlaced(String to, String orderId) {
            NotificationSender sender = createSender();
            sender.send(to, "Order " + orderId + " confirmed. Track it in the app.");
        }
    }

    static final class SmsOrderNotifier extends OrderNotifier {
        protected NotificationSender createSender() {
            return new SmsSender();
        }
    }

    static final class WhatsAppOrderNotifier extends OrderNotifier {
        protected NotificationSender createSender() {
            return new WhatsAppSender();
        }
    }

    public static void main(String[] args) {
        NotificationFactory factory = new NotificationFactory();
        factory.register("sms", SmsSender::new);
        factory.register("email", EmailSender::new);
        factory.register("push", PushSender::new);
        factory.register("whatsapp", WhatsAppSender::new);

        // The channel comes from user preferences, not from code.
        String[][] prefs = {
            {"SMS", "+91-98450-11111"},
            {"email", "asha@example.com"},
            {"push", "device-7f3a"},
        };
        System.out.println("Simple factory:");
        for (String[] p : prefs) {
            factory.create(p[0]).send(p[1], "Your OTP is 482913");
        }
        try {
            factory.create("pigeon");
        } catch (IllegalArgumentException e) {
            System.out.println("  Error: " + e.getMessage());
        }

        System.out.println("Factory method:");
        OrderNotifier[] notifiers = {new SmsOrderNotifier(), new WhatsAppOrderNotifier()};
        for (OrderNotifier n : notifiers) {
            n.orderPlaced("+91-98450-22222", "SW-1042");
        }
    }
}
`,
      python: String.raw`from abc import ABC, abstractmethod


class NotificationSender(ABC):
    @abstractmethod
    def send(self, to: str, message: str) -> None: ...


# Simple factory with a registry. A class decorator registers each sender,
# so adding a channel means writing one new class and nothing else.
_registry: dict[str, type[NotificationSender]] = {}


def channel(name):
    def wrap(cls):
        _registry[name] = cls
        return cls
    return wrap


def create_sender(name: str) -> NotificationSender:
    cls = _registry.get(name.lower())
    if cls is None:
        raise ValueError(f"Unknown channel: {name}")
    return cls()


@channel("sms")
class SmsSender(NotificationSender):
    def send(self, to, message):
        print(f"  [SMS to {to}] {message}")


@channel("email")
class EmailSender(NotificationSender):
    def send(self, to, message):
        print(f"  [Email to {to}] {message}")


@channel("push")
class PushSender(NotificationSender):
    def send(self, to, message):
        print(f"  [Push to {to}] {message}")


@channel("whatsapp")
class WhatsAppSender(NotificationSender):
    def send(self, to, message):
        print(f"  [WhatsApp to {to}] {message}")


# Factory Method (GoF): the base class owns the workflow,
# subclasses decide which sender to create.
class OrderNotifier(ABC):
    @abstractmethod
    def create_sender(self) -> NotificationSender: ...

    def order_placed(self, to, order_id):
        sender = self.create_sender()
        sender.send(to, f"Order {order_id} confirmed. Track it in the app.")


class SmsOrderNotifier(OrderNotifier):
    def create_sender(self):
        return SmsSender()


class WhatsAppOrderNotifier(OrderNotifier):
    def create_sender(self):
        return WhatsAppSender()


if __name__ == "__main__":
    prefs = [("SMS", "+91-98450-11111"), ("email", "asha@example.com"), ("push", "device-7f3a")]
    print("Simple factory:")
    for ch, to in prefs:
        create_sender(ch).send(to, "Your OTP is 482913")
    try:
        create_sender("pigeon")
    except ValueError as e:
        print(f"  Error: {e}")

    print("Factory method:")
    for notifier in (SmsOrderNotifier(), WhatsAppOrderNotifier()):
        notifier.order_placed("+91-98450-22222", "SW-1042")
`,
      cpp: String.raw`#include <algorithm>
#include <cctype>
#include <functional>
#include <iostream>
#include <map>
#include <memory>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

class NotificationSender {
public:
    virtual ~NotificationSender() = default;
    virtual void send(const std::string& to, const std::string& message) = 0;
};

class SmsSender : public NotificationSender {
public:
    void send(const std::string& to, const std::string& message) override {
        std::cout << "  [SMS to " << to << "] " << message << "\n";
    }
};
class EmailSender : public NotificationSender {
public:
    void send(const std::string& to, const std::string& message) override {
        std::cout << "  [Email to " << to << "] " << message << "\n";
    }
};
class PushSender : public NotificationSender {
public:
    void send(const std::string& to, const std::string& message) override {
        std::cout << "  [Push to " << to << "] " << message << "\n";
    }
};
class WhatsAppSender : public NotificationSender {
public:
    void send(const std::string& to, const std::string& message) override {
        std::cout << "  [WhatsApp to " << to << "] " << message << "\n";
    }
};

// Simple factory: maps a channel name to a creator function.
// Callers get a unique_ptr and own the sender.
class NotificationFactory {
public:
    using Creator = std::function<std::unique_ptr<NotificationSender>()>;

    void registerChannel(const std::string& channel, Creator creator) {
        registry_[lower(channel)] = std::move(creator);
    }

    std::unique_ptr<NotificationSender> create(const std::string& channel) const {
        auto it = registry_.find(lower(channel));
        if (it == registry_.end()) throw std::invalid_argument("Unknown channel: " + channel);
        return it->second();
    }

private:
    static std::string lower(std::string s) {
        std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) { return std::tolower(c); });
        return s;
    }
    std::map<std::string, Creator> registry_;
};

// Factory Method (GoF): base class owns the workflow, subclasses pick the product.
class OrderNotifier {
public:
    virtual ~OrderNotifier() = default;
    void orderPlaced(const std::string& to, const std::string& orderId) {
        auto sender = createSender();
        sender->send(to, "Order " + orderId + " confirmed. Track it in the app.");
    }

protected:
    virtual std::unique_ptr<NotificationSender> createSender() = 0;
};

class SmsOrderNotifier : public OrderNotifier {
protected:
    std::unique_ptr<NotificationSender> createSender() override { return std::make_unique<SmsSender>(); }
};
class WhatsAppOrderNotifier : public OrderNotifier {
protected:
    std::unique_ptr<NotificationSender> createSender() override { return std::make_unique<WhatsAppSender>(); }
};

int main() {
    NotificationFactory factory;
    factory.registerChannel("sms", [] { return std::make_unique<SmsSender>(); });
    factory.registerChannel("email", [] { return std::make_unique<EmailSender>(); });
    factory.registerChannel("push", [] { return std::make_unique<PushSender>(); });
    factory.registerChannel("whatsapp", [] { return std::make_unique<WhatsAppSender>(); });

    std::vector<std::pair<std::string, std::string>> prefs = {
        {"SMS", "+91-98450-11111"}, {"email", "asha@example.com"}, {"push", "device-7f3a"}};
    std::cout << "Simple factory:\n";
    for (const auto& [ch, to] : prefs) factory.create(ch)->send(to, "Your OTP is 482913");
    try {
        factory.create("pigeon");
    } catch (const std::invalid_argument& e) {
        std::cout << "  Error: " << e.what() << "\n";
    }

    std::cout << "Factory method:\n";
    std::vector<std::unique_ptr<OrderNotifier>> notifiers;
    notifiers.push_back(std::make_unique<SmsOrderNotifier>());
    notifiers.push_back(std::make_unique<WhatsAppOrderNotifier>());
    for (auto& n : notifiers) n->orderPlaced("+91-98450-22222", "SW-1042");
    return 0;
}
`,
      javascript: String.raw`class NotificationSender {
  send(to, message) {
    throw new Error("not implemented");
  }
}

class SmsSender extends NotificationSender {
  send(to, message) { console.log("  [SMS to " + to + "] " + message); }
}
class EmailSender extends NotificationSender {
  send(to, message) { console.log("  [Email to " + to + "] " + message); }
}
class PushSender extends NotificationSender {
  send(to, message) { console.log("  [Push to " + to + "] " + message); }
}
class WhatsAppSender extends NotificationSender {
  send(to, message) { console.log("  [WhatsApp to " + to + "] " + message); }
}

// Simple factory: a registry from channel name to a creator function.
class NotificationFactory {
  #registry = new Map();

  register(channel, creator) {
    this.#registry.set(channel.toLowerCase(), creator);
  }

  create(channel) {
    const creator = this.#registry.get(channel.toLowerCase());
    if (!creator) throw new Error("Unknown channel: " + channel);
    return creator();
  }
}

// Factory Method (GoF): base class owns the workflow, subclasses pick the product.
class OrderNotifier {
  createSender() {
    throw new Error("subclass must implement createSender()");
  }
  orderPlaced(to, orderId) {
    const sender = this.createSender();
    sender.send(to, "Order " + orderId + " confirmed. Track it in the app.");
  }
}
class SmsOrderNotifier extends OrderNotifier {
  createSender() { return new SmsSender(); }
}
class WhatsAppOrderNotifier extends OrderNotifier {
  createSender() { return new WhatsAppSender(); }
}

const factory = new NotificationFactory();
factory.register("sms", () => new SmsSender());
factory.register("email", () => new EmailSender());
factory.register("push", () => new PushSender());
factory.register("whatsapp", () => new WhatsAppSender());

const prefs = [["SMS", "+91-98450-11111"], ["email", "asha@example.com"], ["push", "device-7f3a"]];
console.log("Simple factory:");
for (const [ch, to] of prefs) factory.create(ch).send(to, "Your OTP is 482913");
try {
  factory.create("pigeon");
} catch (e) {
  console.log("  Error: " + e.message);
}

console.log("Factory method:");
for (const n of [new SmsOrderNotifier(), new WhatsAppOrderNotifier()]) {
  n.orderPlaced("+91-98450-22222", "SW-1042");
}
`,
      go: String.raw`package main

import (
	"fmt"
	"strings"
)

type NotificationSender interface {
	Send(to, message string)
}

type SmsSender struct{}
type EmailSender struct{}
type PushSender struct{}
type WhatsAppSender struct{}

func (SmsSender) Send(to, msg string)      { fmt.Printf("  [SMS to %s] %s\n", to, msg) }
func (EmailSender) Send(to, msg string)    { fmt.Printf("  [Email to %s] %s\n", to, msg) }
func (PushSender) Send(to, msg string)     { fmt.Printf("  [Push to %s] %s\n", to, msg) }
func (WhatsAppSender) Send(to, msg string) { fmt.Printf("  [WhatsApp to %s] %s\n", to, msg) }

// Simple factory: a registry of constructor functions. In Go the factory is
// just a function that returns an interface (plus an error, not an exception).
var registry = map[string]func() NotificationSender{
	"sms":      func() NotificationSender { return SmsSender{} },
	"email":    func() NotificationSender { return EmailSender{} },
	"push":     func() NotificationSender { return PushSender{} },
	"whatsapp": func() NotificationSender { return WhatsAppSender{} },
}

func NewSender(channel string) (NotificationSender, error) {
	create, ok := registry[strings.ToLower(channel)]
	if !ok {
		return nil, fmt.Errorf("unknown channel: %s", channel)
	}
	return create(), nil
}

// Factory Method, Go style: no inheritance, so the "overridable" creation
// step is a function field supplied when the notifier is built.
type OrderNotifier struct {
	createSender func() NotificationSender
}

func (n OrderNotifier) OrderPlaced(to, orderID string) {
	sender := n.createSender()
	sender.Send(to, "Order "+orderID+" confirmed. Track it in the app.")
}

func main() {
	prefs := [][2]string{
		{"SMS", "+91-98450-11111"},
		{"email", "asha@example.com"},
		{"push", "device-7f3a"},
	}
	fmt.Println("Simple factory:")
	for _, p := range prefs {
		s, err := NewSender(p[0])
		if err != nil {
			fmt.Println("  Error:", err)
			continue
		}
		s.Send(p[1], "Your OTP is 482913")
	}
	if _, err := NewSender("pigeon"); err != nil {
		fmt.Println("  Error:", err)
	}

	fmt.Println("Factory method:")
	notifiers := []OrderNotifier{
		{createSender: func() NotificationSender { return SmsSender{} }},
		{createSender: func() NotificationSender { return WhatsAppSender{} }},
	}
	for _, n := range notifiers {
		n.OrderPlaced("+91-98450-22222", "SW-1042")
	}
}
`,
    },
    abstractFactory: {
      title: "Abstract Factory: payment provider families",
      java: String.raw`public class Main {

    // Products
    interface PaymentGateway {
        String charge(String orderId, long amountMinor);
    }

    interface RefundService {
        void refund(String paymentId, long amountMinor);
    }

    // Abstract factory: one method per product in the family.
    interface PaymentProviderFactory {
        String name();
        PaymentGateway createGateway();
        RefundService createRefundService();
    }

    // Family 1: Razorpay (India, amounts in paise)
    static final class RazorpayGateway implements PaymentGateway {
        public String charge(String orderId, long paise) {
            System.out.println("  Razorpay: charged Rs." + paise / 100 + " for " + orderId + " (UPI/cards)");
            return "pay_rzp_" + orderId;
        }
    }

    static final class RazorpayRefunds implements RefundService {
        public void refund(String paymentId, long paise) {
            if (!paymentId.startsWith("pay_rzp_")) throw new IllegalArgumentException("not a Razorpay payment");
            System.out.println("  Razorpay: refunded Rs." + paise / 100 + " on " + paymentId);
        }
    }

    static final class RazorpayFactory implements PaymentProviderFactory {
        public String name() { return "Razorpay"; }
        public PaymentGateway createGateway() { return new RazorpayGateway(); }
        public RefundService createRefundService() { return new RazorpayRefunds(); }
    }

    // Family 2: Stripe (international, amounts in cents)
    static final class StripeGateway implements PaymentGateway {
        public String charge(String orderId, long cents) {
            System.out.println("  Stripe: charged USD " + cents / 100 + " for " + orderId + " (cards)");
            return "pi_stripe_" + orderId;
        }
    }

    static final class StripeRefunds implements RefundService {
        public void refund(String paymentId, long cents) {
            if (!paymentId.startsWith("pi_stripe_")) throw new IllegalArgumentException("not a Stripe payment");
            System.out.println("  Stripe: refunded USD " + cents / 100 + " on " + paymentId);
        }
    }

    static final class StripeFactory implements PaymentProviderFactory {
        public String name() { return "Stripe"; }
        public PaymentGateway createGateway() { return new StripeGateway(); }
        public RefundService createRefundService() { return new StripeRefunds(); }
    }

    // Client: knows only the abstract factory and product interfaces,
    // so it can never mix a Razorpay charge with a Stripe refund.
    static final class CheckoutService {
        private final PaymentGateway gateway;
        private final RefundService refunds;

        CheckoutService(PaymentProviderFactory factory) {
            this.gateway = factory.createGateway();
            this.refunds = factory.createRefundService();
        }

        void payThenCancel(String orderId, long amountMinor) {
            String paymentId = gateway.charge(orderId, amountMinor);
            refunds.refund(paymentId, amountMinor);
        }
    }

    static PaymentProviderFactory factoryFor(String country) {
        return "IN".equals(country) ? new RazorpayFactory() : new StripeFactory();
    }

    public static void main(String[] args) {
        String[] countries = {"IN", "US"};
        long[] amounts = {49900, 1200};
        for (int i = 0; i < countries.length; i++) {
            PaymentProviderFactory factory = factoryFor(countries[i]);
            System.out.println("Country " + countries[i] + " -> " + factory.name() + " family");
            new CheckoutService(factory).payThenCancel("ORD-" + (101 + i), amounts[i]);
        }
    }
}
`,
      python: String.raw`from abc import ABC, abstractmethod


# Products
class PaymentGateway(ABC):
    @abstractmethod
    def charge(self, order_id: str, amount_minor: int) -> str: ...


class RefundService(ABC):
    @abstractmethod
    def refund(self, payment_id: str, amount_minor: int) -> None: ...


# Abstract factory: one method per product in the family.
class PaymentProviderFactory(ABC):
    name = "?"

    @abstractmethod
    def create_gateway(self) -> PaymentGateway: ...

    @abstractmethod
    def create_refund_service(self) -> RefundService: ...


# Family 1: Razorpay (India, amounts in paise)
class RazorpayGateway(PaymentGateway):
    def charge(self, order_id, paise):
        print(f"  Razorpay: charged Rs.{paise // 100} for {order_id} (UPI/cards)")
        return "pay_rzp_" + order_id


class RazorpayRefunds(RefundService):
    def refund(self, payment_id, paise):
        if not payment_id.startswith("pay_rzp_"):
            raise ValueError("not a Razorpay payment")
        print(f"  Razorpay: refunded Rs.{paise // 100} on {payment_id}")


class RazorpayFactory(PaymentProviderFactory):
    name = "Razorpay"

    def create_gateway(self):
        return RazorpayGateway()

    def create_refund_service(self):
        return RazorpayRefunds()


# Family 2: Stripe (international, amounts in cents)
class StripeGateway(PaymentGateway):
    def charge(self, order_id, cents):
        print(f"  Stripe: charged USD {cents // 100} for {order_id} (cards)")
        return "pi_stripe_" + order_id


class StripeRefunds(RefundService):
    def refund(self, payment_id, cents):
        if not payment_id.startswith("pi_stripe_"):
            raise ValueError("not a Stripe payment")
        print(f"  Stripe: refunded USD {cents // 100} on {payment_id}")


class StripeFactory(PaymentProviderFactory):
    name = "Stripe"

    def create_gateway(self):
        return StripeGateway()

    def create_refund_service(self):
        return StripeRefunds()


# Client: depends only on the abstract types.
class CheckoutService:
    def __init__(self, factory: PaymentProviderFactory):
        self._gateway = factory.create_gateway()
        self._refunds = factory.create_refund_service()

    def pay_then_cancel(self, order_id, amount_minor):
        payment_id = self._gateway.charge(order_id, amount_minor)
        self._refunds.refund(payment_id, amount_minor)


def factory_for(country: str) -> PaymentProviderFactory:
    return RazorpayFactory() if country == "IN" else StripeFactory()


if __name__ == "__main__":
    for i, (country, amount) in enumerate([("IN", 49900), ("US", 1200)]):
        factory = factory_for(country)
        print(f"Country {country} -> {factory.name} family")
        CheckoutService(factory).pay_then_cancel(f"ORD-{101 + i}", amount)
`,
      cpp: String.raw`#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

// Products
class PaymentGateway {
public:
    virtual ~PaymentGateway() = default;
    virtual std::string charge(const std::string& orderId, long amountMinor) = 0;
};

class RefundService {
public:
    virtual ~RefundService() = default;
    virtual void refund(const std::string& paymentId, long amountMinor) = 0;
};

// Abstract factory: one method per product in the family.
class PaymentProviderFactory {
public:
    virtual ~PaymentProviderFactory() = default;
    virtual std::string name() const = 0;
    virtual std::unique_ptr<PaymentGateway> createGateway() const = 0;
    virtual std::unique_ptr<RefundService> createRefundService() const = 0;
};

static bool startsWith(const std::string& s, const std::string& p) { return s.rfind(p, 0) == 0; }

// Family 1: Razorpay (India, amounts in paise)
class RazorpayGateway : public PaymentGateway {
public:
    std::string charge(const std::string& orderId, long paise) override {
        std::cout << "  Razorpay: charged Rs." << paise / 100 << " for " << orderId << " (UPI/cards)\n";
        return "pay_rzp_" + orderId;
    }
};
class RazorpayRefunds : public RefundService {
public:
    void refund(const std::string& paymentId, long paise) override {
        if (!startsWith(paymentId, "pay_rzp_")) throw std::invalid_argument("not a Razorpay payment");
        std::cout << "  Razorpay: refunded Rs." << paise / 100 << " on " << paymentId << "\n";
    }
};
class RazorpayFactory : public PaymentProviderFactory {
public:
    std::string name() const override { return "Razorpay"; }
    std::unique_ptr<PaymentGateway> createGateway() const override { return std::make_unique<RazorpayGateway>(); }
    std::unique_ptr<RefundService> createRefundService() const override { return std::make_unique<RazorpayRefunds>(); }
};

// Family 2: Stripe (international, amounts in cents)
class StripeGateway : public PaymentGateway {
public:
    std::string charge(const std::string& orderId, long cents) override {
        std::cout << "  Stripe: charged USD " << cents / 100 << " for " << orderId << " (cards)\n";
        return "pi_stripe_" + orderId;
    }
};
class StripeRefunds : public RefundService {
public:
    void refund(const std::string& paymentId, long cents) override {
        if (!startsWith(paymentId, "pi_stripe_")) throw std::invalid_argument("not a Stripe payment");
        std::cout << "  Stripe: refunded USD " << cents / 100 << " on " << paymentId << "\n";
    }
};
class StripeFactory : public PaymentProviderFactory {
public:
    std::string name() const override { return "Stripe"; }
    std::unique_ptr<PaymentGateway> createGateway() const override { return std::make_unique<StripeGateway>(); }
    std::unique_ptr<RefundService> createRefundService() const override { return std::make_unique<StripeRefunds>(); }
};

// Client: owns its products, knows only the interfaces.
class CheckoutService {
public:
    explicit CheckoutService(const PaymentProviderFactory& f)
        : gateway_(f.createGateway()), refunds_(f.createRefundService()) {}

    void payThenCancel(const std::string& orderId, long amountMinor) {
        std::string paymentId = gateway_->charge(orderId, amountMinor);
        refunds_->refund(paymentId, amountMinor);
    }

private:
    std::unique_ptr<PaymentGateway> gateway_;
    std::unique_ptr<RefundService> refunds_;
};

std::unique_ptr<PaymentProviderFactory> factoryFor(const std::string& country) {
    if (country == "IN") return std::make_unique<RazorpayFactory>();
    return std::make_unique<StripeFactory>();
}

int main() {
    std::vector<std::pair<std::string, long>> orders = {{"IN", 49900}, {"US", 1200}};
    int n = 101;
    for (const auto& [country, amount] : orders) {
        auto factory = factoryFor(country);
        std::cout << "Country " << country << " -> " << factory->name() << " family\n";
        CheckoutService(*factory).payThenCancel("ORD-" + std::to_string(n++), amount);
    }
    return 0;
}
`,
      javascript: String.raw`// Family 1: Razorpay (India, amounts in paise)
class RazorpayGateway {
  charge(orderId, paise) {
    console.log("  Razorpay: charged Rs." + Math.floor(paise / 100) + " for " + orderId + " (UPI/cards)");
    return "pay_rzp_" + orderId;
  }
}
class RazorpayRefunds {
  refund(paymentId, paise) {
    if (!paymentId.startsWith("pay_rzp_")) throw new Error("not a Razorpay payment");
    console.log("  Razorpay: refunded Rs." + Math.floor(paise / 100) + " on " + paymentId);
  }
}
class RazorpayFactory {
  get name() { return "Razorpay"; }
  createGateway() { return new RazorpayGateway(); }
  createRefundService() { return new RazorpayRefunds(); }
}

// Family 2: Stripe (international, amounts in cents)
class StripeGateway {
  charge(orderId, cents) {
    console.log("  Stripe: charged USD " + Math.floor(cents / 100) + " for " + orderId + " (cards)");
    return "pi_stripe_" + orderId;
  }
}
class StripeRefunds {
  refund(paymentId, cents) {
    if (!paymentId.startsWith("pi_stripe_")) throw new Error("not a Stripe payment");
    console.log("  Stripe: refunded USD " + Math.floor(cents / 100) + " on " + paymentId);
  }
}
class StripeFactory {
  get name() { return "Stripe"; }
  createGateway() { return new StripeGateway(); }
  createRefundService() { return new StripeRefunds(); }
}

// Client: relies only on the shape { createGateway(), createRefundService() }.
// JS has no interfaces, so the "abstract factory" is a duck-typed contract.
class CheckoutService {
  constructor(factory) {
    this.gateway = factory.createGateway();
    this.refunds = factory.createRefundService();
  }
  payThenCancel(orderId, amountMinor) {
    const paymentId = this.gateway.charge(orderId, amountMinor);
    this.refunds.refund(paymentId, amountMinor);
  }
}

const factoryFor = (country) => (country === "IN" ? new RazorpayFactory() : new StripeFactory());

[["IN", 49900], ["US", 1200]].forEach(([country, amount], i) => {
  const factory = factoryFor(country);
  console.log("Country " + country + " -> " + factory.name + " family");
  new CheckoutService(factory).payThenCancel("ORD-" + (101 + i), amount);
});
`,
      go: String.raw`package main

import (
	"errors"
	"fmt"
	"strings"
)

// Products
type PaymentGateway interface {
	Charge(orderID string, amountMinor int64) string
}

type RefundService interface {
	Refund(paymentID string, amountMinor int64) error
}

// Abstract factory: one method per product in the family.
type PaymentProviderFactory interface {
	Name() string
	NewGateway() PaymentGateway
	NewRefundService() RefundService
}

// Family 1: Razorpay (India, amounts in paise)
type razorpayGateway struct{}
type razorpayRefunds struct{}
type RazorpayFactory struct{}

func (razorpayGateway) Charge(orderID string, paise int64) string {
	fmt.Printf("  Razorpay: charged Rs.%d for %s (UPI/cards)\n", paise/100, orderID)
	return "pay_rzp_" + orderID
}

func (razorpayRefunds) Refund(paymentID string, paise int64) error {
	if !strings.HasPrefix(paymentID, "pay_rzp_") {
		return errors.New("not a Razorpay payment")
	}
	fmt.Printf("  Razorpay: refunded Rs.%d on %s\n", paise/100, paymentID)
	return nil
}

func (RazorpayFactory) Name() string                   { return "Razorpay" }
func (RazorpayFactory) NewGateway() PaymentGateway      { return razorpayGateway{} }
func (RazorpayFactory) NewRefundService() RefundService { return razorpayRefunds{} }

// Family 2: Stripe (international, amounts in cents)
type stripeGateway struct{}
type stripeRefunds struct{}
type StripeFactory struct{}

func (stripeGateway) Charge(orderID string, cents int64) string {
	fmt.Printf("  Stripe: charged USD %d for %s (cards)\n", cents/100, orderID)
	return "pi_stripe_" + orderID
}

func (stripeRefunds) Refund(paymentID string, cents int64) error {
	if !strings.HasPrefix(paymentID, "pi_stripe_") {
		return errors.New("not a Stripe payment")
	}
	fmt.Printf("  Stripe: refunded USD %d on %s\n", cents/100, paymentID)
	return nil
}

func (StripeFactory) Name() string                   { return "Stripe" }
func (StripeFactory) NewGateway() PaymentGateway      { return stripeGateway{} }
func (StripeFactory) NewRefundService() RefundService { return stripeRefunds{} }

// Client: depends only on the interfaces.
type CheckoutService struct {
	gateway PaymentGateway
	refunds RefundService
}

func NewCheckoutService(f PaymentProviderFactory) *CheckoutService {
	return &CheckoutService{gateway: f.NewGateway(), refunds: f.NewRefundService()}
}

func (c *CheckoutService) PayThenCancel(orderID string, amountMinor int64) error {
	paymentID := c.gateway.Charge(orderID, amountMinor)
	return c.refunds.Refund(paymentID, amountMinor)
}

func factoryFor(country string) PaymentProviderFactory {
	if country == "IN" {
		return RazorpayFactory{}
	}
	return StripeFactory{}
}

func main() {
	orders := []struct {
		country string
		amount  int64
	}{{"IN", 49900}, {"US", 1200}}

	for i, o := range orders {
		f := factoryFor(o.country)
		fmt.Printf("Country %s -> %s family\n", o.country, f.Name())
		if err := NewCheckoutService(f).PayThenCancel(fmt.Sprintf("ORD-%d", 101+i), o.amount); err != nil {
			fmt.Println("  error:", err)
		}
	}
}
`,
    },
    builder: {
      title: "Builder for an HTTP request (Go: functional options)",
      java: String.raw`import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

public class Main {

    static final class HttpRequest {
        private final String method;
        private final String url;
        private final Map<String, String> headers;
        private final String body; // may be null
        private final int timeoutMs;
        private final int maxRetries;

        // Private: the only way in is through the Builder.
        private HttpRequest(Builder b) {
            this.method = b.method;
            this.url = b.url;
            this.headers = Collections.unmodifiableMap(new LinkedHashMap<>(b.headers));
            this.body = b.body;
            this.timeoutMs = b.timeoutMs;
            this.maxRetries = b.maxRetries;
        }

        static Builder newBuilder(String url) {
            return new Builder(url);
        }

        @Override
        public String toString() {
            StringBuilder sb = new StringBuilder();
            sb.append(method).append(' ').append(url)
              .append("\n  timeout=").append(timeoutMs).append("ms retries=").append(maxRetries);
            headers.forEach((k, v) -> sb.append("\n  ").append(k).append(": ").append(v));
            if (body != null) sb.append("\n  body: ").append(body);
            return sb.toString();
        }

        static final class Builder {
            private final String url;                 // required: in the constructor
            private String method = "GET";            // optional: sensible defaults
            private final Map<String, String> headers = new LinkedHashMap<>();
            private String body;
            private int timeoutMs = 5000;
            private int maxRetries = 0;

            private Builder(String url) {
                this.url = Objects.requireNonNull(url, "url");
            }

            Builder method(String method) { this.method = method; return this; }
            Builder header(String name, String value) { headers.put(name, value); return this; }
            Builder body(String body) { this.body = body; return this; }
            Builder timeoutMs(int timeoutMs) { this.timeoutMs = timeoutMs; return this; }
            Builder retries(int maxRetries) { this.maxRetries = maxRetries; return this; }

            // One place for cross-field validation.
            HttpRequest build() {
                if (!url.startsWith("https://")) throw new IllegalStateException("url must use https");
                if (body != null && method.equals("GET")) throw new IllegalStateException("GET request cannot have a body");
                if (timeoutMs <= 0) throw new IllegalStateException("timeout must be positive");
                if (maxRetries < 0 || maxRetries > 5) throw new IllegalStateException("retries must be 0..5");
                return new HttpRequest(this);
            }
        }
    }

    public static void main(String[] args) {
        HttpRequest menu = HttpRequest.newBuilder("https://api.example.in/restaurants/42/menu").build();
        System.out.println(menu);

        HttpRequest order = HttpRequest.newBuilder("https://api.example.in/orders")
            .method("POST")
            .header("Content-Type", "application/json")
            .header("Idempotency-Key", "ord-9f2c")
            .body("{\"item\":\"masala dosa\",\"qty\":2}")
            .timeoutMs(2000)
            .retries(3)
            .build();
        System.out.println(order);

        try {
            HttpRequest.newBuilder("https://api.example.in/orders").body("{}").build();
        } catch (IllegalStateException e) {
            System.out.println("Rejected: " + e.getMessage());
        }
    }
}
`,
      python: String.raw`from dataclasses import dataclass, field


@dataclass(frozen=True)
class HttpRequest:
    url: str
    method: str = "GET"
    headers: dict = field(default_factory=dict)
    body: str | None = None
    timeout_ms: int = 5000
    max_retries: int = 0

    # Validation lives with the object, so both the builder and
    # keyword-argument construction are checked.
    def __post_init__(self):
        if not self.url.startswith("https://"):
            raise ValueError("url must use https")
        if self.body is not None and self.method == "GET":
            raise ValueError("GET request cannot have a body")
        if self.timeout_ms <= 0:
            raise ValueError("timeout must be positive")
        if not 0 <= self.max_retries <= 5:
            raise ValueError("retries must be 0..5")

    def __str__(self):
        lines = [f"{self.method} {self.url}", f"  timeout={self.timeout_ms}ms retries={self.max_retries}"]
        lines += [f"  {k}: {v}" for k, v in self.headers.items()]
        if self.body is not None:
            lines.append(f"  body: {self.body}")
        return "\n".join(lines)

    @staticmethod
    def builder(url):
        return HttpRequestBuilder(url)


class HttpRequestBuilder:
    """Fluent builder: handy when a request is assembled across several steps."""

    def __init__(self, url):
        self._kw = {"url": url, "headers": {}}

    def method(self, m):
        self._kw["method"] = m
        return self

    def header(self, name, value):
        self._kw["headers"][name] = value
        return self

    def body(self, b):
        self._kw["body"] = b
        return self

    def timeout_ms(self, t):
        self._kw["timeout_ms"] = t
        return self

    def retries(self, r):
        self._kw["max_retries"] = r
        return self

    def build(self):
        kw = dict(self._kw, headers=dict(self._kw["headers"]))
        return HttpRequest(**kw)


if __name__ == "__main__":
    # Keyword arguments already avoid telescoping constructors in Python.
    menu = HttpRequest("https://api.example.in/restaurants/42/menu")
    print(menu)

    order = (
        HttpRequest.builder("https://api.example.in/orders")
        .method("POST")
        .header("Content-Type", "application/json")
        .header("Idempotency-Key", "ord-9f2c")
        .body('{"item":"masala dosa","qty":2}')
        .timeout_ms(2000)
        .retries(3)
        .build()
    )
    print(order)

    try:
        HttpRequest.builder("https://api.example.in/orders").body("{}").build()
    except ValueError as e:
        print(f"Rejected: {e}")
`,
      cpp: String.raw`#include <iostream>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

class HttpRequest {
public:
    class Builder;

    std::string toString() const {
        std::ostringstream out;
        out << method_ << ' ' << url_ << "\n  timeout=" << timeoutMs_ << "ms retries=" << maxRetries_;
        for (const auto& [k, v] : headers_) out << "\n  " << k << ": " << v;
        if (body_) out << "\n  body: " << *body_;
        return out.str();
    }

    static Builder newBuilder(std::string url);

private:
    HttpRequest() = default; // only the Builder can create one
    std::string method_, url_;
    std::vector<std::pair<std::string, std::string>> headers_;
    std::optional<std::string> body_;
    int timeoutMs_ = 0, maxRetries_ = 0;
};

class HttpRequest::Builder {
public:
    explicit Builder(std::string url) : url_(std::move(url)) {}

    Builder& method(std::string m) { method_ = std::move(m); return *this; }
    Builder& header(std::string k, std::string v) { headers_.emplace_back(std::move(k), std::move(v)); return *this; }
    Builder& body(std::string b) { body_ = std::move(b); return *this; }
    Builder& timeoutMs(int t) { timeoutMs_ = t; return *this; }
    Builder& retries(int r) { maxRetries_ = r; return *this; }

    HttpRequest build() const {
        if (url_.rfind("https://", 0) != 0) throw std::invalid_argument("url must use https");
        if (body_ && method_ == "GET") throw std::invalid_argument("GET request cannot have a body");
        if (timeoutMs_ <= 0) throw std::invalid_argument("timeout must be positive");
        if (maxRetries_ < 0 || maxRetries_ > 5) throw std::invalid_argument("retries must be 0..5");
        HttpRequest r;
        r.method_ = method_;
        r.url_ = url_;
        r.headers_ = headers_;
        r.body_ = body_;
        r.timeoutMs_ = timeoutMs_;
        r.maxRetries_ = maxRetries_;
        return r;
    }

private:
    std::string url_;                 // required
    std::string method_ = "GET";      // optional, with defaults
    std::vector<std::pair<std::string, std::string>> headers_;
    std::optional<std::string> body_;
    int timeoutMs_ = 5000;
    int maxRetries_ = 0;
};

HttpRequest::Builder HttpRequest::newBuilder(std::string url) { return Builder(std::move(url)); }

int main() {
    HttpRequest menu = HttpRequest::newBuilder("https://api.example.in/restaurants/42/menu").build();
    std::cout << menu.toString() << "\n";

    HttpRequest order = HttpRequest::newBuilder("https://api.example.in/orders")
                            .method("POST")
                            .header("Content-Type", "application/json")
                            .header("Idempotency-Key", "ord-9f2c")
                            .body(R"({"item":"masala dosa","qty":2})")
                            .timeoutMs(2000)
                            .retries(3)
                            .build();
    std::cout << order.toString() << "\n";

    try {
        HttpRequest::newBuilder("https://api.example.in/orders").body("{}").build();
    } catch (const std::invalid_argument& e) {
        std::cout << "Rejected: " << e.what() << "\n";
    }
    return 0;
}
`,
      javascript: String.raw`class HttpRequest {
  constructor(b) {
    // Called only by the builder; the result is frozen (immutable).
    this.method = b.method;
    this.url = b.url;
    this.headers = Object.freeze(new Map(b.headers));
    this.body = b.body;
    this.timeoutMs = b.timeoutMs;
    this.maxRetries = b.maxRetries;
    Object.freeze(this);
  }

  static newBuilder(url) {
    return new HttpRequestBuilder(url);
  }

  toString() {
    const lines = [this.method + " " + this.url, "  timeout=" + this.timeoutMs + "ms retries=" + this.maxRetries];
    for (const [k, v] of this.headers) lines.push("  " + k + ": " + v);
    if (this.body !== undefined) lines.push("  body: " + this.body);
    return lines.join("\n");
  }
}

class HttpRequestBuilder {
  constructor(url) {
    if (!url) throw new Error("url is required");
    this.url = url;
    this.method_ = "GET";
    this.headers = new Map();
    this.body_ = undefined;
    this.timeoutMs_ = 5000;
    this.maxRetries_ = 0;
  }
  method(m) { this.method_ = m; return this; }
  header(k, v) { this.headers.set(k, v); return this; }
  body(b) { this.body_ = b; return this; }
  timeoutMs(t) { this.timeoutMs_ = t; return this; }
  retries(r) { this.maxRetries_ = r; return this; }

  build() {
    if (!this.url.startsWith("https://")) throw new Error("url must use https");
    if (this.body_ !== undefined && this.method_ === "GET") throw new Error("GET request cannot have a body");
    if (this.timeoutMs_ <= 0) throw new Error("timeout must be positive");
    if (this.maxRetries_ < 0 || this.maxRetries_ > 5) throw new Error("retries must be 0..5");
    return new HttpRequest({
      method: this.method_, url: this.url, headers: this.headers,
      body: this.body_, timeoutMs: this.timeoutMs_, maxRetries: this.maxRetries_,
    });
  }
}

const menu = HttpRequest.newBuilder("https://api.example.in/restaurants/42/menu").build();
console.log(menu.toString());

const order = HttpRequest.newBuilder("https://api.example.in/orders")
  .method("POST")
  .header("Content-Type", "application/json")
  .header("Idempotency-Key", "ord-9f2c")
  .body(JSON.stringify({ item: "masala dosa", qty: 2 }))
  .timeoutMs(2000)
  .retries(3)
  .build();
console.log(order.toString());

try {
  HttpRequest.newBuilder("https://api.example.in/orders").body("{}").build();
} catch (e) {
  console.log("Rejected: " + e.message);
}
`,
      go: String.raw`package main

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

type Request struct {
	Method  string
	URL     string
	Headers [][2]string // ordered, unlike a map
	Body    *string     // nil means no body
	Timeout time.Duration
	Retries int
}

// Functional options: each option is a function that tweaks the request.
type Option func(*Request)

func WithMethod(m string) Option          { return func(r *Request) { r.Method = m } }
func WithHeader(k, v string) Option       { return func(r *Request) { r.Headers = append(r.Headers, [2]string{k, v}) } }
func WithBody(b string) Option            { return func(r *Request) { r.Body = &b } }
func WithTimeout(d time.Duration) Option  { return func(r *Request) { r.Timeout = d } }
func WithRetries(n int) Option            { return func(r *Request) { r.Retries = n } }

// NewRequest: required args are normal parameters, optional ones are options.
// Defaults first, then options, then one validation step.
func NewRequest(url string, opts ...Option) (*Request, error) {
	r := &Request{Method: "GET", URL: url, Timeout: 5 * time.Second}
	for _, opt := range opts {
		opt(r)
	}
	switch {
	case !strings.HasPrefix(r.URL, "https://"):
		return nil, errors.New("url must use https")
	case r.Body != nil && r.Method == "GET":
		return nil, errors.New("GET request cannot have a body")
	case r.Timeout <= 0:
		return nil, errors.New("timeout must be positive")
	case r.Retries < 0 || r.Retries > 5:
		return nil, errors.New("retries must be 0..5")
	}
	return r, nil
}

func (r *Request) String() string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "%s %s\n  timeout=%dms retries=%d", r.Method, r.URL, r.Timeout.Milliseconds(), r.Retries)
	for _, h := range r.Headers {
		fmt.Fprintf(&sb, "\n  %s: %s", h[0], h[1])
	}
	if r.Body != nil {
		fmt.Fprintf(&sb, "\n  body: %s", *r.Body)
	}
	return sb.String()
}

func main() {
	menu, _ := NewRequest("https://api.example.in/restaurants/42/menu")
	fmt.Println(menu)

	order, err := NewRequest("https://api.example.in/orders",
		WithMethod("POST"),
		WithHeader("Content-Type", "application/json"),
		WithHeader("Idempotency-Key", "ord-9f2c"),
		WithBody("{\"item\":\"masala dosa\",\"qty\":2}"),
		WithTimeout(2*time.Second),
		WithRetries(3),
	)
	if err != nil {
		fmt.Println("unexpected:", err)
		return
	}
	fmt.Println(order)

	if _, err := NewRequest("https://api.example.in/orders", WithBody("{}")); err != nil {
		fmt.Println("Rejected:", err)
	}
}
`,
    },
    prototype: {
      title: "Prototype: shallow vs deep copy, and a prototype registry",
      java: String.raw`import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Main {

    static class Campaign {
        String name;
        int discountPct;
        List<String> cities;

        Campaign(String name, int discountPct, List<String> cities) {
            this.name = name;
            this.discountPct = discountPct;
            this.cities = cities;
        }

        // Copy constructor = deep copy. New list; the Strings inside are
        // immutable, so sharing them is safe.
        Campaign(Campaign other) {
            this(other.name, other.discountPct, new ArrayList<>(other.cities));
        }

        Campaign copy() {
            return new Campaign(this);
        }

        // The bug to avoid: the copy shares the same list object.
        Campaign shallowCopy() {
            return new Campaign(name, discountPct, cities);
        }

        @Override
        public String toString() {
            return name + " " + discountPct + "% " + cities;
        }
    }

    static final class FlashSale extends Campaign {
        int durationMins;

        FlashSale(String name, int discountPct, List<String> cities, int durationMins) {
            super(name, discountPct, cities);
            this.durationMins = durationMins;
        }

        FlashSale(FlashSale other) {
            super(other);
            this.durationMins = other.durationMins;
        }

        @Override
        FlashSale copy() { // covariant return: copy keeps the real type
            return new FlashSale(this);
        }

        @Override
        public String toString() {
            return super.toString() + " for " + durationMins + " min";
        }
    }

    // Prototype registry: configured templates, handed out as copies.
    static final class CampaignRegistry {
        private final Map<String, Campaign> prototypes = new HashMap<>();

        void register(String key, Campaign prototype) {
            prototypes.put(key, prototype);
        }

        Campaign create(String key) {
            Campaign p = prototypes.get(key);
            if (p == null) throw new IllegalArgumentException("no prototype " + key);
            return p.copy(); // caller does not need to know the concrete class
        }
    }

    static Campaign diwali() {
        return new Campaign("Diwali Dhamaka", 40, new ArrayList<>(List.of("Mumbai", "Delhi")));
    }

    public static void main(String[] args) {
        Campaign original = diwali();
        Campaign shallow = original.shallowCopy();
        shallow.name = "Diwali Pune";
        shallow.cities.set(0, "Pune");
        System.out.println("Shallow copy, then edit the copy:");
        System.out.println("  original: " + original + "   <- changed by accident");

        original = diwali();
        Campaign deep = original.copy();
        deep.name = "Diwali Pune";
        deep.cities.set(0, "Pune");
        System.out.println("Deep copy, then edit the copy:");
        System.out.println("  original: " + original);
        System.out.println("  copy:     " + deep);

        CampaignRegistry registry = new CampaignRegistry();
        registry.register("diwali", diwali());
        registry.register("midnight", new FlashSale("Midnight Biryani", 50, new ArrayList<>(List.of("Hyderabad")), 30));

        Campaign c = registry.create("midnight");
        c.cities.add("Bengaluru");
        System.out.println("From registry:");
        System.out.println("  edited copy: " + c);
        System.out.println("  fresh copy:  " + registry.create("midnight"));
        System.out.println("  type kept:   " + c.getClass().getSimpleName());
    }
}
`,
      python: String.raw`import copy


class Campaign:
    def __init__(self, name, discount_pct, cities):
        self.name = name
        self.discount_pct = discount_pct
        self.cities = cities

    def clone(self):
        # deepcopy copies nested lists/dicts too, and keeps the real class.
        return copy.deepcopy(self)

    def __str__(self):
        return f"{self.name} {self.discount_pct}% [{', '.join(self.cities)}]"


class FlashSale(Campaign):
    def __init__(self, name, discount_pct, cities, duration_mins):
        super().__init__(name, discount_pct, cities)
        self.duration_mins = duration_mins

    def __str__(self):
        return f"{super().__str__()} for {self.duration_mins} min"


class CampaignRegistry:
    def __init__(self):
        self._prototypes = {}

    def register(self, key, prototype):
        self._prototypes[key] = prototype

    def create(self, key):
        if key not in self._prototypes:
            raise KeyError(f"no prototype {key}")
        return self._prototypes[key].clone()


def diwali():
    return Campaign("Diwali Dhamaka", 40, ["Mumbai", "Delhi"])


if __name__ == "__main__":
    original = diwali()
    shallow = copy.copy(original)  # new object, but the SAME list inside
    shallow.name = "Diwali Pune"
    shallow.cities[0] = "Pune"
    print("Shallow copy, then edit the copy:")
    print(f"  original: {original}   <- changed by accident")

    original = diwali()
    deep = original.clone()
    deep.name = "Diwali Pune"
    deep.cities[0] = "Pune"
    print("Deep copy, then edit the copy:")
    print(f"  original: {original}")
    print(f"  copy:     {deep}")

    registry = CampaignRegistry()
    registry.register("diwali", diwali())
    registry.register("midnight", FlashSale("Midnight Biryani", 50, ["Hyderabad"], 30))

    c = registry.create("midnight")
    c.cities.append("Bengaluru")
    print("From registry:")
    print(f"  edited copy: {c}")
    print(f"  fresh copy:  {registry.create('midnight')}")
    print(f"  type kept:   {type(c).__name__}")
`,
      cpp: String.raw`#include <iostream>
#include <map>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>

// Campaign holds its cities through a shared_ptr on purpose, to show the
// shallow-copy trap: the compiler-generated copy shares the pointer.
// (Plain value members like std::vector would be deep-copied automatically.)
class Campaign {
public:
    Campaign(std::string name, int pct, std::vector<std::string> cities)
        : name(std::move(name)), discountPct(pct),
          cities(std::make_shared<std::vector<std::string>>(std::move(cities))) {}
    virtual ~Campaign() = default;

    // Polymorphic deep copy: works even through a Campaign* that is really a FlashSale.
    virtual std::unique_ptr<Campaign> clone() const {
        auto c = std::make_unique<Campaign>(*this);   // copies fields (shares cities)
        c->cities = std::make_shared<std::vector<std::string>>(*cities); // then deep-copy
        return c;
    }

    virtual std::string toString() const {
        std::string s = name + " " + std::to_string(discountPct) + "% [";
        for (size_t i = 0; i < cities->size(); i++) s += (i ? ", " : "") + (*cities)[i];
        return s + "]";
    }
    virtual std::string typeName() const { return "Campaign"; }

    std::string name;
    int discountPct;
    std::shared_ptr<std::vector<std::string>> cities;
};

class FlashSale : public Campaign {
public:
    FlashSale(std::string name, int pct, std::vector<std::string> cities, int mins)
        : Campaign(std::move(name), pct, std::move(cities)), durationMins(mins) {}

    std::unique_ptr<Campaign> clone() const override {
        auto c = std::make_unique<FlashSale>(*this);
        c->cities = std::make_shared<std::vector<std::string>>(*cities);
        return c;
    }
    std::string toString() const override {
        return Campaign::toString() + " for " + std::to_string(durationMins) + " min";
    }
    std::string typeName() const override { return "FlashSale"; }

    int durationMins;
};

class CampaignRegistry {
public:
    void add(const std::string& key, std::unique_ptr<Campaign> prototype) {
        prototypes_[key] = std::move(prototype);
    }
    std::unique_ptr<Campaign> create(const std::string& key) const {
        auto it = prototypes_.find(key);
        if (it == prototypes_.end()) throw std::invalid_argument("no prototype " + key);
        return it->second->clone();
    }

private:
    std::map<std::string, std::unique_ptr<Campaign>> prototypes_;
};

Campaign diwali() { return Campaign("Diwali Dhamaka", 40, {"Mumbai", "Delhi"}); }

int main() {
    Campaign original = diwali();
    Campaign shallow = original; // default copy: shares the cities vector
    shallow.name = "Diwali Pune";
    (*shallow.cities)[0] = "Pune";
    std::cout << "Shallow copy, then edit the copy:\n";
    std::cout << "  original: " << original.toString() << "   <- changed by accident\n";

    original = diwali();
    auto deep = original.clone();
    deep->name = "Diwali Pune";
    (*deep->cities)[0] = "Pune";
    std::cout << "Deep copy, then edit the copy:\n";
    std::cout << "  original: " << original.toString() << "\n";
    std::cout << "  copy:     " << deep->toString() << "\n";

    CampaignRegistry registry;
    registry.add("diwali", std::make_unique<Campaign>(diwali()));
    registry.add("midnight", std::make_unique<FlashSale>("Midnight Biryani", 50, std::vector<std::string>{"Hyderabad"}, 30));

    auto c = registry.create("midnight");
    c->cities->push_back("Bengaluru");
    std::cout << "From registry:\n";
    std::cout << "  edited copy: " << c->toString() << "\n";
    std::cout << "  fresh copy:  " << registry.create("midnight")->toString() << "\n";
    std::cout << "  type kept:   " << c->typeName() << "\n";
    return 0;
}
`,
      javascript: String.raw`class Campaign {
  constructor(name, discountPct, cities) {
    this.name = name;
    this.discountPct = discountPct;
    this.cities = cities;
  }

  // Deep copy that keeps the real class (structuredClone would return a
  // plain object and lose the methods).
  clone() {
    const copy = Object.create(Object.getPrototypeOf(this));
    Object.assign(copy, this);
    copy.cities = [...this.cities];
    return copy;
  }

  // The bug to avoid: Object.assign / spread copy references, not the list.
  shallowClone() {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
  }

  toString() {
    return this.name + " " + this.discountPct + "% [" + this.cities.join(", ") + "]";
  }
}

class FlashSale extends Campaign {
  constructor(name, discountPct, cities, durationMins) {
    super(name, discountPct, cities);
    this.durationMins = durationMins;
  }
  toString() {
    return super.toString() + " for " + this.durationMins + " min";
  }
}

class CampaignRegistry {
  #prototypes = new Map();
  register(key, prototype) { this.#prototypes.set(key, prototype); }
  create(key) {
    const p = this.#prototypes.get(key);
    if (!p) throw new Error("no prototype " + key);
    return p.clone();
  }
}

const diwali = () => new Campaign("Diwali Dhamaka", 40, ["Mumbai", "Delhi"]);

let original = diwali();
const shallow = original.shallowClone();
shallow.name = "Diwali Pune";
shallow.cities[0] = "Pune";
console.log("Shallow copy, then edit the copy:");
console.log("  original: " + original + "   <- changed by accident");

original = diwali();
const deep = original.clone();
deep.name = "Diwali Pune";
deep.cities[0] = "Pune";
console.log("Deep copy, then edit the copy:");
console.log("  original: " + original);
console.log("  copy:     " + deep);

const registry = new CampaignRegistry();
registry.register("diwali", diwali());
registry.register("midnight", new FlashSale("Midnight Biryani", 50, ["Hyderabad"], 30));

const c = registry.create("midnight");
c.cities.push("Bengaluru");
console.log("From registry:");
console.log("  edited copy: " + c);
console.log("  fresh copy:  " + registry.create("midnight"));
console.log("  type kept:   " + c.constructor.name);
`,
      go: String.raw`package main

import (
	"fmt"
	"slices"
	"strings"
)

// Prototype is anything that can copy itself.
type Prototype interface {
	Clone() Prototype
	String() string
}

type Campaign struct {
	Name        string
	DiscountPct int
	Cities      []string
}

// Clone makes a deep copy: struct copy, then a fresh slice.
func (c *Campaign) Clone() Prototype {
	cp := *c
	cp.Cities = slices.Clone(c.Cities)
	return &cp
}

func (c *Campaign) String() string {
	return fmt.Sprintf("%s %d%% [%s]", c.Name, c.DiscountPct, strings.Join(c.Cities, ", "))
}

type FlashSale struct {
	Campaign     // embedded: FlashSale gets Campaign's fields
	DurationMins int
}

func (f *FlashSale) Clone() Prototype {
	cp := *f
	cp.Cities = slices.Clone(f.Cities)
	return &cp
}

func (f *FlashSale) String() string {
	return fmt.Sprintf("%s for %d min", f.Campaign.String(), f.DurationMins)
}

type CampaignRegistry struct{ prototypes map[string]Prototype }

func (r *CampaignRegistry) Register(key string, p Prototype) { r.prototypes[key] = p }

func (r *CampaignRegistry) Create(key string) (Prototype, error) {
	p, ok := r.prototypes[key]
	if !ok {
		return nil, fmt.Errorf("no prototype %s", key)
	}
	return p.Clone(), nil
}

func diwali() *Campaign {
	return &Campaign{Name: "Diwali Dhamaka", DiscountPct: 40, Cities: []string{"Mumbai", "Delhi"}}
}

func main() {
	original := diwali()
	shallow := *original // copies the struct, but the slice still shares its array
	shallow.Name = "Diwali Pune"
	shallow.Cities[0] = "Pune"
	fmt.Println("Shallow copy, then edit the copy:")
	fmt.Println("  original:", original, "  <- changed by accident")

	original = diwali()
	deep := original.Clone().(*Campaign)
	deep.Name = "Diwali Pune"
	deep.Cities[0] = "Pune"
	fmt.Println("Deep copy, then edit the copy:")
	fmt.Println("  original:", original)
	fmt.Println("  copy:    ", deep)

	reg := &CampaignRegistry{prototypes: map[string]Prototype{}}
	reg.Register("diwali", diwali())
	reg.Register("midnight", &FlashSale{
		Campaign:     Campaign{Name: "Midnight Biryani", DiscountPct: 50, Cities: []string{"Hyderabad"}},
		DurationMins: 30,
	})

	p, _ := reg.Create("midnight")
	c := p.(*FlashSale)
	c.Cities = append(c.Cities, "Bengaluru")
	fresh, _ := reg.Create("midnight")
	fmt.Println("From registry:")
	fmt.Println("  edited copy:", c)
	fmt.Println("  fresh copy: ", fresh)
	fmt.Printf("  type kept:   %T\n", p)
}
`,
    },
  },
  diagrams: {
    singleton: String.raw`classDiagram
  class AppConfig {
    -AppConfig()
    -values Map
    +getInstance()$ AppConfig
    +get(key) String
  }
  class Holder {
    -INSTANCE AppConfig$
  }
  class PaymentService {
    -config AppConfig
    +PaymentService(config)
  }
  AppConfig ..> Holder : lazy init
  PaymentService --> AppConfig : injected`,
    factory: String.raw`classDiagram
  class NotificationSender {
    <<interface>>
    +send(to, message)
  }
  class SmsSender
  class EmailSender
  class WhatsAppSender
  NotificationSender <|.. SmsSender
  NotificationSender <|.. EmailSender
  NotificationSender <|.. WhatsAppSender
  class NotificationFactory {
    -registry Map
    +register(channel, creator)
    +create(channel) NotificationSender
  }
  NotificationFactory ..> NotificationSender : creates
  class OrderNotifier {
    <<abstract>>
    +orderPlaced(to, orderId)
    #createSender()* NotificationSender
  }
  class SmsOrderNotifier {
    #createSender() NotificationSender
  }
  class WhatsAppOrderNotifier {
    #createSender() NotificationSender
  }
  OrderNotifier <|-- SmsOrderNotifier
  OrderNotifier <|-- WhatsAppOrderNotifier`,
    abstractFactory: String.raw`classDiagram
  class PaymentProviderFactory {
    <<interface>>
    +createGateway() PaymentGateway
    +createRefundService() RefundService
  }
  class RazorpayFactory
  class StripeFactory
  PaymentProviderFactory <|.. RazorpayFactory
  PaymentProviderFactory <|.. StripeFactory
  class PaymentGateway {
    <<interface>>
    +charge(orderId, amount) String
  }
  class RefundService {
    <<interface>>
    +refund(paymentId, amount)
  }
  PaymentGateway <|.. RazorpayGateway
  PaymentGateway <|.. StripeGateway
  RefundService <|.. RazorpayRefunds
  RefundService <|.. StripeRefunds
  RazorpayFactory ..> RazorpayGateway : creates
  RazorpayFactory ..> RazorpayRefunds : creates
  StripeFactory ..> StripeGateway : creates
  StripeFactory ..> StripeRefunds : creates
  class CheckoutService
  CheckoutService --> PaymentProviderFactory
  CheckoutService --> PaymentGateway
  CheckoutService --> RefundService`,
    builder: String.raw`classDiagram
  class HttpRequest {
    -method String
    -url String
    -headers Map
    -body String
    -timeoutMs int
    -maxRetries int
    -HttpRequest(builder)
    +newBuilder(url)$ Builder
  }
  class Builder {
    -url String
    -method String
    -timeoutMs int
    +method(m) Builder
    +header(k, v) Builder
    +body(b) Builder
    +timeoutMs(t) Builder
    +retries(n) Builder
    +build() HttpRequest
  }
  Builder ..> HttpRequest : builds`,
    prototype: String.raw`classDiagram
  class Prototype {
    <<interface>>
    +clone() Prototype
  }
  class Campaign {
    +name String
    +discountPct int
    +cities List
    +clone() Campaign
  }
  class FlashSale {
    +durationMins int
    +clone() FlashSale
  }
  class CampaignRegistry {
    -prototypes Map
    +register(key, prototype)
    +create(key) Campaign
  }
  Prototype <|.. Campaign
  Campaign <|-- FlashSale
  CampaignRegistry o-- Prototype : stores templates`,
  },
});
