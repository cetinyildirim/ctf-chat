/** Lightweight route placeholder — avoids flashing the full LoadingScreen on every nav. */
export default function AppLoading() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="h-8 w-48 animate-pulse rounded-md bg-white/5" />
      <div className="h-4 w-72 animate-pulse rounded-md bg-white/[0.04]" />
      <div className="mt-2 min-h-0 flex-1 animate-pulse rounded-xl border border-white/5 bg-white/[0.02]" />
    </div>
  );
}
