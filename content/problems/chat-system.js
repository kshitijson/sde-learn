SD.register({
  id: "chat-system",
  html: String.raw`
    <p class="lead">A chat system like WhatsApp looks simple: Alice types, Bob sees it. Underneath, you must keep hundreds of millions of phones connected at once, find the one server that holds Bob's connection, keep messages in order, store them safely when Bob is offline, and show the right ticks (sent, delivered, read). This page walks through the design an SDE 2 interviewer expects, with the numbers, the message flow and the hard parts.</p>

    <h2>Problem statement</h2>
    <p>Design a mobile messaging service like WhatsApp, Telegram or Signal. Users can send text and media to one person or to a group. Messages should arrive in well under a second when both people are online, and should never be lost when the receiver is offline. The sender should see whether a message was sent, delivered and read. Users can see whether a contact is online or when they were last seen.</p>

    <div class="callout tip"><strong>Try it first</strong>Spend 15 minutes before reading on. Sketch: (1) how a phone stays connected to your servers, (2) how a message from Alice reaches the exact server that holds Bob's connection, (3) where messages live while Bob's phone is switched off, and (4) how you assign an order to messages in one chat. If you can explain those four, you have the core of this design.</div>

    <details class="hint"><summary>Hint 1: the connection</summary>
      <p>HTTP request/response is client-initiated. The server needs to push to the phone at any moment. Which protocol keeps one long-lived, two-way connection open? What does that mean for your servers (stateful or stateless)?</p>
    </details>
    <details class="hint"><summary>Hint 2: finding the receiver</summary>
      <p>If you have 3,000 chat servers and Bob is connected to one of them, you need a fast lookup <code>user_id → server_id</code>. Where would you keep it, and what happens when the lookup says "nobody"?</p>
    </details>
    <details class="hint"><summary>Hint 3: order and receipts</summary>
      <p>Give every message a sequence number <em>per conversation</em>. Then "delivered up to 57" and "read up to 54" are just two numbers per user per chat, and a reconnecting phone simply asks "everything after 57".</p>
    </details>

    <h2>Requirements</h2>
    <div class="grid-2">
      <div class="card">
        <h3>Functional</h3>
        <ul>
          <li>1:1 chat: send and receive text messages.</li>
          <li>Group chat with up to ~500 members.</li>
          <li>Receipts: sent (one tick), delivered (two ticks), read (blue ticks).</li>
          <li>Presence: online indicator and "last seen at".</li>
          <li>Offline delivery: messages wait on the server and arrive when the phone reconnects; a push notification tells the user.</li>
          <li>Media: images, video, voice notes, documents.</li>
          <li>Optional: multiple devices per user (phone + web + desktop).</li>
        </ul>
      </div>
      <div class="card">
        <h3>Non-functional</h3>
        <ul>
          <li><strong>Low latency</strong>: p99 under ~300 ms end-to-end when both users are online.</li>
          <li><strong>Ordering</strong>: everyone in a chat sees messages in the same order.</li>
          <li><strong>Durability</strong>: a message acknowledged with one tick is never lost.</li>
          <li><strong>High availability</strong>: chat is a "must work" product; prefer availability for presence, consistency for message order.</li>
          <li><strong>Security</strong>: end-to-end encryption (E2E): servers relay ciphertext they cannot read.</li>
          <li><strong>Scale</strong>: 500M daily active users, 2B+ registered.</li>
        </ul>
      </div>
    </div>
    <div class="callout info"><strong>Out of scope (say it out loud)</strong>Voice/video calls, stories/status, payments, spam detection and message search. Mention them as follow-ups so the interviewer knows you thought about them.</div>

    <h2>Capacity estimation</h2>
    <p>Assumptions: <strong>500M DAU</strong>, each sends <strong>40 messages/day</strong>, average stored message ~<strong>200 bytes</strong> (100 B payload + 100 B metadata), 5% of messages carry media of ~200 KB.</p>
    <table>
      <thead><tr><th>Quantity</th><th>Arithmetic</th><th>Result</th></tr></thead>
      <tbody>
        <tr><td>Messages per day</td><td>500M × 40</td><td>20B / day</td></tr>
        <tr><td>Average write QPS</td><td>20B ÷ 86,400 s</td><td>≈ 231K msg/s</td></tr>
        <tr><td>Peak write QPS</td><td>231K × 3 (evening peak, festivals)</td><td>≈ 700K msg/s</td></tr>
        <tr><td>Text storage per day</td><td>20B × 200 B</td><td>4 TB / day</td></tr>
        <tr><td>Text storage per year (3 replicas)</td><td>4 TB × 365 × 3</td><td>≈ 4.4 PB / year</td></tr>
        <tr><td>Media per day</td><td>20B × 5% × 200 KB = 1B × 200 KB</td><td>200 TB / day</td></tr>
        <tr><td>Media ingress bandwidth</td><td>200 TB ÷ 86,400 s</td><td>≈ 2.3 GB/s ≈ 18.5 Gbps</td></tr>
        <tr><td>Concurrent connections at peak</td><td>50% of DAU online</td><td>250M sockets</td></tr>
        <tr><td>Chat servers</td><td>250M ÷ 100K sockets per server</td><td>2,500 (≈ 3,000 with headroom)</td></tr>
        <tr><td>Heartbeats</td><td>250M ÷ one every 30 s</td><td>≈ 8.3M / s</td></tr>
      </tbody>
    </table>
    <p>Three things jump out. First, text is cheap and media is expensive: 4 TB vs 200 TB a day, so media must go to object storage and a CDN, never through the chat servers. Second, 250M open sockets means the connection tier is a fleet of thousands of <em>stateful</em> servers. Third, 8.3M heartbeats a second cannot each be a database write; presence must be handled in memory on the chat server and only state <em>changes</em> written out.</p>
    <div data-widget="estimator"></div>
    <div class="callout interview"><strong>Say this in the interview</strong>"20 billion messages a day is about 230K writes per second on average and maybe 700K at peak. That is a write-heavy workload, so I want a store built for writes like Cassandra or HBase, partitioned by conversation. Media is 50× the bytes of text, so it bypasses the chat path entirely and goes to blob storage behind a CDN."</div>

    <h2>Choosing the connection</h2>
    <p>The server must push a message to Bob the moment it arrives. Plain HTTP cannot do that because only the client can start a request. The options:</p>
    <table>
      <thead><tr><th>Technique</th><th>How it works</th><th>Latency</th><th>Server cost</th><th>Verdict</th></tr></thead>
      <tbody>
        <tr><td>Short polling</td><td>Client asks "anything new?" every few seconds</td><td>Up to the poll interval</td><td>Huge: most requests return nothing; headers and TLS on every call</td><td>No</td></tr>
        <tr><td>Long polling</td><td>Client asks; server holds the request open until data arrives or ~30 s timeout, then client re-asks</td><td>Low</td><td>Medium: a new request after every message; awkward for sending</td><td>Fallback only</td></tr>
        <tr><td>Server-Sent Events</td><td>One long HTTP response that streams server → client events</td><td>Low</td><td>Low</td><td>One-way only; sends still need separate requests</td></tr>
        <tr><td><strong>WebSocket</strong></td><td>HTTP upgrade to a persistent, full-duplex TCP connection</td><td>Lowest</td><td>Low per message; memory per open socket</td><td><strong>Yes</strong></td></tr>
      </tbody>
    </table>
    <p>We use <strong>WebSocket</strong> (WhatsApp historically used a custom XMPP-like protocol over raw TCP; same idea). Each phone keeps one connection to one chat server. That makes chat servers <em>stateful</em>: a server knows which users are attached to it. Everything else (message service, group service, presence store) stays stateless.</p>

    <h2>API design</h2>
    <h3>WebSocket events (the hot path)</h3>
    <table>
      <thead><tr><th>Direction</th><th>Event</th><th>Payload (simplified)</th></tr></thead>
      <tbody>
        <tr><td>client → server</td><td><code>send_message</code></td><td><code>{client_msg_id, conversation_id, type, ciphertext, media_id?}</code></td></tr>
        <tr><td>server → client</td><td><code>message_ack</code></td><td><code>{client_msg_id, seq, server_ts}</code>: drives the single tick</td></tr>
        <tr><td>server → client</td><td><code>new_message</code></td><td><code>{conversation_id, seq, sender_id, ciphertext, server_ts}</code></td></tr>
        <tr><td>client → server</td><td><code>receipt</code></td><td><code>{conversation_id, up_to_seq, kind: DELIVERED | READ}</code></td></tr>
        <tr><td>server → client</td><td><code>receipt_update</code></td><td><code>{conversation_id, user_id, up_to_seq, kind}</code>: drives double/blue ticks</td></tr>
        <tr><td>client → server</td><td><code>sync</code></td><td><code>{cursors: [{conversation_id, last_seq}]}</code> or <code>{inbox_cursor}</code></td></tr>
        <tr><td>both</td><td><code>ping</code> / <code>pong</code></td><td>heartbeat every ~30 s</td></tr>
        <tr><td>both</td><td><code>typing</code>, <code>presence_subscribe</code>, <code>presence_update</code></td><td>ephemeral, never stored</td></tr>
      </tbody>
    </table>
    <h3>REST endpoints (cold path)</h3>
    <ul>
      <li><code>POST /v1/media</code> → returns <code>{media_id, upload_url}</code> (a pre-signed object storage URL).</li>
      <li><code>GET /v1/conversations/{id}/messages?before_seq=900&amp;limit=50</code> → scroll back through history.</li>
      <li><code>POST /v1/groups</code>, <code>POST /v1/groups/{id}/members</code>, <code>DELETE /v1/groups/{id}/members/{user_id}</code>.</li>
      <li><code>GET /v1/users/{id}/last_seen</code> (subject to privacy settings).</li>
    </ul>
    <div class="callout tip"><strong>Idempotency</strong>The client generates <code>client_msg_id</code> (a UUID) before sending. On a flaky 3G connection in a Mumbai local train the phone may resend the same message three times; the server dedupes on <code>(sender_id, client_msg_id)</code> and returns the same <code>seq</code> each time.</div>

    <h2>Data model</h2>
    <p>Messages are by far the biggest table, written 700K times a second at peak, and almost always read as "the latest N messages of one conversation". That access pattern is a perfect fit for a wide-column store such as <strong>Cassandra</strong> or <strong>HBase</strong> (Facebook Messenger used HBase; Discord uses Cassandra/ScyllaDB).</p>
    <table>
      <thead><tr><th>Table</th><th>Key</th><th>Columns</th><th>Store</th></tr></thead>
      <tbody>
        <tr><td><code>messages</code></td><td>Partition: <code>(conversation_id, bucket)</code>; clustering: <code>seq DESC</code></td><td><code>message_id, sender_id, type, ciphertext, media_id, server_ts</code></td><td>Cassandra / HBase</td></tr>
        <tr><td><code>conversation_members</code></td><td><code>conversation_id</code>, <code>user_id</code></td><td><code>role, joined_at, delivered_upto_seq, read_upto_seq</code></td><td>Cassandra (or sharded MySQL)</td></tr>
        <tr><td><code>user_conversations</code></td><td>Partition: <code>user_id</code>; clustering: <code>last_activity DESC</code></td><td><code>conversation_id, last_seq, unread_count, muted</code></td><td>Cassandra</td></tr>
        <tr><td><code>users</code></td><td><code>user_id</code></td><td><code>phone, name, avatar_url, identity_public_key, privacy</code></td><td>MySQL / Postgres (sharded)</td></tr>
        <tr><td><code>groups</code></td><td><code>group_id</code></td><td><code>name, owner_id, created_at, member_count</code></td><td>MySQL / Postgres</td></tr>
        <tr><td><code>session:{user_id}</code></td><td>key</td><td><code>{device_id: chat_server_id}</code></td><td>Redis</td></tr>
        <tr><td><code>presence:{user_id}</code></td><td>key with TTL</td><td><code>{status, last_seen}</code></td><td>Redis</td></tr>
      </tbody>
    </table>
    <ul>
      <li><strong>Why <code>conversation_id</code> as the partition key?</strong> All messages of a chat sit together on one replica set, sorted by <code>seq</code>. "Latest 50" is one sequential read. The <code>bucket</code> (e.g. month, or every 100K messages) stops a very old, very chatty group from growing one unbounded partition.</li>
      <li><strong>Time-sortable ids.</strong> <code>message_id</code> is a Snowflake-style 64-bit id (timestamp + machine + counter) so it is globally unique and roughly time-ordered. <code>seq</code> is the strict per-conversation order that clients use.</li>
      <li><strong>Receipts are watermarks, not rows.</strong> Instead of a row per message per reader, store two numbers per member: <code>delivered_upto_seq</code> and <code>read_upto_seq</code>. A message is "read" by Bob if <code>seq ≤ read_upto_seq</code>. For a 500-member group this saves 500 writes per message.</li>
      <li><strong>1:1 conversation ids</strong> are deterministic: e.g. <code>hash(min(a,b) + ":" + max(a,b))</code>, so both sides compute the same id without a lookup.</li>
    </ul>

    <h2>High-level design</h2>
    <div data-diagram="arch" data-caption="WhatsApp-style architecture: stateful chat servers hold WebSockets; everything behind them is stateless."></div>
    <ol class="steps">
      <li><strong>Chat servers (gateways)</strong> terminate WebSockets behind an L4 load balancer. They hold socket state only: who is connected here.</li>
      <li><strong>Session / presence service</strong> keeps <code>user → chat server</code> and online/last-seen in Redis.</li>
      <li><strong>Message service</strong> validates, dedupes, assigns <code>seq</code>, persists to Cassandra, then routes the message to the recipient's chat server (or to the push service if offline).</li>
      <li><strong>Queue (Kafka)</strong> decouples persistence from delivery side-effects: group fan-out, push notifications, analytics, and backups.</li>
      <li><strong>Push notification service</strong> wakes offline phones through APNs (iOS) and FCM (Android).</li>
      <li><strong>Media service</strong> hands out pre-signed URLs; encrypted blobs live in object storage (S3) and are downloaded through a CDN.</li>
      <li><strong>Group service</strong> owns membership; results are cached because every group message needs the member list.</li>
    </ol>

    <h2>Deep dive 1: 1:1 message flow and the three ticks</h2>
    <div data-diagram="send" data-caption="Alice sends to Bob: one tick on persist, two ticks on delivery, blue ticks on read."></div>
    <ol class="steps">
      <li>Alice's app shows the message with a clock icon and sends <code>send_message</code> with a fresh <code>client_msg_id</code>.</li>
      <li>Chat server A forwards it to the message service, which dedupes, assigns <code>seq = 58</code>, and writes to Cassandra with quorum.</li>
      <li>Only after the write succeeds does Alice get <code>message_ack</code>: <strong>one grey tick</strong> means "the server has it and will not lose it".</li>
      <li>The message service looks up Bob's session, finds chat server B, and forwards. B pushes <code>new_message</code> down Bob's socket.</li>
      <li>Bob's phone stores it locally and sends <code>receipt {up_to_seq: 58, DELIVERED}</code>. The server updates Bob's watermark and relays it to Alice: <strong>two grey ticks</strong>.</li>
      <li>When Bob opens the chat, his app sends <code>receipt {up_to_seq: 58, READ}</code>: <strong>blue ticks</strong>.</li>
    </ol>
    <p>Receipts are <strong>cumulative</strong> ("everything up to 58") and <strong>monotonic</strong> (status only moves SENT → DELIVERED → READ, never back). A late or duplicated DELIVERED receipt arriving after READ must be ignored. Cumulative receipts also mean one receipt can cover 40 messages Bob received in one burst, cutting receipt traffic a lot.</p>

    <h3>Core algorithm: per-conversation store with receipts and sync</h3>
    <p>The code below is the heart of the message service, in memory: it assigns monotonically increasing sequence numbers per conversation, applies cumulative receipts that never move backwards, and answers "give me everything after seq N" for a reconnecting phone. Because receipts are cumulative, older messages always have a status at least as advanced as newer ones, so applying a receipt walks backwards and stops at the first message already updated: each status change happens once, giving amortised O(1) per message.</p>
    <div data-code="store"></div>

    <h2>Deep dive 2: routing to the right chat server</h2>
    <p>With ~3,000 chat servers, Alice and Bob are almost never on the same one. Three common approaches:</p>
    <div class="tabs">
      <section data-tab="Session registry + direct RPC">
        <p>On connect, chat server B writes <code>session:bob = {phone: "chat-b-17"}</code> to Redis (with a TTL refreshed by heartbeats). The message service reads it and calls <code>chat-b-17</code> over gRPC. Simple and low-latency. If the lookup is empty, Bob is offline: go to the push path.</p>
      </section>
      <section data-tab="Per-server queue">
        <p>Each chat server subscribes to its own topic or Redis pub/sub channel (<code>inbox.chat-b-17</code>). The message service publishes there instead of calling directly. This absorbs short spikes and lets a restarting server catch up, at the cost of one extra hop.</p>
      </section>
      <section data-tab="Consistent hashing">
        <p>Route users to chat servers by <code>hash(user_id)</code> on a hash ring, so "where is Bob" is a computation, not a lookup. It breaks down when a client reconnects through a different region, and rebalancing moves many live sockets, so most real systems still keep a registry.</p>
      </section>
    </div>
    <p>A routing race is normal: Bob may disconnect a millisecond after the lookup. That is fine, because the message is already persisted. If forwarding fails, we treat Bob as offline; when he reconnects, sync picks the message up. <mark>Persist first, deliver second</mark> is what makes the design safe.</p>
    <div class="callout interview"><strong>Say this in the interview</strong>"Chat servers are the only stateful tier. I keep a session map in Redis from user to chat server. Delivery is best-effort on top of a durable log: if the push to the socket fails or the user is offline, nothing is lost, because the message is already in Cassandra and the client will sync from its last sequence number."</div>

    <h2>Deep dive 3: ordering and message ids</h2>
    <p>Clocks on phones are wrong, and clocks on servers drift by milliseconds. Ordering by client timestamp shows replies above questions. We need a server-assigned order <em>per conversation</em>; global order across all chats is unnecessary and very expensive.</p>
    <table>
      <thead><tr><th>Approach</th><th>How</th><th>Pros</th><th>Cons</th></tr></thead>
      <tbody>
        <tr><td>Single writer per conversation</td><td>Kafka partition by <code>conversation_id</code>; one consumer owns a conversation and increments its counter</td><td>Strict, gap-free order; no coordination</td><td>Hot groups bottleneck on one partition; failover must restore the counter</td></tr>
        <tr><td>Atomic counter</td><td><code>INCR seq:{conversation_id}</code> in Redis, or a lightweight transaction in the DB</td><td>Simple</td><td>Extra network hop per message; counter store must be durable</td></tr>
        <tr><td>Snowflake ids</td><td>Timestamp + machine id + counter</td><td>No coordination at all; globally unique</td><td>Only roughly ordered across machines; not gap-free, so "missing message" detection is harder</td></tr>
      </tbody>
    </table>
    <p>A good answer combines them: a <strong>Snowflake <code>message_id</code></strong> as the primary identity, plus a <strong>per-conversation <code>seq</code></strong> assigned by the single owner of that conversation. Gap-free <code>seq</code> lets the client notice "I have 55 and 57, so 56 is missing" and ask for it. Within one sender, the client sends in order and waits for acks (or pipelines with <code>client_msg_id</code>), so Alice's own messages never reorder.</p>

    <h2>Deep dive 4: offline delivery and sync on reconnect</h2>
    <p>Phones go offline constantly: lifts, metro tunnels, the OS killing background apps. The design treats every client as "occasionally connected".</p>
    <div data-diagram="sync" data-caption="Bob was offline: push notification, then reconnect and sync from his last seq."></div>
    <ul>
      <li><strong>Push notification.</strong> If Bob has no session, the message service publishes to the push service, which calls APNs/FCM. With E2E encryption the notification carries no plaintext; it just wakes the app, which connects and syncs.</li>
      <li><strong>Sync by cursor.</strong> The phone remembers the last <code>seq</code> it stored per conversation. On reconnect it sends those cursors and receives everything newer, in pages of ~100. This is exactly the <code>syncSince</code> function in the code above.</li>
      <li><strong>Per-user inbox (optimisation).</strong> Sending 300 cursors on every reconnect is wasteful. Many systems also keep a per-user inbox stream with its own sequence: every message for Bob, from any chat, gets an inbox entry. Reconnect is then one call: "inbox entries after 81,234".</li>
      <li><strong>Retention.</strong> WhatsApp historically deleted messages from servers once delivered to all devices (store-and-forward), which keeps storage small. Telegram and Messenger keep history on the server for multi-device sync. Say which one you pick and why.</li>
    </ul>
    <div class="callout warn"><strong>Pitfall</strong>Do not mark a message DELIVERED when the server writes it to the socket. Mark it when the <em>device</em> acknowledges it. A socket write can succeed into a buffer while the phone has already lost signal.</div>

    <h2>Deep dive 5: group chat fan-out</h2>
    <p>A group message must reach up to 500 members. Two options:</p>
    <div class="grid-2">
      <div class="card good"><strong>Store once, fan out deliveries</strong><p>Write the message once to the group's partition. Fan out only lightweight <em>delivery events</em>: a socket push for online members and a push notification for offline ones. Each member syncs from the group partition by <code>seq</code>. Storage cost: 1 write.</p></div>
      <div class="card"><strong>Fan out to each member's inbox</strong><p>Copy the message (or a pointer) into each member's inbox. Reads are trivial, but a 500-member group costs 500 writes per message. Fine with pointers; wasteful with full bodies.</p></div>
    </div>
    <div data-diagram="group" data-caption="Group message: persist once, then fan out delivery events via Kafka workers."></div>
    <ul>
      <li>Fan-out runs asynchronously in workers reading from Kafka, so the sender gets the one-tick ack after a single write, not after 500 deliveries.</li>
      <li>Workers batch by chat server: if 40 members of the group sit on <code>chat-b-17</code>, send one RPC with 40 recipients.</li>
      <li>The member list is read from a cache (group service), invalidated on join/leave.</li>
      <li><strong>Receipts in groups</strong> use the same watermarks. "Read by everyone" for message 900 means <code>min(read_upto_seq)</code> across members is at least 900. Senders see a "message info" screen computed on demand, not pushed for every member.</li>
      <li><strong>E2E in groups</strong>: the Signal protocol's <em>sender keys</em> let a sender encrypt once for the group instead of 500 times; the server still just relays ciphertext.</li>
    </ul>
    <p>Rough cost: if 10% of the 20B daily messages are group messages with 50 members on average, that is 2B × 50 = 100B delivery events a day, about 1.16M per second. This is why fan-out is a separate, horizontally scaled worker tier.</p>

    <h2>Deep dive 6: presence and last seen</h2>
    <ul>
      <li><strong>Heartbeats.</strong> The app sends <code>ping</code> every ~30 s on the existing WebSocket. The chat server tracks it in memory. If no heartbeat arrives for ~2 intervals, the user is considered offline.</li>
      <li><strong>Write only transitions.</strong> At 8.3M heartbeats a second, the chat server must not write each one to Redis. It writes <code>presence:{user}</code> only when the state changes (online → offline), and stores <code>last_seen</code> on disconnect. A TTL on the key cleans up if the chat server itself crashes.</li>
      <li><strong>Fan out lazily.</strong> Pushing "Alice is online" to all her 400 contacts on every app open is a storm. Instead, Bob's app <em>subscribes</em> to Alice's presence only while he has her chat open. Only subscribers get updates.</li>
      <li><strong>Debounce.</strong> On a flaky network the app flips online/offline every few seconds. Delay the "offline" transition by ~10–20 s so contacts do not see flicker.</li>
      <li><strong>Availability over consistency.</strong> Presence that is 5 seconds stale is fine. Never let presence failures block messaging.</li>
    </ul>

    <h2>Scaling &amp; bottlenecks</h2>
    <h3>Scaling WebSocket servers</h3>
    <ul>
      <li><strong>Memory per socket.</strong> Roughly 10–30 KB of kernel buffers and app state each. 100K sockets × 20 KB ≈ 2 GB per server, so memory is fine; tune file-descriptor limits and the TCP stack. (WhatsApp famously held ~2M connections per Erlang server.)</li>
      <li><strong>L4 load balancer.</strong> Balance at TCP level, by least connections. Once a socket is placed it stays there; there is no per-message balancing.</li>
      <li><strong>Deploys.</strong> A restart drops 100K users. Drain gradually: stop accepting new sockets, then close existing ones in small batches over several minutes, with a "reconnect" hint.</li>
      <li><strong>Reconnect storms.</strong> If a whole data centre blips, 50M phones reconnect at once, hammering auth, the session store and sync. Defences: client <strong>exponential backoff with jitter</strong>, admission control (rate limit new connections per server), cheap token-based resume so reconnect skips full login, and sync that is paginated and deprioritised behind live traffic.</li>
      <li><strong>Separate concerns.</strong> Keep chat servers thin (sockets + routing only). Business logic lives in stateless services that scale independently.</li>
    </ul>
    <h3>Other hot spots</h3>
    <ul>
      <li><strong>Hot groups.</strong> A 500-member group during an IPL final can hit thousands of messages a minute on one partition. Bucketing and a single-writer per conversation keep it manageable; limits on group size do the rest.</li>
      <li><strong>Multi-device.</strong> <code>session:{user}</code> becomes a map of devices. Deliver to every device; each device has its own cursor. With E2E, each device has its own keys, so the sender encrypts once per device.</li>
      <li><strong>Multi-region.</strong> Users connect to the nearest region. Conversations have a home region for ordering; cross-region delivery goes over a replicated queue.</li>
    </ul>

    <h2>Trade-offs</h2>
    <table>
      <thead><tr><th>Decision</th><th>Choice</th><th>What we give up</th></tr></thead>
      <tbody>
        <tr><td>Transport</td><td>WebSocket</td><td>Stateful servers, careful deploys, reconnect handling</td></tr>
        <tr><td>Message store</td><td>Cassandra/HBase by conversation</td><td>No ad-hoc queries or joins; cross-conversation search needs a separate index</td></tr>
        <tr><td>Ordering</td><td>Per-conversation <code>seq</code> from a single owner</td><td>No global order (not needed); hot conversations have one bottleneck</td></tr>
        <tr><td>Receipts</td><td>Cumulative watermarks</td><td>Cannot express "read 58 but not 57", which users do not need</td></tr>
        <tr><td>Group fan-out</td><td>Store once, fan out events</td><td>Members read from a shared partition; large groups need limits</td></tr>
        <tr><td>Presence</td><td>Eventually consistent, subscribe on demand</td><td>"Online" can be a few seconds stale</td></tr>
        <tr><td>Retention</td><td>Store-and-forward vs keep history</td><td>Smaller storage and better privacy vs easy multi-device history</td></tr>
        <tr><td>E2E encryption</td><td>Server relays ciphertext</td><td>No server-side search, moderation or previews in notifications</td></tr>
      </tbody>
    </table>

    <h2>Follow-up questions</h2>
    <div class="quiz">
      <details><summary>Why not order messages by the timestamp the phone sends?</summary><div>Phone clocks are wrong or deliberately changed, and two phones disagree. If Alice's clock runs 2 minutes fast, her reply appears above Bob's question. The server assigns a per-conversation <code>seq</code>; client time is only used for display.</div></details>
      <details><summary>Alice's message got one tick but Bob's chat server crashed before delivering it. Is it lost?</summary><div>No. One tick is only sent after the message is durably written. Bob's phone notices the dropped socket, reconnects to another chat server, and syncs everything after its last stored <code>seq</code>. The message arrives then, and the delivered receipt flows back to Alice.</div></details>
      <details><summary>How do you avoid duplicates when the client retries a send?</summary><div>The client attaches a <code>client_msg_id</code> (UUID). The message service keeps a short-lived dedupe record of <code>(sender, client_msg_id) → seq</code>, and a retry returns the original <code>seq</code> instead of creating a new message. Receivers also dedupe by <code>seq</code>.</div></details>
      <details><summary>How would you show "last seen" without hammering the database?</summary><div>Heartbeats stay in the chat server's memory. Only transitions are written to Redis (with a TTL), and <code>last_seen</code> is written on disconnect. Contacts get presence updates only while subscribed (chat open), and offline transitions are debounced.</div></details>
      <details><summary>What changes for a 100,000-member broadcast channel?</summary><div>It becomes a feed problem, not a chat problem: store the post once, do not track per-member delivery receipts, and let members pull on open (fan-out on read), with push notifications batched and rate-limited. See the news feed problem.</div></details>
      <details><summary>How would you support message search with E2E encryption?</summary><div>The server cannot read messages, so search must run on the device over its local database (WhatsApp does this). Without E2E you could index into Elasticsearch partitioned by user.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>Use <strong>WebSockets</strong> on a fleet of stateful chat servers; keep everything behind them stateless.</li>
      <li>A Redis <strong>session registry</strong> maps user → chat server; no session means offline → push notification.</li>
      <li><strong>Persist first, deliver second.</strong> One tick means durable; delivery is best-effort with sync as the safety net.</li>
      <li>Order with a server-assigned <strong>per-conversation sequence</strong>; partition messages by <code>conversation_id</code> in Cassandra/HBase.</li>
      <li>Receipts are <strong>cumulative, monotonic watermarks</strong>: SENT → DELIVERED → READ, never backwards.</li>
      <li>Groups: <strong>store once, fan out events</strong> through queue-driven workers.</li>
      <li>Presence: heartbeats in memory, write only transitions, subscribe on demand.</li>
      <li>Plan for <strong>reconnect storms</strong>: backoff with jitter, admission control, paginated sync.</li>
    </ul></div>
  `,
  code: {
    store: {
      title: "Per-conversation message store with receipts and sync",
      java: String.raw`import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class Chat {
    enum Status { SENT, DELIVERED, READ } // declaration order = progress order

    static final class Message {
        final String conversationId;
        final long seq; // 1, 2, 3 ... per conversation
        final String senderId;
        final String text;
        Status status = Status.SENT;

        Message(String conversationId, long seq, String senderId, String text) {
            this.conversationId = conversationId;
            this.seq = seq;
            this.senderId = senderId;
            this.text = text;
        }

        @Override
        public String toString() {
            return "#" + seq + " '" + text + "' [" + status + "]";
        }
    }

    /** In-memory, per-conversation message log with receipts and sync. */
    static final class MessageStore {
        private final Map<String, List<Message>> convs = new HashMap<>(); // log.get(i).seq == i + 1

        Message send(String convId, String senderId, String text) {
            List<Message> log = convs.computeIfAbsent(convId, k -> new ArrayList<>());
            Message m = new Message(convId, log.size() + 1, senderId, text);
            log.add(m);
            return m;
        }

        int markDelivered(String convId, long upToSeq) { return advanceUpTo(convId, upToSeq, Status.DELIVERED); }

        int markRead(String convId, long upToSeq) { return advanceUpTo(convId, upToSeq, Status.READ); }

        /** Messages with seq > lastSeenSeq, oldest first. */
        List<Message> syncSince(String convId, long lastSeenSeq, int limit) {
            List<Message> log = convs.getOrDefault(convId, Collections.emptyList());
            int start = (int) Math.max(lastSeenSeq, 0);
            if (start >= log.size()) return Collections.emptyList();
            int end = Math.min(start + limit, log.size());
            return new ArrayList<>(log.subList(start, end));
        }

        // Cumulative ack: every message with seq <= upToSeq becomes at least target.
        // Older messages always have status >= newer ones, so walk backwards and stop
        // at the first message that is already there. Status never moves backwards.
        private int advanceUpTo(String convId, long upToSeq, Status target) {
            List<Message> log = convs.get(convId);
            if (log == null) return 0;
            int changed = 0;
            for (int i = (int) Math.min(upToSeq, log.size()) - 1;
                 i >= 0 && log.get(i).status.compareTo(target) < 0; i--) {
                log.get(i).status = target;
                changed++;
            }
            return changed;
        }
    }

    static String show(List<Message> msgs) {
        return msgs.stream().map(Message::toString).collect(Collectors.joining(", "));
    }

    public static void main(String[] args) {
        MessageStore store = new MessageStore();
        String chat = "alice:bob";
        for (String t : List.of("hi", "lunch at 1?", "the usual place")) store.send(chat, "alice", t);

        List<Message> batch = store.syncSince(chat, 0, 100);
        System.out.println("bob syncs: " + show(batch));
        System.out.println("delivered acks: " + store.markDelivered(chat, batch.get(batch.size() - 1).seq));
        System.out.println("read acks: " + store.markRead(chat, 2));
        System.out.println("late delivered ack changed: " + store.markDelivered(chat, 2));
        System.out.println("state: " + show(store.syncSince(chat, 0, 100)));

        store.send(chat, "alice", "are you coming?");
        store.send(chat, "alice", "ok see you there");
        List<Message> missed = store.syncSince(chat, 3, 100);
        System.out.println("bob reconnects, missed: " + show(missed));
        long last = missed.get(missed.size() - 1).seq;
        store.markDelivered(chat, last);
        store.markRead(chat, last);
        System.out.println("final: " + show(store.syncSince(chat, 0, 100)));
    }
}`,
      python: String.raw`from dataclasses import dataclass
from enum import IntEnum


class Status(IntEnum):
    SENT = 1
    DELIVERED = 2
    READ = 3


@dataclass
class Message:
    conversation_id: str
    seq: int          # 1, 2, 3 ... per conversation
    sender_id: str
    text: str
    status: Status = Status.SENT


class Conversation:
    def __init__(self):
        self.messages = []  # messages[i].seq == i + 1

    def next_seq(self):
        return len(self.messages) + 1


class MessageStore:
    """In-memory, per-conversation message log with receipts and sync."""

    def __init__(self):
        self._convs = {}

    def _conv(self, conversation_id):
        return self._convs.setdefault(conversation_id, Conversation())

    def send(self, conversation_id, sender_id, text):
        conv = self._conv(conversation_id)
        msg = Message(conversation_id, conv.next_seq(), sender_id, text)
        conv.messages.append(msg)
        return msg

    def _advance_up_to(self, conversation_id, up_to_seq, target):
        """Cumulative ack: every message with seq <= up_to_seq becomes at least
        target. Status never moves backwards. Because acks are cumulative,
        older messages always have status >= newer ones, so we walk backwards
        and stop at the first message that is already there."""
        conv = self._convs.get(conversation_id)
        if conv is None:
            return 0
        changed = 0
        i = min(up_to_seq, len(conv.messages)) - 1
        while i >= 0 and conv.messages[i].status < target:
            conv.messages[i].status = target
            changed += 1
            i -= 1
        return changed

    def mark_delivered(self, conversation_id, up_to_seq):
        return self._advance_up_to(conversation_id, up_to_seq, Status.DELIVERED)

    def mark_read(self, conversation_id, up_to_seq):
        return self._advance_up_to(conversation_id, up_to_seq, Status.READ)

    def sync_since(self, conversation_id, last_seen_seq, limit=100):
        """Messages with seq > last_seen_seq, oldest first."""
        conv = self._convs.get(conversation_id)
        if conv is None:
            return []
        start = max(last_seen_seq, 0)
        return conv.messages[start:start + limit]


def show(msgs):
    return ", ".join(f"#{m.seq} {m.text!r} [{m.status.name}]" for m in msgs)


if __name__ == "__main__":
    store = MessageStore()
    chat = "alice:bob"

    for text in ["hi", "lunch at 1?", "the usual place"]:
        store.send(chat, "alice", text)

    # Bob's phone connects for the first time: sync everything after seq 0.
    batch = store.sync_since(chat, 0)
    print("bob syncs:", show(batch))
    print("delivered acks:", store.mark_delivered(chat, batch[-1].seq))

    # Bob opens the chat and reads up to message 2.
    print("read acks:", store.mark_read(chat, 2))
    # A late, duplicate DELIVERED ack must not undo READ.
    print("late delivered ack changed:", store.mark_delivered(chat, 2))
    print("state:", show(store.sync_since(chat, 0)))

    # Bob goes offline (last seen seq = 3); Alice keeps typing.
    store.send(chat, "alice", "are you coming?")
    store.send(chat, "alice", "ok see you there")

    missed = store.sync_since(chat, 3)
    print("bob reconnects, missed:", show(missed))
    store.mark_delivered(chat, missed[-1].seq)
    store.mark_read(chat, missed[-1].seq)
    print("final:", show(store.sync_since(chat, 0)))`,
      cpp: String.raw`#include <algorithm>
#include <cstdint>
#include <iostream>
#include <string>
#include <unordered_map>
#include <vector>

enum class Status { SENT = 1, DELIVERED = 2, READ = 3 };

const char* name(Status s) {
    switch (s) {
        case Status::SENT: return "SENT";
        case Status::DELIVERED: return "DELIVERED";
        default: return "READ";
    }
}

struct Message {
    std::string conversationId;
    int64_t seq;  // 1, 2, 3 ... per conversation
    std::string senderId;
    std::string text;
    Status status = Status::SENT;
};

class MessageStore {
public:
    Message send(const std::string& convId, const std::string& senderId, const std::string& text) {
        auto& log = convs_[convId];
        log.push_back(Message{convId, static_cast<int64_t>(log.size()) + 1, senderId, text});
        return log.back();
    }

    int markDelivered(const std::string& convId, int64_t upTo) { return advanceUpTo(convId, upTo, Status::DELIVERED); }
    int markRead(const std::string& convId, int64_t upTo) { return advanceUpTo(convId, upTo, Status::READ); }

    // Messages with seq > lastSeen, oldest first (copies, like a network response).
    std::vector<Message> syncSince(const std::string& convId, int64_t lastSeen, size_t limit = 100) const {
        auto it = convs_.find(convId);
        if (it == convs_.end()) return {};
        const auto& log = it->second;
        size_t start = static_cast<size_t>(std::max<int64_t>(lastSeen, 0));
        if (start >= log.size()) return {};
        size_t end = std::min(start + limit, log.size());
        return std::vector<Message>(log.begin() + start, log.begin() + end);
    }

private:
    std::unordered_map<std::string, std::vector<Message>> convs_;  // log[i].seq == i + 1

    // Cumulative ack: every message with seq <= upTo becomes at least target.
    // Older messages always have status >= newer ones, so walk backwards and
    // stop at the first message that is already there. Never moves backwards.
    int advanceUpTo(const std::string& convId, int64_t upTo, Status target) {
        auto it = convs_.find(convId);
        if (it == convs_.end()) return 0;
        auto& log = it->second;
        int changed = 0;
        for (int64_t i = std::min<int64_t>(upTo, log.size()) - 1; i >= 0 && log[i].status < target; --i) {
            log[i].status = target;
            ++changed;
        }
        return changed;
    }
};

std::string show(const std::vector<Message>& msgs) {
    std::string out;
    for (const auto& m : msgs) {
        if (!out.empty()) out += ", ";
        out += "#" + std::to_string(m.seq) + " '" + m.text + "' [" + name(m.status) + "]";
    }
    return out;
}

int main() {
    MessageStore store;
    const std::string chat = "alice:bob";
    for (const char* t : {"hi", "lunch at 1?", "the usual place"}) store.send(chat, "alice", t);

    auto batch = store.syncSince(chat, 0);
    std::cout << "bob syncs: " << show(batch) << "\n";
    std::cout << "delivered acks: " << store.markDelivered(chat, batch.back().seq) << "\n";
    std::cout << "read acks: " << store.markRead(chat, 2) << "\n";
    std::cout << "late delivered ack changed: " << store.markDelivered(chat, 2) << "\n";
    std::cout << "state: " << show(store.syncSince(chat, 0)) << "\n";

    store.send(chat, "alice", "are you coming?");
    store.send(chat, "alice", "ok see you there");
    auto missed = store.syncSince(chat, 3);
    std::cout << "bob reconnects, missed: " << show(missed) << "\n";
    store.markDelivered(chat, missed.back().seq);
    store.markRead(chat, missed.back().seq);
    std::cout << "final: " << show(store.syncSince(chat, 0)) << "\n";
}`,
      javascript: String.raw`const Status = Object.freeze({ SENT: 1, DELIVERED: 2, READ: 3 });
const STATUS_NAME = { 1: "SENT", 2: "DELIVERED", 3: "READ" };

class MessageStore {
  constructor() {
    this.convs = new Map(); // conversationId -> array of messages (messages[i].seq === i + 1)
  }

  send(conversationId, senderId, text) {
    if (!this.convs.has(conversationId)) this.convs.set(conversationId, []);
    const log = this.convs.get(conversationId);
    const msg = { conversationId, seq: log.length + 1, senderId, text, status: Status.SENT };
    log.push(msg);
    return msg;
  }

  // Cumulative ack: every message with seq <= upToSeq becomes at least target.
  // Older messages always have status >= newer ones, so walk backwards and stop
  // at the first message that is already there. Status never moves backwards.
  advanceUpTo(conversationId, upToSeq, target) {
    const log = this.convs.get(conversationId);
    if (!log) return 0;
    let changed = 0;
    for (let i = Math.min(upToSeq, log.length) - 1; i >= 0 && log[i].status < target; i--) {
      log[i].status = target;
      changed++;
    }
    return changed;
  }

  markDelivered(conversationId, upToSeq) {
    return this.advanceUpTo(conversationId, upToSeq, Status.DELIVERED);
  }

  markRead(conversationId, upToSeq) {
    return this.advanceUpTo(conversationId, upToSeq, Status.READ);
  }

  // Messages with seq > lastSeenSeq, oldest first.
  syncSince(conversationId, lastSeenSeq, limit = 100) {
    const log = this.convs.get(conversationId) || [];
    const start = Math.max(lastSeenSeq, 0);
    return log.slice(start, start + limit);
  }
}

const show = (msgs) =>
  msgs.map((m) => "#" + m.seq + " '" + m.text + "' [" + STATUS_NAME[m.status] + "]").join(", ");

// ---- demo ----
const store = new MessageStore();
const chat = "alice:bob";
for (const t of ["hi", "lunch at 1?", "the usual place"]) store.send(chat, "alice", t);

const batch = store.syncSince(chat, 0);
console.log("bob syncs:", show(batch));
console.log("delivered acks:", store.markDelivered(chat, batch[batch.length - 1].seq));
console.log("read acks:", store.markRead(chat, 2));
console.log("late delivered ack changed:", store.markDelivered(chat, 2));
console.log("state:", show(store.syncSince(chat, 0)));

store.send(chat, "alice", "are you coming?");
store.send(chat, "alice", "ok see you there");
const missed = store.syncSince(chat, 3);
console.log("bob reconnects, missed:", show(missed));
store.markDelivered(chat, missed[missed.length - 1].seq);
store.markRead(chat, missed[missed.length - 1].seq);
console.log("final:", show(store.syncSince(chat, 0)));`,
      go: String.raw`package main

import (
	"fmt"
	"strings"
)

type Status int

const (
	Sent Status = iota + 1
	Delivered
	Read
)

func (s Status) String() string {
	return [...]string{"", "SENT", "DELIVERED", "READ"}[s]
}

type Message struct {
	ConversationID string
	Seq            int64 // 1, 2, 3 ... per conversation
	SenderID       string
	Text           string
	Status         Status
}

// MessageStore is an in-memory, per-conversation message log.
type MessageStore struct {
	convs map[string][]*Message // messages[i].Seq == i+1
}

func NewMessageStore() *MessageStore {
	return &MessageStore{convs: make(map[string][]*Message)}
}

func (s *MessageStore) Send(convID, senderID, text string) *Message {
	log := s.convs[convID]
	m := &Message{ConversationID: convID, Seq: int64(len(log)) + 1, SenderID: senderID, Text: text, Status: Sent}
	s.convs[convID] = append(log, m)
	return m
}

// advanceUpTo is a cumulative ack: every message with seq <= upTo becomes at
// least target. Older messages always have status >= newer ones, so walk
// backwards and stop at the first one already there. Never moves backwards.
func (s *MessageStore) advanceUpTo(convID string, upTo int64, target Status) int {
	log := s.convs[convID]
	changed := 0
	i := int(min(upTo, int64(len(log)))) - 1
	for ; i >= 0 && log[i].Status < target; i-- {
		log[i].Status = target
		changed++
	}
	return changed
}

func (s *MessageStore) MarkDelivered(convID string, upTo int64) int {
	return s.advanceUpTo(convID, upTo, Delivered)
}

func (s *MessageStore) MarkRead(convID string, upTo int64) int {
	return s.advanceUpTo(convID, upTo, Read)
}

// SyncSince returns messages with seq > lastSeen, oldest first.
func (s *MessageStore) SyncSince(convID string, lastSeen int64, limit int) []*Message {
	log := s.convs[convID]
	start := int(max(lastSeen, 0))
	if start >= len(log) {
		return nil
	}
	end := min(start+limit, len(log))
	return log[start:end]
}

func show(msgs []*Message) string {
	parts := make([]string, 0, len(msgs))
	for _, m := range msgs {
		parts = append(parts, fmt.Sprintf("#%d %q [%s]", m.Seq, m.Text, m.Status))
	}
	return strings.Join(parts, ", ")
}

func main() {
	store := NewMessageStore()
	chat := "alice:bob"
	for _, t := range []string{"hi", "lunch at 1?", "the usual place"} {
		store.Send(chat, "alice", t)
	}

	batch := store.SyncSince(chat, 0, 100)
	fmt.Println("bob syncs:", show(batch))
	fmt.Println("delivered acks:", store.MarkDelivered(chat, batch[len(batch)-1].Seq))
	fmt.Println("read acks:", store.MarkRead(chat, 2))
	fmt.Println("late delivered ack changed:", store.MarkDelivered(chat, 2))
	fmt.Println("state:", show(store.SyncSince(chat, 0, 100)))

	store.Send(chat, "alice", "are you coming?")
	store.Send(chat, "alice", "ok see you there")
	missed := store.SyncSince(chat, 3, 100)
	fmt.Println("bob reconnects, missed:", show(missed))
	last := missed[len(missed)-1].Seq
	store.MarkDelivered(chat, last)
	store.MarkRead(chat, last)
	fmt.Println("final:", show(store.SyncSince(chat, 0, 100)))
}`,
    },
  },
  diagrams: {
    arch: String.raw`flowchart LR
  A[Alice phone] -- WebSocket --> LB["L4 load balancer"]
  B[Bob phone] -- WebSocket --> LB
  LB --> CS1["Chat server A"]
  LB --> CS2["Chat server B"]
  CS1 --> MS["Message service"]
  CS2 --> MS
  CS1 -. heartbeats .-> PS["Session and presence service"]
  CS2 -. heartbeats .-> PS
  PS --> R[("Redis: sessions, presence")]
  MS --> DB[("Cassandra: messages")]
  MS --> GS["Group service"]
  MS --> K[["Kafka"]]
  K --> FW["Fan-out workers"]
  K --> PN["Push notification service"]
  FW --> CS2
  PN --> APNS["APNs / FCM"]
  A -. media upload .-> OS[("Object storage")]
  OS --> CDN["CDN"]
  CDN -. media download .-> B`,
    send: String.raw`sequenceDiagram
  participant A as Alice
  participant CA as Chat server A
  participant M as Message service
  participant DB as Cassandra
  participant R as Session store
  participant CB as Chat server B
  participant B as Bob
  A->>CA: send_message client_msg_id=u1
  CA->>M: forward
  M->>DB: write seq 58 (quorum)
  DB-->>M: ok
  M-->>CA: ack seq 58
  CA-->>A: message_ack (one tick)
  M->>R: where is Bob?
  R-->>M: chat server B
  M->>CB: deliver seq 58
  CB->>B: new_message seq 58
  B->>CB: receipt DELIVERED up to 58
  CB->>M: update delivered watermark
  M->>CA: receipt_update
  CA-->>A: two grey ticks
  B->>CB: receipt READ up to 58
  CB->>M: update read watermark
  M->>CA: receipt_update
  CA-->>A: blue ticks`,
    sync: String.raw`sequenceDiagram
  participant A as Alice
  participant M as Message service
  participant R as Session store
  participant P as Push service
  participant B as Bob phone
  participant CB as Chat server B
  A->>M: send seq 59, 60
  M->>R: where is Bob?
  R-->>M: no session (offline)
  M->>P: notify Bob
  P->>B: APNs/FCM wake-up (no plaintext)
  B->>CB: connect + auth token
  CB->>R: session Bob = chat server B
  B->>CB: sync last_seq=58
  CB->>M: messages after 58
  M-->>CB: seq 59, 60
  CB-->>B: new_message batch
  B->>CB: receipt DELIVERED up to 60
  CB->>M: update watermark, notify Alice`,
    group: String.raw`flowchart LR
  S[Sender] --> CS["Chat server"]
  CS --> MS["Message service"]
  MS --> DB[("Group partition in Cassandra")]
  MS --> K[["Kafka: group_messages"]]
  K --> W["Fan-out worker"]
  W --> GC["Group member cache"]
  W --> SR["Session store"]
  W -->|"online, batched"| C1["Chat server 1"]
  W -->|online| C2["Chat server 2"]
  W -->|offline| PN["Push service"]`,
  },
});
