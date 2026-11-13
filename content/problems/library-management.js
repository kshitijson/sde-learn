SD.register({
  id: "library-management",
  html: String.raw`
<p class="lead">"Design a Library Management System" is a classic LLD question for SDE 1 interviews at Amazon, Flipkart, Paytm and service-to-product switch rounds. It looks like CRUD, but it hides three modelling traps that separate a good answer from an average one. First, a <em>book</em> and a <em>copy of a book</em> are different things. Second, reservations need a fair queue and a "held at the desk" step. Third, due dates and fines depend on time, and code that calls the system clock directly cannot be tested. This page builds a clean design that handles all three, with Strategy for fines, Observer for notifications, and full runnable code in five languages.</p>

<h2>Problem statement</h2>
<p>Design the software for a library, like a college central library or a city library such as the ones run by the British Council in Indian cities. The library has a catalogue of books, and several physical copies of popular books. Members search the catalogue, borrow copies, renew them, return them, and reserve books when every copy is out. Librarians add books and copies, issue and receive books at the desk, and collect fines for late returns.</p>
<p>In a machine-coding round you build the core in memory with a demo. In a discussion round you draw the classes, the key flows and the database tables. This page covers both.</p>

<div class="callout tip"><strong>Try it first</strong>Before reading on, take 10 minutes. The library has 3 copies of "Clean Code". All 3 are out, and two members want it. Write down what happens, step by step, when one copy comes back. Who gets it? How do they find out? What stops a third member from walking up to the desk and borrowing it first? And how would you test that a book returned 10 days late is fined correctly, without waiting 10 days?</div>

<details class="hint"><summary>Hint 1: A book is not a copy</summary>
<p>"Clean Code" has one ISBN, one title, one author. The library may own 3 copies of it, each with its own barcode, shelf position and status (on the shelf, on loan, held for someone). Searching works on <code>Book</code>; borrowing works on <code>BookItem</code>. Mixing the two is the most common mistake in this question.</p>
</details>
<details class="hint"><summary>Hint 2: Reservations need a hold state</summary>
<p>When a reserved book comes back, it should not go back on the shelf. It goes to the desk <em>on hold</em> for the first member in that book's queue, who is notified and has a few days to collect it. While on hold, only that member can borrow that copy. The queue is per book (ISBN), not per copy, because the member wants any copy.</p>
</details>
<details class="hint"><summary>Hint 3: Time is a dependency</summary>
<p>Due dates, renewals and fines all depend on "today". If your code calls <code>LocalDate.now()</code> directly, a test cannot say "it is now day 25". Inject a <code>Clock</code>. Production uses the system clock; tests and the demo use a fake clock they can move forward. Fine rules change too (per day, slabs, caps, no fines for faculty), so they belong behind a <code>FinePolicy</code> interface.</p>
</details>

<h2>Requirements</h2>
<p>Good clarifying questions: One branch or many? Physical books only, or also e-books? How many books can a member borrow, and for how long? Can members renew? Are there fines, and are they the same for everyone? How are members notified: SMS, email, app push?</p>
<div class="grid-2">
<div class="card">
<h3>Functional</h3>
<ul>
<li>Librarian adds books (ISBN, title, author, subject) and physical copies (barcode).</li>
<li>Search the catalogue by title, author or subject, showing how many copies are on the shelf.</li>
<li><strong>Issue</strong> a copy to a member, with a due date (14 days by default).</li>
<li><strong>Borrowing limit</strong> per member (2 for students, 5 for faculty, for example).</li>
<li><strong>Return</strong> a copy; if late, charge a fine using the fine policy.</li>
<li><strong>Renew</strong> a loan once, only if it is not overdue and nobody is waiting for the book.</li>
<li><strong>Reserve</strong> a book when no copy is on the shelf. Reservations are first come, first served.</li>
<li>When a reserved book is returned, hold it for the next member and <strong>notify</strong> them (SMS, email).</li>
<li>Members with unpaid fines cannot borrow until they pay.</li>
</ul>
</div>
<div class="card">
<h3>Non-functional</h3>
<ul>
<li><strong>Correctness:</strong> a copy is never issued to two members; the reservation queue is fair.</li>
<li><strong>Testable:</strong> time is injected, so due dates and fines are deterministic in tests.</li>
<li><strong>Extensible:</strong> new fine rules, member types and notification channels without editing the core flow.</li>
<li><strong>Concurrent desks:</strong> several librarians and a member app may act at the same time.</li>
<li><strong>Scale is small:</strong> a big university library has around 500,000 copies and maybe 5,000 transactions a day. A single relational database handles this easily.</li>
</ul>
</div>
</div>

<h2>How to approach the 60 to 90 minute machine-coding round</h2>
<div class="callout info"><strong>Time plan</strong>
<table>
<thead><tr><th>Minutes</th><th>What you do</th></tr></thead>
<tbody>
<tr><td>0 to 8</td><td>Clarify limits, loan period, renewals, fine rules and notification channels. Write down what you will skip (payments, multiple branches, e-books).</td></tr>
<tr><td>8 to 18</td><td>List entities and draw the <code>Book</code> vs <code>BookItem</code> split. Sketch the issue and return flows. Decide on the <code>Clock</code>, <code>FinePolicy</code> and listener interfaces.</td></tr>
<tr><td>18 to 55</td><td>Code models, then <code>Catalog</code> with search, then <code>Library</code>: issue, return, renew, reserve, pay fine. Throw clear errors for every rule.</td></tr>
<tr><td>55 to 70</td><td>Demo <code>main</code> with a fake clock: limit exceeded, reservation, renewal refused, late return with fine, hold and notify.</td></tr>
<tr><td>70 to 90</td><td>Walk through it. Discuss the database schema, concurrency at the desk, and how a new fine rule or channel plugs in.</td></tr>
</tbody>
</table>
<p><strong>What evaluators check:</strong></p>
<ol>
<li><strong>Book vs BookItem</strong> is modelled correctly.</li>
<li><strong>Business rules</strong> are enforced in one place (the service), with clear error messages.</li>
<li><strong>Patterns where they fit:</strong> Strategy for fines, Observer for notifications. Not patterns for their own sake.</li>
<li><strong>Testability:</strong> injected clock, deterministic demo.</li>
<li><strong>Edge cases:</strong> limit reached, overdue renewal, reserved copy taken by the wrong member, unpaid fines.</li>
</ol>
</div>

<h2>Core entities</h2>
<table>
<thead><tr><th>Entity</th><th>Kind</th><th>Responsibility</th></tr></thead>
<tbody>
<tr><td><code>Book</code></td><td>Value object</td><td>ISBN, title, author, subject. What you search for. Shared by all its copies.</td></tr>
<tr><td><code>BookItem</code></td><td>Entity</td><td>One physical copy: barcode, status (AVAILABLE, LOANED, ON_HOLD), and who it is held for.</td></tr>
<tr><td><code>Member</code></td><td>Entity</td><td>Id, name, borrowing limit, current loans, unpaid fines.</td></tr>
<tr><td><code>Librarian</code></td><td>Actor</td><td>Adds books and copies, operates the desk. In code, the librarian is whoever calls the <code>Library</code> admin methods; add a class with permissions when login is in scope.</td></tr>
<tr><td><code>Loan</code></td><td>Entity</td><td>Links a copy to a member: issue day, due day, renewals used. Kept as history after return.</td></tr>
<tr><td><code>Catalog</code></td><td>Repository</td><td>Stores books and copies; search by title, author or subject.</td></tr>
<tr><td><code>Clock</code></td><td>Interface</td><td><code>today()</code>. <code>FakeClock</code> in tests and the demo.</td></tr>
<tr><td><code>FinePolicy</code></td><td>Interface (Strategy)</td><td><code>fine(daysLate)</code>. <code>PerDayFine</code>, <code>SlabFine</code>, or a capped policy.</td></tr>
<tr><td><code>HoldListener</code></td><td>Interface (Observer)</td><td><code>onHoldReady(member, item, untilDay)</code>. <code>SmsNotifier</code>, <code>EmailNotifier</code>.</td></tr>
<tr><td><code>Library</code></td><td>Service (Facade)</td><td>The single entry point. Enforces every rule: limits, holds, renewals, fines, reservation queues.</td></tr>
</tbody>
</table>

<h2>Class diagram</h2>
<div data-diagram="classes" data-caption="The Library service coordinates. Fines are a Strategy, notifications are Observers, time comes from an injected Clock."></div>

<h2>The life of a copy</h2>
<div data-diagram="itemStates" data-caption="A BookItem moves between three states. Holds exist so a reserved copy cannot be grabbed by someone else."></div>
<p>The ON_HOLD state is what makes reservations fair. Without it, a returned copy goes back on the shelf and whoever reaches it first wins, which defeats the queue. With it, the copy is kept at the desk for the first member in line until they collect it, or until the hold expires (3 days here), when it moves to the next member or back to the shelf.</p>

<h2>Issue and return flows</h2>
<div data-diagram="flow" data-caption="Issue checks fines, limit and copy status. Return computes the fine and hands the copy to the reservation queue."></div>
<ol class="steps">
<li><strong>Issue:</strong> the librarian scans the member card and the copy's barcode. The library checks, in order: unpaid fines, borrowing limit, copy already on loan, copy on hold for someone else. Any failure stops the issue with a clear message.</li>
<li>If all checks pass, the copy becomes LOANED, a <code>Loan</code> is created with <code>dueDay = today + 14</code>, and if this member was in the book's reservation queue they are removed from it.</li>
<li><strong>Return:</strong> the loan is closed. Days late = <code>max(0, today - dueDay)</code>. The fine policy turns that into rupees, added to the member's unpaid fines.</li>
<li>If the book's reservation queue is not empty, the first member is taken off the queue, the copy becomes ON_HOLD for them, and every listener is told. Otherwise the copy goes back to AVAILABLE.</li>
</ol>

<h2>Business rules in one place</h2>
<table>
<thead><tr><th>Rule</th><th>Default</th><th>Where it lives</th></tr></thead>
<tbody>
<tr><td>Loan period</td><td>14 days</td><td><code>Library</code> constructor</td></tr>
<tr><td>Borrowing limit</td><td>2 (student), 5 (faculty)</td><td><code>Member.maxBooks</code>, or a <code>MemberType</code></td></tr>
<tr><td>Renewals</td><td>1, not if overdue, not if someone is waiting</td><td><code>Library.renew</code></td></tr>
<tr><td>Reservation</td><td>Only when no copy is on the shelf; one entry per member per book</td><td><code>Library.reserve</code></td></tr>
<tr><td>Hold period</td><td>3 days at the desk</td><td><code>Library</code> constructor</td></tr>
<tr><td>Fine</td><td>Rs10 per day late</td><td><code>FinePolicy</code> (Strategy)</td></tr>
<tr><td>Blocked borrowing</td><td>Any unpaid fine</td><td><code>Library.issue</code></td></tr>
</tbody>
</table>
<p>Keeping every rule inside the <code>Library</code> service (not in <code>Member</code> or <code>BookItem</code>) is deliberate. Entities hold state; the service enforces rules that involve several entities at once. When the rule changes ("faculty can renew twice"), there is exactly one place to look.</p>

<h2>Design patterns used and why</h2>
<h3>Strategy: fine policy</h3>
<p>Fine rules change more often than anything else in a library. A college might charge Rs2 a day for the first week and Rs5 after that; a city library might cap the fine at the book's price; faculty might pay nothing. <code>FinePolicy</code> has one method, <code>fine(daysLate)</code>, and the library receives one in its constructor. The demo compares <code>PerDayFine(10)</code> with <code>SlabFine(7, 5, 10)</code>: 10 days late costs Rs100 under the first and Rs65 under the second (7 x 5 + 3 x 10). A per-member policy is one more step: look the policy up by member type. See <a href="#/p/behavioral-patterns">behavioural patterns</a>.</p>
<h3>Observer: notifications</h3>
<p>When a held book is ready, the member should get an SMS and an email today, and maybe a WhatsApp message or app push next quarter. The library should not know about any of these. It keeps a list of <code>HoldListener</code>s and calls <code>onHoldReady</code> on each one. Adding WhatsApp is a new listener class plus one <code>subscribe</code> call. In production the listener would put a message on a queue rather than send directly, so a slow SMS gateway never slows down the desk; see <a href="#/p/message-queues">message queues</a> and the <a href="#/p/notification-system">notification system</a> design.</p>
<h3>Dependency injection: the clock</h3>
<p>The <code>Clock</code> is not a Gang of Four pattern, but it matters more in this question than any pattern. Every rule about time (due dates, renewals, overdue checks, fines, hold expiry) reads <code>clock.today()</code>. The demo starts on day 1, moves to day 10 to renew, then to day 25 for a late return, all in a few microseconds. The demo uses whole day numbers to keep the output identical across languages; real code would use <code>LocalDate</code>, <code>datetime.date</code> or <code>time.Time</code> with the same idea.</p>
<h3>Facade and Repository</h3>
<p><code>Library</code> is a facade: the desk UI, the member app and the admin screen all call the same five methods and never touch the maps inside. <code>Catalog</code> is a simple repository: today an in-memory map, tomorrow a database, with the same methods. Both ideas keep the code easy to change; see <a href="#/p/structural-patterns">structural patterns</a>.</p>
<h3>What about Singleton?</h3>
<p>"There is only one library" is the usual excuse for <code>Library.getInstance()</code>. Avoid it. A city system has many branches, tests need a fresh library each time, and a hidden global makes the clock and fine policy impossible to swap. Create one instance in <code>main</code> and pass it to whoever needs it.</p>

<h2>Search</h2>
<p>The demo searches with a simple case-insensitive "contains" over every book. That is O(number of books) per search, which is fine for 50,000 titles in memory: a few milliseconds. Mention what you would do at scale:</p>
<ul>
<li><strong>Indexes by field:</strong> a map from each lowercased word in titles, authors and subjects to the set of ISBNs that contain it (an inverted index). A query looks up each word and intersects the sets.</li>
<li><strong>In the database:</strong> a B-tree index on author and subject for exact and prefix matches, and full-text search for titles. See <a href="#/p/indexing">indexing</a>.</li>
<li><strong>At large scale or with typo tolerance:</strong> a search engine like Elasticsearch, kept in sync from the database. See <a href="#/p/search-index">search indexes</a>.</li>
</ul>
<p>Search returns <code>Book</code>s, and the result shows how many copies are on the shelf, because that is what a member actually wants to know.</p>

<h2>Full implementation</h2>
<p>Each tab is one self-contained file that compiles and runs. Errors are exceptions (or returned errors in Go) with human-readable messages; the demo's <code>attempt</code> helper prints them as "Refused". Every public method on <code>Library</code> takes one lock, so two desks can never issue the same copy.</p>
<div data-code="full"></div>
<p>Expected output (identical in every language):</p>
<pre><code>== 1. Search ==
author contains 'martin':
  Clean Code - Robert C. Martin (Software), 2 of 2 on shelf
  Designing Data-Intensive Applications - Martin Kleppmann (Databases), 1 of 1 on shelf
subject contains 'software':
  Clean Code - Robert C. Martin (Software), 2 of 2 on shelf
  The Pragmatic Programmer - Andrew Hunt (Software), 1 of 1 on shelf
title contains 'wings':
  Wings of Fire - A. P. J. Abdul Kalam (Biography), 1 of 1 on shelf
== 2. Issue and borrowing limit (day 1) ==
Issued 'Clean Code' (CC-1) to Asha, due day 15
Issued 'Designing Data-Intensive Applications' (DDIA-1) to Asha, due day 15
Refused: Asha already has 2 of 2 books
== 3. Reservation queue ==
Refused: DDIA-1 is already on loan
Ravi reserved 'Designing Data-Intensive Applications', position 1 in queue
Refused: a copy of 'Clean Code' is on the shelf, borrow it instead
== 4. Renewals (day 10) ==
Renewed CC-1 for Asha, now due day 24
Refused: CC-1 has used its 1 renewal(s)
Refused: someone is waiting for 'Designing Data-Intensive Applications'
== 5. Late return, hold and notify (day 25) ==
  [SMS to Ravi] 'Designing Data-Intensive Applications' is waiting for you at the desk until day 28
  [Email to Ravi] Your reservation for 'Designing Data-Intensive Applications' (DDIA-1) is ready
Asha returned DDIA-1 on day 25: 10 days late, fine Rs100. On hold for Ravi
Refused: DDIA-1 is on hold for Ravi
Issued 'Designing Data-Intensive Applications' (DDIA-1) to Ravi, due day 39
== 6. Fines block borrowing ==
Refused: Asha has unpaid fines of Rs100
Asha paid Rs100, fines due Rs0
Issued 'The Pragmatic Programmer' (PP-1) to Asha, due day 39
== 7. Swap the fine policy ==
10 days late: per-day Rs100, slab Rs65</code></pre>
<p>Things to point out when you walk through it:</p>
<ul>
<li><strong>Search shows Book, issue uses BookItem.</strong> "martin" matches both Robert C. Martin and Martin Kleppmann, and each result shows copies on the shelf.</li>
<li><strong>Reservation is refused when a copy is on the shelf.</strong> Kabir cannot reserve "Clean Code" because CC-2 is available; he should just borrow it.</li>
<li><strong>Renewal rules are ordered.</strong> The second renewal of CC-1 fails on the limit; the renewal of DDIA-1 fails because Ravi is waiting.</li>
<li><strong>Notifications fire before the receipt is printed</strong>, because the listeners are called inside <code>returnItem</code>. In production they would enqueue messages and return at once.</li>
<li><strong>The hold is enforced.</strong> Kabir cannot take DDIA-1 off the desk; Ravi can.</li>
<li><strong>Fines block borrowing</strong> until paid, and the fine policy is swappable without touching <code>Library</code>.</li>
</ul>

<h2>Data model for persistence</h2>
<p>If the interviewer asks "how would you store this?", sketch the tables. The <code>Book</code> vs <code>BookItem</code> split maps directly onto two tables. See <a href="#/p/schema-design">schema design</a>.</p>
<table>
<thead><tr><th>Table</th><th>Key columns</th><th>Notes</th></tr></thead>
<tbody>
<tr><td><code>book</code></td><td>isbn (PK), title, author, subject</td><td>Full-text index on title; index on author, subject.</td></tr>
<tr><td><code>book_item</code></td><td>barcode (PK), isbn (FK), status, held_for, hold_until, version</td><td>Index on (isbn, status) to find a shelf copy fast.</td></tr>
<tr><td><code>member</code></td><td>id (PK), name, type, fine_due</td><td><code>type</code> decides limit and fine policy.</td></tr>
<tr><td><code>loan</code></td><td>id (PK), barcode (FK), member_id (FK), issued_on, due_on, returned_on, renewals</td><td>Kept forever as history. Partial unique index: one open loan per barcode.</td></tr>
<tr><td><code>reservation</code></td><td>id (PK), isbn (FK), member_id (FK), created_at, status</td><td>Queue order = <code>created_at</code>. Unique (isbn, member_id) while active.</td></tr>
<tr><td><code>fine_payment</code></td><td>id (PK), member_id (FK), amount, paid_at, method</td><td>UPI or cash. Never update <code>fine_due</code> without a payment row.</td></tr>
</tbody>
</table>

<h2>Concurrency</h2>
<p>A library feels slow-moving, but there are real races. Two librarians at two desks scan the last copy of a bestseller for two members at the same second. A member reserves from the app at the moment the copy is returned at the desk.</p>
<ul>
<li><strong>In memory (the round):</strong> one lock around every public method of <code>Library</code>, as in the code. The traffic is a few requests a second, so a single lock never becomes a bottleneck. Finer locks (per copy, per ISBN) add risk for no benefit at this scale.</li>
<li><strong>With a database:</strong> make "check status and change it" one atomic step. Either a conditional update, <code>UPDATE book_item SET status = 'LOANED' WHERE barcode = ? AND status = 'AVAILABLE'</code>, and treat "0 rows updated" as "someone else got it"; or <code>SELECT ... FOR UPDATE</code> inside a transaction. The loan insert and the status change must be in the same transaction. See <a href="#/p/transactions">transactions</a> and <a href="#/p/concurrency">concurrency</a>.</li>
<li><strong>Notifications outside the lock:</strong> sending an SMS can take a second. Collect the events inside the lock and publish them after it is released, or write them to an outbox table in the same transaction and let a worker send them.</li>
</ul>

<h2>Extensibility</h2>
<div class="tabs">
<section data-tab="Member types">
<p>Students borrow 2 books for 14 days; faculty borrow 5 for 30 days and pay no fines. Add a <code>MemberType</code> (or a <code>MembershipPlan</code>) holding limit, loan period, renewals and fine policy. <code>Library</code> reads the rules from the member's plan instead of its own constructor. No <code>if (member.isFaculty())</code> anywhere.</p>
</section>
<section data-tab="Hold expiry">
<p>A daily job (or a scheduled check on every desk action) finds holds whose <code>holdUntil</code> has passed, gives the copy to the next member in the queue (and notifies them), or puts it back on the shelf. Because the clock is injected, the test is "advance the clock 4 days, run the job, check the copy moved on".</p>
</section>
<section data-tab="Multiple branches">
<p>Add a <code>Branch</code>; each <code>BookItem</code> belongs to one. Search shows availability per branch. Reservations can be "any branch" (with an inter-branch transfer) or "this branch". The <code>Book</code> catalogue stays shared.</p>
</section>
<section data-tab="E-books">
<p>An e-book licence allows N concurrent loans and has no barcode or shelf. Model it as a different kind of item behind a small interface (<code>Lendable</code>: <code>canLend</code>, <code>lend</code>, <code>giveBack</code>). Loans expire automatically, so there are no fines.</p>
</section>
<section data-tab="Paying fines">
<p>Add a <code>PaymentGateway</code> interface (cash at the desk, UPI via Razorpay or PhonePe). Record every payment in its own table, and use the payment id as an idempotency key so a retried UPI callback does not clear the fine twice.</p>
</section>
</div>

<h2>Common mistakes</h2>
<div class="callout warn"><strong>Things that lose marks</strong>
<ul>
<li>One <code>Book</code> class with a <code>quantity</code> field, so you cannot tell which copy a member has or where it is.</li>
<li>Calling the system clock directly, so due dates and fines cannot be tested.</li>
<li>Putting a returned reserved book back on the shelf instead of holding it for the next member.</li>
<li>Reservation queues per copy instead of per book.</li>
<li>Fine calculation as a hard-coded formula inside <code>returnBook</code>.</li>
<li>Rules spread across <code>Member</code>, <code>BookItem</code> and the UI instead of one service.</li>
<li>Using <code>double</code> for rupees. Fines are whole rupees (or paise) as integers.</li>
<li>Sending SMS synchronously while holding the library lock.</li>
</ul>
</div>

<div class="callout interview"><strong>Say this in the interview</strong>"I will separate Book, which is the catalogue entry, from BookItem, which is a physical copy with a barcode and a status. Members borrow BookItems through a Loan. All rules live in one Library service: issue checks unpaid fines, the borrowing limit and the copy's status; return computes days late and asks a FinePolicy strategy for the amount. Reservations are a FIFO queue per ISBN; when a copy comes back and the queue is not empty, it goes ON_HOLD for the first member and the Library notifies its listeners, which are SMS and email observers. Time comes from an injected Clock, so I can test a 10-day-late return instantly. With a database, issuing is a conditional update on the copy's status inside a transaction."</div>

<h2>Follow-up questions</h2>
<div class="quiz">
<details><summary>Why separate Book and BookItem? Would a quantity field not be enough?</summary><div>A quantity tells you how many copies exist, but not which copy a member has, where each copy is, whether a specific copy is damaged, or which copy is on hold for whom. Loans, holds and barcodes all belong to a physical copy. Search and reservations belong to the title. Two classes (and two tables) model this cleanly.</div></details>
<details><summary>A reserved book is returned. Walk through exactly what happens.</summary><div>The loan is closed and the fine (if late) is added to the returning member. The library looks at the reservation queue for that ISBN. If it has someone, it removes the first member, marks the copy ON_HOLD for them with a hold-until date (today + 3), and notifies every listener (SMS, email). Only that member can now borrow that copy. If they do not collect it in time, the hold passes to the next member or the copy goes back on the shelf.</div></details>
<details><summary>How do you test that a book returned 10 days late is fined Rs100?</summary><div>Inject a fake clock. Issue on day 1 (due day 15), advance the fake clock to day 25, return the book, and assert that the member's fine is 10 x Rs10 = Rs100. No sleeping, no real dates, the test runs in microseconds. The same fake clock tests renewals, overdue checks and hold expiry.</div></details>
<details><summary>Two librarians try to issue the last copy at the same time. How do you prevent a double issue?</summary><div>In memory, one lock around the issue method makes "check status and mark LOANED" atomic. In a database, use a conditional update (<code>UPDATE book_item SET status='LOANED' WHERE barcode=? AND status='AVAILABLE'</code>) and treat 0 rows updated as "already taken", or lock the row with <code>SELECT ... FOR UPDATE</code>. Create the loan row in the same transaction.</div></details>
<details><summary>The library wants faculty to pay no fines and students to pay slab rates. What changes?</summary><div>Only configuration. Add a <code>NoFine</code> policy that always returns 0, keep <code>SlabFine</code> for students, and pick the policy by member type (a map from type to policy, or a field on a membership plan). The return flow still calls <code>policy.fine(daysLate)</code>. This is the Strategy pattern paying off.</div></details>
<details><summary>Why is renewal refused when someone has reserved the book?</summary><div>Renewal would push back the date the waiting member gets the book, which is unfair to them and defeats the queue. So the rule is: renew only if the loan is not overdue, the renewal limit is not reached, and the book's reservation queue is empty. The code checks all three and gives a different message for each.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
<li>Separate <code>Book</code> (catalogue entry, what you search) from <code>BookItem</code> (physical copy, what you borrow).</li>
<li>Keep every business rule in one <code>Library</code> service with clear errors: fines, limits, holds, renewals.</li>
<li>Reservations are a FIFO queue per ISBN plus an ON_HOLD state so the next member really gets the copy.</li>
<li>Fines are a Strategy and notifications are Observers; both change without touching the core flow.</li>
<li>Inject the clock. Time-based rules are only testable when "today" is a dependency.</li>
<li>With a database, issuing is a conditional update or row lock inside a transaction, so a copy is never issued twice.</li>
</ul></div>
`,
  code: {
    full: {
      title: "Complete library management system (single file, runnable)",
      java: String.raw`// Library management: books vs copies, loans, renewals, reservations, fines.
// Run: javac LibraryDemo.java && java LibraryDemo
import java.util.*;
import java.util.function.Function;
import java.util.function.Supplier;

public class LibraryDemo {

    static class LibraryException extends RuntimeException {
        LibraryException(String msg) { super(msg); }
    }

    enum ItemStatus { AVAILABLE, LOANED, ON_HOLD }

    // The title in the catalogue. One Book has many physical copies (BookItems).
    record Book(String isbn, String title, String author, String subject) {}

    // One physical copy with its own barcode and status.
    static class BookItem {
        final String barcode;
        final Book book;
        ItemStatus status = ItemStatus.AVAILABLE;
        Member heldFor = null; // set when ON_HOLD
        BookItem(String barcode, Book book) { this.barcode = barcode; this.book = book; }
    }

    static class Member {
        final String id, name;
        final int maxBooks;
        final List<String> loans = new ArrayList<>(); // barcodes
        int fineDue = 0;
        Member(String id, String name, int maxBooks) { this.id = id; this.name = name; this.maxBooks = maxBooks; }
    }

    static class Loan {
        final BookItem item;
        final Member member;
        final int issueDay;
        int dueDay, renewals = 0;
        Loan(BookItem item, Member member, int issueDay, int dueDay) {
            this.item = item; this.member = member; this.issueDay = issueDay; this.dueDay = dueDay;
        }
    }

    // ---------- Injectable clock: days as integers keep the demo deterministic ----------
    interface Clock { int today(); }

    static class FakeClock implements Clock {
        private int day;
        FakeClock(int day) { this.day = day; }
        public int today() { return day; }
        void advance(int days) { day += days; }
    }

    // ---------- Strategy: fine policy ----------
    interface FinePolicy { int fine(int daysLate); }

    record PerDayFine(int rate) implements FinePolicy {
        public int fine(int daysLate) { return daysLate * rate; }
    }

    // Cheap for the first few days, steeper after that.
    record SlabFine(int slabDays, int lowRate, int highRate) implements FinePolicy {
        public int fine(int daysLate) {
            int low = Math.min(daysLate, slabDays);
            return low * lowRate + (daysLate - low) * highRate;
        }
    }

    // ---------- Observer: who hears that a reserved book is ready ----------
    interface HoldListener { void onHoldReady(Member m, BookItem item, int untilDay); }

    static class SmsNotifier implements HoldListener {
        public void onHoldReady(Member m, BookItem item, int untilDay) {
            System.out.printf("  [SMS to %s] '%s' is waiting for you at the desk until day %d%n", m.name, item.book.title(), untilDay);
        }
    }

    static class EmailNotifier implements HoldListener {
        public void onHoldReady(Member m, BookItem item, int untilDay) {
            System.out.printf("  [Email to %s] Your reservation for '%s' (%s) is ready%n", m.name, item.book.title(), item.barcode);
        }
    }

    static class Catalog {
        static final Map<String, Function<Book, String>> FIELDS =
                Map.of("title", Book::title, "author", Book::author, "subject", Book::subject);
        final Map<String, Book> books = new LinkedHashMap<>();     // isbn -> Book
        final Map<String, BookItem> items = new LinkedHashMap<>(); // barcode -> BookItem

        void addBook(Book book, String... barcodes) {
            books.put(book.isbn(), book);
            for (String code : barcodes) items.put(code, new BookItem(code, book));
        }
        List<BookItem> copies(String isbn) {
            List<BookItem> out = new ArrayList<>();
            for (BookItem i : items.values()) if (i.book.isbn().equals(isbn)) out.add(i);
            return out;
        }
        List<Book> search(String field, String query) {
            Function<Book, String> get = FIELDS.get(field);
            String q = query.toLowerCase();
            List<Book> out = new ArrayList<>();
            for (Book b : books.values()) if (get.apply(b).toLowerCase().contains(q)) out.add(b);
            return out;
        }
    }

    static class Library {
        private final Clock clock;
        private final FinePolicy finePolicy;
        private final int loanDays, maxRenewals, holdDays;
        final Catalog catalog = new Catalog();
        private final Map<String, Member> members = new HashMap<>();
        private final Map<String, Loan> loans = new HashMap<>();                // barcode -> active loan
        private final Map<String, Deque<Member>> reservations = new HashMap<>(); // isbn -> FIFO queue
        private final List<HoldListener> listeners = new ArrayList<>();

        Library(Clock clock, FinePolicy finePolicy, int loanDays, int maxRenewals, int holdDays) {
            this.clock = clock; this.finePolicy = finePolicy;
            this.loanDays = loanDays; this.maxRenewals = maxRenewals; this.holdDays = holdDays;
        }

        void subscribe(HoldListener l) { listeners.add(l); }
        void addMember(Member m) { members.put(m.id, m); }

        private BookItem item(String barcode) {
            BookItem i = catalog.items.get(barcode);
            if (i == null) throw new LibraryException("unknown barcode " + barcode);
            return i;
        }

        synchronized String issue(String memberId, String barcode) {
            Member m = members.get(memberId);
            BookItem item = item(barcode);
            if (m.fineDue > 0) throw new LibraryException(m.name + " has unpaid fines of Rs" + m.fineDue);
            if (m.loans.size() >= m.maxBooks)
                throw new LibraryException(m.name + " already has " + m.loans.size() + " of " + m.maxBooks + " books");
            if (item.status == ItemStatus.LOANED) throw new LibraryException(barcode + " is already on loan");
            if (item.status == ItemStatus.ON_HOLD && item.heldFor != m)
                throw new LibraryException(barcode + " is on hold for " + item.heldFor.name);
            Deque<Member> queue = reservations.get(item.book.isbn());
            if (queue != null) queue.remove(m); // they got a copy, so they leave the queue
            int today = clock.today();
            Loan loan = new Loan(item, m, today, today + loanDays);
            item.status = ItemStatus.LOANED;
            item.heldFor = null;
            m.loans.add(barcode);
            loans.put(barcode, loan);
            return "Issued '" + item.book.title() + "' (" + barcode + ") to " + m.name + ", due day " + loan.dueDay;
        }

        synchronized String renew(String memberId, String barcode) {
            Loan loan = loans.get(barcode);
            if (loan == null || !loan.member.id.equals(memberId))
                throw new LibraryException(barcode + " is not on loan to this member");
            int today = clock.today();
            if (today > loan.dueDay) throw new LibraryException(barcode + " is overdue, return it first");
            if (loan.renewals >= maxRenewals)
                throw new LibraryException(barcode + " has used its " + maxRenewals + " renewal(s)");
            Deque<Member> queue = reservations.get(loan.item.book.isbn());
            if (queue != null && !queue.isEmpty())
                throw new LibraryException("someone is waiting for '" + loan.item.book.title() + "'");
            loan.renewals++;
            loan.dueDay = today + loanDays;
            return "Renewed " + barcode + " for " + loan.member.name + ", now due day " + loan.dueDay;
        }

        synchronized String reserve(String memberId, String isbn) {
            Member m = members.get(memberId);
            Book book = catalog.books.get(isbn);
            for (BookItem i : catalog.copies(isbn))
                if (i.status == ItemStatus.AVAILABLE)
                    throw new LibraryException("a copy of '" + book.title() + "' is on the shelf, borrow it instead");
            Deque<Member> queue = reservations.computeIfAbsent(isbn, k -> new ArrayDeque<>());
            if (queue.contains(m)) throw new LibraryException(m.name + " already reserved '" + book.title() + "'");
            queue.addLast(m);
            return m.name + " reserved '" + book.title() + "', position " + queue.size() + " in queue";
        }

        synchronized String returnItem(String barcode) {
            Loan loan = loans.remove(barcode);
            if (loan == null) throw new LibraryException(barcode + " is not on loan");
            BookItem item = loan.item;
            Member m = loan.member;
            int today = clock.today();
            m.loans.remove(barcode);
            int daysLate = Math.max(0, today - loan.dueDay);
            int fine = finePolicy.fine(daysLate);
            m.fineDue += fine;
            String msg = m.name + " returned " + barcode + " on day " + today
                    + (daysLate > 0 ? ": " + daysLate + " days late, fine Rs" + fine : ": on time");
            Deque<Member> queue = reservations.get(item.book.isbn());
            if (queue != null && !queue.isEmpty()) {
                Member next = queue.pollFirst();
                item.status = ItemStatus.ON_HOLD;
                item.heldFor = next;
                for (HoldListener l : listeners) l.onHoldReady(next, item, today + holdDays);
                return msg + ". On hold for " + next.name;
            }
            item.status = ItemStatus.AVAILABLE;
            return msg;
        }

        synchronized String payFine(String memberId, int amount) {
            Member m = members.get(memberId);
            m.fineDue = Math.max(0, m.fineDue - amount);
            return m.name + " paid Rs" + amount + ", fines due Rs" + m.fineDue;
        }
    }

    static void attempt(Supplier<String> action) {
        try {
            System.out.println(action.get());
        } catch (LibraryException e) {
            System.out.println("Refused: " + e.getMessage());
        }
    }

    public static void main(String[] args) {
        FakeClock clock = new FakeClock(1);
        Library lib = new Library(clock, new PerDayFine(10), 14, 1, 3);
        lib.subscribe(new SmsNotifier());
        lib.subscribe(new EmailNotifier());
        lib.catalog.addBook(new Book("9780132350884", "Clean Code", "Robert C. Martin", "Software"), "CC-1", "CC-2");
        lib.catalog.addBook(new Book("9781449373320", "Designing Data-Intensive Applications", "Martin Kleppmann", "Databases"), "DDIA-1");
        lib.catalog.addBook(new Book("9780201616224", "The Pragmatic Programmer", "Andrew Hunt", "Software"), "PP-1");
        lib.catalog.addBook(new Book("9788173711466", "Wings of Fire", "A. P. J. Abdul Kalam", "Biography"), "WOF-1");
        lib.addMember(new Member("M1", "Asha", 2));
        lib.addMember(new Member("M2", "Ravi", 2));
        lib.addMember(new Member("M3", "Kabir", 5));

        System.out.println("== 1. Search ==");
        String[][] queries = {{"author", "martin"}, {"subject", "software"}, {"title", "wings"}};
        for (String[] q : queries) {
            System.out.println(q[0] + " contains '" + q[1] + "':");
            for (Book b : lib.catalog.search(q[0], q[1])) {
                List<BookItem> copies = lib.catalog.copies(b.isbn());
                long free = copies.stream().filter(i -> i.status == ItemStatus.AVAILABLE).count();
                System.out.printf("  %s - %s (%s), %d of %d on shelf%n", b.title(), b.author(), b.subject(), free, copies.size());
            }
        }

        System.out.println("== 2. Issue and borrowing limit (day " + clock.today() + ") ==");
        attempt(() -> lib.issue("M1", "CC-1"));
        attempt(() -> lib.issue("M1", "DDIA-1"));
        attempt(() -> lib.issue("M1", "PP-1"));

        System.out.println("== 3. Reservation queue ==");
        attempt(() -> lib.issue("M2", "DDIA-1"));
        attempt(() -> lib.reserve("M2", "9781449373320"));
        attempt(() -> lib.reserve("M3", "9780132350884"));

        clock.advance(9);
        System.out.println("== 4. Renewals (day " + clock.today() + ") ==");
        attempt(() -> lib.renew("M1", "CC-1"));
        attempt(() -> lib.renew("M1", "CC-1"));
        attempt(() -> lib.renew("M1", "DDIA-1"));

        clock.advance(15);
        System.out.println("== 5. Late return, hold and notify (day " + clock.today() + ") ==");
        attempt(() -> lib.returnItem("DDIA-1"));
        attempt(() -> lib.issue("M3", "DDIA-1"));
        attempt(() -> lib.issue("M2", "DDIA-1"));

        System.out.println("== 6. Fines block borrowing ==");
        attempt(() -> lib.issue("M1", "PP-1"));
        attempt(() -> lib.payFine("M1", 100));
        attempt(() -> lib.issue("M1", "PP-1"));

        System.out.println("== 7. Swap the fine policy ==");
        System.out.println("10 days late: per-day Rs" + new PerDayFine(10).fine(10) + ", slab Rs" + new SlabFine(7, 5, 10).fine(10));
    }
}`,
      python: String.raw`# Library management: books vs copies, loans, renewals, reservations, fines.
# Run: python3 main.py
import functools
import threading
from collections import deque
from enum import Enum


def synchronized(method):
    """One lock per Library: issue, return, renew and reserve never interleave."""

    @functools.wraps(method)
    def wrapper(self, *args):
        with self._lock:
            return method(self, *args)

    return wrapper


class LibraryError(Exception):
    pass


class ItemStatus(Enum):
    AVAILABLE = "AVAILABLE"
    LOANED = "LOANED"
    ON_HOLD = "ON_HOLD"


class Book:
    """The title in the catalogue. One Book has many physical copies (BookItems)."""

    def __init__(self, isbn, title, author, subject):
        self.isbn, self.title, self.author, self.subject = isbn, title, author, subject


class BookItem:
    """One physical copy with its own barcode and status."""

    def __init__(self, barcode, book):
        self.barcode = barcode
        self.book = book
        self.status = ItemStatus.AVAILABLE
        self.held_for = None  # Member, when ON_HOLD


class Member:
    def __init__(self, member_id, name, max_books):
        self.id, self.name, self.max_books = member_id, name, max_books
        self.loans = []  # barcodes
        self.fine_due = 0


class Loan:
    def __init__(self, item, member, issue_day, due_day):
        self.item, self.member = item, member
        self.issue_day, self.due_day = issue_day, due_day
        self.renewals = 0


# ---------- Injectable clock: days as integers keep the demo deterministic ----------
class FakeClock:
    def __init__(self, day):
        self.day = day

    def today(self):
        return self.day

    def advance(self, days):
        self.day += days


# ---------- Strategy: fine policy ----------
class PerDayFine:
    def __init__(self, rate):
        self.rate = rate

    def fine(self, days_late):
        return days_late * self.rate


class SlabFine:
    """Cheap for the first few days, steeper after that."""

    def __init__(self, slab_days, low_rate, high_rate):
        self.slab_days, self.low_rate, self.high_rate = slab_days, low_rate, high_rate

    def fine(self, days_late):
        low = min(days_late, self.slab_days)
        return low * self.low_rate + (days_late - low) * self.high_rate


# ---------- Observer: who hears that a reserved book is ready ----------
class SmsNotifier:
    def on_hold_ready(self, member, item, until_day):
        print("  [SMS to %s] '%s' is waiting for you at the desk until day %d" % (member.name, item.book.title, until_day))


class EmailNotifier:
    def on_hold_ready(self, member, item, until_day):
        print("  [Email to %s] Your reservation for '%s' (%s) is ready" % (member.name, item.book.title, item.barcode))


class Catalog:
    FIELDS = {"title": lambda b: b.title, "author": lambda b: b.author, "subject": lambda b: b.subject}

    def __init__(self):
        self.books = {}  # isbn -> Book (insertion order)
        self.items = {}  # barcode -> BookItem

    def add_book(self, book, *barcodes):
        self.books[book.isbn] = book
        for code in barcodes:
            self.items[code] = BookItem(code, book)

    def copies(self, isbn):
        return [i for i in self.items.values() if i.book.isbn == isbn]

    def search(self, field, query):
        get, q = self.FIELDS[field], query.lower()
        return [b for b in self.books.values() if q in get(b).lower()]


class Library:
    def __init__(self, clock, fine_policy, loan_days=14, max_renewals=1, hold_days=3):
        self.clock, self.fine_policy = clock, fine_policy
        self.loan_days, self.max_renewals, self.hold_days = loan_days, max_renewals, hold_days
        self.catalog = Catalog()
        self.members = {}
        self.loans = {}         # barcode -> active Loan
        self.reservations = {}  # isbn -> deque of Members (FIFO)
        self.listeners = []
        self._lock = threading.Lock()

    def subscribe(self, listener):
        self.listeners.append(listener)

    def add_member(self, member):
        self.members[member.id] = member

    def _item(self, barcode):
        if barcode not in self.catalog.items:
            raise LibraryError("unknown barcode " + barcode)
        return self.catalog.items[barcode]

    @synchronized
    def issue(self, member_id, barcode):
        m, item = self.members[member_id], self._item(barcode)
        if m.fine_due > 0:
            raise LibraryError("%s has unpaid fines of Rs%d" % (m.name, m.fine_due))
        if len(m.loans) >= m.max_books:
            raise LibraryError("%s already has %d of %d books" % (m.name, len(m.loans), m.max_books))
        if item.status == ItemStatus.LOANED:
            raise LibraryError("%s is already on loan" % barcode)
        if item.status == ItemStatus.ON_HOLD and item.held_for is not m:
            raise LibraryError("%s is on hold for %s" % (barcode, item.held_for.name))
        queue = self.reservations.get(item.book.isbn)
        if queue and m in queue:
            queue.remove(m)  # they got a copy, so they leave the queue
        today = self.clock.today()
        loan = Loan(item, m, today, today + self.loan_days)
        item.status, item.held_for = ItemStatus.LOANED, None
        m.loans.append(barcode)
        self.loans[barcode] = loan
        return "Issued '%s' (%s) to %s, due day %d" % (item.book.title, barcode, m.name, loan.due_day)

    @synchronized
    def renew(self, member_id, barcode):
        loan = self.loans.get(barcode)
        if loan is None or loan.member.id != member_id:
            raise LibraryError("%s is not on loan to this member" % barcode)
        today = self.clock.today()
        if today > loan.due_day:
            raise LibraryError("%s is overdue, return it first" % barcode)
        if loan.renewals >= self.max_renewals:
            raise LibraryError("%s has used its %d renewal(s)" % (barcode, self.max_renewals))
        if self.reservations.get(loan.item.book.isbn):
            raise LibraryError("someone is waiting for '%s'" % loan.item.book.title)
        loan.renewals += 1
        loan.due_day = today + self.loan_days
        return "Renewed %s for %s, now due day %d" % (barcode, loan.member.name, loan.due_day)

    @synchronized
    def reserve(self, member_id, isbn):
        m, book = self.members[member_id], self.catalog.books[isbn]
        if any(i.status == ItemStatus.AVAILABLE for i in self.catalog.copies(isbn)):
            raise LibraryError("a copy of '%s' is on the shelf, borrow it instead" % book.title)
        queue = self.reservations.setdefault(isbn, deque())
        if m in queue:
            raise LibraryError("%s already reserved '%s'" % (m.name, book.title))
        queue.append(m)
        return "%s reserved '%s', position %d in queue" % (m.name, book.title, len(queue))

    @synchronized
    def return_item(self, barcode):
        loan = self.loans.pop(barcode, None)
        if loan is None:
            raise LibraryError("%s is not on loan" % barcode)
        item, m, today = loan.item, loan.member, self.clock.today()
        m.loans.remove(barcode)
        days_late = max(0, today - loan.due_day)
        fine = self.fine_policy.fine(days_late)
        m.fine_due += fine
        msg = "%s returned %s on day %d" % (m.name, barcode, today)
        msg += ": %d days late, fine Rs%d" % (days_late, fine) if days_late else ": on time"
        queue = self.reservations.get(item.book.isbn)
        if queue:
            nxt = queue.popleft()
            item.status, item.held_for = ItemStatus.ON_HOLD, nxt
            for listener in self.listeners:
                listener.on_hold_ready(nxt, item, today + self.hold_days)
            return msg + ". On hold for " + nxt.name
        item.status = ItemStatus.AVAILABLE
        return msg

    @synchronized
    def pay_fine(self, member_id, amount):
        m = self.members[member_id]
        m.fine_due = max(0, m.fine_due - amount)
        return "%s paid Rs%d, fines due Rs%d" % (m.name, amount, m.fine_due)


def attempt(action):
    try:
        print(action())
    except LibraryError as e:
        print("Refused: " + str(e))


def main():
    clock = FakeClock(1)
    lib = Library(clock, PerDayFine(10))
    lib.subscribe(SmsNotifier())
    lib.subscribe(EmailNotifier())
    lib.catalog.add_book(Book("9780132350884", "Clean Code", "Robert C. Martin", "Software"), "CC-1", "CC-2")
    lib.catalog.add_book(Book("9781449373320", "Designing Data-Intensive Applications", "Martin Kleppmann", "Databases"), "DDIA-1")
    lib.catalog.add_book(Book("9780201616224", "The Pragmatic Programmer", "Andrew Hunt", "Software"), "PP-1")
    lib.catalog.add_book(Book("9788173711466", "Wings of Fire", "A. P. J. Abdul Kalam", "Biography"), "WOF-1")
    lib.add_member(Member("M1", "Asha", 2))
    lib.add_member(Member("M2", "Ravi", 2))
    lib.add_member(Member("M3", "Kabir", 5))

    print("== 1. Search ==")
    for field, query in [("author", "martin"), ("subject", "software"), ("title", "wings")]:
        print("%s contains '%s':" % (field, query))
        for b in lib.catalog.search(field, query):
            copies = lib.catalog.copies(b.isbn)
            free = sum(1 for i in copies if i.status == ItemStatus.AVAILABLE)
            print("  %s - %s (%s), %d of %d on shelf" % (b.title, b.author, b.subject, free, len(copies)))

    print("== 2. Issue and borrowing limit (day %d) ==" % clock.today())
    attempt(lambda: lib.issue("M1", "CC-1"))
    attempt(lambda: lib.issue("M1", "DDIA-1"))
    attempt(lambda: lib.issue("M1", "PP-1"))

    print("== 3. Reservation queue ==")
    attempt(lambda: lib.issue("M2", "DDIA-1"))
    attempt(lambda: lib.reserve("M2", "9781449373320"))
    attempt(lambda: lib.reserve("M3", "9780132350884"))

    clock.advance(9)
    print("== 4. Renewals (day %d) ==" % clock.today())
    attempt(lambda: lib.renew("M1", "CC-1"))
    attempt(lambda: lib.renew("M1", "CC-1"))
    attempt(lambda: lib.renew("M1", "DDIA-1"))

    clock.advance(15)
    print("== 5. Late return, hold and notify (day %d) ==" % clock.today())
    attempt(lambda: lib.return_item("DDIA-1"))
    attempt(lambda: lib.issue("M3", "DDIA-1"))
    attempt(lambda: lib.issue("M2", "DDIA-1"))

    print("== 6. Fines block borrowing ==")
    attempt(lambda: lib.issue("M1", "PP-1"))
    attempt(lambda: lib.pay_fine("M1", 100))
    attempt(lambda: lib.issue("M1", "PP-1"))

    print("== 7. Swap the fine policy ==")
    print("10 days late: per-day Rs%d, slab Rs%d" % (PerDayFine(10).fine(10), SlabFine(7, 5, 10).fine(10)))


if __name__ == "__main__":
    main()`,
      cpp: String.raw`// Library management: books vs copies, loans, renewals, reservations, fines.
// Build: g++ -std=c++17 -o library main.cpp && ./library
#include <algorithm>
#include <deque>
#include <functional>
#include <iostream>
#include <map>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <vector>
using namespace std;

struct LibraryError : runtime_error {
    using runtime_error::runtime_error;
};

enum class ItemStatus { AVAILABLE, LOANED, ON_HOLD };

// The title in the catalogue. One Book has many physical copies (BookItems).
struct Book {
    string isbn, title, author, subject;
};

struct Member {
    string id, name;
    int maxBooks;
    vector<string> loans; // barcodes
    int fineDue = 0;
};

// One physical copy with its own barcode and status.
struct BookItem {
    string barcode;
    const Book* book;
    ItemStatus status = ItemStatus::AVAILABLE;
    Member* heldFor = nullptr; // set when ON_HOLD
};

struct Loan {
    BookItem* item;
    Member* member;
    int issueDay, dueDay, renewals = 0;
};

// ---------- Injectable clock: days as integers keep the demo deterministic ----------
class Clock {
public:
    virtual ~Clock() = default;
    virtual int today() const = 0;
};

class FakeClock : public Clock {
    int day;
public:
    explicit FakeClock(int day) : day(day) {}
    int today() const override { return day; }
    void advance(int days) { day += days; }
};

// ---------- Strategy: fine policy ----------
class FinePolicy {
public:
    virtual ~FinePolicy() = default;
    virtual int fine(int daysLate) const = 0;
};

class PerDayFine : public FinePolicy {
    int rate;
public:
    explicit PerDayFine(int rate) : rate(rate) {}
    int fine(int daysLate) const override { return daysLate * rate; }
};

// Cheap for the first few days, steeper after that.
class SlabFine : public FinePolicy {
    int slabDays, lowRate, highRate;
public:
    SlabFine(int slabDays, int lowRate, int highRate) : slabDays(slabDays), lowRate(lowRate), highRate(highRate) {}
    int fine(int daysLate) const override {
        int low = min(daysLate, slabDays);
        return low * lowRate + (daysLate - low) * highRate;
    }
};

// ---------- Observer: who hears that a reserved book is ready ----------
class HoldListener {
public:
    virtual ~HoldListener() = default;
    virtual void onHoldReady(const Member& m, const BookItem& item, int untilDay) = 0;
};

class SmsNotifier : public HoldListener {
public:
    void onHoldReady(const Member& m, const BookItem& item, int untilDay) override {
        cout << "  [SMS to " << m.name << "] '" << item.book->title << "' is waiting for you at the desk until day "
             << untilDay << "\n";
    }
};

class EmailNotifier : public HoldListener {
public:
    void onHoldReady(const Member& m, const BookItem& item, int) override {
        cout << "  [Email to " << m.name << "] Your reservation for '" << item.book->title << "' (" << item.barcode
             << ") is ready\n";
    }
};

string lower(string s) {
    transform(s.begin(), s.end(), s.begin(), [](unsigned char c) { return (char)tolower(c); });
    return s;
}

class Catalog {
public:
    vector<unique_ptr<Book>> books;     // insertion order
    vector<unique_ptr<BookItem>> items; // insertion order
    map<string, Book*> byIsbn;
    map<string, BookItem*> byBarcode;

    void addBook(const Book& b, const vector<string>& barcodes) {
        books.push_back(make_unique<Book>(b));
        Book* book = books.back().get();
        byIsbn[book->isbn] = book;
        for (auto& code : barcodes) {
            items.push_back(make_unique<BookItem>(BookItem{code, book}));
            byBarcode[code] = items.back().get();
        }
    }
    vector<BookItem*> copies(const string& isbn) const {
        vector<BookItem*> out;
        for (auto& i : items) if (i->book->isbn == isbn) out.push_back(i.get());
        return out;
    }
    vector<Book*> search(const string& field, const string& query) const {
        vector<Book*> out;
        string q = lower(query);
        for (auto& b : books) {
            const string& value = field == "title" ? b->title : field == "author" ? b->author : b->subject;
            if (lower(value).find(q) != string::npos) out.push_back(b.get());
        }
        return out;
    }
};

class Library {
    const Clock& clock;
    const FinePolicy& finePolicy;
    int loanDays, maxRenewals, holdDays;
    map<string, Member*> members;
    map<string, Loan> loans;                    // barcode -> active loan
    map<string, deque<Member*>> reservations;   // isbn -> FIFO queue
    vector<HoldListener*> listeners;
    mutex mu;

    BookItem* item(const string& barcode) {
        auto it = catalog.byBarcode.find(barcode);
        if (it == catalog.byBarcode.end()) throw LibraryError("unknown barcode " + barcode);
        return it->second;
    }

public:
    Catalog catalog;

    Library(const Clock& clock, const FinePolicy& finePolicy, int loanDays = 14, int maxRenewals = 1, int holdDays = 3)
        : clock(clock), finePolicy(finePolicy), loanDays(loanDays), maxRenewals(maxRenewals), holdDays(holdDays) {}

    void subscribe(HoldListener* l) { listeners.push_back(l); }
    void addMember(Member* m) { members[m->id] = m; }

    string issue(const string& memberId, const string& barcode) {
        lock_guard<mutex> g(mu);
        Member* m = members.at(memberId);
        BookItem* it = item(barcode);
        if (m->fineDue > 0) throw LibraryError(m->name + " has unpaid fines of Rs" + to_string(m->fineDue));
        if ((int)m->loans.size() >= m->maxBooks)
            throw LibraryError(m->name + " already has " + to_string(m->loans.size()) + " of " + to_string(m->maxBooks) + " books");
        if (it->status == ItemStatus::LOANED) throw LibraryError(barcode + " is already on loan");
        if (it->status == ItemStatus::ON_HOLD && it->heldFor != m)
            throw LibraryError(barcode + " is on hold for " + it->heldFor->name);
        auto& queue = reservations[it->book->isbn];
        queue.erase(remove(queue.begin(), queue.end(), m), queue.end()); // they got a copy, so they leave the queue
        int today = clock.today();
        Loan loan{it, m, today, today + loanDays};
        it->status = ItemStatus::LOANED;
        it->heldFor = nullptr;
        m->loans.push_back(barcode);
        loans[barcode] = loan;
        return "Issued '" + it->book->title + "' (" + barcode + ") to " + m->name + ", due day " + to_string(loan.dueDay);
    }

    string renew(const string& memberId, const string& barcode) {
        lock_guard<mutex> g(mu);
        auto found = loans.find(barcode);
        if (found == loans.end() || found->second.member->id != memberId)
            throw LibraryError(barcode + " is not on loan to this member");
        Loan& loan = found->second;
        int today = clock.today();
        if (today > loan.dueDay) throw LibraryError(barcode + " is overdue, return it first");
        if (loan.renewals >= maxRenewals)
            throw LibraryError(barcode + " has used its " + to_string(maxRenewals) + " renewal(s)");
        if (!reservations[loan.item->book->isbn].empty())
            throw LibraryError("someone is waiting for '" + loan.item->book->title + "'");
        loan.renewals++;
        loan.dueDay = today + loanDays;
        return "Renewed " + barcode + " for " + loan.member->name + ", now due day " + to_string(loan.dueDay);
    }

    string reserve(const string& memberId, const string& isbn) {
        lock_guard<mutex> g(mu);
        Member* m = members.at(memberId);
        Book* book = catalog.byIsbn.at(isbn);
        for (BookItem* i : catalog.copies(isbn))
            if (i->status == ItemStatus::AVAILABLE)
                throw LibraryError("a copy of '" + book->title + "' is on the shelf, borrow it instead");
        auto& queue = reservations[isbn];
        if (find(queue.begin(), queue.end(), m) != queue.end())
            throw LibraryError(m->name + " already reserved '" + book->title + "'");
        queue.push_back(m);
        return m->name + " reserved '" + book->title + "', position " + to_string(queue.size()) + " in queue";
    }

    string returnItem(const string& barcode) {
        lock_guard<mutex> g(mu);
        auto found = loans.find(barcode);
        if (found == loans.end()) throw LibraryError(barcode + " is not on loan");
        Loan loan = found->second;
        loans.erase(found);
        Member* m = loan.member;
        int today = clock.today();
        m->loans.erase(find(m->loans.begin(), m->loans.end(), barcode));
        int daysLate = max(0, today - loan.dueDay);
        int fine = finePolicy.fine(daysLate);
        m->fineDue += fine;
        string msg = m->name + " returned " + barcode + " on day " + to_string(today) +
                     (daysLate > 0 ? ": " + to_string(daysLate) + " days late, fine Rs" + to_string(fine) : ": on time");
        auto& queue = reservations[loan.item->book->isbn];
        if (!queue.empty()) {
            Member* next = queue.front();
            queue.pop_front();
            loan.item->status = ItemStatus::ON_HOLD;
            loan.item->heldFor = next;
            for (HoldListener* l : listeners) l->onHoldReady(*next, *loan.item, today + holdDays);
            return msg + ". On hold for " + next->name;
        }
        loan.item->status = ItemStatus::AVAILABLE;
        return msg;
    }

    string payFine(const string& memberId, int amount) {
        lock_guard<mutex> g(mu);
        Member* m = members.at(memberId);
        m->fineDue = max(0, m->fineDue - amount);
        return m->name + " paid Rs" + to_string(amount) + ", fines due Rs" + to_string(m->fineDue);
    }
};

void attempt(const function<string()>& action) {
    try {
        cout << action() << "\n";
    } catch (const LibraryError& e) {
        cout << "Refused: " << e.what() << "\n";
    }
}

int main() {
    FakeClock clock(1);
    PerDayFine perDay(10);
    Library lib(clock, perDay);
    SmsNotifier sms;
    EmailNotifier email;
    lib.subscribe(&sms);
    lib.subscribe(&email);
    lib.catalog.addBook({"9780132350884", "Clean Code", "Robert C. Martin", "Software"}, {"CC-1", "CC-2"});
    lib.catalog.addBook({"9781449373320", "Designing Data-Intensive Applications", "Martin Kleppmann", "Databases"}, {"DDIA-1"});
    lib.catalog.addBook({"9780201616224", "The Pragmatic Programmer", "Andrew Hunt", "Software"}, {"PP-1"});
    lib.catalog.addBook({"9788173711466", "Wings of Fire", "A. P. J. Abdul Kalam", "Biography"}, {"WOF-1"});
    Member asha{"M1", "Asha", 2}, ravi{"M2", "Ravi", 2}, kabir{"M3", "Kabir", 5};
    lib.addMember(&asha);
    lib.addMember(&ravi);
    lib.addMember(&kabir);

    cout << "== 1. Search ==\n";
    vector<pair<string, string>> queries = {{"author", "martin"}, {"subject", "software"}, {"title", "wings"}};
    for (auto& [field, query] : queries) {
        cout << field << " contains '" << query << "':\n";
        for (Book* b : lib.catalog.search(field, query)) {
            auto copies = lib.catalog.copies(b->isbn);
            int free = (int)count_if(copies.begin(), copies.end(), [](BookItem* i) { return i->status == ItemStatus::AVAILABLE; });
            cout << "  " << b->title << " - " << b->author << " (" << b->subject << "), " << free << " of " << copies.size()
                 << " on shelf\n";
        }
    }

    cout << "== 2. Issue and borrowing limit (day " << clock.today() << ") ==\n";
    attempt([&] { return lib.issue("M1", "CC-1"); });
    attempt([&] { return lib.issue("M1", "DDIA-1"); });
    attempt([&] { return lib.issue("M1", "PP-1"); });

    cout << "== 3. Reservation queue ==\n";
    attempt([&] { return lib.issue("M2", "DDIA-1"); });
    attempt([&] { return lib.reserve("M2", "9781449373320"); });
    attempt([&] { return lib.reserve("M3", "9780132350884"); });

    clock.advance(9);
    cout << "== 4. Renewals (day " << clock.today() << ") ==\n";
    attempt([&] { return lib.renew("M1", "CC-1"); });
    attempt([&] { return lib.renew("M1", "CC-1"); });
    attempt([&] { return lib.renew("M1", "DDIA-1"); });

    clock.advance(15);
    cout << "== 5. Late return, hold and notify (day " << clock.today() << ") ==\n";
    attempt([&] { return lib.returnItem("DDIA-1"); });
    attempt([&] { return lib.issue("M3", "DDIA-1"); });
    attempt([&] { return lib.issue("M2", "DDIA-1"); });

    cout << "== 6. Fines block borrowing ==\n";
    attempt([&] { return lib.issue("M1", "PP-1"); });
    attempt([&] { return lib.payFine("M1", 100); });
    attempt([&] { return lib.issue("M1", "PP-1"); });

    cout << "== 7. Swap the fine policy ==\n";
    cout << "10 days late: per-day Rs" << PerDayFine(10).fine(10) << ", slab Rs" << SlabFine(7, 5, 10).fine(10) << "\n";
    return 0;
}`,
      javascript: String.raw`// Library management: books vs copies, loans, renewals, reservations, fines.
// Run: node main.js
"use strict";

class LibraryError extends Error {}

const ItemStatus = Object.freeze({ AVAILABLE: "AVAILABLE", LOANED: "LOANED", ON_HOLD: "ON_HOLD" });

// The title in the catalogue. One Book has many physical copies (BookItems).
class Book {
  constructor(isbn, title, author, subject) {
    Object.assign(this, { isbn, title, author, subject });
  }
}

// One physical copy with its own barcode and status.
class BookItem {
  constructor(barcode, book) {
    this.barcode = barcode;
    this.book = book;
    this.status = ItemStatus.AVAILABLE;
    this.heldFor = null; // Member, when ON_HOLD
  }
}

class Member {
  constructor(id, name, maxBooks) {
    Object.assign(this, { id, name, maxBooks });
    this.loans = []; // barcodes
    this.fineDue = 0;
  }
}

class Loan {
  constructor(item, member, issueDay, dueDay) {
    Object.assign(this, { item, member, issueDay, dueDay });
    this.renewals = 0;
  }
}

// ---------- Injectable clock: days as integers keep the demo deterministic ----------
class FakeClock {
  constructor(day) { this.day = day; }
  today() { return this.day; }
  advance(days) { this.day += days; }
}

// ---------- Strategy: fine policy. Interface: fine(daysLate) -> rupees ----------
class PerDayFine {
  constructor(rate) { this.rate = rate; }
  fine(daysLate) { return daysLate * this.rate; }
}

// Cheap for the first few days, steeper after that.
class SlabFine {
  constructor(slabDays, lowRate, highRate) { Object.assign(this, { slabDays, lowRate, highRate }); }
  fine(daysLate) {
    const low = Math.min(daysLate, this.slabDays);
    return low * this.lowRate + (daysLate - low) * this.highRate;
  }
}

// ---------- Observer: who hears that a reserved book is ready ----------
class SmsNotifier {
  onHoldReady(m, item, untilDay) {
    console.log("  [SMS to " + m.name + "] '" + item.book.title + "' is waiting for you at the desk until day " + untilDay);
  }
}

class EmailNotifier {
  onHoldReady(m, item) {
    console.log("  [Email to " + m.name + "] Your reservation for '" + item.book.title + "' (" + item.barcode + ") is ready");
  }
}

class Catalog {
  constructor() {
    this.books = new Map(); // isbn -> Book (insertion order)
    this.items = new Map(); // barcode -> BookItem
  }
  addBook(book, ...barcodes) {
    this.books.set(book.isbn, book);
    for (const code of barcodes) this.items.set(code, new BookItem(code, book));
  }
  copies(isbn) { return [...this.items.values()].filter((i) => i.book.isbn === isbn); }
  search(field, query) {
    const q = query.toLowerCase();
    return [...this.books.values()].filter((b) => b[field].toLowerCase().includes(q));
  }
}

class Library {
  constructor(clock, finePolicy, { loanDays = 14, maxRenewals = 1, holdDays = 3 } = {}) {
    Object.assign(this, { clock, finePolicy, loanDays, maxRenewals, holdDays });
    this.catalog = new Catalog();
    this.members = new Map();
    this.loans = new Map();        // barcode -> active Loan
    this.reservations = new Map(); // isbn -> array of Members (FIFO)
    this.listeners = [];
  }

  subscribe(listener) { this.listeners.push(listener); }
  addMember(m) { this.members.set(m.id, m); }

  item(barcode) {
    const i = this.catalog.items.get(barcode);
    if (!i) throw new LibraryError("unknown barcode " + barcode);
    return i;
  }

  issue(memberId, barcode) {
    const m = this.members.get(memberId), item = this.item(barcode);
    if (m.fineDue > 0) throw new LibraryError(m.name + " has unpaid fines of Rs" + m.fineDue);
    if (m.loans.length >= m.maxBooks) {
      throw new LibraryError(m.name + " already has " + m.loans.length + " of " + m.maxBooks + " books");
    }
    if (item.status === ItemStatus.LOANED) throw new LibraryError(barcode + " is already on loan");
    if (item.status === ItemStatus.ON_HOLD && item.heldFor !== m) {
      throw new LibraryError(barcode + " is on hold for " + item.heldFor.name);
    }
    const queue = this.reservations.get(item.book.isbn);
    if (queue && queue.includes(m)) queue.splice(queue.indexOf(m), 1); // they got a copy, so they leave the queue
    const today = this.clock.today();
    const loan = new Loan(item, m, today, today + this.loanDays);
    item.status = ItemStatus.LOANED;
    item.heldFor = null;
    m.loans.push(barcode);
    this.loans.set(barcode, loan);
    return "Issued '" + item.book.title + "' (" + barcode + ") to " + m.name + ", due day " + loan.dueDay;
  }

  renew(memberId, barcode) {
    const loan = this.loans.get(barcode);
    if (!loan || loan.member.id !== memberId) throw new LibraryError(barcode + " is not on loan to this member");
    const today = this.clock.today();
    if (today > loan.dueDay) throw new LibraryError(barcode + " is overdue, return it first");
    if (loan.renewals >= this.maxRenewals) {
      throw new LibraryError(barcode + " has used its " + this.maxRenewals + " renewal(s)");
    }
    const queue = this.reservations.get(loan.item.book.isbn);
    if (queue && queue.length) throw new LibraryError("someone is waiting for '" + loan.item.book.title + "'");
    loan.renewals++;
    loan.dueDay = today + this.loanDays;
    return "Renewed " + barcode + " for " + loan.member.name + ", now due day " + loan.dueDay;
  }

  reserve(memberId, isbn) {
    const m = this.members.get(memberId), book = this.catalog.books.get(isbn);
    if (this.catalog.copies(isbn).some((i) => i.status === ItemStatus.AVAILABLE)) {
      throw new LibraryError("a copy of '" + book.title + "' is on the shelf, borrow it instead");
    }
    if (!this.reservations.has(isbn)) this.reservations.set(isbn, []);
    const queue = this.reservations.get(isbn);
    if (queue.includes(m)) throw new LibraryError(m.name + " already reserved '" + book.title + "'");
    queue.push(m);
    return m.name + " reserved '" + book.title + "', position " + queue.length + " in queue";
  }

  returnItem(barcode) {
    const loan = this.loans.get(barcode);
    if (!loan) throw new LibraryError(barcode + " is not on loan");
    this.loans.delete(barcode);
    const { item, member: m } = loan, today = this.clock.today();
    m.loans.splice(m.loans.indexOf(barcode), 1);
    const daysLate = Math.max(0, today - loan.dueDay);
    const fine = this.finePolicy.fine(daysLate);
    m.fineDue += fine;
    const msg = m.name + " returned " + barcode + " on day " + today +
      (daysLate > 0 ? ": " + daysLate + " days late, fine Rs" + fine : ": on time");
    const queue = this.reservations.get(item.book.isbn);
    if (queue && queue.length) {
      const next = queue.shift();
      item.status = ItemStatus.ON_HOLD;
      item.heldFor = next;
      for (const l of this.listeners) l.onHoldReady(next, item, today + this.holdDays);
      return msg + ". On hold for " + next.name;
    }
    item.status = ItemStatus.AVAILABLE;
    return msg;
  }

  payFine(memberId, amount) {
    const m = this.members.get(memberId);
    m.fineDue = Math.max(0, m.fineDue - amount);
    return m.name + " paid Rs" + amount + ", fines due Rs" + m.fineDue;
  }
}

function attempt(action) {
  try {
    console.log(action());
  } catch (e) {
    if (!(e instanceof LibraryError)) throw e;
    console.log("Refused: " + e.message);
  }
}

function main() {
  const clock = new FakeClock(1);
  const lib = new Library(clock, new PerDayFine(10));
  lib.subscribe(new SmsNotifier());
  lib.subscribe(new EmailNotifier());
  lib.catalog.addBook(new Book("9780132350884", "Clean Code", "Robert C. Martin", "Software"), "CC-1", "CC-2");
  lib.catalog.addBook(new Book("9781449373320", "Designing Data-Intensive Applications", "Martin Kleppmann", "Databases"), "DDIA-1");
  lib.catalog.addBook(new Book("9780201616224", "The Pragmatic Programmer", "Andrew Hunt", "Software"), "PP-1");
  lib.catalog.addBook(new Book("9788173711466", "Wings of Fire", "A. P. J. Abdul Kalam", "Biography"), "WOF-1");
  lib.addMember(new Member("M1", "Asha", 2));
  lib.addMember(new Member("M2", "Ravi", 2));
  lib.addMember(new Member("M3", "Kabir", 5));

  console.log("== 1. Search ==");
  for (const [field, query] of [["author", "martin"], ["subject", "software"], ["title", "wings"]]) {
    console.log(field + " contains '" + query + "':");
    for (const b of lib.catalog.search(field, query)) {
      const copies = lib.catalog.copies(b.isbn);
      const free = copies.filter((i) => i.status === ItemStatus.AVAILABLE).length;
      console.log("  " + b.title + " - " + b.author + " (" + b.subject + "), " + free + " of " + copies.length + " on shelf");
    }
  }

  console.log("== 2. Issue and borrowing limit (day " + clock.today() + ") ==");
  attempt(() => lib.issue("M1", "CC-1"));
  attempt(() => lib.issue("M1", "DDIA-1"));
  attempt(() => lib.issue("M1", "PP-1"));

  console.log("== 3. Reservation queue ==");
  attempt(() => lib.issue("M2", "DDIA-1"));
  attempt(() => lib.reserve("M2", "9781449373320"));
  attempt(() => lib.reserve("M3", "9780132350884"));

  clock.advance(9);
  console.log("== 4. Renewals (day " + clock.today() + ") ==");
  attempt(() => lib.renew("M1", "CC-1"));
  attempt(() => lib.renew("M1", "CC-1"));
  attempt(() => lib.renew("M1", "DDIA-1"));

  clock.advance(15);
  console.log("== 5. Late return, hold and notify (day " + clock.today() + ") ==");
  attempt(() => lib.returnItem("DDIA-1"));
  attempt(() => lib.issue("M3", "DDIA-1"));
  attempt(() => lib.issue("M2", "DDIA-1"));

  console.log("== 6. Fines block borrowing ==");
  attempt(() => lib.issue("M1", "PP-1"));
  attempt(() => lib.payFine("M1", 100));
  attempt(() => lib.issue("M1", "PP-1"));

  console.log("== 7. Swap the fine policy ==");
  console.log("10 days late: per-day Rs" + new PerDayFine(10).fine(10) + ", slab Rs" + new SlabFine(7, 5, 10).fine(10));
}

main();`,
      go: String.raw`// Library management: books vs copies, loans, renewals, reservations, fines.
// Run: go run main.go
package main

import (
	"errors"
	"fmt"
	"strings"
	"sync"
)

type ItemStatus int

const (
	Available ItemStatus = iota
	Loaned
	OnHold
)

// Book is the title in the catalogue. One Book has many physical copies (BookItems).
type Book struct{ ISBN, Title, Author, Subject string }

// BookItem is one physical copy with its own barcode and status.
type BookItem struct {
	Barcode string
	Book    *Book
	Status  ItemStatus
	HeldFor *Member // set when OnHold
}

type Member struct {
	ID, Name string
	MaxBooks int
	Loans    []string // barcodes
	FineDue  int
}

type Loan struct {
	Item                       *BookItem
	Member                     *Member
	IssueDay, DueDay, Renewals int
}

// ---------- Injectable clock: days as integers keep the demo deterministic ----------
type Clock interface{ Today() int }

type FakeClock struct{ day int }

func (c *FakeClock) Today() int       { return c.day }
func (c *FakeClock) Advance(days int) { c.day += days }

// ---------- Strategy: fine policy ----------
type FinePolicy interface{ Fine(daysLate int) int }

type PerDayFine struct{ Rate int }

func (p PerDayFine) Fine(daysLate int) int { return daysLate * p.Rate }

// SlabFine is cheap for the first few days, steeper after that.
type SlabFine struct{ SlabDays, LowRate, HighRate int }

func (p SlabFine) Fine(daysLate int) int {
	low := min(daysLate, p.SlabDays)
	return low*p.LowRate + (daysLate-low)*p.HighRate
}

// ---------- Observer: who hears that a reserved book is ready ----------
type HoldListener interface {
	OnHoldReady(m *Member, item *BookItem, untilDay int)
}

type SmsNotifier struct{}

func (SmsNotifier) OnHoldReady(m *Member, item *BookItem, untilDay int) {
	fmt.Printf("  [SMS to %s] '%s' is waiting for you at the desk until day %d\n", m.Name, item.Book.Title, untilDay)
}

type EmailNotifier struct{}

func (EmailNotifier) OnHoldReady(m *Member, item *BookItem, _ int) {
	fmt.Printf("  [Email to %s] Your reservation for '%s' (%s) is ready\n", m.Name, item.Book.Title, item.Barcode)
}

type Catalog struct {
	books     []*Book     // insertion order
	items     []*BookItem // insertion order
	byISBN    map[string]*Book
	byBarcode map[string]*BookItem
}

func NewCatalog() *Catalog {
	return &Catalog{byISBN: map[string]*Book{}, byBarcode: map[string]*BookItem{}}
}

func (c *Catalog) AddBook(b Book, barcodes ...string) {
	book := &b
	c.books = append(c.books, book)
	c.byISBN[book.ISBN] = book
	for _, code := range barcodes {
		item := &BookItem{Barcode: code, Book: book, Status: Available}
		c.items = append(c.items, item)
		c.byBarcode[code] = item
	}
}

func (c *Catalog) Copies(isbn string) []*BookItem {
	var out []*BookItem
	for _, i := range c.items {
		if i.Book.ISBN == isbn {
			out = append(out, i)
		}
	}
	return out
}

func (c *Catalog) Search(field, query string) []*Book {
	q := strings.ToLower(query)
	var out []*Book
	for _, b := range c.books {
		value := map[string]string{"title": b.Title, "author": b.Author, "subject": b.Subject}[field]
		if strings.Contains(strings.ToLower(value), q) {
			out = append(out, b)
		}
	}
	return out
}

type Library struct {
	mu                              sync.Mutex
	clock                           Clock
	finePolicy                      FinePolicy
	loanDays, maxRenewals, holdDays int
	Catalog                         *Catalog
	members                         map[string]*Member
	loans                           map[string]*Loan     // barcode -> active loan
	reservations                    map[string][]*Member // isbn -> FIFO queue
	listeners                       []HoldListener
}

func NewLibrary(clock Clock, fp FinePolicy) *Library {
	return &Library{clock: clock, finePolicy: fp, loanDays: 14, maxRenewals: 1, holdDays: 3, Catalog: NewCatalog(),
		members: map[string]*Member{}, loans: map[string]*Loan{}, reservations: map[string][]*Member{}}
}

func (l *Library) Subscribe(h HoldListener) { l.listeners = append(l.listeners, h) }
func (l *Library) AddMember(m *Member)      { l.members[m.ID] = m }

func without(list []*Member, m *Member) []*Member {
	out := list[:0]
	for _, x := range list {
		if x != m {
			out = append(out, x)
		}
	}
	return out
}

func (l *Library) Issue(memberID, barcode string) (string, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	m := l.members[memberID]
	item, ok := l.Catalog.byBarcode[barcode]
	switch {
	case !ok:
		return "", errors.New("unknown barcode " + barcode)
	case m.FineDue > 0:
		return "", fmt.Errorf("%s has unpaid fines of Rs%d", m.Name, m.FineDue)
	case len(m.Loans) >= m.MaxBooks:
		return "", fmt.Errorf("%s already has %d of %d books", m.Name, len(m.Loans), m.MaxBooks)
	case item.Status == Loaned:
		return "", fmt.Errorf("%s is already on loan", barcode)
	case item.Status == OnHold && item.HeldFor != m:
		return "", fmt.Errorf("%s is on hold for %s", barcode, item.HeldFor.Name)
	}
	isbn := item.Book.ISBN
	l.reservations[isbn] = without(l.reservations[isbn], m) // they got a copy, so they leave the queue
	today := l.clock.Today()
	loan := &Loan{Item: item, Member: m, IssueDay: today, DueDay: today + l.loanDays}
	item.Status, item.HeldFor = Loaned, nil
	m.Loans = append(m.Loans, barcode)
	l.loans[barcode] = loan
	return fmt.Sprintf("Issued '%s' (%s) to %s, due day %d", item.Book.Title, barcode, m.Name, loan.DueDay), nil
}

func (l *Library) Renew(memberID, barcode string) (string, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	loan, ok := l.loans[barcode]
	if !ok || loan.Member.ID != memberID {
		return "", fmt.Errorf("%s is not on loan to this member", barcode)
	}
	today := l.clock.Today()
	switch {
	case today > loan.DueDay:
		return "", fmt.Errorf("%s is overdue, return it first", barcode)
	case loan.Renewals >= l.maxRenewals:
		return "", fmt.Errorf("%s has used its %d renewal(s)", barcode, l.maxRenewals)
	case len(l.reservations[loan.Item.Book.ISBN]) > 0:
		return "", fmt.Errorf("someone is waiting for '%s'", loan.Item.Book.Title)
	}
	loan.Renewals++
	loan.DueDay = today + l.loanDays
	return fmt.Sprintf("Renewed %s for %s, now due day %d", barcode, loan.Member.Name, loan.DueDay), nil
}

func (l *Library) Reserve(memberID, isbn string) (string, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	m, book := l.members[memberID], l.Catalog.byISBN[isbn]
	for _, i := range l.Catalog.Copies(isbn) {
		if i.Status == Available {
			return "", fmt.Errorf("a copy of '%s' is on the shelf, borrow it instead", book.Title)
		}
	}
	for _, x := range l.reservations[isbn] {
		if x == m {
			return "", fmt.Errorf("%s already reserved '%s'", m.Name, book.Title)
		}
	}
	l.reservations[isbn] = append(l.reservations[isbn], m)
	return fmt.Sprintf("%s reserved '%s', position %d in queue", m.Name, book.Title, len(l.reservations[isbn])), nil
}

func (l *Library) Return(barcode string) (string, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	loan, ok := l.loans[barcode]
	if !ok {
		return "", fmt.Errorf("%s is not on loan", barcode)
	}
	delete(l.loans, barcode)
	item, m, today := loan.Item, loan.Member, l.clock.Today()
	for i, b := range m.Loans {
		if b == barcode {
			m.Loans = append(m.Loans[:i], m.Loans[i+1:]...)
			break
		}
	}
	daysLate := max(0, today-loan.DueDay)
	fine := l.finePolicy.Fine(daysLate)
	m.FineDue += fine
	msg := fmt.Sprintf("%s returned %s on day %d", m.Name, barcode, today)
	if daysLate > 0 {
		msg += fmt.Sprintf(": %d days late, fine Rs%d", daysLate, fine)
	} else {
		msg += ": on time"
	}
	if queue := l.reservations[item.Book.ISBN]; len(queue) > 0 {
		next := queue[0]
		l.reservations[item.Book.ISBN] = queue[1:]
		item.Status, item.HeldFor = OnHold, next
		for _, h := range l.listeners {
			h.OnHoldReady(next, item, today+l.holdDays)
		}
		return msg + ". On hold for " + next.Name, nil
	}
	item.Status = Available
	return msg, nil
}

func (l *Library) PayFine(memberID string, amount int) (string, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	m := l.members[memberID]
	m.FineDue = max(0, m.FineDue-amount)
	return fmt.Sprintf("%s paid Rs%d, fines due Rs%d", m.Name, amount, m.FineDue), nil
}

func attempt(msg string, err error) {
	if err != nil {
		fmt.Println("Refused: " + err.Error())
		return
	}
	fmt.Println(msg)
}

func main() {
	clock := &FakeClock{day: 1}
	lib := NewLibrary(clock, PerDayFine{Rate: 10})
	lib.Subscribe(SmsNotifier{})
	lib.Subscribe(EmailNotifier{})
	lib.Catalog.AddBook(Book{"9780132350884", "Clean Code", "Robert C. Martin", "Software"}, "CC-1", "CC-2")
	lib.Catalog.AddBook(Book{"9781449373320", "Designing Data-Intensive Applications", "Martin Kleppmann", "Databases"}, "DDIA-1")
	lib.Catalog.AddBook(Book{"9780201616224", "The Pragmatic Programmer", "Andrew Hunt", "Software"}, "PP-1")
	lib.Catalog.AddBook(Book{"9788173711466", "Wings of Fire", "A. P. J. Abdul Kalam", "Biography"}, "WOF-1")
	lib.AddMember(&Member{ID: "M1", Name: "Asha", MaxBooks: 2})
	lib.AddMember(&Member{ID: "M2", Name: "Ravi", MaxBooks: 2})
	lib.AddMember(&Member{ID: "M3", Name: "Kabir", MaxBooks: 5})

	fmt.Println("== 1. Search ==")
	for _, q := range [][2]string{{"author", "martin"}, {"subject", "software"}, {"title", "wings"}} {
		fmt.Printf("%s contains '%s':\n", q[0], q[1])
		for _, b := range lib.Catalog.Search(q[0], q[1]) {
			copies := lib.Catalog.Copies(b.ISBN)
			free := 0
			for _, i := range copies {
				if i.Status == Available {
					free++
				}
			}
			fmt.Printf("  %s - %s (%s), %d of %d on shelf\n", b.Title, b.Author, b.Subject, free, len(copies))
		}
	}

	fmt.Printf("== 2. Issue and borrowing limit (day %d) ==\n", clock.Today())
	attempt(lib.Issue("M1", "CC-1"))
	attempt(lib.Issue("M1", "DDIA-1"))
	attempt(lib.Issue("M1", "PP-1"))

	fmt.Println("== 3. Reservation queue ==")
	attempt(lib.Issue("M2", "DDIA-1"))
	attempt(lib.Reserve("M2", "9781449373320"))
	attempt(lib.Reserve("M3", "9780132350884"))

	clock.Advance(9)
	fmt.Printf("== 4. Renewals (day %d) ==\n", clock.Today())
	attempt(lib.Renew("M1", "CC-1"))
	attempt(lib.Renew("M1", "CC-1"))
	attempt(lib.Renew("M1", "DDIA-1"))

	clock.Advance(15)
	fmt.Printf("== 5. Late return, hold and notify (day %d) ==\n", clock.Today())
	attempt(lib.Return("DDIA-1"))
	attempt(lib.Issue("M3", "DDIA-1"))
	attempt(lib.Issue("M2", "DDIA-1"))

	fmt.Println("== 6. Fines block borrowing ==")
	attempt(lib.Issue("M1", "PP-1"))
	attempt(lib.PayFine("M1", 100))
	attempt(lib.Issue("M1", "PP-1"))

	fmt.Println("== 7. Swap the fine policy ==")
	fmt.Printf("10 days late: per-day Rs%d, slab Rs%d\n", PerDayFine{10}.Fine(10), SlabFine{7, 5, 10}.Fine(10))
}`,
    },
  },
  diagrams: {
    classes: String.raw`classDiagram
  class Library {
    -Clock clock
    -FinePolicy finePolicy
    -Map~String,Loan~ loans
    -Map~String,Queue~ reservations
    -List~HoldListener~ listeners
    +issue(memberId, barcode) String
    +returnItem(barcode) String
    +renew(memberId, barcode) String
    +reserve(memberId, isbn) String
    +payFine(memberId, amount) String
  }
  class Catalog {
    -Map~String,Book~ books
    -Map~String,BookItem~ items
    +addBook(book, barcodes)
    +search(field, query) List~Book~
    +copies(isbn) List~BookItem~
  }
  class Book {
    +String isbn
    +String title
    +String author
    +String subject
  }
  class BookItem {
    +String barcode
    +ItemStatus status
    +Member heldFor
  }
  class Member {
    +String id
    +String name
    +int maxBooks
    +int fineDue
  }
  class Loan {
    +int issueDay
    +int dueDay
    +int renewals
  }
  class Clock {
    <<interface>>
    +today() int
  }
  class FinePolicy {
    <<interface>>
    +fine(daysLate) int
  }
  class HoldListener {
    <<interface>>
    +onHoldReady(member, item, untilDay)
  }
  Library *-- Catalog
  Library o-- Clock
  Library o-- FinePolicy
  Library o-- HoldListener
  Library *-- Loan
  Catalog *-- Book
  Catalog *-- BookItem
  BookItem --> Book
  Loan --> BookItem
  Loan --> Member
  FinePolicy <|.. PerDayFine
  FinePolicy <|.. SlabFine
  HoldListener <|.. SmsNotifier
  HoldListener <|.. EmailNotifier
  Clock <|.. FakeClock`,
    itemStates: String.raw`stateDiagram-v2
  [*] --> Available: copy added
  Available --> Loaned: issue
  Loaned --> Available: return, queue empty
  Loaned --> OnHold: return, someone reserved
  OnHold --> Loaned: issue to that member
  OnHold --> OnHold: hold expired, next in queue
  OnHold --> Available: hold expired, queue empty`,
    flow: String.raw`sequenceDiagram
  actor Lib as Librarian
  participant L as Library
  participant C as Catalog
  participant F as FinePolicy
  participant N as HoldListeners
  Lib->>L: issue(M1, DDIA-1)
  L->>C: find copy DDIA-1
  L->>L: check fines, limit, status
  L-->>Lib: issued, due day 15
  Note over Lib,N: 24 days later
  Lib->>L: returnItem(DDIA-1)
  L->>L: daysLate = 25 - 15 = 10
  L->>F: fine(10)
  F-->>L: Rs100
  alt reservation queue not empty
    L->>L: copy ON_HOLD for Ravi
    L->>N: onHoldReady(Ravi, DDIA-1)
    N-->>N: SMS and email
  else queue empty
    L->>L: copy AVAILABLE
  end
  L-->>Lib: receipt with fine`,
  },
});
