'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Bot, Trash2, Minimize2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const STORAGE_KEY = 'assistant_chat_messages';
const SUGGESTED_QUESTIONS = [
  'Скільки активних учнів?',
  'Хто боржники цього місяця?',
  'Які заняття сьогодні?',
  'Загальна статистика',
];

export default function AssistantChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  // Load messages from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setMessages(JSON.parse(saved));
      }
    } catch { /* ignore */ }
  }, []);

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
      } catch { /* ignore */ }
    }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Помилка сервера');
        setIsLoading(false);
        return;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch {
      setError('Помилка з\'єднання');
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    setError(null);
  };

  const toggleOpen = () => {
    if (isOpen) {
      setIsOpen(false);
      setIsMinimized(false);
    } else {
      setIsOpen(true);
      setIsMinimized(false);
    }
  };

  // Simple markdown-like formatting
  const formatMessage = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <>
      {/* Chat window */}
      {isOpen && (
        <div
          className={`assistant-chat-window ${isMinimized ? 'assistant-chat-minimized' : ''}`}
          style={{
            position: 'fixed',
            bottom: isMinimized ? '80px' : '80px',
            right: '16px',
            zIndex: 1000,
          }}
        >
          {/* Header */}
          <div className="assistant-chat-header" onClick={() => isMinimized && setIsMinimized(false)}>
            <div className="assistant-chat-header-left">
              <Bot size={18} />
              <span>Помічник</span>
            </div>
            <div className="assistant-chat-header-actions">
              {messages.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); clearHistory(); }}
                  className="assistant-chat-header-btn"
                  title="Очистити"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                className="assistant-chat-header-btn"
                title="Згорнути"
              >
                <Minimize2 size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleOpen(); }}
                className="assistant-chat-header-btn"
                title="Закрити"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Body */}
          {!isMinimized && (
            <>
              <div className="assistant-chat-body" ref={chatBodyRef}>
                {messages.length === 0 && !isLoading && (
                  <div className="assistant-chat-welcome">
                    <Bot size={32} className="assistant-chat-welcome-icon" />
                    <p className="assistant-chat-welcome-title">Привіт! Я помічник CRM.</p>
                    <p className="assistant-chat-welcome-subtitle">
                      Запитай мене про учнів, групи, оплати, відвідуваність або статистику.
                    </p>
                    <div className="assistant-chat-suggestions">
                      {SUGGESTED_QUESTIONS.map((q, i) => (
                        <button
                          key={i}
                          className="assistant-chat-suggestion"
                          onClick={() => sendMessage(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`assistant-chat-message assistant-chat-message-${msg.role}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="assistant-chat-avatar">
                        <Bot size={14} />
                      </div>
                    )}
                    <div
                      className={`assistant-chat-bubble assistant-chat-bubble-${msg.role}`}
                      dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                    />
                  </div>
                ))}

                {isLoading && (
                  <div className="assistant-chat-message assistant-chat-message-assistant">
                    <div className="assistant-chat-avatar">
                      <Bot size={14} />
                    </div>
                    <div className="assistant-chat-bubble assistant-chat-bubble-assistant">
                      <div className="assistant-chat-typing">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="assistant-chat-error">{error}</div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="assistant-chat-input-area">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Напишіть запитання..."
                  className="assistant-chat-input"
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  className="assistant-chat-send"
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={toggleOpen}
        className={`assistant-chat-fab ${isOpen ? 'assistant-chat-fab-active' : ''}`}
        title="AI Помічник"
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          zIndex: 1001,
        }}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  );
}
