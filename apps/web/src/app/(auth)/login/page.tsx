'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Loader2, KeyRound } from 'lucide-react';
import { useI18n } from '@/components/providers/LocaleProvider';
import { normalizeSessionUser } from '@/lib/auth/session-normalize';

type FormValues = z.infer<typeof schemas.loginSchema>;

function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schemas.loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const next = params.get('next') ?? '/';

  const onSubmit = async (values: FormValues) => {
    try {
      const user = await authApi.login(values.identifier, values.password);
      setUser(normalizeSessionUser(user as SessionUser));
      toast.success(t.authLoginWelcomeBack.replace('{{name}}', user.displayName));
      router.replace(next);
    } catch (err) {
      const { message } = unwrapApiError(err);
      toast.error(message ?? t.authLoginFailed);
    }
  };

  return (
    <AuthShell
      title={t.authLoginTitle}
      subtitle={t.authLoginSubtitle}
      footer={
        <>
          {t.authFooterNewUser}{' '}
          <Link href="/register" className="text-accent-cyan hover:underline">
            {t.authFooterRegister}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="identifier">{t.authLoginIdentifierLabel}</Label>
          <Input id="identifier" autoComplete="username" placeholder="admin" {...register('identifier')} />
          {errors.identifier ? (
            <p className="text-xs text-accent-rose">{errors.identifier.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">{t.authLoginPasswordLabel}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            {...register('password')}
          />
          {errors.password ? <p className="text-xs text-accent-rose">{errors.password.message}</p> : null}
        </div>

        <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {isSubmitting ? t.authLoginSubmitting : t.authLoginSubmit}
        </Button>

        <div className="rounded-lg border border-white/8 bg-white/[0.03] p-3 text-[11px] text-fg-subtle">
          <div className="mb-1 font-mono uppercase tracking-wider text-muted-fg">{t.authDemoTitle}</div>
          <div className="font-mono">{t.authDemoLine}</div>
        </div>
      </form>
    </AuthShell>
  );
}

function LoginFallback() {
  const { t } = useI18n();
  return (
    <AuthShell title={t.authLoginTitle} subtitle={t.authLoading}>
      <div className="space-y-4">
        <div className="h-10 animate-pulse rounded-md bg-white/5" />
        <div className="h-10 animate-pulse rounded-md bg-white/5" />
        <div className="h-11 animate-pulse rounded-md bg-white/8" />
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
