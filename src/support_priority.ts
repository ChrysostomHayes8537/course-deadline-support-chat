import { z } from "zod";

const offsetDateTime = z.string().datetime({ offset: true });

export const supportRequestSchema = z.object({
  learnerId: z.string().min(1),
  courseId: z.string().min(1),
  courseTitle: z.string().min(1),
  deadlineAt: offsetDateTime,
  question: z.string().min(1).max(2000)
}).strict();

export type SupportRequest = z.infer<typeof supportRequestSchema>;
export type SupportPriority = "deadline-risk" | "standard";

export function decideSupportPriority(
  request: SupportRequest,
  now: Date
): { priority: SupportPriority; hoursUntilDeadline: number } {
  const hoursUntilDeadline = Math.round(
    (Date.parse(request.deadlineAt) - now.getTime()) / 3_600_000
  );

  return {
    priority: hoursUntilDeadline <= 24 ? "deadline-risk" : "standard",
    hoursUntilDeadline
  };
}
