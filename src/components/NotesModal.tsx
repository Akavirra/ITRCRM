'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, CheckSquare, Pin, Trash2, Plus, Search, X } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Task { id: string; text: string; done: boolean; }

interface Note {
  id: number;
  type: 'note' | 'todo';
  title: string;
  content: string;
  tasks: Task[];
  color: string | null;
  is_pinned: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// ── Color palette ─────────────────────────────────────────────────────────────

const COLORS: { key: string | null; bg: string; dot: string }[] = [
  { key: null,     bg: '#ffffff', dot: '#e2e8f0' },
  { key: 'yellow', bg: '#fefce8', dot: '#fde047' },
  { key: 'blue',   bg: '#eff6ff', dot: '#93c5fd' },
  { key: 'green',  bg: '#f0fdf4', dot: '#86efac' },
  { key: 'pink',   bg: '#fdf2f8', dot: '#f9a8d4' },
  { key: 'purple', bg: '#f5f3ff', dot: '#c4b5fd' },
];

function colorBg(color: string | null) {
  return COLORS.find(c => c.key === color)?.bg ?? '#ffffff';
}
function colorDot(color: string | null) {
  return COLORS.find(c => c.key === color)?.dot ?? '#e2e8f0';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  if (diff < 60000)      return 'щойно';
  if (diff < 3600000)    return `${Math.floor(diff / 60000)} хв тому`;
  if (diff < 86400000)   return `${Math.floor(diff / 3600000)} год тому`;
  if (diff < 604800000)  return `${Math.floor(diff / 86400000)} д тому`;
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

// ── Note list item ────────────────────────────────────────────────────────────

function NoteListItem({ note, selected, onClick }: { note: Note; selected: boolean; onClick: () => void }) {
  const done = note.tasks.filter(t => t.done).length;
  const total = note.tasks.length;
  const preview = note.type === 'note'
    ? (note.content.trim().slice(0, 45) || formatDate(note.updated_at))
    : (total > 0 ? `${done}/${total} виконано` : formatDate(note.updated_at));

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', background: selected ? '#eff6ff' : 'transparent',
        border: 'none', borderLeft: `3px solid ${colorDot(note.color)}`,
        padding: '0.5rem 0.75rem 0.5rem 0.625rem', cursor: 'pointer',
        borderBottom: '1px solid #f1f5f9', display: 'block', transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#f8fafc'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
        {note.type === 'todo'
          ? <CheckSquare size={11} color={selected ? '#2563eb' : '#94a3b8'} style={{ flexShrink: 0 }} />
          : <FileText    size={11} color={selected ? '#2563eb' : '#94a3b8'} style={{ flexShrink: 0 }} />
        }
        <span style={{
          fontSize: '0.8125rem', fontWeight: 600,
          color: selected ? '#1d4ed8' : '#1e293b',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          {note.title || (note.type === 'todo' ? 'Новий список' : 'Нова нотатка')}
        </span>
        {note.is_pinned && <Pin size={10} color="#f59e0b" style={{ flexShrink: 0 }} />}
      </div>
      <div style={{ fontSize: '0.6875rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 16 }}>
        {preview}
      </div>
      {note.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, paddingLeft: 16, marginTop: 3 }}>
          {note.tags.slice(0, 3).map(tag => (
            <span key={tag} style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '0 0.3rem', borderRadius: 10, background: selected ? '#bfdbfe' : '#e2e8f0', color: selected ? '#1d4ed8' : '#64748b' }}>
              #{tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props { isOpen: boolean; onClose: () => void; }

export default function NotesModal({ isOpen, onClose }: Props) {
  const [notes, setNotes]           = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch]         = useState('');
  const [activeTag, setActiveTag]   = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [justSaved, setJustSaved]   = useState(false);
  const [newTaskText, setNewTaskText] = useState('');

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState({ x: -1, y: -1 });
  const dragging = useRef(false);
  const origin   = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  // Centre on first open
  useEffect(() => {
    if (isOpen && pos.x === -1) {
      setPos({
        x: Math.max(20, window.innerWidth  / 2 - 320),
        y: Math.max(20, window.innerHeight / 2 - 260),
      });
    }
  }, [isOpen, pos.x]);

  // Drag
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: origin.current.px + e.clientX - origin.current.mx, y: origin.current.py + e.clientY - origin.current.my });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    dragging.current = true;
    origin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    e.preventDefault();
  };

  // Load notes on open
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/notes')
      .then(r => r.json())
      .then(d => { if (d.notes) setNotes(d.notes); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Auto-save (debounced 700ms)
  const scheduleSave = useCallback((note: Note) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`/api/notes/${note.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title:     note.title,
            content:   note.content,
            tasks:     note.tasks,
            color:     note.color,
            is_pinned: note.is_pinned,
            tags:      note.tags,
          }),
        });
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 1800);
      } catch { /* silent */ }
      setSaving(false);
    }, 700);
  }, []);

  const updateNote = useCallback((id: number, patch: Partial<Note>, save = true) => {
    setNotes(prev => prev.map(n => {
      if (n.id !== id) return n;
      const updated: Note = { ...n, ...patch, updated_at: new Date().toISOString() };
      if (save) scheduleSave(updated);
      return updated;
    }));
  }, [scheduleSave]);

  const selectedNote = notes.find(n => n.id === selectedId) ?? null;

  const createNote = async (type: 'note' | 'todo') => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    const d = await res.json();
    if (d.note) {
      setNotes(prev => [d.note, ...prev]);
      setSelectedId(d.note.id);
      setNewTaskText('');
    }
  };

  const deleteNote = async (id: number) => {
    if (!confirm('Видалити нотатку?')) return;
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // All unique tags across notes
  const allTags = Array.from(new Set(notes.flatMap(n => n.tags))).sort();

  // Filter
  const filtered = notes.filter(n => {
    if (activeTag && !n.tags.includes(activeTag)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tasks.some(t => t.text.toLowerCase().includes(q))
    );
  });
  const pinned = filtered.filter(n =>  n.is_pinned);
  const rest   = filtered.filter(n => !n.is_pinned);

  // Task helpers
  const addTask = () => {
    if (!selectedNote || !newTaskText.trim()) return;
    const task: Task = { id: crypto.randomUUID(), text: newTaskText.trim(), done: false };
    updateNote(selectedNote.id, { tasks: [...selectedNote.tasks, task] });
    setNewTaskText('');
  };

  const toggleTask = (taskId: string) => {
    if (!selectedNote) return;
    updateNote(selectedNote.id, { tasks: selectedNote.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) });
  };

  const deleteTask = (taskId: string) => {
    if (!selectedNote) return;
    updateNote(selectedNote.id, { tasks: selectedNote.tasks.filter(t => t.id !== taskId) });
  };

  const renameTask = (taskId: string, text: string) => {
    if (!selectedNote) return;
    updateNote(selectedNote.id, { tasks: selectedNote.tasks.map(t => t.id === taskId ? { ...t, text } : t) });
  };

  const addTag = (tag: string) => {
    if (!selectedNote) return;
    const t = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!t || selectedNote.tags.includes(t)) return;
    updateNote(selectedNote.id, { tags: [...selectedNote.tags, t] });
  };

  const removeTag = (tag: string) => {
    if (!selectedNote) return;
    updateNote(selectedNote.id, { tags: selectedNote.tags.filter(t => t !== tag) });
  };

  const doneTasks  = selectedNote?.tasks.filter(t => t.done).length ?? 0;
  const totalTasks = selectedNote?.tasks.length ?? 0;

  if (!isOpen || pos.x === -1) return null;

  const bg = selectedNote ? colorBg(selectedNote.color) : '#ffffff';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9800, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', left: pos.x, top: pos.y,
        width: 640, height: 520,
        background: '#ffffff',
        borderRadius: 20,
        boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.07)',
        overflow: 'hidden',
        pointerEvents: 'all',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* ── Header ── */}
        <div
          onMouseDown={startDrag}
          style={{ padding: '0.75rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'grab', background: '#1e293b', flexShrink: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>Записник</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', borderRadius: 6, width: 24, height: 24 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left panel — note list */}
          <div style={{ width: 200, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#f8fafc', flexShrink: 0 }}>

            {/* Create buttons */}
            <div style={{ padding: '0.625rem', display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => createNote('note')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0.4rem 0', borderRadius: 8, background: '#1e293b', color: '#ffffff', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#334155'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#1e293b'; }}
              >
                <Plus size={11} strokeWidth={2.5} /> Нотатка
              </button>
              <button
                onClick={() => createNote('todo')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0.4rem 0', borderRadius: 8, background: '#f1f5f9', color: '#1e293b', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; }}
              >
                <Plus size={11} strokeWidth={2.5} /> Список
              </button>
            </div>

            {/* Search */}
            <div style={{ padding: '0 0.625rem 0.5rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: 8, padding: '0.25rem 0.5rem', gap: 5, border: '1px solid #e2e8f0' }}>
                <Search size={11} color="#94a3b8" style={{ flexShrink: 0 }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Пошук..."
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.75rem', color: '#374151', width: '100%', userSelect: 'text' }}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#94a3b8' }}>
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Tag filter */}
            {allTags.length > 0 && (
              <div style={{ padding: '0 0.625rem 0.5rem', display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0 }}>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                    style={{
                      padding: '0.125rem 0.5rem', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600,
                      background: activeTag === tag ? '#1e293b' : '#e2e8f0',
                      color: activeTag === tag ? '#ffffff' : '#64748b',
                      transition: 'all 0.15s',
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}

            {/* Note list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                  Завантаження...
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.75rem', lineHeight: 1.6 }}>
                  {search ? 'Нічого не знайдено' : 'Немає нотаток.\nСтвори першу!'}
                </div>
              ) : (
                <>
                  {pinned.length > 0 && (
                    <>
                      <div style={{ padding: '0.375rem 0.75rem 0.125rem', fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        📌 Закріплені
                      </div>
                      {pinned.map(n => (
                        <NoteListItem key={n.id} note={n} selected={selectedId === n.id} onClick={() => { setSelectedId(n.id); setNewTaskText(''); }} />
                      ))}
                    </>
                  )}
                  {rest.length > 0 && pinned.length > 0 && (
                    <div style={{ padding: '0.375rem 0.75rem 0.125rem', fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Нотатки
                    </div>
                  )}
                  {rest.map(n => (
                    <NoteListItem key={n.id} note={n} selected={selectedId === n.id} onClick={() => { setSelectedId(n.id); setNewTaskText(''); }} />
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Right panel — editor */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selectedNote ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#cbd5e1' }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>Обери нотатку або створи нову</span>
              </div>
            ) : (
              <>
                {/* Toolbar */}
                <div style={{
                  padding: '0.625rem 1rem',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
                  background: bg,
                  transition: 'background 0.2s',
                }}>
                  <input
                    value={selectedNote.title}
                    onChange={e => updateNote(selectedNote.id, { title: e.target.value })}
                    placeholder="Заголовок..."
                    style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9375rem', fontWeight: 600, color: '#1e293b', userSelect: 'text' }}
                  />

                  {/* Save indicator */}
                  <span style={{
                    fontSize: '0.6875rem', whiteSpace: 'nowrap', transition: 'color 0.3s',
                    color: saving ? '#f59e0b' : justSaved ? '#22c55e' : 'transparent',
                  }}>
                    {saving ? 'Збереження...' : '✓ Збережено'}
                  </span>

                  {/* Color dots */}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {COLORS.map(c => (
                      <button
                        key={c.key ?? 'none'}
                        onClick={() => updateNote(selectedNote.id, { color: c.key })}
                        title={c.key ?? 'без кольору'}
                        style={{
                          width: 13, height: 13, borderRadius: '50%', background: c.dot,
                          border: `2px solid ${selectedNote.color === c.key ? '#2563eb' : 'transparent'}`,
                          cursor: 'pointer', padding: 0, outline: selectedNote.color === c.key ? '1px solid #2563eb' : '1px solid #e2e8f0',
                          outlineOffset: 1, transition: 'outline 0.15s',
                        }}
                      />
                    ))}
                  </div>

                  {/* Pin */}
                  <button
                    onClick={() => updateNote(selectedNote.id, { is_pinned: !selectedNote.is_pinned })}
                    title={selectedNote.is_pinned ? 'Відкріпити' : 'Закріпити'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 3, borderRadius: 5, color: selectedNote.is_pinned ? '#f59e0b' : '#94a3b8' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                  >
                    <Pin size={14} strokeWidth={2} />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteNote(selectedNote.id)}
                    title="Видалити нотатку"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 3, borderRadius: 5, color: '#94a3b8' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'none'; }}
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>

                {/* Tags row */}
                <TagsRow tags={selectedNote.tags} onAdd={addTag} onRemove={removeTag} bg={bg} />

                {/* Content area */}
                {selectedNote.type === 'note' ? (
                  <textarea
                    value={selectedNote.content}
                    onChange={e => updateNote(selectedNote.id, { content: e.target.value })}
                    placeholder="Починай писати..."
                    style={{
                      flex: 1, border: 'none', outline: 'none', resize: 'none',
                      padding: '1rem 1.125rem',
                      fontSize: '0.875rem', lineHeight: 1.75, color: '#374151',
                      background: bg, fontFamily: 'inherit', userSelect: 'text',
                      transition: 'background 0.2s',
                    }}
                  />
                ) : (
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0.875rem 1.125rem', background: bg, transition: 'background 0.2s' }}>

                    {/* Progress bar */}
                    {totalTasks > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: '#94a3b8', marginBottom: 5 }}>
                          <span>Прогрес</span>
                          <span style={{ fontWeight: 600, color: doneTasks === totalTasks ? '#22c55e' : '#64748b' }}>
                            {doneTasks}/{totalTasks}
                          </span>
                        </div>
                        <div style={{ height: 4, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${(doneTasks / totalTasks) * 100}%`,
                            background: doneTasks === totalTasks ? '#22c55e' : '#3b82f6',
                            borderRadius: 4, transition: 'width 0.35s ease',
                          }} />
                        </div>
                      </div>
                    )}

                    {/* Task items */}
                    <TaskList
                      tasks={selectedNote.tasks}
                      onToggle={toggleTask}
                      onDelete={deleteTask}
                      onRename={renameTask}
                      onReorder={newTasks => updateNote(selectedNote.id, { tasks: newTasks })}
                    />

                    {/* Add task input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, padding: '0.375rem 0' }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, border: '2px dashed #d1d5db', flexShrink: 0 }} />
                      <input
                        value={newTaskText}
                        onChange={e => setNewTaskText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addTask(); }}
                        placeholder="Додати пункт..."
                        style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.875rem', color: '#374151', userSelect: 'text' }}
                      />
                      {newTaskText.trim() && (
                        <button
                          onClick={addTask}
                          style={{ background: '#1e293b', border: 'none', cursor: 'pointer', color: 'white', padding: '0.2rem 0.5rem', borderRadius: 5, fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          +
                        </button>
                      )}
                    </div>

                    {/* Empty state */}
                    {totalTasks === 0 && (
                      <div style={{ textAlign: 'center', padding: '2rem 0', color: '#cbd5e1', fontSize: '0.8125rem' }}>
                        Додай перший пункт ↑
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Task item ─────────────────────────────────────────────────────────────────

function TaskItem({ task, onToggle, onDelete, onRename }: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onRename: (text: string) => void;
}) {
  const [hovered, setHovered]   = useState(false);
  const [editing, setEditing]   = useState(false);
  const [editText, setEditText] = useState(task.text);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditText(task.text);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== task.text) onRename(trimmed);
    setEditing(false);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.3125rem 0.375rem', borderRadius: 7, background: hovered ? 'rgba(0,0,0,0.04)' : 'transparent', transition: 'background 0.12s', cursor: 'default' }}
    >
      {/* Drag handle */}
      <span style={{ color: '#d1d5db', fontSize: '0.75rem', cursor: 'grab', opacity: hovered ? 1 : 0, transition: 'opacity 0.12s', flexShrink: 0, lineHeight: 1 }}>⠿</span>

      {/* Checkbox */}
      <button
        onClick={onToggle}
        style={{
          flexShrink: 0, width: 18, height: 18, borderRadius: 5,
          border: `2px solid ${task.done ? '#22c55e' : '#d1d5db'}`,
          background: task.done ? '#22c55e' : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, transition: 'all 0.15s',
        }}
      >
        {task.done && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Text / inline edit */}
      {editing ? (
        <input
          ref={inputRef}
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') setEditing(false);
          }}
          style={{ flex: 1, border: 'none', borderBottom: '1.5px solid #3b82f6', background: 'transparent', outline: 'none', fontSize: '0.875rem', color: '#1e293b', padding: '1px 0', userSelect: 'text' }}
        />
      ) : (
        <span
          onDoubleClick={startEdit}
          title="Подвійний клік — редагувати"
          style={{
            flex: 1, fontSize: '0.875rem', lineHeight: 1.4, cursor: 'text',
            color: task.done ? '#94a3b8' : '#374151',
            textDecoration: task.done ? 'line-through' : 'none',
            transition: 'all 0.15s',
          }}
        >
          {task.text}
        </span>
      )}

      {/* Delete */}
      <button
        onClick={onDelete}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
          display: 'flex', color: '#cbd5e1', borderRadius: 4,
          opacity: hovered && !editing ? 1 : 0, transition: 'opacity 0.15s, color 0.1s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#cbd5e1'; }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── Tags row ──────────────────────────────────────────────────────────────────

function TagsRow({ tags, onAdd, onRemove, bg }: { tags: string[]; onAdd: (t: string) => void; onRemove: (t: string) => void; bg: string }) {
  const [adding, setAdding] = useState(false);
  const [input, setInput]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    if (input.trim()) onAdd(input);
    setInput('');
    setAdding(false);
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '0.375rem 1.125rem', borderBottom: tags.length > 0 || adding ? '1px solid #f1f5f9' : 'none', background: bg, minHeight: tags.length > 0 || adding ? undefined : 0, alignItems: 'center' }}>
      {tags.map(tag => (
        <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0.125rem 0.5rem', borderRadius: 20, background: '#e2e8f0', fontSize: '0.6875rem', fontWeight: 600, color: '#475569' }}>
          #{tag}
          <button onClick={() => onRemove(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#94a3b8', lineHeight: 1 }}>
            <X size={10} />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setAdding(false); setInput(''); } }}
          placeholder="мітка..."
          autoFocus
          style={{ border: 'none', borderBottom: '1.5px solid #3b82f6', background: 'transparent', outline: 'none', fontSize: '0.6875rem', width: 70, color: '#374151', userSelect: 'text' }}
        />
      ) : (
        <button
          onClick={() => { setAdding(true); setTimeout(() => inputRef.current?.focus(), 0); }}
          style={{ background: 'none', border: '1px dashed #d1d5db', borderRadius: 20, cursor: 'pointer', padding: '0.125rem 0.5rem', fontSize: '0.6875rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}
        >
          <Plus size={9} strokeWidth={2.5} /> тег
        </button>
      )}
    </div>
  );
}

