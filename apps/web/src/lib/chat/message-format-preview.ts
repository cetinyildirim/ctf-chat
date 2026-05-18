/** Lightweight preview for composer help (not full markdown). */
export function previewMessageFormat(raw: string): string {
  let html = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/```([\s\S]*?)```/g, '<pre class="my-1 rounded bg-bg-deep/80 px-2 py-1 font-mono text-xs">$1</pre>');
  html = html.replace(/`([^`]+)`/g, '<code class="rounded bg-bg-deep/80 px-1 font-mono text-accent-cyan text-xs">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-fg">$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic text-fg-subtle">$1</em>');
  html = html.replace(/^&gt;\s?(.*)$/gm, '<blockquote class="border-l-2 border-accent-cyan/40 pl-2 text-fg-subtle">$1</blockquote>');
  html = html.replace(/@([a-z0-9_.-]{3,24})/gi, '<span class="text-accent-cyan">@$1</span>');
  html = html.replace(/\n/g, '<br />');
  return html || '<span class="text-muted-fg">…</span>';
}
