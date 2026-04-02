# Ligacup.se — Real-time Architecture

## Overview

Two separate real-time channels serve different needs:

| Channel | Technology | Direction | Used for |
|---|---|---|---|
| Score / rank updates | SSE (Server-Sent Events) | Server → Client | Live scores, leaderboard changes, notifications |
| League chat | WebSocket | Bidirectional | Messages, reactions, typing indicators |

Separating these means a leaderboard traffic spike during a goal doesn't affect the chat server, and vice versa. Each is independently deployable in Portainer.

---

## SSE — Server-Sent Events

### Why SSE over WebSockets for broadcasts

- HTTP-native: works through Cloudflare Tunnel, Nginx, and proxies without special configuration
- Auto-reconnect built into the browser (`EventSource` retries on disconnect)
- One unidirectional connection per client; server cannot receive data on it
- ~2 KB RAM per open connection — very lightweight for broadcasts
- Next.js App Router Route Handlers support streaming responses natively

### Connection

Client connects on app load and on every page that needs live data:

```
GET /api/events?leagueId={league_id}
Authorization: Bearer {clerk_session_token}
Accept: text/event-stream
```

Response headers:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no   ← critical for Nginx to not buffer the stream
```

### Event Types

All events are JSON strings in the SSE `data:` field.

```
event: leaderboard_updated
data: {"leagueId":"uuid","topChanges":[{"userId":"uuid","newRank":3,"oldRank":5,"points":12}]}

event: match_score
data: {"matchId":"uuid","homeScore":2,"awayScore":1,"status":"live","minute":67}

event: match_result
data: {"matchId":"uuid","homeScore":2,"awayScore":1,"status":"completed","pointsAwarded":{"userId":"uuid","points":3,"type":"exact_score"}}

event: rank_overtaken
data: {"leagueId":"uuid","byUser":{"id":"uuid","displayName":"Kalle"},"yourNewRank":6,"leagueName":"Kontoret"}

event: notification
data: {"id":"uuid","type":"mention","text":"Kalle mentioned you in Kontoret","leagueId":"uuid"}

event: ping
data: {}
```

`ping` is sent every 30s to keep the connection alive through Cloudflare's idle timeout.

### Server Implementation (Next.js Route Handler)

```
/app/api/events/route.ts

1. Validate Clerk session token from query param
2. Identify leagues this user belongs to
3. Create a ReadableStream
4. Subscribe to Redis Pub/Sub channels:
   - "events:global" (match scores, global notifications)
   - "events:{league_id}" for each of the user's leagues