// ── Task list with drag-and-drop ──────────────────────────────────────────────

function TaskList({ tasks, onToggle, onDelete, onRename, onReorder }: {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, text: string) => void;
  onReorder: (tasks: Task[]) => void;
}) {
  const dragId  = useRef<string | null>(null);
  const overId  = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const onDragStart = (id: string) => { dragId.current = id; };

  const onDragEnter = (id: string) => {
    overId.current = id;
    setDragOver(id);
  };

  const onDrop = () => {
    if (!dragId.current || !overId.current || dragId.current === overId.current) {
      setDragOver(null);
      return;
    }
    const from = tasks.findIndex(t => t.id === dragId.current);
    const to   = tasks.findIndex(t => t.id === overId.current);
    if (from === -1 || to === -1) { setDragOver(null); return; }
    const next = [...tasks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
    dragId.current = null;
    overId.current = null;
    setDragOver(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {tasks.map(task => (
        <div
          key={task.id}
          draggable
          onDragStart={() => onDragStart(task.id)}
          onDragEnter={() => onDragEnter(task.id)}
          onDragOver={e => e.preventDefault()}
          onDragEnd={() => { setDragOver(null); dragId.current = null; }}
          onDrop={onDrop}
          style={{ outline: dragOver === task.id ? '2px solid #3b82f6' : '2px solid transparent', borderRadius: 7, transition: 'outline 0.1s' }}
        >
          <TaskItem
            task={task}
            onToggle={() => onToggle(task.id)}
            onDelete={() => onDelete(task.id)}
            onRename={text => onRename(task.id, text)}
          />
        </div>
      ))}
    </div>
  );
}
