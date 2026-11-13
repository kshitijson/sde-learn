SD.register({
  id: "indexing",
  html: String.raw`
    <p class="lead">An index is a separate, sorted data structure that lets a database jump straight to the rows you want instead of reading the whole table. Without one, finding a user by email in a 1-billion-row table means reading every row; with a B+ tree index it takes 3 or 4 page reads. Almost every database uses one of two index families: <strong>B-trees</strong> (MySQL, PostgreSQL), which are great for reads, and <strong>LSM trees</strong> (Cassandra, RocksDB), which are great for writes. Knowing how they work tells you which database to pick, which index to add, and why a query is slow.</p>

    <h2>Why indexes: full scan vs index lookup</h2>
    <p>Databases store data on disk in fixed-size <strong>pages</strong> (16 KB in MySQL InnoDB, 8 KB in PostgreSQL). The unit of work is a page read, not a row read. So the real question is always "how many pages must I touch?"</p>
    <ul>
      <li><strong>Full table scan</strong>: read every page and check every row. That is O(n). A 1-billion-row <code>users</code> table at about 100 bytes per row is about 100 GB. Even at 500 MB/s of sequential reads, that is over 3 minutes for one query.</li>
      <li><strong>Index lookup</strong>: walk a balanced tree from the root to a leaf. That is O(log n), and because each tree node is a whole page holding hundreds of keys, the tree is very shallow. 4 page reads at about 0.1 ms each on an SSD is well under a millisecond. The top levels are usually already in memory, so only 1 or 2 reads hit the disk.</li>
    </ul>
    <p>An index is like the index at the back of a textbook: sorted terms with page numbers. You trade extra storage and slower writes for much faster reads.</p>
    <div class="callout info"><strong>Key terms</strong><strong>Page</strong>: fixed-size block the database reads and writes as a unit. <strong>Primary key</strong>: the unique id of a row. <strong>Secondary index</strong>: any other index. <strong>Selectivity</strong>: how well a column narrows down rows. <strong>Query planner (optimizer)</strong>: the part of the database that decides whether to use an index or scan.</div>

    <h2>The B+ tree</h2>
    <p>The B+ tree is the default index in almost every relational database. It is a balanced tree where:</p>
    <ul>
      <li>Every node is one disk page. <strong>Internal nodes</strong> hold only keys and pointers to child pages; they act as signposts.</li>
      <li><strong>Leaf nodes</strong> hold the actual keys plus either the row data or a pointer to the row.</li>
      <li>All leaves are at the same depth, so every lookup costs the same number of page reads.</li>
      <li>Leaves are linked to their neighbours, so once you find the start of a range you just walk sideways.</li>
    </ul>
    <figure class="svg-fig">
      <svg viewBox="0 0 680 300">
        <rect class="s-box" x="250" y="20" width="180" height="44" rx="10"/>
        <text class="s-title" x="340" y="47" text-anchor="middle">20 | 40</text>
        <text class="s-muted" x="550" y="47" text-anchor="middle">root (internal page)</text>
        <line class="s-line" x1="290" y1="64" x2="112" y2="138" marker-end="url(#arrow)"/>
        <line class="s-line" x1="340" y1="64" x2="340" y2="138" marker-end="url(#arrow)"/>
        <line class="s-line" x1="390" y1="64" x2="568" y2="138" marker-end="url(#arrow)"/>
        <text class="s-muted" x="170" y="96" text-anchor="middle">keys &lt; 20</text>
        <text class="s-muted" x="378" y="110" text-anchor="middle">20 to 39</text>
        <text class="s-muted" x="512" y="96" text-anchor="middle">keys ≥ 40</text>
        <rect class="s-box" x="20" y="140" width="180" height="48" rx="10"/>
        <text class="s-text" x="110" y="169" text-anchor="middle">5 · 10 · 15</text>
        <rect class="s-accent" x="250" y="140" width="180" height="48" rx="10"/>
        <text class="s-text" x="340" y="169" text-anchor="middle">20 · 25 · 30</text>
        <rect class="s-accent" x="480" y="140" width="180" height="48" rx="10"/>
        <text class="s-text" x="570" y="169" text-anchor="middle">40 · 45 · 50</text>
        <line class="s-line" x1="200" y1="164" x2="247" y2="164" marker-end="url(#arrow)"/>
        <line class="s-line" x1="430" y1="164" x2="477" y2="164" marker-end="url(#arrow)"/>
        <text class="s-muted" x="110" y="210" text-anchor="middle">rows or row pointers</text>
        <text class="s-muted" x="340" y="210" text-anchor="middle">rows or row pointers</text>
        <text class="s-muted" x="570" y="210" text-anchor="middle">rows or row pointers</text>
        <text class="s-title" x="340" y="252" text-anchor="middle">WHERE id BETWEEN 25 AND 45: descend once to 25, then follow leaf links</text>
        <text class="s-muted" x="340" y="280" text-anchor="middle">Real pages hold hundreds to ~1,000 keys, so 3 to 4 levels cover billions of rows</text>
      </svg>
      <figcaption>A tiny B+ tree. Internal nodes only route; leaves hold the data and are chained left to right, which makes range scans cheap.</figcaption>
    </figure>

    <h3>Fan-out and height</h3>
    <p><strong>Fan-out</strong> is how many children each internal node has. With a 16 KB page and a key plus pointer of about 14 bytes (an 8-byte <code>BIGINT</code> key and a 6-byte page number), one internal page holds about 1,000 to 1,200 entries. Say 1,000 for easy maths, and say a leaf page holds about 100 full rows:</p>
    <table>
      <thead><tr><th>Height</th><th>Leaf pages</th><th>Rows covered (100 per leaf)</th></tr></thead>
      <tbody>
        <tr><td>2 (root + leaves)</td><td>1,000</td><td>100,000</td></tr>
        <tr><td>3</td><td>1,000,000</td><td>100 million</td></tr>
        <tr><td>4</td><td>1 billion</td><td>100 billion</td></tr>
      </tbody>
    </table>
    <p>So a billion-row table needs a tree only 4 levels deep. The root and second level are a few MB and stay in the buffer pool (the database's page cache in RAM), so a point lookup usually costs 1 to 2 real disk reads.</p>

    <h3>Range scans</h3>
    <p>Because keys are sorted and leaves are linked, <code>WHERE created_at BETWEEN '2026-11-01' AND '2026-11-07'</code> descends once to the first matching key and then reads leaves in order until it passes the end. The same property makes <code>ORDER BY</code> on the indexed column free (no sort step) and makes <code>LIMIT 20</code> stop early. A hash index cannot do any of this.</p>

    <h3>Page splits</h3>
    <p>When you insert a key into a full leaf, the database <strong>splits</strong> it: it allocates a new page, moves about half the keys over, and adds a pointer in the parent. If the parent is full it splits too, and in rare cases the split goes all the way up and the tree grows one level taller at the root. This is how the tree stays balanced without ever being rebuilt.</p>
    <p>Splits cost extra writes and leave pages half empty. With an ever-increasing key (auto-increment id, timestamp, Snowflake id) inserts always go to the rightmost leaf, so splits are rare and pages fill up. With a <strong>random</strong> key such as UUIDv4, inserts land on random pages all over the tree, causing many splits, fragmented half-full pages and poor cache use. This is why <a href="#/p/unique-ids">time-ordered IDs</a> are preferred as primary keys.</p>

    <h2>Clustered vs secondary indexes</h2>
    <p>A <strong>clustered index</strong> decides the physical order of the table: the leaf pages <em>are</em> the table rows. A table can have only one. Every other index is a <strong>secondary</strong> (non-clustered) index.</p>
    <div class="tabs">
      <section data-tab="MySQL InnoDB">
        <p>In InnoDB the table <em>is</em> a B+ tree on the primary key. The leaves hold the full rows. If you do not declare a primary key, InnoDB uses the first unique non-null index or creates a hidden 6-byte row id.</p>
        <p>A secondary index on <code>email</code> stores <code>(email, primary key)</code> in its leaves, not a disk address. So a lookup by email is <strong>two tree walks</strong>: find the primary key in the email index, then find the row in the clustered index. Consequences:</p>
        <ul>
          <li>A big primary key (a 36-character UUID string) is copied into every secondary index and bloats all of them.</li>
          <li>Primary key lookups and primary key range scans are the fastest possible queries.</li>
          <li>Rows can move during page splits without updating secondary indexes, because those store the key, not a location.</li>
        </ul>
      </section>
      <section data-tab="PostgreSQL">
        <p>PostgreSQL stores rows in an unordered <strong>heap</strong>. Every index, including the primary key index, is secondary: its leaves hold a tuple id (<code>ctid</code>, page number + slot) pointing into the heap. A lookup is one index walk plus one heap page read.</p>
        <p>The <code>CLUSTER</code> command physically reorders the heap once by an index, but the order is not maintained for new rows. Because rows can move on update, Postgres uses tricks like HOT (heap-only tuple) updates to avoid touching every index.</p>
      </section>
    </div>
    <div data-diagram="lookup" data-caption="InnoDB secondary index lookup: the email index gives the primary key, then the clustered index gives the row."></div>

    <h2>Composite indexes and the leftmost-prefix rule</h2>
    <p>A <strong>composite</strong> (multi-column) index on <code>(a, b, c)</code> is sorted by <code>a</code>, then by <code>b</code> within equal <code>a</code>, then by <code>c</code>. Think of a phone book sorted by last name, then first name. You can find "all Sharmas" or "Sharma, Priya" quickly, but not "everyone named Priya".</p>
    <p>That gives the <strong>leftmost-prefix rule</strong>: the index can be used to seek on <code>a</code>, on <code>a, b</code>, or on <code>a, b, c</code>, but not on <code>b</code> alone or <code>c</code> alone. A second rule: once a column is used with a <em>range</em> (<code>&gt;</code>, <code>&lt;</code>, <code>BETWEEN</code>, <code>LIKE 'x%'</code>), the columns after it cannot be used to seek, only to filter.</p>
    <table>
      <thead><tr><th>Index on (city, age, name)</th><th>Uses the index?</th></tr></thead>
      <tbody>
        <tr><td><code>WHERE city = 'Pune'</code></td><td>Yes, seek on city</td></tr>
        <tr><td><code>WHERE city = 'Pune' AND age = 30</code></td><td>Yes, seek on both</td></tr>
        <tr><td><code>WHERE age = 30</code></td><td>No seek (age is not the leftmost column); at best a full index scan</td></tr>
        <tr><td><code>WHERE city = 'Pune' AND name = 'Riya'</code></td><td>Seek on city only; name is filtered inside the index</td></tr>
        <tr><td><code>WHERE city = 'Pune' AND age &gt; 25 AND name = 'Riya'</code></td><td>Seek on city + age range; name only filtered</td></tr>
      </tbody>
    </table>

    <h3>Worked example</h3>
    <p>A Swiggy-style admin page lists users in a city above an age, newest sign-ups first:</p>
    <pre><code>SELECT id, name FROM users
WHERE city = 'Pune' AND age &gt; 25
ORDER BY signup_date DESC
LIMIT 20;</code></pre>
    <ol class="steps">
      <li><strong>Index (city)</strong>: finds all Pune users (say 2 million), reads each row to check age, then sorts the survivors by <code>signup_date</code>. Slow: lots of row reads and a big sort.</li>
      <li><strong>Index (city, age)</strong>: seeks <code>city = 'Pune' AND age &gt; 25</code> precisely, but results come out ordered by age, not by date. The database still has to sort them all (MySQL shows <code>Using filesort</code>) before it can return the top 20.</li>
      <li><strong>Index (city, signup_date)</strong>: seeks to Pune, then walks entries already in <code>signup_date</code> order (backwards for <code>DESC</code>), checks age on each row, and <em>stops after 20 matches</em>. No sort. Usually the best when most users pass the age filter.</li>
      <li><strong>Index (city, signup_date, age, name)</strong>: same as above, but age is checked inside the index and name is in the index too, so the table is never touched. This is a covering index (next section).</li>
    </ol>
    <div class="callout tip"><strong>The ESR rule</strong>Order columns in a composite index as <strong>E</strong>quality first, then <strong>S</strong>ort, then <strong>R</strong>ange. It comes from MongoDB's guidance but applies to any B-tree index. Equality columns narrow to one contiguous block; the sort column keeps that block in the right order; range columns go last because they break ordering for anything after them.</div>

    <h2>Covering indexes</h2>
    <p>If an index contains every column a query needs, the database answers from the index alone and never reads the table rows. This is a <strong>covering index</strong>. It saves the second tree walk in InnoDB (or the heap read in Postgres), which matters a lot when a query touches thousands of rows.</p>
    <ul>
      <li>MySQL's <code>EXPLAIN</code> shows <code>Using index</code> in the Extra column.</li>
      <li>PostgreSQL shows <code>Index Only Scan</code>. Postgres 11+ lets you add non-key payload columns: <code>CREATE INDEX ON orders (user_id, created_at) INCLUDE (total)</code>.</li>
      <li>In InnoDB every secondary index already contains the primary key, so <code>SELECT id FROM users WHERE email = ?</code> is covered by an index on <code>email</code>.</li>
    </ul>

    <h2>Selectivity: when an index does not help</h2>
    <p><strong>Selectivity</strong> = distinct values / total rows. A unique email column has selectivity 1 (perfect). A <code>gender</code> or <code>is_active</code> column might have selectivity close to 0: an index finds 50% of the table, and then the database does millions of random row reads, which is slower than one sequential scan. The planner knows this from table statistics and will often ignore such an index. As a rough rule, if a query returns more than about 5 to 20% of the table, a scan wins.</p>
    <p>Low-selectivity columns still help as the <em>later</em> part of a composite index (<code>(user_id, status)</code>) or as a <strong>partial index</strong>: <code>CREATE INDEX ON orders (created_at) WHERE status = 'PENDING'</code> indexes only the few pending orders (PostgreSQL).</p>
    <div class="callout warn"><strong>Things that silently stop index use</strong>
      <ul>
        <li>Functions on the column: <code>WHERE LOWER(email) = ?</code> or <code>WHERE YEAR(created_at) = 2026</code>. Use a range on the raw column or a functional/expression index.</li>
        <li>A leading wildcard: <code>LIKE '%phone'</code>. The B-tree is sorted by prefix, so there is no place to start. That is a job for a <a href="#/p/search-index">search index</a>.</li>
        <li>Type mismatches: comparing a <code>VARCHAR</code> phone column to a number forces a conversion on every row.</li>
        <li><code>OR</code> across different columns, unless the database can merge two indexes.</li>
      </ul>
    </div>

    <h2>The write cost of indexes</h2>
    <p>Indexes are not free. Every <code>INSERT</code> must add an entry to <em>every</em> index on the table, and every <code>UPDATE</code> of an indexed column must delete and re-insert in that index. A table with 1 clustered + 6 secondary indexes does about 7 tree modifications per insert, each possibly causing a page split. Each index also takes disk space and, more importantly, buffer-pool memory that could have cached data.</p>
    <ul>
      <li>Index for the queries you actually run (check the slow-query log), not "just in case".</li>
      <li>Drop unused and duplicate indexes; an index on <code>(a, b)</code> makes a separate index on <code>(a)</code> redundant.</li>
      <li>For bulk loads, it can be faster to drop secondary indexes, load, and rebuild them.</li>
    </ul>

    <h2>LSM trees: built for writes</h2>
    <p>B-trees update pages <em>in place</em>, which means random disk writes. A <strong>Log-Structured Merge tree</strong> (LSM tree) never modifies data in place. It turns all writes into sequential appends and sorts data in memory first. This is why write-heavy stores like Cassandra, ScyllaDB, HBase, Bigtable and RocksDB use it.</p>
    <figure class="svg-fig">
      <svg viewBox="0 0 680 330">
        <rect class="s-accent" x="20" y="40" width="130" height="50" rx="10"/>
        <text class="s-title" x="85" y="70" text-anchor="middle">put(k, v)</text>
        <rect class="s-green" x="220" y="40" width="180" height="50" rx="10"/>
        <text class="s-title" x="310" y="62" text-anchor="middle">Memtable</text>
        <text class="s-muted" x="310" y="80" text-anchor="middle">sorted, in RAM</text>
        <rect class="s-box" x="470" y="40" width="190" height="50" rx="10"/>
        <text class="s-title" x="565" y="62" text-anchor="middle">Immutable memtable</text>
        <text class="s-muted" x="565" y="80" text-anchor="middle">waiting to flush</text>
        <line class="s-line" x1="150" y1="65" x2="217" y2="65" marker-end="url(#arrow)"/>
        <text class="s-muted" x="184" y="56" text-anchor="middle">2</text>
        <line class="s-line" x1="400" y1="65" x2="467" y2="65" marker-end="url(#arrow)"/>
        <text class="s-muted" x="434" y="30" text-anchor="middle">when full</text>
        <line class="s-dash" x1="10" y1="125" x2="670" y2="125"/>
        <text class="s-muted" x="40" y="117" text-anchor="middle">RAM</text>
        <text class="s-muted" x="40" y="143" text-anchor="middle">disk</text>
        <rect class="s-amber" x="80" y="160" width="160" height="50" rx="10"/>
        <text class="s-title" x="160" y="182" text-anchor="middle">WAL</text>
        <text class="s-muted" x="160" y="200" text-anchor="middle">append-only log</text>
        <line class="s-line" x1="100" y1="90" x2="140" y2="157" marker-end="url(#arrow)"/>
        <text class="s-muted" x="100" y="130" text-anchor="middle">1</text>
        <rect class="s-box" x="470" y="160" width="190" height="40" rx="10"/>
        <text class="s-text" x="565" y="185" text-anchor="middle">L0: SST · SST · SST</text>
        <rect class="s-box" x="470" y="218" width="190" height="40" rx="10"/>
        <text class="s-text" x="565" y="243" text-anchor="middle">L1: sorted runs</text>
        <rect class="s-box" x="470" y="276" width="190" height="40" rx="10"/>
        <text class="s-text" x="565" y="301" text-anchor="middle">L2: ~10× bigger</text>
        <line class="s-line" x1="565" y1="90" x2="565" y2="157" marker-end="url(#arrow)"/>
        <text class="s-muted" x="595" y="130" text-anchor="middle">flush</text>
        <line class="s-line" x1="565" y1="200" x2="565" y2="215" marker-end="url(#arrow)"/>
        <line class="s-line" x1="565" y1="258" x2="565" y2="273" marker-end="url(#arrow)"/>
        <text class="s-title" x="360" y="240" text-anchor="middle">compaction</text>
        <text class="s-muted" x="360" y="260" text-anchor="middle">merges files, keeps newest</text>
        <text class="s-muted" x="360" y="278" text-anchor="middle">version, drops tombstones</text>
        <rect class="s-box" x="20" y="240" width="220" height="70" rx="10"/>
        <text class="s-text" x="130" y="266" text-anchor="middle">Each SSTable: sorted keys</text>
        <text class="s-muted" x="130" y="290" text-anchor="middle">+ sparse index + Bloom filter</text>
      </svg>
      <figcaption>LSM write path: (1) append to the write-ahead log for durability, (2) insert into the sorted memtable. Full memtables are flushed to immutable SSTables, which compaction merges in the background.</figcaption>
    </figure>
    <ol class="steps">
      <li><strong>WAL</strong>: the write is appended to a write-ahead log on disk (sequential, fast) so it survives a crash.</li>
      <li><strong>Memtable</strong>: the write goes into an in-memory sorted structure, usually a skip list. The client gets an ack. No disk page was read or rewritten.</li>
      <li><strong>Flush</strong>: when the memtable reaches a size limit (RocksDB's default is 64 MB), it is frozen and written to disk as an <strong>SSTable</strong> (Sorted String Table): an immutable file of sorted key-value pairs. The WAL for it can then be deleted.</li>
      <li><strong>Compaction</strong>: background threads merge SSTables (like the merge step of merge sort), keeping only the newest version of each key and removing deleted keys. This keeps the number of files, and so read cost, under control.</li>
    </ol>
    <h3>Reads, deletes and Bloom filters</h3>
    <p>A read checks the memtable first, then SSTables from newest to oldest, and stops at the first hit. Each SSTable has a small <strong>sparse index</strong> (the first key of every 4 to 64 KB block) so it can jump to one block and binary search it.</p>
    <p>Checking many files for a key that is not there would be slow, so every SSTable also has a <strong>Bloom filter</strong>: a compact bit array that answers "definitely not here" or "maybe here". With about 10 bits per key the false-positive rate is about 1%, so a read for a missing key skips almost every file without touching the disk.</p>
    <p>You cannot delete from an immutable file, so a delete writes a <strong>tombstone</strong>: a marker meaning "this key is deleted as of now". Reads that find a tombstone return "not found". Compaction finally drops the key once no older file can still hold it. Lots of tombstones (for example, a queue-like table in Cassandra) slow reads down until compaction catches up.</p>
    <div data-diagram="lsmread" data-caption="LSM read path: memtable first, then SSTables newest to oldest, using Bloom filters to skip files."></div>
    <h3>Compaction strategies</h3>
    <ul>
      <li><strong>Size-tiered</strong> (Cassandra's default, STCS): merge several SSTables of similar size into one bigger one. Lower write amplification; a key can live in many files, so reads may check more; needs free disk space during big merges.</li>
      <li><strong>Leveled</strong> (RocksDB and LevelDB default; Cassandra LCS): each level is about 10× bigger than the one above and files within a level do not overlap, so a read checks at most one file per level. Better reads and space, but more rewriting (higher write amplification).</li>
    </ul>

    <h3>Code: a tiny LSM key-value store</h3>
    <p>This toy keeps everything in memory but has the real shape: a sorted memtable that flushes to immutable sorted SSTables after N entries, reads that check the memtable and then SSTables newest to oldest with binary search, tombstones for deletes, and a compaction that merges all SSTables.</p>
    <div data-code="lsm"></div>

    <h2>B-tree vs LSM tree</h2>
    <p>Engineers compare them with three kinds of <strong>amplification</strong>: how much extra work the engine does compared to the data you asked for.</p>
    <table>
      <thead><tr><th>Aspect</th><th>B+ tree</th><th>LSM tree</th></tr></thead>
      <tbody>
        <tr><td>Write path</td><td>Find the page, modify it in place (random I/O), plus WAL/redo log</td><td>Append to WAL + memtable; sequential flushes</td></tr>
        <tr><td>Write amplification</td><td>Rewrites a whole 8 to 16 KB page to change a 100-byte row</td><td>Compaction rewrites each key several times (leveled: often 10 to 30×), but sequentially</td></tr>
        <tr><td>Read amplification</td><td>Low and predictable: one root-to-leaf walk</td><td>Higher: may check memtable + several SSTables (Bloom filters help point reads; range scans must merge files)</td></tr>
        <tr><td>Space amplification</td><td>Pages often 50 to 70% full after random inserts</td><td>Old versions and tombstones until compaction; compresses well since files are immutable</td></tr>
        <tr><td>Best for</td><td>Read-heavy, OLTP, range queries, transactions</td><td>Write-heavy: chat messages, events, IoT, time-series, logs</td></tr>
        <tr><td>Examples</td><td>MySQL InnoDB, PostgreSQL, Oracle, SQL Server, MongoDB (WiredTiger)</td><td>Cassandra, ScyllaDB, HBase, Bigtable, RocksDB, LevelDB; MyRocks; CockroachDB (Pebble); TiKV</td></tr>
      </tbody>
    </table>
    <div class="callout interview"><strong>Say this in the interview</strong>"Chat messages are write-heavy, append-only and read by <code>(chat_id, time)</code> ranges. An LSM-based store like Cassandra suits that: writes are sequential appends, and the partition key plus clustering key keeps each chat's messages sorted on disk. For orders and payments I'd use MySQL or Postgres, whose B-tree indexes give fast, predictable reads and transactions."</div>

    <h2>Hash indexes and other index types</h2>
    <p>A <strong>hash index</strong> maps <code>hash(key)</code> to a location. Point lookups are O(1), but there is no order, so no range queries, no <code>ORDER BY</code>, no prefix match.</p>
    <ul>
      <li>PostgreSQL has a <code>HASH</code> index type; MySQL's <code>MEMORY</code> engine uses hash indexes; InnoDB builds an internal "adaptive hash index" over hot B-tree pages automatically.</li>
      <li><strong>Bitcask</strong> (Riak's storage engine) keeps an in-memory hash map of every key to its offset in an append-only log file: one disk seek per read, but all keys must fit in RAM.</li>
      <li>Redis and Memcached are, at heart, giant in-memory hash tables.</li>
    </ul>
    <p>Other special-purpose indexes you should be able to name: <strong>inverted indexes</strong> for full-text search (see <a href="#/p/search-index">Search &amp; Inverted Indexes</a>), <strong>GIN</strong> indexes in Postgres for JSONB and arrays, <strong>R-trees / geohash</strong> for "restaurants near me", and <strong>bitmap / columnar</strong> indexes in analytics stores (see <a href="#/p/timeseries-olap">Time-Series &amp; Analytics Databases</a>).</p>

    <h2>Reading EXPLAIN</h2>
    <p>Put <code>EXPLAIN</code> in front of a query to see the plan without running it. <code>EXPLAIN ANALYZE</code> (Postgres, MySQL 8.0.18+) runs it and shows real row counts and timings.</p>
    <pre><code>EXPLAIN SELECT id, name FROM users WHERE city = 'Pune' AND age &gt; 25;

type: range   key: idx_city_age   rows: 41200   Extra: Using index condition</code></pre>
    <table>
      <thead><tr><th>MySQL <code>type</code> (best to worst)</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr><td><code>const</code> / <code>eq_ref</code></td><td>At most one row via a primary or unique key</td></tr>
        <tr><td><code>ref</code></td><td>Equality lookup on a non-unique index</td></tr>
        <tr><td><code>range</code></td><td>Index range scan (<code>BETWEEN</code>, <code>&gt;</code>, <code>IN</code>)</td></tr>
        <tr><td><code>index</code></td><td>Reads the whole index (better than the table, still a scan)</td></tr>
        <tr><td><code>ALL</code></td><td>Full table scan: the red flag</td></tr>
      </tbody>
    </table>
    <p>Also watch the <code>Extra</code> column: <code>Using index</code> (covering, good), <code>Using filesort</code> (sort step, check your ORDER BY columns), <code>Using temporary</code> (temp table for GROUP BY). In Postgres look for <code>Seq Scan</code> vs <code>Index Scan</code> / <code>Index Only Scan</code> / <code>Bitmap Heap Scan</code>, and compare estimated rows with actual rows: a big gap means stale statistics, fixed with <code>ANALYZE</code>.</p>

    <h2>Common interview questions and pitfalls</h2>
    <div class="callout interview"><strong>Say this in the interview</strong>
      <ul>
        <li>"The 'my orders' page queries by user, newest first, so I'll add a composite index on <code>(user_id, created_at DESC)</code>. That's one range scan and no sort, and with <code>LIMIT 20</code> it stops after 20 rows."</li>
        <li>"I'll use a time-ordered id as the primary key so inserts append to the right edge of the B-tree instead of splitting random pages."</li>
        <li>"Indexes speed up reads but slow down every write, so I'd only index columns that appear in hot WHERE, JOIN and ORDER BY clauses."</li>
        <li>"For a write-heavy append workload I'd choose an LSM-based store; for read-heavy transactional data a B-tree database."</li>
      </ul>
    </div>
    <div class="callout warn"><strong>Pitfalls</strong>Saying "just add an index" without saying which columns and in what order; indexing low-selectivity columns alone; forgetting that a composite index on <code>(a, b)</code> does not help a query on <code>b</code>; random UUID primary keys in InnoDB; using <code>LIKE '%term%'</code> for search; claiming LSM trees are always faster (they win on writes, not on reads).</div>

    <h2>Test yourself</h2>
    <div class="quiz">
      <details><summary>Why is a B+ tree only 3 or 4 levels deep even for a billion rows?</summary><div>Each node is a whole disk page (8 to 16 KB) that holds hundreds to about a thousand keys, so the fan-out is huge. 1,000 × 1,000 × 1,000 = 1 billion leaf pages at height 4. The top levels stay cached in memory, so a lookup costs only 1 or 2 disk reads.</div></details>
      <details><summary>You have an index on (user_id, status, created_at). Which of these use it to seek: (a) WHERE user_id = 5, (b) WHERE status = 'PAID', (c) WHERE user_id = 5 AND created_at &gt; '2026-01-01'?</summary><div>(a) yes, leftmost prefix. (b) no, status is not the leftmost column. (c) only partly: it seeks on <code>user_id</code>, but <code>created_at</code> cannot be used to seek because <code>status</code> is skipped; created_at is only filtered. An index on <code>(user_id, created_at)</code> would serve (c) fully.</div></details>
      <details><summary>In InnoDB, why does a lookup through a secondary index usually cost two tree traversals, and how do you avoid the second?</summary><div>Secondary index leaves store the primary key, not the row. The database must then search the clustered (primary key) index to get the full row. A covering index that includes all selected columns avoids the second lookup (EXPLAIN shows <code>Using index</code>).</div></details>
      <details><summary>How does an LSM tree handle a delete, given that SSTables are immutable?</summary><div>It writes a tombstone for the key into the memtable, which gets flushed like any other write. Reads that see the tombstone first return "not found". Compaction later removes the old values and eventually the tombstone itself.</div></details>
      <details><summary>What does a Bloom filter do in an LSM tree, and can it give a wrong answer?</summary><div>It lets a read skip SSTables that definitely do not contain the key. It can give false positives ("maybe here" when the key is not), costing one wasted block read, but never false negatives, so it never hides real data.</div></details>
      <details><summary>Your query <code>WHERE DATE(created_at) = '2026-11-11'</code> does a full scan despite an index on created_at. Why, and how do you fix it?</summary><div>Wrapping the column in a function means the index (sorted by raw created_at) cannot be searched. Rewrite as a range: <code>created_at &gt;= '2026-11-11' AND created_at &lt; '2026-11-12'</code>, or create an expression index on <code>DATE(created_at)</code>.</div></details>
    </div>

    <div class="takeaways"><h2>Key takeaways</h2><ul>
      <li>Databases read pages, not rows; an index turns an O(n) scan into an O(log n) walk of a few pages.</li>
      <li>B+ trees have huge fan-out (about 1,000), so 3 to 4 levels cover billions of rows; linked leaves make range scans and ORDER BY cheap.</li>
      <li>InnoDB clusters the table on the primary key; secondary indexes store the primary key, so keep it small and time-ordered.</li>
      <li>Composite indexes follow the leftmost-prefix rule; order columns Equality, Sort, Range; covering indexes skip the table entirely.</li>
      <li>Every index slows writes and uses memory; index for real queries and check with EXPLAIN.</li>
      <li>LSM trees (WAL + memtable + SSTables + compaction + Bloom filters) trade read and compaction cost for fast sequential writes: Cassandra and RocksDB vs MySQL and Postgres.</li>
    </ul></div>
  `,
  code: {
    lsm: {
      title: "Tiny LSM-style key-value store: memtable, SSTables, tombstones, compaction",
      java: String.raw`import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

public class Main {
    /** Immutable sorted run of keys. A null value is a tombstone (the key was deleted). */
    record SSTable(String[] keys, String[] values) {
        /** Binary search. Returns index of key, or -1 if absent. */
        int find(String key) {
            int lo = 0, hi = keys.length - 1;
            while (lo <= hi) {
                int mid = (lo + hi) >>> 1;
                int cmp = keys[mid].compareTo(key);
                if (cmp == 0) return mid;
                if (cmp < 0) lo = mid + 1; else hi = mid - 1;
            }
            return -1;
        }
    }

    static class LsmStore {
        private final int memtableLimit;
        // Sorted in-memory buffer. Real engines use a skip list; null value = tombstone.
        private TreeMap<String, String> memtable = new TreeMap<>();
        private final List<SSTable> sstables = new ArrayList<>(); // oldest first

        LsmStore(int memtableLimit) { this.memtableLimit = memtableLimit; }

        void put(String key, String value) { write(key, value); }

        void delete(String key) { write(key, null); } // write a tombstone, do not erase

        private void write(String key, String value) {
            // A real store appends to a write-ahead log (WAL) on disk first, for crash safety.
            memtable.put(key, value);
            if (memtable.size() >= memtableLimit) flush();
        }

        private void flush() {
            String[] keys = memtable.keySet().toArray(new String[0]);
            String[] values = memtable.values().toArray(new String[0]);
            sstables.add(new SSTable(keys, values)); // already sorted: TreeMap iterates in order
            memtable = new TreeMap<>();
        }

        String get(String key) {
            if (memtable.containsKey(key)) return memtable.get(key); // may be a tombstone (null)
            for (int i = sstables.size() - 1; i >= 0; i--) {          // newest to oldest
                SSTable t = sstables.get(i);
                int idx = t.find(key);
                if (idx >= 0) return t.values()[idx];
            }
            return null;
        }

        /** Merge all SSTables into one. Newer values win; tombstones are dropped. */
        void compact() {
            TreeMap<String, String> merged = new TreeMap<>();
            for (SSTable t : sstables) {                  // oldest first, so newer overwrite
                for (int i = 0; i < t.keys().length; i++) merged.put(t.keys()[i], t.values()[i]);
            }
            merged.values().removeIf(v -> v == null);     // safe: no older table remains below
            sstables.clear();
            if (!merged.isEmpty()) {
                sstables.add(new SSTable(merged.keySet().toArray(new String[0]),
                                         merged.values().toArray(new String[0])));
            }
        }

        String sizes() {
            List<Integer> s = new ArrayList<>();
            for (SSTable t : sstables) s.add(t.keys().length);
            return sstables.size() + ", sizes " + s;
        }
    }

    static String show(String v) { return v == null ? "(not found)" : v; }

    public static void main(String[] args) {
        LsmStore db = new LsmStore(3);
        db.put("user:1", "Asha");
        db.put("user:2", "Ravi");
        db.put("user:3", "Meera");      // memtable full: flush to SSTable 1
        db.put("user:1", "Asha K");     // newer version of user:1
        db.delete("user:2");            // tombstone
        db.put("user:4", "Kabir");      // flush to SSTable 2
        db.put("user:5", "Zoya");       // stays in the memtable

        for (String k : new String[] {"user:1", "user:2", "user:3", "user:5", "user:9"}) {
            System.out.println("get " + k + " -> " + show(db.get(k)));
        }
        System.out.println("SSTables before compaction: " + db.sizes());
        db.compact();
        System.out.println("SSTables after compaction: " + db.sizes());
        System.out.println("after compaction: user:1 -> " + show(db.get("user:1"))
                + ", user:2 -> " + show(db.get("user:2")) + ", user:4 -> " + show(db.get("user:4")));
    }
}
`,
      python: String.raw`from bisect import bisect_left

TOMBSTONE = None  # a deleted key is stored with value None


class SSTable:
    """Immutable sorted run of (key, value) pairs."""

    def __init__(self, items):
        self.keys = [k for k, _ in items]
        self.values = [v for _, v in items]

    def find(self, key):
        """Binary search. Returns (found, value)."""
        i = bisect_left(self.keys, key)
        if i < len(self.keys) and self.keys[i] == key:
            return True, self.values[i]
        return False, None


class LsmStore:
    def __init__(self, memtable_limit):
        self.memtable_limit = memtable_limit
        self.memtable = {}   # real engines keep this sorted (skip list); we sort on flush
        self.sstables = []   # oldest first

    def put(self, key, value):
        self._write(key, value)

    def delete(self, key):
        self._write(key, TOMBSTONE)  # write a tombstone, do not erase

    def _write(self, key, value):
        # A real store appends to a write-ahead log (WAL) on disk first, for crash safety.
        self.memtable[key] = value
        if len(self.memtable) >= self.memtable_limit:
            self._flush()

    def _flush(self):
        self.sstables.append(SSTable(sorted(self.memtable.items())))
        self.memtable = {}

    def get(self, key):
        if key in self.memtable:
            return self.memtable[key]          # may be a tombstone (None)
        for table in reversed(self.sstables):  # newest to oldest
            found, value = table.find(key)
            if found:
                return value
        return None

    def compact(self):
        """Merge all SSTables into one. Newer values win; tombstones are dropped."""
        merged = {}
        for table in self.sstables:            # oldest first, so newer overwrite
            merged.update(zip(table.keys, table.values))
        live = sorted((k, v) for k, v in merged.items() if v is not TOMBSTONE)
        self.sstables = [SSTable(live)] if live else []

    def sizes(self):
        return f"{len(self.sstables)}, sizes {[len(t.keys) for t in self.sstables]}"


def show(v):
    return "(not found)" if v is None else v


if __name__ == "__main__":
    db = LsmStore(3)
    db.put("user:1", "Asha")
    db.put("user:2", "Ravi")
    db.put("user:3", "Meera")    # memtable full: flush to SSTable 1
    db.put("user:1", "Asha K")   # newer version of user:1
    db.delete("user:2")          # tombstone
    db.put("user:4", "Kabir")    # flush to SSTable 2
    db.put("user:5", "Zoya")     # stays in the memtable

    for k in ["user:1", "user:2", "user:3", "user:5", "user:9"]:
        print(f"get {k} -> {show(db.get(k))}")
    print("SSTables before compaction:", db.sizes())
    db.compact()
    print("SSTables after compaction:", db.sizes())
    print(f"after compaction: user:1 -> {show(db.get('user:1'))}, "
          f"user:2 -> {show(db.get('user:2'))}, user:4 -> {show(db.get('user:4'))}")
`,
      cpp: String.raw`#include <algorithm>
#include <iostream>
#include <map>
#include <optional>
#include <string>
#include <utility>
#include <vector>

using Value = std::optional<std::string>;  // std::nullopt = tombstone

// Immutable sorted run of (key, value) pairs.
struct SSTable {
    std::vector<std::pair<std::string, Value>> rows;

    // Binary search. Returns pointer to the row, or nullptr if absent.
    const std::pair<std::string, Value>* find(const std::string& key) const {
        auto it = std::lower_bound(rows.begin(), rows.end(), key,
            [](const auto& row, const std::string& k) { return row.first < k; });
        if (it != rows.end() && it->first == key) return &*it;
        return nullptr;
    }
};

class LsmStore {
public:
    explicit LsmStore(size_t memtableLimit) : limit_(memtableLimit) {}

    void put(const std::string& key, const std::string& value) { write(key, value); }
    void remove(const std::string& key) { write(key, std::nullopt); }  // tombstone

    Value get(const std::string& key) const {
        if (auto it = memtable_.find(key); it != memtable_.end()) return it->second;
        for (auto t = sstables_.rbegin(); t != sstables_.rend(); ++t) {  // newest to oldest
            if (const auto* row = t->find(key)) return row->second;
        }
        return std::nullopt;
    }

    // Merge all SSTables into one. Newer values win; tombstones are dropped.
    void compact() {
        std::map<std::string, Value> merged;
        for (const auto& t : sstables_)                 // oldest first, so newer overwrite
            for (const auto& [k, v] : t.rows) merged[k] = v;
        SSTable out;
        for (const auto& [k, v] : merged)
            if (v) out.rows.emplace_back(k, v);
        sstables_.clear();
        if (!out.rows.empty()) sstables_.push_back(std::move(out));
    }

    std::string sizes() const {
        std::string s = std::to_string(sstables_.size()) + ", sizes [";
        for (size_t i = 0; i < sstables_.size(); ++i) {
            if (i) s += ", ";
            s += std::to_string(sstables_[i].rows.size());
        }
        return s + "]";
    }

private:
    void write(const std::string& key, Value value) {
        // A real store appends to a write-ahead log (WAL) on disk first, for crash safety.
        memtable_[key] = std::move(value);
        if (memtable_.size() >= limit_) flush();
    }

    void flush() {
        SSTable t;
        t.rows.assign(memtable_.begin(), memtable_.end());  // std::map iterates in sorted order
        sstables_.push_back(std::move(t));
        memtable_.clear();
    }

    size_t limit_;
    std::map<std::string, Value> memtable_;  // sorted; real engines use a skip list
    std::vector<SSTable> sstables_;          // oldest first
};

std::string show(const Value& v) { return v ? *v : "(not found)"; }

int main() {
    LsmStore db(3);
    db.put("user:1", "Asha");
    db.put("user:2", "Ravi");
    db.put("user:3", "Meera");    // memtable full: flush to SSTable 1
    db.put("user:1", "Asha K");   // newer version of user:1
    db.remove("user:2");          // tombstone
    db.put("user:4", "Kabir");    // flush to SSTable 2
    db.put("user:5", "Zoya");     // stays in the memtable

    for (const char* k : {"user:1", "user:2", "user:3", "user:5", "user:9"})
        std::cout << "get " << k << " -> " << show(db.get(k)) << "\n";
    std::cout << "SSTables before compaction: " << db.sizes() << "\n";
    db.compact();
    std::cout << "SSTables after compaction: " << db.sizes() << "\n";
    std::cout << "after compaction: user:1 -> " << show(db.get("user:1"))
              << ", user:2 -> " << show(db.get("user:2"))
              << ", user:4 -> " << show(db.get("user:4")) << "\n";
}
`,
      javascript: String.raw`const TOMBSTONE = null; // a deleted key is stored with value null

// Immutable sorted run of keys and values.
class SSTable {
  constructor(entries) {
    this.keys = entries.map((e) => e[0]);
    this.values = entries.map((e) => e[1]);
  }

  // Binary search. Returns the index of key, or -1 if absent.
  find(key) {
    let lo = 0, hi = this.keys.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.keys[mid] === key) return mid;
      if (this.keys[mid] < key) lo = mid + 1; else hi = mid - 1;
    }
    return -1;
  }
}

const byKey = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

class LsmStore {
  constructor(memtableLimit) {
    this.memtableLimit = memtableLimit;
    this.memtable = new Map(); // real engines keep this sorted (skip list); we sort on flush
    this.sstables = [];        // oldest first
  }

  put(key, value) { this.write(key, value); }

  delete(key) { this.write(key, TOMBSTONE); } // write a tombstone, do not erase

  write(key, value) {
    // A real store appends to a write-ahead log (WAL) on disk first, for crash safety.
    this.memtable.set(key, value);
    if (this.memtable.size >= this.memtableLimit) this.flush();
  }

  flush() {
    this.sstables.push(new SSTable([...this.memtable.entries()].sort(byKey)));
    this.memtable = new Map();
  }

  get(key) {
    if (this.memtable.has(key)) return this.memtable.get(key); // may be a tombstone
    for (let i = this.sstables.length - 1; i >= 0; i--) {      // newest to oldest
      const t = this.sstables[i];
      const idx = t.find(key);
      if (idx >= 0) return t.values[idx];
    }
    return null;
  }

  // Merge all SSTables into one. Newer values win; tombstones are dropped.
  compact() {
    const merged = new Map();
    for (const t of this.sstables) {                 // oldest first, so newer overwrite
      t.keys.forEach((k, i) => merged.set(k, t.values[i]));
    }
    const live = [...merged.entries()].filter((e) => e[1] !== TOMBSTONE).sort(byKey);
    this.sstables = live.length ? [new SSTable(live)] : [];
  }

  sizes() {
    return this.sstables.length + ", sizes [" + this.sstables.map((t) => t.keys.length).join(", ") + "]";
  }
}

const show = (v) => (v === null ? "(not found)" : v);

const db = new LsmStore(3);
db.put("user:1", "Asha");
db.put("user:2", "Ravi");
db.put("user:3", "Meera");   // memtable full: flush to SSTable 1
db.put("user:1", "Asha K");  // newer version of user:1
db.delete("user:2");         // tombstone
db.put("user:4", "Kabir");   // flush to SSTable 2
db.put("user:5", "Zoya");    // stays in the memtable

for (const k of ["user:1", "user:2", "user:3", "user:5", "user:9"]) {
  console.log("get " + k + " -> " + show(db.get(k)));
}
console.log("SSTables before compaction: " + db.sizes());
db.compact();
console.log("SSTables after compaction: " + db.sizes());
console.log("after compaction: user:1 -> " + show(db.get("user:1")) +
  ", user:2 -> " + show(db.get("user:2")) + ", user:4 -> " + show(db.get("user:4")));
`,
      go: String.raw`package main

import (
	"fmt"
	"sort"
)

// entry holds a value; deleted=true marks a tombstone.
type entry struct {
	key     string
	value   string
	deleted bool
}

// SSTable is an immutable run of entries sorted by key.
type SSTable struct{ rows []entry }

// find does a binary search and returns the entry, if present.
func (t *SSTable) find(key string) (entry, bool) {
	i := sort.Search(len(t.rows), func(i int) bool { return t.rows[i].key >= key })
	if i < len(t.rows) && t.rows[i].key == key {
		return t.rows[i], true
	}
	return entry{}, false
}

type LsmStore struct {
	limit    int
	memtable map[string]entry // real engines keep this sorted (skip list); we sort on flush
	sstables []*SSTable       // oldest first
}

func NewLsmStore(limit int) *LsmStore {
	return &LsmStore{limit: limit, memtable: map[string]entry{}}
}

func (s *LsmStore) Put(key, value string) { s.write(entry{key: key, value: value}) }

func (s *LsmStore) Delete(key string) { s.write(entry{key: key, deleted: true}) } // tombstone

func (s *LsmStore) write(e entry) {
	// A real store appends to a write-ahead log (WAL) on disk first, for crash safety.
	s.memtable[e.key] = e
	if len(s.memtable) >= s.limit {
		s.flush()
	}
}

func sortedRows(m map[string]entry, keepTombstones bool) []entry {
	rows := make([]entry, 0, len(m))
	for _, e := range m {
		if keepTombstones || !e.deleted {
			rows = append(rows, e)
		}
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].key < rows[j].key })
	return rows
}

func (s *LsmStore) flush() {
	s.sstables = append(s.sstables, &SSTable{rows: sortedRows(s.memtable, true)})
	s.memtable = map[string]entry{}
}

// Get returns the value and whether a live (non-deleted) value exists.
func (s *LsmStore) Get(key string) (string, bool) {
	if e, ok := s.memtable[key]; ok {
		return e.value, !e.deleted
	}
	for i := len(s.sstables) - 1; i >= 0; i-- { // newest to oldest
		if e, ok := s.sstables[i].find(key); ok {
			return e.value, !e.deleted
		}
	}
	return "", false
}

// Compact merges all SSTables into one. Newer values win; tombstones are dropped.
func (s *LsmStore) Compact() {
	merged := map[string]entry{}
	for _, t := range s.sstables { // oldest first, so newer overwrite
		for _, e := range t.rows {
			merged[e.key] = e
		}
	}
	live := sortedRows(merged, false)
	s.sstables = nil
	if len(live) > 0 {
		s.sstables = []*SSTable{{rows: live}}
	}
}

func (s *LsmStore) Sizes() string {
	sizes := make([]int, len(s.sstables))
	for i, t := range s.sstables {
		sizes[i] = len(t.rows)
	}
	out := fmt.Sprintf("%d, sizes [", len(s.sstables))
	for i, n := range sizes {
		if i > 0 {
			out += ", "
		}
		out += fmt.Sprint(n)
	}
	return out + "]"
}

func show(v string, ok bool) string {
	if !ok {
		return "(not found)"
	}
	return v
}

func main() {
	db := NewLsmStore(3)
	db.Put("user:1", "Asha")
	db.Put("user:2", "Ravi")
	db.Put("user:3", "Meera")  // memtable full: flush to SSTable 1
	db.Put("user:1", "Asha K") // newer version of user:1
	db.Delete("user:2")        // tombstone
	db.Put("user:4", "Kabir")  // flush to SSTable 2
	db.Put("user:5", "Zoya")   // stays in the memtable

	for _, k := range []string{"user:1", "user:2", "user:3", "user:5", "user:9"} {
		fmt.Println("get " + k + " -> " + show(db.Get(k)))
	}
	fmt.Println("SSTables before compaction: " + db.Sizes())
	db.Compact()
	fmt.Println("SSTables after compaction: " + db.Sizes())
	fmt.Println("after compaction: user:1 -> " + show(db.Get("user:1")) +
		", user:2 -> " + show(db.Get("user:2")) + ", user:4 -> " + show(db.Get("user:4")))
}
`,
    },
  },
  diagrams: {
    lookup: String.raw`flowchart LR
      Q["WHERE email = 'a@x.com'"] --> SI["Secondary index on email"]
      SI -->|"leaf holds PK = 42"| CI["Clustered index on id"]
      CI -->|"leaf holds full row"| R["Row 42"]`,
    lsmread: String.raw`flowchart TB
      G["get(key)"] --> M{"In memtable?"}
      M -->|yes| V["Return value, or not found if tombstone"]
      M -->|no| S["Next SSTable, newest first"]
      S --> BF{"Bloom filter: maybe here?"}
      BF -->|"no, skip file"| S
      BF -->|maybe| BS["Sparse index, read one block"]
      BS -->|found| V
      BS -->|"not in this file"| S
      S -->|"no files left"| NF["Not found"]`,
  },
});
