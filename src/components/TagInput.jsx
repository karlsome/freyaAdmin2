import React, { useState, useRef, useEffect } from "react";

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
  uppercase = false
}) {
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);

  const safeTags = Array.isArray(tags) ? tags : [];

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  return (
    <div className={`relative flex flex-col ${className}`} ref={wrapperRef}>
      {label && <label className="mb-1 block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">{label}</label>}
      <div 
        className="flex min-h-[38px] flex-wrap items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface px-3 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary cursor-text"
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
          className="flex-1 min-w-[80px] bg-transparent text-sm text-on-surface placeholder-on-surface-variant/50 outline-none"
          placeholder={safeTags.length === 0 ? placeholder : ""}
        />
      </div>

      {isFocused && (filteredSuggestions.length > 0 || (inputValue.trim() && !safeTags.includes(inputValue.trim()))) && (
        <ul className="absolute left-0 right-0 top-[100%] z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface py-1 shadow-xl">
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
      )}
    </div>
  );
}
