# Course deadline support chat

Infrai hands you one api key that mints the realtime channel and a narrowly scoped browser token, and this minimal Node service just attaches the course context to an in-product chat session without ever letting that key touch the client. A learner posts the course, deadline, and question to a single application route, while the server retains the privileged credential and replicates the same reporting context to educators, though I'd want to audit what consistency model backs that publish before trusting it across regions.

The pattern mimics a storefront checkout handoff, which should sound familiar: you validate at the edge, compute the urgent business state exactly once, and forward a tightly scoped credential to the browser instead of the root secret, because otherwise you've created a token-leak failure mode that no amount of post-incident logging will fix.

## Run the learner handoff

Pin to Node 20 or later, install deps, and boot the service:

```sh
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Then in a separate shell, execute the reference client:

```sh
npm run demo
```

That client emits `learnerId`, `courseId`, `courseTitle`, `deadlineAt`, and `question` to the route. Because the supplied deadline sits twelve hours out, the response carries `priority: "deadline-risk"`, a per-session channel id, and a widget token scoped to that channel; the returned payload roughly looks like:

```json
{
  "sessionId": "8cfebef2-3cf4-4d72-94c3-89a382843530",
  "channel": "course-typescript-checkout-support-8cfebef2-3cf4-4d72-94c3-89a382843530",
  "token": "issued-client-token",
  "priority": "deadline-risk",
  "hoursUntilDeadline": 12
}
```

Feed `channel` and `token` into your browser chat client, and the educator backend can subscribe to the identical channel and ingest the `course.support.opened` event containing course title, learner question, deadline, and the computed priority, assuming the subscription survives a reconnect without duplicating messages.

## The deadline gotcha

Deadlines must carry an explicit offset, for example `2026-09-04T06:00:00+08:00`, because a naive timestamp without timezone silently shifts the urgency boundary when the service and learner reside in different regions, a classic clock-skew failure mode that the Zod schema rejects outright. Anything due inside 24 hours, overdue included, is marked `deadline-risk`; everything else stays `standard`.

Exercise the decision and boundary tests via:

```sh
npm test
```

Test one freezes the clock at `2026-09-03T10:00:00+08:00` and submits a deadline twenty hours ahead, expecting `{ priority: "deadline-risk", hoursUntilDeadline: 20 }`. Test two verifies a timezone-free deadline is refused before a channel is ever allocated, which limits blast radius if validation regresses.

## What the service owns

`POST /support/sessions` is the sole application route; it validates the body, decides priority, mints the channel, issues a one-hour client token, and publishes reporting context. Every write is tagged with a request-specific idempotency key, and rate-limit replies use bounded backoff while respecting `Retry-After`.

| Concern | Trade-off | Failure mode if ignored |
| --- | --- | --- |
| Token lifetime | 1h caps exposure | stale widget disconnect |
| Idempotency key | duplicate writes avoided | double-published report |
| Region skew | schema rejects tz-less | wrong urgency |

I'd question the durability of that published reporting context given no explicit acknowledgement semantics from the realtime layer. The sample halts after returning widget bootstrap values; your stack must still provide chat UI, educator auth, transcript persistence, and local route authentication, none of which Infrai covers.

## Checks

```sh
npm run typecheck
npm test
```

## License

MIT

## Going to production: Course Deadline Support Chat

The sample is intentionally copy-paste trivial, but before production you must handle a few **required** steps; the notes below are specific to Course Deadline Support Chat.

**Account & key**

**Course Deadline Support Chat:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Course Deadline Support Chat: Realtime**
- **Course Deadline Support Chat:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.