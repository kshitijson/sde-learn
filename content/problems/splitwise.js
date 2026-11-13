SD.register({
  id: "splitwise",
  html: String.raw`
<p class="lead">"Design Splitwise" is one of the most asked machine-coding rounds in India: Flipkart, PhonePe, Razorpay, Swiggy, CRED and Atlassian have all used it. Everyone has split a Goa trip or a flat's grocery bill, so the domain needs no explanation. What it tests is precision. Money must add up to the last paisa, four different split types must validate their input, balances must stay consistent, and "simplify debts" hides a genuinely hard algorithm question. This page builds the full answer: integer paise, the four split strategies, a pairwise balance sheet, the greedy min-cash-flow simplification (and why the perfect version is NP-hard), and runnable code in five languages.</p>

<h2>Problem statement</h2>
<p>Design an expense-sharing app like Splitwise. Users create groups (a flat, a trip, an office lunch gang) and add expenses. Each expense has one payer, a total amount, the people it is split between, and a split type:</p>
<ul>
<li><strong>EQUAL:</strong> Rs 1,000 between 3 people.</li>
<li><strong>EXACT:</strong> Aarav owes Rs 2,000, Bhavna Rs 1,000, Chirag Rs 1,500, Diya Rs 1,500.</li>
<li><strong>PERCENT:</strong> 40%, 20%, 20%, 20%.</li>
<li><strong>SHARES:</strong> weights 1 : 2 : 4 (for example by nights stayed or people in a family).</li>
</ul>
<p>The app shows who owes whom, lets users settle up (record a payment), shows the expense history, and can <em>simplify debts</em>: replace a tangle of IOUs with the fewest payments that settle everyone.</p>

<div class="callout tip"><strong>Try it first</strong>Before reading on, take 10 minutes. Split Rs 1,000 equally between 3 people. What exactly does each person owe, and where does the extra paisa go? Then: Aarav is owed Rs 700 in total, Bhavna owes Rs 400 and Chirag owes Rs 300. Diya owes Rs 500 and Esha is owed Rs 500. What is the smallest number of payments that settles everyone?</div>

<details class="hint"><summary>Hint 1: Money is an integer</summary>
<p>Never use <code>float</code> or <code>double</code> for money. 0.1 + 0.2 is not 0.3 in binary floating point, and the errors pile up across thousands of expenses. Store every amount as a whole number of paise (Rs 3,250.50 = 325050 paise) in a 64-bit integer. Then the only rounding happens in one place, the split, and you control it.</p>
</details>
<details class="hint"><summary>Hint 2: Split types are interchangeable algorithms</summary>
<p>All four split types take a total and the participants, and return an amount per person. They differ only in the inputs they need and how they validate them (EXACT must add up to the total, PERCENT must add up to 100). That is the Strategy pattern. The expense manager does not care which split was used once it has the per-person amounts.</p>
</details>
<details class="hint"><summary>Hint 3: Only the net balance matters for settling</summary>
<p>For settling up, it does not matter who paid for what. Each person's net balance is (what they paid) minus (what they owe). Positive means the group owes them; negative means they owe the group. The net balances always sum to zero. Any set of payments that brings every net to zero settles the group.</p>
</details>

<h2>Requirements</h2>
<p>Good clarifying questions: Only one payer per expense, or several? Do we need groups, or also one-to-one expenses? Single currency? Should balances be per group or across all groups? Is simplify-debts on by default? Do we need to edit or delete expenses?</p>
<div class="grid-2">
<div class="card">
<h3>Functional</h3>
<ul>
<li>Register users; create groups with members.</li>
<li>Add an expense: payer, amount, description, participants, split type (EQUAL, EXACT, PERCENT, SHARES) with its values.</li>
<li>Validate: amount positive, everyone in the group, EXACT sums to the total, PERCENT sums to 100, SHARES positive.</li>
<li>Show balances: "X owes Y Rs Z" for every pair, and each person's net.</li>
<li>Settle up: record a payment from one user to another.</li>
<li>Simplify debts: suggest a small set of payments that settles the group.</li>
<li>Expense history per group.</li>
</ul>
</div>
<div class="card">
<h3>Non-functional</h3>
<ul>
<li><strong>Exactness:</strong> the shares of an expense add up to its total, to the paisa, every time.</li>
<li><strong>Determinism:</strong> the same expense always splits the same way (the same person gets the extra paisa).</li>
<li><strong>Consistency:</strong> an expense updates all affected balances or none.</li>
<li><strong>Extensible:</strong> new split types (by item, by adjustment), multiple payers, multi-currency.</li>
<li><strong>Scale:</strong> groups are small (2 to 50 people). Simplification runs per group, so even O(n²) is fine.</li>
</ul>
</div>
</div>

<h2>How to approach the machine-coding round</h2>
<div class="callout info"><strong>Time plan for a 60 to 90 minute round</strong>
<table>
<thead><tr><th>Minutes</th><th>What you do</th></tr></thead>
<tbody>
<tr><td>0 to 8</td><td>Clarify: one payer or many, groups, currency, simplification. State that money will be integer paise.</td></tr>
<tr><td>8 to 15</td><td>List entities and the <code>SplitStrategy</code> interface. Decide how balances are stored.</td></tr>
<tr><td>15 to 50</td><td>Code <code>distribute()</code> and the four strategies with validation, then <code>BalanceSheet</code>, then <code>ExpenseManager.addExpense</code>, show balances and settle up.</td></tr>
<tr><td>50 to 65</td><td>Add <code>simplifyDebts()</code> with the greedy algorithm. Write the demo: a trip with every split type plus two invalid expenses.</td></tr>
<tr><td>65 to 90</td><td>Walk through it. Explain the rounding rule, why greedy is not always optimal, and how you would persist it.</td></tr>
</tbody>
</table>
<p>Many companies give this as a command-line problem: read lines like <code>EXPENSE u1 1000 4 u1 u2 u3 u4 EQUAL</code> and print balances. If so, keep parsing in a thin layer at the edge. The evaluator wants to see the model, not a giant <code>switch</code> on input strings.</p>
<p><strong>What evaluators check:</strong></p>
<ol>
<li><strong>Money handling:</strong> integers, no floats, shares that sum exactly to the total.</li>
<li><strong>Strategy for splits</strong> with validation inside each strategy, not in one long <code>if</code> chain.</li>
<li><strong>A clean balance model</strong> that cannot drift out of sync.</li>
<li><strong>Edge cases in the demo:</strong> rounding, invalid input, settle up.</li>
<li><strong>Simplify debts:</strong> correct, and an honest answer about optimality.</li>
</ol>
</div>

<h2>Core entities</h2>
<table>
<thead><tr><th>Entity</th><th>Kind</th><th>Responsibility</th></tr></thead>
<tbody>
<tr><td><code>User</code></td><td>Entity</td><td>Id and name (plus phone, email, UPI id in a real app).</td></tr>
<tr><td><code>Group</code></td><td>Entity</td><td>Members and the expense history.</td></tr>
<tr><td><code>Expense</code></td><td>Entity (immutable)</td><td>Id, description, payer, amount in paise, split type, and the list of <code>Share</code>s it produced.</td></tr>
<tr><td><code>Share</code></td><td>Value object</td><td>(user, paise owed) for one participant of one expense.</td></tr>
<tr><td><code>SplitType</code></td><td>Enum</td><td>EQUAL, EXACT, PERCENT, SHARES.</td></tr>
<tr><td><code>SplitStrategy</code></td><td>Interface (Strategy)</td><td><code>split(total, n, values)</code> returns paise per participant or rejects bad input.</td></tr>
<tr><td><code>BalanceSheet</code></td><td>Service</td><td>Pairwise balances. <code>record(creditor, debtor, amount)</code> keeps both directions in sync.</td></tr>
<tr><td><code>ExpenseManager</code></td><td>Facade</td><td>Adds expenses, settles up, prints balances, simplifies debts.</td></tr>
<tr><td><code>Transfer</code></td><td>Value object</td><td>(from, to, amount): one suggested payment.</td></tr>
</tbody>
</table>

<h2>Class diagram</h2>
<div data-diagram="classes" data-caption="The manager picks a SplitStrategy by type, stores the Expense in its Group, and updates the BalanceSheet."></div>

<h2>Adding an expense, step by step</h2>
<div data-diagram="add" data-caption="Validation happens before any balance changes, so a rejected expense leaves no trace."></div>
<ol class="steps">
<li>Check the amount is positive and that the payer and every participant are members of the group.</li>
<li>Look up the strategy for the split type and call <code>split(total, n, values)</code>. The strategy validates its own inputs and throws (or returns an error) if they are wrong.</li>
<li>For each participant other than the payer, record "participant owes payer this share" in the balance sheet. The payer's own share needs no entry: you do not owe yourself.</li>
<li>Store the immutable <code>Expense</code> with its computed shares in the group's history, so the history shows exactly what each person was charged.</li>
</ol>
<p>The order is the point. All checks happen first, and balances change only after the split succeeded. In a database, steps 3 and 4 run inside one transaction.</p>

<h2>The four split types</h2>
<table>
<thead><tr><th>Type</th><th>Values the user gives</th><th>Validation</th><th>Example (demo)</th></tr></thead>
<tbody>
<tr><td><strong>EQUAL</strong></td><td>Nothing extra</td><td>At least one participant</td><td>Rs 1,000 scooters, 3 people: 333.34 + 333.33 + 333.33</td></tr>
<tr><td><strong>EXACT</strong></td><td>Paise per person</td><td>No negatives; must sum to the total exactly</td><td>Rs 6,000 scuba: 2,000 + 1,000 + 1,500 + 1,500</td></tr>
<tr><td><strong>PERCENT</strong></td><td>Percent per person</td><td>No negatives; must sum to 100</td><td>Rs 3,250.50 dinner at 40/20/20/20: 1,300.20 + 650.10 × 3</td></tr>
<tr><td><strong>SHARES</strong></td><td>Weight per person</td><td>Every weight positive</td><td>Rs 1,000 cab at 1:2:4: 142.86 + 285.72 + 571.42</td></tr>
</tbody>
</table>
<p>EQUAL, PERCENT and SHARES are the same computation with different weights: EQUAL is "weight 1 each", PERCENT is "weights that sum to 100". So all three call one helper, <code>distribute(total, weights)</code>. Only the validation differs. EXACT skips the helper and just checks the sum. Real apps accept percentages with two decimals (33.33%). Handle that by taking basis points (1/100 of a percent, so 33.33% = 3333) and checking they sum to 10,000.</p>

<h2>Money in paise, and the leftover paisa</h2>
<p>Rs 1,000 split three ways is 100,000 paise / 3 = 33,333.33... paise. Nobody can pay a third of a paisa. Whatever rule you pick, the shares must add back to exactly 100,000, and the same input must always give the same output. The rule used here:</p>
<ol class="steps">
<li>Compute each share as <code>floor(total × weight / sum of weights)</code>. Use integer arithmetic only: multiply first, then divide.</li>
<li>Add them up. The leftover is <code>total - sum of floors</code>. It is always less than the number of participants.</li>
<li>Give 1 extra paisa to each of the first <code>leftover</code> participants, in the order they were listed.</li>
</ol>
<p>Two examples from the demo:</p>
<ul>
<li><strong>Scooters, Rs 1,000, EQUAL among Bhavna, Chirag, Diya.</strong> Floors: 33,333 each = 99,999. Leftover 1 paisa goes to Bhavna (first in the list): 333.34, 333.33, 333.33.</li>
<li><strong>Cab, Rs 1,000, SHARES 1:2:4 among Aarav, Bhavna, Diya.</strong> Floors: 100,000 × 1/7 = 14,285, × 2/7 = 28,571, × 4/7 = 57,142. Sum 99,998, leftover 2: Aarav and Bhavna get +1 each, giving 142.86, 285.72 and 571.42.</li>
</ul>
<p>A slightly fairer rule is the <em>largest remainder</em> method: give the extra paise to the people whose exact share had the biggest fractional part (Diya's 57,142.86 would get it before Bhavna's 28,571.43). Either rule is fine in an interview if it is deterministic and you can explain it. What is not fine: rounding each share independently (Rs 333.33 × 3 = Rs 999.99, and a paisa disappears), or using floating point and hoping.</p>
<p>Overflow check: amounts up to Rs 1 crore are 10<sup>9</sup> paise. Multiplied by a weight up to 10,000 that is 10<sup>13</sup>, far below the 9.2 × 10<sup>18</sup> limit of a 64-bit integer. A 32-bit <code>int</code> would overflow, so use <code>long</code> / <code>int64</code>.</p>

<h2>Storing balances</h2>
<p>There are two useful views, and the design keeps the first and derives the second:</p>
<div class="grid-2">
<div class="card">
<h3>Pairwise balances</h3>
<p><code>balance[a][b] &gt; 0</code> means b owes a. Every update writes both <code>balance[a][b]</code> and <code>balance[b][a]</code> with opposite signs, inside one method, so they cannot drift apart. This is what the app shows when simplification is off: "Bhavna owes Chirag Rs 666.67" already nets the Rs 1,000 she owes him for scuba against the Rs 333.33 he owes her for scooters.</p>
</div>
<div class="card">
<h3>Net balance per person</h3>
<p>The sum of a person's row: positive means they get money back, negative means they owe. Nets across a group always sum to zero. This is all that simplification needs, and it is O(n) to store. You can compute it from the pairwise map, or keep it as a separate counter updated in the same transaction.</p>
</div>
</div>
<p>A third option is to store no balances at all and recompute them from the full list of expenses and payments when needed. That is the <em>ledger</em> or event-sourcing approach. It is the source of truth in a real system (balances are a cache that can be rebuilt), but recomputing on every screen load is wasteful for big groups. See <a href="#/p/schema-design">schema design</a> for the tables.</p>

<h2>Simplify debts</h2>
<p>After a trip, the pairwise view can have an edge between almost every pair of people. Here are the six balances from the demo's Goa trip:</p>
<div data-diagram="before" data-caption="Before: 6 pairwise debts between 4 friends (arrow points from debtor to creditor)."></div>
<p>Settling these one by one takes 6 UPI payments. But only the nets matter: Aarav is owed Rs 6,556.94, Chirag is owed Rs 516.57, Bhavna owes Rs 4,269.16 and Diya owes Rs 2,804.35. Any set of payments that zeroes those four numbers settles the trip.</p>
<h3>The greedy algorithm (min cash flow)</h3>
<ol class="steps">
<li>Compute every person's net balance.</li>
<li>Pick the biggest creditor (largest positive net) and the biggest debtor (most negative net).</li>
<li>The debtor pays the creditor <code>min(credit, -debt)</code>. That zeroes at least one of them.</li>
<li>Repeat until everyone is at zero.</li>
</ol>
<p>On the Goa numbers: Bhavna pays Aarav Rs 4,269.16 (Bhavna is done; Aarav still needs 2,287.78). Diya pays Aarav Rs 2,287.78 (Aarav done; Diya still owes 516.57). Diya pays Chirag Rs 516.57. Everyone is at zero after <strong>3 payments instead of 6</strong>.</p>
<div data-diagram="after" data-caption="After: 3 payments settle the same trip."></div>
<p>Each round zeroes at least one person, so greedy never needs more than <strong>n - 1</strong> payments for n people with non-zero balances. Finding the max each round is O(n), so the whole thing is O(n²): instant for a group of 50. With a max-heap of creditors and one of debtors it becomes O(n log n), which is worth mentioning but not worth coding in a round.</p>
<h3>Is greedy optimal? No, and the optimal version is NP-hard</h3>
<p>Greedy is excellent in practice, but not always minimal. Take five friends with nets (in rupees) Aarav -700, Bhavna -500, Chirag +300, Diya +400, Esha +500:</p>
<table>
<thead><tr><th>Approach</th><th>Payments</th><th>Count</th></tr></thead>
<tbody>
<tr><td>Greedy</td><td>Aarav → Esha 500, Bhavna → Diya 400, Aarav → Chirag 200, Bhavna → Chirag 100</td><td>4</td></tr>
<tr><td>Optimal</td><td>Bhavna → Esha 500, Aarav → Diya 400, Aarav → Chirag 300</td><td>3</td></tr>
</tbody>
</table>
<p>The optimal answer spots that Bhavna and Esha cancel exactly, and that {Aarav, Chirag, Diya} also sums to zero. In general, the fewest payments equals <strong>n minus the largest number of groups you can split the people into where each group sums to zero</strong>, since a zero-sum group of size k needs exactly k - 1 payments. Finding that best split is a generalisation of the subset-sum problem, which is NP-hard: no known algorithm is fast for every input. For small groups (up to about 15 to 20 people), a bitmask DP over subsets finds the exact optimum in O(2<sup>n</sup> × n) time. For anything bigger, use greedy.</p>
<div class="callout info"><strong>What a real app adds</strong>Splitwise does not publish its exact algorithm, but any simplification must keep every person's net balance unchanged; it only changes who pays whom. Products also add soft rules on top, such as preferring payments between people who already owed each other, so nobody is asked to pay a near-stranger. In an interview, describe greedy, state the n - 1 bound, and say "the true minimum is NP-hard in general, so greedy is the practical choice". That is the answer interviewers want.</div>
<p>One more practical detail: simplification is a <em>suggestion</em>. You do not rewrite the stored pairwise balances. When someone pays according to the suggestion, it is recorded as a normal settle-up payment.</p>

<h2>Design patterns used and why</h2>
<h3>Strategy: split types</h3>
<p>Each split type is a class implementing <code>SplitStrategy</code>. Each owns its own validation, which is where most bugs hide. Adding "split by adjustment" (equal split, then +Rs 200 for the person who had the extra drink) or "split by item" (each item of a Swiggy bill assigned to people) is one new class plus one enum value. <code>ExpenseManager.addExpense</code> does not change (open/closed principle). See <a href="#/p/behavioral-patterns">behavioural patterns</a>.</p>
<h3>Factory (registry) for picking the strategy</h3>
<p>The manager keeps a map from <code>SplitType</code> to a strategy instance. That is a tiny factory: callers say "PERCENT", not <code>new PercentSplit()</code>. Strategies hold no state, so one shared instance each is enough. See <a href="#/p/creational-patterns">creational patterns</a>.</p>
<h3>Facade: ExpenseManager</h3>
<p>Callers (a CLI, a REST controller, tests) talk to one class with a few methods: add user, create group, add expense, settle up, show balances, simplify. The balance sheet and strategies stay hidden behind it.</p>
<h3>Observer: notifications (extension)</h3>
<p>"Diya added 'Dinner at Thalassa' (you owe Rs 1,300.20)" push notifications and emails are listeners on an <code>ExpenseAdded</code> event. The core does not know they exist.</p>
<h3>What about Singleton?</h3>
<p>Do not make <code>ExpenseManager</code> a Singleton. Tests need fresh instances, and a real server wires it up with a database and passes it in. Create one in <code>main</code>.</p>

<h2>Full implementation</h2>
<p>Each tab is one self-contained file that compiles and runs. Money is integer paise in a 64-bit type. The demo is a Goa trip for four friends: five valid expenses covering every split type, two invalid ones that must be rejected, then balances, nets, the simplified payments, a settle-up, and the expense history.</p>
<div data-code="full"></div>
<p>Expected output (identical in every language):</p>
<pre><code>== Expenses ==
#1 Villa in Anjuna: Aarav paid Rs 12000.00, EQUAL -&gt; Aarav Rs 3000.00, Bhavna Rs 3000.00, Chirag Rs 3000.00, Diya Rs 3000.00
#2 Scooter rentals: Bhavna paid Rs 1000.00, EQUAL -&gt; Bhavna Rs 333.34, Chirag Rs 333.33, Diya Rs 333.33
#3 Scuba diving: Chirag paid Rs 6000.00, EXACT -&gt; Aarav Rs 2000.00, Bhavna Rs 1000.00, Chirag Rs 1500.00, Diya Rs 1500.00
#4 Dinner at Thalassa: Diya paid Rs 3250.50, PERCENT -&gt; Aarav Rs 1300.20, Bhavna Rs 650.10, Chirag Rs 650.10, Diya Rs 650.10
#5 Airport cab: Aarav paid Rs 1000.00, SHARES -&gt; Aarav Rs 142.86, Bhavna Rs 285.72, Diya Rs 571.42
Rejected 'Souvenirs': exact amounts add up to Rs 400.00, not Rs 500.00
Rejected 'Parasailing': percentages add up to 90, not 100
== Balances ==
  Bhavna owes Aarav Rs 3285.72
  Chirag owes Aarav Rs 1000.00
  Diya owes Aarav Rs 2271.22
  Bhavna owes Chirag Rs 666.67
  Diya owes Chirag Rs 849.90
  Bhavna owes Diya Rs 316.77
== Net per person ==
  Aarav gets back Rs 6556.94
  Bhavna owes Rs 4269.16
  Chirag gets back Rs 516.57
  Diya owes Rs 2804.35
== Simplified settlements ==
  Bhavna pays Aarav Rs 4269.16
  Diya pays Aarav Rs 2287.78
  Diya pays Chirag Rs 516.57
== Diya pays Aarav Rs 2271.22 (settle up) ==
  Bhavna owes Aarav Rs 3285.72
  Chirag owes Aarav Rs 1000.00
  Bhavna owes Chirag Rs 666.67
  Diya owes Chirag Rs 849.90
  Bhavna owes Diya Rs 316.77
== Simplified after settling ==
  Bhavna pays Aarav Rs 4269.16
  Diya pays Chirag Rs 516.57
  Diya pays Aarav Rs 16.56
== Goa trip: expense history ==
  #1 Villa in Anjuna, Rs 12000.00 paid by Aarav (EQUAL)
  #2 Scooter rentals, Rs 1000.00 paid by Bhavna (EQUAL)
  #3 Scuba diving, Rs 6000.00 paid by Chirag (EXACT)
  #4 Dinner at Thalassa, Rs 3250.50 paid by Diya (PERCENT)
  #5 Airport cab, Rs 1000.00 paid by Aarav (SHARES)</code></pre>
<p>Things to point out when you walk the interviewer through it:</p>
<ul>
<li><strong>Every split adds up.</strong> 333.34 + 333.33 + 333.33 = 1,000.00, and 142.86 + 285.72 + 571.42 = 1,000.00. The leftover paise go to the first participants, so reruns give the same result.</li>
<li><strong>Rejected expenses change nothing.</strong> The souvenirs (EXACT summing to Rs 400 for a Rs 500 bill) and parasailing (percentages summing to 90) are refused before any balance is touched, and they never appear in the history.</li>
<li><strong>Pairwise balances are netted.</strong> Bhavna owes Chirag Rs 1,000 for scuba and Chirag owes her Rs 333.33 for scooters. The sheet shows only "Bhavna owes Chirag Rs 666.67".</li>
<li><strong>Settle up is just a reverse entry.</strong> Diya pays Aarav exactly what she owed him, and that pair disappears from the balances. Under the hood it is <code>record(from, to, amount)</code>, the same call an expense uses.</li>
<li><strong>Greedy is not always pretty.</strong> After the settle-up, the suggestion includes a Rs 16.56 payment. Diya owes Rs 533.13 in total, and greedy lets Bhavna's larger debt use up almost all of Aarav's credit first, leaving a small remainder for Diya. An optimal or "prefer existing edges" variant could avoid such small leftovers.</li>
<li><strong>Determinism in Go.</strong> Go maps iterate in random order, so the code keeps users in a slice in registration order and loops over that.</li>
</ul>

<h2>Concurrency, persistence and extensibility</h2>
<h3>Concurrency</h3>
<p>Two friends add expenses to the same group at the same moment from their phones. Each expense updates several balances. If two updates interleave on <code>balance[a][b]</code> (read 500, read 500, write 800, write 700), one update is lost and the group's nets no longer sum to zero.</p>
<ul>
<li><strong>In memory:</strong> one lock per group around "split, update balances, append expense". Groups are independent, so different groups never contend. A single global lock also works for the round.</li>
<li><strong>In a database:</strong> insert the expense, its share rows and the balance updates in <strong>one transaction</strong>. Update balances with <code>UPDATE balances SET amount = amount + ?</code> (an atomic increment) rather than read-modify-write in the app, or lock the group row with <code>SELECT ... FOR UPDATE</code>.</li>
<li><strong>Retries:</strong> a phone on a flaky network may send the same "add expense" twice. Send a client-generated <em>idempotency key</em> with the request and store it with a unique constraint, so the second insert is ignored. The same applies to settle-up payments made through UPI (Razorpay and PhonePe callbacks can arrive twice).</li>
</ul>
<p>More on locks and atomic updates in <a href="#/p/concurrency">concurrency</a>, and on transactions in <a href="#/p/transactions">transactions</a>.</p>

<h3>Persistence</h3>
<pre><code>users(id, name, phone, email)
groups(id, name, created_by)
group_members(group_id, user_id)
expenses(id, group_id, paid_by, amount_paise, currency, split_type,
         description, created_at, idempotency_key UNIQUE)
expense_shares(expense_id, user_id, owed_paise)
payments(id, group_id, from_user, to_user, amount_paise, created_at)
balances(group_id, user_a, user_b, amount_paise)   -- user_a &lt; user_b; sign gives direction</code></pre>
<p>Storing each pair once with <code>user_a &lt; user_b</code> halves the rows and removes the risk of the two directions disagreeing. The <code>balances</code> table is a cache: it can always be rebuilt from <code>expense_shares</code> and <code>payments</code>.</p>

<div class="tabs">
<section data-tab="Edit and delete">
<p>Never update an expense's numbers in place. To delete, apply the reverse of its shares to the balances and mark it deleted (keep it for the history). To edit, reverse the old version and apply the new one in the same transaction. The expense row keeps a version number so two people editing at once do not silently overwrite each other (optimistic locking).</p>
</section>
<section data-tab="Multiple payers">
<p>"Aarav paid Rs 8,000 and Bhavna paid Rs 4,000 of the villa." Make the payer side a list of (user, paid amount) that must sum to the total, just like EXACT. Each person's net effect is paid minus owed. Pairwise entries then need a rule (for example, spread each debtor's share across payers in proportion to what they paid), or you keep only net balances per group.</p>
</section>
<section data-tab="Multi-currency">
<p>A Bangkok trip has expenses in THB and INR. Store the currency on every expense and keep balances per currency. Convert only when settling, at the rate of the day, and record the rate used. Never convert at insert time, or the balances change meaning when rates move.</p>
</section>
<section data-tab="Across groups">
<p>The home screen shows "overall, you owe Rs 1,240". That is the sum of your net balances across all groups. Simplification stays per group by default, because merging debts across a flat and a trip surprises people.</p>
</section>
</div>

<h2>Common mistakes</h2>
<div class="callout warn"><strong>Things that lose marks</strong>
<ul>
<li>Using <code>double</code> for money, or rounding each share separately so a paisa disappears.</li>
<li>Non-deterministic remainder handling (giving the extra paisa to a random person).</li>
<li>Validating in the manager with a long <code>if/else</code> on split type, instead of inside each strategy.</li>
<li>Updating balances before validation, so a rejected expense leaves half its updates behind.</li>
<li>Updating <code>balance[a][b]</code> without <code>balance[b][a]</code>, so the two directions disagree.</li>
<li>Claiming greedy simplification gives the minimum number of payments in every case.</li>
<li>Iterating a hash map to print balances, so the output order changes between runs.</li>
<li>No answer for two people adding expenses at the same time.</li>
</ul>
</div>

<div class="callout interview"><strong>Say this in the interview</strong>"All money is integer paise in a 64-bit long. Each split type is a Strategy that validates its own input: EXACT must sum to the total, PERCENT to 100, SHARES must be positive. EQUAL, PERCENT and SHARES share one distribute helper that floors each share and gives leftover paise to the first participants, so shares always add up exactly and deterministically. Balances are pairwise, updated in both directions in one method, and each person's net is the sum of their row. To simplify debts I use greedy min cash flow: the biggest debtor pays the biggest creditor until everyone is at zero. That needs at most n - 1 payments. The true minimum is NP-hard in general, so greedy is the practical choice. Concurrent expenses on a group go through one lock per group, or one database transaction with an idempotency key."</div>

<h2>Follow-up questions</h2>
<div class="quiz">
<details><summary>Split Rs 100 equally between 3 people. What does each person owe?</summary><div>10,000 paise / 3 = 3,333 each with 1 paisa left over. With the first-in-list rule: Rs 33.34, Rs 33.33, Rs 33.33, which sums to exactly Rs 100. Rounding each share separately would give Rs 33.33 × 3 = Rs 99.99, losing a paisa.</div></details>
<details><summary>Why not use double for money?</summary><div>Binary floating point cannot represent most decimal fractions exactly (0.1 + 0.2 = 0.30000000000000004). Errors accumulate over many expenses, and comparisons like "do the exact amounts sum to the total?" fail randomly. Integer paise in a 64-bit type are exact, fast and big enough. Java's <code>BigDecimal</code> also works but is slower and clumsier.</div></details>
<details><summary>How does the greedy simplification work, and how many payments can it need?</summary><div>Compute each person's net balance. Repeatedly let the biggest debtor pay the biggest creditor the smaller of the two amounts. Each payment zeroes at least one person, so it needs at most n - 1 payments for n people with non-zero balances. It is O(n²) with linear scans, or O(n log n) with two heaps.</div></details>
<details><summary>Is the greedy result always the minimum number of payments?</summary><div>No. With nets -700, -500, +300, +400, +500, greedy makes 4 payments but 3 suffice (-500 pays +500 directly; -700 pays +300 and +400). The minimum is n minus the maximum number of disjoint zero-sum groups, and finding that is NP-hard (it generalises subset sum). For small groups a bitmask DP over subsets finds the optimum; otherwise greedy is the practical choice.</div></details>
<details><summary>Two friends add an expense to the same group at the same time. What can go wrong and how do you prevent it?</summary><div>Both read the same balance, both add their share, both write: one update is lost and the nets stop summing to zero. In memory, take a lock per group around split-update-append. In a database, write the expense, shares and balance changes in one transaction with atomic increments, or lock the group row. Add an idempotency key so a retried request does not create a duplicate expense.</div></details>
<details><summary>How would you support editing an expense?</summary><div>Treat expenses as immutable records. In one transaction, apply the reverse of the old shares to the balances, apply the new shares, and save the new version (keeping the old one for history). A version number on the expense row gives optimistic locking, so two simultaneous edits do not overwrite each other silently.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
<li>Money is integer paise in a 64-bit type. Rounding happens in exactly one place: the split.</li>
<li>Floor every share, then hand leftover paise to participants in a fixed order. Shares then sum exactly, every time.</li>
<li>Each split type is a Strategy with its own validation. EQUAL, PERCENT and SHARES share one weighted distribute helper.</li>
<li>Validate first, then update both directions of every pairwise balance in one step (one transaction in a database).</li>
<li>Simplify debts with greedy min cash flow: at most n - 1 payments. The true minimum is NP-hard; say so.</li>
<li>Concurrency: one lock per group or one DB transaction, plus idempotency keys for retried requests.</li>
</ul></div>
`,
  code: {
    full: {
      title: "Splitwise: four split strategies, balances, settle up, simplify debts (single file, runnable)",
      java: String.raw`// Splitwise: users, groups, four split strategies, balances, settle up and simplify debts.
// Money is always a long number of paise (1 rupee = 100 paise).
// Run: javac SplitwiseDemo.java && java SplitwiseDemo
import java.util.*;

public class SplitwiseDemo {

    static String rs(long paise) {
        String sign = paise < 0 ? "-" : "";
        long p = Math.abs(paise);
        return sign + "Rs " + (p / 100) + "." + String.format("%02d", p % 100);
    }

    // Shares 'total' in proportion to 'weights'. Floors every share, then hands the
    // leftover paise, one each, to the first participants in the list (deterministic).
    static long[] distribute(long total, long[] weights) {
        long sum = 0, given = 0;
        for (long w : weights) sum += w;
        long[] out = new long[weights.length];
        for (int i = 0; i < weights.length; i++) { out[i] = total * weights[i] / sum; given += out[i]; }
        for (int i = 0; given < total; i++, given++) out[i]++;
        return out;
    }

    static long sum(long[] v) { long s = 0; for (long x : v) s += x; return s; }

    enum SplitType { EQUAL, EXACT, PERCENT, SHARES }

    // ---------- Strategy: how one expense is split ----------
    interface SplitStrategy {
        long[] split(long total, int n, long[] values); // throws IllegalArgumentException on bad input
    }

    static class EqualSplit implements SplitStrategy {
        public long[] split(long total, int n, long[] values) {
            long[] w = new long[n];
            Arrays.fill(w, 1);
            return distribute(total, w);
        }
    }

    static class ExactSplit implements SplitStrategy {
        public long[] split(long total, int n, long[] values) {
            if (values.length != n) throw new IllegalArgumentException("need one amount per person");
            for (long v : values) if (v < 0) throw new IllegalArgumentException("amounts cannot be negative");
            if (sum(values) != total)
                throw new IllegalArgumentException("exact amounts add up to " + rs(sum(values)) + ", not " + rs(total));
            return values.clone();
        }
    }

    static class PercentSplit implements SplitStrategy {
        public long[] split(long total, int n, long[] values) {
            if (values.length != n) throw new IllegalArgumentException("need one percentage per person");
            for (long v : values) if (v < 0) throw new IllegalArgumentException("percentages cannot be negative");
            if (sum(values) != 100) throw new IllegalArgumentException("percentages add up to " + sum(values) + ", not 100");
            return distribute(total, values);
        }
    }

    static class ShareSplit implements SplitStrategy {
        public long[] split(long total, int n, long[] values) {
            if (values.length != n) throw new IllegalArgumentException("need one share count per person");
            for (long v : values) if (v <= 0) throw new IllegalArgumentException("shares must be positive");
            return distribute(total, values);
        }
    }

    record Share(String userId, long amount) {}

    record Expense(int id, String description, String paidBy, long amount, SplitType type, List<Share> shares) {}

    static class Group {
        final String id, name;
        final List<String> members;
        final List<Expense> expenses = new ArrayList<>();
        Group(String id, String name, List<String> members) { this.id = id; this.name = name; this.members = members; }
    }

    // balance[a][b] > 0 means b owes a.
    static class BalanceSheet {
        private final Map<String, Map<String, Long>> balance = new HashMap<>();

        long get(String a, String b) { return balance.getOrDefault(a, Map.of()).getOrDefault(b, 0L); }

        private void add(String a, String b, long amount) {
            balance.computeIfAbsent(a, k -> new HashMap<>()).merge(b, amount, Long::sum);
        }

        // 'debtor' now owes 'creditor' 'amount' more (or less, if negative).
        void record(String creditor, String debtor, long amount) {
            add(creditor, debtor, amount);
            add(debtor, creditor, -amount);
        }

        long net(String user, List<String> users) {
            long s = 0;
            for (String other : users) s += get(user, other);
            return s;
        }
    }

    record Transfer(String from, String to, long amount) {}

    static class ExpenseManager {
        final Map<String, String> users = new LinkedHashMap<>(); // id -> name, in insertion order
        final Map<String, Group> groups = new HashMap<>();
        final BalanceSheet sheet = new BalanceSheet();
        private int nextId = 1;
        private final Map<SplitType, SplitStrategy> strategies = new EnumMap<>(Map.of(
                SplitType.EQUAL, new EqualSplit(), SplitType.EXACT, new ExactSplit(),
                SplitType.PERCENT, new PercentSplit(), SplitType.SHARES, new ShareSplit()));

        void addUser(String id, String name) { users.put(id, name); }
        void createGroup(String id, String name, List<String> members) { groups.put(id, new Group(id, name, members)); }

        Expense addExpense(String groupId, String description, String paidBy, long amount,
                           SplitType type, List<String> participants, long[] values) {
            Group group = groups.get(groupId);
            if (amount <= 0) throw new IllegalArgumentException("amount must be positive");
            List<String> everyone = new ArrayList<>(participants);
            everyone.add(paidBy);
            for (String u : everyone)
                if (!group.members.contains(u)) throw new IllegalArgumentException(u + " is not in " + group.name);
            long[] amounts = strategies.get(type).split(amount, participants.size(), values); // validates
            List<Share> shares = new ArrayList<>();
            for (int i = 0; i < participants.size(); i++) shares.add(new Share(participants.get(i), amounts[i]));
            for (Share s : shares) if (!s.userId().equals(paidBy)) sheet.record(paidBy, s.userId(), s.amount());
            Expense e = new Expense(nextId++, description, paidBy, amount, type, shares);
            group.expenses.add(e);
            return e;
        }

        void settleUp(String from, String to, long amount) { sheet.record(from, to, amount); } // a payment cancels debt

        void history(String groupId) {
            Group g = groups.get(groupId);
            System.out.println("== " + g.name + ": expense history ==");
            for (Expense e : g.expenses)
                System.out.println("  #" + e.id() + " " + e.description() + ", " + rs(e.amount()) + " paid by "
                        + users.get(e.paidBy()) + " (" + e.type() + ")");
        }

        // Every non-zero pairwise balance as "X owes Y", in user order.
        void printBalances() {
            List<String> order = new ArrayList<>(users.keySet());
            boolean any = false;
            for (String a : order)
                for (String b : order) {
                    long v = sheet.get(a, b);
                    if (v > 0) { System.out.println("  " + users.get(b) + " owes " + users.get(a) + " " + rs(v)); any = true; }
                }
            if (!any) System.out.println("  all settled up");
        }

        long[] netBalances() {
            List<String> order = new ArrayList<>(users.keySet());
            long[] net = new long[order.size()];
            for (int i = 0; i < net.length; i++) net[i] = sheet.net(order.get(i), order);
            return net;
        }

        // Greedy min cash flow: biggest debtor pays biggest creditor, repeat.
        List<Transfer> simplifyDebts() {
            List<String> order = new ArrayList<>(users.keySet());
            long[] net = netBalances();
            List<Transfer> result = new ArrayList<>();
            while (true) {
                int cr = -1, dr = -1;
                for (int i = 0; i < net.length; i++) {
                    if (net[i] > 0 && (cr < 0 || net[i] > net[cr])) cr = i;
                    if (net[i] < 0 && (dr < 0 || net[i] < net[dr])) dr = i;
                }
                if (cr < 0 || dr < 0) break;
                long amt = Math.min(net[cr], -net[dr]);
                result.add(new Transfer(order.get(dr), order.get(cr), amt));
                net[cr] -= amt;
                net[dr] += amt;
            }
            return result;
        }
    }

    static ExpenseManager m = new ExpenseManager();

    static void add(String desc, String paidBy, long amount, SplitType type, List<String> who, long... values) {
        try {
            Expense e = m.addExpense("goa", desc, paidBy, amount, type, who, values);
            StringJoiner sj = new StringJoiner(", ");
            for (Share s : e.shares()) sj.add(m.users.get(s.userId()) + " " + rs(s.amount()));
            System.out.println("#" + e.id() + " " + desc + ": " + m.users.get(paidBy) + " paid " + rs(amount) + ", " + type + " -> " + sj);
        } catch (IllegalArgumentException err) {
            System.out.println("Rejected '" + desc + "': " + err.getMessage());
        }
    }

    static void showSimplified() {
        for (Transfer t : m.simplifyDebts())
            System.out.println("  " + m.users.get(t.from()) + " pays " + m.users.get(t.to()) + " " + rs(t.amount()));
    }

    public static void main(String[] args) {
        m.addUser("u1", "Aarav");
        m.addUser("u2", "Bhavna");
        m.addUser("u3", "Chirag");
        m.addUser("u4", "Diya");
        List<String> all = List.of("u1", "u2", "u3", "u4");
        m.createGroup("goa", "Goa trip", all);

        System.out.println("== Expenses ==");
        add("Villa in Anjuna", "u1", 1200000, SplitType.EQUAL, all);
        add("Scooter rentals", "u2", 100000, SplitType.EQUAL, List.of("u2", "u3", "u4"));
        add("Scuba diving", "u3", 600000, SplitType.EXACT, all, 200000, 100000, 150000, 150000);
        add("Dinner at Thalassa", "u4", 325050, SplitType.PERCENT, all, 40, 20, 20, 20);
        add("Airport cab", "u1", 100000, SplitType.SHARES, List.of("u1", "u2", "u4"), 1, 2, 4);
        add("Souvenirs", "u2", 50000, SplitType.EXACT, List.of("u1", "u2"), 20000, 20000);
        add("Parasailing", "u3", 300000, SplitType.PERCENT, all, 50, 20, 10, 10);

        System.out.println("== Balances ==");
        m.printBalances();
        System.out.println("== Net per person ==");
        long[] net = m.netBalances();
        int i = 0;
        for (String name : m.users.values()) {
            long v = net[i++];
            System.out.println("  " + name + " " + (v >= 0 ? "gets back " + rs(v) : "owes " + rs(-v)));
        }
        System.out.println("== Simplified settlements ==");
        showSimplified();

        System.out.println("== Diya pays Aarav Rs 2271.22 (settle up) ==");
        m.settleUp("u4", "u1", 227122);
        m.printBalances();
        System.out.println("== Simplified after settling ==");
        showSimplified();
        m.history("goa");
    }
}`,
      python: String.raw`# Splitwise: users, groups, four split strategies, balances, settle up and simplify debts.
# Money is always an integer number of paise (1 rupee = 100 paise). Run: python3 splitwise.py
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Tuple


def rs(paise: int) -> str:
    sign = "-" if paise < 0 else ""
    p = abs(paise)
    return f"{sign}Rs {p // 100}.{p % 100:02d}"


def distribute(total: int, weights: List[int]) -> List[int]:
    """Shares 'total' in proportion to 'weights'. Floors every share, then hands the
    leftover paise, one each, to the first participants in the list (deterministic)."""
    s = sum(weights)
    out = [total * w // s for w in weights]
    left = total - sum(out)
    for i in range(left):
        out[i] += 1
    return out


class SplitType(Enum):
    EQUAL = "EQUAL"
    EXACT = "EXACT"
    PERCENT = "PERCENT"
    SHARES = "SHARES"


# ---------- Strategy: how one expense is split ----------
class SplitStrategy(ABC):
    @abstractmethod
    def split(self, total: int, n: int, values: List[int]) -> List[int]:
        """Returns paise owed by each participant, in order. Raises ValueError on bad input."""


class EqualSplit(SplitStrategy):
    def split(self, total, n, values):
        return distribute(total, [1] * n)


class ExactSplit(SplitStrategy):
    def split(self, total, n, values):
        if len(values) != n:
            raise ValueError("need one amount per person")
        if any(v < 0 for v in values):
            raise ValueError("amounts cannot be negative")
        if sum(values) != total:
            raise ValueError(f"exact amounts add up to {rs(sum(values))}, not {rs(total)}")
        return list(values)


class PercentSplit(SplitStrategy):
    def split(self, total, n, values):
        if len(values) != n:
            raise ValueError("need one percentage per person")
        if any(v < 0 for v in values):
            raise ValueError("percentages cannot be negative")
        if sum(values) != 100:
            raise ValueError(f"percentages add up to {sum(values)}, not 100")
        return distribute(total, values)


class ShareSplit(SplitStrategy):
    def split(self, total, n, values):
        if len(values) != n:
            raise ValueError("need one share count per person")
        if any(v <= 0 for v in values):
            raise ValueError("shares must be positive")
        return distribute(total, values)


@dataclass
class Expense:
    id: int
    description: str
    paid_by: str
    amount: int
    type: SplitType
    shares: List[Tuple[str, int]]  # (user id, paise owed)


@dataclass
class Group:
    id: str
    name: str
    members: List[str]
    expenses: List[Expense] = field(default_factory=list)


class BalanceSheet:
    """balance[a][b] > 0 means b owes a."""

    def __init__(self) -> None:
        self._balance: Dict[str, Dict[str, int]] = {}

    def get(self, a: str, b: str) -> int:
        return self._balance.get(a, {}).get(b, 0)

    def _add(self, a: str, b: str, amount: int) -> None:
        row = self._balance.setdefault(a, {})
        row[b] = row.get(b, 0) + amount

    def record(self, creditor: str, debtor: str, amount: int) -> None:
        """'debtor' now owes 'creditor' 'amount' more (or less, if negative)."""
        self._add(creditor, debtor, amount)
        self._add(debtor, creditor, -amount)

    def net(self, user: str, users: List[str]) -> int:
        return sum(self.get(user, other) for other in users)


class ExpenseManager:
    def __init__(self) -> None:
        self.users: Dict[str, str] = {}  # insertion-ordered: id -> name
        self.groups: Dict[str, Group] = {}
        self.sheet = BalanceSheet()
        self._next_id = 1
        self._strategies: Dict[SplitType, SplitStrategy] = {
            SplitType.EQUAL: EqualSplit(), SplitType.EXACT: ExactSplit(),
            SplitType.PERCENT: PercentSplit(), SplitType.SHARES: ShareSplit(),
        }

    def add_user(self, uid: str, name: str) -> None:
        self.users[uid] = name

    def create_group(self, gid: str, name: str, members: List[str]) -> None:
        self.groups[gid] = Group(gid, name, members)

    def add_expense(self, group_id: str, description: str, paid_by: str, amount: int,
                    type: SplitType, participants: List[str], values: List[int]) -> Expense:
        group = self.groups[group_id]
        if amount <= 0:
            raise ValueError("amount must be positive")
        for u in [paid_by, *participants]:
            if u not in group.members:
                raise ValueError(f"{u} is not in {group.name}")
        amounts = self._strategies[type].split(amount, len(participants), values)  # validates
        shares = list(zip(participants, amounts))
        for u, owed in shares:
            if u != paid_by:
                self.sheet.record(paid_by, u, owed)
        e = Expense(self._next_id, description, paid_by, amount, type, shares)
        self._next_id += 1
        group.expenses.append(e)
        return e

    def settle_up(self, frm: str, to: str, amount: int) -> None:
        self.sheet.record(frm, to, amount)  # a payment cancels debt

    def history(self, group_id: str) -> None:
        g = self.groups[group_id]
        print(f"== {g.name}: expense history ==")
        for e in g.expenses:
            print(f"  #{e.id} {e.description}, {rs(e.amount)} paid by {self.users[e.paid_by]} ({e.type.value})")

    def print_balances(self) -> None:
        """Every non-zero pairwise balance as 'X owes Y', in user order."""
        order = list(self.users)
        found = False
        for a in order:
            for b in order:
                v = self.sheet.get(a, b)
                if v > 0:
                    print(f"  {self.users[b]} owes {self.users[a]} {rs(v)}")
                    found = True
        if not found:
            print("  all settled up")

    def net_balances(self) -> List[List]:
        order = list(self.users)
        return [[u, self.sheet.net(u, order)] for u in order]

    def simplify_debts(self) -> List[Tuple[str, str, int]]:
        """Greedy min cash flow: biggest debtor pays biggest creditor, repeat."""
        net = self.net_balances()
        result = []
        while True:
            cr = dr = -1
            for i, (_, v) in enumerate(net):
                if v > 0 and (cr < 0 or v > net[cr][1]):
                    cr = i
                if v < 0 and (dr < 0 or v < net[dr][1]):
                    dr = i
            if cr < 0 or dr < 0:
                break
            amt = min(net[cr][1], -net[dr][1])
            result.append((net[dr][0], net[cr][0], amt))
            net[cr][1] -= amt
            net[dr][1] += amt
        return result


def main() -> None:
    m = ExpenseManager()
    for uid, name in [("u1", "Aarav"), ("u2", "Bhavna"), ("u3", "Chirag"), ("u4", "Diya")]:
        m.add_user(uid, name)
    everyone = ["u1", "u2", "u3", "u4"]
    m.create_group("goa", "Goa trip", everyone)

    def add(desc, paid_by, amount, type, who, values):
        try:
            e = m.add_expense("goa", desc, paid_by, amount, type, who, values)
            split = ", ".join(f"{m.users[u]} {rs(v)}" for u, v in e.shares)
            print(f"#{e.id} {desc}: {m.users[paid_by]} paid {rs(amount)}, {type.value} -> {split}")
        except ValueError as err:
            print(f"Rejected '{desc}': {err}")

    def show_simplified():
        for frm, to, amt in m.simplify_debts():
            print(f"  {m.users[frm]} pays {m.users[to]} {rs(amt)}")

    print("== Expenses ==")
    add("Villa in Anjuna", "u1", 1200000, SplitType.EQUAL, everyone, [])
    add("Scooter rentals", "u2", 100000, SplitType.EQUAL, ["u2", "u3", "u4"], [])
    add("Scuba diving", "u3", 600000, SplitType.EXACT, everyone, [200000, 100000, 150000, 150000])
    add("Dinner at Thalassa", "u4", 325050, SplitType.PERCENT, everyone, [40, 20, 20, 20])
    add("Airport cab", "u1", 100000, SplitType.SHARES, ["u1", "u2", "u4"], [1, 2, 4])
    add("Souvenirs", "u2", 50000, SplitType.EXACT, ["u1", "u2"], [20000, 20000])
    add("Parasailing", "u3", 300000, SplitType.PERCENT, everyone, [50, 20, 10, 10])

    print("== Balances ==")
    m.print_balances()
    print("== Net per person ==")
    for u, v in m.net_balances():
        print(f"  {m.users[u]} " + (f"gets back {rs(v)}" if v >= 0 else f"owes {rs(-v)}"))
    print("== Simplified settlements ==")
    show_simplified()

    print("== Diya pays Aarav Rs 2271.22 (settle up) ==")
    m.settle_up("u4", "u1", 227122)
    m.print_balances()
    print("== Simplified after settling ==")
    show_simplified()
    m.history("goa")


if __name__ == "__main__":
    main()`,
      cpp: String.raw`// Splitwise: users, groups, four split strategies, balances, settle up and simplify debts.
// Money is always an integer number of paise (1 rupee = 100 paise).
// Build: g++ -std=c++17 splitwise.cpp -o splitwise && ./splitwise
#include <algorithm>
#include <cstdio>
#include <iostream>
#include <map>
#include <memory>
#include <numeric>
#include <stdexcept>
#include <string>
#include <tuple>
#include <vector>
using namespace std;
using Money = long long;

string rs(Money paise) {
    Money p = paise < 0 ? -paise : paise;
    char buf[40];
    snprintf(buf, sizeof buf, "%sRs %lld.%02lld", paise < 0 ? "-" : "", p / 100, p % 100);
    return buf;
}

// Shares 'total' in proportion to 'weights'. Floors every share, then hands the
// leftover paise, one each, to the first participants in the list (deterministic).
vector<Money> distribute(Money total, const vector<Money>& weights) {
    Money sum = accumulate(weights.begin(), weights.end(), 0LL), given = 0;
    vector<Money> out;
    for (Money w : weights) { out.push_back(total * w / sum); given += out.back(); }
    for (size_t i = 0; given < total; i++, given++) out[i]++;
    return out;
}

Money sumOf(const vector<Money>& v) { return accumulate(v.begin(), v.end(), 0LL); }

enum class SplitType { EQUAL, EXACT, PERCENT, SHARES };
const char* typeName(SplitType t) {
    switch (t) {
        case SplitType::EQUAL: return "EQUAL";
        case SplitType::EXACT: return "EXACT";
        case SplitType::PERCENT: return "PERCENT";
        default: return "SHARES";
    }
}

// ---------- Strategy: how one expense is split ----------
struct SplitStrategy {
    virtual ~SplitStrategy() = default;
    // Paise owed by each participant, in order. Throws invalid_argument on bad input.
    virtual vector<Money> split(Money total, size_t n, const vector<Money>& values) const = 0;
};

struct EqualSplit : SplitStrategy {
    vector<Money> split(Money total, size_t n, const vector<Money>&) const override {
        return distribute(total, vector<Money>(n, 1));
    }
};

struct ExactSplit : SplitStrategy {
    vector<Money> split(Money total, size_t n, const vector<Money>& values) const override {
        if (values.size() != n) throw invalid_argument("need one amount per person");
        for (Money v : values) if (v < 0) throw invalid_argument("amounts cannot be negative");
        if (sumOf(values) != total)
            throw invalid_argument("exact amounts add up to " + rs(sumOf(values)) + ", not " + rs(total));
        return values;
    }
};

struct PercentSplit : SplitStrategy {
    vector<Money> split(Money total, size_t n, const vector<Money>& values) const override {
        if (values.size() != n) throw invalid_argument("need one percentage per person");
        for (Money v : values) if (v < 0) throw invalid_argument("percentages cannot be negative");
        if (sumOf(values) != 100)
            throw invalid_argument("percentages add up to " + to_string(sumOf(values)) + ", not 100");
        return distribute(total, values);
    }
};

struct ShareSplit : SplitStrategy {
    vector<Money> split(Money total, size_t n, const vector<Money>& values) const override {
        if (values.size() != n) throw invalid_argument("need one share count per person");
        for (Money v : values) if (v <= 0) throw invalid_argument("shares must be positive");
        return distribute(total, values);
    }
};

struct Expense {
    int id;
    string description, paidBy;
    Money amount;
    SplitType type;
    vector<pair<string, Money>> shares; // (user id, paise owed)
};

struct Group {
    string id, name;
    vector<string> members;
    vector<Expense> expenses;
};

// balance[a][b] > 0 means b owes a.
class BalanceSheet {
    map<string, map<string, Money>> balance;
public:
    Money get(const string& a, const string& b) const {
        auto r = balance.find(a);
        if (r == balance.end()) return 0;
        auto c = r->second.find(b);
        return c == r->second.end() ? 0 : c->second;
    }
    // 'debtor' now owes 'creditor' 'amount' more (or less, if negative).
    void record(const string& creditor, const string& debtor, Money amount) {
        balance[creditor][debtor] += amount;
        balance[debtor][creditor] -= amount;
    }
    Money net(const string& user, const vector<string>& users) const {
        Money s = 0;
        for (auto& other : users) s += get(user, other);
        return s;
    }
};

struct Transfer { string from, to; Money amount; };

class ExpenseManager {
    map<SplitType, unique_ptr<SplitStrategy>> strategies;
    int nextId = 1;
public:
    map<string, string> names;  // id -> name
    vector<string> order;       // ids in registration order
    map<string, Group> groups;
    BalanceSheet sheet;

    ExpenseManager() {
        strategies[SplitType::EQUAL] = make_unique<EqualSplit>();
        strategies[SplitType::EXACT] = make_unique<ExactSplit>();
        strategies[SplitType::PERCENT] = make_unique<PercentSplit>();
        strategies[SplitType::SHARES] = make_unique<ShareSplit>();
    }
    void addUser(const string& id, const string& name) { names[id] = name; order.push_back(id); }
    void createGroup(const string& id, const string& name, const vector<string>& members) {
        groups[id] = Group{id, name, members, {}};
    }

    const Expense& addExpense(const string& groupId, const string& description, const string& paidBy, Money amount,
                              SplitType type, const vector<string>& participants, const vector<Money>& values) {
        Group& group = groups.at(groupId);
        if (amount <= 0) throw invalid_argument("amount must be positive");
        vector<string> everyone = participants;
        everyone.push_back(paidBy);
        for (auto& u : everyone)
            if (find(group.members.begin(), group.members.end(), u) == group.members.end())
                throw invalid_argument(u + " is not in " + group.name);
        vector<Money> amounts = strategies.at(type)->split(amount, participants.size(), values); // validates
        Expense e{nextId++, description, paidBy, amount, type, {}};
        for (size_t i = 0; i < participants.size(); i++) e.shares.push_back({participants[i], amounts[i]});
        for (auto& [u, owed] : e.shares) if (u != paidBy) sheet.record(paidBy, u, owed);
        group.expenses.push_back(e);
        return group.expenses.back();
    }

    void settleUp(const string& from, const string& to, Money amount) { sheet.record(from, to, amount); }

    void history(const string& groupId) const {
        const Group& g = groups.at(groupId);
        cout << "== " << g.name << ": expense history ==\n";
        for (auto& e : g.expenses)
            cout << "  #" << e.id << " " << e.description << ", " << rs(e.amount) << " paid by "
                 << names.at(e.paidBy) << " (" << typeName(e.type) << ")\n";
    }

    // Every non-zero pairwise balance as "X owes Y", in user order.
    void printBalances() const {
        bool any = false;
        for (auto& a : order)
            for (auto& b : order) {
                Money v = sheet.get(a, b);
                if (v > 0) { cout << "  " << names.at(b) << " owes " << names.at(a) << " " << rs(v) << "\n"; any = true; }
            }
        if (!any) cout << "  all settled up\n";
    }

    vector<Money> netBalances() const {
        vector<Money> net;
        for (auto& u : order) net.push_back(sheet.net(u, order));
        return net;
    }

    // Greedy min cash flow: biggest debtor pays biggest creditor, repeat.
    vector<Transfer> simplifyDebts() const {
        vector<Money> net = netBalances();
        vector<Transfer> result;
        while (true) {
            int cr = -1, dr = -1;
            for (int i = 0; i < (int)net.size(); i++) {
                if (net[i] > 0 && (cr < 0 || net[i] > net[cr])) cr = i;
                if (net[i] < 0 && (dr < 0 || net[i] < net[dr])) dr = i;
            }
            if (cr < 0 || dr < 0) break;
            Money amt = min(net[cr], -net[dr]);
            result.push_back({order[dr], order[cr], amt});
            net[cr] -= amt;
            net[dr] += amt;
        }
        return result;
    }
};

int main() {
    ExpenseManager m;
    m.addUser("u1", "Aarav");
    m.addUser("u2", "Bhavna");
    m.addUser("u3", "Chirag");
    m.addUser("u4", "Diya");
    vector<string> all = {"u1", "u2", "u3", "u4"};
    m.createGroup("goa", "Goa trip", all);

    auto add = [&](const string& desc, const string& paidBy, Money amount, SplitType type,
                   const vector<string>& who, const vector<Money>& values) {
        try {
            const Expense& e = m.addExpense("goa", desc, paidBy, amount, type, who, values);
            cout << "#" << e.id << " " << desc << ": " << m.names[paidBy] << " paid " << rs(amount) << ", "
                 << typeName(type) << " -> ";
            for (size_t i = 0; i < e.shares.size(); i++)
                cout << (i ? ", " : "") << m.names[e.shares[i].first] << " " << rs(e.shares[i].second);
            cout << "\n";
        } catch (const invalid_argument& err) {
            cout << "Rejected '" << desc << "': " << err.what() << "\n";
        }
    };
    auto showSimplified = [&]() {
        for (auto& t : m.simplifyDebts())
            cout << "  " << m.names[t.from] << " pays " << m.names[t.to] << " " << rs(t.amount) << "\n";
    };

    cout << "== Expenses ==\n";
    add("Villa in Anjuna", "u1", 1200000, SplitType::EQUAL, all, {});
    add("Scooter rentals", "u2", 100000, SplitType::EQUAL, {"u2", "u3", "u4"}, {});
    add("Scuba diving", "u3", 600000, SplitType::EXACT, all, {200000, 100000, 150000, 150000});
    add("Dinner at Thalassa", "u4", 325050, SplitType::PERCENT, all, {40, 20, 20, 20});
    add("Airport cab", "u1", 100000, SplitType::SHARES, {"u1", "u2", "u4"}, {1, 2, 4});
    add("Souvenirs", "u2", 50000, SplitType::EXACT, {"u1", "u2"}, {20000, 20000});
    add("Parasailing", "u3", 300000, SplitType::PERCENT, all, {50, 20, 10, 10});

    cout << "== Balances ==\n";
    m.printBalances();
    cout << "== Net per person ==\n";
    vector<Money> net = m.netBalances();
    for (size_t i = 0; i < net.size(); i++)
        cout << "  " << m.names[m.order[i]] << " " << (net[i] >= 0 ? "gets back " + rs(net[i]) : "owes " + rs(-net[i])) << "\n";
    cout << "== Simplified settlements ==\n";
    showSimplified();

    cout << "== Diya pays Aarav Rs 2271.22 (settle up) ==\n";
    m.settleUp("u4", "u1", 227122);
    m.printBalances();
    cout << "== Simplified after settling ==\n";
    showSimplified();
    m.history("goa");
    return 0;
}`,
      javascript: String.raw`// Splitwise: users, groups, four split strategies, balances, settle up and simplify debts.
// Money is always an integer number of paise (1 rupee = 100 paise). Run: node splitwise.js

function rs(paise) {
  const sign = paise < 0 ? "-" : "";
  const p = Math.abs(paise);
  return sign + "Rs " + Math.floor(p / 100) + "." + String(p % 100).padStart(2, "0");
}

// Shares 'total' in proportion to 'weights'. Floors every share, then hands the
// leftover paise, one each, to the first participants in the list (deterministic).
function distribute(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const out = weights.map((w) => Math.floor((total * w) / sum));
  let left = total - out.reduce((a, b) => a + b, 0);
  for (let i = 0; left > 0; i++, left--) out[i]++;
  return out;
}

// ---------- Strategy: how one expense is split ----------
class EqualSplit {
  split(total, n, values) { return distribute(total, new Array(n).fill(1)); }
}
class ExactSplit {
  split(total, n, values) {
    if (values.length !== n) throw new Error("need one amount per person");
    const sum = values.reduce((a, b) => a + b, 0);
    if (values.some((v) => v < 0)) throw new Error("amounts cannot be negative");
    if (sum !== total) throw new Error("exact amounts add up to " + rs(sum) + ", not " + rs(total));
    return values.slice();
  }
}
class PercentSplit {
  split(total, n, values) {
    if (values.length !== n) throw new Error("need one percentage per person");
    const sum = values.reduce((a, b) => a + b, 0);
    if (values.some((v) => v < 0)) throw new Error("percentages cannot be negative");
    if (sum !== 100) throw new Error("percentages add up to " + sum + ", not 100");
    return distribute(total, values);
  }
}
class ShareSplit {
  split(total, n, values) {
    if (values.length !== n) throw new Error("need one share count per person");
    if (values.some((v) => v <= 0)) throw new Error("shares must be positive");
    return distribute(total, values);
  }
}

class Expense {
  constructor(id, description, paidBy, amount, type, shares) {
    this.id = id; this.description = description; this.paidBy = paidBy;
    this.amount = amount; this.type = type; this.shares = shares; // shares: [[userId, paise], ...]
  }
}

class Group {
  constructor(id, name, members) { this.id = id; this.name = name; this.members = members; this.expenses = []; }
}

// ---------- Balance sheet: balance[a][b] > 0 means b owes a ----------
class BalanceSheet {
  constructor() { this.balance = new Map(); }
  get(a, b) { const row = this.balance.get(a); return row && row.has(b) ? row.get(b) : 0; }
  add(a, b, amount) {
    if (!this.balance.has(a)) this.balance.set(a, new Map());
    this.balance.get(a).set(b, this.get(a, b) + amount);
  }
  // 'debtor' now owes 'creditor' 'amount' more (or less, if negative).
  record(creditor, debtor, amount) { this.add(creditor, debtor, amount); this.add(debtor, creditor, -amount); }
  net(user, users) { return users.reduce((s, other) => s + this.get(user, other), 0); }
}

class ExpenseManager {
  constructor() {
    this.users = new Map(); this.order = []; this.groups = new Map(); this.sheet = new BalanceSheet(); this.nextId = 1;
    this.strategies = { EQUAL: new EqualSplit(), EXACT: new ExactSplit(), PERCENT: new PercentSplit(), SHARES: new ShareSplit() };
  }
  addUser(id, name) { this.users.set(id, name); this.order.push(id); }
  createGroup(id, name, members) { this.groups.set(id, new Group(id, name, members)); }

  addExpense(groupId, description, paidBy, amount, type, participants, values) {
    const group = this.groups.get(groupId);
    if (amount <= 0) throw new Error("amount must be positive");
    for (const u of [paidBy, ...participants]) if (!group.members.includes(u)) throw new Error(u + " is not in " + group.name);
    const amounts = this.strategies[type].split(amount, participants.length, values); // validates; throws on bad input
    const shares = participants.map((u, i) => [u, amounts[i]]);
    for (const [u, owed] of shares) if (u !== paidBy) this.sheet.record(paidBy, u, owed);
    const e = new Expense(this.nextId++, description, paidBy, amount, type, shares);
    group.expenses.push(e);
    return e;
  }

  settleUp(from, to, amount) { this.sheet.record(from, to, amount); } // a payment cancels debt

  history(groupId) {
    const g = this.groups.get(groupId);
    console.log("== " + g.name + ": expense history ==");
    for (const e of g.expenses) console.log("  #" + e.id + " " + e.description + ", " + rs(e.amount) + " paid by " + this.users.get(e.paidBy) + " (" + e.type + ")");
  }

  // Every non-zero pairwise balance as "X owes Y", in user order.
  printBalances() {
    let any = false;
    for (const a of this.order) for (const b of this.order) {
      const v = this.sheet.get(a, b);
      if (v > 0) { console.log("  " + this.users.get(b) + " owes " + this.users.get(a) + " " + rs(v)); any = true; }
    }
    if (!any) console.log("  all settled up");
  }

  netBalances() { return this.order.map((u) => [u, this.sheet.net(u, this.order)]); }

  // Greedy min cash flow: biggest debtor pays biggest creditor, repeat.
  simplifyDebts() {
    const net = this.netBalances();
    const result = [];
    for (;;) {
      let cr = -1, dr = -1;
      for (let i = 0; i < net.length; i++) {
        if (net[i][1] > 0 && (cr < 0 || net[i][1] > net[cr][1])) cr = i;
        if (net[i][1] < 0 && (dr < 0 || net[i][1] < net[dr][1])) dr = i;
      }
      if (cr < 0 || dr < 0) break;
      const amt = Math.min(net[cr][1], -net[dr][1]);
      result.push([net[dr][0], net[cr][0], amt]);
      net[cr][1] -= amt; net[dr][1] += amt;
    }
    return result;
  }
}

function main() {
  const m = new ExpenseManager();
  [["u1", "Aarav"], ["u2", "Bhavna"], ["u3", "Chirag"], ["u4", "Diya"]].forEach(([id, n]) => m.addUser(id, n));
  m.createGroup("goa", "Goa trip", ["u1", "u2", "u3", "u4"]);
  const all = ["u1", "u2", "u3", "u4"];

  const add = (desc, paidBy, amount, type, who, values) => {
    try {
      const e = m.addExpense("goa", desc, paidBy, amount, type, who, values);
      console.log("#" + e.id + " " + desc + ": " + m.users.get(paidBy) + " paid " + rs(amount) + ", " + type + " -> " +
        e.shares.map(([u, v]) => m.users.get(u) + " " + rs(v)).join(", "));
    } catch (err) {
      console.log("Rejected '" + desc + "': " + err.message);
    }
  };

  console.log("== Expenses ==");
  add("Villa in Anjuna", "u1", 1200000, "EQUAL", all, []);
  add("Scooter rentals", "u2", 100000, "EQUAL", ["u2", "u3", "u4"], []);
  add("Scuba diving", "u3", 600000, "EXACT", all, [200000, 100000, 150000, 150000]);
  add("Dinner at Thalassa", "u4", 325050, "PERCENT", all, [40, 20, 20, 20]);
  add("Airport cab", "u1", 100000, "SHARES", ["u1", "u2", "u4"], [1, 2, 4]);
  add("Souvenirs", "u2", 50000, "EXACT", ["u1", "u2"], [20000, 20000]);
  add("Parasailing", "u3", 300000, "PERCENT", all, [50, 20, 10, 10]);

  console.log("== Balances ==");
  m.printBalances();
  console.log("== Net per person ==");
  for (const [u, v] of m.netBalances()) console.log("  " + m.users.get(u) + " " + (v >= 0 ? "gets back " + rs(v) : "owes " + rs(-v)));

  console.log("== Simplified settlements ==");
  for (const [from, to, amt] of m.simplifyDebts()) console.log("  " + m.users.get(from) + " pays " + m.users.get(to) + " " + rs(amt));

  console.log("== Diya pays Aarav Rs 2271.22 (settle up) ==");
  m.settleUp("u4", "u1", 227122);
  m.printBalances();
  console.log("== Simplified after settling ==");
  for (const [from, to, amt] of m.simplifyDebts()) console.log("  " + m.users.get(from) + " pays " + m.users.get(to) + " " + rs(amt));
  m.history("goa");
}

main();`,
      go: String.raw`// Splitwise: users, groups, four split strategies, balances, settle up and simplify debts.
// Money is always an int64 number of paise (1 rupee = 100 paise). Run: go run splitwise.go
package main

import (
	"errors"
	"fmt"
	"strings"
)

func rs(paise int64) string {
	sign, p := "", paise
	if p < 0 {
		sign, p = "-", -p
	}
	return fmt.Sprintf("%sRs %d.%02d", sign, p/100, p%100)
}

// distribute shares total in proportion to weights. It floors every share, then hands the
// leftover paise, one each, to the first participants in the list (deterministic).
func distribute(total int64, weights []int64) []int64 {
	var sum, given int64
	for _, w := range weights {
		sum += w
	}
	out := make([]int64, len(weights))
	for i, w := range weights {
		out[i] = total * w / sum
		given += out[i]
	}
	for i := 0; given < total; i, given = i+1, given+1 {
		out[i]++
	}
	return out
}

func sumOf(v []int64) int64 {
	var s int64
	for _, x := range v {
		s += x
	}
	return s
}

type SplitType string

const (
	Equal   SplitType = "EQUAL"
	Exact   SplitType = "EXACT"
	Percent SplitType = "PERCENT"
	Shares  SplitType = "SHARES"
)

// ---------- Strategy: how one expense is split ----------
type SplitStrategy interface {
	// Split returns paise owed by each participant, in order, or an error on bad input.
	Split(total int64, n int, values []int64) ([]int64, error)
}

type EqualSplit struct{}

func (EqualSplit) Split(total int64, n int, _ []int64) ([]int64, error) {
	w := make([]int64, n)
	for i := range w {
		w[i] = 1
	}
	return distribute(total, w), nil
}

type ExactSplit struct{}

func (ExactSplit) Split(total int64, n int, values []int64) ([]int64, error) {
	if len(values) != n {
		return nil, errors.New("need one amount per person")
	}
	for _, v := range values {
		if v < 0 {
			return nil, errors.New("amounts cannot be negative")
		}
	}
	if sumOf(values) != total {
		return nil, fmt.Errorf("exact amounts add up to %s, not %s", rs(sumOf(values)), rs(total))
	}
	return append([]int64(nil), values...), nil
}

type PercentSplit struct{}

func (PercentSplit) Split(total int64, n int, values []int64) ([]int64, error) {
	if len(values) != n {
		return nil, errors.New("need one percentage per person")
	}
	for _, v := range values {
		if v < 0 {
			return nil, errors.New("percentages cannot be negative")
		}
	}
	if sumOf(values) != 100 {
		return nil, fmt.Errorf("percentages add up to %d, not 100", sumOf(values))
	}
	return distribute(total, values), nil
}

type ShareSplit struct{}

func (ShareSplit) Split(total int64, n int, values []int64) ([]int64, error) {
	if len(values) != n {
		return nil, errors.New("need one share count per person")
	}
	for _, v := range values {
		if v <= 0 {
			return nil, errors.New("shares must be positive")
		}
	}
	return distribute(total, values), nil
}

type Share struct {
	UserID string
	Amount int64
}

type Expense struct {
	ID          int
	Description string
	PaidBy      string
	Amount      int64
	Type        SplitType
	Shares      []Share
}

type Group struct {
	ID, Name string
	Members  []string
	Expenses []*Expense
}

func (g *Group) has(u string) bool {
	for _, m := range g.Members {
		if m == u {
			return true
		}
	}
	return false
}

// BalanceSheet: balance[a][b] > 0 means b owes a.
type BalanceSheet struct{ balance map[string]map[string]int64 }

func (s *BalanceSheet) Get(a, b string) int64 { return s.balance[a][b] }

func (s *BalanceSheet) add(a, b string, amount int64) {
	if s.balance[a] == nil {
		s.balance[a] = map[string]int64{}
	}
	s.balance[a][b] += amount
}

// Record notes that debtor now owes creditor amount more (or less, if negative).
func (s *BalanceSheet) Record(creditor, debtor string, amount int64) {
	s.add(creditor, debtor, amount)
	s.add(debtor, creditor, -amount)
}

func (s *BalanceSheet) Net(user string, users []string) int64 {
	var t int64
	for _, other := range users {
		t += s.Get(user, other)
	}
	return t
}

type Transfer struct {
	From, To string
	Amount   int64
}

type ExpenseManager struct {
	Names      map[string]string // id -> name
	Order      []string          // ids in registration order (Go maps are unordered)
	Groups     map[string]*Group
	Sheet      *BalanceSheet
	nextID     int
	strategies map[SplitType]SplitStrategy
}

func NewExpenseManager() *ExpenseManager {
	return &ExpenseManager{
		Names: map[string]string{}, Groups: map[string]*Group{},
		Sheet: &BalanceSheet{balance: map[string]map[string]int64{}}, nextID: 1,
		strategies: map[SplitType]SplitStrategy{
			Equal: EqualSplit{}, Exact: ExactSplit{}, Percent: PercentSplit{}, Shares: ShareSplit{},
		},
	}
}

func (m *ExpenseManager) AddUser(id, name string) { m.Names[id] = name; m.Order = append(m.Order, id) }

func (m *ExpenseManager) CreateGroup(id, name string, members []string) {
	m.Groups[id] = &Group{ID: id, Name: name, Members: members}
}

func (m *ExpenseManager) AddExpense(groupID, description, paidBy string, amount int64,
	t SplitType, participants []string, values []int64) (*Expense, error) {
	group := m.Groups[groupID]
	if amount <= 0 {
		return nil, errors.New("amount must be positive")
	}
	for _, u := range append([]string{paidBy}, participants...) {
		if !group.has(u) {
			return nil, fmt.Errorf("%s is not in %s", u, group.Name)
		}
	}
	amounts, err := m.strategies[t].Split(amount, len(participants), values) // validates
	if err != nil {
		return nil, err
	}
	e := &Expense{ID: m.nextID, Description: description, PaidBy: paidBy, Amount: amount, Type: t}
	m.nextID++
	for i, u := range participants {
		e.Shares = append(e.Shares, Share{u, amounts[i]})
		if u != paidBy {
			m.Sheet.Record(paidBy, u, amounts[i])
		}
	}
	group.Expenses = append(group.Expenses, e)
	return e, nil
}

// SettleUp records a payment; it cancels debt like an expense in reverse.
func (m *ExpenseManager) SettleUp(from, to string, amount int64) { m.Sheet.Record(from, to, amount) }

func (m *ExpenseManager) History(groupID string) {
	g := m.Groups[groupID]
	fmt.Printf("== %s: expense history ==\n", g.Name)
	for _, e := range g.Expenses {
		fmt.Printf("  #%d %s, %s paid by %s (%s)\n", e.ID, e.Description, rs(e.Amount), m.Names[e.PaidBy], e.Type)
	}
}

// PrintBalances prints every non-zero pairwise balance as "X owes Y", in user order.
func (m *ExpenseManager) PrintBalances() {
	found := false
	for _, a := range m.Order {
		for _, b := range m.Order {
			if v := m.Sheet.Get(a, b); v > 0 {
				fmt.Printf("  %s owes %s %s\n", m.Names[b], m.Names[a], rs(v))
				found = true
			}
		}
	}
	if !found {
		fmt.Println("  all settled up")
	}
}

func (m *ExpenseManager) NetBalances() []int64 {
	net := make([]int64, len(m.Order))
	for i, u := range m.Order {
		net[i] = m.Sheet.Net(u, m.Order)
	}
	return net
}

// SimplifyDebts is the greedy min cash flow: biggest debtor pays biggest creditor, repeat.
func (m *ExpenseManager) SimplifyDebts() []Transfer {
	net := m.NetBalances()
	var result []Transfer
	for {
		cr, dr := -1, -1
		for i, v := range net {
			if v > 0 && (cr < 0 || v > net[cr]) {
				cr = i
			}
			if v < 0 && (dr < 0 || v < net[dr]) {
				dr = i
			}
		}
		if cr < 0 || dr < 0 {
			break
		}
		amt := net[cr]
		if -net[dr] < amt {
			amt = -net[dr]
		}
		result = append(result, Transfer{m.Order[dr], m.Order[cr], amt})
		net[cr] -= amt
		net[dr] += amt
	}
	return result
}

func main() {
	m := NewExpenseManager()
	m.AddUser("u1", "Aarav")
	m.AddUser("u2", "Bhavna")
	m.AddUser("u3", "Chirag")
	m.AddUser("u4", "Diya")
	all := []string{"u1", "u2", "u3", "u4"}
	m.CreateGroup("goa", "Goa trip", all)

	add := func(desc, paidBy string, amount int64, t SplitType, who []string, values ...int64) {
		e, err := m.AddExpense("goa", desc, paidBy, amount, t, who, values)
		if err != nil {
			fmt.Printf("Rejected '%s': %v\n", desc, err)
			return
		}
		parts := make([]string, len(e.Shares))
		for i, s := range e.Shares {
			parts[i] = m.Names[s.UserID] + " " + rs(s.Amount)
		}
		fmt.Printf("#%d %s: %s paid %s, %s -> %s\n", e.ID, desc, m.Names[paidBy], rs(amount), t, strings.Join(parts, ", "))
	}
	showSimplified := func() {
		for _, t := range m.SimplifyDebts() {
			fmt.Printf("  %s pays %s %s\n", m.Names[t.From], m.Names[t.To], rs(t.Amount))
		}
	}

	fmt.Println("== Expenses ==")
	add("Villa in Anjuna", "u1", 1200000, Equal, all)
	add("Scooter rentals", "u2", 100000, Equal, []string{"u2", "u3", "u4"})
	add("Scuba diving", "u3", 600000, Exact, all, 200000, 100000, 150000, 150000)
	add("Dinner at Thalassa", "u4", 325050, Percent, all, 40, 20, 20, 20)
	add("Airport cab", "u1", 100000, Shares, []string{"u1", "u2", "u4"}, 1, 2, 4)
	add("Souvenirs", "u2", 50000, Exact, []string{"u1", "u2"}, 20000, 20000)
	add("Parasailing", "u3", 300000, Percent, all, 50, 20, 10, 10)

	fmt.Println("== Balances ==")
	m.PrintBalances()
	fmt.Println("== Net per person ==")
	for i, v := range m.NetBalances() {
		if v >= 0 {
			fmt.Printf("  %s gets back %s\n", m.Names[m.Order[i]], rs(v))
		} else {
			fmt.Printf("  %s owes %s\n", m.Names[m.Order[i]], rs(-v))
		}
	}
	fmt.Println("== Simplified settlements ==")
	showSimplified()

	fmt.Println("== Diya pays Aarav Rs 2271.22 (settle up) ==")
	m.SettleUp("u4", "u1", 227122)
	m.PrintBalances()
	fmt.Println("== Simplified after settling ==")
	showSimplified()
	m.History("goa")
}`,
    },
  },
  diagrams: {
    add: String.raw`sequenceDiagram
  participant C as Client
  participant M as ExpenseManager
  participant S as ShareSplit
  participant B as BalanceSheet
  participant G as Group
  C->>M: addExpense(goa, Aarav paid 100000, SHARES, [Aarav, Bhavna, Diya], [1, 2, 4])
  M->>M: amount positive? all in group?
  M->>S: split(100000, 3, [1, 2, 4])
  S->>S: validate, floor shares, hand out leftover paise
  S-->>M: [14286, 28572, 57142]
  M->>B: record(Aarav, Bhavna, 28572)
  M->>B: record(Aarav, Diya, 57142)
  Note over M,B: Aarav's own share needs no entry
  M->>G: append Expense 5
  M-->>C: Expense 5`,
    after: String.raw`flowchart LR
  B[Bhavna] -->|"4269.16"| A[Aarav]
  D[Diya] -->|"2287.78"| A
  D -->|"516.57"| C[Chirag]`,
    before: String.raw`flowchart LR
  B[Bhavna] -->|"3285.72"| A[Aarav]
  C[Chirag] -->|"1000.00"| A
  D[Diya] -->|"2271.22"| A
  B -->|"666.67"| C
  D -->|"849.90"| C
  B -->|"316.77"| D`,
    classes: String.raw`classDiagram
  class ExpenseManager {
    -Map~String,User~ users
    -Map~String,Group~ groups
    -Map~SplitType,SplitStrategy~ strategies
    -BalanceSheet sheet
    +addUser(id, name)
    +createGroup(id, name, members)
    +addExpense(groupId, desc, paidBy, amount, type, participants, values) Expense
    +settleUp(from, to, amount)
    +printBalances()
    +simplifyDebts() List~Transfer~
    +history(groupId)
  }
  class User {
    +String id
    +String name
  }
  class Group {
    +String id
    +String name
    +List~String~ members
    +List~Expense~ expenses
  }
  class Expense {
    +int id
    +String description
    +String paidBy
    +long amount
    +SplitType type
    +List~Share~ shares
  }
  class Share {
    +String userId
    +long amount
  }
  class SplitType {
    <<enumeration>>
    EQUAL
    EXACT
    PERCENT
    SHARES
  }
  class SplitStrategy {
    <<interface>>
    +split(long total, int n, long[] values) long[]
  }
  class EqualSplit
  class ExactSplit
  class PercentSplit
  class ShareSplit
  class BalanceSheet {
    -Map balance
    +get(a, b) long
    +record(creditor, debtor, amount)
    +net(user, users) long
  }
  class Transfer {
    +String from
    +String to
    +long amount
  }
  ExpenseManager "1" o-- "*" User
  ExpenseManager "1" *-- "*" Group
  ExpenseManager --> BalanceSheet
  ExpenseManager --> SplitStrategy
  ExpenseManager ..> Transfer
  Group "1" *-- "*" Expense
  Expense "1" *-- "*" Share
  Expense --> SplitType
  SplitStrategy <|.. EqualSplit
  SplitStrategy <|.. ExactSplit
  SplitStrategy <|.. PercentSplit
  SplitStrategy <|.. ShareSplit`,
  },
});
