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
  deadline: string | null;
  is_archived: boolean;
  remind_at: string | null;
  reminded: boolean;
  linked_student_id: number | null;
  linked_group_id: number | null;
  created_at: string;
  updated_at: string;
}

function deadlineLabel(d: string | null): { text: string; overdue: boolean } | null {
  if (!d) return null;
  const deadline = new Date(d);
  deadline.setHours(23, 59, 59);
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  const days = Math.ceil(diff / 86400000);
  const overdue = diff < 0;
  if (overdue) return { text: `Прострочено ${Math.abs(days)} д тому`, overdue: true };
  if (days === 0) return { text: 'Сьогодні', overdue: false };
  if (days === 1) return { text: 'Завтра', overdue: false };
  return { text: `${String(deadline.getDate()).padStart(2,'0')}.${String(deadline.getMonth()+1).padStart(2,'0')}`, overdue: false };
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

// ── Minimal markdown renderer ─────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return text.split('\n').map(line => {
    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      return '<div style="border-bottom:1px solid #e2e8f0;margin:0.75em 0"></div>';
    }
    // Headings
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const sizes = ['1.25rem', '1.1rem', '0.95rem'];
      return `<div style="font-weight:700;font-size:${sizes[level-1]};margin:0.5em 0 0.25em">${inlineFormat(esc(h[2]))}</div>`;
    }
    // Blockquote
    if (/^>\s+/.test(line)) {
      return `<div style="padding-left:1em;border-left:3px solid #93c5fd;color:#64748b;font-style:italic;margin:0.25em 0">${inlineFormat(esc(line.replace(/^>\s+/, '')))}</div>`;
    }
    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      return `<div style="padding-left:1.25em;position:relative"><span style="position:absolute;left:0.25em">•</span>${inlineFormat(esc(line.replace(/^[-*]\s+/, '')))}</div>`;
    }
    // Ordered list
    const ol = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (ol) {
      return `<div style="padding-left:1.25em;position:relative"><span style="position:absolute;left:0">${ol[1]}.</span>${inlineFormat(esc(ol[2]))}</div>`;
    }
    // Empty line
    if (!line.trim()) return '<div style="height:0.5em"></div>';
    // Normal paragraph
    return `<div>${inlineFormat(esc(line))}</div>`;
  }).join('');
}

function inlineFormat(html: string): string {
  return html
    .replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:0.85em;color:#e11d48">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<span style="text-decoration:line-through;color:#94a3b8">$1</span>');
}

// ── Formatting toolbar ────────────────────────────────────────────────────────

function FormatToolbar({ textareaRef, noteId, content, onUpdate }: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  noteId: number;
  content: string;
  onUpdate: (id: number, patch: { content: string }) => void;
}) {
  const insert = (before: string, after: string = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    const replacement = before + (selected || 'текст') + after;
    const newContent = content.slice(0, start) + replacement + content.slice(end);
    onUpdate(noteId, { content: newContent });
    setTimeout(() => {
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + (selected || 'текст').length;
    }, 0);
  };

  const insertLine = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    const pos = ta.selectionStart;
    // Find start of current line
    const lineStart = content.lastIndexOf('\n', pos - 1) + 1;
    const newContent = content.slice(0, lineStart) + prefix + content.slice(lineStart);
    onUpdate(noteId, { content: newContent });
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = pos + prefix.length; }, 0);
  };

  const btns: { title: string; label: string; action: () => void }[] = [
    { title: 'Жирний (Ctrl+B)', label: 'B', action: () => insert('**', '**') },
    { title: 'Курсив (Ctrl+I)', label: 'I', action: () => insert('*', '*') },
    { title: 'Закреслений', label: 'S', action: () => insert('~~', '~~') },
    { title: 'Код', label: '<>', action: () => insert('`', '`') },
    { title: 'Заголовок', label: 'H', action: () => insertLine('## ') },
    { title: 'Список', label: '•', action: () => insertLine('- ') },
    { title: 'Цитата', label: '>', action: () => insertLine('> ') },
    { title: 'Лінія', label: '—', action: () => insert('\n---\n') },
  ];

  return (
    <div style={{ display: 'flex', gap: 1, padding: '0 1.5rem 0.25rem', flexShrink: 0 }}>
      {btns.map(b => (
        <button
          key={b.label}
          onClick={b.action}
          title={b.title}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '3px 7px',
            borderRadius: 5, fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8',
            fontFamily: b.label === 'I' ? 'Georgia, serif' : 'inherit',
            fontStyle: b.label === 'I' ? 'italic' : 'normal',
            textDecoration: b.label === 'S' ? 'line-through' : 'none',
            transition: 'all 0.12s', lineHeight: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#374151'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

// ── Note list item ────────────────────────────────────────────────────────────

function NoteListItem({ note, selected, onClick, bulkMode, bulkSelected, onBulkToggle }: { note: Note; selected: boolean; onClick: () => void; bulkMode?: boolean; bulkSelected?: boolean; onBulkToggle?: () => void }) {
  const done = note.tasks.filter(t => t.done).length;
  const total = note.tasks.length;
  const hasTasks = total > 0;
  const hasContent = note.content.trim().length > 0;
  const preview = hasTasks && hasContent
    ? `${done}/${total} · ${note.content.trim().slice(0, 30)}`
    : hasTasks
      ? `${done}/${total} виконано`
      : (note.content.trim().slice(0, 50) || formatDate(note.updated_at));

  const dotColor = COLORS.find(c => c.key === note.color)?.dot ?? '#e2e8f0';

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        background: selected ? '#eff6ff' : 'transparent',
        border: 'none',
        borderLeft: `3px solid ${selected ? '#2563eb' : dotColor}`,
        padding: '0.75rem 1rem 0.75rem 0.875rem',
        cursor: 'pointer',
        borderBottom: '1px solid #f1f5f9',
        display: 'block',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#f8fafc'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {bulkMode ? (
          <span
            onClick={e => { e.stopPropagation(); onBulkToggle?.(); }}
            style={{
              width: 14, height: 14, borderRadius: 4, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2px solid ${bulkSelected ? '#2563eb' : '#d1d5db'}`,
              background: bulkSelected ? '#2563eb' : 'transparent',
            }}
          >
            {bulkSelected && <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </span>
        ) : hasTasks
          ? <CheckSquare size={12} color={selected ? '#2563eb' : '#94a3b8'} style={{ flexShrink: 0 }} />
          : <FileText    size={12} color={selected ? '#2563eb' : '#94a3b8'} style={{ flexShrink: 0 }} />
        }
        <span style={{
          fontSize: '0.8125rem', fontWeight: 600,
          color: selected ? '#1d4ed8' : '#1e293b',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          {note.title || 'Нова нотатка'}
        </span>
        {note.is_pinned && <Pin size={11} color={selected ? '#2563eb' : '#94a3b8'} style={{ flexShrink: 0 }} />}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 18 }}>
        {preview}
      </div>
      {hasTasks && (
        <div style={{ marginTop: 5, paddingLeft: 18, paddingRight: 4 }}>
          <div style={{ height: 3, background: selected ? '#bfdbfe' : '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${total > 0 ? (done / total) * 100 : 0}%`,
              background: done === total ? '#22c55e' : (selected ? '#2563eb' : '#93c5fd'),
              borderRadius: 3, transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}
      {(note.tags.length > 0 || note.deadline) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, paddingLeft: 18, marginTop: 5, alignItems: 'center' }}>
          {note.tags.slice(0, 2).map(tag => (
            <span key={tag} style={{ fontSize: '0.625rem', fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: selected ? '#bfdbfe' : '#e2e8f0', color: selected ? '#1d4ed8' : '#64748b' }}>
              #{tag}
            </span>
          ))}
          {(() => { const dl = deadlineLabel(note.deadline); return dl ? (
            <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: dl.overdue ? '#fee2e2' : '#dcfce7', color: dl.overdue ? '#dc2626' : '#16a34a' }}>
              {dl.text}
            </span>
          ) : null; })()}
        </div>
      )}
    </button>
  );
}

// ── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATES: { icon: string; label: string; desc: string; type: 'note' | 'todo'; content?: string; tasks?: Omit<Task,'id'>[] }[] = [
  {
    icon: '📋', type: 'todo', label: 'Щотижневий чеклист',
    desc: 'Стандартні завдання на тиждень',
    tasks: [
      { text: 'Перевірити оплати учнів', done: false },
      { text: 'Переглянути розклад груп', done: false },
      { text: 'Оновити відвідуваність', done: false },
      { text: 'Зв\'язатись із боржниками', done: false },
      { text: 'Переглянути звіти', done: false },
    ],
  },
  {
    icon: '💰', type: 'todo', label: 'Перевірка оплат',
    desc: 'Контроль фінансових надходжень',
    tasks: [
      { text: 'Перевірити поточні борги', done: false },
      { text: 'Надіслати нагадування боржникам', done: false },
      { text: 'Зафіксувати нові оплати', done: false },
      { text: 'Звірити баланс', done: false },
    ],
  },
  {
    icon: '🎓', type: 'todo', label: 'Нова група',
    desc: 'Кроки для запуску групи',
    tasks: [
      { text: 'Визначити викладача', done: false },
      { text: 'Скласти розклад занять', done: false },
      { text: 'Зібрати учнів', done: false },
      { text: 'Налаштувати оплату', done: false },
      { text: 'Провести перше заняття', done: false },
    ],
  },
  {
    icon: '📝', type: 'note', label: 'Нотатка про учня',
    desc: 'Шаблон замітки по учню',
    content: 'Ім\'я: \nГрупа: \nКонтакт: \n\nПримітки:\n',
  },
  {
    icon: '📅', type: 'note', label: 'Нотатка про зустріч',
    desc: 'Запис результатів зустрічі',
    content: 'Дата: \nУчасники: \n\nОбговорені питання:\n\nРішення:\n\nНаступні кроки:\n',
  },
];

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props { isOpen: boolean; onClose: () => void; }

