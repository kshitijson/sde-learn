SD.register({
  id: "parking-lot",
  html: String.raw`
<p class="lead">"Design a parking lot" is the most common machine-coding round in India, asked at Flipkart, Swiggy, PhonePe, Amazon and many startups. Nobody cares about parking. The interviewer wants to see you turn a vague brief into clean classes, pick the right design patterns, keep pricing and spot allocation pluggable, and stop two gates from giving away the same spot. This page walks through the full answer, with working code in five languages.</p>

<h2>Problem statement</h2>
<p>Design the software for a multi-storey parking lot, the kind you see at a mall like Phoenix Marketcity or at a big IT park. Vehicles enter through entry gates, get a ticket and a spot, park, and later leave through an exit gate after paying. The lot has several floors, and each floor has spots of different sizes. Display boards at the entrance show how many spots are free on each floor.</p>
<p>In a machine-coding round you write runnable code in 60 to 90 minutes. In an LLD discussion round you mostly draw classes and explain. Either way the core model is the same.</p>

<div class="callout tip"><strong>Try it first</strong>Before reading on, take 10 minutes. List the nouns in the problem (they become classes), the verbs (they become methods), and the parts that are likely to change (they become interfaces). Then sketch how <code>park()</code> works step by step.</div>

<details class="hint"><summary>Hint 1: Find the nouns</summary>
<p>Lot, floor, spot, vehicle, ticket, gate, payment, display board. Most of these are plain classes. The size of a spot and the type of a vehicle are small fixed sets, so make them enums, not class hierarchies.</p>
</details>
<details class="hint"><summary>Hint 2: What will the product team change next month?</summary>
<p>Pricing (weekend flat rate, first 30 minutes free, EV charging fees) and the way you choose a spot (nearest to the lift, fill top floors first, keep VIP spots). Put each behind an interface. That is the Strategy pattern, and it is the single biggest thing evaluators look for.</p>
</details>
<details class="hint"><summary>Hint 3: Where is the race?</summary>
<p>Two entry gates call <code>park()</code> at the same moment. Both scan the floors, both see spot F0-3 as free, both assign it. "Find a free spot" and "mark it taken" must happen as one atomic step: a lock around both, or a compare-and-set on the spot itself.</p>
</details>

<h2>Requirements</h2>
<p>Spend the first 5 minutes asking questions. Interviewers often leave things vague on purpose to see if you clarify before coding. Good questions: How many floors and spots? Which vehicle types? Can a bike park in a car spot? Is pricing hourly or flat? Do we need reservations? Is this one lot or a chain?</p>
<div class="grid-2">
<div class="card">
<h3>Functional</h3>
<ul>
<li>Multiple floors, each with spots of type <code>SMALL</code> (bike), <code>MEDIUM</code> (car) and <code>LARGE</code> (truck/bus). Optionally <code>EV</code> spots with chargers.</li>
<li>Vehicle types: bike, car, truck (easy to add more).</li>
<li>Multiple entry and exit gates.</li>
<li>Entry: find a suitable free spot, assign it, issue a ticket with entry time.</li>
<li>Exit: compute the fee with a pluggable pricing rule (hourly, flat, per vehicle type), take payment by cash, card or UPI, free the spot.</li>
<li>Show free spots per floor and per type on display boards, updated on every change.</li>
<li>If no spot fits, reject the vehicle with a "lot full" message.</li>
</ul>
</div>
<div class="card">
<h3>Non-functional</h3>
<ul>
<li><strong>Correctness under concurrency:</strong> two gates must never get the same spot.</li>
<li><strong>Extensibility:</strong> new vehicle types, pricing rules and allocation rules without editing existing classes.</li>
<li><strong>Readability and testability:</strong> small classes, injected dependencies, deterministic time in tests.</li>
<li><strong>Scale is small:</strong> a big mall has 2,000 to 5,000 spots and maybe 2 cars per second at peak. One process with in-memory state is fine for the round. Persistence is a follow-up.</li>
</ul>
</div>
</div>

<h2>How to approach a machine-coding round</h2>
<div class="callout info"><strong>Time plan for a 90-minute round</strong>
<table>
<thead><tr><th>Minutes</th><th>What you do</th></tr></thead>
<tbody>
<tr><td>0 to 10</td><td>Clarify requirements. Write down the 5 or 6 features you will build and the ones you will skip.</td></tr>
<tr><td>10 to 20</td><td>List entities, enums and interfaces. Sketch the class diagram on paper or in comments.</td></tr>
<tr><td>20 to 65</td><td>Code the models first, then strategies, then the <code>ParkingLot</code> service, then a demo <code>main</code>.</td></tr>
<tr><td>65 to 80</td><td>Run it. Add edge cases: lot full, unknown ticket, payment failure, exactly 60 minutes.</td></tr>
<tr><td>80 to 90</td><td>Walk the interviewer through it. Point out where new pricing or a new vehicle type plugs in.</td></tr>
</tbody>
</table>
<p>For a 60-minute round, squeeze clarifying to 5 minutes and design to 5 minutes. Working code beats a beautiful diagram with no code.</p>
<p><strong>What evaluators check:</strong></p>
<ol>
<li><strong>Correctness:</strong> it compiles, runs, and the demo output is right.</li>
<li><strong>Extensibility:</strong> can a new pricing rule be added as a new class, with no edits to <code>ParkingLot</code>?</li>
<li><strong>SOLID and patterns:</strong> used where they help, not sprinkled everywhere.</li>
<li><strong>Readability:</strong> good names, small methods, no 300-line god class.</li>
<li><strong>Tests or a demo driver:</strong> a <code>main</code> that exercises the happy path and the edge cases. Bonus for a couple of unit tests.</li>
<li><strong>Concurrency awareness:</strong> at least a lock around allocation, and the ability to explain why.</li>
</ol>
</div>

<h2>Core entities</h2>
<table>
<thead><tr><th>Entity</th><th>Kind</th><th>Responsibility</th></tr></thead>
<tbody>
<tr><td><code>VehicleType</code>, <code>SpotType</code>, <code>TicketStatus</code></td><td>Enums</td><td>Fixed sets of values. A map from vehicle type to required spot type lives in one place.</td></tr>
<tr><td><code>Vehicle</code></td><td>Value object</td><td>Number plate and type. Nothing else.</td></tr>
<tr><td><code>ParkingSpot</code></td><td>Entity</td><td>Id (like <code>F0-3</code>), type, floor, and the vehicle in it (or empty).</td></tr>
<tr><td><code>ParkingFloor</code></td><td>Entity</td><td>Holds its spots, counts free spots by type.</td></tr>
<tr><td><code>Ticket</code></td><td>Entity</td><td>Id, vehicle, spot, entry time, exit time, fee, status.</td></tr>
<tr><td><code>PricingStrategy</code></td><td>Interface</td><td>Fee for a ticket at a given exit time. Implementations: <code>HourlyPricing</code>, <code>FlatPricing</code>.</td></tr>
<tr><td><code>SpotAllocationStrategy</code></td><td>Interface</td><td>Picks a free spot of a given type. Implementation: <code>NearestFirstStrategy</code>.</td></tr>
<tr><td><code>PaymentMethod</code></td><td>Interface</td><td>Charges an amount. Implementations: cash, card, UPI.</td></tr>
<tr><td><code>AvailabilityObserver</code></td><td>Interface</td><td>Told when availability changes. Implementation: <code>DisplayBoard</code>.</td></tr>
<tr><td><code>ParkingLot</code></td><td>Service</td><td>Owns floors and active tickets. Exposes <code>park()</code> and <code>unpark()</code>. Holds the lock.</td></tr>
</tbody>
</table>
<p>Notice what is <em>not</em> here: no <code>Car extends Vehicle</code>, <code>Truck extends Vehicle</code> hierarchy. Those subclasses would carry no behaviour, only a type. An enum is simpler. Add subclasses only when vehicle types really behave differently (for example an EV that needs a charger).</p>

<h2>Class diagram</h2>
<div data-diagram="classes" data-caption="Classes and interfaces. Dotted arrows with hollow heads mean 'implements'."></div>
<p>The <code>ParkingLot</code> depends only on interfaces for the parts that change. It never mentions <code>HourlyPricing</code> or <code>UpiPayment</code> by name. That is what makes the design open for extension.</p>

<h2>Flow: parking a vehicle</h2>
<div data-diagram="parkFlow" data-caption="Entry gate flow. The find-and-assign step runs under the lot's lock."></div>
<ol class="steps">
<li>The gate builds a <code>Vehicle</code> from the number plate camera or the attendant's input.</li>
<li><code>ParkingLot.park()</code> takes the lock, maps the vehicle type to a spot type, and asks the allocation strategy for a free spot.</li>
<li>If none is free, it returns nothing and the gate shows "lot full".</li>
<li>Otherwise it assigns the vehicle to the spot, creates a ticket, stores it in the active-tickets map, and notifies the display boards.</li>
<li>The lock is released and the gate prints the ticket.</li>
</ol>

<h2>Flow: exit and payment</h2>
<div data-diagram="exitFlow" data-caption="Exit gate flow. The spot is freed only after payment succeeds."></div>
<p>The order matters. Free the spot only after payment succeeds. If you free it first and the UPI payment then fails, the car is still physically in the spot but the system already gave it to someone else.</p>

<h2>Lifecycles</h2>
<div class="grid-2">
<div class="card"><div data-diagram="spotState" data-caption="Parking spot states"></div></div>
<div class="card"><div data-diagram="ticketState" data-caption="Ticket states"></div></div>
</div>
<p>The code on this page keeps it simple: a spot is free or occupied, and a ticket is active or paid. The extra states (out of service, lost ticket) are common follow-ups. With a lost ticket the lot usually charges a fixed penalty, often a full day's rate. If the lifecycle grows past four or five states with rules about which moves are allowed, model it with the State pattern instead of a growing pile of <code>if</code> checks.</p>

<h2>Design patterns used and why</h2>

<h3>Strategy: pricing and spot allocation</h3>
<p>The Strategy pattern means "put a family of interchangeable algorithms behind one interface, and choose one at runtime". We use it twice.</p>
<ul>
<li><strong>Pricing:</strong> <code>HourlyPricing</code> charges per started hour (a car at Rs 40/hour parked for 150 minutes pays for 3 hours, Rs 120). <code>FlatPricing</code> charges a fixed amount per visit by vehicle type. Tomorrow you might add "first 30 minutes free" or "weekend surge". Each is a new class. <code>ParkingLot</code> does not change.</li>
<li><strong>Allocation:</strong> <code>NearestFirstStrategy</code> picks the lowest floor and lowest spot number. Other options: fill from the top to keep the ground floor for quick visits, spread cars evenly across floors, or reserve spots near the lift for disabled drivers.</li>
</ul>
<p>Because the strategy is passed into the constructor (dependency injection), tests can pass a fake pricing rule that always returns Rs 0 and check only the allocation logic.</p>

<h3>Factory: building floors and spots</h3>
<p>A factory is a method or class whose job is to create objects, so callers do not repeat construction logic. <code>ParkingFloor.create(number, small, medium, large)</code> builds a floor and names every spot (<code>F1-1</code>, <code>F1-2</code>...). If vehicles later become subclasses (<code>ElectricCar</code> with a battery size), a <code>VehicleFactory.create(type, plate)</code> keeps the "which class do I build" switch in one spot instead of spreading it across every gate.</p>

<h3>Singleton: one ParkingLot (and why to be careful)</h3>
<p>Many textbook answers make <code>ParkingLot</code> a Singleton, a class that allows only one instance, reached through <code>getInstance()</code>. It sounds right because there is one physical lot. Mention it, but know the pitfalls:</p>
<ul>
<li><strong>Hard to test:</strong> every test shares the same global lot, so tests leak state into each other.</li>
<li><strong>Hidden dependency:</strong> any class can call <code>ParkingLot.getInstance()</code>, so you cannot see what depends on what.</li>
<li><strong>Breaks with growth:</strong> the moment the business runs 50 lots across Bengaluru, "only one instance" is wrong.</li>
<li><strong>Thread-safety traps:</strong> lazy creation needs double-checked locking with a <code>volatile</code> field in Java, or an eager static instance.</li>
</ul>
<p>The code here creates one <code>ParkingLot</code> in <code>main</code> and passes it where needed. That gives you "one instance" in practice without a global. Saying this out loud usually earns points.</p>

<h3>Observer: display boards</h3>
<p>Observer means "objects subscribe to an event and get called when it happens". Display boards at the entrance, a mobile app, and an analytics logger all want to know when availability changes. <code>ParkingLot</code> keeps a list of <code>AvailabilityObserver</code>s and calls <code>onChange()</code> after every park and unpark. Adding an SMS alert when the lot is 90% full is one new class. The lot itself does not know or care who is listening.</p>
<p>One caution: observers run inside the lock in this simple version, so they must be fast. In production, publish an event to a queue and let boards update on their own.</p>

<h3>SOLID in this design</h3>
<p>SOLID is five design rules for keeping classes easy to change. Here is where each shows up.</p>
<div class="grid-3">
<div class="card"><strong>S: Single responsibility</strong><p>Pricing math lives in pricing classes, spot selection in allocation classes, payment in payment classes. <code>ParkingLot</code> only coordinates.</p></div>
<div class="card"><strong>O: Open/closed</strong><p>Add <code>WeekendPricing</code> or <code>TopFloorFirstStrategy</code> as new classes. No existing class is edited.</p></div>
<div class="card"><strong>L: Liskov substitution</strong><p>Any <code>PaymentMethod</code> can replace another. Cash, card and UPI all honour the same "return true if charged" contract.</p></div>
<div class="card"><strong>I: Interface segregation</strong><p>Small interfaces with one method each. A display board does not have to implement payment methods.</p></div>
<div class="card"><strong>D: Dependency inversion</strong><p><code>ParkingLot</code> depends on <code>PricingStrategy</code>, not on <code>HourlyPricing</code>. Concrete classes are injected from <code>main</code>.</p></div>
<div class="card"><strong>Bonus: composition</strong><p>The lot <em>has</em> a pricing strategy instead of <em>being</em> an <code>HourlyParkingLot</code>. Swap it at runtime with <code>setPricing()</code>.</p></div>
</div>

<h2>Full implementation</h2>
<p>Each tab is one self-contained file that compiles and runs. Time is passed in as minutes so the demo is deterministic. In real code you would inject a clock (<code>java.time.Clock</code> in Java) so tests can control it. Money is kept in whole rupees as integers. Never use floating point for money.</p>
<div data-code="full"></div>
<p>Expected output (same in every language):</p>
<pre><code>  [Board] F0 SMALL:1 MEDIUM:2 LARGE:1 | F1 SMALL:1 MEDIUM:2 LARGE:1
Parked KA-01-AB-1111 at F0-1, ticket T1
...
Parked TN-09-TR-5555 at F1-4, ticket T5
No LARGE spot free for DL-01-TR-6666
Car exits after 150 min (hourly pricing):
  Paid Rs.120 via UPI (rahul@okaxis) for T2
Bike exits after 45 min (hourly pricing):
  Paid Rs.20 in cash for T1
Truck exits (flat pricing):
  Paid Rs.300 by card for T4
  [Board] F0 SMALL:2 MEDIUM:1 LARGE:1 | F1 SMALL:1 MEDIUM:2 LARGE:0</code></pre>
<p>Things to point out when you walk the interviewer through it:</p>
<ul>
<li>The vehicle-to-spot rule is one map. Allowing bikes in car spots when small spots run out is a change in the allocation strategy, not in five <code>if</code> blocks.</li>
<li><code>park()</code> returns "no ticket" instead of throwing when the lot is full. Full is a normal business outcome, not an error. An unknown ticket at exit is an error, so that throws.</li>
<li>Each language uses its own idiom for the lock: <code>synchronized</code> in Java, <code>threading.Lock</code> in Python, <code>std::mutex</code> with <code>lock_guard</code> in C++, <code>sync.Mutex</code> in Go. JavaScript needs none, and the comment in the code explains why.</li>
</ul>

<h2>Concurrency: two gates, one spot</h2>
<p>This is the part that separates an SDE 2 answer from an SDE 1 answer. The bug is a classic <mark>check-then-act race</mark>: gate A checks spot F0-3 and sees it free, gate B checks the same spot and also sees it free, then both assign it. Two cars, one spot, one angry customer.</p>
<table>
<thead><tr><th>Approach</th><th>How</th><th>Pros</th><th>Cons</th></tr></thead>
<tbody>
<tr><td>One lock for the lot</td><td><code>synchronized</code> / mutex around find + assign</td><td>Simplest, obviously correct</td><td>All gates wait on each other. Fine at 2 cars/second, which is real mall traffic.</td></tr>
<tr><td>Lock per floor</td><td>Each floor has its own lock; gates try floors in turn</td><td>Gates on different floors do not block</td><td>More code. Moving between floors needs care to avoid deadlock (always lock in one order).</td></tr>
<tr><td>Atomic claim per spot</td><td>Compare-and-set (CAS) on the spot: "set to this car only if still empty"</td><td>No global lock. Losers just try the next spot.</td><td>Free counts on boards are briefly stale. Harder to explain.</td></tr>
<tr><td>Database row lock</td><td><code>SELECT ... FOR UPDATE SKIP LOCKED</code> or <code>UPDATE spots SET ticket=? WHERE id=? AND ticket IS NULL</code></td><td>Works across many app servers</td><td>Needs a database round trip per park.</td></tr>
</tbody>
</table>
<p>CAS (compare-and-set) is a CPU instruction that updates a value only if it still holds the value you expect, all in one indivisible step. The snippet below uses it to claim spots without a lot-wide lock. Twenty cars race for five spots. Exactly five win, and no spot gets two cars.</p>
<div data-code="concurrent"></div>
<div class="callout warn"><strong>JavaScript is not immune</strong>Node runs your code on one thread, so two lines of synchronous code never interleave. But the race comes back the moment you put an <code>await</code> between "check" and "take", for example a database read. The JavaScript tab shows the broken and the fixed version side by side. Rule: claim first, then await.</div>
<p>Two more concurrency details worth mentioning:</p>
<ul>
<li><strong>Keep slow work outside the lock.</strong> A real UPI payment can take 5 to 30 seconds. Holding the lot lock that long would freeze every gate. Better: compute the fee, take payment outside the lock, then take the lock only to mark the ticket paid and free the spot. Mark the ticket as "payment in progress" first so a second exit scan cannot double-charge.</li>
<li><strong>Ticket ids must be unique under concurrency.</strong> A plain <code>seq++</code> is fine inside the lock. Outside it, use an atomic counter or a UUID.</li>
</ul>

<h2>Extensibility: common follow-ups</h2>
<div class="tabs">
<section data-tab="EV charging">
<p>Add <code>SpotType.EV</code> and an <code>ELECTRIC_CAR</code> vehicle type. The allocation strategy prefers EV spots for electric cars and falls back to regular car spots. Charging is a separate fee: wrap the base pricing in a <code>ChargingFeeDecorator</code> that adds Rs per kWh. That is the Decorator pattern, which adds behaviour by wrapping an object instead of changing it. No change to <code>HourlyPricing</code>.</p>
</section>
<section data-tab="Reservations">
<p>Add a <code>Reservation</code> (vehicle, spot, start, end) and a <code>RESERVED</code> spot state. The allocation strategy skips reserved spots unless the arriving plate matches. A scheduled job releases reservations that are not claimed within 15 minutes of the start time, the way BookMyShow releases unpaid seats.</p>
</section>
<section data-tab="Multiple lots">
<p>Drop the Singleton idea for good. Add a <code>ParkingLotRegistry</code> (or a service in front of many lots) keyed by lot id. Each lot keeps its own lock, so lots never block each other. A "find me parking near Koramangala" feature becomes a query across lots, which is now an HLD problem.</p>
</section>
<section data-tab="Persistence">
<p>Tables: <code>floors</code>, <code>spots(id, floor_id, type, status, ticket_id)</code>, <code>tickets(id, plate, spot_id, entry_at, exit_at, fee, status)</code>, <code>payments(id, ticket_id, method, amount, status)</code>. Put the repository behind an interface (<code>TicketRepository</code>) so the in-memory version from the round and a MySQL version are swappable. The concurrency fix moves into the database as a conditional <code>UPDATE</code>.</p>
</section>
<section data-tab="Smarter allocation">
<p>Let bikes overflow into car spots when small spots run out, but never trucks into car spots. Keep free spots in a per-type min-heap (priority queue) per floor instead of scanning every spot: allocation drops from O(spots) to O(log spots). For 5,000 spots a scan is still under a millisecond, so mention it as an optimisation, not a must.</p>
</section>
</div>

<h2>Common mistakes</h2>
<div class="callout warn"><strong>Things that lose marks</strong>
<ul>
<li>A god class: <code>ParkingLot</code> computes fees with a big <code>switch</code>, prints boards, and talks to the payment gateway.</li>
<li>Pricing as <code>if (type == CAR) ... else if (type == BIKE)</code> inside <code>unpark()</code>. Every new rule edits the core class.</li>
<li>A deep inheritance tree (<code>Car</code>, <code>Bike</code>, <code>Truck</code>, <code>CompactSpot</code>, <code>LargeSpot</code>...) with no behaviour in any subclass.</li>
<li>No lock, or a lock around only "find" but not "assign".</li>
<li>Freeing the spot before payment succeeds.</li>
<li>Using <code>double</code> for money, or rounding 61 minutes down to 1 hour when the rule is "per started hour".</li>
<li>Calling <code>System.currentTimeMillis()</code> deep inside pricing, so the fee cannot be tested.</li>
<li>Spending 40 minutes on the diagram and never running the code.</li>
</ul>
</div>

<div class="callout interview"><strong>Say this in the interview</strong>"I will keep vehicle and spot types as enums since they carry no behaviour. The two things likely to change are pricing and spot selection, so both are Strategy interfaces injected into <code>ParkingLot</code>. Display boards subscribe as observers. Allocation is find-then-assign, which is a check-then-act race between gates, so I do both under one lock. At mall traffic of a couple of cars per second a single lock is plenty, and if it ever becomes a bottleneck I can move to per-floor locks or a compare-and-set on each spot."</div>

<h2>Follow-up questions</h2>
<div class="quiz">
<details><summary>Why make PricingStrategy an interface instead of a method with a switch on vehicle type?</summary><div>New pricing rules (weekend flat rate, first 30 minutes free, EV charging) come often. With an interface each rule is a new class and <code>ParkingLot</code> never changes (open/closed principle). Each rule can also be unit-tested on its own. A switch grows forever and every change risks breaking the other branches.</div></details>
<details><summary>Two gates call park() at the same time and only one spot is left. Walk through what happens in your code.</summary><div>Both threads try to enter the <code>synchronized</code> block (or acquire the mutex). One wins, finds the spot, assigns it, creates a ticket and releases the lock. The second then enters, scans, finds no free spot of that type, and returns "no ticket". Without the lock, both could see the spot as free and both assign it.</div></details>
<details><summary>Should ParkingLot be a Singleton?</summary><div>It is a common textbook answer, but it hurts testability (shared global state across tests), hides dependencies, and breaks when the business runs many lots. Prefer creating one instance at startup and injecting it. If asked to implement one anyway, use an eager static instance or double-checked locking with a <code>volatile</code> field in Java.</div></details>
<details><summary>A UPI payment takes 20 seconds. What changes?</summary><div>Do not hold the lot lock during payment, or every gate freezes. Mark the ticket as <code>PAYMENT_PENDING</code> under the lock, release it, call the gateway, then take the lock again to mark it <code>PAID</code> and free the spot. Use the ticket id as an idempotency key with the gateway so a retry never charges twice.</div></details>
<details><summary>How would you let bikes park in car spots when bike spots are full?</summary><div>Change only the allocation strategy: for a bike, try <code>SMALL</code> first, then <code>MEDIUM</code>. Keep the list of acceptable spot types per vehicle in one table. <code>ParkingLot</code>, pricing and tickets do not change. Decide with the interviewer whether the bike then pays bike rates or car rates. That is a pricing rule.</div></details>
<details><summary>How do display boards stay correct without the lot knowing about them?</summary><div>Observer pattern. Boards implement <code>AvailabilityObserver</code> and register with the lot. After each park or unpark the lot calls <code>onChange()</code> on every observer. New consumers (mobile app, "lot almost full" SMS) are new observer classes. In production, publish an event to a queue so a slow board cannot slow down the gates.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
<li>Nouns become classes, fixed sets become enums, things that change become interfaces.</li>
<li>Strategy for pricing and spot allocation is the heart of the answer. Inject both into <code>ParkingLot</code>.</li>
<li>Observer keeps display boards decoupled. Factory keeps construction in one place. Singleton is worth mentioning mainly for its pitfalls.</li>
<li>Find-and-assign is a check-then-act race. Do it under one lock, or claim spots with compare-and-set.</li>
<li>Free the spot only after payment succeeds, and keep slow payment calls outside the lock.</li>
<li>In the round, working code with a demo beats a perfect diagram. Plan your 90 minutes.</li>
</ul></div>
`,
  code: {
    full: {
      title: "Complete parking lot (single file, runnable)",
      java: String.raw`// Parking lot: a single-file machine-coding solution.
// Run: javac ParkingLotDemo.java && java ParkingLotDemo
import java.util.*;

public class ParkingLotDemo {

    enum VehicleType { BIKE, CAR, TRUCK }
    enum SpotType { SMALL, MEDIUM, LARGE }
    enum TicketStatus { ACTIVE, PAID }

    // Which spot each vehicle needs. One place to change the rule.
    static SpotType spotFor(VehicleType v) {
        switch (v) {
            case BIKE: return SpotType.SMALL;
            case CAR: return SpotType.MEDIUM;
            default: return SpotType.LARGE;
        }
    }

    static class Vehicle {
        final String plate;
        final VehicleType type;
        Vehicle(String plate, VehicleType type) { this.plate = plate; this.type = type; }
    }

    static class ParkingSpot {
        final String id;
        final SpotType type;
        final int floor;
        private Vehicle vehicle; // null means free

        ParkingSpot(String id, SpotType type, int floor) { this.id = id; this.type = type; this.floor = floor; }
        boolean isFree() { return vehicle == null; }
        void assign(Vehicle v) { vehicle = v; }
        void release() { vehicle = null; }
    }

    static class ParkingFloor {
        final int number;
        final List<ParkingSpot> spots = new ArrayList<>();
        ParkingFloor(int number) { this.number = number; }

        // Factory: builds a floor and names its spots F<floor>-<n>.
        static ParkingFloor create(int number, int small, int medium, int large) {
            ParkingFloor f = new ParkingFloor(number);
            int[] counts = {small, medium, large};
            for (SpotType t : SpotType.values())
                for (int i = 0; i < counts[t.ordinal()]; i++)
                    f.spots.add(new ParkingSpot("F" + number + "-" + (f.spots.size() + 1), t, number));
            return f;
        }

        int freeCount(SpotType t) {
            int n = 0;
            for (ParkingSpot s : spots) if (s.type == t && s.isFree()) n++;
            return n;
        }
    }

    static class Ticket {
        final String id;
        final Vehicle vehicle;
        final ParkingSpot spot;
        final int entryMin;
        int exitMin = -1;
        int fee = 0;
        TicketStatus status = TicketStatus.ACTIVE;

        Ticket(String id, Vehicle vehicle, ParkingSpot spot, int entryMin) {
            this.id = id; this.vehicle = vehicle; this.spot = spot; this.entryMin = entryMin;
        }
    }

    // ---------- Strategy: pricing ----------
    interface PricingStrategy { int fee(Ticket t, int exitMin); }

    static class HourlyPricing implements PricingStrategy {
        private final Map<VehicleType, Integer> rate = new EnumMap<>(VehicleType.class); // Rs per hour
        HourlyPricing() {
            rate.put(VehicleType.BIKE, 20);
            rate.put(VehicleType.CAR, 40);
            rate.put(VehicleType.TRUCK, 100);
        }
        public int fee(Ticket t, int exitMin) {
            int minutes = Math.max(1, exitMin - t.entryMin);
            int hours = (minutes + 59) / 60; // round up: 61 minutes = 2 hours
            return hours * rate.get(t.vehicle.type);
        }
    }

    static class FlatPricing implements PricingStrategy {
        private final Map<VehicleType, Integer> flat = new EnumMap<>(VehicleType.class); // Rs per visit
        FlatPricing() {
            flat.put(VehicleType.BIKE, 50);
            flat.put(VehicleType.CAR, 100);
            flat.put(VehicleType.TRUCK, 300);
        }
        public int fee(Ticket t, int exitMin) { return flat.get(t.vehicle.type); }
    }

    // ---------- Strategy: spot allocation ----------
    interface SpotAllocationStrategy { ParkingSpot find(List<ParkingFloor> floors, SpotType t); }

    // Lowest floor first, then lowest spot number.
    static class NearestFirstStrategy implements SpotAllocationStrategy {
        public ParkingSpot find(List<ParkingFloor> floors, SpotType t) {
            for (ParkingFloor f : floors)
                for (ParkingSpot s : f.spots)
                    if (s.type == t && s.isFree()) return s;
            return null;
        }
    }

    // ---------- Payment ----------
    interface PaymentMethod { boolean pay(String ticketId, int amount); }

    static class CashPayment implements PaymentMethod {
        public boolean pay(String id, int amt) { System.out.println("  Paid Rs." + amt + " in cash for " + id); return true; }
    }
    static class CardPayment implements PaymentMethod {
        public boolean pay(String id, int amt) { System.out.println("  Paid Rs." + amt + " by card for " + id); return true; }
    }
    static class UpiPayment implements PaymentMethod {
        private final String upiId;
        UpiPayment(String upiId) { this.upiId = upiId; }
        public boolean pay(String id, int amt) {
            System.out.println("  Paid Rs." + amt + " via UPI (" + upiId + ") for " + id);
            return true;
        }
    }

    // ---------- Observer: display boards ----------
    interface AvailabilityObserver { void onChange(List<ParkingFloor> floors); }

    static class DisplayBoard implements AvailabilityObserver {
        public void onChange(List<ParkingFloor> floors) {
            StringJoiner all = new StringJoiner(" | ", "  [Board] ", "");
            for (ParkingFloor f : floors) {
                StringBuilder sb = new StringBuilder("F" + f.number);
                for (SpotType t : SpotType.values()) sb.append(' ').append(t).append(':').append(f.freeCount(t));
                all.add(sb);
            }
            System.out.println(all);
        }
    }

    // ---------- The lot ----------
    static class ParkingLot {
        private final List<ParkingFloor> floors;
        private final SpotAllocationStrategy allocation;
        private PricingStrategy pricing;
        private final Map<String, Ticket> active = new HashMap<>();
        private final List<AvailabilityObserver> observers = new ArrayList<>();
        private int seq = 0;
        // One lock guards "find a free spot + mark it taken" so two gates
        // can never hand out the same spot.
        private final Object lock = new Object();

        ParkingLot(List<ParkingFloor> floors, SpotAllocationStrategy a, PricingStrategy p) {
            this.floors = floors; this.allocation = a; this.pricing = p;
        }

        void addObserver(AvailabilityObserver o) { observers.add(o); }

        void setPricing(PricingStrategy p) { synchronized (lock) { pricing = p; } }

        private void notifyObservers() { for (AvailabilityObserver o : observers) o.onChange(floors); }

        // Returns null when no matching spot is free.
        Ticket park(Vehicle v, int nowMin) {
            synchronized (lock) {
                ParkingSpot spot = allocation.find(floors, spotFor(v.type));
                if (spot == null) return null;
                spot.assign(v);
                Ticket t = new Ticket("T" + (++seq), v, spot, nowMin);
                active.put(t.id, t);
                notifyObservers();
                return t;
            }
        }

        int unpark(String ticketId, int nowMin, PaymentMethod payment) {
            synchronized (lock) {
                Ticket t = active.get(ticketId);
                if (t == null) throw new IllegalArgumentException("Unknown or closed ticket " + ticketId);
                int fee = pricing.fee(t, nowMin);
                // Payment is instant here. With a real gateway, take payment
                // outside the lock and only free the spot under it.
                if (!payment.pay(t.id, fee)) throw new IllegalStateException("Payment failed");
                t.exitMin = nowMin;
                t.fee = fee;
                t.status = TicketStatus.PAID;
                t.spot.release();
                active.remove(ticketId);
                notifyObservers();
                return fee;
            }
        }
    }

    public static void main(String[] args) {
        ParkingLot lot = new ParkingLot(
            Arrays.asList(ParkingFloor.create(0, 2, 2, 1), ParkingFloor.create(1, 1, 2, 1)),
            new NearestFirstStrategy(), new HourlyPricing());
        lot.addObserver(new DisplayBoard());

        Vehicle[] vehicles = {
            new Vehicle("KA-01-AB-1111", VehicleType.BIKE), new Vehicle("KA-05-MN-2222", VehicleType.CAR),
            new Vehicle("MH-12-XY-3333", VehicleType.CAR), new Vehicle("KA-51-TR-4444", VehicleType.TRUCK),
            new Vehicle("TN-09-TR-5555", VehicleType.TRUCK), new Vehicle("DL-01-TR-6666", VehicleType.TRUCK),
        };
        int[] arriveAt = {0, 0, 10, 30, 35, 40};
        List<Ticket> tickets = new ArrayList<>();
        for (int i = 0; i < vehicles.length; i++) {
            Vehicle v = vehicles[i];
            Ticket t = lot.park(v, arriveAt[i]);
            if (t == null) {
                System.out.println("No " + spotFor(v.type) + " spot free for " + v.plate);
                continue;
            }
            System.out.println("Parked " + v.plate + " at " + t.spot.id + ", ticket " + t.id);
            tickets.add(t);
        }

        System.out.println("Car exits after 150 min (hourly pricing):");
        lot.unpark(tickets.get(1).id, 150, new UpiPayment("rahul@okaxis"));
        System.out.println("Bike exits after 45 min (hourly pricing):");
        lot.unpark(tickets.get(0).id, 45, new CashPayment());
        lot.setPricing(new FlatPricing()); // e.g. a weekend flat rate, swapped at runtime
        System.out.println("Truck exits (flat pricing):");
        lot.unpark(tickets.get(3).id, 400, new CardPayment());
    }
}`,
      python: String.raw`"""Parking lot: a single-file machine-coding solution. Run: python3 parking_lot.py"""
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


class VehicleType(Enum):
    BIKE = "BIKE"
    CAR = "CAR"
    TRUCK = "TRUCK"


class SpotType(Enum):
    SMALL = "SMALL"
    MEDIUM = "MEDIUM"
    LARGE = "LARGE"


class TicketStatus(Enum):
    ACTIVE = "ACTIVE"
    PAID = "PAID"


# Which spot each vehicle needs. One place to change the rule.
SPOT_FOR = {VehicleType.BIKE: SpotType.SMALL, VehicleType.CAR: SpotType.MEDIUM, VehicleType.TRUCK: SpotType.LARGE}


@dataclass(frozen=True)
class Vehicle:
    plate: str
    type: VehicleType


class ParkingSpot:
    def __init__(self, spot_id: str, spot_type: SpotType, floor: int):
        self.id, self.type, self.floor = spot_id, spot_type, floor
        self.vehicle: Optional[Vehicle] = None  # None means free

    def is_free(self) -> bool:
        return self.vehicle is None

    def assign(self, v: Vehicle) -> None:
        self.vehicle = v

    def release(self) -> None:
        self.vehicle = None


class ParkingFloor:
    def __init__(self, number: int):
        self.number = number
        self.spots: List[ParkingSpot] = []

    @staticmethod
    def create(number: int, small: int, medium: int, large: int) -> "ParkingFloor":
        """Factory: builds a floor and names its spots F<floor>-<n>."""
        floor = ParkingFloor(number)
        for spot_type, count in ((SpotType.SMALL, small), (SpotType.MEDIUM, medium), (SpotType.LARGE, large)):
            for _ in range(count):
                floor.spots.append(ParkingSpot(f"F{number}-{len(floor.spots) + 1}", spot_type, number))
        return floor

    def free_count(self, spot_type: SpotType) -> int:
        return sum(1 for s in self.spots if s.type == spot_type and s.is_free())


@dataclass
class Ticket:
    id: str
    vehicle: Vehicle
    spot: ParkingSpot
    entry_min: int
    exit_min: int = -1
    fee: int = 0
    status: TicketStatus = TicketStatus.ACTIVE


# ---------- Strategy: pricing ----------
class PricingStrategy(ABC):
    @abstractmethod
    def fee(self, ticket: Ticket, exit_min: int) -> int: ...


class HourlyPricing(PricingStrategy):
    RATE = {VehicleType.BIKE: 20, VehicleType.CAR: 40, VehicleType.TRUCK: 100}  # Rs per hour

    def fee(self, ticket: Ticket, exit_min: int) -> int:
        minutes = max(1, exit_min - ticket.entry_min)
        hours = (minutes + 59) // 60  # round up: 61 minutes = 2 hours
        return hours * self.RATE[ticket.vehicle.type]


class FlatPricing(PricingStrategy):
    FLAT = {VehicleType.BIKE: 50, VehicleType.CAR: 100, VehicleType.TRUCK: 300}  # Rs per visit

    def fee(self, ticket: Ticket, exit_min: int) -> int:
        return self.FLAT[ticket.vehicle.type]


# ---------- Strategy: spot allocation ----------
class SpotAllocationStrategy(ABC):
    @abstractmethod
    def find(self, floors: List[ParkingFloor], spot_type: SpotType) -> Optional[ParkingSpot]: ...


class NearestFirstStrategy(SpotAllocationStrategy):
    """Lowest floor first, then lowest spot number (closest to the entry ramp)."""

    def find(self, floors, spot_type):
        for floor in floors:
            for spot in floor.spots:
                if spot.type == spot_type and spot.is_free():
                    return spot
        return None


# ---------- Payment ----------
class PaymentMethod(ABC):
    @abstractmethod
    def pay(self, ticket_id: str, amount: int) -> bool: ...


class CashPayment(PaymentMethod):
    def pay(self, ticket_id, amount):
        print(f"  Paid Rs.{amount} in cash for {ticket_id}")
        return True


class CardPayment(PaymentMethod):
    def pay(self, ticket_id, amount):
        print(f"  Paid Rs.{amount} by card for {ticket_id}")
        return True


class UpiPayment(PaymentMethod):
    def __init__(self, upi_id: str):
        self.upi_id = upi_id

    def pay(self, ticket_id, amount):
        print(f"  Paid Rs.{amount} via UPI ({self.upi_id}) for {ticket_id}")
        return True


# ---------- Observer: display boards ----------
class AvailabilityObserver(ABC):
    @abstractmethod
    def on_change(self, floors: List[ParkingFloor]) -> None: ...


class DisplayBoard(AvailabilityObserver):
    def on_change(self, floors):
        parts = []
        for f in floors:
            counts = " ".join(f"{t.value}:{f.free_count(t)}" for t in SpotType)
            parts.append(f"F{f.number} {counts}")
        print("  [Board] " + " | ".join(parts))


# ---------- The lot ----------
class ParkingLot:
    def __init__(self, floors, allocation: SpotAllocationStrategy, pricing: PricingStrategy):
        self.floors = floors
        self.allocation = allocation
        self.pricing = pricing
        self.active: Dict[str, Ticket] = {}
        self.observers: List[AvailabilityObserver] = []
        self.seq = 0
        # One lock guards "find a free spot + mark it taken" so two gates
        # can never hand out the same spot.
        self._lock = threading.Lock()

    def add_observer(self, o: AvailabilityObserver) -> None:
        self.observers.append(o)

    def set_pricing(self, p: PricingStrategy) -> None:
        self.pricing = p

    def _notify(self) -> None:
        for o in self.observers:
            o.on_change(self.floors)

    def park(self, v: Vehicle, now_min: int) -> Optional[Ticket]:
        with self._lock:
            spot = self.allocation.find(self.floors, SPOT_FOR[v.type])
            if spot is None:
                return None
            spot.assign(v)
            self.seq += 1
            ticket = Ticket(f"T{self.seq}", v, spot, now_min)
            self.active[ticket.id] = ticket
            self._notify()
            return ticket

    def unpark(self, ticket_id: str, now_min: int, payment: PaymentMethod) -> int:
        with self._lock:
            ticket = self.active.get(ticket_id)
            if ticket is None:
                raise ValueError(f"Unknown or closed ticket {ticket_id}")
            fee = self.pricing.fee(ticket, now_min)
            # Payment is instant here. With a real gateway, take payment
            # outside the lock and only free the spot under it.
            if not payment.pay(ticket.id, fee):
                raise RuntimeError("Payment failed")
            ticket.exit_min, ticket.fee, ticket.status = now_min, fee, TicketStatus.PAID
            ticket.spot.release()
            del self.active[ticket_id]
            self._notify()
            return fee


def main() -> None:
    lot = ParkingLot([ParkingFloor.create(0, 2, 2, 1), ParkingFloor.create(1, 1, 2, 1)],
                     NearestFirstStrategy(), HourlyPricing())
    lot.add_observer(DisplayBoard())

    arrivals = [
        (Vehicle("KA-01-AB-1111", VehicleType.BIKE), 0),
        (Vehicle("KA-05-MN-2222", VehicleType.CAR), 0),
        (Vehicle("MH-12-XY-3333", VehicleType.CAR), 10),
        (Vehicle("KA-51-TR-4444", VehicleType.TRUCK), 30),
        (Vehicle("TN-09-TR-5555", VehicleType.TRUCK), 35),
        (Vehicle("DL-01-TR-6666", VehicleType.TRUCK), 40),
    ]
    tickets = []
    for v, t in arrivals:
        ticket = lot.park(v, t)
        if ticket is None:
            print(f"No {SPOT_FOR[v.type].value} spot free for {v.plate}")
        else:
            print(f"Parked {v.plate} at {ticket.spot.id}, ticket {ticket.id}")
            tickets.append(ticket)

    print("Car exits after 150 min (hourly pricing):")
    lot.unpark(tickets[1].id, 150, UpiPayment("rahul@okaxis"))
    print("Bike exits after 45 min (hourly pricing):")
    lot.unpark(tickets[0].id, 45, CashPayment())
    lot.set_pricing(FlatPricing())  # e.g. a weekend flat rate, swapped at runtime
    print("Truck exits (flat pricing):")
    lot.unpark(tickets[3].id, 400, CardPayment())


if __name__ == "__main__":
    main()`,
      cpp: String.raw`// Parking lot: a single-file machine-coding solution.
// Build: g++ -std=c++17 -pthread parking_lot.cpp -o lot && ./lot
#include <iostream>
#include <map>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>
using namespace std;

enum class VehicleType { BIKE, CAR, TRUCK };
enum class SpotType { SMALL, MEDIUM, LARGE };
enum class TicketStatus { ACTIVE, PAID };

const vector<SpotType> ALL_SPOT_TYPES = {SpotType::SMALL, SpotType::MEDIUM, SpotType::LARGE};
string name(SpotType t) { return t == SpotType::SMALL ? "SMALL" : t == SpotType::MEDIUM ? "MEDIUM" : "LARGE"; }

// Which spot each vehicle needs. One place to change the rule.
SpotType spotFor(VehicleType v) {
    switch (v) {
        case VehicleType::BIKE: return SpotType::SMALL;
        case VehicleType::CAR: return SpotType::MEDIUM;
        default: return SpotType::LARGE;
    }
}

struct Vehicle {
    string plate;
    VehicleType type;
};

class ParkingSpot {
public:
    ParkingSpot(string id, SpotType type, int floor) : id(std::move(id)), type(type), floor(floor) {}
    bool isFree() const { return vehicle == nullptr; }
    void assign(const Vehicle* v) { vehicle = v; }
    void release() { vehicle = nullptr; }
    const string id;
    const SpotType type;
    const int floor;
private:
    const Vehicle* vehicle = nullptr;  // nullptr means free
};

class ParkingFloor {
public:
    explicit ParkingFloor(int number) : number(number) {}
    // Factory: builds a floor and names its spots F<floor>-<n>.
    static unique_ptr<ParkingFloor> create(int number, int small, int medium, int large) {
        auto f = make_unique<ParkingFloor>(number);
        int counts[] = {small, medium, large};
        for (int i = 0; i < 3; i++)
            for (int k = 0; k < counts[i]; k++)
                f->spots.push_back(make_unique<ParkingSpot>(
                    "F" + to_string(number) + "-" + to_string(f->spots.size() + 1), ALL_SPOT_TYPES[i], number));
        return f;
    }
    int freeCount(SpotType t) const {
        int n = 0;
        for (auto& s : spots) if (s->type == t && s->isFree()) n++;
        return n;
    }
    const int number;
    vector<unique_ptr<ParkingSpot>> spots;
};

struct Ticket {
    string id;
    Vehicle vehicle;
    ParkingSpot* spot;
    int entryMin;
    int exitMin = -1;
    int fee = 0;
    TicketStatus status = TicketStatus::ACTIVE;
};

using Floors = vector<unique_ptr<ParkingFloor>>;

// ---------- Strategy: pricing ----------
struct PricingStrategy {
    virtual ~PricingStrategy() = default;
    virtual int fee(const Ticket& t, int exitMin) const = 0;
};

struct HourlyPricing : PricingStrategy {
    map<VehicleType, int> rate{{VehicleType::BIKE, 20}, {VehicleType::CAR, 40}, {VehicleType::TRUCK, 100}};
    int fee(const Ticket& t, int exitMin) const override {
        int minutes = max(1, exitMin - t.entryMin);
        int hours = (minutes + 59) / 60;  // round up: 61 minutes = 2 hours
        return hours * rate.at(t.vehicle.type);
    }
};

struct FlatPricing : PricingStrategy {
    map<VehicleType, int> flat{{VehicleType::BIKE, 50}, {VehicleType::CAR, 100}, {VehicleType::TRUCK, 300}};
    int fee(const Ticket& t, int) const override { return flat.at(t.vehicle.type); }
};

// ---------- Strategy: spot allocation ----------
struct SpotAllocationStrategy {
    virtual ~SpotAllocationStrategy() = default;
    virtual ParkingSpot* find(const Floors& floors, SpotType t) const = 0;
};

// Lowest floor first, then lowest spot number.
struct NearestFirstStrategy : SpotAllocationStrategy {
    ParkingSpot* find(const Floors& floors, SpotType t) const override {
        for (auto& f : floors)
            for (auto& s : f->spots)
                if (s->type == t && s->isFree()) return s.get();
        return nullptr;
    }
};

// ---------- Payment ----------
struct PaymentMethod {
    virtual ~PaymentMethod() = default;
    virtual bool pay(const string& ticketId, int amount) = 0;
};
struct CashPayment : PaymentMethod {
    bool pay(const string& id, int amt) override { cout << "  Paid Rs." << amt << " in cash for " << id << "\n"; return true; }
};
struct CardPayment : PaymentMethod {
    bool pay(const string& id, int amt) override { cout << "  Paid Rs." << amt << " by card for " << id << "\n"; return true; }
};
struct UpiPayment : PaymentMethod {
    string upiId;
    explicit UpiPayment(string u) : upiId(std::move(u)) {}
    bool pay(const string& id, int amt) override {
        cout << "  Paid Rs." << amt << " via UPI (" << upiId << ") for " << id << "\n";
        return true;
    }
};

// ---------- Observer: display boards ----------
struct AvailabilityObserver {
    virtual ~AvailabilityObserver() = default;
    virtual void onChange(const Floors& floors) = 0;
};

struct DisplayBoard : AvailabilityObserver {
    void onChange(const Floors& floors) override {
        cout << "  [Board]";
        for (size_t i = 0; i < floors.size(); i++) {
            cout << (i ? " | F" : " F") << floors[i]->number;
            for (auto t : ALL_SPOT_TYPES) cout << " " << name(t) << ":" << floors[i]->freeCount(t);
        }
        cout << "\n";
    }
};

// ---------- The lot ----------
class ParkingLot {
public:
    ParkingLot(Floors floors, unique_ptr<SpotAllocationStrategy> a, unique_ptr<PricingStrategy> p)
        : floors(std::move(floors)), allocation(std::move(a)), pricing(std::move(p)) {}

    void addObserver(AvailabilityObserver* o) { observers.push_back(o); }
    void setPricing(unique_ptr<PricingStrategy> p) {
        lock_guard<mutex> g(mu);
        pricing = std::move(p);
    }

    // Returns nullptr when no matching spot is free.
    Ticket* park(const Vehicle& v, int nowMin) {
        lock_guard<mutex> g(mu);  // find + assign must be one atomic step
        ParkingSpot* spot = allocation->find(floors, spotFor(v.type));
        if (!spot) return nullptr;
        auto t = make_unique<Ticket>(Ticket{"T" + to_string(++seq), v, spot, nowMin});
        spot->assign(&t->vehicle);
        Ticket* raw = t.get();
        active[raw->id] = std::move(t);
        notify();
        return raw;
    }

    int unpark(const string& ticketId, int nowMin, PaymentMethod& pm) {
        lock_guard<mutex> g(mu);
        auto it = active.find(ticketId);
        if (it == active.end()) throw runtime_error("Unknown or closed ticket " + ticketId);
        Ticket& t = *it->second;
        int fee = pricing->fee(t, nowMin);
        // Payment is instant here. With a real gateway, take payment
        // outside the lock and only free the spot under it.
        if (!pm.pay(t.id, fee)) throw runtime_error("Payment failed");
        t.exitMin = nowMin;
        t.fee = fee;
        t.status = TicketStatus::PAID;
        t.spot->release();
        history.push_back(std::move(it->second));  // keep closed tickets for reports
        active.erase(it);
        notify();
        return fee;
    }

private:
    void notify() { for (auto* o : observers) o->onChange(floors); }

    mutex mu;
    Floors floors;
    unique_ptr<SpotAllocationStrategy> allocation;
    unique_ptr<PricingStrategy> pricing;
    unordered_map<string, unique_ptr<Ticket>> active;
    vector<unique_ptr<Ticket>> history;
    vector<AvailabilityObserver*> observers;
    int seq = 0;
};

int main() {
    Floors floors;
    floors.push_back(ParkingFloor::create(0, 2, 2, 1));
    floors.push_back(ParkingFloor::create(1, 1, 2, 1));
    ParkingLot lot(std::move(floors), make_unique<NearestFirstStrategy>(), make_unique<HourlyPricing>());
    DisplayBoard board;
    lot.addObserver(&board);

    vector<pair<Vehicle, int>> arrivals = {
        {{"KA-01-AB-1111", VehicleType::BIKE}, 0},  {{"KA-05-MN-2222", VehicleType::CAR}, 0},
        {{"MH-12-XY-3333", VehicleType::CAR}, 10},  {{"KA-51-TR-4444", VehicleType::TRUCK}, 30},
        {{"TN-09-TR-5555", VehicleType::TRUCK}, 35}, {{"DL-01-TR-6666", VehicleType::TRUCK}, 40},
    };
    vector<string> tickets;
    for (auto& [v, minute] : arrivals) {
        Ticket* t = lot.park(v, minute);
        if (!t) {
            cout << "No " << name(spotFor(v.type)) << " spot free for " << v.plate << "\n";
            continue;
        }
        cout << "Parked " << v.plate << " at " << t->spot->id << ", ticket " << t->id << "\n";
        tickets.push_back(t->id);
    }

    UpiPayment upi("rahul@okaxis");
    CashPayment cash;
    CardPayment card;
    cout << "Car exits after 150 min (hourly pricing):\n";
    lot.unpark(tickets[1], 150, upi);
    cout << "Bike exits after 45 min (hourly pricing):\n";
    lot.unpark(tickets[0], 45, cash);
    lot.setPricing(make_unique<FlatPricing>());  // e.g. a weekend flat rate, swapped at runtime
    cout << "Truck exits (flat pricing):\n";
    lot.unpark(tickets[3], 400, card);
    return 0;
}`,
      javascript: String.raw`// Parking lot: a single-file machine-coding solution. Run: node parking_lot.js
"use strict";

const VehicleType = Object.freeze({ BIKE: "BIKE", CAR: "CAR", TRUCK: "TRUCK" });
const SpotType = Object.freeze({ SMALL: "SMALL", MEDIUM: "MEDIUM", LARGE: "LARGE" });
const TicketStatus = Object.freeze({ ACTIVE: "ACTIVE", PAID: "PAID" });

// Which spot each vehicle needs. One place to change the rule.
const SPOT_FOR = { BIKE: SpotType.SMALL, CAR: SpotType.MEDIUM, TRUCK: SpotType.LARGE };

class Vehicle {
  constructor(plate, type) {
    this.plate = plate;
    this.type = type;
  }
}

class ParkingSpot {
  constructor(id, type, floor) {
    this.id = id;
    this.type = type;
    this.floor = floor;
    this.vehicle = null; // null means free
  }
  isFree() { return this.vehicle === null; }
  assign(v) { this.vehicle = v; }
  release() { this.vehicle = null; }
}

class ParkingFloor {
  constructor(number) {
    this.number = number;
    this.spots = [];
  }
  // Factory: builds a floor and names its spots F<floor>-<n>.
  static create(number, small, medium, large) {
    const f = new ParkingFloor(number);
    const plan = [[SpotType.SMALL, small], [SpotType.MEDIUM, medium], [SpotType.LARGE, large]];
    for (const [type, count] of plan) {
      for (let i = 0; i < count; i++) {
        f.spots.push(new ParkingSpot(\`F\${number}-\${f.spots.length + 1}\`, type, number));
      }
    }
    return f;
  }
  freeCount(type) {
    return this.spots.filter((s) => s.type === type && s.isFree()).length;
  }
}

class Ticket {
  constructor(id, vehicle, spot, entryMin) {
    Object.assign(this, { id, vehicle, spot, entryMin });
    this.exitMin = -1;
    this.fee = 0;
    this.status = TicketStatus.ACTIVE;
  }
}

// ---------- Strategy: pricing (JS has no interfaces; any object with fee() works) ----------
class HourlyPricing {
  static RATE = { BIKE: 20, CAR: 40, TRUCK: 100 }; // Rs per hour
  fee(ticket, exitMin) {
    const minutes = Math.max(1, exitMin - ticket.entryMin);
    const hours = Math.ceil(minutes / 60); // round up: 61 minutes = 2 hours
    return hours * HourlyPricing.RATE[ticket.vehicle.type];
  }
}

class FlatPricing {
  static FLAT = { BIKE: 50, CAR: 100, TRUCK: 300 }; // Rs per visit
  fee(ticket) {
    return FlatPricing.FLAT[ticket.vehicle.type];
  }
}

// ---------- Strategy: spot allocation ----------
class NearestFirstStrategy {
  // Lowest floor first, then lowest spot number.
  find(floors, type) {
    for (const f of floors) {
      for (const s of f.spots) if (s.type === type && s.isFree()) return s;
    }
    return null;
  }
}

// ---------- Payment ----------
class CashPayment {
  pay(ticketId, amount) { console.log(\`  Paid Rs.\${amount} in cash for \${ticketId}\`); return true; }
}
class CardPayment {
  pay(ticketId, amount) { console.log(\`  Paid Rs.\${amount} by card for \${ticketId}\`); return true; }
}
class UpiPayment {
  constructor(upiId) { this.upiId = upiId; }
  pay(ticketId, amount) { console.log(\`  Paid Rs.\${amount} via UPI (\${this.upiId}) for \${ticketId}\`); return true; }
}

// ---------- Observer: display boards ----------
class DisplayBoard {
  onChange(floors) {
    const parts = floors.map((f) =>
      \`F\${f.number} \` + Object.values(SpotType).map((t) => \`\${t}:\${f.freeCount(t)}\`).join(" "));
    console.log("  [Board] " + parts.join(" | "));
  }
}

// ---------- The lot ----------
// Thread safety: Node runs our JS on ONE thread. park() has no "await" between
// "find a free spot" and "mark it taken", so no other request can run in between.
// No lock is needed. If you add an await in the middle (say, a DB call), you
// reopen the race and need a per-lot async mutex or a DB-level atomic update.
class ParkingLot {
  constructor(floors, allocation, pricing) {
    this.floors = floors;
    this.allocation = allocation;
    this.pricing = pricing;
    this.active = new Map();
    this.observers = [];
    this.seq = 0;
  }
  addObserver(o) { this.observers.push(o); }
  setPricing(p) { this.pricing = p; }
  notify() { for (const o of this.observers) o.onChange(this.floors); }

  park(vehicle, nowMin) {
    const spot = this.allocation.find(this.floors, SPOT_FOR[vehicle.type]);
    if (!spot) return null;
    spot.assign(vehicle);
    const ticket = new Ticket(\`T\${++this.seq}\`, vehicle, spot, nowMin);
    this.active.set(ticket.id, ticket);
    this.notify();
    return ticket;
  }

  unpark(ticketId, nowMin, payment) {
    const ticket = this.active.get(ticketId);
    if (!ticket) throw new Error(\`Unknown or closed ticket \${ticketId}\`);
    const fee = this.pricing.fee(ticket, nowMin);
    if (!payment.pay(ticket.id, fee)) throw new Error("Payment failed");
    Object.assign(ticket, { exitMin: nowMin, fee, status: TicketStatus.PAID });
    ticket.spot.release();
    this.active.delete(ticketId);
    this.notify();
    return fee;
  }
}

function main() {
  const lot = new ParkingLot([ParkingFloor.create(0, 2, 2, 1), ParkingFloor.create(1, 1, 2, 1)],
    new NearestFirstStrategy(), new HourlyPricing());
  lot.addObserver(new DisplayBoard());

  const arrivals = [
    [new Vehicle("KA-01-AB-1111", VehicleType.BIKE), 0],
    [new Vehicle("KA-05-MN-2222", VehicleType.CAR), 0],
    [new Vehicle("MH-12-XY-3333", VehicleType.CAR), 10],
    [new Vehicle("KA-51-TR-4444", VehicleType.TRUCK), 30],
    [new Vehicle("TN-09-TR-5555", VehicleType.TRUCK), 35],
    [new Vehicle("DL-01-TR-6666", VehicleType.TRUCK), 40],
  ];
  const tickets = [];
  for (const [v, t] of arrivals) {
    const ticket = lot.park(v, t);
    if (!ticket) {
      console.log(\`No \${SPOT_FOR[v.type]} spot free for \${v.plate}\`);
      continue;
    }
    console.log(\`Parked \${v.plate} at \${ticket.spot.id}, ticket \${ticket.id}\`);
    tickets.push(ticket);
  }

  console.log("Car exits after 150 min (hourly pricing):");
  lot.unpark(tickets[1].id, 150, new UpiPayment("rahul@okaxis"));
  console.log("Bike exits after 45 min (hourly pricing):");
  lot.unpark(tickets[0].id, 45, new CashPayment());
  lot.setPricing(new FlatPricing()); // e.g. a weekend flat rate, swapped at runtime
  console.log("Truck exits (flat pricing):");
  lot.unpark(tickets[3].id, 400, new CardPayment());
}

main();`,
      go: String.raw`// Parking lot: a single-file machine-coding solution. Run: go run main.go
package main

import (
	"errors"
	"fmt"
	"strings"
	"sync"
)

type VehicleType int
type SpotType int
type TicketStatus int

const (
	Bike VehicleType = iota
	Car
	Truck
)

const (
	Small SpotType = iota
	Medium
	Large
)

const (
	Active TicketStatus = iota
	Paid
)

var spotTypes = []SpotType{Small, Medium, Large}

func (s SpotType) String() string { return [...]string{"SMALL", "MEDIUM", "LARGE"}[s] }

// Which spot each vehicle needs. One place to change the rule.
var spotFor = map[VehicleType]SpotType{Bike: Small, Car: Medium, Truck: Large}

type Vehicle struct {
	Plate string
	Type  VehicleType
}

type ParkingSpot struct {
	ID      string
	Type    SpotType
	Floor   int
	vehicle *Vehicle // nil means free
}

func (s *ParkingSpot) IsFree() bool      { return s.vehicle == nil }
func (s *ParkingSpot) Assign(v *Vehicle) { s.vehicle = v }
func (s *ParkingSpot) Release()          { s.vehicle = nil }

type ParkingFloor struct {
	Number int
	Spots  []*ParkingSpot
}

// NewFloor is a factory: it builds a floor and names its spots F<floor>-<n>.
func NewFloor(number, small, medium, large int) *ParkingFloor {
	f := &ParkingFloor{Number: number}
	counts := map[SpotType]int{Small: small, Medium: medium, Large: large}
	for _, t := range spotTypes {
		for i := 0; i < counts[t]; i++ {
			id := fmt.Sprintf("F%d-%d", number, len(f.Spots)+1)
			f.Spots = append(f.Spots, &ParkingSpot{ID: id, Type: t, Floor: number})
		}
	}
	return f
}

func (f *ParkingFloor) FreeCount(t SpotType) int {
	n := 0
	for _, s := range f.Spots {
		if s.Type == t && s.IsFree() {
			n++
		}
	}
	return n
}

type Ticket struct {
	ID       string
	Vehicle  *Vehicle
	Spot     *ParkingSpot
	EntryMin int
	ExitMin  int
	Fee      int
	Status   TicketStatus
}

// ---------- Strategy: pricing ----------
type PricingStrategy interface {
	Fee(t *Ticket, exitMin int) int
}

type HourlyPricing struct{}

var hourlyRate = map[VehicleType]int{Bike: 20, Car: 40, Truck: 100} // Rs per hour

func (HourlyPricing) Fee(t *Ticket, exitMin int) int {
	minutes := exitMin - t.EntryMin
	if minutes < 1 {
		minutes = 1
	}
	hours := (minutes + 59) / 60 // round up: 61 minutes = 2 hours
	return hours * hourlyRate[t.Vehicle.Type]
}

type FlatPricing struct{}

var flatRate = map[VehicleType]int{Bike: 50, Car: 100, Truck: 300} // Rs per visit

func (FlatPricing) Fee(t *Ticket, exitMin int) int { return flatRate[t.Vehicle.Type] }

// ---------- Strategy: spot allocation ----------
type SpotAllocationStrategy interface {
	Find(floors []*ParkingFloor, t SpotType) *ParkingSpot
}

// NearestFirst: lowest floor first, then lowest spot number.
type NearestFirst struct{}

func (NearestFirst) Find(floors []*ParkingFloor, t SpotType) *ParkingSpot {
	for _, f := range floors {
		for _, s := range f.Spots {
			if s.Type == t && s.IsFree() {
				return s
			}
		}
	}
	return nil
}

// ---------- Payment ----------
type PaymentMethod interface {
	Pay(ticketID string, amount int) bool
}

type CashPayment struct{}
type CardPayment struct{}
type UpiPayment struct{ UpiID string }

func (CashPayment) Pay(id string, amt int) bool {
	fmt.Printf("  Paid Rs.%d in cash for %s\n", amt, id)
	return true
}
func (CardPayment) Pay(id string, amt int) bool {
	fmt.Printf("  Paid Rs.%d by card for %s\n", amt, id)
	return true
}
func (u UpiPayment) Pay(id string, amt int) bool {
	fmt.Printf("  Paid Rs.%d via UPI (%s) for %s\n", amt, u.UpiID, id)
	return true
}

// ---------- Observer: display boards ----------
type AvailabilityObserver interface {
	OnChange(floors []*ParkingFloor)
}

type DisplayBoard struct{}

func (DisplayBoard) OnChange(floors []*ParkingFloor) {
	parts := []string{}
	for _, f := range floors {
		counts := []string{}
		for _, t := range spotTypes {
			counts = append(counts, fmt.Sprintf("%s:%d", t, f.FreeCount(t)))
		}
		parts = append(parts, fmt.Sprintf("F%d %s", f.Number, strings.Join(counts, " ")))
	}
	fmt.Println("  [Board] " + strings.Join(parts, " | "))
}

// ---------- The lot ----------
type ParkingLot struct {
	mu         sync.Mutex // guards "find a free spot + mark it taken"
	floors     []*ParkingFloor
	allocation SpotAllocationStrategy
	pricing    PricingStrategy
	active     map[string]*Ticket
	observers  []AvailabilityObserver
	seq        int
}

func NewParkingLot(floors []*ParkingFloor, a SpotAllocationStrategy, p PricingStrategy) *ParkingLot {
	return &ParkingLot{floors: floors, allocation: a, pricing: p, active: map[string]*Ticket{}}
}

func (l *ParkingLot) AddObserver(o AvailabilityObserver) { l.observers = append(l.observers, o) }

func (l *ParkingLot) SetPricing(p PricingStrategy) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.pricing = p
}

func (l *ParkingLot) notify() {
	for _, o := range l.observers {
		o.OnChange(l.floors)
	}
}

// Park returns nil when no matching spot is free.
func (l *ParkingLot) Park(v *Vehicle, nowMin int) *Ticket {
	l.mu.Lock()
	defer l.mu.Unlock()
	spot := l.allocation.Find(l.floors, spotFor[v.Type])
	if spot == nil {
		return nil
	}
	spot.Assign(v)
	l.seq++
	t := &Ticket{ID: fmt.Sprintf("T%d", l.seq), Vehicle: v, Spot: spot, EntryMin: nowMin, ExitMin: -1}
	l.active[t.ID] = t
	l.notify()
	return t
}

func (l *ParkingLot) Unpark(ticketID string, nowMin int, pm PaymentMethod) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	t, ok := l.active[ticketID]
	if !ok {
		return 0, errors.New("unknown or closed ticket " + ticketID)
	}
	fee := l.pricing.Fee(t, nowMin)
	// Payment is instant here. With a real gateway, take payment
	// outside the lock and only free the spot under it.
	if !pm.Pay(t.ID, fee) {
		return 0, errors.New("payment failed")
	}
	t.ExitMin, t.Fee, t.Status = nowMin, fee, Paid
	t.Spot.Release()
	delete(l.active, ticketID)
	l.notify()
	return fee, nil
}

func main() {
	lot := NewParkingLot([]*ParkingFloor{NewFloor(0, 2, 2, 1), NewFloor(1, 1, 2, 1)},
		NearestFirst{}, HourlyPricing{})
	lot.AddObserver(DisplayBoard{})

	arrivals := []struct {
		v   *Vehicle
		min int
	}{
		{&Vehicle{"KA-01-AB-1111", Bike}, 0},
		{&Vehicle{"KA-05-MN-2222", Car}, 0},
		{&Vehicle{"MH-12-XY-3333", Car}, 10},
		{&Vehicle{"KA-51-TR-4444", Truck}, 30},
		{&Vehicle{"TN-09-TR-5555", Truck}, 35},
		{&Vehicle{"DL-01-TR-6666", Truck}, 40},
	}
	var tickets []*Ticket
	for _, a := range arrivals {
		t := lot.Park(a.v, a.min)
		if t == nil {
			fmt.Printf("No %s spot free for %s\n", spotFor[a.v.Type], a.v.Plate)
			continue
		}
		fmt.Printf("Parked %s at %s, ticket %s\n", a.v.Plate, t.Spot.ID, t.ID)
		tickets = append(tickets, t)
	}

	fmt.Println("Car exits after 150 min (hourly pricing):")
	lot.Unpark(tickets[1].ID, 150, UpiPayment{"rahul@okaxis"})
	fmt.Println("Bike exits after 45 min (hourly pricing):")
	lot.Unpark(tickets[0].ID, 45, CashPayment{})
	lot.SetPricing(FlatPricing{}) // e.g. a weekend flat rate, swapped at runtime
	fmt.Println("Truck exits (flat pricing):")
	lot.Unpark(tickets[3].ID, 400, CardPayment{})
}`,
    },
    concurrent: {
      title: "Lock-free spot claiming with compare-and-set",
      java: String.raw`// Two gates, one spot: claim a spot atomically.
// Run: javac ConcurrentAllocation.java && java ConcurrentAllocation
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public class ConcurrentAllocation {

    static class ParkingSpot {
        final String id;
        private final AtomicReference<String> plate = new AtomicReference<>(null); // null = free
        ParkingSpot(String id) { this.id = id; }

        // Atomic "if free, take it". Only one thread can win the compare-and-set.
        boolean tryOccupy(String p) { return plate.compareAndSet(null, p); }
        void release() { plate.set(null); }
        String occupant() { return plate.get(); }
    }

    static class SpotAllocator {
        private final List<ParkingSpot> spots;
        SpotAllocator(List<ParkingSpot> spots) { this.spots = spots; }

        // No global lock: scan, try to claim, move on if another gate won.
        ParkingSpot allocate(String plate) {
            for (ParkingSpot s : spots)
                if (s.occupant() == null && s.tryOccupy(plate)) return s;
            return null;
        }
    }

    public static void main(String[] args) throws Exception {
        List<ParkingSpot> spots = new ArrayList<>();
        for (int i = 1; i <= 5; i++) spots.add(new ParkingSpot("S" + i));
        SpotAllocator allocator = new SpotAllocator(spots);

        ExecutorService gates = Executors.newFixedThreadPool(8);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger parked = new AtomicInteger(), away = new AtomicInteger();
        List<Future<Object>> results = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            String plate = "CAR-" + i;
            results.add(gates.submit(() -> {
                start.await(); // release all gates at the same moment
                if (allocator.allocate(plate) != null) parked.incrementAndGet();
                else away.incrementAndGet();
                return null;
            }));
        }
        start.countDown();
        for (Future<Object> f : results) f.get();
        gates.shutdown();

        Set<String> distinct = new HashSet<>();
        for (ParkingSpot s : spots) distinct.add(s.occupant());
        System.out.println("Parked: " + parked.get() + ", turned away: " + away.get());
        System.out.println("Distinct cars in spots: " + distinct.size() + " (must equal 5)");
    }
}`,
      python: String.raw`"""Two gates, one spot: claim a spot atomically. Run: python3 alloc.py"""
import threading
from concurrent.futures import ThreadPoolExecutor


class ParkingSpot:
    def __init__(self, spot_id: str):
        self.id = spot_id
        self.plate = None
        self._lock = threading.Lock()  # one small lock per spot

    def try_occupy(self, plate: str) -> bool:
        # "if free, take it" must be ONE step. The GIL does not make
        # check-then-act atomic: a thread can be switched out between them.
        with self._lock:
            if self.plate is not None:
                return False
            self.plate = plate
            return True

    def release(self) -> None:
        with self._lock:
            self.plate = None


class SpotAllocator:
    def __init__(self, spots):
        self.spots = spots

    def allocate(self, plate: str):
        # No global lock: scan, try to claim; if another gate won, move on.
        for s in self.spots:
            if s.plate is None and s.try_occupy(plate):
                return s
        return None


def main() -> None:
    spots = [ParkingSpot(f"S{i}") for i in range(1, 6)]
    allocator = SpotAllocator(spots)
    start = threading.Event()
    counts = {"parked": 0, "away": 0}
    counts_lock = threading.Lock()

    def gate(plate: str) -> None:
        start.wait()  # release all gates at the same moment
        won = allocator.allocate(plate) is not None
        with counts_lock:
            counts["parked" if won else "away"] += 1

    with ThreadPoolExecutor(max_workers=8) as pool:
        for i in range(20):
            pool.submit(gate, f"CAR-{i}")
        start.set()

    distinct = {s.plate for s in spots}
    print(f"Parked: {counts['parked']}, turned away: {counts['away']}")
    print(f"Distinct cars in spots: {len(distinct)} (must equal 5)")


if __name__ == "__main__":
    main()`,
      cpp: String.raw`// Two gates, one spot: claim a spot atomically.
// Build: g++ -std=c++17 -pthread alloc.cpp -o alloc && ./alloc
#include <atomic>
#include <iostream>
#include <memory>
#include <set>
#include <string>
#include <thread>
#include <vector>
using namespace std;

class ParkingSpot {
public:
    explicit ParkingSpot(string id) : id(std::move(id)) {}
    // Atomic "if free, take it". Only one thread can win the compare-exchange.
    bool tryOccupy(int carId) {
        int expected = 0;  // 0 = free
        return car.compare_exchange_strong(expected, carId);
    }
    void release() { car.store(0); }
    int occupant() const { return car.load(); }
    const string id;
private:
    atomic<int> car{0};
};

class SpotAllocator {
public:
    explicit SpotAllocator(vector<unique_ptr<ParkingSpot>>& spots) : spots(spots) {}
    // No global lock: scan, try to claim, move on if another gate won.
    ParkingSpot* allocate(int carId) {
        for (auto& s : spots)
            if (s->occupant() == 0 && s->tryOccupy(carId)) return s.get();
        return nullptr;
    }
private:
    vector<unique_ptr<ParkingSpot>>& spots;
};

int main() {
    vector<unique_ptr<ParkingSpot>> spots;
    for (int i = 1; i <= 5; i++) spots.push_back(make_unique<ParkingSpot>("S" + to_string(i)));
    SpotAllocator allocator(spots);

    atomic<bool> go{false};
    atomic<int> parked{0}, away{0};
    vector<thread> gates;
    for (int car = 1; car <= 20; car++) {
        gates.emplace_back([&, car] {
            while (!go.load()) this_thread::yield();  // release all gates together
            if (allocator.allocate(car)) parked++; else away++;
        });
    }
    go = true;
    for (auto& t : gates) t.join();

    set<int> distinct;
    for (auto& s : spots) distinct.insert(s->occupant());
    cout << "Parked: " << parked << ", turned away: " << away << "\n";
    cout << "Distinct cars in spots: " << distinct.size() << " (must equal 5)\n";
}`,
      javascript: String.raw`// Two gates, one spot. Run: node alloc.js
// Node runs JS on one thread, so two lines of sync code never interleave.
// The race in JS happens across an "await": while one request waits on
// a DB or camera call, another request runs and sees the same free spot.
"use strict";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class ParkingSpot {
  constructor(id) { this.id = id; this.plate = null; }
  // Atomic because there is no await inside: "if free, take it" in one go.
  tryOccupy(plate) {
    if (this.plate !== null) return false;
    this.plate = plate;
    return true;
  }
  release() { this.plate = null; }
}

// BROKEN: check, then await, then take. Every request sees the same free spot.
async function parkUnsafe(spots, plate) {
  const spot = spots.find((s) => s.plate === null);
  if (!spot) return null;
  await sleep(1); // e.g. reading the number-plate camera
  spot.plate = plate; // overwrites whoever got here first
  return spot;
}

// FIXED: claim first (no await between check and take), slow work after.
async function parkSafe(spots, plate) {
  const spot = spots.find((s) => s.plate === null && s.tryOccupy(plate));
  if (!spot) return null;
  await sleep(1); // slow work after the claim is fine
  return spot;
}

async function run(label, parkFn) {
  const spots = [1, 2, 3, 4, 5].map((i) => new ParkingSpot(\`S\${i}\`));
  const plates = Array.from({ length: 20 }, (_, i) => \`CAR-\${i}\`);
  const results = await Promise.all(plates.map((p) => parkFn(spots, p)));
  const parked = results.filter(Boolean).length;
  const distinct = new Set(spots.map((s) => s.plate).filter(Boolean)).size;
  console.log(\`\${label} Parked: \${parked}, turned away: \${20 - parked}\`);
  console.log(\`\${label} Distinct cars in spots: \${distinct} (must equal 5)\`);
}

(async () => {
  await run("[unsafe]", parkUnsafe);
  await run("[safe]  ", parkSafe);
})();`,
      go: String.raw`// Two gates, one spot: claim a spot atomically. Run: go run alloc.go
package main

import (
	"fmt"
	"sync"
	"sync/atomic"
)

type ParkingSpot struct {
	ID  string
	car atomic.Int64 // 0 = free, otherwise the car's id
}

// TryOccupy is an atomic "if free, take it". Only one goroutine can win.
func (s *ParkingSpot) TryOccupy(carID int64) bool { return s.car.CompareAndSwap(0, carID) }
func (s *ParkingSpot) Release()                   { s.car.Store(0) }

type SpotAllocator struct{ spots []*ParkingSpot }

// Allocate takes no global lock: scan, try to claim, move on if another gate won.
func (a *SpotAllocator) Allocate(carID int64) *ParkingSpot {
	for _, s := range a.spots {
		if s.car.Load() == 0 && s.TryOccupy(carID) {
			return s
		}
	}
	return nil
}

func main() {
	var spots []*ParkingSpot
	for i := 1; i <= 5; i++ {
		spots = append(spots, &ParkingSpot{ID: fmt.Sprintf("S%d", i)})
	}
	alloc := &SpotAllocator{spots: spots}

	var parked, away atomic.Int32
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := 1; i <= 20; i++ {
		wg.Add(1)
		go func(carID int64) {
			defer wg.Done()
			<-start // release all gates at the same moment
			if alloc.Allocate(carID) != nil {
				parked.Add(1)
			} else {
				away.Add(1)
			}
		}(int64(i))
	}
	close(start)
	wg.Wait()

	distinct := map[int64]bool{}
	for _, s := range spots {
		distinct[s.car.Load()] = true
	}
	fmt.Printf("Parked: %d, turned away: %d\n", parked.Load(), away.Load())
	fmt.Printf("Distinct cars in spots: %d (must equal 5)\n", len(distinct))
}`,
    },
  },
  diagrams: {
    classes: String.raw`classDiagram
  class ParkingLot {
    -floors List~ParkingFloor~
    -activeTickets Map
    -allocation SpotAllocationStrategy
    -pricing PricingStrategy
    -observers List~AvailabilityObserver~
    +park(vehicle, now) Ticket
    +unpark(ticketId, now, payment) int
    +setPricing(p)
    +addObserver(o)
  }
  class ParkingFloor {
    +number int
    +spots List~ParkingSpot~
    +create(n, small, medium, large) ParkingFloor$
    +freeCount(type) int
  }
  class ParkingSpot {
    +id String
    +type SpotType
    -vehicle Vehicle
    +isFree() bool
    +assign(v)
    +release()
  }
  class Vehicle {
    +plate String
    +type VehicleType
  }
  class Ticket {
    +id String
    +entryMin int
    +exitMin int
    +fee int
    +status TicketStatus
  }
  class PricingStrategy {
    <<interface>>
    +fee(ticket, exitMin) int
  }
  class SpotAllocationStrategy {
    <<interface>>
    +find(floors, type) ParkingSpot
  }
  class PaymentMethod {
    <<interface>>
    +pay(ticketId, amount) bool
  }
  class AvailabilityObserver {
    <<interface>>
    +onChange(floors)
  }
  ParkingLot "1" *-- "many" ParkingFloor
  ParkingFloor "1" *-- "many" ParkingSpot
  ParkingLot "1" --> "many" Ticket
  Ticket --> Vehicle
  Ticket --> ParkingSpot
  ParkingLot o-- PricingStrategy
  ParkingLot o-- SpotAllocationStrategy
  ParkingLot o-- AvailabilityObserver
  ParkingLot ..> PaymentMethod : uses
  PricingStrategy <|.. HourlyPricing
  PricingStrategy <|.. FlatPricing
  SpotAllocationStrategy <|.. NearestFirstStrategy
  PaymentMethod <|.. CashPayment
  PaymentMethod <|.. CardPayment
  PaymentMethod <|.. UpiPayment
  AvailabilityObserver <|.. DisplayBoard`,
    parkFlow: String.raw`sequenceDiagram
  actor Driver
  participant Gate as Entry gate
  participant Lot as ParkingLot
  participant Alloc as AllocationStrategy
  participant Board as DisplayBoard
  Driver->>Gate: arrives (plate, type)
  Gate->>Lot: park(vehicle, now)
  Note over Lot: acquire lock
  Lot->>Alloc: find(floors, MEDIUM)
  alt no free spot
    Alloc-->>Lot: none
    Lot-->>Gate: no ticket
    Gate-->>Driver: show LOT FULL
  else spot found
    Alloc-->>Lot: spot F0-3
    Lot->>Lot: spot.assign(vehicle)
    Lot->>Lot: create ticket T2
    Lot->>Board: onChange(floors)
    Lot-->>Gate: ticket T2
    Gate-->>Driver: print ticket, open barrier
  end
  Note over Lot: release lock`,
    exitFlow: String.raw`sequenceDiagram
  actor Driver
  participant Gate as Exit gate
  participant Lot as ParkingLot
  participant Price as PricingStrategy
  participant Pay as PaymentMethod
  participant Board as DisplayBoard
  Driver->>Gate: scan ticket T2
  Gate->>Lot: unpark(T2, now, UPI)
  Lot->>Price: fee(ticket, now)
  Price-->>Lot: Rs 120
  Lot->>Pay: pay(T2, 120)
  alt payment fails
    Pay-->>Lot: false
    Lot-->>Gate: error, spot stays taken
  else payment ok
    Pay-->>Lot: true
    Lot->>Lot: ticket PAID, spot.release()
    Lot->>Board: onChange(floors)
    Lot-->>Gate: fee charged
    Gate-->>Driver: open barrier
  end`,
    spotState: String.raw`stateDiagram-v2
  [*] --> Free
  Free --> Occupied: park
  Occupied --> Free: unpark after payment
  Free --> Reserved: reservation
  Reserved --> Occupied: booked car arrives
  Reserved --> Free: no-show timeout
  Free --> OutOfService: maintenance
  OutOfService --> Free: fixed`,
    ticketState: String.raw`stateDiagram-v2
  [*] --> Active: issued at entry
  Active --> PaymentPending: exit scan
  PaymentPending --> Paid: payment ok
  PaymentPending --> Active: payment failed
  Active --> Lost: ticket lost
  Lost --> Paid: penalty paid
  Paid --> [*]: vehicle leaves`,
  },
});
