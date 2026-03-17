'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen,
  FileText,
  Image,
  Video,
  Music,
  File,
  Download,
  ExternalLink,
  Search,
  Trash2,
  ChevronLeft,
} from 'lucide-react';

interface Topic {
  id: number;
  thread_id: string;
  name: string;
  file_count: number;
}

interface MediaFile {
  id: number;
  topic_id: number;
  topic_name: string;
  file_name: string;
  file_type: string;
  file_size: number;
  drive_file_id: string;
  drive_view_url: string;
  drive_download_url: string;
  uploaded_by_name: string | null;
  created_at: string;
}

function FileIcon({ type }: { type: string }) {
  const style = { width: 20, height: 20, flexShrink: 0 };
  if (type === 'photo' || type === 'animation') return <Image style={style} color="#3b82f6" />;
  if (type === 'video') return <Video style={style} color="#8b5cf6" />;
  if (type === 'audio' || type === 'voice') return <Music style={style} color="#f59e0b" />;
  if (type === 'document') return <FileText style={style} color="#6b7280" />;
  return <File style={style} color="#6b7280" />;
}

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function MaterialsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadTopics = useCallback(async () => {
    const res = await fetch('/api/media/topics');
    if (res.ok) setTopics(await res.json());
  }, []);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedTopicId) params.set('topic_id', String(selectedTopicId));
    if (search) params.set('search', search);
    const res = await fetch(`/api/media/files?${params}`);
    if (res.ok) {
      const data = await res.json();
      setFiles(data.files);
    }
    setLoading(false);
  }, [selectedTopicId, search]);

  useEffect(() => { loadTopics(); }, [loadTopics]);
  useEffect(() => { loadFiles(); }, [loadFiles]);

  async function renameTopic(id: number, name: string) {
    await fetch('/api/media/topics', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    });
    setEditingTopicId(null);
    loadTopics();
    loadFiles();
  }

  async function deleteFile(id: number) {
    if (!confirm('Видалити файл? Він буде видалений з Google Drive.')) return;
    setDeletingId(id);
    await fetch(`/api/media/files/${id}`, { method: 'DELETE' });
    setDeletingId(null);
    loadFiles();
    loadTopics();
  }

  const selectedTopic = topics.find(t => t.id === selectedTopicId);

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <FolderOpen size={28} color="#3b82f6" />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', margin: 0 }}>Матеріали</h1>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Topics sidebar */}
        <div style={{
          width: 220, flexShrink: 0, background: '#fff',
          borderRadius: 16, border: '1px solid #f0f0f0',
          padding: '12px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', padding: '4px 12px 8px', letterSpacing: '0.05em' }}>
            ТЕМИ
          </div>

          {/* All topics */}
          <button
            onClick={() => setSelectedTopicId(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
              background: selectedTopicId === null ? '#e3f2fd' : 'transparent',
              color: selectedTopicId === null ? '#1565c0' : '#374151',
              fontWeight: selectedTopicId === null ? 600 : 400, fontSize: 14,
            }}
          >
            <FolderOpen size={16} />
            Всі матеріали
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
              {topics.reduce((s, t) => s + t.file_count, 0)}
            </span>
          </button>

          {topics.map(topic => (
            <div key={topic.id} style={{ position: 'relative', group: 'true' } as React.CSSProperties}>
              {editingTopicId === topic.id ? (
                <form
                  onSubmit={e => { e.preventDefault(); renameTopic(topic.id, editingName); }}
                  style={{ padding: '4px 8px' }}
                >
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onBlur={() => setEditingTopicId(null)}
                    style={{
                      width: '100%', padding: '6px 8px', borderRadius: 8,
                      border: '1px solid #3b82f6', fontSize: 13, outline: 'none',
                    }}
                  />
                </form>
              ) : (
                <button
                  onClick={() => setSelectedTopicId(topic.id)}
                  onDoubleClick={() => { setEditingTopicId(topic.id); setEditingName(topic.name); }}
                  title="Двічі клікніть, щоб перейменувати"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: selectedTopicId === topic.id ? '#e3f2fd' : 'transparent',
                    color: selectedTopicId === topic.id ? '#1565c0' : '#374151',
                    fontWeight: selectedTopicId === topic.id ? 600 : 400, fontSize: 14,
                  }}
                >
                  <FolderOpen size={16} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {topic.name}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>{topic.file_count}</span>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Files area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Breadcrumb + search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            {selectedTopic && (
              <button
                onClick={() => setSelectedTopicId(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: 14 }}
              >
                <ChevronLeft size={16} />
                Всі
              </button>
            )}
            <span style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>
              {selectedTopic ? selectedTopic.name : 'Всі матеріали'}
            </span>

            <div style={{ marginLeft: 'auto', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                placeholder="Пошук файлів..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  paddingLeft: 34, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                  borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none', width: 220,
                }}
              />
            </div>
          </div>

          {/* Files list */}
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Завантаження...</div>
          ) : files.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
              <FolderOpen size={48} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
              Файлів немає
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              {files.map((file, i) => (
                <div
                  key={file.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px',
                    borderBottom: i < files.length - 1 ? '1px solid #f8f9fa' : 'none',
                  }}
                >
                  <FileIcon type={file.file_type} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.file_name}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                      {!selectedTopicId && <span style={{ marginRight: 8 }}>{file.topic_name} ·</span>}
                      {file.uploaded_by_name && <span>{file.uploaded_by_name} · </span>}
                      {formatDate(file.created_at)}
                      {file.file_size > 0 && <span> · {formatSize(file.file_size)}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <a
                      href={file.drive_view_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Відкрити"
                      style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: '#eff6ff', color: '#3b82f6', textDecoration: 'none', fontSize: 13, fontWeight: 500, gap: 4 }}
                    >
                      <ExternalLink size={14} />
                      Відкрити
                    </a>
                    <a
                      href={file.drive_download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Завантажити"
                      style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: '#f0fdf4', color: '#16a34a', textDecoration: 'none', fontSize: 13, fontWeight: 500, gap: 4 }}
                    >
                      <Download size={14} />
                    </a>
                    <button
                      onClick={() => deleteFile(file.id)}
                      disabled={deletingId === file.id}
                      title="Видалити"
                      style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: '#fff5f5', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: 13 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
