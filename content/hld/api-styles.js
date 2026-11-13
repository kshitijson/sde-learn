SD.register({
  id: "api-styles",
  html: String.raw`
    <p class="lead">An API style is the contract shape two programs use to talk: how you name things, what goes over the wire, and who decides what data comes back. The three you will be asked about are <strong>REST</strong> (resources over plain HTTP and JSON), <strong>GraphQL</strong> (one endpoint, the client asks for exactly the fields it wants) and <strong>gRPC</strong> (typed remote function calls with Protocol Buffers over HTTP/2). None is "best". REST wins for public APIs, GraphQL for data-hungry mobile and web screens, gRPC for fast service-to-service calls. Interviewers want to hear you pick one per boundary and say why.</p>

    <h2>What an API style is</h2>
    <p>Every design has several API boundaries: the public API partners call, the API your own apps call, and the calls between your microservices. Each boundary has different needs. A public API needs to be easy to try with <code>curl</code> and stable for years. A mobile app on a 4G connection in a Tier-3 city wants one small response per screen. Internal services want low latency, strict types and generated clients.</p>
    <div data-diagram="landscape" data-caption="A typical product company uses all three: REST at the public edge, GraphQL in a backend-for-frontend for its apps, gRPC between internal services."></div>
    <div class="callout info"><strong>Key terms</strong><strong>Endpoint</strong>: a URL the server listens on. <strong>Payload</strong>: the body of a request or response. <strong>Serialization</strong>: turning an object into bytes (JSON text, Protobuf binary). <strong>BFF</strong> (backend for frontend): a thin server built for one client type that gathers data from many services. <strong>IDL</strong> (interface definition language): a file that defines the API's types and methods, used to generate code.</div>

    <h2>REST</h2>
    <p>REST (Representational State Transfer, from Roy Fielding's 2000 thesis) models your system as <strong>resources</strong> identified by URLs, and uses standard <strong>HTTP verbs</strong> to act on them. An order is <code>/orders/42</code>; its items are <code>/orders/42/items</code>. You do not invent verbs in the URL (<code>/getOrder</code>); the HTTP method is the verb.</p>
    <table>
      <thead><tr><th>Method</th><th>Meaning</th><th>Safe?</th><th>Idempotent?</th><th>Example</th></tr></thead>
      <tbody>
        <tr><td>GET</td><td>Read a resource or list</td><td>Yes</td><td>Yes</td><td><code>GET /orders/42</code></td></tr>
        <tr><td>POST</td><td>Create, or trigger an action</td><td>No</td><td>No</td><td><code>POST /orders</code></td></tr>
        <tr><td>PUT</td><td>Replace a resource completely</td><td>No</td><td>Yes</td><td><code>PUT /users/7/address</code></td></tr>
        <tr><td>PATCH</td><td>Change some fields</td><td>No</td><td>Not guaranteed</td><td><code>PATCH /orders/42</code> with <code>{"status":"CANCELLED"}</code></td></tr>
        <tr><td>DELETE</td><td>Remove a resource</td><td>No</td><td>Yes</td><td><code>DELETE /cart/items/9</code></td></tr>
      </tbody>
    </table>
    <p><strong>Safe</strong> means the call does not change state. <strong>Idempotent</strong> means doing it twice has the same effect as doing it once, so a client can retry it after a timeout. POST is not idempotent, which is why payment APIs such as Razorpay and Stripe accept an <strong>idempotency key</strong> header: the server remembers the key and returns the first result on a retry instead of charging twice.</p>
    <h3>Status codes worth knowing</h3>
    <table>
      <thead><tr><th>Code</th><th>Meaning</th><th>When</th></tr></thead>
      <tbody>
        <tr><td>200 / 201 / 204</td><td>OK / Created / No Content</td><td>Successful read, create (with a <code>Location</code> header), delete</td></tr>
        <tr><td>304</td><td>Not Modified</td><td>Client's cached copy (ETag) is still valid; no body sent</td></tr>
        <tr><td>400 / 422</td><td>Bad Request / Unprocessable</td><td>Malformed JSON, or a valid shape that fails validation</td></tr>
        <tr><td>401 / 403</td><td>Unauthenticated / Forbidden</td><td>No valid token / token is valid but not allowed</td></tr>
        <tr><td>404 / 409</td><td>Not Found / Conflict</td><td>Missing resource / version clash, duplicate create</td></tr>
        <tr><td>429</td><td>Too Many Requests</td><td>Rate limited; send <code>Retry-After</code></td></tr>
        <tr><td>500 / 502 / 503 / 504</td><td>Server error / bad gateway / unavailable / gateway timeout</td><td>Retryable with backoff (except many 500s)</td></tr>
      </tbody>
    </table>
    <h3>Statelessness and caching</h3>
    <p>Each REST request carries everything the server needs (usually a bearer token in the <code>Authorization</code> header). The server keeps no session in memory between calls, so any server behind the <a href="#/p/load-balancers">load balancer</a> can answer and you can <a href="#/p/scaling">scale out</a> freely. Because REST uses plain GET URLs, every HTTP cache understands it: browsers, <a href="#/p/cdn">CDNs</a> and reverse proxies can cache <code>GET /products/42</code> using <code>Cache-Control</code> and <code>ETag</code> headers for free.</p>
    <h3>HATEOAS, briefly</h3>
    <p>HATEOAS (Hypermedia As The Engine Of Application State) says a response should include links to what the client can do next, for example an order response containing <code>"links": {"cancel": "/orders/42/cancel"}</code>. It is part of Fielding's original idea, but very few real APIs follow it fully. Mention it to show you know it; nobody will expect you to design with it.</p>
    <div class="grid-2">
      <div class="card good"><strong>REST strengths</strong><ul><li>Universal: any language, <code>curl</code>, browser</li><li>HTTP caching, CDNs and proxies just work</li><li>Easy to read, debug and document (OpenAPI/Swagger)</li><li>Mature tooling for auth, rate limiting, gateways</li></ul></div>
      <div class="card bad"><strong>REST weaknesses</strong><ul><li><strong>Over-fetching</strong>: <code>GET /users/7</code> returns 40 fields when the screen needs 3</li><li><strong>Under-fetching</strong>: a screen needs 5 calls (user, orders, items, restaurant, offers)</li><li>JSON text is bigger and slower to parse than binary</li><li>No built-in schema; contracts drift unless you use OpenAPI</li></ul></div>
    </div>

    <h2>GraphQL</h2>
    <p>GraphQL was built at Facebook in 2012 for its mobile News Feed and open-sourced in 2015. The server publishes a typed <strong>schema</strong>. Clients send a <strong>query</strong> to a single endpoint (usually <code>POST /graphql</code>) naming exactly the fields and nested objects they want, and get back JSON in the same shape. Writes are <strong>mutations</strong>; live updates are <strong>subscriptions</strong> (usually over WebSockets).</p>
    <p>Each field in the schema is backed by a <strong>resolver</strong>, a function that fetches that field's data from a database or another service. The GraphQL server walks the query tree and calls resolvers, so one query can pull from five services and return one response. That solves both over-fetching (you get only the fields you named) and under-fetching (one round trip instead of five), which matters most on slow mobile networks.</p>
    <h3>The N+1 problem and DataLoader</h3>
    <p>Naive resolvers are slow. A query for 20 orders, each with its restaurant, runs 1 query for the orders and then 20 separate queries for restaurants: N+1 calls. The standard fix is <strong>DataLoader</strong> (a small library from Facebook): resolvers ask the loader for one id, the loader collects all ids requested in the same tick, makes <em>one</em> batched call (<code>WHERE id IN (...)</code>) and caches results for the rest of the request.</p>
    <div data-diagram="dataloader" data-caption="DataLoader turns 20 restaurant lookups into one batched call per request."></div>
    <h3>Why GraphQL is harder to run</h3>
    <ul>
      <li><strong>Caching</strong>: every query is a POST to one URL, so CDNs and browser caches cannot key on the URL. Fixes: <strong>persisted queries</strong> (the client sends a hash of a pre-registered query, which can go as a cacheable GET) and client-side normalized caches (Apollo, Relay).</li>
      <li><strong>Expensive queries</strong>: a client can ask for friends of friends of friends. Servers enforce depth limits, query cost analysis and timeouts.</li>
      <li><strong>Errors</strong>: responses are usually HTTP 200 with an <code>errors</code> array, so normal HTTP monitoring misses failures.</li>
      <li><strong>Rate limiting</strong> by request count is meaningless when one request can be cheap or huge; limit by computed query cost instead (GitHub's GraphQL API does this).</li>
    </ul>

    <h2>gRPC</h2>
    <p>gRPC is Google's open-source RPC (remote procedure call) framework, released in 2015 and based on its internal system Stubby. You describe services and messages in a <code>.proto</code> file. The <code>protoc</code> compiler <strong>generates</strong> client and server code in Java, Go, Python, C++ and more, so calling another service looks like calling a local method: <code>orderClient.getOrder(req)</code>.</p>
    <ul>
      <li><strong>Protocol Buffers (Protobuf)</strong>: a compact binary format. Fields are sent as numeric tags, not names, and integers use variable-length encoding. Messages are often 3 to 10 times smaller than the same JSON and much faster to parse.</li>
      <li><strong>HTTP/2</strong>: many calls share one TCP connection at once (multiplexing), headers are compressed, and streams can flow both ways. See <a href="#/p/http-versions">HTTP versions</a>.</li>
      <li><strong>Deadlines</strong>: every call carries a timeout that propagates to downstream calls, so a slow chain gives up together instead of piling up.</li>
    </ul>
    <table>
      <thead><tr><th>Call type</th><th>Shape</th><th>Example</th></tr></thead>
      <tbody>
        <tr><td>Unary</td><td>One request, one response</td><td><code>GetOrder</code></td></tr>
        <tr><td>Server streaming</td><td>One request, a stream of responses</td><td>Stream delivery partner locations for an order</td></tr>
        <tr><td>Client streaming</td><td>A stream of requests, one response</td><td>Upload GPS points, get a trip summary</td></tr>
        <tr><td>Bidirectional streaming</td><td>Both sides stream independently</td><td>Chat, live ride matching</td></tr>
      </tbody>
    </table>
    <div data-diagram="grpc" data-caption="gRPC: one .proto file generates typed client and server stubs; calls travel as Protobuf over a shared HTTP/2 connection."></div>
    <div class="callout warn"><strong>gRPC gotchas</strong>Browsers cannot speak native gRPC (they cannot control HTTP/2 framing and trailers), so web clients need <strong>gRPC-Web</strong> through a proxy such as Envoy. Binary payloads are not human-readable, so you need tools like <code>grpcurl</code>. And because clients hold one long-lived HTTP/2 connection, an L4 load balancer sends all of a client's calls to one server; use L7 (per-request) balancing or client-side load balancing.</div>

    <h2>Same call, three styles</h2>
    <p>"Get order 42 with its items" in each style. Notice who decides the response shape: the server in REST, the client in GraphQL, the shared <code>.proto</code> contract in gRPC.</p>
    <div class="tabs">
      <section data-tab="REST">
<pre><code>GET /v1/orders/42?include=items HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOi...
Accept: application/json

HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: private, max-age=30
ETag: "a1b2c3"

{
  "id": 42,
  "status": "DELIVERED",
  "restaurantId": 9,
  "totalPaise": 45900,
  "createdAt": "2026-11-11T13:05:00Z",
  "items": [
    { "sku": "paneer-tikka", "qty": 1, "pricePaise": 28900 },
    { "sku": "butter-naan",  "qty": 2, "pricePaise": 8500 }
  ]
}</code></pre>
        <p>The server picks the fields. If the screen also needs the restaurant name, that is a second call to <code>/v1/restaurants/9</code>, or a custom <code>include</code> parameter.</p>
      </section>
      <section data-tab="GraphQL">
<pre><code>POST /graphql
Content-Type: application/json

query OrderScreen {
  order(id: 42) {
    status
    totalPaise
    restaurant { name }
    items { sku qty }
  }
}

=&gt; 200 OK
{
  "data": {
    "order": {
      "status": "DELIVERED",
      "totalPaise": 45900,
      "restaurant": { "name": "Punjabi Dhaba" },
      "items": [
        { "sku": "paneer-tikka", "qty": 1 },
        { "sku": "butter-naan",  "qty": 2 }
      ]
    }
  }
}</code></pre>
        <p>One round trip returns order, items and restaurant name, and nothing else. The server's resolvers fetched them from the order service and the restaurant service.</p>
      </section>
      <section data-tab="gRPC">
<pre><code>// order.proto
syntax = "proto3";
package orders.v1;

service OrderService {
  rpc GetOrder(GetOrderRequest) returns (Order);
}

message GetOrderRequest { int64 id = 1; }

message Item {
  string sku = 1;
  int32 qty = 2;
  int64 price_paise = 3;
}

message Order {
  int64 id = 1;
  string status = 2;
  int64 total_paise = 3;
  repeated Item items = 4;
}

// Generated client (Go):
// order, err := client.GetOrder(ctx, &amp;ordersv1.GetOrderRequest{Id: 42})</code></pre>
        <p>On the wire this is an HTTP/2 POST to <code>/orders.v1.OrderService/GetOrder</code> with a binary Protobuf body a fraction of the JSON size. The numbers (<code>= 1</code>, <code>= 2</code>) are field tags; they, not names, go on the wire.</p>
      </section>
    </div>

    <h2>WebSockets and webhooks</h2>
    <p>Two more styles come up alongside these. <strong>WebSockets</strong> keep a two-way connection open so the server can push messages (chat, live tracking); see <a href="#/p/realtime">Polling, WebSockets and SSE</a>. <strong>Webhooks</strong> are reverse APIs: instead of you polling a provider, the provider calls <em>your</em> URL when something happens. Razorpay sends a <code>payment.captured</code> event to your server; Shopify and GitHub do the same. Rules for webhooks: verify the HMAC signature header, respond 2xx fast and process asynchronously (via a <a href="#/p/message-queues">queue</a>), and make handling idempotent because providers retry and may deliver the same event twice.</p>

    <h2>Big comparison</h2>
    <table>
      <thead><tr><th>Aspect</th><th>REST</th><th>GraphQL</th><th>gRPC</th></tr></thead>
      <tbody>
        <tr><td>Model</td><td>Resources + HTTP verbs</td><td>Typed graph, client-written queries</td><td>Remote procedure calls (methods)</td></tr>
        <tr><td>Transport</td><td>HTTP/1.1, 2 or 3</td><td>Usually HTTP POST; WebSocket for subscriptions</td><td>HTTP/2 (required)</td></tr>
        <tr><td>Format</td><td>JSON (text)</td><td>JSON (text)</td><td>Protobuf (binary)</td></tr>
        <tr><td>Contract</td><td>Optional (OpenAPI)</td><td>Required schema (SDL)</td><td>Required <code>.proto</code> with codegen</td></tr>
        <tr><td>Who shapes the response</td><td>Server</td><td>Client</td><td>Contract</td></tr>
        <tr><td>Round trips per screen</td><td>Often many</td><td>One</td><td>One per method (server can aggregate)</td></tr>
        <tr><td>HTTP caching / CDN</td><td>Excellent</td><td>Hard (persisted queries help)</td><td>Not applicable</td></tr>
        <tr><td>Streaming</td><td>No (use SSE/WebSocket)</td><td>Subscriptions</td><td>Native, 4 modes</td></tr>
        <tr><td>Browser support</td><td>Native</td><td>Native</td><td>Needs gRPC-Web proxy</td></tr>
        <tr><td>Performance</td><td>Good</td><td>Good; resolver cost varies</td><td>Best: small payloads, multiplexed</td></tr>
        <tr><td>Learning / debugging</td><td>Easiest</td><td>Medium</td><td>Harder (binary)</td></tr>
        <tr><td>Sweet spot</td><td>Public and partner APIs, simple CRUD</td><td>Mobile/web BFF, many clients with different needs</td><td>Internal microservices, polyglot, low latency</td></tr>
      </tbody>
    </table>

    <h2>When to choose which</h2>
    <ul>
      <li><strong>Public or partner API: REST.</strong> Payment gateways (Razorpay, Stripe), maps and SMS providers expose REST because every developer can call it from any language with no special tooling, and it is easy to document and cache. GitHub offers both REST and GraphQL; REST is still the one most people start with.</li>
      <li><strong>Your own mobile and web apps: often GraphQL in a BFF.</strong> A food-delivery home screen (think Swiggy or Zomato) shows the user's address, offers, carousels of restaurants with ratings and ETAs, and past orders, drawn from many services. A BFF lets the Android app, iOS app and website each ask for exactly what their screen needs in one round trip. Plain REST BFF endpoints shaped per screen (<code>GET /home-screen</code>) are a perfectly good alternative and simpler to run.</li>
      <li><strong>Internal service to service: gRPC.</strong> At a Flipkart-scale checkout, one user click fans out to cart, pricing, offers, inventory and payment services. Each hop saving a few milliseconds and a few kilobytes adds up, and generated, typed clients stop teams from breaking each other. Google, Netflix, Uber and many Indian startups use gRPC internally.</li>
      <li><strong>Events between services: neither.</strong> If the caller does not need an answer now, publish an event to Kafka instead of making a call. See <a href="#/p/message-queues">message queues</a>.</li>
    </ul>
    <div class="callout tip"><strong>A safe interview default</strong>"REST with JSON at the public edge through an <a href="#/p/api-gateway-rate-limiting">API gateway</a>, gRPC between internal services, and Kafka for asynchronous events. I'd add GraphQL only if we have many client types with very different data needs."</div>

    <h2>API versioning</h2>
    <p>APIs outlive the apps that call them: an old Android build may stay installed for years. You need to change the API without breaking those clients.</p>
    <ul>
      <li><strong>Additive changes are free</strong>: adding a new optional field or a new endpoint does not break anyone, as long as clients ignore unknown fields.</li>
      <li><strong>REST</strong>: put the major version in the path (<code>/v1/orders</code>, the most common and easiest to route), or in a header (<code>Accept: application/vnd.example.v2+json</code>). Stripe pins each account to a dated version (<code>Stripe-Version: 2024-06-20</code>) and translates responses for older versions.</li>
      <li><strong>GraphQL</strong>: usually no versions. You evolve one schema, add fields, and mark old ones <code>@deprecated</code>, then remove them when usage drops to zero.</li>
      <li><strong>gRPC / Protobuf</strong>: never change or reuse a field number; add new fields with new numbers; mark removed numbers <code>reserved</code>. Put a version in the package name (<code>orders.v1</code>) for breaking changes.</li>
    </ul>

    <h2>Pagination: offset vs cursor</h2>
    <p>Any list endpoint (order history, feed, search results) must return results in pages. There are two common ways.</p>
    <p><strong>Offset pagination</strong>: <code>GET /orders?limit=20&amp;offset=40</code>, which maps to SQL <code>LIMIT 20 OFFSET 40</code>. Simple, and lets users jump to page 7. But the database still reads and throws away all skipped rows, so <code>OFFSET 100000</code> is slow. Worse, if a new row is inserted at the top while the user is paging, everything shifts down by one and the user sees a duplicate (or misses a row on delete).</p>
    <p><strong>Cursor (keyset) pagination</strong>: the response includes an opaque <code>next_cursor</code>; the client sends it back to get the next page. The cursor encodes the position of the last row seen (here, its timestamp and id), so the query becomes <code>WHERE (created_at, id) &lt; (:ts, :id) ORDER BY created_at DESC, id DESC LIMIT 20</code>. With an index on <code>(created_at, id)</code> that is an index seek: page 5,000 is as fast as page 1, and inserts do not shift anything. Twitter/X, Facebook's Graph API, Slack and Stripe all use cursors.</p>
    <figure class="svg-fig">
      <svg viewBox="0 0 640 250">
        <text class="s-title" x="160" y="24" text-anchor="middle">Offset: page 2 = rows 4-6</text>
        <text class="s-title" x="480" y="24" text-anchor="middle">Cursor: after (180, 105)</text>
        <rect class="s-accent" x="40" y="40" width="240" height="30" rx="10"/>
        <text class="s-text" x="160" y="60" text-anchor="middle">108 (new, inserted after page 1)</text>
        <rect class="s-box" x="40" y="74" width="240" height="30" rx="10"/>
        <text class="s-text" x="160" y="94" text-anchor="middle">107</text>
        <rect class="s-box" x="40" y="108" width="240" height="30" rx="10"/>
        <text class="s-text" x="160" y="128" text-anchor="middle">106</text>
        <rect class="s-red" x="40" y="142" width="240" height="30" rx="10"/>
        <text class="s-text" x="160" y="162" text-anchor="middle">105 (seen again!)</text>
        <rect class="s-amber" x="40" y="176" width="240" height="30" rx="10"/>
        <text class="s-text" x="160" y="196" text-anchor="middle">104, 103</text>
        <text class="s-muted" x="160" y="232" text-anchor="middle">rows shifted down by one: duplicate</text>
        <rect class="s-box" x="360" y="40" width="240" height="30" rx="10"/>
        <text class="s-muted" x="480" y="60" text-anchor="middle">108 (newer than cursor, skipped)</text>
        <rect class="s-box" x="360" y="74" width="240" height="30" rx="10"/>
        <text class="s-muted" x="480" y="94" text-anchor="middle">107, 106 (already seen)</text>
        <rect class="s-box" x="360" y="108" width="240" height="30" rx="10"/>
        <text class="s-text" x="480" y="128" text-anchor="middle">105 = cursor position</text>
        <line class="s-line" x1="480" y1="140" x2="480" y2="156" marker-end="url(#arrow)"/>
        <rect class="s-green" x="360" y="160" width="240" height="46" rx="10"/>
        <text class="s-text" x="480" y="188" text-anchor="middle">104, 103, 102</text>
        <text class="s-muted" x="480" y="232" text-anchor="middle">position is a value, not a count: stable</text>
      </svg>
      <figcaption>A new order arrives between page 1 and page 2. Offset pagination repeats order 105; cursor pagination continues correctly.</figcaption>
    </figure>
    <table>
      <thead><tr><th></th><th>Offset</th><th>Cursor (keyset)</th></tr></thead>
      <tbody>
        <tr><td>Deep pages</td><td>Slow (scans skipped rows)</td><td>Fast (index seek)</td></tr>
        <tr><td>Inserts/deletes while paging</td><td>Duplicates or gaps</td><td>Stable</td></tr>
        <tr><td>Jump to page N / total pages</td><td>Easy</td><td>Not supported</td></tr>
        <tr><td>Sort requirements</td><td>Any</td><td>Needs a unique, indexed sort key (add id as tie-breaker)</td></tr>
        <tr><td>Good for</td><td>Admin tables, small lists</td><td>Feeds, infinite scroll, APIs, large tables</td></tr>
      </tbody>
    </table>
    <h3>Code: cursor pagination</h3>
    <p>The cursor is <strong>opaque</strong>: base64url of <code>createdAt:id</code>. Clients must not parse it, which leaves you free to change what is inside (add a shard id, sign it with an HMAC to stop tampering). Sorting by timestamp alone is not enough because two orders can share a timestamp; the id breaks ties so the order is total. The demo pages through orders, inserts a new one between pages, and shows that offset paging repeats a row while the cursor does not.</p>
    <div data-code="cursor"></div>
    <div class="callout tip"><strong>Fetch one extra</strong>Ask the database for <code>limit + 1</code> rows. If you got the extra one, there is a next page and you return a cursor; otherwise return <code>null</code>. This avoids a separate <code>COUNT(*)</code> query, which is expensive on big tables.</div>

    <h2>Common interview questions</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"The public API is REST over HTTPS with JSON, versioned in the path as <code>/v1</code>, with cursor pagination and idempotency keys on POSTs that create payments or orders."</li>
        <li>"Internal services talk gRPC: Protobuf is smaller and faster than JSON, we get generated typed clients, and deadlines propagate across the call chain."</li>
        <li>"The mobile app hits a BFF that aggregates five services into one response per screen, so a user on a slow network makes one round trip instead of five."</li>
        <li>"If we use GraphQL I'll batch resolver calls with DataLoader to avoid N+1, and cap query depth and cost."</li>
      </ul>
    </div>
    <div class="callout warn"><strong>Pitfalls</strong>Verbs in REST URLs (<code>/createOrder</code>); returning 200 with an error body from REST; offset pagination on an infinite feed; non-idempotent retries on payment calls; choosing gRPC for a browser-facing API without mentioning gRPC-Web; choosing GraphQL and forgetting caching and N+1.</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>Which HTTP methods are idempotent, and why does it matter?</summary><div>GET, PUT, DELETE (and HEAD, OPTIONS) are idempotent; POST is not, and PATCH is not guaranteed to be. It matters for retries: after a timeout a client can safely resend an idempotent request. For POSTs that must be retried (payments), use an idempotency key the server deduplicates on.</div></details>
      <details><summary>What are over-fetching and under-fetching, and how does GraphQL address them?</summary><div>Over-fetching: an endpoint returns more fields than the client needs. Under-fetching: one endpoint does not return enough, so the client makes several calls. GraphQL lets the client name exactly the fields and nested objects it wants, returned in one round trip.</div></details>
      <details><summary>A GraphQL query for 50 posts with their authors makes 51 database queries. What is happening and how do you fix it?</summary><div>The N+1 problem: one query for posts, then one author query per post from the author resolver. Use DataLoader to collect all author ids requested in the same tick and fetch them in one batched <code>IN (...)</code> query, with per-request caching.</div></details>
      <details><summary>Why is gRPC usually not used directly from browsers, and what do you do instead?</summary><div>Browsers do not expose the low-level HTTP/2 control (frames, trailers) gRPC needs. Use gRPC-Web through a proxy like Envoy, or put a REST/GraphQL gateway in front of the gRPC services.</div></details>
      <details><summary>Why can offset pagination show duplicates on a live feed, and why is cursor pagination faster on deep pages?</summary><div>Offset counts positions; an insert at the top shifts every row down, so the next page starts one row earlier and repeats a row. Cursor pagination remembers the last row's sort key and queries <code>WHERE key &lt; cursor</code>, which is an index seek that does not depend on how many rows came before, whereas <code>OFFSET n</code> must read and discard n rows.</div></details>
      <details><summary>You need to remove a field from a Protobuf message used by many services. What do you do?</summary><div>Stop writing it, wait until no client reads it, delete it from the message and mark its field number (and name) as <code>reserved</code> so nobody reuses the number with a different type, which would corrupt decoding for old clients.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>REST: resources and HTTP verbs, stateless, cache-friendly, universal. The default for public APIs.</li>
      <li>GraphQL: one endpoint, client-shaped responses, fixes over/under-fetching; watch N+1 (DataLoader), caching and query cost.</li>
      <li>gRPC: Protobuf over HTTP/2 with codegen, deadlines and four streaming modes. The default between internal services.</li>
      <li>Pick per boundary: REST at the edge, GraphQL or a REST BFF for apps, gRPC inside, events for async work.</li>
      <li>Version by adding, never by changing meaning: <code>/v1</code> paths, <code>@deprecated</code> fields, reserved Protobuf numbers.</li>
      <li>Use cursor pagination with a unique, indexed sort key for feeds and large lists; offset only for small admin tables.</li>
    </ul></div>
  `,
  code: {
    cursor: {
      title: "Cursor pagination with an opaque base64url cursor",
      java: String.raw`import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

public class Main {
    record Order(long id, long createdAt) {}
    record Cursor(long createdAt, long id) {}
    record Page(List<Order> items, String nextCursor) {}

    // The cursor is opaque to clients: base64url("createdAt:id"), no padding.
    static String encode(Cursor c) {
        String raw = c.createdAt() + ":" + c.id();
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    static Cursor decode(String token) {
        try {
            String raw = new String(Base64.getUrlDecoder().decode(token), StandardCharsets.UTF_8);
            String[] parts = raw.split(":");
            if (parts.length != 2) throw new IllegalArgumentException("bad shape");
            return new Cursor(Long.parseLong(parts[0]), Long.parseLong(parts[1]));
        } catch (IllegalArgumentException e) { // also covers NumberFormatException
            throw new IllegalArgumentException("invalid cursor");
        }
    }

    // Sort order: newest first, id breaks ties so no two rows are "equal".
    static int newestFirst(Order a, Order b) {
        if (a.createdAt() != b.createdAt()) return Long.compare(b.createdAt(), a.createdAt());
        return Long.compare(b.id(), a.id());
    }

    // True if o comes strictly after the cursor position in newest-first order.
    // SQL: WHERE (created_at, id) < (:ts, :id) ORDER BY created_at DESC, id DESC LIMIT :n
    static boolean after(Order o, Cursor c) {
        return o.createdAt() < c.createdAt()
                || (o.createdAt() == c.createdAt() && o.id() < c.id());
    }

    static class OrderStore {
        private final List<Order> orders = new ArrayList<>();

        void add(Order o) {
            orders.add(o);
            orders.sort(Main::newestFirst);
        }

        Page fetch(String cursor, int limit) {
            Cursor c = cursor == null ? null : decode(cursor);
            List<Order> out = new ArrayList<>();
            for (Order o : orders) { // a database would seek straight to the cursor via an index
                if (c != null && !after(o, c)) continue;
                out.add(o);
                if (out.size() == limit + 1) break; // fetch one extra to learn if more exist
            }
            if (out.size() <= limit) return new Page(out, null);
            List<Order> page = new ArrayList<>(out.subList(0, limit));
            Order last = page.get(limit - 1);
            return new Page(page, encode(new Cursor(last.createdAt(), last.id())));
        }

        List<Order> fetchByOffset(int offset, int limit) {
            return orders.subList(Math.min(offset, orders.size()), Math.min(offset + limit, orders.size()));
        }
    }

    static String ids(List<Order> list) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < list.size(); i++) sb.append(i == 0 ? "" : " ").append(list.get(i).id());
        return sb.append("]").toString();
    }

    static void print(int n, Page p) {
        System.out.println("page " + n + ": " + ids(p.items()) + " next="
                + (p.nextCursor() == null ? "<end>" : p.nextCursor()));
    }

    public static void main(String[] args) {
        OrderStore store = new OrderStore();
        long[][] seed = {{101, 1700000000}, {102, 1700000060}, {103, 1700000060}, {104, 1700000120},
                         {105, 1700000180}, {106, 1700000180}, {107, 1700000240}};
        for (long[] s : seed) store.add(new Order(s[0], s[1]));

        Page p1 = store.fetch(null, 3);
        print(1, p1);
        store.add(new Order(108, 1700000300));
        System.out.println("new order 108 arrives");
        Page p2 = store.fetch(p1.nextCursor(), 3);
        print(2, p2);
        print(3, store.fetch(p2.nextCursor(), 3));
        System.out.println("offset page 2 after insert: " + ids(store.fetchByOffset(3, 3)) + " (105 repeated)");
        try {
            store.fetch("!!!", 3);
        } catch (IllegalArgumentException e) {
            System.out.println("bad cursor: " + e.getMessage());
        }
    }
}
`,
      python: String.raw`import base64
import binascii
from dataclasses import dataclass
from typing import List, Optional


@dataclass(frozen=True)
class Order:
    id: int
    created_at: int


@dataclass(frozen=True)
class Cursor:
    created_at: int
    id: int


@dataclass
class Page:
    items: List[Order]
    next_cursor: Optional[str]


def encode(c: Cursor) -> str:
    """Opaque cursor: base64url("created_at:id") without padding."""
    raw = f"{c.created_at}:{c.id}".encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode(token: str) -> Cursor:
    try:
        padded = token + "=" * (-len(token) % 4)
        raw = base64.b64decode(padded, altchars=b"-_", validate=True).decode()
        ts, oid = raw.split(":")
        return Cursor(int(ts), int(oid))
    except (binascii.Error, ValueError, UnicodeDecodeError):
        raise ValueError("invalid cursor") from None


def sort_key(o: Order):
    # Newest first; id breaks ties so the order is total.
    return (-o.created_at, -o.id)


def after(o: Order, c: Cursor) -> bool:
    # SQL: WHERE (created_at, id) < (:ts, :id) ORDER BY created_at DESC, id DESC LIMIT :n
    return o.created_at < c.created_at or (o.created_at == c.created_at and o.id < c.id)


class OrderStore:
    def __init__(self):
        self.orders: List[Order] = []

    def add(self, o: Order) -> None:
        self.orders.append(o)
        self.orders.sort(key=sort_key)

    def fetch(self, cursor: Optional[str], limit: int) -> Page:
        c = decode(cursor) if cursor else None
        out: List[Order] = []
        for o in self.orders:  # a database would seek straight to the cursor via an index
            if c and not after(o, c):
                continue
            out.append(o)
            if len(out) == limit + 1:  # fetch one extra to learn if more exist
                break
        if len(out) <= limit:
            return Page(out, None)
        page = out[:limit]
        last = page[-1]
        return Page(page, encode(Cursor(last.created_at, last.id)))

    def fetch_by_offset(self, offset: int, limit: int) -> List[Order]:
        return self.orders[offset:offset + limit]


def ids(items: List[Order]) -> str:
    return "[" + " ".join(str(o.id) for o in items) + "]"


def show(n: int, p: Page) -> None:
    print(f"page {n}: {ids(p.items)} next={p.next_cursor or '<end>'}")


if __name__ == "__main__":
    store = OrderStore()
    seed = [(101, 1700000000), (102, 1700000060), (103, 1700000060), (104, 1700000120),
            (105, 1700000180), (106, 1700000180), (107, 1700000240)]
    for oid, ts in seed:
        store.add(Order(oid, ts))

    p1 = store.fetch(None, 3)
    show(1, p1)
    store.add(Order(108, 1700000300))
    print("new order 108 arrives")
    p2 = store.fetch(p1.next_cursor, 3)
    show(2, p2)
    show(3, store.fetch(p2.next_cursor, 3))
    print(f"offset page 2 after insert: {ids(store.fetch_by_offset(3, 3))} (105 repeated)")
    try:
        store.fetch("!!!", 3)
    except ValueError as e:
        print(f"bad cursor: {e}")
`,
      cpp: String.raw`#include <algorithm>
#include <cstdint>
#include <iostream>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

struct Order {
    int64_t id;
    int64_t createdAt;
};

struct Cursor {
    int64_t createdAt;
    int64_t id;
};

struct Page {
    std::vector<Order> items;
    std::optional<std::string> nextCursor;  // nullopt = no more pages
};

static const std::string kAlphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";  // base64url

// base64url without padding: every 3 bytes become 4 characters of 6 bits each.
std::string base64UrlEncode(const std::string& in) {
    std::string out;
    uint32_t buf = 0;
    int bits = 0;
    for (unsigned char ch : in) {
        buf = (buf << 8) | ch;
        bits += 8;
        while (bits >= 6) {
            bits -= 6;
            out += kAlphabet[(buf >> bits) & 0x3F];
        }
    }
    if (bits > 0) out += kAlphabet[(buf << (6 - bits)) & 0x3F];
    return out;
}

std::string base64UrlDecode(const std::string& in) {
    std::string out;
    uint32_t buf = 0;
    int bits = 0;
    for (char ch : in) {
        auto pos = kAlphabet.find(ch);
        if (pos == std::string::npos) throw std::invalid_argument("invalid cursor");
        buf = (buf << 6) | static_cast<uint32_t>(pos);
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out += static_cast<char>((buf >> bits) & 0xFF);
        }
    }
    return out;
}

// Opaque cursor: base64url("createdAt:id").
std::string encode(const Cursor& c) {
    return base64UrlEncode(std::to_string(c.createdAt) + ":" + std::to_string(c.id));
}

Cursor decode(const std::string& token) {
    std::string raw = base64UrlDecode(token);
    auto colon = raw.find(':');
    if (colon == std::string::npos || colon == 0 || colon + 1 == raw.size())
        throw std::invalid_argument("invalid cursor");
    std::string ts = raw.substr(0, colon), id = raw.substr(colon + 1);
    auto digits = [](const std::string& s) {
        return std::all_of(s.begin(), s.end(), [](char ch) { return ch >= '0' && ch <= '9'; });
    };
    if (!digits(ts) || !digits(id)) throw std::invalid_argument("invalid cursor");
    return Cursor{std::stoll(ts), std::stoll(id)};
}

// SQL: WHERE (created_at, id) < (:ts, :id) ORDER BY created_at DESC, id DESC LIMIT :n
bool after(const Order& o, const Cursor& c) {
    return o.createdAt < c.createdAt || (o.createdAt == c.createdAt && o.id < c.id);
}

class OrderStore {
    std::vector<Order> orders_;

public:
    void add(const Order& o) {
        orders_.push_back(o);
        std::sort(orders_.begin(), orders_.end(), [](const Order& a, const Order& b) {
            if (a.createdAt != b.createdAt) return a.createdAt > b.createdAt;  // newest first
            return a.id > b.id;                                                // id breaks ties
        });
    }

    Page fetch(const std::optional<std::string>& cursor, size_t limit) const {
        std::optional<Cursor> c;
        if (cursor) c = decode(*cursor);
        Page page;
        for (const Order& o : orders_) {  // a database would seek straight to the cursor via an index
            if (c && !after(o, *c)) continue;
            page.items.push_back(o);
            if (page.items.size() == limit + 1) break;  // fetch one extra to learn if more exist
        }
        if (page.items.size() > limit) {
            page.items.resize(limit);
            const Order& last = page.items.back();
            page.nextCursor = encode(Cursor{last.createdAt, last.id});
        }
        return page;
    }

    std::vector<Order> fetchByOffset(size_t offset, size_t limit) const {
        size_t lo = std::min(offset, orders_.size()), hi = std::min(offset + limit, orders_.size());
        return std::vector<Order>(orders_.begin() + lo, orders_.begin() + hi);
    }
};

std::string ids(const std::vector<Order>& list) {
    std::string s = "[";
    for (size_t i = 0; i < list.size(); i++) s += (i ? " " : "") + std::to_string(list[i].id);
    return s + "]";
}

void show(int n, const Page& p) {
    std::cout << "page " << n << ": " << ids(p.items) << " next=" << p.nextCursor.value_or("<end>") << "\n";
}

int main() {
    OrderStore store;
    std::vector<Order> seed = {{101, 1700000000}, {102, 1700000060}, {103, 1700000060}, {104, 1700000120},
                               {105, 1700000180}, {106, 1700000180}, {107, 1700000240}};
    for (const Order& o : seed) store.add(o);

    Page p1 = store.fetch(std::nullopt, 3);
    show(1, p1);
    store.add({108, 1700000300});
    std::cout << "new order 108 arrives\n";
    Page p2 = store.fetch(p1.nextCursor, 3);
    show(2, p2);
    show(3, store.fetch(p2.nextCursor, 3));
    std::cout << "offset page 2 after insert: " << ids(store.fetchByOffset(3, 3)) << " (105 repeated)\n";
    try {
        store.fetch(std::string("!!!"), 3);
    } catch (const std::invalid_argument& e) {
        std::cout << "bad cursor: " << e.what() << "\n";
    }
}
`,
      javascript: String.raw`// Opaque cursor: base64url("createdAt:id") without padding.
function encode({ createdAt, id }) {
  return Buffer.from(createdAt + ":" + id, "utf8").toString("base64url");
}

function decode(token) {
  if (!/^[A-Za-z0-9_-]+$/.test(token)) throw new Error("invalid cursor");
  const raw = Buffer.from(token, "base64url").toString("utf8");
  const m = /^(\d+):(\d+)$/.exec(raw);
  if (!m) throw new Error("invalid cursor");
  return { createdAt: Number(m[1]), id: Number(m[2]) };
}

// Newest first; id breaks ties so the order is total.
const newestFirst = (a, b) => b.createdAt - a.createdAt || b.id - a.id;

// SQL: WHERE (created_at, id) < (:ts, :id) ORDER BY created_at DESC, id DESC LIMIT :n
const after = (o, c) => o.createdAt < c.createdAt || (o.createdAt === c.createdAt && o.id < c.id);

class OrderStore {
  constructor() {
    this.orders = [];
  }

  add(order) {
    this.orders.push(order);
    this.orders.sort(newestFirst);
  }

  fetch(cursor, limit) {
    const c = cursor ? decode(cursor) : null;
    const out = [];
    for (const o of this.orders) { // a database would seek straight to the cursor via an index
      if (c && !after(o, c)) continue;
      out.push(o);
      if (out.length === limit + 1) break; // fetch one extra to learn if more exist
    }
    if (out.length <= limit) return { items: out, nextCursor: null };
    const items = out.slice(0, limit);
    const last = items[limit - 1];
    return { items, nextCursor: encode(last) };
  }

  fetchByOffset(offset, limit) {
    return this.orders.slice(offset, offset + limit);
  }
}

const ids = (list) => "[" + list.map((o) => o.id).join(" ") + "]";
const show = (n, p) => console.log("page " + n + ": " + ids(p.items) + " next=" + (p.nextCursor ?? "<end>"));

const store = new OrderStore();
const seed = [[101, 1700000000], [102, 1700000060], [103, 1700000060], [104, 1700000120],
  [105, 1700000180], [106, 1700000180], [107, 1700000240]];
for (const [id, createdAt] of seed) store.add({ id, createdAt });

const p1 = store.fetch(null, 3);
show(1, p1);
store.add({ id: 108, createdAt: 1700000300 });
console.log("new order 108 arrives");
const p2 = store.fetch(p1.nextCursor, 3);
show(2, p2);
show(3, store.fetch(p2.nextCursor, 3));
console.log("offset page 2 after insert: " + ids(store.fetchByOffset(3, 3)) + " (105 repeated)");
try {
  store.fetch("!!!", 3);
} catch (e) {
  console.log("bad cursor: " + e.message);
}
`,
      go: String.raw`package main

import (
	"encoding/base64"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

type Order struct {
	ID        int64
	CreatedAt int64
}

type Cursor struct {
	CreatedAt int64
	ID        int64
}

type Page struct {
	Items      []Order
	NextCursor string // "" means no more pages
}

var errBadCursor = errors.New("invalid cursor")

// Encode makes an opaque cursor: base64url("createdAt:id") without padding.
func Encode(c Cursor) string {
	raw := fmt.Sprintf("%d:%d", c.CreatedAt, c.ID)
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func Decode(token string) (Cursor, error) {
	b, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return Cursor{}, errBadCursor
	}
	parts := strings.Split(string(b), ":")
	if len(parts) != 2 {
		return Cursor{}, errBadCursor
	}
	ts, err1 := strconv.ParseInt(parts[0], 10, 64)
	id, err2 := strconv.ParseInt(parts[1], 10, 64)
	if err1 != nil || err2 != nil {
		return Cursor{}, errBadCursor
	}
	return Cursor{ts, id}, nil
}

// after: SQL equivalent is
// WHERE (created_at, id) < (:ts, :id) ORDER BY created_at DESC, id DESC LIMIT :n
func after(o Order, c Cursor) bool {
	return o.CreatedAt < c.CreatedAt || (o.CreatedAt == c.CreatedAt && o.ID < c.ID)
}

type OrderStore struct{ orders []Order }

func (s *OrderStore) Add(o Order) {
	s.orders = append(s.orders, o)
	sort.Slice(s.orders, func(i, j int) bool { // newest first, id breaks ties
		a, b := s.orders[i], s.orders[j]
		if a.CreatedAt != b.CreatedAt {
			return a.CreatedAt > b.CreatedAt
		}
		return a.ID > b.ID
	})
}

func (s *OrderStore) Fetch(cursor string, limit int) (Page, error) {
	var c *Cursor
	if cursor != "" {
		dc, err := Decode(cursor)
		if err != nil {
			return Page{}, err
		}
		c = &dc
	}
	out := []Order{}
	for _, o := range s.orders { // a database would seek straight to the cursor via an index
		if c != nil && !after(o, *c) {
			continue
		}
		out = append(out, o)
		if len(out) == limit+1 { // fetch one extra to learn if more exist
			break
		}
	}
	if len(out) <= limit {
		return Page{Items: out}, nil
	}
	items := out[:limit]
	last := items[limit-1]
	return Page{Items: items, NextCursor: Encode(Cursor{last.CreatedAt, last.ID})}, nil
}

func (s *OrderStore) FetchByOffset(offset, limit int) []Order {
	lo, hi := min(offset, len(s.orders)), min(offset+limit, len(s.orders))
	return s.orders[lo:hi]
}

func ids(list []Order) string {
	parts := make([]string, len(list))
	for i, o := range list {
		parts[i] = strconv.FormatInt(o.ID, 10)
	}
	return "[" + strings.Join(parts, " ") + "]"
}

func show(n int, p Page) {
	next := p.NextCursor
	if next == "" {
		next = "<end>"
	}
	fmt.Printf("page %d: %s next=%s\n", n, ids(p.Items), next)
}

func main() {
	store := &OrderStore{}
	seed := [][2]int64{{101, 1700000000}, {102, 1700000060}, {103, 1700000060}, {104, 1700000120},
		{105, 1700000180}, {106, 1700000180}, {107, 1700000240}}
	for _, s := range seed {
		store.Add(Order{ID: s[0], CreatedAt: s[1]})
	}

	p1, _ := store.Fetch("", 3)
	show(1, p1)
	store.Add(Order{ID: 108, CreatedAt: 1700000300})
	fmt.Println("new order 108 arrives")
	p2, _ := store.Fetch(p1.NextCursor, 3)
	show(2, p2)
	p3, _ := store.Fetch(p2.NextCursor, 3)
	show(3, p3)
	fmt.Printf("offset page 2 after insert: %s (105 repeated)\n", ids(store.FetchByOffset(3, 3)))
	if _, err := store.Fetch("!!!", 3); err != nil {
		fmt.Println("bad cursor:", err)
	}
}
`,
    },
  },
  diagrams: {
    landscape: String.raw`flowchart LR
      P["Partner / public client"] -->|"REST + JSON"| GW["API gateway"]
      M["Mobile and web apps"] -->|"GraphQL or REST"| BFF["BFF"]
      GW -->|gRPC| O["Order service"]
      BFF -->|gRPC| O
      BFF -->|gRPC| R["Restaurant service"]
      O -->|gRPC| PAY["Payment service"]
      O -.->|"events (Kafka)"| N["Notification service"]
      EXT["Payment provider"] -->|"webhook POST"| GW`,
    dataloader: String.raw`sequenceDiagram
      participant G as GraphQL server
      participant L as DataLoader
      participant DB as Restaurant DB
      G->>L: load(9), load(4), load(9) ... 20 calls
      Note over L: collect ids in the same tick, dedupe
      L->>DB: SELECT * FROM restaurants WHERE id IN (9, 4, ...)
      DB-->>L: rows
      L-->>G: resolve each load() from the batch`,
    grpc: String.raw`flowchart LR
      PROTO["order.proto"] --> GEN["protoc codegen"]
      GEN --> CS["Client stub (Go)"]
      GEN --> SS["Server stub (Java)"]
      CS -->|"Protobuf over HTTP/2 (multiplexed)"| SS`,
  },
});
