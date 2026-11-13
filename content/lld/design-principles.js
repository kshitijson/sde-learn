SD.register({
  id: "design-principles",
  html: String.raw`
<p class="lead">SOLID gets the headlines, but most day-to-day design decisions are guided by a handful of shorter rules: DRY (don't repeat yourself), KISS (keep it simple), YAGNI (you aren't gonna need it), composition over inheritance, the Law of Demeter, separation of concerns, high cohesion with low coupling, programming to an interface, and failing fast. Each fits in one sentence, and each can be over-applied. This page explains what each rule protects you from, shows the smell in real code from a Swiggy or Razorpay-style codebase, and, just as important, tells you when to break it.</p>

<h2>The rules at a glance</h2>
<table>
<thead><tr><th>Rule</th><th>One line</th><th>Protects against</th><th>Over-applied, it causes</th></tr></thead>
<tbody>
<tr><td>DRY</td><td>Every piece of knowledge has one home</td><td>Fixing a bug in 3 places and missing the 4th</td><td>Wrong abstractions that couple unrelated code</td></tr>
<tr><td>KISS</td><td>Pick the simplest design that works</td><td>Code nobody can read or debug</td><td>Rarely a problem; "simple" is not "hacky"</td></tr>
<tr><td>YAGNI</td><td>Build it when it is needed, not before</td><td>Paying for features nobody uses</td><td>Ignoring obvious, cheap seams for known changes</td></tr>
<tr><td>Composition over inheritance</td><td>Combine small parts instead of deep hierarchies</td><td>Class explosion, fragile base classes</td><td>Needless indirection for one stable is-a</td></tr>
<tr><td>Law of Demeter</td><td>Talk only to your immediate friends</td><td>Code that breaks when a distant class changes</td><td>Dozens of pass-through wrapper methods</td></tr>
<tr><td>Separation of concerns</td><td>Different jobs in different modules</td><td>SQL inside HTTP handlers, HTML inside business rules</td><td>Too many tiny layers for a small app</td></tr>
<tr><td>High cohesion, low coupling</td><td>Related things together, unrelated things apart</td><td>Changes rippling across the codebase</td><td>(The goal itself; the other rules serve it)</td></tr>
<tr><td>Program to an interface</td><td>Depend on what something does, not what it is</td><td>Being stuck with one vendor or one data structure</td><td>Interfaces with one implementation forever</td></tr>
<tr><td>Fail fast</td><td>Detect bad state at the boundary and stop loudly</td><td>Corrupt data discovered hours later</td><td>Crashing on recoverable, expected cases</td></tr>
</tbody>
</table>

<h2>DRY: Don't Repeat Yourself</h2>
<p>From <em>The Pragmatic Programmer</em>: "Every piece of knowledge must have a single, unambiguous, authoritative representation within a system." The key word is <strong>knowledge</strong>, not <strong>text</strong>. DRY is about business rules, formulas and decisions, not about two lines that happen to look alike.</p>
<h3>The smell</h3>
<p>The GST calculation for a food order is written three times, by three people, in three places:</p>
<pre><code>// CartService
long tax = subtotal * 5 / 100;                       // 5% GST on food
// InvoiceService
long tax = Math.round(subtotal * 0.05);              // rounds differently
// RefundService
long tax = (subtotal - packaging) * 5 / 100;         // excludes packaging, others do not</code></pre>
<p>The cart shows Rs 52, the invoice says Rs 53, and the refund gives back Rs 49. When the GST council changes the rate for restaurants, someone updates two of the three. Customer support spends a week on tickets.</p>
<h3>The fix</h3>
<pre><code>final class Gst {
    static final int FOOD_PERCENT = 5;
    static long onFood(long taxable) { return taxable * FOOD_PERCENT / 100; }
}
// Cart, invoice and refund all call Gst.onFood(...)</code></pre>
<p>Now the rule has one home, one test, and one place to change. Other forms of DRY: generate API clients from one OpenAPI spec instead of hand-writing them; derive the database schema and the validation from one model; keep the list of order states in one enum.</p>
<h3>When duplication is fine</h3>
<ul>
<li><strong>Coincidental duplication.</strong> Delivery fee and packaging fee are both Rs 30 today. They are different rules owned by different teams and will diverge. Merging them into one constant <code>THIRTY</code> couples them by accident. Ask: "If one changes, must the other change too?" If not, it is not duplication.</li>
<li><strong>The rule of three.</strong> The first time, just write it. The second time, wince but duplicate. The third time, refactor. With two examples you cannot tell what is truly shared; with three you can.</li>
<li><strong>The wrong abstraction.</strong> Sandi Metz: "Duplication is far cheaper than the wrong abstraction." A shared helper that grows a boolean flag for each caller (<code>formatAmount(x, true, false, true)</code>) is worse than three small copies. When that happens, inline it back and start again.</li>
<li><strong>Across service boundaries.</strong> Two microservices owned by different teams can each have their own <code>Address</code> class. Sharing a library between them couples their release cycles. Share the contract (an API schema), not the code.</li>
<li><strong>Tests.</strong> A test should read top to bottom on its own. Some repetition in test setup is better than a maze of shared helpers.</li>
</ul>

<h2>KISS: Keep It Simple</h2>
<p>Choose the simplest design that meets today's requirements. Simple means few moving parts and obvious behaviour, not "the fewest characters". Code is read ten times more often than it is written, often at 3 a.m. during an outage.</p>
<div class="grid-2">
<div class="card bad"><strong>Over-built</strong><p>To pick a delivery fee (Rs 0 above Rs 199, else Rs 30), a teammate builds a rules engine: a <code>Rule</code> interface, a <code>RuleChain</code>, a JSON DSL loaded at startup, and a reflection-based evaluator. 600 lines, two new libraries, and nobody else can change the fee without reading the engine.</p></div>
<div class="card good"><strong>Simple</strong><pre><code>long deliveryFee(long cartTotal) {
    return cartTotal &gt;= 199 ? 0 : 30;
}</code></pre><p>Three lines, obviously correct, trivially tested. When the business has ten fee rules that change weekly, then consider a strategy table or a config service.</p></div>
</div>
<p>KISS in an LLD round: use an enum instead of a class hierarchy when types carry no behaviour; use a <code>HashMap</code> before you invent a custom index; use one lock before you try lock-free code (see <a href="#/p/concurrency">Concurrency</a>). Interviewers reward the candidate who solves the problem cleanly over the one who shows every pattern they know.</p>

<h2>YAGNI: You Aren't Gonna Need It</h2>
<p>From Extreme Programming: do not build a feature until you actually need it. Every speculative feature has a cost today (time to build), a cost forever (code to read, test and keep working), and is often wrong when the real need finally arrives.</p>
<p>Examples of YAGNI violations in Indian startups:</p>
<ul>
<li>Building multi-currency support for a product that only sells in India "because we might go global".</li>
<li>A plugin system for SMS vendors when there is one vendor and no plan to add a second.</li>
<li>Sharding the database on day one for 2,000 orders a day. One PostgreSQL box handles that with room to spare (see <a href="#/p/sharding">Sharding</a> for when you really need it).</li>
<li>Adding <code>createdBy</code>, <code>approvedBy</code>, <code>version</code> and <code>tenantId</code> to every table "for later".</li>
</ul>
<div class="callout info"><strong>YAGNI is not "never plan ahead"</strong>YAGNI is about <em>features</em>, not about <em>seams</em>. Putting payment behind a <code>PaymentGateway</code> interface costs ten lines today and is a well-known change point, so it is fine. Building adapters for five gateways you do not use is YAGNI. Also, some decisions are expensive to reverse (a public API shape, the primary key of a 1-billion-row table, money stored as floats). Think those through upfront.</div>

<h2>Composition over inheritance</h2>
<p>From the <em>Design Patterns</em> book (the "Gang of Four"): "Favour object composition over class inheritance." Inheritance shares code by making a class <em>be</em> a kind of another. Composition shares code by making a class <em>have</em> other objects and delegate to them. (The basics of has-a vs is-a are on the <a href="#/p/oop">OOP Fundamentals</a> page.)</p>
<h3>Problem 1: the fragile base class</h3>
<p>A subclass depends on how its parent works inside, not just on what it promises. When the parent changes its internals, children break without any change to their own code.</p>
<p>The famous example from <em>Effective Java</em>: you extend <code>HashSet</code> to count how many items were ever added, overriding both <code>add</code> and <code>addAll</code> to increment a counter. Adding 3 items with <code>addAll</code> reports 6. Why? <code>HashSet.addAll</code> internally calls <code>add</code> for each item, so each item is counted twice. Your code was correct according to the documentation; it broke because of a private detail of the parent. With composition (wrap a <code>Set</code> and forward calls) the problem cannot happen, because you only depend on the public interface.</p>
<h3>Problem 2: class explosion</h3>
<p>Swiggy sends order updates over SMS, email and push. Some messages go to several channels. Product also wants logging on all sends and "quiet hours" (no promotional messages between 10 p.m. and 7 a.m.). Model this with inheritance and you need a class for every combination:</p>
<figure class="svg-fig">
<svg viewBox="0 0 700 330" role="img" aria-label="Class count with inheritance versus composition">
  <text class="s-title" x="185" y="24" text-anchor="middle">Inheritance: one class per combo</text>
  <rect class="s-box" x="15" y="42" width="165" height="32" rx="10"/>
  <text class="s-text" x="97" y="63" text-anchor="middle">SmsNotifier</text>
  <rect class="s-box" x="190" y="42" width="165" height="32" rx="10"/>
  <text class="s-text" x="272" y="63" text-anchor="middle">SmsEmailNotifier</text>
  <rect class="s-box" x="15" y="82" width="165" height="32" rx="10"/>
  <text class="s-text" x="97" y="103" text-anchor="middle">EmailNotifier</text>
  <rect class="s-box" x="190" y="82" width="165" height="32" rx="10"/>
  <text class="s-text" x="272" y="103" text-anchor="middle">SmsPushNotifier</text>
  <rect class="s-box" x="15" y="122" width="165" height="32" rx="10"/>
  <text class="s-text" x="97" y="143" text-anchor="middle">PushNotifier</text>
  <rect class="s-box" x="190" y="122" width="165" height="32" rx="10"/>
  <text class="s-text" x="272" y="143" text-anchor="middle">EmailPushNotifier</text>
  <rect class="s-box" x="102" y="162" width="165" height="32" rx="10"/>
  <text class="s-text" x="185" y="183" text-anchor="middle">SmsEmailPushNotifier</text>
  <text class="s-muted" x="185" y="214" text-anchor="middle">x (none, Logging, QuietHours, both)</text>
  <rect class="s-red" x="15" y="226" width="340" height="40" rx="10"/>
  <text class="s-title" x="185" y="251" text-anchor="middle">7 x 4 = 28 classes</text>
  <text class="s-muted" x="185" y="290" text-anchor="middle">Add WhatsApp: 15 x 4 = 60 classes</text>
  <line class="s-dash" x1="368" y1="20" x2="368" y2="310"/>
  <text class="s-title" x="535" y="24" text-anchor="middle">Composition: parts you combine</text>
  <rect class="s-green" x="385" y="42" width="90" height="32" rx="10"/>
  <text class="s-text" x="430" y="63" text-anchor="middle">Sms</text>
  <rect class="s-green" x="490" y="42" width="90" height="32" rx="10"/>
  <text class="s-text" x="535" y="63" text-anchor="middle">Email</text>
  <rect class="s-green" x="595" y="42" width="90" height="32" rx="10"/>
  <text class="s-text" x="640" y="63" text-anchor="middle">Push</text>
  <text class="s-muted" x="535" y="96" text-anchor="middle">channels</text>
  <rect class="s-accent" x="385" y="108" width="145" height="32" rx="10"/>
  <text class="s-text" x="457" y="129" text-anchor="middle">Logging</text>
  <rect class="s-accent" x="540" y="108" width="145" height="32" rx="10"/>
  <text class="s-text" x="612" y="129" text-anchor="middle">QuietHours</text>
  <text class="s-muted" x="535" y="162" text-anchor="middle">decorators wrap any notifier</text>
  <rect class="s-accent" x="460" y="174" width="150" height="32" rx="10"/>
  <text class="s-text" x="535" y="195" text-anchor="middle">MultiNotifier</text>
  <text class="s-muted" x="535" y="218" text-anchor="middle">fans out to a list</text>
  <rect class="s-green" x="385" y="226" width="300" height="40" rx="10"/>
  <text class="s-title" x="535" y="251" text-anchor="middle">3 + 2 + 1 = 6 classes</text>
  <text class="s-muted" x="535" y="290" text-anchor="middle">Add WhatsApp: 7 classes</text>
</svg>
<figcaption>Class count for the same features. Inheritance multiplies (channels x features); composition adds.</figcaption>
</figure>
<p>With composition, every type implements one small <code>Notifier</code> interface. Channels do the sending. <code>MultiNotifier</code> holds a list of notifiers and sends to each (the <strong>Composite</strong> pattern). <code>LoggingNotifier</code> and <code>QuietHoursNotifier</code> wrap any notifier and add behaviour before passing the call on (the <strong>Decorator</strong> pattern; see <a href="#/p/structural-patterns">Structural patterns</a>). Because every piece is a <code>Notifier</code>, they nest in any order.</p>
<div data-diagram="notifier" data-caption="Every box is a Notifier. Decorators and the composite hold other Notifiers, so they nest freely."></div>
<div data-code="notifier"></div>
<p>Expected output:</p>
<pre><code>Order update at 14:00
  [log] notifying Ravi
  SMS   -&gt; Ravi: Order #881 is out for delivery
  PUSH  -&gt; Ravi: Order #881 is out for delivery
Promo at 23:00
  [quiet hours] held: 50% off on biryani tonight
Promo at 19:00
  EMAIL -&gt; Ravi: 50% off on biryani tonight
  PUSH  -&gt; Ravi: 50% off on biryani tonight</code></pre>
<p>Adding WhatsApp is one class. Adding "retry three times on failure" is one decorator that works for every channel. The order service only knows <code>Notifier</code>, so none of this touches it. This is the in-process version of what the <a href="#/p/notification-system">notification system</a> design does at scale with queues.</p>
<div class="callout tip"><strong>When inheritance is still right</strong>A stable, shallow "is-a" where children truly share behaviour and the parent is designed for extension: exception hierarchies, UI widget toolkits, an abstract base with a template method. Go makes the choice for you: it has no inheritance, only embedding, which is composition.</div>

<h2>Law of Demeter: talk to friends, not strangers</h2>
<p>Also called the "principle of least knowledge". A method should only call methods on: itself, its own fields, its parameters, and objects it creates. It should not reach through one object to get another and then call that one. A quick test: more than one dot in a chain of <em>getters</em> is a warning sign.</p>
<div class="grid-2">
<div class="card bad"><strong>Reaching through strangers</strong><pre><code>// CheckoutService
order.getCustomer()
     .getWallet()
     .debit(order.getTotal());</code></pre><p><code>CheckoutService</code> now knows that customers have wallets and that wallets have <code>debit</code>. If wallets move to a separate service, or customers can have two wallets, this line and every line like it breaks.</p></div>
<div class="card good"><strong>Tell, don't ask</strong><pre><code>// CheckoutService
paymentService.charge(
    order.customerId(),
    order.total());</code></pre><p>Ask the object that owns the knowledge to do the work. <code>CheckoutService</code> knows only its direct collaborators. The wallet's location is <code>PaymentService</code>'s business.</p></div>
</div>
<p>Exceptions: fluent APIs and builders (<code>list.stream().filter(...).map(...)</code>, <code>Order.builder().item(...).build()</code>) return the same kind of object at each step, so they are not violations. Plain data objects (DTOs) are also fine to navigate. The rule is about not depending on the <em>internal structure</em> of other objects' collaborators.</p>

<h2>Separation of concerns</h2>
<p>A <strong>concern</strong> is one area of responsibility: handling HTTP, enforcing business rules, storing data, formatting output. Keep each in its own module so you can change one without reading the others. It is SRP applied at the level of layers and modules.</p>
<table>
<thead><tr><th>Layer</th><th>Concern</th><th>Must not contain</th></tr></thead>
<tbody>
<tr><td>Controller / handler</td><td>Parse the request, validate shape, call a service, map the result to HTTP</td><td>Business rules, SQL</td></tr>
<tr><td>Service / domain</td><td>Business rules: "an order above Rs 5,000 needs OTP", "refund within 7 days"</td><td>HTTP status codes, SQL strings, JSON formatting</td></tr>
<tr><td>Repository / data access</td><td>Read and write storage</td><td>Business decisions</td></tr>
<tr><td>Integration clients</td><td>Talk to Razorpay, SMS vendors, Google Maps</td><td>Business decisions</td></tr>
</tbody>
</table>
<p>Cross-cutting concerns such as logging, metrics, authentication and retries cut across every layer. Keep them out of business code with decorators, middleware or aspects, exactly like <code>LoggingNotifier</code> above.</p>

<h2>High cohesion, low coupling</h2>
<p><strong>Cohesion</strong> is how closely the parts <em>inside</em> one module belong together. <strong>Coupling</strong> is how much one module depends on the insides of <em>another</em>. You want high cohesion (each module is about one thing) and low coupling (modules connect through small, stable interfaces). Almost every other principle on this page is a way to get there.</p>
<div class="grid-2">
<div class="card bad"><strong>Low cohesion, high coupling</strong><p>A <code>Utils</code> class with <code>formatDate</code>, <code>calculateGst</code>, <code>sendSms</code> and <code>parseCsv</code>. Everything imports it, so everything is coupled to everything. An <code>OrderService</code> that reads <code>PaymentService</code>'s database tables directly.</p></div>
<div class="card good"><strong>High cohesion, low coupling</strong><p><code>Gst</code> holds only tax rules. <code>SmsClient</code> holds only SMS. <code>OrderService</code> talks to payments through a <code>PaymentGateway</code> interface with two methods, never its tables. A change to SMS retries touches one file.</p></div>
</div>
<p>Measuring it informally: when a typical feature or bug fix touches one or two modules, you are in good shape. When every change touches eight files across five packages, cohesion is low or coupling is high.</p>

<h2>Program to an interface, not an implementation</h2>
<p>Declare variables, parameters and fields with the most general type that offers what you need. Then the concrete choice can change in one place.</p>
<pre><code>// Implementation-bound
ArrayList&lt;Order&gt; orders = new ArrayList&lt;&gt;();
void notifyUser(SmsNotifier sms) { ... }

// Interface-bound
List&lt;Order&gt; orders = new ArrayList&lt;&gt;();       // can become LinkedList or an immutable list
void notifyUser(Notifier notifier) { ... }       // SMS, email, push, or a test fake</code></pre>
<p>"Interface" here means the idea, not the keyword: a Python function that only calls <code>.send()</code>, or a Go function that accepts an <code>io.Writer</code>, is programming to an interface. This is the everyday habit behind the <a href="#/p/solid">Dependency Inversion Principle</a>.</p>

<h2>Fail fast</h2>
<p>Check inputs and state at the boundary, and stop immediately with a clear error when something is wrong. A failure close to its cause is cheap to debug. A failure discovered later (a negative amount stored in the ledger, a 5-digit pincode that breaks the delivery partner's app at 9 p.m.) is expensive, and sometimes the data is already corrupt.</p>
<ul>
<li>Validate in constructors and factory methods, so an invalid object can never exist. This is "make illegal states unrepresentable".</li>
<li>Use guard clauses at the top of a method instead of deep nesting.</li>
<li>Read required configuration at startup and crash if it is missing, rather than failing on the first payment at peak hour.</li>
<li>Do not swallow exceptions with an empty <code>catch</code>. Log and rethrow, or handle properly.</li>
</ul>
<div data-code="failfast"></div>
<div class="callout warn"><strong>Fail fast is not crash on everything</strong>Distinguish bugs and bad input (fail fast) from expected business outcomes (handle them). "Restaurant closed" or "payment declined" are normal results, not exceptions: return them as values. Fail fast inside your system; at the edges facing users, turn failures into friendly messages. In distributed systems, failing fast also means short timeouts and circuit breakers so one slow dependency does not hang every thread.</div>

<h2>When rules collide</h2>
<p>These rules pull in different directions. Good design is choosing which one matters more in context.</p>
<table>
<thead><tr><th>Tension</th><th>Lean towards the first when</th><th>Lean towards the second when</th></tr></thead>
<tbody>
<tr><td>DRY vs low coupling</td><td>The duplicated thing is one business rule that must change in lock-step</td><td>The code only looks similar, or lives in services owned by different teams</td></tr>
<tr><td>KISS / YAGNI vs open/closed</td><td>There is one variant and no signal more are coming</td><td>The business has already asked for a second and third variant</td></tr>
<tr><td>Law of Demeter vs simplicity</td><td>The chain crosses module or service boundaries</td><td>You would need ten pass-through methods to avoid one getter chain on a plain data object</td></tr>
<tr><td>Composition vs inheritance</td><td>Features combine freely, or behaviour must change at runtime</td><td>A small, stable is-a family shares real logic</td></tr>
</tbody>
</table>

<h2>Common interview questions and pitfalls</h2>
<ul>
<li><strong>"Is all duplication bad?"</strong> No. DRY is about knowledge. Coincidental similarity, two-instance duplication (rule of three), and duplication across service boundaries are often fine. The wrong abstraction costs more.</li>
<li><strong>"Why prefer composition over inheritance?"</strong> Inheritance couples children to parent internals (fragile base class), fixes behaviour at compile time, and multiplies classes when features combine. Composition adds classes instead of multiplying them and allows runtime swaps.</li>
<li><strong>"YAGNI vs designing for extensibility in an LLD round?"</strong> Build only the requested features, but put the obvious change points (pricing, payment, notification channel) behind interfaces. Say out loud which extensions you are deliberately not building.</li>
<li><strong>Pitfall:</strong> a <code>Utils</code> or <code>Helper</code> class that collects unrelated functions. It is a cohesion smell.</li>
<li><strong>Pitfall:</strong> catching every exception and returning <code>null</code>, the opposite of fail fast. The bug surfaces later as a <code>NullPointerException</code> far from the cause.</li>
</ul>
<div class="callout interview"><strong>Say this in the interview</strong>"I will keep the GST rule in one place so the cart, invoice and refund agree. For notifications I will not subclass for every channel combination; each channel implements a small <code>Notifier</code> interface, a <code>MultiNotifier</code> fans out to a list, and cross-cutting things like logging and quiet hours are decorators. That is six classes instead of twenty-eight, and WhatsApp is one more. I will validate the order request in its constructor so a bad pincode fails at the API boundary, not in the delivery partner's app. I am not building multi-currency now; that is YAGNI until the business asks."</div>

<h2>Test yourself</h2>
<div class="quiz">
<details><summary>The delivery fee and the packaging fee are both Rs 30. A teammate replaces both with one constant DEFAULT_FEE. Good idea?</summary><div>No. That is coincidental duplication. The two fees are different business rules owned by different people and will change independently. Merging them couples them by accident: raising packaging to Rs 40 would silently raise delivery too. DRY applies to one piece of knowledge, not to equal values.</div></details>
<details><summary>A shared formatAmount(amount, showSymbol, inLakhs, forSms, roundUp) helper has five boolean flags and is used by eight callers in different ways. What would you do?</summary><div>It is the wrong abstraction. Each flag was added to serve one caller. Inline it back into the callers (or into a few clearly named functions like <code>formatForSms</code>, <code>formatForInvoice</code>), then extract only what is truly shared. Duplication is cheaper than an abstraction that everybody bends.</div></details>
<details><summary>Why does extending HashSet to count insertions double-count with addAll?</summary><div>Because <code>HashSet.addAll</code> internally calls <code>add</code> for every element, and the subclass overrides both. This is the fragile base class problem: the subclass depends on a private implementation detail of its parent. Wrapping a <code>Set</code> (composition) and forwarding calls avoids it, since only the public contract matters.</div></details>
<details><summary>Is list.stream().filter(...).map(...).toList() a Law of Demeter violation?</summary><div>No. Each call returns a stream or list, the same abstraction you started with, not a stranger's internal collaborator. Demeter is about reaching through an object's structure, like <code>order.getCustomer().getWallet().debit()</code>.</div></details>
<details><summary>You need a notifier that retries 3 times and then logs. With composition, how many new classes do you write, and how do you combine them?</summary><div>One new decorator, <code>RetryNotifier</code>, if <code>LoggingNotifier</code> already exists. Combine by wrapping: <code>new LoggingNotifier(new RetryNotifier(sms, 3))</code>. The same retry decorator works for email, push and any future channel.</div></details>
<details><summary>Should a "payment declined" result throw an exception under fail fast?</summary><div>Usually not. A declined payment is an expected business outcome and should be returned as a value (a status or result type) that callers handle. Fail fast is for bugs and invalid input: a negative amount, a missing required config, an order without items.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
<li>DRY is about knowledge, not text. Use the rule of three, and prefer duplication over the wrong abstraction.</li>
<li>KISS and YAGNI: build the simplest thing for today's needs, but keep cheap seams at known change points.</li>
<li>Composition over inheritance: features that combine should be parts (decorators, composites), not subclasses. Inheritance multiplies classes; composition adds them.</li>
<li>Law of Demeter: tell objects what to do instead of reaching through them to their collaborators.</li>
<li>Separation of concerns, high cohesion and low coupling: each module about one thing, connected by small interfaces.</li>
<li>Program to an interface so concrete choices can change in one place.</li>
<li>Fail fast on bugs and bad input at the boundary; return expected business outcomes as values.</li>
</ul></div>
`,
  code: {
    notifier: {
      title: "Composition: channels, a composite and decorators instead of a subclass per combination",
      java: String.raw`import java.util.List;

public class NotifierDemo {

    interface Notifier { void send(String user, String msg); }

    // Channels: each knows only how to send on its medium.
    static class SmsNotifier implements Notifier {
        public void send(String user, String msg) { System.out.println("  SMS   -> " + user + ": " + msg); }
    }
    static class EmailNotifier implements Notifier {
        public void send(String user, String msg) { System.out.println("  EMAIL -> " + user + ": " + msg); }
    }
    static class PushNotifier implements Notifier {
        public void send(String user, String msg) { System.out.println("  PUSH  -> " + user + ": " + msg); }
    }

    // Composite: fans out to any list of notifiers.
    static class MultiNotifier implements Notifier {
        private final List<Notifier> targets;
        MultiNotifier(List<Notifier> targets) { this.targets = List.copyOf(targets); }
        public void send(String user, String msg) { for (Notifier n : targets) n.send(user, msg); }
    }

    // Decorator: adds logging around any notifier.
    static class LoggingNotifier implements Notifier {
        private final Notifier inner;
        LoggingNotifier(Notifier inner) { this.inner = inner; }
        public void send(String user, String msg) {
            System.out.println("  [log] notifying " + user);
            inner.send(user, msg);
        }
    }

    // Decorator: holds messages during quiet hours (10 pm to 7 am).
    static class QuietHoursNotifier implements Notifier {
        private final Notifier inner;
        private final int hour;            // injected so the demo is deterministic
        QuietHoursNotifier(Notifier inner, int hour) { this.inner = inner; this.hour = hour; }
        public void send(String user, String msg) {
            if (hour >= 22 || hour < 7) {
                System.out.println("  [quiet hours] held: " + msg);
                return;
            }
            inner.send(user, msg);
        }
    }

    public static void main(String[] args) {
        Notifier sms = new SmsNotifier(), email = new EmailNotifier(), push = new PushNotifier();

        System.out.println("Order update at 14:00");
        Notifier orderUpdates = new LoggingNotifier(new MultiNotifier(List.of(sms, push)));
        orderUpdates.send("Ravi", "Order #881 is out for delivery");

        Notifier promoChannels = new MultiNotifier(List.of(email, push));
        System.out.println("Promo at 23:00");
        new QuietHoursNotifier(promoChannels, 23).send("Ravi", "50% off on biryani tonight");
        System.out.println("Promo at 19:00");
        new QuietHoursNotifier(promoChannels, 19).send("Ravi", "50% off on biryani tonight");
    }
}
`,
      python: String.raw`from typing import Protocol, Sequence


class Notifier(Protocol):
    def send(self, user: str, msg: str) -> None: ...


# Channels: each knows only how to send on its medium.
class SmsNotifier:
    def send(self, user: str, msg: str) -> None:
        print(f"  SMS   -> {user}: {msg}")


class EmailNotifier:
    def send(self, user: str, msg: str) -> None:
        print(f"  EMAIL -> {user}: {msg}")


class PushNotifier:
    def send(self, user: str, msg: str) -> None:
        print(f"  PUSH  -> {user}: {msg}")


class MultiNotifier:
    """Composite: fans out to any list of notifiers."""

    def __init__(self, targets: Sequence[Notifier]) -> None:
        self._targets = tuple(targets)

    def send(self, user: str, msg: str) -> None:
        for n in self._targets:
            n.send(user, msg)


class LoggingNotifier:
    """Decorator: adds logging around any notifier."""

    def __init__(self, inner: Notifier) -> None:
        self._inner = inner

    def send(self, user: str, msg: str) -> None:
        print(f"  [log] notifying {user}")
        self._inner.send(user, msg)


class QuietHoursNotifier:
    """Decorator: holds messages during quiet hours (10 pm to 7 am)."""

    def __init__(self, inner: Notifier, hour: int) -> None:
        self._inner = inner
        self._hour = hour            # injected so the demo is deterministic

    def send(self, user: str, msg: str) -> None:
        if self._hour >= 22 or self._hour < 7:
            print(f"  [quiet hours] held: {msg}")
            return
        self._inner.send(user, msg)


if __name__ == "__main__":
    sms, email, push = SmsNotifier(), EmailNotifier(), PushNotifier()

    print("Order update at 14:00")
    order_updates = LoggingNotifier(MultiNotifier([sms, push]))
    order_updates.send("Ravi", "Order #881 is out for delivery")

    promo_channels = MultiNotifier([email, push])
    print("Promo at 23:00")
    QuietHoursNotifier(promo_channels, 23).send("Ravi", "50% off on biryani tonight")
    print("Promo at 19:00")
    QuietHoursNotifier(promo_channels, 19).send("Ravi", "50% off on biryani tonight")
`,
      cpp: String.raw`#include <iostream>
#include <memory>
#include <string>
#include <utility>
#include <vector>

class Notifier {
public:
    virtual ~Notifier() = default;
    virtual void send(const std::string& user, const std::string& msg) = 0;
};
using NotifierPtr = std::shared_ptr<Notifier>;

// Channels: each knows only how to send on its medium.
class SmsNotifier : public Notifier {
public:
    void send(const std::string& u, const std::string& m) override { std::cout << "  SMS   -> " << u << ": " << m << "\n"; }
};
class EmailNotifier : public Notifier {
public:
    void send(const std::string& u, const std::string& m) override { std::cout << "  EMAIL -> " << u << ": " << m << "\n"; }
};
class PushNotifier : public Notifier {
public:
    void send(const std::string& u, const std::string& m) override { std::cout << "  PUSH  -> " << u << ": " << m << "\n"; }
};

// Composite: fans out to any list of notifiers.
class MultiNotifier : public Notifier {
public:
    explicit MultiNotifier(std::vector<NotifierPtr> targets) : targets_(std::move(targets)) {}
    void send(const std::string& u, const std::string& m) override {
        for (auto& n : targets_) n->send(u, m);
    }
private:
    std::vector<NotifierPtr> targets_;
};

// Decorator: adds logging around any notifier.
class LoggingNotifier : public Notifier {
public:
    explicit LoggingNotifier(NotifierPtr inner) : inner_(std::move(inner)) {}
    void send(const std::string& u, const std::string& m) override {
        std::cout << "  [log] notifying " << u << "\n";
        inner_->send(u, m);
    }
private:
    NotifierPtr inner_;
};

// Decorator: holds messages during quiet hours (10 pm to 7 am).
class QuietHoursNotifier : public Notifier {
public:
    QuietHoursNotifier(NotifierPtr inner, int hour) : inner_(std::move(inner)), hour_(hour) {}
    void send(const std::string& u, const std::string& m) override {
        if (hour_ >= 22 || hour_ < 7) {
            std::cout << "  [quiet hours] held: " << m << "\n";
            return;
        }
        inner_->send(u, m);
    }
private:
    NotifierPtr inner_;
    int hour_;   // injected so the demo is deterministic
};

int main() {
    NotifierPtr sms = std::make_shared<SmsNotifier>();
    NotifierPtr email = std::make_shared<EmailNotifier>();
    NotifierPtr push = std::make_shared<PushNotifier>();

    std::cout << "Order update at 14:00\n";
    LoggingNotifier orderUpdates(std::make_shared<MultiNotifier>(std::vector<NotifierPtr>{sms, push}));
    orderUpdates.send("Ravi", "Order #881 is out for delivery");

    auto promoChannels = std::make_shared<MultiNotifier>(std::vector<NotifierPtr>{email, push});
    std::cout << "Promo at 23:00\n";
    QuietHoursNotifier(promoChannels, 23).send("Ravi", "50% off on biryani tonight");
    std::cout << "Promo at 19:00\n";
    QuietHoursNotifier(promoChannels, 19).send("Ravi", "50% off on biryani tonight");
    return 0;
}
`,
      javascript: String.raw`// Any object with send(user, msg) is a notifier.

// Channels: each knows only how to send on its medium.
class SmsNotifier { send(user, msg) { console.log("  SMS   -> " + user + ": " + msg); } }
class EmailNotifier { send(user, msg) { console.log("  EMAIL -> " + user + ": " + msg); } }
class PushNotifier { send(user, msg) { console.log("  PUSH  -> " + user + ": " + msg); } }

// Composite: fans out to any list of notifiers.
class MultiNotifier {
  #targets;
  constructor(targets) { this.#targets = [...targets]; }
  send(user, msg) { for (const n of this.#targets) n.send(user, msg); }
}

// Decorator: adds logging around any notifier.
class LoggingNotifier {
  #inner;
  constructor(inner) { this.#inner = inner; }
  send(user, msg) {
    console.log("  [log] notifying " + user);
    this.#inner.send(user, msg);
  }
}

// Decorator: holds messages during quiet hours (10 pm to 7 am).
class QuietHoursNotifier {
  #inner;
  #hour;
  constructor(inner, hour) { this.#inner = inner; this.#hour = hour; } // hour injected for a deterministic demo
  send(user, msg) {
    if (this.#hour >= 22 || this.#hour < 7) {
      console.log("  [quiet hours] held: " + msg);
      return;
    }
    this.#inner.send(user, msg);
  }
}

const sms = new SmsNotifier(), email = new EmailNotifier(), push = new PushNotifier();

console.log("Order update at 14:00");
const orderUpdates = new LoggingNotifier(new MultiNotifier([sms, push]));
orderUpdates.send("Ravi", "Order #881 is out for delivery");

const promoChannels = new MultiNotifier([email, push]);
console.log("Promo at 23:00");
new QuietHoursNotifier(promoChannels, 23).send("Ravi", "50% off on biryani tonight");
console.log("Promo at 19:00");
new QuietHoursNotifier(promoChannels, 19).send("Ravi", "50% off on biryani tonight");
`,
      go: String.raw`package main

import "fmt"

type Notifier interface {
	Send(user, msg string)
}

// Channels: each knows only how to send on its medium.
type SmsNotifier struct{}
type EmailNotifier struct{}
type PushNotifier struct{}

func (SmsNotifier) Send(user, msg string)   { fmt.Printf("  SMS   -> %s: %s\n", user, msg) }
func (EmailNotifier) Send(user, msg string) { fmt.Printf("  EMAIL -> %s: %s\n", user, msg) }
func (PushNotifier) Send(user, msg string)  { fmt.Printf("  PUSH  -> %s: %s\n", user, msg) }

// Composite: fans out to any list of notifiers.
type MultiNotifier struct{ targets []Notifier }

func (m MultiNotifier) Send(user, msg string) {
	for _, n := range m.targets {
		n.Send(user, msg)
	}
}

// Decorator: adds logging around any notifier.
type LoggingNotifier struct{ inner Notifier }

func (l LoggingNotifier) Send(user, msg string) {
	fmt.Println("  [log] notifying", user)
	l.inner.Send(user, msg)
}

// Decorator: holds messages during quiet hours (10 pm to 7 am).
type QuietHoursNotifier struct {
	inner Notifier
	hour  int // injected so the demo is deterministic
}

func (q QuietHoursNotifier) Send(user, msg string) {
	if q.hour >= 22 || q.hour < 7 {
		fmt.Println("  [quiet hours] held:", msg)
		return
	}
	q.inner.Send(user, msg)
}

func main() {
	sms, email, push := SmsNotifier{}, EmailNotifier{}, PushNotifier{}

	fmt.Println("Order update at 14:00")
	var orderUpdates Notifier = LoggingNotifier{MultiNotifier{[]Notifier{sms, push}}}
	orderUpdates.Send("Ravi", "Order #881 is out for delivery")

	promoChannels := MultiNotifier{[]Notifier{email, push}}
	fmt.Println("Promo at 23:00")
	QuietHoursNotifier{promoChannels, 23}.Send("Ravi", "50% off on biryani tonight")
	fmt.Println("Promo at 19:00")
	QuietHoursNotifier{promoChannels, 19}.Send("Ravi", "50% off on biryani tonight")
}
`,
    },
    failfast: {
      title: "Fail fast: an order request that cannot exist in an invalid state",
      java: String.raw`import java.util.List;

public class FailFastDemo {

    // Validated in the constructor: an invalid OrderRequest can never be created.
    record OrderRequest(String pincode, int quantity, long amount) {
        OrderRequest {
            if (pincode == null || !pincode.matches("\\d{6}"))
                throw new IllegalArgumentException("pincode must be 6 digits, got '" + pincode + "'");
            if (quantity < 1 || quantity > 10)
                throw new IllegalArgumentException("quantity must be 1..10, got " + quantity);
            if (amount <= 0)
                throw new IllegalArgumentException("amount must be positive, got " + amount);
        }
    }

    record Input(String pincode, int quantity, long amount) {}

    public static void main(String[] args) {
        List<Input> inputs = List.of(
            new Input("560001", 2, 598), new Input("5600", 1, 299),
            new Input("400001", 0, 0), new Input("110001", 3, -10));
        for (Input in : inputs) {
            try {
                OrderRequest r = new OrderRequest(in.pincode(), in.quantity(), in.amount());
                System.out.println("OK: order to " + r.pincode() + ", " + r.quantity() + " item(s), Rs " + r.amount());
            } catch (IllegalArgumentException e) {
                System.out.println("Rejected: " + e.getMessage());   // first broken rule wins
            }
        }
    }
}
`,
      python: String.raw`import re
from dataclasses import dataclass


@dataclass(frozen=True)
class OrderRequest:
    pincode: str
    quantity: int
    amount: int

    def __post_init__(self) -> None:
        # Guard clauses: validate at the boundary, stop at the first broken rule.
        if not re.fullmatch(r"\d{6}", self.pincode or ""):
            raise ValueError(f"pincode must be 6 digits, got '{self.pincode}'")
        if not 1 <= self.quantity <= 10:
            raise ValueError(f"quantity must be 1..10, got {self.quantity}")
        if self.amount <= 0:
            raise ValueError(f"amount must be positive, got {self.amount}")


if __name__ == "__main__":
    inputs = [("560001", 2, 598), ("5600", 1, 299), ("400001", 0, 0), ("110001", 3, -10)]
    for pincode, qty, amount in inputs:
        try:
            r = OrderRequest(pincode, qty, amount)
            print(f"OK: order to {r.pincode}, {r.quantity} item(s), Rs {r.amount}")
        except ValueError as e:
            print(f"Rejected: {e}")
`,
      cpp: String.raw`#include <cctype>
#include <utility>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

// Validated in the constructor: an invalid OrderRequest can never be created.
class OrderRequest {
public:
    OrderRequest(std::string pincode, int quantity, long amount)
        : pincode_(std::move(pincode)), quantity_(quantity), amount_(amount) {
        if (!isSixDigits(pincode_))
            throw std::invalid_argument("pincode must be 6 digits, got '" + pincode_ + "'");
        if (quantity_ < 1 || quantity_ > 10)
            throw std::invalid_argument("quantity must be 1..10, got " + std::to_string(quantity_));
        if (amount_ <= 0)
            throw std::invalid_argument("amount must be positive, got " + std::to_string(amount_));
    }
    const std::string& pincode() const { return pincode_; }
    int quantity() const { return quantity_; }
    long amount() const { return amount_; }

private:
    static bool isSixDigits(const std::string& s) {
        if (s.size() != 6) return false;
        for (char c : s) if (!std::isdigit(static_cast<unsigned char>(c))) return false;
        return true;
    }
    std::string pincode_;
    int quantity_;
    long amount_;
};

struct Input { std::string pincode; int quantity; long amount; };

int main() {
    std::vector<Input> inputs{{"560001", 2, 598}, {"5600", 1, 299}, {"400001", 0, 0}, {"110001", 3, -10}};
    for (const auto& in : inputs) {
        try {
            OrderRequest r(in.pincode, in.quantity, in.amount);
            std::cout << "OK: order to " << r.pincode() << ", " << r.quantity() << " item(s), Rs " << r.amount() << "\n";
        } catch (const std::invalid_argument& e) {
            std::cout << "Rejected: " << e.what() << "\n";
        }
    }
    return 0;
}
`,
      javascript: String.raw`class OrderRequest {
  constructor(pincode, quantity, amount) {
    // Guard clauses: validate at the boundary, stop at the first broken rule.
    if (!/^\d{6}$/.test(String(pincode))) {
      throw new RangeError("pincode must be 6 digits, got '" + pincode + "'");
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new RangeError("quantity must be 1..10, got " + quantity);
    }
    if (!(amount > 0)) {
      throw new RangeError("amount must be positive, got " + amount);
    }
    this.pincode = pincode;
    this.quantity = quantity;
    this.amount = amount;
    Object.freeze(this); // cannot be changed into an invalid state later
  }
}

const inputs = [["560001", 2, 598], ["5600", 1, 299], ["400001", 0, 0], ["110001", 3, -10]];
for (const [pincode, qty, amount] of inputs) {
  try {
    const r = new OrderRequest(pincode, qty, amount);
    console.log("OK: order to " + r.pincode + ", " + r.quantity + " item(s), Rs " + r.amount);
  } catch (e) {
    if (!(e instanceof RangeError)) throw e; // do not swallow unexpected errors
    console.log("Rejected: " + e.message);
  }
}
`,
      go: String.raw`package main

import (
	"fmt"
	"regexp"
)

var sixDigits = regexp.MustCompile("^[0-9]{6}$") // MustCompile panics at startup if the pattern is bad: fail fast

type OrderRequest struct {
	pincode  string
	quantity int
	amount   int64
}

// The only way to build an OrderRequest. Go reports errors as values, not exceptions.
func NewOrderRequest(pincode string, quantity int, amount int64) (OrderRequest, error) {
	if !sixDigits.MatchString(pincode) {
		return OrderRequest{}, fmt.Errorf("pincode must be 6 digits, got '%s'", pincode)
	}
	if quantity < 1 || quantity > 10 {
		return OrderRequest{}, fmt.Errorf("quantity must be 1..10, got %d", quantity)
	}
	if amount <= 0 {
		return OrderRequest{}, fmt.Errorf("amount must be positive, got %d", amount)
	}
	return OrderRequest{pincode, quantity, amount}, nil
}

func main() {
	inputs := []struct {
		pincode  string
		quantity int
		amount   int64
	}{{"560001", 2, 598}, {"5600", 1, 299}, {"400001", 0, 0}, {"110001", 3, -10}}

	for _, in := range inputs {
		r, err := NewOrderRequest(in.pincode, in.quantity, in.amount)
		if err != nil {
			fmt.Println("Rejected:", err)
			continue
		}
		fmt.Printf("OK: order to %s, %d item(s), Rs %d\n", r.pincode, r.quantity, r.amount)
	}
}
`,
    },
  },
  diagrams: {
    notifier: String.raw`classDiagram
  class Notifier {
    <<interface>>
    +send(user, msg)
  }
  class SmsNotifier
  class EmailNotifier
  class PushNotifier
  class MultiNotifier {
    -targets List~Notifier~
  }
  class LoggingNotifier {
    -inner Notifier
  }
  class QuietHoursNotifier {
    -inner Notifier
    -hour int
  }
  Notifier <|.. SmsNotifier
  Notifier <|.. EmailNotifier
  Notifier <|.. PushNotifier
  Notifier <|.. MultiNotifier
  Notifier <|.. LoggingNotifier
  Notifier <|.. QuietHoursNotifier
  MultiNotifier o-- Notifier : many
  LoggingNotifier o-- Notifier : wraps
  QuietHoursNotifier o-- Notifier : wraps`,
  },
});
