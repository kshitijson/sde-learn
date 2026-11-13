SD.register({
  id: "vending-machine",
  html: String.raw`
<p class="lead">"Design a vending machine" is the classic test of the State pattern. It is a common 60 to 90 minute machine-coding round at Amazon, Flipkart, Uber and many Indian startups. The domain is tiny, but the same button means different things at different times: pressing "A1" before inserting money, after inserting too little, and while the machine is dropping a can are three different situations. Candidates who answer with a pile of <code>if</code> flags get tangled. Candidates who model states as classes finish on time. This page builds the full answer, including the part most people skip: returning change when the machine is running low on coins.</p>

<h2>Problem statement</h2>
<p>Design the software for a snack and drinks vending machine, like the ones in office pantries and metro stations. Each slot (A1, A2, B1...) holds one product with a price. A customer inserts Indian coins and notes, picks a slot, and gets the product plus change. They can cancel at any time before the product drops and get their money back. An operator restocks products, loads coins for change, collects cash, and can take the machine out of service for maintenance.</p>

<div class="callout tip"><strong>Try it first</strong>Before reading on, take 10 minutes. List every state the machine can be in, and every action a user or operator can take. Draw a grid with states as rows and actions as columns. What should happen in each cell? Then think about this: the machine holds one Rs50 coin and three Rs20 coins, and owes a customer Rs60 in change. What does a "biggest coin first" approach do?</div>

<details class="hint"><summary>Hint 1: The behaviour depends on the state</summary>
<p>"Select A1" in <em>Idle</em> means "insert money first". In <em>HasMoney</em> it means "try to sell". In <em>Dispensing</em> it means "busy, wait". In <em>OutOfService</em> it means "sorry". When one method's behaviour depends on a mode, and every method has the same problem, that is the signal for the State pattern: one class per state, each implementing all the actions.</p>
</details>
<details class="hint"><summary>Hint 2: Keep the customer's money separate</summary>
<p>Hold inserted coins in an <em>escrow</em> (a holding area) until the sale completes. On cancel you return the exact coins the customer put in. On success you move them into the machine's cash box. Never mix them early, or a refund might hand back 100 one-rupee coins for a Rs100 note.</p>
</details>
<details class="hint"><summary>Hint 3: Change is a coin-change problem with limited stock</summary>
<p>With unlimited coins, Indian denominations work fine with greedy (largest coin first). But the machine has a <em>limited</em> number of each coin, and greedy can then fail even when an answer exists. A small dynamic-programming routine over the coins actually in the box always finds an answer if one exists. Check that change is possible <em>before</em> dropping the product.</p>
</details>

<h2>Requirements</h2>
<p>Good clarifying questions: Money first or product first? Which coins and notes are accepted? One item per transaction or a cart? Is card or UPI needed now, or later? What should happen when the machine cannot make change?</p>
<div class="grid-2">
<div class="card">
<h3>Functional</h3>
<ul>
<li>Show products by slot code with price and availability.</li>
<li>Accept INR: Rs1, Rs2, Rs5, Rs10, Rs20 coins or notes, and Rs50, Rs100 notes. Reject anything else.</li>
<li>Select a product: dispense it and return change when the balance is enough.</li>
<li><strong>Insufficient funds:</strong> say how much more is needed and keep the balance.</li>
<li><strong>Out of stock:</strong> say so and let the customer pick another item or cancel.</li>
<li><strong>Cancel / refund:</strong> return exactly the coins and notes inserted.</li>
<li><strong>Exact change only:</strong> if change cannot be made, refuse the sale before dispensing and ask for the exact amount.</li>
<li><strong>Admin:</strong> restock slots, load coins for change, collect cash, take the machine in and out of service.</li>
</ul>
</div>
<div class="card">
<h3>Non-functional</h3>
<ul>
<li><strong>Never lose money:</strong> every rupee is either refunded, kept as payment, or returned as change.</li>
<li><strong>Never dispense without payment</strong> and never take payment without dispensing.</li>
<li><strong>Extensible:</strong> card and UPI payments, new states (like a jammed slot), new change policies without rewriting the core.</li>
<li><strong>Thread-safe enough:</strong> coin acceptor, keypad, admin panel and UPI callbacks may fire events at the same time.</li>
<li><strong>Small scale:</strong> one machine, about 30 slots, a few hundred sales a day. In-memory state is fine for the round.</li>
</ul>
</div>
</div>

<h2>How to approach the machine-coding round</h2>
<div class="callout info"><strong>Time plan for a 60 to 90 minute round</strong>
<table>
<thead><tr><th>Minutes</th><th>What you do</th></tr></thead>
<tbody>
<tr><td>0 to 8</td><td>Clarify: money first or product first, accepted denominations, refund rules, payment methods. Write down what you will skip.</td></tr>
<tr><td>8 to 18</td><td>Draw the state diagram and the state-by-action grid. List entities. This grid <em>is</em> your design.</td></tr>
<tr><td>18 to 55</td><td>Code models (<code>Denomination</code>, <code>CoinBag</code>, <code>Product</code>, <code>Inventory</code>), then the <code>State</code> interface and four states, then the machine, then change-making.</td></tr>
<tr><td>55 to 70</td><td>Write a demo <code>main</code> that runs every scenario: success, short of money, sold out, cancel, no change.</td></tr>
<tr><td>70 to 90</td><td>Walk through it. Show where card or UPI plugs in and how a new state is added.</td></tr>
</tbody>
</table>
<p>In a 60-minute round, start with greedy change and say "greedy can fail with limited coins; I will switch to DP if time allows". A working machine beats a perfect change algorithm in a broken machine.</p>
<p><strong>What evaluators check:</strong></p>
<ol>
<li><strong>State modelling:</strong> states are classes, not boolean flags. Invalid actions in each state are handled, not ignored.</li>
<li><strong>Money correctness:</strong> integer rupees, exact refunds, change checked before dispensing.</li>
<li><strong>Separation:</strong> inventory, cash handling and change-making are separate classes. The machine coordinates.</li>
<li><strong>Edge cases in the demo:</strong> not just the happy path.</li>
<li><strong>Extensibility story:</strong> a new payment method or state without editing every class.</li>
</ol>
</div>

<h2>Core entities</h2>
<table>
<thead><tr><th>Entity</th><th>Kind</th><th>Responsibility</th></tr></thead>
<tbody>
<tr><td><code>Denomination</code></td><td>Enum</td><td>Accepted coins and notes with their rupee value, highest first.</td></tr>
<tr><td><code>CoinBag</code></td><td>Value class</td><td>Count per denomination. Used three ways: the machine's cash box, the customer's escrow, and a set of change coins.</td></tr>
<tr><td><code>Product</code></td><td>Value object</td><td>Name and price in whole rupees.</td></tr>
<tr><td><code>Slot</code>, <code>Inventory</code></td><td>Entities</td><td>Slot code to product and quantity. Restock, look up, count items.</td></tr>
<tr><td><code>State</code></td><td>Interface</td><td><code>insertMoney</code>, <code>selectProduct</code>, <code>cancel</code>, <code>dispense</code>. One class per state implements all four.</td></tr>
<tr><td><code>IdleState</code>, <code>HasMoneyState</code>, <code>DispensingState</code>, <code>OutOfServiceState</code></td><td>States</td><td>Each decides what every action means in that state, and which state comes next.</td></tr>
<tr><td><code>ChangeStrategy</code></td><td>Interface (Strategy)</td><td>Picks coins for a change amount from a limited stock. <code>GreedyChange</code> and <code>DpChange</code>.</td></tr>
<tr><td><code>VendingMachine</code></td><td>Context</td><td>Holds inventory, cash box, escrow and the current state. Every public action is forwarded to the current state.</td></tr>
</tbody>
</table>

<h2>Class diagram</h2>
<div data-diagram="classes" data-caption="The machine forwards every action to its current State. Change-making is a separate Strategy."></div>

<h2>States and transitions</h2>
<div data-diagram="states" data-caption="Machine states. Self-loops on HasMoney cover more coins, sold out, short of money and no change."></div>
<p>The grid below is the whole behaviour of the machine on one screen. Draw it in the interview before you write a line of code. Each row becomes one class, and each cell becomes one method body.</p>
<table>
<thead><tr><th>State</th><th>insertMoney</th><th>selectProduct</th><th>cancel</th><th>dispense</th></tr></thead>
<tbody>
<tr><td><strong>Idle</strong></td><td>Add to escrow, go to HasMoney</td><td>"Insert money first"</td><td>"Nothing to refund"</td><td>Ignore</td></tr>
<tr><td><strong>HasMoney</strong></td><td>Add to escrow</td><td>Check stock, balance, change. If all OK, commit and go to Dispensing</td><td>Refund escrow, go to Idle</td><td>"Select a product first"</td></tr>
<tr><td><strong>Dispensing</strong></td><td>Return the coin, "busy"</td><td>"Busy, please wait"</td><td>"Too late to cancel"</td><td>Drop product and change, go to Idle (or OutOfService if empty)</td></tr>
<tr><td><strong>OutOfService</strong></td><td>Return the coin</td><td>"Out of service"</td><td>"Out of service"</td><td>Ignore</td></tr>
</tbody>
</table>

<h2>Flow: a purchase with change</h2>
<div data-diagram="purchase" data-caption="Inserting Rs50 and buying a Rs40 Coke. Change is computed and reserved before the product drops."></div>
<ol class="steps">
<li>The customer inserts Rs50. <code>IdleState</code> puts it in escrow and switches to <code>HasMoneyState</code>.</li>
<li>The customer presses A1. <code>HasMoneyState</code> checks the slot is valid and in stock, and that Rs50 covers Rs40.</li>
<li>It asks the change strategy for Rs10, using the cash box <em>plus</em> the customer's own coins. If that fails, it refuses the sale and keeps the escrow.</li>
<li>On success it commits: escrow moves into the cash box, the change coins come out, and the state becomes <code>DispensingState</code>.</li>
<li><code>DispensingState</code> drops the product, returns the change, decrements stock, and goes back to <code>Idle</code>.</li>
</ol>
<p>The order matters. Check change <em>before</em> dropping the product. If you drop the Coke first and then discover you cannot return Rs10, you have either cheated the customer or given away a product.</p>

<h2>Design patterns used and why</h2>
<h3>State: why if/else fails</h3>
<p>The first version most people write keeps a few flags and checks them everywhere:</p>
<pre><code>void selectProduct(String code) {
    if (outOfService) { print("Out of service"); return; }
    if (dispensing)   { print("Busy"); return; }
    if (balance == 0) { print("Insert money first"); return; }
    // ...actual selling logic...
}
// ...and the same three checks again in insertMoney(), cancel(), dispense()</code></pre>
<p>It works for the demo. Then the product team asks for a "jammed slot" state, or a UPI flow where you pick the product <em>first</em> and then pay. Now every method gains another flag check, and the flags can contradict each other: what does <code>dispensing == true</code> with <code>balance == 0</code> mean? Nothing stops that combination, so bugs hide there. With N states and M actions you end up with N × M scattered branches and no single place that says "this is what Idle does".</p>
<p>The State pattern turns each row of the grid into a class. The machine (called the <em>context</em>) holds a reference to its current state object and forwards every action to it. A state does its work and then tells the machine which state comes next. The benefits:</p>
<ul>
<li><strong>One state, one place.</strong> Everything about <code>Dispensing</code> lives in <code>DispensingState</code>.</li>
<li><strong>Impossible combinations disappear.</strong> The machine is in exactly one state, not a mix of flags.</li>
<li><strong>Adding a state is adding a class.</strong> A <code>MaintenanceState</code> or <code>AwaitingUpiPaymentState</code> does not touch the other four (open/closed principle).</li>
<li><strong>Every action is handled in every state</strong>, because the interface forces you to write all four methods. You cannot forget what "cancel while dispensing" means.</li>
</ul>
<p>The states here hold no data of their own, so the machine creates one instance of each and reuses them. If a state needed its own data (like a timer for a UPI payment), you would create a fresh instance on each transition instead.</p>

<h3>Strategy: change-making</h3>
<p><code>ChangeStrategy</code> hides the algorithm that picks coins. <code>GreedyChange</code> is simple and fast. <code>DpChange</code> is always correct for limited stock. An operator might also want a policy that hands out larger coins first to keep small ones for later. Each is one class, injected into the machine's constructor.</p>

<h3>What about Singleton?</h3>
<p>There is one physical machine, so some answers make <code>VendingMachine</code> a Singleton. Mention it, but prefer creating one instance in <code>main</code> and passing it around. A Singleton makes tests share state, and a company like a metro operator runs hundreds of machines from one backend, where "only one instance" is simply wrong. See the <a href="#/p/parking-lot">parking lot</a> page for the full argument.</p>

<h2>Returning change with limited coins</h2>
<p>Indian denominations (1, 2, 5, 10, 20, 50, 100) form a <em>canonical</em> coin system: with an unlimited supply of every coin, greedy (always take the largest coin that fits) gives the fewest coins. That is why a shopkeeper does it in their head. A vending machine does not have unlimited coins. It has exactly what is in its cash box, and that changes everything.</p>
<table>
<thead><tr><th>Case</th><th>Coins available</th><th>Change owed</th><th>Greedy</th><th>DP</th></tr></thead>
<tbody>
<tr><td>Plenty of coins</td><td>Every INR coin, many of each</td><td>Rs80</td><td>50 + 20 + 10 (3 coins)</td><td>Same</td></tr>
<tr><td>Limited stock</td><td>Rs50 x1, Rs20 x3</td><td>Rs60</td><td>Takes 50, needs 10, has none: <strong>fails</strong></td><td>20 + 20 + 20</td></tr>
<tr><td>Non-canonical system</td><td>Coins of 1, 3, 4 (unlimited)</td><td>6</td><td>4 + 1 + 1 (3 coins)</td><td>3 + 3 (2 coins)</td></tr>
<tr><td>Truly impossible</td><td>Rs10 x1, Rs5 x2, plus the customer's Rs100</td><td>Rs80</td><td>Fails</td><td>Fails: refuse the sale, "exact change only"</td></tr>
</tbody>
</table>
<p>The second row is the one to remember. Greedy grabs the Rs50 coin and paints itself into a corner. A correct algorithm must consider <em>not</em> using a coin even when it fits.</p>
<h3>The DP: bounded coin change</h3>
<p>Let <code>best[a]</code> be the fewest coins that make amount <code>a</code> using the denominations processed so far. Start with <code>best[0] = 0</code> and everything else infinite. For each denomination <code>d</code> with <code>c</code> coins in stock, build a new table: for every amount <code>a</code>, try using <code>k = 0, 1, ..., c</code> coins of <code>d</code> and keep the smallest <code>best[a - k·d] + k</code>. Record the chosen <code>k</code> so you can walk back and list the coins at the end. If <code>best[amount]</code> is still infinite, change is impossible.</p>
<p>Cost: O(D × A × C), where D is the number of denominations (7), A is the change amount, and C is the most coins of one kind. For Rs500 of change with up to 50 coins of each kind, that is about 175,000 simple steps: well under a millisecond even on the small processor inside a machine. The amounts are small, so a fancier algorithm is not worth it.</p>
<p>Two details matter:</p>
<ul>
<li><strong>The customer's coins count.</strong> Change is computed from the cash box <em>plus</em> the escrow. If the box is empty and someone inserts Rs20 + Rs20 for a Rs20 item, you can hand back one of their own Rs20s.</li>
<li><strong>The exact-change light.</strong> Real machines show "EXACT CHANGE ONLY" when coins run low. After each sale, check whether common change amounts (say every multiple of Rs5 up to Rs95) are still makeable, and turn the light on if not. The per-sale check in the code is still needed, because the light is only a hint.</li>
</ul>

<h2>Full implementation</h2>
<p>Each tab is one self-contained file that compiles and runs. Money is in whole rupees as integers. Never use floating point for money. The demo walks through every scenario from the requirements.</p>
<div data-code="full"></div>
<p>Expected output (identical in every language):</p>
<pre><code>== 1. Purchase with change ==
Inserted Rs50. Balance Rs50
Dispensed Coke. Change Rs10: Rs10 x1
State: Idle
== 2. No change available ==
Inserted Rs100. Balance Rs100
Cannot return Rs80 change. Exact change only: insert the exact amount or cancel
State: HasMoney
Refunded Rs100: Rs100 x1
== 3. Insufficient funds ==
Inserted Rs20. Balance Rs20
Insufficient funds: Coke costs Rs40, inserted Rs20. Insert Rs20 more
Inserted Rs20. Balance Rs40
Dispensed Coke
== 4. Out of stock ==
Inserted Rs20. Balance Rs20
Coke is sold out. Pick another item or cancel
KitKat is sold out. Pick another item or cancel
Dispensed Lays
== 5. Cancel and refund ==
Insert money first
Inserted Rs10. Balance Rs10
Inserted Rs2. Balance Rs12
Refunded Rs12: Rs10 x1, Rs2 x1
Nothing to refund
== 6. Admin ==
Admin: machine is out of service
Out of service. Returned Rs10
Admin: restocked Coke, now 5
Admin: collected Rs50. Left for change: Rs20 x3, Rs5 x2
Admin: machine is back, state Idle
== 7. Greedy vs DP with limited coins ==
Box: Rs50 x1, Rs20 x3. Change needed: Rs60
Greedy: fails (takes Rs50, then needs Rs10)
DP: Rs20 x3</code></pre>
<p>Things to point out when you walk the interviewer through it:</p>
<ul>
<li><strong>Failed checks keep the state.</strong> Sold out, short of money and no change all leave the machine in <code>HasMoney</code> with the escrow intact, so the customer can add coins, pick something else, or cancel.</li>
<li><strong>Commit, then dispense.</strong> Money moves from escrow to cash box only once change is reserved. A crash before that point loses nothing.</li>
<li><strong>Scenario 2 is the interesting one.</strong> The box holds Rs50 + Rs5 + Rs5 after the first sale. Rs80 of change is impossible, so the sale is refused before anything drops.</li>
<li><strong>Admin actions are guarded.</strong> Going out of service is only allowed from <code>Idle</code>, so the operator cannot strand a customer's money mid-sale.</li>
<li><strong>Go maps are unordered</strong>, so the Go <code>CoinBag</code> sorts denominations before printing. Small thing, but it keeps output deterministic.</li>
</ul>

<h2>Concurrency and failure handling</h2>
<p>A physical machine has one keypad, so it is tempting to say "no concurrency". But events come from several places: the coin acceptor's interrupt handler, the keypad, the operator's admin panel, and, with UPI, a payment callback over the network. If a coin lands at the same moment as a cancel, the escrow can be refunded and then credited again.</p>
<ul>
<li><strong>Simplest fix:</strong> make every public method on <code>VendingMachine</code> take one lock (<code>synchronized</code> in Java, a mutex elsewhere). The state transitions then happen one at a time. Traffic is tiny, so the lock never contends.</li>
<li><strong>Cleaner fix:</strong> funnel all events into one queue processed by a single thread, an <em>event loop</em>. This is how most embedded controllers work. The State pattern fits this naturally: each event is a method call on the current state.</li>
<li><strong>Hardware failure:</strong> the motor turns but the drop sensor (an infrared beam under the slot) never sees the product fall. Refund the customer, mark the slot faulty, and alert the operator. This is a good place for a <code>DispenseFailed</code> transition.</li>
<li><strong>Power cut mid-sale:</strong> write a small transaction log (escrow amount, selected slot, step reached) to flash storage before each step, so the machine can refund or complete on restart.</li>
</ul>

<h2>Extensibility: card and UPI payments</h2>
<p>Cash is one payment method among several. Put payment behind an interface so the machine does not care how money arrives:</p>
<pre><code>interface PaymentMethod {
    PaymentResult collect(int amountRs, String orderId);  // cash, card, UPI
    void refund(PaymentResult result);
}
class CashPayment implements PaymentMethod { ... }  // wraps escrow + change-making
class CardPayment implements PaymentMethod { ... }  // talks to the card reader
class UpiPayment  implements PaymentMethod { ... }  // shows a QR, waits for the callback</code></pre>
<p>Card and UPI flip the order of steps. The customer picks the product <em>first</em>, the machine shows a dynamic UPI QR code for exactly that amount, and the payment gateway (Razorpay, PhonePe, Paytm) calls back when it succeeds. No change-making is needed. The State pattern absorbs this without touching existing states: add <code>ProductSelectedState</code> and <code>AwaitingPaymentState</code>. The waiting state starts a timeout (say 120 seconds). If the callback arrives late, the order is refunded automatically. Use the order id as an <em>idempotency key</em>, so a callback delivered twice never dispenses twice.</p>
<div class="tabs">
<section data-tab="New states">
<p>A jammed slot, a "door open" state while the operator restocks, or a "low temperature" lockout for a drinks fridge. Each is a new <code>State</code> class plus the transitions into and out of it. No existing state's code changes, except the one transition that leads into the new state.</p>
</section>
<section data-tab="Pricing">
<p>Happy-hour discounts or combo offers ("chips + drink for Rs50") belong in a <code>PricingStrategy</code> the machine asks for the price, instead of reading <code>product.price</code> directly. The states stay the same.</p>
</section>
<section data-tab="Telemetry">
<p>The operator wants a low-stock alert when a slot drops below 2 items, and daily sales reports. Add an Observer: the machine publishes <code>ItemSold</code> and <code>SlotLow</code> events, and a telemetry client sends them to a backend. The core never knows who is listening.</p>
</section>
<section data-tab="Fleet of machines">
<p>A company running 500 machines across Bengaluru metro stations needs a backend: machine registry, remote price updates, restock routes, sales dashboards. Each machine still runs this exact state machine locally, so it keeps selling even when the network is down. That backend is an HLD problem.</p>
</section>
</div>

<h2>Common mistakes</h2>
<div class="callout warn"><strong>Things that lose marks</strong>
<ul>
<li>Boolean flags (<code>hasMoney</code>, <code>isDispensing</code>) checked in every method instead of state classes.</li>
<li>Dispensing first and computing change afterwards.</li>
<li>Assuming greedy change always works, or assuming the machine has unlimited coins.</li>
<li>Refunding the balance as an amount instead of the actual coins inserted.</li>
<li>Using <code>double</code> for money.</li>
<li>Silently ignoring invalid actions (cancel while dispensing) instead of giving a clear response.</li>
<li>A <code>VendingMachine</code> god class that also does change-making, inventory and printing.</li>
<li>Letting the admin go out of service while a customer's money is in escrow.</li>
</ul>
</div>

<div class="callout interview"><strong>Say this in the interview</strong>"The same button means different things depending on what the machine is doing, so I will use the State pattern: Idle, HasMoney, Dispensing and OutOfService, each implementing insertMoney, selectProduct, cancel and dispense. The machine just forwards to its current state. Inserted money sits in escrow until the sale commits, so a cancel returns the exact coins. Before dispensing I check that change is possible from the coins really in the box. Greedy can fail with limited stock, for example Rs60 from one Rs50 and three Rs20s, so I use a small bounded coin-change DP behind a ChangeStrategy interface. Card and UPI plug in behind a PaymentMethod interface with two extra states."</div>

<h2>Follow-up questions</h2>
<div class="quiz">
<details><summary>Why is the State pattern better than an enum plus a switch in every method?</summary><div>An enum with a switch is a fine start for 3 states. But every new state means editing every method's switch, and the logic for one state is spread across all of them. With state classes, everything about one state lives in one class, the interface forces you to handle every action in every state, and a new state is a new class (open/closed). The switch version is not wrong; it just does not scale as states and actions grow.</div></details>
<details><summary>The machine has one Rs50 and three Rs20 coins. A customer is owed Rs60. What happens with greedy, and what should happen?</summary><div>Greedy takes the Rs50 (largest that fits), then needs Rs10, has no Rs10, Rs5, Rs2 or Rs1 coins, and fails. A bounded coin-change DP considers not using the Rs50 and finds Rs20 + Rs20 + Rs20. The machine should use an algorithm that finds an answer whenever one exists, and only refuse the sale when none does.</div></details>
<details><summary>Why check change before dispensing, and where do the customer's coins go meanwhile?</summary><div>If you dispense first and then cannot make change, you either short the customer or give the product away. The customer's coins sit in escrow, separate from the cash box, until change is confirmed. Then the sale commits atomically: escrow goes into the box and the change coins come out. A cancel before that point returns the exact coins.</div></details>
<details><summary>How would you add UPI payments?</summary><div>Add a <code>PaymentMethod</code> interface with cash, card and UPI implementations. For UPI, the flow is product first: a new <code>ProductSelectedState</code> shows a dynamic QR for the exact price, and an <code>AwaitingPaymentState</code> waits for the gateway's callback with a timeout. Use the order id as an idempotency key so a repeated callback cannot dispense twice. A late payment after timeout is refunded automatically.</div></details>
<details><summary>Can two events really race on a single vending machine?</summary><div>Yes. The coin acceptor, keypad, admin panel and UPI callbacks can fire independently. A coin arriving during a cancel could be refunded and credited at once. Make the machine's public methods take one lock, or queue all events to a single-threaded event loop. Either way, state transitions happen one at a time.</div></details>
<details><summary>The motor turns but the product gets stuck. What should the software do?</summary><div>A drop sensor (an infrared beam under the slots) confirms the product fell. If it does not trip within a few seconds, treat it as a failed dispense: refund the payment (the reserved change plus the price), mark the slot faulty so it is not sold again, and alert the operator. This becomes a <code>DispenseFailed</code> transition from <code>Dispensing</code>.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
<li>When the same action means different things in different modes, use the State pattern: one class per state, the machine forwards every action.</li>
<li>Draw the state-by-action grid first. Each row is a class, each cell is a method body.</li>
<li>Keep the customer's money in escrow. Commit it only after change is reserved, and refund the exact coins on cancel.</li>
<li>Greedy change is optimal for INR only with unlimited coins. With limited stock it can fail; a small bounded coin-change DP never does.</li>
<li>Check stock, balance and change <em>before</em> dispensing. Money is integer rupees, never floating point.</li>
<li>Card and UPI plug in behind a <code>PaymentMethod</code> interface plus two new states. Use idempotency keys for payment callbacks.</li>
</ul></div>
`,
  code: {
    full: {
      title: "Complete vending machine (single file, runnable)",
      java: String.raw`// Vending machine: single-file machine-coding solution built on the State pattern.
// Run: javac VendingMachineDemo.java && java VendingMachineDemo
import java.util.*;

public class VendingMachineDemo {

    // Accepted Indian coins and notes, highest first (enum order = iteration order).
    enum Denomination {
        HUNDRED(100), FIFTY(50), TWENTY(20), TEN(10), FIVE(5), TWO(2), ONE(1);
        final int value;
        Denomination(int value) { this.value = value; }
        @Override public String toString() { return "Rs" + value; }
    }

    // A bag of coins/notes: the machine's cash box, the customer's escrow, or a change set.
    static class CoinBag {
        private final EnumMap<Denomination, Integer> counts = new EnumMap<>(Denomination.class);

        void add(Denomination d, int n) {
            int c = count(d) + n;
            if (c < 0) throw new IllegalStateException("not enough " + d);
            if (c == 0) counts.remove(d); else counts.put(d, c);
        }
        int count(Denomination d) { return counts.getOrDefault(d, 0); }
        void addAll(CoinBag other) { other.counts.forEach(this::add); }
        void removeAll(CoinBag other) { other.counts.forEach((d, n) -> add(d, -n)); }
        void clear() { counts.clear(); }
        boolean isEmpty() { return counts.isEmpty(); }
        int total() {
            int t = 0;
            for (Map.Entry<Denomination, Integer> e : counts.entrySet()) t += e.getKey().value * e.getValue();
            return t;
        }
        CoinBag copy() { CoinBag b = new CoinBag(); b.addAll(this); return b; }
        @Override public String toString() {
            StringJoiner sj = new StringJoiner(", ");
            counts.forEach((d, n) -> sj.add(d + " x" + n));
            return sj.length() == 0 ? "nothing" : sj.toString();
        }
    }

    // ---------- Strategy: how to make change from a LIMITED set of coins ----------
    interface ChangeStrategy {
        CoinBag makeChange(CoinBag available, int amount); // null if impossible
    }

    // Take the biggest coin that fits, repeat. Fast, but can fail when coins run low.
    static class GreedyChange implements ChangeStrategy {
        public CoinBag makeChange(CoinBag available, int amount) {
            CoinBag out = new CoinBag();
            int left = amount;
            for (Denomination d : Denomination.values()) {
                int k = Math.min(available.count(d), left / d.value);
                if (k > 0) { out.add(d, k); left -= k * d.value; }
            }
            return left == 0 ? out : null;
        }
    }

    // Bounded coin change: fewest coins using at most the coins we actually hold.
    static class DpChange implements ChangeStrategy {
        private static final int INF = 1 << 29;

        public CoinBag makeChange(CoinBag available, int amount) {
            Denomination[] ds = Denomination.values();
            int[] best = new int[amount + 1];          // best[a] = fewest coins for a so far
            Arrays.fill(best, INF);
            best[0] = 0;
            int[][] take = new int[ds.length][amount + 1]; // how many of ds[i] we used for a
            for (int i = 0; i < ds.length; i++) {
                int d = ds[i].value, have = available.count(ds[i]);
                int[] next = new int[amount + 1];
                Arrays.fill(next, INF);
                for (int a = 0; a <= amount; a++) {
                    for (int k = 0; k <= have && k * d <= a; k++) {
                        if (best[a - k * d] + k < next[a]) { next[a] = best[a - k * d] + k; take[i][a] = k; }
                    }
                }
                best = next;
            }
            if (best[amount] >= INF) return null;
            CoinBag out = new CoinBag();
            int a = amount;
            for (int i = ds.length - 1; i >= 0; i--) {   // walk the choices backwards
                int k = take[i][a];
                if (k > 0) { out.add(ds[i], k); a -= k * ds[i].value; }
            }
            return out;
        }
    }

    // ---------- Products and inventory ----------
    static class Product {
        final String name;
        final int price;
        Product(String name, int price) { this.name = name; this.price = price; }
    }

    static class Slot {
        final Product product;
        int quantity;
        Slot(Product product, int quantity) { this.product = product; this.quantity = quantity; }
    }

    static class Inventory {
        private final Map<String, Slot> slots = new TreeMap<>();
        void add(String code, Product p, int qty) { slots.put(code, new Slot(p, qty)); }
        Slot get(String code) { return slots.get(code); }
        int totalItems() {
            int n = 0;
            for (Slot s : slots.values()) n += s.quantity;
            return n;
        }
    }

    // ---------- State pattern ----------
    interface State {
        String name();
        void insertMoney(VendingMachine m, Denomination d);
        void selectProduct(VendingMachine m, String code);
        void cancel(VendingMachine m);
        void dispense(VendingMachine m);
    }

    static class IdleState implements State {
        public String name() { return "Idle"; }
        public void insertMoney(VendingMachine m, Denomination d) {
            m.escrow.add(d, 1);
            System.out.println("Inserted " + d + ". Balance Rs" + m.balance());
            m.setState(m.hasMoney);
        }
        public void selectProduct(VendingMachine m, String code) { System.out.println("Insert money first"); }
        public void cancel(VendingMachine m) { System.out.println("Nothing to refund"); }
        public void dispense(VendingMachine m) { System.out.println("Insert money first"); }
    }

    static class HasMoneyState implements State {
        public String name() { return "HasMoney"; }
        public void insertMoney(VendingMachine m, Denomination d) {
            m.escrow.add(d, 1);
            System.out.println("Inserted " + d + ". Balance Rs" + m.balance());
        }
        public void selectProduct(VendingMachine m, String code) {
            Slot slot = m.inventory.get(code);
            if (slot == null) { System.out.println("Invalid code " + code); return; }
            Product p = slot.product;
            if (slot.quantity == 0) { System.out.println(p.name + " is sold out. Pick another item or cancel"); return; }
            int balance = m.balance();
            if (balance < p.price) {
                System.out.println("Insufficient funds: " + p.name + " costs Rs" + p.price + ", inserted Rs" + balance
                        + ". Insert Rs" + (p.price - balance) + " more");
                return;
            }
            // Change may use the machine's coins AND the customer's own coins.
            CoinBag pool = m.cashBox.copy();
            pool.addAll(m.escrow);
            CoinBag change = m.changeStrategy.makeChange(pool, balance - p.price);
            if (change == null) {
                System.out.println("Cannot return Rs" + (balance - p.price) + " change. Exact change only: insert the exact amount or cancel");
                return;
            }
            m.cashBox.addAll(m.escrow);   // commit: customer's money is now the machine's
            m.escrow.clear();
            m.cashBox.removeAll(change);  // reserve the change coins
            m.pendingCode = code;
            m.pendingChange = change;
            m.setState(m.dispensing);
            m.dispense();
        }
        public void cancel(VendingMachine m) { m.refundEscrow(); m.setState(m.idle); }
        public void dispense(VendingMachine m) { System.out.println("Select a product first"); }
    }

    static class DispensingState implements State {
        public String name() { return "Dispensing"; }
        public void insertMoney(VendingMachine m, Denomination d) { System.out.println("Busy dispensing. Returned " + d); }
        public void selectProduct(VendingMachine m, String code) { System.out.println("Busy dispensing. Please wait"); }
        public void cancel(VendingMachine m) { System.out.println("Too late to cancel. Dispensing"); }
        public void dispense(VendingMachine m) {
            Slot slot = m.inventory.get(m.pendingCode);
            slot.quantity--;
            String msg = "Dispensed " + slot.product.name;
            if (!m.pendingChange.isEmpty()) msg += ". Change Rs" + m.pendingChange.total() + ": " + m.pendingChange;
            System.out.println(msg);
            m.pendingCode = null;
            m.pendingChange = null;
            m.setState(m.inventory.totalItems() == 0 ? m.outOfService : m.idle);
        }
    }

    static class OutOfServiceState implements State {
        public String name() { return "OutOfService"; }
        public void insertMoney(VendingMachine m, Denomination d) { System.out.println("Out of service. Returned " + d); }
        public void selectProduct(VendingMachine m, String code) { System.out.println("Out of service"); }
        public void cancel(VendingMachine m) { System.out.println("Out of service"); }
        public void dispense(VendingMachine m) { System.out.println("Out of service"); }
    }

    // ---------- The machine (context): holds data, delegates every action to the current state ----------
    static class VendingMachine {
        final State idle = new IdleState();
        final State hasMoney = new HasMoneyState();
        final State dispensing = new DispensingState();
        final State outOfService = new OutOfServiceState();

        final Inventory inventory = new Inventory();
        final CoinBag cashBox = new CoinBag(); // machine's own money, used for change
        final CoinBag escrow = new CoinBag();  // customer's money for the current sale
        final ChangeStrategy changeStrategy;
        String pendingCode;
        CoinBag pendingChange;
        private State state = idle;

        VendingMachine(ChangeStrategy changeStrategy) { this.changeStrategy = changeStrategy; }

        // Customer actions
        void insertMoney(Denomination d) { state.insertMoney(this, d); }
        void selectProduct(String code) { state.selectProduct(this, code); }
        void cancel() { state.cancel(this); }
        void dispense() { state.dispense(this); }

        void setState(State s) { state = s; }
        String stateName() { return state.name(); }
        int balance() { return escrow.total(); }

        void refundEscrow() {
            System.out.println("Refunded Rs" + escrow.total() + ": " + escrow);
            escrow.clear();
        }

        // Admin actions
        void loadCash(Denomination d, int n) { cashBox.add(d, n); }

        void restock(String code, int qty) {
            Slot s = inventory.get(code);
            s.quantity += qty;
            System.out.println("Admin: restocked " + s.product.name + ", now " + s.quantity);
        }

        // Takes out Rs50 and Rs100 notes. Smaller coins and notes stay behind for change.
        int collectCash() {
            int total = 0;
            for (Denomination d : new Denomination[] {Denomination.HUNDRED, Denomination.FIFTY}) {
                int n = cashBox.count(d);
                cashBox.add(d, -n);
                total += n * d.value;
            }
            System.out.println("Admin: collected Rs" + total + ". Left for change: " + cashBox);
            return total;
        }

        void setOutOfService(boolean down) {
            if (down) {
                if (state != idle) { System.out.println("Admin: finish or cancel the current sale first"); return; }
                state = outOfService;
                System.out.println("Admin: machine is out of service");
            } else {
                state = inventory.totalItems() > 0 ? idle : outOfService;
                System.out.println("Admin: machine is back, state " + state.name());
            }
        }
    }

    public static void main(String[] args) {
        VendingMachine vm = new VendingMachine(new DpChange());
        vm.inventory.add("A1", new Product("Coke", 40), 2);
        vm.inventory.add("A2", new Product("Lays", 20), 3);
        vm.inventory.add("A3", new Product("KitKat", 25), 0);
        vm.loadCash(Denomination.TEN, 1);
        vm.loadCash(Denomination.FIVE, 2);

        System.out.println("== 1. Purchase with change ==");
        vm.insertMoney(Denomination.FIFTY);
        vm.selectProduct("A1");
        System.out.println("State: " + vm.stateName());

        System.out.println("== 2. No change available ==");
        vm.insertMoney(Denomination.HUNDRED);
        vm.selectProduct("A2");
        System.out.println("State: " + vm.stateName());
        vm.cancel();

        System.out.println("== 3. Insufficient funds ==");
        vm.insertMoney(Denomination.TWENTY);
        vm.selectProduct("A1");
        vm.insertMoney(Denomination.TWENTY);
        vm.selectProduct("A1");

        System.out.println("== 4. Out of stock ==");
        vm.insertMoney(Denomination.TWENTY);
        vm.selectProduct("A1");
        vm.selectProduct("A3");
        vm.selectProduct("A2");

        System.out.println("== 5. Cancel and refund ==");
        vm.selectProduct("A2");
        vm.insertMoney(Denomination.TEN);
        vm.insertMoney(Denomination.TWO);
        vm.cancel();
        vm.cancel();

        System.out.println("== 6. Admin ==");
        vm.setOutOfService(true);
        vm.insertMoney(Denomination.TEN);
        vm.restock("A1", 5);
        vm.collectCash();
        vm.setOutOfService(false);

        System.out.println("== 7. Greedy vs DP with limited coins ==");
        CoinBag box = new CoinBag();
        box.add(Denomination.FIFTY, 1);
        box.add(Denomination.TWENTY, 3);
        System.out.println("Box: " + box + ". Change needed: Rs60");
        CoinBag g = new GreedyChange().makeChange(box, 60);
        CoinBag dp = new DpChange().makeChange(box, 60);
        System.out.println("Greedy: " + (g == null ? "fails (takes Rs50, then needs Rs10)" : g.toString()));
        System.out.println("DP: " + (dp == null ? "fails" : dp.toString()));
    }
}`,
      python: String.raw`# Vending machine: single-file machine-coding solution built on the State pattern.
# Run: python3 vm.py
from __future__ import annotations

import enum
from abc import ABC, abstractmethod
from typing import Dict, Optional


class Denomination(enum.Enum):
    """Accepted Indian coins and notes, highest first (definition order = iteration order)."""
    HUNDRED = 100
    FIFTY = 50
    TWENTY = 20
    TEN = 10
    FIVE = 5
    TWO = 2
    ONE = 1

    def __str__(self) -> str:
        return f"Rs{self.value}"


class CoinBag:
    """A bag of coins/notes: the machine's cash box, the customer's escrow, or a change set."""

    def __init__(self) -> None:
        self._counts: Dict[Denomination, int] = {}

    def add(self, d: Denomination, n: int) -> None:
        c = self.count(d) + n
        if c < 0:
            raise ValueError(f"not enough {d}")
        if c == 0:
            self._counts.pop(d, None)
        else:
            self._counts[d] = c

    def count(self, d: Denomination) -> int:
        return self._counts.get(d, 0)

    def add_all(self, other: CoinBag) -> None:
        for d, n in other._counts.items():
            self.add(d, n)

    def remove_all(self, other: CoinBag) -> None:
        for d, n in other._counts.items():
            self.add(d, -n)

    def clear(self) -> None:
        self._counts.clear()

    def is_empty(self) -> bool:
        return not self._counts

    def total(self) -> int:
        return sum(d.value * n for d, n in self._counts.items())

    def copy(self) -> CoinBag:
        b = CoinBag()
        b.add_all(self)
        return b

    def __str__(self) -> str:
        parts = [f"{d} x{self._counts[d]}" for d in Denomination if d in self._counts]
        return ", ".join(parts) if parts else "nothing"


# ---------- Strategy: how to make change from a LIMITED set of coins ----------
class ChangeStrategy(ABC):
    @abstractmethod
    def make_change(self, available: CoinBag, amount: int) -> Optional[CoinBag]:
        """Returns the coins to give back, or None if impossible."""


class GreedyChange(ChangeStrategy):
    """Take the biggest coin that fits, repeat. Fast, but can fail when coins run low."""

    def make_change(self, available: CoinBag, amount: int) -> Optional[CoinBag]:
        out, left = CoinBag(), amount
        for d in Denomination:
            k = min(available.count(d), left // d.value)
            if k > 0:
                out.add(d, k)
                left -= k * d.value
        return out if left == 0 else None


class DpChange(ChangeStrategy):
    """Bounded coin change: fewest coins using at most the coins we actually hold."""

    INF = 1 << 29

    def make_change(self, available: CoinBag, amount: int) -> Optional[CoinBag]:
        ds = list(Denomination)
        best = [self.INF] * (amount + 1)  # best[a] = fewest coins for a so far
        best[0] = 0
        take = [[0] * (amount + 1) for _ in ds]  # how many of ds[i] we used for a
        for i, den in enumerate(ds):
            d, have = den.value, available.count(den)
            nxt = [self.INF] * (amount + 1)
            for a in range(amount + 1):
                k = 0
                while k <= have and k * d <= a:
                    if best[a - k * d] + k < nxt[a]:
                        nxt[a] = best[a - k * d] + k
                        take[i][a] = k
                    k += 1
            best = nxt
        if best[amount] >= self.INF:
            return None
        out, a = CoinBag(), amount
        for i in range(len(ds) - 1, -1, -1):  # walk the choices backwards
            k = take[i][a]
            if k > 0:
                out.add(ds[i], k)
                a -= k * ds[i].value
        return out


# ---------- Products and inventory ----------
class Product:
    def __init__(self, name: str, price: int) -> None:
        self.name, self.price = name, price


class Slot:
    def __init__(self, product: Product, quantity: int) -> None:
        self.product, self.quantity = product, quantity


class Inventory:
    def __init__(self) -> None:
        self._slots: Dict[str, Slot] = {}

    def add(self, code: str, product: Product, qty: int) -> None:
        self._slots[code] = Slot(product, qty)

    def get(self, code: str) -> Optional[Slot]:
        return self._slots.get(code)

    def total_items(self) -> int:
        return sum(s.quantity for s in self._slots.values())


# ---------- State pattern ----------
class State(ABC):
    name = "State"

    @abstractmethod
    def insert_money(self, m: VendingMachine, d: Denomination) -> None: ...

    @abstractmethod
    def select_product(self, m: VendingMachine, code: str) -> None: ...

    @abstractmethod
    def cancel(self, m: VendingMachine) -> None: ...

    @abstractmethod
    def dispense(self, m: VendingMachine) -> None: ...


class IdleState(State):
    name = "Idle"

    def insert_money(self, m, d):
        m.escrow.add(d, 1)
        print(f"Inserted {d}. Balance Rs{m.balance()}")
        m.set_state(m.has_money)

    def select_product(self, m, code):
        print("Insert money first")

    def cancel(self, m):
        print("Nothing to refund")

    def dispense(self, m):
        print("Insert money first")


class HasMoneyState(State):
    name = "HasMoney"

    def insert_money(self, m, d):
        m.escrow.add(d, 1)
        print(f"Inserted {d}. Balance Rs{m.balance()}")

    def select_product(self, m, code):
        slot = m.inventory.get(code)
        if slot is None:
            print(f"Invalid code {code}")
            return
        p = slot.product
        if slot.quantity == 0:
            print(f"{p.name} is sold out. Pick another item or cancel")
            return
        balance = m.balance()
        if balance < p.price:
            print(f"Insufficient funds: {p.name} costs Rs{p.price}, inserted Rs{balance}. "
                  f"Insert Rs{p.price - balance} more")
            return
        # Change may use the machine's coins AND the customer's own coins.
        pool = m.cash_box.copy()
        pool.add_all(m.escrow)
        change = m.change_strategy.make_change(pool, balance - p.price)
        if change is None:
            print(f"Cannot return Rs{balance - p.price} change. "
                  "Exact change only: insert the exact amount or cancel")
            return
        m.cash_box.add_all(m.escrow)  # commit: customer's money is now the machine's
        m.escrow.clear()
        m.cash_box.remove_all(change)  # reserve the change coins
        m.pending_code, m.pending_change = code, change
        m.set_state(m.dispensing)
        m.dispense()

    def cancel(self, m):
        m.refund_escrow()
        m.set_state(m.idle)

    def dispense(self, m):
        print("Select a product first")


class DispensingState(State):
    name = "Dispensing"

    def insert_money(self, m, d):
        print(f"Busy dispensing. Returned {d}")

    def select_product(self, m, code):
        print("Busy dispensing. Please wait")

    def cancel(self, m):
        print("Too late to cancel. Dispensing")

    def dispense(self, m):
        slot = m.inventory.get(m.pending_code)
        slot.quantity -= 1
        msg = f"Dispensed {slot.product.name}"
        if not m.pending_change.is_empty():
            msg += f". Change Rs{m.pending_change.total()}: {m.pending_change}"
        print(msg)
        m.pending_code, m.pending_change = None, None
        m.set_state(m.out_of_service if m.inventory.total_items() == 0 else m.idle)


class OutOfServiceState(State):
    name = "OutOfService"

    def insert_money(self, m, d):
        print(f"Out of service. Returned {d}")

    def select_product(self, m, code):
        print("Out of service")

    def cancel(self, m):
        print("Out of service")

    def dispense(self, m):
        print("Out of service")


# ---------- The machine (context): holds data, delegates every action to the current state ----------
class VendingMachine:
    def __init__(self, change_strategy: ChangeStrategy) -> None:
        self.idle, self.has_money = IdleState(), HasMoneyState()
        self.dispensing, self.out_of_service = DispensingState(), OutOfServiceState()
        self.inventory = Inventory()
        self.cash_box = CoinBag()  # machine's own money, used for change
        self.escrow = CoinBag()  # customer's money for the current sale
        self.change_strategy = change_strategy
        self.pending_code: Optional[str] = None
        self.pending_change: Optional[CoinBag] = None
        self._state: State = self.idle

    # Customer actions
    def insert_money(self, d: Denomination) -> None:
        self._state.insert_money(self, d)

    def select_product(self, code: str) -> None:
        self._state.select_product(self, code)

    def cancel(self) -> None:
        self._state.cancel(self)

    def dispense(self) -> None:
        self._state.dispense(self)

    def set_state(self, s: State) -> None:
        self._state = s

    def state_name(self) -> str:
        return self._state.name

    def balance(self) -> int:
        return self.escrow.total()

    def refund_escrow(self) -> None:
        print(f"Refunded Rs{self.escrow.total()}: {self.escrow}")
        self.escrow.clear()

    # Admin actions
    def load_cash(self, d: Denomination, n: int) -> None:
        self.cash_box.add(d, n)

    def restock(self, code: str, qty: int) -> None:
        s = self.inventory.get(code)
        s.quantity += qty
        print(f"Admin: restocked {s.product.name}, now {s.quantity}")

    def collect_cash(self) -> int:
        """Takes out Rs50 and Rs100 notes. Smaller coins and notes stay behind for change."""
        total = 0
        for d in (Denomination.HUNDRED, Denomination.FIFTY):
            n = self.cash_box.count(d)
            self.cash_box.add(d, -n)
            total += n * d.value
        print(f"Admin: collected Rs{total}. Left for change: {self.cash_box}")
        return total

    def set_out_of_service(self, down: bool) -> None:
        if down:
            if self._state is not self.idle:
                print("Admin: finish or cancel the current sale first")
                return
            self._state = self.out_of_service
            print("Admin: machine is out of service")
        else:
            self._state = self.idle if self.inventory.total_items() > 0 else self.out_of_service
            print(f"Admin: machine is back, state {self._state.name}")


def main() -> None:
    D = Denomination
    vm = VendingMachine(DpChange())
    vm.inventory.add("A1", Product("Coke", 40), 2)
    vm.inventory.add("A2", Product("Lays", 20), 3)
    vm.inventory.add("A3", Product("KitKat", 25), 0)
    vm.load_cash(D.TEN, 1)
    vm.load_cash(D.FIVE, 2)

    print("== 1. Purchase with change ==")
    vm.insert_money(D.FIFTY)
    vm.select_product("A1")
    print(f"State: {vm.state_name()}")

    print("== 2. No change available ==")
    vm.insert_money(D.HUNDRED)
    vm.select_product("A2")
    print(f"State: {vm.state_name()}")
    vm.cancel()

    print("== 3. Insufficient funds ==")
    vm.insert_money(D.TWENTY)
    vm.select_product("A1")
    vm.insert_money(D.TWENTY)
    vm.select_product("A1")

    print("== 4. Out of stock ==")
    vm.insert_money(D.TWENTY)
    vm.select_product("A1")
    vm.select_product("A3")
    vm.select_product("A2")

    print("== 5. Cancel and refund ==")
    vm.select_product("A2")
    vm.insert_money(D.TEN)
    vm.insert_money(D.TWO)
    vm.cancel()
    vm.cancel()

    print("== 6. Admin ==")
    vm.set_out_of_service(True)
    vm.insert_money(D.TEN)
    vm.restock("A1", 5)
    vm.collect_cash()
    vm.set_out_of_service(False)

    print("== 7. Greedy vs DP with limited coins ==")
    box = CoinBag()
    box.add(D.FIFTY, 1)
    box.add(D.TWENTY, 3)
    print(f"Box: {box}. Change needed: Rs60")
    g = GreedyChange().make_change(box, 60)
    dp = DpChange().make_change(box, 60)
    print("Greedy: " + (str(g) if g is not None else "fails (takes Rs50, then needs Rs10)"))
    print("DP: " + (str(dp) if dp is not None else "fails"))


if __name__ == "__main__":
    main()`,
      cpp: String.raw`// Vending machine: single-file machine-coding solution built on the State pattern.
// Build: g++ -std=c++17 -Wall -Wextra vm.cpp -o vm && ./vm
#include <algorithm>
#include <array>
#include <iostream>
#include <map>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

// Accepted Indian coins and notes, highest first.
const std::array<int, 7> DENOMINATIONS = {100, 50, 20, 10, 5, 2, 1};
std::string rs(int v) { return "Rs" + std::to_string(v); }

// A bag of coins/notes: the machine's cash box, the customer's escrow, or a change set.
class CoinBag {
    std::map<int, int, std::greater<int>> counts_; // highest denomination first
public:
    void add(int d, int n) {
        int c = count(d) + n;
        if (c < 0) throw std::logic_error("not enough " + rs(d));
        if (c == 0) counts_.erase(d); else counts_[d] = c;
    }
    int count(int d) const { auto it = counts_.find(d); return it == counts_.end() ? 0 : it->second; }
    void addAll(const CoinBag& o) { for (auto [d, n] : o.counts_) add(d, n); }
    void removeAll(const CoinBag& o) { for (auto [d, n] : o.counts_) add(d, -n); }
    void clear() { counts_.clear(); }
    bool empty() const { return counts_.empty(); }
    int total() const { int t = 0; for (auto [d, n] : counts_) t += d * n; return t; }
    std::string str() const {
        std::string s;
        for (auto [d, n] : counts_) s += (s.empty() ? "" : ", ") + rs(d) + " x" + std::to_string(n);
        return s.empty() ? "nothing" : s;
    }
};

// ---------- Strategy: how to make change from a LIMITED set of coins ----------
class ChangeStrategy {
public:
    virtual ~ChangeStrategy() = default;
    virtual std::optional<CoinBag> makeChange(const CoinBag& available, int amount) const = 0;
};

// Take the biggest coin that fits, repeat. Fast, but can fail when coins run low.
class GreedyChange : public ChangeStrategy {
public:
    std::optional<CoinBag> makeChange(const CoinBag& available, int amount) const override {
        CoinBag out;
        int left = amount;
        for (int d : DENOMINATIONS) {
            int k = std::min(available.count(d), left / d);
            if (k > 0) { out.add(d, k); left -= k * d; }
        }
        if (left != 0) return std::nullopt;
        return out;
    }
};

// Bounded coin change: fewest coins using at most the coins we actually hold.
class DpChange : public ChangeStrategy {
    static constexpr int INF = 1 << 29;
public:
    std::optional<CoinBag> makeChange(const CoinBag& available, int amount) const override {
        const size_t n = DENOMINATIONS.size();
        std::vector<int> best(amount + 1, INF);                      // best[a] = fewest coins so far
        best[0] = 0;
        std::vector<std::vector<int>> take(n, std::vector<int>(amount + 1, 0)); // how many of coin i for a
        for (size_t i = 0; i < n; i++) {
            int d = DENOMINATIONS[i], have = available.count(d);
            std::vector<int> next(amount + 1, INF);
            for (int a = 0; a <= amount; a++)
                for (int k = 0; k <= have && k * d <= a; k++)
                    if (best[a - k * d] + k < next[a]) { next[a] = best[a - k * d] + k; take[i][a] = k; }
            best = std::move(next);
        }
        if (best[amount] >= INF) return std::nullopt;
        CoinBag out;
        int a = amount;
        for (size_t i = n; i-- > 0;) {                               // walk the choices backwards
            int k = take[i][a];
            if (k > 0) { out.add(DENOMINATIONS[i], k); a -= k * DENOMINATIONS[i]; }
        }
        return out;
    }
};

// ---------- Products and inventory ----------
struct Product { std::string name; int price; };
struct Slot { Product product; int quantity; };

class Inventory {
    std::map<std::string, Slot> slots_;
public:
    void add(const std::string& code, Product p, int qty) { slots_[code] = Slot{std::move(p), qty}; }
    Slot* get(const std::string& code) { auto it = slots_.find(code); return it == slots_.end() ? nullptr : &it->second; }
    int totalItems() const { int n = 0; for (const auto& kv : slots_) n += kv.second.quantity; return n; }
};

// ---------- State pattern ----------
class VendingMachine;

class State {
public:
    virtual ~State() = default;
    virtual std::string name() const = 0;
    virtual void insertMoney(VendingMachine& m, int d) = 0;
    virtual void selectProduct(VendingMachine& m, const std::string& code) = 0;
    virtual void cancel(VendingMachine& m) = 0;
    virtual void dispense(VendingMachine& m) = 0;
};

class IdleState : public State {
public:
    std::string name() const override { return "Idle"; }
    void insertMoney(VendingMachine& m, int d) override;
    void selectProduct(VendingMachine&, const std::string&) override { std::cout << "Insert money first\n"; }
    void cancel(VendingMachine&) override { std::cout << "Nothing to refund\n"; }
    void dispense(VendingMachine&) override { std::cout << "Insert money first\n"; }
};

class HasMoneyState : public State {
public:
    std::string name() const override { return "HasMoney"; }
    void insertMoney(VendingMachine& m, int d) override;
    void selectProduct(VendingMachine& m, const std::string& code) override;
    void cancel(VendingMachine& m) override;
    void dispense(VendingMachine&) override { std::cout << "Select a product first\n"; }
};

class DispensingState : public State {
public:
    std::string name() const override { return "Dispensing"; }
    void insertMoney(VendingMachine&, int d) override { std::cout << "Busy dispensing. Returned " << rs(d) << "\n"; }
    void selectProduct(VendingMachine&, const std::string&) override { std::cout << "Busy dispensing. Please wait\n"; }
    void cancel(VendingMachine&) override { std::cout << "Too late to cancel. Dispensing\n"; }
    void dispense(VendingMachine& m) override;
};

class OutOfServiceState : public State {
public:
    std::string name() const override { return "OutOfService"; }
    void insertMoney(VendingMachine&, int d) override { std::cout << "Out of service. Returned " << rs(d) << "\n"; }
    void selectProduct(VendingMachine&, const std::string&) override { std::cout << "Out of service\n"; }
    void cancel(VendingMachine&) override { std::cout << "Out of service\n"; }
    void dispense(VendingMachine&) override { std::cout << "Out of service\n"; }
};

// ---------- The machine (context): holds data, delegates every action to the current state ----------
class VendingMachine {
public:
    IdleState idle;
    HasMoneyState hasMoney;
    DispensingState dispensing;
    OutOfServiceState outOfService;

    Inventory inventory;
    CoinBag cashBox; // machine's own money, used for change
    CoinBag escrow;  // customer's money for the current sale
    const ChangeStrategy& changeStrategy;
    std::string pendingCode;
    CoinBag pendingChange;

    explicit VendingMachine(const ChangeStrategy& cs) : changeStrategy(cs) {}

    // Customer actions
    void insertMoney(int d) {
        if (std::find(DENOMINATIONS.begin(), DENOMINATIONS.end(), d) == DENOMINATIONS.end())
            throw std::invalid_argument("unknown denomination");
        state_->insertMoney(*this, d);
    }
    void selectProduct(const std::string& code) { state_->selectProduct(*this, code); }
    void cancel() { state_->cancel(*this); }
    void dispense() { state_->dispense(*this); }

    void setState(State& s) { state_ = &s; }
    std::string stateName() const { return state_->name(); }
    int balance() const { return escrow.total(); }

    void refundEscrow() {
        std::cout << "Refunded Rs" << escrow.total() << ": " << escrow.str() << "\n";
        escrow.clear();
    }

    // Admin actions
    void loadCash(int d, int n) { cashBox.add(d, n); }

    void restock(const std::string& code, int qty) {
        Slot* s = inventory.get(code);
        s->quantity += qty;
        std::cout << "Admin: restocked " << s->product.name << ", now " << s->quantity << "\n";
    }

    // Takes out Rs50 and Rs100 notes. Smaller coins and notes stay behind for change.
    int collectCash() {
        int total = 0;
        for (int d : {100, 50}) {
            int n = cashBox.count(d);
            cashBox.add(d, -n);
            total += n * d;
        }
        std::cout << "Admin: collected Rs" << total << ". Left for change: " << cashBox.str() << "\n";
        return total;
    }

    void setOutOfService(bool down) {
        if (down) {
            if (state_ != &idle) { std::cout << "Admin: finish or cancel the current sale first\n"; return; }
            state_ = &outOfService;
            std::cout << "Admin: machine is out of service\n";
        } else {
            state_ = inventory.totalItems() > 0 ? static_cast<State*>(&idle) : &outOfService;
            std::cout << "Admin: machine is back, state " << state_->name() << "\n";
        }
    }

private:
    State* state_ = &idle;
};

void IdleState::insertMoney(VendingMachine& m, int d) {
    m.escrow.add(d, 1);
    std::cout << "Inserted " << rs(d) << ". Balance Rs" << m.balance() << "\n";
    m.setState(m.hasMoney);
}

void HasMoneyState::insertMoney(VendingMachine& m, int d) {
    m.escrow.add(d, 1);
    std::cout << "Inserted " << rs(d) << ". Balance Rs" << m.balance() << "\n";
}

void HasMoneyState::selectProduct(VendingMachine& m, const std::string& code) {
    Slot* slot = m.inventory.get(code);
    if (!slot) { std::cout << "Invalid code " << code << "\n"; return; }
    const Product& p = slot->product;
    if (slot->quantity == 0) { std::cout << p.name << " is sold out. Pick another item or cancel\n"; return; }
    int balance = m.balance();
    if (balance < p.price) {
        std::cout << "Insufficient funds: " << p.name << " costs Rs" << p.price << ", inserted Rs" << balance
                  << ". Insert Rs" << (p.price - balance) << " more\n";
        return;
    }
    // Change may use the machine's coins AND the customer's own coins.
    CoinBag pool = m.cashBox;
    pool.addAll(m.escrow);
    std::optional<CoinBag> change = m.changeStrategy.makeChange(pool, balance - p.price);
    if (!change) {
        std::cout << "Cannot return Rs" << (balance - p.price)
                  << " change. Exact change only: insert the exact amount or cancel\n";
        return;
    }
    m.cashBox.addAll(m.escrow); // commit: customer's money is now the machine's
    m.escrow.clear();
    m.cashBox.removeAll(*change); // reserve the change coins
    m.pendingCode = code;
    m.pendingChange = *change;
    m.setState(m.dispensing);
    m.dispense();
}

void HasMoneyState::cancel(VendingMachine& m) {
    m.refundEscrow();
    m.setState(m.idle);
}

void DispensingState::dispense(VendingMachine& m) {
    Slot* slot = m.inventory.get(m.pendingCode);
    slot->quantity--;
    std::string msg = "Dispensed " + slot->product.name;
    if (!m.pendingChange.empty())
        msg += ". Change Rs" + std::to_string(m.pendingChange.total()) + ": " + m.pendingChange.str();
    std::cout << msg << "\n";
    m.pendingCode.clear();
    m.pendingChange.clear();
    if (m.inventory.totalItems() == 0) m.setState(m.outOfService);
    else m.setState(m.idle);
}

int main() {
    DpChange dpChange;
    VendingMachine vm(dpChange);
    vm.inventory.add("A1", {"Coke", 40}, 2);
    vm.inventory.add("A2", {"Lays", 20}, 3);
    vm.inventory.add("A3", {"KitKat", 25}, 0);
    vm.loadCash(10, 1);
    vm.loadCash(5, 2);

    std::cout << "== 1. Purchase with change ==\n";
    vm.insertMoney(50);
    vm.selectProduct("A1");
    std::cout << "State: " << vm.stateName() << "\n";

    std::cout << "== 2. No change available ==\n";
    vm.insertMoney(100);
    vm.selectProduct("A2");
    std::cout << "State: " << vm.stateName() << "\n";
    vm.cancel();

    std::cout << "== 3. Insufficient funds ==\n";
    vm.insertMoney(20);
    vm.selectProduct("A1");
    vm.insertMoney(20);
    vm.selectProduct("A1");

    std::cout << "== 4. Out of stock ==\n";
    vm.insertMoney(20);
    vm.selectProduct("A1");
    vm.selectProduct("A3");
    vm.selectProduct("A2");

    std::cout << "== 5. Cancel and refund ==\n";
    vm.selectProduct("A2");
    vm.insertMoney(10);
    vm.insertMoney(2);
    vm.cancel();
    vm.cancel();

    std::cout << "== 6. Admin ==\n";
    vm.setOutOfService(true);
    vm.insertMoney(10);
    vm.restock("A1", 5);
    vm.collectCash();
    vm.setOutOfService(false);

    std::cout << "== 7. Greedy vs DP with limited coins ==\n";
    CoinBag box;
    box.add(50, 1);
    box.add(20, 3);
    std::cout << "Box: " << box.str() << ". Change needed: Rs60\n";
    auto g = GreedyChange().makeChange(box, 60);
    auto dp = DpChange().makeChange(box, 60);
    std::cout << "Greedy: " << (g ? g->str() : "fails (takes Rs50, then needs Rs10)") << "\n";
    std::cout << "DP: " << (dp ? dp->str() : "fails") << "\n";
}`,
      javascript: String.raw`// Vending machine: single-file machine-coding solution built on the State pattern.
// Run: node vm.js

// Accepted Indian coins and notes, highest first.
const DENOMINATIONS = Object.freeze([100, 50, 20, 10, 5, 2, 1]);
const rs = (v) => "Rs" + v;

// A bag of coins/notes: the machine's cash box, the customer's escrow, or a change set.
class CoinBag {
  constructor() { this.counts = new Map(); }

  add(d, n) {
    const c = this.count(d) + n;
    if (c < 0) throw new Error("not enough " + rs(d));
    if (c === 0) this.counts.delete(d); else this.counts.set(d, c);
  }
  count(d) { return this.counts.get(d) || 0; }
  addAll(other) { for (const [d, n] of other.counts) this.add(d, n); }
  removeAll(other) { for (const [d, n] of other.counts) this.add(d, -n); }
  clear() { this.counts.clear(); }
  isEmpty() { return this.counts.size === 0; }
  total() { let t = 0; for (const [d, n] of this.counts) t += d * n; return t; }
  copy() { const b = new CoinBag(); b.addAll(this); return b; }
  toString() {
    const parts = DENOMINATIONS.filter((d) => this.counts.has(d)).map((d) => rs(d) + " x" + this.counts.get(d));
    return parts.length ? parts.join(", ") : "nothing";
  }
}

// ---------- Strategy: how to make change from a LIMITED set of coins ----------
// Interface (duck-typed): makeChange(available: CoinBag, amount) -> CoinBag | null

// Take the biggest coin that fits, repeat. Fast, but can fail when coins run low.
class GreedyChange {
  makeChange(available, amount) {
    const out = new CoinBag();
    let left = amount;
    for (const d of DENOMINATIONS) {
      const k = Math.min(available.count(d), Math.floor(left / d));
      if (k > 0) { out.add(d, k); left -= k * d; }
    }
    return left === 0 ? out : null;
  }
}

// Bounded coin change: fewest coins using at most the coins we actually hold.
class DpChange {
  makeChange(available, amount) {
    const INF = 1 << 29;
    let best = new Array(amount + 1).fill(INF); // best[a] = fewest coins for a so far
    best[0] = 0;
    const take = DENOMINATIONS.map(() => new Array(amount + 1).fill(0)); // how many of coin i for a
    DENOMINATIONS.forEach((d, i) => {
      const have = available.count(d);
      const next = new Array(amount + 1).fill(INF);
      for (let a = 0; a <= amount; a++) {
        for (let k = 0; k <= have && k * d <= a; k++) {
          if (best[a - k * d] + k < next[a]) { next[a] = best[a - k * d] + k; take[i][a] = k; }
        }
      }
      best = next;
    });
    if (best[amount] >= INF) return null;
    const out = new CoinBag();
    let a = amount;
    for (let i = DENOMINATIONS.length - 1; i >= 0; i--) { // walk the choices backwards
      const k = take[i][a];
      if (k > 0) { out.add(DENOMINATIONS[i], k); a -= k * DENOMINATIONS[i]; }
    }
    return out;
  }
}

// ---------- Products and inventory ----------
class Inventory {
  constructor() { this.slots = new Map(); } // code -> { product: {name, price}, quantity }
  add(code, product, quantity) { this.slots.set(code, { product, quantity }); }
  get(code) { return this.slots.get(code); }
  totalItems() { let n = 0; for (const s of this.slots.values()) n += s.quantity; return n; }
}

// ---------- State pattern ----------
// Every state implements: insertMoney(m, d), selectProduct(m, code), cancel(m), dispense(m)
class IdleState {
  get name() { return "Idle"; }
  insertMoney(m, d) {
    m.escrow.add(d, 1);
    console.log("Inserted " + rs(d) + ". Balance Rs" + m.balance());
    m.setState(m.hasMoney);
  }
  selectProduct() { console.log("Insert money first"); }
  cancel() { console.log("Nothing to refund"); }
  dispense() { console.log("Insert money first"); }
}

class HasMoneyState {
  get name() { return "HasMoney"; }
  insertMoney(m, d) {
    m.escrow.add(d, 1);
    console.log("Inserted " + rs(d) + ". Balance Rs" + m.balance());
  }
  selectProduct(m, code) {
    const slot = m.inventory.get(code);
    if (!slot) { console.log("Invalid code " + code); return; }
    const p = slot.product;
    if (slot.quantity === 0) { console.log(p.name + " is sold out. Pick another item or cancel"); return; }
    const balance = m.balance();
    if (balance < p.price) {
      console.log("Insufficient funds: " + p.name + " costs Rs" + p.price + ", inserted Rs" + balance +
        ". Insert Rs" + (p.price - balance) + " more");
      return;
    }
    // Change may use the machine's coins AND the customer's own coins.
    const pool = m.cashBox.copy();
    pool.addAll(m.escrow);
    const change = m.changeStrategy.makeChange(pool, balance - p.price);
    if (change === null) {
      console.log("Cannot return Rs" + (balance - p.price) + " change. Exact change only: insert the exact amount or cancel");
      return;
    }
    m.cashBox.addAll(m.escrow); // commit: customer's money is now the machine's
    m.escrow.clear();
    m.cashBox.removeAll(change); // reserve the change coins
    m.pendingCode = code;
    m.pendingChange = change;
    m.setState(m.dispensing);
    m.dispense();
  }
  cancel(m) { m.refundEscrow(); m.setState(m.idle); }
  dispense() { console.log("Select a product first"); }
}

class DispensingState {
  get name() { return "Dispensing"; }
  insertMoney(m, d) { console.log("Busy dispensing. Returned " + rs(d)); }
  selectProduct() { console.log("Busy dispensing. Please wait"); }
  cancel() { console.log("Too late to cancel. Dispensing"); }
  dispense(m) {
    const slot = m.inventory.get(m.pendingCode);
    slot.quantity--;
    let msg = "Dispensed " + slot.product.name;
    if (!m.pendingChange.isEmpty()) msg += ". Change Rs" + m.pendingChange.total() + ": " + m.pendingChange;
    console.log(msg);
    m.pendingCode = null;
    m.pendingChange = null;
    m.setState(m.inventory.totalItems() === 0 ? m.outOfService : m.idle);
  }
}

class OutOfServiceState {
  get name() { return "OutOfService"; }
  insertMoney(m, d) { console.log("Out of service. Returned " + rs(d)); }
  selectProduct() { console.log("Out of service"); }
  cancel() { console.log("Out of service"); }
  dispense() { console.log("Out of service"); }
}

// ---------- The machine (context): holds data, delegates every action to the current state ----------
class VendingMachine {
  constructor(changeStrategy) {
    this.idle = new IdleState();
    this.hasMoney = new HasMoneyState();
    this.dispensing = new DispensingState();
    this.outOfService = new OutOfServiceState();
    this.inventory = new Inventory();
    this.cashBox = new CoinBag(); // machine's own money, used for change
    this.escrow = new CoinBag();  // customer's money for the current sale
    this.changeStrategy = changeStrategy;
    this.pendingCode = null;
    this.pendingChange = null;
    this.state = this.idle;
  }

  // Customer actions
  insertMoney(d) {
    if (!DENOMINATIONS.includes(d)) throw new RangeError("unknown denomination " + d);
    this.state.insertMoney(this, d);
  }
  selectProduct(code) { this.state.selectProduct(this, code); }
  cancel() { this.state.cancel(this); }
  dispense() { this.state.dispense(this); }

  setState(s) { this.state = s; }
  stateName() { return this.state.name; }
  balance() { return this.escrow.total(); }

  refundEscrow() {
    console.log("Refunded Rs" + this.escrow.total() + ": " + this.escrow);
    this.escrow.clear();
  }

  // Admin actions
  loadCash(d, n) { this.cashBox.add(d, n); }

  restock(code, qty) {
    const s = this.inventory.get(code);
    s.quantity += qty;
    console.log("Admin: restocked " + s.product.name + ", now " + s.quantity);
  }

  // Takes out Rs50 and Rs100 notes. Smaller coins and notes stay behind for change.
  collectCash() {
    let total = 0;
    for (const d of [100, 50]) {
      const n = this.cashBox.count(d);
      this.cashBox.add(d, -n);
      total += n * d;
    }
    console.log("Admin: collected Rs" + total + ". Left for change: " + this.cashBox);
    return total;
  }

  setOutOfService(down) {
    if (down) {
      if (this.state !== this.idle) { console.log("Admin: finish or cancel the current sale first"); return; }
      this.state = this.outOfService;
      console.log("Admin: machine is out of service");
    } else {
      this.state = this.inventory.totalItems() > 0 ? this.idle : this.outOfService;
      console.log("Admin: machine is back, state " + this.state.name);
    }
  }
}

function main() {
  const vm = new VendingMachine(new DpChange());
  vm.inventory.add("A1", { name: "Coke", price: 40 }, 2);
  vm.inventory.add("A2", { name: "Lays", price: 20 }, 3);
  vm.inventory.add("A3", { name: "KitKat", price: 25 }, 0);
  vm.loadCash(10, 1);
  vm.loadCash(5, 2);

  console.log("== 1. Purchase with change ==");
  vm.insertMoney(50);
  vm.selectProduct("A1");
  console.log("State: " + vm.stateName());

  console.log("== 2. No change available ==");
  vm.insertMoney(100);
  vm.selectProduct("A2");
  console.log("State: " + vm.stateName());
  vm.cancel();

  console.log("== 3. Insufficient funds ==");
  vm.insertMoney(20);
  vm.selectProduct("A1");
  vm.insertMoney(20);
  vm.selectProduct("A1");

  console.log("== 4. Out of stock ==");
  vm.insertMoney(20);
  vm.selectProduct("A1");
  vm.selectProduct("A3");
  vm.selectProduct("A2");

  console.log("== 5. Cancel and refund ==");
  vm.selectProduct("A2");
  vm.insertMoney(10);
  vm.insertMoney(2);
  vm.cancel();
  vm.cancel();

  console.log("== 6. Admin ==");
  vm.setOutOfService(true);
  vm.insertMoney(10);
  vm.restock("A1", 5);
  vm.collectCash();
  vm.setOutOfService(false);

  console.log("== 7. Greedy vs DP with limited coins ==");
  const box = new CoinBag();
  box.add(50, 1);
  box.add(20, 3);
  console.log("Box: " + box + ". Change needed: Rs60");
  const g = new GreedyChange().makeChange(box, 60);
  const dp = new DpChange().makeChange(box, 60);
  console.log("Greedy: " + (g === null ? "fails (takes Rs50, then needs Rs10)" : g));
  console.log("DP: " + (dp === null ? "fails" : dp));
}

main();`,
      go: String.raw`// Vending machine: single-file machine-coding solution built on the State pattern.
// Run: go run main.go   (Go 1.21+ for the built-in min)
package main

import (
	"fmt"
	"sort"
	"strings"
)

// Accepted Indian coins and notes, highest first.
var denominations = []int{100, 50, 20, 10, 5, 2, 1}

func rs(v int) string { return fmt.Sprintf("Rs%d", v) }

// CoinBag is a bag of coins/notes: the machine's cash box, the customer's escrow, or a change set.
type CoinBag struct{ counts map[int]int }

func NewCoinBag() *CoinBag { return &CoinBag{counts: map[int]int{}} }

func (b *CoinBag) Add(d, n int) {
	c := b.counts[d] + n
	if c < 0 {
		panic("not enough " + rs(d))
	}
	if c == 0 {
		delete(b.counts, d)
	} else {
		b.counts[d] = c
	}
}
func (b *CoinBag) Count(d int) int { return b.counts[d] }
func (b *CoinBag) AddAll(o *CoinBag) {
	for d, n := range o.counts {
		b.Add(d, n)
	}
}
func (b *CoinBag) RemoveAll(o *CoinBag) {
	for d, n := range o.counts {
		b.Add(d, -n)
	}
}
func (b *CoinBag) Clear()        { b.counts = map[int]int{} }
func (b *CoinBag) IsEmpty() bool { return len(b.counts) == 0 }
func (b *CoinBag) Total() int {
	t := 0
	for d, n := range b.counts {
		t += d * n
	}
	return t
}
func (b *CoinBag) Copy() *CoinBag { c := NewCoinBag(); c.AddAll(b); return c }
func (b *CoinBag) String() string {
	keys := make([]int, 0, len(b.counts))
	for d := range b.counts {
		keys = append(keys, d)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(keys))) // Go maps are unordered: sort for stable output
	parts := []string{}
	for _, d := range keys {
		parts = append(parts, fmt.Sprintf("%s x%d", rs(d), b.counts[d]))
	}
	if len(parts) == 0 {
		return "nothing"
	}
	return strings.Join(parts, ", ")
}

// ---------- Strategy: how to make change from a LIMITED set of coins ----------
type ChangeStrategy interface {
	MakeChange(available *CoinBag, amount int) *CoinBag // nil if impossible
}

// GreedyChange takes the biggest coin that fits, repeatedly. Fast, but can fail when coins run low.
type GreedyChange struct{}

func (GreedyChange) MakeChange(available *CoinBag, amount int) *CoinBag {
	out, left := NewCoinBag(), amount
	for _, d := range denominations {
		k := min(available.Count(d), left/d)
		if k > 0 {
			out.Add(d, k)
			left -= k * d
		}
	}
	if left != 0 {
		return nil
	}
	return out
}

// DpChange solves bounded coin change: fewest coins using at most the coins we actually hold.
type DpChange struct{}

func (DpChange) MakeChange(available *CoinBag, amount int) *CoinBag {
	const inf = 1 << 29
	best := make([]int, amount+1) // best[a] = fewest coins for a so far
	for a := 1; a <= amount; a++ {
		best[a] = inf
	}
	take := make([][]int, len(denominations)) // how many of coin i we used for a
	for i, d := range denominations {
		take[i] = make([]int, amount+1)
		have := available.Count(d)
		next := make([]int, amount+1)
		for a := range next {
			next[a] = inf
			for k := 0; k <= have && k*d <= a; k++ {
				if best[a-k*d]+k < next[a] {
					next[a] = best[a-k*d] + k
					take[i][a] = k
				}
			}
		}
		best = next
	}
	if best[amount] >= inf {
		return nil
	}
	out, a := NewCoinBag(), amount
	for i := len(denominations) - 1; i >= 0; i-- { // walk the choices backwards
		if k := take[i][a]; k > 0 {
			out.Add(denominations[i], k)
			a -= k * denominations[i]
		}
	}
	return out
}

// ---------- Products and inventory ----------
type Product struct {
	Name  string
	Price int
}

type Slot struct {
	Product  Product
	Quantity int
}

type Inventory struct{ slots map[string]*Slot }

func (inv *Inventory) Add(code string, p Product, qty int) { inv.slots[code] = &Slot{p, qty} }
func (inv *Inventory) Get(code string) *Slot               { return inv.slots[code] }
func (inv *Inventory) TotalItems() int {
	n := 0
	for _, s := range inv.slots {
		n += s.Quantity
	}
	return n
}

// ---------- State pattern ----------
type State interface {
	Name() string
	InsertMoney(m *VendingMachine, d int)
	SelectProduct(m *VendingMachine, code string)
	Cancel(m *VendingMachine)
	Dispense(m *VendingMachine)
}

type IdleState struct{}

func (IdleState) Name() string { return "Idle" }
func (IdleState) InsertMoney(m *VendingMachine, d int) {
	m.escrow.Add(d, 1)
	fmt.Printf("Inserted %s. Balance Rs%d\n", rs(d), m.Balance())
	m.SetState(m.hasMoney)
}
func (IdleState) SelectProduct(*VendingMachine, string) { fmt.Println("Insert money first") }
func (IdleState) Cancel(*VendingMachine)                { fmt.Println("Nothing to refund") }
func (IdleState) Dispense(*VendingMachine)              { fmt.Println("Insert money first") }

type HasMoneyState struct{}

func (HasMoneyState) Name() string { return "HasMoney" }
func (HasMoneyState) InsertMoney(m *VendingMachine, d int) {
	m.escrow.Add(d, 1)
	fmt.Printf("Inserted %s. Balance Rs%d\n", rs(d), m.Balance())
}
func (HasMoneyState) SelectProduct(m *VendingMachine, code string) {
	slot := m.Inventory.Get(code)
	if slot == nil {
		fmt.Println("Invalid code " + code)
		return
	}
	p := slot.Product
	if slot.Quantity == 0 {
		fmt.Println(p.Name + " is sold out. Pick another item or cancel")
		return
	}
	balance := m.Balance()
	if balance < p.Price {
		fmt.Printf("Insufficient funds: %s costs Rs%d, inserted Rs%d. Insert Rs%d more\n",
			p.Name, p.Price, balance, p.Price-balance)
		return
	}
	// Change may use the machine's coins AND the customer's own coins.
	pool := m.cashBox.Copy()
	pool.AddAll(m.escrow)
	change := m.changeStrategy.MakeChange(pool, balance-p.Price)
	if change == nil {
		fmt.Printf("Cannot return Rs%d change. Exact change only: insert the exact amount or cancel\n", balance-p.Price)
		return
	}
	m.cashBox.AddAll(m.escrow) // commit: customer's money is now the machine's
	m.escrow.Clear()
	m.cashBox.RemoveAll(change) // reserve the change coins
	m.pendingCode, m.pendingChange = code, change
	m.SetState(m.dispensing)
	m.Dispense()
}
func (HasMoneyState) Cancel(m *VendingMachine) {
	m.refundEscrow()
	m.SetState(m.idle)
}
func (HasMoneyState) Dispense(*VendingMachine) { fmt.Println("Select a product first") }

type DispensingState struct{}

func (DispensingState) Name() string { return "Dispensing" }
func (DispensingState) InsertMoney(_ *VendingMachine, d int) {
	fmt.Println("Busy dispensing. Returned " + rs(d))
}
func (DispensingState) SelectProduct(*VendingMachine, string) {
	fmt.Println("Busy dispensing. Please wait")
}
func (DispensingState) Cancel(*VendingMachine) { fmt.Println("Too late to cancel. Dispensing") }
func (DispensingState) Dispense(m *VendingMachine) {
	slot := m.Inventory.Get(m.pendingCode)
	slot.Quantity--
	msg := "Dispensed " + slot.Product.Name
	if !m.pendingChange.IsEmpty() {
		msg += fmt.Sprintf(". Change Rs%d: %s", m.pendingChange.Total(), m.pendingChange)
	}
	fmt.Println(msg)
	m.pendingCode, m.pendingChange = "", nil
	if m.Inventory.TotalItems() == 0 {
		m.SetState(m.outOfService)
	} else {
		m.SetState(m.idle)
	}
}

type OutOfServiceState struct{}

func (OutOfServiceState) Name() string { return "OutOfService" }
func (OutOfServiceState) InsertMoney(_ *VendingMachine, d int) {
	fmt.Println("Out of service. Returned " + rs(d))
}
func (OutOfServiceState) SelectProduct(*VendingMachine, string) { fmt.Println("Out of service") }
func (OutOfServiceState) Cancel(*VendingMachine)                { fmt.Println("Out of service") }
func (OutOfServiceState) Dispense(*VendingMachine)              { fmt.Println("Out of service") }

// ---------- The machine (context): holds data, delegates every action to the current state ----------
type VendingMachine struct {
	idle, hasMoney, dispensing, outOfService State

	Inventory      *Inventory
	cashBox        *CoinBag // machine's own money, used for change
	escrow         *CoinBag // customer's money for the current sale
	changeStrategy ChangeStrategy
	pendingCode    string
	pendingChange  *CoinBag
	state          State
}

func NewVendingMachine(cs ChangeStrategy) *VendingMachine {
	m := &VendingMachine{
		idle: IdleState{}, hasMoney: HasMoneyState{}, dispensing: DispensingState{}, outOfService: OutOfServiceState{},
		Inventory: &Inventory{slots: map[string]*Slot{}},
		cashBox:   NewCoinBag(), escrow: NewCoinBag(), changeStrategy: cs,
	}
	m.state = m.idle
	return m
}

// Customer actions
func (m *VendingMachine) InsertMoney(d int)         { m.state.InsertMoney(m, d) }
func (m *VendingMachine) SelectProduct(code string) { m.state.SelectProduct(m, code) }
func (m *VendingMachine) Cancel()                   { m.state.Cancel(m) }
func (m *VendingMachine) Dispense()                 { m.state.Dispense(m) }

func (m *VendingMachine) SetState(s State)  { m.state = s }
func (m *VendingMachine) StateName() string { return m.state.Name() }
func (m *VendingMachine) Balance() int      { return m.escrow.Total() }

func (m *VendingMachine) refundEscrow() {
	fmt.Printf("Refunded Rs%d: %s\n", m.escrow.Total(), m.escrow)
	m.escrow.Clear()
}

// Admin actions
func (m *VendingMachine) LoadCash(d, n int) { m.cashBox.Add(d, n) }

func (m *VendingMachine) Restock(code string, qty int) {
	s := m.Inventory.Get(code)
	s.Quantity += qty
	fmt.Printf("Admin: restocked %s, now %d\n", s.Product.Name, s.Quantity)
}

// CollectCash takes out Rs50 and Rs100 notes. Smaller coins and notes stay behind for change.
func (m *VendingMachine) CollectCash() int {
	total := 0
	for _, d := range []int{100, 50} {
		n := m.cashBox.Count(d)
		m.cashBox.Add(d, -n)
		total += n * d
	}
	fmt.Printf("Admin: collected Rs%d. Left for change: %s\n", total, m.cashBox)
	return total
}

func (m *VendingMachine) SetOutOfService(down bool) {
	if down {
		if m.state != m.idle {
			fmt.Println("Admin: finish or cancel the current sale first")
			return
		}
		m.state = m.outOfService
		fmt.Println("Admin: machine is out of service")
		return
	}
	if m.Inventory.TotalItems() > 0 {
		m.state = m.idle
	} else {
		m.state = m.outOfService
	}
	fmt.Println("Admin: machine is back, state " + m.state.Name())
}

func main() {
	vm := NewVendingMachine(DpChange{})
	vm.Inventory.Add("A1", Product{"Coke", 40}, 2)
	vm.Inventory.Add("A2", Product{"Lays", 20}, 3)
	vm.Inventory.Add("A3", Product{"KitKat", 25}, 0)
	vm.LoadCash(10, 1)
	vm.LoadCash(5, 2)

	fmt.Println("== 1. Purchase with change ==")
	vm.InsertMoney(50)
	vm.SelectProduct("A1")
	fmt.Println("State: " + vm.StateName())

	fmt.Println("== 2. No change available ==")
	vm.InsertMoney(100)
	vm.SelectProduct("A2")
	fmt.Println("State: " + vm.StateName())
	vm.Cancel()

	fmt.Println("== 3. Insufficient funds ==")
	vm.InsertMoney(20)
	vm.SelectProduct("A1")
	vm.InsertMoney(20)
	vm.SelectProduct("A1")

	fmt.Println("== 4. Out of stock ==")
	vm.InsertMoney(20)
	vm.SelectProduct("A1")
	vm.SelectProduct("A3")
	vm.SelectProduct("A2")

	fmt.Println("== 5. Cancel and refund ==")
	vm.SelectProduct("A2")
	vm.InsertMoney(10)
	vm.InsertMoney(2)
	vm.Cancel()
	vm.Cancel()

	fmt.Println("== 6. Admin ==")
	vm.SetOutOfService(true)
	vm.InsertMoney(10)
	vm.Restock("A1", 5)
	vm.CollectCash()
	vm.SetOutOfService(false)

	fmt.Println("== 7. Greedy vs DP with limited coins ==")
	box := NewCoinBag()
	box.Add(50, 1)
	box.Add(20, 3)
	fmt.Printf("Box: %s. Change needed: Rs60\n", box)
	g := GreedyChange{}.MakeChange(box, 60)
	dp := DpChange{}.MakeChange(box, 60)
	if g == nil {
		fmt.Println("Greedy: fails (takes Rs50, then needs Rs10)")
	} else {
		fmt.Println("Greedy: " + g.String())
	}
	if dp == nil {
		fmt.Println("DP: fails")
	} else {
		fmt.Println("DP: " + dp.String())
	}
}`,
    },
  },
  diagrams: {
    classes: String.raw`classDiagram
  class VendingMachine {
    -State state
    -Inventory inventory
    -CoinBag cashBox
    -CoinBag escrow
    -ChangeStrategy changeStrategy
    +insertMoney(Denomination d)
    +selectProduct(String code)
    +cancel()
    +restock(String code, int qty)
    +collectCash() int
    +setOutOfService(bool down)
  }
  class State {
    <<interface>>
    +insertMoney(m, d)
    +selectProduct(m, code)
    +cancel(m)
    +dispense(m)
  }
  class IdleState
  class HasMoneyState
  class DispensingState
  class OutOfServiceState
  class Inventory {
    -Map~String,Slot~ slots
    +get(String code) Slot
    +totalItems() int
  }
  class Slot {
    +Product product
    +int quantity
  }
  class Product {
    +String name
    +int price
  }
  class CoinBag {
    -Map~Denomination,int~ counts
    +add(Denomination d, int n)
    +total() int
  }
  class Denomination {
    <<enumeration>>
    HUNDRED
    FIFTY
    TWENTY
    TEN
    FIVE
    TWO
    ONE
  }
  class ChangeStrategy {
    <<interface>>
    +makeChange(CoinBag available, int amount) CoinBag
  }
  class GreedyChange
  class DpChange
  VendingMachine o-- State
  VendingMachine *-- Inventory
  VendingMachine *-- CoinBag
  VendingMachine o-- ChangeStrategy
  Inventory *-- Slot
  Slot --> Product
  CoinBag ..> Denomination
  State <|.. IdleState
  State <|.. HasMoneyState
  State <|.. DispensingState
  State <|.. OutOfServiceState
  ChangeStrategy <|.. GreedyChange
  ChangeStrategy <|.. DpChange`,
    states: String.raw`stateDiagram-v2
  [*] --> Idle
  Idle --> HasMoney: insert money
  HasMoney --> HasMoney: more money or failed select
  HasMoney --> Idle: cancel, refund escrow
  HasMoney --> Dispensing: select OK, change reserved
  Dispensing --> Idle: product and change out
  Dispensing --> OutOfService: last item sold
  Idle --> OutOfService: admin maintenance
  OutOfService --> Idle: admin back in service`,
    purchase: String.raw`sequenceDiagram
  actor User
  participant VM as VendingMachine
  participant St as Current state
  participant Inv as Inventory
  participant CS as ChangeStrategy
  User->>VM: insertMoney(Rs50)
  VM->>St: Idle.insertMoney
  St-->>VM: escrow = Rs50, state = HasMoney
  User->>VM: selectProduct(A1)
  VM->>St: HasMoney.selectProduct
  St->>Inv: get(A1)
  Inv-->>St: Coke, Rs40, qty 2
  St->>CS: makeChange(cashBox + escrow, Rs10)
  alt no way to make change
    CS-->>St: none
    St-->>User: exact change only, money kept in escrow
  else change found
    CS-->>St: Rs10 x1
    St->>VM: move escrow to cashBox, remove change, state = Dispensing
    VM->>St: Dispensing.dispense
    St->>Inv: quantity - 1
    St-->>User: Coke and Rs10 change
    St->>VM: state = Idle
  end`,
  },
});
