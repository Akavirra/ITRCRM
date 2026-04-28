'use client';

import {
  ChangeEvent,
  ClipboardEvent,
  KeyboardEvent,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

interface Props {
  /** Контрольоване значення (рядок цифр довжиною ≤ length). */
  value: string;
  onChange: (value: string) => void;
  /** Кількість cells (за замовчуванням 6). */
  length?: number;
  /** Викликається коли всі cells заповнені — зручно для автосабміту. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
  /**
   * Counter, що інкрементується ззовні при кожній помилці. Будь-яка зміна цього
   * числа запускає shake-анімацію + danger tint на ~380мс.
   */
  errorTrigger?: number;
}

export interface PinInputHandle {
  focus: () => void;
  clear: () => void;
}

/**
 * OTP-style PIN-поле: N окремих квадратиків (за замовчуванням 6).
 *
 * Поведінка:
 *   - Введення цифри → автофокус на наступну cell.
 *   - Backspace на порожній cell → focus повертається назад і стирає її.
 *   - ←/→ — переміщення між cells.
 *   - Paste «123456» → розкладається по cells і фокусується на останній або
 *     на першій порожній.
 *   - autocomplete="one-time-code" → iOS Safari пропонує авто-вставку SMS-коду.
 */
const PinInput = forwardRef<PinInputHandle, Props>(function PinInput(
  {
    value,
    onChange,
    length = 6,
    onComplete,
    disabled = false,
    autoFocus = false,
    ariaLabel = 'PIN-код',
    errorTrigger,
  },
  ref,
) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const [shaking, setShaking] = useState(false);

  const digits = useMemo(() => {
    const arr = Array.from({ length }, (_, i) => value[i] ?? '');
    return arr;
  }, [value, length]);

  // Запускаємо shake коли батько інкрементує errorTrigger.
  useEffect(() => {
    if (!errorTrigger) return;
    setShaking(true);
    const t = window.setTimeout(() => setShaking(false), 400);
    return () => window.clearTimeout(t);
  }, [errorTrigger]);

  useImperativeHandle(ref, () => ({
    focus: () => inputs.current[0]?.focus(),
    clear: () => {
      onChange('');
      inputs.current[0]?.focus();
    },
  }));

  useEffect(() => {
    if (autoFocus) {
      inputs.current[0]?.focus();
    }
  }, [autoFocus]);

  function update(idx: number, digit: string) {
    const next = digits.slice();
    next[idx] = digit;
    const joined = next.join('').replace(/\D/g, '').slice(0, length);
    onChange(joined);
    if (joined.length === length && onComplete) {
      onComplete(joined);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>, idx: number) {
    const raw = e.target.value;
    // Якщо ввели більше одного символа (paste у одну cell або swap),
    // обробляємо як вставку від поточного індексу.
    if (raw.length > 1) {
      handlePasteText(raw, idx);
      return;
    }
    const onlyDigit = raw.replace(/\D/g, '');
    if (!onlyDigit) {
      // Якщо очистили cell — просто оновлюємо
      update(idx, '');
      return;
    }
    update(idx, onlyDigit);
    if (idx < length - 1) {
      inputs.current[idx + 1]?.focus();
      inputs.current[idx + 1]?.select?.();
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        // Поточна cell заповнена — стандартна поведінка стирання.
        return;
      }
      // Порожня cell → стираємо попередню і фокусуємось на ній.
      e.preventDefault();
      if (idx > 0) {
        update(idx - 1, '');
        inputs.current[idx - 1]?.focus();
      }
      return;
    }
    if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      inputs.current[idx - 1]?.focus();
      inputs.current[idx - 1]?.select?.();
      return;
    }
    if (e.key === 'ArrowRight' && idx < length - 1) {
      e.preventDefault();
      inputs.current[idx + 1]?.focus();
      inputs.current[idx + 1]?.select?.();
      return;
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>, idx: number) {
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;
    e.preventDefault();
    handlePasteText(pasted, idx);
  }

  function handlePasteText(text: string, startIdx: number) {
    const onlyDigits = text.replace(/\D/g, '');
    if (!onlyDigits) return;
    const next = digits.slice();
    for (let i = 0; i < onlyDigits.length && startIdx + i < length; i++) {
      next[startIdx + i] = onlyDigits[i]!;
    }
    const joined = next.join('').slice(0, length);
    onChange(joined);
    const focusIdx = Math.min(startIdx + onlyDigits.length, length - 1);
    inputs.current[focusIdx]?.focus();
    if (joined.length === length && onComplete) {
      onComplete(joined);
    }
  }

  return (
    <div
      className={'student-pin-cells' + (shaking ? ' student-pin-cells--error' : '')}
      role="group"
      aria-label={ariaLabel}
    >
      {digits.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputs.current[idx] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(e, idx)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          onPaste={(e) => handlePaste(e, idx)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          autoComplete={idx === 0 ? 'one-time-code' : 'off'}
          aria-label={`Цифра ${idx + 1} з ${length}`}
          className={
            'student-pin-cell' + (digit ? ' student-pin-cell--filled' : '')
          }
        />
      ))}
    </div>
  );
});

export default PinInput;
