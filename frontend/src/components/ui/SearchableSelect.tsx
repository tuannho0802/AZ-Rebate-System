'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { cx } from './primitives';

export interface SearchableSelectOption {
  id: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
  tag?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  loading?: boolean;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * SearchableSelect — combobox tìm-kiếm-và-chọn, dùng thay thế mọi input
 * text nhập UUID thủ công.
 *
 * - Gõ để lọc theo label/sublabel (client-side).
 * - Hiển thị label (tên/email), KHÔNG BAO GIỜ hiện id trong UI.
 * - Tag nhỏ bên phải mỗi option (role, level...).
 * - Bàn phím: ↑/↓ để di chuyển, Enter để chọn, Esc để đóng.
 *
 * // TODO: cần endpoint search phía backend khi số lượng user/asset lớn (>100).
 * Hiện tại dùng client-side filter trên danh sách đã tải.
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Tìm kiếm...',
  loading = false,
  emptyMessage = 'Không tìm thấy kết quả',
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Resolve selected value to display label
  const selectedOption = options.find((o) => o.id === value);

  // Client-side filter
  const filtered = options.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.label.toLowerCase().includes(q) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );
  });

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [search]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-option]');
    const item = items[highlightIndex] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex, isOpen]);

  const select = useCallback(
    (id: string) => {
      onChange(id);
      setIsOpen(false);
      setSearch('');
    },
    [onChange],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const enabledFiltered = filtered.filter((o) => !o.disabled);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filtered[highlightIndex] && !filtered[highlightIndex].disabled) {
        select(filtered[highlightIndex].id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearch('');
      inputRef.current?.blur();
    }
  };

  const fieldBase =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 ' +
    'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400 transition-shadow';

  return (
    <div ref={containerRef} className={cx('relative', className)}>
      {/* Input / Display */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className={fieldBase}
          placeholder={selectedOption ? undefined : placeholder}
          value={isOpen ? search : selectedOption?.label ?? ''}
          disabled={disabled}
          readOnly={!isOpen}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearch('');
          }}
          onKeyDown={handleKeyDown}
        />
        {/* Clear button */}
        {value && !disabled && (
          <button
            type="button"
            className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm p-0.5"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setSearch('');
              inputRef.current?.focus();
            }}
            tabIndex={-1}
          >
            ✕
          </button>
        )}
        {/* Chevron */}
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">
          ▼
        </span>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg"
        >
          {loading ? (
            <li className="px-3 py-3 text-sm text-slate-400 text-center">Đang tải...</li>
          ) : filtered.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-400 text-center">{emptyMessage}</li>
          ) : (
            filtered.map((option, idx) => (
              <li
                key={option.id}
                data-option
                className={cx(
                  'px-3 py-2 text-sm cursor-pointer flex items-center justify-between gap-2 transition-colors',
                  idx === highlightIndex && 'bg-indigo-50',
                  option.disabled && 'opacity-40 cursor-not-allowed',
                  !option.disabled && idx !== highlightIndex && 'hover:bg-slate-50',
                )}
                onClick={() => !option.disabled && select(option.id)}
                onMouseEnter={() => setHighlightIndex(idx)}
              >
                <div className="min-w-0 flex-1">
                  <span className="text-slate-900 font-medium truncate block">
                    {option.label}
                  </span>
                  {option.sublabel && (
                    <span className="text-xs text-slate-400 truncate block">
                      {option.sublabel}
                    </span>
                  )}
                </div>
                {option.tag && (
                  <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                    {option.tag}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
