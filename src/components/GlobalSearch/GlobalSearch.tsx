'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Users, BookOpen, GraduationCap, ArrowRight, SearchX } from 'lucide-react';
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
  query: string;
  inputFocused: boolean;
  onClose: () => void;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; iconClass: string; page: string }> = {
  student:  { label: 'Учні',      icon: <User size={16} />,           iconClass: 'student',  page: '/students' },
  group:    { label: 'Групи',     icon: <Users size={16} />,          iconClass: 'group',    page: '/groups' },
  course:   { label: 'Курси',     icon: <BookOpen size={16} />,       iconClass: 'course',   page: '/courses' },
  teacher:  { label: 'Викладачі', icon: <GraduationCap size={16} />,  iconClass: 'teacher',  page: '/teachers' },
};

const CATEGORY_ORDER: string[] = ['student', 'group', 'course', 'teacher'];

export default function GlobalSearch({ query, inputFocused, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  // Search when query changes
  useEffect(() => {
    setActiveIndex(-1);
    clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
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
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        // Check if the click target is the search input (parent handles that)
        const searchInput = document.getElementById('global-search-input');
        if (searchInput && searchInput.contains(e.target as Node)) return;
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Navigate to result
  const navigateToResult = useCallback((result: SearchResult) => {
    const meta = CATEGORY_META[result.type];
    if (!meta) return;
    onClose();
    router.push(meta.page);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(`itrobot-open-${result.type}`, {
        detail: { id: result.id, publicId: result.public_id },
      }));
    }, 300);
  }, [onClose, router]);

  // Keyboard navigation (called from parent)
  useEffect(() => {
    if (!inputFocused) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault();
        navigateToResult(results[activeIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [inputFocused, results, activeIndex, navigateToResult, onClose]);

  // Don't render if nothing to show
  const showDropdown = inputFocused && query.trim().length >= 2;
  if (!showDropdown) return null;

  // Group results by type
  const grouped = CATEGORY_ORDER
    .map(type => ({
      type,
      items: results.filter(r => r.type === type),
    }))
    .filter(g => g.items.length > 0);

  let flatIndex = 0;

  return (
    <div ref={dropdownRef} className={styles.dropdown}>
      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          Пошук...
        </div>
      )}

      {!loading && hasSearched && results.length === 0 && (
        <div className={styles.empty}>
          <SearchX size={24} className={styles.emptyIcon} />
          <div className={styles.emptyText}>Нічого не знайдено</div>
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
                  <div className={`${styles.itemIcon} ${styles[meta.iconClass] || ''}`}>
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
  );
}
