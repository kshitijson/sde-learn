SD.register({
  id: "behavioral-patterns",
  html: String.raw`
<p class="lead">Behavioural patterns are about <em>who does what</em> and <em>how objects talk to each other</em>. Creational patterns decide how objects are made, structural patterns decide how they are wired together, and behavioural patterns decide how work and messages flow between them. They are the patterns you will reach for most in a machine-coding round: a parking lot needs a pricing Strategy, a vending machine needs State, a logger needs Chain of Responsibility, and a notification system is Observer from top to bottom. This page covers the ten you should know, with the six most important ones implemented as runnable programs in five languages.</p>

<h2>What behavioural patterns solve</h2>
<p>Every behavioural pattern answers the same kind of question: <em>"this piece of behaviour keeps changing, or keeps growing. How do I move it out of the class that uses it, so that adding a new variant does not mean editing old code?"</em> That is the open/closed principle from <a href="#/p/solid">SOLID</a> in action: open for extension, closed for modification. The trick is almost always the same: put the varying behaviour behind an interface, and let the main class hold a reference to it instead of a pile of <code>if</code> statements.</p>
<table>
<thead><tr><th>Pattern</th><th>One-line intent</th><th>Typical LLD use</th><th>How often you need it</th></tr></thead>
<tbody>
<tr><td><strong>Strategy</strong></td><td>Swap one algorithm for another at runtime</td><td>Pricing, discounts, spot allocation, split types</td><td>Almost every round</td></tr>
<tr><td><strong>Observer</strong></td><td>Notify many listeners when something changes</td><td>Order status, display boards, notifications</td><td>Very often</td></tr>
<tr><td><strong>State</strong></td><td>Change behaviour when internal state changes</td><td>Vending machine, elevator, order lifecycle</td><td>Very often</td></tr>
<tr><td><strong>Command</strong></td><td>Turn a request into an object</td><td>Undo/redo, job queues, elevator requests</td><td>Often</td></tr>
<tr><td><strong>Chain of Responsibility</strong></td><td>Pass a request along handlers until one deals with it</td><td>Middleware, validation, log levels, approvals</td><td>Often</td></tr>
<tr><td><strong>Template Method</strong></td><td>Fixed skeleton, variable steps</td><td>Payment flow, report export, game loop</td><td>Sometimes</td></tr>
<tr><td><strong>Iterator</strong></td><td>Walk a collection without exposing its insides</td><td>Custom collections, paginated results</td><td>Sometimes</td></tr>
<tr><td><strong>Mediator</strong></td><td>Objects talk through a hub, not to each other</td><td>Chat rooms, air-traffic control, UI forms</td><td>Occasionally</td></tr>
<tr><td><strong>Memento</strong></td><td>Save and restore a snapshot</td><td>Undo in editors and games</td><td>Occasionally</td></tr>
<tr><td><strong>Visitor</strong></td><td>Add operations to a class hierarchy without editing it</td><td>Compilers, file-system size and export</td><td>Rarely</td></tr>
</tbody>
</table>
<div class="callout info"><strong>How to read this page</strong>Each main pattern follows the same shape: the intent, the problem it fixes, a diagram, runnable code, when to use it (and when it is overkill), and where it shows up in LLD rounds. If interfaces, composition and polymorphism feel shaky, read <a href="#/p/oop">OOP fundamentals</a> first. For the other two families see <a href="#/p/creational-patterns">creational</a> and <a href="#/p/structural-patterns">structural</a> patterns.</div>

<h2>Strategy</h2>
<p><strong>Intent:</strong> define a family of algorithms, put each one in its own class behind a common interface, and let the client pick one at runtime.</p>
<h3>The problem</h3>
<p>Flipkart's checkout needs to apply a coupon. On day one there is one rule: Rs200 off on orders above Rs999. Then marketing adds "10% off, up to Rs150". Then a bank offer. Then a festive sale rule. The naive code grows like this:</p>
<pre><code>int payable(int amount, String coupon) {
    if (coupon.equals("FLAT200")) { ... }
    else if (coupon.equals("PCT10")) { ... }
    else if (coupon.equals("HDFC5")) { ... }
    // every new offer edits this method, and every test of it
}</code></pre>
<p>Every new rule touches the same method. The method's tests have to be re-run for every change, two developers adding offers in the same sprint get merge conflicts, and the checkout class now knows the details of every promotion in the company.</p>
<h3>The fix</h3>
<p>Pull each rule into its own class that implements a <code>DiscountStrategy</code> interface with one method: <code>discount(amount)</code>. The <code>Checkout</code> class (the <em>context</em>) holds one strategy and calls it. It never knows which rule it has. A new offer is a new class; nothing that already works is touched.</p>
<div data-diagram="strategy" data-caption="Checkout depends only on the interface. Each discount rule is a separate, swappable class."></div>
<div data-code="strategy"></div>
<p>Expected output:</p>
<pre><code>Cart total: Rs2400
No coupon                -> pay Rs2400
FLAT200 (min Rs999)      -> pay Rs2200
FLAT200 on Rs800 cart    -> pay Rs800
10% off, max Rs150       -> pay Rs2250
Bank offer 5% (lambda)   -> pay Rs2280</code></pre>

<h3>Strategy vs if/else</h3>
<p>Strategy is not "always better than if/else". It is better when the branches are <em>algorithms that grow independently</em>. A quick test:</p>
<table>
<thead><tr><th>Keep the if/else when...</th><th>Switch to Strategy when...</th></tr></thead>
<tbody>
<tr><td>There are 2 or 3 branches and they rarely change</td><td>New variants arrive regularly (offers, pricing plans, routing modes)</td></tr>
<tr><td>Each branch is one or two lines</td><td>Each branch has its own settings, state or tests</td></tr>
<tr><td>The choice is fixed at compile time</td><td>The choice is made at runtime (config, user choice, A/B test)</td></tr>
<tr><td>Only one place makes the decision</td><td>The same switch appears in several methods</td></tr>
</tbody>
</table>
<p>Even with Strategy, <em>something</em> must pick the strategy, often a small <code>if</code> or a map from coupon code to strategy object inside a factory. That is fine. The point is that the decision happens in one place, and the algorithms themselves live elsewhere.</p>

<h3>Functions as strategies</h3>
<p>A strategy interface with one method is really just a function type. Languages with first-class functions let you skip the class entirely:</p>
<ul>
<li><strong>Python and JavaScript:</strong> pass a function. Factories like <code>flat(200, 999)</code> return a closure that remembers its settings. The Python and JavaScript tabs above use this style, with no classes at all.</li>
<li><strong>Go:</strong> keep a one-method interface, and add a function type that satisfies it (<code>type DiscountFunc func(int) int</code> with a <code>Discount</code> method). This is exactly how the standard library's <code>http.HandlerFunc</code> works: structs for rules that carry settings, plain functions for one-offs.</li>
<li><strong>Java and C++:</strong> a functional interface (Java) or <code>std::function</code> (C++) lets a lambda stand in for a class. Use classes when the strategy has a name, settings and tests; use a lambda for a quick one-off.</li>
</ul>
<p>In an interview, write the interface version first even in Python. It makes the design visible on the whiteboard. Then say "in Python I could just pass a function", which shows you know both.</p>

<h3>When to use it, and when it is overkill</h3>
<div class="grid-2">
<div class="card good"><h3>Use it for</h3><ul>
<li>Pricing and fee rules (parking per hour vs flat, surge pricing on Uber or Ola).</li>
<li>Discount and coupon rules.</li>
<li>Algorithms the user picks: shortest vs fastest vs no-toll routes in Google Maps.</li>
<li>Pluggable policies: cache eviction (LRU, LFU), load balancing (round robin, least connections), parking spot allocation.</li>
</ul></div>
<div class="card bad"><h3>Overkill when</h3><ul>
<li>There is exactly one algorithm and no hint of a second.</li>
<li>The "strategies" share so much code that they are really one class with a parameter (10% vs 20% off is one <code>PercentDiscount</code> with a field, not two classes).</li>
<li>You create an interface for every method "just in case". That is speculative design, and interviewers notice.</li>
</ul></div>
</div>
<p><strong>Where it shows up:</strong> the <a href="#/p/parking-lot">parking lot</a> (spot allocation and fee calculation), <a href="#/p/splitwise">Splitwise</a> (equal, exact and percentage splits), the <a href="#/p/elevator">elevator</a> (which car serves a request), the <a href="#/p/vending-machine">vending machine</a> (change-making), and the <a href="#/p/rate-limiter">rate limiter</a> (token bucket vs sliding window).</p>

<h2>Observer</h2>
<p><strong>Intent:</strong> when one object (the <em>subject</em>) changes, automatically notify a list of interested objects (the <em>observers</em> or <em>listeners</em>), without the subject knowing what they are.</p>
<h3>The problem</h3>
<p>A Swiggy order moves through PLACED, PREPARING, OUT_FOR_DELIVERY and DELIVERED. Each change must update the customer app, send an email receipt, send an SMS for the important steps, update the restaurant dashboard, and feed analytics. If <code>Order.setStatus()</code> calls <code>smsService.send()</code>, <code>emailService.send()</code>, <code>pushService.send()</code> and so on directly, the order class depends on every channel. Adding WhatsApp notifications means editing the order class. Testing an order means mocking five services.</p>
<h3>The fix</h3>
<p>The order keeps a list of observers behind one small interface (<code>onStatusChange(event)</code>). Channels <em>subscribe</em> themselves. When the status changes, the order loops over the list and calls each one. It knows nothing about SMS or email. A new channel is a new observer that subscribes; the order does not change.</p>
<div data-diagram="observer" data-caption="The order publishes one event; each subscribed channel decides what to do with it."></div>
<div data-code="observer"></div>
<p>Expected output:</p>
<pre><code>[order SW-1001] -> PLACED
  App push: order SW-1001 is PLACED
  Email to asha@example.com: order SW-1001 is PLACED
[order SW-1001] -> OUT_FOR_DELIVERY
  App push: order SW-1001 is OUT_FOR_DELIVERY
  Email to asha@example.com: order SW-1001 is OUT_FOR_DELIVERY
  SMS to +91-98XXXXXX01: order SW-1001 is OUT_FOR_DELIVERY
(email unsubscribed)
[order SW-1001] -> DELIVERED
  App push: order SW-1001 is DELIVERED
  SMS to +91-98XXXXXX01: order SW-1001 is DELIVERED</code></pre>
<p>Two details in the code are worth pointing out. First, <code>subscribe</code> returns an "unsubscribe" handle, the same style as browser <code>removeEventListener</code> or React's effect cleanup. Second, the subject loops over a <em>copy</em> of the observer list, so an observer that unsubscribes itself during a notification does not break the loop (in Java that would be a <code>ConcurrentModificationException</code>).</p>

<h3>Push vs pull</h3>
<div class="tabs">
<section data-tab="Push model">
<p>The subject sends the data with the notification: <code>onStatusChange(new OrderEvent("SW-1001", DELIVERED))</code>. Observers have everything they need and never call back. This is the usual choice: simple, and observers stay decoupled from the subject's class.</p>
<p>Risk: if different observers need different data, the event object keeps growing until it carries everything for everyone.</p>
</section>
<section data-tab="Pull model">
<p>The subject only says "I changed" and passes itself: <code>update(order)</code>. Each observer reads what it needs (<code>order.getStatus()</code>, <code>order.getEta()</code>). Events stay tiny, and each observer pulls only what it uses.</p>
<p>Risk: observers now depend on the subject's class, and by the time an observer reads, the state may already have changed again (it sees the latest value, not the one that triggered the call).</p>
</section>
</div>
<p>A common middle ground: push a small event with the id and what changed, and let the observer pull extra details if it needs them.</p>

<h3>The lapsed listener problem (memory leaks)</h3>
<p>The subject holds a strong reference to every observer. If an observer is forgotten but never unsubscribed, it can never be garbage collected, and it keeps receiving (and reacting to) events. This is called the <em>lapsed listener</em> problem, and it is one of the most common memory leaks in Java desktop apps, Android activities and single-page web apps. A screen that subscribes to a store each time it opens, and never unsubscribes when it closes, ends up with 50 copies running after 50 visits.</p>
<ul>
<li><strong>Always pair subscribe with unsubscribe.</strong> Return an unsubscribe handle, or implement <code>close()</code> / <code>Dispose</code> on the observer.</li>
<li><strong>Tie subscriptions to a lifecycle:</strong> Android's <code>LiveData</code> unsubscribes automatically when the screen is destroyed; React effects return a cleanup function.</li>
<li><strong>Weak references</strong> (Java <code>WeakReference</code>, JavaScript <code>WeakRef</code>) can help, but cleanup then depends on when the garbage collector runs, so behaviour becomes hard to predict. Explicit unsubscribe is better.</li>
</ul>

<h3>Observer vs pub/sub</h3>
<p>Observer is the in-process, synchronous version of publish/subscribe. The subject knows its observers directly and calls them in the same thread. In pub/sub, a broker sits in the middle: publishers send to a topic, subscribers read from it, and neither knows the other exists. The broker can buffer, retry and deliver across machines. That is what Kafka, RabbitMQ and SNS do (see <a href="#/p/message-queues">message queues and pub/sub</a>).</p>
<table>
<thead><tr><th></th><th>Observer</th><th>Pub/sub</th></tr></thead>
<tbody>
<tr><td>Who knows whom</td><td>Subject holds a list of observers</td><td>Neither side knows the other; both know the topic</td></tr>
<tr><td>Delivery</td><td>Direct method call, usually synchronous</td><td>Through a broker, usually asynchronous</td></tr>
<tr><td>Scope</td><td>One process</td><td>Across services and machines</td></tr>
<tr><td>Slow listener</td><td>Blocks the subject</td><td>Queue absorbs it</td></tr>
<tr><td>Failures</td><td>Exception in one observer can stop the rest</td><td>Retries, dead-letter queues</td></tr>
</tbody>
</table>
<p>In an LLD round, implement Observer. Then say: "in production these observers would be consumers of an <code>order-status</code> Kafka topic, so a slow SMS provider cannot slow down order updates". That is the bridge to the <a href="#/p/notification-system">notification system</a> HLD problem.</p>

<h3>When to use it, and when it is overkill</h3>
<p>Use it when one change must trigger an open-ended list of reactions: order updates, a parking lot's "spots free" display board, stock price tickers, elevator floor displays, low-stock alerts. It is overkill when there is exactly one fixed listener: just call it. Watch out for two traps: observers that throw (wrap each call in try/catch so one bad listener does not stop the others), and slow observers (one slow SMS call blocks the whole loop; hand the work to a queue or thread pool, see <a href="#/p/concurrency">concurrency</a>).</p>

<h2>State</h2>
<p><strong>Intent:</strong> let an object change its behaviour when its internal state changes, as if it changed its class. Each state is a class; the object (the <em>context</em>) forwards every action to its current state object, and the state decides what happens and which state comes next.</p>
<p>The <a href="#/p/vending-machine">vending machine</a> page teaches this pattern in depth, with a full state-by-action grid, the "why flags fail" argument and a complete implementation in five languages. Read that page for State. The short version: when the same button means different things in different modes ("select A1" before paying, after paying and while dispensing), and every method keeps checking the same mode flags, replace the flags with state classes.</p>
<p>State and Strategy have <em>identical</em> class diagrams: a context holding a reference to an interface with several implementations. Interviewers love asking how they differ.</p>
<table>
<thead><tr><th></th><th>Strategy</th><th>State</th></tr></thead>
<tbody>
<tr><td>Who chooses the implementation</td><td>The client, from outside (config, user choice)</td><td>The states themselves, from inside (each state sets the next one)</td></tr>
<tr><td>Do implementations know each other?</td><td>No. Strategies are independent</td><td>Yes. A state knows which states it can move to</td></tr>
<tr><td>How often it changes</td><td>Rarely, often once per object</td><td>Constantly, as events arrive</td></tr>
<tr><td>What it replaces</td><td>An if/else choosing an <em>algorithm</em></td><td>Mode flags checked in <em>every</em> method</td></tr>
<tr><td>Example</td><td>Pricing rule for a parking lot</td><td>Idle, HasMoney, Dispensing in a vending machine</td></tr>
</tbody>
</table>
<p><strong>Where it shows up:</strong> vending machine, <a href="#/p/elevator">elevator</a> (moving up, moving down, idle, doors open, maintenance), order and booking lifecycles (created, paid, cancelled, refunded), traffic lights, document approval flows, and the game status in <a href="#/p/tic-tac-toe">tic-tac-toe</a> or chess.</p>

<h2>Command</h2>
<p><strong>Intent:</strong> wrap a request (an action plus its arguments) in an object. Once an action is an object, you can store it, queue it, log it, send it to another thread, and undo it.</p>
<h3>The problem</h3>
<p>A text editor has a toolbar button, a keyboard shortcut and a menu item that all do "delete selection". It also needs undo and redo. If each button calls <code>document.delete(...)</code> directly, there is no record of what happened, so there is nothing to undo. You need each action to remember enough to reverse itself.</p>
<h3>The fix</h3>
<p>Four roles:</p>
<ul>
<li><strong>Command:</strong> an interface with <code>execute()</code> and <code>undo()</code>.</li>
<li><strong>Concrete commands:</strong> <code>InsertCommand</code>, <code>DeleteCommand</code>. Each stores its arguments, and anything it needs for undo (the delete command saves the text it removed).</li>
<li><strong>Receiver:</strong> the object that really does the work, here the <code>Document</code>.</li>
<li><strong>Invoker:</strong> runs commands and keeps history, here <code>History</code> with an undo stack and a redo stack.</li>
</ul>
<div data-diagram="command" data-caption="The invoker only knows the Command interface. Each command knows its receiver and how to reverse itself."></div>
<div data-code="command"></div>
<p>Expected output:</p>
<pre><code>type "Hello"             -> "Hello"
type " World"            -> "Hello World"
delete 6 at 5            -> "Hello"
undo                     -> "Hello World"
undo                     -> "Hello"
redo                     -> "Hello World"
type "!"                 -> "Hello World!"
redo (nothing to redo)   -> "Hello World!"</code></pre>
<p>The rule that trips people up: <strong>a new command clears the redo stack</strong>. After you undo twice and type something new, the undone actions belong to an abandoned timeline. Redoing them on top of the new text would corrupt the document.</p>

<h3>Beyond undo: queued jobs</h3>
<p>Because a command is just data plus behaviour, it can be put in a queue and run later or somewhere else:</p>
<ul>
<li><strong>Job queues and thread pools:</strong> Java's <code>Runnable</code> passed to an <code>ExecutorService</code> is the Command pattern. So is a task in a Celery or Sidekiq queue.</li>
<li><strong>Elevator requests:</strong> each button press becomes a <code>Request(floor, direction)</code> command queued for the scheduler.</li>
<li><strong>Macros and transactions:</strong> a <code>CompositeCommand</code> runs a list of commands and undoes them in reverse order if one fails.</li>
<li><strong>Audit logs and replay:</strong> store every command to rebuild state later. This is the idea behind event sourcing.</li>
</ul>
<h3>When to use it, and when it is overkill</h3>
<p>Use it when you need undo/redo, queuing, retries, scheduling or logging of actions. In chess, every move is a <code>MoveCommand</code> that remembers the captured piece so it can be undone. It is overkill for a plain button that calls one method with no history; a function reference or lambda is enough.</p>

<h2>Chain of Responsibility</h2>
<p><strong>Intent:</strong> pass a request along a chain of handlers. Each handler either deals with it (and may stop the chain) or passes it to the next one. The sender does not know which handler will act.</p>
<h3>The problem</h3>
<p>Every request to Razorpay's "create order" API must be authenticated, rate-limited, validated, and only then processed. Writing all of that at the top of every controller method copies the same checks into hundreds of endpoints, in slightly different orders. Changing the order of checks, or adding a new one (fraud scoring, IP block list), means editing all of them.</p>
<h3>The fix</h3>
<p>Each check becomes a handler with a <code>next</code> link. The handler does its one job; if the request fails, it returns an error and the chain stops there; if it passes, it calls <code>next.handle(request)</code>. The chain is built once, in one place, and adding a check means inserting one handler.</p>
<div data-diagram="chain" data-caption="A request walks the chain. Any handler can reject it and stop; only a clean request reaches the controller."></div>
<div data-code="chain"></div>
<p>Expected output:</p>
<pre><code>req 1 ravi -> 401 Unauthorized (stopped at auth)
req 2 asha -> 400 Bad Request: empty body (stopped at validation)
req 3 asha -> 201 Created: order for asha
req 4 asha -> 429 Too Many Requests (stopped at rate limit)</code></pre>
<p>Notice the two styles in the tabs. Java, Python and C++ use the classic linked handlers, each with a <code>next</code> field. JavaScript uses the Express.js style, where each middleware gets <code>(req, next)</code> and calls <code>next()</code> to continue. Go uses its own idiom: a middleware is a function that takes the next handler and returns a wrapped handler, as with <code>net/http</code>. Same pattern, three shapes. Order matters: put cheap checks that reject the most traffic (auth, rate limit) before expensive ones (body validation, database calls).</p>
<h3>Two flavours</h3>
<ul>
<li><strong>Stop at the first handler that can deal with it:</strong> the classic GoF (Gang of Four, the authors of the original design-patterns book) version. Example: a leave-approval chain where a team lead approves up to 2 days, a manager up to 10, and HR beyond that. Customer support escalation (bot, then L1, then L2) works the same way.</li>
<li><strong>Every handler gets a turn:</strong> the middleware version. Each one can stop the request, but if it passes, the next one runs too.</li>
</ul>
<h3>Logger levels</h3>
<p>The classic textbook example is a logger: an <code>InfoLogger</code> links to a <code>WarnLogger</code> that links to an <code>ErrorLogger</code>; each handler writes the message if its level matches, then passes it on. It is a fine way to show the pattern, and interviewers often ask for it. The <a href="#/p/logger">logger</a> problem page builds this, and discusses why a real logger usually prefers a level threshold plus a list of appenders (console, file, network) instead.</p>
<h3>When to use it, and when it is overkill</h3>
<p>Use it for request pipelines (auth, rate limit, validation), approval and escalation flows, event handling where several handlers might respond, and fallbacks (try the cache, then the replica, then the primary). Avoid it when the steps are fixed and few: three function calls in a row are simpler than a chain. The main risk is that a request can fall off the end of the chain unhandled, so always have a final default handler, like the 500 response in the code above.</p>

<h2>Template Method</h2>
<p><strong>Intent:</strong> define the skeleton of an algorithm in a base class, and let subclasses fill in some steps without changing the order of the steps.</p>
<h3>The problem</h3>
<p>Every payment at PhonePe or Razorpay follows the same steps: validate the amount, authenticate the user, work out any fee, debit the money, send a receipt. UPI, card and net banking differ only in <em>how</em> they authenticate and debit. If each payment class writes the whole flow, the common steps get copied three times, and sooner or later one copy forgets to validate the amount or to send the receipt.</p>
<h3>The fix</h3>
<p>The base class has one public method, <code>pay()</code>, that runs the steps in a fixed order. It is marked <code>final</code> (Java) or kept non-virtual (C++) so subclasses cannot change the order. The varying steps are abstract methods the subclasses must write. Optional steps are <em>hooks</em>: methods with a default (here, <code>fee()</code> returns 0) that subclasses may override.</p>
<div data-diagram="template" data-caption="pay() is the template method: a fixed order of steps. Subclasses only fill in the blanks."></div>
<div data-code="template"></div>
<p>Expected output:</p>
<pre><code>--- UPI ---
validate: Rs500 ok
auth: UPI PIN verified for asha
debit: Rs500 from bank account via NPCI
receipt: asha paid Rs500 (fee Rs0), txn UPI-1
--- CARD ---
validate: Rs1000 ok
auth: OTP (3-D Secure) verified for asha
debit: Rs1020 charged to card
receipt: asha paid Rs1020 (fee Rs20), txn CARD-2
--- NETBANKING ---
validate: Rs750 ok
auth: redirected to bank login for ravi
debit: Rs760 via bank redirect
receipt: ravi paid Rs760 (fee Rs10), txn NETBANKING-3
--- CARD ---
validate: Rs0 is invalid, aborting</code></pre>
<p>In C++ this shape has a name: the <em>non-virtual interface</em> (NVI) idiom, where the public method is non-virtual and the steps are private virtual functions. Go has no inheritance, so the Go tab passes the varying steps in as an interface value to a plain <code>Pay</code> function, and gets the default hook by embedding a small <code>NoFee</code> struct.</p>

<h3>Template Method vs Strategy</h3>
<table>
<thead><tr><th></th><th>Template Method</th><th>Strategy</th></tr></thead>
<tbody>
<tr><td>Mechanism</td><td>Inheritance: subclass overrides steps</td><td>Composition: context holds a strategy object</td></tr>
<tr><td>What varies</td><td>Some steps of one algorithm</td><td>The whole algorithm</td></tr>
<tr><td>When it is fixed</td><td>Compile time (you pick the subclass)</td><td>Runtime (you can swap it any time)</td></tr>
<tr><td>Coupling</td><td>Subclass is tied to the base class</td><td>Strategy is independent of the context</td></tr>
</tbody>
</table>
<p>Modern advice, also in <a href="#/p/design-principles">design principles</a>, is to <em>favour composition over inheritance</em>, so Strategy is usually the more flexible choice. Template Method is still the right tool when the order of steps is the important rule that must never be broken (validate before debit, always send a receipt). Frameworks use it everywhere: JUnit's <code>setUp</code> / test / <code>tearDown</code>, Android's activity lifecycle, and the game loop in <a href="#/p/tic-tac-toe">tic-tac-toe</a> (start, then take turns until someone wins, then announce the result). Avoid it when subclasses would need to override most of the steps, or when you would need two independent axes of variation (that leads to a subclass explosion: <code>UpiWithCashback</code>, <code>CardWithCashback</code>...).</p>

<h2>Iterator</h2>
<p><strong>Intent:</strong> give a way to visit every element of a collection one by one without exposing how the collection is stored inside.</p>
<h3>The problem</h3>
<p>You built a binary search tree, a ring buffer or a paginated list of orders. Callers want to loop over it. If they have to know about <code>left</code> and <code>right</code> pointers, or page tokens, your internal structure leaks into every caller, and you can never change it.</p>
<h3>The fix</h3>
<p>The collection hands out an iterator object with two operations: "is there another?" and "give me the next one". The iterator keeps its own position, so two loops over the same tree do not disturb each other. Every modern language builds its <code>for</code> loop on this pattern, so plugging into it makes your collection feel native:</p>
<ul>
<li><strong>Java:</strong> implement <code>Iterable&lt;T&gt;</code> and return an <code>Iterator&lt;T&gt;</code>; for-each loops then work.</li>
<li><strong>Python:</strong> write <code>__iter__</code>; the easiest way is a generator with <code>yield</code>.</li>
<li><strong>C++:</strong> provide <code>begin()</code> and <code>end()</code> returning an iterator class with <code>*</code>, <code>++</code> and <code>!=</code>; range-for then works.</li>
<li><strong>JavaScript:</strong> define <code>[Symbol.iterator]</code>, usually as a generator function (<code>*</code>).</li>
<li><strong>Go:</strong> since Go 1.23, return an <code>iter.Seq[T]</code> and loop with <code>for v := range tree.All()</code>. <code>iter.Pull</code> turns it into a next-style cursor.</li>
</ul>
<div data-diagram="iterator" data-caption="The tree hands out iterators. Each one keeps its own stack, so several can run at once."></div>
<div data-code="iterator"></div>
<p>Expected output:</p>
<pre><code>In order: 20 30 40 50 60 70 80
Smallest 3: 20 30 40
Independent cursors: a -> 40, b -> 20</code></pre>
<p>The in-order iterator holds only one root-to-leaf path on its stack, so it uses O(h) memory, where h is the tree height, instead of copying all n values into a list first. "Implement a BST iterator with <code>next()</code> and <code>hasNext()</code>" is also a well-known coding question (LeetCode 173), so this one pays twice.</p>
<h3>Generators: iterators for free</h3>
<p>A <em>generator</em> is a function that can pause. Each <code>yield</code> hands one value to the caller and freezes the function until the next value is asked for. The language turns it into an iterator for you, so you do not write the state machine by hand. Generators are <em>lazy</em>: the "Smallest 3" loop above stops after three values, and the rest of the tree is never visited. That makes them perfect for paginated APIs ("yield each order, fetch the next page only when needed"), reading huge files line by line, and infinite sequences like ID generators.</p>
<p><strong>Watch out:</strong> changing a collection while iterating over it. Java's built-in collections detect this and throw <code>ConcurrentModificationException</code> (they are <em>fail-fast</em>). Concurrent collections like <code>CopyOnWriteArrayList</code> instead iterate over a snapshot (<em>fail-safe</em>). For your own collection, decide which behaviour you want and say so.</p>
<p><strong>When it is overkill:</strong> if your class just wraps a list, return a read-only view of the list (or expose its iterator). Write a custom iterator only when the walk itself is non-trivial: trees, graphs, merged sorted streams, pages from an API.</p>

<h2>The brief ones: Mediator, Memento, Visitor</h2>
<h3>Mediator</h3>
<p><strong>Intent:</strong> instead of objects talking to each other directly (which makes a tangled web of N × N links), they all talk to one hub that routes messages. The textbook example is air-traffic control: planes do not radio each other about who lands next, they all talk to the tower. A chat room is the LLD version: a <code>User</code> calls <code>room.send(this, text)</code>, and the <code>ChatRoom</code> decides who receives it (everyone, one person, or nobody if the sender is muted).</p>
<div data-diagram="mediator" data-caption="Every user talks only to the room. Adding a user adds one link, not N."></div>
<p>It differs from Observer in that the mediator holds the <em>coordination logic</em> (muting, routing, turn order), not just a list of listeners. The risk is that the mediator becomes a god class that knows everything. Use it for chat rooms, UI forms where fields enable or disable each other, and the controller that coordinates several elevator cars.</p>
<h3>Memento</h3>
<p><strong>Intent:</strong> capture an object's internal state as a snapshot (the <em>memento</em>) so it can be restored later, without exposing its fields to the outside world. Three roles: the <em>originator</em> (the editor) creates and restores mementos; the <em>caretaker</em> (the history) stores them but never looks inside; the memento itself is an opaque, read-only value.</p>
<pre><code>Snapshot s = editor.save();   // caretaker stores s, cannot read it
editor.type(" more text");
editor.restore(s);            // back to how it was</code></pre>
<p>Memento vs Command for undo: Command stores <em>how to reverse</em> each change (small, but every command needs a correct <code>undo()</code>). Memento stores <em>the whole state</em> before a change (simple and always correct, but memory-hungry for large objects). Games use mementos for save points; editors usually use commands, with an occasional full snapshot as a checkpoint. In <a href="#/p/tic-tac-toe">board games</a>, a memento of the board is an easy way to support "undo last move".</p>
<h3>Visitor</h3>
<p><strong>Intent:</strong> add new operations to a stable class hierarchy without editing those classes. Each element class gets one method, <code>accept(visitor)</code>, which calls back <code>visitor.visitFile(this)</code> or <code>visitor.visitFolder(this)</code>. This trick is called <em>double dispatch</em>: the method that runs depends on both the element's type and the visitor's type. A new operation (compute total size, export to JSON, search by name) is a new visitor class; the <code>File</code> and <code>Folder</code> classes stay untouched.</p>
<p>The trade-off is the mirror image of normal OOP: adding operations becomes easy, but adding a new element type (say <code>Symlink</code>) means editing every visitor. So use it only when the set of types is stable and the set of operations keeps growing. Compilers are the classic case: the syntax tree types rarely change, but new passes (type checking, optimisation, code generation) keep arriving. In LLD rounds it is rare. Mention it for an in-memory file system or a tax calculator over different item types, and do not force it elsewhere. In languages with pattern matching (Java 21 <code>switch</code> on sealed types, Python <code>match</code>), a plain switch over the types often replaces Visitor.</p>

<h2>Which pattern for which interview problem</h2>
<p>Interviewers do not ask "implement the Observer pattern". They ask "design a parking lot" and watch whether the right patterns appear naturally. Here is where each common problem uses behavioural patterns:</p>
<table>
<thead><tr><th>Problem</th><th>Behavioural patterns</th><th>Where exactly</th></tr></thead>
<tbody>
<tr><td><a href="#/p/parking-lot">Parking lot</a></td><td>Strategy, Observer</td><td>Spot allocation (nearest, by floor) and fee rules (hourly, flat, weekend) as strategies; the entrance display board observes free-spot counts.</td></tr>
<tr><td><a href="#/p/elevator">Elevator</a></td><td>State, Strategy, Command, Observer</td><td>Each car's state (idle, moving, doors open, maintenance); scheduling algorithm (nearest car, SCAN) as a strategy; button presses as queued request commands; floor displays observe car position.</td></tr>
<tr><td><a href="#/p/vending-machine">Vending machine</a></td><td>State, Strategy</td><td>Idle, HasMoney, Dispensing, OutOfService states; change-making as a strategy.</td></tr>
<tr><td><a href="#/p/logger">Logger</a></td><td>Chain of Responsibility, Strategy, Observer</td><td>Level handlers in a chain; formatters as strategies; appenders (console, file, network) subscribed like observers.</td></tr>
<tr><td><a href="#/p/splitwise">Splitwise</a></td><td>Strategy, Observer</td><td>Equal, exact and percentage splits as strategies (with validation that shares add up); group members notified when an expense is added.</td></tr>
<tr><td>BookMyShow</td><td>State, Strategy, Observer, Template Method</td><td>Booking lifecycle (seats held, paid, confirmed, expired); pricing (weekday, premium seats) and payment method as strategies; waitlisted users notified when seats free up; a payment flow skeleton.</td></tr>
<tr><td>Chess</td><td>Command, Memento, State, Strategy</td><td>Each move as a command (undo, move history, replay); board snapshots for undo; game status (in progress, check, checkmate, draw); move rules per piece type, or an AI difficulty as a strategy.</td></tr>
<tr><td><a href="#/p/notification-system">Notification system</a></td><td>Observer, Strategy, Chain, Template Method</td><td>Channels subscribe to events; channel choice per user preference as a strategy; fallback chain (push, then SMS, then email); a fixed send pipeline (render template, check opt-out, send, record).</td></tr>
</tbody>
</table>
<div class="callout tip"><strong>A shortcut that works</strong>Listen for the trigger words. "Different ways to calculate..." means Strategy. "Notify / update / alert when..." means Observer. "Depending on whether it is currently..." means State. "Undo, history, queue, retry" means Command. "Validate, then check, then..." or "escalate" means Chain. "All X follow the same steps, but..." means Template Method.</div>

<h2>Common mistakes</h2>
<div class="callout warn"><strong>Things that lose marks</strong>
<ul>
<li><strong>Pattern-first design.</strong> Starting with "I will use Observer, Strategy and Visitor" before understanding the problem. Name a pattern only when a real need shows up.</li>
<li><strong>Calling everything Strategy.</strong> If the implementations switch each other on events, it is State. Know the difference and say it.</li>
<li><strong>Forgetting to unsubscribe</strong> observers, or letting one failing observer stop the rest.</li>
<li><strong>Undo without clearing redo</strong> when a new command runs.</li>
<li><strong>A chain with no end:</strong> requests that fall off the last handler and silently disappear.</li>
<li><strong>Template Method with a non-final skeleton,</strong> so a subclass can override <code>pay()</code> and skip validation.</li>
<li><strong>Interfaces for one implementation</strong> "for future flexibility" everywhere. One or two well-placed patterns beat seven forced ones.</li>
</ul>
</div>

<div class="callout interview"><strong>Say this in the interview</strong>"The fee rules will keep changing, so I will put them behind a <code>PricingStrategy</code> interface and inject it, which keeps the lot class closed for modification. For status updates I will use Observer: the order exposes subscribe and unsubscribe, and SMS, email and push are separate observers, so adding WhatsApp is one new class. In production those observers would read from a Kafka topic so a slow SMS provider cannot block the order flow. The machine itself changes behaviour by mode, so that part is State, not Strategy: the states pick the next state themselves."</div>

<h2>Test yourself</h2>
<div class="quiz">
<details><summary>State and Strategy have the same class diagram. How do you tell them apart in a design?</summary><div>Ask who changes the implementation and why. In Strategy, the client chooses an algorithm from outside, usually once (a coupon rule, a routing mode), and strategies do not know about each other. In State, the state objects switch the context to the next state themselves as events arrive, and each state knows its possible successors. Strategy replaces an if/else that picks an algorithm; State replaces mode flags checked in every method.</div></details>
<details><summary>Your app's memory grows every time a user opens and closes the order-tracking screen. What is the likely cause?</summary><div>The lapsed listener problem. The screen subscribes to the order (the subject) when it opens but never unsubscribes when it closes. The subject's list keeps a strong reference to each old screen, so none can be garbage collected, and all of them keep reacting to updates. Fix it by unsubscribing on close: return an unsubscribe handle from <code>subscribe</code>, or tie the subscription to the screen's lifecycle.</div></details>
<details><summary>A user types A, types B, undoes once, then types C. What should redo do now, and why?</summary><div>Nothing. Running a new command (type C) must clear the redo stack. The undone "type B" belonged to a timeline the user abandoned when they typed C. Re-applying it on top of the new text could insert B at a position that no longer makes sense and corrupt the document.</div></details>
<details><summary>When would you choose Memento over Command for undo?</summary><div>When writing a correct inverse for every action is hard or impossible, and the state is small enough to copy. A board game's board (64 squares) is cheap to snapshot, so a memento per move is simple and always correct. A large document is expensive to copy on every keystroke, so editors use commands with small inverses, sometimes with periodic full snapshots as checkpoints.</div></details>
<details><summary>In an API middleware chain, why should auth and rate limiting come before body validation?</summary><div>Cheap checks that reject the most bad traffic should run first, so you spend as little work as possible on requests you will reject anyway. Auth also has to come before anything that uses the user identity, like a per-user rate limit. Rate limiting before validation also protects the server from attackers flooding it with huge or malformed bodies.</div></details>
<details><summary>Template Method or Strategy for a payment flow with UPI, card and net banking?</summary><div>Both can work. Template Method fits when the order of steps is the rule that must never break (validate, authenticate, debit, receipt): the base class fixes the order and subclasses fill in auth and debit. Strategy (a <code>PaymentMethod</code> interface the checkout holds) is more flexible: you can choose the method at runtime and combine it with other variations, like cashback rules, without a subclass for every combination. A good answer often uses both: a fixed flow that calls a pluggable payment-method strategy for the varying steps.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
<li>Behavioural patterns move changing behaviour behind an interface, so new variants are new classes, not edits to old ones (open/closed principle).</li>
<li><strong>Strategy</strong> swaps algorithms chosen from outside; in Python, JavaScript and Go a function is often all the strategy you need.</li>
<li><strong>Observer</strong> lets one change notify many listeners. Return an unsubscribe handle, iterate over a copy, and remember it is the in-process cousin of pub/sub.</li>
<li><strong>State</strong> looks like Strategy, but the states switch themselves. See the vending machine page for the full treatment.</li>
<li><strong>Command</strong> turns actions into objects: undo/redo with two stacks (a new command clears redo), queues, retries and audit logs.</li>
<li><strong>Chain of Responsibility</strong> builds pipelines like middleware and escalations. Order handlers cheapest-first and always end with a default.</li>
<li><strong>Template Method</strong> fixes the order of steps in a final method; <strong>Iterator</strong> hides how a collection is stored, and generators make it nearly free.</li>
<li>Pick patterns from the problem, not the other way round. One or two well-placed patterns beat a page full of forced ones.</li>
</ul></div>
`,
  code: {
    strategy: {
      title: "Strategy: discount rules at checkout",
      java: String.raw`// Strategy: swap discount rules at checkout without editing Checkout.
// Run: javac StrategyDemo.java && java StrategyDemo
public class StrategyDemo {

    // One method, so it is also a functional interface: a lambda can be a strategy.
    @FunctionalInterface
    interface DiscountStrategy {
        int discount(int amount); // rupees off for this cart amount
    }

    static class NoDiscount implements DiscountStrategy {
        public int discount(int amount) { return 0; }
    }

    // Rs off when the cart is at least minOrder.
    static class FlatDiscount implements DiscountStrategy {
        private final int off, minOrder;
        FlatDiscount(int off, int minOrder) { this.off = off; this.minOrder = minOrder; }
        public int discount(int amount) { return amount >= minOrder ? off : 0; }
    }

    // percent off, but never more than cap rupees.
    static class PercentDiscount implements DiscountStrategy {
        private final int percent, cap;
        PercentDiscount(int percent, int cap) { this.percent = percent; this.cap = cap; }
        public int discount(int amount) { return Math.min(amount * percent / 100, cap); }
    }

    // Context: knows nothing about how any discount is computed.
    static class Checkout {
        private DiscountStrategy strategy = new NoDiscount();
        void setStrategy(DiscountStrategy strategy) { this.strategy = strategy; }
        int payable(int amount) {
            int off = Math.min(strategy.discount(amount), amount); // never pay below zero
            return amount - off;
        }
    }

    static void show(Checkout checkout, String label, int amount) {
        System.out.println(String.format("%-24s -> pay Rs%d", label, checkout.payable(amount)));
    }

    public static void main(String[] args) {
        int cart = 2400;
        Checkout checkout = new Checkout();
        System.out.println("Cart total: Rs" + cart);
        show(checkout, "No coupon", cart);

        checkout.setStrategy(new FlatDiscount(200, 999));
        show(checkout, "FLAT200 (min Rs999)", cart);
        show(checkout, "FLAT200 on Rs800 cart", 800);

        checkout.setStrategy(new PercentDiscount(10, 150));
        show(checkout, "10% off, max Rs150", cart);

        // A one-off rule needs no class at all.
        checkout.setStrategy(amount -> amount * 5 / 100);
        show(checkout, "Bank offer 5% (lambda)", cart);
    }
}`,
      python: String.raw`# Strategy with plain functions: in Python a strategy is usually just a callable.
from typing import Callable

Discount = Callable[[int], int]  # cart amount -> rupees off


def no_discount(amount: int) -> int:
    return 0


def flat(off: int, min_order: int) -> Discount:
    """Factory: returns a strategy that remembers its settings (a closure)."""
    def rule(amount: int) -> int:
        return off if amount >= min_order else 0
    return rule


def percent(pct: int, cap: int) -> Discount:
    def rule(amount: int) -> int:
        return min(amount * pct // 100, cap)
    return rule


class Checkout:
    """Context: holds one strategy and knows nothing about how it works."""

    def __init__(self, strategy: Discount = no_discount) -> None:
        self.strategy = strategy

    def payable(self, amount: int) -> int:
        off = min(self.strategy(amount), amount)  # never pay below zero
        return amount - off


def show(checkout: Checkout, label: str, amount: int) -> None:
    print(f"{label:<24} -> pay Rs{checkout.payable(amount)}")


def main() -> None:
    cart = 2400
    checkout = Checkout()
    print(f"Cart total: Rs{cart}")
    show(checkout, "No coupon", cart)

    checkout.strategy = flat(200, 999)
    show(checkout, "FLAT200 (min Rs999)", cart)
    show(checkout, "FLAT200 on Rs800 cart", 800)

    checkout.strategy = percent(10, 150)
    show(checkout, "10% off, max Rs150", cart)

    checkout.strategy = lambda amount: amount * 5 // 100
    show(checkout, "Bank offer 5% (lambda)", cart)


if __name__ == "__main__":
    main()`,
      cpp: String.raw`// Strategy: swap discount rules at checkout without editing Checkout.
#include <algorithm>
#include <functional>
#include <iomanip>
#include <iostream>
#include <memory>
#include <string>
#include <utility>

struct DiscountStrategy {
    virtual ~DiscountStrategy() = default;
    virtual int discount(int amount) const = 0;  // rupees off
};

struct NoDiscount : DiscountStrategy {
    int discount(int) const override { return 0; }
};

class FlatDiscount : public DiscountStrategy {
    int off_, minOrder_;
public:
    FlatDiscount(int off, int minOrder) : off_(off), minOrder_(minOrder) {}
    int discount(int amount) const override { return amount >= minOrder_ ? off_ : 0; }
};

class PercentDiscount : public DiscountStrategy {
    int percent_, cap_;
public:
    PercentDiscount(int percent, int cap) : percent_(percent), cap_(cap) {}
    int discount(int amount) const override { return std::min(amount * percent_ / 100, cap_); }
};

// Adapter: any lambda becomes a strategy, so a one-off rule needs no new class.
class FnDiscount : public DiscountStrategy {
    std::function<int(int)> fn_;
public:
    explicit FnDiscount(std::function<int(int)> fn) : fn_(std::move(fn)) {}
    int discount(int amount) const override { return fn_(amount); }
};

// Context: owns one strategy and knows nothing about how it works.
class Checkout {
    std::unique_ptr<DiscountStrategy> strategy_ = std::make_unique<NoDiscount>();
public:
    void setStrategy(std::unique_ptr<DiscountStrategy> s) { strategy_ = std::move(s); }
    int payable(int amount) const {
        int off = std::min(strategy_->discount(amount), amount);  // never below zero
        return amount - off;
    }
};

void show(const Checkout& checkout, const std::string& label, int amount) {
    std::cout << std::left << std::setw(24) << label << " -> pay Rs" << checkout.payable(amount) << "\n";
}

int main() {
    const int cart = 2400;
    Checkout checkout;
    std::cout << "Cart total: Rs" << cart << "\n";
    show(checkout, "No coupon", cart);

    checkout.setStrategy(std::make_unique<FlatDiscount>(200, 999));
    show(checkout, "FLAT200 (min Rs999)", cart);
    show(checkout, "FLAT200 on Rs800 cart", 800);

    checkout.setStrategy(std::make_unique<PercentDiscount>(10, 150));
    show(checkout, "10% off, max Rs150", cart);

    checkout.setStrategy(std::make_unique<FnDiscount>([](int amount) { return amount * 5 / 100; }));
    show(checkout, "Bank offer 5% (lambda)", cart);
}`,
      javascript: String.raw`// Strategy with plain functions: in JavaScript a strategy is usually just a function.

const noDiscount = () => 0;

// Factories return a strategy that remembers its settings (a closure).
function flat(off, minOrder) {
  return (amount) => (amount >= minOrder ? off : 0);
}

function percent(pct, cap) {
  return (amount) => Math.min(Math.floor((amount * pct) / 100), cap);
}

// Context: holds one strategy and knows nothing about how it works.
class Checkout {
  constructor(strategy = noDiscount) {
    this.strategy = strategy;
  }

  payable(amount) {
    const off = Math.min(this.strategy(amount), amount); // never pay below zero
    return amount - off;
  }
}

function show(checkout, label, amount) {
  console.log(label.padEnd(24) + " -> pay Rs" + checkout.payable(amount));
}

const cart = 2400;
const checkout = new Checkout();
console.log("Cart total: Rs" + cart);
show(checkout, "No coupon", cart);

checkout.strategy = flat(200, 999);
show(checkout, "FLAT200 (min Rs999)", cart);
show(checkout, "FLAT200 on Rs800 cart", 800);

checkout.strategy = percent(10, 150);
show(checkout, "10% off, max Rs150", cart);

checkout.strategy = (amount) => Math.floor((amount * 5) / 100);
show(checkout, "Bank offer 5% (lambda)", cart);`,
      go: String.raw`// Strategy in Go: a one-method interface, plus a func type that satisfies it
// (the same trick as http.HandlerFunc).
package main

import "fmt"

type DiscountStrategy interface {
	Discount(amount int) int // rupees off
}

// DiscountFunc lets any plain function be used as a strategy.
type DiscountFunc func(amount int) int

func (f DiscountFunc) Discount(amount int) int { return f(amount) }

type NoDiscount struct{}

func (NoDiscount) Discount(int) int { return 0 }

type FlatDiscount struct{ Off, MinOrder int }

func (f FlatDiscount) Discount(amount int) int {
	if amount >= f.MinOrder {
		return f.Off
	}
	return 0
}

type PercentDiscount struct{ Percent, Cap int }

func (p PercentDiscount) Discount(amount int) int {
	return min(amount*p.Percent/100, p.Cap)
}

// Checkout is the context: it only knows the interface.
type Checkout struct {
	Strategy DiscountStrategy
}

func (c *Checkout) Payable(amount int) int {
	off := min(c.Strategy.Discount(amount), amount) // never pay below zero
	return amount - off
}

func show(c *Checkout, label string, amount int) {
	fmt.Printf("%-24s -> pay Rs%d\n", label, c.Payable(amount))
}

func main() {
	cart := 2400
	checkout := &Checkout{Strategy: NoDiscount{}}
	fmt.Printf("Cart total: Rs%d\n", cart)
	show(checkout, "No coupon", cart)

	checkout.Strategy = FlatDiscount{Off: 200, MinOrder: 999}
	show(checkout, "FLAT200 (min Rs999)", cart)
	show(checkout, "FLAT200 on Rs800 cart", 800)

	checkout.Strategy = PercentDiscount{Percent: 10, Cap: 150}
	show(checkout, "10% off, max Rs150", cart)

	checkout.Strategy = DiscountFunc(func(amount int) int { return amount * 5 / 100 })
	show(checkout, "Bank offer 5% (lambda)", cart)
}`,
    },

    observer: {
      title: "Observer: order status to app, email and SMS",
      java: String.raw`// Observer: an order notifies every subscribed channel when its status changes.
// Run: javac ObserverDemo.java && java ObserverDemo
import java.util.*;

public class ObserverDemo {

    enum Status { PLACED, PREPARING, OUT_FOR_DELIVERY, DELIVERED }

    // Push model: the event carries what observers need.
    record OrderEvent(String orderId, Status status) {}

    interface OrderObserver {
        void onStatusChange(OrderEvent e);
    }

    static class AppPushNotifier implements OrderObserver {
        public void onStatusChange(OrderEvent e) {
            System.out.println("  App push: order " + e.orderId() + " is " + e.status());
        }
    }

    static class EmailNotifier implements OrderObserver {
        private final String email;
        EmailNotifier(String email) { this.email = email; }
        public void onStatusChange(OrderEvent e) {
            System.out.println("  Email to " + email + ": order " + e.orderId() + " is " + e.status());
        }
    }

    // SMS costs money, so this observer filters to the important updates.
    static class SmsNotifier implements OrderObserver {
        private static final Set<Status> IMPORTANT = EnumSet.of(Status.OUT_FOR_DELIVERY, Status.DELIVERED);
        private final String phone;
        SmsNotifier(String phone) { this.phone = phone; }
        public void onStatusChange(OrderEvent e) {
            if (!IMPORTANT.contains(e.status())) return;
            System.out.println("  SMS to " + phone + ": order " + e.orderId() + " is " + e.status());
        }
    }

    // Subject: knows observers only through the interface.
    static class Order {
        private final String id;
        private Status status;
        private final Map<Integer, OrderObserver> observers = new LinkedHashMap<>();
        private int nextId = 0;

        Order(String id) { this.id = id; }

        // Returns an unsubscribe handle; the caller must keep it to avoid leaks.
        Runnable subscribe(OrderObserver o) {
            int subId = nextId++;
            observers.put(subId, o);
            return () -> observers.remove(subId);
        }

        void setStatus(Status s) {
            status = s;
            System.out.println("[order " + id + "] -> " + status);
            OrderEvent event = new OrderEvent(id, status);
            // Iterate over a copy so an observer may unsubscribe while being notified.
            for (OrderObserver o : new ArrayList<>(observers.values())) {
                try {
                    o.onStatusChange(event);
                } catch (RuntimeException ex) {
                    System.out.println("  observer failed: " + ex.getMessage()); // one bad observer must not stop the rest
                }
            }
        }
    }

    public static void main(String[] args) {
        Order order = new Order("SW-1001");
        order.subscribe(new AppPushNotifier());
        Runnable stopEmail = order.subscribe(new EmailNotifier("asha@example.com"));
        order.subscribe(new SmsNotifier("+91-98XXXXXX01"));

        order.setStatus(Status.PLACED);
        order.setStatus(Status.OUT_FOR_DELIVERY);

        stopEmail.run();
        System.out.println("(email unsubscribed)");
        order.setStatus(Status.DELIVERED);
    }
}`,
      python: String.raw`# Observer: an order notifies every subscribed channel when its status changes.
# Observers are plain callables; subscribe() returns an unsubscribe function.
from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class OrderEvent:  # push model: the event carries what observers need
    order_id: str
    status: str


Observer = Callable[[OrderEvent], None]


class Order:
    """Subject: keeps observers and calls them on every status change."""

    def __init__(self, order_id: str) -> None:
        self.order_id = order_id
        self.status = ""
        self._observers: dict[int, Observer] = {}  # dicts keep insertion order
        self._next_id = 0

    def subscribe(self, observer: Observer) -> Callable[[], None]:
        sub_id = self._next_id
        self._next_id += 1
        self._observers[sub_id] = observer
        return lambda: self._observers.pop(sub_id, None)

    def set_status(self, status: str) -> None:
        self.status = status
        print(f"[order {self.order_id}] -> {status}")
        event = OrderEvent(self.order_id, status)
        # Iterate over a copy so an observer may unsubscribe while being notified.
        for observer in list(self._observers.values()):
            try:
                observer(event)
            except Exception as ex:  # one bad observer must not stop the rest
                print(f"  observer failed: {ex}")


def app_push(e: OrderEvent) -> None:
    print(f"  App push: order {e.order_id} is {e.status}")


def email(address: str) -> Observer:
    def notify(e: OrderEvent) -> None:
        print(f"  Email to {address}: order {e.order_id} is {e.status}")
    return notify


def sms(phone: str) -> Observer:
    important = {"OUT_FOR_DELIVERY", "DELIVERED"}  # SMS costs money

    def notify(e: OrderEvent) -> None:
        if e.status in important:
            print(f"  SMS to {phone}: order {e.order_id} is {e.status}")
    return notify


def main() -> None:
    order = Order("SW-1001")
    order.subscribe(app_push)
    stop_email = order.subscribe(email("asha@example.com"))
    order.subscribe(sms("+91-98XXXXXX01"))

    order.set_status("PLACED")
    order.set_status("OUT_FOR_DELIVERY")

    stop_email()
    print("(email unsubscribed)")
    order.set_status("DELIVERED")


if __name__ == "__main__":
    main()`,
      cpp: String.raw`// Observer: an order notifies every subscribed channel when its status changes.
#include <functional>
#include <iostream>
#include <map>
#include <set>
#include <string>
#include <vector>

struct OrderEvent {  // push model: the event carries what observers need
    std::string orderId;
    std::string status;
};

using Observer = std::function<void(const OrderEvent&)>;

class Order {
    std::string id_;
    std::string status_;
    std::map<int, Observer> observers_;  // ordered by subscription id
    int nextId_ = 0;

public:
    explicit Order(std::string id) : id_(std::move(id)) {}

    // Returns an unsubscribe handle. It captures this, so the order must outlive it.
    std::function<void()> subscribe(Observer o) {
        int subId = nextId_++;
        observers_[subId] = std::move(o);
        return [this, subId] { observers_.erase(subId); };
    }

    void setStatus(const std::string& status) {
        status_ = status;
        std::cout << "[order " << id_ << "] -> " << status_ << "\n";
        OrderEvent event{id_, status_};
        // Copy first, so an observer may unsubscribe while being notified.
        std::vector<Observer> snapshot;
        for (const auto& entry : observers_) snapshot.push_back(entry.second);
        for (const auto& o : snapshot) {
            try {
                o(event);
            } catch (const std::exception& ex) {  // one bad observer must not stop the rest
                std::cout << "  observer failed: " << ex.what() << "\n";
            }
        }
    }
};

Observer appPush() {
    return [](const OrderEvent& e) {
        std::cout << "  App push: order " << e.orderId << " is " << e.status << "\n";
    };
}

Observer email(const std::string& address) {
    return [address](const OrderEvent& e) {
        std::cout << "  Email to " << address << ": order " << e.orderId << " is " << e.status << "\n";
    };
}

Observer sms(const std::string& phone) {
    const std::set<std::string> important{"OUT_FOR_DELIVERY", "DELIVERED"};  // SMS costs money
    return [phone, important](const OrderEvent& e) {
        if (!important.count(e.status)) return;
        std::cout << "  SMS to " << phone << ": order " << e.orderId << " is " << e.status << "\n";
    };
}

int main() {
    Order order("SW-1001");
    order.subscribe(appPush());
    auto stopEmail = order.subscribe(email("asha@example.com"));
    order.subscribe(sms("+91-98XXXXXX01"));

    order.setStatus("PLACED");
    order.setStatus("OUT_FOR_DELIVERY");

    stopEmail();
    std::cout << "(email unsubscribed)\n";
    order.setStatus("DELIVERED");
}`,
      javascript: String.raw`// Observer: an order notifies every subscribed channel when its status changes.
// Observers are plain functions; subscribe() returns an unsubscribe function,
// the same style as removeEventListener or a React effect cleanup.

class Order {
  constructor(id) {
    this.id = id;
    this.status = "";
    this.observers = new Set(); // keeps insertion order
  }

  subscribe(observer) {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  setStatus(status) {
    this.status = status;
    console.log("[order " + this.id + "] -> " + status);
    const event = { orderId: this.id, status }; // push model
    // Iterate over a copy so an observer may unsubscribe while being notified.
    for (const observer of [...this.observers]) {
      try {
        observer(event);
      } catch (err) {
        console.log("  observer failed: " + err.message); // one bad observer must not stop the rest
      }
    }
  }
}

const appPush = (e) => console.log("  App push: order " + e.orderId + " is " + e.status);

function email(address) {
  return (e) => console.log("  Email to " + address + ": order " + e.orderId + " is " + e.status);
}

function sms(phone) {
  const important = new Set(["OUT_FOR_DELIVERY", "DELIVERED"]); // SMS costs money
  return (e) => {
    if (!important.has(e.status)) return;
    console.log("  SMS to " + phone + ": order " + e.orderId + " is " + e.status);
  };
}

const order = new Order("SW-1001");
order.subscribe(appPush);
const stopEmail = order.subscribe(email("asha@example.com"));
order.subscribe(sms("+91-98XXXXXX01"));

order.setStatus("PLACED");
order.setStatus("OUT_FOR_DELIVERY");

stopEmail();
console.log("(email unsubscribed)");
order.setStatus("DELIVERED");`,
      go: String.raw`// Observer: an order notifies every subscribed channel when its status changes.
// Observers are functions; Subscribe returns a function that unsubscribes.
package main

import "fmt"

type OrderEvent struct { // push model: the event carries what observers need
	OrderID string
	Status  string
}

type Observer func(e OrderEvent)

type subscription struct {
	id int
	fn Observer
}

type Order struct {
	ID     string
	status string
	subs   []subscription // funcs are not comparable, so each gets an id
	nextID int
}

func (o *Order) Subscribe(fn Observer) (unsubscribe func()) {
	id := o.nextID
	o.nextID++
	o.subs = append(o.subs, subscription{id, fn})
	return func() {
		kept := make([]subscription, 0, len(o.subs))
		for _, s := range o.subs {
			if s.id != id {
				kept = append(kept, s)
			}
		}
		o.subs = kept
	}
}

func (o *Order) SetStatus(status string) {
	o.status = status
	fmt.Printf("[order %s] -> %s\n", o.ID, status)
	event := OrderEvent{OrderID: o.ID, Status: status}
	// Iterate over a copy so an observer may unsubscribe while being notified.
	snapshot := append([]subscription(nil), o.subs...)
	for _, s := range snapshot {
		s.fn(event)
	}
}

func appPush(e OrderEvent) {
	fmt.Printf("  App push: order %s is %s\n", e.OrderID, e.Status)
}

func email(address string) Observer {
	return func(e OrderEvent) {
		fmt.Printf("  Email to %s: order %s is %s\n", address, e.OrderID, e.Status)
	}
}

func sms(phone string) Observer {
	important := map[string]bool{"OUT_FOR_DELIVERY": true, "DELIVERED": true} // SMS costs money
	return func(e OrderEvent) {
		if !important[e.Status] {
			return
		}
		fmt.Printf("  SMS to %s: order %s is %s\n", phone, e.OrderID, e.Status)
	}
}

func main() {
	order := &Order{ID: "SW-1001"}
	order.Subscribe(appPush)
	stopEmail := order.Subscribe(email("asha@example.com"))
	order.Subscribe(sms("+91-98XXXXXX01"))

	order.SetStatus("PLACED")
	order.SetStatus("OUT_FOR_DELIVERY")

	stopEmail()
	fmt.Println("(email unsubscribed)")
	order.SetStatus("DELIVERED")
}`,
    },

    command: {
      title: "Command: text editor with undo and redo",
      java: String.raw`// Command: every edit is an object that can execute and undo itself.
// Run: javac CommandDemo.java && java CommandDemo
import java.util.ArrayDeque;
import java.util.Deque;

public class CommandDemo {

    // Receiver: the object that really changes.
    static class Document {
        private final StringBuilder text = new StringBuilder();
        void insert(int pos, String s) { text.insert(pos, s); }
        String delete(int pos, int len) {
            String removed = text.substring(pos, pos + len);
            text.delete(pos, pos + len);
            return removed;
        }
        int length() { return text.length(); }
        @Override public String toString() { return text.toString(); }
    }

    interface Command {
        void execute();
        void undo();
        String describe();
    }

    static class InsertCommand implements Command {
        private final Document doc;
        private final int pos;
        private final String s;
        InsertCommand(Document doc, int pos, String s) { this.doc = doc; this.pos = pos; this.s = s; }
        public void execute() { doc.insert(pos, s); }
        public void undo() { doc.delete(pos, s.length()); }
        public String describe() { return "type \"" + s + "\""; }
    }

    static class DeleteCommand implements Command {
        private final Document doc;
        private final int pos, len;
        private String removed = ""; // saved on execute, needed for undo
        DeleteCommand(Document doc, int pos, int len) { this.doc = doc; this.pos = pos; this.len = len; }
        public void execute() { removed = doc.delete(pos, len); }
        public void undo() { doc.insert(pos, removed); }
        public String describe() { return "delete " + len + " at " + pos; }
    }

    // Invoker: runs commands and keeps the two history stacks.
    static class History {
        private final Deque<Command> undoStack = new ArrayDeque<>();
        private final Deque<Command> redoStack = new ArrayDeque<>();

        void run(Command c) {
            c.execute();
            undoStack.push(c);
            redoStack.clear(); // a new action abandons the undone timeline
        }
        boolean undo() {
            if (undoStack.isEmpty()) return false;
            Command c = undoStack.pop();
            c.undo();
            redoStack.push(c);
            return true;
        }
        boolean redo() {
            if (redoStack.isEmpty()) return false;
            Command c = redoStack.pop();
            c.execute();
            undoStack.push(c);
            return true;
        }
    }

    static void print(String label, Document doc) {
        System.out.println(String.format("%-24s -> \"%s\"", label, doc));
    }

    public static void main(String[] args) {
        Document doc = new Document();
        History history = new History();

        Command[] edits = {
            new InsertCommand(doc, 0, "Hello"),
            new InsertCommand(doc, 5, " World"),
            new DeleteCommand(doc, 5, 6),
        };
        for (Command c : edits) { history.run(c); print(c.describe(), doc); }

        print(history.undo() ? "undo" : "undo (nothing to undo)", doc);
        print(history.undo() ? "undo" : "undo (nothing to undo)", doc);
        print(history.redo() ? "redo" : "redo (nothing to redo)", doc);

        Command bang = new InsertCommand(doc, doc.length(), "!");
        history.run(bang);
        print(bang.describe(), doc);
        print(history.redo() ? "redo" : "redo (nothing to redo)", doc);
    }
}`,
      python: String.raw`# Command: every edit is an object that can execute and undo itself.
from abc import ABC, abstractmethod


class Document:
    """Receiver: the object that really changes."""

    def __init__(self) -> None:
        self.text = ""

    def insert(self, pos: int, s: str) -> None:
        self.text = self.text[:pos] + s + self.text[pos:]

    def delete(self, pos: int, length: int) -> str:
        removed = self.text[pos:pos + length]
        self.text = self.text[:pos] + self.text[pos + length:]
        return removed


class Command(ABC):
    @abstractmethod
    def execute(self) -> None: ...

    @abstractmethod
    def undo(self) -> None: ...

    @abstractmethod
    def describe(self) -> str: ...


class InsertCommand(Command):
    def __init__(self, doc: Document, pos: int, s: str) -> None:
        self.doc, self.pos, self.s = doc, pos, s

    def execute(self) -> None:
        self.doc.insert(self.pos, self.s)

    def undo(self) -> None:
        self.doc.delete(self.pos, len(self.s))

    def describe(self) -> str:
        return f'type "{self.s}"'


class DeleteCommand(Command):
    def __init__(self, doc: Document, pos: int, length: int) -> None:
        self.doc, self.pos, self.length = doc, pos, length
        self.removed = ""  # saved on execute, needed for undo

    def execute(self) -> None:
        self.removed = self.doc.delete(self.pos, self.length)

    def undo(self) -> None:
        self.doc.insert(self.pos, self.removed)

    def describe(self) -> str:
        return f"delete {self.length} at {self.pos}"


class History:
    """Invoker: runs commands and keeps the two history stacks."""

    def __init__(self) -> None:
        self.undo_stack: list[Command] = []
        self.redo_stack: list[Command] = []

    def run(self, cmd: Command) -> None:
        cmd.execute()
        self.undo_stack.append(cmd)
        self.redo_stack.clear()  # a new action abandons the undone timeline

    def undo(self) -> bool:
        if not self.undo_stack:
            return False
        cmd = self.undo_stack.pop()
        cmd.undo()
        self.redo_stack.append(cmd)
        return True

    def redo(self) -> bool:
        if not self.redo_stack:
            return False
        cmd = self.redo_stack.pop()
        cmd.execute()
        self.undo_stack.append(cmd)
        return True


def show(label: str, doc: Document) -> None:
    print(f'{label:<24} -> "{doc.text}"')


def main() -> None:
    doc = Document()
    history = History()

    for cmd in (InsertCommand(doc, 0, "Hello"),
                InsertCommand(doc, 5, " World"),
                DeleteCommand(doc, 5, 6)):
        history.run(cmd)
        show(cmd.describe(), doc)

    show("undo" if history.undo() else "undo (nothing to undo)", doc)
    show("undo" if history.undo() else "undo (nothing to undo)", doc)
    show("redo" if history.redo() else "redo (nothing to redo)", doc)

    bang = InsertCommand(doc, len(doc.text), "!")
    history.run(bang)
    show(bang.describe(), doc)
    show("redo" if history.redo() else "redo (nothing to redo)", doc)


if __name__ == "__main__":
    main()`,
      cpp: String.raw`// Command: every edit is an object that can execute and undo itself.
#include <iomanip>
#include <iostream>
#include <memory>
#include <string>
#include <vector>

// Receiver: the object that really changes.
class Document {
    std::string text_;
public:
    void insert(size_t pos, const std::string& s) { text_.insert(pos, s); }
    std::string erase(size_t pos, size_t len) {
        std::string removed = text_.substr(pos, len);
        text_.erase(pos, len);
        return removed;
    }
    size_t length() const { return text_.size(); }
    const std::string& text() const { return text_; }
};

class Command {
public:
    virtual ~Command() = default;
    virtual void execute() = 0;
    virtual void undo() = 0;
    virtual std::string describe() const = 0;
};

class InsertCommand : public Command {
    Document& doc_;
    size_t pos_;
    std::string s_;
public:
    InsertCommand(Document& doc, size_t pos, std::string s) : doc_(doc), pos_(pos), s_(std::move(s)) {}
    void execute() override { doc_.insert(pos_, s_); }
    void undo() override { doc_.erase(pos_, s_.size()); }
    std::string describe() const override { return "type \"" + s_ + "\""; }
};

class DeleteCommand : public Command {
    Document& doc_;
    size_t pos_, len_;
    std::string removed_;  // saved on execute, needed for undo
public:
    DeleteCommand(Document& doc, size_t pos, size_t len) : doc_(doc), pos_(pos), len_(len) {}
    void execute() override { removed_ = doc_.erase(pos_, len_); }
    void undo() override { doc_.insert(pos_, removed_); }
    std::string describe() const override {
        return "delete " + std::to_string(len_) + " at " + std::to_string(pos_);
    }
};

// Invoker: runs commands and keeps the two history stacks.
class History {
    std::vector<std::shared_ptr<Command>> undo_, redo_;
public:
    void run(const std::shared_ptr<Command>& c) {
        c->execute();
        undo_.push_back(c);
        redo_.clear();  // a new action abandons the undone timeline
    }
    bool undo() {
        if (undo_.empty()) return false;
        auto c = undo_.back();
        undo_.pop_back();
        c->undo();
        redo_.push_back(c);
        return true;
    }
    bool redo() {
        if (redo_.empty()) return false;
        auto c = redo_.back();
        redo_.pop_back();
        c->execute();
        undo_.push_back(c);
        return true;
    }
};

void show(const std::string& label, const Document& doc) {
    std::cout << std::left << std::setw(24) << label << " -> \"" << doc.text() << "\"\n";
}

int main() {
    Document doc;
    History history;

    std::vector<std::shared_ptr<Command>> edits{
        std::make_shared<InsertCommand>(doc, 0, "Hello"),
        std::make_shared<InsertCommand>(doc, 5, " World"),
        std::make_shared<DeleteCommand>(doc, 5, 6),
    };
    for (const auto& c : edits) {
        history.run(c);
        show(c->describe(), doc);
    }

    show(history.undo() ? "undo" : "undo (nothing to undo)", doc);
    show(history.undo() ? "undo" : "undo (nothing to undo)", doc);
    show(history.redo() ? "redo" : "redo (nothing to redo)", doc);

    auto bang = std::make_shared<InsertCommand>(doc, doc.length(), "!");
    history.run(bang);
    show(bang->describe(), doc);
    show(history.redo() ? "redo" : "redo (nothing to redo)", doc);
}`,
      javascript: String.raw`// Command: every edit is an object that can execute and undo itself.

// Receiver: the object that really changes.
class Document {
  constructor() {
    this.text = "";
  }
  insert(pos, s) {
    this.text = this.text.slice(0, pos) + s + this.text.slice(pos);
  }
  delete(pos, len) {
    const removed = this.text.slice(pos, pos + len);
    this.text = this.text.slice(0, pos) + this.text.slice(pos + len);
    return removed;
  }
}

class InsertCommand {
  constructor(doc, pos, s) {
    Object.assign(this, { doc, pos, s });
  }
  execute() { this.doc.insert(this.pos, this.s); }
  undo() { this.doc.delete(this.pos, this.s.length); }
  describe() { return 'type "' + this.s + '"'; }
}

class DeleteCommand {
  constructor(doc, pos, len) {
    Object.assign(this, { doc, pos, len, removed: "" }); // removed is saved for undo
  }
  execute() { this.removed = this.doc.delete(this.pos, this.len); }
  undo() { this.doc.insert(this.pos, this.removed); }
  describe() { return "delete " + this.len + " at " + this.pos; }
}

// Invoker: runs commands and keeps the two history stacks.
class History {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }
  run(cmd) {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack.length = 0; // a new action abandons the undone timeline
  }
  undo() {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    cmd.undo();
    this.redoStack.push(cmd);
    return true;
  }
  redo() {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    cmd.execute();
    this.undoStack.push(cmd);
    return true;
  }
}

const show = (label, doc) => console.log(label.padEnd(24) + ' -> "' + doc.text + '"');

const doc = new Document();
const history = new History();

for (const cmd of [
  new InsertCommand(doc, 0, "Hello"),
  new InsertCommand(doc, 5, " World"),
  new DeleteCommand(doc, 5, 6),
]) {
  history.run(cmd);
  show(cmd.describe(), doc);
}

show(history.undo() ? "undo" : "undo (nothing to undo)", doc);
show(history.undo() ? "undo" : "undo (nothing to undo)", doc);
show(history.redo() ? "redo" : "redo (nothing to redo)", doc);

const bang = new InsertCommand(doc, doc.text.length, "!");
history.run(bang);
show(bang.describe(), doc);
show(history.redo() ? "redo" : "redo (nothing to redo)", doc);`,
      go: String.raw`// Command: every edit is a value that can execute and undo itself.
package main

import "fmt"

// Document is the receiver: the object that really changes.
type Document struct{ text string }

func (d *Document) Insert(pos int, s string) { d.text = d.text[:pos] + s + d.text[pos:] }

func (d *Document) Delete(pos, n int) string {
	removed := d.text[pos : pos+n]
	d.text = d.text[:pos] + d.text[pos+n:]
	return removed
}

type Command interface {
	Execute()
	Undo()
	Describe() string
}

type InsertCommand struct {
	doc *Document
	pos int
	s   string
}

func (c *InsertCommand) Execute()         { c.doc.Insert(c.pos, c.s) }
func (c *InsertCommand) Undo()            { c.doc.Delete(c.pos, len(c.s)) }
func (c *InsertCommand) Describe() string { return fmt.Sprintf("type %q", c.s) }

type DeleteCommand struct {
	doc     *Document
	pos, n  int
	removed string // saved on Execute, needed for Undo
}

func (c *DeleteCommand) Execute()         { c.removed = c.doc.Delete(c.pos, c.n) }
func (c *DeleteCommand) Undo()            { c.doc.Insert(c.pos, c.removed) }
func (c *DeleteCommand) Describe() string { return fmt.Sprintf("delete %d at %d", c.n, c.pos) }

// History is the invoker: it runs commands and keeps the two stacks.
type History struct{ undo, redo []Command }

func (h *History) Run(c Command) {
	c.Execute()
	h.undo = append(h.undo, c)
	h.redo = nil // a new action abandons the undone timeline
}

func (h *History) Undo() bool {
	if len(h.undo) == 0 {
		return false
	}
	c := h.undo[len(h.undo)-1]
	h.undo = h.undo[:len(h.undo)-1]
	c.Undo()
	h.redo = append(h.redo, c)
	return true
}

func (h *History) Redo() bool {
	if len(h.redo) == 0 {
		return false
	}
	c := h.redo[len(h.redo)-1]
	h.redo = h.redo[:len(h.redo)-1]
	c.Execute()
	h.undo = append(h.undo, c)
	return true
}

func show(label string, d *Document) { fmt.Printf("%-24s -> %q\n", label, d.text) }

func pick(ok bool, yes, no string) string {
	if ok {
		return yes
	}
	return no
}

func main() {
	doc := &Document{}
	history := &History{}

	for _, c := range []Command{
		&InsertCommand{doc: doc, pos: 0, s: "Hello"},
		&InsertCommand{doc: doc, pos: 5, s: " World"},
		&DeleteCommand{doc: doc, pos: 5, n: 6},
	} {
		history.Run(c)
		show(c.Describe(), doc)
	}

	show(pick(history.Undo(), "undo", "undo (nothing to undo)"), doc)
	show(pick(history.Undo(), "undo", "undo (nothing to undo)"), doc)
	show(pick(history.Redo(), "redo", "redo (nothing to redo)"), doc)

	bang := &InsertCommand{doc: doc, pos: len(doc.text), s: "!"}
	history.Run(bang)
	show(bang.Describe(), doc)
	show(pick(history.Redo(), "redo", "redo (nothing to redo)"), doc)
}`,
    },

    chain: {
      title: "Chain of Responsibility: API request middleware",
      java: String.raw`// Chain of Responsibility: auth -> rate limit -> validation -> controller.
// Each handler either rejects the request (stopping the chain) or passes it on.
// Run: javac ChainDemo.java && java ChainDemo
import java.util.*;

public class ChainDemo {

    record Request(String user, String token, String body) {}

    static abstract class Handler {
        private Handler next;

        // Returns the next handler so chains can be built fluently.
        Handler linkWith(Handler next) {
            this.next = next;
            return next;
        }

        // Default behaviour: pass along, or fail safely at the end of the chain.
        String handle(Request r) {
            return next == null ? "500 No handler" : next.handle(r);
        }
    }

    static class AuthHandler extends Handler {
        private final Set<String> validTokens;
        AuthHandler(Set<String> validTokens) { this.validTokens = validTokens; }
        @Override String handle(Request r) {
            if (!validTokens.contains(r.token())) return "401 Unauthorized (stopped at auth)";
            return super.handle(r);
        }
    }

    static class RateLimitHandler extends Handler {
        private final int limit;
        private final Map<String, Integer> counts = new HashMap<>();
        RateLimitHandler(int limit) { this.limit = limit; }
        @Override String handle(Request r) {
            int seen = counts.merge(r.user(), 1, Integer::sum);
            if (seen > limit) return "429 Too Many Requests (stopped at rate limit)";
            return super.handle(r);
        }
    }

    static class ValidationHandler extends Handler {
        @Override String handle(Request r) {
            if (r.body().isBlank()) return "400 Bad Request: empty body (stopped at validation)";
            return super.handle(r);
        }
    }

    // The last link does the real work.
    static class OrderController extends Handler {
        @Override String handle(Request r) { return "201 Created: order for " + r.user(); }
    }

    public static void main(String[] args) {
        Handler chain = new AuthHandler(Set.of("tok-asha"));
        chain.linkWith(new RateLimitHandler(2))
             .linkWith(new ValidationHandler())
             .linkWith(new OrderController());

        List<Request> requests = List.of(
            new Request("ravi", "bad-token", "item=42"),
            new Request("asha", "tok-asha", ""),
            new Request("asha", "tok-asha", "item=42"),
            new Request("asha", "tok-asha", "item=7"));

        for (int i = 0; i < requests.size(); i++) {
            Request r = requests.get(i);
            System.out.println("req " + (i + 1) + " " + r.user() + " -> " + chain.handle(r));
        }
    }
}`,
      python: String.raw`# Chain of Responsibility: auth -> rate limit -> validation -> controller.
# Each handler either rejects the request (stopping the chain) or passes it on.
from collections import defaultdict
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Request:
    user: str
    token: str
    body: str


class Handler:
    def __init__(self) -> None:
        self._next: Optional["Handler"] = None

    def link_with(self, nxt: "Handler") -> "Handler":
        """Returns the next handler so chains can be built fluently."""
        self._next = nxt
        return nxt

    def handle(self, req: Request) -> str:
        # Default behaviour: pass along, or fail safely at the end of the chain.
        return self._next.handle(req) if self._next else "500 No handler"


class AuthHandler(Handler):
    def __init__(self, valid_tokens: set[str]) -> None:
        super().__init__()
        self.valid_tokens = valid_tokens

    def handle(self, req: Request) -> str:
        if req.token not in self.valid_tokens:
            return "401 Unauthorized (stopped at auth)"
        return super().handle(req)


class RateLimitHandler(Handler):
    def __init__(self, limit: int) -> None:
        super().__init__()
        self.limit = limit
        self.counts: defaultdict[str, int] = defaultdict(int)

    def handle(self, req: Request) -> str:
        self.counts[req.user] += 1
        if self.counts[req.user] > self.limit:
            return "429 Too Many Requests (stopped at rate limit)"
        return super().handle(req)


class ValidationHandler(Handler):
    def handle(self, req: Request) -> str:
        if not req.body.strip():
            return "400 Bad Request: empty body (stopped at validation)"
        return super().handle(req)


class OrderController(Handler):
    """The last link does the real work."""

    def handle(self, req: Request) -> str:
        return f"201 Created: order for {req.user}"


def main() -> None:
    chain = AuthHandler({"tok-asha"})
    (chain.link_with(RateLimitHandler(2))
          .link_with(ValidationHandler())
          .link_with(OrderController()))

    requests = [
        Request("ravi", "bad-token", "item=42"),
        Request("asha", "tok-asha", ""),
        Request("asha", "tok-asha", "item=42"),
        Request("asha", "tok-asha", "item=7"),
    ]
    for i, req in enumerate(requests, start=1):
        print(f"req {i} {req.user} -> {chain.handle(req)}")


if __name__ == "__main__":
    main()`,
      cpp: String.raw`// Chain of Responsibility: auth -> rate limit -> validation -> controller.
// Each handler either rejects the request (stopping the chain) or passes it on.
#include <iostream>
#include <memory>
#include <set>
#include <string>
#include <unordered_map>
#include <vector>

struct Request {
    std::string user, token, body;
};

class Handler {
    std::shared_ptr<Handler> next_;
public:
    virtual ~Handler() = default;

    // Returns the next handler so chains can be built fluently.
    std::shared_ptr<Handler> linkWith(std::shared_ptr<Handler> next) {
        next_ = std::move(next);
        return next_;
    }

    // Default behaviour: pass along, or fail safely at the end of the chain.
    virtual std::string handle(const Request& r) {
        return next_ ? next_->handle(r) : "500 No handler";
    }
};

class AuthHandler : public Handler {
    std::set<std::string> valid_;
public:
    explicit AuthHandler(std::set<std::string> valid) : valid_(std::move(valid)) {}
    std::string handle(const Request& r) override {
        if (!valid_.count(r.token)) return "401 Unauthorized (stopped at auth)";
        return Handler::handle(r);
    }
};

class RateLimitHandler : public Handler {
    int limit_;
    std::unordered_map<std::string, int> counts_;
public:
    explicit RateLimitHandler(int limit) : limit_(limit) {}
    std::string handle(const Request& r) override {
        if (++counts_[r.user] > limit_) return "429 Too Many Requests (stopped at rate limit)";
        return Handler::handle(r);
    }
};

class ValidationHandler : public Handler {
public:
    std::string handle(const Request& r) override {
        if (r.body.find_first_not_of(" \t") == std::string::npos)
            return "400 Bad Request: empty body (stopped at validation)";
        return Handler::handle(r);
    }
};

// The last link does the real work.
class OrderController : public Handler {
public:
    std::string handle(const Request& r) override { return "201 Created: order for " + r.user; }
};

int main() {
    auto chain = std::make_shared<AuthHandler>(std::set<std::string>{"tok-asha"});
    chain->linkWith(std::make_shared<RateLimitHandler>(2))
        ->linkWith(std::make_shared<ValidationHandler>())
        ->linkWith(std::make_shared<OrderController>());

    std::vector<Request> requests{
        {"ravi", "bad-token", "item=42"},
        {"asha", "tok-asha", ""},
        {"asha", "tok-asha", "item=42"},
        {"asha", "tok-asha", "item=7"},
    };
    for (size_t i = 0; i < requests.size(); ++i) {
        const Request& r = requests[i];
        std::cout << "req " << (i + 1) << " " << r.user << " -> " << chain->handle(r) << "\n";
    }
}`,
      javascript: String.raw`// Chain of Responsibility, Express.js style: each middleware gets (req, next)
// and either returns a response (stopping the chain) or calls next().

function auth(validTokens) {
  return (req, next) => (validTokens.has(req.token) ? next() : "401 Unauthorized (stopped at auth)");
}

function rateLimit(limit) {
  const counts = new Map();
  return (req, next) => {
    const seen = (counts.get(req.user) || 0) + 1;
    counts.set(req.user, seen);
    return seen > limit ? "429 Too Many Requests (stopped at rate limit)" : next();
  };
}

function validate() {
  return (req, next) =>
    req.body.trim() === "" ? "400 Bad Request: empty body (stopped at validation)" : next();
}

// The last link does the real work.
const orderController = (req) => "201 Created: order for " + req.user;

// Builds one handler that walks the middleware list, then the controller.
function buildChain(middlewares, finalHandler) {
  return (req) => {
    const dispatch = (i) =>
      i === middlewares.length ? finalHandler(req) : middlewares[i](req, () => dispatch(i + 1));
    return dispatch(0);
  };
}

const handle = buildChain([auth(new Set(["tok-asha"])), rateLimit(2), validate()], orderController);

const requests = [
  { user: "ravi", token: "bad-token", body: "item=42" },
  { user: "asha", token: "tok-asha", body: "" },
  { user: "asha", token: "tok-asha", body: "item=42" },
  { user: "asha", token: "tok-asha", body: "item=7" },
];
requests.forEach((req, i) => console.log("req " + (i + 1) + " " + req.user + " -> " + handle(req)));`,
      go: String.raw`// Chain of Responsibility, Go style: a middleware takes the next handler and
// returns a wrapped one (the net/http idiom). Any link can stop the chain.
package main

import (
	"fmt"
	"strings"
)

type Request struct{ User, Token, Body string }

type Handler func(r Request) string

type Middleware func(next Handler) Handler

func Auth(validTokens map[string]bool) Middleware {
	return func(next Handler) Handler {
		return func(r Request) string {
			if !validTokens[r.Token] {
				return "401 Unauthorized (stopped at auth)"
			}
			return next(r)
		}
	}
}

func RateLimit(limit int) Middleware {
	counts := map[string]int{}
	return func(next Handler) Handler {
		return func(r Request) string {
			counts[r.User]++
			if counts[r.User] > limit {
				return "429 Too Many Requests (stopped at rate limit)"
			}
			return next(r)
		}
	}
}

func Validate() Middleware {
	return func(next Handler) Handler {
		return func(r Request) string {
			if strings.TrimSpace(r.Body) == "" {
				return "400 Bad Request: empty body (stopped at validation)"
			}
			return next(r)
		}
	}
}

// OrderController is the last link and does the real work.
func OrderController(r Request) string { return "201 Created: order for " + r.User }

// Chain wraps from the inside out, so the first middleware runs first.
func Chain(final Handler, mws ...Middleware) Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		final = mws[i](final)
	}
	return final
}

func main() {
	handle := Chain(OrderController,
		Auth(map[string]bool{"tok-asha": true}),
		RateLimit(2),
		Validate(),
	)

	requests := []Request{
		{"ravi", "bad-token", "item=42"},
		{"asha", "tok-asha", ""},
		{"asha", "tok-asha", "item=42"},
		{"asha", "tok-asha", "item=7"},
	}
	for i, r := range requests {
		fmt.Printf("req %d %s -> %s\n", i+1, r.User, handle(r))
	}
}`,
    },

    template: {
      title: "Template Method: one payment flow, three payment methods",
      java: String.raw`// Template Method: pay() fixes the order of steps; subclasses fill in the blanks.
// Run: javac TemplateMethodDemo.java && java TemplateMethodDemo
public class TemplateMethodDemo {

    static abstract class PaymentFlow {
        private static int txnCounter = 0;

        // The template method. final: no subclass can skip or reorder a step.
        public final void pay(String user, int amount) {
            System.out.println("--- " + method() + " ---");
            if (amount <= 0) {
                System.out.println("validate: Rs" + amount + " is invalid, aborting");
                return;
            }
            System.out.println("validate: Rs" + amount + " ok");
            authenticate(user);
            int fee = fee(amount);
            debit(amount + fee);
            txnCounter++;
            System.out.println("receipt: " + user + " paid Rs" + (amount + fee)
                + " (fee Rs" + fee + "), txn " + method() + "-" + txnCounter);
        }

        protected abstract String method();
        protected abstract void authenticate(String user);
        protected abstract void debit(int total);

        // Hook: a step with a default that subclasses may override.
        protected int fee(int amount) { return 0; }
    }

    static class UpiPayment extends PaymentFlow {
        protected String method() { return "UPI"; }
        protected void authenticate(String user) { System.out.println("auth: UPI PIN verified for " + user); }
        protected void debit(int total) { System.out.println("debit: Rs" + total + " from bank account via NPCI"); }
    }

    static class CardPayment extends PaymentFlow {
        protected String method() { return "CARD"; }
        protected void authenticate(String user) { System.out.println("auth: OTP (3-D Secure) verified for " + user); }
        protected void debit(int total) { System.out.println("debit: Rs" + total + " charged to card"); }
        @Override protected int fee(int amount) { return amount * 2 / 100; } // 2% convenience fee
    }

    static class NetBankingPayment extends PaymentFlow {
        protected String method() { return "NETBANKING"; }
        protected void authenticate(String user) { System.out.println("auth: redirected to bank login for " + user); }
        protected void debit(int total) { System.out.println("debit: Rs" + total + " via bank redirect"); }
        @Override protected int fee(int amount) { return 10; } // flat fee
    }

    public static void main(String[] args) {
        new UpiPayment().pay("asha", 500);
        new CardPayment().pay("asha", 1000);
        new NetBankingPayment().pay("ravi", 750);
        new CardPayment().pay("ravi", 0);
    }
}`,
      python: String.raw`# Template Method: pay() fixes the order of steps; subclasses fill in the blanks.
from abc import ABC, abstractmethod
from typing import final


class PaymentFlow(ABC):
    _txn_counter = 0

    @final  # a type checker flags any subclass that overrides the skeleton
    def pay(self, user: str, amount: int) -> None:
        print(f"--- {self.method()} ---")
        if amount <= 0:
            print(f"validate: Rs{amount} is invalid, aborting")
            return
        print(f"validate: Rs{amount} ok")
        self.authenticate(user)
        fee = self.fee(amount)
        self.debit(amount + fee)
        PaymentFlow._txn_counter += 1
        print(f"receipt: {user} paid Rs{amount + fee} (fee Rs{fee}), "
              f"txn {self.method()}-{PaymentFlow._txn_counter}")

    @abstractmethod
    def method(self) -> str: ...

    @abstractmethod
    def authenticate(self, user: str) -> None: ...

    @abstractmethod
    def debit(self, total: int) -> None: ...

    def fee(self, amount: int) -> int:
        """Hook: a step with a default that subclasses may override."""
        return 0


class UpiPayment(PaymentFlow):
    def method(self) -> str:
        return "UPI"

    def authenticate(self, user: str) -> None:
        print(f"auth: UPI PIN verified for {user}")

    def debit(self, total: int) -> None:
        print(f"debit: Rs{total} from bank account via NPCI")


class CardPayment(PaymentFlow):
    def method(self) -> str:
        return "CARD"

    def authenticate(self, user: str) -> None:
        print(f"auth: OTP (3-D Secure) verified for {user}")

    def debit(self, total: int) -> None:
        print(f"debit: Rs{total} charged to card")

    def fee(self, amount: int) -> int:
        return amount * 2 // 100  # 2% convenience fee


class NetBankingPayment(PaymentFlow):
    def method(self) -> str:
        return "NETBANKING"

    def authenticate(self, user: str) -> None:
        print(f"auth: redirected to bank login for {user}")

    def debit(self, total: int) -> None:
        print(f"debit: Rs{total} via bank redirect")

    def fee(self, amount: int) -> int:
        return 10  # flat fee


def main() -> None:
    UpiPayment().pay("asha", 500)
    CardPayment().pay("asha", 1000)
    NetBankingPayment().pay("ravi", 750)
    CardPayment().pay("ravi", 0)


if __name__ == "__main__":
    main()`,
      cpp: String.raw`// Template Method via the non-virtual interface (NVI) idiom:
// pay() is public and non-virtual; the steps are private virtual functions.
#include <iostream>
#include <string>

class PaymentFlow {
public:
    virtual ~PaymentFlow() = default;

    // The template method. Not virtual, so no subclass can reorder the steps.
    void pay(const std::string& user, int amount) {
        std::cout << "--- " << method() << " ---\n";
        if (amount <= 0) {
            std::cout << "validate: Rs" << amount << " is invalid, aborting\n";
            return;
        }
        std::cout << "validate: Rs" << amount << " ok\n";
        authenticate(user);
        int f = fee(amount);
        debit(amount + f);
        ++txnCounter;
        std::cout << "receipt: " << user << " paid Rs" << (amount + f) << " (fee Rs" << f
                  << "), txn " << method() << "-" << txnCounter << "\n";
    }

private:
    inline static int txnCounter = 0;
    virtual std::string method() const = 0;
    virtual void authenticate(const std::string& user) = 0;
    virtual void debit(int total) = 0;
    virtual int fee(int) const { return 0; }  // hook: default, may be overridden
};

class UpiPayment : public PaymentFlow {
    std::string method() const override { return "UPI"; }
    void authenticate(const std::string& user) override { std::cout << "auth: UPI PIN verified for " << user << "\n"; }
    void debit(int total) override { std::cout << "debit: Rs" << total << " from bank account via NPCI\n"; }
};

class CardPayment : public PaymentFlow {
    std::string method() const override { return "CARD"; }
    void authenticate(const std::string& user) override { std::cout << "auth: OTP (3-D Secure) verified for " << user << "\n"; }
    void debit(int total) override { std::cout << "debit: Rs" << total << " charged to card\n"; }
    int fee(int amount) const override { return amount * 2 / 100; }  // 2% convenience fee
};

class NetBankingPayment : public PaymentFlow {
    std::string method() const override { return "NETBANKING"; }
    void authenticate(const std::string& user) override { std::cout << "auth: redirected to bank login for " << user << "\n"; }
    void debit(int total) override { std::cout << "debit: Rs" << total << " via bank redirect\n"; }
    int fee(int) const override { return 10; }  // flat fee
};

int main() {
    UpiPayment().pay("asha", 500);
    CardPayment().pay("asha", 1000);
    NetBankingPayment().pay("ravi", 750);
    CardPayment().pay("ravi", 0);
}`,
      javascript: String.raw`// Template Method: pay() fixes the order of steps; subclasses fill in the blanks.
let txnCounter = 0;

class PaymentFlow {
  constructor() {
    if (new.target === PaymentFlow) throw new Error("PaymentFlow is abstract");
  }

  // The template method. Subclasses should not override it.
  pay(user, amount) {
    console.log("--- " + this.method() + " ---");
    if (amount <= 0) {
      console.log("validate: Rs" + amount + " is invalid, aborting");
      return;
    }
    console.log("validate: Rs" + amount + " ok");
    this.authenticate(user);
    const fee = this.fee(amount);
    this.debit(amount + fee);
    txnCounter++;
    console.log("receipt: " + user + " paid Rs" + (amount + fee) + " (fee Rs" + fee + "), txn " +
      this.method() + "-" + txnCounter);
  }

  method() { throw new Error("subclass must implement method()"); }
  authenticate() { throw new Error("subclass must implement authenticate()"); }
  debit() { throw new Error("subclass must implement debit()"); }
  fee() { return 0; } // hook: a default that subclasses may override
}

class UpiPayment extends PaymentFlow {
  method() { return "UPI"; }
  authenticate(user) { console.log("auth: UPI PIN verified for " + user); }
  debit(total) { console.log("debit: Rs" + total + " from bank account via NPCI"); }
}

class CardPayment extends PaymentFlow {
  method() { return "CARD"; }
  authenticate(user) { console.log("auth: OTP (3-D Secure) verified for " + user); }
  debit(total) { console.log("debit: Rs" + total + " charged to card"); }
  fee(amount) { return Math.floor((amount * 2) / 100); } // 2% convenience fee
}

class NetBankingPayment extends PaymentFlow {
  method() { return "NETBANKING"; }
  authenticate(user) { console.log("auth: redirected to bank login for " + user); }
  debit(total) { console.log("debit: Rs" + total + " via bank redirect"); }
  fee() { return 10; } // flat fee
}

new UpiPayment().pay("asha", 500);
new CardPayment().pay("asha", 1000);
new NetBankingPayment().pay("ravi", 750);
new CardPayment().pay("ravi", 0);`,
      go: String.raw`// Template Method in Go: there is no inheritance, so the skeleton is a plain
// function and the varying steps arrive as an interface value.
package main

import "fmt"

type PaymentSteps interface {
	Method() string
	Authenticate(user string)
	Debit(total int)
	Fee(amount int) int
}

// NoFee is embedded to supply the default hook.
type NoFee struct{}

func (NoFee) Fee(int) int { return 0 }

var txnCounter = 0

// Pay is the template method: the order of steps lives here and only here.
func Pay(s PaymentSteps, user string, amount int) {
	fmt.Printf("--- %s ---\n", s.Method())
	if amount <= 0 {
		fmt.Printf("validate: Rs%d is invalid, aborting\n", amount)
		return
	}
	fmt.Printf("validate: Rs%d ok\n", amount)
	s.Authenticate(user)
	fee := s.Fee(amount)
	s.Debit(amount + fee)
	txnCounter++
	fmt.Printf("receipt: %s paid Rs%d (fee Rs%d), txn %s-%d\n", user, amount+fee, fee, s.Method(), txnCounter)
}

type UpiPayment struct{ NoFee }

func (UpiPayment) Method() string           { return "UPI" }
func (UpiPayment) Authenticate(user string) { fmt.Println("auth: UPI PIN verified for " + user) }
func (UpiPayment) Debit(total int)          { fmt.Printf("debit: Rs%d from bank account via NPCI\n", total) }

type CardPayment struct{}

func (CardPayment) Method() string           { return "CARD" }
func (CardPayment) Authenticate(user string) { fmt.Println("auth: OTP (3-D Secure) verified for " + user) }
func (CardPayment) Debit(total int)          { fmt.Printf("debit: Rs%d charged to card\n", total) }
func (CardPayment) Fee(amount int) int       { return amount * 2 / 100 } // 2% convenience fee

type NetBankingPayment struct{}

func (NetBankingPayment) Method() string           { return "NETBANKING" }
func (NetBankingPayment) Authenticate(user string) { fmt.Println("auth: redirected to bank login for " + user) }
func (NetBankingPayment) Debit(total int)          { fmt.Printf("debit: Rs%d via bank redirect\n", total) }
func (NetBankingPayment) Fee(int) int              { return 10 } // flat fee

func main() {
	Pay(UpiPayment{}, "asha", 500)
	Pay(CardPayment{}, "asha", 1000)
	Pay(NetBankingPayment{}, "ravi", 750)
	Pay(CardPayment{}, "ravi", 0)
}`,
    },

    iterator: {
      title: "Iterator: in-order traversal of a binary search tree",
      java: String.raw`// Iterator: a BST that works in a for-each loop without exposing its nodes.
// Run: javac IteratorDemo.java && java IteratorDemo
import java.util.*;

public class IteratorDemo {

    static class BST implements Iterable<Integer> {
        private static class Node {
            final int val;
            Node left, right;
            Node(int val) { this.val = val; }
        }

        private Node root;

        void insert(int v) { root = insert(root, v); }

        private Node insert(Node n, int v) {
            if (n == null) return new Node(v);
            if (v < n.val) n.left = insert(n.left, v);
            else n.right = insert(n.right, v);
            return n;
        }

        // External iterator: in-order walk with an explicit stack, O(height) memory.
        @Override
        public Iterator<Integer> iterator() {
            return new Iterator<>() {
                private final Deque<Node> stack = new ArrayDeque<>();
                { pushLeft(root); }

                private void pushLeft(Node n) {
                    while (n != null) { stack.push(n); n = n.left; }
                }

                public boolean hasNext() { return !stack.isEmpty(); }

                public Integer next() {
                    if (stack.isEmpty()) throw new NoSuchElementException();
                    Node n = stack.pop();
                    pushLeft(n.right);
                    return n.val;
                }
            };
        }
    }

    public static void main(String[] args) {
        BST tree = new BST();
        for (int v : new int[] {50, 30, 70, 20, 40, 60, 80}) tree.insert(v);

        // 1. for-each calls iterator() behind the scenes.
        StringJoiner all = new StringJoiner(" ");
        for (int v : tree) all.add(String.valueOf(v));
        System.out.println("In order: " + all);

        // 2. Lazy: stop after 3 values; the rest of the tree is never visited.
        StringJoiner first = new StringJoiner(" ");
        Iterator<Integer> it = tree.iterator();
        for (int i = 0; i < 3 && it.hasNext(); i++) first.add(String.valueOf(it.next()));
        System.out.println("Smallest 3: " + first);

        // 3. Each iterator keeps its own position.
        Iterator<Integer> a = tree.iterator(), b = tree.iterator();
        a.next();
        a.next();
        System.out.println("Independent cursors: a -> " + a.next() + ", b -> " + b.next());
    }
}`,
      python: String.raw`# Iterator: a BST that works in a for loop without exposing its nodes.
# __iter__ is a generator, so Python builds the iterator object for us.
from dataclasses import dataclass
from itertools import islice
from typing import Iterator, Optional


@dataclass
class Node:
    val: int
    left: Optional["Node"] = None
    right: Optional["Node"] = None


class BST:
    def __init__(self) -> None:
        self._root: Optional[Node] = None

    def insert(self, v: int) -> None:
        if self._root is None:
            self._root = Node(v)
            return
        n = self._root
        while True:
            if v < n.val:
                if n.left is None:
                    n.left = Node(v)
                    return
                n = n.left
            else:
                if n.right is None:
                    n.right = Node(v)
                    return
                n = n.right

    def __iter__(self) -> Iterator[int]:
        # In-order walk with an explicit stack: O(height) memory, fully lazy.
        stack: list[Node] = []
        n = self._root
        while stack or n:
            while n:
                stack.append(n)
                n = n.left
            n = stack.pop()
            yield n.val  # pause here until the caller asks for the next value
            n = n.right


def main() -> None:
    tree = BST()
    for v in (50, 30, 70, 20, 40, 60, 80):
        tree.insert(v)

    # 1. A for loop (and join) calls iter(tree) behind the scenes.
    print("In order:", " ".join(str(v) for v in tree))

    # 2. Lazy: islice stops after 3 values; the rest is never visited.
    print("Smallest 3:", " ".join(str(v) for v in islice(tree, 3)))

    # 3. Each iterator keeps its own position.
    a, b = iter(tree), iter(tree)
    next(a)
    next(a)
    print(f"Independent cursors: a -> {next(a)}, b -> {next(b)}")


if __name__ == "__main__":
    main()`,
      cpp: String.raw`// Iterator: a BST that works in a range-for loop without exposing its nodes.
#include <iostream>
#include <memory>
#include <stack>

class BST {
    struct Node {
        int val;
        std::unique_ptr<Node> left, right;
        explicit Node(int v) : val(v) {}
    };
    std::unique_ptr<Node> root_;

public:
    void insert(int v) {
        std::unique_ptr<Node>* slot = &root_;
        while (*slot) slot = v < (*slot)->val ? &(*slot)->left : &(*slot)->right;
        *slot = std::make_unique<Node>(v);
    }

    // In-order iterator with an explicit stack: O(height) memory.
    class Iterator {
        std::stack<const Node*> stack_;
        void pushLeft(const Node* n) {
            while (n) { stack_.push(n); n = n->left.get(); }
        }
    public:
        explicit Iterator(const Node* root) { pushLeft(root); }
        int operator*() const { return stack_.top()->val; }
        Iterator& operator++() {
            const Node* n = stack_.top();
            stack_.pop();
            pushLeft(n->right.get());
            return *this;
        }
        // Two iterators are equal when both are finished, or both point at the same node.
        bool operator!=(const Iterator& other) const {
            if (stack_.empty() || other.stack_.empty()) return stack_.empty() != other.stack_.empty();
            return stack_.top() != other.stack_.top();
        }
    };

    Iterator begin() const { return Iterator(root_.get()); }
    Iterator end() const { return Iterator(nullptr); }
};

int main() {
    BST tree;
    for (int v : {50, 30, 70, 20, 40, 60, 80}) tree.insert(v);

    // 1. Range-for calls begin() and end() behind the scenes.
    std::cout << "In order:";
    for (int v : tree) std::cout << " " << v;
    std::cout << "\n";

    // 2. Lazy: stop after 3 values; the rest of the tree is never visited.
    std::cout << "Smallest 3:";
    int taken = 0;
    for (auto it = tree.begin(); it != tree.end() && taken < 3; ++it, ++taken) std::cout << " " << *it;
    std::cout << "\n";

    // 3. Each iterator keeps its own position.
    auto a = tree.begin(), b = tree.begin();
    ++a;
    ++a;
    std::cout << "Independent cursors: a -> " << *a << ", b -> " << *b << "\n";
}`,
      javascript: String.raw`// Iterator: a BST that works in for...of without exposing its nodes.
// [Symbol.iterator] is a generator, so JavaScript builds the iterator for us.

class BST {
  #root = null;

  insert(val) {
    const node = { val, left: null, right: null };
    if (!this.#root) {
      this.#root = node;
      return;
    }
    let n = this.#root;
    for (;;) {
      const side = val < n.val ? "left" : "right";
      if (!n[side]) {
        n[side] = node;
        return;
      }
      n = n[side];
    }
  }

  // In-order walk with an explicit stack: O(height) memory, fully lazy.
  *[Symbol.iterator]() {
    const stack = [];
    let n = this.#root;
    while (stack.length || n) {
      while (n) {
        stack.push(n);
        n = n.left;
      }
      n = stack.pop();
      yield n.val; // pause here until the caller asks for the next value
      n = n.right;
    }
  }
}

const tree = new BST();
for (const v of [50, 30, 70, 20, 40, 60, 80]) tree.insert(v);

// 1. Spread and for...of call tree[Symbol.iterator]() behind the scenes.
console.log("In order: " + [...tree].join(" "));

// 2. Lazy: break after 3 values; the rest of the tree is never visited.
const first = [];
for (const v of tree) {
  if (first.length === 3) break;
  first.push(v);
}
console.log("Smallest 3: " + first.join(" "));

// 3. Each iterator keeps its own position.
const a = tree[Symbol.iterator]();
const b = tree[Symbol.iterator]();
a.next();
a.next();
console.log("Independent cursors: a -> " + a.next().value + ", b -> " + b.next().value);`,
      go: String.raw`// Iterator in Go 1.23+: All() returns an iter.Seq, so callers can range over
// the tree. iter.Pull turns it into a next()-style cursor when needed.
package main

import (
	"fmt"
	"iter"
	"strings"
)

type node struct {
	val         int
	left, right *node
}

type BST struct{ root *node }

func (t *BST) Insert(v int) {
	slot := &t.root
	for *slot != nil {
		if v < (*slot).val {
			slot = &(*slot).left
		} else {
			slot = &(*slot).right
		}
	}
	*slot = &node{val: v}
}

// All walks the tree in order with an explicit stack: O(height) memory, lazy.
func (t *BST) All() iter.Seq[int] {
	return func(yield func(int) bool) {
		var stack []*node
		n := t.root
		for len(stack) > 0 || n != nil {
			for n != nil {
				stack = append(stack, n)
				n = n.left
			}
			n = stack[len(stack)-1]
			stack = stack[:len(stack)-1]
			if !yield(n.val) { // the caller broke out of the loop
				return
			}
			n = n.right
		}
	}
}

func main() {
	tree := &BST{}
	for _, v := range []int{50, 30, 70, 20, 40, 60, 80} {
		tree.Insert(v)
	}

	// 1. range over the iterator function.
	var all []string
	for v := range tree.All() {
		all = append(all, fmt.Sprint(v))
	}
	fmt.Println("In order: " + strings.Join(all, " "))

	// 2. Lazy: break after 3 values; the rest of the tree is never visited.
	var first []string
	for v := range tree.All() {
		if len(first) == 3 {
			break
		}
		first = append(first, fmt.Sprint(v))
	}
	fmt.Println("Smallest 3: " + strings.Join(first, " "))

	// 3. Each cursor keeps its own position.
	nextA, stopA := iter.Pull(tree.All())
	defer stopA()
	nextB, stopB := iter.Pull(tree.All())
	defer stopB()
	nextA()
	nextA()
	a, _ := nextA()
	b, _ := nextB()
	fmt.Printf("Independent cursors: a -> %d, b -> %d\n", a, b)
}`,
    },
  },
  diagrams: {
    strategy: String.raw`classDiagram
  class Checkout {
    -DiscountStrategy strategy
    +setStrategy(DiscountStrategy s)
    +payable(int amount) int
  }
  class DiscountStrategy {
    <<interface>>
    +discount(int amount) int
  }
  class NoDiscount
  class FlatDiscount {
    -int off
    -int minOrder
  }
  class PercentDiscount {
    -int percent
    -int cap
  }
  Checkout o-- DiscountStrategy
  DiscountStrategy <|.. NoDiscount
  DiscountStrategy <|.. FlatDiscount
  DiscountStrategy <|.. PercentDiscount`,
    observer: String.raw`sequenceDiagram
  participant App as Restaurant app
  participant O as Order (subject)
  participant P as AppPush
  participant E as Email
  participant S as SMS
  P->>O: subscribe()
  E->>O: subscribe()
  S->>O: subscribe()
  App->>O: setStatus(OUT_FOR_DELIVERY)
  O->>P: onStatusChange(event)
  O->>E: onStatusChange(event)
  O->>S: onStatusChange(event)
  S-->>S: important? send SMS
  E->>O: unsubscribe()
  App->>O: setStatus(DELIVERED)
  O->>P: onStatusChange(event)
  O->>S: onStatusChange(event)`,
    command: String.raw`classDiagram
  class Command {
    <<interface>>
    +execute()
    +undo()
  }
  class InsertCommand {
    -int pos
    -String text
  }
  class DeleteCommand {
    -int pos
    -int len
    -String removed
  }
  class Document {
    +insert(int pos, String s)
    +delete(int pos, int len) String
  }
  class History {
    -Stack~Command~ undoStack
    -Stack~Command~ redoStack
    +run(Command c)
    +undo() bool
    +redo() bool
  }
  Command <|.. InsertCommand
  Command <|.. DeleteCommand
  InsertCommand --> Document
  DeleteCommand --> Document
  History o-- Command`,
    chain: String.raw`sequenceDiagram
  participant C as Client
  participant A as Auth
  participant R as RateLimit
  participant V as Validation
  participant K as OrderController
  C->>A: handle(req)
  alt bad token
    A-->>C: 401 Unauthorized
  else token OK
    A->>R: next.handle(req)
    alt over limit
      R-->>C: 429 Too Many Requests
    else under limit
      R->>V: next.handle(req)
      alt empty body
        V-->>C: 400 Bad Request
      else valid
        V->>K: next.handle(req)
        K-->>C: 201 Created
      end
    end
  end`,
    template: String.raw`classDiagram
  class PaymentFlow {
    <<abstract>>
    +pay(user, amount)
    #method() String*
    #authenticate(user)*
    #debit(total)*
    #fee(amount) int
  }
  class UpiPayment {
    #method() String
    #authenticate(user)
    #debit(total)
  }
  class CardPayment {
    #method() String
    #authenticate(user)
    #debit(total)
    #fee(amount) int
  }
  class NetBankingPayment {
    #method() String
    #authenticate(user)
    #debit(total)
    #fee(amount) int
  }
  PaymentFlow <|-- UpiPayment
  PaymentFlow <|-- CardPayment
  PaymentFlow <|-- NetBankingPayment`,
    iterator: String.raw`classDiagram
  class Iterable~T~ {
    <<interface>>
    +iterator() Iterator~T~
  }
  class Iterator~T~ {
    <<interface>>
    +hasNext() bool
    +next() T
  }
  class BST {
    -Node root
    +insert(int v)
    +iterator() Iterator~int~
  }
  class InOrderIterator {
    -Stack~Node~ stack
    +hasNext() bool
    +next() int
  }
  Iterable <|.. BST
  Iterator <|.. InOrderIterator
  BST ..> InOrderIterator : creates`,
    mediator: String.raw`flowchart LR
  A[Asha] <--> R((ChatRoom))
  B[Ravi] <--> R
  C[Meera] <--> R
  D[Karan] <--> R`,
  },
});
