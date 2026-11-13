SD.register({
  id: "structural-patterns",
  html: String.raw`
<p class="lead">Structural patterns are about how objects fit together. Most of them are some form of <em>wrapping</em>: put one object in front of another to change its interface (Adapter), add behaviour (Decorator), control access (Proxy), or hide a messy subsystem behind one simple entry point (Facade). Composite lets you treat a single object and a whole tree of objects the same way. This page covers those five in depth with runnable code in five languages, plus short notes on Bridge and Flyweight.</p>

<h2>Why structure needs patterns</h2>
<p><a href="#/p/creational-patterns">Creational patterns</a> decide how objects are born. Structural patterns decide how they are connected once they exist. The recurring problems are very practical:</p>
<ul>
<li>A third-party SDK has the wrong shape for your code, and you cannot edit it.</li>
<li>You want logging, retries and caching around a service without touching the service.</li>
<li>Checkout talks to six subsystems and every caller repeats the same 40 lines of glue.</li>
<li>An expensive object should be created only when someone actually uses it.</li>
<li>A folder contains files and other folders, and you want <code>size()</code> to work on both.</li>
</ul>
<p>All of these favour <strong>composition over inheritance</strong>: build behaviour by holding a reference to another object rather than by extending its class. That principle is covered in <a href="#/p/design-principles">DRY, KISS, YAGNI &amp; Composition</a>, and the patterns below are its most common concrete forms.</p>

<figure class="svg-fig">
<svg viewBox="0 0 760 232" role="img" aria-label="Four wrapper patterns side by side: adapter, decorator, proxy and facade">
  <text class="s-title" x="100" y="22" text-anchor="middle">Adapter</text>
  <rect class="s-box" x="30" y="38" width="140" height="36" rx="10"/>
  <text class="s-text" x="100" y="61" text-anchor="middle">OtpService</text>
  <rect class="s-accent" x="30" y="98" width="140" height="36" rx="10"/>
  <text class="s-text" x="100" y="121" text-anchor="middle">SmsAdapter</text>
  <rect class="s-box" x="30" y="158" width="140" height="36" rx="10"/>
  <text class="s-text" x="100" y="181" text-anchor="middle">Vendor SDK</text>
  <line class="s-line" x1="100" y1="74" x2="100" y2="96" marker-end="url(#arrow)"/>
  <line class="s-line" x1="100" y1="134" x2="100" y2="156" marker-end="url(#arrow)"/>
  <text class="s-muted" x="100" y="216" text-anchor="middle">converts the interface</text>

  <text class="s-title" x="290" y="22" text-anchor="middle">Decorator</text>
  <rect class="s-box" x="220" y="38" width="140" height="36" rx="10"/>
  <text class="s-text" x="290" y="61" text-anchor="middle">Caller</text>
  <rect class="s-accent" x="220" y="98" width="140" height="36" rx="10"/>
  <text class="s-text" x="290" y="121" text-anchor="middle">Retry wrapper</text>
  <rect class="s-box" x="220" y="158" width="140" height="36" rx="10"/>
  <text class="s-text" x="290" y="181" text-anchor="middle">PriceService</text>
  <line class="s-line" x1="290" y1="74" x2="290" y2="96" marker-end="url(#arrow)"/>
  <line class="s-line" x1="290" y1="134" x2="290" y2="156" marker-end="url(#arrow)"/>
  <text class="s-muted" x="290" y="216" text-anchor="middle">same interface, adds behaviour</text>

  <text class="s-title" x="480" y="22" text-anchor="middle">Proxy</text>
  <rect class="s-box" x="410" y="38" width="140" height="36" rx="10"/>
  <text class="s-text" x="480" y="61" text-anchor="middle">Client</text>
  <rect class="s-accent" x="410" y="98" width="140" height="36" rx="10"/>
  <text class="s-text" x="480" y="121" text-anchor="middle">ReportProxy</text>
  <rect class="s-box" x="410" y="158" width="140" height="36" rx="10"/>
  <text class="s-text" x="480" y="181" text-anchor="middle">Real report</text>
  <line class="s-line" x1="480" y1="74" x2="480" y2="96" marker-end="url(#arrow)"/>
  <line class="s-dash" x1="480" y1="134" x2="480" y2="156"/>
  <text class="s-muted" x="480" y="216" text-anchor="middle">same interface, controls access</text>

  <text class="s-title" x="670" y="22" text-anchor="middle">Facade</text>
  <rect class="s-box" x="600" y="38" width="140" height="36" rx="10"/>
  <text class="s-text" x="670" y="61" text-anchor="middle">Checkout API</text>
  <rect class="s-accent" x="600" y="98" width="140" height="36" rx="10"/>
  <text class="s-text" x="670" y="121" text-anchor="middle">CheckoutFacade</text>
  <rect class="s-box" x="598" y="158" width="44" height="36" rx="10"/>
  <text class="s-text" x="620" y="181" text-anchor="middle">Cart</text>
  <rect class="s-box" x="648" y="158" width="44" height="36" rx="10"/>
  <text class="s-text" x="670" y="181" text-anchor="middle">Pay</text>
  <rect class="s-box" x="698" y="158" width="44" height="36" rx="10"/>
  <text class="s-text" x="720" y="181" text-anchor="middle">Stock</text>
  <line class="s-line" x1="670" y1="74" x2="670" y2="96" marker-end="url(#arrow)"/>
  <line class="s-line" x1="630" y1="134" x2="620" y2="156" marker-end="url(#arrow)"/>
  <line class="s-line" x1="670" y1="134" x2="670" y2="156" marker-end="url(#arrow)"/>
  <line class="s-line" x1="710" y1="134" x2="720" y2="156" marker-end="url(#arrow)"/>
  <text class="s-muted" x="670" y="216" text-anchor="middle">one simple entry point</text>
</svg>
<figcaption>Four wrappers that look alike in code. The difference is intent: change the interface, add behaviour, control access, or simplify. The dashed line means the proxy may not have created the real object yet.</figcaption>
</figure>

<div class="callout info"><strong>Quick map</strong>
<table>
<thead><tr><th>Pattern</th><th>One-line intent</th></tr></thead>
<tbody>
<tr><td>Adapter</td><td>Make an existing class usable through the interface your code expects.</td></tr>
<tr><td>Decorator</td><td>Add responsibilities to an object at runtime by wrapping it in objects with the same interface.</td></tr>
<tr><td>Facade</td><td>Give a complex subsystem one simple, high-level entry point.</td></tr>
<tr><td>Proxy</td><td>Stand in for another object to control access to it: lazily, remotely, or with checks.</td></tr>
<tr><td>Composite</td><td>Treat individual objects and trees of objects through the same interface.</td></tr>
<tr><td>Bridge</td><td>Split two independent dimensions of variation into two hierarchies joined by a reference.</td></tr>
<tr><td>Flyweight</td><td>Share the common part of many small objects to save memory.</td></tr>
</tbody>
</table>
</div>

<h2>Adapter</h2>
<p><strong>Intent:</strong> convert the interface of an existing class into the interface your code expects, without changing either side.</p>
<h3>The problem it solves</h3>
<p>Swiggy sends roughly a crore OTP and order SMS messages a day through Indian SMS vendors. Each vendor ships its own SDK. One wants a payload object with an <code>msisdn</code> (the number as <code>919845011111</code>, no plus sign) and returns an HTTP-style status code. Another wants an E.164 number (<code>+919845011111</code>) and returns a result object with an <code>accepted</code> flag. Your OTP service should not care. It wants one method: <code>send(phone, text)</code> returning true or false.</p>
<p>You cannot edit the vendor SDKs, and you should not scatter vendor-specific code across your services. An adapter is a small class that implements <em>your</em> interface and translates each call into the vendor's API: reformat the phone number, build the payload, map status codes to a boolean. Once every vendor sits behind the same interface, you get failover for free: try vendor A, and if it is down, try vendor B.</p>
<div data-diagram="adapter" data-caption="Each adapter implements the SmsSender interface and wraps one vendor client. OtpService only knows SmsSender."></div>
<h3>How it works</h3>
<ol class="steps">
<li>Define the <strong>target</strong> interface from your code's point of view: <code>SmsSender.send(phone, text)</code>.</li>
<li>Leave the <strong>adaptee</strong> (vendor client) untouched.</li>
<li>Write an <strong>adapter</strong> that implements the target and holds a reference to the adaptee. Each method translates arguments, calls the adaptee, and translates the result and errors back.</li>
<li>Inject adapters into clients. Adding a third vendor is one new adapter class.</li>
</ol>
<div data-code="adapter"></div>
<h3>Object adapter vs class adapter</h3>
<p>The version above is an <strong>object adapter</strong>: it holds the vendor client as a field. A <strong>class adapter</strong> instead inherits from the vendor class and implements your interface at the same time. Class adapters need multiple inheritance (C++) or only work when the vendor class is not final, and they expose all vendor methods. Prefer object adapters; they follow composition over inheritance and can wrap any subclass of the vendor client.</p>
<h3>When to use it, and when it is overkill</h3>
<p>Use an adapter at every boundary with code you do not own: payment gateways, SMS and email vendors, maps APIs, legacy modules during a migration. It also keeps vendor types out of your domain model, which is the core idea of "ports and adapters" (hexagonal) architecture. It is overkill when you control both sides: just change one of them to match. An adapter over your own fresh code is usually a sign of a design mistake upstream.</p>
<h3>In LLD rounds and real libraries</h3>
<ul>
<li>Java: <code>Arrays.asList()</code> adapts an array to the <code>List</code> interface. <code>InputStreamReader</code> adapts a byte <code>InputStream</code> into a character <code>Reader</code>.</li>
<li>Go: <code>http.HandlerFunc</code> adapts a plain function <code>func(w, r)</code> into the <code>http.Handler</code> interface. <code>strings.NewReader</code> adapts a string to <code>io.Reader</code>.</li>
<li>In rounds: wrapping UPI, card and wallet providers behind one <code>PaymentMethod</code> in <a href="#/p/parking-lot">Parking Lot</a> or <a href="#/p/vending-machine">Vending Machine</a>, or vendor clients in a <a href="#/p/notification-system">notification system</a>.</li>
</ul>

<h2>Decorator</h2>
<p><strong>Intent:</strong> attach extra responsibilities to an object at runtime by wrapping it in another object that has the same interface.</p>
<h3>The problem it solves</h3>
<p>Flipkart's product page calls a <code>PriceService</code> to fetch the current price of an item. Over time the team wants logging on every call, retries when the catalog service times out, and an in-memory cache because the same phone gets looked up thousands of times a second during a Big Billion Days sale. Some callers want all three, the admin tool wants no cache, and tests want none of them.</p>
<p>With inheritance you would write <code>LoggingPriceService</code>, <code>CachingPriceService</code>, <code>LoggingCachingPriceService</code>, <code>LoggingRetryingCachingPriceService</code>... Three optional features give 2<sup>3</sup> = 8 subclasses, and a fourth feature doubles it again to 16. That is the <mark>inheritance explosion</mark>. Decorators fix it: each feature is one small class that implements <code>PriceService</code>, holds another <code>PriceService</code>, does its extra work, and delegates. You stack them in any order at startup: three features, three classes, any combination.</p>
<div data-diagram="decorator" data-caption="Every decorator is a PriceService and has a PriceService. Calls flow from the outermost wrapper inward."></div>
<h3>How it works</h3>
<ol class="steps">
<li>Start with the component interface: <code>getPrice(sku)</code>.</li>
<li>The concrete component (<code>CatalogPriceService</code>) does the real work.</li>
<li>Each decorator implements the same interface and takes the wrapped component in its constructor.</li>
<li>Its method does something before and/or after calling <code>inner.getPrice(sku)</code>, or skips the inner call entirely (a cache hit).</li>
<li>Compose at startup: <code>new Logging(new Caching(new Retrying(catalog, 3)))</code>. The caller just sees a <code>PriceService</code>.</li>
</ol>
<p>Order matters. Here the cache sits outside the retry, so a cache hit never triggers a retry. If retry were outside logging, you would log every attempt instead of every request. Choosing the order is a design decision you should say out loud in an interview.</p>
<div data-code="decorator"></div>
<div class="callout tip"><strong>Python's @decorator is related but not the same</strong>Python's <code>@functools.cache</code> or a custom <code>@retry</code> wraps a <em>function</em> at definition time. The GoF Decorator wraps an <em>object</em>, usually at runtime. Both apply the same idea, adding behaviour by wrapping, and Python's syntax is often the lighter choice for cross-cutting concerns on single functions.</div>
<h3>When to use it, and when it is overkill</h3>
<p>Use decorators for cross-cutting features that can be switched on and off independently: logging, metrics, retries, caching, rate limiting, compression, encryption, authorization checks. They keep each concern in its own small class that you can test alone. They are overkill when there is one fixed extra behaviour that every caller always wants (just put it in the class), and they get hard to debug when you stack ten of them, because a stack trace runs through every layer.</p>
<h3>In LLD rounds and real libraries</h3>
<ul>
<li>Java I/O is the textbook example: <code>new BufferedReader(new InputStreamReader(new FileInputStream(f)))</code>. Each layer is a <code>Reader</code> or <code>InputStream</code> that adds buffering, decoding or gzip (<code>GZIPInputStream</code>). Also <code>Collections.unmodifiableList(list)</code> and <code>Collections.synchronizedMap(map)</code>.</li>
<li>Go: <code>bufio.NewReader(r)</code> and <code>gzip.NewReader(r)</code> wrap any <code>io.Reader</code>. HTTP middleware, <code>func(next http.Handler) http.Handler</code>, is decorator in function form.</li>
<li>Express and Koa middleware in Node, and servlet filters in Java, are decorator chains around a request handler.</li>
<li>In rounds: toppings on a pizza or a coffee (the classic textbook example), add-on charges like EV charging on top of base parking pricing, or log formatters in the <a href="#/p/logger">logger</a> problem.</li>
</ul>

<h2>Facade</h2>
<p><strong>Intent:</strong> provide one simple, high-level interface to a set of interfaces in a subsystem.</p>
<h3>The problem it solves</h3>
<p>Placing an order on Zepto or BigBasket touches the cart, inventory, pricing, payment, order storage and notifications. The correct sequence is subtle: reserve stock for every item, charge the customer, and if the payment fails, release the stock you reserved; only after success, clear the cart and send the confirmation. If the mobile API, the web API and the "reorder" button each repeat this sequence, one of them will eventually get the rollback wrong and you will have phantom-reserved stock.</p>
<p>A facade puts the sequence in one class, <code>CheckoutFacade.placeOrder(userId, paymentMethod)</code>. Callers make one call. The subsystems stay independent and can still be used directly for other features (an admin tool may talk to inventory alone).</p>
<div data-diagram="facade" data-caption="Clients call one method on the facade. The facade orchestrates the subsystems, which do not know about each other."></div>
<h3>How it works</h3>
<ol class="steps">
<li>Leave the subsystem classes as they are, each with its own focused API.</li>
<li>Create a facade that holds references to them (injected through the constructor).</li>
<li>Expose a few coarse-grained methods that match what clients actually want to do.</li>
<li>Put ordering, rollback and error mapping inside the facade, so clients get one result.</li>
</ol>
<div data-code="facade"></div>
<h3>Facade vs Adapter vs Mediator</h3>
<p>An adapter makes <em>one</em> class fit an interface that already exists. A facade <em>defines a new, simpler</em> interface over <em>many</em> classes. A mediator (a behavioural pattern) also coordinates many objects, but those objects talk to the mediator and know about it; subsystems behind a facade do not know the facade exists. See <a href="#/p/behavioral-patterns">Behavioural Patterns</a>.</p>
<h3>When to use it, and when it is overkill</h3>
<p>Use a facade when a common workflow spans several classes, or to give a team a clean entry point into a messy legacy module. In services this is often called an application service or orchestrator. Watch out for the facade becoming a god class: if <code>CheckoutFacade</code> starts calculating taxes and formatting emails itself, the logic has leaked out of the subsystems. A facade should coordinate, not compute. It is overkill when there is only one subsystem call to make.</p>
<h3>In LLD rounds and real libraries</h3>
<ul>
<li>SLF4J is named "Simple Logging Facade for Java": one API over Logback, Log4j and java.util.logging.</li>
<li>Java's <code>javax.faces.context.FacesContext</code>, jQuery's <code>$.ajax</code> over XMLHttpRequest, and Python's <code>requests.get()</code> over sockets, TLS, redirects and connection pools are all facades.</li>
<li>At system level, an <a href="#/p/api-gateway-rate-limiting">API gateway</a> or a backend-for-frontend is a facade over many microservices.</li>
<li>In rounds: <code>ParkingLot.park()</code>, <code>Library.checkout()</code> in <a href="#/p/library-management">Library Management</a>, and <code>BookingService.book()</code> are facades over smaller classes.</li>
</ul>

<h2>Proxy</h2>
<p><strong>Intent:</strong> provide a stand-in object with the same interface as the real one, to control access to it.</p>
<h3>The problem it solves</h3>
<p>A PhonePe business dashboard shows a sales report built from gigabytes of warehouse data. Creating the report object loads that data, which takes seconds and lots of memory. Most users open the dashboard and never click the report, and interns should not see revenue numbers at all. You want code to hold a <code>Report</code> reference freely, while the expensive load happens only on first real use, and only for authorised roles.</p>
<p>A proxy implements the same <code>Report</code> interface as the real report. It checks the role first, creates the real object on first allowed access, and then forwards calls. Callers cannot tell the difference.</p>
<div data-diagram="proxy" data-caption="The proxy and the real subject share one interface. The proxy creates the real object only when needed."></div>
<h3>Kinds of proxy</h3>
<div class="tabs">
<section data-tab="Virtual (lazy)">
<p>Delays creating an expensive object until it is first used. Hibernate and JPA return lazy proxies for related entities: <code>order.getCustomer()</code> returns a proxy, and the SQL query runs only when you read a field. The famous <em>LazyInitializationException</em> happens when you touch the proxy after the database session is closed.</p>
</section>
<section data-tab="Protection">
<p>Checks permissions before forwarding. Spring Security's <code>@PreAuthorize</code> works by wrapping your bean in a proxy that checks the caller's roles first. Our report example combines protection and lazy loading.</p>
</section>
<section data-tab="Remote">
<p>Makes a remote object look local. A gRPC client stub or a Java RMI stub has the service's methods, but each call serialises arguments and sends them over the network. Convenient, but it hides latency and failure, so name such methods honestly and handle timeouts.</p>
</section>
<section data-tab="Caching / smart">
<p>Remembers results, counts references or adds logging. A caching proxy and a caching decorator have identical code. The difference is intent: a proxy controls access to one specific subject and often manages its lifecycle; a decorator adds a feature that can be stacked with others on any implementation.</p>
</section>
</div>
<div data-code="proxy"></div>
<h3>Proxy pattern vs reverse proxy</h3>
<p>A <a href="#/p/proxies">reverse proxy</a> such as Nginx or Envoy is the same idea at network level. It accepts requests on behalf of backend servers, which clients never talk to directly, and adds access control (TLS termination, auth), caching and lazy behaviour (connection pooling). A forward proxy does the same on behalf of clients. The class-level Proxy pattern is the in-process version: same interface, controlled access.</p>
<h3>When to use it, and when it is overkill</h3>
<p>Use a proxy for lazy loading of heavy objects, for access checks you want enforced in one place, for remote calls, and for framework magic (transactions, security, caching) that must wrap your objects transparently. It is overkill for objects that are cheap to create and have no access rules. Be careful with thread safety in lazy proxies: two threads can both see "not loaded yet". Use a lock, <code>sync.Once</code> or <code>std::call_once</code>, as the code does.</p>
<h3>In LLD rounds and real libraries</h3>
<ul>
<li>Spring AOP: <code>@Transactional</code>, <code>@Cacheable</code> and <code>@Async</code> all work by wrapping your bean in a proxy (a JDK dynamic proxy via <code>java.lang.reflect.Proxy</code>, or a CGLIB subclass). That is why calling a <code>@Transactional</code> method from inside the same class skips the transaction: the call never goes through the proxy.</li>
<li>JavaScript has a built-in <code>Proxy</code> object that intercepts property reads and writes. Vue 3's reactivity system is built on it.</li>
<li>In rounds: a cache in front of a slow repository, or role checks in front of an admin service. In <a href="#/p/library-management">Library Management</a>, a protection proxy can stop members from calling librarian-only operations.</li>
</ul>

<h2>Composite</h2>
<p><strong>Intent:</strong> compose objects into tree structures and let clients treat single objects and groups of objects through the same interface.</p>
<h3>The problem it solves</h3>
<p>Google Drive shows the size of a folder. A folder contains files and other folders, which contain more files, to any depth. Without Composite, the size code is full of checks: "if this is a file, take its size; if it is a folder, loop over children and check each one again". Every new operation (count files, search, delete, set permissions) repeats that branching.</p>
<p>With Composite, both <code>File</code> and <code>Directory</code> implement one interface, <code>FsNode</code>, with <code>size()</code>. A file returns its own size. A directory returns the sum of <code>size()</code> over its children, without caring whether each child is a file or another directory. Recursion does the rest. The same shape fits a Swiggy restaurant menu (categories that contain dishes and sub-categories), an org chart, UI layouts (a panel contains buttons and other panels) and the expression trees in a calculator.</p>
<div data-diagram="composite" data-caption="Directory is an FsNode and contains FsNodes. Leaves (File) and composites (Directory) share one interface."></div>
<h3>How it works</h3>
<ol class="steps">
<li>Define the component interface with the operations that make sense on both leaves and groups: <code>size()</code>, <code>print()</code>, <code>fileCount()</code>.</li>
<li>Leaves implement them directly.</li>
<li>Composites hold a list of components and implement each operation by delegating to the children and combining results.</li>
<li>Clients call operations on the root, or on any subtree, the same way.</li>
</ol>
<div data-code="composite"></div>
<h3>Design choices to discuss</h3>
<ul>
<li><strong>Where do <code>add()</code> and <code>remove()</code> live?</strong> On the composite only (type-safe: you cannot add a child to a file) or on the shared interface (uniform, but a file must throw). Most modern code puts them on the composite only.</li>
<li><strong>Parent pointers</strong> make "path of this file" and "move" easy, but you must keep them in sync.</li>
<li><strong>Cached sizes</strong>: recomputing a folder size walks the whole subtree. For huge trees, cache the size in each directory and update ancestors on change.</li>
<li><strong>Cycles</strong>: a tree must not contain itself. Symlinks and shortcuts turn it into a graph, so traversals need a visited set.</li>
</ul>
<h3>When to use it, and when it is overkill</h3>
<p>Use Composite whenever the domain is naturally a part-whole hierarchy with unlimited depth. It is overkill for a fixed, shallow structure (a cart with items is just a list; no nesting needed). The full in-memory file system problem builds on this pattern with paths, <code>mkdir</code>, <code>ls</code> and moves.</p>
<h3>In LLD rounds and real libraries</h3>
<ul>
<li>The browser DOM: every element is a <code>Node</code>, and elements contain nodes. React components contain components.</li>
<li>Java Swing and AWT: <code>Container</code> extends <code>Component</code> and holds components.</li>
<li>In rounds: file systems, menus with categories, organisation hierarchies, and nested comments.</li>
</ul>

<h2>Bridge and Flyweight (brief)</h2>
<div class="grid-2">
<div class="card">
<h3>Bridge</h3>
<p><strong>Intent:</strong> split a class that varies along two independent dimensions into two hierarchies, connected by a reference, so each side can change on its own.</p>
<p><strong>Example:</strong> a notification system has message kinds (OTP, promotion, order update) and channels (SMS, email, WhatsApp). Subclassing every pair gives <code>OtpSms</code>, <code>OtpEmail</code>, <code>PromoSms</code> and so on: 3 &times; 3 = 9 classes, and a fourth channel adds 3 more. With Bridge, a <code>Message</code> hierarchy holds a reference to a <code>Channel</code> interface: 3 + 3 = 6 classes, and each new channel is one class.</p>
<p><strong>Real world:</strong> JDBC splits the API you code against from vendor drivers. SLF4J's API and its logging backends. Remote controls (abstraction) and TV brands (implementation) in textbooks.</p>
<p><strong>vs Adapter:</strong> Bridge is designed up front so two sides can vary; Adapter is applied afterwards to make two existing things fit.</p>
</div>
<div class="card">
<h3>Flyweight</h3>
<p><strong>Intent:</strong> share the part of many small objects that is the same (intrinsic state) and pass in the part that differs (extrinsic state), to save memory.</p>
<p><strong>Example:</strong> a Swiggy map shows 50,000 restaurant pins. Each pin needs a position and a rating (unique) and an icon bitmap plus colours per cuisine (shared). Store one <code>PinStyle</code> object per cuisine in a factory map and let each pin point to it. 50,000 bitmaps become 20. Text editors do the same for character glyphs and fonts.</p>
<p><strong>Real world:</strong> <code>Integer.valueOf()</code> caches -128 to 127, <code>String.intern()</code>, Python's small integer and interned string caches, and game engines drawing thousands of identical trees.</p>
<p><strong>Rule:</strong> flyweights must be immutable, since many owners share them.</p>
</div>
</div>

<h2>Choosing between them</h2>
<table>
<thead><tr><th>Pattern</th><th>Interface it exposes</th><th>Wraps</th><th>Main purpose</th><th>Overkill when</th></tr></thead>
<tbody>
<tr><td>Adapter</td><td>Your target interface (different from the wrapped one)</td><td>One existing class</td><td>Make incompatible code fit</td><td>You control both sides</td></tr>
<tr><td>Decorator</td><td>Same as wrapped</td><td>One object, stackable</td><td>Add optional behaviour</td><td>One fixed behaviour everyone needs</td></tr>
<tr><td>Facade</td><td>New, simpler interface</td><td>Many classes</td><td>Simplify a workflow</td><td>Only one call to make</td></tr>
<tr><td>Proxy</td><td>Same as wrapped</td><td>One specific subject</td><td>Control access: lazy, remote, protected</td><td>Cheap object, no access rules</td></tr>
<tr><td>Composite</td><td>Same for leaf and group</td><td>A tree of children</td><td>Treat part and whole alike</td><td>Flat or fixed-depth data</td></tr>
<tr><td>Bridge</td><td>Abstraction holding an implementation</td><td>An implementor interface</td><td>Avoid M &times; N subclasses</td><td>Only one dimension varies</td></tr>
<tr><td>Flyweight</td><td>Shared immutable object</td><td>Nothing, it is shared</td><td>Save memory</td><td>Few objects</td></tr>
</tbody>
</table>

<div class="callout warn"><strong>Common mistakes</strong>
<ul>
<li>Calling every wrapper a "decorator". If it changes the interface it is an adapter; if it controls access to one subject it is a proxy.</li>
<li>A decorator that does not implement the full interface, so it cannot be stacked or swapped in.</li>
<li>A facade that grows business logic and becomes the new god class.</li>
<li>Lazy proxies with no thread safety, so two threads both load the heavy object.</li>
<li>Composite with <code>if (node instanceof Directory)</code> checks in client code, which defeats the point.</li>
<li>Leaking vendor types (an SDK's response class) through an adapter into your domain code.</li>
</ul>
</div>

<div class="callout interview"><strong>Say this in the interview</strong>"The SMS vendors have different SDKs, so each sits behind an adapter implementing our <code>SmsSender</code>; that also gives us failover between vendors. Retries, logging and caching are decorators around the price service, so each concern is one small class and we compose them at startup instead of creating a subclass per combination. Checkout gets a facade that owns the reserve, charge, rollback sequence, so no caller can get the rollback wrong. Folders and files share one <code>FsNode</code> interface, which is Composite, so size and search are just recursion."</div>

<h2>Test yourself</h2>
<div class="quiz">
<details><summary>Adapter, Decorator and Proxy all wrap an object. How do you tell them apart?</summary><div>By intent and interface. An adapter exposes a <em>different</em> interface from the one it wraps, to make it fit. A decorator exposes the <em>same</em> interface and adds behaviour; decorators are meant to be stacked in any combination. A proxy exposes the same interface and controls access to one particular subject: lazy creation, permission checks, remote calls or caching.</div></details>
<details><summary>You need logging, retry and caching around a service, in any combination. Why not subclasses?</summary><div>Three optional features need 2<sup>3</sup> = 8 subclasses to cover every combination, and each new feature doubles that. Decorators need one class per feature, composed at runtime, and each can be tested alone. The order of wrapping is explicit and can differ per caller.</div></details>
<details><summary>Where should the cache sit relative to the retry decorator, and why?</summary><div>Usually outside: <code>Cache(Retry(service))</code>. A cache hit then returns immediately and never triggers retries, and only a miss goes through the retry logic. If the retry were outside the cache, it would retry cache lookups too, which is pointless. Logging is typically outermost so each request is logged once.</div></details>
<details><summary>In a facade, payment fails after stock was reserved. What should happen?</summary><div>The facade releases every item it reserved (a compensating action), leaves the cart intact so the user can retry, and returns a clear failure. Keeping this rollback inside the facade means no caller can forget it. Across services this becomes the saga pattern with compensations.</div></details>
<details><summary>Why does a @Transactional method called from another method in the same Spring bean not start a transaction?</summary><div>Spring implements <code>@Transactional</code> with a proxy around the bean. External calls go through the proxy, which starts the transaction. A call from inside the bean uses <code>this</code>, which is the real object, so the proxy is bypassed. Fixes: move the method to another bean, or inject the bean's own proxy.</div></details>
<details><summary>How would you compute the size of a folder with millions of files quickly?</summary><div>Composite gives a correct recursive <code>size()</code>, but walking millions of nodes on every call is slow. Cache the size in each directory and, when a file is added, removed or resized, update the cached size of every ancestor (needs parent pointers). Reads become O(1); writes cost O(depth).</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
<li>Structural patterns are mostly wrappers. Name them by intent: Adapter changes the interface, Decorator adds behaviour, Proxy controls access, Facade simplifies many classes.</li>
<li>Adapters belong at every boundary with code you do not own, and they make vendors swappable.</li>
<li>Decorators replace the inheritance explosion with small stackable classes. Wrapping order is a design decision.</li>
<li>A facade coordinates subsystems and owns rollback, but should not grow business logic.</li>
<li>Proxies power lazy loading, security checks and framework features like Spring's <code>@Transactional</code>. A reverse proxy is the same idea on the network.</li>
<li>Composite turns part-whole trees into simple recursion. Bridge avoids M &times; N subclasses; Flyweight shares immutable state to save memory.</li>
</ul></div>
`,
  code: {
    adapter: {
      title: "Adapter: two SMS vendor SDKs behind one interface, with failover",
      java: String.raw`import java.util.List;

public class Main {

    // Target: the interface our code wants.
    interface SmsSender {
        String name();
        boolean send(String phone, String text);
    }

    // ---- Adaptee 1: vendor SDK we cannot change ----
    static final class SmsPayload {
        final String msisdn, senderId, body;
        SmsPayload(String msisdn, String senderId, String body) {
            this.msisdn = msisdn;
            this.senderId = senderId;
            this.body = body;
        }
    }

    static final class FastSmsClient {
        private final boolean down;
        FastSmsClient(boolean down) { this.down = down; }

        int dispatch(SmsPayload p) { // returns an HTTP-style status
            int status = down ? 503 : 202;
            System.out.println("  [FastSms] dispatch msisdn=" + p.msisdn + " sender=" + p.senderId + " -> HTTP " + status);
            return status;
        }
    }

    // ---- Adaptee 2: another vendor, different shape ----
    static final class CloudTextResult {
        final boolean accepted;
        CloudTextResult(boolean accepted) { this.accepted = accepted; }
    }

    static final class CloudTextApi {
        CloudTextResult sendMessage(String toE164, String message) {
            System.out.println("  [CloudText] sendMessage to=" + toE164 + " -> accepted");
            return new CloudTextResult(true);
        }
    }

    // ---- Adapters: implement our interface, translate to the vendor's ----
    static final class FastSmsAdapter implements SmsSender {
        private final FastSmsClient client;
        private final String senderId;
        FastSmsAdapter(FastSmsClient client, String senderId) {
            this.client = client;
            this.senderId = senderId;
        }
        public String name() { return "FastSms"; }
        public boolean send(String phone, String text) {
            String msisdn = phone.replaceAll("[^0-9]", ""); // +91-98450-11111 -> 919845011111
            return client.dispatch(new SmsPayload(msisdn, senderId, text)) == 202;
        }
    }

    static final class CloudTextAdapter implements SmsSender {
        private final CloudTextApi api;
        CloudTextAdapter(CloudTextApi api) { this.api = api; }
        public String name() { return "CloudText"; }
        public boolean send(String phone, String text) {
            String e164 = "+" + phone.replaceAll("[^0-9]", ""); // -> +919845011111
            return api.sendMessage(e164, text).accepted;
        }
    }

    // Client: knows only SmsSender, so vendors are swappable and can fail over.
    static final class OtpService {
        private final List<SmsSender> senders;
        OtpService(List<SmsSender> senders) { this.senders = senders; }

        boolean sendOtp(String phone, String otp) {
            String text = "Your OTP is " + otp + ". Valid for 5 minutes.";
            for (SmsSender s : senders) {
                if (s.send(phone, text)) {
                    System.out.println("  delivered via " + s.name());
                    return true;
                }
                System.out.println("  " + s.name() + " failed, trying next provider");
            }
            return false;
        }
    }

    public static void main(String[] args) {
        OtpService otp = new OtpService(List.of(
            new FastSmsAdapter(new FastSmsClient(true), "SWIGGY"), // primary is down today
            new CloudTextAdapter(new CloudTextApi())));
        System.out.println("Sending OTP to +91-98450-11111");
        boolean ok = otp.sendOtp("+91-98450-11111", "4821");
        System.out.println("Result: " + ok);
    }
}
`,
      python: String.raw`import re
from abc import ABC, abstractmethod
from dataclasses import dataclass


# Target: the interface our code wants.
class SmsSender(ABC):
    name = "?"

    @abstractmethod
    def send(self, phone: str, text: str) -> bool: ...


# ---- Adaptee 1: vendor SDK we cannot change ----
@dataclass
class SmsPayload:
    msisdn: str
    sender_id: str
    body: str


class FastSmsClient:
    def __init__(self, down=False):
        self.down = down

    def dispatch(self, p: SmsPayload) -> int:
        status = 503 if self.down else 202
        print(f"  [FastSms] dispatch msisdn={p.msisdn} sender={p.sender_id} -> HTTP {status}")
        return status


# ---- Adaptee 2: another vendor, different shape ----
@dataclass
class CloudTextResult:
    accepted: bool


class CloudTextApi:
    def send_message(self, to_e164: str, message: str) -> CloudTextResult:
        print(f"  [CloudText] sendMessage to={to_e164} -> accepted")
        return CloudTextResult(accepted=True)


# ---- Adapters ----
def digits(phone):
    return re.sub(r"[^0-9]", "", phone)


class FastSmsAdapter(SmsSender):
    name = "FastSms"

    def __init__(self, client: FastSmsClient, sender_id: str):
        self._client = client
        self._sender_id = sender_id

    def send(self, phone, text):
        payload = SmsPayload(digits(phone), self._sender_id, text)  # 919845011111
        return self._client.dispatch(payload) == 202


class CloudTextAdapter(SmsSender):
    name = "CloudText"

    def __init__(self, api: CloudTextApi):
        self._api = api

    def send(self, phone, text):
        return self._api.send_message("+" + digits(phone), text).accepted  # +919845011111


# Client: knows only SmsSender.
class OtpService:
    def __init__(self, senders):
        self._senders = senders

    def send_otp(self, phone, otp):
        text = f"Your OTP is {otp}. Valid for 5 minutes."
        for s in self._senders:
            if s.send(phone, text):
                print(f"  delivered via {s.name}")
                return True
            print(f"  {s.name} failed, trying next provider")
        return False


if __name__ == "__main__":
    otp = OtpService([
        FastSmsAdapter(FastSmsClient(down=True), "SWIGGY"),  # primary is down today
        CloudTextAdapter(CloudTextApi()),
    ])
    print("Sending OTP to +91-98450-11111")
    ok = otp.send_otp("+91-98450-11111", "4821")
    print(f"Result: {str(ok).lower()}")
`,
      cpp: String.raw`#include <cctype>
#include <iostream>
#include <memory>
#include <string>
#include <utility>
#include <vector>

// Target: the interface our code wants.
class SmsSender {
public:
    virtual ~SmsSender() = default;
    virtual std::string name() const = 0;
    virtual bool send(const std::string& phone, const std::string& text) = 0;
};

// ---- Adaptee 1: vendor SDK we cannot change ----
struct SmsPayload {
    std::string msisdn, senderId, body;
};

class FastSmsClient {
public:
    explicit FastSmsClient(bool down) : down_(down) {}
    int dispatch(const SmsPayload& p) {
        int status = down_ ? 503 : 202;
        std::cout << "  [FastSms] dispatch msisdn=" << p.msisdn << " sender=" << p.senderId
                  << " -> HTTP " << status << "\n";
        return status;
    }
private:
    bool down_;
};

// ---- Adaptee 2: another vendor, different shape ----
struct CloudTextResult {
    bool accepted;
};

class CloudTextApi {
public:
    CloudTextResult sendMessage(const std::string& toE164, const std::string&) {
        std::cout << "  [CloudText] sendMessage to=" << toE164 << " -> accepted\n";
        return {true};
    }
};

static std::string digits(const std::string& s) {
    std::string out;
    for (char c : s) if (std::isdigit(static_cast<unsigned char>(c))) out += c;
    return out;
}

// ---- Adapters: own the vendor client, implement our interface ----
class FastSmsAdapter : public SmsSender {
public:
    FastSmsAdapter(std::unique_ptr<FastSmsClient> client, std::string senderId)
        : client_(std::move(client)), senderId_(std::move(senderId)) {}
    std::string name() const override { return "FastSms"; }
    bool send(const std::string& phone, const std::string& text) override {
        return client_->dispatch({digits(phone), senderId_, text}) == 202;
    }
private:
    std::unique_ptr<FastSmsClient> client_;
    std::string senderId_;
};

class CloudTextAdapter : public SmsSender {
public:
    explicit CloudTextAdapter(std::unique_ptr<CloudTextApi> api) : api_(std::move(api)) {}
    std::string name() const override { return "CloudText"; }
    bool send(const std::string& phone, const std::string& text) override {
        return api_->sendMessage("+" + digits(phone), text).accepted;
    }
private:
    std::unique_ptr<CloudTextApi> api_;
};

// Client: knows only SmsSender.
class OtpService {
public:
    explicit OtpService(std::vector<std::unique_ptr<SmsSender>> senders) : senders_(std::move(senders)) {}
    bool sendOtp(const std::string& phone, const std::string& otp) {
        std::string text = "Your OTP is " + otp + ". Valid for 5 minutes.";
        for (auto& s : senders_) {
            if (s->send(phone, text)) {
                std::cout << "  delivered via " << s->name() << "\n";
                return true;
            }
            std::cout << "  " << s->name() << " failed, trying next provider\n";
        }
        return false;
    }
private:
    std::vector<std::unique_ptr<SmsSender>> senders_;
};

int main() {
    std::vector<std::unique_ptr<SmsSender>> senders;
    senders.push_back(std::make_unique<FastSmsAdapter>(std::make_unique<FastSmsClient>(true), "SWIGGY"));
    senders.push_back(std::make_unique<CloudTextAdapter>(std::make_unique<CloudTextApi>()));
    OtpService otp(std::move(senders));

    std::cout << "Sending OTP to +91-98450-11111\n";
    bool ok = otp.sendOtp("+91-98450-11111", "4821");
    std::cout << "Result: " << (ok ? "true" : "false") << "\n";
    return 0;
}
`,
      javascript: String.raw`// ---- Adaptee 1: vendor SDK we cannot change ----
class FastSmsClient {
  constructor(down) { this.down = down; }
  dispatch(payload) { // returns an HTTP-style status
    const status = this.down ? 503 : 202;
    console.log("  [FastSms] dispatch msisdn=" + payload.msisdn + " sender=" + payload.senderId + " -> HTTP " + status);
    return status;
  }
}

// ---- Adaptee 2: another vendor, different shape ----
class CloudTextApi {
  sendMessage(toE164, message) {
    console.log("  [CloudText] sendMessage to=" + toE164 + " -> accepted");
    return { accepted: true };
  }
}

const digits = (phone) => phone.replace(/[^0-9]/g, "");

// ---- Adapters: all expose { name, send(phone, text) -> boolean } ----
class FastSmsAdapter {
  constructor(client, senderId) {
    this.client = client;
    this.senderId = senderId;
    this.name = "FastSms";
  }
  send(phone, text) {
    return this.client.dispatch({ msisdn: digits(phone), senderId: this.senderId, body: text }) === 202;
  }
}

class CloudTextAdapter {
  constructor(api) {
    this.api = api;
    this.name = "CloudText";
  }
  send(phone, text) {
    return this.api.sendMessage("+" + digits(phone), text).accepted;
  }
}

// Client: relies only on the SmsSender shape.
class OtpService {
  constructor(senders) { this.senders = senders; }
  sendOtp(phone, otp) {
    const text = "Your OTP is " + otp + ". Valid for 5 minutes.";
    for (const s of this.senders) {
      if (s.send(phone, text)) {
        console.log("  delivered via " + s.name);
        return true;
      }
      console.log("  " + s.name + " failed, trying next provider");
    }
    return false;
  }
}

const otp = new OtpService([
  new FastSmsAdapter(new FastSmsClient(true), "SWIGGY"), // primary is down today
  new CloudTextAdapter(new CloudTextApi()),
]);
console.log("Sending OTP to +91-98450-11111");
const ok = otp.sendOtp("+91-98450-11111", "4821");
console.log("Result: " + ok);
`,
      go: String.raw`package main

import (
	"fmt"
	"strings"
	"unicode"
)

// Target: the interface our code wants.
type SmsSender interface {
	Name() string
	Send(phone, text string) bool
}

// ---- Adaptee 1: vendor SDK we cannot change ----
type SmsPayload struct{ Msisdn, SenderID, Body string }

type FastSmsClient struct{ Down bool }

func (c *FastSmsClient) Dispatch(p SmsPayload) int {
	status := 202
	if c.Down {
		status = 503
	}
	fmt.Printf("  [FastSms] dispatch msisdn=%s sender=%s -> HTTP %d\n", p.Msisdn, p.SenderID, status)
	return status
}

// ---- Adaptee 2: another vendor, different shape ----
type CloudTextResult struct{ Accepted bool }

type CloudTextAPI struct{}

func (CloudTextAPI) SendMessage(toE164, message string) CloudTextResult {
	fmt.Printf("  [CloudText] sendMessage to=%s -> accepted\n", toE164)
	return CloudTextResult{Accepted: true}
}

func digits(s string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsDigit(r) {
			return r
		}
		return -1
	}, s)
}

// ---- Adapters ----
type FastSmsAdapter struct {
	client   *FastSmsClient
	senderID string
}

func (a FastSmsAdapter) Name() string { return "FastSms" }
func (a FastSmsAdapter) Send(phone, text string) bool {
	return a.client.Dispatch(SmsPayload{Msisdn: digits(phone), SenderID: a.senderID, Body: text}) == 202
}

type CloudTextAdapter struct{ api CloudTextAPI }

func (a CloudTextAdapter) Name() string { return "CloudText" }
func (a CloudTextAdapter) Send(phone, text string) bool {
	return a.api.SendMessage("+"+digits(phone), text).Accepted
}

// Client: knows only SmsSender.
type OtpService struct{ senders []SmsSender }

func (o OtpService) SendOtp(phone, otp string) bool {
	text := "Your OTP is " + otp + ". Valid for 5 minutes."
	for _, s := range o.senders {
		if s.Send(phone, text) {
			fmt.Println("  delivered via", s.Name())
			return true
		}
		fmt.Println(" ", s.Name(), "failed, trying next provider")
	}
	return false
}

func main() {
	otp := OtpService{senders: []SmsSender{
		FastSmsAdapter{client: &FastSmsClient{Down: true}, senderID: "SWIGGY"}, // primary is down today
		CloudTextAdapter{},
	}}
	fmt.Println("Sending OTP to +91-98450-11111")
	ok := otp.SendOtp("+91-98450-11111", "4821")
	fmt.Println("Result:", ok)
}
`,
    },
    decorator: {
      title: "Decorator: logging, caching and retry around a price service",
      java: String.raw`import java.util.HashMap;
import java.util.Map;

public class Main {

    interface PriceService {
        int getPrice(String sku);
    }

    // The real component. Times out on its first two calls to show retries.
    static final class CatalogPriceService implements PriceService {
        int calls = 0;

        public int getPrice(String sku) {
            calls++;
            if (calls <= 2) {
                System.out.println("      [catalog] " + sku + " -> timeout");
                throw new RuntimeException("timeout");
            }
            System.out.println("      [catalog] " + sku + " -> 79999");
            return 79999;
        }
    }

    static final class LoggingPriceService implements PriceService {
        private final PriceService inner;
        LoggingPriceService(PriceService inner) { this.inner = inner; }

        public int getPrice(String sku) {
            System.out.println("[log] getPrice(" + sku + ")");
            int price = inner.getPrice(sku);
            System.out.println("[log] getPrice(" + sku + ") = " + price);
            return price;
        }
    }

    static final class CachingPriceService implements PriceService {
        private final PriceService inner;
        private final Map<String, Integer> cache = new HashMap<>();
        CachingPriceService(PriceService inner) { this.inner = inner; }

        public int getPrice(String sku) {
            Integer hit = cache.get(sku);
            if (hit != null) {
                System.out.println("  [cache] hit " + sku);
                return hit;
            }
            System.out.println("  [cache] miss " + sku);
            int price = inner.getPrice(sku);
            cache.put(sku, price);
            return price;
        }
    }

    static final class RetryingPriceService implements PriceService {
        private final PriceService inner;
        private final int maxAttempts;
        RetryingPriceService(PriceService inner, int maxAttempts) {
            this.inner = inner;
            this.maxAttempts = maxAttempts;
        }

        public int getPrice(String sku) {
            for (int attempt = 1; ; attempt++) {
                try {
                    return inner.getPrice(sku);
                } catch (RuntimeException e) {
                    if (attempt >= maxAttempts) throw e;
                    System.out.println("    [retry] attempt " + attempt + " failed (" + e.getMessage() + "), retrying");
                }
            }
        }
    }

    public static void main(String[] args) {
        CatalogPriceService catalog = new CatalogPriceService();
        // Compose at startup. Order: log -> cache -> retry -> real service.
        PriceService prices = new LoggingPriceService(
            new CachingPriceService(
                new RetryingPriceService(catalog, 3)));

        System.out.println("Call 1:");
        prices.getPrice("SKU-PHONE-15");
        System.out.println("Call 2:");
        prices.getPrice("SKU-PHONE-15");
        System.out.println("Catalog calls: " + catalog.calls);
    }
}
`,
      python: String.raw`from abc import ABC, abstractmethod


class PriceService(ABC):
    @abstractmethod
    def get_price(self, sku: str) -> int: ...


class CatalogPriceService(PriceService):
    """The real component. Times out on its first two calls to show retries."""

    def __init__(self):
        self.calls = 0

    def get_price(self, sku):
        self.calls += 1
        if self.calls <= 2:
            print(f"      [catalog] {sku} -> timeout")
            raise TimeoutError("timeout")
        print(f"      [catalog] {sku} -> 79999")
        return 79999


class LoggingPriceService(PriceService):
    def __init__(self, inner: PriceService):
        self._inner = inner

    def get_price(self, sku):
        print(f"[log] getPrice({sku})")
        price = self._inner.get_price(sku)
        print(f"[log] getPrice({sku}) = {price}")
        return price


class CachingPriceService(PriceService):
    def __init__(self, inner: PriceService):
        self._inner = inner
        self._cache = {}

    def get_price(self, sku):
        if sku in self._cache:
            print(f"  [cache] hit {sku}")
            return self._cache[sku]
        print(f"  [cache] miss {sku}")
        price = self._inner.get_price(sku)
        self._cache[sku] = price
        return price


class RetryingPriceService(PriceService):
    def __init__(self, inner: PriceService, max_attempts: int):
        self._inner = inner
        self._max = max_attempts

    def get_price(self, sku):
        attempt = 1
        while True:
            try:
                return self._inner.get_price(sku)
            except TimeoutError as e:
                if attempt >= self._max:
                    raise
                print(f"    [retry] attempt {attempt} failed ({e}), retrying")
                attempt += 1


if __name__ == "__main__":
    catalog = CatalogPriceService()
    # Compose at startup. Order: log -> cache -> retry -> real service.
    prices = LoggingPriceService(CachingPriceService(RetryingPriceService(catalog, 3)))

    print("Call 1:")
    prices.get_price("SKU-PHONE-15")
    print("Call 2:")
    prices.get_price("SKU-PHONE-15")
    print(f"Catalog calls: {catalog.calls}")
`,
      cpp: String.raw`#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <utility>

class PriceService {
public:
    virtual ~PriceService() = default;
    virtual int getPrice(const std::string& sku) = 0;
};

// The real component. Times out on its first two calls to show retries.
class CatalogPriceService : public PriceService {
public:
    int calls = 0;
    int getPrice(const std::string& sku) override {
        calls++;
        if (calls <= 2) {
            std::cout << "      [catalog] " << sku << " -> timeout\n";
            throw std::runtime_error("timeout");
        }
        std::cout << "      [catalog] " << sku << " -> 79999\n";
        return 79999;
    }
};

// Each decorator owns the component it wraps (unique_ptr), except the
// innermost one we keep a raw pointer to for the demo's call counter.
class LoggingPriceService : public PriceService {
public:
    explicit LoggingPriceService(std::unique_ptr<PriceService> inner) : inner_(std::move(inner)) {}
    int getPrice(const std::string& sku) override {
        std::cout << "[log] getPrice(" << sku << ")\n";
        int price = inner_->getPrice(sku);
        std::cout << "[log] getPrice(" << sku << ") = " << price << "\n";
        return price;
    }
private:
    std::unique_ptr<PriceService> inner_;
};

class CachingPriceService : public PriceService {
public:
    explicit CachingPriceService(std::unique_ptr<PriceService> inner) : inner_(std::move(inner)) {}
    int getPrice(const std::string& sku) override {
        auto it = cache_.find(sku);
        if (it != cache_.end()) {
            std::cout << "  [cache] hit " << sku << "\n";
            return it->second;
        }
        std::cout << "  [cache] miss " << sku << "\n";
        int price = inner_->getPrice(sku);
        cache_[sku] = price;
        return price;
    }
private:
    std::unique_ptr<PriceService> inner_;
    std::unordered_map<std::string, int> cache_;
};

class RetryingPriceService : public PriceService {
public:
    RetryingPriceService(std::unique_ptr<PriceService> inner, int maxAttempts)
        : inner_(std::move(inner)), maxAttempts_(maxAttempts) {}
    int getPrice(const std::string& sku) override {
        for (int attempt = 1;; attempt++) {
            try {
                return inner_->getPrice(sku);
            } catch (const std::runtime_error& e) {
                if (attempt >= maxAttempts_) throw;
                std::cout << "    [retry] attempt " << attempt << " failed (" << e.what() << "), retrying\n";
            }
        }
    }
private:
    std::unique_ptr<PriceService> inner_;
    int maxAttempts_;
};

int main() {
    auto catalogOwned = std::make_unique<CatalogPriceService>();
    CatalogPriceService* catalog = catalogOwned.get();

    // Compose at startup. Order: log -> cache -> retry -> real service.
    std::unique_ptr<PriceService> prices = std::make_unique<LoggingPriceService>(
        std::make_unique<CachingPriceService>(
            std::make_unique<RetryingPriceService>(std::move(catalogOwned), 3)));

    std::cout << "Call 1:\n";
    prices->getPrice("SKU-PHONE-15");
    std::cout << "Call 2:\n";
    prices->getPrice("SKU-PHONE-15");
    std::cout << "Catalog calls: " << catalog->calls << "\n";
    return 0;
}
`,
      javascript: String.raw`// Any object with getPrice(sku) is a PriceService.

class CatalogPriceService {
  constructor() { this.calls = 0; }
  getPrice(sku) {
    this.calls++;
    if (this.calls <= 2) {
      console.log("      [catalog] " + sku + " -> timeout");
      throw new Error("timeout");
    }
    console.log("      [catalog] " + sku + " -> 79999");
    return 79999;
  }
}

class LoggingPriceService {
  constructor(inner) { this.inner = inner; }
  getPrice(sku) {
    console.log("[log] getPrice(" + sku + ")");
    const price = this.inner.getPrice(sku);
    console.log("[log] getPrice(" + sku + ") = " + price);
    return price;
  }
}

class CachingPriceService {
  constructor(inner) {
    this.inner = inner;
    this.cache = new Map();
  }
  getPrice(sku) {
    if (this.cache.has(sku)) {
      console.log("  [cache] hit " + sku);
      return this.cache.get(sku);
    }
    console.log("  [cache] miss " + sku);
    const price = this.inner.getPrice(sku);
    this.cache.set(sku, price);
    return price;
  }
}

class RetryingPriceService {
  constructor(inner, maxAttempts) {
    this.inner = inner;
    this.maxAttempts = maxAttempts;
  }
  getPrice(sku) {
    for (let attempt = 1; ; attempt++) {
      try {
        return this.inner.getPrice(sku);
      } catch (e) {
        if (attempt >= this.maxAttempts) throw e;
        console.log("    [retry] attempt " + attempt + " failed (" + e.message + "), retrying");
      }
    }
  }
}

const catalog = new CatalogPriceService();
// Compose at startup. Order: log -> cache -> retry -> real service.
const prices = new LoggingPriceService(new CachingPriceService(new RetryingPriceService(catalog, 3)));

console.log("Call 1:");
prices.getPrice("SKU-PHONE-15");
console.log("Call 2:");
prices.getPrice("SKU-PHONE-15");
console.log("Catalog calls: " + catalog.calls);
`,
      go: String.raw`package main

import (
	"errors"
	"fmt"
)

type PriceService interface {
	GetPrice(sku string) (int, error)
}

// The real component. Times out on its first two calls to show retries.
type CatalogPriceService struct{ Calls int }

func (c *CatalogPriceService) GetPrice(sku string) (int, error) {
	c.Calls++
	if c.Calls <= 2 {
		fmt.Printf("      [catalog] %s -> timeout\n", sku)
		return 0, errors.New("timeout")
	}
	fmt.Printf("      [catalog] %s -> 79999\n", sku)
	return 79999, nil
}

// Each decorator embeds nothing; it holds the next PriceService explicitly.
type LoggingPriceService struct{ inner PriceService }

func (l LoggingPriceService) GetPrice(sku string) (int, error) {
	fmt.Printf("[log] getPrice(%s)\n", sku)
	price, err := l.inner.GetPrice(sku)
	if err != nil {
		fmt.Printf("[log] getPrice(%s) failed: %v\n", sku, err)
		return 0, err
	}
	fmt.Printf("[log] getPrice(%s) = %d\n", sku, price)
	return price, nil
}

type CachingPriceService struct {
	inner PriceService
	cache map[string]int
}

func NewCaching(inner PriceService) *CachingPriceService {
	return &CachingPriceService{inner: inner, cache: map[string]int{}}
}

func (c *CachingPriceService) GetPrice(sku string) (int, error) {
	if p, ok := c.cache[sku]; ok {
		fmt.Printf("  [cache] hit %s\n", sku)
		return p, nil
	}
	fmt.Printf("  [cache] miss %s\n", sku)
	p, err := c.inner.GetPrice(sku)
	if err != nil {
		return 0, err
	}
	c.cache[sku] = p
	return p, nil
}

type RetryingPriceService struct {
	inner       PriceService
	maxAttempts int
}

func (r RetryingPriceService) GetPrice(sku string) (int, error) {
	for attempt := 1; ; attempt++ {
		p, err := r.inner.GetPrice(sku)
		if err == nil {
			return p, nil
		}
		if attempt >= r.maxAttempts {
			return 0, err
		}
		fmt.Printf("    [retry] attempt %d failed (%v), retrying\n", attempt, err)
	}
}

func main() {
	catalog := &CatalogPriceService{}
	// Compose at startup. Order: log -> cache -> retry -> real service.
	var prices PriceService = LoggingPriceService{
		inner: NewCaching(RetryingPriceService{inner: catalog, maxAttempts: 3}),
	}

	fmt.Println("Call 1:")
	prices.GetPrice("SKU-PHONE-15")
	fmt.Println("Call 2:")
	prices.GetPrice("SKU-PHONE-15")
	fmt.Println("Catalog calls:", catalog.Calls)
}
`,
    },
    facade: {
      title: "Facade: one checkout call over cart, inventory, payment and notifications",
      java: String.raw`import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class Main {

    record CartItem(String sku, int qty, int price) {}

    // ---- Subsystems: each focused, unaware of the facade ----
    static final class CartService {
        private final Map<String, List<CartItem>> carts = new HashMap<>();
        void add(String user, CartItem item) { carts.computeIfAbsent(user, u -> new ArrayList<>()).add(item); }
        List<CartItem> items(String user) { return carts.getOrDefault(user, List.of()); }
        void clear(String user) {
            carts.remove(user);
            System.out.println("  [cart] cleared for " + user);
        }
    }

    static final class InventoryService {
        private final Map<String, Integer> stock = new LinkedHashMap<>();
        void put(String sku, int qty) { stock.put(sku, qty); }
        boolean reserve(String sku, int qty) {
            int have = stock.getOrDefault(sku, 0);
            if (have < qty) {
                System.out.println("  [inventory] only " + have + " x " + sku + " left, wanted " + qty);
                return false;
            }
            stock.put(sku, have - qty);
            System.out.println("  [inventory] reserved " + qty + " x " + sku);
            return true;
        }
        void release(String sku, int qty) {
            stock.merge(sku, qty, Integer::sum);
            System.out.println("  [inventory] released " + qty + " x " + sku);
        }
        Map<String, Integer> snapshot() { return stock; }
    }

    static final class PaymentService {
        private final String failingMethod; // demo: this method always declines
        PaymentService(String failingMethod) { this.failingMethod = failingMethod; }
        boolean charge(String user, int amount, String method) {
            boolean ok = !method.equals(failingMethod);
            System.out.println("  [payment] " + (ok ? "charged" : "declined") + " Rs." + amount + " via " + method);
            return ok;
        }
    }

    static final class NotificationService {
        void notify(String user, String msg) { System.out.println("  [notify] " + user + ": " + msg); }
    }

    // ---- Facade: one method, owns the ordering and the rollback ----
    static final class CheckoutFacade {
        private final CartService cart;
        private final InventoryService inventory;
        private final PaymentService payments;
        private final NotificationService notifier;
        private int nextOrder = 1;

        CheckoutFacade(CartService c, InventoryService i, PaymentService p, NotificationService n) {
            cart = c; inventory = i; payments = p; notifier = n;
        }

        String placeOrder(String user, String method) {
            List<CartItem> items = cart.items(user);
            if (items.isEmpty()) return "FAILED (cart empty)";

            List<CartItem> reserved = new ArrayList<>();
            for (CartItem it : items) {
                if (!inventory.reserve(it.sku(), it.qty())) {
                    releaseAll(reserved);
                    return "FAILED (out of stock: " + it.sku() + ")";
                }
                reserved.add(it);
            }

            int total = items.stream().mapToInt(it -> it.qty() * it.price()).sum();
            if (!payments.charge(user, total, method)) {
                releaseAll(reserved);
                return "FAILED (payment declined)";
            }

            cart.clear(user);
            String orderId = "ORD-" + nextOrder++;
            notifier.notify(user, "Order " + orderId + " placed. Paid Rs." + total + ".");
            return orderId;
        }

        private void releaseAll(List<CartItem> reserved) {
            for (CartItem it : reserved) inventory.release(it.sku(), it.qty());
        }
    }

    public static void main(String[] args) {
        CartService cart = new CartService();
        InventoryService inventory = new InventoryService();
        inventory.put("ATTA-5KG", 10);
        inventory.put("GHEE-1L", 5);

        cart.add("u1", new CartItem("ATTA-5KG", 1, 289));
        cart.add("u1", new CartItem("GHEE-1L", 2, 650));
        cart.add("u2", new CartItem("GHEE-1L", 1, 650));
        cart.add("u3", new CartItem("ATTA-5KG", 2, 289));
        cart.add("u3", new CartItem("GHEE-1L", 5, 650));

        CheckoutFacade checkout = new CheckoutFacade(cart, inventory, new PaymentService("card"), new NotificationService());

        String[][] runs = {{"u1", "upi"}, {"u2", "card"}, {"u3", "upi"}};
        for (String[] r : runs) {
            System.out.println("== " + r[0] + " checks out with " + r[1] + " ==");
            System.out.println("Result: " + checkout.placeOrder(r[0], r[1]));
        }
        StringBuilder sb = new StringBuilder("Stock now:");
        inventory.snapshot().forEach((k, v) -> sb.append(' ').append(k).append('=').append(v));
        System.out.println(sb);
    }
}
`,
      python: String.raw`from dataclasses import dataclass


@dataclass(frozen=True)
class CartItem:
    sku: str
    qty: int
    price: int


# ---- Subsystems ----
class CartService:
    def __init__(self):
        self._carts = {}

    def add(self, user, item):
        self._carts.setdefault(user, []).append(item)

    def items(self, user):
        return list(self._carts.get(user, []))

    def clear(self, user):
        self._carts.pop(user, None)
        print(f"  [cart] cleared for {user}")


class InventoryService:
    def __init__(self, stock):
        self.stock = dict(stock)

    def reserve(self, sku, qty):
        have = self.stock.get(sku, 0)
        if have < qty:
            print(f"  [inventory] only {have} x {sku} left, wanted {qty}")
            return False
        self.stock[sku] = have - qty
        print(f"  [inventory] reserved {qty} x {sku}")
        return True

    def release(self, sku, qty):
        self.stock[sku] = self.stock.get(sku, 0) + qty
        print(f"  [inventory] released {qty} x {sku}")


class PaymentService:
    def __init__(self, failing_method):
        self._failing = failing_method  # demo: this method always declines

    def charge(self, user, amount, method):
        ok = method != self._failing
        print(f"  [payment] {'charged' if ok else 'declined'} Rs.{amount} via {method}")
        return ok


class NotificationService:
    def notify(self, user, msg):
        print(f"  [notify] {user}: {msg}")


# ---- Facade ----
class CheckoutFacade:
    def __init__(self, cart, inventory, payments, notifier):
        self._cart = cart
        self._inventory = inventory
        self._payments = payments
        self._notifier = notifier
        self._next_order = 1

    def place_order(self, user, method):
        items = self._cart.items(user)
        if not items:
            return "FAILED (cart empty)"

        reserved = []
        for it in items:
            if not self._inventory.reserve(it.sku, it.qty):
                self._release_all(reserved)
                return f"FAILED (out of stock: {it.sku})"
            reserved.append(it)

        total = sum(it.qty * it.price for it in items)
        if not self._payments.charge(user, total, method):
            self._release_all(reserved)
            return "FAILED (payment declined)"

        self._cart.clear(user)
        order_id = f"ORD-{self._next_order}"
        self._next_order += 1
        self._notifier.notify(user, f"Order {order_id} placed. Paid Rs.{total}.")
        return order_id

    def _release_all(self, reserved):
        for it in reserved:
            self._inventory.release(it.sku, it.qty)


if __name__ == "__main__":
    cart = CartService()
    inventory = InventoryService({"ATTA-5KG": 10, "GHEE-1L": 5})
    cart.add("u1", CartItem("ATTA-5KG", 1, 289))
    cart.add("u1", CartItem("GHEE-1L", 2, 650))
    cart.add("u2", CartItem("GHEE-1L", 1, 650))
    cart.add("u3", CartItem("ATTA-5KG", 2, 289))
    cart.add("u3", CartItem("GHEE-1L", 5, 650))

    checkout = CheckoutFacade(cart, inventory, PaymentService("card"), NotificationService())
    for user, method in [("u1", "upi"), ("u2", "card"), ("u3", "upi")]:
        print(f"== {user} checks out with {method} ==")
        print(f"Result: {checkout.place_order(user, method)}")
    print("Stock now: " + " ".join(f"{k}={v}" for k, v in inventory.stock.items()))
`,
      cpp: String.raw`#include <iostream>
#include <map>
#include <memory>
#include <string>
#include <utility>
#include <vector>

struct CartItem {
    std::string sku;
    int qty;
    int price;
};

// ---- Subsystems ----
class CartService {
public:
    void add(const std::string& user, CartItem item) { carts_[user].push_back(std::move(item)); }
    std::vector<CartItem> items(const std::string& user) const {
        auto it = carts_.find(user);
        return it == carts_.end() ? std::vector<CartItem>{} : it->second;
    }
    void clear(const std::string& user) {
        carts_.erase(user);
        std::cout << "  [cart] cleared for " << user << "\n";
    }
private:
    std::map<std::string, std::vector<CartItem>> carts_;
};

class InventoryService {
public:
    void put(const std::string& sku, int qty) { stock_[sku] = qty; }
    bool reserve(const std::string& sku, int qty) {
        int have = stock_[sku];
        if (have < qty) {
            std::cout << "  [inventory] only " << have << " x " << sku << " left, wanted " << qty << "\n";
            return false;
        }
        stock_[sku] = have - qty;
        std::cout << "  [inventory] reserved " << qty << " x " << sku << "\n";
        return true;
    }
    void release(const std::string& sku, int qty) {
        stock_[sku] += qty;
        std::cout << "  [inventory] released " << qty << " x " << sku << "\n";
    }
    const std::map<std::string, int>& snapshot() const { return stock_; }
private:
    std::map<std::string, int> stock_;
};

class PaymentService {
public:
    explicit PaymentService(std::string failingMethod) : failing_(std::move(failingMethod)) {}
    bool charge(const std::string&, int amount, const std::string& method) {
        bool ok = method != failing_;
        std::cout << "  [payment] " << (ok ? "charged" : "declined") << " Rs." << amount << " via " << method << "\n";
        return ok;
    }
private:
    std::string failing_; // demo: this method always declines
};

class NotificationService {
public:
    void notify(const std::string& user, const std::string& msg) {
        std::cout << "  [notify] " << user << ": " << msg << "\n";
    }
};

// ---- Facade: shares the subsystems (they may be used elsewhere too) ----
class CheckoutFacade {
public:
    CheckoutFacade(std::shared_ptr<CartService> c, std::shared_ptr<InventoryService> i,
                   std::shared_ptr<PaymentService> p, std::shared_ptr<NotificationService> n)
        : cart_(std::move(c)), inventory_(std::move(i)), payments_(std::move(p)), notifier_(std::move(n)) {}

    std::string placeOrder(const std::string& user, const std::string& method) {
        auto items = cart_->items(user);
        if (items.empty()) return "FAILED (cart empty)";

        std::vector<CartItem> reserved;
        for (const auto& it : items) {
            if (!inventory_->reserve(it.sku, it.qty)) {
                releaseAll(reserved);
                return "FAILED (out of stock: " + it.sku + ")";
            }
            reserved.push_back(it);
        }

        int total = 0;
        for (const auto& it : items) total += it.qty * it.price;
        if (!payments_->charge(user, total, method)) {
            releaseAll(reserved);
            return "FAILED (payment declined)";
        }

        cart_->clear(user);
        std::string orderId = "ORD-" + std::to_string(nextOrder_++);
        notifier_->notify(user, "Order " + orderId + " placed. Paid Rs." + std::to_string(total) + ".");
        return orderId;
    }

private:
    void releaseAll(const std::vector<CartItem>& reserved) {
        for (const auto& it : reserved) inventory_->release(it.sku, it.qty);
    }
    std::shared_ptr<CartService> cart_;
    std::shared_ptr<InventoryService> inventory_;
    std::shared_ptr<PaymentService> payments_;
    std::shared_ptr<NotificationService> notifier_;
    int nextOrder_ = 1;
};

int main() {
    auto cart = std::make_shared<CartService>();
    auto inventory = std::make_shared<InventoryService>();
    inventory->put("ATTA-5KG", 10);
    inventory->put("GHEE-1L", 5);

    cart->add("u1", {"ATTA-5KG", 1, 289});
    cart->add("u1", {"GHEE-1L", 2, 650});
    cart->add("u2", {"GHEE-1L", 1, 650});
    cart->add("u3", {"ATTA-5KG", 2, 289});
    cart->add("u3", {"GHEE-1L", 5, 650});

    CheckoutFacade checkout(cart, inventory, std::make_shared<PaymentService>("card"),
                            std::make_shared<NotificationService>());

    std::vector<std::pair<std::string, std::string>> runs = {{"u1", "upi"}, {"u2", "card"}, {"u3", "upi"}};
    for (const auto& [user, method] : runs) {
        std::cout << "== " << user << " checks out with " << method << " ==\n";
        std::string result = checkout.placeOrder(user, method); // evaluate before printing "Result: "
        std::cout << "Result: " << result << "\n";
    }
    std::cout << "Stock now:";
    for (const auto& [sku, qty] : inventory->snapshot()) std::cout << " " << sku << "=" << qty;
    std::cout << "\n";
    return 0;
}
`,
      javascript: String.raw`// ---- Subsystems ----
class CartService {
  #carts = new Map();
  add(user, item) {
    if (!this.#carts.has(user)) this.#carts.set(user, []);
    this.#carts.get(user).push(item);
  }
  items(user) { return [...(this.#carts.get(user) || [])]; }
  clear(user) {
    this.#carts.delete(user);
    console.log("  [cart] cleared for " + user);
  }
}

class InventoryService {
  constructor(stock) { this.stock = new Map(Object.entries(stock)); }
  reserve(sku, qty) {
    const have = this.stock.get(sku) || 0;
    if (have < qty) {
      console.log("  [inventory] only " + have + " x " + sku + " left, wanted " + qty);
      return false;
    }
    this.stock.set(sku, have - qty);
    console.log("  [inventory] reserved " + qty + " x " + sku);
    return true;
  }
  release(sku, qty) {
    this.stock.set(sku, (this.stock.get(sku) || 0) + qty);
    console.log("  [inventory] released " + qty + " x " + sku);
  }
}

class PaymentService {
  constructor(failingMethod) { this.failing = failingMethod; } // demo: always declines
  charge(user, amount, method) {
    const ok = method !== this.failing;
    console.log("  [payment] " + (ok ? "charged" : "declined") + " Rs." + amount + " via " + method);
    return ok;
  }
}

class NotificationService {
  notify(user, msg) { console.log("  [notify] " + user + ": " + msg); }
}

// ---- Facade ----
class CheckoutFacade {
  #nextOrder = 1;
  constructor(cart, inventory, payments, notifier) {
    Object.assign(this, { cart, inventory, payments, notifier });
  }

  placeOrder(user, method) {
    const items = this.cart.items(user);
    if (items.length === 0) return "FAILED (cart empty)";

    const reserved = [];
    for (const it of items) {
      if (!this.inventory.reserve(it.sku, it.qty)) {
        this.#releaseAll(reserved);
        return "FAILED (out of stock: " + it.sku + ")";
      }
      reserved.push(it);
    }

    const total = items.reduce((sum, it) => sum + it.qty * it.price, 0);
    if (!this.payments.charge(user, total, method)) {
      this.#releaseAll(reserved);
      return "FAILED (payment declined)";
    }

    this.cart.clear(user);
    const orderId = "ORD-" + this.#nextOrder++;
    this.notifier.notify(user, "Order " + orderId + " placed. Paid Rs." + total + ".");
    return orderId;
  }

  #releaseAll(reserved) {
    for (const it of reserved) this.inventory.release(it.sku, it.qty);
  }
}

const cart = new CartService();
const inventory = new InventoryService({ "ATTA-5KG": 10, "GHEE-1L": 5 });
cart.add("u1", { sku: "ATTA-5KG", qty: 1, price: 289 });
cart.add("u1", { sku: "GHEE-1L", qty: 2, price: 650 });
cart.add("u2", { sku: "GHEE-1L", qty: 1, price: 650 });
cart.add("u3", { sku: "ATTA-5KG", qty: 2, price: 289 });
cart.add("u3", { sku: "GHEE-1L", qty: 5, price: 650 });

const checkout = new CheckoutFacade(cart, inventory, new PaymentService("card"), new NotificationService());
for (const [user, method] of [["u1", "upi"], ["u2", "card"], ["u3", "upi"]]) {
  console.log("== " + user + " checks out with " + method + " ==");
  console.log("Result: " + checkout.placeOrder(user, method));
}
console.log("Stock now: " + [...inventory.stock].map(([k, v]) => k + "=" + v).join(" "));
`,
      go: String.raw`package main

import (
	"errors"
	"fmt"
)

type CartItem struct {
	SKU   string
	Qty   int
	Price int
}

// ---- Subsystems ----
type CartService struct{ carts map[string][]CartItem }

func (c *CartService) Add(user string, it CartItem) { c.carts[user] = append(c.carts[user], it) }
func (c *CartService) Items(user string) []CartItem  { return c.carts[user] }
func (c *CartService) Clear(user string) {
	delete(c.carts, user)
	fmt.Println("  [cart] cleared for", user)
}

type InventoryService struct{ stock map[string]int }

func (inv *InventoryService) Reserve(sku string, qty int) bool {
	have := inv.stock[sku]
	if have < qty {
		fmt.Printf("  [inventory] only %d x %s left, wanted %d\n", have, sku, qty)
		return false
	}
	inv.stock[sku] = have - qty
	fmt.Printf("  [inventory] reserved %d x %s\n", qty, sku)
	return true
}

func (inv *InventoryService) Release(sku string, qty int) {
	inv.stock[sku] += qty
	fmt.Printf("  [inventory] released %d x %s\n", qty, sku)
}

type PaymentService struct{ failingMethod string } // demo: this method always declines

func (p PaymentService) Charge(user string, amount int, method string) bool {
	ok := method != p.failingMethod
	verb := "charged"
	if !ok {
		verb = "declined"
	}
	fmt.Printf("  [payment] %s Rs.%d via %s\n", verb, amount, method)
	return ok
}

type NotificationService struct{}

func (NotificationService) Notify(user, msg string) { fmt.Printf("  [notify] %s: %s\n", user, msg) }

// ---- Facade ----
type CheckoutFacade struct {
	cart      *CartService
	inventory *InventoryService
	payments  PaymentService
	notifier  NotificationService
	nextOrder int
}

var ErrPaymentDeclined = errors.New("payment declined")

func (f *CheckoutFacade) PlaceOrder(user, method string) (string, error) {
	items := f.cart.Items(user)
	if len(items) == 0 {
		return "", errors.New("cart empty")
	}

	var reserved []CartItem
	for _, it := range items {
		if !f.inventory.Reserve(it.SKU, it.Qty) {
			f.releaseAll(reserved)
			return "", fmt.Errorf("out of stock: %s", it.SKU)
		}
		reserved = append(reserved, it)
	}

	total := 0
	for _, it := range items {
		total += it.Qty * it.Price
	}
	if !f.payments.Charge(user, total, method) {
		f.releaseAll(reserved)
		return "", ErrPaymentDeclined
	}

	f.cart.Clear(user)
	f.nextOrder++
	orderID := fmt.Sprintf("ORD-%d", f.nextOrder)
	f.notifier.Notify(user, fmt.Sprintf("Order %s placed. Paid Rs.%d.", orderID, total))
	return orderID, nil
}

func (f *CheckoutFacade) releaseAll(reserved []CartItem) {
	for _, it := range reserved {
		f.inventory.Release(it.SKU, it.Qty)
	}
}

func main() {
	cart := &CartService{carts: map[string][]CartItem{}}
	inventory := &InventoryService{stock: map[string]int{"ATTA-5KG": 10, "GHEE-1L": 5}}
	cart.Add("u1", CartItem{"ATTA-5KG", 1, 289})
	cart.Add("u1", CartItem{"GHEE-1L", 2, 650})
	cart.Add("u2", CartItem{"GHEE-1L", 1, 650})
	cart.Add("u3", CartItem{"ATTA-5KG", 2, 289})
	cart.Add("u3", CartItem{"GHEE-1L", 5, 650})

	checkout := &CheckoutFacade{cart: cart, inventory: inventory, payments: PaymentService{failingMethod: "card"}}
	for _, run := range [][2]string{{"u1", "upi"}, {"u2", "card"}, {"u3", "upi"}} {
		fmt.Printf("== %s checks out with %s ==\n", run[0], run[1])
		id, err := checkout.PlaceOrder(run[0], run[1])
		if err != nil {
			fmt.Printf("Result: FAILED (%v)\n", err)
			continue
		}
		fmt.Println("Result:", id)
	}
	// Map order is random in Go, so print in a fixed order.
	fmt.Printf("Stock now: ATTA-5KG=%d GHEE-1L=%d\n", inventory.stock["ATTA-5KG"], inventory.stock["GHEE-1L"])
}
`,
    },
    proxy: {
      title: "Proxy: lazy loading plus access control for a heavy report",
      java: String.raw`import java.util.Set;

public class Main {

    interface Report {
        String view(String role);
    }

    // Real subject: expensive to create.
    static final class SalesReport implements Report {
        static int loads = 0;
        private final String data;

        SalesReport() {
            loads++;
            System.out.println("  [real] loading 2 GB of sales data from the warehouse (slow)");
            data = "Q3 GMV Rs.1240 Cr, 18.2M orders";
        }

        public String view(String role) {
            return data;
        }
    }

    // Proxy: same interface. Protection (role check) + virtual (lazy creation).
    static final class ReportProxy implements Report {
        private static final Set<String> ALLOWED = Set.of("finance", "admin");
        private SalesReport real; // not created until someone allowed asks

        public synchronized String view(String role) { // synchronized: only one thread may load
            if (!ALLOWED.contains(role)) {
                return "ACCESS DENIED";
            }
            if (real == null) {
                real = new SalesReport();
            }
            return real.view(role);
        }
    }

    public static void main(String[] args) {
        Report report = new ReportProxy();
        System.out.println("Proxy created; report not loaded yet");
        for (String role : new String[] {"intern", "finance", "admin"}) {
            System.out.println(role + ": " + report.view(role));
        }
        System.out.println("Warehouse loads: " + SalesReport.loads);
    }
}
`,
      python: String.raw`import threading
from abc import ABC, abstractmethod


class Report(ABC):
    @abstractmethod
    def view(self, role: str) -> str: ...


class SalesReport(Report):
    """Real subject: expensive to create."""

    loads = 0

    def __init__(self):
        SalesReport.loads += 1
        print("  [real] loading 2 GB of sales data from the warehouse (slow)")
        self._data = "Q3 GMV Rs.1240 Cr, 18.2M orders"

    def view(self, role):
        return self._data


class ReportProxy(Report):
    """Same interface. Protection (role check) + virtual (lazy creation)."""

    ALLOWED = {"finance", "admin"}

    def __init__(self):
        self._real = None
        self._lock = threading.Lock()

    def view(self, role):
        if role not in self.ALLOWED:
            return "ACCESS DENIED"
        if self._real is None:
            with self._lock:  # only one thread may load
                if self._real is None:
                    self._real = SalesReport()
        return self._real.view(role)


if __name__ == "__main__":
    report = ReportProxy()
    print("Proxy created; report not loaded yet")
    for role in ("intern", "finance", "admin"):
        print(f"{role}: {report.view(role)}")
    print(f"Warehouse loads: {SalesReport.loads}")
`,
      cpp: String.raw`#include <iostream>
#include <memory>
#include <mutex>
#include <set>
#include <string>

class Report {
public:
    virtual ~Report() = default;
    virtual std::string view(const std::string& role) = 0;
};

// Real subject: expensive to create.
class SalesReport : public Report {
public:
    static inline int loads = 0;
    SalesReport() {
        loads++;
        std::cout << "  [real] loading 2 GB of sales data from the warehouse (slow)\n";
        data_ = "Q3 GMV Rs.1240 Cr, 18.2M orders";
    }
    std::string view(const std::string&) override { return data_; }
private:
    std::string data_;
};

// Proxy: same interface. Protection (role check) + virtual (lazy creation).
class ReportProxy : public Report {
public:
    std::string view(const std::string& role) override {
        if (!allowed_.count(role)) return "ACCESS DENIED";
        std::call_once(loaded_, [this] { real_ = std::make_unique<SalesReport>(); });
        return real_->view(role);
    }
private:
    const std::set<std::string> allowed_{"finance", "admin"};
    std::once_flag loaded_;               // thread-safe one-time creation
    std::unique_ptr<SalesReport> real_;   // empty until first allowed use
};

int main() {
    std::unique_ptr<Report> report = std::make_unique<ReportProxy>();
    std::cout << "Proxy created; report not loaded yet\n";
    for (std::string role : {"intern", "finance", "admin"}) {
        std::string shown = report->view(role); // may print a load message first
        std::cout << role << ": " << shown << "\n";
    }
    std::cout << "Warehouse loads: " << SalesReport::loads << "\n";
    return 0;
}
`,
      javascript: String.raw`// Real subject: expensive to create.
class SalesReport {
  static loads = 0;
  constructor() {
    SalesReport.loads++;
    console.log("  [real] loading 2 GB of sales data from the warehouse (slow)");
    this.data = "Q3 GMV Rs.1240 Cr, 18.2M orders";
  }
  view(role) {
    return this.data;
  }
}

// Proxy: same view(role) method. Protection (role check) + virtual (lazy creation).
// JS is single-threaded, so the lazy check needs no lock.
class ReportProxy {
  static #ALLOWED = new Set(["finance", "admin"]);
  #real = null;

  view(role) {
    if (!ReportProxy.#ALLOWED.has(role)) return "ACCESS DENIED";
    if (this.#real === null) this.#real = new SalesReport();
    return this.#real.view(role);
  }
}

const report = new ReportProxy();
console.log("Proxy created; report not loaded yet");
for (const role of ["intern", "finance", "admin"]) {
  console.log(role + ": " + report.view(role));
}
console.log("Warehouse loads: " + SalesReport.loads);
`,
      go: String.raw`package main

import (
	"fmt"
	"sync"
)

type Report interface {
	View(role string) string
}

var loads int

// Real subject: expensive to create.
type SalesReport struct{ data string }

func NewSalesReport() *SalesReport {
	loads++
	fmt.Println("  [real] loading 2 GB of sales data from the warehouse (slow)")
	return &SalesReport{data: "Q3 GMV Rs.1240 Cr, 18.2M orders"}
}

func (s *SalesReport) View(role string) string { return s.data }

// Proxy: same interface. Protection (role check) + virtual (lazy creation).
type ReportProxy struct {
	allowed map[string]bool
	once    sync.Once // thread-safe one-time creation
	real    *SalesReport
}

func NewReportProxy() *ReportProxy {
	return &ReportProxy{allowed: map[string]bool{"finance": true, "admin": true}}
}

func (p *ReportProxy) View(role string) string {
	if !p.allowed[role] {
		return "ACCESS DENIED"
	}
	p.once.Do(func() { p.real = NewSalesReport() })
	return p.real.View(role)
}

func main() {
	var report Report = NewReportProxy()
	fmt.Println("Proxy created; report not loaded yet")
	for _, role := range []string{"intern", "finance", "admin"} {
		fmt.Printf("%s: %s\n", role, report.View(role))
	}
	fmt.Println("Warehouse loads:", loads)
}
`,
    },
    composite: {
      title: "Composite: files and folders share one interface",
      java: String.raw`import java.util.ArrayList;
import java.util.List;

public class Main {

    // Component: what both leaves and groups can do.
    interface FsNode {
        String name();
        long size();      // in KB
        int fileCount();
        void print(String indent);
    }

    // Leaf
    static final class File implements FsNode {
        private final String name;
        private final long size;
        File(String name, long size) { this.name = name; this.size = size; }
        public String name() { return name; }
        public long size() { return size; }
        public int fileCount() { return 1; }
        public void print(String indent) {
            System.out.println(indent + name + " (" + size + " KB)");
        }
    }

    // Composite: holds children, delegates and combines.
    static final class Directory implements FsNode {
        private final String name;
        private final List<FsNode> children = new ArrayList<>();
        Directory(String name) { this.name = name; }

        Directory add(FsNode node) { children.add(node); return this; } // only on the composite

        public String name() { return name; }
        public long size() {
            long total = 0;
            for (FsNode c : children) total += c.size(); // file or folder, no instanceof
            return total;
        }
        public int fileCount() {
            int n = 0;
            for (FsNode c : children) n += c.fileCount();
            return n;
        }
        public void print(String indent) {
            System.out.println(indent + name + "/ (" + size() + " KB)");
            for (FsNode c : children) c.print(indent + "  ");
        }
    }

    public static void main(String[] args) {
        Directory docs = new Directory("docs")
            .add(new File("resume.pdf", 120))
            .add(new File("offer-letter.pdf", 80));
        Directory goa = new Directory("goa")
            .add(new File("beach.jpg", 2048))
            .add(new File("sunset.jpg", 3072));
        Directory photos = new Directory("photos")
            .add(goa)
            .add(new File("pan-card.jpg", 512));
        Directory home = new Directory("home")
            .add(docs)
            .add(photos)
            .add(new File("notes.txt", 4));

        home.print("");
        System.out.println("Total: " + home.size() + " KB in " + home.fileCount() + " files");
        System.out.println("photos alone: " + photos.size() + " KB"); // same call on a subtree
    }
}
`,
      python: String.raw`from abc import ABC, abstractmethod


class FsNode(ABC):
    """Component: what both leaves and groups can do."""

    def __init__(self, name):
        self.name = name

    @abstractmethod
    def size(self) -> int: ...  # in KB

    @abstractmethod
    def file_count(self) -> int: ...

    @abstractmethod
    def print_tree(self, indent: str = "") -> None: ...


class File(FsNode):
    def __init__(self, name, size_kb):
        super().__init__(name)
        self._size = size_kb

    def size(self):
        return self._size

    def file_count(self):
        return 1

    def print_tree(self, indent=""):
        print(f"{indent}{self.name} ({self._size} KB)")


class Directory(FsNode):
    def __init__(self, name):
        super().__init__(name)
        self._children = []

    def add(self, node):  # only on the composite
        self._children.append(node)
        return self

    def size(self):
        return sum(c.size() for c in self._children)  # file or folder, no isinstance

    def file_count(self):
        return sum(c.file_count() for c in self._children)

    def print_tree(self, indent=""):
        print(f"{indent}{self.name}/ ({self.size()} KB)")
        for c in self._children:
            c.print_tree(indent + "  ")


if __name__ == "__main__":
    docs = Directory("docs").add(File("resume.pdf", 120)).add(File("offer-letter.pdf", 80))
    goa = Directory("goa").add(File("beach.jpg", 2048)).add(File("sunset.jpg", 3072))
    photos = Directory("photos").add(goa).add(File("pan-card.jpg", 512))
    home = Directory("home").add(docs).add(photos).add(File("notes.txt", 4))

    home.print_tree()
    print(f"Total: {home.size()} KB in {home.file_count()} files")
    print(f"photos alone: {photos.size()} KB")
`,
      cpp: String.raw`#include <iostream>
#include <memory>
#include <string>
#include <utility>
#include <vector>

// Component: what both leaves and groups can do.
class FsNode {
public:
    explicit FsNode(std::string name) : name_(std::move(name)) {}
    virtual ~FsNode() = default;
    const std::string& name() const { return name_; }
    virtual long size() const = 0;      // in KB
    virtual int fileCount() const = 0;
    virtual void print(const std::string& indent) const = 0;
protected:
    std::string name_;
};

class File : public FsNode {
public:
    File(std::string name, long size) : FsNode(std::move(name)), size_(size) {}
    long size() const override { return size_; }
    int fileCount() const override { return 1; }
    void print(const std::string& indent) const override {
        std::cout << indent << name_ << " (" << size_ << " KB)\n";
    }
private:
    long size_;
};

// Composite: owns its children through shared_ptr so a subtree can also be
// referenced from outside (like "photos" below).
class Directory : public FsNode {
public:
    explicit Directory(std::string name) : FsNode(std::move(name)) {}
    Directory& add(std::shared_ptr<FsNode> node) { children_.push_back(std::move(node)); return *this; }

    long size() const override {
        long total = 0;
        for (const auto& c : children_) total += c->size(); // file or folder alike
        return total;
    }
    int fileCount() const override {
        int n = 0;
        for (const auto& c : children_) n += c->fileCount();
        return n;
    }
    void print(const std::string& indent) const override {
        std::cout << indent << name_ << "/ (" << size() << " KB)\n";
        for (const auto& c : children_) c->print(indent + "  ");
    }
private:
    std::vector<std::shared_ptr<FsNode>> children_;
};

int main() {
    auto docs = std::make_shared<Directory>("docs");
    docs->add(std::make_shared<File>("resume.pdf", 120)).add(std::make_shared<File>("offer-letter.pdf", 80));
    auto goa = std::make_shared<Directory>("goa");
    goa->add(std::make_shared<File>("beach.jpg", 2048)).add(std::make_shared<File>("sunset.jpg", 3072));
    auto photos = std::make_shared<Directory>("photos");
    photos->add(goa).add(std::make_shared<File>("pan-card.jpg", 512));
    auto home = std::make_shared<Directory>("home");
    home->add(docs).add(photos).add(std::make_shared<File>("notes.txt", 4));

    home->print("");
    std::cout << "Total: " << home->size() << " KB in " << home->fileCount() << " files\n";
    std::cout << "photos alone: " << photos->size() << " KB\n";
    return 0;
}
`,
      javascript: String.raw`// Both classes expose { name, size(), fileCount(), print(indent) }.

class File {
  constructor(name, size) {
    this.name = name;
    this.sizeKb = size;
  }
  size() { return this.sizeKb; }
  fileCount() { return 1; }
  print(indent = "") { console.log(indent + this.name + " (" + this.sizeKb + " KB)"); }
}

class Directory {
  constructor(name) {
    this.name = name;
    this.children = [];
  }
  add(node) { // only on the composite
    this.children.push(node);
    return this;
  }
  size() { return this.children.reduce((sum, c) => sum + c.size(), 0); }
  fileCount() { return this.children.reduce((n, c) => n + c.fileCount(), 0); }
  print(indent = "") {
    console.log(indent + this.name + "/ (" + this.size() + " KB)");
    for (const c of this.children) c.print(indent + "  ");
  }
}

const docs = new Directory("docs").add(new File("resume.pdf", 120)).add(new File("offer-letter.pdf", 80));
const goa = new Directory("goa").add(new File("beach.jpg", 2048)).add(new File("sunset.jpg", 3072));
const photos = new Directory("photos").add(goa).add(new File("pan-card.jpg", 512));
const home = new Directory("home").add(docs).add(photos).add(new File("notes.txt", 4));

home.print();
console.log("Total: " + home.size() + " KB in " + home.fileCount() + " files");
console.log("photos alone: " + photos.size() + " KB");
`,
      go: String.raw`package main

import "fmt"

// Component: what both leaves and groups can do.
type FsNode interface {
	Name() string
	Size() int64 // in KB
	FileCount() int
	Print(indent string)
}

type File struct {
	name string
	size int64
}

func (f *File) Name() string       { return f.name }
func (f *File) Size() int64        { return f.size }
func (f *File) FileCount() int     { return 1 }
func (f *File) Print(indent string) { fmt.Printf("%s%s (%d KB)\n", indent, f.name, f.size) }

type Directory struct {
	name     string
	children []FsNode
}

func NewDir(name string, children ...FsNode) *Directory {
	return &Directory{name: name, children: children}
}

func (d *Directory) Name() string { return d.name }

func (d *Directory) Size() int64 {
	var total int64
	for _, c := range d.children {
		total += c.Size() // file or folder, no type switch
	}
	return total
}

func (d *Directory) FileCount() int {
	n := 0
	for _, c := range d.children {
		n += c.FileCount()
	}
	return n
}

func (d *Directory) Print(indent string) {
	fmt.Printf("%s%s/ (%d KB)\n", indent, d.name, d.Size())
	for _, c := range d.children {
		c.Print(indent + "  ")
	}
}

func main() {
	docs := NewDir("docs", &File{"resume.pdf", 120}, &File{"offer-letter.pdf", 80})
	goa := NewDir("goa", &File{"beach.jpg", 2048}, &File{"sunset.jpg", 3072})
	photos := NewDir("photos", goa, &File{"pan-card.jpg", 512})
	home := NewDir("home", docs, photos, &File{"notes.txt", 4})

	home.Print("")
	fmt.Printf("Total: %d KB in %d files\n", home.Size(), home.FileCount())
	fmt.Printf("photos alone: %d KB\n", photos.Size())
}
`,
    },
  },
  diagrams: {
    adapter: String.raw`classDiagram
  class SmsSender {
    <<interface>>
    +name() String
    +send(phone, text) bool
  }
  class OtpService {
    -senders List
    +sendOtp(phone, otp) bool
  }
  class FastSmsAdapter {
    -client FastSmsClient
    +send(phone, text) bool
  }
  class CloudTextAdapter {
    -api CloudTextApi
    +send(phone, text) bool
  }
  class FastSmsClient {
    +dispatch(payload) int
  }
  class CloudTextApi {
    +sendMessage(toE164, message) Result
  }
  OtpService --> SmsSender
  SmsSender <|.. FastSmsAdapter
  SmsSender <|.. CloudTextAdapter
  FastSmsAdapter --> FastSmsClient : wraps
  CloudTextAdapter --> CloudTextApi : wraps`,
    decorator: String.raw`classDiagram
  class PriceService {
    <<interface>>
    +getPrice(sku) int
  }
  class CatalogPriceService {
    +getPrice(sku) int
  }
  class LoggingPriceService {
    -inner PriceService
  }
  class CachingPriceService {
    -inner PriceService
    -cache Map
  }
  class RetryingPriceService {
    -inner PriceService
    -maxAttempts int
  }
  PriceService <|.. CatalogPriceService
  PriceService <|.. LoggingPriceService
  PriceService <|.. CachingPriceService
  PriceService <|.. RetryingPriceService
  LoggingPriceService o-- PriceService : wraps
  CachingPriceService o-- PriceService : wraps
  RetryingPriceService o-- PriceService : wraps`,
    facade: String.raw`classDiagram
  class CheckoutFacade {
    +placeOrder(user, method) String
  }
  class CartService {
    +items(user) List
    +clear(user)
  }
  class InventoryService {
    +reserve(sku, qty) bool
    +release(sku, qty)
  }
  class PaymentService {
    +charge(user, amount, method) bool
  }
  class NotificationService {
    +notify(user, msg)
  }
  class MobileApi
  class WebApi
  MobileApi --> CheckoutFacade
  WebApi --> CheckoutFacade
  CheckoutFacade --> CartService
  CheckoutFacade --> InventoryService
  CheckoutFacade --> PaymentService
  CheckoutFacade --> NotificationService`,
    proxy: String.raw`classDiagram
  class Report {
    <<interface>>
    +view(role) String
  }
  class SalesReport {
    -data String
    +SalesReport()
    +view(role) String
  }
  class ReportProxy {
    -allowed Set
    -real SalesReport
    +view(role) String
  }
  class Client
  Client --> Report
  Report <|.. SalesReport
  Report <|.. ReportProxy
  ReportProxy --> SalesReport : creates lazily`,
    composite: String.raw`classDiagram
  class FsNode {
    <<interface>>
    +name() String
    +size() long
    +fileCount() int
    +print(indent)
  }
  class File {
    -size long
  }
  class Directory {
    -children List
    +add(node) Directory
  }
  FsNode <|.. File
  FsNode <|.. Directory
  Directory o-- FsNode : children`,
  },
});
