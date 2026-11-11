/* Every page on the site. `soon: true` = planned, not written yet.
   level: "s1" (SDE 1 core), "s2" (SDE 2 depth), null (good to know).
   difficulty (problems only): "easy" | "medium" | "hard". */
window.SD_GROUPS = [
  { id: "hld", title: "High-Level Design", icon: "layers" },
  { id: "lld", title: "Low-Level Design", icon: "code" },
  { id: "problems", title: "Practice Problems", icon: "target" },
];

window.SD_SECTIONS = [
  { id: "hld-foundations", group: "hld", title: "Foundations" },
  { id: "hld-networking", group: "hld", title: "Networking Basics" },
  { id: "hld-blocks", group: "hld", title: "Core Building Blocks" },
  { id: "hld-databases", group: "hld", title: "Databases" },
  { id: "hld-distributed", group: "hld", title: "Distributed Systems" },
  { id: "hld-patterns", group: "hld", title: "Architecture Patterns" },
  { id: "hld-production", group: "hld", title: "Production Concerns" },
  { id: "lld-foundations", group: "lld", title: "LLD Foundations" },
  { id: "lld-patterns", group: "lld", title: "Design Patterns" },
  { id: "problems-hld", group: "problems", title: "HLD Problems" },
  { id: "problems-lld", group: "problems", title: "LLD / Machine Coding" },
];

