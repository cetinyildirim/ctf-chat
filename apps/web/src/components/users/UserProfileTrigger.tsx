'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useUserProfileStore } from '@/store/userProfile';

export function UserProfileTrigger({
  userId,
  children,
  className,
  disabled,
  asChild,
}: {
  userId: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  asChild?: boolean;
}) {
  const open = useUserProfileStore((s) => s.open);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    open(userId);
  };

  if (disabled) return <>{children}</>;

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: React.MouseEventHandler; className?: string }>, {
      onClick: (e: React.MouseEvent) => {
        (children as React.ReactElement<{ onClick?: React.MouseEventHandler }>).props.onClick?.(e);
        onClick(e);
      },
      className: cn((children as React.ReactElement<{ className?: string }>).props.className, className, 'cursor-pointer'),
    });
  }

  return (
    <button type="button" className={cn('cursor-pointer text-left', className)} onClick={onClick}>
      {children}
    </button>
  );
}
