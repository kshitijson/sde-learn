SD.register({
  id: "object-storage",
  html: String.raw`
    <p class="lead">Object storage (Amazon S3, Google Cloud Storage, Azure Blob, MinIO) is where large, unstructured
    files live: images, videos, PDFs, backups, logs. You store a whole file (an <em>object</em>) under a key and get it
    back by that key over HTTP. It is cheap, practically infinite and extremely durable. In almost every HLD
    interview with media, the answer is "blob in object storage, metadata in a database, CDN in front".</p>

    <h2>Block vs file vs object storage</h2>
    <p>There are three ways to store bytes, and each one exposes a different interface.</p>
    <figure class="svg-fig">
      <svg viewBox="0 0 760 250">
        <rect x="20" y="20" width="220" height="210" rx="10" class="s-box"/>
        <text x="130" y="48" class="s-title" text-anchor="middle">Block</text>
        <rect x="45" y="65" width="40" height="30" rx="4" class="s-accent"/>
        <rect x="90" y="65" width="40" height="30" rx="4" class="s-accent"/>
        <rect x="135" y="65" width="40" height="30" rx="4" class="s-accent"/>
        <rect x="180" y="65" width="40" height="30" rx="4" class="s-accent"/>
        <rect x="45" y="100" width="40" height="30" rx="4" class="s-accent"/>
        <rect x="90" y="100" width="40" height="30" rx="4" class="s-accent"/>
        <rect x="135" y="100" width="40" height="30" rx="4" class="s-accent"/>
        <rect x="180" y="100" width="40" height="30" rx="4" class="s-accent"/>
        <text x="130" y="160" class="s-text" text-anchor="middle">raw fixed-size blocks</text>
        <text x="130" y="185" class="s-muted" text-anchor="middle">EBS, SAN disks</text>
        <text x="130" y="208" class="s-muted" text-anchor="middle">used by DBs, OS volumes</text>

        <rect x="270" y="20" width="220" height="210" rx="10" class="s-box"/>
        <text x="380" y="48" class="s-title" text-anchor="middle">File</text>
        <text x="300" y="80" class="s-text">/home</text>
        <text x="320" y="102" class="s-text">/docs</text>
        <text x="340" y="124" class="s-text">report.pdf</text>
        <text x="320" y="146" class="s-text">/photos</text>
        <text x="380" y="185" class="s-muted" text-anchor="middle">EFS, NFS, NAS</text>
        <text x="380" y="208" class="s-muted" text-anchor="middle">hierarchy + POSIX locks</text>

        <rect x="520" y="20" width="220" height="210" rx="10" class="s-box"/>
        <text x="630" y="48" class="s-title" text-anchor="middle">Object</text>
        <rect x="545" y="65" width="170" height="80" rx="10" class="s-green"/>
        <text x="630" y="88" class="s-text" text-anchor="middle">key: u/42/a.jpg</text>
        <text x="630" y="110" class="s-text" text-anchor="middle">data: 2.3 MB bytes</text>
        <text x="630" y="132" class="s-text" text-anchor="middle">meta: type, owner</text>
        <text x="630" y="185" class="s-muted" text-anchor="middle">S3, GCS, Azure Blob</text>
        <text x="630" y="208" class="s-muted" text-anchor="middle">flat namespace, HTTP API</text>
      </svg>
      <figcaption>Block storage hands out disk blocks, file storage gives a folder tree, object storage gives key → blob.</figcaption>
    </figure>
    <table>
      <thead><tr><th></th><th>Block</th><th>File</th><th>Object</th></tr></thead>
      <tbody>
        <tr><td>Interface</td><td>Read/write block N (mounted as a disk)</td><td>Paths, open/seek/write</td><td>HTTP PUT / GET / DELETE by key</td></tr>
        <tr><td>Update in place</td><td>Yes, any byte</td><td>Yes</td><td>No, replace the whole object</td></tr>
        <tr><td>Latency</td><td>Sub-millisecond</td><td>Low milliseconds</td><td>Tens of milliseconds (first byte)</td></tr>
        <tr><td>Scale</td><td>One machine, TBs</td><td>Shared, PBs with effort</td><td>Effectively unlimited</td></tr>
        <tr><td>Cost (rough)</td><td>Highest</td><td>High</td><td>Lowest (about $0.023/GB-month on S3 Standard)</td></tr>
        <tr><td>Use for</td><td>Databases, boot disks</td><td>Shared files across servers, legacy apps</td><td>Media, backups, logs, data lakes, static sites</td></tr>
      </tbody>
    </table>
    <div class="callout tip"><strong>Don't put files in your database</strong>Storing a 5 MB image as a BLOB column bloats
    the DB, slows backups and replication, and wastes expensive IOPS. Store the file in object storage and keep only its
    key in the DB.</div>

    <h2>How it works: buckets, keys and metadata</h2>
    <ul>
      <li>A <strong>bucket</strong> is a top-level container (globally unique name in S3), with its own region, access policy, versioning and lifecycle rules.</li>
      <li>A <strong>key</strong> is the object's full name, like <code>users/42/avatar/2024-06-01.jpg</code>. The namespace is flat; the slashes only <em>look</em> like folders, and the console fakes folders with prefix listing.</li>
      <li>The object holds the <strong>data</strong> (up to 5 TB in S3) and <strong>metadata</strong>: system fields (size, ETag/checksum, content type, last modified) plus your own <code>x-amz-meta-*</code> headers.</li>
      <li>Objects are <strong>immutable</strong>: "editing" means uploading a new version. With <strong>versioning</strong> on, old versions are kept, which protects against accidental deletes.</li>
      <li>S3 is now <strong>strongly consistent</strong> for read-after-write: once a PUT succeeds, the next GET returns the new data.</li>
    </ul>
    <p>Internally, a front-end layer authenticates the request, a metadata/index service maps the key to where its
    chunks live, and storage nodes hold the chunks spread across racks and availability zones (AZs).</p>

    <h2>Durability: 11 nines</h2>
    <p>S3 Standard is designed for <strong>99.999999999%</strong> (11 nines) durability per year. If you store 10 million
    objects, you can expect to lose one about every 10,000 years. Do not confuse this with <strong>availability</strong>
    (can I read it right now?), which is about 99.99%.</p>
    <h3>Replication vs erasure coding</h3>
    <div class="grid-2">
      <div class="card"><strong>3x replication</strong>
        <p>Keep three full copies on different machines / AZs. Simple, fast to read and to repair.</p>
        <p><strong>Overhead: 200%</strong> (1 GB costs 3 GB). Tolerates 2 lost copies.</p>
      </div>
      <div class="card"><strong>Erasure coding (for example 6 + 3)</strong>
        <p>Split data into 6 data chunks, compute 3 parity chunks (Reed-Solomon), store all 9 on different nodes. <em>Any</em> 6 of the 9 rebuild the object.</p>
        <p><strong>Overhead: 50%</strong> (1 GB costs 1.5 GB). Tolerates 3 lost chunks. Costs CPU and more network on repair.</p>
      </div>
    </div>
    <p>Big object stores use erasure coding for most data because at exabyte scale, 150% overhead instead of 300% saves
    enormous money. Checksums on every chunk plus background "scrubbing" detect silent bit rot and repair it before
    enough chunks fail to lose data.</p>

    <h2>Storage classes and lifecycle</h2>
    <p>Most files are hot for a few days and then rarely touched (think old WhatsApp photos or last year's invoices).
    Tiers let you pay less for cold data.</p>
    <table>
      <thead><tr><th>Class (S3 names)</th><th>Access pattern</th><th>Storage cost</th><th>Retrieval</th></tr></thead>
      <tbody>
        <tr><td>Standard</td><td>Frequent</td><td>Highest</td><td>Instant, no fee</td></tr>
        <tr><td>Standard-IA / One Zone-IA</td><td>Monthly-ish</td><td>About 45% less</td><td>Instant, per-GB fee, 30-day minimum</td></tr>
        <tr><td>Intelligent-Tiering</td><td>Unknown</td><td>Auto-moves objects</td><td>Instant</td></tr>
        <tr><td>Glacier Instant / Flexible</td><td>Few times a year</td><td>Very low</td><td>Milliseconds to hours</td></tr>
        <tr><td>Glacier Deep Archive</td><td>Compliance archives</td><td>Lowest (about $1/TB-month)</td><td>Up to 12–48 hours</td></tr>
      </tbody>
    </table>
    <p><strong>Lifecycle rules</strong> automate this: "move <code>invoices/</code> to IA after 30 days, to Deep Archive
    after 1 year, delete after 8 years" (handy for Indian GST record-keeping rules).</p>

    <h2>Presigned URLs: direct upload and download</h2>
    <p>The naive design streams every upload through your app servers: client → API → S3. A 200 MB video then ties up
    an app server thread and doubles your bandwidth bill. Instead, the server hands the client a <strong>presigned
    URL</strong>: a normal S3 URL plus an expiry time and an HMAC signature made with the server's secret key. Anyone holding
    the URL can do exactly that one operation (PUT this key, or GET that key) until it expires. S3 checks the signature;
    your servers never touch the bytes.</p>
    <div data-diagram="presigned" data-caption="Direct-to-S3 upload with a presigned URL; the app server only handles small JSON calls"></div>
    <ol class="steps">
      <li>Client asks the API for an upload slot, sending file name, size and type.</li>
      <li>API checks auth and limits (for example images under 10 MB), picks a key such as <code>uploads/{userId}/{uuid}.jpg</code>, and writes a <code>PENDING</code> row.</li>
      <li>API returns a presigned PUT URL valid for, say, 5 minutes.</li>
      <li>Client uploads straight to S3.</li>
      <li>S3 fires an event (or the client calls "complete"); the backend marks the row <code>UPLOADED</code> and kicks off processing.</li>
    </ol>
    <div class="callout warn"><strong>Keep presigned URLs tight</strong>Short expiry, one exact key (generated by the
    server, never chosen by the client), and content-type / size conditions where supported. Private buckets
    by default; downloads also use short-lived presigned GET URLs (or signed CDN URLs).</div>

    <h2>Multipart upload</h2>
    <p>Uploading a 4 GB video in one request is fragile: one network blip at 95% and you start over. <strong>Multipart
    upload</strong> splits the file into parts (5 MB to 5 GB each, up to 10,000 parts).</p>
    <ul>
      <li><code>CreateMultipartUpload</code> returns an <code>uploadId</code>.</li>
      <li>Upload parts <strong>in parallel</strong>, each with its own presigned URL; each returns an ETag.</li>
      <li>Retry only the failed part. A mobile app on a flaky Jio 4G connection can resume after the app was killed.</li>
      <li><code>CompleteMultipartUpload</code> with the list of part ETags stitches them into one object.</li>
      <li>Add a lifecycle rule to abort incomplete uploads after a few days, or orphaned parts keep costing money.</li>
    </ul>
    <p>Rule of thumb: use multipart for anything over about 100 MB.</p>

    <h2>CDN in front of storage</h2>
    <p>Object storage is durable but not fast for users far away: a GET from Mumbai to a US bucket is 200+ ms. Put a
    <strong>CDN</strong> (CloudFront, Akamai, Cloudflare) in front. Edge servers in Mumbai, Chennai and Delhi cache
    popular objects, and the bucket becomes the <em>origin</em>.</p>
    <ul>
      <li>Keep the bucket private; let only the CDN read it (origin access control).</li>
      <li>Use <strong>immutable, versioned keys</strong> (<code>banner_v7.jpg</code> or a content hash) so you can cache for a year and never need invalidation.</li>
      <li>For paid or private content (Hotstar video, purchased e-books), use <strong>signed CDN URLs or cookies</strong>.</li>
    </ul>

    <h2>Pattern: metadata in a DB, blob in object storage</h2>
    <p>Object storage is bad at queries ("all photos of user 42 tagged Goa, newest first"). So split responsibilities:</p>
    <table>
      <thead><tr><th>Database row (Postgres / DynamoDB)</th><th>Object storage</th></tr></thead>
      <tbody>
        <tr><td><code>photo_id, user_id, s3_key, size, content_type, width, height, status, created_at, tags</code></td><td>The bytes at <code>s3_key</code>, plus derived files (thumbnails)</td></tr>
        <tr><td>Indexed, queryable, transactional</td><td>Cheap, durable, served via CDN</td></tr>
      </tbody>
    </table>
    <p>Write order matters: create the DB row as <code>PENDING</code>, upload the blob, then flip to <code>UPLOADED</code>.
    A periodic cleanup job deletes blobs with no row, and rows stuck in <code>PENDING</code>.</p>

    <h2>Real-world example: image upload pipeline</h2>
    <p>Think Instagram, a Flipkart seller uploading product photos, or Zomato restaurant menus. The user uploads one
    original; the app needs many sizes.</p>
    <div data-diagram="pipeline" data-caption="Upload once, then resize asynchronously into thumbnails served via CDN"></div>
    <ol class="steps">
      <li>Client uploads the original to <code>originals/{id}.jpg</code> using a presigned URL.</li>
      <li>S3 emits an <code>ObjectCreated</code> event to a queue (SQS / Kafka).</li>
      <li>Resize workers (or a Lambda) download the original, strip EXIF location data, scan for malware or abuse, and produce 150 px, 480 px and 1080 px WebP/AVIF versions.</li>
      <li>Workers write them to <code>thumbs/{id}/150.webp</code> etc. and update the DB row with the variants and status <code>READY</code>.</li>
      <li>Clients load images through the CDN; the right size is picked per screen.</li>
    </ol>
    <p>Because the pipeline is queue-driven, a spike of uploads during a Big Billion Days sale just grows the queue; add
    workers to catch up. Make the worker idempotent: re-processing the same image overwrites the same keys.</p>
    <p>Other everyday uses: Netflix and Hotstar store video segments in S3 behind CDNs; Razorpay and banks keep statements
    and KYC documents in encrypted buckets; data teams build data lakes of Parquet files queried by Athena or Spark.</p>

    <h2>Trade-offs and limits</h2>
    <div class="grid-2">
      <div class="card good"><strong>Strengths</strong><ul>
        <li>Practically unlimited scale, pay per GB.</li>
        <li>11 nines durability without you running anything.</li>
        <li>Plain HTTP; works with CDNs, presigned URLs, events.</li>
      </ul></div>
      <div class="card bad"><strong>Weaknesses</strong><ul>
        <li>No in-place edits or appends; replace the whole object.</li>
        <li>Higher latency than disk; not a database or a filesystem.</li>
        <li>Listing by prefix is slow at huge scale; keep an index in your DB.</li>
        <li>Egress (data out) is often the biggest cost; use a CDN.</li>
      </ul></div>
    </div>

    <h2>Interview questions and pitfalls</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>"Media goes to S3, never through our app
    servers. The client gets a short-lived presigned URL, uploads directly (multipart for large files), and an
    S3 event triggers async processing. Metadata and the object key live in Postgres; users fetch through a CDN with
    long cache TTLs on immutable keys. Old originals move to cheaper tiers with lifecycle rules."</div>
    <ul>
      <li><strong>"How do you stop users overwriting each other's files?"</strong> The server generates the key, scoped to the user, and signs only that key.</li>
      <li><strong>"How would you deduplicate uploads?"</strong> Hash the content (SHA-256) and use it as the key; if it exists, skip the upload and add a reference (Dropbox-style).</li>
      <li><strong>Capacity check</strong>: 10M uploads/day x 2 MB = 20 TB/day, about 7 PB/year before thumbnails. That is why tiering and lifecycle rules matter.</li>
      <li><strong>Pitfall</strong>: public buckets. Many real data leaks were simply misconfigured public S3 buckets.</li>
    </ul>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>Why not store user profile pictures in a MySQL BLOB column?</summary>
        <div>Large blobs bloat the DB, slow backups and replication, waste costly IOPS and memory, and cannot be served by a CDN directly. Store the image in object storage and keep only the key and metadata in MySQL.</div></details>
      <details><summary>What is the difference between 11 nines durability and 4 nines availability?</summary>
        <div>Durability is the chance your data is not lost over a year. Availability is the chance you can access it at a given moment. An object can be temporarily unreachable (availability) yet never lost (durability).</div></details>
      <details><summary>Compare 3x replication with 6+3 erasure coding.</summary>
        <div>Replication: 200% overhead, survives 2 failures, cheap reads and repairs. 6+3 erasure coding: 50% overhead, survives any 3 chunk losses, but repair and degraded reads need CPU and reading 6 chunks over the network. Large stores use EC for most data.</div></details>
      <details><summary>Walk through a presigned-URL upload. What does the app server never do?</summary>
        <div>Client asks the API for an upload URL; the API authorises, picks the key, signs a short-lived PUT URL and returns it; the client PUTs directly to S3; an event or callback marks the upload complete. The app server never streams the file bytes.</div></details>
      <details><summary>A user uploads a 3 GB video on a flaky mobile network. How do you make it reliable?</summary>
        <div>Multipart upload: split into parts (say 10–50 MB), upload them in parallel with per-part presigned URLs, retry only failed parts, persist the uploadId so the app can resume, then complete the upload. Abort stale uploads with a lifecycle rule.</div></details>
      <details><summary>How do you serve images fast to users across India without exposing the bucket?</summary>
        <div>Put a CDN in front with the private bucket as origin (origin access control), use immutable versioned keys with long TTLs, and use signed CDN URLs for private content.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>Block = raw disk for databases; file = shared folder tree; object = key → immutable blob over HTTP, cheap and unlimited.</li>
      <li>Store blobs in object storage and metadata (with the key) in a database.</li>
      <li>11 nines durability comes from spreading data across AZs, usually with erasure coding instead of full copies.</li>
      <li>Presigned URLs let clients upload and download directly; multipart makes big uploads resumable and parallel.</li>
      <li>Put a CDN in front, use immutable keys, and tier cold data down with lifecycle rules.</li>
      <li>Process media asynchronously: upload event → queue → idempotent workers → thumbnails.</li>
    </ul></div>
  `,
  diagrams: {
    presigned: String.raw`sequenceDiagram
  participant C as Client app
  participant A as API server
  participant D as Metadata DB
  participant S as S3 bucket
  C->>A: POST /uploads (name, size, type)
  A->>A: auth + validate limits
  A->>D: insert row (key, PENDING)
  A-->>C: presigned PUT URL (expires 5 min)
  C->>S: PUT file bytes to URL
  S->>S: verify signature and expiry
  S-->>C: 200 OK (ETag)
  S-)A: ObjectCreated event
  A->>D: status = UPLOADED`,
    pipeline: String.raw`flowchart LR
  C[Client] -->|"presigned PUT"| S1[("S3: originals/")]
  S1 -->|ObjectCreated| Q[["Queue"]]
  Q --> W1[Resize worker]
  Q --> W2[Resize worker]
  W1 --> S2[("S3: thumbs/")]
  W2 --> S2
  W1 --> DB[("Photos DB: status READY")]
  S2 --> CDN["CDN edge"]
  CDN --> U[Users]`,
  },
});
