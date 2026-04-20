import { z } from "zod";

export const assigneeEmail = z.string().email();

export const indexSchema = z.object({
  project: z.object({
    name: z.string(),
    workspace: z.string(),
    teamKey: z.string(),
    url: z.string().url().optional(),
  }),
  schedule: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    weekLengthDays: z.number().int().positive(),
  }),
  assignees: z
    .array(
      z.object({
        email: assigneeEmail,
        alias: z.string().optional(),
      }),
    )
    .min(1),
  labels: z.array(
    z.object({
      name: z.string(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    }),
  ),
  legacyTickets: z.object({
    archive: z.array(
      z.object({
        identifier: z.string(),
        reason: z.string().optional(),
      }),
    ),
  }),
});
export type IndexConfig = z.infer<typeof indexSchema>;

export const ticketSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.number().int().min(0).max(4),
  estimate: z.number().int().positive().optional(),
  labels: z.array(z.string()).default([]),
  assignee: assigneeEmail,
  /** 1-based index of tickets within this milestone that must finish before this one. */
  blockedBy: z.array(z.number().int().positive()).default([]),
});
export type Ticket = z.infer<typeof ticketSchema>;

export const milestoneSchema = z.object({
  milestone: z.object({
    name: z.string().min(1),
    weekNumber: z.number().int().positive(),
    description: z.string().min(1),
  }),
  tickets: z.array(ticketSchema).min(1),
});
export type MilestoneConfig = z.infer<typeof milestoneSchema>;
