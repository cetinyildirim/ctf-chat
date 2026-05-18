from pathlib import Path

p = Path(r"e:\Yapay Zeka Çalışmalar\SYDT Chat\apps\web\src\components\admin\AdminDashboard.tsx")
t = p.read_text(encoding="utf-8")

cat_old = """              <motionless className="min-w-0 flex-1">
                <motionless className="font-medium text-fg">{c.name}</motionless>
                {c.staffOnly ? <motionless className="text-[11px] uppercase text-amber-300/90">{t.staffOnlyCategory}</motionless> : null}
              </motionless>""".replace("motionless", "div")

cat_new = """              <motionless className="min-w-0 flex-1">
                {catEditingId === c.id ? (
                  <motionless className="flex flex-wrap items-center gap-2">
                    <Input value={catEditName} onChange={(e) => setCatEditName(e.target.value)} className="max-w-xs" />
                    <label className="flex items-center gap-1 text-xs text-fg-subtle">
                      <input type="checkbox" checked={catEditStaff} onChange={(e) => setCatEditStaff(e.target.checked)} />
                      {t.staffOnlyCategory}
                    </label>
                  </motionless>
                ) : (
                  <>
                    <motionless className="font-medium text-fg">{c.name}</motionless>
                    {c.staffOnly ? (
                      <motionless className="text-[11px] uppercase text-amber-300/90">{t.staffOnlyCategory}</motionless>
                    ) : null}
                  </>
                )}
              </motionless>""".replace("motionless", "motionless")

# fix cat_new - all div
cat_new = cat_new.replace("motionless", "div")

if cat_old in t:
    t = t.replace(cat_old, cat_new, 1)
    print("cat ok")
else:
    print("cat miss")

ch_state = """  const [chCategoryId, setChCategoryId] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!data?.categories.length) return;"""

ch_state_new = """  const [chCategoryId, setChCategoryId] = React.useState('');
  const [chEditingId, setChEditingId] = React.useState<string | null>(null);
  const [chEditName, setChEditName] = React.useState('');
  const [chEditTopic, setChEditTopic] = React.useState('');
  const [chEditType, setChEditType] = React.useState<ChannelType>(ChannelType.GLOBAL_CHAT);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!data?.categories.length) return;"""

if ch_state in t:
    t = t.replace(ch_state, ch_state_new, 1)
    print("ch state ok")

ch_handlers = """  const invalidate = () => void qc.invalidateQueries({ queryKey: queryKeys.channels });

  const onCreate = async (e: React.FormEvent) => {"""

ch_handlers_new = """  const invalidate = () => void qc.invalidateQueries({ queryKey: queryKeys.channels });

  const saveChannelEdit = async (id: string) => {
    if (!chEditName.trim()) return;
    setBusy(true);
    try {
      await channelsApi.update(id, {
        name: chEditName.trim(),
        topic: chEditTopic.trim() || null,
        type: chEditType,
      });
      toast.success(t.chUpdated);
      setChEditingId(null);
      invalidate();
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? 'Error');
    } finally {
      setBusy(false);
    }
  };

  const deleteChannel = async (id: string) => {
    if (!window.confirm(t.chDeleteConfirm)) return;
    setBusy(true);
    try {
      await channelsApi.remove(id);
      toast.success(t.chDeleted);
      invalidate();
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? 'Error');
    } finally {
      setBusy(false);
    }
  };

  const onCreate = async (e: React.FormEvent) => {"""

if ch_handlers in t:
    t = t.replace(ch_handlers, ch_handlers_new, 1)
    print("ch handlers ok")

ch_row_old = """                      <motionless className="min-w-0 flex-1">
                        <motionless className="font-medium text-fg">{ch.name}</motionless>
                        <motionless className="truncate text-[11px] text-muted-fg">{ch.type}</motionless>
                      </motionless>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id={`adm-ch-${ch.id}`}""".replace("motionless", "div")

ch_row_new = """                      <motionless className="min-w-0 flex-1">
                        {chEditingId === ch.id ? (
                          <motionless className="grid gap-2 sm:grid-cols-2">
                            <Input value={chEditName} onChange={(e) => setChEditName(e.target.value)} />
                            <Input value={chEditTopic} onChange={(e) => setChEditTopic(e.target.value)} placeholder={t.channelTopicLabel} />
                            <select
                              className="flex h-10 rounded-md border border-white/10 bg-bg-deep px-2 text-sm text-fg sm:col-span-2"
                              value={chEditType}
                              onChange={(e) => setChEditType(e.target.value as ChannelType)}
                            >
                              {ADMIN_CHANNEL_TYPE_OPTIONS.map((ty) => (
                                <option key={ty} value={ty}>
                                  {channelTypeLabel(ty, t)}
                                </option>
                              ))}
                            </select>
                          </motionless>
                        ) : (
                          <>
                            <motionless className="font-medium text-fg">{ch.name}</motionless>
                            <motionless className="truncate text-[11px] text-muted-fg">{channelTypeLabel(ch.type as ChannelType, t)}</motionless>
                          </>
                        )}
                      </motionless>
                      {chEditingId !== ch.id ? (
                        <>
                          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { setChEditingId(ch.id); setChEditName(ch.name); setChEditTopic(ch.topic ?? ''); setChEditType(ch.type as ChannelType); }}>{t.chEdit}</Button>
                          <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void deleteChannel(ch.id)}>{t.chDelete}</Button>
                        </>
                      ) : (
                        <>
                          <Button type="button" size="sm" disabled={busy} onClick={() => void saveChannelEdit(ch.id)}>{t.teamSave}</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setChEditingId(null)}>{t.teamCancelEdit}</Button>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id={`adm-ch-${ch.id}`}""".replace("motionless", "div")

if ch_row_old in t:
    t = t.replace(ch_row_old, ch_row_new, 1)
    print("ch row ok")
else:
    print("ch row miss")

team_color_old = """          <motionless className="space-y-1.5">
            <Label>{t.teamFieldColor}</Label>
            <Input value={color} onChange={(e) => setColor(e.target.value)} />
          </motionless>""".replace("motionless", "div")

team_color_new = """          <motionless className="space-y-1.5 sm:col-span-3">
            <ColorPalettePicker value={color} onChange={setColor} label={t.teamFieldColor} />
          </motionless>""".replace("motionless", "motionless")

team_color_new = team_color_new.replace("motionless", "div")

if team_color_old in t:
    t = t.replace(team_color_old, team_color_new, 1)
    print("team color ok")

team_edit_old = """                      <Input
                        value={editDraft.color}
                        onChange={(e) => setEditDraft((d) => ({ ...d, color: e.target.value }))}
                        placeholder={t.teamFieldColor}
                      />"""
team_edit_new = """                      <ColorPalettePicker value={editDraft.color} onChange={(c) => setEditDraft((d) => ({ ...d, color: c }))} label={t.teamFieldColor} />"""
if team_edit_old in t:
    t = t.replace(team_edit_old, team_edit_new, 1)
    print("team edit color ok")

t = t.replace("placeholder={t.teamAddMemberId}", "placeholder={t.teamAddMemberHint}")

p.write_text(t, encoding="utf-8")
print("written")
