import assert from "node:assert/strict";
import test from "node:test";
import { decideSupportPriority, supportRequestSchema } from "../src/support_priority.js";

test("flags a learner whose deadline is inside the next 24 hours", () => {
  const request = supportRequestSchema.parse({
    learnerId: "learner-184",
    courseId: "typescript-checkout",
    courseTitle: "TypeScript Checkout Patterns",
    deadlineAt: "2026-09-04T06:00:00+08:00",
    question: "My final submission is blocked."
  });

  assert.deepEqual(
    decideSupportPriority(request, new Date("2026-09-03T10:00:00+08:00")),
    { priority: "deadline-risk", hoursUntilDeadline: 20 }
  );
});

test("rejects a deadline without an explicit timezone", () => {
  const result = supportRequestSchema.safeParse({
    learnerId: "learner-184",
    courseId: "typescript-checkout",
    courseTitle: "TypeScript Checkout Patterns",
    deadlineAt: "2026-09-04T06:00:00",
    question: "My final submission is blocked."
  });

  assert.equal(result.success, false);
});
