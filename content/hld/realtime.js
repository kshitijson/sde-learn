SD.register({
  id: "realtime",
  html: String.raw`
    <p class="lead">Plain HTTP is request-response: the client asks, the server answers, done. But a chat message, a cricket score, a delivery partner moving on a map or a stock price all start on the <em>server</em>, and the client needs to know now. There are four main ways to get server updates to a browser or app: <strong>short polling</strong> (ask again and again), <strong>long polling</strong> (ask and wait), <strong>Server-Sent Events</strong> (a one-way stream from server to client) and <strong>WebSockets</strong> (a full two-way pipe). Picking the right one, and knowing how to hold millions of open connections, is a standard interview topic.</p>

    <h2>The problem: the server cannot call the browser</h2>
    <p>A browser or mobile app sits behind NAT routers and firewalls and has no public address the server can dial. So every technique starts with the <strong>client opening a connection</strong>. The question is what happens on that connection: does it close after one answer, stay open waiting for one answer, or stay open for a stream of messages?</p>
    <p>Play with the timeline below. The same stream of server events is delivered with each technique. Watch how many requests each one makes and how long each event waits before the client sees it.</p>
    <div data-widget="polling"></div>

    <h2>Short polling</h2>
    <p>The client sends a normal HTTP request every N seconds: "any new messages?" The server answers immediately, usually with "no".</p>
    <ul>
      <li><strong>Latency</strong>: an event waits on average N/2 seconds (up to N) before the next poll picks it up.</li>
      <li><strong>Waste</strong>: most responses are empty. 1 million users polling every 5 seconds is 200,000 requests per second, each carrying 500 to 800 bytes of HTTP headers and cookies, nearly all for nothing.</li>
      <li><strong>Upside</strong>: dead simple, stateless, works through every proxy, cacheable, easy to scale with ordinary load balancers.</li>
    </ul>
    <p>Short polling is fine when updates are rare and a delay is acceptable: checking whether a report export has finished, refreshing an order status every 30 seconds, or a dashboard that refreshes each minute.</p>

    <h2>Long polling</h2>
    <p>The client sends a request, and the server <strong>holds it open</strong> until it has something to say (or a timeout, typically 20 to 60 seconds). As soon as the client gets a response, it immediately sends the next request.</p>
    <div data-diagram="longpoll" data-caption="Long polling: the server parks the request until an event arrives or a timeout fires; the client re-polls at once."></div>
    <ul>
      <li><strong>Latency</strong>: near real time; the event goes out on the parked request immediately.</li>
      <li><strong>Overhead</strong>: one full HTTP request per event (plus one per timeout). Bursts of events need extra round trips, and an event arriving between a response and the next request must be buffered on the server.</li>
      <li><strong>Server cost</strong>: each waiting client holds a connection, so the server needs non-blocking I/O, not a thread per request.</li>
    </ul>
    <p>Long polling was the backbone of early web chat (Facebook chat, Gmail) and is still the fallback in libraries such as Socket.IO when WebSockets are blocked.</p>

    <h2>Server-Sent Events (SSE)</h2>
    <p>SSE is a standard browser API (<code>EventSource</code>) for a <strong>one-way stream from server to client over a normal HTTP response</strong>. The server replies with <code>Content-Type: text/event-stream</code> and never finishes the response; it writes small text messages as events happen.</p>
<pre><code>HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache

id: 1841
event: score
data: {"match":"IND-AUS","score":"287/4","over":"47.2"}

id: 1842
event: score
data: {"match":"IND-AUS","score":"291/4","over":"47.3"}

: heartbeat comment, ignored by the client
</code></pre>
    <ul>
      <li><strong>Automatic reconnection</strong> is built in. If the connection drops, the browser reconnects after a delay (the server can set it with <code>retry:</code>) and sends a <code>Last-Event-ID</code> header so the server can resend what was missed.</li>
      <li><strong>Plain HTTP</strong>: works through most proxies, uses normal auth cookies, and multiplexes nicely over HTTP/2.</li>
      <li><strong>Limits</strong>: server to client only, and text only (UTF-8; send binary as base64). Over HTTP/1.1, browsers allow only about 6 connections per domain, so many SSE tabs can starve each other; HTTP/2 removes this problem. Some buffering proxies hold the stream back unless you disable buffering (for Nginx, <code>X-Accel-Buffering: no</code>).</li>
    </ul>
    <p>SSE is the right tool when the client mostly listens: live scores, notifications, progress bars, and streaming tokens from an LLM (ChatGPT-style responses are commonly streamed with SSE). If the client occasionally needs to send something, it uses a normal POST.</p>

    <h2>WebSockets</h2>
    <p>A WebSocket (RFC 6455) is a <strong>full-duplex</strong>, long-lived connection: both sides can send messages at any time over one TCP connection. It starts life as an HTTP request and then "upgrades".</p>
    <h3>The handshake</h3>
    <div data-diagram="wshandshake" data-caption="WebSocket upgrade: one HTTP request, a 101 response, then the same TCP connection carries WebSocket frames both ways."></div>
    <p>The client sends <code>GET /chat</code> with <code>Upgrade: websocket</code>, <code>Connection: Upgrade</code>, <code>Sec-WebSocket-Version: 13</code> and a random <code>Sec-WebSocket-Key</code>. The server answers <code>101 Switching Protocols</code> with <code>Sec-WebSocket-Accept</code>, which is base64(SHA-1(key + a fixed GUID)). That proves the server really speaks WebSocket and is not a confused cache. From then on, no more HTTP. Use <code>wss://</code> (WebSocket over TLS) in production; encrypted traffic also gets through middleboxes that would mangle plain <code>ws://</code>.</p>
    <h3>Frames</h3>
    <p>Data travels in small <strong>frames</strong> with just 2 to 14 bytes of header, compared with hundreds of bytes for an HTTP request. Frame types (opcodes): text, binary, continuation, and control frames <strong>ping</strong>, <strong>pong</strong> and <strong>close</strong>. Frames from client to server are masked (XORed with a random key) to stop cache-poisoning attacks on old proxies.</p>
    <h3>Heartbeats</h3>
    <p>An idle TCP connection can die silently: a phone switches from Wi-Fi to 4G, a NAT router forgets the mapping, or a load balancer closes it after its idle timeout (60 seconds by default on AWS ALB). Neither side notices until it tries to send. So both sides send a <strong>heartbeat</strong> (ping/pong frames or a tiny app message) every 20 to 30 seconds. If no pong comes back after two or three intervals, the server closes the socket and marks the user offline; the client reconnects with <strong>exponential backoff plus jitter</strong> so a server restart does not cause a reconnect storm of a million clients in the same second.</p>
    <div class="callout warn"><strong>WebSockets give you a pipe, not a protocol</strong>Unlike SSE, there is no built-in reconnection, message ids, acknowledgements or replay. You must design them: give each message a sequence number, have the client send "last seen = 1841" on reconnect, and resend from a durable store. This is exactly what the <a href="#/p/chat-system">chat system</a> design does.</div>

    <h2>WebRTC, briefly</h2>
    <p>WebRTC lets two browsers or apps talk <strong>peer to peer</strong>, mostly over UDP, for audio, video and data channels. It is what Google Meet, and video calling in apps, use. The peers still need a server for <strong>signaling</strong> (exchanging connection offers, usually over a WebSocket), a <strong>STUN</strong> server to discover their public address, and a <strong>TURN</strong> relay when firewalls block a direct path. For group calls, media usually goes through an SFU (selective forwarding unit) server rather than every peer sending to every other. In an interview, WebRTC is the answer for "video call", not for "chat" or "live score".</p>

    <h2>Comparison</h2>
    <table>
      <thead><tr><th></th><th>Short polling</th><th>Long polling</th><th>SSE</th><th>WebSocket</th></tr></thead>
      <tbody>
        <tr><td>Direction</td><td>Client pulls</td><td>Client pulls (server delays reply)</td><td>Server to client</td><td>Both ways</td></tr>
        <tr><td>Latency</td><td>Up to poll interval</td><td>Near real time</td><td>Real time</td><td>Real time</td></tr>
        <tr><td>Per-message overhead</td><td>Full HTTP request, mostly empty</td><td>Full HTTP request per event</td><td>A few bytes of text</td><td>2 to 14 byte frame header</td></tr>
        <tr><td>Server state</td><td>None</td><td>Parked request</td><td>Open connection</td><td>Open connection</td></tr>
        <tr><td>Browser support</td><td>Everywhere</td><td>Everywhere</td><td>All modern browsers</td><td>All modern browsers</td></tr>
        <tr><td>Proxies and firewalls</td><td>No issues</td><td>Mostly fine (watch timeouts)</td><td>Fine; watch proxy buffering</td><td>Needs upgrade support; <code>wss://</code> passes most</td></tr>
        <tr><td>Reconnection</td><td>Not needed</td><td>Natural (next poll)</td><td>Built in, with <code>Last-Event-ID</code></td><td>You build it</td></tr>
        <tr><td>Binary data</td><td>Yes</td><td>Yes</td><td>No (text only)</td><td>Yes</td></tr>
        <tr><td>Best for</td><td>Rare updates, simple status</td><td>Fallback, legacy</td><td>Feeds, scores, notifications, LLM streaming</td><td>Chat, games, collaboration, live location</td></tr>
      </tbody>
    </table>

    <h2>Use cases</h2>
    <table>
      <thead><tr><th>Product</th><th>Good fit</th><th>Why</th></tr></thead>
      <tbody>
        <tr><td>Live cricket score (Cricbuzz, Hotstar scorecard)</td><td>SSE (or short polling with CDN caching)</td><td>Millions only listen; one update per ball, the same for everyone. Short polls every few seconds can even be served from a <a href="#/p/cdn">CDN</a> cache, which is how many score widgets survive an India vs Pakistan match.</td></tr>
        <tr><td>Chat (WhatsApp, Slack)</td><td>WebSocket</td><td>Both sides send often; typing indicators and read receipts need low-latency two-way messages.</td></tr>
        <tr><td>Uber / Ola driver location</td><td>WebSocket or gRPC stream from the driver app; WebSocket or SSE to the rider</td><td>Drivers send GPS every few seconds; riders watching a trip need pushes. Many apps fall back to polling on bad networks.</td></tr>
        <tr><td>Stock ticker (Zerodha Kite)</td><td>WebSocket</td><td>Many price ticks per second, binary-packed to save bandwidth; client changes subscriptions on the fly.</td></tr>
        <tr><td>Notifications bell on a website</td><td>SSE</td><td>One way, low volume, auto-reconnect for free.</td></tr>
        <tr><td>Mobile app in background</td><td>Push notifications (FCM / APNs)</td><td>The OS kills background sockets to save battery; let Google or Apple hold the one connection per phone.</td></tr>
        <tr><td>Video call</td><td>WebRTC</td><td>Peer-to-peer media over UDP with low latency.</td></tr>
      </tbody>
    </table>

    <h2>Scaling to millions of connections</h2>
    <p>Stateless HTTP servers are easy: any server can answer any request. A WebSocket or SSE connection is <strong>stateful</strong>: user 42 is attached to <em>one</em> specific server for minutes or hours. That changes how you design.</p>
    <h3>C10K and C1M</h3>
    <p>The <strong>C10K problem</strong> (Dan Kegel, 1999) asked how one server can handle 10,000 concurrent connections. A thread per connection fails: each thread needs its own stack (often 1 MB reserved) and context switching kills the CPU. The answer was <strong>event-driven, non-blocking I/O</strong>: one thread watches thousands of sockets with <code>epoll</code> (Linux) or <code>kqueue</code> (BSD/macOS) and handles whichever is ready. Nginx, Node.js, Netty and Go's runtime all work this way. Today the target is <strong>C1M</strong>, a million connections per machine. WhatsApp famously ran around 2 million connections per server on Erlang back in 2012.</p>
    <p>What limits connections per server:</p>
    <ul>
      <li><strong>File descriptors</strong>: every socket is a file descriptor. The default limit is often 1,024 per process; raise it (<code>ulimit -n</code>, <code>fs.file-max</code>) to over a million.</li>
      <li><strong>Memory</strong>: kernel socket buffers plus your per-connection state. At around 10 to 20 KB per idle connection, 1 million connections need 10 to 20 GB of RAM.</li>
      <li><strong>Ports</strong>: a server listening on one port can hold millions of clients, because each connection is identified by the 4-tuple (client IP, client port, server IP, server port). But a proxy or load balancer opening connections <em>to</em> one backend address runs out of about 64,000 source ports per IP; give it several source IPs.</li>
      <li><strong>Heartbeat and fan-out CPU</strong>: a million clients pinging every 30 s is about 33,000 small messages per second before any real traffic.</li>
    </ul>
    <h3>The architecture</h3>
    <div data-diagram="scale" data-caption="Connection servers hold sockets; a Redis pub/sub or Kafka backplane routes each message to whichever server holds the recipient."></div>
    <ol class="steps">
      <li><strong>Dedicated connection servers</strong> (also called gateway or edge servers) do nothing but hold sockets, authenticate, and pass messages in and out. Business logic lives in normal stateless services behind them. You can then deploy business logic without dropping everyone's connection.</li>
      <li><strong>Load balancer</strong>: use one that supports long-lived connections and the upgrade (an L4 balancer, or an L7 one such as ALB, Nginx or Envoy with WebSocket support). Connections are balanced only when they are <em>opened</em>, so new servers start empty; use least-connections balancing and slowly rebalance by asking clients to reconnect. See <a href="#/p/load-balancers">load balancers</a>.</li>
      <li><strong>Sticky sessions</strong>: needed for long polling and the Socket.IO handshake, where several HTTP requests must reach the same server. A true WebSocket is one TCP connection, so it is naturally sticky.</li>
      <li><strong>Connection registry</strong>: a fast store (Redis) maps <code>userId -&gt; connection server</code>, written on connect and deleted on disconnect or missed heartbeats. This also gives you online presence.</li>
      <li><strong>Pub/sub backplane</strong>: when the chat service needs to send to user 42, it publishes to a channel (Redis pub/sub, or a <a href="#/p/message-queues">Kafka</a> topic per server). The connection server holding user 42 receives it and writes it to the socket. For broadcast (one score update to 10 million viewers), every connection server subscribes to the match channel and fans out locally.</li>
      <li><strong>Graceful deploys</strong>: drain a server by telling its clients to reconnect elsewhere over a few minutes, with jitter, instead of killing a million sockets at once.</li>
    </ol>
    <div class="callout tip"><strong>Back-of-envelope</strong>10 million concurrent viewers at about 200,000 connections per server needs about 50 connection servers, plus headroom (say 70 to 80) to survive a zone failure and the reconnect wave after it. One score update fanned out to 10 million sockets is 10 million small writes; spread across 50 servers that is 200,000 writes each, done in well under a second.</div>

    <h2>Common interview questions</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"Chat is two-way and latency-sensitive, so clients keep a WebSocket to a fleet of connection servers. A Redis registry maps users to servers and a pub/sub backplane routes messages between them."</li>
        <li>"For the live score, clients only listen, so I'd use SSE: plain HTTP, automatic reconnect with Last-Event-ID, and fewer moving parts than WebSockets."</li>
        <li>"Heartbeats every 30 seconds detect dead connections and keep load balancer idle timeouts from closing the socket; clients reconnect with exponential backoff and jitter."</li>
        <li>"When the app is in the background we fall back to FCM/APNs push, because the OS will kill our socket."</li>
      </ul>
    </div>
    <div class="callout warn"><strong>Pitfalls</strong>Choosing WebSockets for one-way data; forgetting that connection servers are stateful when scaling or deploying; no heartbeat; no message ids so reconnects lose messages; all clients reconnecting at the same instant; assuming a WebSocket works when the app is backgrounded on a phone.</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>1 million clients short-poll every 10 seconds. What is the request rate and what is the average delay before a client sees an event?</summary><div>1,000,000 / 10 = 100,000 requests per second, mostly returning nothing. An event waits on average half the interval, 5 seconds, and up to 10 seconds.</div></details>
      <details><summary>How does long polling differ from short polling?</summary><div>In long polling the server holds the request open until it has data or a timeout, then the client immediately re-requests. Events are delivered almost instantly and there are far fewer empty responses, at the cost of the server keeping many parked connections.</div></details>
      <details><summary>When would you pick SSE over WebSockets?</summary><div>When data flows only from server to client (scores, notifications, LLM token streaming). SSE is plain HTTP, works with existing auth and proxies, multiplexes over HTTP/2, and has automatic reconnection with <code>Last-Event-ID</code> built in. Pick WebSockets when the client also sends frequently or you need binary data.</div></details>
      <details><summary>Describe the WebSocket handshake.</summary><div>The client sends an HTTP GET with <code>Upgrade: websocket</code>, <code>Connection: Upgrade</code>, <code>Sec-WebSocket-Version: 13</code> and a random <code>Sec-WebSocket-Key</code>. The server replies <code>101 Switching Protocols</code> with <code>Sec-WebSocket-Accept</code> derived from the key. The same TCP connection then carries WebSocket frames in both directions.</div></details>
      <details><summary>User A on connection server 3 sends a message to user B on connection server 17. How does it get there?</summary><div>Server 3 hands the message to the chat service, which stores it and looks up B in the connection registry (Redis: B is on server 17). It publishes the message on server 17's pub/sub channel; server 17 receives it and writes it to B's socket. If B is offline, it stays stored and a push notification is sent.</div></details>
      <details><summary>Why do clients need jittered exponential backoff when reconnecting?</summary><div>If a connection server with 200,000 clients dies, all of them disconnect at once. Without backoff and randomness they all reconnect in the same second, overloading the load balancer, auth and remaining servers (a thundering herd). Jitter spreads reconnects out over time.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>The client always opens the connection; techniques differ in how long it stays open and in which direction data flows.</li>
      <li>Short polling is simple but wasteful and laggy; long polling is near real time with one HTTP request per event.</li>
      <li>SSE: one-way server push over HTTP with built-in reconnection. WebSocket: two-way, low-overhead frames, but you build reconnection and acks.</li>
      <li>Use heartbeats, message sequence numbers and jittered backoff for any long-lived connection.</li>
      <li>Scale with dedicated connection servers, a user-to-server registry and a pub/sub backplane; event-driven I/O and raised file descriptor limits get one box to hundreds of thousands of connections.</li>
      <li>Mobile apps in the background use FCM/APNs push; video calls use WebRTC.</li>
    </ul></div>
  `,
  diagrams: {
    longpoll: String.raw`sequenceDiagram
      participant C as Client
      participant S as Server
      C->>S: GET /updates?after=17
      Note over S: hold request (no data yet)
      Note over S: event 18 arrives
      S-->>C: 200 [event 18]
      C->>S: GET /updates?after=18
      Note over S: hold... 30 s timeout
      S-->>C: 204 No Content
      C->>S: GET /updates?after=18`,
    wshandshake: String.raw`sequenceDiagram
      participant C as Browser
      participant S as Server
      C->>S: GET /chat, Upgrade: websocket, Sec-WebSocket-Key
      S-->>C: 101 Switching Protocols, Sec-WebSocket-Accept
      Note over C,S: Same TCP connection, now WebSocket frames
      C->>S: text frame: hi
      S-->>C: text frame: hello
      S-->>C: ping
      C->>S: pong
      C->>S: close`,
    scale: String.raw`flowchart LR
      U1["Clients A..."] --> LB["Load balancer (L4/L7)"]
      U2["Clients B..."] --> LB
      LB --> CS1["Connection server 3"]
      LB --> CS2["Connection server 17"]
      CS1 --> CHAT["Chat service (stateless)"]
      CHAT --> REG[("Registry: user to server (Redis)")]
      CHAT --> DB[("Message store")]
      CHAT --> PS["Pub/sub backplane (Redis / Kafka)"]
      PS --> CS2`,
  },
});