5. On Redis message: enqueue into stream
6. On client disconnect: unsubscribe from Redis channels, close stream
7. Send ping every 30s
```

### Redis Pub/Sub Broadcast

When BullMQ worker finishes calculating points for a match:
```
PUBLISH events:{league_id} {json_event_string}
```

All SSE Route Handler instances subscribed to that channel receive the message and push it to their connected clients. Because each Route Handler process subscribes independently to Redis, horizontal scaling works automatically — add more Next.js containers, they all subscribe to the same Redis channels.

---

## WebSocket — League Chat

### Architecture

A standalone Node.js server (`ws-server/`) separate from the Next.js app:
- Next.js cannot maintain persistent stateful WS connections reliably across serverless-style restarts
- The WS server is a long-running process; Portainer keeps it alive
- Nginx proxies `/chat/*` WebSocket upgrades to `ws-server:3001`

### Connection

```
wss://ligacup.se/chat/{league_id}?token={clerk_session_token}
```

Server validates token via Clerk's `verifyToken()` on connect. Invalid token → close connection.

### Message Protocol (Client → Server)

```json
{ "type": "message", "text": "Heja Sverige! 🇸🇪", "replyTo": null }
{ "type": "reaction", "messageId": "uuid", "emoji": "🔥" }
{ "type": "typing" }
```

### Message Protocol (Server → Client)

```json
{
  "type": "message",
  "id": "uuid",
  "userId": "uuid",
  "displayName": "Kalle",
  "avatarUrl": "https://...",
  "text": "Heja Sverige! 🇸🇪",
  "mentions": [],
  "replyTo": null,
  "reactions": {},
  "createdAt": "2026-06-11T18:45:00Z"
}

{ "type": "reaction_update", "messageId": "uuid", "reactions": {"🔥": ["userId1", "userId2"]} }
{ "type": "user_joined", "userId": "uuid", "displayName": "Kalle" }
{ "type": "history", "messages": [...] }   ← sent on connect, last 50 messages
```

### Server Flow

**On connect:**
1. Validate token
2. Fetch user from DB (or cache)
3. Check user is member of `league_id` (DB check, cached in Redis for 5min)
4. Subscribe this socket to Redis channel `chat:{league_id}`
5. Fetch last 50 messages from Redis: `LRANGE chat:{league_id} 0 49`
6. Send `history` event to connecting client only

**On incoming message:**
1. Rate limit check: `INCR rate:{user_id}:chat` with `EXPIRE 10s` — reject if > 5
2. Validate text: non-empty, max 1000 chars
3. Parse @mentions: regex `/@(\w+)/g`, resolve usernames to user IDs
4. Build message object with UUID
5. `LPUSH chat:{league_id} {message_json}`
6. `LTRIM chat:{league_id} 0 199` — keep last 200
7. `EXPIRE chat:{league_id} 2592000` — reset 30-day TTL
8. `PUBLISH chat:{league_id} {message_json}` — broadcast to all WS servers
9. Enqueue BullMQ job: `chat-persist` (async Postgres write)
10. If @mentions present: enqueue BullMQ job: `notification` per mentioned user

**On Redis Pub/Sub message (broadcast):**
- Find all sockets subscribed to this league_id
- Send message to each socket

**On disconnect:**
- Remove socket from league room map
- Unsubscribe from Redis channel if no more sockets in that league

### Scaling WS Horizontally

Each WS server instance subscribes to Redis Pub/Sub for all active league channels. When a message arrives, Redis broadcasts to all instances; each instance delivers to its locally connected sockets. This means multiple WS containers work correctly without sticky sessions.

---

## BullMQ Job Queues

All queues use the same Redis instance. Workers run in a separate Docker container.

### Queue: `match-results`

**Triggered by:** Admin marking a match result as confirmed.

```
Job payload: { matchId, homeScore, awayScore, tournamentId }

Worker steps:
  1. Fetch all predictions for matchId
  2. Fetch prediction_rules for tournament
  3. For each prediction:
     - Calculate points (exact=3, correct winner=1, correct draw=1)
  4. Batch upsert point_snapshots (increment total_points, matches_played, etc.)
  5. Re-rank all users in all leagues that have this tournament:
     SELECT user_id, total_points FROM point_snapshots WHERE league_id = ?
     ORDER BY total_points DESC
     → UPDATE rank_in_league = row_number for each
  6. Redis pipeline: ZADD leaderboard:{league_id} {points} {user_id} for all leagues
  7. Capture rank changes (old rank vs new rank)
  8. PUBLISH events:{league_id} {"type":"leaderboard_updated",...}
  9. For users whose rank dropped: enqueue notification jobs
```

**Concurrency:** 1 worker, sequential processing. Point calculation must be atomic per match.

### Queue: `notifications`

```
Job payload: { userId, type, payload }

Worker steps:
  1. INSERT into notifications table
  2. Check Redis: is user currently online? (session:{user_id} key exists)
  3. If online: PUBLISH events:user:{user_id} notification event
```

**Concurrency:** 5 workers (notifications are independent and non-critical).

### Queue: `chat-persist`

```
Job payload: { message: MessageObject }

Worker steps:
  1. INSERT into messages table (Postgres cold storage)
  2. If mentions: bulk INSERT or UPDATE (no-op if already handled)
```

**Concurrency:** 10 workers. Non-critical, can be delayed.

---

## Redis Pub/Sub Channel Map

| Channel | Published by | Subscribed by |
|---|---|---|
| `events:{league_id}` | BullMQ match-results worker | SSE Route Handlers |
| `events:global` | Admin match score update | All SSE Route Handlers |
| `chat:{league_id}` | WS server (on message receive) | All WS server instances |

---

## Failure Modes & Recovery

| Failure | Impact | Recovery |
|---|---|---|
| Redis restart | SSE connections drop | Clients auto-reconnect via EventSource, re-subscribe |
| WS server crash | Chat disconnected | Portainer restarts container; clients reconnect; history from Redis |
| BullMQ worker crash | Delayed point calculation | BullMQ auto-retries (3 attempts with backoff); jobs persist in Redis |
| Postgres down | No writes | Redis serves reads; BullMQ jobs queue; Postgres writes backfill on recovery |
| SSE Route Handler crash | Client loses live feed | EventSource auto-reconnects to next available instance |

---

## Client Implementation Notes

### SSE (React)

```typescript
// Custom hook: useSSE(leagueId)
// - Creates EventSource on mount
// - Parses events and dispatches to local state
// - Cleans up EventSource on unmount
// - Re-connects with exponential backoff if EventSource errors
```

Token passed as query param (SSE doesn't support custom headers):
`GET /api/events?leagueId=xxx&token=clerk_session_token`

### WebSocket (React)

```typescript
// Custom hook: useLeagueChat(leagueId)
// - Creates WebSocket on mount
// - Handles send (rate-limited optimistically on client)
// - On message: prepend to message list
// - On disconnect: show reconnecting state, attempt reconnect
// - On history event: replace message list
```

Both hooks expose a clean interface to components — no raw SSE/WS code in components.
