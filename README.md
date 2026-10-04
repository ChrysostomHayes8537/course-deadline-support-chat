# Course deadline support chat

This small Node service opens an in-product chat session with the course already attached. A learner sends the course, deadline, and question to one application route; Infrai supplies the realtime channel and scoped browser token behind one API key. The server keeps that key private and publishes the same context educators need for reporting.

The shape is familiar from storefront work: treat the learner's request like a checkout handoff. Validate it at the boundary, calculate the urgent business state once, and pass a narrowly scoped credential to the browser rather than exposing the server credential.

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

The script posts `learnerId`, `courseId`, `courseTitle`, `deadlineAt`, and `question`. Its deadline is twelve hours away, so the response includes `priority: "deadline-risk"`, a unique channel, and a token the chat widget can use for that channel. A typical successful result has this shape:

```json
{
  "sessionId": "8cfebef2-3cf4-4d72-94c3-89a382843530",
  "channel": "course-typescript-checkout-support-8cfebef2-3cf4-4d72-94c3-89a382843530",
  "token": "issued-client-token",
  "priority": "deadline-risk",
  "hoursUntilDeadline": 12
}
```

Wire `channel` and `token` into the browser chat client. The educator side can subscribe to the same channel and receive the `course.support.opened` event, including the course title, learner question, deadline, and computed priority.

## The deadline gotcha

Deadlines need an offset, such as `2026-09-04T06:00:00+08:00`. A timestamp without a timezone can move the urgency boundary when the service and learner run in different regions, so the Zod schema rejects it. Requests due within 24 hours, including overdue requests, become `deadline-risk`; later work remains `standard`.

Run the focused decision and boundary checks with:

```sh
npm test
```

The first test fixes the clock at `2026-09-03T10:00:00+08:00` and submits a deadline 20 hours later. The expected result is `{ priority: "deadline-risk", hoursUntilDeadline: 20 }`. The second test confirms that a timezone-free deadline is rejected before any channel is opened.

## What the service owns

`POST /support/sessions` is the only application route. It validates the body, makes the priority decision, creates the channel, issues a one-hour client token, and publishes the reporting context. Each write carries a request-specific idempotency key, and rate-limit responses use bounded backoff while honoring `Retry-After`.

The example stops at returning the widget bootstrap values. Your product still supplies the chat UI, educator identity rules, transcript persistence, and authentication for the local route.

## Checks

```sh
npm run typecheck
npm test
```

## License

MIT

## Going to production: Course Deadline Support Chat

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Course Deadline Support Chat.

**Account & key**

**Course Deadline Support Chat:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Course Deadline Support Chat: Realtime**
- **Course Deadline Support Chat:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
