'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { pagesApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { MessageMarkdown } from '@/components/chat/MessageMarkdown';
import { LoadingScreen } from '@/components/common/LoadingScreen';

export default function PlatformPageView() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const { data: page, isLoading, isError } = useQuery({
    queryKey: queryKeys.platformPage(slug),
    queryFn: () => pagesApi.getBySlug(slug),
    retry: false,
  });

  if (isLoading) return <LoadingScreen label="…" />;

  if (isError || !page) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0c0d10] px-6 text-center">
        <p className="text-lg text-fg">Sayfa bulunamadı</p>
        <Link href="/" className="mt-4 text-sm text-accent-cyan hover:underline">
          Ana sayfaya dön
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0d10] text-fg">
      <header className="border-b border-white/8 bg-[#0c0d10]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-fg-subtle transition-colors hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" />
            Ana sayfa
          </Link>
          <span className="font-mono text-sm font-semibold tracking-wide">
            SYDT<span className="text-accent-cyan">.</span>
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">{page.title}</h1>
        <p className="mt-2 font-mono text-xs text-muted-fg">/p/{page.slug}</p>
        <article className="prose-invert mt-8">
          <MessageMarkdown content={page.content || '_Boş sayfa._'} allowHtml />
        </article>
      </main>
    </div>
  );
}
