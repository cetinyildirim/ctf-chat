import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(3, 'Enter your email or username')
    .max(120, 'Identifier too long'),
  password: z.string().min(8, 'Minimum 8 characters').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email: z.string().email('Invalid email'),
    username: z
      .string()
      .min(3, 'Minimum 3 characters')
      .max(24, 'Maximum 24 characters')
      .regex(/^[a-z0-9_.-]+$/i, 'Letters, digits, _ . - only'),
    displayName: z.string().min(2, 'Minimum 2 characters').max(40),
    password: z
      .string()
      .min(8, 'Minimum 8 characters')
      .max(200, 'Too long')
      .regex(/[A-Z]/, 'Add an uppercase letter')
      .regex(/[a-z]/, 'Add a lowercase letter')
      .regex(/[0-9]/, 'Add a digit'),
    confirmPassword: z.string(),
    teamCode: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type RegisterInput = z.infer<typeof registerSchema>;
