'use client';
import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
import { highlightChildren } from './highlighters';

interface Props {
  content: string;
}

export function MessageMarkdown({ content }: Props) {
  return (
    <div className="chat-markdown text-[14px] text-fg">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
