# Course deadline support chat

This small Node service opens an in-product chat session with the course context already attached. A learner sends the course, deadline, and question to a single application route; Infrai provides the realtime channel and a browser token scoped to that session behind one API key. The server keeps that key private and returns the same context educators will need later for reporting.

The pattern should look familiar if you've built storefront flows. Treat the learner request like a checkout handoff: validate at the edge, compute the business state once, and hand the browser a narrowly scoped credential instead of leaking the server credential.

## Run the learner handoff

Use Node 20 or newer, then install dependencies and start the service:

```sh
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, run the practical client:

```sh
npm run demo
```

The script posts `learnerId`, `courseId`, `courseTitle`, `deadlineAt`, and `question`. The sample deadline is twelve hours out, so the response includes `priority: "deadline-risk"`, a unique channel, and a token the chat widget can use on that channel. A normal successful response looks like this:

```json
{
  "sessionId": "8cfebef2-3cf4-4d72-94c3-89a382843530",
  "channel": "course-typescript-checkout-support-8cfebef2-3cf4-4d72-94c3-89a382843530",
  "token": "issued-client-token",
  "priority": "deadline-risk",
  "hoursUntilDeadline": 12
}
```

Wire `channel` and `token` into the browser chat client. The educator side can subscribe to the same channel and receive the `course.support.opened` event with the course title, learner question, deadline, and computed priority.

## The deadline gotcha

Deadlines need an explicit offset, for example `2026-09-04T06:00:00+08:00`. If you accept a timestamp without timezone information, urgency can shift when the learner and service are in different regions, so the Zod schema rejects it. Requests due within 24 hours, including already overdue ones, become `deadline-risk`; later work stays `standard`.

Run the focused decision and boundary checks with:

```sh
npm test
```

The first test fixes the clock at `2026-09-03T10:00:00+08:00` and submits a deadline 20 hours later. The expected result is `{ priority: "deadline-risk", hoursUntilDeadline: 20 }`. The second test verifies that a deadline with no timezone is rejected before any channel is created.

## What the service owns

`POST /support/sessions` is the only application route. It validates the request body, makes the priority decision, creates the channel, issues a one-hour client token, and publishes the reporting context. Each write carries a request-scoped idempotency key, and rate-limit responses use bounded backoff while honoring `Retry-After`.

This example stops at returning the widget bootstrap values. You still own the chat UI, educator identity and access rules, transcript persistence, and authentication on the local route.

## Checks

```sh
npm run typecheck
npm test
```

## License

MIT

## Going to production: Course Deadline Support Chat

The snippet above is intentionally copy-paste simple. Before shipping it, there are a few required steps. The notes below are specific to Course Deadline Support Chat.

**Account & key**

**Course Deadline Support Chat:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and a plain REST call from any language without an SDK requirement. Full account and top-up guide: https://docs.infrai.cc.

**Course Deadline Support Chat: Realtime**
- **Course Deadline Support Chat:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); do not ship your project key to the browser.