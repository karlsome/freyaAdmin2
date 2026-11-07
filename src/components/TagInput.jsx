import React, { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

export default function TagInput({ 
  label, 
  tags = [], 
  setTags, 
  onAdd, 
  onRemove, 
  onChange,
  suggestions = [], 
  placeholder = "Type and press enter...",
  className = "",
  tagClassName = "",
  uppercase = false,
  // Render the suggestion list on document.body so scrollable/overflow parents (e.g. modals) do not clip it
  portal = false,
}) {
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [menuRect, setMenuRect] = useState(null);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const fieldRef = useRef(null);

  const safeTags = Array.isArray(tags) ? tags : [];

  // Portal mode: keep the floating list anchored under the field (follows scroll / resize / tag wrapping)
  useLayoutEffect(() => {
    if (!portal || !isFocused) return undefined;
    const update = () => {
      const el = fieldRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuRect({ left: rect.left, width: rect.width, top: rect.bottom + 4 });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [portal, isFocused, safeTags.length, inputValue]);

  const addTag = (tag) => {
    let trimmed = (tag || "").trim();
    if (uppercase) trimmed = trimmed.toUpperCase();
    if (trimmed && !safeTags.includes(trimmed)) {
      if (onAdd) {
        onAdd(trimmed);
      }
      if (onChange) {
        onChange([...safeTags, trimmed]);
      }
      if (setTags) {
        setTags([...safeTags, trimmed]);
      }
    }
    setInputValue("");
  };

  const removeTag = (indexToRemove) => {
    const tagToRemove = safeTags[indexToRemove];
    const newTags = safeTags.filter((_, index) => index !== indexToRemove);
    if (onRemove) {
      onRemove(tagToRemove, indexToRemove);
    }
    if (onChange) {
      onChange(newTags);
    }
    if (setTags) {
      setTags(newTags);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && safeTags.length > 0) {
      removeTag(safeTags.length - 1);
    }
  };

  const filteredSuggestions = suggestions.filter(
    (s) => s.toLowerCase().includes(inputValue.toLowerCase()) && !safeTags.includes(s)
  );

  const showMenu = isFocused && (filteredSuggestions.length > 0 || (inputValue.trim() && !safeTags.includes(inputValue.trim())));

  const menu = showMenu ? (
    <ul
      className={portal
        ? "fixed z-[1000] max-h-64 overflow-y-auto rounded-xl border border-outline-variant/30 bg-[var(--surface-raised,var(--surface))] py-1 shadow-xl"
        : "absolute left-0 right-0 top-[100%] z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface py-1 shadow-xl"}
      style={portal && menuRect ? { left: menuRect.left, width: menuRect.width, top: menuRect.top } : undefined}
    >
      {inputValue.trim() && !safeTags.includes(inputValue.trim()) && !filteredSuggestions.includes(inputValue.trim()) && (
        <li 
          className="cursor-pointer px-4 py-2 text-sm text-on-surface hover:bg-surface-container-high flex items-center gap-2 font-medium"
          onMouseDown={(e) => {
            e.preventDefault();
            addTag(inputValue);
            inputRef.current?.focus();
          }}
        >
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>add</span>
          Add "{inputValue.trim()}"
        </li>
      )}
      {filteredSuggestions.map((suggestion, index) => (
        <li
          key={index}
          className="cursor-pointer px-4 py-2 text-sm text-on-surface hover:bg-surface-container-high font-medium"
          onMouseDown={(e) => {
            e.preventDefault();
            addTag(suggestion);
            inputRef.current?.focus();
          }}
        >
          {suggestion}
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <div className={`relative flex flex-col ${className}`} ref={wrapperRef}>
      {label && <label className="mb-1 block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">{label}</label>}
      <div 
        ref={fieldRef}
        className="flex min-h-[38px] flex-wrap items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface px-3 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary cursor-text"
        onMouseDown={(e) => {
          // Clicking tags / padding must not blur the input (which would close the list); focus it instead
          if (e.target !== inputRef.current) e.preventDefault();
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {safeTags.map((tag, index) => (
          <span 
            key={index} 
            className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${tagClassName || "bg-primary/10 text-primary"}`}
          >
            {tag}
            <button 
              type="button" 
              onClick={(e) => {
                e.stopPropagation();
                removeTag(index);
              }}
              className="flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition cursor-pointer"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="flex-1 min-w-[80px] bg-transparent text-sm text-on-surface placeholder-on-surface-variant/50 outline-none"
          placeholder={safeTags.length === 0 ? placeholder : ""}
        />
      </div>

      {portal ? (menu && menuRect ? createPortal(menu, document.body) : null) : menu}
    </div>
  );
}
