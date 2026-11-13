SD.register({
  id: "elevator",
  html: String.raw`
<p class="lead">"Design an elevator system" is a favourite machine-coding and LLD round at Amazon, Microsoft, Uber, Flipkart and many Indian startups. Everyone has used a lift, so nobody needs the domain explained. That makes it a pure test of modelling: can you separate <em>which car</em> answers a call from <em>in what order</em> a car visits its floors, model a car's life as a clean state machine, and keep the code open for new rules like VIP floors or fire mode? This page builds the full answer: the states, a direction-aware dispatcher, the FCFS vs SCAN vs LOOK scheduling question with real numbers, and a runnable tick-based simulation in five languages.</p>

<h2>Problem statement</h2>
<p>Design the control software for the lifts in an office tower, like the ones at a Bengaluru tech park or a Gurugram cyber city building. The building has <strong>N floors</strong> and <strong>M elevator cars</strong>. On every floor there are hall buttons: an UP button and a DOWN button (only UP on the ground floor, only DOWN on the top floor). Inside every car there is a panel with one button per floor, plus door-open and alarm buttons. The system must decide which car answers each hall call, move every car efficiently, open and close doors, respect each car's weight limit, and support maintenance and emergency modes.</p>
<p>Two kinds of request drive everything:</p>
<ul>
<li><strong>Hall call</strong> (also called a landing call): someone on floor 5 presses UP. The system knows the floor and the direction, but not the destination. It must <em>choose a car</em>.</li>
<li><strong>Car call</strong>: someone inside car B presses 9. The car is already chosen. It only has to <em>add a stop</em> to that car's plan.</li>
</ul>

<div class="callout tip"><strong>Try it first</strong>Before reading on, take 10 minutes. Write down every state one car can be in and what moves it from one state to the next. Then answer two separate questions: (1) a person on floor 6 presses UP while car A is at floor 2 going up and car B is idle at floor 9. Which car should go, and why? (2) Car A is at floor 10 going up, with stops at 14, 3, 18, 7, 1 and 16. In what order should it visit them?</div>

<details class="hint"><summary>Hint 1: Two decisions, two strategies</summary>
<p>"Which car serves this hall call?" is a building-level decision made once per call by a central controller. "In what order does this car visit its stops?" is a per-car decision made on every move. They change for different reasons (a new dispatch rule vs a new scheduling algorithm), so put each behind its own interface. That is two uses of the Strategy pattern.</p>
</details>
<details class="hint"><summary>Hint 2: The car is a state machine</summary>
<p>A car is IDLE, MOVING_UP, MOVING_DOWN, DOORS_OPEN or in MAINTENANCE. "A new stop was added" means different things in each: an idle car starts moving, a moving car just updates its plan, a car in maintenance ignores it. Draw the states and transitions first. The code follows from the diagram.</p>
</details>
<details class="hint"><summary>Hint 3: Keep going in the same direction</summary>
<p>Serving requests in the order they arrive (FCFS) makes the car zig-zag. Disk schedulers solved this decades ago: sweep in one direction, serving every stop on the way, then reverse. SCAN sweeps to the end of the shaft. LOOK reverses as soon as there is nothing further ahead. Real lifts behave like LOOK.</p>
</details>

<h2>Requirements</h2>
<p>Good clarifying questions: How many floors and cars? Do all cars serve all floors? Do we model weight, or only button presses? Do we need fire and maintenance modes? Is destination dispatch in scope?</p>
<div class="grid-2">
<div class="card">
<h3>Functional</h3>
<ul>
<li>N floors (numbered 0 to N-1) and M cars, each car serving every floor.</li>
<li>Hall calls with a direction (UP / DOWN) from any floor. The controller assigns each to one car.</li>
<li>Car calls from inside a car: add the floor to that car's stops.</li>
<li>Cars move one floor at a time, stop at their stops, open doors for a fixed time, then continue.</li>
<li>Per-car scheduling that keeps going in one direction while there is work ahead (LOOK).</li>
<li>Weight limit: a full car skips new hall calls; an overloaded car does not move.</li>
<li>Maintenance mode per car, and an emergency (fire) mode for the whole building.</li>
</ul>
</div>
<div class="card">
<h3>Non-functional</h3>
<ul>
<li><strong>Safety first:</strong> never move with doors open, never move when overloaded. Safety overrides efficiency.</li>
<li><strong>Low wait time:</strong> average wait under about 30 seconds at peak; no request waits forever (no starvation).</li>
<li><strong>Efficiency:</strong> fewer floors travelled means less energy and wear.</li>
<li><strong>Correct under concurrent presses:</strong> 20 floors can press buttons in the same second.</li>
<li><strong>Extensible:</strong> new dispatch rules (zoning, VIP floors), new scheduling algorithms and new modes without rewriting the core.</li>
<li><strong>Testable:</strong> a deterministic clock so the same inputs always give the same timeline.</li>
</ul>
</div>
</div>

<h2>How to approach the machine-coding round</h2>
<div class="callout info"><strong>Time plan for a 60 to 90 minute round</strong>
<table>
<thead><tr><th>Minutes</th><th>What you do</th></tr></thead>
<tbody>
<tr><td>0 to 8</td><td>Clarify floors, cars, hall vs car calls, weight, modes. Say out loud what you will skip (destination dispatch, multiple banks).</td></tr>
<tr><td>8 to 18</td><td>Draw the car state diagram. List entities. Name the two strategies: dispatch and scheduling.</td></tr>
<tr><td>18 to 55</td><td>Code <code>Direction</code>, <code>CarState</code>, <code>Car</code> with its <code>step()</code>, then <code>LookScheduler</code>, then the dispatcher's cost function, then the controller.</td></tr>
<tr><td>55 to 70</td><td>Write a demo with a scripted list of button presses and a tick loop. Print a timeline. Include an on-the-way pickup and a car in maintenance.</td></tr>
<tr><td>70 to 90</td><td>Walk through it. Explain FCFS vs SCAN vs LOOK, the concurrency model, and where fire mode or zoning would plug in.</td></tr>
</tbody>
</table>
<p>The biggest time trap is real time. Do not use <code>Thread.sleep</code> and background threads in the round. A <strong>tick-based simulation</strong> (one tick = one floor of travel) is deterministic, easy to test and easy to print. Mention that production code is event-driven, and explain how.</p>
<p><strong>What evaluators check:</strong></p>
<ol>
<li><strong>Separation:</strong> dispatching and scheduling are different classes behind interfaces, not one giant <code>if</code> in the controller.</li>
<li><strong>State modelling:</strong> explicit car states, with doors and maintenance handled.</li>
<li><strong>A sensible cost function:</strong> direction-aware, not just "nearest car".</li>
<li><strong>A runnable demo</strong> with more than the happy path.</li>
<li><strong>Concurrency story:</strong> how simultaneous presses are handled safely.</li>
</ol>
</div>

<h2>Core entities</h2>
<table>
<thead><tr><th>Entity</th><th>Kind</th><th>Responsibility</th></tr></thead>
<tbody>
<tr><td><code>Direction</code></td><td>Enum</td><td>UP, DOWN, NONE. Also used as the step (+1, -1, 0).</td></tr>
<tr><td><code>CarState</code></td><td>Enum (State)</td><td>IDLE, MOVING_UP, MOVING_DOWN, DOORS_OPEN, MAINTENANCE.</td></tr>
<tr><td><code>Car</code></td><td>Entity</td><td>Current floor, direction, state, the set of stops, door timer, load. <code>step()</code> advances it by one tick.</td></tr>
<tr><td><code>SchedulingStrategy</code></td><td>Interface (Strategy)</td><td>Given a car, which way should it move next? <code>LookScheduler</code> implements it.</td></tr>
<tr><td><code>DispatchStrategy</code></td><td>Interface (Strategy)</td><td>Given a hall call, how expensive is it for each car? <code>NearestCarDispatcher</code> uses a direction-aware cost.</td></tr>
<tr><td><code>ElevatorController</code></td><td>Service</td><td>Owns the cars, accepts hall and car calls, runs the clock, applies modes.</td></tr>
<tr><td><code>CarListener</code></td><td>Interface (Observer)</td><td>Floor displays, hall lanterns, logs and monitoring subscribe to car events.</td></tr>
<tr><td><code>HallCall</code>, <code>CarCall</code></td><td>Value objects</td><td>A floor plus a direction, or a car plus a floor. In production these are events in a queue.</td></tr>
</tbody>
</table>

<h2>Class diagram</h2>
<div data-diagram="classes" data-caption="The controller owns the cars. Dispatching and scheduling are separate strategies. Displays observe the cars."></div>

<h2>Car states</h2>
<div data-diagram="states" data-caption="One car's life. Maintenance is entered only from IDLE, so no passenger is stranded."></div>
<p>Every tick, a car does exactly one thing based on its state. The table below is the whole behaviour of a car on one screen:</p>
<table>
<thead><tr><th>State</th><th>On tick</th><th>New stop added</th><th>Maintenance key</th></tr></thead>
<tbody>
<tr><td><strong>IDLE</strong></td><td>If a stop is at this floor, open doors. Else if any stop exists, ask the scheduler for a direction and move.</td><td>Start moving next tick</td><td>Enter MAINTENANCE</td></tr>
<tr><td><strong>MOVING_UP / MOVING_DOWN</strong></td><td>Move one floor. If the new floor is a stop, open doors.</td><td>Join the plan; LOOK decides when</td><td>Refused until idle</td></tr>
<tr><td><strong>DOORS_OPEN</strong></td><td>Count down the door timer. At zero, close and decide what next (move on or go IDLE).</td><td>Join the plan</td><td>Refused until idle</td></tr>
<tr><td><strong>MAINTENANCE</strong></td><td>Do nothing.</td><td>Rejected (car calls) / never assigned (hall calls)</td><td>Back to IDLE</td></tr>
</tbody>
</table>
<p>Two safety rules live in this table. The car can only reach a moving state through a "doors closed" step, so it never moves with doors open. And maintenance is only allowed from IDLE with no stops, so the operator cannot switch off a car with people inside who are waiting for their floor.</p>

<h2>How a request flows</h2>
<div data-diagram="flow" data-caption="Hall calls go through the dispatcher, which picks a car. Car calls go straight to their car."></div>
<p>Every button press becomes an event in the controller's queue. Hall calls go through the dispatcher, which adds the stop to the cheapest car. Car calls go straight to their car. On every tick, each car runs its state machine and asks its scheduler which way to go. When doors open, observers update the displays and switch off the hall button.</p>

<h2>Dispatching: which car answers a hall call?</h2>
<p>"Send the nearest car" sounds right but is wrong. A car one floor below you that is going <em>down</em> is not near at all: it will go to the basement first and only then come back up. A good cost function estimates <strong>how many floors the car must travel before it can stop for you, heading your way</strong>.</p>
<table>
<thead><tr><th>Car situation</th><th>Call</th><th>Cost (floors)</th></tr></thead>
<tbody>
<tr><td>Idle at floor <code>c</code></td><td>Floor <code>f</code>, any direction</td><td><code>|c - f|</code></td></tr>
<tr><td>Going UP at <code>c</code>, <code>f &gt;= c</code></td><td>UP</td><td><code>f - c</code> (on the way)</td></tr>
<tr><td>Going UP, call behind it or going DOWN</td><td>Anything else</td><td>Go up to <code>top = max(c, f, highest stop)</code>, then come back: <code>(top - c) + (top - f)</code></td></tr>
<tr><td>Going DOWN at <code>c</code>, <code>f &lt;= c</code></td><td>DOWN</td><td><code>c - f</code> (on the way)</td></tr>
<tr><td>Going DOWN, anything else</td><td>Anything else</td><td>Mirror image with <code>bottom = min(c, f, lowest stop)</code></td></tr>
<tr><td>In MAINTENANCE, emergency, or full</td><td>Any</td><td>Infinite: never chosen</td></tr>
</tbody>
</table>
<p><strong>Worked example.</strong> 10 floors. Car A is at floor 5 going up with a stop at 8. Car B is idle at floor 7 with nothing to do. Two hall calls arrive in the same second:</p>
<ul>
<li><strong>Floor 2, UP.</strong> A is going up and floor 2 is behind it: A must go to 8 and come back, cost (8 - 5) + (8 - 2) = 9. B is idle: cost |7 - 2| = 5. <strong>B wins</strong>, and now has a stop at 2.</li>
<li><strong>Floor 6, UP.</strong> A is going up and 6 is ahead: on the way, cost 1. B has not moved yet, but it is about to head down to 2, so it must go to 2 first and come back up: (7 - 2) + (6 - 2) = 9. <strong>A wins</strong>, and stops at 6 on its way to 8.</li>
</ul>
<p>Plain "nearest car" would have scored B at distance 1 for the second call and sent it the wrong way. Notice the subtle case: car B is not moving yet but already has work. Treating it as idle would give a misleading cost of 1. The code asks the scheduler which way such a car is about to go and uses that direction.</p>
<p>Ties go to the first car in the list, which keeps the output deterministic. Real controllers add more terms to the cost: a penalty per pending stop (each stop costs about 10 seconds of doors), the car's current load, and energy (a heavy car going down generates power; going up costs it).</p>

<h2>Scheduling: in what order does one car visit its stops?</h2>
<p>Once a car has a set of stops, it must decide which way to go next. This is the same problem as moving a hard disk's read head across tracks, so the algorithms carry disk-scheduling names:</p>
<ul>
<li><strong>FCFS</strong> (first come, first served): visit stops in the order they were added. Simple and fair, but the car zig-zags.</li>
<li><strong>SSTF</strong> (shortest seek time first): always go to the nearest stop. Short total distance, but a stop at one end can wait forever while new calls keep arriving near the car. That is called <em>starvation</em>.</li>
<li><strong>SCAN</strong> (the "elevator algorithm"): move in one direction, serve every stop on the way, go all the way to the last floor, then reverse.</li>
<li><strong>LOOK</strong>: like SCAN, but reverse as soon as there are no more stops ahead. No pointless trip to the top floor.</li>
</ul>
<p><strong>Worked example.</strong> A 21-floor building (0 to 20). The car is at floor 10 going up. Pending stops, in the order they were pressed: 14, 3, 18, 7, 1, 16.</p>
<table>
<thead><tr><th>Algorithm</th><th>Visit order</th><th>Floors travelled</th><th>Starvation?</th></tr></thead>
<tbody>
<tr><td>FCFS</td><td>10 → 14 → 3 → 18 → 7 → 1 → 16</td><td>4 + 11 + 15 + 11 + 6 + 15 = <strong>62</strong></td><td>No</td></tr>
<tr><td>SSTF</td><td>10 → 7 → 3 → 1 → 14 → 16 → 18</td><td>3 + 4 + 2 + 13 + 2 + 2 = <strong>26</strong></td><td>Yes</td></tr>
<tr><td>SCAN</td><td>10 → 14 → 16 → 18 → (20) → 7 → 3 → 1</td><td>10 up + 19 down = <strong>29</strong></td><td>No</td></tr>
<tr><td>LOOK</td><td>10 → 14 → 16 → 18 → 7 → 3 → 1</td><td>8 up + 17 down = <strong>25</strong></td><td>No</td></tr>
</tbody>
</table>
<p>LOOK travels less than half of what FCFS does, and unlike SSTF it never abandons a direction while there is still work ahead, so every stop is served within at most two sweeps. SSTF looks close here only because the request list is fixed. With calls arriving continuously near the car, the person on floor 18 could wait indefinitely.</p>
<p>Try your own request lists in the widget below. Watch how FCFS's distance explodes when requests alternate between the top and the bottom, while SCAN and LOOK barely change.</p>
<div data-widget="elevator"></div>
<p>The same comparison as a small program. Each function returns the path the car takes:</p>
<div data-code="compare"></div>
<p>You may also hear of <strong>C-SCAN</strong> and <strong>C-LOOK</strong>, which serve stops in one direction only and jump back. They suit disks, not lifts, because a lift cannot make a non-stop return trip with people inside.</p>

<h2>Design patterns used and why</h2>
<h3>Strategy, twice</h3>
<p><code>DispatchStrategy</code> answers "how much does it cost car X to serve this call?". <code>SchedulingStrategy</code> answers "which way should this car move next?". Both are injected into the controller's constructor. A hospital may want a dispatcher that reserves a car for stretchers; a test may want FCFS as a baseline. Each is one new class, and nothing else changes (open/closed principle). See <a href="#/p/behavioral-patterns">behavioural patterns</a> for the general form.</p>

<h3>State, for the car</h3>
<p>The car's behaviour on every event depends on its state. In the code below, the states are an enum and <code>step()</code> switches on it. With one event (tick) and five states, that is the readable choice, and it is what most candidates write in a round. When events multiply (tick, door obstructed, overload, fire alarm, power failure), move each state into its own class, exactly like the <a href="#/p/vending-machine">vending machine</a>:</p>
<pre><code>interface CarStateHandler {
    void onTick(Car car);
    void onStopAdded(Car car, int floor);
    void onOverload(Car car);
    void onFireAlarm(Car car);
}
class IdleState implements CarStateHandler { ... }
class MovingState implements CarStateHandler { ... }   // holds the direction
class DoorsOpenState implements CarStateHandler { ... } // holds its own timer
class MaintenanceState implements CarStateHandler { ... }</code></pre>

<h3>Observer, for displays</h3>
<p>Floor displays in every lobby, hall lanterns, the building management system dashboard and an audit log all want to know when a car arrives or goes idle. The car should not know about any of them. It publishes events to a list of <code>CarListener</code>s. In the demo, a <code>ConsoleDisplay</code> prints the timeline.</p>

<h3>What about Singleton?</h3>
<p>There is one controller per building, so some candidates make it a Singleton. Avoid it. A building with separate low-rise and high-rise banks has two controllers, and tests need fresh instances. Create one in <code>main</code> and pass it around.</p>

<h2>Full implementation</h2>
<p>Each tab is one self-contained file. One tick is the time to travel one floor. Doors stay open for 2 ticks. The demo uses a 10-floor building with car A starting at the ground floor and car B at the top, then plays a script of button presses and prints the timeline. Car calls are given by car index (0 = A, 1 = B).</p>
<div data-code="full"></div>
<p>Expected output (identical in every language):</p>
<pre><code>t=00  hall call 4 UP -&gt; car A (cost 4)
t=00  hall call 7 DOWN -&gt; car B (cost 2)
t=01  car B doors open at floor 7
t=03  car A doors open at floor 4
t=03  car B idle at floor 7
t=05  car A button 8
t=06  hall call 2 UP -&gt; car B (cost 5)
t=06  hall call 6 UP -&gt; car A (cost 1)
t=06  car A doors open at floor 6
t=09  car A doors open at floor 8
t=10  car B doors open at floor 2
t=11  car B button 9
t=11  car A idle at floor 8
t=13  hall call 5 DOWN -&gt; car A (cost 3)
t=14  car B busy, maintenance refused
t=15  car A doors open at floor 5
t=17  car A idle at floor 5
t=18  car B doors open at floor 9
t=20  car B idle at floor 9
t=22  car B -&gt; MAINTENANCE
t=23  hall call 8 DOWN -&gt; car A (cost 3)
t=25  car A doors open at floor 8
t=27  car A idle at floor 8
t=30  car B back in service
car A: 14 floors travelled, now at 8 (IDLE)
car B: 14 floors travelled, now at 9 (IDLE)
total floors travelled: 28, finished at t=31</code></pre>
<p>Things to point out when you walk the interviewer through it:</p>
<ul>
<li><strong>t=00:</strong> floor 4 UP goes to A (cost 4; B would need 5). Floor 7 DOWN goes to B (cost 2). A already has work heading up, so its cost for a DOWN call at 7 is 7.</li>
<li><strong>t=06:</strong> the worked example from above. Floor 2 UP goes to idle B (cost 5), and floor 6 UP goes to A because it is on the way (cost 1). A stops at 6 at t=06 and reaches 8 at t=09.</li>
<li><strong>t=13:</strong> floor 5 DOWN goes to A, idle at 8 (cost 3). B is climbing from 3 to 9 and would need 6 + 4 = 10.</li>
<li><strong>t=14:</strong> maintenance for B is refused because it still has a passenger going to 9. At <strong>t=22</strong> it is idle and goes into maintenance.</li>
<li><strong>t=23:</strong> floor 8 DOWN. B is parked at 9 and would cost 1, but it is in maintenance, so A answers at cost 3.</li>
<li><strong>One simplification:</strong> a car keeps one set of stops, not separate "up" and "down" hall stops. A production car keeps two sets, so a car going up does not stop for someone who pressed DOWN (they would get in and ride the wrong way). It is a 10-line change: worth mentioning, not worth spending round time on.</li>
</ul>

<h2>Weight limit, maintenance and emergency modes</h2>
<h3>Capacity and weight</h3>
<p>Every car has a load sensor under the floor and a rated load, for example 1,088 kg or 16 persons in a typical office lift (Indian code assumes 68 kg per person). Two thresholds matter:</p>
<ul>
<li><strong>Full-load bypass</strong> (around 80% of rated load): the car is too full for more people. It keeps serving its own car calls but skips hall calls. The dispatcher's cost for it becomes infinite, and if a hall stop was already assigned, the controller re-dispatches it to another car.</li>
<li><strong>Overload</strong> (above 100%): the doors stay open, a buzzer sounds and the car refuses to move until someone steps out. In the state machine, the transition DOORS_OPEN to MOVING is guarded by <code>load &lt;= ratedLoad</code>.</li>
</ul>
<pre><code>int cost(Car car, int floor, Direction dir) {
    if (car.state == MAINTENANCE || car.loadKg &gt;= 0.8 * car.ratedKg) return INF; // full: skip hall calls
    ...
}</code></pre>

<h3>Maintenance</h3>
<p>The safe sequence is: stop giving the car new hall calls, let it finish its car calls, park with doors open, then enter MAINTENANCE. The demo implements the simple version (refuse while the car has stops). Any hall calls it held must be re-dispatched, so the controller should remember which stops came from hall calls.</p>

<h3>Emergency (fire service) mode</h3>
<p>When the fire alarm triggers, every car is recalled to the designated floor (usually the ground floor), skipping all stops on the way. It opens its doors and stays there. Hall and car calls are ignored. Model this as a building-wide mode in the controller: entering it clears every car's stops, adds the recall floor, and makes the dispatcher return infinite cost for everyone. With state classes, it is an <code>EmergencyRecallState</code> that ignores everything except "reached recall floor".</p>

<h2>Concurrency: many buttons at once</h2>
<p>At 9:30 am, people press buttons on 20 floors within the same second while cars report arrivals and door sensors fire. If several threads mutate car state directly, the dispatcher can read car A's floor mid-update, or two hall calls handled in parallel can both see car A as idle and both pile onto it.</p>
<p>The standard answer is a <strong>single dispatcher thread with an event queue</strong>, the same model as an embedded controller or a UI event loop:</p>
<pre><code>BlockingQueue&lt;Event&gt; events = new LinkedBlockingQueue&lt;&gt;();

// Button panels, door sensors and motor controllers only enqueue:
void onHallButton(int floor, Direction d) { events.put(new HallCall(floor, d)); }
void onCarArrived(int car, int floor)      { events.put(new Arrived(car, floor)); }

// Exactly one thread reads events and changes state, in order:
void runLoop() {
    while (true) {
        Event e = events.take();
        e.applyTo(controller);   // dispatch, add stop, open doors...
    }
}</code></pre>
<ul>
<li><strong>No locks on car state.</strong> Only one thread ever touches it, so every decision sees a consistent snapshot of all cars.</li>
<li><strong>Ordering is clear.</strong> Events are handled in arrival order, and replaying the queue reproduces a bug exactly.</li>
<li><strong>Duplicate presses are harmless.</strong> Pressing UP on floor 5 ten times adds the same stop ten times. Make <code>addStop</code> idempotent (the code uses a boolean per floor, so it already is).</li>
</ul>
<p>If the interviewer insists on shared memory, the fallback is one lock around "compute costs and assign", plus a lock per car for its stops. The single-thread design is simpler and easier to prove correct. More on this in <a href="#/p/concurrency">concurrency</a>.</p>

<h2>Extensibility</h2>
<div class="tabs">
<section data-tab="Destination dispatch">
<p>Many modern office towers have keypads in the lobby instead of UP/DOWN buttons. You key in floor 14, and the screen says "go to car C". Because the system knows destinations before assigning, it can group people going to nearby floors into the same car. In our design that is a new <code>DispatchStrategy</code> that receives a <code>(from, to)</code> pair instead of <code>(floor, direction)</code>. The cars and the scheduler do not change.</p>
</section>
<section data-tab="Zoning and banks">
<p>A 40-floor building splits cars into a low-rise bank (floors 0 to 20) and a high-rise bank (0 and 21 to 40). Each car gets a set of served floors, and the dispatcher's cost returns infinite for floors a car does not serve.</p>
</section>
</div>

<h2>Common mistakes</h2>
<div class="callout warn"><strong>Things that lose marks</strong>
<ul>
<li>Treating hall calls and car calls the same. A hall call needs a car to be chosen; a car call does not.</li>
<li>"Nearest car" by absolute distance, ignoring the car's direction and pending stops.</li>
<li>FCFS scheduling inside a car, or SSTF without mentioning starvation.</li>
<li>One <code>Elevator</code> god class that dispatches, schedules, moves and prints.</li>
<li>Boolean flags (<code>isMoving</code>, <code>doorsOpen</code>, <code>inMaintenance</code>) that can contradict each other, instead of one state.</li>
<li>Moving with doors open, or allowing maintenance while passengers are inside.</li>
<li>Real threads and <code>sleep()</code> in a 60-minute round: non-deterministic output and no time left to debug.</li>
<li>Forgetting to re-dispatch hall calls when a car goes full or out of service.</li>
</ul>
</div>

<div class="callout interview"><strong>Say this in the interview</strong>"I separate two decisions. A central controller picks a car for each hall call using a direction-aware cost: the floors the car must travel before it can stop for you heading your way, so a car going away from you is expensive even if it is close. Car calls go straight to their car. Each car runs LOOK: keep going while there are stops ahead, then reverse. That avoids FCFS zig-zags and SSTF starvation. Both decisions are Strategies, the car is a State machine with IDLE, MOVING_UP, MOVING_DOWN, DOORS_OPEN and MAINTENANCE, and displays are Observers. All button presses go into one event queue processed by a single thread, so there are no races on car state."</div>

<h2>Follow-up questions</h2>
<div class="quiz">
<details><summary>Why not always send the nearest car?</summary><div>Distance ignores direction. A car one floor below you that is heading down to the basement will travel far before it comes back. The right cost is the distance the car must travel before it can stop at your floor heading your way: on-the-way cars cost the direct distance, cars moving away cost the trip to the end of their sweep and back. Add penalties for pending stops and load, and give infinite cost to cars that are full or out of service.</div></details>
<details><summary>A car is at floor 10 going up with stops 14, 3, 18, 7, 1, 16 in a 0 to 20 building. Compare FCFS, SCAN and LOOK.</summary><div>FCFS: 10 → 14 → 3 → 18 → 7 → 1 → 16 = 62 floors. SCAN: up through 14, 16, 18 to the top floor 20, then down through 7, 3, 1 = 10 + 19 = 29 floors. LOOK: same but turn at 18 = 8 + 17 = 25 floors. LOOK wins and, unlike SSTF (26 here), cannot starve a far-away stop.</div></details>
<details><summary>What is starvation, and which algorithm suffers from it?</summary><div>Starvation is when a request waits indefinitely because newer requests keep getting priority. SSTF always serves the nearest stop, so if calls keep arriving near the car, a stop at the far end of the building is never reached. SCAN and LOOK cannot starve: the car keeps moving in one direction until no stops are ahead, so every stop is served within at most two sweeps.</div></details>
<details><summary>How do you handle 20 people pressing buttons at the same moment?</summary><div>Every button press becomes an event on a thread-safe queue. A single dispatcher thread takes events one by one and is the only code that changes car state. Each decision sees a consistent view of all cars, no locks are needed on car data, and the order of events is replayable for debugging. Duplicate presses are harmless because adding a stop is idempotent. A few hundred events per second is trivial for one thread.</div></details>
<details><summary>A car becomes full at floor 6 while it still has a hall stop at floor 4. What happens?</summary><div>Above the full-load threshold (about 80% of rated load), the car stops accepting hall calls. Its cost for new calls becomes infinite and the controller re-dispatches the floor 4 hall call to another car. The full car keeps serving its car calls, so people inside still reach their floors. If load goes above 100%, the doors stay open and the car does not move until someone steps out.</div></details>
<details><summary>How would you add fire service mode?</summary><div>Make it a building-wide mode on the controller. On the fire alarm, every car clears its stops, gets one stop at the recall floor, and travels there without stopping. It opens its doors and stays. The dispatcher returns infinite cost for every car, so hall calls are ignored, and car calls are rejected. With state classes, this is an <code>EmergencyRecallState</code> per car. No existing scheduling or dispatch code changes.</div></details>
</div>

<div class="takeaways"><h2>Key takeaways</h2><ul>
<li>Separate the two decisions: <strong>which car</strong> answers a hall call (dispatch) and <strong>in what order</strong> a car visits its stops (scheduling). Each is a Strategy.</li>
<li>Hall calls have a floor and a direction and need a car chosen. Car calls already belong to a car.</li>
<li>Use a direction-aware cost: floors travelled before the car can stop for you heading your way. Plain nearest-car is wrong.</li>
<li>LOOK beats FCFS by a wide margin (25 vs 62 floors in the worked example) and, unlike SSTF, never starves a request.</li>
<li>Model the car as a state machine: IDLE, MOVING_UP, MOVING_DOWN, DOORS_OPEN, MAINTENANCE. Safety rules live in the transitions.</li>
<li>In the round, simulate with ticks for deterministic output. In production, use one event queue and a single dispatcher thread.</li>
</ul></div>
`,
  code: {
    full: {
      title: "Elevator system: dispatcher + LOOK, tick-based simulation (single file, runnable)",
      java: String.raw`// Elevator system: tick-based simulation. A central dispatcher assigns hall calls;
// every car runs the LOOK algorithm. Run: javac ElevatorDemo.java && java ElevatorDemo
import java.util.*;

public class ElevatorDemo {

    enum Direction {
        UP(1), DOWN(-1), NONE(0);
        final int step;
        Direction(int step) { this.step = step; }
    }

    enum CarState { IDLE, MOVING_UP, MOVING_DOWN, DOORS_OPEN, MAINTENANCE }

    static final int DOOR_TICKS = 2; // doors stay open for 2 ticks; the car leaves on the 3rd
    static final int INF = 1_000_000_000;

    static void log(int t, String msg) { System.out.println(String.format("t=%02d  %s", t, msg)); }

    // ---------- Observer: floor displays and anything else that watches a car ----------
    interface CarListener {
        void onDoorsOpen(int t, Car car);
        void onIdle(int t, Car car);
    }

    static class ConsoleDisplay implements CarListener {
        public void onDoorsOpen(int t, Car car) { log(t, "car " + car.name + " doors open at floor " + car.floor); }
        public void onIdle(int t, Car car) { log(t, "car " + car.name + " idle at floor " + car.floor); }
    }

    // ---------- Strategy: per-car scheduling ----------
    interface SchedulingStrategy { Direction nextDirection(Car car); }

    static class LookScheduler implements SchedulingStrategy {
        public Direction nextDirection(Car car) {
            boolean above = car.hasStopAbove(), below = car.hasStopBelow();
            if (car.dir == Direction.UP && above) return Direction.UP;     // keep sweeping in the same direction
            if (car.dir == Direction.DOWN && below) return Direction.DOWN;
            if (above && below) {                                          // fresh start: nearer side, ties go up
                int up = car.floor + 1;
                while (!car.stops[up]) up++;
                int down = car.floor - 1;
                while (!car.stops[down]) down--;
                return up - car.floor <= car.floor - down ? Direction.UP : Direction.DOWN;
            }
            return above ? Direction.UP : Direction.DOWN;                  // nothing ahead: reverse
        }
    }

    // ---------- One elevator car (the State lives in car.state) ----------
    static class Car {
        final String name;
        final SchedulingStrategy scheduler;
        final boolean[] stops;
        final List<CarListener> listeners = new ArrayList<>();
        int floor, doorTicks, moves;
        Direction dir = Direction.NONE;
        CarState state = CarState.IDLE;

        Car(String name, int floor, int floors, SchedulingStrategy scheduler) {
            this.name = name; this.floor = floor; this.scheduler = scheduler;
            this.stops = new boolean[floors];
        }

        void addStop(int f) { stops[f] = true; }
        boolean hasStops() { for (boolean s : stops) if (s) return true; return false; }
        boolean hasStopAbove() { for (int f = floor + 1; f < stops.length; f++) if (stops[f]) return true; return false; }
        boolean hasStopBelow() { for (int f = floor - 1; f >= 0; f--) if (stops[f]) return true; return false; }
        int highestStop() { for (int f = stops.length - 1; f >= 0; f--) if (stops[f]) return f; return floor; }
        int lowestStop() { for (int f = 0; f < stops.length; f++) if (stops[f]) return f; return floor; }

        void openDoors(int t) {
            stops[floor] = false;
            state = CarState.DOORS_OPEN;
            doorTicks = DOOR_TICKS;
            for (CarListener l : listeners) l.onDoorsOpen(t, this);
        }

        // One tick of the car's state machine.
        void step(int t) {
            if (state == CarState.MAINTENANCE) return;
            if (state == CarState.DOORS_OPEN) {
                doorTicks--;
                if (doorTicks > 0) return;
                state = CarState.IDLE;                     // doors closed; decide what next
            }
            if (!hasStops()) {
                if (dir != Direction.NONE) {
                    dir = Direction.NONE;
                    for (CarListener l : listeners) l.onIdle(t, this);
                }
                state = CarState.IDLE;
                return;
            }
            if (stops[floor]) { openDoors(t); return; }    // call at the floor we are on
            dir = scheduler.nextDirection(this);
            floor += dir.step;
            moves++;
            state = dir == Direction.UP ? CarState.MOVING_UP : CarState.MOVING_DOWN;
            if (stops[floor]) openDoors(t);
        }
    }

    // ---------- Strategy: which car answers a hall call ----------
    interface DispatchStrategy {
        int cost(Car car, int floor, Direction dir);
    }

    static class NearestCarDispatcher implements DispatchStrategy {
        // Floors a car must travel before it can stop at 'floor' heading 'dir'.
        public int cost(Car car, int floor, Direction dir) {
            if (car.state == CarState.MAINTENANCE) return INF;
            Direction heading = car.dir;
            if (heading == Direction.NONE && (car.hasStopAbove() || car.hasStopBelow()))
                heading = car.scheduler.nextDirection(car);                            // assigned work, not moving yet
            if (heading == Direction.NONE) return Math.abs(car.floor - floor);         // truly idle
            if (heading == Direction.UP) {
                if (dir == Direction.UP && floor >= car.floor) return floor - car.floor;    // on the way
                int top = Math.max(car.floor, Math.max(floor, car.highestStop()));         // finish sweep, come back
                return (top - car.floor) + (top - floor);
            }
            if (dir == Direction.DOWN && floor <= car.floor) return car.floor - floor;
            int bottom = Math.min(car.floor, Math.min(floor, car.lowestStop()));
            return (car.floor - bottom) + (floor - bottom);
        }
    }

    // ---------- Controller: owns the cars, takes button presses, runs the clock ----------
    static class ElevatorController {
        final List<Car> cars = new ArrayList<>();
        final DispatchStrategy dispatcher;
        int time = 0;

        ElevatorController(int floors, int[] starts, DispatchStrategy dispatcher, SchedulingStrategy scheduler) {
            this.dispatcher = dispatcher;
            for (int i = 0; i < starts.length; i++)
                cars.add(new Car(String.valueOf((char) ('A' + i)), starts[i], floors, scheduler));
        }

        void addListener(CarListener l) { for (Car c : cars) c.listeners.add(l); }

        void hallCall(int floor, Direction dir) {
            Car best = null;
            int bestCost = INF;
            for (Car c : cars) {
                int k = dispatcher.cost(c, floor, dir);
                if (k < bestCost) { best = c; bestCost = k; } // strict '<': ties go to the earlier car
            }
            if (best == null) { log(time, "hall call " + floor + " " + dir + ": no car available"); return; }
            best.addStop(floor);
            log(time, "hall call " + floor + " " + dir + " -> car " + best.name + " (cost " + bestCost + ")");
        }

        void carCall(int i, int floor) {
            Car car = cars.get(i);
            if (car.state == CarState.MAINTENANCE) { log(time, "car " + car.name + " is in maintenance"); return; }
            car.addStop(floor);
            log(time, "car " + car.name + " button " + floor);
        }

        void setMaintenance(int i, boolean on) {
            Car car = cars.get(i);
            if (on && car.hasStops()) { log(time, "car " + car.name + " busy, maintenance refused"); return; }
            car.state = on ? CarState.MAINTENANCE : CarState.IDLE;
            car.dir = Direction.NONE;
            log(time, "car " + car.name + (on ? " -> MAINTENANCE" : " back in service"));
        }

        void tick() { for (Car c : cars) c.step(time); time++; }

        boolean allIdle() {
            for (Car c : cars)
                if (c.hasStops() || c.state == CarState.DOORS_OPEN || c.dir != Direction.NONE) return false;
            return true;
        }
    }

    record Event(int time, Runnable action) {}

    public static void main(String[] args) {
        ElevatorController ctl = new ElevatorController(10, new int[] {0, 9}, new NearestCarDispatcher(), new LookScheduler());
        ctl.addListener(new ConsoleDisplay());
        // Scripted button presses
        List<Event> script = List.of(
                new Event(0, () -> ctl.hallCall(4, Direction.UP)),
                new Event(0, () -> ctl.hallCall(7, Direction.DOWN)),
                new Event(5, () -> ctl.carCall(0, 8)),
                new Event(6, () -> ctl.hallCall(2, Direction.UP)),
                new Event(6, () -> ctl.hallCall(6, Direction.UP)),
                new Event(11, () -> ctl.carCall(1, 9)),
                new Event(13, () -> ctl.hallCall(5, Direction.DOWN)),
                new Event(14, () -> ctl.setMaintenance(1, true)),
                new Event(22, () -> ctl.setMaintenance(1, true)),
                new Event(23, () -> ctl.hallCall(8, Direction.DOWN)),
                new Event(30, () -> ctl.setMaintenance(1, false)));
        int lastEvent = script.get(script.size() - 1).time();
        int next = 0;
        while (ctl.time <= lastEvent || !ctl.allIdle()) {
            while (next < script.size() && script.get(next).time() == ctl.time) script.get(next++).action().run();
            ctl.tick();
        }
        int total = 0;
        for (Car c : ctl.cars) {
            System.out.println("car " + c.name + ": " + c.moves + " floors travelled, now at " + c.floor + " (" + c.state + ")");
            total += c.moves;
        }
        System.out.println("total floors travelled: " + total + ", finished at t=" + ctl.time);
    }
}`,
      python: String.raw`# Elevator system: tick-based simulation. A central dispatcher assigns hall calls;
# every car runs the LOOK algorithm. Run: python3 elevator.py
from __future__ import annotations

from enum import Enum
from typing import List, Optional, Tuple

UP, DOWN, NONE = 1, -1, 0
DIR_NAME = {UP: "UP", DOWN: "DOWN", NONE: "NONE"}
DOOR_TICKS = 2  # doors stay open for 2 ticks; the car leaves on the 3rd
INF = 1_000_000_000


class CarState(Enum):
    IDLE = "IDLE"
    MOVING_UP = "MOVING_UP"
    MOVING_DOWN = "MOVING_DOWN"
    DOORS_OPEN = "DOORS_OPEN"
    MAINTENANCE = "MAINTENANCE"


def log(t: int, msg: str) -> None:
    print(f"t={t:02d}  {msg}")


# ---------- Observer: floor displays and anything else that watches a car ----------
class ConsoleDisplay:
    def on_doors_open(self, t: int, car: Car) -> None:
        log(t, f"car {car.name} doors open at floor {car.floor}")

    def on_idle(self, t: int, car: Car) -> None:
        log(t, f"car {car.name} idle at floor {car.floor}")


# ---------- Strategy: per-car scheduling (LOOK) ----------
class LookScheduler:
    def next_direction(self, car: Car) -> int:
        above, below = car.has_stop_above(), car.has_stop_below()
        if car.dir == UP and above:  # keep sweeping in the same direction
            return UP
        if car.dir == DOWN and below:
            return DOWN
        if above and below:  # fresh start: go to the nearer side, ties go up
            up = car.floor + 1
            while not car.stops[up]:
                up += 1
            down = car.floor - 1
            while not car.stops[down]:
                down -= 1
            return UP if up - car.floor <= car.floor - down else DOWN
        return UP if above else DOWN  # nothing ahead: reverse


# ---------- One elevator car (the State lives in car.state) ----------
class Car:
    def __init__(self, name: str, floor: int, floors: int, scheduler: LookScheduler) -> None:
        self.name, self.floor, self.scheduler = name, floor, scheduler
        self.dir = NONE
        self.state = CarState.IDLE
        self.stops = [False] * floors
        self.door_ticks = 0
        self.moves = 0
        self.listeners: List[ConsoleDisplay] = []

    def add_stop(self, f: int) -> None:
        self.stops[f] = True

    def has_stops(self) -> bool:
        return any(self.stops)

    def has_stop_above(self) -> bool:
        return any(self.stops[self.floor + 1:])

    def has_stop_below(self) -> bool:
        return any(self.stops[:self.floor])

    def highest_stop(self) -> int:
        return max((f for f, s in enumerate(self.stops) if s), default=self.floor)

    def lowest_stop(self) -> int:
        return min((f for f, s in enumerate(self.stops) if s), default=self.floor)

    def open_doors(self, t: int) -> None:
        self.stops[self.floor] = False
        self.state = CarState.DOORS_OPEN
        self.door_ticks = DOOR_TICKS
        for listener in self.listeners:
            listener.on_doors_open(t, self)

    def step(self, t: int) -> None:
        """One tick of the car's state machine."""
        if self.state == CarState.MAINTENANCE:
            return
        if self.state == CarState.DOORS_OPEN:
            self.door_ticks -= 1
            if self.door_ticks > 0:
                return
            self.state = CarState.IDLE  # doors closed; decide what next
        if not self.has_stops():
            if self.dir != NONE:
                self.dir = NONE
                for listener in self.listeners:
                    listener.on_idle(t, self)
            self.state = CarState.IDLE
            return
        if self.stops[self.floor]:  # call at the floor we are on
            self.open_doors(t)
            return
        self.dir = self.scheduler.next_direction(self)
        self.floor += self.dir
        self.moves += 1
        self.state = CarState.MOVING_UP if self.dir == UP else CarState.MOVING_DOWN
        if self.stops[self.floor]:
            self.open_doors(t)


# ---------- Strategy: which car answers a hall call ----------
class NearestCarDispatcher:
    def cost(self, car: Car, floor: int, d: int) -> int:
        """Floors a car must travel before it can stop at 'floor' heading 'd'."""
        if car.state == CarState.MAINTENANCE:
            return INF
        heading = car.dir
        if heading == NONE and (car.has_stop_above() or car.has_stop_below()):
            heading = car.scheduler.next_direction(car)  # assigned work, not moving yet
        if heading == NONE:  # truly idle
            return abs(car.floor - floor)
        if heading == UP:
            if d == UP and floor >= car.floor:  # on the way
                return floor - car.floor
            top = max(car.floor, floor, car.highest_stop())  # finish the sweep, come back
            return (top - car.floor) + (top - floor)
        if d == DOWN and floor <= car.floor:
            return car.floor - floor
        bottom = min(car.floor, floor, car.lowest_stop())
        return (car.floor - bottom) + (floor - bottom)

    def select(self, cars: List[Car], floor: int, d: int) -> Optional[Tuple[Car, int]]:
        best, best_cost = None, INF
        for c in cars:
            k = self.cost(c, floor, d)
            if k < best_cost:  # strict '<': ties go to the earlier car
                best, best_cost = c, k
        return None if best is None else (best, best_cost)


# ---------- Controller: owns the cars, takes button presses, runs the clock ----------
class ElevatorController:
    def __init__(self, floors: int, starts: List[int], dispatcher: NearestCarDispatcher,
                 scheduler: LookScheduler) -> None:
        self.floors, self.dispatcher, self.time = floors, dispatcher, 0
        self.cars = [Car(chr(65 + i), f, floors, scheduler) for i, f in enumerate(starts)]

    def add_listener(self, listener: ConsoleDisplay) -> None:
        for c in self.cars:
            c.listeners.append(listener)

    def hall_call(self, floor: int, d: int) -> None:
        pick = self.dispatcher.select(self.cars, floor, d)
        if pick is None:
            log(self.time, f"hall call {floor} {DIR_NAME[d]}: no car available")
            return
        car, cost = pick
        car.add_stop(floor)
        log(self.time, f"hall call {floor} {DIR_NAME[d]} -> car {car.name} (cost {cost})")

    def car_call(self, i: int, floor: int) -> None:
        car = self.cars[i]
        if car.state == CarState.MAINTENANCE:
            log(self.time, f"car {car.name} is in maintenance")
            return
        car.add_stop(floor)
        log(self.time, f"car {car.name} button {floor}")

    def set_maintenance(self, i: int, on: bool) -> None:
        car = self.cars[i]
        if on and car.has_stops():
            log(self.time, f"car {car.name} busy, maintenance refused")
            return
        car.state = CarState.MAINTENANCE if on else CarState.IDLE
        car.dir = NONE
        log(self.time, f"car {car.name}" + (" -> MAINTENANCE" if on else " back in service"))

    def tick(self) -> None:
        for c in self.cars:
            c.step(self.time)
        self.time += 1

    def all_idle(self) -> bool:
        return all(not c.has_stops() and c.state != CarState.DOORS_OPEN and c.dir == NONE for c in self.cars)


def main() -> None:
    ctl = ElevatorController(10, [0, 9], NearestCarDispatcher(), LookScheduler())
    ctl.add_listener(ConsoleDisplay())
    # Scripted button presses: (time, action)
    script = [
        (0, lambda: ctl.hall_call(4, UP)),
        (0, lambda: ctl.hall_call(7, DOWN)),
        (5, lambda: ctl.car_call(0, 8)),
        (6, lambda: ctl.hall_call(2, UP)),
        (6, lambda: ctl.hall_call(6, UP)),
        (11, lambda: ctl.car_call(1, 9)),
        (13, lambda: ctl.hall_call(5, DOWN)),
        (14, lambda: ctl.set_maintenance(1, True)),
        (22, lambda: ctl.set_maintenance(1, True)),
        (23, lambda: ctl.hall_call(8, DOWN)),
        (30, lambda: ctl.set_maintenance(1, False)),
    ]
    last_event = script[-1][0]
    nxt = 0
    while ctl.time <= last_event or not ctl.all_idle():
        while nxt < len(script) and script[nxt][0] == ctl.time:
            script[nxt][1]()
            nxt += 1
        ctl.tick()
    total = 0
    for c in ctl.cars:
        print(f"car {c.name}: {c.moves} floors travelled, now at {c.floor} ({c.state.value})")
        total += c.moves
    print(f"total floors travelled: {total}, finished at t={ctl.time}")


if __name__ == "__main__":
    main()`,
      cpp: String.raw`// Elevator system: tick-based simulation. A central dispatcher assigns hall calls;
// every car runs the LOOK algorithm. Build: g++ -std=c++17 elevator.cpp -o elevator && ./elevator
#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <functional>
#include <memory>
#include <string>
#include <vector>
using namespace std;

enum Direction { DOWN = -1, NONE = 0, UP = 1 };
enum class CarState { IDLE, MOVING_UP, MOVING_DOWN, DOORS_OPEN, MAINTENANCE };
const char* dirName(Direction d) { return d == UP ? "UP" : d == DOWN ? "DOWN" : "NONE"; }
const char* stateName(CarState s) {
    switch (s) {
        case CarState::IDLE: return "IDLE";
        case CarState::MOVING_UP: return "MOVING_UP";
        case CarState::MOVING_DOWN: return "MOVING_DOWN";
        case CarState::DOORS_OPEN: return "DOORS_OPEN";
        default: return "MAINTENANCE";
    }
}
const int DOOR_TICKS = 2; // doors stay open for 2 ticks; the car leaves on the 3rd
const int INF = 1000000000;

void logLine(int t, const string& msg) { printf("t=%02d  %s\n", t, msg.c_str()); }

struct Car;

// ---------- Observer: floor displays and anything else that watches a car ----------
struct CarListener {
    virtual ~CarListener() = default;
    virtual void onDoorsOpen(int t, const Car& car) = 0;
    virtual void onIdle(int t, const Car& car) = 0;
};

// ---------- Strategy: per-car scheduling ----------
struct SchedulingStrategy {
    virtual ~SchedulingStrategy() = default;
    virtual Direction nextDirection(const Car& car) const = 0;
};

// ---------- One elevator car (the State lives in car.state) ----------
struct Car {
    string name;
    int floor, doorTicks = 0, moves = 0;
    Direction dir = NONE;
    CarState state = CarState::IDLE;
    vector<bool> stops;
    const SchedulingStrategy* scheduler;
    vector<CarListener*> listeners;

    Car(string n, int f, int floors, const SchedulingStrategy* s) : name(n), floor(f), stops(floors, false), scheduler(s) {}

    void addStop(int f) { stops[f] = true; }
    bool hasStops() const { return find(stops.begin(), stops.end(), true) != stops.end(); }
    bool hasStopAbove() const { for (int f = floor + 1; f < (int)stops.size(); f++) if (stops[f]) return true; return false; }
    bool hasStopBelow() const { for (int f = floor - 1; f >= 0; f--) if (stops[f]) return true; return false; }
    int highestStop() const { for (int f = (int)stops.size() - 1; f >= 0; f--) if (stops[f]) return f; return floor; }
    int lowestStop() const { for (int f = 0; f < (int)stops.size(); f++) if (stops[f]) return f; return floor; }

    void openDoors(int t) {
        stops[floor] = false;
        state = CarState::DOORS_OPEN;
        doorTicks = DOOR_TICKS;
        for (auto* l : listeners) l->onDoorsOpen(t, *this);
    }

    // One tick of the car's state machine.
    void step(int t) {
        if (state == CarState::MAINTENANCE) return;
        if (state == CarState::DOORS_OPEN) {
            if (--doorTicks > 0) return;
            state = CarState::IDLE;                    // doors closed; decide what next
        }
        if (!hasStops()) {
            if (dir != NONE) {
                dir = NONE;
                for (auto* l : listeners) l->onIdle(t, *this);
            }
            state = CarState::IDLE;
            return;
        }
        if (stops[floor]) { openDoors(t); return; }    // call at the floor we are on
        dir = scheduler->nextDirection(*this);
        floor += dir;
        moves++;
        state = dir == UP ? CarState::MOVING_UP : CarState::MOVING_DOWN;
        if (stops[floor]) openDoors(t);
    }
};

struct ConsoleDisplay : CarListener {
    void onDoorsOpen(int t, const Car& car) override { logLine(t, "car " + car.name + " doors open at floor " + to_string(car.floor)); }
    void onIdle(int t, const Car& car) override { logLine(t, "car " + car.name + " idle at floor " + to_string(car.floor)); }
};

struct LookScheduler : SchedulingStrategy {
    Direction nextDirection(const Car& car) const override {
        bool above = car.hasStopAbove(), below = car.hasStopBelow();
        if (car.dir == UP && above) return UP;         // keep sweeping in the same direction
        if (car.dir == DOWN && below) return DOWN;
        if (above && below) {                          // fresh start: nearer side, ties go up
            int up = car.floor + 1;
            while (!car.stops[up]) up++;
            int down = car.floor - 1;
            while (!car.stops[down]) down--;
            return up - car.floor <= car.floor - down ? UP : DOWN;
        }
        return above ? UP : DOWN;                      // nothing ahead: reverse
    }
};

// ---------- Strategy: which car answers a hall call ----------
struct DispatchStrategy {
    virtual ~DispatchStrategy() = default;
    virtual int cost(const Car& car, int floor, Direction dir) const = 0;
};

struct NearestCarDispatcher : DispatchStrategy {
    // Floors a car must travel before it can stop at 'floor' heading 'dir'.
    int cost(const Car& car, int floor, Direction dir) const override {
        if (car.state == CarState::MAINTENANCE) return INF;
        Direction heading = car.dir;
        if (heading == NONE && (car.hasStopAbove() || car.hasStopBelow()))
            heading = car.scheduler->nextDirection(car);                    // assigned work, not moving yet
        if (heading == NONE) return abs(car.floor - floor);                 // truly idle
        if (heading == UP) {
            if (dir == UP && floor >= car.floor) return floor - car.floor;   // on the way
            int top = max({car.floor, floor, car.highestStop()});           // finish the sweep, come back
            return (top - car.floor) + (top - floor);
        }
        if (dir == DOWN && floor <= car.floor) return car.floor - floor;
        int bottom = min({car.floor, floor, car.lowestStop()});
        return (car.floor - bottom) + (floor - bottom);
    }
};

// ---------- Controller: owns the cars, takes button presses, runs the clock ----------
class ElevatorController {
    const DispatchStrategy& dispatcher;
public:
    vector<Car> cars;
    int time = 0;

    ElevatorController(int floors, const vector<int>& starts, const DispatchStrategy& d, const SchedulingStrategy& s)
        : dispatcher(d) {
        for (size_t i = 0; i < starts.size(); i++) cars.emplace_back(string(1, char('A' + i)), starts[i], floors, &s);
    }
    void addListener(CarListener* l) { for (auto& c : cars) c.listeners.push_back(l); }

    void hallCall(int floor, Direction dir) {
        Car* best = nullptr;
        int bestCost = INF;
        for (auto& c : cars) {
            int k = dispatcher.cost(c, floor, dir);
            if (k < bestCost) { best = &c; bestCost = k; } // strict '<': ties go to the earlier car
        }
        string call = "hall call " + to_string(floor) + " " + dirName(dir);
        if (!best) { logLine(time, call + ": no car available"); return; }
        best->addStop(floor);
        logLine(time, call + " -> car " + best->name + " (cost " + to_string(bestCost) + ")");
    }

    void carCall(int i, int floor) {
        Car& car = cars[i];
        if (car.state == CarState::MAINTENANCE) { logLine(time, "car " + car.name + " is in maintenance"); return; }
        car.addStop(floor);
        logLine(time, "car " + car.name + " button " + to_string(floor));
    }

    void setMaintenance(int i, bool on) {
        Car& car = cars[i];
        if (on && car.hasStops()) { logLine(time, "car " + car.name + " busy, maintenance refused"); return; }
        car.state = on ? CarState::MAINTENANCE : CarState::IDLE;
        car.dir = NONE;
        logLine(time, "car " + car.name + (on ? " -> MAINTENANCE" : " back in service"));
    }

    void tick() { for (auto& c : cars) c.step(time); time++; }

    bool allIdle() const {
        for (auto& c : cars)
            if (c.hasStops() || c.state == CarState::DOORS_OPEN || c.dir != NONE) return false;
        return true;
    }
};

int main() {
    NearestCarDispatcher dispatcher;
    LookScheduler look;
    ConsoleDisplay display;
    ElevatorController ctl(10, {0, 9}, dispatcher, look);
    ctl.addListener(&display);
    // Scripted button presses: (time, action)
    vector<pair<int, function<void()>>> script = {
        {0, [&] { ctl.hallCall(4, UP); }},
        {0, [&] { ctl.hallCall(7, DOWN); }},
        {5, [&] { ctl.carCall(0, 8); }},
        {6, [&] { ctl.hallCall(2, UP); }},
        {6, [&] { ctl.hallCall(6, UP); }},
        {11, [&] { ctl.carCall(1, 9); }},
        {13, [&] { ctl.hallCall(5, DOWN); }},
        {14, [&] { ctl.setMaintenance(1, true); }},
        {22, [&] { ctl.setMaintenance(1, true); }},
        {23, [&] { ctl.hallCall(8, DOWN); }},
        {30, [&] { ctl.setMaintenance(1, false); }},
    };
    int lastEvent = script.back().first;
    size_t next = 0;
    while (ctl.time <= lastEvent || !ctl.allIdle()) {
        while (next < script.size() && script[next].first == ctl.time) script[next++].second();
        ctl.tick();
    }
    int total = 0;
    for (auto& c : ctl.cars) {
        printf("car %s: %d floors travelled, now at %d (%s)\n", c.name.c_str(), c.moves, c.floor, stateName(c.state));
        total += c.moves;
    }
    printf("total floors travelled: %d, finished at t=%d\n", total, ctl.time);
    return 0;
}`,
      javascript: String.raw`// Elevator system: tick-based simulation. A central dispatcher assigns hall calls;
// every car runs the LOOK algorithm. Run: node elevator.js

const UP = 1, DOWN = -1, NONE = 0;
const dirName = (d) => (d === UP ? "UP" : d === DOWN ? "DOWN" : "NONE");
const CarState = { IDLE: "IDLE", MOVING_UP: "MOVING_UP", MOVING_DOWN: "MOVING_DOWN", DOORS_OPEN: "DOORS_OPEN", MAINTENANCE: "MAINTENANCE" };
const DOOR_TICKS = 2; // doors stay open for 2 ticks; the car leaves on the 3rd
const INF = 1000000000;

function log(t, msg) { console.log("t=" + String(t).padStart(2, "0") + "  " + msg); }

// ---------- Observer: floor displays and anything else that watches a car ----------
class ConsoleDisplay {
  onDoorsOpen(t, car) { log(t, "car " + car.name + " doors open at floor " + car.floor); }
  onIdle(t, car) { log(t, "car " + car.name + " idle at floor " + car.floor); }
}

// ---------- Strategy: per-car scheduling (LOOK) ----------
class LookScheduler {
  nextDirection(car) {
    const above = car.hasStopAbove(), below = car.hasStopBelow();
    if (car.dir === UP && above) return UP;       // keep sweeping in the same direction
    if (car.dir === DOWN && below) return DOWN;
    if (above && below) {                          // fresh start: go to the nearer side, ties go up
      let up = car.floor + 1; while (!car.stops[up]) up++;
      let down = car.floor - 1; while (!car.stops[down]) down--;
      return up - car.floor <= car.floor - down ? UP : DOWN;
    }
    return above ? UP : DOWN;                      // nothing ahead: reverse
  }
}

// ---------- One elevator car (the State lives in car.state) ----------
class Car {
  constructor(name, floor, floors, scheduler) {
    this.name = name; this.floor = floor; this.scheduler = scheduler;
    this.dir = NONE; this.state = CarState.IDLE;
    this.stops = new Array(floors).fill(false);
    this.doorTicks = 0; this.moves = 0; this.listeners = [];
  }
  addStop(f) { this.stops[f] = true; }
  hasStops() { return this.stops.some((s) => s); }
  hasStopAbove() { for (let f = this.floor + 1; f < this.stops.length; f++) if (this.stops[f]) return true; return false; }
  hasStopBelow() { for (let f = this.floor - 1; f >= 0; f--) if (this.stops[f]) return true; return false; }
  highestStop() { for (let f = this.stops.length - 1; f >= 0; f--) if (this.stops[f]) return f; return this.floor; }
  lowestStop() { for (let f = 0; f < this.stops.length; f++) if (this.stops[f]) return f; return this.floor; }

  openDoors(t) {
    this.stops[this.floor] = false;
    this.state = CarState.DOORS_OPEN;
    this.doorTicks = DOOR_TICKS;
    this.listeners.forEach((l) => l.onDoorsOpen(t, this));
  }

  // One tick of the car's state machine.
  step(t) {
    if (this.state === CarState.MAINTENANCE) return;
    if (this.state === CarState.DOORS_OPEN) {
      this.doorTicks--;
      if (this.doorTicks > 0) return;
      this.state = CarState.IDLE;                  // doors closed; decide what next
    }
    if (!this.hasStops()) {
      if (this.dir !== NONE) { this.dir = NONE; this.listeners.forEach((l) => l.onIdle(t, this)); }
      this.state = CarState.IDLE;
      return;
    }
    if (this.stops[this.floor]) { this.openDoors(t); return; } // call at the floor we are on
    this.dir = this.scheduler.nextDirection(this);
    this.floor += this.dir;
    this.moves++;
    this.state = this.dir === UP ? CarState.MOVING_UP : CarState.MOVING_DOWN;
    if (this.stops[this.floor]) this.openDoors(t);
  }
}

// ---------- Strategy: which car answers a hall call ----------
class NearestCarDispatcher {
  // Floors a car must travel before it can stop at 'floor' heading 'dir'.
  cost(car, floor, dir) {
    if (car.state === CarState.MAINTENANCE) return INF;
    let heading = car.dir;
    if (heading === NONE && (car.hasStopAbove() || car.hasStopBelow()))
      heading = car.scheduler.nextDirection(car);                      // assigned work, not moving yet
    if (heading === NONE) return Math.abs(car.floor - floor);          // truly idle
    if (heading === UP) {
      if (dir === UP && floor >= car.floor) return floor - car.floor;  // on the way
      const top = Math.max(car.floor, floor, car.highestStop());      // finish the sweep, come back
      return (top - car.floor) + (top - floor);
    }
    if (dir === DOWN && floor <= car.floor) return car.floor - floor;
    const bottom = Math.min(car.floor, floor, car.lowestStop());
    return (car.floor - bottom) + (floor - bottom);
  }
  select(cars, floor, dir) {
    let best = null, bestCost = INF;
    for (const c of cars) {
      const k = this.cost(c, floor, dir);
      if (k < bestCost) { best = c; bestCost = k; } // strict '<': ties go to the earlier car
    }
    return best === null ? null : { car: best, cost: bestCost };
  }
}

// ---------- Controller: owns the cars, takes button presses, runs the clock ----------
class ElevatorController {
  constructor(floors, starts, dispatcher, scheduler) {
    this.floors = floors; this.dispatcher = dispatcher; this.time = 0;
    this.cars = starts.map((f, i) => new Car(String.fromCharCode(65 + i), f, floors, scheduler));
  }
  addListener(l) { this.cars.forEach((c) => c.listeners.push(l)); }
  hallCall(floor, dir) {
    const pick = this.dispatcher.select(this.cars, floor, dir);
    if (pick === null) { log(this.time, "hall call " + floor + " " + dirName(dir) + ": no car available"); return; }
    pick.car.addStop(floor);
    log(this.time, "hall call " + floor + " " + dirName(dir) + " -> car " + pick.car.name + " (cost " + pick.cost + ")");
  }
  carCall(i, floor) {
    const car = this.cars[i];
    if (car.state === CarState.MAINTENANCE) { log(this.time, "car " + car.name + " is in maintenance"); return; }
    car.addStop(floor);
    log(this.time, "car " + car.name + " button " + floor);
  }
  setMaintenance(i, on) {
    const car = this.cars[i];
    if (on && car.hasStops()) { log(this.time, "car " + car.name + " busy, maintenance refused"); return; }
    car.state = on ? CarState.MAINTENANCE : CarState.IDLE;
    car.dir = NONE;
    log(this.time, "car " + car.name + (on ? " -> MAINTENANCE" : " back in service"));
  }
  tick() { this.cars.forEach((c) => c.step(this.time)); this.time++; }
  allIdle() { return this.cars.every((c) => !c.hasStops() && c.state !== CarState.DOORS_OPEN && c.dir === NONE); }
}

function main() {
  const ctl = new ElevatorController(10, [0, 9], new NearestCarDispatcher(), new LookScheduler());
  ctl.addListener(new ConsoleDisplay());
  // Scripted button presses: [time, action]
  const script = [
    [0, () => ctl.hallCall(4, UP)],
    [0, () => ctl.hallCall(7, DOWN)],
    [5, () => ctl.carCall(0, 8)],
    [6, () => ctl.hallCall(2, UP)],
    [6, () => ctl.hallCall(6, UP)],
    [11, () => ctl.carCall(1, 9)],
    [13, () => ctl.hallCall(5, DOWN)],
    [14, () => ctl.setMaintenance(1, true)],
    [22, () => ctl.setMaintenance(1, true)],
    [23, () => ctl.hallCall(8, DOWN)],
    [30, () => ctl.setMaintenance(1, false)],
  ];
  const lastEvent = script[script.length - 1][0];
  let next = 0;
  while (ctl.time <= lastEvent || !ctl.allIdle()) {
    while (next < script.length && script[next][0] === ctl.time) { script[next][1](); next++; }
    ctl.tick();
  }
  let total = 0;
  for (const c of ctl.cars) { console.log("car " + c.name + ": " + c.moves + " floors travelled, now at " + c.floor + " (" + c.state + ")"); total += c.moves; }
  console.log("total floors travelled: " + total + ", finished at t=" + ctl.time);
}

main();`,
      go: String.raw`// Elevator system: tick-based simulation. A central dispatcher assigns hall calls;
// every car runs the LOOK algorithm. Run: go run elevator.go
package main

import "fmt"

type Direction int

const (
	Down Direction = -1
	None Direction = 0
	Up   Direction = 1
)

func (d Direction) String() string {
	switch d {
	case Up:
		return "UP"
	case Down:
		return "DOWN"
	}
	return "NONE"
}

type CarState string

const (
	Idle        CarState = "IDLE"
	MovingUp    CarState = "MOVING_UP"
	MovingDown  CarState = "MOVING_DOWN"
	DoorsOpen   CarState = "DOORS_OPEN"
	Maintenance CarState = "MAINTENANCE"
)

const doorTicks = 2 // doors stay open for 2 ticks; the car leaves on the 3rd
const inf = 1000000000

func logLine(t int, msg string) { fmt.Printf("t=%02d  %s\n", t, msg) }

// ---------- Observer: floor displays and anything else that watches a car ----------
type CarListener interface {
	OnDoorsOpen(t int, car *Car)
	OnIdle(t int, car *Car)
}

type ConsoleDisplay struct{}

func (ConsoleDisplay) OnDoorsOpen(t int, car *Car) {
	logLine(t, fmt.Sprintf("car %s doors open at floor %d", car.Name, car.Floor))
}
func (ConsoleDisplay) OnIdle(t int, car *Car) {
	logLine(t, fmt.Sprintf("car %s idle at floor %d", car.Name, car.Floor))
}

// ---------- Strategy: per-car scheduling ----------
type SchedulingStrategy interface{ NextDirection(car *Car) Direction }

type LookScheduler struct{}

func (LookScheduler) NextDirection(car *Car) Direction {
	above, below := car.HasStopAbove(), car.HasStopBelow()
	if car.Dir == Up && above { // keep sweeping in the same direction
		return Up
	}
	if car.Dir == Down && below {
		return Down
	}
	if above && below { // fresh start: nearer side, ties go up
		up := car.Floor + 1
		for !car.Stops[up] {
			up++
		}
		down := car.Floor - 1
		for !car.Stops[down] {
			down--
		}
		if up-car.Floor <= car.Floor-down {
			return Up
		}
		return Down
	}
	if above { // nothing ahead: reverse
		return Up
	}
	return Down
}

// ---------- One elevator car (the State lives in car.State) ----------
type Car struct {
	Name                    string
	Floor, doorTicks, Moves int
	Dir                     Direction
	State                   CarState
	Stops                   []bool
	scheduler               SchedulingStrategy
	listeners               []CarListener
}

func NewCar(name string, floor, floors int, s SchedulingStrategy) *Car {
	return &Car{Name: name, Floor: floor, Dir: None, State: Idle, Stops: make([]bool, floors), scheduler: s}
}

func (c *Car) AddStop(f int) { c.Stops[f] = true }

func (c *Car) HasStops() bool {
	for _, s := range c.Stops {
		if s {
			return true
		}
	}
	return false
}

func (c *Car) HasStopAbove() bool {
	for f := c.Floor + 1; f < len(c.Stops); f++ {
		if c.Stops[f] {
			return true
		}
	}
	return false
}

func (c *Car) HasStopBelow() bool {
	for f := c.Floor - 1; f >= 0; f-- {
		if c.Stops[f] {
			return true
		}
	}
	return false
}

func (c *Car) HighestStop() int {
	for f := len(c.Stops) - 1; f >= 0; f-- {
		if c.Stops[f] {
			return f
		}
	}
	return c.Floor
}

func (c *Car) LowestStop() int {
	for f := 0; f < len(c.Stops); f++ {
		if c.Stops[f] {
			return f
		}
	}
	return c.Floor
}

func (c *Car) openDoors(t int) {
	c.Stops[c.Floor] = false
	c.State = DoorsOpen
	c.doorTicks = doorTicks
	for _, l := range c.listeners {
		l.OnDoorsOpen(t, c)
	}
}

// Step runs one tick of the car's state machine.
func (c *Car) Step(t int) {
	if c.State == Maintenance {
		return
	}
	if c.State == DoorsOpen {
		c.doorTicks--
		if c.doorTicks > 0 {
			return
		}
		c.State = Idle // doors closed; decide what next
	}
	if !c.HasStops() {
		if c.Dir != None {
			c.Dir = None
			for _, l := range c.listeners {
				l.OnIdle(t, c)
			}
		}
		c.State = Idle
		return
	}
	if c.Stops[c.Floor] { // call at the floor we are on
		c.openDoors(t)
		return
	}
	c.Dir = c.scheduler.NextDirection(c)
	c.Floor += int(c.Dir)
	c.Moves++
	if c.Dir == Up {
		c.State = MovingUp
	} else {
		c.State = MovingDown
	}
	if c.Stops[c.Floor] {
		c.openDoors(t)
	}
}

// ---------- Strategy: which car answers a hall call ----------
type DispatchStrategy interface {
	Cost(car *Car, floor int, dir Direction) int
}

type NearestCarDispatcher struct{}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// Cost is the number of floors a car must travel before it can stop at floor heading dir.
func (NearestCarDispatcher) Cost(car *Car, floor int, dir Direction) int {
	if car.State == Maintenance {
		return inf
	}
	heading := car.Dir
	if heading == None && (car.HasStopAbove() || car.HasStopBelow()) {
		heading = car.scheduler.NextDirection(car) // assigned work, not moving yet
	}
	if heading == None { // truly idle
		return abs(car.Floor - floor)
	}
	if heading == Up {
		if dir == Up && floor >= car.Floor { // on the way
			return floor - car.Floor
		}
		top := max(car.Floor, floor, car.HighestStop()) // finish the sweep, come back
		return (top - car.Floor) + (top - floor)
	}
	if dir == Down && floor <= car.Floor {
		return car.Floor - floor
	}
	bottom := min(car.Floor, floor, car.LowestStop())
	return (car.Floor - bottom) + (floor - bottom)
}

// ---------- Controller: owns the cars, takes button presses, runs the clock ----------
type ElevatorController struct {
	Cars       []*Car
	dispatcher DispatchStrategy
	Time       int
}

func NewController(floors int, starts []int, d DispatchStrategy, s SchedulingStrategy) *ElevatorController {
	ctl := &ElevatorController{dispatcher: d}
	for i, f := range starts {
		ctl.Cars = append(ctl.Cars, NewCar(string(rune('A'+i)), f, floors, s))
	}
	return ctl
}

func (ctl *ElevatorController) AddListener(l CarListener) {
	for _, c := range ctl.Cars {
		c.listeners = append(c.listeners, l)
	}
}

func (ctl *ElevatorController) HallCall(floor int, dir Direction) {
	var best *Car
	bestCost := inf
	for _, c := range ctl.Cars {
		if k := ctl.dispatcher.Cost(c, floor, dir); k < bestCost { // strict '<': ties go to the earlier car
			best, bestCost = c, k
		}
	}
	if best == nil {
		logLine(ctl.Time, fmt.Sprintf("hall call %d %s: no car available", floor, dir))
		return
	}
	best.AddStop(floor)
	logLine(ctl.Time, fmt.Sprintf("hall call %d %s -> car %s (cost %d)", floor, dir, best.Name, bestCost))
}

func (ctl *ElevatorController) CarCall(i, floor int) {
	car := ctl.Cars[i]
	if car.State == Maintenance {
		logLine(ctl.Time, "car "+car.Name+" is in maintenance")
		return
	}
	car.AddStop(floor)
	logLine(ctl.Time, fmt.Sprintf("car %s button %d", car.Name, floor))
}

func (ctl *ElevatorController) SetMaintenance(i int, on bool) {
	car := ctl.Cars[i]
	if on && car.HasStops() {
		logLine(ctl.Time, "car "+car.Name+" busy, maintenance refused")
		return
	}
	car.Dir = None
	if on {
		car.State = Maintenance
		logLine(ctl.Time, "car "+car.Name+" -> MAINTENANCE")
	} else {
		car.State = Idle
		logLine(ctl.Time, "car "+car.Name+" back in service")
	}
}

func (ctl *ElevatorController) Tick() {
	for _, c := range ctl.Cars {
		c.Step(ctl.Time)
	}
	ctl.Time++
}

func (ctl *ElevatorController) AllIdle() bool {
	for _, c := range ctl.Cars {
		if c.HasStops() || c.State == DoorsOpen || c.Dir != None {
			return false
		}
	}
	return true
}

type event struct {
	time   int
	action func()
}

func main() {
	ctl := NewController(10, []int{0, 9}, NearestCarDispatcher{}, LookScheduler{})
	ctl.AddListener(ConsoleDisplay{})
	// Scripted button presses
	script := []event{
		{0, func() { ctl.HallCall(4, Up) }},
		{0, func() { ctl.HallCall(7, Down) }},
		{5, func() { ctl.CarCall(0, 8) }},
		{6, func() { ctl.HallCall(2, Up) }},
		{6, func() { ctl.HallCall(6, Up) }},
		{11, func() { ctl.CarCall(1, 9) }},
		{13, func() { ctl.HallCall(5, Down) }},
		{14, func() { ctl.SetMaintenance(1, true) }},
		{22, func() { ctl.SetMaintenance(1, true) }},
		{23, func() { ctl.HallCall(8, Down) }},
		{30, func() { ctl.SetMaintenance(1, false) }},
	}
	lastEvent := script[len(script)-1].time
	next := 0
	for ctl.Time <= lastEvent || !ctl.AllIdle() {
		for next < len(script) && script[next].time == ctl.Time {
			script[next].action()
			next++
		}
		ctl.Tick()
	}
	total := 0
	for _, c := range ctl.Cars {
		fmt.Printf("car %s: %d floors travelled, now at %d (%s)\n", c.Name, c.Moves, c.Floor, c.State)
		total += c.Moves
	}
	fmt.Printf("total floors travelled: %d, finished at t=%d\n", total, ctl.Time)
}`,
    },
    compare: {
      title: "FCFS vs SSTF vs SCAN vs LOOK on one request list",
      java: String.raw`// FCFS vs SSTF vs SCAN vs LOOK for one car. Each returns the path of floors visited.
import java.util.*;

public class Schedulers {

    static List<Integer> fcfs(int start, List<Integer> reqs) {
        List<Integer> path = new ArrayList<>(List.of(start));
        path.addAll(reqs);
        return path;
    }

    // Shortest seek first: always the nearest pending floor.
    static List<Integer> sstf(int start, List<Integer> reqs) {
        List<Integer> left = new ArrayList<>(reqs), path = new ArrayList<>(List.of(start));
        int at = start;
        while (!left.isEmpty()) {
            int best = 0;
            for (int i = 1; i < left.size(); i++)
                if (Math.abs(left.get(i) - at) < Math.abs(left.get(best) - at)) best = i;
            at = left.remove(best);
            path.add(at);
        }
        return path;
    }

    // The car starts moving UP. SCAN rides to the end before reversing; LOOK does not.
    static List<Integer> sweep(int start, List<Integer> reqs, int top, boolean goToEnd) {
        List<Integer> up = new ArrayList<>(), down = new ArrayList<>();
        for (int f : reqs) (f >= start ? up : down).add(f);
        Collections.sort(up);
        down.sort(Collections.reverseOrder());
        List<Integer> path = new ArrayList<>(List.of(start));
        path.addAll(up);
        if (goToEnd && !down.isEmpty() && path.get(path.size() - 1) != top) path.add(top);
        path.addAll(down);
        return path;
    }

    static int distance(List<Integer> path) {
        int d = 0;
        for (int i = 1; i < path.size(); i++) d += Math.abs(path.get(i) - path.get(i - 1));
        return d;
    }

    static void show(String name, List<Integer> path) {
        StringJoiner sj = new StringJoiner(" -> ");
        for (int f : path) sj.add(String.valueOf(f));
        System.out.println(name + ": " + sj + " = " + distance(path) + " floors");
    }

    public static void main(String[] args) {
        int start = 10, top = 20;
        List<Integer> reqs = List.of(14, 3, 18, 7, 1, 16);
        StringJoiner sj = new StringJoiner(", ");
        for (int f : reqs) sj.add(String.valueOf(f));
        System.out.println("Start at floor " + start + " going UP. Requests: " + sj + ". Top floor " + top);
        show("FCFS", fcfs(start, reqs));
        show("SSTF", sstf(start, reqs));
        show("SCAN", sweep(start, reqs, top, true));
        show("LOOK", sweep(start, reqs, top, false));
    }
}`,
      python: String.raw`# FCFS vs SSTF vs SCAN vs LOOK for one car. Each returns the path of floors visited.
from typing import List


def fcfs(start: int, reqs: List[int]) -> List[int]:
    return [start, *reqs]


def sstf(start: int, reqs: List[int]) -> List[int]:
    """Shortest seek first: always the nearest pending floor."""
    left, path, at = list(reqs), [start], start
    while left:
        best = 0
        for i in range(1, len(left)):
            if abs(left[i] - at) < abs(left[best] - at):
                best = i
        at = left.pop(best)
        path.append(at)
    return path


def sweep(start: int, reqs: List[int], top: int, go_to_end: bool) -> List[int]:
    """The car starts moving UP. SCAN rides to the end before reversing; LOOK does not."""
    up = sorted(f for f in reqs if f >= start)
    down = sorted((f for f in reqs if f < start), reverse=True)
    path = [start, *up]
    if go_to_end and down and path[-1] != top:
        path.append(top)
    return path + down


def distance(path: List[int]) -> int:
    return sum(abs(b - a) for a, b in zip(path, path[1:]))


def show(name: str, path: List[int]) -> None:
    print(f"{name}: {' -> '.join(map(str, path))} = {distance(path)} floors")


start, top, reqs = 10, 20, [14, 3, 18, 7, 1, 16]
print(f"Start at floor {start} going UP. Requests: {', '.join(map(str, reqs))}. Top floor {top}")
show("FCFS", fcfs(start, reqs))
show("SSTF", sstf(start, reqs))
show("SCAN", sweep(start, reqs, top, True))
show("LOOK", sweep(start, reqs, top, False))`,
      cpp: String.raw`// FCFS vs SSTF vs SCAN vs LOOK for one car. Each returns the path of floors visited.
#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <functional>
#include <string>
#include <vector>
using namespace std;

vector<int> fcfs(int start, const vector<int>& reqs) {
    vector<int> path = {start};
    path.insert(path.end(), reqs.begin(), reqs.end());
    return path;
}

// Shortest seek first: always the nearest pending floor.
vector<int> sstf(int start, vector<int> left) {
    vector<int> path = {start};
    int at = start;
    while (!left.empty()) {
        size_t best = 0;
        for (size_t i = 1; i < left.size(); i++)
            if (abs(left[i] - at) < abs(left[best] - at)) best = i;
        at = left[best];
        left.erase(left.begin() + best);
        path.push_back(at);
    }
    return path;
}

// The car starts moving UP. SCAN rides to the end before reversing; LOOK does not.
vector<int> sweep(int start, const vector<int>& reqs, int top, bool goToEnd) {
    vector<int> up, down;
    for (int f : reqs) (f >= start ? up : down).push_back(f);
    sort(up.begin(), up.end());
    sort(down.begin(), down.end(), greater<int>());
    vector<int> path = {start};
    path.insert(path.end(), up.begin(), up.end());
    if (goToEnd && !down.empty() && path.back() != top) path.push_back(top);
    path.insert(path.end(), down.begin(), down.end());
    return path;
}

int distance(const vector<int>& path) {
    int d = 0;
    for (size_t i = 1; i < path.size(); i++) d += abs(path[i] - path[i - 1]);
    return d;
}

string join(const vector<int>& v, const string& sep) {
    string s;
    for (size_t i = 0; i < v.size(); i++) s += (i ? sep : "") + to_string(v[i]);
    return s;
}

void show(const char* name, const vector<int>& path) {
    printf("%s: %s = %d floors\n", name, join(path, " -> ").c_str(), distance(path));
}

int main() {
    int start = 10, top = 20;
    vector<int> reqs = {14, 3, 18, 7, 1, 16};
    printf("Start at floor %d going UP. Requests: %s. Top floor %d\n", start, join(reqs, ", ").c_str(), top);
    show("FCFS", fcfs(start, reqs));
    show("SSTF", sstf(start, reqs));
    show("SCAN", sweep(start, reqs, top, true));
    show("LOOK", sweep(start, reqs, top, false));
    return 0;
}`,
      javascript: String.raw`// FCFS vs SSTF vs SCAN vs LOOK for one car. Each returns the path of floors visited.
function fcfs(start, reqs) { return [start, ...reqs]; }

function sstf(start, reqs) {            // shortest seek first: always the nearest pending floor
  const left = reqs.slice(), path = [start];
  let at = start;
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (Math.abs(left[i] - at) < Math.abs(left[best] - at)) best = i;
    at = left.splice(best, 1)[0];
    path.push(at);
  }
  return path;
}

function sweep(start, reqs, top, goToEnd) { // car starts moving UP
  const up = reqs.filter((f) => f >= start).sort((a, b) => a - b);
  const down = reqs.filter((f) => f < start).sort((a, b) => b - a);
  const path = [start, ...up];
  if (goToEnd && down.length && path[path.length - 1] !== top) path.push(top); // SCAN rides to the end
  return path.concat(down);
}

function distance(path) {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += Math.abs(path[i] - path[i - 1]);
  return d;
}

function show(name, path) { console.log(name + ": " + path.join(" -> ") + " = " + distance(path) + " floors"); }

const start = 10, top = 20, reqs = [14, 3, 18, 7, 1, 16];
console.log("Start at floor " + start + " going UP. Requests: " + reqs.join(", ") + ". Top floor " + top);
show("FCFS", fcfs(start, reqs));
show("SSTF", sstf(start, reqs));
show("SCAN", sweep(start, reqs, top, true));
show("LOOK", sweep(start, reqs, top, false));`,
      go: String.raw`// FCFS vs SSTF vs SCAN vs LOOK for one car. Each returns the path of floors visited.
package main

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

func fcfs(start int, reqs []int) []int { return append([]int{start}, reqs...) }

// sstf (shortest seek first) always goes to the nearest pending floor.
func sstf(start int, reqs []int) []int {
	left := append([]int(nil), reqs...)
	path, at := []int{start}, start
	for len(left) > 0 {
		best := 0
		for i := 1; i < len(left); i++ {
			if abs(left[i]-at) < abs(left[best]-at) {
				best = i
			}
		}
		at = left[best]
		left = append(left[:best], left[best+1:]...)
		path = append(path, at)
	}
	return path
}

// sweep: the car starts moving UP. SCAN rides to the end before reversing; LOOK does not.
func sweep(start int, reqs []int, top int, goToEnd bool) []int {
	var up, down []int
	for _, f := range reqs {
		if f >= start {
			up = append(up, f)
		} else {
			down = append(down, f)
		}
	}
	sort.Ints(up)
	sort.Sort(sort.Reverse(sort.IntSlice(down)))
	path := append([]int{start}, up...)
	if goToEnd && len(down) > 0 && path[len(path)-1] != top {
		path = append(path, top)
	}
	return append(path, down...)
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

func distance(path []int) int {
	d := 0
	for i := 1; i < len(path); i++ {
		d += abs(path[i] - path[i-1])
	}
	return d
}

func join(v []int, sep string) string {
	parts := make([]string, len(v))
	for i, x := range v {
		parts[i] = strconv.Itoa(x)
	}
	return strings.Join(parts, sep)
}

func show(name string, path []int) {
	fmt.Printf("%s: %s = %d floors\n", name, join(path, " -> "), distance(path))
}

func main() {
	start, top := 10, 20
	reqs := []int{14, 3, 18, 7, 1, 16}
	fmt.Printf("Start at floor %d going UP. Requests: %s. Top floor %d\n", start, join(reqs, ", "), top)
	show("FCFS", fcfs(start, reqs))
	show("SSTF", sstf(start, reqs))
	show("SCAN", sweep(start, reqs, top, true))
	show("LOOK", sweep(start, reqs, top, false))
}`,
    },
  },
  diagrams: {
    classes: String.raw`classDiagram
  class ElevatorController {
    -List~Car~ cars
    -DispatchStrategy dispatcher
    -int time
    +hallCall(int floor, Direction dir)
    +carCall(int car, int floor)
    +setMaintenance(int car, bool on)
    +tick()
  }
  class Car {
    -String name
    -int floor
    -Direction dir
    -CarState state
    -bool[] stops
    -int doorTicks
    +addStop(int floor)
    +step(int t)
  }
  class CarState {
    <<enumeration>>
    IDLE
    MOVING_UP
    MOVING_DOWN
    DOORS_OPEN
    MAINTENANCE
  }
  class Direction {
    <<enumeration>>
    UP
    DOWN
    NONE
  }
  class DispatchStrategy {
    <<interface>>
    +cost(Car car, int floor, Direction dir) int
  }
  class NearestCarDispatcher
  class SchedulingStrategy {
    <<interface>>
    +nextDirection(Car car) Direction
  }
  class LookScheduler
  class CarListener {
    <<interface>>
    +onDoorsOpen(int t, Car car)
    +onIdle(int t, Car car)
  }
  class ConsoleDisplay
  ElevatorController "1" *-- "M" Car
  ElevatorController --> DispatchStrategy
  Car --> SchedulingStrategy
  Car --> CarState
  Car --> Direction
  Car o-- CarListener
  DispatchStrategy <|.. NearestCarDispatcher
  SchedulingStrategy <|.. LookScheduler
  CarListener <|.. ConsoleDisplay`,
    flow: String.raw`flowchart TB
  HB["Hall button: floor 6 UP"] --> Q[Event queue]
  CB["Car button: car B to 9"] --> Q
  Q --> CT[Controller thread]
  CT -->|hall call| DS[Dispatcher: cost per car]
  DS -->|cheapest| CA[Car A stops]
  CT -->|car call| CBS[Car B stops]
  CA --> LK[LOOK scheduler]
  CBS --> LK
  LK --> MO[Motor and doors]
  MO -->|arrived| OB["Observers: displays, lanterns"]`,
    states: String.raw`stateDiagram-v2
  [*] --> IDLE
  IDLE --> MOVING_UP: stop above
  IDLE --> MOVING_DOWN: stop below
  IDLE --> DOORS_OPEN: call at this floor
  MOVING_UP --> DOORS_OPEN: reached a stop
  MOVING_DOWN --> DOORS_OPEN: reached a stop
  DOORS_OPEN --> MOVING_UP: doors closed, LOOK says up
  DOORS_OPEN --> MOVING_DOWN: doors closed, LOOK says down
  DOORS_OPEN --> IDLE: doors closed, no stops
  IDLE --> MAINTENANCE: key on, no stops
  MAINTENANCE --> IDLE: key off`,
  },
});
