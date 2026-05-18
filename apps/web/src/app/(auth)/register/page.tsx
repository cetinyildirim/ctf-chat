'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { schemas } from '@sydt/shared';
import type { SessionUser } from '@sydt/shared';
import type { z } from 'zod';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api/endpoints';
import { unwrapApiError } from '@/lib/api/axios';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';
import { useI18n } from '@/components/providers/LocaleProvider';
import { normalizeSessionUser } from '@/lib/auth/session-normalize';

type FormValues = z.infer<typeof schemas.registerSchema>;

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schemas.registerSchema),
    defaultValues: {
      email: '',
      username: '',
      displayName: '',
      password: '',
      confirmPassword: '',
      teamCode: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const user = await authApi.register(values);
      setUser(normalizeSessionUser(user as SessionUser));
      toast.success(t.authRegisterWelcome.replace('{{name}}', user.displayName));
      router.replace('/');
    } catch (err) {
      const { message } = unwrapApiError(err);
      toast.error(message ?? t.authRegisterFailed);
    }
  };

  return (
    <AuthShell
      title={t.authRegisterTitle}
      subtitle={t.authRegisterSubtitle}
      footer={
        <>
          {t.authFooterHasAccount}{' '}
          <Link href="/login" className="text-accent-cyan hover:underline">
            {t.authFooterSignIn}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="username">{t.authRegisterUsername}</Label>
            <Input id="username" {...register('username')} />
            {errors.username ? <p className="text-xs text-accent-rose">{errors.username.message}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="displayName">{t.authRegisterDisplayName}</Label>
            <Input id="displayName" {...register('displayName')} />
            {errors.displayName ? <p className="text-xs text-accent-rose">{errors.displayName.message}</p> : null}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">{t.authRegisterEmail}</Label>
          <Input id="email" type="email" {...register('email')} />
          {errors.email ? <p className="text-xs text-accent-rose">{errors.email.message}</p> : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="password">{t.authRegisterPassword}</Label>
            <Input id="password" type="password" {...register('password')} />
            {errors.password ? <p className="text-xs text-accent-rose">{errors.password.message}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">{t.authRegisterConfirm}</Label>
            <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
            {errors.confirmPassword ? (
              <p className="text-xs text-accent-rose">{errors.confirmPassword.message}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="teamCode">{t.authRegisterTeamCode}</Label>
          <Input id="teamCode" {...register('teamCode')} />
        </div>

        <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {isSubmitting ? t.authRegisterSubmitting : t.authRegisterSubmit}
        </Button>
      </form>
    </AuthShell>
  );
}
