SD.register({
  id: "requirements",
  html: String.raw`
<p class="lead">Every design starts with two lists. <strong>Functional requirements</strong> say <em>what</em> the system does: "a customer can place an order". <strong>Non-functional requirements</strong> (NFRs) say <em>how well</em> it must do it: "order placement succeeds 99.99% of the time and responds in under 300 ms". Functional requirements decide which components you need; non-functional requirements decide how those components are built, replicated and scaled.</p>

<h2>What it is</h2>
<p>Think of a building. The functional requirements are the rooms: kitchen, two bedrooms, a balcony. The non-functional requirements are the engineering: it must survive an earthquake, hold 200 people, and the lift must arrive within 30 seconds. Two buildings with identical rooms can look completely different underneath because their NFRs differ.</p>
<div data-diagram="split" data-caption="Functional requirements pick the components. Non-functional requirements shape how each one is built."></div>

<div class="grid-2">
<div class="card">
<h3>Functional</h3>
<ul>
  <li>Describe user-visible behaviour (features, use cases).</li>
  <li>Usually phrased as "a user can..." or "the system shall...".</li>
  <li>Map directly to APIs and data entities.</li>
  <li>Example: "A rider can see the order pickup location."</li>
</ul>
</div>
<div class="card">
<h3>Non-functional</h3>
<ul>
  <li>Describe qualities and constraints (scale, speed, safety).</li>
  <li>Usually have a number: QPS, p99, nines, RPO.</li>
  <li>Map to architecture: replication, caching, sharding, queues.</li>
  <li>Example: "Rider location is at most 5 seconds stale."</li>
</ul>
</div>
</div>

<h2>The non-functional requirements that matter</h2>
<p>You do not need all of these for every problem. Pick the 3–4 that actually shape <em>this</em> design and attach a number to each.</p>
<table>
  <thead><tr><th>NFR</th><th>Question it answers</th><th>Typical target</th><th>Design levers</th></tr></thead>
  <tbody>
    <tr><td><strong>Scalability</strong></td><td>Can it grow with users and data?</td><td>"10 M DAU, 3× growth in 2 years"</td><td>Stateless servers, horizontal scaling, sharding, queues</td></tr>
    <tr><td><strong>Availability</strong></td><td>What fraction of time does it work?</td><td>99.9% (8.8 h down/year) to 99.99% (53 min/year)</td><td>Redundancy, replicas, multi-zone deploys, failover</td></tr>
    <tr><td><strong>Latency</strong></td><td>How fast does one request finish?</td><td>p99 &lt; 200 ms for APIs; &lt; 100 ms for search typeahead</td><td>Caching, CDN, indexes, async work, data locality</td></tr>
    <tr><td><strong>Consistency</strong></td><td>Do all users see the same, latest data?</td><td>Strong for payments/inventory; eventual for feeds/likes</td><td>Single leader, quorums, transactions vs async replication</td></tr>
    <tr><td><strong>Durability</strong></td><td>Once saved, is data ever lost?</td><td>"Zero loss of committed orders"; S3 claims 11 nines</td><td>Replication, write-ahead logs, backups, multi-region copies</td></tr>
    <tr><td><strong>Security &amp; privacy</strong></td><td>Who can see and change what?</td><td>Auth on every API, PCI-DSS for cards, data residency in India</td><td>AuthN/AuthZ, encryption at rest and in transit, rate limits, audit logs</td></tr>
    <tr><td><strong>Cost</strong></td><td>Can the business afford it?</td><td>"Under X per 1,000 orders"</td><td>Right-sizing, tiered storage, caching to cut DB load, spot instances</td></tr>
  </tbody>
</table>
<p>Other NFRs that occasionally matter: <strong>observability</strong> (can we debug it?), <strong>maintainability</strong>, <strong>compliance</strong> (RBI rules on storing payment data in India), and <strong>freshness</strong> (how stale may a search index be?).</p>

<div class="callout warn">
<strong>NFRs conflict</strong>
You cannot max out everything. Strong consistency across regions adds latency. Very high availability costs money (more replicas, more regions). The CAP theorem says that during a network partition you must choose between consistency and availability. Your job is to pick the right trade-off per feature, not one global setting.
</div>

<h2>How to ask clarifying questions</h2>
<p>The prompt is vague on purpose. The interviewer wants to see whether you can find the real problem. A good rhythm is four buckets, in this order:</p>
<ol class="steps">
  <li><strong>Users and use cases.</strong> Who uses it (customers, restaurants, riders, admins)? What are the top 3 actions?</li>
  <li><strong>Scale.</strong> How many daily active users? How many requests or items per day? Read-heavy or write-heavy? Peak patterns (lunch, dinner, Big Billion Days)?</li>
  <li><strong>Quality.</strong> Latency targets, availability, can data be stale, can data be lost?</li>
  <li><strong>Scope and constraints.</strong> What is out of scope? Mobile or web? Single country or global? Any existing systems to reuse?</li>
</ol>
<p>Then <strong>summarise back</strong> what you heard and confirm it. If the interviewer says "you decide", make a reasonable assumption, state it out loud, and write it down.</p>

<div class="callout tip">
<strong>Keep it to about 5 minutes</strong>
Ask 6–10 focused questions, not 30. Prioritise questions whose answers would change the design. "What colour is the button?" changes nothing; "Do we need real-time rider tracking?" changes everything.
</div>

<h2>Worked example: design a food-delivery app (Swiggy / Zomato)</h2>
<p>Prompt: <em>"Design a food delivery platform."</em> Here is how a strong candidate scopes it.</p>

<h3>Questions and assumptions</h3>
<p>Candidate asks about users (customers, restaurants, delivery partners), scale (assume 5 M orders/day in India, 20 M DAU browsing), peak (dinner 8–10 pm carries ~40% of orders), and what is in scope (no grocery, no restaurant onboarding flows, payments via an external gateway).</p>

<div class="grid-2">
<div class="card">
<h3>Functional (in scope)</h3>
<ol>
  <li>Customer browses nearby restaurants and menus.</li>
  <li>Customer places an order and pays.</li>
  <li>Restaurant accepts/rejects the order and marks it ready.</li>
  <li>System assigns a delivery partner.</li>
  <li>Customer tracks order status and rider location live.</li>
</ol>
<p><strong>Out of scope:</strong> reviews, offers engine, restaurant onboarding, customer support chat.</p>
</div>
<div class="card">
<h3>Non-functional</h3>
<ul>
  <li><strong>Availability</strong>: order placement 99.99%; browsing 99.9% is fine.</li>
  <li><strong>Latency</strong>: restaurant list p99 &lt; 300 ms; tracking updates every 3–5 s.</li>
  <li><strong>Consistency</strong>: orders and payments strongly consistent (no double charge, no lost order); menus and ratings can be eventually consistent.</li>
  <li><strong>Scale</strong>: ~60 orders/s average, ~300/s at peak; 1 M+ riders sending GPS pings.</li>
  <li><strong>Durability</strong>: a confirmed order is never lost.</li>
</ul>
</div>
</div>

<p>Notice how each NFR already points to a design choice. Strong consistency for orders → a relational DB (PostgreSQL/MySQL) with transactions. Eventual consistency for menus → aggressive caching. 1 M riders pinging every 4 s = 250k writes/s of location → an in-memory geo store (Redis GEO) rather than the orders DB. Live tracking → WebSockets or server-sent events.</p>

<div data-diagram="food" data-caption="How the Swiggy-style requirements map to components. Different NFRs lead to different stores."></div>

<h2>Question → why it matters</h2>
<table>
  <thead><tr><th>Question to ask</th><th>Why it matters for the design</th></tr></thead>
  <tbody>
    <tr><td>How many daily active users? How many writes per day?</td><td>Decides QPS, number of servers, and whether you need sharding.</td></tr>
    <tr><td>What is the read:write ratio?</td><td>Read-heavy (feeds, catalogues) → caches and read replicas. Write-heavy (logs, GPS pings) → append-friendly stores, queues, batching.</td></tr>
    <tr><td>Is there a traffic peak?</td><td>Flipkart Big Billion Days or IPL streaming on Hotstar can be 10–20× normal. Design for peak, not average.</td></tr>
    <tr><td>Can users see slightly stale data?</td><td>Yes → eventual consistency, caching, async replication. No → strong consistency, leader reads, transactions.</td></tr>
    <tr><td>Can we ever lose data?</td><td>Payments and orders: no → synchronous replication, WAL, backups. Analytics clicks: small loss is okay → cheaper pipelines.</td></tr>
    <tr><td>What latency do users expect?</td><td>Under 100 ms needs caches and data near the user (CDN, regional deployment). Seconds are fine for reports, so do them async.</td></tr>
    <tr><td>Is it global or one country?</td><td>Global → multi-region, geo-DNS, cross-region replication, data residency rules.</td></tr>
    <tr><td>How large are the objects?</td><td>Small rows → DB. Images/videos → object storage (S3) + CDN, with only metadata in the DB.</td></tr>
    <tr><td>Do we need real-time updates?</td><td>Yes → WebSockets/SSE, pub/sub, connection servers. No → simple polling.</td></tr>
    <tr><td>Who are the clients (mobile, web, third-party)?</td><td>Affects API style, versioning, auth, and payload size on slow mobile networks.</td></tr>
  </tbody>
</table>

<h2>Real-world examples</h2>
<ul>
  <li><strong>Razorpay</strong>: correctness beats latency. A payment that is a bit slower is fine; a payment charged twice is not. Idempotency and strong consistency are top NFRs.</li>
  <li><strong>Netflix</strong>: availability beats consistency for most features. If the "continue watching" row is a few seconds stale, nobody minds; if the play button fails, everyone does.</li>
  <li><strong>WhatsApp</strong>: latency and durability of messages (delivered once, in order per chat) with huge scale: over 100 billion messages a day.</li>
  <li><strong>IRCTC Tatkal</strong>: extreme peak (bookings open at 10 am) and strong consistency on seat inventory. The NFRs force queuing and careful locking.</li>
</ul>

<h2>Common interview pitfalls</h2>
<div class="callout interview">
<strong>Say this in the interview</strong>
"Let me split this into functional and non-functional requirements. Functionally, the core flows are placing an order, assigning a rider and tracking. For non-functional, orders must be strongly consistent and highly available, while restaurant listings can be eventually consistent and cached. I'll design for about 300 orders per second at dinner peak. Does that match what you had in mind?"
</div>
<ul>
  <li>Listing NFRs without numbers ("it should be scalable and fast"). Always quantify.</li>
  <li>Applying one consistency level to the whole system. Different features need different guarantees.</li>
  <li>Forgetting the peak. Average QPS hides the 8 pm dinner rush.</li>
  <li>Scoping too wide. Ten features in 45 minutes means none done well. Agree on 3–5.</li>
  <li>Never mentioning security on systems that handle money or personal data.</li>
</ul>

<h2>Test yourself</h2>
<div class="quiz">
<details><summary>Is "users can upload a profile photo up to 5 MB" functional or non-functional?</summary><div>Mostly functional (a user can upload a photo), with a constraint attached (5 MB limit). The size limit influences design (object storage, upload via pre-signed URLs), but the requirement itself describes a feature.</div></details>
<details><summary>Why might a food-delivery app use different consistency levels for orders and menus?</summary><div>Orders involve money and must not be lost or duplicated, so they need strong consistency and transactions. Menus change rarely and a few seconds of staleness is harmless, so they can be cached and replicated asynchronously for speed and lower DB load.</div></details>
<details><summary>The interviewer says "assume whatever scale you want". What do you do?</summary><div>Pick a realistic number, state it, and write it down: "I'll assume 10 M DAU and 50 M requests a day, read-heavy at 10:1." A concrete assumption lets you do estimation and justify choices. Avoid absurdly small (nothing to design) or absurdly large numbers.</div></details>
<details><summary>Name three NFRs that usually conflict and how.</summary><div>Consistency vs latency/availability: synchronous replication across regions is consistent but slower and less available during partitions. Availability vs cost: more replicas and regions cost more. Latency vs durability: acknowledging a write before it is replicated is faster but risks loss.</div></details>
<details><summary>Which question best reveals whether you need a cache?</summary><div>"What is the read:write ratio and how stale can reads be?" A high read ratio with tolerance for staleness strongly suggests caching.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
  <li>Functional = what the system does; non-functional = how well, with numbers.</li>
  <li>The core NFRs: scalability, availability, latency, consistency, durability, security, cost.</li>
  <li>Ask questions in four buckets: users &amp; use cases, scale, quality, scope. Spend about 5 minutes.</li>
  <li>Only ask questions whose answers would change your design; state assumptions when unsure.</li>
  <li>Different features can (and often should) have different NFRs, e.g. strong consistency for orders, eventual for menus.</li>
  <li>Write the requirements on the board and refer back to them when justifying choices.</li>
</ul></div>
`,
  diagrams: {
    split: String.raw`flowchart LR
      P["Vague prompt"] --> F["Functional: features"]
      P --> N["Non-functional: qualities"]
      F --> C["Which components? APIs, entities"]
      N --> H["How built? replicas, cache, shards"]
      C --> D["Design"]
      H --> D`,
    food: String.raw`flowchart LR
      U["Customer app"] --> G["API gateway"]
      G --> R["Restaurant service"]
      G --> O["Order service"]
      G --> T["Tracking service"]
      R --> RC["Cache (Redis)"]
      RC --> RD[("Menu DB")]
      O --> OD[("Orders DB - SQL")]
      O --> PG["Payment gateway"]
      O --> Q["Queue"] --> A["Rider assignment"]
      Rider["Rider app"] --> T
      T --> GEO["Redis GEO"]
      T -. "WebSocket" .-> U`,
  },
});