(function () {
  const T = (id, section, title, level, summary, tags, extra) =>
    Object.assign({ id, section, title, level, summary, tags: tags || [], kind: "topic" }, extra || {});
  const P = (id, section, title, level, difficulty, summary, tags, extra) =>
    Object.assign({ id, section, title, level, difficulty, summary, tags: tags || [], kind: "problem" }, extra || {});
  const soon = { soon: true };

  window.SD_PAGES = [
    // ---------- HLD: Foundations ----------
    T("interview-framework", "hld-foundations", "The System Design Interview Framework", "s1",
      "A repeatable 6-step approach for any 45-minute design round.", ["interview", "framework", "approach"]),
    T("requirements", "hld-foundations", "Functional vs Non-Functional Requirements", "s1",
      "Pin down what the system does and how well it must do it.", ["requirements", "nfr", "scope"]),
    T("estimation", "hld-foundations", "Back-of-the-Envelope Estimation", "s1",
      "QPS, storage and bandwidth maths with numbers worth memorising.", ["capacity", "qps", "storage", "math"]),
    T("latency-throughput", "hld-foundations", "Latency vs Throughput", "s1",
      "How fast vs how much, and the latency numbers every engineer should know.", ["latency", "throughput", "performance"]),
    T("availability", "hld-foundations", "Availability, Reliability & SLAs", "s1",
      "The nines, SLI/SLO/SLA, and how redundancy changes uptime.", ["availability", "sla", "nines", "reliability"]),
    T("scaling", "hld-foundations", "Vertical vs Horizontal Scaling", "s1",
      "Bigger machine or more machines, and what it takes to go stateless.", ["scaling", "stateless", "scale out"]),

    // ---------- HLD: Networking ----------
    T("url-to-page", "hld-networking", "What Happens When You Type a URL", "s1",
      "DNS, TCP, TLS and HTTP end to end.", ["dns", "tcp", "tls", "http"], soon),
    T("http-versions", "hld-networking", "HTTP/1.1 vs HTTP/2 vs HTTP/3 & HTTPS", "s1",
      "Multiplexing, head-of-line blocking and QUIC.", ["http", "quic", "https"], soon),
    T("tcp-udp", "hld-networking", "TCP vs UDP", "s1", "Reliability vs speed at the transport layer.", ["tcp", "udp"], soon),
    T("api-styles", "hld-networking", "REST vs GraphQL vs gRPC", "s1", "Choosing an API style.", ["rest", "graphql", "grpc", "api"], soon),
    T("realtime", "hld-networking", "Polling, Long Polling, WebSockets & SSE", "s1",
      "Ways to push updates to clients.", ["websocket", "sse", "polling", "realtime"], soon),
    T("cdn", "hld-networking", "CDNs & Edge Caching", "s1", "Serving content close to users.", ["cdn", "edge", "cache"], soon),
    T("proxies", "hld-networking", "Forward vs Reverse Proxies", null, "Who the proxy is acting for.", ["proxy", "nginx"], soon),

    // ---------- HLD: Core Building Blocks ----------
    T("load-balancers", "hld-blocks", "Load Balancers", "s1",
      "L4 vs L7, balancing algorithms and health checks.", ["load balancer", "round robin", "l4", "l7", "nginx"]),
    T("api-gateway-rate-limiting", "hld-blocks", "API Gateways & Rate Limiting", "s1",
      "One front door for your services, and how to throttle abusers.", ["api gateway", "rate limit", "token bucket", "throttling"]),
    T("caching", "hld-blocks", "Caching", "s1",
      "Cache layers, read/write strategies, eviction, invalidation and stampedes.", ["cache", "redis", "lru", "cache aside", "eviction"]),
    T("message-queues", "hld-blocks", "Message Queues & Pub/Sub", "s2",
      "Decoupling services with Kafka, RabbitMQ and SQS.", ["kafka", "rabbitmq", "sqs", "queue", "pubsub", "async"]),
    T("object-storage", "hld-blocks", "Blob / Object Storage", "s1",
      "Storing files and media with S3-style storage.", ["s3", "blob", "object storage", "files", "presigned url"]),
    T("unique-ids", "hld-blocks", "Unique ID Generation", "s2",
      "UUID, Snowflake and ticket servers for IDs at scale.", ["uuid", "snowflake", "id", "ticket server"]),
    T("consistent-hashing", "hld-blocks", "Consistent Hashing", "s2",
      "Spreading keys across servers so adding one doesn't reshuffle everything.", ["hashing", "sharding", "virtual nodes", "ring"]),

    // ---------- HLD: Databases ----------
    T("sql-vs-nosql", "hld-databases", "SQL vs NoSQL", "s1", "When to pick which.", ["sql", "nosql", "database"], soon),
    T("nosql-types", "hld-databases", "NoSQL Types", "s1", "Key-value, document, wide-column and graph stores.", ["nosql", "mongodb", "cassandra"], soon),
    T("indexing", "hld-databases", "Indexing: B-Trees & LSM Trees", "s2", "How databases find rows fast.", ["index", "btree", "lsm"], soon),
    T("transactions", "hld-databases", "Transactions, ACID & Isolation Levels", "s2", "Correctness under concurrency.", ["acid", "isolation", "transaction"], soon),
    T("replication", "hld-databases", "Replication", "s2", "Leader-follower, multi-leader and leaderless.", ["replication", "replica"], soon),
    T("sharding", "hld-databases", "Sharding & Partitioning", "s2", "Splitting data across machines.", ["sharding", "partition", "hot key"], soon),
    T("denormalization", "hld-databases", "Denormalisation & Read Replicas", "s1", "Trading writes for faster reads.", ["denormalization", "read replica"], soon),
    T("search-index", "hld-databases", "Search & Inverted Indexes", "s2", "How Elasticsearch finds documents.", ["search", "elasticsearch", "inverted index"], soon),
    T("timeseries-olap", "hld-databases", "Time-Series & Analytics Databases", null, "Metrics and OLAP stores.", ["timeseries", "olap"], soon),

    // ---------- HLD: Distributed systems ----------
    T("cap-theorem", "hld-distributed", "CAP Theorem & PACELC", "s1", "The trade-off under network partitions.", ["cap", "pacelc"], soon),
    T("consistency-models", "hld-distributed", "Consistency Models", "s2", "Strong, eventual, causal and more.", ["consistency"], soon),
    T("consensus", "hld-distributed", "Leader Election & Consensus (Raft)", "s2", "Agreeing on one truth.", ["raft", "paxos", "leader election"], soon),
    T("distributed-transactions", "hld-distributed", "Distributed Transactions: 2PC, Saga, Outbox", "s2", "Keeping services in sync.", ["saga", "2pc", "outbox"], soon),
    T("idempotency", "hld-distributed", "Idempotency & Delivery Guarantees", "s2", "Exactly-once vs at-least-once.", ["idempotency", "exactly once"], soon),
    T("probabilistic", "hld-distributed", "Bloom Filters, HyperLogLog & Quorums", "s2", "Clever approximate structures.", ["bloom filter", "hyperloglog", "quorum"], soon),
    T("clocks", "hld-distributed", "Clocks & Ordering", null, "Lamport and vector clocks.", ["clock", "lamport"], soon),

    // ---------- HLD: Patterns ----------
    T("monolith-microservices", "hld-patterns", "Monolith vs Microservices", "s1", "When to split.", ["microservices", "monolith"], soon),
    T("service-discovery", "hld-patterns", "Service Discovery & Service Mesh", null, "Finding services at runtime.", ["service mesh", "discovery"], soon),
    T("event-driven", "hld-patterns", "Event-Driven, Event Sourcing & CQRS", "s2", "Designing around events.", ["cqrs", "event sourcing"], soon),
    T("resilience", "hld-patterns", "Circuit Breakers, Retries & Bulkheads", "s2", "Surviving failures.", ["circuit breaker", "retry", "backoff"], soon),
    T("batch-stream", "hld-patterns", "Batch vs Stream Processing", "s2", "Hadoop, Spark, Flink.", ["batch", "stream", "flink"], soon),

    // ---------- HLD: Production ----------
    T("observability", "hld-production", "Monitoring, Logging & Tracing", "s2", "Seeing inside your system.", ["observability", "metrics", "tracing"], soon),
    T("security", "hld-production", "Auth, OAuth 2.0, JWT & Encryption", "s1", "Security basics for design rounds.", ["oauth", "jwt", "auth"], soon),
    T("deployments", "hld-production", "Deployment Strategies", null, "Blue-green, canary, rolling.", ["deploy", "canary"], soon),

    // ---------- LLD: Foundations ----------
    T("oop", "lld-foundations", "OOP Fundamentals", "s1", "Encapsulation, abstraction, inheritance, polymorphism.", ["oop"], soon),
    T("solid", "lld-foundations", "SOLID Principles", "s1", "Five principles with code.", ["solid"], soon),
    T("design-principles", "lld-foundations", "DRY, KISS, YAGNI & Composition", "s1", "Everyday design rules.", ["dry", "kiss"], soon),
    T("uml", "lld-foundations", "UML Class & Sequence Diagrams", "s1", "Drawing designs clearly.", ["uml"], soon),
    T("concurrency", "lld-foundations", "Concurrency Basics", "s2", "Threads, locks, races, producer-consumer.", ["threads", "locks"], soon),
    T("schema-design", "lld-foundations", "Database Schema Design", "s1", "Tables, keys and normalisation.", ["schema", "normalization"], soon),
    T("api-design", "lld-foundations", "API Design", "s1", "Resources, pagination, versioning, errors.", ["api", "rest"], soon),
    T("creational-patterns", "lld-patterns", "Creational Patterns", "s1", "Singleton, Factory, Builder, Prototype.", ["singleton", "factory", "builder"], soon),
    T("structural-patterns", "lld-patterns", "Structural Patterns", "s1", "Adapter, Decorator, Facade, Proxy, Composite.", ["adapter", "decorator"], soon),
    T("behavioral-patterns", "lld-patterns", "Behavioural Patterns", "s1", "Strategy, Observer, State, Command and more.", ["strategy", "observer", "state"], soon),

    // ---------- Problems: HLD ----------
    P("url-shortener", "problems-hld", "Design a URL Shortener", "s1", "easy",
      "TinyURL / bit.ly: short codes, redirects and analytics at scale.", ["tinyurl", "bitly", "base62", "hashing"]),
    P("pastebin", "problems-hld", "Design Pastebin", "s1", "easy", "Store and share text snippets.", ["pastebin"], soon),
    P("rate-limiter", "problems-hld", "Design a Rate Limiter", "s1", "easy",
      "A distributed limiter that protects APIs from abuse.", ["rate limiter", "token bucket", "redis", "sliding window"]),
    P("kv-store", "problems-hld", "Design a Key-Value Store", "s2", "easy", "From one machine to a distributed store.", ["kv", "dynamo"], soon),
    P("unique-id-service", "problems-hld", "Design a Unique ID Generator", "s1", "easy", "IDs for a distributed system.", ["snowflake"], soon),
    P("notification-system", "problems-hld", "Design a Notification System", "s1", "easy", "Push, SMS and email at scale.", ["notification"], soon),
    P("web-crawler", "problems-hld", "Design a Web Crawler", "s2", "easy", "Crawl billions of pages politely.", ["crawler"], soon),
    P("chat-system", "problems-hld", "Design a Chat System (WhatsApp)", "s2", "medium",
      "1:1 and group messaging, delivery receipts and presence.", ["whatsapp", "chat", "websocket", "messaging"]),
    P("news-feed", "problems-hld", "Design a News Feed (Twitter/X)", "s2", "medium",
      "Posting and reading a personalised timeline with fan-out.", ["twitter", "feed", "fanout", "timeline"]),
    P("instagram", "problems-hld", "Design Instagram", "s2", "medium", "Photo upload, storage and feed.", ["instagram"], soon),
    P("autocomplete", "problems-hld", "Design Search Autocomplete", "s2", "medium", "Typeahead suggestions with tries.", ["trie", "typeahead"], soon),
    P("video-streaming", "problems-hld", "Design YouTube / Netflix", "s2", "medium", "Upload, transcode and stream video.", ["video", "youtube"], soon),
    P("file-sync", "problems-hld", "Design Google Drive / Dropbox", "s2", "medium", "File storage and sync.", ["dropbox"], soon),
    P("ride-hailing", "problems-hld", "Design Uber / Ola", "s2", "medium", "Matching riders with nearby drivers.", ["uber", "geohash"], soon),
    P("food-delivery", "problems-hld", "Design Swiggy / Zomato", "s2", "medium", "Restaurants, orders and delivery partners.", ["swiggy"], soon),
    P("ecommerce", "problems-hld", "Design Amazon / Flipkart", "s2", "medium", "Catalogue, cart and checkout.", ["flipkart"], soon),
    P("ticket-booking", "problems-hld", "Design BookMyShow", "s2", "medium", "Seat booking without double-booking.", ["bookmyshow"], soon),
    P("payment-system", "problems-hld", "Design a Payment System", "s2", "medium", "Idempotent payments and a ledger.", ["razorpay", "upi"], soon),
    P("distributed-queue", "problems-hld", "Design a Distributed Message Queue", "s2", "hard", "Build your own Kafka.", ["kafka"], soon),
    P("distributed-cache", "problems-hld", "Design a Distributed Cache", "s2", "hard", "Build your own Redis cluster.", ["redis"], soon),
    P("collab-editor", "problems-hld", "Design Google Docs", "s2", "hard", "Real-time collaborative editing.", ["ot", "crdt"], soon),
    P("leaderboard", "problems-hld", "Design a Real-Time Leaderboard", "s2", "hard", "Ranking millions of players live.", ["leaderboard"], soon),
    P("ad-click-aggregation", "problems-hld", "Design Ad Click Aggregation", "s2", "hard", "Counting a firehose of events.", ["stream"], soon),
    P("stock-exchange", "problems-hld", "Design a Stock Exchange", "s2", "hard", "Order matching at low latency.", ["exchange"], soon),

    // ---------- Problems: LLD ----------
    P("parking-lot", "problems-lld", "Design a Parking Lot", "s1", "easy",
      "The classic OOP round: spots, tickets, pricing and strategies.", ["parking lot", "oop", "strategy", "lld"]),
    P("tic-tac-toe", "problems-lld", "Design Tic-Tac-Toe / Snake & Ladder", "s1", "easy", "Game modelling basics.", ["game"], soon),
    P("vending-machine", "problems-lld", "Design a Vending Machine", "s1", "easy", "State pattern in action.", ["state pattern"], soon),
    P("library-management", "problems-lld", "Design a Library Management System", "s1", "easy", "Books, members and loans.", ["library"], soon),
    P("lru-cache-lld", "problems-lld", "Design an LRU Cache", "s1", "easy", "Hash map plus doubly linked list.", ["lru"], soon),
    P("logger", "problems-lld", "Design a Logger", "s1", "easy", "Log levels and chain of responsibility.", ["logger"], soon),
    P("elevator", "problems-lld", "Design an Elevator System", "s1", "medium", "Scheduling lifts.", ["elevator"], soon),
    P("splitwise", "problems-lld", "Design Splitwise", "s2", "medium", "Shared expenses and settling up.", ["splitwise"], soon),
    P("bookmyshow-lld", "problems-lld", "Design Movie Ticket Booking", "s2", "medium", "Seat locking in code.", ["booking"], soon),
    P("rate-limiter-lld", "problems-lld", "Implement a Rate Limiter", "s2", "medium", "Token bucket and sliding window in code.", ["rate limiter"], soon),
    P("chess", "problems-lld", "Design Chess", "s2", "medium", "Pieces, moves and rules.", ["chess"], soon),
    P("food-delivery-lld", "problems-lld", "Design Food Delivery / Ride Booking", "s2", "medium", "Orders, matching and states.", ["swiggy"], soon),
    P("pubsub-lld", "problems-lld", "Design a Pub/Sub Broker", "s2", "medium", "Topics, subscribers and delivery.", ["pubsub"], soon),
    P("task-scheduler", "problems-lld", "Design a Task Scheduler", "s2", "medium", "Delayed and recurring jobs.", ["scheduler"], soon),
    P("file-system", "problems-lld", "Design an In-Memory File System", "s2", "medium", "Directories, files and paths.", ["composite"], soon),
    P("shopping-cart", "problems-lld", "Design a Shopping Cart with Discounts", "s2", "medium", "Pricing rules that stay extensible.", ["cart"], soon),
  ];

  const folder = { "problems-hld": "problems", "problems-lld": "problems" };
  window.SD_PAGES.forEach((p) => {
    const g = window.SD_SECTIONS.find((s) => s.id === p.section).group;
    p.group = g;
    p.file = "content/" + (folder[p.section] || g) + "/" + p.id + ".js";
  });
})();
