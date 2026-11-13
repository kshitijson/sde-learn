SD.register({
  id: "api-design",
  html: String.raw`
<p class="lead">API design is choosing the contract other code will depend on for years: the URLs, methods, request and response shapes, error format, pagination, versioning and safety rules like idempotency keys and rate limits. In an LLD or machine-coding round you are often asked to "expose this as an API" after the classes are done. A good answer names resources cleanly, uses HTTP methods and status codes correctly, makes retries safe, and never breaks old clients. This page is the practical checklist, ending with the full API for a ride-booking flow and a working idempotency-key store in five languages.</p>
<p>Choosing between REST, GraphQL and gRPC, and the details of offset vs cursor pagination, are covered in <a href="#/p/api-styles">API styles</a>. Here we assume a JSON-over-HTTP REST API, which is what most LLD rounds expect.</p>

<h2>Anatomy of a good API call</h2>
<div data-diagram="anatomy" data-caption="A request passes through auth, rate limiting and validation before business logic; every response has a status code, consistent body and useful headers."></div>
<pre><code>POST /v1/orders HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
Content-Type: application/json
Idempotency-Key: 6f1c2a9e-1b7d-4c55-9a51-3d2f0f6f8a10

{ "restaurantId": "10", "items": [{ "menuItemId": "77", "qty": 2 }], "paymentMethod": "UPI" }

HTTP/1.1 201 Created
Location: /v1/orders/7210985542
Content-Type: application/json
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97

{ "id": "7210985542", "status": "PAYMENT_PENDING", "totalPaise": 57800,
  "currency": "INR", "createdAt": "2026-11-13T08:15:02Z" }</code></pre>

<h2>Resource modelling and URL naming</h2>
<p>Start from the nouns in your class diagram (see <a href="#/p/uml">UML</a>): each important entity is a <strong>resource</strong> with a collection URL and an item URL. The HTTP method is the verb, so URLs contain nouns only.</p>
<table>
<thead><tr><th>Rule</th><th>Good</th><th>Bad</th></tr></thead>
<tbody>
<tr><td>Plural nouns for collections</td><td><code>GET /v1/orders</code>, <code>GET /v1/orders/501</code></td><td><code>GET /v1/getOrders</code>, <code>/v1/order/501</code></td></tr>
<tr><td>Verbs come from the method</td><td><code>DELETE /v1/cart/items/9</code></td><td><code>POST /v1/deleteCartItem?id=9</code></td></tr>
<tr><td>Nest only to show ownership, at most one level</td><td><code>GET /v1/orders/501/items</code></td><td><code>/v1/customers/1/orders/501/items/3/addons</code></td></tr>
<tr><td>Lower-case, hyphens in paths</td><td><code>/v1/fare-estimates</code></td><td><code>/v1/FareEstimates</code>, <code>/v1/fare_estimates</code></td></tr>
<tr><td>Filters in the query string</td><td><code>GET /v1/orders?status=DELIVERED</code></td><td><code>GET /v1/orders/delivered</code></td></tr>
<tr><td>"Me" for the caller's own data</td><td><code>GET /v1/me/orders</code></td><td>Trusting a <code>customerId</code> sent by the client</td></tr>
</tbody>
</table>
<h3>Actions that are not CRUD</h3>
<p>Some operations do not fit create, read, update and delete: cancel an order, accept a ride, refund a payment. Two accepted styles:</p>
<ul>
<li><strong>A sub-resource action</strong>: <code>POST /v1/orders/501/cancel</code>. Short and readable; most real APIs (Stripe, Razorpay, GitHub) do this.</li>
<li><strong>Create a new resource</strong> that represents the action: <code>POST /v1/refunds</code> with <code>{"paymentId": "..."}</code>. Best when the action has its own life (a refund has a status, an id and can fail later).</li>
</ul>
<p>Avoid <code>PATCH /v1/orders/501 {"status": "CANCELLED"}</code> for business transitions: it lets clients set any status, and cancelling usually has side effects (refunds, notifications) that a generic field update hides.</p>

<h2>HTTP methods and idempotency</h2>
<table>
<thead><tr><th>Method</th><th>Use</th><th>Safe</th><th>Idempotent</th><th>Typical success</th></tr></thead>
<tbody>
<tr><td>GET</td><td>Read one or a list</td><td>Yes</td><td>Yes</td><td>200</td></tr>
<tr><td>POST</td><td>Create, or run an action</td><td>No</td><td><strong>No</strong> (make it so with a key)</td><td>201 + <code>Location</code>, or 202</td></tr>
<tr><td>PUT</td><td>Replace the whole resource at a known URL</td><td>No</td><td>Yes</td><td>200 or 204</td></tr>
<tr><td>PATCH</td><td>Change some fields</td><td>No</td><td>Not guaranteed</td><td>200</td></tr>
<tr><td>DELETE</td><td>Remove</td><td>No</td><td>Yes</td><td>204 (and 204 or 404 on repeat)</td></tr>
</tbody>
</table>
<p><strong>Safe</strong> means no state change. <strong>Idempotent</strong> means sending the same request twice has the same effect as sending it once. This matters because networks fail in the worst way: the request reached the server and was processed, but the response was lost. The client cannot tell, so it retries. Retrying a GET, PUT or DELETE is harmless. Retrying <code>POST /payments</code> charges the customer twice. The fix is an idempotency key, below. Retries and timeouts on the wire are covered in <a href="#/p/http-versions">HTTP versions</a>.</p>

<h2>Status codes</h2>
<table>
<thead><tr><th>Code</th><th>Name</th><th>Use it when</th><th>Client should</th></tr></thead>
<tbody>
<tr><td>200</td><td>OK</td><td>Successful read or update with a body</td><td>Use the body</td></tr>
<tr><td>201</td><td>Created</td><td>A POST created a resource; send <code>Location</code></td><td>Store the new id</td></tr>
<tr><td>202</td><td>Accepted</td><td>Work queued, not done yet (report generation, bulk upload)</td><td>Poll the status URL or wait for a webhook</td></tr>
<tr><td>204</td><td>No Content</td><td>Success with nothing to return (DELETE)</td><td>Nothing</td></tr>
<tr><td>400</td><td>Bad Request</td><td>Malformed JSON, wrong types, missing required field</td><td>Fix the request; do not retry</td></tr>
<tr><td>401</td><td>Unauthorized</td><td>No token, or the token is invalid or expired</td><td>Refresh the token or log in</td></tr>
<tr><td>403</td><td>Forbidden</td><td>Valid identity, but not allowed (another user's order)</td><td>Do not retry</td></tr>
<tr><td>404</td><td>Not Found</td><td>No such resource (also used instead of 403 to hide that it exists)</td><td>Do not retry</td></tr>
<tr><td>409</td><td>Conflict</td><td>State clash: cancelling a delivered order, reused idempotency key, duplicate create</td><td>Re-read state, then decide</td></tr>
<tr><td>412</td><td>Precondition Failed</td><td><code>If-Match</code> ETag no longer matches (someone else edited it)</td><td>Re-read and re-apply the change</td></tr>
<tr><td>422</td><td>Unprocessable Content</td><td>Valid shape, fails business rules (qty 0, restaurant closed)</td><td>Show the error to the user</td></tr>
<tr><td>429</td><td>Too Many Requests</td><td>Rate limited; send <code>Retry-After</code></td><td>Wait, then retry with backoff</td></tr>
<tr><td>500</td><td>Internal Server Error</td><td>A bug or unexpected failure</td><td>Retry only if idempotent, with backoff</td></tr>
<tr><td>502 / 503 / 504</td><td>Bad Gateway / Unavailable / Gateway Timeout</td><td>Upstream down, overloaded, or too slow</td><td>Retry with exponential backoff and jitter</td></tr>
</tbody>
</table>
<div class="callout warn"><strong>Never return 200 with an error inside</strong>A <code>200 OK</code> with <code>{"success": false}</code> hides failures from load balancers, monitoring dashboards, retries and caches. Use the right 4xx or 5xx code and put details in the body.</div>

<h2>Request and response shapes</h2>
<ul>
<li><strong>One naming style</strong> for JSON fields across the whole API: <code>camelCase</code> or <code>snake_case</code> (Razorpay and Stripe use snake_case). Never mix.</li>
<li><strong>IDs as strings</strong>. JavaScript numbers lose precision above 2<sup>53</sup>, so a 64-bit Snowflake id like <code>7210985542123456789</code> gets silently corrupted in a browser. Strings also let you change the id format later.</li>
<li><strong>Money</strong> as an integer in the smallest unit plus a currency: <code>"amountPaise": 57800, "currency": "INR"</code>. Never a float (see <a href="#/p/schema-design">schema design</a>).</li>
<li><strong>Timestamps</strong> as ISO-8601 strings in UTC: <code>"2026-11-13T08:15:02Z"</code>.</li>
<li><strong>Enums</strong> as upper-case strings (<code>"OUT_FOR_DELIVERY"</code>), never magic numbers. Document that new values may be added.</li>
<li><strong>Return the created or updated resource</strong> from POST, PUT and PATCH, so the client does not need a second GET.</li>
<li><strong>Do not wrap everything</strong> in <code>{"data": ..., "success": true}</code>; the status code already says success. A wrapper is fine for lists that need pagination metadata.</li>
</ul>
<h3>Error format: problem details</h3>
<p>Every error from every endpoint should have the same shape, so clients can write one error handler. The standard is <strong>Problem Details for HTTP APIs</strong> (RFC 7807, updated as RFC 9457), with content type <code>application/problem+json</code>.</p>
<pre><code>HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json

{
  "type": "https://api.example.com/problems/restaurant-closed",
  "title": "Restaurant is closed",
  "status": 422,
  "detail": "Punjabi Dhaba stops taking orders at 23:00 IST.",
  "instance": "/v1/orders",
  "code": "RESTAURANT_CLOSED",
  "traceId": "4bf92f3577b34da6",
  "errors": [
    { "field": "restaurantId", "message": "restaurant 10 is closed" }
  ]
}</code></pre>
<p><code>type</code>, <code>title</code>, <code>status</code>, <code>detail</code> and <code>instance</code> are the standard fields. You may add your own: a stable machine-readable <code>code</code> that clients switch on (never parse <code>detail</code> text), a <code>traceId</code> for support tickets, and a per-field <code>errors</code> list for forms. Never leak stack traces or SQL in errors.</p>

<h2>Pagination, filtering and sorting</h2>
<p>Any endpoint that returns a list must be paginated from day one, with a default and maximum page size (say 20 and 100). Adding pagination later breaks every client that expected the full list.</p>
<div class="grid-2">
<div class="card"><strong>Offset</strong><p><code>?limit=20&amp;offset=40</code>. Simple, supports "jump to page 7". But the database still reads and skips 40 rows, and inserts shift pages so users see duplicates or miss items. Fine for small admin tables.</p></div>
<div class="card"><strong>Cursor</strong><p><code>?limit=20&amp;cursor=eyJ0IjoiMjAy...</code>. The cursor encodes the last item seen (for example its <code>created_at</code> and <code>id</code>). Fast at any depth and stable under inserts. The default for feeds and order history.</p></div>
</div>
<pre><code>GET /v1/me/orders?status=DELIVERED&amp;sort=-createdAt&amp;limit=20&amp;cursor=eyJ0IjoiMjAyNi0xMS0xMlQxMDowMDowMFoiLCJpZCI6IjcyMTAifQ

200 OK
{
  "items": [ { "id": "7209", "status": "DELIVERED", "totalPaise": 45900, "createdAt": "2026-11-12T09:41:10Z" } ],
  "nextCursor": "eyJ0IjoiMjAyNi0xMS0xMlQwOTo0MToxMFoiLCJpZCI6IjcyMDkifQ",
  "hasMore": true
}</code></pre>
<p>The full comparison and the SQL behind cursor pagination are on the <a href="#/p/api-styles">API styles</a> page. For filters and sorting:</p>
<ul>
<li>Filters are plain query parameters: <code>?status=DELIVERED&amp;restaurantId=10&amp;createdAfter=2026-11-01T00:00:00Z</code>.</li>
<li>Sorting uses one parameter with a minus for descending: <code>?sort=-createdAt,totalPaise</code>.</li>
<li><strong>Whitelist</strong> filterable and sortable fields, and make sure each allowed combination has an index (see <a href="#/p/indexing">indexing</a>). Letting clients sort by any column is how one dashboard brings down a database.</li>
<li>Make the cursor <strong>opaque</strong> (base64 of JSON, ideally signed) so clients cannot build or edit it, and tie it to the same filters and sort.</li>
</ul>

<h2>Versioning</h2>
<table>
<thead><tr><th>Strategy</th><th>Looks like</th><th>Pros</th><th>Cons</th></tr></thead>
<tbody>
<tr><td>URL path</td><td><code>/v1/orders</code>, <code>/v2/orders</code></td><td>Obvious, easy to route and cache, easy to test with curl</td><td>Whole-API version jumps; v1 and v2 code paths live side by side</td></tr>
<tr><td>Header</td><td><code>Api-Version: 2</code></td><td>Clean URLs</td><td>Invisible in logs and links; easy to forget</td></tr>
<tr><td>Media type</td><td><code>Accept: application/vnd.example.v2+json</code></td><td>Purist REST</td><td>Awkward for clients and tools</td></tr>
<tr><td>Date-based</td><td><code>Stripe-Version: 2024-06-20</code></td><td>Each account is pinned to the version it signed up on; the server translates old shapes</td><td>Needs a translation layer per change; heavy to build</td></tr>
</tbody>
</table>
<p>Most teams use a major version in the URL (<code>/v1</code>) and evolve inside it with backward-compatible changes. A new major version is a rare, planned event with a long overlap period.</p>
<h3>Backward-compatibility rules</h3>
<div class="grid-2">
<div class="card good"><strong>Safe (no new version needed)</strong>
<ul>
<li>Add a new endpoint</li>
<li>Add an optional request field with a sensible default</li>
<li>Add a response field</li>
<li>Add a new enum value, if you documented that clients must ignore unknown ones</li>
<li>Relax a validation (allow longer names)</li>
</ul></div>
<div class="card bad"><strong>Breaking (needs a new version)</strong>
<ul>
<li>Remove or rename a field or endpoint</li>
<li>Change a field's type (<code>"id": 42</code> to <code>"id": "42"</code>)</li>
<li>Make an optional field required</li>
<li>Change the meaning of a field or a default</li>
<li>Change status codes or error codes clients rely on</li>
</ul></div>
</div>
<p>Clients should follow the <strong>tolerant reader</strong> rule: ignore fields they do not know. Mobile apps make this critical, because users in India run app versions that are months old, so an API change must keep working for every version still in the field. When retiring something, announce it, send <code>Deprecation</code> and <code>Sunset</code> headers, and watch traffic until it reaches zero.</p>

<h2>Idempotency keys for POST</h2>
<p>A customer taps "Pay ₹578" on a train going into a tunnel. The request reaches the server, the payment succeeds, the response is lost, and the app retries. Without protection, the customer pays twice. Razorpay, Stripe, PayPal and most payment APIs solve this with an <strong>idempotency key</strong>: a unique value (usually a UUID) the client generates once per logical operation and sends as a header on the first attempt and every retry.</p>
<ol class="steps">
<li>The client creates a key when the user taps "Pay" and stores it with the pending operation. Retries reuse the same key; a new purchase gets a new key.</li>
<li>The server looks up the key (scoped to the caller, so two merchants cannot collide). If it is new, it records the key as <strong>in progress</strong> along with a hash of the request body, then runs the operation.</li>
<li>When done, it stores the response (status and body) against the key, typically for 24 hours.</li>
<li>A retry with the same key and same body gets the <strong>stored response</strong>, without running the operation again.</li>
<li>The same key with a <strong>different body</strong> is a client bug: reject with 409 (or 422). A retry that arrives while the first is still running also gets 409, and the client tries again shortly.</li>
<li>If the operation failed with a server error before doing anything, delete the key so the client can retry safely.</li>
</ol>
<div data-diagram="idemSeq" data-caption="The response is lost; the retry with the same key gets the saved response and no second charge."></div>
<div data-diagram="idemState" data-caption="Life of an idempotency key on the server."></div>
<p>Here is the core of that store. <code>handle(key, requestHash, fn)</code> runs <code>fn</code> at most once per key, replays the saved response on retries, rejects a reused key with a different payload, and forgets keys whose attempt failed with a 5xx so they can be retried. The lock is held only while reading and writing the map, never while the operation runs.</p>
<div data-code="idem"></div>
<div class="callout info"><strong>Making it production-grade</strong>Store keys in Redis (<code>SET key value NX EX 86400</code> is an atomic "insert if absent with expiry") or in a database table with a unique constraint on <code>(merchant_id, idempotency_key)</code>, written in the same transaction as the payment row so the two can never disagree. Hash the canonical request body with SHA-256. For idempotent consumers of queued messages, see <a href="#/p/message-queues">message queues</a>.</div>

<h2>Rate-limit headers</h2>
<p>Every public API needs rate limits, usually per API key or per user, enforced at the gateway (algorithms in <a href="#/p/api-gateway-rate-limiting">API gateways and rate limiting</a>). Tell clients where they stand on every response so they can slow down before being blocked:</p>
<pre><code>HTTP/1.1 200 OK
X-RateLimit-Limit: 100          # requests allowed per window
X-RateLimit-Remaining: 12       # left in the current window
X-RateLimit-Reset: 1794555360   # when the window resets (Unix seconds)

HTTP/1.1 429 Too Many Requests
Retry-After: 30
Content-Type: application/problem+json

{ "type": "https://api.example.com/problems/rate-limited", "title": "Too many requests", "status": 429 }</code></pre>
<p>An IETF draft standardises these as <code>RateLimit-Limit</code>, <code>RateLimit-Remaining</code> and <code>RateLimit-Reset</code>, but the <code>X-</code> versions are still the most common. Expensive endpoints (search, OTP sending) get stricter limits than cheap ones, and OTP endpoints should also limit per phone number to stop SMS-cost abuse.</p>

<h2>Authentication basics</h2>
<table>
<thead><tr><th>Method</th><th>How it works</th><th>Use for</th></tr></thead>
<tbody>
<tr><td>API key + secret</td><td>A long random secret sent on every call, often as HTTP Basic auth (<code>key_id:key_secret</code>, as Razorpay does) over HTTPS</td><td>Server-to-server: a merchant's backend calling a payment API. Never ship it in a mobile app or web page.</td></tr>
<tr><td>OAuth 2.0 access token</td><td>The user logs in once; the app gets a short-lived access token (5 to 60 minutes) and a long-lived refresh token</td><td>Mobile and web apps acting for a user; third-party apps acting with the user's permission ("Login with Google")</td></tr>
<tr><td>JWT (JSON Web Token)</td><td>A signed token that carries claims (<code>sub</code>, <code>exp</code>, scopes); any service can verify the signature without a database lookup</td><td>A common <em>format</em> for access tokens. Keep them short-lived because they are hard to revoke early.</td></tr>
<tr><td>Webhook signatures</td><td>The provider signs the webhook body with HMAC using a shared secret; you verify before trusting it</td><td>Payment-success callbacks from a gateway</td></tr>
</tbody>
</table>
<p>Always HTTPS. Send credentials in the <code>Authorization</code> header, never in the URL (URLs end up in logs and browser history). Authentication says <em>who</em> is calling; you still need <strong>authorisation</strong> on every resource: "does this user own order 501?" Missing that check (called IDOR, insecure direct object reference) is one of the most common real API bugs.</p>

<h2>End to end: a ride-booking API</h2>
<p>Design the API for an Uber or Ola style app: a rider gets a fare estimate, books a ride, a nearby driver accepts, starts the ride with an OTP, completes it, and the rider pays and rates. Two client apps (rider, driver) talk to the same backend.</p>
<table>
<thead><tr><th>Step</th><th>Endpoint</th><th>Request</th><th>Response</th></tr></thead>
<tbody>
<tr><td>Fare estimate</td><td><code>POST /v1/fare-estimates</code></td><td>pickup, drop (lat/lng), vehicle type</td><td>201: <code>estimateId</code>, <code>farePaise</code>, surge, <code>expiresAt</code> (2 min)</td></tr>
<tr><td>Book</td><td><code>POST /v1/rides</code> + <code>Idempotency-Key</code></td><td><code>estimateId</code>, payment method</td><td>201: ride <code>id</code>, status <code>SEARCHING</code></td></tr>
<tr><td>Track (rider)</td><td><code>GET /v1/rides/{id}</code></td><td>(none)</td><td>200: status, driver, vehicle, ETA, OTP; live location over WebSocket</td></tr>
<tr><td>Driver location</td><td>WebSocket or <code>PUT /v1/drivers/me/location</code></td><td>lat, lng, heading every 4 s</td><td>204</td></tr>
<tr><td>Offer to driver</td><td>Push / WebSocket message</td><td>ride offer with a 15 s timeout</td><td>(server to driver)</td></tr>
<tr><td>Accept</td><td><code>POST /v1/ride-offers/{offerId}/accept</code></td><td>(none)</td><td>200: ride details, or 409 if another driver got it or the offer expired</td></tr>
<tr><td>Start</td><td><code>POST /v1/rides/{id}/start</code></td><td><code>otp</code></td><td>200: status <code>IN_PROGRESS</code>; 422 if the OTP is wrong</td></tr>
<tr><td>Complete</td><td><code>POST /v1/rides/{id}/complete</code></td><td>final odometer / route summary</td><td>200: final <code>farePaise</code></td></tr>
<tr><td>Cancel</td><td><code>POST /v1/rides/{id}/cancel</code></td><td><code>reason</code></td><td>200 with cancellation fee, or 409 if already completed</td></tr>
<tr><td>Pay</td><td><code>POST /v1/rides/{id}/payments</code> + <code>Idempotency-Key</code></td><td>method</td><td>201 payment, or 202 if the UPI collect request is pending</td></tr>
<tr><td>Rate</td><td><code>PUT /v1/rides/{id}/rating</code></td><td><code>stars</code>, comment</td><td>200 (PUT, so re-rating simply replaces it)</td></tr>
<tr><td>History</td><td><code>GET /v1/me/rides?cursor=...&amp;limit=20</code></td><td>(none)</td><td>200: page of rides + <code>nextCursor</code></td></tr>
</tbody>
</table>
<div data-diagram="rideSeq" data-caption="Booking a ride end to end. Sync calls for what the user waits on; driver offers and status updates are pushed."></div>
<p>Design choices worth pointing out:</p>
<ul>
<li><strong>The fare estimate is its own resource</strong> with an expiry. Booking references <code>estimateId</code>, so the rider pays the price they were shown, and the server never trusts a fare sent by the client.</li>
<li><strong>Accepting is a conditional state change</strong>. Two drivers tapping "accept" at once both call the endpoint; the server does a compare-and-set on the ride status, one gets 200 and the other gets 409. The same trick appears in the <a href="#/p/schema-design">schema design</a> page's <code>UPDATE ... WHERE status = ...</code>.</li>
<li><strong>Only the right party can call each endpoint</strong>: only the assigned driver can start or complete a ride, only the rider can rate the driver. Check it on every call.</li>
<li><strong>High-frequency location updates</strong> do not go through the normal REST path in production; they use a WebSocket or a lightweight UDP/MQTT channel (see <a href="#/p/realtime">real-time communication</a>).</li>
</ul>
<p>A food-order flow has the same shape: <code>POST /v1/carts/{id}/checkout</code> (or <code>POST /v1/orders</code>) with an idempotency key, <code>GET /v1/orders/{id}</code> for status, <code>POST /v1/orders/{id}/cancel</code>, and restaurant-side <code>POST /v1/orders/{id}/accept</code> and <code>/ready</code> actions guarded by the order state machine shown on the <a href="#/p/uml">UML</a> page.</p>

<h2>Pitfalls and interview tips</h2>
<div class="grid-2">
<div class="card bad"><strong>Common mistakes</strong>
<ul>
<li>Verbs in URLs (<code>/createOrder</code>) and inconsistent naming.</li>
<li><code>200 OK</code> with an error body.</li>
<li>Unpaginated list endpoints.</li>
<li>Numbers for 64-bit ids, floats for money, local times.</li>
<li>Trusting client-sent prices, user ids or roles.</li>
<li>No idempotency on payment or order creation.</li>
<li>Renaming a field "because it reads better" and breaking old app versions.</li>
</ul></div>
<div class="card good"><strong>What scores well</strong>
<ul>
<li>A table of endpoints with method, path, request, response and status codes.</li>
<li>Idempotency keys on every POST that moves money or creates orders.</li>
<li>One error format everywhere.</li>
<li>Cursor pagination with a max page size.</li>
<li>Explicit authorisation checks and rate limits.</li>
<li>A sentence on versioning and backward compatibility.</li>
</ul></div>
</div>
<div class="callout interview"><strong>Say this in the interview</strong>"Resources are rides, fare estimates, payments and ratings. Booking is <code>POST /v1/rides</code> with an <code>Idempotency-Key</code> header so a retry after a timeout cannot create two rides; a retry gets the stored response, and the same key with a different body gets a 409. State changes like accept, start and cancel are action endpoints that check the current state atomically and return 409 on a clash. Errors use one <code>problem+json</code> shape with a stable code. Lists are cursor-paginated, ids are strings, money is in paise, times are UTC. We version in the path and only make additive changes within <code>v1</code>."</div>

<h2>Test yourself</h2>
<div class="quiz">
<details><summary>A client sends <code>POST /v1/payments</code>, times out and retries. How does the server avoid charging twice?</summary><div>The client sends the same <code>Idempotency-Key</code> header on both attempts. The server stores the key with a hash of the body and the final response. The retry finds the key with a matching hash and returns the stored response without charging again. If the first attempt is still running, the retry gets 409 and tries again shortly.</div></details>
<details><summary>Same idempotency key, different amount. What should the server do and why?</summary><div>Reject it (409 Conflict, or 422) and do nothing. A key identifies one logical operation; a different payload means the client reused a key by mistake. Silently replaying the old response would hide a bug, and running the new one would break the guarantee.</div></details>
<details><summary>Which status codes for: wrong OTP on ride start; token expired; ride already completed when the rider taps cancel; too many OTP requests?</summary><div>Wrong OTP: <strong>422</strong> (valid request, fails a business rule; some APIs use 400). Expired token: <strong>401</strong>. Cancel after completion: <strong>409</strong> (conflicts with current state). Too many OTP requests: <strong>429</strong> with <code>Retry-After</code>.</div></details>
<details><summary>Is adding a new value <code>"REFUND_PENDING"</code> to the order status enum a breaking change?</summary><div>It depends on what you promised. If clients were told to treat unknown enum values gracefully (tolerant reader), it is additive and safe. If an old app version uses an exhaustive switch and crashes on an unknown value, it breaks those users. Document from day one that enums can grow, and test old app versions against new values.</div></details>
<details><summary>Why return 64-bit ids as strings in JSON?</summary><div>JavaScript numbers are 64-bit floats with only 53 bits of integer precision, so ids above 2<sup>53</sup> (about 9 quadrillion), such as Snowflake ids, get rounded silently in browsers and React Native apps. Strings are exact and also let you change the id format later.</div></details>
<details><summary>Offset or cursor pagination for a customer's order history with infinite scroll?</summary><div>Cursor. It stays fast however far the user scrolls (the database seeks with <code>WHERE (created_at, id) &lt; (?, ?)</code> using the index instead of skipping rows) and new orders arriving at the top do not shift pages and cause duplicates. Offset is fine for small admin tables where "jump to page 7" matters.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
<li>URLs are plural nouns; the HTTP method is the verb. Use action sub-resources (<code>/cancel</code>) for business transitions.</li>
<li>GET, PUT and DELETE are idempotent; POST is not, so protect money-moving POSTs with an idempotency key (replay on match, 409 on mismatch or in-progress).</li>
<li>Use precise status codes and one error format (<code>application/problem+json</code>) with a stable machine-readable code.</li>
<li>IDs as strings, money as integer paise with a currency, timestamps in UTC ISO-8601, enums as strings.</li>
<li>Paginate every list (cursor by default), whitelist filters and sorts that have indexes.</li>
<li>Version in the path, evolve additively, never remove or rename within a version; clients ignore unknown fields.</li>
<li>Rate-limit headers and 429 with <code>Retry-After</code>; API keys for servers, short-lived OAuth/JWT tokens for users, authorisation on every resource.</li>
</ul></div>
`,
  code: {
    idem: {
      title: "Idempotency-key store: run once, replay on retry, 409 on misuse",
      java: String.raw`import java.util.HashMap;
import java.util.Map;
import java.util.function.Supplier;

public class Main {
    record Response(int status, String body, boolean replayed) {
        Response replay() { return new Response(status, body, true); }
    }

    static final class IdempotencyStore {
        private static final class Entry {
            final String requestHash;
            Response response; // null while the first request is still running
            Entry(String requestHash) { this.requestHash = requestHash; }
        }

        private final Map<String, Entry> entries = new HashMap<>();

        Response handle(String key, String requestHash, Supplier<Response> fn) {
            synchronized (this) {
                Entry e = entries.get(key);
                if (e != null) {
                    if (!e.requestHash.equals(requestHash))
                        return new Response(409, "Idempotency-Key reused with a different payload", false);
                    if (e.response == null)
                        return new Response(409, "a request with this key is still in progress", false);
                    return e.response.replay();
                }
                entries.put(key, new Entry(requestHash)); // claim the key
            }

            Response r = fn.get(); // run outside the lock

            synchronized (this) {
                if (r.status() >= 500) entries.remove(key); // nothing happened: allow a retry
                else entries.get(key).response = r;
            }
            return r;
        }
    }

    static int charges = 0;
    static boolean gatewayDown = false;

    static Supplier<Response> charge(long amountPaise) {
        return () -> {
            if (gatewayDown) return new Response(503, "payment gateway unavailable", false);
            charges++;
            return new Response(201, "pay_" + charges + " amount=" + amountPaise, false);
        };
    }

    static void show(String label, Response r) {
        System.out.println(label + " -> " + r.status() + " " + r.body() + " (replayed=" + r.replayed() + ")");
    }

    public static void main(String[] args) {
        IdempotencyStore store = new IdempotencyStore();
        String h1 = "amount=50000|currency=INR";

        show("1. k-101 first try ", store.handle("k-101", h1, charge(50000)));
        show("2. k-101 retry     ", store.handle("k-101", h1, charge(50000)));
        show("3. k-101 new amount", store.handle("k-101", "amount=90000|currency=INR", charge(90000)));

        String h2 = "amount=12000|currency=INR";
        gatewayDown = true;
        show("4. k-102 gateway down", store.handle("k-102", h2, charge(12000)));
        gatewayDown = false;
        show("5. k-102 retry       ", store.handle("k-102", h2, charge(12000)));

        String h3 = "amount=7500|currency=INR";
        Response outer = store.handle("k-103", h3, () -> {
            // a duplicate arrives while the first request is still running
            show("6. k-103 duplicate during first", store.handle("k-103", h3, charge(7500)));
            return charge(7500).get();
        });
        show("7. k-103 first finishes        ", outer);

        System.out.println("total charges made: " + charges);
    }
}
`,
      python: String.raw`import threading
from dataclasses import dataclass, replace
from typing import Callable, Optional


@dataclass(frozen=True)
class Response:
    status: int
    body: str
    replayed: bool = False


class _Entry:
    def __init__(self, request_hash: str):
        self.request_hash = request_hash
        self.response: Optional[Response] = None  # None while still running


class IdempotencyStore:
    def __init__(self):
        self._entries: dict[str, _Entry] = {}
        self._lock = threading.Lock()

    def handle(self, key: str, request_hash: str, fn: Callable[[], Response]) -> Response:
        with self._lock:
            e = self._entries.get(key)
            if e is not None:
                if e.request_hash != request_hash:
                    return Response(409, "Idempotency-Key reused with a different payload")
                if e.response is None:
                    return Response(409, "a request with this key is still in progress")
                return replace(e.response, replayed=True)
            self._entries[key] = _Entry(request_hash)  # claim the key

        r = fn()  # run outside the lock

        with self._lock:
            if r.status >= 500:
                del self._entries[key]  # nothing happened: allow a retry
            else:
                self._entries[key].response = r
        return r


charges = 0
gateway_down = False


def charge(amount_paise: int) -> Callable[[], Response]:
    def run() -> Response:
        global charges
        if gateway_down:
            return Response(503, "payment gateway unavailable")
        charges += 1
        return Response(201, f"pay_{charges} amount={amount_paise}")
    return run


def show(label: str, r: Response) -> None:
    print(f"{label} -> {r.status} {r.body} (replayed={'true' if r.replayed else 'false'})")


def main() -> None:
    global gateway_down
    store = IdempotencyStore()
    h1 = "amount=50000|currency=INR"

    show("1. k-101 first try ", store.handle("k-101", h1, charge(50000)))
    show("2. k-101 retry     ", store.handle("k-101", h1, charge(50000)))
    show("3. k-101 new amount", store.handle("k-101", "amount=90000|currency=INR", charge(90000)))

    h2 = "amount=12000|currency=INR"
    gateway_down = True
    show("4. k-102 gateway down", store.handle("k-102", h2, charge(12000)))
    gateway_down = False
    show("5. k-102 retry       ", store.handle("k-102", h2, charge(12000)))

    h3 = "amount=7500|currency=INR"

    def first_request() -> Response:
        # a duplicate arrives while the first request is still running
        show("6. k-103 duplicate during first", store.handle("k-103", h3, charge(7500)))
        return charge(7500)()

    show("7. k-103 first finishes        ", store.handle("k-103", h3, first_request))
    print(f"total charges made: {charges}")


if __name__ == "__main__":
    main()
`,
      cpp: String.raw`#include <functional>
#include <iostream>
#include <mutex>
#include <optional>
#include <string>
#include <unordered_map>

struct Response {
    int status;
    std::string body;
    bool replayed = false;
};

class IdempotencyStore {
    struct Entry {
        std::string requestHash;
        std::optional<Response> response; // empty while the first request is still running
    };
    std::unordered_map<std::string, Entry> entries_;
    std::mutex mu_;

public:
    Response handle(const std::string& key, const std::string& requestHash,
                    const std::function<Response()>& fn) {
        {
            std::lock_guard<std::mutex> lock(mu_);
            auto it = entries_.find(key);
            if (it != entries_.end()) {
                if (it->second.requestHash != requestHash)
                    return {409, "Idempotency-Key reused with a different payload"};
                if (!it->second.response)
                    return {409, "a request with this key is still in progress"};
                Response r = *it->second.response;
                r.replayed = true;
                return r;
            }
            entries_[key] = Entry{requestHash, std::nullopt}; // claim the key
        }

        Response r = fn(); // run outside the lock

        std::lock_guard<std::mutex> lock(mu_);
        if (r.status >= 500) entries_.erase(key); // nothing happened: allow a retry
        else entries_[key].response = r;
        return r;
    }
};

int charges = 0;
bool gatewayDown = false;

std::function<Response()> charge(long long amountPaise) {
    return [amountPaise]() -> Response {
        if (gatewayDown) return {503, "payment gateway unavailable"};
        ++charges;
        return {201, "pay_" + std::to_string(charges) + " amount=" + std::to_string(amountPaise)};
    };
}

void show(const std::string& label, const Response& r) {
    std::cout << label << " -> " << r.status << " " << r.body
              << " (replayed=" << (r.replayed ? "true" : "false") << ")\n";
}

int main() {
    IdempotencyStore store;
    const std::string h1 = "amount=50000|currency=INR";

    show("1. k-101 first try ", store.handle("k-101", h1, charge(50000)));
    show("2. k-101 retry     ", store.handle("k-101", h1, charge(50000)));
    show("3. k-101 new amount", store.handle("k-101", "amount=90000|currency=INR", charge(90000)));

    const std::string h2 = "amount=12000|currency=INR";
    gatewayDown = true;
    show("4. k-102 gateway down", store.handle("k-102", h2, charge(12000)));
    gatewayDown = false;
    show("5. k-102 retry       ", store.handle("k-102", h2, charge(12000)));

    const std::string h3 = "amount=7500|currency=INR";
    Response outer = store.handle("k-103", h3, [&]() {
        // a duplicate arrives while the first request is still running
        show("6. k-103 duplicate during first", store.handle("k-103", h3, charge(7500)));
        return charge(7500)();
    });
    show("7. k-103 first finishes        ", outer);

    std::cout << "total charges made: " << charges << "\n";
    return 0;
}
`,
      javascript: String.raw`// Node runs JavaScript on one thread, so the map needs no lock as long as fn is synchronous.
// For an async fn the same "claim, run, store" steps still work, because the claim happens
// before the first await.

class IdempotencyStore {
  #entries = new Map(); // key -> { requestHash, response | null }

  handle(key, requestHash, fn) {
    const e = this.#entries.get(key);
    if (e) {
      if (e.requestHash !== requestHash)
        return { status: 409, body: "Idempotency-Key reused with a different payload", replayed: false };
      if (e.response === null)
        return { status: 409, body: "a request with this key is still in progress", replayed: false };
      return { ...e.response, replayed: true };
    }
    this.#entries.set(key, { requestHash, response: null }); // claim the key

    const r = fn();

    if (r.status >= 500) this.#entries.delete(key); // nothing happened: allow a retry
    else this.#entries.get(key).response = r;
    return r;
  }
}

let charges = 0;
let gatewayDown = false;

function charge(amountPaise) {
  return () => {
    if (gatewayDown) return { status: 503, body: "payment gateway unavailable", replayed: false };
    charges++;
    return { status: 201, body: "pay_" + charges + " amount=" + amountPaise, replayed: false };
  };
}

function show(label, r) {
  console.log(label + " -> " + r.status + " " + r.body + " (replayed=" + r.replayed + ")");
}

function main() {
  const store = new IdempotencyStore();
  const h1 = "amount=50000|currency=INR";

  show("1. k-101 first try ", store.handle("k-101", h1, charge(50000)));
  show("2. k-101 retry     ", store.handle("k-101", h1, charge(50000)));
  show("3. k-101 new amount", store.handle("k-101", "amount=90000|currency=INR", charge(90000)));

  const h2 = "amount=12000|currency=INR";
  gatewayDown = true;
  show("4. k-102 gateway down", store.handle("k-102", h2, charge(12000)));
  gatewayDown = false;
  show("5. k-102 retry       ", store.handle("k-102", h2, charge(12000)));

  const h3 = "amount=7500|currency=INR";
  const outer = store.handle("k-103", h3, () => {
    // a duplicate arrives while the first request is still running
    show("6. k-103 duplicate during first", store.handle("k-103", h3, charge(7500)));
    return charge(7500)();
  });
  show("7. k-103 first finishes        ", outer);

  console.log("total charges made: " + charges);
}

main();
`,
      go: String.raw`package main

import (
	"fmt"
	"sync"
)

type Response struct {
	Status   int
	Body     string
	Replayed bool
}

type entry struct {
	requestHash string
	response    *Response // nil while the first request is still running
}

type IdempotencyStore struct {
	mu      sync.Mutex
	entries map[string]*entry
}

func NewIdempotencyStore() *IdempotencyStore {
	return &IdempotencyStore{entries: make(map[string]*entry)}
}

func (s *IdempotencyStore) Handle(key, requestHash string, fn func() Response) Response {
	s.mu.Lock()
	if e, ok := s.entries[key]; ok {
		s.mu.Unlock()
		if e.requestHash != requestHash {
			return Response{409, "Idempotency-Key reused with a different payload", false}
		}
		if e.response == nil {
			return Response{409, "a request with this key is still in progress", false}
		}
		r := *e.response
		r.Replayed = true
		return r
	}
	s.entries[key] = &entry{requestHash: requestHash} // claim the key
	s.mu.Unlock()

	r := fn() // run outside the lock

	s.mu.Lock()
	defer s.mu.Unlock()
	if r.Status >= 500 {
		delete(s.entries, key) // nothing happened: allow a retry
	} else {
		saved := r
		s.entries[key].response = &saved
	}
	return r
}

var charges = 0
var gatewayDown = false

func charge(amountPaise int64) func() Response {
	return func() Response {
		if gatewayDown {
			return Response{503, "payment gateway unavailable", false}
		}
		charges++
		return Response{201, fmt.Sprintf("pay_%d amount=%d", charges, amountPaise), false}
	}
}

func show(label string, r Response) {
	fmt.Printf("%s -> %d %s (replayed=%v)\n", label, r.Status, r.Body, r.Replayed)
}

func main() {
	store := NewIdempotencyStore()
	h1 := "amount=50000|currency=INR"

	show("1. k-101 first try ", store.Handle("k-101", h1, charge(50000)))
	show("2. k-101 retry     ", store.Handle("k-101", h1, charge(50000)))
	show("3. k-101 new amount", store.Handle("k-101", "amount=90000|currency=INR", charge(90000)))

	h2 := "amount=12000|currency=INR"
	gatewayDown = true
	show("4. k-102 gateway down", store.Handle("k-102", h2, charge(12000)))
	gatewayDown = false
	show("5. k-102 retry       ", store.Handle("k-102", h2, charge(12000)))

	h3 := "amount=7500|currency=INR"
	outer := store.Handle("k-103", h3, func() Response {
		// a duplicate arrives while the first request is still running
		show("6. k-103 duplicate during first", store.Handle("k-103", h3, charge(7500)))
		return charge(7500)()
	})
	show("7. k-103 first finishes        ", outer)

	fmt.Printf("total charges made: %d\n", charges)
}
`,
    },
  },
  diagrams: {
    anatomy: String.raw`flowchart LR
  C[Client] -->|"HTTPS + token"| G[API gateway]
  G --> A{Auth ok?}
  A -->|no| E1["401 / 403"]
  A -->|yes| R{Under rate limit?}
  R -->|no| E2["429 + Retry-After"]
  R -->|yes| V{Valid body?}
  V -->|no| E3["400 / 422 problem+json"]
  V -->|yes| I{Idempotency key seen?}
  I -->|yes| E4[Replay saved response]
  I -->|no| B[Business logic]
  B --> OK["2xx + body + headers"]`,
    idemSeq: String.raw`sequenceDiagram
  participant App as Customer app
  participant API as Payments API
  participant Store as Key store
  participant Bank as Bank / UPI
  App->>API: POST /v1/payments, Key K1, 57800 paise
  API->>Store: claim K1 with body hash
  Store-->>API: new key, IN_PROGRESS
  API->>Bank: debit 57800
  Bank-->>API: success txn_88
  API->>Store: save K1 = 201 pay_1
  API--xApp: 201 lost in a tunnel
  Note over App: timeout, retry with the SAME key
  App->>API: POST /v1/payments, Key K1, 57800 paise
  API->>Store: lookup K1
  Store-->>API: COMPLETED, same hash, 201 pay_1
  API-->>App: 201 pay_1 (replayed, no second debit)`,
    idemState: String.raw`stateDiagram-v2
  [*] --> InProgress: first request claims key
  InProgress --> Completed: 2xx or 4xx saved
  InProgress --> [*]: 5xx, key deleted, retry allowed
  Completed --> Completed: same hash, replay saved response
  Completed --> Completed: different hash, 409
  Completed --> [*]: expires after 24 h`,
    rideSeq: String.raw`sequenceDiagram
  actor R as Rider app
  participant API as Ride API
  participant M as Matching
  actor D as Driver app
  participant P as Payments
  R->>API: POST /v1/fare-estimates
  API-->>R: 201 estimateId, 21400 paise
  R->>API: POST /v1/rides, Idempotency-Key
  API-)M: find driver near pickup
  API-->>R: 201 ride SEARCHING
  M-)D: ride offer, 15 s to accept
  D->>API: POST /v1/ride-offers/o9/accept
  alt still available
    API-->>D: 200 ride details
    API-)R: push DRIVER_ASSIGNED + OTP
  else taken or expired
    API-->>D: 409 offer no longer available
  end
  D->>API: POST /v1/rides/r1/start, otp 4821
  API-->>D: 200 IN_PROGRESS
  D->>API: POST /v1/rides/r1/complete
  API-->>D: 200 fare 23800 paise
  R->>API: POST /v1/rides/r1/payments, Idempotency-Key
  API->>P: charge 23800 via UPI
  P-->>API: success
  API-->>R: 201 payment
  R->>API: PUT /v1/rides/r1/rating
  API-->>R: 200`,
  },
});
