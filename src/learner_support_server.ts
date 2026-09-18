import { createServer, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { InfraiError, InfraiRealtime } from "./infrai_realtime.js";
import { decideSupportPriority, supportRequestSchema } from "./support_priority.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const infrai = new InfraiRealtime(apiKey);
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/support/sessions") {
    return sendJson(response, 404, { error: "Route not found" });
  }

  try {
    const input = supportRequestSchema.parse(await readJson(request));
    const decision = decideSupportPriority(input, new Date());
    const sessionId = randomUUID();
    const channel = `course-${input.courseId}-support-${sessionId}`;

    await infrai.createChannel(channel, `${sessionId}:channel`);
    const tokenResult = await infrai.issueToken(
      input.learnerId,
      channel,
      `${sessionId}:token`
    );
    await infrai.publishContext(
      channel,
      input.learnerId,
      {
        sessionId,
        learnerId: input.learnerId,
        courseId: input.courseId,
        courseTitle: input.courseTitle,
        deadlineAt: input.deadlineAt,
        question: input.question,
        priority: decision.priority,
        hoursUntilDeadline: decision.hoursUntilDeadline
      },
      `${sessionId}:context`
    );

    return sendJson(response, 201, {
      sessionId,
      channel,
      token: tokenResult.token,
      priority: decision.priority,
      hoursUntilDeadline: decision.hoursUntilDeadline
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return sendJson(response, 400, { error: "Invalid support request", issues: error.issues });
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return sendJson(response, status, {
        error: error.message,
        code: error.detail?.code
      });
    }
    return sendJson(response, 500, { error: "Could not open support session" });
  }
}).listen(port, () => {
  console.log(`Learner support service listening on http://localhost:${port}`);
});

async function readJson(request: AsyncIterable<Buffer | string>): Promise<unknown> {
  let body = "";
  for await (const chunk of request) body += chunk;
  return JSON.parse(body);
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
