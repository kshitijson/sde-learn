SD.register({
  id: "uml",
  html: String.raw`
<p class="lead">UML (Unified Modeling Language) is a shared picture language for software design. In an LLD round you will not draw all 14 UML diagram types. You need three: the <strong>class diagram</strong> (what classes exist and how they are connected), the <strong>sequence diagram</strong> (who calls whom, in what order, for one use case) and, sometimes, the <strong>state diagram</strong> (the life of one object, like an order). Drawing these in 5 minutes before you code shows the interviewer your design, catches mistakes while they are cheap, and gives you a map to code against. This page teaches the notation, what each arrow means in real code, and how to draw fast on a whiteboard.</p>

<h2>Why draw before you code</h2>
<p>In a machine-coding or LLD round at Flipkart, Swiggy, PhonePe, Amazon or Uber, the interviewer has about 60 minutes and one question in mind: <em>can this person turn a vague problem into a clean set of classes?</em> If you start typing straight away, they only see your design when you are 300 lines in, and changing it costs too much. A quick diagram fixes that.</p>
<div class="grid-3">
<div class="card"><strong>Agree early</strong><p>The interviewer can say "a <code>Ticket</code> should not own the <code>Vehicle</code>" in minute 8, not minute 48.</p></div>
<div class="card"><strong>Find the gaps</strong><p>Drawing a sequence for "cancel order" often shows a missing method or a class with two jobs.</p></div>
<div class="card"><strong>Code faster</strong><p>Each box becomes a class file, each arrow becomes a field, parameter or <code>extends</code>. No guessing while coding.</p></div>
</div>
<p>You are not graded on perfect UML. You are graded on clear thinking. Use the standard symbols where they help, label anything unclear, and keep moving. The class diagram links directly to the ideas in <a href="#/p/oop">OOP fundamentals</a> and <a href="#/p/solid">SOLID</a>: every arrow is a design decision about coupling.</p>

<h2>Class diagram notation</h2>
<p>A class is a box with three compartments: the <strong>name</strong>, the <strong>attributes</strong> (fields) and the <strong>methods</strong> (operations). Each member gets a <strong>visibility</strong> symbol in front.</p>
<table>
<thead><tr><th>Symbol</th><th>Visibility</th><th>Meaning</th><th>Java / C++ keyword</th></tr></thead>
<tbody>
<tr><td><code>+</code></td><td>Public</td><td>Anyone can use it</td><td><code>public</code></td></tr>
<tr><td><code>-</code></td><td>Private</td><td>Only this class</td><td><code>private</code></td></tr>
<tr><td><code>#</code></td><td>Protected</td><td>This class and subclasses</td><td><code>protected</code></td></tr>
<tr><td><code>~</code></td><td>Package</td><td>Same package / module</td><td>Java default (no keyword)</td></tr>
</tbody>
</table>
<p>Other conventions you will see:</p>
<ul>
<li><strong>Types</strong> are written after the name: <code>-balance: long</code>, <code>+withdraw(amount: long): bool</code>. On a whiteboard, drop types that are obvious.</li>
<li><strong>Static</strong> members are <u>underlined</u> (Mermaid uses a trailing <code>$</code>): a factory method like <code>Order.create()</code>.</li>
<li><strong>Abstract</strong> classes and methods are in <em>italics</em> (Mermaid uses a trailing <code>*</code>), or you write the stereotype <code>&lt;&lt;abstract&gt;&gt;</code> above the name. On a whiteboard, italics are invisible; always write the stereotype.</li>
<li><strong>Interfaces</strong> get the stereotype <code>&lt;&lt;interface&gt;&gt;</code>. Enums get <code>&lt;&lt;enumeration&gt;&gt;</code> and list their values as attributes.</li>
</ul>
<div data-diagram="notation" data-caption="One interface, one abstract class, one concrete class and one enum. + public, - private, # protected; $ marks static, * marks abstract."></div>
<p>Read it like this: <code>PaymentMethod</code> is an interface with one method. <code>Account</code> is abstract, has a private balance, a protected id, a static counter and an abstract <code>monthlyFee()</code>. <code>SavingsAccount</code> extends <code>Account</code> and fills in <code>monthlyFee()</code>. <code>AccountStatus</code> is an enum.</p>

<h2>The six relationships</h2>
<p>Lines between boxes are where most marks are won or lost. There are six you must know. The trick is to remember what each one becomes <strong>in code</strong>: a field, a field you create yourself, <code>extends</code>, <code>implements</code>, or just a method parameter.</p>
<figure class="svg-fig">
<svg viewBox="0 0 660 420" role="img" aria-label="The six UML relationship symbols">
<text x="16" y="26" class="s-muted">RELATIONSHIP</text>
<text x="200" y="26" class="s-muted">SYMBOL (A to B)</text>
<text x="440" y="26" class="s-muted">IN CODE</text>
<text x="16" y="74" class="s-title">Association</text>
<text x="186" y="79" class="s-text" text-anchor="middle">A</text>
<line x1="200" y1="74" x2="404" y2="74" class="s-line" marker-end="url(#arrow)"/>
<text x="418" y="79" class="s-text" text-anchor="middle">B</text>
<text x="440" y="79" class="s-text">A has a field of type B</text>
<text x="16" y="136" class="s-title">Aggregation</text>
<text x="186" y="141" class="s-text" text-anchor="middle">A</text>
<polygon points="200,136 214,128 228,136 214,144" class="s-box"/>
<line x1="228" y1="136" x2="406" y2="136" class="s-line"/>
<text x="418" y="141" class="s-text" text-anchor="middle">B</text>
<text x="440" y="141" class="s-text">field, B passed in, B lives on</text>
<text x="16" y="198" class="s-title">Composition</text>
<text x="186" y="203" class="s-text" text-anchor="middle">A</text>
<polygon points="200,198 214,190 228,198 214,206" class="s-arrowhead"/>
<line x1="228" y1="198" x2="406" y2="198" class="s-line"/>
<text x="418" y="203" class="s-text" text-anchor="middle">B</text>
<text x="440" y="203" class="s-text">A creates B, B dies with A</text>
<text x="16" y="260" class="s-title">Inheritance</text>
<text x="186" y="265" class="s-text" text-anchor="middle">A</text>
<line x1="200" y1="260" x2="390" y2="260" class="s-line"/>
<polygon points="390,250 408,260 390,270" class="s-box"/>
<text x="418" y="265" class="s-text" text-anchor="middle">B</text>
<text x="440" y="265" class="s-text">class A extends B</text>
<text x="16" y="322" class="s-title">Realisation</text>
<text x="186" y="327" class="s-text" text-anchor="middle">A</text>
<line x1="200" y1="322" x2="390" y2="322" class="s-dash"/>
<polygon points="390,312 408,322 390,332" class="s-box"/>
<text x="418" y="327" class="s-text" text-anchor="middle">B</text>
<text x="440" y="327" class="s-text">class A implements B</text>
<text x="16" y="384" class="s-title">Dependency</text>
<text x="186" y="389" class="s-text" text-anchor="middle">A</text>
<line x1="200" y1="384" x2="404" y2="384" class="s-dash" marker-end="url(#arrow)"/>
<text x="418" y="389" class="s-text" text-anchor="middle">B</text>
<text x="440" y="389" class="s-text">B only as a parameter or local</text>
</svg>
<figcaption>The six relationships. Solid line = structural (a field or extends). Dashed line = weaker (implements, or temporary use). Diamonds sit on the whole (owner) side; triangles point at the parent.</figcaption>
</figure>
<p>They go from weakest coupling to strongest: <strong>dependency</strong> (uses it for a moment) &lt; <strong>association</strong> (knows it) &lt; <strong>aggregation</strong> (has it, does not own it) &lt; <strong>composition</strong> (owns it, controls its life) &lt; <strong>inheritance</strong> (is one). Realisation sits beside inheritance but only shares a contract, not code.</p>

<h3>1. Association: "knows about"</h3>
<p>A plain solid line (with an arrow if only one side knows the other). An <code>Order</code> keeps a reference to the <code>Customer</code> who placed it. Both have their own life; neither creates the other.</p>
<div data-diagram="assoc" data-caption="Association with multiplicity: one customer places many orders; each order has exactly one customer."></div>
<p><strong>In code:</strong> a field. <code>class Order { private Customer customer; }</code>. If the arrow goes both ways, both classes hold a reference, which is more coupling, so prefer one direction unless you really need to navigate both ways.</p>

<h3>2. Aggregation: "has a, but does not own"</h3>
<p>A solid line with a <strong>hollow diamond</strong> on the whole side. A <code>DeliveryFleet</code> has many <code>DeliveryPartner</code>s, but partners exist on their own: they were hired before the fleet zone was created and they move to another zone when this one shuts down.</p>
<div data-diagram="aggr" data-caption="Aggregation: the fleet groups partners it did not create. Delete the fleet and the partners still exist."></div>
<p><strong>In code:</strong> a field (often a list) whose objects are <strong>passed in</strong> from outside, through a constructor or an <code>add()</code> method. The whole never calls <code>new</code> on the parts.</p>

<h3>3. Composition: "owns, and the part dies with it"</h3>
<p>A solid line with a <strong>filled diamond</strong> on the owner side. An <code>Order</code> is made of <code>OrderLine</code>s. A line "2 x Paneer Tikka" means nothing without its order, is never shared with another order, and is deleted when the order is deleted.</p>
<div data-diagram="comp" data-caption="Composition: the order creates its lines and they share its life cycle. A part belongs to exactly one whole."></div>
<p><strong>In code:</strong> the owner <strong>creates</strong> the parts itself, usually inside a method like <code>order.addLine(itemId, qty, price)</code>, and never hands out a way for another object to own them. In C++ this is a member held by value or a <code>unique_ptr</code>. In a database it is <code>ON DELETE CASCADE</code> (see <a href="#/p/schema-design">schema design</a>).</p>

<h3>4. Inheritance (generalisation): "is a"</h3>
<p>A solid line with a <strong>hollow triangle</strong> pointing at the parent. A <code>Customer</code> is a <code>User</code>; so is a <code>DeliveryPartner</code>. Shared fields (<code>id</code>, <code>name</code>, <code>phone</code>) live in the parent.</p>
<div data-diagram="inherit" data-caption="Inheritance: the arrow points from child to parent. Children reuse the parent's fields and code."></div>
<p><strong>In code:</strong> <code>class Customer extends User</code> (Java, JS), <code>class Customer(User)</code> (Python), <code>class Customer : public User</code> (C++). Go has no inheritance; you embed a struct (<code>type Customer struct { User }</code>), which gives reuse but not "is a" substitution. Inheritance is the strongest coupling, so use it only for a true "is a" with shared behaviour. See <a href="#/p/design-principles">composition over inheritance</a>.</p>

<h3>5. Realisation: "implements a contract"</h3>
<p>A <strong>dashed</strong> line with a hollow triangle pointing at the interface. <code>UpiPayment</code>, <code>CardPayment</code> and <code>CodPayment</code> all realise <code>PaymentMethod</code>. This is how the Strategy pattern looks on paper (see <a href="#/p/behavioral-patterns">behavioural patterns</a>).</p>
<div data-diagram="realise" data-caption="Realisation: three classes implement one interface. The caller depends on the interface, not the classes."></div>
<p><strong>In code:</strong> <code>class UpiPayment implements PaymentMethod</code>. In Python an <code>ABC</code> with <code>@abstractmethod</code>; in C++ a class with pure virtual methods; in Go any type that has the methods satisfies the interface automatically.</p>

<h3>6. Dependency: "uses for a moment"</h3>
<p>A <strong>dashed</strong> line with an open arrow. <code>CheckoutService.checkout(order, payment)</code> uses a <code>PaymentMethod</code> and an <code>InvoicePrinter</code> during one call, but does not keep them.</p>
<div data-diagram="dep" data-caption="Dependency: the service uses these types as parameters or locals only. No field holds them."></div>
<p><strong>In code:</strong> a method parameter, a local variable, a return type, or a static call. No field. If the type later becomes a field, upgrade the line to an association.</p>

<h3>The same six in running code</h3>
<p>Here is one tiny food-ordering program that contains all six relationships, with a comment on each. Run it in your language and match each comment to the arrows above.</p>
<div data-code="relations"></div>

<h3>Multiplicity</h3>
<p>Numbers at each end of a line say how many objects take part. Write them near the class they describe.</p>
<table>
<thead><tr><th>Notation</th><th>Means</th><th>Example</th></tr></thead>
<tbody>
<tr><td><code>1</code></td><td>Exactly one</td><td>An order has exactly 1 customer</td></tr>
<tr><td><code>0..1</code></td><td>Zero or one (optional)</td><td>An order has 0..1 delivery partner (none until assigned)</td></tr>
<tr><td><code>*</code> or <code>0..*</code></td><td>Any number, including none</td><td>A customer has 0..* orders</td></tr>
<tr><td><code>1..*</code></td><td>At least one</td><td>An order has 1..* lines (an empty order is invalid)</td></tr>
<tr><td><code>2..4</code></td><td>A fixed range</td><td>A Splitwise group bill split among 2..4 people</td></tr>
</tbody>
</table>
<p>Multiplicity tells you the field type: <code>1</code> or <code>0..1</code> is a single reference (nullable for <code>0..1</code>), <code>*</code> is a list, set or map. It also tells you the database shape: one-to-many becomes a foreign key, many-to-many becomes a junction table.</p>

<div class="callout warn"><strong>Aggregation vs composition: the classic mix-up</strong>
<p>Ask two questions. <strong>Who creates the part?</strong> <strong>Can the part outlive or be shared beyond the whole?</strong> If the whole creates it and it dies with the whole, it is composition (filled diamond). If it is passed in and lives on, it is aggregation (hollow diamond).</p>
<table>
<thead><tr><th>Whole and part</th><th>Relationship</th><th>Why</th></tr></thead>
<tbody>
<tr><td>House and Room</td><td>Composition</td><td>A room is not moved to another house</td></tr>
<tr><td>Order and OrderLine</td><td>Composition</td><td>A line has no meaning without its order</td></tr>
<tr><td>ParkingLot and ParkingFloor</td><td>Composition</td><td>Floors are built with the lot (see <a href="#/p/parking-lot">parking lot</a>)</td></tr>
<tr><td>Team and Player</td><td>Aggregation</td><td>A player leaves and joins another team</td></tr>
<tr><td>Playlist and Song</td><td>Aggregation</td><td>Deleting a playlist does not delete songs, and a song is in many playlists</td></tr>
<tr><td>Library and Book (catalogue)</td><td>Aggregation (usually)</td><td>Books can be transferred; say your assumption (see <a href="#/p/library-management">library management</a>)</td></tr>
</tbody>
</table>
<p>If you are unsure, use a plain association and say so out loud. Interviewers care far more that you know the <em>life-cycle question</em> than which diamond you pick.</p>
</div>

<h2>Sequence diagrams</h2>
<p>A class diagram is static: it shows structure, not behaviour. A <strong>sequence diagram</strong> shows one use case over time: which object calls which method, in what order, and what comes back. Time flows top to bottom.</p>
<table>
<thead><tr><th>Element</th><th>Drawn as</th><th>Meaning</th></tr></thead>
<tbody>
<tr><td>Participant / lifeline</td><td>Box at the top with a dashed line down</td><td>One object or service, alive for the whole scenario. A stick figure means a human actor.</td></tr>
<tr><td>Synchronous message</td><td>Solid line, filled arrowhead</td><td>A normal method call. The caller waits for the answer.</td></tr>
<tr><td>Asynchronous message</td><td>Solid line, open arrowhead</td><td>Fire and forget: publish an event, put a job on a queue. The caller does not wait.</td></tr>
<tr><td>Return</td><td>Dashed line back</td><td>The value or result of a sync call. Often skipped for void calls.</td></tr>
<tr><td>Activation bar</td><td>Thin rectangle on a lifeline</td><td>The period when that object is busy handling a call.</td></tr>
<tr><td>Self call</td><td>Arrow looping back to the same lifeline</td><td>A private helper method, like <code>validate()</code>.</td></tr>
</tbody>
</table>
<div data-diagram="seqBasics" data-caption="Sequence basics: sync call with activation, return, self call, and an async event the caller does not wait for."></div>
<h3>Combined fragments: alt, opt, loop</h3>
<p>Real flows have branches and repeats. UML draws them as labelled boxes around a group of messages:</p>
<ul>
<li><strong>alt</strong>: if / else. Each section has a guard like <code>[payment ok]</code> and <code>[payment failed]</code>.</li>
<li><strong>opt</strong>: an <code>if</code> with no else. "If the user applied a coupon, validate it."</li>
<li><strong>loop</strong>: repeat while a condition holds. "Every 5 seconds, send the partner's location."</li>
<li><strong>par</strong>: things that happen in parallel, such as notifying the restaurant and the customer at the same time.</li>
</ul>

<h3>Worked example: placing a Swiggy order</h3>
<p>Use case: a customer taps "Place order" for a paneer tikka and two naans paid by UPI. We want to show the order service as the coordinator, payment as a sync call that can fail, and the downstream work (restaurant, delivery assignment) as async events so the customer is not kept waiting.</p>
<div data-diagram="swiggy" data-caption="Placing a food order: sync calls for things the customer must wait for (price, payment), async events for everything after."></div>
<ol class="steps">
<li>The app calls <code>OrderService.placeOrder(cart)</code>. The order service is activated and stays activated until it returns.</li>
<li><strong>opt</strong> fragment: only if a coupon was applied does it call the coupon service.</li>
<li>It asks the menu service for current prices (never trust prices sent by the client) and saves the order as <code>PAYMENT_PENDING</code>.</li>
<li><strong>alt</strong> fragment: payment succeeds or fails. On failure the order is marked <code>FAILED</code> and the app gets an error. On success it is <code>CONFIRMED</code>.</li>
<li>An async <code>OrderConfirmed</code> event goes on the queue (see <a href="#/p/message-queues">message queues</a>). The app gets its response immediately; the restaurant and delivery services react in their own time.</li>
<li><strong>loop</strong> fragment: once a partner is assigned, location updates stream to the app until delivery.</li>
</ol>
<div class="callout tip"><strong>Sequence diagram habits that score well</strong>Name messages as real method calls (<code>charge(orderId, 45900)</code>), not vague verbs ("process stuff"). Show the failure branch for at least one call. Mark which calls are async, because that is where the interesting questions (retries, ordering, <a href="#/p/api-design">idempotency keys</a>) come from. Keep to 5 or 6 lifelines; group the rest as "Other services".</div>

<h2>State diagrams, briefly</h2>
<p>When one object has a clear life cycle (an order, a payment, an elevator, a ticket), a <strong>state diagram</strong> is the fastest way to show the legal moves. Rounded boxes are states, arrows are transitions labelled with the event that causes them, a filled dot is the start and a ringed dot is the end.</p>
<div data-diagram="orderState" data-caption="Life cycle of a food order. Any arrow not drawn is an illegal move, for example DELIVERED to CANCELLED."></div>
<p>In code this becomes an enum plus a guard: <code>if (!ALLOWED.get(current).contains(next)) throw new IllegalStateException()</code>. When each state has a lot of behaviour, it becomes the State pattern, as in the <a href="#/p/vending-machine">vending machine</a> and <a href="#/p/elevator">elevator</a> problems. A state diagram also gives you test cases for free: one per arrow, plus a few illegal ones.</p>

<h2>Drawing fast on a whiteboard</h2>
<div class="callout interview"><strong>How to draw a useful class diagram in 5 minutes</strong>
<ol>
<li><strong>Nouns to boxes (1 min).</strong> Read the requirements and circle the nouns: Order, Customer, Restaurant, MenuItem, Payment. Draw only names first, no compartments.</li>
<li><strong>Find what changes (1 min).</strong> Pricing, payment method, assignment rule. Draw those as <code>&lt;&lt;interface&gt;&gt;</code> boxes with 2 implementations each.</li>
<li><strong>Connect with lines (1.5 min).</strong> Plain lines first. Then upgrade the important ones: filled diamond where one object creates and owns another, triangle for "is a" or "implements". Add <code>1</code> and <code>*</code> at the ends.</li>
<li><strong>Key members only (1.5 min).</strong> Two or three fields and the main public methods per class: <code>placeOrder()</code>, <code>cancel()</code>, <code>assignPartner()</code>. Skip getters, setters and obvious types.</li>
<li><strong>Talk while you draw.</strong> "Order owns its lines, that is composition; payment is a strategy so we can add wallets later." The talking is what gets scored.</li>
</ol>
<p>Then draw one sequence diagram for the most important use case, and a state diagram only if there is a real life cycle. Leave the rest for code.</p>
</div>

<h2>Common mistakes</h2>
<div class="grid-2">
<div class="card bad"><strong>Mistakes that cost marks</strong>
<ul>
<li>Arrow direction backwards: the inheritance triangle points at the <em>parent</em>, not the child.</li>
<li>Diamond on the wrong end: it goes on the <em>whole</em> (owner), not the part.</li>
<li>Filled diamond everywhere. Most "has a" links are plain associations or aggregation.</li>
<li>Inheritance for roles: <code>Admin extends Customer</code> because admins can also order. Roles change; use composition.</li>
<li>Every getter and setter drawn. It hides the design under noise.</li>
<li>A 20-box diagram with no sequence diagram. Structure without behaviour does not show how it works.</li>
</ul>
</div>
<div class="card good"><strong>Habits that impress</strong>
<ul>
<li>Interfaces for every axis of change, each with two concrete classes.</li>
<li>Multiplicity on the important links.</li>
<li>Enums for fixed sets (status, vehicle type) instead of class hierarchies.</li>
<li>A short legend or label wherever the symbol might be ambiguous.</li>
<li>The diagram updated when the design changes during the discussion.</li>
<li>A sequence diagram with the failure path, not just the happy path.</li>
</ul>
</div>
</div>
<div class="callout interview"><strong>Say this in the interview</strong>"Before I code, let me sketch the main classes and one sequence for placing an order, so we agree on the shape. <code>Order</code> composes its <code>OrderLine</code>s because lines die with the order. <code>Order</code> only associates with <code>Customer</code>. Payment is an interface with UPI and card implementations, so adding a wallet is a new class with no edits to <code>OrderService</code>."</div>

<h2>Test yourself</h2>
<div class="quiz">
<details><summary>A <code>Car</code> has an <code>Engine</code> that is built into it at the factory and scrapped with it. A <code>Car</code> also has a <code>Driver</code>. Which relationship is each?</summary><div>Car to Engine is <strong>composition</strong> (filled diamond on Car): the car creates and owns the engine, and they share a life cycle. Car to Driver is an <strong>association</strong> (or aggregation if the car keeps a list of allowed drivers passed in): the driver exists independently and drives other cars too. If you argue that engines can be swapped into another car, aggregation is also defensible; the point is to state the life-cycle assumption.</div></details>
<details><summary>In code, what is the difference between an association and a dependency?</summary><div>An association is stored: the class has a <strong>field</strong> of the other type, so the link lasts as long as the object. A dependency is temporary: the other type appears only as a <strong>method parameter, local variable or return type</strong>. <code>OrderService.checkout(PaymentMethod p)</code> depends on <code>PaymentMethod</code>; <code>Order { Customer customer; }</code> is associated with <code>Customer</code>.</div></details>
<details><summary>Which way does the inheritance arrow point, and what is the line style for implementing an interface?</summary><div>The hollow triangle points at the <strong>parent</strong> (the more general class). Implementing an interface (realisation) uses the same hollow triangle on a <strong>dashed</strong> line, pointing at the interface.</div></details>
<details><summary>When would you use an <code>alt</code> fragment versus an <code>opt</code> fragment in a sequence diagram?</summary><div><code>alt</code> is if / else with two or more guarded branches, for example payment succeeded vs failed. <code>opt</code> is a single optional block that runs only if its guard is true, with no else, for example "if a coupon was applied, validate it".</div></details>
<details><summary>An order can have zero or one delivery partner and at least one line. Write the multiplicities and the field types.</summary><div>Order to DeliveryPartner is <code>0..1</code>, so a nullable single reference (<code>Optional&lt;DeliveryPartner&gt;</code>, a pointer, or <code>None</code>). Order to OrderLine is <code>1..*</code>, so a list that the constructor or a validation check keeps non-empty before the order can be placed.</div></details>
<details><summary>Why show payment as a sync message but the "order confirmed" event as async?</summary><div>The customer must know whether payment worked before the app can show success, so the order service waits for it (sync). Notifying the restaurant, assigning a rider and sending SMS can happen a moment later, so they are published as an event (async). This keeps the user-facing call fast and lets the downstream services fail and retry independently.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
<li>In LLD rounds you need three UML diagrams: class (structure), sequence (one flow over time) and sometimes state (one object's life cycle).</li>
<li>Visibility: <code>+</code> public, <code>-</code> private, <code>#</code> protected. Mark interfaces and abstract classes with stereotypes on a whiteboard.</li>
<li>Six relationships, weakest to strongest: dependency (parameter), association (field), aggregation (field passed in), composition (field created and owned), inheritance (<code>extends</code>); realisation is <code>implements</code>.</li>
<li>Aggregation vs composition is a life-cycle question: who creates the part, and does it die with the whole?</li>
<li>Multiplicity tells you the field type (single, optional, list) and the database shape (foreign key or junction table).</li>
<li>Sequence diagrams: solid filled arrow = sync call, open arrow = async, dashed = return; use <code>alt</code>, <code>opt</code> and <code>loop</code> for logic. Always show one failure path.</li>
<li>Spend 5 minutes drawing, talk while you draw, then code against the diagram.</li>
</ul></div>
`,
  code: {
    relations: {
      title: "All six UML relationships in one small program",
      java: String.raw`import java.util.ArrayList;
import java.util.List;

public class Main {
    // REALISATION: UpiPayment implements the PaymentMethod contract.
    interface PaymentMethod {
        String pay(long paise);
    }

    static class UpiPayment implements PaymentMethod {
        private final String vpa;
        UpiPayment(String vpa) { this.vpa = vpa; }
        public String pay(long paise) { return "paid " + paise + " paise via UPI " + vpa; }
    }

    // INHERITANCE: Customer is a User.
    static abstract class User {
        protected final String name;
        User(String name) { this.name = name; }
        abstract String role();
    }

    static class Customer extends User {
        Customer(String name) { super(name); }
        String role() { return "customer"; }
    }

    static class DeliveryPartner extends User {
        DeliveryPartner(String name) { super(name); }
        String role() { return "partner"; }
    }

    // COMPOSITION: an OrderLine is created by, and lives only inside, its Order.
    static class OrderLine {
        final String item;
        final int qty;
        final long pricePaise;
        private OrderLine(String item, int qty, long pricePaise) {
            this.item = item; this.qty = qty; this.pricePaise = pricePaise;
        }
        long total() { return qty * pricePaise; }
    }

    static class Order {
        final int id;
        private final Customer customer;                     // ASSOCIATION: a field, not owned
        private final List<OrderLine> lines = new ArrayList<>(); // COMPOSITION: created here

        Order(int id, Customer customer) { this.id = id; this.customer = customer; }

        void addLine(String item, int qty, long pricePaise) {
            lines.add(new OrderLine(item, qty, pricePaise));  // the whole creates the part
        }

        long total() {
            long sum = 0;
            for (OrderLine l : lines) sum += l.total();
            return sum;
        }

        int lineCount() { return lines.size(); }
        Customer customer() { return customer; }

        // DEPENDENCY: PaymentMethod is only a parameter, never stored.
        String checkout(PaymentMethod method) { return method.pay(total()); }
    }

    // AGGREGATION: the fleet holds partners that were created elsewhere.
    static class DeliveryFleet {
        private final List<DeliveryPartner> partners = new ArrayList<>();
        void add(DeliveryPartner p) { partners.add(p); }   // passed in, not created
        String names() {
            List<String> out = new ArrayList<>();
            for (DeliveryPartner p : partners) out.add(p.name);
            return String.join(", ", out);
        }
        int size() { return partners.size(); }
    }

    public static void main(String[] args) {
        Customer asha = new Customer("Asha");
        System.out.println("[inheritance] " + asha.name + " is a User with role " + asha.role());

        Order order = new Order(1, asha);
        System.out.println("[association] order " + order.id + " belongs to " + order.customer().name);

        order.addLine("Paneer Tikka", 2, 28900);
        order.addLine("Butter Naan", 1, 4500);
        System.out.println("[composition] order " + order.id + " has " + order.lineCount()
                + " lines, total " + order.total() + " paise");

        PaymentMethod upi = new UpiPayment("asha@okicici");
        System.out.println("[dependency + realisation] " + order.checkout(upi));

        DeliveryPartner ravi = new DeliveryPartner("Ravi");
        DeliveryPartner imran = new DeliveryPartner("Imran");
        DeliveryFleet fleet = new DeliveryFleet();
        fleet.add(ravi);
        fleet.add(imran);
        System.out.println("[aggregation] fleet has " + fleet.size() + " partners: " + fleet.names());
        fleet = null; // the zone shuts down
        System.out.println("[aggregation] fleet gone, " + ravi.name + " still exists as a " + ravi.role());
    }
}
`,
      python: String.raw`from abc import ABC, abstractmethod


# REALISATION: UpiPayment implements the PaymentMethod contract.
class PaymentMethod(ABC):
    @abstractmethod
    def pay(self, paise: int) -> str: ...


class UpiPayment(PaymentMethod):
    def __init__(self, vpa: str):
        self._vpa = vpa

    def pay(self, paise: int) -> str:
        return f"paid {paise} paise via UPI {self._vpa}"


# INHERITANCE: Customer is a User.
class User(ABC):
    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    def role(self) -> str: ...


class Customer(User):
    def role(self) -> str:
        return "customer"


class DeliveryPartner(User):
    def role(self) -> str:
        return "partner"


# COMPOSITION: an OrderLine is created by, and lives only inside, its Order.
class OrderLine:
    def __init__(self, item: str, qty: int, price_paise: int):
        self.item, self.qty, self.price_paise = item, qty, price_paise

    def total(self) -> int:
        return self.qty * self.price_paise


class Order:
    def __init__(self, order_id: int, customer: Customer):
        self.id = order_id
        self.customer = customer           # ASSOCIATION: a field, not owned
        self._lines: list[OrderLine] = []  # COMPOSITION: created here

    def add_line(self, item: str, qty: int, price_paise: int) -> None:
        self._lines.append(OrderLine(item, qty, price_paise))  # the whole creates the part

    def total(self) -> int:
        return sum(line.total() for line in self._lines)

    def line_count(self) -> int:
        return len(self._lines)

    # DEPENDENCY: PaymentMethod is only a parameter, never stored.
    def checkout(self, method: PaymentMethod) -> str:
        return method.pay(self.total())


# AGGREGATION: the fleet holds partners that were created elsewhere.
class DeliveryFleet:
    def __init__(self):
        self._partners: list[DeliveryPartner] = []

    def add(self, partner: DeliveryPartner) -> None:
        self._partners.append(partner)  # passed in, not created

    def names(self) -> str:
        return ", ".join(p.name for p in self._partners)

    def size(self) -> int:
        return len(self._partners)


def main() -> None:
    asha = Customer("Asha")
    print(f"[inheritance] {asha.name} is a User with role {asha.role()}")

    order = Order(1, asha)
    print(f"[association] order {order.id} belongs to {order.customer.name}")

    order.add_line("Paneer Tikka", 2, 28900)
    order.add_line("Butter Naan", 1, 4500)
    print(f"[composition] order {order.id} has {order.line_count()} lines, total {order.total()} paise")

    upi = UpiPayment("asha@okicici")
    print(f"[dependency + realisation] {order.checkout(upi)}")

    ravi, imran = DeliveryPartner("Ravi"), DeliveryPartner("Imran")
    fleet = DeliveryFleet()
    fleet.add(ravi)
    fleet.add(imran)
    print(f"[aggregation] fleet has {fleet.size()} partners: {fleet.names()}")
    del fleet  # the zone shuts down
    print(f"[aggregation] fleet gone, {ravi.name} still exists as a {ravi.role()}")


if __name__ == "__main__":
    main()
`,
      cpp: String.raw`#include <iostream>
#include <memory>
#include <string>
#include <vector>

// REALISATION: UpiPayment implements the PaymentMethod contract (pure virtual).
class PaymentMethod {
public:
    virtual ~PaymentMethod() = default;
    virtual std::string pay(long long paise) const = 0;
};

class UpiPayment : public PaymentMethod {
    std::string vpa_;
public:
    explicit UpiPayment(std::string vpa) : vpa_(std::move(vpa)) {}
    std::string pay(long long paise) const override {
        return "paid " + std::to_string(paise) + " paise via UPI " + vpa_;
    }
};

// INHERITANCE: Customer is a User.
class User {
protected:
    std::string name_;
public:
    explicit User(std::string name) : name_(std::move(name)) {}
    virtual ~User() = default;
    const std::string& name() const { return name_; }
    virtual std::string role() const = 0;
};

class Customer : public User {
public:
    using User::User;
    std::string role() const override { return "customer"; }
};

class DeliveryPartner : public User {
public:
    using User::User;
    std::string role() const override { return "partner"; }
};

// COMPOSITION: OrderLine objects are held by value inside Order and die with it.
struct OrderLine {
    std::string item;
    int qty;
    long long pricePaise;
    long long total() const { return qty * pricePaise; }
};

class Order {
    int id_;
    const Customer* customer_;       // ASSOCIATION: a non-owning pointer
    std::vector<OrderLine> lines_;   // COMPOSITION: owned by value
public:
    Order(int id, const Customer* customer) : id_(id), customer_(customer) {}
    int id() const { return id_; }
    const Customer& customer() const { return *customer_; }

    void addLine(const std::string& item, int qty, long long pricePaise) {
        lines_.push_back(OrderLine{item, qty, pricePaise});  // the whole creates the part
    }
    long long total() const {
        long long sum = 0;
        for (const auto& l : lines_) sum += l.total();
        return sum;
    }
    size_t lineCount() const { return lines_.size(); }

    // DEPENDENCY: PaymentMethod is only a parameter, never stored.
    std::string checkout(const PaymentMethod& method) const { return method.pay(total()); }
};

// AGGREGATION: the fleet points at partners it does not own (shared_ptr shared with the caller).
class DeliveryFleet {
    std::vector<std::shared_ptr<DeliveryPartner>> partners_;
public:
    void add(std::shared_ptr<DeliveryPartner> p) { partners_.push_back(std::move(p)); }
    size_t size() const { return partners_.size(); }
    std::string names() const {
        std::string out;
        for (size_t i = 0; i < partners_.size(); ++i) {
            if (i) out += ", ";
            out += partners_[i]->name();
        }
        return out;
    }
};

int main() {
    Customer asha("Asha");
    std::cout << "[inheritance] " << asha.name() << " is a User with role " << asha.role() << "\n";

    Order order(1, &asha);
    std::cout << "[association] order " << order.id() << " belongs to " << order.customer().name() << "\n";

    order.addLine("Paneer Tikka", 2, 28900);
    order.addLine("Butter Naan", 1, 4500);
    std::cout << "[composition] order " << order.id() << " has " << order.lineCount()
              << " lines, total " << order.total() << " paise\n";

    UpiPayment upi("asha@okicici");
    std::cout << "[dependency + realisation] " << order.checkout(upi) << "\n";

    auto ravi = std::make_shared<DeliveryPartner>("Ravi");
    auto imran = std::make_shared<DeliveryPartner>("Imran");
    {
        DeliveryFleet fleet;
        fleet.add(ravi);
        fleet.add(imran);
        std::cout << "[aggregation] fleet has " << fleet.size() << " partners: " << fleet.names() << "\n";
    } // the zone shuts down: fleet is destroyed here
    std::cout << "[aggregation] fleet gone, " << ravi->name() << " still exists as a " << ravi->role() << "\n";
    return 0;
}
`,
      javascript: String.raw`// REALISATION: JavaScript has no interfaces, so we use a base class that throws.
class PaymentMethod {
  pay(paise) { throw new Error("not implemented"); }
}

class UpiPayment extends PaymentMethod {
  #vpa;
  constructor(vpa) { super(); this.#vpa = vpa; }
  pay(paise) { return "paid " + paise + " paise via UPI " + this.#vpa; }
}

// INHERITANCE: Customer is a User.
class User {
  constructor(name) { this.name = name; }
  role() { throw new Error("abstract"); }
}

class Customer extends User {
  role() { return "customer"; }
}

class DeliveryPartner extends User {
  role() { return "partner"; }
}

// COMPOSITION: an OrderLine is created by, and lives only inside, its Order.
class OrderLine {
  constructor(item, qty, pricePaise) {
    this.item = item; this.qty = qty; this.pricePaise = pricePaise;
  }
  total() { return this.qty * this.pricePaise; }
}

class Order {
  #lines = []; // COMPOSITION: created here, never handed out
  constructor(id, customer) {
    this.id = id;
    this.customer = customer; // ASSOCIATION: a field, not owned
  }
  addLine(item, qty, pricePaise) {
    this.#lines.push(new OrderLine(item, qty, pricePaise)); // the whole creates the part
  }
  total() { return this.#lines.reduce((s, l) => s + l.total(), 0); }
  lineCount() { return this.#lines.length; }

  // DEPENDENCY: the payment method is only a parameter, never stored.
  checkout(method) { return method.pay(this.total()); }
}

// AGGREGATION: the fleet holds partners that were created elsewhere.
class DeliveryFleet {
  #partners = [];
  add(partner) { this.#partners.push(partner); } // passed in, not created
  size() { return this.#partners.length; }
  names() { return this.#partners.map((p) => p.name).join(", "); }
}

function main() {
  const asha = new Customer("Asha");
  console.log("[inheritance] " + asha.name + " is a User with role " + asha.role());

  const order = new Order(1, asha);
  console.log("[association] order " + order.id + " belongs to " + order.customer.name);

  order.addLine("Paneer Tikka", 2, 28900);
  order.addLine("Butter Naan", 1, 4500);
  console.log("[composition] order " + order.id + " has " + order.lineCount() +
    " lines, total " + order.total() + " paise");

  const upi = new UpiPayment("asha@okicici");
  console.log("[dependency + realisation] " + order.checkout(upi));

  const ravi = new DeliveryPartner("Ravi");
  const imran = new DeliveryPartner("Imran");
  let fleet = new DeliveryFleet();
  fleet.add(ravi);
  fleet.add(imran);
  console.log("[aggregation] fleet has " + fleet.size() + " partners: " + fleet.names());
  fleet = null; // the zone shuts down
  console.log("[aggregation] fleet gone, " + ravi.name + " still exists as a " + ravi.role());
}

main();
`,
      go: String.raw`package main

import (
	"fmt"
	"strings"
)

// REALISATION: any type with a Pay method satisfies PaymentMethod (implicit in Go).
type PaymentMethod interface {
	Pay(paise int64) string
}

type UpiPayment struct{ vpa string }

func (u UpiPayment) Pay(paise int64) string {
	return fmt.Sprintf("paid %d paise via UPI %s", paise, u.vpa)
}

// "INHERITANCE": Go has none, so Customer embeds User to reuse its fields.
type User struct{ Name string }

type Customer struct{ User }

func (Customer) Role() string { return "customer" }

type DeliveryPartner struct{ User }

func (DeliveryPartner) Role() string { return "partner" }

// COMPOSITION: orderLine is unexported and only created by Order.
type orderLine struct {
	item       string
	qty        int64
	pricePaise int64
}

func (l orderLine) total() int64 { return l.qty * l.pricePaise }

type Order struct {
	ID       int
	Customer *Customer  // ASSOCIATION: a pointer field, not owned
	lines    []orderLine // COMPOSITION: owned by value
}

func (o *Order) AddLine(item string, qty, pricePaise int64) {
	o.lines = append(o.lines, orderLine{item, qty, pricePaise}) // the whole creates the part
}

func (o *Order) Total() int64 {
	var sum int64
	for _, l := range o.lines {
		sum += l.total()
	}
	return sum
}

// DEPENDENCY: PaymentMethod is only a parameter, never stored.
func (o *Order) Checkout(m PaymentMethod) string { return m.Pay(o.Total()) }

// AGGREGATION: the fleet holds pointers to partners created elsewhere.
type DeliveryFleet struct{ partners []*DeliveryPartner }

func (f *DeliveryFleet) Add(p *DeliveryPartner) { f.partners = append(f.partners, p) }

func (f *DeliveryFleet) Names() string {
	names := make([]string, 0, len(f.partners))
	for _, p := range f.partners {
		names = append(names, p.Name)
	}
	return strings.Join(names, ", ")
}

func main() {
	asha := &Customer{User{"Asha"}}
	fmt.Printf("[inheritance] %s is a User with role %s\n", asha.Name, asha.Role())

	order := &Order{ID: 1, Customer: asha}
	fmt.Printf("[association] order %d belongs to %s\n", order.ID, order.Customer.Name)

	order.AddLine("Paneer Tikka", 2, 28900)
	order.AddLine("Butter Naan", 1, 4500)
	fmt.Printf("[composition] order %d has %d lines, total %d paise\n", order.ID, len(order.lines), order.Total())

	upi := UpiPayment{vpa: "asha@okicici"}
	fmt.Printf("[dependency + realisation] %s\n", order.Checkout(upi))

	ravi := &DeliveryPartner{User{"Ravi"}}
	imran := &DeliveryPartner{User{"Imran"}}
	fleet := &DeliveryFleet{}
	fleet.Add(ravi)
	fleet.Add(imran)
	fmt.Printf("[aggregation] fleet has %d partners: %s\n", len(fleet.partners), fleet.Names())
	fleet = nil // the zone shuts down
	_ = fleet
	fmt.Printf("[aggregation] fleet gone, %s still exists as a %s\n", ravi.Name, ravi.Role())
}
`,
    },
  },
  diagrams: {
    notation: String.raw`classDiagram
  class PaymentMethod {
    <<interface>>
    +pay(amount) bool
  }
  class Account {
    <<abstract>>
    #id String
    -balance long
    -count int$
    +deposit(amount) void
    +monthlyFee() long*
    +nextId() String$
  }
  class SavingsAccount {
    -rateBps int
    +monthlyFee() long
  }
  class AccountStatus {
    <<enumeration>>
    ACTIVE
    FROZEN
    CLOSED
  }
  Account <|-- SavingsAccount
  Account --> AccountStatus`,
    assoc: String.raw`classDiagram
  direction LR
  class Customer {
    -name String
  }
  class Order {
    -customer Customer
  }
  Customer "1" <-- "0..*" Order : placed by`,
    aggr: String.raw`classDiagram
  direction LR
  class DeliveryFleet {
    -partners List~DeliveryPartner~
    +add(partner)
  }
  class DeliveryPartner {
    -name String
  }
  DeliveryFleet "1" o-- "0..*" DeliveryPartner`,
    comp: String.raw`classDiagram
  direction LR
  class Order {
    -lines List~OrderLine~
    +addLine(item, qty, price)
  }
  class OrderLine {
    -item String
    -qty int
  }
  Order "1" *-- "1..*" OrderLine`,
    inherit: String.raw`classDiagram
  class User {
    <<abstract>>
    #id long
    #name String
    +role() String*
  }
  class Customer {
    -addresses List~Address~
  }
  class DeliveryPartner {
    -vehicleNo String
  }
  User <|-- Customer
  User <|-- DeliveryPartner`,
    realise: String.raw`classDiagram
  class PaymentMethod {
    <<interface>>
    +pay(orderId, paise) bool
  }
  PaymentMethod <|.. UpiPayment
  PaymentMethod <|.. CardPayment
  PaymentMethod <|.. CodPayment`,
    dep: String.raw`classDiagram
  direction LR
  class CheckoutService {
    +checkout(order, payment) Receipt
  }
  class PaymentMethod {
    <<interface>>
  }
  CheckoutService ..> PaymentMethod : uses
  CheckoutService ..> InvoicePrinter : creates locally`,
    seqBasics: String.raw`sequenceDiagram
  actor U as User
  participant A as App
  participant S as OrderService
  participant Q as EventQueue
  U->>A: tap Place order
  A->>+S: placeOrder(cart)
  S->>S: validate(cart)
  S-)Q: publish OrderPlaced
  S-->>-A: orderId 501
  A-->>U: show tracking screen`,
    swiggy: String.raw`sequenceDiagram
  actor C as Customer
  participant App
  participant OS as OrderService
  participant CS as CouponService
  participant MS as MenuService
  participant PS as PaymentService
  participant Q as EventQueue
  C->>App: Place order
  App->>+OS: placeOrder(cart, coupon, UPI)
  opt coupon applied
    OS->>CS: validate(SAVE50, cart)
    CS-->>OS: discount 5000 paise
  end
  OS->>MS: price(items)
  MS-->>OS: subtotal 46200 paise
  OS->>OS: save order PAYMENT_PENDING
  OS->>+PS: charge(orderId, 41200, UPI)
  alt payment ok
    PS-->>OS: SUCCESS txn_77
    OS->>OS: status CONFIRMED
    OS-)Q: OrderConfirmed event
    OS-->>App: 201 order 501 CONFIRMED
  else payment failed
    PS-->>-OS: FAILED
    OS->>OS: status FAILED
    OS-->>-App: 402 payment failed
  end
  App-->>C: result screen
  loop every 5 s until delivered
    Q-)App: partner location update
  end`,
    orderState: String.raw`stateDiagram-v2
  [*] --> PAYMENT_PENDING: placeOrder
  PAYMENT_PENDING --> CONFIRMED: payment ok
  PAYMENT_PENDING --> FAILED: payment failed
  CONFIRMED --> PREPARING: restaurant accepts
  CONFIRMED --> CANCELLED: restaurant rejects
  PREPARING --> OUT_FOR_DELIVERY: picked up
  OUT_FOR_DELIVERY --> DELIVERED: handed over
  CONFIRMED --> CANCELLED: customer cancels
  FAILED --> [*]
  CANCELLED --> [*]
  DELIVERED --> [*]`,
  },
});
