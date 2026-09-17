'use client';

import * as React from 'react';

export function useImportSelection(allKeys: string[]) {
  const fingerprint = allKeys.join('\0');

  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(allKeys));

  React.useEffect(() => {
    setSelected(new Set(allKeys));
  }, [fingerprint]);

  const toggle = React.useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const setGroup = React.useCallback((keys: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }, []);

  const selectAll = React.useCallback(() => {
    setSelected(new Set(allKeys));
  }, [fingerprint]);

  const deselectAll = React.useCallback(() => {
    setSelected(new Set());
  }, []);

  const isGroupChecked = React.useCallback(
    (keys: string[]) => keys.length > 0 && keys.every((k) => selected.has(k)),
    [selected],
  );

  const isGroupIndeterminate = React.useCallback(
    (keys: string[]) => {
      const hit = keys.filter((k) => selected.has(k)).length;
      return hit > 0 && hit < keys.length;
    },
    [selected],
  );

  return {
    selected,
    toggle,
    setGroup,
    selectAll,
    deselectAll,
    isGroupChecked,
    isGroupIndeterminate,
    count: selected.size,
  };
}
