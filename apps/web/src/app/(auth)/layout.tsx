import * as React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[140%] -translate-x-1/2 bg-[radial-gradient(closest-side,_rgba(34,211,238,0.18),transparent_70%)] blur-2xl" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-12">
        {children}
      </div>
    </div>
  );
}
