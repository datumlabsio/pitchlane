import { z } from 'zod';

export const accountUpdateSchema = z.object({
  gmailLabel: z.string().trim().min(1, 'Label is required').max(120, 'Label is too long'),
  forwardingInbox: z.email('Forwarding inbox must be a valid email address'),
  notificationEmail: z.union([
    z.literal(''),
    z.null(),
    z.email('Notification email must be a valid email address'),
  ]),
  isActive: z.boolean(),
});

export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;

export type AccountSettingsView = {
  id: string;
  name: string;
  personName: string;
  gmailLabel: string;
  forwardingInbox: string;
  notificationEmail: string | null;
  isActive: boolean;
};
