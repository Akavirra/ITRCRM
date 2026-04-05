'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, User, Users, BookOpen, GraduationCap, ArrowRight, SearchX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import styles from './GlobalSearch.module.css';

interface SearchResult {
  id: number;
  public_id?: string;
  title: string;
  subtitle: string;
  type: 'student' | 'group' | 'course' | 'teacher';
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; iconClass: string; page: string }> = {
  student:  { label: 'Учні',      icon: <User size={16} />,           iconClass: styles.student ?? 'student',  page: '/students' },
  group:    { label: 'Групи',     icon: <Users size={16} />,          iconClass: styles.group ?? 'group',      page: '/groups' },
  course:   { label: 'Курси',     icon: <BookOpen size={16} />,       iconClass: styles.course ?? 'course',    page: '/courses' },
  teacher:  { label: 'Викладачі', icon: <GraduationCap size={16} />,  iconClass: styles.teacher ?? 'teacher',  page: '/teachers' },
};

const CATEGORY_ORDER: string[] = ['student', 'group', 'course', 'teacher'];

export default function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setHasSearched(false);
      setActiveIndex(-1);
      // Small delay to let animation start
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Search with debounce
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        console.error('Search error:', e);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setHasSearched(true);
      }
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setActiveIndex(-1);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => doSearch(val.trim()), 250);
  };

  // Navigate to result
  const navigateToResult = useCallback((result: SearchResult) => {
    const meta = CATEGORY_META[result.type];
    if (!meta) return;

    onClose();

    // Navigate to the page
    router.push(meta.page);

    // Dispatch custom event to open the entity modal
    setTimeout(() => {
      const eventName = `itrobot-open-${result.type}`;
      window.dispatchEvent(new CustomEvent(eventName, {
        detail: { id: result.id, publicId: result.public_id },
      }));
    }, 300);
  }, [onClose, router]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, results.length - 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, -1));
      return;
    }

    if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < results.length) {
      e.preventDefault();
      navigateToResult(results[activeIndex]);
    }
  };

  // Close on backdrop click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Group results by type
  const grouped = CATEGORY_ORDER
    .map(type => ({
      type,
      items: results.filter(r => r.type === type),
    }))
    .filter(g => g.items.length > 0);

  // Compute flat index for keyboard navigation
  let flatIndex = 0;

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-label="Пошук">
      <div className={styles.modal}>
        {/* Input */}
        <div className={styles.inputArea}>
          <Search size={20} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Пошук учнів, груп, курсів, викладачів..."
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className={styles.escHint}>Esc</kbd>
        </div>

        {/* Results */}
        <div className={styles.results}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              Пошук...
            </div>
          )}

          {!loading && hasSearched && results.length === 0 && (
            <div className={styles.empty}>
              <SearchX size={32} className={styles.emptyIcon} />
              <div className={styles.emptyText}>Нічого не знайдено</div>
              <div className={styles.emptyHint}>Спробуйте інший запит</div>
            </div>
          )}

          {!loading && grouped.map(group => {
            const meta = CATEGORY_META[group.type];
            return (
              <div key={group.type} className={styles.category}>
                <div className={styles.categoryLabel}>
                  {meta.icon}
                  {meta.label}
                </div>
                {group.items.map(item => {
                  const thisIndex = flatIndex++;
                  const isActive = thisIndex === activeIndex;
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
                      onClick={() => navigateToResult(item)}
                      onMouseEnter={() => setActiveIndex(thisIndex)}
                    >
                      <div className={`${styles.itemIcon} ${meta.iconClass}`}>
                        {meta.icon}
                      </div>
                      <div className={styles.itemContent}>
                        <div className={styles.itemTitle}>{item.title}</div>
                        <div className={styles.itemSubtitle}>{item.subtitle}</div>
                      </div>
                      <ArrowRight size={14} className={styles.itemArrow} />
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer with hints */}
        <div className={styles.footer}>
          <span><kbd className={styles.footerKey}>↑</kbd><kbd className={styles.footerKey}>↓</kbd> навігація</span>
          <span><kbd className={styles.footerKey}>↵</kbd> відкрити</span>
          <span><kbd className={styles.footerKey}>Esc</kbd> закрити</span>
        </div>
      </div>
    </div>
  );
}