export default function NotesModal({ isOpen, onClose }: Props) {
  const [notes, setNotes]           = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch]         = useState('');
  const [activeTag, setActiveTag]       = useState<string | null>(null);
  const [showArchive, setShowArchive]   = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTaskSection, setShowTaskSection] = useState(false);
  const [forceShowText, setForceShowText] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [justSaved, setJustSaved]   = useState(false);
  const [students, setStudents]     = useState<{ id: number; name: string }[]>([]);
  const [groups, setGroups]         = useState<{ id: number; title: string }[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated');
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [sidebarW, setSidebarW] = useState(240);
  const sidebarResizing = useRef(false);
  const sidebarOrigin   = useRef({ mx: 0, w: 240 });
  const [mdPreview, setMdPreview] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkIds, setBulkIds]   = useState<Set<number>>(new Set());
  const undoStack = useRef<{ noteId: number; prev: Partial<Note> }[]>([]);
  const [undoToast, setUndoToast] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos]   = useState({ x: -1, y: -1 });
  const [size, setSize] = useState({ w: 800, h: 620 });
  const dragging  = useRef(false);
  const resizing  = useRef(false);
  const origin    = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const resizeOrigin = useRef({ mx: 0, my: 0, w: 800, h: 620 });

  // Restore or centre position/size on first open
  useEffect(() => {
    if (isOpen && pos.x === -1) {
      try {
        const saved = localStorage.getItem('itrobot-notes-layout');
        if (saved) {
          const { x, y, w, h, sw } = JSON.parse(saved);
          setPos({ x, y });
          setSize({ w, h });
          if (sw) setSidebarW(sw);
          return;
        }
      } catch { /* ignore */ }
      setPos({
        x: Math.max(20, window.innerWidth  / 2 - 400),
        y: Math.max(20, window.innerHeight / 2 - 310),
      });
    }
  }, [isOpen, pos.x]);

  // Persist layout when pos/size change
  useEffect(() => {
    if (pos.x === -1) return;
    localStorage.setItem('itrobot-notes-layout', JSON.stringify({ x: pos.x, y: pos.y, w: size.w, h: size.h, sw: sidebarW }));
  }, [pos, size, sidebarW]);

  // Drag & Resize
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) {
        setPos({ x: origin.current.px + e.clientX - origin.current.mx, y: origin.current.py + e.clientY - origin.current.my });
      } else if (resizing.current) {
        const w = Math.max(560, resizeOrigin.current.w + e.clientX - resizeOrigin.current.mx);
        const h = Math.max(420, resizeOrigin.current.h + e.clientY - resizeOrigin.current.my);
        setSize({ w, h });
      } else if (sidebarResizing.current) {
        const w = Math.max(180, Math.min(360, sidebarOrigin.current.w + e.clientX - sidebarOrigin.current.mx));
        setSidebarW(w);
      }
    };
    const onUp = () => { dragging.current = false; resizing.current = false; sidebarResizing.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    dragging.current = true;
    origin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    e.preventDefault();
  };

  // Load notes on open + fire due reminders
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/notes')
      .then(r => r.json())
      .then(d => { if (d.notes) setNotes(d.notes); })
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch('/api/notes/check-reminders', { method: 'POST' }).catch(() => {});
    if (students.length === 0) {
      fetch('/api/students?limit=500').then(r => r.json()).then(d => { if (d.students) setStudents(d.students.map((s: {id:number;full_name:string}) => ({ id: s.id, name: s.full_name }))); }).catch(() => {});
      fetch('/api/groups?limit=200').then(r => r.json()).then(d => { if (d.groups) setGroups(d.groups.map((g: {id:number;title:string}) => ({ id: g.id, title: g.title }))); }).catch(() => {});
    }
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
            deadline:    note.deadline,
            is_archived: note.is_archived,
            remind_at:          note.remind_at,
            linked_student_id:  note.linked_student_id,
            linked_group_id:    note.linked_group_id,
          }),
        });
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2500);
      } catch { /* silent */ }
      setSaving(false);
    }, 700);
  }, []);

  const updateNote = useCallback((id: number, patch: Partial<Note>, save = true) => {
    setNotes(prev => prev.map(n => {
      if (n.id !== id) return n;
      // Push previous state to undo stack (keep last 15)
      const snapshot: Partial<Note> = {};
      for (const key of Object.keys(patch) as (keyof Note)[]) { (snapshot as Record<string, unknown>)[key] = n[key]; }
      undoStack.current = [...undoStack.current.slice(-14), { noteId: id, prev: snapshot }];
      const updated: Note = { ...n, ...patch, updated_at: new Date().toISOString() };
      if (save) scheduleSave(updated);
      return updated;
    }));
  }, [scheduleSave]);

  const selectedNote = notes.find(n => n.id === selectedId) ?? null;

  // Show task section automatically if note already has tasks
  useEffect(() => {
    setShowTaskSection(selectedNote ? selectedNote.tasks.length > 0 : false);
    setForceShowText(false);
    setMdPreview(false);
    // Reset textarea height on note change + autofocus title
    setTimeout(() => {
      if (textareaRef.current) autoResizeTextarea(textareaRef.current);
      if (selectedNote && !selectedNote.title) titleRef.current?.focus();
    }, 0);
  }, [selectedId]);

  const autoResizeTextarea = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  const createNote = async (type: 'note' | 'todo', template?: { title: string; content?: string; tasks?: Omit<Task,'id'>[] }) => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    const d = await res.json();
    if (!d.note) return;
    if (template) {
      const patch: Partial<Note> = { title: template.title };
      if (template.content) patch.content = template.content;
      if (template.tasks)   patch.tasks   = template.tasks.map(t => ({ ...t, id: crypto.randomUUID() }));
      await fetch(`/api/notes/${d.note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      Object.assign(d.note, patch);
    }
    setNotes(prev => [d.note, ...prev]);
    setSelectedId(d.note.id);
    setNewTaskText('');
  };

  const duplicateNote = async (note: Note) => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: note.type }),
    });
    const d = await res.json();
    if (!d.note) return;
    await fetch(`/api/notes/${d.note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:   note.title ? `${note.title} (копія)` : '',
        content: note.content,
        tasks:   note.tasks.map(t => ({ ...t, id: crypto.randomUUID(), done: false })),
        color:   note.color,
        tags:    note.tags,
      }),
    });
    const fresh = { ...d.note, title: note.title ? `${note.title} (копія)` : '', content: note.content, tasks: note.tasks.map(t => ({ ...t, id: crypto.randomUUID(), done: false })), color: note.color, tags: note.tags };
    setNotes(prev => [fresh, ...prev]);
    setSelectedId(fresh.id);
  };

  const deleteNote = async (id: number) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    setConfirmDeleteId(null);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // All unique tags (non-archived only)
  const allTags = Array.from(new Set(notes.filter(n => !n.is_archived).flatMap(n => n.tags))).sort();

  // Filter + sort
  const sortFn = (a: Note, b: Note) => {
    if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '', 'uk');
    if (sortBy === 'created') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  };
  const filtered = notes.filter(n => {
    if (n.is_archived !== showArchive) return false;
    if (activeTag && !n.tags.includes(activeTag)) return false;
    if (activeColor !== null && (n.color ?? '') !== activeColor) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tasks.some(t => t.text.toLowerCase().includes(q))
    );
  }).sort(sortFn);
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

  const performUndo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    setNotes(prev => prev.map(n => {
      if (n.id !== entry.noteId) return n;
      const restored = { ...n, ...entry.prev, updated_at: new Date().toISOString() };
      scheduleSave(restored);
      return restored;
    }));
    setUndoToast(true);
    setTimeout(() => setUndoToast(false), 1500);
  }, [scheduleSave]);

  // Keyboard shortcuts + arrow nav
  const shortcutRef = useRef({ createNote, onClose, filtered, selectedId, setSelectedId, setNewTaskText, performUndo });
  useEffect(() => { shortcutRef.current = { createNote, onClose, filtered, selectedId, setSelectedId, setNewTaskText, performUndo }; });
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); shortcutRef.current.onClose(); return; }
      // Arrow nav (only when not editing text)
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        const { filtered: list, selectedId: sid } = shortcutRef.current;
        const allItems = [...list.filter(n => n.is_pinned), ...list.filter(n => !n.is_pinned)];
        if (allItems.length === 0) return;
        const idx = allItems.findIndex(n => n.id === sid);
        const next = e.key === 'ArrowDown'
          ? (idx < allItems.length - 1 ? idx + 1 : 0)
          : (idx > 0 ? idx - 1 : allItems.length - 1);
        shortcutRef.current.setSelectedId(allItems[next].id);
        shortcutRef.current.setNewTaskText('');
        return;
      }
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'n') { e.preventDefault(); shortcutRef.current.createNote('note'); }
      if (e.key === 't') { e.preventDefault(); shortcutRef.current.createNote('todo'); }
      if (e.key === 'w') { e.preventDefault(); shortcutRef.current.onClose(); }
      if (e.key === 'z') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return; // let native undo work
        e.preventDefault(); shortcutRef.current.performUndo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen || pos.x === -1) return null;

  const bg = selectedNote ? colorBg(selectedNote.color) : '#ffffff';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9800, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', left: pos.x, top: pos.y,
        width: size.w, height: size.h,
        background: '#ffffff',
        borderRadius: 18,
        boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 4px 20px rgba(0,0,0,0.07)',
        overflow: 'hidden',
        pointerEvents: 'all',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* ── Header ── */}
        <div
          onMouseDown={startDrag}
          style={{
            padding: '0 1.125rem',
            height: 48,
            display: 'flex', alignItems: 'center', gap: '0.625rem',
            cursor: 'grab', flexShrink: 0,
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <span title={"Ctrl+N — нова нотатка\nCtrl+T — новий список\nCtrl+W / Esc — закрити"} style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#ffffff', letterSpacing: '0.03em', flex: 1 }}>
            Записник
          </span>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', borderRadius: 8, width: 30, height: 30, transition: 'background 0.15s', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.55)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Toasts */}
        {(undoToast || copiedToast) && (
          <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', padding: '6px 16px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, zIndex: 20, opacity: 0.9, pointerEvents: 'none' }}>
            {undoToast ? 'Скасовано (Ctrl+Z)' : 'Скопійовано'}
          </div>
        )}

        {/* Resize handle */}
        <div
          onMouseDown={e => {
            resizing.current = true;
            resizeOrigin.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h };
            e.preventDefault();
          }}
          style={{ position: 'absolute', bottom: 2, right: 2, width: 20, height: 20, cursor: 'se-resize', zIndex: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '3px', opacity: 0.5, transition: 'opacity 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <line x1="9" y1="2" x2="2" y2="9" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="9" y1="5.5" x2="5.5" y2="9" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── Left panel ── */}
          <div style={{ width: sidebarW, borderRight: 'none', display: 'flex', flexDirection: 'column', background: '#f9fafb', flexShrink: 0, position: 'relative' }}>
            {/* Sidebar resize handle */}
            <div
              onMouseDown={e => {
                sidebarResizing.current = true;
                sidebarOrigin.current = { mx: e.clientX, w: sidebarW };
                e.preventDefault();
              }}
              style={{ position: 'absolute', top: 0, right: -2, width: 5, height: '100%', cursor: 'col-resize', zIndex: 5 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            />

            {/* Archive toggle */}
            <div style={{ padding: '0.875rem 0.875rem 0.625rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 10, padding: 3, gap: 2 }}>
                <button
                  onClick={() => { setShowArchive(false); setSelectedId(null); }}
                  style={{ flex: 1, padding: '0.4rem 0', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.15s', background: !showArchive ? '#2563eb' : 'transparent', color: !showArchive ? '#fff' : '#64748b' }}
                >
                  Активні
                </button>
                <button
                  onClick={() => { setShowArchive(true); setSelectedId(null); }}
                  style={{ flex: 1, padding: '0.4rem 0', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.15s', background: showArchive ? '#2563eb' : 'transparent', color: showArchive ? '#fff' : '#64748b' }}
                >
                  Архів
                </button>
              </div>
            </div>

            {/* Create buttons */}
            <div style={{ padding: '0 0.875rem 0.5rem', flexShrink: 0, display: 'flex', gap: 4 }}>
              <button
                onClick={() => createNote('note')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0.5rem 0', borderRadius: 10, background: '#2563eb', color: '#ffffff', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, transition: 'background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#1d4ed8'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#2563eb'; }}
              >
                <FileText size={11} strokeWidth={2.5} /> Нотатка
              </button>
              <button
                onClick={() => createNote('todo')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0.5rem 0', borderRadius: 10, background: '#2563eb', color: '#ffffff', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, transition: 'background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#1d4ed8'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#2563eb'; }}
              >
                <CheckSquare size={11} strokeWidth={2.5} /> Список
              </button>
            </div>

            {/* Templates dropdown */}
            <div style={{ padding: '0 0.875rem 0.75rem', flexShrink: 0, position: 'relative' }}>
              <button
                onClick={() => setShowTemplates(v => !v)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '0.3125rem 0', borderRadius: 8, border: '1px dashed #d1d5db', background: showTemplates ? '#eff6ff' : 'transparent', cursor: 'pointer', fontSize: '0.75rem', color: showTemplates ? '#2563eb' : '#94a3b8', fontWeight: 500, transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!showTemplates) { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#64748b'; } }}
                onMouseLeave={e => { if (!showTemplates) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#94a3b8'; } }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                Шаблони
              </button>
              {showTemplates && (
                <div style={{ position: 'absolute', top: '100%', left: '0.875rem', right: '0.875rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.1)', zIndex: 10, overflow: 'hidden', marginTop: 4 }}>
                  {TEMPLATES.map(tpl => (
                    <button
                      key={tpl.label}
                      onClick={() => { createNote(tpl.type, { title: tpl.label, content: tpl.content, tasks: tpl.tasks }); setShowTemplates(false); }}
                      style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.1s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                    >
                      <span style={{ fontSize: '1.125rem', lineHeight: 1 }}>{tpl.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{tpl.label}</div>
                        <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: 1 }}>{tpl.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            <div style={{ padding: '0 0.875rem 0.75rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderRadius: 10, padding: '0.4rem 0.75rem', gap: 6, border: '1.5px solid #e2e8f0', transition: 'border-color 0.15s' }}
                onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#93c5fd'; }}
                onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0'; }}
              >
                <Search size={12} color="#94a3b8" style={{ flexShrink: 0 }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Пошук..."
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8125rem', color: '#374151', width: '100%', userSelect: 'text' }}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#94a3b8' }}>
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Sort + Color filter */}
            <div style={{ padding: '0 0.875rem 0.625rem', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {/* Sort selector */}
              <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 6, padding: 2, gap: 1, flex: 1 }}>
                {([['updated', 'Оновл.'], ['created', 'Створ.'], ['title', 'Назва']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    style={{
                      flex: 1, padding: '2px 0', borderRadius: 5, border: 'none', cursor: 'pointer',
                      fontSize: '0.625rem', fontWeight: 600, transition: 'all 0.12s',
                      background: sortBy === key ? '#fff' : 'transparent',
                      color: sortBy === key ? '#1e293b' : '#94a3b8',
                      boxShadow: sortBy === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Color filter dots */}
              <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                {COLORS.map(c => (
                  <button
                    key={c.key ?? 'none'}
                    onClick={() => setActiveColor(activeColor === (c.key ?? '') ? null : (c.key ?? ''))}
                    style={{
                      width: 10, height: 10, borderRadius: '50%', background: c.dot,
                      border: activeColor === (c.key ?? '') ? '2px solid #2563eb' : '1.5px solid transparent',
                      cursor: 'pointer', padding: 0,
                      boxShadow: activeColor === (c.key ?? '') ? '0 0 0 1px #2563eb' : 'none',
                      transition: 'all 0.12s',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Tag filter */}
            {allTags.length > 0 && (
              <div style={{ padding: '0 0.875rem 0.625rem', display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0 }}>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                    style={{
                      padding: '2px 9px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600,
                      background: activeTag === tag ? '#2563eb' : '#e2e8f0',
                      color: activeTag === tag ? '#ffffff' : '#64748b',
                      transition: 'all 0.15s',
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}

            {/* Bulk mode toolbar */}
            {bulkMode && (
              <div style={{ padding: '0.5rem 0.875rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, background: '#eff6ff' }}>
                {/* Select all checkbox */}
                <button
                  onClick={() => {
                    if (bulkIds.size === filtered.length) {
                      setBulkIds(new Set());
                    } else {
                      setBulkIds(new Set(filtered.map(n => n.id)));
                    }
                  }}
                  style={{
                    width: 14, height: 14, borderRadius: 3, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    border: `2px solid ${bulkIds.size === filtered.length && filtered.length > 0 ? '#2563eb' : '#93c5fd'}`,
                    background: bulkIds.size === filtered.length && filtered.length > 0 ? '#2563eb' : 'transparent',
                  }}
                  title={bulkIds.size === filtered.length ? 'Зняти всі' : 'Обрати всі'}
                >
                  {bulkIds.size === filtered.length && filtered.length > 0 && <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  {bulkIds.size > 0 && bulkIds.size < filtered.length && <div style={{ width: 6, height: 2, background: '#2563eb', borderRadius: 1 }} />}
                </button>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#2563eb', flex: 1 }}>
                  {bulkIds.size > 0 ? `Обрано: ${bulkIds.size}` : 'Оберіть нотатки'}
                </span>
                {bulkIds.size > 0 && (
                  <>
                    {/* Bulk color change */}
                    <div style={{ display: 'flex', gap: 2, alignItems: 'center', marginRight: 2 }}>
                      {COLORS.slice(0, 4).map(c => (
                        <button
                          key={c.key ?? 'none'}
                          onClick={() => { Array.from(bulkIds).forEach(id => updateNote(id, { color: c.key })); }}
                          title={c.key ?? 'без кольору'}
                          style={{ width: 10, height: 10, borderRadius: '50%', background: c.dot, border: '1px solid #d1d5db', cursor: 'pointer', padding: 0 }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={async () => {
                        Array.from(bulkIds).forEach(id => updateNote(id, { is_archived: true }, true));
                        setBulkIds(new Set()); setBulkMode(false); setSelectedId(null);
                      }}
                      style={{ fontSize: '0.625rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#fef3c7', color: '#d97706' }}
                    >
                      Архів
                    </button>
                    <button
                      onClick={async () => {
                        await Promise.all(Array.from(bulkIds).map(id => fetch(`/api/notes/${id}`, { method: 'DELETE' })));
                        setNotes(prev => prev.filter(n => !bulkIds.has(n.id)));
                        if (bulkIds.has(selectedId ?? 0)) setSelectedId(null);
                        setBulkIds(new Set()); setBulkMode(false);
                      }}
                      style={{ fontSize: '0.625rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#fee2e2', color: '#ef4444' }}
                    >
                      Видалити
                    </button>
                  </>
                )}
                <button
                  onClick={() => { setBulkMode(false); setBulkIds(new Set()); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: '#94a3b8' }}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Note list + footer */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', fontSize: '0.8125rem' }}>
                  Завантаження...
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', fontSize: '0.8125rem', lineHeight: 1.7 }}>
                  {search ? 'Нічого не знайдено' : showArchive ? 'Архів порожній' : 'Немає нотаток.\nСтвори першу!'}
                </div>
              ) : (
                <>
                  {pinned.length > 0 && (
                    <>
                      <div style={{ padding: '0.75rem 1rem 0.3rem', fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Pin size={10} /> Закріплені
                      </div>
                      {pinned.map(n => (
                        <NoteListItem key={n.id} note={n} selected={selectedId === n.id} onClick={() => { if (bulkMode) { setBulkIds(prev => { const next = new Set(prev); next.has(n.id) ? next.delete(n.id) : next.add(n.id); return next; }); } else { setSelectedId(n.id); setNewTaskText(''); } }} bulkMode={bulkMode} bulkSelected={bulkIds.has(n.id)} onBulkToggle={() => setBulkIds(prev => { const next = new Set(prev); next.has(n.id) ? next.delete(n.id) : next.add(n.id); return next; })} />
                      ))}
                    </>
                  )}
                  {rest.length > 0 && pinned.length > 0 && (
                    <div style={{ padding: '0.875rem 1rem 0.3rem', fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em' }}>
                      Нотатки
                    </div>
                  )}
                  {rest.map(n => (
                    <NoteListItem key={n.id} note={n} selected={selectedId === n.id} onClick={() => { if (bulkMode) { setBulkIds(prev => { const next = new Set(prev); next.has(n.id) ? next.delete(n.id) : next.add(n.id); return next; }); } else { setSelectedId(n.id); setNewTaskText(''); } }} bulkMode={bulkMode} bulkSelected={bulkIds.has(n.id)} onBulkToggle={() => setBulkIds(prev => { const next = new Set(prev); next.has(n.id) ? next.delete(n.id) : next.add(n.id); return next; })} />
                  ))}
                </>
              )}
            </div>
            {/* Footer counter + bulk toggle */}
            {!loading && filtered.length > 0 && (
              <div style={{ padding: '0.375rem 1rem', borderTop: '1px solid #f1f5f9', fontSize: '0.6875rem', color: '#94a3b8', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span>
                  {filtered.length} {filtered.length === 1 ? 'нотатка' : filtered.length < 5 ? 'нотатки' : 'нотаток'}
                  {pinned.length > 0 && ` · ${pinned.length} закріп.`}
                </span>
                {!bulkMode && filtered.length > 1 && (
                  <button
                    onClick={() => setBulkMode(true)}
                    style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 5, cursor: 'pointer', padding: '1px 6px', fontSize: '0.625rem', color: '#94a3b8', transition: 'all 0.12s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.color = '#2563eb'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#94a3b8'; }}
                  >
                    Виділити
                  </button>
                )}
              </div>
            )}
            </div>
          </div>

          {/* ── Right panel — editor ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: bg, transition: 'background 0.2s' }}>
            {!selectedNote ? (
              /* Empty state */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, color: '#cbd5e1' }}>
                <div style={{ width: 80, height: 80, borderRadius: 24, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Вибери нотатку</div>
                  <div style={{ fontSize: '0.8125rem', color: '#cbd5e1', lineHeight: 1.7 }}>або натисни «Нотатка» / «Список»,<br/>щоб створити нову</div>
                </div>
              </div>
            ) : (
              <>
                {/* ── Title row ── */}
                <div style={{
                  padding: '1.125rem 1.5rem 0.75rem',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                  flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {selectedNote.tasks.length > 0
                      ? <CheckSquare size={17} color="#2563eb" style={{ flexShrink: 0 }} />
                      : <FileText    size={17} color="#2563eb" style={{ flexShrink: 0 }} />
                    }
                    <input
                      ref={titleRef}
                      value={selectedNote.title}
                      onChange={e => updateNote(selectedNote.id, { title: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          textareaRef.current?.focus();
                        }
                      }}
                      placeholder="Заголовок нотатки..."
                      style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '1.0625rem', fontWeight: 700, color: '#1e293b', userSelect: 'text' }}
                    />
                    {/* Save indicator */}
                    <span style={{
                      fontSize: '0.6875rem', whiteSpace: 'nowrap', transition: 'opacity 0.3s',
                      opacity: saving || justSaved ? 1 : 0,
                      color: saving ? '#f59e0b' : '#22c55e',
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}>
                      {saving ? (
                        <>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          Збереження...
                        </>
                      ) : (
                        <>✓ Збережено</>
                      )}
                    </span>
                  </div>
                </div>

                {/* ── Action bar ── */}
                <div style={{
                  padding: '0.5rem 1.5rem',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, flexWrap: 'nowrap',
                }}>
                  {/* Color dots */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginRight: 4 }}>
                    {COLORS.map(c => (
                      <button
                        key={c.key ?? 'none'}
                        onClick={() => updateNote(selectedNote.id, { color: c.key })}
                        title={c.key ?? 'без кольору'}
                        style={{
                          width: 15, height: 15, borderRadius: '50%', background: c.dot,
                          border: `2px solid ${selectedNote.color === c.key ? '#2563eb' : 'transparent'}`,
                          cursor: 'pointer', padding: 0,
                          boxShadow: selectedNote.color === c.key ? '0 0 0 1px #2563eb' : '0 0 0 1px #e2e8f0',
                          transition: 'box-shadow 0.15s',
                        }}
                      />
                    ))}
                  </div>

                  <div style={{ width: 1, height: 18, background: '#e2e8f0', flexShrink: 0, margin: '0 4px' }} />

                  {/* Reminder */}
                  {(() => {
                    const hasRemind = !!selectedNote.remind_at;
                    const isPast = hasRemind && new Date(selectedNote.remind_at!) <= new Date();
                    return (
                      <label title="Нагадування" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                        {hasRemind ? (
                          <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: isPast ? '#f3f4f6' : '#eff6ff', color: isPast ? '#9ca3af' : '#2563eb', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            {new Date(selectedNote.remind_at!).toLocaleString('uk', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                            <button onClick={e => { e.preventDefault(); updateNote(selectedNote.id, { remind_at: null }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', lineHeight: 1, marginLeft: 1, display: 'flex' }}>
                              <X size={9} />
                            </button>
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.6875rem', color: '#94a3b8', padding: '3px 9px', borderRadius: 20, border: '1px dashed #d1d5db', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLSpanElement).style.borderColor = '#93c5fd'; (e.currentTarget as HTMLSpanElement).style.color = '#2563eb'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLSpanElement).style.color = '#94a3b8'; }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            нагадати
                          </span>
                        )}
                        <input
                          type="datetime-local"
                          value={selectedNote.remind_at ? new Date(selectedNote.remind_at).toISOString().slice(0,16) : ''}
                          onChange={e => updateNote(selectedNote.id, { remind_at: e.target.value || null })}
                          style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' }}
                        />
                      </label>
                    );
                  })()}

                  {/* Deadline (todo only) */}
                  {selectedNote.type === 'todo' && (() => {
                    const dl = deadlineLabel(selectedNote.deadline);
                    return (
                      <label title="Дедлайн" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                        {dl ? (
                          <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: dl.overdue ? '#fee2e2' : '#dcfce7', color: dl.overdue ? '#dc2626' : '#16a34a', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
                            📅 {dl.text}
                            <button
                              onClick={e => { e.preventDefault(); updateNote(selectedNote.id, { deadline: null }); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', lineHeight: 1, display: 'flex', marginLeft: 1 }}
                            >
                              <X size={9} />
                            </button>
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.6875rem', color: '#94a3b8', padding: '3px 9px', borderRadius: 20, border: '1px dashed #d1d5db', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLSpanElement).style.borderColor = '#86efac'; (e.currentTarget as HTMLSpanElement).style.color = '#16a34a'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLSpanElement).style.color = '#94a3b8'; }}
                          >
                            + дедлайн
                          </span>
                        )}
                        <input
                          type="date"
                          value={selectedNote.deadline?.slice(0, 10) ?? ''}
                          onChange={e => updateNote(selectedNote.id, { deadline: e.target.value || null })}
                          style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' }}
                        />
                      </label>
                    );
                  })()}

                  <div style={{ flex: 1 }} />

                  {/* Markdown preview toggle */}
                  <ActionBtn
                    title={mdPreview ? 'Редагувати' : 'Попередній перегляд'}
                    active={mdPreview}
                    activeColor="#8b5cf6"
                    hoverColor="#8b5cf6"
                    hoverBg="#f5f3ff"
                    onClick={() => setMdPreview(v => !v)}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  </ActionBtn>

                  {/* Toggle task section */}
                  <ActionBtn
                    title={showTaskSection ? 'Сховати список' : 'Додати список завдань'}
                    active={showTaskSection}
                    activeColor="#2563eb"
                    hoverColor="#2563eb"
                    hoverBg="#eff6ff"
                    onClick={() => setShowTaskSection(v => !v)}
                  >
                    <CheckSquare size={15} strokeWidth={2} />
                  </ActionBtn>

                  <div style={{ width: 1, height: 18, background: '#e2e8f0', flexShrink: 0, margin: '0 2px' }} />

                  {/* Icon buttons */}
                  <ActionBtn
                    title={selectedNote.is_pinned ? 'Відкріпити' : 'Закріпити'}
                    active={selectedNote.is_pinned}
                    activeColor="#f59e0b"
                    onClick={() => updateNote(selectedNote.id, { is_pinned: !selectedNote.is_pinned })}
                  >
                    <Pin size={15} strokeWidth={2} />
                  </ActionBtn>

                  <ActionBtn
                    title="Копіювати текст"
                    hoverColor="#2563eb"
                    hoverBg="#eff6ff"
                    onClick={() => {
                      const parts: string[] = [];
                      if (selectedNote.title) parts.push(`# ${selectedNote.title}`);
                      if (selectedNote.content.trim()) parts.push(selectedNote.content.trim());
                      if (selectedNote.tasks.length > 0) {
                        parts.push(selectedNote.tasks.map(t => `${t.done ? '- [x]' : '- [ ]'} ${t.text}`).join('\n'));
                      }
                      navigator.clipboard.writeText(parts.join('\n\n')).then(() => {
                        setCopiedToast(true);
                        setTimeout(() => setCopiedToast(false), 1500);
                      });
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                      <rect x="8" y="2" width="8" height="4" rx="1"/>
                    </svg>
                  </ActionBtn>

                  <ActionBtn
                    title="Дублювати нотатку"
                    hoverColor="#2563eb"
                    hoverBg="#eff6ff"
                    onClick={() => duplicateNote(selectedNote)}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </ActionBtn>

                  <ActionBtn
                    title={selectedNote.is_archived ? 'Відновити' : 'Архівувати'}
                    hoverColor="#d97706"
                    hoverBg="#fffbeb"
                    onClick={() => { updateNote(selectedNote.id, { is_archived: !selectedNote.is_archived }); setSelectedId(null); }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
                    </svg>
                  </ActionBtn>

                  {confirmDeleteId === selectedNote.id ? (
                    <button
                      onClick={() => deleteNote(selectedNote.id)}
                      style={{ background: '#fee2e2', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 8, fontSize: '0.6875rem', fontWeight: 700, color: '#ef4444', transition: 'all 0.15s', flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                    >
                      Точно?
                    </button>
                  ) : (
                    <ActionBtn
                      title="Видалити нотатку"
                      hoverColor="#ef4444"
                      hoverBg="#fef2f2"
                      onClick={() => deleteNote(selectedNote.id)}
                    >
                      <Trash2 size={15} strokeWidth={2} />
                    </ActionBtn>
                  )}
                </div>

                {/* ── Tags row ── */}
                <TagsRow tags={selectedNote.tags} onAdd={addTag} onRemove={removeTag} bg={bg} />

                {/* ── Linked entity row ── */}
                <LinkedRow
                  studentId={selectedNote.linked_student_id}
                  groupId={selectedNote.linked_group_id}
                  students={students}
                  groups={groups}
                  bg={bg}
                  onChangeStudent={id => updateNote(selectedNote.id, { linked_student_id: id })}
                  onChangeGroup={id => updateNote(selectedNote.id, { linked_group_id: id })}
                />

                {/* ── Content area ── */}
                {(() => {
                  const hasContent = selectedNote.content.trim().length > 0;
                  // When tasks exist and there's no text — list takes full height
                  const tasksFull = showTaskSection && !hasContent && !forceShowText;
                  return (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }}>

                  {/* Text area / markdown preview */}
                  {!tasksFull && (
                  mdPreview && selectedNote.content.trim() ? (
                    <div
                      onClick={() => setMdPreview(false)}
                      style={{
                        padding: showTaskSection ? '1.25rem 1.5rem 0.75rem' : '1.25rem 1.5rem',
                        fontSize: '0.9375rem', lineHeight: 1.8, color: '#374151',
                        cursor: 'text', minHeight: 56,
                      }}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedNote.content) }}
                    />
                  ) : (
                  <>
                  <FormatToolbar textareaRef={textareaRef} noteId={selectedNote.id} content={selectedNote.content} onUpdate={(id, patch) => updateNote(id, patch)} />
                  <textarea
                    ref={textareaRef}
                    value={selectedNote.content}
                    onChange={e => {
                      updateNote(selectedNote.id, { content: e.target.value });
                      autoResizeTextarea(e.currentTarget);
                    }}
                    onKeyDown={e => {
                      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i')) {
                        e.preventDefault();
                        e.stopPropagation();
                        const ta = e.currentTarget;
                        const s = ta.selectionStart;
                        const end = ta.selectionEnd;
                        const sel = selectedNote.content.slice(s, end);
                        const wrap = e.key === 'b' ? '**' : '*';
                        const replacement = wrap + (sel || 'текст') + wrap;
                        const newContent = selectedNote.content.slice(0, s) + replacement + selectedNote.content.slice(end);
                        updateNote(selectedNote.id, { content: newContent });
                        setTimeout(() => { ta.selectionStart = s + wrap.length; ta.selectionEnd = s + wrap.length + (sel || 'текст').length; }, 0);
                      }
                    }}
                    placeholder="Починай писати... (підтримує **bold**, *italic*, # заголовки, - списки)"
                    rows={1}
                    style={{
                      width: '100%', border: 'none', outline: 'none', resize: 'none',
                      padding: showTaskSection ? '0.5rem 1.5rem 0.75rem' : '0.5rem 1.5rem',
                      fontSize: '0.9375rem', lineHeight: 1.8, color: '#374151',
                      background: 'transparent', fontFamily: 'inherit', userSelect: 'text',
                      overflow: 'hidden', minHeight: 56, boxSizing: 'border-box',
                    }}
                  />
                  </>
                  ))}

                  {/* Task section — shown when toggled or tasks exist */}
                  {showTaskSection && (
                    <div style={{
                      borderTop: tasksFull ? 'none' : '1px solid rgba(0,0,0,0.07)',
                      padding: tasksFull ? '1.25rem 1.5rem' : '1rem 1.5rem 1.5rem',
                      background: 'transparent',
                      flexShrink: 0,
                    }}>
                      {/* "Add text" hint when in full-list mode */}
                      {tasksFull && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                          <button
                            onClick={() => setForceShowText(true)}
                            style={{ background: 'none', border: '1px dashed #d1d5db', borderRadius: 20, cursor: 'pointer', padding: '2px 10px', fontSize: '0.6875rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.color = '#2563eb'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#94a3b8'; }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Додати текст
                          </button>
                        </div>
                      )}

                      {/* Progress bar */}
                      {totalTasks > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: '#94a3b8', marginBottom: 6 }}>
                            <span>Прогрес</span>
                            <span style={{ fontWeight: 700, color: doneTasks === totalTasks ? '#22c55e' : '#2563eb' }}>
                              {doneTasks}/{totalTasks}
                            </span>
                          </div>
                          <div style={{ height: 5, background: '#e5e7eb', borderRadius: 5, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${(doneTasks / totalTasks) * 100}%`,
                              background: doneTasks === totalTasks ? '#22c55e' : '#3b82f6',
                              borderRadius: 5, transition: 'width 0.35s ease',
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: '0.4rem 0.375rem', borderRadius: 8, transition: 'background 0.12s' }}
                        onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.03)'; }}
                        onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                      >
                        <div style={{ width: 18, height: 18, borderRadius: 5, border: '2px dashed #d1d5db', flexShrink: 0 }} />
                        <input
                          value={newTaskText}
                          onChange={e => setNewTaskText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addTask(); }}
                          placeholder="Додати пункт..."
                          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9375rem', color: '#374151', userSelect: 'text' }}
                        />
                        {newTaskText.trim() && (
                          <button
                            onClick={addTask}
                            style={{ background: '#2563eb', border: 'none', cursor: 'pointer', color: 'white', padding: '0.3rem 0.75rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700 }}
                          >
                            +
                          </button>
                        )}
                      </div>

                      {totalTasks === 0 && (
                        <div style={{ color: '#d1d5db', fontSize: '0.8125rem', paddingLeft: 28, paddingTop: 4 }}>
                          Додай перший пункт ↑
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Action button helper ───────────────────────────────────────────────────────

function ActionBtn({ children, title, onClick, active, activeColor, hoverColor, hoverBg }: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  activeColor?: string;
  hoverColor?: string;
  hoverBg?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: 8, color: active ? (activeColor ?? '#2563eb') : '#94a3b8', transition: 'all 0.15s', flexShrink: 0 }}
      onMouseEnter={e => {
        e.currentTarget.style.color = active ? (activeColor ?? '#2563eb') : (hoverColor ?? '#374151');
        e.currentTarget.style.background = hoverBg ?? '#f1f5f9';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = active ? (activeColor ?? '#2563eb') : '#94a3b8';
        e.currentTarget.style.background = 'none';
      }}
    >
      {children}
    </button>
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
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.375rem 0.375rem', borderRadius: 8, background: hovered ? 'rgba(0,0,0,0.04)' : 'transparent', transition: 'background 0.12s', cursor: 'default' }}
    >
      {/* Drag handle */}
      <span style={{ cursor: 'grab', opacity: hovered ? 1 : 0, transition: 'opacity 0.12s', flexShrink: 0, lineHeight: 1, display: 'flex' }}>
        <svg width="10" height="14" viewBox="0 0 10 14" fill="#cbd5e1">
          <circle cx="3" cy="2" r="1.5"/><circle cx="7" cy="2" r="1.5"/>
          <circle cx="3" cy="7" r="1.5"/><circle cx="7" cy="7" r="1.5"/>
          <circle cx="3" cy="12" r="1.5"/><circle cx="7" cy="12" r="1.5"/>
        </svg>
      </span>

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
          style={{ flex: 1, border: 'none', borderBottom: '1.5px solid #3b82f6', background: 'transparent', outline: 'none', fontSize: '0.9375rem', color: '#1e293b', padding: '1px 0', userSelect: 'text' }}
        />
      ) : (
        <span
          onClick={startEdit}
          style={{
            flex: 1, fontSize: '0.9375rem', lineHeight: 1.5, cursor: 'text',
            color: task.done ? '#94a3b8' : '#1e293b',
            textDecoration: task.done ? 'line-through' : 'none',
            transition: 'color 0.15s, text-decoration 0.15s',
          }}
        >
          {task.text}
        </span>
      )}

      {/* Delete */}
      <button
        onClick={onDelete}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 3,
          display: 'flex', color: '#cbd5e1', borderRadius: 4,
          opacity: hovered && !editing ? 1 : 0, transition: 'opacity 0.15s, color 0.1s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#cbd5e1'; }}
      >
        <X size={13} />
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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '0.625rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,0.05)', background: bg, alignItems: 'center', minHeight: 40 }}>
      {tags.map(tag => (
        <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 9px', borderRadius: 20, background: '#e0e7ff', fontSize: '0.6875rem', fontWeight: 600, color: '#3730a3' }}>
          #{tag}
          <button onClick={() => onRemove(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#818cf8', lineHeight: 1 }}>
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
          style={{ background: 'none', border: '1px dashed #d1d5db', borderRadius: 20, cursor: 'pointer', padding: '2px 9px', fontSize: '0.6875rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#a5b4fc'; e.currentTarget.style.color = '#4f46e5'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#94a3b8'; }}
        >
          <Plus size={9} strokeWidth={2.5} /> тег
        </button>
      )}
    </div>
  );
}

// ── Searchable dropdown ───────────────────────────────────────────────────────

function SearchableDropdown({ icon, placeholder, items, onSelect, activeBg, activeColor }: {
  icon: string;
  placeholder: string;
  items: { id: number; label: string }[];
  onSelect: (id: number) => void;
  activeBg: string;
  activeColor: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const filtered = query
    ? items.filter(i => i.label.toLowerCase().includes(query.toLowerCase())).slice(0, 30)
    : items.slice(0, 30);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(v => !v); setQuery(''); setTimeout(() => inputRef.current?.focus(), 0); }}
        style={{ background: 'none', border: '1px dashed #d1d5db', borderRadius: 20, cursor: 'pointer', padding: '2px 9px', fontSize: '0.6875rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = activeColor; e.currentTarget.style.color = activeColor; }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#94a3b8'; } }}
      >
        {icon} {placeholder}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, width: 220, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 20, overflow: 'hidden' }}>
          <div style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Пошук..."
              style={{ width: '100%', border: 'none', outline: 'none', fontSize: '0.75rem', color: '#374151', background: 'transparent', userSelect: 'text' }}
            />
          </div>
          <div style={{ maxHeight: 160, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '8px 10px', fontSize: '0.6875rem', color: '#94a3b8' }}>Не знайдено</div>
            ) : filtered.map(item => (
              <button
                key={item.id}
                onClick={() => { onSelect(item.id); setOpen(false); setQuery(''); }}
                style={{ width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#374151', transition: 'background 0.1s', display: 'block' }}
                onMouseEnter={e => { e.currentTarget.style.background = activeBg; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Linked entity row ─────────────────────────────────────────────────────────

function LinkedRow({ studentId, groupId, students, groups, bg, onChangeStudent, onChangeGroup }: {
  studentId: number | null;
  groupId: number | null;
  students: { id: number; name: string }[];
  groups: { id: number; title: string }[];
  bg: string;
  onChangeStudent: (id: number | null) => void;
  onChangeGroup: (id: number | null) => void;
}) {
  const hasLinks = !!studentId || !!groupId;
  const studentName = students.find(s => s.id === studentId)?.name;
  const groupTitle  = groups.find(g => g.id === groupId)?.title;

  if (!hasLinks && students.length === 0 && groups.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '0.625rem 1.5rem', borderBottom: hasLinks ? '1px solid rgba(0,0,0,0.05)' : 'none', background: bg, alignItems: 'center', minHeight: 40 }}>
      {/* Student link */}
      {studentId && studentName ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 9px', borderRadius: 20, background: '#eff6ff', fontSize: '0.6875rem', fontWeight: 600, color: '#2563eb' }}>
          <a href={`/students/${studentId}`} style={{ color: 'inherit', textDecoration: 'none' }} title="Відкрити картку учня"
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none'; }}
          >👤 {studentName}</a>
          <button onClick={() => onChangeStudent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#93c5fd', lineHeight: 1 }}><X size={10} /></button>
        </span>
      ) : students.length > 0 && (
        <SearchableDropdown
          icon="👤"
          placeholder="Учень..."
          items={students.map(s => ({ id: s.id, label: s.name }))}
          onSelect={id => onChangeStudent(id)}
          activeBg="#eff6ff"
          activeColor="#2563eb"
        />
      )}

      {/* Group link */}
      {groupId && groupTitle ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 9px', borderRadius: 20, background: '#f0fdf4', fontSize: '0.6875rem', fontWeight: 600, color: '#16a34a' }}>
          <a href={`/groups/${groupId}`} style={{ color: 'inherit', textDecoration: 'none' }} title="Відкрити групу"
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none'; }}
          >👥 {groupTitle}</a>
          <button onClick={() => onChangeGroup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#86efac', lineHeight: 1 }}><X size={10} /></button>
        </span>
      ) : groups.length > 0 && (
        <SearchableDropdown
          icon="👥"
          placeholder="Група..."
          items={groups.map(g => ({ id: g.id, label: g.title }))}
          onSelect={id => onChangeGroup(id)}
          activeBg="#f0fdf4"
          activeColor="#16a34a"
        />
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

  const undone = tasks.filter(t => !t.done);
  const done   = tasks.filter(t =>  t.done);

  const renderItem = (task: Task) => (
    <div
      key={task.id}
      draggable
      onDragStart={() => onDragStart(task.id)}
      onDragEnter={() => onDragEnter(task.id)}
      onDragOver={e => e.preventDefault()}
      onDragEnd={() => { setDragOver(null); dragId.current = null; }}
      onDrop={onDrop}
      style={{ outline: dragOver === task.id ? '2px solid #3b82f6' : '2px solid transparent', borderRadius: 8, transition: 'outline 0.1s' }}
    >
      <TaskItem
        task={task}
        onToggle={() => onToggle(task.id)}
        onDelete={() => onDelete(task.id)}
        onRename={text => onRename(task.id, text)}
      />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {undone.map(renderItem)}
      {done.length > 0 && undone.length > 0 && (
        <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', padding: '0.5rem 0.375rem 0.25rem', display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          <span>Виконано ({done.length})</span>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        </div>
      )}
      {done.map(renderItem)}
    </div>
  );
}
