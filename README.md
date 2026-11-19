# AI & Ethics — lunch session

An interactive lunch session for the team: the host runs it from a laptop on the big screen, everyone else joins on their phone with a QR code or a code. Answers are anonymous.

Live: https://meiqidevries.github.io/ai-lunch/

## Running the session

1. Open the page on the laptop that goes on the screen and click **Start a new session**.
2. The room scans the QR code (or goes to the page and types the code).
3. Click **Next** (or use the arrow keys or a presentation clicker). On steps with results, Next first reveals the results, then moves on. **Skip** jumps past a step; the dots at the top jump to any step.
4. On the last step, **Copy summary** or **Download summary** gives every answer, anonymous, as text for the follow-up mail.

If the laptop reloads or the browser closes, open the page again and choose **Resume that session**: the code stays the same and the phones carry on.

## How it is built

A static site: `index.html` (layout and styles), `content.js` (every card, question and step), `app.js` (stage and phone views), `live.js` (live connection), `tekeningen.js` (drawings), `qr.js` (QR code generator, MIT licence), `fonts/` (Zilla Slab and Poppins, SIL Open Font License).

**Live connection.** Every message is encrypted on the device (AES-GCM, key derived from the session code) and sent through public relay servers that only see unreadable text. There is no database: the host's laptop keeps the session. Messages go out on five relays ("routes") at once: four free public MQTT brokers and ntfy, see `config.js`. The session keeps running as long as one MQTT route works; the others are spare for when a broker is down or blocked on a network. **Check the connection on this network** on the start page tests every route from where you are. ntfy on its own cannot carry 22 phones on one office network: it allows 60 requests in a burst per network address, then one every five seconds.

**Changing the content.** Edit `content.js`. Cards have an `id`; the default card per step is set in `STEPS`.

**Privacy.** No accounts, cookies or analytics, no third-party requests apart from the relays. Phones store only their own anonymous id; the host laptop stores the session in the browser until a new one is started.

## Testing locally

Serve the folder (`python3 -m http.server`) and add `?channels=mqtt:ws://localhost:9001/mqtt,ntfy:http://localhost:8787` to point at local relays. This override only works on localhost.
