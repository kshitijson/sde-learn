SD.register({
  id: "oop",
  html: String.raw`
<p class="lead">Object-oriented programming (OOP) is a way of organising code around <em>objects</em>: small bundles of data plus the behaviour that works on that data. Every Low-Level Design round, from a parking lot at Flipkart to a Splitwise clone at PhonePe, quietly tests whether you can use its four ideas well: encapsulation, abstraction, inheritance and polymorphism. This page explains each one in plain English with a single running example, a checkout that accepts UPI, cards and wallets, and shows how Java, Python, C++, JavaScript and Go each express the same ideas (Go does it without classes at all).</p>

<h2>The big picture</h2>
<p>A <strong>class</strong> is a blueprint: it says what data an object holds and what it can do. An <strong>object</strong> is one thing built from that blueprint. <code>Order</code> is a class; "order #FK-1029 for Rs 1,499 placed by Asha" is an object. You can build millions of objects from one class, each with its own data.</p>
<p>The four pillars are four rules of thumb for designing those classes so that the code stays easy to change:</p>
<figure class="svg-fig">
<svg viewBox="0 0 680 250" role="img" aria-label="The four pillars of OOP">
  <rect class="s-accent" x="190" y="14" width="300" height="46" rx="10"/>
  <text class="s-title" x="340" y="43" text-anchor="middle">Object = data + behaviour</text>
  <line class="s-line" x1="340" y1="60" x2="85" y2="108" marker-end="url(#arrow)"/>
  <line class="s-line" x1="340" y1="60" x2="255" y2="108" marker-end="url(#arrow)"/>
  <line class="s-line" x1="340" y1="60" x2="425" y2="108" marker-end="url(#arrow)"/>
  <line class="s-line" x1="340" y1="60" x2="595" y2="108" marker-end="url(#arrow)"/>
  <rect class="s-box" x="10" y="110" width="150" height="120" rx="10"/>
  <text class="s-title" x="85" y="138" text-anchor="middle">Encapsulation</text>
  <text class="s-text" x="85" y="166" text-anchor="middle">Hide the data,</text>
  <text class="s-text" x="85" y="186" text-anchor="middle">guard the rules</text>
  <text class="s-muted" x="85" y="214" text-anchor="middle">private balance</text>
  <rect class="s-box" x="180" y="110" width="150" height="120" rx="10"/>
  <text class="s-title" x="255" y="138" text-anchor="middle">Abstraction</text>
  <text class="s-text" x="255" y="166" text-anchor="middle">Show what,</text>
  <text class="s-text" x="255" y="186" text-anchor="middle">hide how</text>
  <text class="s-muted" x="255" y="214" text-anchor="middle">pay(amount)</text>
  <rect class="s-box" x="350" y="110" width="150" height="120" rx="10"/>
  <text class="s-title" x="425" y="138" text-anchor="middle">Inheritance</text>
  <text class="s-text" x="425" y="166" text-anchor="middle">Reuse a parent</text>
  <text class="s-text" x="425" y="186" text-anchor="middle">("is-a")</text>
  <text class="s-muted" x="425" y="214" text-anchor="middle">Card is a Payment</text>
  <rect class="s-box" x="520" y="110" width="150" height="120" rx="10"/>
  <text class="s-title" x="595" y="138" text-anchor="middle">Polymorphism</text>
  <text class="s-text" x="595" y="166" text-anchor="middle">One call,</text>
  <text class="s-text" x="595" y="186" text-anchor="middle">many behaviours</text>
  <text class="s-muted" x="595" y="214" text-anchor="middle">method.pay(499)</text>
</svg>
<figcaption>The four pillars. Encapsulation and abstraction are about hiding; inheritance and polymorphism are about substituting one type for another.</figcaption>
</figure>
<p>Here is the running example as a class diagram. A <code>Checkout</code> talks only to the abstract <code>PaymentMethod</code>. It never knows whether the customer chose UPI, a card or a wallet.</p>
<div data-diagram="payments" data-caption="Checkout depends on the abstract PaymentMethod. Hollow-head arrows mean 'is a kind of'."></div>

<h2>Encapsulation: guard your own data</h2>
<p><strong>Encapsulation</strong> means an object keeps its data private and only lets the outside world change it through methods that enforce the rules. The object is responsible for its own consistency.</p>
<p>Picture a PhonePe-style wallet. The rule is simple: the balance must never go negative, and every change must be recorded. If <code>balance</code> is a public field, any of the 200 classes in the codebase can write <code>wallet.balance = wallet.balance - 500</code> and skip both rules.</p>
<h3>Bad: public data, rules scattered everywhere</h3>
<pre><code>class Wallet {
    public long balance;          // anyone can write anything
}

// somewhere in CheckoutService
wallet.balance -= amount;         // forgot the "enough money?" check
// somewhere in RefundService
wallet.balance += refund;         // forgot to record history
// somewhere in a test
wallet.balance = -300;            // nothing stops this</code></pre>
<p>Every caller must remember the rules. One forgets, and a customer ends up with Rs -300. Worse, when the rule changes (say, a daily limit of Rs 10,000 by RBI rules), you must find and fix every caller.</p>
<h3>Good: private state, public behaviour</h3>
<p>The balance is private. The only ways to change it are <code>addMoney</code> and <code>pay</code>, which check the rules in one place. Callers can read the balance and history but not modify them.</p>
<div data-code="encapsulation"></div>
<div class="callout info"><strong>Getters and setters are not encapsulation</strong>Making a field private and then adding <code>getBalance()</code> and <code>setBalance()</code> for it changes nothing: anyone can still set any value. Expose <em>behaviour</em> (<code>pay</code>, <code>addMoney</code>) instead of raw setters. Ask "what does the caller want to do?", not "what fields does the caller want to touch?".</div>

<h3>Access modifiers in each language</h3>
<p>An <strong>access modifier</strong> is a keyword that controls who can see a field or method. The five languages enforce it very differently:</p>
<table>
<thead><tr><th>Language</th><th>Private</th><th>Package / module level</th><th>Subclass</th><th>Public</th><th>Enforced by</th></tr></thead>
<tbody>
<tr><td>Java</td><td><code>private</code></td><td>no keyword (package-private)</td><td><code>protected</code> (also package)</td><td><code>public</code></td><td>Compiler and JVM</td></tr>
<tr><td>C++</td><td><code>private:</code> (default in <code>class</code>)</td><td>none (use namespaces)</td><td><code>protected:</code></td><td><code>public:</code> (default in <code>struct</code>)</td><td>Compiler; <code>friend</code> can bypass</td></tr>
<tr><td>Python</td><td><code>__name</code> (name mangling)</td><td><code>_name</code> (convention: "internal")</td><td>no keyword</td><td>everything else</td><td>Convention only. "We are all adults here."</td></tr>
<tr><td>JavaScript</td><td><code>#name</code> (true private, ES2022)</td><td>module scope (not exported)</td><td>no keyword</td><td>everything else</td><td>Runtime for <code>#</code>; convention for <code>_name</code></td></tr>
<tr><td>Go</td><td>none per type</td><td>lowercase name (unexported)</td><td>none (no inheritance)</td><td>Capitalised name (exported)</td><td>Compiler, at <em>package</em> level</td></tr>
</tbody>
</table>
<p>Go's rule surprises people: a lowercase field is hidden from <em>other packages</em>, but any code in the same package can touch it. So in Go you put a type like <code>Wallet</code> in its own small package to get real encapsulation.</p>

<h2>Abstraction: show what, hide how</h2>
<p><strong>Abstraction</strong> means exposing a simple idea ("pay this amount") and hiding the messy details (UPI collect requests, card 3-D Secure, wallet ledger entries). The caller works with the idea, not the details.</p>
<p>Encapsulation and abstraction are related but not the same. Encapsulation <em>protects</em> data inside one class. Abstraction <em>simplifies</em> what a whole group of classes looks like from outside, usually through an interface or an abstract class.</p>
<p>At a Razorpay-style checkout, the order service should only need one sentence of knowledge: "a payment method can pay an amount and tells me if it worked". That sentence is the abstraction. The details of NPCI for UPI or Visa for cards live behind it.</p>

<h2>Inheritance: reuse through "is-a"</h2>
<p><strong>Inheritance</strong> lets a class (the child or subclass) reuse and extend another class (the parent or base class). It models an "is-a" relationship: a card payment <em>is a</em> payment method. The child gets the parent's fields and methods and can override some of them.</p>
<p>In the code below, the abstract base class <code>PaymentMethod</code> holds the steps every payment shares: reject non-positive amounts, add any fee, charge, print a receipt. Each child fills in only what differs: how to charge, and whether there is a fee. A base method that fixes the order of steps and lets children fill in one step is called the <strong>Template Method</strong> pattern (see <a href="#/p/behavioral-patterns">Behavioral patterns</a>).</p>
<div class="callout warn"><strong>Inheritance is the most over-used pillar</strong>It couples the child tightly to the parent's internals. Change the parent and every child may break (the "fragile base class" problem). Use it only for a true, stable "is-a" with shared behaviour, and keep hierarchies one or two levels deep. More on this in <a href="#/p/design-principles">composition over inheritance</a>.</div>

<h2>Polymorphism: one call, many behaviours</h2>
<p><strong>Polymorphism</strong> (Greek for "many shapes") means the same call does different things depending on the actual object. <code>method.pay(1000)</code> charges a UPI handle, a card or a wallet depending on what <code>method</code> really is. There are two kinds.</p>
<div class="grid-2">
<div class="card"><h3>Compile-time (static)</h3><p>The compiler picks which function to call by looking at the argument types. This is <strong>method overloading</strong>: two methods with the same name but different parameters, like <code>pay(amount, method)</code> and <code>pay(amount, method, coupon)</code>. Also operator overloading (<code>a + b</code> on a C++ <code>Money</code> class) and templates/generics.</p><p>Java and C++ have overloading. Python and JavaScript do not (the last definition wins), so they use default or optional parameters. Go has neither overloading nor default parameters; you write <code>Pay</code> and <code>PayWithCoupon</code>.</p></div>
<div class="card"><h3>Run-time (dynamic)</h3><p>The program decides <em>while running</em> which method to call, based on the real object behind a parent-type reference. This is <strong>method overriding</strong> plus <strong>dynamic dispatch</strong>. A <code>List&lt;PaymentMethod&gt;</code> can hold UPI, card and wallet objects, and one loop calls the right <code>charge</code> for each.</p><p>Java methods are virtual by default. C++ methods are only dynamic if marked <code>virtual</code>. Python and JavaScript look the method up on the object at call time. Go dispatches through interface values.</p></div>
</div>
<p>The program below shows abstraction, inheritance and both kinds of polymorphism in one place. Notice that <code>Checkout</code> never mentions <code>UpiPayment</code>, <code>CardPayment</code> or <code>WalletPayment</code>. Adding Net Banking tomorrow means adding one class and changing nothing else.</p>
<div data-code="payments"></div>
<p>Expected output (same in every language):</p>
<pre><code>Paid Rs 1000 via UPI asha@okhdfc
Paid Rs 1020 via Card ****4242
FAILED Rs 1000 via Wallet
Coupon FLAT50: -Rs 50
Paid Rs 249 via UPI asha@okhdfc</code></pre>
<div class="callout tip"><strong>Look at the Go tab carefully</strong>Go has no inheritance. The shared steps live in a plain function <code>Pay(m PaymentMethod, amount)</code> that takes an interface. The default "no fee" behaviour comes from an embedded <code>base</code> struct, and <code>CardPayment</code> defines its own <code>Fee</code>. An embedded struct's methods are not virtual: if <code>base</code> had a <code>Pay</code> method that called <code>b.Fee()</code>, it would always get the base's zero fee, never the card's. That is why the template is a free function over the interface.</div>

<h2>Interfaces vs abstract classes</h2>
<p>An <strong>interface</strong> is a pure contract: a list of method signatures, no state. An <strong>abstract class</strong> is a partly built class: it can hold fields and finished methods, but cannot be created on its own and leaves some methods for children to fill in.</p>
<table>
<thead><tr><th></th><th>Interface</th><th>Abstract class</th></tr></thead>
<tbody>
<tr><td>Holds state (fields)</td><td>No (constants only)</td><td>Yes</td></tr>
<tr><td>Method bodies</td><td>None, or <code>default</code> methods (Java 8+)</td><td>Some finished, some abstract</td></tr>
<tr><td>How many can a class have</td><td>Many</td><td>One parent (Java, C#); C++ and Python allow several</td></tr>
<tr><td>Relationship it models</td><td>"can do" (Payable, Refundable, Comparable)</td><td>"is a" with shared code (PaymentMethod base)</td></tr>
<tr><td>Constructor</td><td>No</td><td>Yes (called by children)</td></tr>
<tr><td>Best for</td><td>Boundaries between modules, plug-in points, test fakes</td><td>A small family of closely related classes sharing real logic</td></tr>
</tbody>
</table>
<p>Default to an interface. Reach for an abstract class only when the children genuinely share code and fields, as with the template steps in <code>PaymentMethod</code>. Even then, many teams prefer an interface plus a helper class used by composition.</p>
<p>How each language spells these: Java has both <code>interface</code> and <code>abstract class</code>. C++ has neither keyword: an "interface" is a class with only pure virtual functions (<code>virtual bool charge(long) = 0;</code>) and a virtual destructor. Python has <code>abc.ABC</code> with <code>@abstractmethod</code>, and <code>typing.Protocol</code> for interfaces checked by shape. JavaScript has no interfaces at all; you rely on convention, JSDoc or TypeScript. Go has only interfaces, and they are satisfied <em>implicitly</em>: any type with the right methods fits, with no <code>implements</code> keyword.</p>

<h2>Composition vs inheritance: has-a vs is-a</h2>
<p><strong>Composition</strong> means building an object out of other objects that it <em>has</em>, and delegating work to them. A checkout <em>has a</em> payment method and <em>has</em> some offers. Inheritance says a class <em>is a</em> kind of another.</p>
<h3>Bad: a subclass for every combination</h3>
<p>Flipkart runs offers all the time: 10% off up to Rs 100, extra Rs 50 off on HDFC cards, cashback on UPI. Try to model "payment with offer" with inheritance and the class list explodes:</p>
<pre><code>class CardPayment extends PaymentMethod { ... }
class CardWithPercentOff extends CardPayment { ... }
class CardWithBankOffer extends CardPayment { ... }
class CardWithPercentOffAndBankOffer extends CardWithPercentOff { ... }  // copy-paste bank logic
class UpiWithPercentOff extends UpiPayment { ... }                       // copy-paste percent logic
// 3 payment types x 4 offer combinations = 12 classes, and the customer
// cannot switch from card to UPI without building a whole new object</code></pre>
<h3>Good: compose small parts and swap them at runtime</h3>
<p>Payment methods and offers are separate small types. <code>Checkout</code> holds one of each kind and delegates. New offer: one new class. Customer changes from card to UPI on the payment page: call <code>setPayment</code>.</p>
<div data-code="composition"></div>
<table>
<thead><tr><th>Question</th><th>Inheritance</th><th>Composition</th></tr></thead>
<tbody>
<tr><td>Relationship</td><td>is-a</td><td>has-a / uses-a</td></tr>
<tr><td>Fixed when?</td><td>Compile time</td><td>Can change at runtime</td></tr>
<tr><td>Coupling</td><td>Child sees parent internals (tight)</td><td>Only through the part's public interface (loose)</td></tr>
<tr><td>Combining features</td><td>One class per combination</td><td>Mix and match parts</td></tr>
<tr><td>Testing</td><td>Must build the whole hierarchy</td><td>Swap in a fake part</td></tr>
<tr><td>Good fit</td><td>Stable taxonomy with shared code (UI widgets, exceptions)</td><td>Most business logic: pricing, payments, notifications</td></tr>
</tbody>
</table>

<h2>How the five languages do OOP</h2>
<table>
<thead><tr><th>Concept</th><th>Java</th><th>Python</th><th>C++</th><th>JavaScript</th><th>Go</th></tr></thead>
<tbody>
<tr><td>Class</td><td><code>class</code></td><td><code>class</code></td><td><code>class</code> / <code>struct</code></td><td><code>class</code> (sugar over prototypes)</td><td>No classes: <code>struct</code> + methods</td></tr>
<tr><td>Inheritance</td><td><code>extends</code>, single</td><td>Multiple, with MRO (method resolution order)</td><td>Multiple, <code>public</code> base</td><td><code>extends</code>, single, via prototype chain</td><td>None. Struct <em>embedding</em> promotes methods, but it is composition</td></tr>
<tr><td>Interface</td><td><code>interface</code>, explicit <code>implements</code></td><td><code>ABC</code> or <code>Protocol</code>; duck typing</td><td>Pure virtual class</td><td>None; duck typing</td><td><code>interface</code>, implicit (structural)</td></tr>
<tr><td>Runtime dispatch</td><td>Virtual by default</td><td>Always dynamic</td><td>Only for <code>virtual</code> methods</td><td>Always dynamic (prototype lookup)</td><td>Through interface values</td></tr>
<tr><td>Overloading</td><td>Yes</td><td>No (default args, <code>singledispatch</code>)</td><td>Yes, plus operators and templates</td><td>No (optional args)</td><td>No</td></tr>
<tr><td>Abstract class</td><td><code>abstract class</code></td><td><code>ABC</code> + <code>@abstractmethod</code></td><td>Class with one pure virtual method</td><td>Throw in constructor if <code>new.target</code> is the base</td><td>Not needed</td></tr>
<tr><td>Memory</td><td>Garbage collected</td><td>Reference counting + GC</td><td>Manual / RAII; use <code>unique_ptr</code>, <code>shared_ptr</code></td><td>Garbage collected</td><td>Garbage collected</td></tr>
</tbody>
</table>
<div class="tabs">
<section data-tab="Python duck typing">
<p>"If it walks like a duck and quacks like a duck, it is a duck." Python does not check types when you call a method; it just looks for a method with that name on the object. Any object with a <code>charge</code> method can be passed where a payment is expected, even if it never inherited from <code>PaymentMethod</code>. <code>ABC</code> adds a safety net: you cannot instantiate a class that forgot an <code>@abstractmethod</code>. <code>typing.Protocol</code> lets a type checker such as mypy verify the shape without inheritance, much like Go interfaces.</p>
</section>
<section data-tab="JavaScript prototypes">
<p>Every JavaScript object has a hidden link to another object, its <strong>prototype</strong>. When you read <code>obj.pay</code> and <code>obj</code> has no own <code>pay</code>, JavaScript follows the link, then that object's link, and so on. The <code>class</code> keyword (ES2015) is a cleaner way to set up these links: <code>class Card extends PaymentMethod</code> makes <code>Card.prototype</code> link to <code>PaymentMethod.prototype</code>. There are no interfaces or abstract classes, so you either throw in the base constructor or rely on TypeScript.</p>
</section>
<section data-tab="Go without classes">
<p>Go has structs, methods (functions with a receiver, like <code>func (w *Wallet) Pay(amount int64) bool</code>), interfaces and embedding. No classes, no <code>extends</code>, no constructors (by convention a <code>NewWallet</code> function), no overloading. A type satisfies an interface just by having the methods, so a package can define a small interface for exactly what it needs, and existing types fit it without changes. Embedding a struct promotes its methods to the outer type, which looks like inheritance but is composition: there is no virtual dispatch from the embedded type back to the outer one.</p>
</section>
<section data-tab="C++ details">
<p>Mark a method <code>virtual</code> to get runtime dispatch, and use <code>override</code> in the child so the compiler catches typos. Always give a polymorphic base class a <code>virtual</code> destructor, or deleting a child through a base pointer leaks the child's parts. Store polymorphic objects through pointers or references, never by value: copying a <code>CardPayment</code> into a <code>PaymentMethod</code> variable <em>slices</em> off the card part. Prefer <code>std::unique_ptr</code> for ownership.</p>
</section>
</div>

<h2>When to use OOP, and when it is overkill</h2>
<div class="grid-2">
<div class="card good"><strong>Use classes and interfaces when</strong><ul>
<li>There is state with rules to protect (wallet balance, order status, seat inventory).</li>
<li>Several variants share one contract and more will come (payment methods, pricing rules, notification channels).</li>
<li>You need to swap a dependency in tests (a fake payment gateway).</li>
<li>The domain has clear nouns that map to objects: the classic machine-coding problems like <a href="#/p/parking-lot">parking lot</a> or <a href="#/p/vending-machine">vending machine</a>.</li>
</ul></div>
<div class="card bad"><strong>Overkill when</strong><ul>
<li>It is a pure calculation: <code>gst(amount)</code> is a function, not a <code>GstCalculatorFactory</code>.</li>
<li>An interface has exactly one implementation and no test needs to fake it.</li>
<li>A class has only data and no behaviour; use a record, dataclass or struct.</li>
<li>A hierarchy is three or more levels deep. Flatten it or switch to composition.</li>
</ul></div>
</div>

<h2>Common interview questions and pitfalls</h2>
<ul>
<li><strong>"Difference between abstraction and encapsulation?"</strong> Encapsulation hides data inside one class and guards its rules. Abstraction hides implementation details behind a simple contract shared by many classes.</li>
<li><strong>"Overloading vs overriding?"</strong> Overloading: same name, different parameters, chosen at compile time. Overriding: child redefines a parent method with the same signature, chosen at runtime.</li>
<li><strong>"Can a static method be overridden?"</strong> No. In Java a static method with the same signature in a child <em>hides</em> the parent's; the call is resolved by the reference type, not the object.</li>
<li><strong>"Why does Go not have inheritance?"</strong> Its designers chose composition (embedding) plus implicit interfaces to avoid deep, fragile hierarchies.</li>
<li><strong>Pitfall:</strong> modelling vehicle types or user roles as subclasses when they carry no behaviour. An enum is simpler.</li>
<li><strong>Pitfall:</strong> a child that overrides a method to throw "not supported". That breaks substitutability (see <a href="#/p/solid">Liskov substitution</a>).</li>
</ul>
<div class="callout interview"><strong>Say this in the interview</strong>"I will keep the balance private and expose behaviour like <code>pay</code> and <code>addMoney</code>, so the 'never negative' rule lives in one place. The checkout depends on a <code>PaymentMethod</code> interface, so UPI, card and wallet are interchangeable at runtime through polymorphism, and adding Net Banking is a new class with no edits to checkout. Offers are composed into the checkout rather than baked into payment subclasses, which avoids a class per combination and lets the user switch payment methods mid-flow."</div>

<h2>Test yourself</h2>
<div class="quiz">
<details><summary>A Wallet class has a private balance with a public setBalance(long). Is it encapsulated?</summary><div>Not really. Anyone can still set any value, including a negative one. Encapsulation is about enforcing the rules inside the class, so expose operations like <code>pay(amount)</code> and <code>addMoney(amount)</code> that validate, and drop the raw setter.</div></details>
<details><summary>Python and JavaScript have no method overloading. How do you offer pay(amount) and pay(amount, coupon)?</summary><div>Use an optional or default parameter: <code>def pay(self, amount, method, coupon=None)</code> in Python, <code>pay(amount, method, coupon = null)</code> in JavaScript. Python also has <code>functools.singledispatch</code> to choose by the type of the first argument. In Go, write two functions with different names.</div></details>
<details><summary>In C++, what goes wrong if PaymentMethod has no virtual destructor?</summary><div>Deleting a <code>CardPayment</code> through a <code>PaymentMethod*</code> (or a <code>unique_ptr&lt;PaymentMethod&gt;</code>) calls only the base destructor. The child's members are never destroyed: undefined behaviour, typically a leak. Any class meant to be used polymorphically needs a <code>virtual ~Base() = default;</code>.</div></details>
<details><summary>In Go, CardPayment embeds base, and base has a method Describe() that calls b.Fee(). CardPayment defines its own Fee(). What fee does card.Describe() use?</summary><div>The base's fee. Embedding is composition: <code>Describe</code> is promoted, but inside it the receiver is still the embedded <code>base</code>, and Go has no virtual dispatch back to the outer struct. To get the card's fee, make the shared logic a function that takes an interface, as in the payments example.</div></details>
<details><summary>When would you choose an abstract class over an interface?</summary><div>When a small, stable family of classes shares real state and code, and you want to enforce a fixed sequence of steps (Template Method). Example: every payment validates the amount, adds a fee, charges and prints a receipt. For plug-in points and module boundaries, prefer an interface.</div></details>
<details><summary>Your teammate wants UpiWithCashback extends UpiPayment and CardWithCashback extends CardPayment. What do you suggest?</summary><div>Composition. Make cashback an <code>Offer</code> that the checkout holds, independent of the payment method. Then any payment method works with any set of offers, the number of classes grows by addition instead of multiplication, and the payment method can be swapped at runtime.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
<li>A class is a blueprint, an object is one instance with its own data.</li>
<li>Encapsulation: private state, public behaviour. Getters and setters for every field are not encapsulation.</li>
<li>Abstraction: callers depend on "what" (an interface), not "how".</li>
<li>Inheritance models a true is-a with shared code. Keep it shallow; it couples tightly.</li>
<li>Polymorphism: overloading is resolved at compile time, overriding at runtime. Runtime polymorphism is what makes code open to new types.</li>
<li>Prefer composition (has-a) for business variations like offers and payment options.</li>
<li>Go has no classes or inheritance: structs, methods, embedding and implicit interfaces do the job. Python and JavaScript rely on duck typing; C++ needs <code>virtual</code> and a virtual destructor.</li>
</ul></div>
`,
  code: {
    encapsulation: {
      title: "Encapsulation: a wallet that guards its own balance",
      java: String.raw`import java.util.ArrayList;
import java.util.List;

public class WalletDemo {

    static class Wallet {
        private final String owner;
        private long balance;                         // rupees; only Wallet can change it
        private final List<String> history = new ArrayList<>();

        Wallet(String owner) { this.owner = owner; }

        public void addMoney(long amount) {
            if (amount <= 0) throw new IllegalArgumentException("amount must be positive");
            balance += amount;
            history.add("+" + amount);
        }

        public boolean pay(long amount) {
            if (amount <= 0) throw new IllegalArgumentException("amount must be positive");
            if (amount > balance) return false;       // the rule lives in one place
            balance -= amount;
            history.add("-" + amount);
            return true;
        }

        public String getOwner() { return owner; }
        public long getBalance() { return balance; }  // read-only: no setter
        public List<String> getHistory() { return List.copyOf(history); } // defensive copy
    }

    public static void main(String[] args) {
        Wallet w = new Wallet("Asha");
        w.addMoney(500);
        System.out.println("Added Rs 500 to " + w.getOwner() + "'s wallet");
        if (w.pay(120)) System.out.println("Paid Rs 120");
        if (!w.pay(1000)) System.out.println("Payment of Rs 1000 declined: insufficient balance");
        try {
            w.addMoney(-50);
        } catch (IllegalArgumentException e) {
            System.out.println("Rejected: " + e.getMessage());
        }
        // w.balance = 1_000_000;   // compile error: balance has private access
        System.out.println("Balance: Rs " + w.getBalance() + " | history: " + String.join(", ", w.getHistory()));
    }
}
`,
      python: String.raw`class Wallet:
    def __init__(self, owner: str) -> None:
        self._owner = owner
        self.__balance = 0          # double underscore: name-mangled, hard to reach from outside
        self._history: list[str] = []

    @property
    def owner(self) -> str:
        return self._owner

    @property
    def balance(self) -> int:       # read-only property: there is no setter
        return self.__balance

    @property
    def history(self) -> tuple[str, ...]:
        return tuple(self._history) # immutable copy

    def add_money(self, amount: int) -> None:
        if amount <= 0:
            raise ValueError("amount must be positive")
        self.__balance += amount
        self._history.append(f"+{amount}")

    def pay(self, amount: int) -> bool:
        if amount <= 0:
            raise ValueError("amount must be positive")
        if amount > self.__balance:   # the rule lives in one place
            return False
        self.__balance -= amount
        self._history.append(f"-{amount}")
        return True


if __name__ == "__main__":
    w = Wallet("Asha")
    w.add_money(500)
    print(f"Added Rs 500 to {w.owner}'s wallet")
    if w.pay(120):
        print("Paid Rs 120")
    if not w.pay(1000):
        print("Payment of Rs 1000 declined: insufficient balance")
    try:
        w.add_money(-50)
    except ValueError as e:
        print(f"Rejected: {e}")
    # w.balance = 1_000_000  -> AttributeError: property has no setter
    print(f"Balance: Rs {w.balance} | history: {', '.join(w.history)}")
`,
      cpp: String.raw`#include <iostream>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

class Wallet {
public:
    explicit Wallet(std::string owner) : owner_(std::move(owner)) {}

    void addMoney(long amount) {
        if (amount <= 0) throw std::invalid_argument("amount must be positive");
        balance_ += amount;
        history_.push_back("+" + std::to_string(amount));
    }

    bool pay(long amount) {
        if (amount <= 0) throw std::invalid_argument("amount must be positive");
        if (amount > balance_) return false;        // the rule lives in one place
        balance_ -= amount;
        history_.push_back("-" + std::to_string(amount));
        return true;
    }

    const std::string& owner() const { return owner_; }
    long balance() const { return balance_; }      // read-only accessor
    const std::vector<std::string>& history() const { return history_; } // const ref: cannot modify

private:                                           // only Wallet's own methods can touch these
    std::string owner_;
    long balance_ = 0;
    std::vector<std::string> history_;
};

int main() {
    Wallet w("Asha");
    w.addMoney(500);
    std::cout << "Added Rs 500 to " << w.owner() << "'s wallet\n";
    if (w.pay(120)) std::cout << "Paid Rs 120\n";
    if (!w.pay(1000)) std::cout << "Payment of Rs 1000 declined: insufficient balance\n";
    try {
        w.addMoney(-50);
    } catch (const std::invalid_argument& e) {
        std::cout << "Rejected: " << e.what() << "\n";
    }
    // w.balance_ = 1000000;   // compile error: balance_ is private
    std::cout << "Balance: Rs " << w.balance() << " | history: ";
    for (size_t i = 0; i < w.history().size(); ++i) {
        std::cout << (i ? ", " : "") << w.history()[i];
    }
    std::cout << "\n";
    return 0;
}
`,
      javascript: String.raw`class Wallet {
  #balance = 0;          // # = truly private (ES2022); outside code cannot read or write it
  #history = [];

  constructor(owner) {
    this.owner = owner;
  }

  addMoney(amount) {
    if (amount <= 0) throw new RangeError("amount must be positive");
    this.#balance += amount;
    this.#history.push("+" + amount);
  }

  pay(amount) {
    if (amount <= 0) throw new RangeError("amount must be positive");
    if (amount > this.#balance) return false; // the rule lives in one place
    this.#balance -= amount;
    this.#history.push("-" + amount);
    return true;
  }

  get balance() { return this.#balance; }      // getter only: assigning has no effect
  get history() { return [...this.#history]; } // copy, so callers cannot push into it
}

const w = new Wallet("Asha");
w.addMoney(500);
console.log("Added Rs 500 to " + w.owner + "'s wallet");
if (w.pay(120)) console.log("Paid Rs 120");
if (!w.pay(1000)) console.log("Payment of Rs 1000 declined: insufficient balance");
try {
  w.addMoney(-50);
} catch (e) {
  console.log("Rejected: " + e.message);
}
// w.#balance = 1000000;  // SyntaxError: private field
console.log("Balance: Rs " + w.balance + " | history: " + w.history.join(", "));
`,
      go: String.raw`package main

import (
	"errors"
	"fmt"
	"strings"
)

// In a real project Wallet lives in its own package (say, wallet/),
// so other packages cannot touch the lowercase (unexported) fields.
type Wallet struct {
	owner   string
	balance int64
	history []string
}

func NewWallet(owner string) *Wallet { return &Wallet{owner: owner} }

func (w *Wallet) AddMoney(amount int64) error {
	if amount <= 0 {
		return errors.New("amount must be positive")
	}
	w.balance += amount
	w.history = append(w.history, fmt.Sprintf("+%d", amount))
	return nil
}

func (w *Wallet) Pay(amount int64) bool {
	if amount <= 0 || amount > w.balance { // the rule lives in one place
		return false
	}
	w.balance -= amount
	w.history = append(w.history, fmt.Sprintf("-%d", amount))
	return true
}

func (w *Wallet) Owner() string    { return w.owner }
func (w *Wallet) Balance() int64   { return w.balance }
func (w *Wallet) History() []string { return append([]string(nil), w.history...) } // copy

func main() {
	w := NewWallet("Asha")
	_ = w.AddMoney(500)
	fmt.Printf("Added Rs 500 to %s's wallet\n", w.Owner())
	if w.Pay(120) {
		fmt.Println("Paid Rs 120")
	}
	if !w.Pay(1000) {
		fmt.Println("Payment of Rs 1000 declined: insufficient balance")
	}
	if err := w.AddMoney(-50); err != nil {
		fmt.Println("Rejected:", err)
	}
	fmt.Printf("Balance: Rs %d | history: %s\n", w.Balance(), strings.Join(w.History(), ", "))
}
`,
    },
    payments: {
      title: "Abstraction, inheritance and polymorphism: payment methods at checkout",
      java: String.raw`import java.util.List;

public class PaymentsDemo {

    // Abstraction + inheritance: shared steps here, the varying step is abstract.
    static abstract class PaymentMethod {
        private final String label;
        protected PaymentMethod(String label) { this.label = label; }

        // Template method: final so children cannot change the order of steps.
        public final boolean pay(long amount) {
            if (amount <= 0) throw new IllegalArgumentException("amount must be positive");
            long total = amount + fee(amount);
            boolean ok = charge(total);                       // runtime dispatch
            System.out.println((ok ? "Paid Rs " : "FAILED Rs ") + total + " via " + label);
            return ok;
        }

        protected long fee(long amount) { return 0; }         // default: no fee
        protected abstract boolean charge(long total);        // each child must implement
    }

    static class UpiPayment extends PaymentMethod {
        UpiPayment(String vpa) { super("UPI " + vpa); }
        @Override protected boolean charge(long total) { return true; } // would call the PSP
    }

    static class CardPayment extends PaymentMethod {
        CardPayment(String last4) { super("Card ****" + last4); }
        @Override protected long fee(long amount) { return amount * 2 / 100; } // 2% convenience fee
        @Override protected boolean charge(long total) { return true; }
    }

    static class WalletPayment extends PaymentMethod {
        private long balance;
        WalletPayment(long balance) { super("Wallet"); this.balance = balance; }
        @Override protected boolean charge(long total) {
            if (total > balance) return false;
            balance -= total;
            return true;
        }
    }

    static class Checkout {
        // Runtime polymorphism: works with any PaymentMethod, present or future.
        boolean pay(long amount, PaymentMethod method) { return method.pay(amount); }

        // Compile-time polymorphism: an overload chosen by the argument list.
        boolean pay(long amount, PaymentMethod method, String coupon) {
            long discount = "FLAT50".equals(coupon) ? 50 : 0;
            System.out.println("Coupon " + coupon + ": -Rs " + discount);
            return pay(amount - discount, method);
        }
    }

    public static void main(String[] args) {
        List<PaymentMethod> methods = List.of(
            new UpiPayment("asha@okhdfc"), new CardPayment("4242"), new WalletPayment(300));
        Checkout checkout = new Checkout();
        for (PaymentMethod m : methods) checkout.pay(1000, m);
        checkout.pay(299, methods.get(0), "FLAT50");
    }
}
`,
      python: String.raw`from abc import ABC, abstractmethod
from typing import Optional


class PaymentMethod(ABC):
    """Abstraction + inheritance: shared steps here, the varying step is abstract."""

    def __init__(self, label: str) -> None:
        self._label = label

    def pay(self, amount: int) -> bool:          # template method
        if amount <= 0:
            raise ValueError("amount must be positive")
        total = amount + self.fee(amount)
        ok = self.charge(total)                  # dynamic dispatch
        print(f"{'Paid' if ok else 'FAILED'} Rs {total} via {self._label}")
        return ok

    def fee(self, amount: int) -> int:           # default: no fee
        return 0

    @abstractmethod
    def charge(self, total: int) -> bool:        # each child must implement
        ...


class UpiPayment(PaymentMethod):
    def __init__(self, vpa: str) -> None:
        super().__init__(f"UPI {vpa}")

    def charge(self, total: int) -> bool:
        return True                              # would call the PSP


class CardPayment(PaymentMethod):
    def __init__(self, last4: str) -> None:
        super().__init__(f"Card ****{last4}")

    def fee(self, amount: int) -> int:
        return amount * 2 // 100                 # 2% convenience fee

    def charge(self, total: int) -> bool:
        return True


class WalletPayment(PaymentMethod):
    def __init__(self, balance: int) -> None:
        super().__init__("Wallet")
        self._balance = balance

    def charge(self, total: int) -> bool:
        if total > self._balance:
            return False
        self._balance -= total
        return True


class Checkout:
    # No overloading in Python: one method with an optional parameter instead.
    def pay(self, amount: int, method: PaymentMethod, coupon: Optional[str] = None) -> bool:
        if coupon is not None:
            discount = 50 if coupon == "FLAT50" else 0
            print(f"Coupon {coupon}: -Rs {discount}")
            amount -= discount
        return method.pay(amount)


if __name__ == "__main__":
    methods: list[PaymentMethod] = [UpiPayment("asha@okhdfc"), CardPayment("4242"), WalletPayment(300)]
    checkout = Checkout()
    for m in methods:
        checkout.pay(1000, m)
    checkout.pay(299, methods[0], "FLAT50")
    # PaymentMethod("x") would raise TypeError: can't instantiate abstract class
`,
      cpp: String.raw`#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

// Abstraction + inheritance: shared steps here, the varying step is pure virtual.
class PaymentMethod {
public:
    explicit PaymentMethod(std::string label) : label_(std::move(label)) {}
    virtual ~PaymentMethod() = default;            // required for polymorphic deletion

    bool pay(long amount) {                        // template method (non-virtual)
        if (amount <= 0) throw std::invalid_argument("amount must be positive");
        long total = amount + fee(amount);
        bool ok = charge(total);                   // virtual call: runtime dispatch
        std::cout << (ok ? "Paid Rs " : "FAILED Rs ") << total << " via " << label_ << "\n";
        return ok;
    }

protected:
    virtual long fee(long) const { return 0; }     // default: no fee
    virtual bool charge(long total) = 0;           // pure virtual: makes the class abstract

private:
    std::string label_;
};

class UpiPayment : public PaymentMethod {
public:
    explicit UpiPayment(const std::string& vpa) : PaymentMethod("UPI " + vpa) {}
protected:
    bool charge(long) override { return true; }    // would call the PSP
};

class CardPayment : public PaymentMethod {
public:
    explicit CardPayment(const std::string& last4) : PaymentMethod("Card ****" + last4) {}
protected:
    long fee(long amount) const override { return amount * 2 / 100; } // 2% convenience fee
    bool charge(long) override { return true; }
};

class WalletPayment : public PaymentMethod {
public:
    explicit WalletPayment(long balance) : PaymentMethod("Wallet"), balance_(balance) {}
protected:
    bool charge(long total) override {
        if (total > balance_) return false;
        balance_ -= total;
        return true;
    }
private:
    long balance_;
};

class Checkout {
public:
    // Runtime polymorphism through a base-class reference.
    bool pay(long amount, PaymentMethod& method) { return method.pay(amount); }

    // Compile-time polymorphism: overload chosen by the argument list.
    bool pay(long amount, PaymentMethod& method, const std::string& coupon) {
        long discount = coupon == "FLAT50" ? 50 : 0;
        std::cout << "Coupon " << coupon << ": -Rs " << discount << "\n";
        return pay(amount - discount, method);
    }
};

int main() {
    std::vector<std::unique_ptr<PaymentMethod>> methods;
    methods.push_back(std::make_unique<UpiPayment>("asha@okhdfc"));
    methods.push_back(std::make_unique<CardPayment>("4242"));
    methods.push_back(std::make_unique<WalletPayment>(300));

    Checkout checkout;
    for (auto& m : methods) checkout.pay(1000, *m);
    checkout.pay(299, *methods[0], "FLAT50");
    return 0;
}
`,
      javascript: String.raw`// Abstraction + inheritance: shared steps here, the varying step is "abstract".
class PaymentMethod {
  constructor(label) {
    if (new.target === PaymentMethod) {
      throw new TypeError("PaymentMethod is abstract");
    }
    this.label = label;
  }

  pay(amount) {                                // template method
    if (amount <= 0) throw new RangeError("amount must be positive");
    const total = amount + this.fee(amount);
    const ok = this.charge(total);             // looked up on the prototype chain at runtime
    console.log((ok ? "Paid Rs " : "FAILED Rs ") + total + " via " + this.label);
    return ok;
  }

  fee(amount) { return 0; }                    // default: no fee
  charge(total) { throw new Error("charge() not implemented"); }
}

class UpiPayment extends PaymentMethod {
  constructor(vpa) { super("UPI " + vpa); }
  charge(total) { return true; }               // would call the PSP
}

class CardPayment extends PaymentMethod {
  constructor(last4) { super("Card ****" + last4); }
  fee(amount) { return Math.floor(amount * 2 / 100); } // 2% convenience fee
  charge(total) { return true; }
}

class WalletPayment extends PaymentMethod {
  #balance;
  constructor(balance) { super("Wallet"); this.#balance = balance; }
  charge(total) {
    if (total > this.#balance) return false;
    this.#balance -= total;
    return true;
  }
}

class Checkout {
  // No overloading in JavaScript: an optional parameter instead.
  pay(amount, method, coupon = null) {
    if (coupon !== null) {
      const discount = coupon === "FLAT50" ? 50 : 0;
      console.log("Coupon " + coupon + ": -Rs " + discount);
      amount -= discount;
    }
    return method.pay(amount);
  }
}

const methods = [new UpiPayment("asha@okhdfc"), new CardPayment("4242"), new WalletPayment(300)];
const checkout = new Checkout();
for (const m of methods) checkout.pay(1000, m);
checkout.pay(299, methods[0], "FLAT50");
`,
      go: String.raw`package main

import "fmt"

// Go has no classes or inheritance. The contract is an interface,
// satisfied implicitly by any type that has these methods.
type PaymentMethod interface {
	Label() string
	Fee(amount int64) int64
	Charge(total int64) bool
}

// base is embedded for shared data and a default Fee. Embedding is composition:
// its methods are promoted to the outer struct, but they are not virtual.
type base struct{ label string }

func (b base) Label() string        { return b.label }
func (b base) Fee(amount int64) int64 { return 0 }

type UpiPayment struct{ base }

func NewUpi(vpa string) *UpiPayment       { return &UpiPayment{base{"UPI " + vpa}} }
func (u *UpiPayment) Charge(total int64) bool { return true } // would call the PSP

type CardPayment struct{ base }

func NewCard(last4 string) *CardPayment         { return &CardPayment{base{"Card ****" + last4}} }
func (c *CardPayment) Fee(amount int64) int64   { return amount * 2 / 100 } // 2% convenience fee
func (c *CardPayment) Charge(total int64) bool  { return true }

type WalletPayment struct {
	base
	balance int64
}

func NewWallet(balance int64) *WalletPayment { return &WalletPayment{base{"Wallet"}, balance} }
func (w *WalletPayment) Charge(total int64) bool {
	if total > w.balance {
		return false
	}
	w.balance -= total
	return true
}

// Pay holds the shared steps. It is a function over the interface,
// so Fee and Charge dispatch to the real type (runtime polymorphism).
func Pay(m PaymentMethod, amount int64) bool {
	if amount <= 0 {
		panic("amount must be positive")
	}
	total := amount + m.Fee(amount)
	ok := m.Charge(total)
	status := "Paid"
	if !ok {
		status = "FAILED"
	}
	fmt.Printf("%s Rs %d via %s\n", status, total, m.Label())
	return ok
}

// No overloading in Go: a second function with its own name.
func PayWithCoupon(m PaymentMethod, amount int64, coupon string) bool {
	var discount int64
	if coupon == "FLAT50" {
		discount = 50
	}
	fmt.Printf("Coupon %s: -Rs %d\n", coupon, discount)
	return Pay(m, amount-discount)
}

func main() {
	methods := []PaymentMethod{NewUpi("asha@okhdfc"), NewCard("4242"), NewWallet(300)}
	for _, m := range methods {
		Pay(m, 1000)
	}
	PayWithCoupon(methods[0], 299, "FLAT50")
}
`,
    },
    composition: {
      title: "Composition: a checkout that has a payment method and offers",
      java: String.raw`import java.util.List;

public class CompositionDemo {

    interface PaymentMethod {
        String name();
        void pay(long amount);
    }

    interface Offer {
        String label();
        long discount(long amount, PaymentMethod method);
    }

    record CardPayment(String bank) implements PaymentMethod {
        public String name() { return bank + " card"; }
        public void pay(long amount) { System.out.println("  Paid Rs " + amount + " via " + name()); }
    }

    record UpiPayment(String vpa) implements PaymentMethod {
        public String name() { return "UPI"; }
        public void pay(long amount) { System.out.println("  Paid Rs " + amount + " via " + name()); }
    }

    record PercentOff(int percent, long cap) implements Offer {
        public String label() { return percent + "% off up to Rs " + cap; }
        public long discount(long amount, PaymentMethod m) { return Math.min(amount * percent / 100, cap); }
    }

    record BankOffer(String bank, long flat) implements Offer {
        public String label() { return "Rs " + flat + " off on " + bank; }
        public long discount(long amount, PaymentMethod m) { return m.name().startsWith(bank) ? flat : 0; }
    }

    // Checkout HAS a payment method and HAS offers. It delegates to them.
    static class Checkout {
        private PaymentMethod payment;
        private final List<Offer> offers;

        Checkout(PaymentMethod payment, List<Offer> offers) {
            this.payment = payment;
            this.offers = offers;
        }

        void setPayment(PaymentMethod p) { this.payment = p; }   // swap at runtime

        void checkout(long amount) {
            System.out.println("Checkout Rs " + amount + " with " + payment.name());
            long total = amount;
            for (Offer o : offers) {
                long d = o.discount(amount, payment);
                if (d > 0) {
                    System.out.println("  " + o.label() + ": -Rs " + d);
                    total -= d;
                }
            }
            payment.pay(total);
        }
    }

    public static void main(String[] args) {
        Checkout c = new Checkout(new CardPayment("HDFC"),
                List.of(new PercentOff(10, 100), new BankOffer("HDFC", 50)));
        c.checkout(1500);
        c.setPayment(new UpiPayment("asha@okicici"));
        c.checkout(1500);
    }
}
`,
      python: String.raw`from typing import Protocol


class PaymentMethod(Protocol):          # structural interface: no inheritance needed
    def name(self) -> str: ...
    def pay(self, amount: int) -> None: ...


class Offer(Protocol):
    def label(self) -> str: ...
    def discount(self, amount: int, method: PaymentMethod) -> int: ...


class CardPayment:
    def __init__(self, bank: str) -> None:
        self.bank = bank

    def name(self) -> str:
        return f"{self.bank} card"

    def pay(self, amount: int) -> None:
        print(f"  Paid Rs {amount} via {self.name()}")


class UpiPayment:
    def __init__(self, vpa: str) -> None:
        self.vpa = vpa

    def name(self) -> str:
        return "UPI"

    def pay(self, amount: int) -> None:
        print(f"  Paid Rs {amount} via {self.name()}")


class PercentOff:
    def __init__(self, percent: int, cap: int) -> None:
        self.percent, self.cap = percent, cap

    def label(self) -> str:
        return f"{self.percent}% off up to Rs {self.cap}"

    def discount(self, amount: int, method: PaymentMethod) -> int:
        return min(amount * self.percent // 100, self.cap)


class BankOffer:
    def __init__(self, bank: str, flat: int) -> None:
        self.bank, self.flat = bank, flat

    def label(self) -> str:
        return f"Rs {self.flat} off on {self.bank}"

    def discount(self, amount: int, method: PaymentMethod) -> int:
        return self.flat if method.name().startswith(self.bank) else 0


class Checkout:
    """HAS a payment method and HAS offers. It delegates to them."""

    def __init__(self, payment: PaymentMethod, offers: list[Offer]) -> None:
        self.payment = payment          # swap at runtime by assigning a new one
        self.offers = offers

    def checkout(self, amount: int) -> None:
        print(f"Checkout Rs {amount} with {self.payment.name()}")
        total = amount
        for o in self.offers:
            d = o.discount(amount, self.payment)
            if d > 0:
                print(f"  {o.label()}: -Rs {d}")
                total -= d
        self.payment.pay(total)


if __name__ == "__main__":
    c = Checkout(CardPayment("HDFC"), [PercentOff(10, 100), BankOffer("HDFC", 50)])
    c.checkout(1500)
    c.payment = UpiPayment("asha@okicici")
    c.checkout(1500)
`,
      cpp: String.raw`#include <algorithm>
#include <iostream>
#include <memory>
#include <string>
#include <utility>
#include <vector>

struct PaymentMethod {
    virtual ~PaymentMethod() = default;
    virtual std::string name() const = 0;
    virtual void pay(long amount) = 0;
};

struct Offer {
    virtual ~Offer() = default;
    virtual std::string label() const = 0;
    virtual long discount(long amount, const PaymentMethod& m) const = 0;
};

class CardPayment : public PaymentMethod {
public:
    explicit CardPayment(std::string bank) : bank_(std::move(bank)) {}
    std::string name() const override { return bank_ + " card"; }
    void pay(long amount) override { std::cout << "  Paid Rs " << amount << " via " << name() << "\n"; }
private:
    std::string bank_;
};

class UpiPayment : public PaymentMethod {
public:
    explicit UpiPayment(std::string vpa) : vpa_(std::move(vpa)) {}
    std::string name() const override { return "UPI"; }
    void pay(long amount) override { std::cout << "  Paid Rs " << amount << " via " << name() << "\n"; }
private:
    std::string vpa_;
};

class PercentOff : public Offer {
public:
    PercentOff(int percent, long cap) : percent_(percent), cap_(cap) {}
    std::string label() const override {
        return std::to_string(percent_) + "% off up to Rs " + std::to_string(cap_);
    }
    long discount(long amount, const PaymentMethod&) const override {
        return std::min(amount * percent_ / 100, cap_);
    }
private:
    int percent_;
    long cap_;
};

class BankOffer : public Offer {
public:
    BankOffer(std::string bank, long flat) : bank_(std::move(bank)), flat_(flat) {}
    std::string label() const override { return "Rs " + std::to_string(flat_) + " off on " + bank_; }
    long discount(long, const PaymentMethod& m) const override {
        return m.name().rfind(bank_, 0) == 0 ? flat_ : 0;   // starts with bank name
    }
private:
    std::string bank_;
    long flat_;
};

// Checkout HAS a payment method and HAS offers. It delegates to them.
class Checkout {
public:
    Checkout(std::unique_ptr<PaymentMethod> payment, std::vector<std::unique_ptr<Offer>> offers)
        : payment_(std::move(payment)), offers_(std::move(offers)) {}

    void setPayment(std::unique_ptr<PaymentMethod> p) { payment_ = std::move(p); } // swap at runtime

    void checkout(long amount) {
        std::cout << "Checkout Rs " << amount << " with " << payment_->name() << "\n";
        long total = amount;
        for (const auto& o : offers_) {
            long d = o->discount(amount, *payment_);
            if (d > 0) {
                std::cout << "  " << o->label() << ": -Rs " << d << "\n";
                total -= d;
            }
        }
        payment_->pay(total);
    }

private:
    std::unique_ptr<PaymentMethod> payment_;
    std::vector<std::unique_ptr<Offer>> offers_;
};

int main() {
    std::vector<std::unique_ptr<Offer>> offers;
    offers.push_back(std::make_unique<PercentOff>(10, 100));
    offers.push_back(std::make_unique<BankOffer>("HDFC", 50));
    Checkout c(std::make_unique<CardPayment>("HDFC"), std::move(offers));
    c.checkout(1500);
    c.setPayment(std::make_unique<UpiPayment>("asha@okicici"));
    c.checkout(1500);
    return 0;
}
`,
      javascript: String.raw`// "Interfaces" by convention: any object with name()/pay() is a payment method,
// any object with label()/discount() is an offer.
class CardPayment {
  constructor(bank) { this.bank = bank; }
  name() { return this.bank + " card"; }
  pay(amount) { console.log("  Paid Rs " + amount + " via " + this.name()); }
}

class UpiPayment {
  constructor(vpa) { this.vpa = vpa; }
  name() { return "UPI"; }
  pay(amount) { console.log("  Paid Rs " + amount + " via " + this.name()); }
}

class PercentOff {
  constructor(percent, cap) { this.percent = percent; this.cap = cap; }
  label() { return this.percent + "% off up to Rs " + this.cap; }
  discount(amount) { return Math.min(Math.floor(amount * this.percent / 100), this.cap); }
}

class BankOffer {
  constructor(bank, flat) { this.bank = bank; this.flat = flat; }
  label() { return "Rs " + this.flat + " off on " + this.bank; }
  discount(amount, method) { return method.name().startsWith(this.bank) ? this.flat : 0; }
}

// Checkout HAS a payment method and HAS offers. It delegates to them.
class Checkout {
  constructor(payment, offers) {
    this.payment = payment;
    this.offers = offers;
  }

  setPayment(p) { this.payment = p; } // swap at runtime

  checkout(amount) {
    console.log("Checkout Rs " + amount + " with " + this.payment.name());
    let total = amount;
    for (const o of this.offers) {
      const d = o.discount(amount, this.payment);
      if (d > 0) {
        console.log("  " + o.label() + ": -Rs " + d);
        total -= d;
      }
    }
    this.payment.pay(total);
  }
}

const c = new Checkout(new CardPayment("HDFC"), [new PercentOff(10, 100), new BankOffer("HDFC", 50)]);
c.checkout(1500);
c.setPayment(new UpiPayment("asha@okicici"));
c.checkout(1500);
`,
      go: String.raw`package main

import (
	"fmt"
	"strings"
)

type PaymentMethod interface {
	Name() string
	Pay(amount int64)
}

type Offer interface {
	Label() string
	Discount(amount int64, m PaymentMethod) int64
}

type CardPayment struct{ Bank string }

func (c CardPayment) Name() string     { return c.Bank + " card" }
func (c CardPayment) Pay(amount int64) { fmt.Printf("  Paid Rs %d via %s\n", amount, c.Name()) }

type UpiPayment struct{ VPA string }

func (u UpiPayment) Name() string     { return "UPI" }
func (u UpiPayment) Pay(amount int64) { fmt.Printf("  Paid Rs %d via %s\n", amount, u.Name()) }

type PercentOff struct {
	Percent int64
	Cap     int64
}

func (p PercentOff) Label() string { return fmt.Sprintf("%d%% off up to Rs %d", p.Percent, p.Cap) }
func (p PercentOff) Discount(amount int64, _ PaymentMethod) int64 {
	return min(amount*p.Percent/100, p.Cap)
}

type BankOffer struct {
	Bank string
	Flat int64
}

func (b BankOffer) Label() string { return fmt.Sprintf("Rs %d off on %s", b.Flat, b.Bank) }
func (b BankOffer) Discount(_ int64, m PaymentMethod) int64 {
	if strings.HasPrefix(m.Name(), b.Bank) {
		return b.Flat
	}
	return 0
}

// Checkout HAS a payment method and HAS offers. It delegates to them.
type Checkout struct {
	Payment PaymentMethod // swap at runtime by assigning a new value
	Offers  []Offer
}

func (c *Checkout) Checkout(amount int64) {
	fmt.Printf("Checkout Rs %d with %s\n", amount, c.Payment.Name())
	total := amount
	for _, o := range c.Offers {
		if d := o.Discount(amount, c.Payment); d > 0 {
			fmt.Printf("  %s: -Rs %d\n", o.Label(), d)
			total -= d
		}
	}
	c.Payment.Pay(total)
}

func main() {
	c := &Checkout{
		Payment: CardPayment{Bank: "HDFC"},
		Offers:  []Offer{PercentOff{10, 100}, BankOffer{"HDFC", 50}},
	}
	c.Checkout(1500)
	c.Payment = UpiPayment{VPA: "asha@okicici"}
	c.Checkout(1500)
}
`,
    },
  },
  diagrams: {
    payments: String.raw`classDiagram
  class Checkout {
    +pay(amount, method) bool
    +pay(amount, method, coupon) bool
  }
  class PaymentMethod {
    <<abstract>>
    -label String
    +pay(amount) bool
    #fee(amount) long
    #charge(total)* bool
  }
  class UpiPayment {
    #charge(total) bool
  }
  class CardPayment {
    #fee(amount) long
    #charge(total) bool
  }
  class WalletPayment {
    -balance long
    #charge(total) bool
  }
  Checkout ..> PaymentMethod : uses
  PaymentMethod <|-- UpiPayment
  PaymentMethod <|-- CardPayment
  PaymentMethod <|-- WalletPayment`,
  },
});
