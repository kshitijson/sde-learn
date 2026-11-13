SD.register({
  id: "notification-system",
  html: String.raw`
    <p class="lead">Every product you use talks to you through notifications: the OTP from your bank, "your order is out for delivery" from Swiggy, the Big Billion Days blast from Flipkart. A notification system is the shared platform that turns "tell user X about event Y" into a push, SMS, email or in-app message, on time, exactly once, in the right language, and only if the user wants it. The tricky part is not sending one message. It is sending 50 million marketing messages without delaying a single OTP, without spamming anyone twice, and without breaking telecom rules.</p>

    <h2>Problem statement</h2>
    <p>Design a central notification service for a large consumer app (think Swiggy, Flipkart or PhonePe). Other teams call it to send notifications through four channels: <strong>mobile push</strong> (via Apple's APNs and Google's FCM), <strong>SMS</strong> (via gateways such as Twilio, MSG91 or Gupshup), <strong>email</strong> (via Amazon SES or SendGrid) and <strong>in-app</strong> (a bell icon with an inbox). It must handle both <strong>transactional</strong> messages (OTPs, order and payment updates) and <strong>promotional</strong> campaigns sent to tens of millions of users. Users can choose what they receive. The business wants to know what was sent, delivered and opened.</p>

    <div class="callout tip"><strong>Try it first</strong>Spend 15 minutes before reading on. Sketch: (1) the path from "order service emits an event" to "phone buzzes", (2) how an OTP avoids waiting behind a 50M-user campaign, (3) what stops a user getting the same SMS twice when a worker retries, and (4) what happens when your SMS provider goes down at 8 pm on a Friday.</div>

    <details class="hint"><summary>Hint 1: decouple with queues</summary>
      <p>Callers should not wait for Twilio or FCM. Accept the request, validate it, put it on a queue and return <code>202 Accepted</code>. Workers drain the queue and talk to providers. Now ask: one queue, or many?</p>
    </details>
    <details class="hint"><summary>Hint 2: isolate by priority</summary>
      <p>If OTPs and marketing share one FIFO queue, an OTP sits behind millions of promos. Use separate queues (or topics) per <em>channel × priority</em>, with their own consumers and their own share of provider capacity.</p>
    </details>
    <details class="hint"><summary>Hint 3: at-least-once needs a dedup key</summary>
      <p>Queues redeliver and clients retry. Make every request carry an <strong>idempotency key</strong> such as <code>order881:out_for_delivery:sms</code>, and refuse a second send for the same key within a window.</p>
    </details>
    <details class="hint"><summary>Hint 4: providers fail</summary>
      <p>Classify failures: a bad phone number will never succeed (do not retry), a timeout might (retry with backoff). Keep at least two SMS providers and route around the one that is failing.</p>
    </details>

    <h2>Requirements</h2>
    <div class="grid-2">
      <div class="card">
        <h3>Functional</h3>
        <ul>
          <li>Send to one user or to a segment, on push, SMS, email and in-app.</li>
          <li>Transactional (OTP, order, payment) and promotional (campaign) categories.</li>
          <li>Templates with parameters and localisation (English, Hindi, Tamil, ...).</li>
          <li>User preferences: opt out per category and channel; quiet hours.</li>
          <li>Scheduling: "send at 7 pm in the user's time zone".</li>
          <li>Delivery tracking: queued, sent, delivered, opened, clicked, failed.</li>
          <li>In-app inbox with read/unread state.</li>
        </ul>
      </div>
      <div class="card">
        <h3>Non-functional</h3>
        <ul>
          <li><strong>Low latency for critical messages</strong>: OTP handed to the provider in under ~1 s (p99).</li>
          <li><strong>No duplicates</strong> for the same event, and <strong>no loss</strong> once accepted (at-least-once with dedup).</li>
          <li><strong>High throughput</strong> for campaigns: tens of thousands of sends per second.</li>
          <li><strong>Isolation</strong>: a marketing blast never slows OTPs.</li>
          <li><strong>Compliance</strong>: honour opt-outs, DND registries and promotional time windows.</li>
          <li><strong>Availability</strong> 99.95%+: if login OTPs fail, nobody can log in.</li>
        </ul>
      </div>
    </div>
    <div class="callout info"><strong>Out of scope (say it out loud)</strong>Building our own SMS gateway or push transport (we use providers), the segmentation engine that decides <em>who</em> gets a campaign, and ML for "best time to send". Mention them as extensions.</div>

    <h2>Capacity estimation</h2>
    <p>Assumptions for a Swiggy/Flipkart-scale app: <strong>5M orders/day</strong> with about <strong>6 status events</strong> each, each event sent on <strong>2 channels</strong> on average (push + in-app, sometimes SMS); <strong>10M OTPs/day</strong>; <strong>2 campaigns/day</strong>, each reaching 50M users by push, 20M by email and 10M by SMS. A notification log record is about <strong>500 bytes</strong>.</p>
    <table>
      <thead><tr><th>Quantity</th><th>Arithmetic</th><th>Result</th></tr></thead>
      <tbody>
        <tr><td>Transactional deliveries</td><td>5M × 6 × 2</td><td>60M / day</td></tr>
        <tr><td>OTP SMS</td><td>given</td><td>10M / day</td></tr>
        <tr><td>Promotional deliveries</td><td>2 × (50M + 20M + 10M)</td><td>160M / day</td></tr>
        <tr><td>Total</td><td>60M + 10M + 160M</td><td>230M / day</td></tr>
        <tr><td>Average send rate</td><td>230M ÷ 86,400 s</td><td>≈ 2,660 / s</td></tr>
        <tr><td>Campaign peak (push)</td><td>50M pushes in a 30-minute window: 50M ÷ 1,800 s</td><td>≈ 27,800 / s</td></tr>
        <tr><td>OTP rate</td><td>10M ÷ 86,400 s, peak ~5×</td><td>≈ 116 / s avg, ~600 / s peak</td></tr>
        <tr><td>SMS volume and cost</td><td>(10M OTP + 2 × 10M promo) × ~₹0.20 per SMS</td><td>30M SMS ≈ ₹60 lakh / day</td></tr>
        <tr><td>Notification log storage</td><td>230M × 500 B</td><td>115 GB / day</td></tr>
        <tr><td>Log, 90-day retention, 3 replicas</td><td>115 GB × 90 × 3</td><td>≈ 31 TB</td></tr>
        <tr><td>Dedup keys in Redis (24 h TTL)</td><td>230M keys × ~100 B</td><td>≈ 23 GB</td></tr>
        <tr><td>Push workers at peak</td><td>27,800 / s ÷ ~1,000 sends/s per worker</td><td>28 (run ~40 for headroom)</td></tr>
      </tbody>
    </table>
    <p>Three things stand out. First, <strong>promotions are 70% of the volume</strong> (160M of 230M) but the least urgent, so they must never block the other 30%. Second, the load is <strong>bursty</strong>: the average is 2.7K/s but a campaign pushes 10× that, so queues must absorb spikes. Third, <strong>SMS is expensive</strong>; SMS prices in India vary by route and volume, but even at ~₹0.20 a message the bill is lakhs a day, so prefer push and in-app wherever the user has the app.</p>
    <div data-widget="estimator"></div>
    <div class="callout interview"><strong>Say this in the interview</strong>"About 230 million notifications a day is under 3K per second on average, but a single campaign can push 28K per second for half an hour. So the design is queue-first: accept fast, buffer in Kafka, and drain with workers sized for the peak. And because 70% of that volume is promotional, I'll keep promotional traffic on separate queues so it can be throttled or paused without touching OTPs."</div>

    <h2>API design</h2>
    <p>Internal services call a small REST (or gRPC) API. Everything is asynchronous: the response means "accepted", not "delivered".</p>
    <table>
      <thead><tr><th>Endpoint</th><th>Purpose</th></tr></thead>
      <tbody>
        <tr><td><code>POST /v1/notifications</code></td><td>Send to one user. Body: <code>{idempotency_key, user_id, category: OTP | TRANSACTIONAL | PROMOTIONAL, template_id, params, channels?, send_at?}</code> → <code>202 {notification_id}</code></td></tr>
        <tr><td><code>POST /v1/campaigns</code></td><td>Send to a segment: <code>{segment_id, template_id, channels, schedule_at, max_rate_per_sec}</code></td></tr>
        <tr><td><code>GET /v1/notifications/{id}</code></td><td>Status per channel: queued, sent, delivered, opened, failed (with reason)</td></tr>
        <tr><td><code>GET/PUT /v1/users/{id}/preferences</code></td><td>Per category and channel opt-in/out, quiet hours, language</td></tr>
        <tr><td><code>GET /v1/users/{id}/inbox?cursor=...</code></td><td>In-app notifications, newest first</td></tr>
        <tr><td><code>POST /v1/callbacks/{provider}</code></td><td>Delivery reports (DLRs) and bounces from Twilio, SES, etc.</td></tr>
      </tbody>
    </table>
    <p>The caller sends a <code>template_id</code> plus parameters (<code>{name: "Asha", order_id: 881, eta_min: 12}</code>), never a finished string. That keeps wording, translation and SMS template registration in one place.</p>

    <h2>Data model</h2>
    <table>
      <thead><tr><th>Table</th><th>Key</th><th>Columns</th><th>Store</th></tr></thead>
      <tbody>
        <tr><td><code>templates</code></td><td><code>(template_id, channel, locale, version)</code></td><td><code>subject, body, sms_registered_template_id, sender_id</code></td><td>MySQL/Postgres + cache</td></tr>
        <tr><td><code>user_preferences</code></td><td><code>user_id</code></td><td><code>{category → channels allowed}, quiet_start, quiet_end, timezone, language</code></td><td>DynamoDB / Cassandra + Redis cache</td></tr>
        <tr><td><code>contacts</code></td><td><code>user_id</code></td><td><code>phone, email, email_verified, sms_dnd</code></td><td>MySQL (sharded)</td></tr>
        <tr><td><code>devices</code></td><td><code>(user_id, device_id)</code></td><td><code>platform, push_token, app_version, last_active</code></td><td>Cassandra / DynamoDB</td></tr>
        <tr><td><code>notifications</code></td><td>partition <code>user_id</code>, cluster <code>created_at DESC</code></td><td><code>notification_id, category, channel, template_id, params, status, provider, provider_msg_id, sent_at, delivered_at, opened_at</code></td><td>Cassandra (90-day TTL)</td></tr>
        <tr><td><code>dedup:{idempotency_key}</code></td><td>key</td><td>first-seen time, <code>notification_id</code></td><td>Redis, <code>SET NX EX 86400</code></td></tr>
        <tr><td><code>events</code></td><td>time + notification</td><td><code>event_type (sent, delivered, opened, clicked), channel, campaign_id</code></td><td>Kafka → ClickHouse</td></tr>
      </tbody>
    </table>
    <p>Preferences and templates are read on every send but change rarely, so they are cached aggressively (see <a href="#/p/caching">Caching</a>). The notification log is write-heavy and read by user, a natural fit for a wide-column store partitioned by <code>user_id</code>.</p>

    <h2>High-level design</h2>
    <div data-diagram="arch" data-caption="Notification platform: accept fast, route by channel and priority, isolate providers behind adapters."></div>
    <ol class="steps">
      <li><strong>Notification API</strong> authenticates the calling service, validates the template and parameters, checks the <strong>idempotency key</strong>, and writes a record with status <code>QUEUED</code>.</li>
      <li><strong>Router</strong> loads the user's preferences and contacts, drops opted-out channels, applies <strong>per-user rate limits</strong> and <strong>quiet hours</strong>, renders the template in the user's language, and publishes one message per channel.</li>
      <li><strong>Kafka topics per channel × priority</strong>: <code>sms.otp</code>, <code>sms.txn</code>, <code>sms.promo</code>, <code>push.txn</code>, <code>push.promo</code>, and so on. See <a href="#/p/message-queues">Message queues</a>.</li>
      <li><strong>Channel workers</strong> consume their topics, respect <strong>per-provider rate limits</strong>, call the provider through an <strong>adapter</strong>, and retry with backoff. Exhausted retries go to a <strong>DLQ</strong> (dead-letter queue).</li>
      <li><strong>Scheduler</strong> holds messages with <code>send_at</code> in the future (or deferred by quiet hours) and releases them on time.</li>
      <li><strong>Campaign service</strong> expands a segment into user batches and feeds them into the promo topics at a controlled rate.</li>
      <li><strong>Status tracker</strong> receives provider callbacks and app open events, updates the log, and streams events to analytics.</li>
    </ol>

    <h2>Deep dive 1: an OTP must never wait</h2>
    <p>Imagine one shared queue. At 8 pm marketing enqueues 10M promo SMS. A user tries to log in; their OTP is message number 10,000,001. At 2,000 SMS/s it arrives in 83 minutes. Isolation fixes this at three levels:</p>
    <ul>
      <li><strong>Separate queues.</strong> OTP, transactional and promotional traffic live on different topics with their own consumer groups. A backlog in <code>sms.promo</code> is invisible to <code>sms.otp</code>.</li>
      <li><strong>Reserved provider capacity.</strong> SMS gateways cap throughput per account (say 1,000 SMS/s). If promos use all of it, OTPs still wait at the provider. Reserve a slice (e.g. 300/s) for OTPs, or use a separate account or route for OTP traffic. Promo workers take only what is left.</li>
      <li><strong>Priority inside a worker.</strong> Where one worker serves several priorities (as in the code below), always drain the higher-priority queue first, and give promotions a strict rate cap so they never starve the rest.</li>
    </ul>
    <div data-diagram="otp" data-caption="OTP path: idempotency check, priority topic, fast provider call with a short timeout and failover."></div>
    <p>OTPs also get special treatment: short provider timeouts (2–3 s, not 30 s), no quiet hours, no opt-out (the user asked for it), but a strict per-user rate limit, such as 3 OTPs per 10 minutes, to stop <em>SMS pumping</em> fraud where bots trigger thousands of OTPs to premium numbers.</p>
    <div class="callout interview"><strong>Say this in the interview</strong>"I isolate by priority at every layer: separate Kafka topics, separate consumer pools, and a reserved share of each provider's rate limit. A paused or backlogged campaign cannot affect OTP latency. And OTPs have a per-user limit, because OTP endpoints are a favourite target for SMS pumping."</div>

    <h2>Deep dive 2: no duplicates with at-least-once delivery</h2>
    <p>Kafka, SQS and RabbitMQ give <em>at-least-once</em> delivery: a worker that crashes after sending but before committing its offset will see the message again. The order service also retries its API call on a timeout. Without care, the user gets "Your order is out for delivery" twice, or worse, two debit alerts.</p>
    <ol class="steps">
      <li><strong>Caller supplies the key.</strong> The key describes the business event, not the HTTP request: <code>order881:out_for_delivery</code>. A retry of the same event carries the same key.</li>
      <li><strong>API dedup.</strong> <code>SET dedup:{key} {notification_id} NX EX 86400</code> in Redis. If the key exists, return the original <code>notification_id</code> with <code>200</code> instead of creating a new one.</li>
      <li><strong>Worker dedup.</strong> Before calling the provider, the worker checks the per-channel status. If it is already <code>SENT</code>, it skips. After the provider accepts, it records <code>SENT</code> and the provider's message id, then commits the offset.</li>
      <li><strong>Campaign keys</strong> are <code>campaign_id:user_id:channel</code>, so re-running a half-finished campaign skips everyone already sent.</li>
    </ol>
    <div class="callout warn"><strong>The unavoidable gap</strong>If a worker crashes after the provider accepted the SMS but before it saved <code>SENT</code>, a retry sends it again. True exactly-once across an external provider is impossible. You shrink the window (save status immediately, pass your id to providers that support idempotency keys) and accept a very rare duplicate. Say this honestly; interviewers like it.</div>

    <h2>Deep dive 3: retries, backoff, DLQ and provider failover</h2>
    <p>Not every failure deserves a retry. Classify first:</p>
    <table>
      <thead><tr><th>Failure</th><th>Example</th><th>Action</th></tr></thead>
      <tbody>
        <tr><td>Permanent, recipient</td><td>FCM says token is unregistered; email hard bounce; invalid number</td><td>Do not retry. Delete the token or mark the email invalid.</td></tr>
        <tr><td>Throttled</td><td>HTTP 429 from the provider</td><td>Back off, slow the worker's send rate.</td></tr>
        <tr><td>Transient</td><td>Timeout, 5xx, connection reset</td><td>Retry with exponential backoff and jitter: 1 s, 2 s, 4 s, ...</td></tr>
        <tr><td>Provider down</td><td>Error rate above, say, 20% for a minute</td><td>Open a circuit breaker and fail over to the secondary provider.</td></tr>
        <tr><td>Retries exhausted</td><td>4 attempts failed</td><td>Move to the DLQ, alert, allow manual replay.</td></tr>
      </tbody>
    </table>
    <div data-diagram="retry" data-caption="A transient failure, backoff, then failover to a secondary SMS provider."></div>
    <ul>
      <li><strong>Backoff with jitter.</strong> If 1M messages fail at the same instant and all retry exactly 2 s later, you create a second spike. Add random jitter so retries spread out.</li>
      <li><strong>Retry topics, not sleeping workers.</strong> A worker should not <code>sleep(4s)</code> while holding a partition. Publish the message to a delay topic (<code>sms.retry.4s</code>) or a scheduler with its next attempt time.</li>
      <li><strong>Multi-provider routing.</strong> In India it is common to keep two or three SMS gateways (for example MSG91 and Gupshup) and route by health, cost and delivery rate per telecom operator. Email can fail over between SES and SendGrid. Push has no alternative to APNs/FCM, so there you just retry.</li>
      <li><strong>Channel fallback.</strong> For critical messages, if push is not delivered within N seconds, fall back to SMS. Never do this for promotions; it multiplies cost.</li>
    </ul>

    <h3>Core algorithm: the dispatcher</h3>
    <p>The code below is the heart of one worker, in memory and with a fake clock so the output is deterministic. It enforces priority (OTP &gt; transactional &gt; promotional), drops duplicates by idempotency key within a 24-hour window, applies per-user sliding-window rate limits (3 OTPs per 10 minutes, 2 promotions per day), honours promotional opt-out and quiet hours (21:00 to 09:00, deferring rather than dropping), and retries failures with exponential backoff before moving them to a DLQ. A <code>ready</code> heap orders sendable work by priority; a <code>delayed</code> heap holds retries and deferred messages by their due time.</p>
    <div data-code="dispatcher"></div>
    <p>Read the output: the OTP <code>n5</code> was submitted after three promotions but is sent first; the duplicate <code>n6</code> is rejected; <code>n8</code> hits the promo limit; <code>n4</code> succeeds on its third attempt; <code>n2</code> lands in the DLQ; and the 22:30 promotion waits until 09:00 the next morning while the OTP at 22:30 goes out immediately.</p>

    <h2>Deep dive 4: preferences, quiet hours and Indian SMS rules</h2>
    <ul>
      <li><strong>Preference model.</strong> Store choices as <code>category × channel</code>: a user can keep order updates on push but turn off promotional SMS. OTPs and security alerts are not opt-out-able. Every promotional email needs a one-click unsubscribe link that writes straight to preferences.</li>
      <li><strong>Quiet hours.</strong> Use the user's time zone, not the server's. Defer promotions until the window ends (as the code does) rather than dropping them, unless they expire, like a "sale ends at midnight" message.</li>
      <li><strong>India: TRAI and DLT.</strong> Under TRAI's commercial-communication rules (TCCCPR 2018), businesses register their sender IDs (headers) and message templates on operators' DLT (distributed ledger) platforms, and messages that do not match a registered template can be blocked. Promotional SMS must skip numbers on the national Do Not Disturb registry and are generally restricted to daytime hours (roughly 9 am to 9 pm); transactional and service messages such as OTPs are not. The rules change often, so in an interview say "we comply with DLT template registration and DND scrubbing" and confirm specifics with your SMS provider rather than quoting exact clauses.</li>
      <li><strong>Templates and localisation.</strong> Templates are versioned per channel and locale, with fallback to English. Watch SMS length: a single GSM-7 SMS holds 160 characters, but any Hindi or Tamil character forces Unicode (UCS-2) with only 70 characters per segment, so the same message can cost two or three times more.</li>
    </ul>

    <h2>Deep dive 5: campaigns, scheduling and tracking</h2>
    <div data-diagram="campaign" data-caption="Campaign fan-out: expand the segment in chunks, throttle, and let the normal pipeline do the rest."></div>
    <ul>
      <li><strong>Chunked fan-out.</strong> The campaign service reads the segment (say 50M user ids) in pages of 10K, and publishes one job per page. Workers expand each job into per-user messages. A crash restarts from the last finished chunk, and dedup keys make re-runs safe.</li>
      <li><strong>Throttle on purpose.</strong> A 50M push blast at full speed makes 50M phones open the app within minutes and can melt your own backend. Campaigns carry a <code>max_rate_per_sec</code>, and the platform can pause or cancel them mid-flight.</li>
      <li><strong>Scheduling.</strong> Store scheduled sends in a table bucketed by minute (<code>send_minute, notification_id</code>). A scheduler polls the current bucket and publishes due messages. For "7 pm local time", compute a per-user UTC instant at fan-out time.</li>
      <li><strong>Delivery tracking.</strong> <em>Sent</em> = provider accepted. <em>Delivered</em> = SMS delivery report (DLR) or email delivery event; for push, the app reports receipt. <em>Opened</em> = app open with the notification id, or an email tracking pixel. <em>Clicked</em> = redirect through a tracking link. Status only moves forward.</li>
    </ul>
    <div data-diagram="lifecycle" data-caption="Per-channel status of one notification. Status moves forward only."></div>
    <p>Events (hundreds of millions a day) go to Kafka and into a column store such as ClickHouse or Druid for dashboards like "delivery rate by operator" or "campaign open rate by city". The operational <code>notifications</code> table keeps only the latest status. See <a href="#/p/timeseries-olap">time-series and analytics databases</a>.</p>

    <h2>Scaling &amp; bottlenecks</h2>
    <ul>
      <li><strong>Stateless everything.</strong> API, router and workers are stateless and scale horizontally behind a <a href="#/p/load-balancers">load balancer</a>; state lives in Kafka, Redis and Cassandra.</li>
      <li><strong>Provider limits are the real ceiling.</strong> You can add workers forever, but if your SMS account allows 1,000/s, that is your SMS throughput. Use a distributed token bucket per provider (see <a href="#/p/rate-limiter">rate limiter</a>), several accounts or providers, and plan large campaigns with the provider in advance.</li>
      <li><strong>Hot preferences.</strong> Every send reads preferences, contacts and devices. Cache them in Redis with invalidation on update; for campaigns, bulk-load them per chunk instead of 50M point reads.</li>
      <li><strong>Kafka partitioning.</strong> Partition by <code>user_id</code> so one user's messages stay in order (order placed before order delivered). Size partitions for the campaign peak: at ~1,000 msg/s per consumer, 28K/s needs at least 28 partitions; use 64 for growth.</li>
      <li><strong>Stale push tokens.</strong> Uninstalls leave dead tokens. Delete tokens on "unregistered" responses, or campaigns waste a large share of calls.</li>
      <li><strong>Multi-region.</strong> Run the OTP path active-active in two regions; a region outage must not block logins.</li>
    </ul>

    <h2>Trade-offs</h2>
    <table>
      <thead><tr><th>Decision</th><th>Choice</th><th>What we give up</th></tr></thead>
      <tbody>
        <tr><td>Synchronous vs async API</td><td>Async (202 + queue)</td><td>Caller does not know delivery outcome immediately; needs status API or callbacks</td></tr>
        <tr><td>Delivery guarantee</td><td>At-least-once + idempotency keys</td><td>Rare duplicate if a worker crashes between provider call and status write</td></tr>
        <tr><td>Queues</td><td>One topic per channel × priority</td><td>More topics and consumer groups to operate</td></tr>
        <tr><td>Rendering</td><td>Templates rendered by the platform</td><td>Callers lose free-form text; every new message needs a template (also required for SMS in India)</td></tr>
        <tr><td>Quiet hours</td><td>Defer, not drop</td><td>Morning bursts when deferred promotions all release at 09:00 (spread them with jitter)</td></tr>
        <tr><td>Providers</td><td>Multiple SMS/email providers</td><td>Integration and reconciliation work; different delivery-report formats</td></tr>
        <tr><td>Analytics</td><td>Events to a separate OLAP store</td><td>Dashboards are seconds to minutes behind</td></tr>
      </tbody>
    </table>

    <h2>Follow-up questions</h2>
    <div class="quiz">
      <details><summary>A 50M-user campaign is running and a provider outage hits. How do you avoid OTP failures?</summary><div>OTPs are on their own topic and consumer pool, with reserved provider capacity. The circuit breaker on the failing provider opens and OTP traffic fails over to the secondary provider first. Pause the campaign (it can resume later from its last chunk, with dedup keys preventing repeats) so the secondary provider's capacity goes to OTPs and transactional messages.</div></details>
      <details><summary>Why not let callers pass the final message text?</summary><div>Templates centralise wording, translation and compliance. In India, SMS bodies must match templates registered on DLT, so free text would get blocked. Templates also let you fix a typo or add a language without redeploying every calling service.</div></details>
      <details><summary>How do you guarantee per-user ordering (order placed before order delivered)?</summary><div>Partition Kafka by <code>user_id</code> so one user's messages are consumed in order by one consumer. Retries can still reorder, so each message carries an event version; the app shows the latest state, and stale updates can be dropped if a newer one has been sent.</div></details>
      <details><summary>How would you stop SMS pumping fraud on your OTP endpoint?</summary><div>Per-user and per-phone rate limits (e.g. 3 per 10 minutes), per-IP and per-device limits at the API gateway, CAPTCHA after repeated requests, blocking premium-rate or unexpected country codes, and alerting on sudden spikes in OTP volume to one country or number range.</div></details>
      <details><summary>The marketing team wants "send at 7 pm in each user's local time". How?</summary><div>At fan-out, compute each user's send instant in UTC from their time zone and write them into minute buckets in the scheduler. The scheduler releases each bucket on time. Spread each bucket with a few minutes of jitter so 7:00:00 is not a thundering herd.</div></details>
      <details><summary>How do you measure push delivery when FCM only says "accepted"?</summary><div>The app sends a lightweight "received" event when the notification arrives (where the OS allows) and an "opened" event with the notification id when tapped. Compare these with "sent" counts to compute delivery and open rates per campaign, platform and app version.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li><strong>Queue-first, async API</strong>: accept, validate, dedup, enqueue, return 202.</li>
      <li><strong>Isolate by channel × priority</strong> at every layer (topics, workers, provider quota) so OTPs never wait behind promotions.</li>
      <li><strong>Idempotency keys</strong> from the business event make at-least-once delivery look exactly-once to users, with one small honest gap.</li>
      <li><strong>Classify failures</strong>: never retry permanent errors; retry transient ones with exponential backoff and jitter; DLQ the rest; fail over between providers with a circuit breaker.</li>
      <li><strong>Respect the user</strong>: category × channel preferences, quiet hours in local time, per-user rate limits, and DND/DLT rules for Indian SMS.</li>
      <li><strong>Templates + localisation</strong> live in the platform; Unicode SMS costs more segments.</li>
      <li>Track <strong>sent → delivered → opened → clicked</strong> as forward-only status, with events flowing to an OLAP store.</li>
    </ul></div>
  `,
  code: {
    dispatcher: {
      title: "Notification dispatcher: priority, dedup, rate limits, quiet hours, retries",
      java: String.raw`import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

public class Notify {
    enum Kind { OTP, TXN, PROMO } // declaration order = priority (OTP first)

    static final long DAY = 86_400;
    static final long DEDUP_WINDOW = DAY;   // same idempotency key within 24 h = duplicate
    static final int MAX_ATTEMPTS = 4;
    static final long BASE_BACKOFF = 1;      // seconds: 1, 2, 4 ...
    // per-user limits: {max sends, window seconds}; TXN is not limited
    static final Map<Kind, long[]> LIMITS = Map.of(Kind.OTP, new long[]{3, 600}, Kind.PROMO, new long[]{2, DAY});

    static final class Notification {
        final String id, user, body, idemKey;
        final Kind kind;
        int attempts = 0;

        Notification(String id, String user, Kind kind, String body, String idemKey) {
            this.id = id; this.user = user; this.kind = kind; this.body = body; this.idemKey = idemKey;
        }
    }

    static final class Prefs {
        final boolean promoOptOut;
        final long quietStart = 21 * 3600, quietEnd = 9 * 3600; // no promotions 21:00 to 09:00

        Prefs(boolean promoOptOut) { this.promoOptOut = promoOptOut; }
    }

    record Entry(long key, long seq, Notification n) {}

    static String fmt(long t) {
        long s = t % DAY;
        return String.format("d%d %02d:%02d:%02d", t / DAY, s / 3600, s % 3600 / 60, s % 60);
    }

    /** Fails a notification a fixed number of times, then succeeds (-1 = always fails). */
    static final class FakeProvider {
        private final Map<String, Integer> failPlan;
        private final Map<String, Integer> calls = new HashMap<>();

        FakeProvider(Map<String, Integer> failPlan) { this.failPlan = failPlan; }

        boolean send(Notification n) {
            int c = calls.merge(n.id, 1, Integer::sum);
            int fails = failPlan.getOrDefault(n.id, 0);
            return !(fails < 0 || c <= fails);
        }
    }

    static final class Dispatcher {
        private final FakeProvider provider;
        private final Map<String, Prefs> prefs;
        long now;
        private long seq = 0;
        private final PriorityQueue<Entry> ready = new PriorityQueue<>(
            (a, b) -> a.key() != b.key() ? Long.compare(a.key(), b.key()) : Long.compare(a.seq(), b.seq()));
        private final PriorityQueue<Entry> delayed = new PriorityQueue<>(
            (a, b) -> a.key() != b.key() ? Long.compare(a.key(), b.key()) : Long.compare(a.seq(), b.seq()));
        private final Map<String, Long> seen = new HashMap<>();
        private final Map<String, Deque<Long>> sentLog = new HashMap<>();
        final List<String> dlq = new ArrayList<>();

        Dispatcher(FakeProvider provider, Map<String, Prefs> prefs, long now) {
            this.provider = provider; this.prefs = prefs; this.now = now;
        }

        private void push(Notification n, long readyAt) {
            seq++;
            if (readyAt <= now) ready.add(new Entry(n.kind.ordinal(), seq, n));
            else delayed.add(new Entry(readyAt, seq, n));
        }

        /** If now is inside quiet hours, return when they end, else -1. */
        private long quietUntil(Prefs p) {
            long dayStart = now - now % DAY, s = now % DAY;
            boolean inside = p.quietStart > p.quietEnd
                ? (s >= p.quietStart || s < p.quietEnd)
                : (s >= p.quietStart && s < p.quietEnd);
            if (!inside) return -1;
            return s < p.quietEnd ? dayStart + p.quietEnd : dayStart + DAY + p.quietEnd;
        }

        private boolean allowRate(Notification n) {
            long[] limit = LIMITS.get(n.kind);
            if (limit == null) return true;
            Deque<Long> log = sentLog.computeIfAbsent(n.user + "|" + n.kind, k -> new ArrayDeque<>());
            while (!log.isEmpty() && log.peekFirst() <= now - limit[1]) log.pollFirst();
            if (log.size() >= limit[0]) return false;
            log.addLast(now);
            return true;
        }

        String submit(Notification n) {
            Long first = seen.get(n.idemKey);
            if (first != null && now - first < DEDUP_WINDOW) return "DUPLICATE";
            seen.put(n.idemKey, now);
            Prefs p = prefs.getOrDefault(n.user, new Prefs(false));
            if (n.kind == Kind.PROMO && p.promoOptOut) return "OPTED_OUT";
            if (!allowRate(n)) return "RATE_LIMITED";
            if (n.kind == Kind.PROMO) {
                long until = quietUntil(p);
                if (until >= 0) {
                    push(n, until);
                    return "DEFERRED to " + fmt(until);
                }
            }
            push(n, now);
            return "QUEUED";
        }

        void run() {
            while (!ready.isEmpty() || !delayed.isEmpty()) {
                while (!delayed.isEmpty() && delayed.peek().key() <= now) {
                    Entry e = delayed.poll();
                    ready.add(new Entry(e.n().kind.ordinal(), e.seq(), e.n()));
                }
                if (ready.isEmpty()) { now = delayed.peek().key(); continue; } // jump the fake clock
                Notification n = ready.poll().n();
                n.attempts++;
                String tag = String.format("[%s] %s %-5s %s", fmt(now), n.id, n.kind, n.user);
                if (provider.send(n)) {
                    System.out.println(tag + " SENT (attempt " + n.attempts + "): " + n.body);
                } else if (n.attempts >= MAX_ATTEMPTS) {
                    dlq.add(n.id);
                    System.out.println(tag + " FAILED " + n.attempts + " times -> DLQ");
                } else {
                    long at = now + BASE_BACKOFF * (1L << (n.attempts - 1));
                    System.out.println(tag + " failed (attempt " + n.attempts + "), retry at " + fmt(at));
                    push(n, at);
                }
            }
        }
    }

    static void submitAll(Dispatcher d, List<Notification> batch) {
        for (Notification n : batch)
            System.out.println(String.format("submit %s %-5s %s -> %s", n.id, n.kind, n.user, d.submit(n)));
    }

    public static void main(String[] args) {
        Map<String, Prefs> prefs = Map.of("u1", new Prefs(false), "u2", new Prefs(false), "u3", new Prefs(true));
        FakeProvider provider = new FakeProvider(Map.of("n4", 2, "n2", -1)); // n4 fails twice, n2 always
        Dispatcher d = new Dispatcher(provider, prefs, 10 * 3600);           // fixed clock: day 0, 10:00:00

        submitAll(d, List.of(
            new Notification("n1", "u1", Kind.PROMO, "Diwali sale: 50% off", "camp42:u1"),
            new Notification("n2", "u2", Kind.PROMO, "Diwali sale: 50% off", "camp42:u2"),
            new Notification("n3", "u3", Kind.PROMO, "Diwali sale: 50% off", "camp42:u3"),
            new Notification("n4", "u1", Kind.TXN, "Order 881 is out for delivery", "order881:ofd"),
            new Notification("n5", "u2", Kind.OTP, "Your OTP is 4821", "otp:u2:login:1"),
            new Notification("n6", "u1", Kind.TXN, "Order 881 is out for delivery", "order881:ofd"),
            new Notification("n7", "u1", Kind.PROMO, "Flash sale at 12", "camp43:u1"),
            new Notification("n8", "u1", Kind.PROMO, "Weekend offers", "camp44:u1")));
        d.run();

        d.now = 22 * 3600 + 30 * 60; // later the same day: 22:30:00
        submitAll(d, List.of(
            new Notification("n9", "u2", Kind.PROMO, "Midnight deals", "camp45:u2"),
            new Notification("n10", "u2", Kind.OTP, "Your OTP is 1937", "otp:u2:login:2")));
        d.run();
        System.out.println("dead-letter queue: " + d.dlq);
    }
}`,
      python: String.raw`import heapq
from collections import deque
from dataclasses import dataclass
from enum import IntEnum


class Kind(IntEnum):        # lower value = higher priority
    OTP = 0
    TXN = 1
    PROMO = 2


DAY = 86_400
DEDUP_WINDOW = DAY                            # same idempotency key within 24 h = duplicate
LIMITS = {Kind.OTP: (3, 600), Kind.PROMO: (2, DAY)}  # (max sends, window seconds) per user
MAX_ATTEMPTS = 4
BASE_BACKOFF = 1                              # seconds: 1, 2, 4 ...


@dataclass
class Notification:
    id: str
    user: str
    kind: Kind
    body: str
    idem_key: str
    attempts: int = 0


@dataclass
class Prefs:
    promo_opt_out: bool = False
    quiet_start: int = 21 * 3600              # no promotions 21:00 to 09:00 local time
    quiet_end: int = 9 * 3600


def fmt(t):
    s = t % DAY
    return f"d{t // DAY} {s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


class FakeProvider:
    """Fails a notification a fixed number of times, then succeeds (-1 = always fails)."""

    def __init__(self, fail_plan):
        self.fail_plan = fail_plan
        self.calls = {}

    def send(self, n):
        self.calls[n.id] = self.calls.get(n.id, 0) + 1
        fails = self.fail_plan.get(n.id, 0)
        return not (fails < 0 or self.calls[n.id] <= fails)


class Dispatcher:
    def __init__(self, provider, prefs, now):
        self.provider = provider
        self.prefs = prefs
        self.now = now
        self.seq = 0
        self.ready = []        # heap of (priority, seq, notification)
        self.delayed = []      # heap of (ready_at, seq, notification)
        self.seen = {}         # idempotency key -> first seen time
        self.sent_log = {}     # (user, kind) -> deque of send times (sliding window)
        self.dlq = []

    def _push(self, n, ready_at):
        self.seq += 1
        if ready_at <= self.now:
            heapq.heappush(self.ready, (int(n.kind), self.seq, n))
        else:
            heapq.heappush(self.delayed, (ready_at, self.seq, n))

    def _quiet_until(self, prefs):
        """If now is inside the user's quiet hours, return when they end, else None."""
        day_start = self.now - self.now % DAY
        s = self.now % DAY
        qs, qe = prefs.quiet_start, prefs.quiet_end
        inside = (s >= qs or s < qe) if qs > qe else (qs <= s < qe)
        if not inside:
            return None
        return day_start + qe if s < qe else day_start + DAY + qe

    def _allow_rate(self, n):
        limit = LIMITS.get(n.kind)
        if limit is None:
            return True
        max_sends, window = limit
        log = self.sent_log.setdefault((n.user, n.kind), deque())
        while log and log[0] <= self.now - window:
            log.popleft()
        if len(log) >= max_sends:
            return False
        log.append(self.now)
        return True

    def submit(self, n):
        first = self.seen.get(n.idem_key)
        if first is not None and self.now - first < DEDUP_WINDOW:
            return "DUPLICATE"
        self.seen[n.idem_key] = self.now
        prefs = self.prefs.get(n.user, Prefs())
        if n.kind == Kind.PROMO and prefs.promo_opt_out:
            return "OPTED_OUT"
        if not self._allow_rate(n):
            return "RATE_LIMITED"
        if n.kind == Kind.PROMO:
            until = self._quiet_until(prefs)
            if until is not None:
                self._push(n, until)
                return "DEFERRED to " + fmt(until)
        self._push(n, self.now)
        return "QUEUED"

    def run(self):
        while self.ready or self.delayed:
            while self.delayed and self.delayed[0][0] <= self.now:
                _, seq, n = heapq.heappop(self.delayed)
                heapq.heappush(self.ready, (int(n.kind), seq, n))
            if not self.ready:
                self.now = self.delayed[0][0]      # jump the fake clock forward
                continue
            _, _, n = heapq.heappop(self.ready)
            n.attempts += 1
            tag = f"[{fmt(self.now)}] {n.id} {n.kind.name:<5} {n.user}"
            if self.provider.send(n):
                print(f"{tag} SENT (attempt {n.attempts}): {n.body}")
            elif n.attempts >= MAX_ATTEMPTS:
                self.dlq.append(n.id)
                print(f"{tag} FAILED {n.attempts} times -> DLQ")
            else:
                at = self.now + BASE_BACKOFF * 2 ** (n.attempts - 1)
                print(f"{tag} failed (attempt {n.attempts}), retry at {fmt(at)}")
                self._push(n, at)


if __name__ == "__main__":
    prefs = {"u1": Prefs(), "u2": Prefs(), "u3": Prefs(promo_opt_out=True)}
    provider = FakeProvider({"n4": 2, "n2": -1})   # n4 fails twice, n2 always fails
    d = Dispatcher(provider, prefs, now=10 * 3600)  # fixed clock: day 0, 10:00:00

    batch = [
        Notification("n1", "u1", Kind.PROMO, "Diwali sale: 50% off", "camp42:u1"),
        Notification("n2", "u2", Kind.PROMO, "Diwali sale: 50% off", "camp42:u2"),
        Notification("n3", "u3", Kind.PROMO, "Diwali sale: 50% off", "camp42:u3"),
        Notification("n4", "u1", Kind.TXN, "Order 881 is out for delivery", "order881:ofd"),
        Notification("n5", "u2", Kind.OTP, "Your OTP is 4821", "otp:u2:login:1"),
        Notification("n6", "u1", Kind.TXN, "Order 881 is out for delivery", "order881:ofd"),
        Notification("n7", "u1", Kind.PROMO, "Flash sale at 12", "camp43:u1"),
        Notification("n8", "u1", Kind.PROMO, "Weekend offers", "camp44:u1"),
    ]
    for n in batch:
        print(f"submit {n.id} {n.kind.name:<5} {n.user} -> {d.submit(n)}")
    d.run()

    d.now = 22 * 3600 + 30 * 60                     # later the same day: 22:30:00
    for n in [Notification("n9", "u2", Kind.PROMO, "Midnight deals", "camp45:u2"),
              Notification("n10", "u2", Kind.OTP, "Your OTP is 1937", "otp:u2:login:2")]:
        print(f"submit {n.id} {n.kind.name:<5} {n.user} -> {d.submit(n)}")
    d.run()
    print("dead-letter queue: [" + ", ".join(d.dlq) + "]")`,
      cpp: String.raw`#include <cstdint>
#include <cstdio>
#include <deque>
#include <iostream>
#include <map>
#include <memory>
#include <queue>
#include <string>
#include <tuple>
#include <unordered_map>
#include <vector>

enum class Kind { OTP = 0, TXN = 1, PROMO = 2 };  // lower value = higher priority

const char* kindName(Kind k) {
    switch (k) {
        case Kind::OTP: return "OTP";
        case Kind::TXN: return "TXN";
        default: return "PROMO";
    }
}

const int64_t DAY = 86400;
const int64_t DEDUP_WINDOW = DAY;   // same idempotency key within 24 h = duplicate
const int MAX_ATTEMPTS = 4;
const int64_t BASE_BACKOFF = 1;     // seconds: 1, 2, 4 ...
// per-user limits: {max sends, window seconds}; TXN is not limited
const std::map<Kind, std::pair<size_t, int64_t>> LIMITS = {{Kind::OTP, {3, 600}}, {Kind::PROMO, {2, DAY}}};

struct Notification {
    std::string id, user;
    Kind kind;
    std::string body, idemKey;
    int attempts = 0;
};

struct Prefs {
    bool promoOptOut = false;
    int64_t quietStart = 21 * 3600, quietEnd = 9 * 3600;  // no promotions 21:00 to 09:00
};

std::string fmt(int64_t t) {
    int64_t s = t % DAY;
    char buf[32];
    std::snprintf(buf, sizeof buf, "d%lld %02lld:%02lld:%02lld", (long long)(t / DAY), (long long)(s / 3600),
                  (long long)(s % 3600 / 60), (long long)(s % 60));
    return buf;
}

std::string pad5(const char* s) {
    std::string r = s;
    while (r.size() < 5) r += ' ';
    return r;
}

// Fails a notification a fixed number of times, then succeeds (-1 = always fails).
class FakeProvider {
public:
    explicit FakeProvider(std::unordered_map<std::string, int> plan) : failPlan_(std::move(plan)) {}
    bool send(const Notification& n) {
        int c = ++calls_[n.id];
        auto it = failPlan_.find(n.id);
        int fails = it == failPlan_.end() ? 0 : it->second;
        return !(fails < 0 || c <= fails);
    }

private:
    std::unordered_map<std::string, int> failPlan_;
    std::unordered_map<std::string, int> calls_;
};

using Entry = std::tuple<int64_t, int64_t, std::shared_ptr<Notification>>;  // (key, seq, notification)
struct EntryGreater {
    bool operator()(const Entry& a, const Entry& b) const {
        if (std::get<0>(a) != std::get<0>(b)) return std::get<0>(a) > std::get<0>(b);
        return std::get<1>(a) > std::get<1>(b);
    }
};
using MinHeap = std::priority_queue<Entry, std::vector<Entry>, EntryGreater>;

class Dispatcher {
public:
    int64_t now;
    std::vector<std::string> dlq;

    Dispatcher(FakeProvider& p, std::unordered_map<std::string, Prefs> prefs, int64_t start)
        : now(start), provider_(p), prefs_(std::move(prefs)) {}

    std::string submit(const Notification& in) {
        auto n = std::make_shared<Notification>(in);
        auto it = seen_.find(n->idemKey);
        if (it != seen_.end() && now - it->second < DEDUP_WINDOW) return "DUPLICATE";
        seen_[n->idemKey] = now;
        Prefs p = prefs_.count(n->user) ? prefs_[n->user] : Prefs{};
        if (n->kind == Kind::PROMO && p.promoOptOut) return "OPTED_OUT";
        if (!allowRate(*n)) return "RATE_LIMITED";
        if (n->kind == Kind::PROMO) {
            int64_t until = quietUntil(p);
            if (until >= 0) {
                push(n, until);
                return "DEFERRED to " + fmt(until);
            }
        }
        push(n, now);
        return "QUEUED";
    }

    void run() {
        while (!ready_.empty() || !delayed_.empty()) {
            while (!delayed_.empty() && std::get<0>(delayed_.top()) <= now) {
                Entry e = delayed_.top();
                delayed_.pop();
                ready_.push({static_cast<int64_t>(std::get<2>(e)->kind), std::get<1>(e), std::get<2>(e)});
            }
            if (ready_.empty()) {  // jump the fake clock forward
                now = std::get<0>(delayed_.top());
                continue;
            }
            auto n = std::get<2>(ready_.top());
            ready_.pop();
            n->attempts++;
            std::string tag = "[" + fmt(now) + "] " + n->id + " " + pad5(kindName(n->kind)) + " " + n->user;
            if (provider_.send(*n)) {
                std::cout << tag << " SENT (attempt " << n->attempts << "): " << n->body << "\n";
            } else if (n->attempts >= MAX_ATTEMPTS) {
                dlq.push_back(n->id);
                std::cout << tag << " FAILED " << n->attempts << " times -> DLQ\n";
            } else {
                int64_t at = now + BASE_BACKOFF * (int64_t{1} << (n->attempts - 1));
                std::cout << tag << " failed (attempt " << n->attempts << "), retry at " << fmt(at) << "\n";
                push(n, at);
            }
        }
    }

private:
    FakeProvider& provider_;
    std::unordered_map<std::string, Prefs> prefs_;
    int64_t seq_ = 0;
    MinHeap ready_, delayed_;
    std::unordered_map<std::string, int64_t> seen_;
    std::map<std::pair<std::string, Kind>, std::deque<int64_t>> sentLog_;

    void push(const std::shared_ptr<Notification>& n, int64_t readyAt) {
        ++seq_;
        if (readyAt <= now) ready_.push({static_cast<int64_t>(n->kind), seq_, n});
        else delayed_.push({readyAt, seq_, n});
    }

    // If now is inside quiet hours, return when they end, else -1.
    int64_t quietUntil(const Prefs& p) const {
        int64_t dayStart = now - now % DAY, s = now % DAY;
        bool inside = p.quietStart > p.quietEnd ? (s >= p.quietStart || s < p.quietEnd)
                                                : (s >= p.quietStart && s < p.quietEnd);
        if (!inside) return -1;
        return s < p.quietEnd ? dayStart + p.quietEnd : dayStart + DAY + p.quietEnd;
    }

    bool allowRate(const Notification& n) {
        auto it = LIMITS.find(n.kind);
        if (it == LIMITS.end()) return true;
        auto& log = sentLog_[{n.user, n.kind}];
        while (!log.empty() && log.front() <= now - it->second.second) log.pop_front();
        if (log.size() >= it->second.first) return false;
        log.push_back(now);
        return true;
    }
};

void submitAll(Dispatcher& d, const std::vector<Notification>& batch) {
    for (const auto& n : batch)
        std::cout << "submit " << n.id << " " << pad5(kindName(n.kind)) << " " << n.user << " -> " << d.submit(n) << "\n";
}

int main() {
    std::unordered_map<std::string, Prefs> prefs = {{"u1", Prefs{}}, {"u2", Prefs{}}, {"u3", Prefs{true}}};
    FakeProvider provider({{"n4", 2}, {"n2", -1}});  // n4 fails twice, n2 always fails
    Dispatcher d(provider, prefs, 10 * 3600);       // fixed clock: day 0, 10:00:00

    submitAll(d, {
        {"n1", "u1", Kind::PROMO, "Diwali sale: 50% off", "camp42:u1"},
        {"n2", "u2", Kind::PROMO, "Diwali sale: 50% off", "camp42:u2"},
        {"n3", "u3", Kind::PROMO, "Diwali sale: 50% off", "camp42:u3"},
        {"n4", "u1", Kind::TXN, "Order 881 is out for delivery", "order881:ofd"},
        {"n5", "u2", Kind::OTP, "Your OTP is 4821", "otp:u2:login:1"},
        {"n6", "u1", Kind::TXN, "Order 881 is out for delivery", "order881:ofd"},
        {"n7", "u1", Kind::PROMO, "Flash sale at 12", "camp43:u1"},
        {"n8", "u1", Kind::PROMO, "Weekend offers", "camp44:u1"},
    });
    d.run();

    d.now = 22 * 3600 + 30 * 60;  // later the same day: 22:30:00
    submitAll(d, {
        {"n9", "u2", Kind::PROMO, "Midnight deals", "camp45:u2"},
        {"n10", "u2", Kind::OTP, "Your OTP is 1937", "otp:u2:login:2"},
    });
    d.run();
    std::cout << "dead-letter queue: [";
    for (size_t i = 0; i < d.dlq.size(); ++i) std::cout << (i ? ", " : "") << d.dlq[i];
    std::cout << "]\n";
}`,
      javascript: String.raw`const Kind = Object.freeze({ OTP: 0, TXN: 1, PROMO: 2 }); // lower value = higher priority
const KIND_NAME = ["OTP", "TXN", "PROMO"];

const DAY = 86400;
const DEDUP_WINDOW = DAY; // same idempotency key within 24 h = duplicate
const MAX_ATTEMPTS = 4;
const BASE_BACKOFF = 1; // seconds: 1, 2, 4 ...
// per-user limits: [max sends, window seconds]; TXN is not limited
const LIMITS = { [Kind.OTP]: [3, 600], [Kind.PROMO]: [2, DAY] };

const pad2 = (x) => String(x).padStart(2, "0");
function fmt(t) {
  const s = t % DAY;
  return "d" + Math.floor(t / DAY) + " " + pad2(Math.floor(s / 3600)) + ":" + pad2(Math.floor((s % 3600) / 60)) + ":" + pad2(s % 60);
}

// Tiny binary min-heap ordered by (key, seq).
class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  peek() { return this.a[0]; }
  less(i, j) {
    const x = this.a[i], y = this.a[j];
    return x.key !== y.key ? x.key < y.key : x.seq < y.seq;
  }
  push(e) {
    const a = this.a;
    a.push(e);
    for (let i = a.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.less(l, m)) m = l;
        if (r < a.length && this.less(r, m)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

// Fails a notification a fixed number of times, then succeeds (-1 = always fails).
class FakeProvider {
  constructor(failPlan) { this.failPlan = failPlan; this.calls = new Map(); }
  send(n) {
    const c = (this.calls.get(n.id) || 0) + 1;
    this.calls.set(n.id, c);
    const fails = this.failPlan[n.id] || 0;
    return !(fails < 0 || c <= fails);
  }
}

const defaultPrefs = () => ({ promoOptOut: false, quietStart: 21 * 3600, quietEnd: 9 * 3600 });

class Dispatcher {
  constructor(provider, prefs, now) {
    this.provider = provider;
    this.prefs = prefs;
    this.now = now;
    this.seq = 0;
    this.ready = new MinHeap();   // key = priority
    this.delayed = new MinHeap(); // key = readyAt
    this.seen = new Map();        // idempotency key -> first seen time
    this.sentLog = new Map();     // "user|kind" -> array of send times (sliding window)
    this.dlq = [];
  }

  push(n, readyAt) {
    this.seq++;
    if (readyAt <= this.now) this.ready.push({ key: n.kind, seq: this.seq, n });
    else this.delayed.push({ key: readyAt, seq: this.seq, n });
  }

  // If now is inside quiet hours, return when they end, else -1.
  quietUntil(p) {
    const dayStart = this.now - (this.now % DAY), s = this.now % DAY;
    const inside = p.quietStart > p.quietEnd
      ? s >= p.quietStart || s < p.quietEnd
      : s >= p.quietStart && s < p.quietEnd;
    if (!inside) return -1;
    return s < p.quietEnd ? dayStart + p.quietEnd : dayStart + DAY + p.quietEnd;
  }

  allowRate(n) {
    const limit = LIMITS[n.kind];
    if (!limit) return true;
    const [maxSends, window] = limit;
    const k = n.user + "|" + n.kind;
    if (!this.sentLog.has(k)) this.sentLog.set(k, []);
    const log = this.sentLog.get(k);
    while (log.length && log[0] <= this.now - window) log.shift();
    if (log.length >= maxSends) return false;
    log.push(this.now);
    return true;
  }

  submit(n) {
    const first = this.seen.get(n.idemKey);
    if (first !== undefined && this.now - first < DEDUP_WINDOW) return "DUPLICATE";
    this.seen.set(n.idemKey, this.now);
    const p = this.prefs[n.user] || defaultPrefs();
    if (n.kind === Kind.PROMO && p.promoOptOut) return "OPTED_OUT";
    if (!this.allowRate(n)) return "RATE_LIMITED";
    if (n.kind === Kind.PROMO) {
      const until = this.quietUntil(p);
      if (until >= 0) {
        this.push(n, until);
        return "DEFERRED to " + fmt(until);
      }
    }
    this.push(n, this.now);
    return "QUEUED";
  }

  run() {
    while (this.ready.size || this.delayed.size) {
      while (this.delayed.size && this.delayed.peek().key <= this.now) {
        const e = this.delayed.pop();
        this.ready.push({ key: e.n.kind, seq: e.seq, n: e.n });
      }
      if (!this.ready.size) {
        this.now = this.delayed.peek().key; // jump the fake clock forward
        continue;
      }
      const n = this.ready.pop().n;
      n.attempts++;
      const tag = "[" + fmt(this.now) + "] " + n.id + " " + KIND_NAME[n.kind].padEnd(5) + " " + n.user;
      if (this.provider.send(n)) {
        console.log(tag + " SENT (attempt " + n.attempts + "): " + n.body);
      } else if (n.attempts >= MAX_ATTEMPTS) {
        this.dlq.push(n.id);
        console.log(tag + " FAILED " + n.attempts + " times -> DLQ");
      } else {
        const at = this.now + BASE_BACKOFF * 2 ** (n.attempts - 1);
        console.log(tag + " failed (attempt " + n.attempts + "), retry at " + fmt(at));
        this.push(n, at);
      }
    }
  }
}

const note = (id, user, kind, body, idemKey) => ({ id, user, kind, body, idemKey, attempts: 0 });
function submitAll(d, batch) {
  for (const n of batch) console.log("submit " + n.id + " " + KIND_NAME[n.kind].padEnd(5) + " " + n.user + " -> " + d.submit(n));
}

// ---- demo ----
const prefs = { u1: defaultPrefs(), u2: defaultPrefs(), u3: { ...defaultPrefs(), promoOptOut: true } };
const provider = new FakeProvider({ n4: 2, n2: -1 }); // n4 fails twice, n2 always fails
const d = new Dispatcher(provider, prefs, 10 * 3600); // fixed clock: day 0, 10:00:00

submitAll(d, [
  note("n1", "u1", Kind.PROMO, "Diwali sale: 50% off", "camp42:u1"),
  note("n2", "u2", Kind.PROMO, "Diwali sale: 50% off", "camp42:u2"),
  note("n3", "u3", Kind.PROMO, "Diwali sale: 50% off", "camp42:u3"),
  note("n4", "u1", Kind.TXN, "Order 881 is out for delivery", "order881:ofd"),
  note("n5", "u2", Kind.OTP, "Your OTP is 4821", "otp:u2:login:1"),
  note("n6", "u1", Kind.TXN, "Order 881 is out for delivery", "order881:ofd"),
  note("n7", "u1", Kind.PROMO, "Flash sale at 12", "camp43:u1"),
  note("n8", "u1", Kind.PROMO, "Weekend offers", "camp44:u1"),
]);
d.run();

d.now = 22 * 3600 + 30 * 60; // later the same day: 22:30:00
submitAll(d, [
  note("n9", "u2", Kind.PROMO, "Midnight deals", "camp45:u2"),
  note("n10", "u2", Kind.OTP, "Your OTP is 1937", "otp:u2:login:2"),
]);
d.run();
console.log("dead-letter queue: [" + d.dlq.join(", ") + "]");`,
      go: String.raw`package main

import (
	"container/heap"
	"fmt"
	"strings"
)

type Kind int

const ( // lower value = higher priority
	OTP Kind = iota
	TXN
	PROMO
)

func (k Kind) String() string { return [...]string{"OTP", "TXN", "PROMO"}[k] }

const (
	Day         = int64(86400)
	DedupWindow = Day // same idempotency key within 24 h = duplicate
	MaxAttempts = 4
	BaseBackoff = int64(1) // seconds: 1, 2, 4 ...
)

// per-user limits: {max sends, window seconds}; TXN is not limited
var limits = map[Kind][2]int64{OTP: {3, 600}, PROMO: {2, Day}}

type Notification struct {
	ID, User      string
	Kind          Kind
	Body, IdemKey string
	Attempts      int
}

type Prefs struct {
	PromoOptOut          bool
	QuietStart, QuietEnd int64 // no promotions in this window (seconds of the day)
}

func defaultPrefs() Prefs { return Prefs{QuietStart: 21 * 3600, QuietEnd: 9 * 3600} }

func fmtTime(t int64) string {
	s := t % Day
	return fmt.Sprintf("d%d %02d:%02d:%02d", t/Day, s/3600, s%3600/60, s%60)
}

// entry heap ordered by (key, seq)
type entry struct {
	key, seq int64
	n        *Notification
}
type minHeap []entry

func (h minHeap) Len() int { return len(h) }
func (h minHeap) Less(i, j int) bool {
	if h[i].key != h[j].key {
		return h[i].key < h[j].key
	}
	return h[i].seq < h[j].seq
}
func (h minHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }
func (h *minHeap) Push(x any)   { *h = append(*h, x.(entry)) }
func (h *minHeap) Pop() any {
	old := *h
	e := old[len(old)-1]
	*h = old[:len(old)-1]
	return e
}

// FakeProvider fails a notification a fixed number of times, then succeeds (-1 = always fails).
type FakeProvider struct {
	failPlan map[string]int
	calls    map[string]int
}

func (p *FakeProvider) Send(n *Notification) bool {
	p.calls[n.ID]++
	fails := p.failPlan[n.ID]
	return !(fails < 0 || p.calls[n.ID] <= fails)
}

type Dispatcher struct {
	provider       *FakeProvider
	prefs          map[string]Prefs
	Now            int64
	seq            int64
	ready, delayed minHeap
	seen           map[string]int64
	sentLog        map[string][]int64
	DLQ            []string
}

func NewDispatcher(p *FakeProvider, prefs map[string]Prefs, now int64) *Dispatcher {
	return &Dispatcher{provider: p, prefs: prefs, Now: now, seen: map[string]int64{}, sentLog: map[string][]int64{}}
}

func (d *Dispatcher) push(n *Notification, readyAt int64) {
	d.seq++
	if readyAt <= d.Now {
		heap.Push(&d.ready, entry{int64(n.Kind), d.seq, n})
	} else {
		heap.Push(&d.delayed, entry{readyAt, d.seq, n})
	}
}

// quietUntil returns when quiet hours end if now is inside them, else -1.
func (d *Dispatcher) quietUntil(p Prefs) int64 {
	dayStart, s := d.Now-d.Now%Day, d.Now%Day
	var inside bool
	if p.QuietStart > p.QuietEnd {
		inside = s >= p.QuietStart || s < p.QuietEnd
	} else {
		inside = s >= p.QuietStart && s < p.QuietEnd
	}
	if !inside {
		return -1
	}
	if s < p.QuietEnd {
		return dayStart + p.QuietEnd
	}
	return dayStart + Day + p.QuietEnd
}

func (d *Dispatcher) allowRate(n *Notification) bool {
	limit, ok := limits[n.Kind]
	if !ok {
		return true
	}
	k := n.User + "|" + n.Kind.String()
	log := d.sentLog[k]
	for len(log) > 0 && log[0] <= d.Now-limit[1] {
		log = log[1:]
	}
	if int64(len(log)) >= limit[0] {
		d.sentLog[k] = log
		return false
	}
	d.sentLog[k] = append(log, d.Now)
	return true
}

func (d *Dispatcher) Submit(n *Notification) string {
	if first, ok := d.seen[n.IdemKey]; ok && d.Now-first < DedupWindow {
		return "DUPLICATE"
	}
	d.seen[n.IdemKey] = d.Now
	p, ok := d.prefs[n.User]
	if !ok {
		p = defaultPrefs()
	}
	if n.Kind == PROMO && p.PromoOptOut {
		return "OPTED_OUT"
	}
	if !d.allowRate(n) {
		return "RATE_LIMITED"
	}
	if n.Kind == PROMO {
		if until := d.quietUntil(p); until >= 0 {
			d.push(n, until)
			return "DEFERRED to " + fmtTime(until)
		}
	}
	d.push(n, d.Now)
	return "QUEUED"
}

func (d *Dispatcher) Run() {
	for d.ready.Len() > 0 || d.delayed.Len() > 0 {
		for d.delayed.Len() > 0 && d.delayed[0].key <= d.Now {
			e := heap.Pop(&d.delayed).(entry)
			heap.Push(&d.ready, entry{int64(e.n.Kind), e.seq, e.n})
		}
		if d.ready.Len() == 0 {
			d.Now = d.delayed[0].key // jump the fake clock forward
			continue
		}
		n := heap.Pop(&d.ready).(entry).n
		n.Attempts++
		tag := fmt.Sprintf("[%s] %s %-5s %s", fmtTime(d.Now), n.ID, n.Kind, n.User)
		switch {
		case d.provider.Send(n):
			fmt.Printf("%s SENT (attempt %d): %s\n", tag, n.Attempts, n.Body)
		case n.Attempts >= MaxAttempts:
			d.DLQ = append(d.DLQ, n.ID)
			fmt.Printf("%s FAILED %d times -> DLQ\n", tag, n.Attempts)
		default:
			at := d.Now + BaseBackoff*(int64(1)<<(n.Attempts-1))
			fmt.Printf("%s failed (attempt %d), retry at %s\n", tag, n.Attempts, fmtTime(at))
			d.push(n, at)
		}
	}
}

func submitAll(d *Dispatcher, batch []*Notification) {
	for _, n := range batch {
		fmt.Printf("submit %s %-5s %s -> %s\n", n.ID, n.Kind, n.User, d.Submit(n))
	}
}

func main() {
	optOut := defaultPrefs()
	optOut.PromoOptOut = true
	prefs := map[string]Prefs{"u1": defaultPrefs(), "u2": defaultPrefs(), "u3": optOut}
	provider := &FakeProvider{failPlan: map[string]int{"n4": 2, "n2": -1}, calls: map[string]int{}} // n4 fails twice, n2 always
	d := NewDispatcher(provider, prefs, 10*3600)                                                    // fixed clock: day 0, 10:00:00

	submitAll(d, []*Notification{
		{ID: "n1", User: "u1", Kind: PROMO, Body: "Diwali sale: 50% off", IdemKey: "camp42:u1"},
		{ID: "n2", User: "u2", Kind: PROMO, Body: "Diwali sale: 50% off", IdemKey: "camp42:u2"},
		{ID: "n3", User: "u3", Kind: PROMO, Body: "Diwali sale: 50% off", IdemKey: "camp42:u3"},
		{ID: "n4", User: "u1", Kind: TXN, Body: "Order 881 is out for delivery", IdemKey: "order881:ofd"},
		{ID: "n5", User: "u2", Kind: OTP, Body: "Your OTP is 4821", IdemKey: "otp:u2:login:1"},
		{ID: "n6", User: "u1", Kind: TXN, Body: "Order 881 is out for delivery", IdemKey: "order881:ofd"},
		{ID: "n7", User: "u1", Kind: PROMO, Body: "Flash sale at 12", IdemKey: "camp43:u1"},
		{ID: "n8", User: "u1", Kind: PROMO, Body: "Weekend offers", IdemKey: "camp44:u1"},
	})
	d.Run()

	d.Now = 22*3600 + 30*60 // later the same day: 22:30:00
	submitAll(d, []*Notification{
		{ID: "n9", User: "u2", Kind: PROMO, Body: "Midnight deals", IdemKey: "camp45:u2"},
		{ID: "n10", User: "u2", Kind: OTP, Body: "Your OTP is 1937", IdemKey: "otp:u2:login:2"},
	})
	d.Run()
	fmt.Println("dead-letter queue: [" + strings.Join(d.DLQ, ", ") + "]")
}`,
    },
  },
  diagrams: {
    arch: String.raw`flowchart LR
  OS["Order service"] --> API["Notification API"]
  AS["Auth service"] --> API
  MK["Campaign service"] --> API
  API --> DD[("Redis: dedup keys")]
  API --> RT["Router"]
  RT --> PR[("Preferences + contacts cache")]
  RT --> TP["Template service"]
  RT --> SCH["Scheduler"]
  SCH --> K
  RT --> K[["Kafka: channel x priority topics"]]
  K --> PW["Push workers"]
  K --> SW["SMS workers"]
  K --> EW["Email workers"]
  K --> IW["In-app workers"]
  PW --> FCM["APNs / FCM"]
  SW --> SMS1["SMS gateway A"]
  SW -.failover.-> SMS2["SMS gateway B"]
  EW --> ES["SES / SendGrid"]
  IW --> INB[("Inbox store")]
  SW --> DLQ[["DLQ"]]
  FCM -. callbacks .-> ST["Status tracker"]
  SMS1 -. delivery reports .-> ST
  ES -. events .-> ST
  ST --> LOG[("Notification log")]
  ST --> AN[("Analytics: ClickHouse")]`,
    otp: String.raw`sequenceDiagram
  participant U as User app
  participant A as Auth service
  participant N as Notification API
  participant R as Redis
  participant K as Kafka sms.otp
  participant W as OTP SMS worker
  participant G as SMS gateway
  U->>A: login with phone
  A->>N: POST /notifications key=otp:u2:login:1
  N->>R: SET dedup key NX, check OTP rate limit
  R-->>N: ok (new key, 1 of 3)
  N->>K: publish (priority OTP)
  N-->>A: 202 notification_id
  K->>W: consume (no promo backlog here)
  W->>G: send SMS, timeout 2 s
  G-->>W: accepted, provider_msg_id
  W->>R: status SENT
  G-->>U: SMS delivered
  G-->>W: delivery report DELIVERED`,
    retry: String.raw`sequenceDiagram
  participant K as Kafka sms.txn
  participant W as SMS worker
  participant CB as Circuit breaker
  participant A as Gateway A
  participant B as Gateway B
  participant D as Delay topic
  K->>W: message attempt 1
  W->>CB: A healthy?
  CB-->>W: closed
  W->>A: send
  A-->>W: 503 timeout
  W->>D: requeue, retry in 1 s plus jitter
  D->>W: message attempt 2
  W->>CB: A healthy?
  CB-->>W: open (error rate high)
  W->>B: send via secondary
  B-->>W: accepted
  W->>K: commit, status SENT via B`,
    campaign: String.raw`flowchart LR
  C["Campaign: 50M users"] --> SEG[("Segment store")]
  SEG --> CH["Chunker: 10K users per job"]
  CH --> JQ[["Kafka: campaign jobs"]]
  JQ --> EX["Expander workers"]
  EX --> PC[("Bulk preferences lookup")]
  EX --> TH{"Rate cap per campaign"}
  TH --> PP[["push.promo"]]
  TH --> EP[["email.promo"]]
  TH --> SP[["sms.promo"]]
  PP --> PW["Push workers"]
  EP --> EW["Email workers"]
  SP --> SW["SMS workers"]`,
    lifecycle: String.raw`stateDiagram-v2
  [*] --> Queued
  Queued --> Deferred: quiet hours or send_at
  Deferred --> Queued: time reached
  Queued --> Sent: provider accepted
  Queued --> Retrying: transient error
  Retrying --> Sent: retry ok
  Retrying --> Failed: retries exhausted (DLQ)
  Queued --> Failed: permanent error
  Sent --> Delivered: DLR or device receipt
  Delivered --> Opened: user taps
  Opened --> Clicked: link click
  Failed --> [*]
  Clicked --> [*]`,
  },
});
