'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { localizeMessage } from '@/i18n/api-errors';
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
import { Loader2, KeyRound, ShieldBan, Eye, EyeOff } from 'lucide-react';
import { suspensionText, takeSuspensionNotice, type SuspensionNotice } from '@/lib/moderation/messages';
import { useI18n } from '@/components/providers/LocaleProvider';
import { normalizeSessionUser } from '@/lib/auth/session-normalize';

type FormValues = z.infer<typeof schemas.loginSchema>;

function LoginForm() {
  const { t } = useI18n();
  const params = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);
  const setReady = useAuthStore((s) => s.setReady);

  const [suspension, setSuspension] = useState<SuspensionNotice | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    void authApi.ensureCsrf().catch(() => {
      /* non-fatal before first POST */
    });
    setSuspension(takeSuspensionNotice());
  }, []);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schemas.loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const nextRaw = params.get('next') ?? '/';
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/';
  const registerHref = next === '/' ? '/register' : `/register?next=${encodeURIComponent(next)}`;

  const onSubmit = async (values: FormValues) => {
    try {
      const user = await authApi.login(values.identifier, values.password);
      setUser(normalizeSessionUser(user as SessionUser));
      setReady(true);
      toast.success(t.authLoginWelcomeBack.replace('{{name}}', user.displayName));
      // Cookie oturumu için soft navigate bazen middleware/RSC ile yarışır; tam yenileme güvenilir.
      window.location.assign(next);
    } catch (err) {
      const { code, message, details } = unwrapApiError(err);
      if (code === 'ACCOUNT_SUSPENDED') {
        const d = (details ?? {}) as Partial<SuspensionNotice>;
        setSuspension({ until: d.until ?? null, reason: d.reason ?? null });
        return;
      }
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
          <Link href={registerHref} className="text-accent-cyan hover:underline">
            {t.authFooterRegister}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {suspension ? (
          <div
            role="alert"
            className="flex gap-3 rounded-lg border border-accent-rose/40 bg-accent-rose/10 px-4 py-3 text-sm"
          >
            <ShieldBan className="mt-0.5 h-5 w-5 shrink-0 text-accent-rose" />
            <div>
              <p className="font-semibold text-fg">{t.suspendedNoticeTitle}</p>
              <p className="mt-1 text-fg-muted">{suspensionText(suspension, t)}</p>
            </div>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="identifier">{t.authLoginIdentifierLabel}</Label>
          <Input
            id="identifier"
            autoComplete="username"
            placeholder={t.authLoginIdentifierPlaceholder}
            {...register('identifier')}
          />
          {errors.identifier ? (
            <p className="text-xs text-accent-rose">{localizeMessage(errors.identifier.message)}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">{t.authLoginPasswordLabel}</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className="pr-10"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t.authHidePassword : t.authShowPassword}
              title={showPassword ? t.authHidePassword : t.authShowPassword}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-fg-subtle transition-colors hover:text-fg"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? <p className="text-xs text-accent-rose">{localizeMessage(errors.password.message)}</p> : null}
        </div>

        <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {isSubmitting ? t.authLoginSubmitting : t.authLoginSubmit}
        </Button>
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
