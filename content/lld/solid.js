SD.register({
  id: "solid",
  html: String.raw`
<p class="lead">SOLID is five design rules, collected by Robert C. Martin ("Uncle Bob"), for writing classes that are easy to change without breaking something else. Interviewers at Flipkart, Swiggy, Amazon and most product companies ask "which SOLID principles did you apply?" after almost every machine-coding round. This page takes each letter, shows a real code smell from an Indian product codebase, the bad version, and a refactor that runs in Java, Python, C++, JavaScript and Go. The goal is not to recite definitions but to spot the smell and name the fix.</p>

<h2>The five principles at a glance</h2>
<figure class="svg-fig">
<svg viewBox="0 0 700 210" role="img" aria-label="The five SOLID principles">
  <rect class="s-accent" x="10" y="20" width="124" height="170" rx="10"/>
  <text class="s-title" x="72" y="62" text-anchor="middle">S</text>
  <text class="s-text" x="72" y="92" text-anchor="middle">Single</text>
  <text class="s-text" x="72" y="110" text-anchor="middle">Responsibility</text>
  <text class="s-muted" x="72" y="146" text-anchor="middle">one reason</text>
  <text class="s-muted" x="72" y="164" text-anchor="middle">to change</text>
  <rect class="s-accent" x="148" y="20" width="124" height="170" rx="10"/>
  <text class="s-title" x="210" y="62" text-anchor="middle">O</text>
  <text class="s-text" x="210" y="92" text-anchor="middle">Open /</text>
  <text class="s-text" x="210" y="110" text-anchor="middle">Closed</text>
  <text class="s-muted" x="210" y="146" text-anchor="middle">add code, don't</text>
  <text class="s-muted" x="210" y="164" text-anchor="middle">edit old code</text>
  <rect class="s-accent" x="286" y="20" width="124" height="170" rx="10"/>
  <text class="s-title" x="348" y="62" text-anchor="middle">L</text>
  <text class="s-text" x="348" y="92" text-anchor="middle">Liskov</text>
  <text class="s-text" x="348" y="110" text-anchor="middle">Substitution</text>
  <text class="s-muted" x="348" y="146" text-anchor="middle">children keep</text>
  <text class="s-muted" x="348" y="164" text-anchor="middle">parent's promises</text>
  <rect class="s-accent" x="424" y="20" width="124" height="170" rx="10"/>
  <text class="s-title" x="486" y="62" text-anchor="middle">I</text>
  <text class="s-text" x="486" y="92" text-anchor="middle">Interface</text>
  <text class="s-text" x="486" y="110" text-anchor="middle">Segregation</text>
  <text class="s-muted" x="486" y="146" text-anchor="middle">small, focused</text>
  <text class="s-muted" x="486" y="164" text-anchor="middle">interfaces</text>
  <rect class="s-accent" x="562" y="20" width="124" height="170" rx="10"/>
  <text class="s-title" x="624" y="62" text-anchor="middle">D</text>
  <text class="s-text" x="624" y="92" text-anchor="middle">Dependency</text>
  <text class="s-text" x="624" y="110" text-anchor="middle">Inversion</text>
  <text class="s-muted" x="624" y="146" text-anchor="middle">depend on</text>
  <text class="s-muted" x="624" y="164" text-anchor="middle">abstractions</text>
</svg>
<figcaption>SOLID in one line each. All five serve one goal: a change in one place should not force changes in many others.</figcaption>
</figure>
<table>
<thead><tr><th>Letter</th><th>Smell that tells you it is violated</th><th>Usual fix</th></tr></thead>
<tbody>
<tr><td>S</td><td>A class you edit for unrelated reasons (tax rule, PDF layout, database). A 2,000-line <code>OrderManager</code>.</td><td>Split into classes with one job each.</td></tr>
<tr><td>O</td><td>A growing <code>if/else</code> or <code>switch</code> on a type, edited for every new case.</td><td>Interface + one class per case (Strategy), or a lookup map.</td></tr>
<tr><td>L</td><td>A subclass that throws "not supported", ignores a call, or needs <code>instanceof</code> checks by callers.</td><td>Fix the hierarchy: separate types or smaller interfaces.</td></tr>
<tr><td>I</td><td>Classes implementing methods they do not need with empty bodies or exceptions.</td><td>Split the fat interface into role interfaces.</td></tr>
<tr><td>D</td><td>Business logic that does <code>new MySqlRepository()</code> or calls a vendor SDK directly. Cannot unit test without a database.</td><td>Depend on an interface; inject the implementation.</td></tr>
</tbody>
</table>

<h2>S: Single Responsibility Principle</h2>
<p><strong>A class should have one reason to change.</strong> "Reason to change" means one group of people or one kind of requirement. The finance team changes GST rules, the design team changes the invoice layout, the platform team changes the database. If one class serves all three, every change risks breaking the other two, and three teams edit the same file and fight over merge conflicts.</p>
<h3>The smell</h3>
<p>A Swiggy-style restaurant <code>Invoice</code> class that calculates totals, formats itself for printing, and saves itself to the database:</p>
<pre><code>class Invoice {
    List&lt;LineItem&gt; items;
    long total()           { ... GST math ... }            // finance rules
    String printText()     { ... layout, alignment ... }  // presentation
    void saveToDb()        { ... JDBC, SQL strings ... }  // persistence
    void emailToCustomer() { ... SMTP ... }               // delivery
}</code></pre>
<p>To test the GST math you now need a database connection. Switching from text to PDF touches the class that holds money logic.</p>
<h3>The refactor</h3>
<p>Split it into three classes. <code>Invoice</code> knows the items and the money math. <code>InvoicePrinter</code> knows layout. <code>InvoiceRepository</code> knows storage. Each can change, and be tested, alone.</p>
<div data-code="srp"></div>
<div class="callout info"><strong>SRP is not "one method per class"</strong>A class can have many methods as long as they serve the same responsibility. <code>Invoice</code> keeps <code>subtotal()</code>, <code>gst()</code> and <code>total()</code> together because they change together, when tax rules change. Splitting those into three classes would scatter one idea. Group by reason to change, not by method count.</div>

<h2>O: Open/Closed Principle</h2>
<p><strong>Software should be open for extension but closed for modification.</strong> You should be able to add new behaviour by adding new code, not by editing code that already works and is already tested.</p>
<h3>The smell</h3>
<p>A Flipkart-style price calculator where every new sale event adds a branch:</p>
<pre><code>long finalPrice(long amount, String type) {
    if (type.equals("PERCENT"))      return amount - Math.min(amount * 20 / 100, 150);
    else if (type.equals("FLAT"))    return amount &gt;= 499 ? amount - 100 : amount;
    else if (type.equals("BOGO"))    ...   // added for Big Billion Days
    else if (type.equals("FIRST"))   ...   // added last week, broke FLAT by mistake
    return amount;
}</code></pre>
<p>Every new offer edits this method. Every edit must re-test all the old branches. The method grows to 300 lines, and a typo in one branch breaks checkout during the sale.</p>
<h3>The refactor</h3>
<p>Put each discount behind a <code>DiscountStrategy</code> interface. The calculator only knows the interface. A new offer is a new class; the calculator is never touched again. This is the <strong>Strategy</strong> pattern (see <a href="#/p/behavioral-patterns">Behavioral patterns</a>).</p>
<div data-diagram="ocp" data-caption="Open/closed: PriceCalculator is closed for modification; new discounts plug in as new classes."></div>
<div data-code="ocp"></div>
<p>Notice the last line of the demo: <code>FirstOrderDiscount</code> was "added later" without editing <code>PriceCalculator</code>. In a real system, a factory or a map from offer code to strategy builds the right object from a database row, so even the wiring is data-driven.</p>
<div class="callout tip"><strong>Closed against what?</strong>No code is closed against every change. OCP is about the changes you expect. At an e-commerce company, new discount types arrive monthly, so make discounts pluggable. The tax formula changes once a year, so a plain method is fine. Do not add an interface for every class "just in case".</div>

<h2>L: Liskov Substitution Principle</h2>
<p><strong>Objects of a subclass must be usable wherever the parent is expected, without the caller noticing.</strong> Named after Barbara Liskov. In plain words: a child class must keep every promise its parent makes. It may do more, never less.</p>
<p>Concretely, a subclass must not:</p>
<ul>
<li>Demand more from callers (stricter inputs, for example rejecting amounts the parent accepted).</li>
<li>Give callers less (weaker outputs, for example returning null where the parent never did).</li>
<li>Throw new kinds of errors for normal calls ("not supported").</li>
<li>Break the parent's rules about its own state (its <em>invariants</em>).</li>
</ul>
<h3>The smell: Square extends Rectangle</h3>
<p>The classic interview example. Mathematically a square is a rectangle, so inheritance looks right:</p>
<pre><code>class Rectangle {
    void setWidth(int w)  { width = w; }
    void setHeight(int h) { height = h; }
    int area()            { return width * height; }
}
class Square extends Rectangle {
    void setWidth(int w)  { width = w; height = w; }   // keep it square
    void setHeight(int h) { width = h; height = h; }
}

void resize(Rectangle r) {
    r.setWidth(5);
    r.setHeight(4);
    assert r.area() == 20;   // fails for a Square: area is 16
}</code></pre>
<p><code>Rectangle</code> promises that setting the width leaves the height alone. <code>Square</code> breaks that promise. Any code written for rectangles is now wrong for squares, and the only fix inside <code>resize</code> is an <code>instanceof Square</code> check, which is a red flag.</p>
<p>The same bug shows up in real code all the time:</p>
<ul>
<li>A <code>ReadOnlyFile extends File</code> whose <code>write()</code> throws <code>UnsupportedOperationException</code>.</li>
<li>A <code>CashOnDelivery extends PaymentMethod</code> whose <code>refundToSource()</code> throws, because cash cannot be refunded to a card.</li>
<li>A <code>PremiumUser extends User</code> whose <code>getDeliveryFee()</code> returns <code>null</code> instead of 0.</li>
</ul>
<h3>The refactor</h3>
<p>Do not force the is-a. Make <code>Rectangle</code> and <code>Square</code> siblings that both implement a <code>Shape</code> interface that only promises what both can keep: an area. Make them immutable, so "change width" returns a new rectangle instead of mutating. Code that needs to resize takes a <code>Rectangle</code> specifically.</p>
<div data-code="lsp"></div>
<div class="callout warn"><strong>"Is-a" in English is not "is-a" in code</strong>A square is a rectangle in geometry, a penguin is a bird in biology, and a read-only file is a file in plain speech. In code, "is-a" means "can do everything the parent promises". Test the hierarchy with behaviour, not with the dictionary.</div>

<h2>I: Interface Segregation Principle</h2>
<p><strong>No client should be forced to depend on methods it does not use.</strong> Prefer several small, focused interfaces ("role interfaces") over one large one.</p>
<h3>The smell</h3>
<p>A restaurant point-of-sale system has one <code>Machine</code> interface for all office devices. The kitchen order ticket (KOT) printer in a Swiggy partner restaurant is a cheap thermal printer. It cannot scan or fax, but it is forced to "implement" both:</p>
<pre><code>interface Machine {
    void print(String doc);
    void scan(String doc);
    void fax(String doc);
}
class ThermalPrinter implements Machine {
    public void print(String doc) { ... }
    public void scan(String doc)  { throw new UnsupportedOperationException(); }  // LSP broken too
    public void fax(String doc)   { throw new UnsupportedOperationException(); }
}</code></pre>
<p>Problems: callers cannot tell from the type what really works; adding <code>email()</code> to <code>Machine</code> forces every device class to change and recompile; and test fakes must stub methods nobody calls.</p>
<h3>The refactor</h3>
<p>Split into <code>Printer</code>, <code>Scanner</code> and <code>Fax</code>. The thermal printer implements only <code>Printer</code>. The office all-in-one implements all three. Each client asks only for the role it needs: the KOT code takes a <code>Printer</code>, the licence-upload screen takes a <code>Scanner</code>.</p>
<div data-code="isp"></div>
<p>In Go this comes naturally. The standard library is built from tiny interfaces like <code>io.Reader</code> (one method) and <code>io.Writer</code> (one method), combined by embedding into <code>io.ReadWriter</code> only when needed. A Go proverb says: "The bigger the interface, the weaker the abstraction."</p>

<h2>D: Dependency Inversion Principle</h2>
<p><strong>High-level modules should not depend on low-level modules; both should depend on abstractions.</strong> The business logic ("place an order") is the high-level module. The database driver, the SMS vendor, the payment SDK are low-level details. The business logic should own an interface describing what it needs, and the details should implement it.</p>
<h3>The smell</h3>
<pre><code>class OrderService {
    private final MySqlOrderRepository repo = new MySqlOrderRepository();  // hard-wired
    void placeOrder(Order o) {
        validate(o);
        repo.insert(o);
    }
}</code></pre>
<p>To unit test <code>placeOrder</code> you need a running MySQL. Moving orders to DynamoDB means editing <code>OrderService</code>. The arrow of dependency points from important business rules to a replaceable detail.</p>
<h3>The refactor</h3>
<p>Define <code>OrderRepository</code> as an interface owned by the order module. <code>OrderService</code> receives one through its constructor (<strong>dependency injection</strong>: someone else creates the dependency and hands it in). MySQL, an in-memory fake for tests, or DynamoDB all plug in without touching the service.</p>
<div data-diagram="dip" data-caption="Dependency inversion: both OrderService and the MySQL class depend on the OrderRepository abstraction, so the arrow to the detail is inverted."></div>
<div data-code="dip"></div>
<div class="callout info"><strong>DIP vs dependency injection vs IoC container</strong><strong>Dependency inversion</strong> is the principle: depend on abstractions. <strong>Dependency injection</strong> is the technique: pass dependencies in (usually through the constructor) instead of creating them inside. An <strong>IoC container</strong> (Spring in Java, Guice, Dagger, NestJS in Node) is a library that does the wiring for you. You can follow DIP with plain constructor injection and no framework, as the code above does.</div>

<h2>How SOLID looks in each language</h2>
<table>
<thead><tr><th>Language</th><th>Abstraction used above</th><th>Notes</th></tr></thead>
<tbody>
<tr><td>Java</td><td><code>interface</code> + <code>implements</code></td><td>Records keep value classes short. Spring does constructor injection for you.</td></tr>
<tr><td>Python</td><td><code>abc.ABC</code> or <code>typing.Protocol</code></td><td>Protocols give Go-style "fits if it has the methods" checking via mypy. Functions are first-class, so a one-method strategy can be just a function.</td></tr>
<tr><td>C++</td><td>Pure virtual class, <code>std::unique_ptr</code> to own</td><td>Virtual destructor on every interface. Templates offer compile-time strategies with zero overhead.</td></tr>
<tr><td>JavaScript</td><td>Duck typing: any object with the method</td><td>No compiler help; TypeScript interfaces add it. Pass dependencies into constructors.</td></tr>
<tr><td>Go</td><td>Small implicit interfaces</td><td>"Accept interfaces, return structs." Define the interface in the package that <em>uses</em> it, which is DIP by default.</td></tr>
</tbody>
</table>

<h2>When SOLID helps, and when it is overkill</h2>
<div class="grid-2">
<div class="card good"><strong>Apply it when</strong><ul>
<li>A part changes often or has many variants: discounts, payment methods, notification channels, pricing in a <a href="#/p/parking-lot">parking lot</a>.</li>
<li>You need to test business logic without the database or a vendor API.</li>
<li>Several teams touch the same module and keep stepping on each other.</li>
<li>In a machine-coding round: evaluators explicitly look for strategies, small interfaces and injected dependencies.</li>
</ul></div>
<div class="card bad"><strong>Overkill when</strong><ul>
<li>A 50-line script or a one-off migration.</li>
<li>An interface with one implementation that will never have a second one and is easy to fake anyway.</li>
<li>Splitting a cohesive class into five classes of five lines each that always change together.</li>
<li>Adding a strategy for something the product team has never asked to vary.</li>
</ul></div>
</div>
<p>Rule of thumb: write the simple version first. When the second variant or the first painful test arrives, refactor towards SOLID. See <a href="#/p/design-principles">YAGNI and KISS</a> for the balancing principles.</p>

<h2>Common interview questions and pitfalls</h2>
<ul>
<li><strong>"Which SOLID principle does the Strategy pattern support?"</strong> Mainly Open/Closed (new strategies without editing the context) and Dependency Inversion (the context depends on the strategy interface).</li>
<li><strong>"Is Square extends Rectangle wrong?"</strong> Only if <code>Rectangle</code> is mutable with independent width and height setters. With immutable shapes that only expose <code>area()</code>, substitution is safe. Explain the promise being broken.</li>
<li><strong>"How do ISP and SRP differ?"</strong> SRP is about why a <em>class</em> changes. ISP is about what a <em>client</em> is forced to see. A fat interface often signals an SRP problem in the classes behind it.</li>
<li><strong>Pitfall:</strong> reciting definitions without code. Always tie each principle to a class in your design: "<code>ParkingLot</code> depends on <code>PricingStrategy</code>, that is DIP."</li>
<li><strong>Pitfall:</strong> over-engineering. Ten interfaces for a tic-tac-toe game looks worse than none.</li>
</ul>
<div class="callout interview"><strong>Say this in the interview</strong>"Discounts change every sale, so I put them behind a <code>DiscountStrategy</code> interface; adding a new offer is a new class and <code>PriceCalculator</code> stays closed for modification. <code>OrderService</code> depends on an <code>OrderRepository</code> interface that I inject through the constructor, so I can unit test it with an in-memory repository and swap MySQL later. I kept interfaces small, so the thermal printer only implements <code>Printer</code>, and every implementation honours the full contract of its interface, so no class throws 'not supported'."</div>

<h2>Test yourself</h2>
<div class="quiz">
<details><summary>A UserService class registers users, hashes passwords, sends the welcome email and writes audit logs. Which principle does it break, and how do you fix it?</summary><div>Single Responsibility. It changes for security reasons (hashing), marketing reasons (email content), compliance reasons (audit) and business reasons (registration). Extract <code>PasswordHasher</code>, <code>WelcomeMailer</code> and <code>AuditLog</code>, and let <code>UserService</code> coordinate them through injected interfaces.</div></details>
<details><summary>Your payment router has switch(method) with cases UPI, CARD, NETBANKING. Product wants BNPL (buy now pay later) next week. What do you do?</summary><div>Replace the switch with a <code>PaymentProcessor</code> interface and one class per method, registered in a map from method name to processor. BNPL becomes one new class plus one registry entry. The router is closed for modification (OCP), and each processor can be tested alone.</div></details>
<details><summary>A subclass overrides a method only to throw UnsupportedOperationException. Which principle is violated?</summary><div>Liskov Substitution: callers holding the parent type cannot safely call the method. It usually also hints at an Interface Segregation problem: the parent interface promises too much. Split the interface so the subclass only promises what it can do.</div></details>
<details><summary>Is it OK for a Go package to define an interface with one method that only one type implements?</summary><div>Yes, if the package that <em>uses</em> it defines it to describe what it needs, for example so tests can pass a fake. That is idiomatic Go and follows DIP. What is not idiomatic is defining a large interface next to the implementation "for future use".</div></details>
<details><summary>What is the difference between dependency inversion and dependency injection?</summary><div>Dependency inversion is a design principle: high-level policy and low-level details both depend on an abstraction. Dependency injection is a technique for supplying a dependency from outside (constructor, setter or parameter). You use injection to achieve inversion. Spring or Guice automate injection but are not required.</div></details>
<details><summary>Does following OCP mean you never edit existing classes?</summary><div>No. You edit classes to fix bugs and to refactor. OCP says that for the <em>expected</em> kind of change (a new discount type, a new channel), you should be able to add a class instead of editing a working one. Predicting every change is impossible; design for the ones the business has already shown you.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
<li><strong>S</strong>: one reason to change per class. Split by who asks for changes, not by method count.</li>
<li><strong>O</strong>: a growing <code>if/else</code> on type is the smell; Strategy or a lookup map is the fix.</li>
<li><strong>L</strong>: a child must keep every promise of its parent. Throwing "not supported" or needing <code>instanceof</code> means the hierarchy is wrong.</li>
<li><strong>I</strong>: small role interfaces. Clients depend only on what they call.</li>
<li><strong>D</strong>: business logic depends on interfaces it owns; inject the database, vendors and clocks from outside.</li>
<li>Apply SOLID where change actually happens. Over-applying it adds classes without adding value.</li>
</ul></div>
`,
  code: {
    srp: {
      title: "S: Invoice split into data/math, printing and storage",
      java: String.raw`import java.util.ArrayList;
import java.util.List;

public class SrpDemo {

    record LineItem(String name, int qty, long price) {
        long amount() { return qty * price; }
    }

    // Responsibility 1: invoice data and money math. Changes when tax rules change.
    record Invoice(String id, List<LineItem> items) {
        static final int GST_PERCENT = 18;
        long subtotal() { return items.stream().mapToLong(LineItem::amount).sum(); }
        long gst() { return subtotal() * GST_PERCENT / 100; }
        long total() { return subtotal() + gst(); }
    }

    // Responsibility 2: presentation. Changes when the layout changes.
    static class InvoicePrinter {
        String format(Invoice inv) {
            StringBuilder sb = new StringBuilder("INVOICE " + inv.id() + "\n");
            for (LineItem li : inv.items()) {
                sb.append("  ").append(li.name()).append(" x").append(li.qty())
                  .append(" = ").append(li.amount()).append("\n");
            }
            sb.append("  GST ").append(Invoice.GST_PERCENT).append("% = ").append(inv.gst()).append("\n");
            sb.append("  TOTAL = ").append(inv.total());
            return sb.toString();
        }
    }

    // Responsibility 3: persistence. Changes when storage changes.
    static class InvoiceRepository {
        private final List<Invoice> rows = new ArrayList<>();
        void save(Invoice inv) { rows.add(inv); }
        int count() { return rows.size(); }
    }

    public static void main(String[] args) {
        Invoice inv = new Invoice("INV-1", List.of(
            new LineItem("Paneer Tikka", 2, 250),
            new LineItem("Butter Naan", 4, 50)));
        System.out.println(new InvoicePrinter().format(inv));
        InvoiceRepository repo = new InvoiceRepository();
        repo.save(inv);
        System.out.println("Saved " + inv.id() + " (repository has " + repo.count() + " invoice)");
    }
}
`,
      python: String.raw`from dataclasses import dataclass


@dataclass(frozen=True)
class LineItem:
    name: str
    qty: int
    price: int

    def amount(self) -> int:
        return self.qty * self.price


# Responsibility 1: invoice data and money math. Changes when tax rules change.
@dataclass(frozen=True)
class Invoice:
    id: str
    items: tuple[LineItem, ...]
    GST_PERCENT = 18                       # class attribute (no annotation, so not a field)

    def subtotal(self) -> int:
        return sum(li.amount() for li in self.items)

    def gst(self) -> int:
        return self.subtotal() * self.GST_PERCENT // 100

    def total(self) -> int:
        return self.subtotal() + self.gst()


# Responsibility 2: presentation. Changes when the layout changes.
class InvoicePrinter:
    def format(self, inv: Invoice) -> str:
        lines = [f"INVOICE {inv.id}"]
        lines += [f"  {li.name} x{li.qty} = {li.amount()}" for li in inv.items]
        lines.append(f"  GST {Invoice.GST_PERCENT}% = {inv.gst()}")
        lines.append(f"  TOTAL = {inv.total()}")
        return "\n".join(lines)


# Responsibility 3: persistence. Changes when storage changes.
class InvoiceRepository:
    def __init__(self) -> None:
        self._rows: list[Invoice] = []

    def save(self, inv: Invoice) -> None:
        self._rows.append(inv)

    def count(self) -> int:
        return len(self._rows)


if __name__ == "__main__":
    inv = Invoice("INV-1", (LineItem("Paneer Tikka", 2, 250), LineItem("Butter Naan", 4, 50)))
    print(InvoicePrinter().format(inv))
    repo = InvoiceRepository()
    repo.save(inv)
    print(f"Saved {inv.id} (repository has {repo.count()} invoice)")
`,
      cpp: String.raw`#include <iostream>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

struct LineItem {
    std::string name;
    int qty;
    long price;
    long amount() const { return qty * price; }
};

// Responsibility 1: invoice data and money math. Changes when tax rules change.
class Invoice {
public:
    static constexpr int GST_PERCENT = 18;
    Invoice(std::string id, std::vector<LineItem> items) : id_(std::move(id)), items_(std::move(items)) {}
    const std::string& id() const { return id_; }
    const std::vector<LineItem>& items() const { return items_; }
    long subtotal() const {
        long s = 0;
        for (const auto& li : items_) s += li.amount();
        return s;
    }
    long gst() const { return subtotal() * GST_PERCENT / 100; }
    long total() const { return subtotal() + gst(); }
private:
    std::string id_;
    std::vector<LineItem> items_;
};

// Responsibility 2: presentation. Changes when the layout changes.
class InvoicePrinter {
public:
    std::string format(const Invoice& inv) const {
        std::ostringstream out;
        out << "INVOICE " << inv.id() << "\n";
        for (const auto& li : inv.items()) out << "  " << li.name << " x" << li.qty << " = " << li.amount() << "\n";
        out << "  GST " << Invoice::GST_PERCENT << "% = " << inv.gst() << "\n";
        out << "  TOTAL = " << inv.total();
        return out.str();
    }
};

// Responsibility 3: persistence. Changes when storage changes.
class InvoiceRepository {
public:
    void save(const Invoice& inv) { rows_.push_back(inv); }
    size_t count() const { return rows_.size(); }
private:
    std::vector<Invoice> rows_;
};

int main() {
    Invoice inv("INV-1", {{"Paneer Tikka", 2, 250}, {"Butter Naan", 4, 50}});
    std::cout << InvoicePrinter().format(inv) << "\n";
    InvoiceRepository repo;
    repo.save(inv);
    std::cout << "Saved " << inv.id() << " (repository has " << repo.count() << " invoice)\n";
    return 0;
}
`,
      javascript: String.raw`class LineItem {
  constructor(name, qty, price) {
    this.name = name;
    this.qty = qty;
    this.price = price;
  }
  amount() { return this.qty * this.price; }
}

// Responsibility 1: invoice data and money math. Changes when tax rules change.
class Invoice {
  static GST_PERCENT = 18;
  constructor(id, items) {
    this.id = id;
    this.items = Object.freeze([...items]);
  }
  subtotal() { return this.items.reduce((s, li) => s + li.amount(), 0); }
  gst() { return Math.floor(this.subtotal() * Invoice.GST_PERCENT / 100); }
  total() { return this.subtotal() + this.gst(); }
}

// Responsibility 2: presentation. Changes when the layout changes.
class InvoicePrinter {
  format(inv) {
    const lines = ["INVOICE " + inv.id];
    for (const li of inv.items) lines.push("  " + li.name + " x" + li.qty + " = " + li.amount());
    lines.push("  GST " + Invoice.GST_PERCENT + "% = " + inv.gst());
    lines.push("  TOTAL = " + inv.total());
    return lines.join("\n");
  }
}

// Responsibility 3: persistence. Changes when storage changes.
class InvoiceRepository {
  #rows = [];
  save(inv) { this.#rows.push(inv); }
  count() { return this.#rows.length; }
}

const inv = new Invoice("INV-1", [new LineItem("Paneer Tikka", 2, 250), new LineItem("Butter Naan", 4, 50)]);
console.log(new InvoicePrinter().format(inv));
const repo = new InvoiceRepository();
repo.save(inv);
console.log("Saved " + inv.id + " (repository has " + repo.count() + " invoice)");
`,
      go: String.raw`package main

import (
	"fmt"
	"strings"
)

type LineItem struct {
	Name  string
	Qty   int64
	Price int64
}

func (li LineItem) Amount() int64 { return li.Qty * li.Price }

// Responsibility 1: invoice data and money math. Changes when tax rules change.
const GSTPercent = 18

type Invoice struct {
	ID    string
	Items []LineItem
}

func (inv Invoice) Subtotal() int64 {
	var s int64
	for _, li := range inv.Items {
		s += li.Amount()
	}
	return s
}
func (inv Invoice) GST() int64   { return inv.Subtotal() * GSTPercent / 100 }
func (inv Invoice) Total() int64 { return inv.Subtotal() + inv.GST() }

// Responsibility 2: presentation. Changes when the layout changes.
type InvoicePrinter struct{}

func (InvoicePrinter) Format(inv Invoice) string {
	var b strings.Builder
	fmt.Fprintf(&b, "INVOICE %s\n", inv.ID)
	for _, li := range inv.Items {
		fmt.Fprintf(&b, "  %s x%d = %d\n", li.Name, li.Qty, li.Amount())
	}
	fmt.Fprintf(&b, "  GST %d%% = %d\n", GSTPercent, inv.GST())
	fmt.Fprintf(&b, "  TOTAL = %d", inv.Total())
	return b.String()
}

// Responsibility 3: persistence. Changes when storage changes.
type InvoiceRepository struct{ rows []Invoice }

func (r *InvoiceRepository) Save(inv Invoice) { r.rows = append(r.rows, inv) }
func (r *InvoiceRepository) Count() int       { return len(r.rows) }

func main() {
	inv := Invoice{ID: "INV-1", Items: []LineItem{{"Paneer Tikka", 2, 250}, {"Butter Naan", 4, 50}}}
	fmt.Println(InvoicePrinter{}.Format(inv))
	repo := &InvoiceRepository{}
	repo.Save(inv)
	fmt.Printf("Saved %s (repository has %d invoice)\n", inv.ID, repo.Count())
}
`,
    },
    ocp: {
      title: "O: discount strategies, add new ones without editing the calculator",
      java: String.raw`import java.util.List;

public class OcpDemo {

    interface DiscountStrategy {
        String name();
        long discount(long amount);
    }

    record NoDiscount() implements DiscountStrategy {
        public String name() { return "NONE"; }
        public long discount(long amount) { return 0; }
    }

    record PercentDiscount(int percent, long cap) implements DiscountStrategy {
        public String name() { return percent + "% up to " + cap; }
        public long discount(long amount) { return Math.min(amount * percent / 100, cap); }
    }

    record FlatDiscount(long flat, long minOrder) implements DiscountStrategy {
        public String name() { return "FLAT " + flat + " over " + minOrder; }
        public long discount(long amount) { return amount >= minOrder ? flat : 0; }
    }

    // Closed for modification: never changes when a new discount type appears.
    static class PriceCalculator {
        long finalPrice(long amount, DiscountStrategy d) {
            return amount - Math.min(d.discount(amount), amount);  // never below zero
        }
    }

    // Open for extension: added "next sprint" as a new class. Nothing else edited.
    record FirstOrderDiscount() implements DiscountStrategy {
        public String name() { return "FIRST ORDER 50%"; }
        public long discount(long amount) { return amount / 2; }
    }

    public static void main(String[] args) {
        PriceCalculator calc = new PriceCalculator();
        List<DiscountStrategy> offers = List.of(
            new NoDiscount(), new PercentDiscount(20, 150), new FlatDiscount(100, 499), new FirstOrderDiscount());
        for (DiscountStrategy d : offers) {
            System.out.println(d.name() + ": 1000 -> " + calc.finalPrice(1000, d));
        }
        System.out.println("FLAT on a small order: 300 -> " + calc.finalPrice(300, new FlatDiscount(100, 499)));
    }
}
`,
      python: String.raw`from abc import ABC, abstractmethod


class DiscountStrategy(ABC):
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    def discount(self, amount: int) -> int: ...


class NoDiscount(DiscountStrategy):
    def name(self) -> str:
        return "NONE"

    def discount(self, amount: int) -> int:
        return 0


class PercentDiscount(DiscountStrategy):
    def __init__(self, percent: int, cap: int) -> None:
        self.percent, self.cap = percent, cap

    def name(self) -> str:
        return f"{self.percent}% up to {self.cap}"

    def discount(self, amount: int) -> int:
        return min(amount * self.percent // 100, self.cap)


class FlatDiscount(DiscountStrategy):
    def __init__(self, flat: int, min_order: int) -> None:
        self.flat, self.min_order = flat, min_order

    def name(self) -> str:
        return f"FLAT {self.flat} over {self.min_order}"

    def discount(self, amount: int) -> int:
        return self.flat if amount >= self.min_order else 0


class PriceCalculator:
    """Closed for modification: never changes when a new discount type appears."""

    def final_price(self, amount: int, d: DiscountStrategy) -> int:
        return amount - min(d.discount(amount), amount)


class FirstOrderDiscount(DiscountStrategy):
    """Open for extension: added later as a new class. Nothing else edited."""

    def name(self) -> str:
        return "FIRST ORDER 50%"

    def discount(self, amount: int) -> int:
        return amount // 2


if __name__ == "__main__":
    calc = PriceCalculator()
    offers = [NoDiscount(), PercentDiscount(20, 150), FlatDiscount(100, 499), FirstOrderDiscount()]
    for d in offers:
        print(f"{d.name()}: 1000 -> {calc.final_price(1000, d)}")
    print(f"FLAT on a small order: 300 -> {calc.final_price(300, FlatDiscount(100, 499))}")
`,
      cpp: String.raw`#include <algorithm>
#include <iostream>
#include <memory>
#include <string>
#include <vector>

struct DiscountStrategy {
    virtual ~DiscountStrategy() = default;
    virtual std::string name() const = 0;
    virtual long discount(long amount) const = 0;
};

struct NoDiscount : DiscountStrategy {
    std::string name() const override { return "NONE"; }
    long discount(long) const override { return 0; }
};

struct PercentDiscount : DiscountStrategy {
    int percent; long cap;
    PercentDiscount(int p, long c) : percent(p), cap(c) {}
    std::string name() const override { return std::to_string(percent) + "% up to " + std::to_string(cap); }
    long discount(long amount) const override { return std::min(amount * percent / 100, cap); }
};

struct FlatDiscount : DiscountStrategy {
    long flat, minOrder;
    FlatDiscount(long f, long m) : flat(f), minOrder(m) {}
    std::string name() const override { return "FLAT " + std::to_string(flat) + " over " + std::to_string(minOrder); }
    long discount(long amount) const override { return amount >= minOrder ? flat : 0; }
};

// Closed for modification: never changes when a new discount type appears.
struct PriceCalculator {
    long finalPrice(long amount, const DiscountStrategy& d) const {
        return amount - std::min(d.discount(amount), amount);
    }
};

// Open for extension: added later as a new class. Nothing else edited.
struct FirstOrderDiscount : DiscountStrategy {
    std::string name() const override { return "FIRST ORDER 50%"; }
    long discount(long amount) const override { return amount / 2; }
};

int main() {
    PriceCalculator calc;
    std::vector<std::unique_ptr<DiscountStrategy>> offers;
    offers.push_back(std::make_unique<NoDiscount>());
    offers.push_back(std::make_unique<PercentDiscount>(20, 150));
    offers.push_back(std::make_unique<FlatDiscount>(100, 499));
    offers.push_back(std::make_unique<FirstOrderDiscount>());
    for (const auto& d : offers) std::cout << d->name() << ": 1000 -> " << calc.finalPrice(1000, *d) << "\n";
    std::cout << "FLAT on a small order: 300 -> " << calc.finalPrice(300, FlatDiscount(100, 499)) << "\n";
    return 0;
}
`,
      javascript: String.raw`// Every strategy has name() and discount(amount). No base class needed: duck typing.
class NoDiscount {
  name() { return "NONE"; }
  discount() { return 0; }
}

class PercentDiscount {
  constructor(percent, cap) { this.percent = percent; this.cap = cap; }
  name() { return this.percent + "% up to " + this.cap; }
  discount(amount) { return Math.min(Math.floor(amount * this.percent / 100), this.cap); }
}

class FlatDiscount {
  constructor(flat, minOrder) { this.flat = flat; this.minOrder = minOrder; }
  name() { return "FLAT " + this.flat + " over " + this.minOrder; }
  discount(amount) { return amount >= this.minOrder ? this.flat : 0; }
}

// Closed for modification: never changes when a new discount type appears.
class PriceCalculator {
  finalPrice(amount, d) { return amount - Math.min(d.discount(amount), amount); }
}

// Open for extension: added later as a new class. Nothing else edited.
class FirstOrderDiscount {
  name() { return "FIRST ORDER 50%"; }
  discount(amount) { return Math.floor(amount / 2); }
}

const calc = new PriceCalculator();
const offers = [new NoDiscount(), new PercentDiscount(20, 150), new FlatDiscount(100, 499), new FirstOrderDiscount()];
for (const d of offers) console.log(d.name() + ": 1000 -> " + calc.finalPrice(1000, d));
console.log("FLAT on a small order: 300 -> " + calc.finalPrice(300, new FlatDiscount(100, 499)));
`,
      go: String.raw`package main

import "fmt"

type DiscountStrategy interface {
	Name() string
	Discount(amount int64) int64
}

type NoDiscount struct{}

func (NoDiscount) Name() string            { return "NONE" }
func (NoDiscount) Discount(int64) int64    { return 0 }

type PercentDiscount struct{ Percent, Cap int64 }

func (p PercentDiscount) Name() string { return fmt.Sprintf("%d%% up to %d", p.Percent, p.Cap) }
func (p PercentDiscount) Discount(amount int64) int64 {
	return min(amount*p.Percent/100, p.Cap)
}

type FlatDiscount struct{ Flat, MinOrder int64 }

func (f FlatDiscount) Name() string { return fmt.Sprintf("FLAT %d over %d", f.Flat, f.MinOrder) }
func (f FlatDiscount) Discount(amount int64) int64 {
	if amount >= f.MinOrder {
		return f.Flat
	}
	return 0
}

// Closed for modification: never changes when a new discount type appears.
type PriceCalculator struct{}

func (PriceCalculator) FinalPrice(amount int64, d DiscountStrategy) int64 {
	return amount - min(d.Discount(amount), amount)
}

// Open for extension: added later as a new type. Nothing else edited.
type FirstOrderDiscount struct{}

func (FirstOrderDiscount) Name() string                { return "FIRST ORDER 50%" }
func (FirstOrderDiscount) Discount(amount int64) int64 { return amount / 2 }

func main() {
	calc := PriceCalculator{}
	offers := []DiscountStrategy{NoDiscount{}, PercentDiscount{20, 150}, FlatDiscount{100, 499}, FirstOrderDiscount{}}
	for _, d := range offers {
		fmt.Printf("%s: 1000 -> %d\n", d.Name(), calc.FinalPrice(1000, d))
	}
	fmt.Printf("FLAT on a small order: 300 -> %d\n", calc.FinalPrice(300, FlatDiscount{100, 499}))
}
`,
    },
    lsp: {
      title: "L: Rectangle and Square as siblings behind a Shape interface",
      java: String.raw`import java.util.List;

public class LspDemo {

    // The contract promises only what every shape can keep.
    interface Shape {
        String describe();
        int area();
    }

    // Immutable: "changing" the width returns a new Rectangle.
    record Rectangle(int width, int height) implements Shape {
        public String describe() { return "Rectangle " + width + "x" + height; }
        public int area() { return width * height; }
        Rectangle withWidth(int w) { return new Rectangle(w, height); }
    }

    // Not a subclass of Rectangle, so it cannot break Rectangle's promises.
    record Square(int side) implements Shape {
        public String describe() { return "Square " + side + "x" + side; }
        public int area() { return side * side; }
    }

    // Works for ANY Shape, present or future: substitution is safe.
    static int totalArea(List<Shape> shapes) {
        return shapes.stream().mapToInt(Shape::area).sum();
    }

    public static void main(String[] args) {
        Rectangle r = new Rectangle(5, 4);
        Square s = new Square(4);
        List<Shape> shapes = List.of(r, s);
        for (Shape sh : shapes) System.out.println(sh.describe() + " area = " + sh.area());
        System.out.println("Total area = " + totalArea(shapes));
        Rectangle wider = r.withWidth(6);   // only rectangles offer resizing
        System.out.println(r.describe() + " resized to width 6: area = " + wider.area());
    }
}
`,
      python: String.raw`from dataclasses import dataclass, replace
from typing import Protocol


class Shape(Protocol):
    """The contract promises only what every shape can keep."""
    def describe(self) -> str: ...
    def area(self) -> int: ...


@dataclass(frozen=True)          # immutable: "changing" width returns a new object
class Rectangle:
    width: int
    height: int

    def describe(self) -> str:
        return f"Rectangle {self.width}x{self.height}"

    def area(self) -> int:
        return self.width * self.height

    def with_width(self, w: int) -> "Rectangle":
        return replace(self, width=w)


@dataclass(frozen=True)          # NOT a subclass of Rectangle
class Square:
    side: int

    def describe(self) -> str:
        return f"Square {self.side}x{self.side}"

    def area(self) -> int:
        return self.side * self.side


def total_area(shapes: list[Shape]) -> int:
    """Works for any Shape, present or future: substitution is safe."""
    return sum(s.area() for s in shapes)


if __name__ == "__main__":
    r, s = Rectangle(5, 4), Square(4)
    shapes: list[Shape] = [r, s]
    for sh in shapes:
        print(f"{sh.describe()} area = {sh.area()}")
    print(f"Total area = {total_area(shapes)}")
    wider = r.with_width(6)          # only rectangles offer resizing
    print(f"{r.describe()} resized to width 6: area = {wider.area()}")
`,
      cpp: String.raw`#include <iostream>
#include <memory>
#include <string>
#include <vector>

// The contract promises only what every shape can keep.
class Shape {
public:
    virtual ~Shape() = default;
    virtual std::string describe() const = 0;
    virtual int area() const = 0;
};

// Immutable: const members, "changing" the width returns a new Rectangle.
class Rectangle : public Shape {
public:
    Rectangle(int w, int h) : w_(w), h_(h) {}
    std::string describe() const override { return "Rectangle " + std::to_string(w_) + "x" + std::to_string(h_); }
    int area() const override { return w_ * h_; }
    Rectangle withWidth(int w) const { return Rectangle(w, h_); }
private:
    const int w_, h_;
};

// A sibling, not a child of Rectangle.
class Square : public Shape {
public:
    explicit Square(int side) : side_(side) {}
    std::string describe() const override { return "Square " + std::to_string(side_) + "x" + std::to_string(side_); }
    int area() const override { return side_ * side_; }
private:
    const int side_;
};

// Works for ANY Shape: substitution is safe.
int totalArea(const std::vector<std::shared_ptr<Shape>>& shapes) {
    int sum = 0;
    for (const auto& s : shapes) sum += s->area();
    return sum;
}

int main() {
    auto r = std::make_shared<Rectangle>(5, 4);
    auto s = std::make_shared<Square>(4);
    std::vector<std::shared_ptr<Shape>> shapes{r, s};
    for (const auto& sh : shapes) std::cout << sh->describe() << " area = " << sh->area() << "\n";
    std::cout << "Total area = " << totalArea(shapes) << "\n";
    Rectangle wider = r->withWidth(6);   // only rectangles offer resizing
    std::cout << r->describe() << " resized to width 6: area = " << wider.area() << "\n";
    return 0;
}
`,
      javascript: String.raw`// Contract (by convention): describe() and area(). Nothing a square cannot keep.
class Rectangle {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    Object.freeze(this);            // immutable
  }
  describe() { return "Rectangle " + this.width + "x" + this.height; }
  area() { return this.width * this.height; }
  withWidth(w) { return new Rectangle(w, this.height); }
}

// A sibling, not "class Square extends Rectangle".
class Square {
  constructor(side) {
    this.side = side;
    Object.freeze(this);
  }
  describe() { return "Square " + this.side + "x" + this.side; }
  area() { return this.side * this.side; }
}

// Works for any shape: substitution is safe.
const totalArea = (shapes) => shapes.reduce((sum, s) => sum + s.area(), 0);

const r = new Rectangle(5, 4);
const s = new Square(4);
const shapes = [r, s];
for (const sh of shapes) console.log(sh.describe() + " area = " + sh.area());
console.log("Total area = " + totalArea(shapes));
const wider = r.withWidth(6);       // only rectangles offer resizing
console.log(r.describe() + " resized to width 6: area = " + wider.area());
`,
      go: String.raw`package main

import "fmt"

// The contract promises only what every shape can keep.
type Shape interface {
	Describe() string
	Area() int
}

// Value types with value receivers: effectively immutable.
type Rectangle struct{ Width, Height int }

func (r Rectangle) Describe() string { return fmt.Sprintf("Rectangle %dx%d", r.Width, r.Height) }
func (r Rectangle) Area() int        { return r.Width * r.Height }
func (r Rectangle) WithWidth(w int) Rectangle {
	r.Width = w // r is a copy, the original is untouched
	return r
}

// Go has no inheritance, so the Square-extends-Rectangle trap cannot even be written.
type Square struct{ Side int }

func (s Square) Describe() string { return fmt.Sprintf("Square %dx%d", s.Side, s.Side) }
func (s Square) Area() int        { return s.Side * s.Side }

// Works for any Shape: substitution is safe.
func TotalArea(shapes []Shape) int {
	sum := 0
	for _, s := range shapes {
		sum += s.Area()
	}
	return sum
}

func main() {
	r := Rectangle{5, 4}
	shapes := []Shape{r, Square{4}}
	for _, sh := range shapes {
		fmt.Printf("%s area = %d\n", sh.Describe(), sh.Area())
	}
	fmt.Printf("Total area = %d\n", TotalArea(shapes))
	wider := r.WithWidth(6) // only rectangles offer resizing
	fmt.Printf("%s resized to width 6: area = %d\n", r.Describe(), wider.Area())
}
`,
    },
    isp: {
      title: "I: small Printer, Scanner and Fax interfaces",
      java: String.raw`public class IspDemo {

    // Small role interfaces instead of one fat Machine interface.
    interface Printer { void print(String doc); }
    interface Scanner { void scan(String doc); }
    interface Fax { void fax(String doc); }

    // The kitchen thermal printer only promises what it can do.
    static class ThermalPrinter implements Printer {
        public void print(String doc) { System.out.println("[Thermal printer] printing: " + doc); }
    }

    // The office all-in-one implements all three roles.
    static class OfficeMachine implements Printer, Scanner, Fax {
        public void print(String doc) { System.out.println("[Office machine] printing: " + doc); }
        public void scan(String doc) { System.out.println("[Office machine] scanning: " + doc); }
        public void fax(String doc) { System.out.println("[Office machine] faxing: " + doc); }
    }

    // Each client asks only for the role it needs.
    static void printKot(Printer p, int kot, String item) { p.print("KOT #" + kot + ": " + item); }
    static void uploadLicence(Scanner s) { s.scan("FSSAI licence"); }

    public static void main(String[] args) {
        ThermalPrinter kitchen = new ThermalPrinter();
        OfficeMachine office = new OfficeMachine();
        printKot(kitchen, 42, "2x Masala Dosa");
        printKot(office, 43, "1x Filter Coffee");   // any Printer works
        uploadLicence(office);
        office.fax("Bank statement");
        // uploadLicence(kitchen);  // compile error: ThermalPrinter is not a Scanner
    }
}
`,
      python: String.raw`from typing import Protocol


# Small role interfaces instead of one fat Machine interface.
class Printer(Protocol):
    def print_doc(self, doc: str) -> None: ...


class Scanner(Protocol):
    def scan(self, doc: str) -> None: ...


class Fax(Protocol):
    def fax(self, doc: str) -> None: ...


class ThermalPrinter:
    """The kitchen thermal printer only promises what it can do."""

    def print_doc(self, doc: str) -> None:
        print(f"[Thermal printer] printing: {doc}")


class OfficeMachine:
    """The office all-in-one fits all three protocols."""

    def print_doc(self, doc: str) -> None:
        print(f"[Office machine] printing: {doc}")

    def scan(self, doc: str) -> None:
        print(f"[Office machine] scanning: {doc}")

    def fax(self, doc: str) -> None:
        print(f"[Office machine] faxing: {doc}")


# Each client asks only for the role it needs.
def print_kot(p: Printer, kot: int, item: str) -> None:
    p.print_doc(f"KOT #{kot}: {item}")


def upload_licence(s: Scanner) -> None:
    s.scan("FSSAI licence")


if __name__ == "__main__":
    kitchen, office = ThermalPrinter(), OfficeMachine()
    print_kot(kitchen, 42, "2x Masala Dosa")
    print_kot(office, 43, "1x Filter Coffee")   # any Printer works
    upload_licence(office)
    office.fax("Bank statement")
    # upload_licence(kitchen)  -> mypy error: ThermalPrinter is not a Scanner
`,
      cpp: String.raw`#include <iostream>
#include <string>

// Small role interfaces instead of one fat Machine interface.
struct Printer {
    virtual ~Printer() = default;
    virtual void print(const std::string& doc) = 0;
};
struct Scanner {
    virtual ~Scanner() = default;
    virtual void scan(const std::string& doc) = 0;
};
struct Fax {
    virtual ~Fax() = default;
    virtual void fax(const std::string& doc) = 0;
};

// The kitchen thermal printer only promises what it can do.
class ThermalPrinter : public Printer {
public:
    void print(const std::string& doc) override { std::cout << "[Thermal printer] printing: " << doc << "\n"; }
};

// The office all-in-one implements all three roles (multiple inheritance of interfaces).
class OfficeMachine : public Printer, public Scanner, public Fax {
public:
    void print(const std::string& doc) override { std::cout << "[Office machine] printing: " << doc << "\n"; }
    void scan(const std::string& doc) override { std::cout << "[Office machine] scanning: " << doc << "\n"; }
    void fax(const std::string& doc) override { std::cout << "[Office machine] faxing: " << doc << "\n"; }
};

// Each client asks only for the role it needs.
void printKot(Printer& p, int kot, const std::string& item) { p.print("KOT #" + std::to_string(kot) + ": " + item); }
void uploadLicence(Scanner& s) { s.scan("FSSAI licence"); }

int main() {
    ThermalPrinter kitchen;
    OfficeMachine office;
    printKot(kitchen, 42, "2x Masala Dosa");
    printKot(office, 43, "1x Filter Coffee");   // any Printer works
    uploadLicence(office);
    office.fax("Bank statement");
    // uploadLicence(kitchen);  // compile error: ThermalPrinter is not a Scanner
    return 0;
}
`,
      javascript: String.raw`// Roles by convention: a Printer has print(), a Scanner has scan(), a Fax has fax().
class ThermalPrinter {
  print(doc) { console.log("[Thermal printer] printing: " + doc); }
}

class OfficeMachine {
  print(doc) { console.log("[Office machine] printing: " + doc); }
  scan(doc) { console.log("[Office machine] scanning: " + doc); }
  fax(doc) { console.log("[Office machine] faxing: " + doc); }
}

// Each client asks only for the role it needs, and can check it cheaply.
function printKot(printer, kot, item) {
  printer.print("KOT #" + kot + ": " + item);
}

function uploadLicence(scanner) {
  if (typeof scanner.scan !== "function") throw new TypeError("need a scanner");
  scanner.scan("FSSAI licence");
}

const kitchen = new ThermalPrinter();
const office = new OfficeMachine();
printKot(kitchen, 42, "2x Masala Dosa");
printKot(office, 43, "1x Filter Coffee");   // any printer works
uploadLicence(office);
office.fax("Bank statement");
`,
      go: String.raw`package main

import "fmt"

// Tiny interfaces, like io.Reader and io.Writer in the standard library.
type Printer interface{ Print(doc string) }
type Scanner interface{ Scan(doc string) }
type Fax interface{ Fax(doc string) }

// Combine by embedding only where a client truly needs all three.
type MultiFunction interface {
	Printer
	Scanner
	Fax
}

type ThermalPrinter struct{}

func (ThermalPrinter) Print(doc string) { fmt.Println("[Thermal printer] printing:", doc) }

type OfficeMachine struct{}

func (OfficeMachine) Print(doc string) { fmt.Println("[Office machine] printing:", doc) }
func (OfficeMachine) Scan(doc string)  { fmt.Println("[Office machine] scanning:", doc) }
func (OfficeMachine) Fax(doc string)   { fmt.Println("[Office machine] faxing:", doc) }

// Each client asks only for the role it needs.
func PrintKot(p Printer, kot int, item string) { p.Print(fmt.Sprintf("KOT #%d: %s", kot, item)) }
func UploadLicence(s Scanner)                   { s.Scan("FSSAI licence") }

// Compile-time check that OfficeMachine satisfies the combined interface.
var _ MultiFunction = OfficeMachine{}

func main() {
	kitchen, office := ThermalPrinter{}, OfficeMachine{}
	PrintKot(kitchen, 42, "2x Masala Dosa")
	PrintKot(office, 43, "1x Filter Coffee") // any Printer works
	UploadLicence(office)
	office.Fax("Bank statement")
	// UploadLicence(kitchen) // compile error: ThermalPrinter does not implement Scanner
}
`,
    },
    dip: {
      title: "D: OrderService depends on an OrderRepository interface, injected",
      java: String.raw`import java.util.HashMap;
import java.util.Map;

public class DipDemo {

    // The abstraction is owned by the business layer.
    interface OrderRepository {
        void save(String orderId, long amount);
        int count();
    }

    // Low-level detail #1 (would use JDBC in real life).
    static class MySqlOrderRepository implements OrderRepository {
        private int rows = 0;
        public void save(String id, long amount) {
            System.out.println("[MySQL] INSERT INTO orders VALUES ('" + id + "', " + amount + ")");
            rows++;
        }
        public int count() { return rows; }
    }

    // Low-level detail #2: in-memory, perfect for unit tests.
    static class InMemoryOrderRepository implements OrderRepository {
        private final Map<String, Long> store = new HashMap<>();
        public void save(String id, long amount) {
            store.put(id, amount);
            System.out.println("[Memory] saved " + id);
        }
        public int count() { return store.size(); }
    }

    // High-level policy: knows only the interface. Dependency injected via constructor.
    static class OrderService {
        private final OrderRepository repo;
        OrderService(OrderRepository repo) { this.repo = repo; }

        void placeOrder(String id, long amount) {
            if (amount <= 0) throw new IllegalArgumentException("amount must be positive");
            repo.save(id, amount);
            System.out.println("Placed " + id + " for Rs " + amount);
        }
    }

    public static void main(String[] args) {
        new OrderService(new MySqlOrderRepository()).placeOrder("ORD-1", 450);   // production wiring
        InMemoryOrderRepository fake = new InMemoryOrderRepository();
        new OrderService(fake).placeOrder("ORD-2", 300);                         // test wiring
        System.out.println("Orders in memory: " + fake.count());
    }
}
`,
      python: String.raw`from abc import ABC, abstractmethod


class OrderRepository(ABC):
    """The abstraction is owned by the business layer."""

    @abstractmethod
    def save(self, order_id: str, amount: int) -> None: ...

    @abstractmethod
    def count(self) -> int: ...


class MySqlOrderRepository(OrderRepository):
    """Low-level detail #1 (would use a DB driver in real life)."""

    def __init__(self) -> None:
        self._rows = 0

    def save(self, order_id: str, amount: int) -> None:
        print(f"[MySQL] INSERT INTO orders VALUES ('{order_id}', {amount})")
        self._rows += 1

    def count(self) -> int:
        return self._rows


class InMemoryOrderRepository(OrderRepository):
    """Low-level detail #2: in-memory, perfect for unit tests."""

    def __init__(self) -> None:
        self._store: dict[str, int] = {}

    def save(self, order_id: str, amount: int) -> None:
        self._store[order_id] = amount
        print(f"[Memory] saved {order_id}")

    def count(self) -> int:
        return len(self._store)


class OrderService:
    """High-level policy: knows only the interface. Dependency injected via __init__."""

    def __init__(self, repo: OrderRepository) -> None:
        self._repo = repo

    def place_order(self, order_id: str, amount: int) -> None:
        if amount <= 0:
            raise ValueError("amount must be positive")
        self._repo.save(order_id, amount)
        print(f"Placed {order_id} for Rs {amount}")


if __name__ == "__main__":
    OrderService(MySqlOrderRepository()).place_order("ORD-1", 450)   # production wiring
    fake = InMemoryOrderRepository()
    OrderService(fake).place_order("ORD-2", 300)                     # test wiring
    print(f"Orders in memory: {fake.count()}")
`,
      cpp: String.raw`#include <iostream>
#include <map>
#include <memory>
#include <stdexcept>
#include <string>
#include <utility>

// The abstraction is owned by the business layer.
class OrderRepository {
public:
    virtual ~OrderRepository() = default;
    virtual void save(const std::string& id, long amount) = 0;
    virtual size_t count() const = 0;
};

// Low-level detail #1 (would use a DB client in real life).
class MySqlOrderRepository : public OrderRepository {
public:
    void save(const std::string& id, long amount) override {
        std::cout << "[MySQL] INSERT INTO orders VALUES ('" << id << "', " << amount << ")\n";
        ++rows_;
    }
    size_t count() const override { return rows_; }
private:
    size_t rows_ = 0;
};

// Low-level detail #2: in-memory, perfect for unit tests.
class InMemoryOrderRepository : public OrderRepository {
public:
    void save(const std::string& id, long amount) override {
        store_[id] = amount;
        std::cout << "[Memory] saved " << id << "\n";
    }
    size_t count() const override { return store_.size(); }
private:
    std::map<std::string, long> store_;
};

// High-level policy: knows only the interface. Dependency injected via constructor.
class OrderService {
public:
    explicit OrderService(std::shared_ptr<OrderRepository> repo) : repo_(std::move(repo)) {}
    void placeOrder(const std::string& id, long amount) {
        if (amount <= 0) throw std::invalid_argument("amount must be positive");
        repo_->save(id, amount);
        std::cout << "Placed " << id << " for Rs " << amount << "\n";
    }
private:
    std::shared_ptr<OrderRepository> repo_;
};

int main() {
    OrderService(std::make_shared<MySqlOrderRepository>()).placeOrder("ORD-1", 450); // production wiring
    auto fake = std::make_shared<InMemoryOrderRepository>();
    OrderService(fake).placeOrder("ORD-2", 300);                                       // test wiring
    std::cout << "Orders in memory: " << fake->count() << "\n";
    return 0;
}
`,
      javascript: String.raw`// Any object with save(id, amount) and count() is an OrderRepository.
class MySqlOrderRepository {
  #rows = 0;
  save(id, amount) {
    console.log("[MySQL] INSERT INTO orders VALUES ('" + id + "', " + amount + ")");
    this.#rows++;
  }
  count() { return this.#rows; }
}

class InMemoryOrderRepository {
  #store = new Map();
  save(id, amount) {
    this.#store.set(id, amount);
    console.log("[Memory] saved " + id);
  }
  count() { return this.#store.size; }
}

// High-level policy: receives its repository, never creates one.
class OrderService {
  #repo;
  constructor(repo) { this.#repo = repo; }

  placeOrder(id, amount) {
    if (amount <= 0) throw new RangeError("amount must be positive");
    this.#repo.save(id, amount);
    console.log("Placed " + id + " for Rs " + amount);
  }
}

new OrderService(new MySqlOrderRepository()).placeOrder("ORD-1", 450); // production wiring
const fake = new InMemoryOrderRepository();
new OrderService(fake).placeOrder("ORD-2", 300);                        // test wiring
console.log("Orders in memory: " + fake.count());
`,
      go: String.raw`package main

import (
	"errors"
	"fmt"
)

// The interface lives with the code that USES it (the order package),
// not with the MySQL code. That is dependency inversion, Go style.
type OrderRepository interface {
	Save(id string, amount int64)
	Count() int
}

type MySQLOrderRepository struct{ rows int }

func (r *MySQLOrderRepository) Save(id string, amount int64) {
	fmt.Printf("[MySQL] INSERT INTO orders VALUES ('%s', %d)\n", id, amount)
	r.rows++
}
func (r *MySQLOrderRepository) Count() int { return r.rows }

type InMemoryOrderRepository struct{ store map[string]int64 }

func NewInMemoryRepo() *InMemoryOrderRepository {
	return &InMemoryOrderRepository{store: map[string]int64{}}
}
func (r *InMemoryOrderRepository) Save(id string, amount int64) {
	r.store[id] = amount
	fmt.Println("[Memory] saved", id)
}
func (r *InMemoryOrderRepository) Count() int { return len(r.store) }

// High-level policy: accepts the interface through its constructor.
type OrderService struct{ repo OrderRepository }

func NewOrderService(repo OrderRepository) *OrderService { return &OrderService{repo: repo} }

func (s *OrderService) PlaceOrder(id string, amount int64) error {
	if amount <= 0 {
		return errors.New("amount must be positive")
	}
	s.repo.Save(id, amount)
	fmt.Printf("Placed %s for Rs %d\n", id, amount)
	return nil
}

func main() {
	_ = NewOrderService(&MySQLOrderRepository{}).PlaceOrder("ORD-1", 450) // production wiring
	fake := NewInMemoryRepo()
	_ = NewOrderService(fake).PlaceOrder("ORD-2", 300) // test wiring
	fmt.Println("Orders in memory:", fake.Count())
}
`,
    },
  },
  diagrams: {
    ocp: String.raw`classDiagram
  class PriceCalculator {
    +finalPrice(amount, strategy) long
  }
  class DiscountStrategy {
    <<interface>>
    +name() String
    +discount(amount) long
  }
  PriceCalculator ..> DiscountStrategy : uses
  DiscountStrategy <|.. NoDiscount
  DiscountStrategy <|.. PercentDiscount
  DiscountStrategy <|.. FlatDiscount
  DiscountStrategy <|.. FirstOrderDiscount`,
    dip: String.raw`classDiagram
  class OrderService {
    -repo OrderRepository
    +placeOrder(id, amount)
  }
  class OrderRepository {
    <<interface>>
    +save(id, amount)
    +count() int
  }
  class MySqlOrderRepository {
    +save(id, amount)
  }
  class InMemoryOrderRepository {
    +save(id, amount)
  }
  OrderService --> OrderRepository : depends on
  OrderRepository <|.. MySqlOrderRepository
  OrderRepository <|.. InMemoryOrderRepository`,
  },
});
