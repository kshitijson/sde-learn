SD.register({
  id: "availability",
  html: String.raw`
<p class="lead"><strong>Availability</strong> is the percentage of time a system is up and answering requests correctly. It is usually quoted in "nines": 99.9% ("three nines") allows about 8.8 hours of downtime a year; 99.99% allows about 53 minutes. Every extra nine costs real money and engineering effort, so the skill is choosing the right target per feature and using redundancy and failover to hit it.</p>

<h2>Availability vs reliability vs durability</h2>
<p>These three words are often mixed up. They answer different questions.</p>
<table>
  <thead><tr><th>Term</th><th>Question</th><th>Measured as</th><th>Example</th></tr></thead>
  <tbody>
    <tr><td><strong>Availability</strong></td><td>Is the system up right now?</td><td>Uptime ÷ total time, or successful requests ÷ total requests</td><td>The PhonePe app accepts UPI payments 99.95% of the time</td></tr>
    <tr><td><strong>Reliability</strong></td><td>Does it work correctly, without failing, over a period?</td><td>MTBF (mean time between failures), error rate</td><td>A payment that succeeds is recorded correctly, every time</td></tr>
    <tr><td><strong>Durability</strong></td><td>Once data is stored, will it still be there later?</td><td>Probability of not losing an object per year</td><td>Amazon S3 is designed for 99.999999999% (11 nines) durability</td></tr>
  </tbody>
</table>
<p>A system can be available but unreliable (it responds, but with wrong answers) or durable but unavailable (your data is safe in S3, but the region is down so you cannot read it for an hour). Interviewers like to probe this distinction.</p>
<p>A useful formula: <strong>Availability = MTBF ÷ (MTBF + MTTR)</strong>, where MTTR is mean time to repair. You can raise availability by failing less often (higher MTBF) <em>or</em> by recovering faster (lower MTTR). In practice, fast detection and automatic failover (cutting MTTR from 30 minutes to 30 seconds) is usually the cheaper lever.</p>

<h2>The nines</h2>
<table>
  <thead><tr><th>Availability</th><th>Downtime per year</th><th>Per month</th><th>Per week</th><th>Typical use</th></tr></thead>
  <tbody>
    <tr><td>99% (two nines)</td><td>3.65 days</td><td>~7.3 hours</td><td>~1.7 hours</td><td>Internal tools, batch jobs</td></tr>
    <tr><td>99.9% (three nines)</td><td>~8.8 hours</td><td>~43.8 minutes</td><td>~10 minutes</td><td>Most web apps, many cloud SLAs</td></tr>
    <tr><td>99.95%</td><td>~4.4 hours</td><td>~21.9 minutes</td><td>~5 minutes</td><td>Single-region managed databases</td></tr>
    <tr><td>99.99% (four nines)</td><td>~52.6 minutes</td><td>~4.4 minutes</td><td>~1 minute</td><td>Payments, checkout, login</td></tr>
    <tr><td>99.999% (five nines)</td><td>~5.3 minutes</td><td>~26 seconds</td><td>~6 seconds</td><td>Telecom, core banking switches</td></tr>
  </tbody>
</table>
<p>Use the widget to convert any percentage into allowed downtime.</p>
<div data-widget="nines"></div>
<div class="callout info">
<strong>Each nine is roughly 10× harder</strong>
Going from 99.9% to 99.99% means you can no longer rely on a human waking up to fix things: 4 minutes a month is less than the time to open a laptop. You need automated detection, automatic failover, multi-zone deployment and safe, gradual deploys.
</div>

<h2>SLI, SLO, SLA and error budgets</h2>
<ol class="steps">
  <li><strong>SLI (Service Level Indicator)</strong>: a measured number. "Percentage of checkout requests that returned 2xx in under 500 ms over the last 5 minutes."</li>
  <li><strong>SLO (Service Level Objective)</strong>: the internal target for an SLI. "99.95% of checkout requests succeed within 500 ms, measured over 30 days."</li>
  <li><strong>SLA (Service Level Agreement)</strong>: a contract with customers, with penalties. "If monthly uptime falls below 99.9%, we refund 10% of the bill." The SLA is always looser than the SLO so you have a safety margin.</li>
  <li><strong>Error budget</strong>: 100% − SLO. With a 99.9% SLO and 10 M requests a month, you may fail 10,000 requests. If the budget is healthy, ship features faster; if it is used up, freeze risky releases and fix reliability.</li>
</ol>
<div class="callout tip">
<strong>Why error budgets are smart</strong>
They turn "reliability vs speed" from an argument into a number. Product teams at Google (where the SRE idea comes from) can ship as fast as they like while the budget lasts. 100% is the wrong target: users cannot tell 99.999% from 100% because their own Wi-Fi and phones fail more often than that.
</div>

<h2>How it works: series vs parallel maths</h2>
<p>Real systems are chains of components. How you connect them changes overall availability dramatically.</p>
<figure class="svg-fig">
<svg viewBox="0 0 740 300" role="img" aria-label="Series components multiply availability; parallel components multiply unavailability">
  <text class="s-title" x="185" y="26" text-anchor="middle">In series (all must work)</text>
  <rect class="s-box" x="20" y="60" width="90" height="50" rx="10"/>
  <text class="s-text" x="65" y="82" text-anchor="middle">LB</text>
  <text class="s-muted" x="65" y="100" text-anchor="middle">99.9%</text>
  <rect class="s-box" x="140" y="60" width="90" height="50" rx="10"/>
  <text class="s-text" x="185" y="82" text-anchor="middle">App</text>
  <text class="s-muted" x="185" y="100" text-anchor="middle">99.9%</text>
  <rect class="s-box" x="260" y="60" width="90" height="50" rx="10"/>
  <text class="s-text" x="305" y="82" text-anchor="middle">DB</text>
  <text class="s-muted" x="305" y="100" text-anchor="middle">99.9%</text>
  <line class="s-line" x1="110" y1="85" x2="138" y2="85" marker-end="url(#arrow)"/>
  <line class="s-line" x1="230" y1="85" x2="258" y2="85" marker-end="url(#arrow)"/>
  <rect class="s-red" x="40" y="140" width="290" height="44" rx="10"/>
  <text class="s-text" x="185" y="160" text-anchor="middle">0.999 × 0.999 × 0.999</text>
  <text class="s-title" x="185" y="178" text-anchor="middle">≈ 99.7% (lower than any part)</text>

  <text class="s-title" x="560" y="26" text-anchor="middle">In parallel (any one is enough)</text>
  <rect class="s-box" x="420" y="60" width="90" height="50" rx="10"/>
  <text class="s-text" x="465" y="82" text-anchor="middle">LB</text>
  <text class="s-muted" x="465" y="100" text-anchor="middle">entry</text>
  <rect class="s-box" x="580" y="40" width="110" height="44" rx="10"/>
  <text class="s-text" x="635" y="60" text-anchor="middle">App A</text>
  <text class="s-muted" x="635" y="76" text-anchor="middle">99%</text>
  <rect class="s-box" x="580" y="96" width="110" height="44" rx="10"/>
  <text class="s-text" x="635" y="116" text-anchor="middle">App B</text>
  <text class="s-muted" x="635" y="132" text-anchor="middle">99%</text>
  <line class="s-line" x1="510" y1="80" x2="578" y2="62" marker-end="url(#arrow)"/>
  <line class="s-line" x1="510" y1="90" x2="578" y2="118" marker-end="url(#arrow)"/>
  <rect class="s-green" x="420" y="160" width="290" height="44" rx="10"/>
  <text class="s-text" x="565" y="180" text-anchor="middle">1 − (0.01 × 0.01)</text>
  <text class="s-title" x="565" y="198" text-anchor="middle">= 99.99% (higher than any part)</text>

  <text class="s-text" x="370" y="250" text-anchor="middle">Series: multiply availabilities. Parallel: multiply the chances of failure.</text>
  <text class="s-muted" x="370" y="274" text-anchor="middle">Parallel maths assumes failures are independent: two servers on one power supply are not independent.</text>
</svg>
<figcaption>Adding components in a chain lowers availability. Adding redundant copies raises it.</figcaption>
</figure>

<h3>The formulas</h3>
<ul>
  <li><strong>Series</strong>: A<sub>total</sub> = A<sub>1</sub> × A<sub>2</sub> × ... × A<sub>n</sub>. Ten microservices at 99.9% each, all called on every request: 0.999<sup>10</sup> ≈ 99.0%. That is 3.65 days of downtime a year from components that each look healthy.</li>
  <li><strong>Parallel</strong>: A<sub>total</sub> = 1 − (1 − A)<sup>n</sup>. Two replicas at 99.9%: 1 − 0.001<sup>2</sup> = 99.9999%. Three replicas at 99%: 1 − 0.01<sup>3</sup> = 99.9999%.</li>
</ul>
<p><strong>Worked example.</strong> A checkout flow at Flipkart: load balancer pair (each 99.99%), 3 app servers (each 99.5%), and a primary database with a hot standby (each 99.9%).</p>
<ul>
  <li>LB pair: 1 − 0.0001<sup>2</sup> ≈ 99.999999%</li>
  <li>App tier: 1 − 0.005<sup>3</sup> ≈ 99.99999%</li>
  <li>DB pair: 1 − 0.001<sup>2</sup> = 99.9999%</li>
  <li>Total in series ≈ 0.99999999 × 0.9999999 × 0.999999 ≈ <mark>99.9999%</mark> in theory.</li>
</ul>
<p>Reality is lower because failover is not instant, failures are correlated (a bad deploy hits all 3 app servers at once), and there are other dependencies (DNS, payment gateway). The maths is still useful: it shows that the weakest <em>non-redundant</em> component dominates.</p>

<h2>Redundancy and failover</h2>
<p><strong>Redundancy</strong> means having more than one copy of every critical component so that one can fail without an outage. <strong>Failover</strong> is the act of switching traffic from a failed component to a healthy one. Redundancy without tested failover is just expensive decoration.</p>
<div data-diagram="failover" data-caption="Active-passive: the standby takes over only when the heartbeat from the primary stops."></div>

<div class="tabs">
<section data-tab="Active-passive">
<p>One node (primary) serves traffic. A standby receives replicated data and a heartbeat. If heartbeats stop, the standby is promoted and traffic (via DNS, a virtual IP, or the load balancer) moves to it.</p>
<ul>
  <li><strong>Hot standby</strong>: fully running and in sync; failover in seconds. Example: Amazon RDS Multi-AZ.</li>
  <li><strong>Warm standby</strong>: running but may lag or need warm-up; minutes.</li>
  <li><strong>Cold standby</strong>: restored from backups when needed; hours. Cheap, used for disaster recovery.</li>
</ul>
<p>Pros: simple, no write conflicts. Cons: standby capacity sits idle; failover takes time; risk of <strong>split brain</strong> if both nodes think they are primary (solved with fencing or a consensus service like ZooKeeper/etcd).</p>
</section>
<section data-tab="Active-active">
<p>All nodes serve traffic at the same time. The load balancer spreads requests across them; if one dies, the others absorb its share.</p>
<ul>
  <li>Natural for stateless app servers: every Swiggy API server is "active".</li>
  <li>For databases and multi-region setups it is harder: two regions accepting writes to the same data can conflict, needing conflict resolution (last-write-wins, CRDTs) or partitioning users by region.</li>
  <li>Each node must run below ~50–60% so the survivors can absorb a failed peer's load.</li>
</ul>
<p>Pros: no idle capacity, near-instant failover, lower latency when spread across regions. Cons: complexity, consistency challenges, more expensive to test.</p>
</section>
</div>

<h3>RTO and RPO</h3>
<p>Two numbers describe disaster recovery. <strong>RTO</strong> (Recovery Time Objective) is how long you may be down: "service back within 15 minutes". <strong>RPO</strong> (Recovery Point Objective) is how much data you may lose: "at most the last 5 seconds of writes". Synchronous replication gives RPO = 0 at the cost of write latency; asynchronous replication is faster but can lose recent writes on failover. Banks and payment companies like Razorpay aim for RPO ≈ 0 on the money ledger.</p>

<h2>Single points of failure</h2>
<p>A <strong>single point of failure</strong> (SPOF) is any component whose failure takes the whole system down. Finding them is a standard interview exercise: walk your diagram box by box and ask "what if this dies?"</p>
<table>
  <thead><tr><th>Common SPOF</th><th>Fix</th></tr></thead>
  <tbody>
    <tr><td>One load balancer</td><td>LB pair with a floating IP, or a managed cloud LB spread across zones</td></tr>
    <tr><td>One database primary</td><td>Replica with automatic failover; multi-AZ</td></tr>
    <tr><td>One cache node</td><td>Redis cluster with replicas; app degrades gracefully to DB on miss</td></tr>
    <tr><td>One availability zone or region</td><td>Spread across 3 AZs; multi-region for critical paths</td></tr>
    <tr><td>One DNS provider</td><td>Secondary DNS provider (major DNS outages have taken down many sites at once)</td></tr>
    <tr><td>A shared config or secrets service</td><td>Cache config locally; fail static (keep last known good)</td></tr>
    <tr><td>A human (only one person can deploy or fix it)</td><td>Runbooks, on-call rotation, automation</td></tr>
  </tbody>
</table>

<h2>Real-world examples</h2>
<ul>
  <li><strong>Netflix</strong> runs Chaos Monkey, which randomly kills production instances so teams are forced to build redundancy. It also practises evacuating whole AWS regions.</li>
  <li><strong>UPI / NPCI</strong>: payment apps like PhonePe and Google Pay route through multiple partner banks so one bank's outage does not stop all payments.</li>
  <li><strong>AWS us-east-1 outages</strong> have repeatedly shown that "multi-AZ" is not "multi-region"; companies with all eggs in one region went down together.</li>
  <li><strong>Cloud SLAs</strong>: a single cloud VM is often around 99.5–99.9%; deploying across two or more zones raises the published SLA to ~99.99%. That is the parallel formula in action.</li>
</ul>

<h2>Common interview questions and pitfalls</h2>
<div class="callout interview">
<strong>Say this in the interview</strong>
"For checkout I'd target 99.99%, about 4 minutes of downtime a month, so every tier is redundant across three availability zones. App servers are stateless and active-active behind the load balancer. The database is a primary with a synchronous standby in another zone for RPO near zero and automatic failover in under a minute. Recommendations can be 99.9% and degrade gracefully: if that service is down, we just hide the widget."
</div>
<ul>
  <li>Claiming 100% availability. It does not exist.</li>
  <li>Forgetting that series dependencies multiply: many microservices on the critical path drag availability down.</li>
  <li>Assuming replicas are independent when they share a zone, power, or the same bad deploy.</li>
  <li>Confusing durability (data not lost) with availability (system reachable).</li>
  <li>Forgetting graceful degradation: a non-critical feature failing should not fail the whole page.</li>
</ul>

<h2>Test yourself</h2>
<div class="quiz">
<details><summary>How much downtime does 99.99% allow per month?</summary><div>About 4.4 minutes (43,800 minutes in a month × 0.0001 ≈ 4.4).</div></details>
<details><summary>A request passes through 5 services in series, each 99.9% available. What is the end-to-end availability?</summary><div>0.999<sup>5</sup> ≈ 0.995 = 99.5%, about 3.6 hours of downtime a month. Lower than every individual service.</div></details>
<details><summary>Two independent replicas, each 99% available. What is the availability of the pair?</summary><div>1 − (0.01 × 0.01) = 1 − 0.0001 = 99.99%.</div></details>
<details><summary>What is the difference between SLO and SLA?</summary><div>An SLO is an internal target ("99.95% success over 30 days"). An SLA is an external contract with penalties ("below 99.9% we refund credits"). The SLA is set looser than the SLO so the team has a buffer before penalties apply.</div></details>
<details><summary>When would you choose active-passive over active-active for a database?</summary><div>When writes must be strongly consistent and conflict-free (payments, inventory). A single writer with a synchronous standby avoids write conflicts. Active-active writes need conflict resolution and suit data that can be partitioned by user/region or merged safely.</div></details>
<details><summary>Can a system be durable but not available?</summary><div>Yes. Data can be safely replicated (durable) while the service in front of it is down or the region is unreachable (unavailable). When it comes back, no data is lost.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
  <li>Availability = up and serving; reliability = working correctly over time; durability = data not lost.</li>
  <li>99.9% ≈ 8.8 h/year, 99.99% ≈ 53 min/year, 99.999% ≈ 5 min/year. Each nine is ~10× harder.</li>
  <li>SLI is measured, SLO is the target, SLA is the contract; the error budget is 100% − SLO.</li>
  <li>Series multiplies availability (goes down); parallel multiplies failure probability (goes up).</li>
  <li>Use redundancy plus tested, automatic failover; active-active for stateless tiers, often active-passive for databases.</li>
  <li>Hunt single points of failure box by box, and design non-critical features to degrade gracefully.</li>
</ul></div>
`,
  diagrams: {
    failover: String.raw`flowchart LR
      C["Clients"] --> V["Virtual IP / DNS"]
      V --> P[("Primary DB")]
      V -. "after failover" .-> S[("Standby DB")]
      P -- "replication" --> S
      P -- "heartbeat" --> M["Health monitor"]
      M -- "promote on failure" --> S`,
  },
});
