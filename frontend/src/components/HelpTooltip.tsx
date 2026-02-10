'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface HelpTooltipProps {
  text: string;
  className?: string;
  size?: 'sm' | 'md';
  inline?: boolean;
}

export default function HelpTooltip({
  text,
  className = '',
  size = 'sm',
  inline = true,
}: HelpTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<'above' | 'below'>('above');
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const circle = size === 'sm' ? 'w-[14px] h-[14px]' : 'w-[18px] h-[18px]';
  const fontSize = size === 'sm' ? 'text-[9px]' : 'text-[11px]';

  const show = useCallback(() => {
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }

    // Determine positioning based on available space
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      // If less than 80px above the icon, show tooltip below instead
      setPosition(rect.top < 80 ? 'below' : 'above');
    }

    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    // Small delay so the user can move the cursor from icon to tooltip
    hideTimeout.current = setTimeout(() => {
      setVisible(false);
    }, 120);
  }, []);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, []);

  return (
    <span
      ref={wrapperRef}
      className={`${inline ? 'inline-flex' : 'flex'} items-center relative ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {/* Question mark icon */}
      <span
        className={`
          ${circle} ${fontSize}
          inline-flex items-center justify-center shrink-0
          rounded-full cursor-help select-none
          border border-slate-300 dark:border-slate-600
          text-slate-400 dark:text-slate-500
          hover:border-slate-400 dark:hover:border-slate-500
          hover:text-slate-500 dark:hover:text-slate-400
          transition-colors duration-150
          leading-none font-semibold
        `}
        role="img"
        aria-label="help"
        tabIndex={0}
      >
        ?
      </span>

      {/* Tooltip bubble */}
      <span
        className={`
          absolute z-50 pointer-events-none
          ${visible ? 'opacity-100 pointer-events-auto' : 'opacity-0'}
          transition-opacity duration-200 ease-out
          ${position === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'}
          start-1/2 -translate-x-1/2
        `}
        role="tooltip"
        aria-hidden={!visible}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        <span
          className="
            block w-max max-w-[250px]
            px-3 py-2 rounded-lg
            bg-slate-800 dark:bg-slate-700
            text-white text-xs leading-relaxed
            font-normal text-start
            shadow-lg
            whitespace-normal break-words
          "
        >
          {text}
        </span>

        {/* Arrow triangle */}
        <span
          className={`
            absolute start-1/2 -translate-x-1/2
            w-0 h-0
            border-x-[5px] border-x-transparent
            ${position === 'above'
              ? 'top-full border-t-[5px] border-t-slate-800 dark:border-t-slate-700'
              : 'bottom-full border-b-[5px] border-b-slate-800 dark:border-b-slate-700'
            }
          `}
        />
      </span>
    </span>
  );
}
