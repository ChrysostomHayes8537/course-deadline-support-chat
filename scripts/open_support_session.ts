export {};

const response = await fetch("http://localhost:3000/support/sessions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    learnerId: "learner-184",
    courseId: "typescript-checkout",
    courseTitle: "TypeScript Checkout Patterns",
    deadlineAt: new Date(Date.now() + 12 * 3_600_000).toISOString(),
    question: "My final submission is stuck on the payment-state exercise."
  })
});

console.log(JSON.stringify(await response.json(), null, 2));
