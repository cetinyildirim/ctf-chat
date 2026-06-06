'use client';
import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { CodeBlock } from './CodeBlock';
import { highlightChildren } from './highlighters';

const adminHtmlSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'u'],
};

function safeHref(href?: string): string | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href, 'https://local.invalid');
    if (url.protocol === 'http:' || url.protocol === 'https:' || href.startsWith('/')) return href;
  } catch {
    /* ignore */
  }
  return undefined;
}

interface Props {
  content: string;
  /** Allow limited HTML (e.g. <u>) — use only for trusted admin-authored pages */
  allowHtml?: boolean;
}

export function MessageMarkdown({ content, allowHtml }: Props) {
  const rehypePlugins = allowHtml
    ? [rehypeRaw, [rehypeSanitize, adminHtmlSchema]]
    : [[rehypeSanitize, defaultSchema]];

  return (
    <div className="chat-markdown text-[14px] text-fg">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins as React.ComponentProps<typeof ReactMarkdown>['rehypePlugins']}
        components={{
          code({ inline, className, children, ...props }: {
            inline?: boolean;
            className?: string;
            children?: React.ReactNode;
          } & React.HTMLAttributes<HTMLElement>) {
            const match = /language-(\w+)/.exec(className ?? '');
            const text = String(children ?? '').replace(/\n$/, '');
            if (inline) {
              return (
                <code className={className} {...props}>
                  {text}
                </code>
              );
            }
            return <CodeBlock code={text} language={match?.[1]} />;
          },
          p: ({ children }) => <p>{highlightChildren(children)}</p>,
          li: ({ children }) => <li>{highlightChildren(children)}</li>,
          a: ({ href, children }) => {
            const safe = safeHref(href);
            if (!safe) return <span>{children}</span>;
            return (
              <a href={safe} target="_blank" rel="noopener noreferrer nofollow">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
