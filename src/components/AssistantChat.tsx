'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Trash2, Minimize2 } from 'lucide-react';
import { useChat, Message } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';

const STORAGE_KEY = 'assistant_chat_messages';
const SUGGESTED_QUESTIONS = [
  'Скільки активних учнів?',
  'Хто боржники цього місяця?',
  'Які заняття сьогодні?',
  'Загальна статистика',
];

// Helper to get friendly tool status
const getToolStatus = (msg: Message) => {
  if (!msg.toolInvocations || msg.toolInvocations.length === 0) return null;
  const currentTool = msg.toolInvocations[msg.toolInvocations.length - 1]; // get the latest
  if (currentTool.state !== 'result') {
    switch (currentTool.toolName) {
      case 'query_students': return 'Шукаю учнів у базі...';
      case 'query_groups': return 'Перевіряю групи...';
      case 'query_student_groups': return 'Перевіряю записи в групах...';
      case 'query_lessons': return 'Шукаю заняття в розкладі...';
      case 'query_payments': return 'Перевіряю оплати...';
      case 'query_debts': return 'Рахую боржників...';
      case 'query_attendance': return 'Обчислюю відвідуваність...';
      case 'query_courses': return 'Шукаю курси...';
      case 'query_teachers': return 'Шукаю викладачів...';
      case 'query_absences': return 'Шукаю учнів з пропусками...';
      case 'query_stats': return 'Збираю загальну статистику...';
      default: return 'Виконую запит до бази даних...';
    }
  }
  return null;
};

export default function AssistantChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  // Load initial messages from localStorage
  const getInitialMessages = (): Message[] => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return [];
  };

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setMessages,
    append,
    stop,
  } = useChat({
    api: '/api/assistant/chat',
    initialMessages: getInitialMessages(),
    maxSteps: 5,
  });

  // Save messages to localStorage and auto-scroll
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
      } catch { /* ignore */ }
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const event = new Event('submit', { cancelable: true });
      handleSubmit(event as any);
    }
  };

  const clearHistory = () => {
    stop();
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
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

  const hasToolCalls = (msg: Message) => {
    return msg.toolInvocations && msg.toolInvocations.length > 0;
  };

  const activeToolStatus = messages.length > 0 ? getToolStatus(messages[messages.length - 1]) : null;

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
                          onClick={() => append({ role: 'user', content: q })}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={msg.id || i}
                    className={`assistant-chat-message assistant-chat-message-${msg.role}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="assistant-chat-avatar">
                        <Bot size={14} />
                      </div>
                    )}
                    <div className={`assistant-chat-bubble assistant-chat-bubble-${msg.role}`}>
                      {msg.content && (
                        <ReactMarkdown 
                          components={{
                            p: ({...props}) => <p style={{ margin: '0 0 0.5em 0', lastChild: { margin: 0 } }} {...props} />,
                            ul: ({...props}) => <ul style={{ paddingLeft: '1.2em', margin: '0.5em 0' }} {...props} />,
                            ol: ({...props}) => <ol style={{ paddingLeft: '1.2em', margin: '0.5em 0' }} {...props} />,
                            li: ({...props}) => <li style={{ margin: '0.2em 0' }} {...props} />,
                            strong: ({...props}) => <strong style={{ fontWeight: 600 }} {...props} />,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                      
                      {hasToolCalls(msg) && (
                        <div style={{ fontSize: '0.85em', color: '#a0aec0', fontStyle: 'italic', marginTop: msg.content ? '4px' : '0' }}>
                          {getToolStatus(msg)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && messages[messages.length - 1]?.role === 'user' && !activeToolStatus && (
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
                  <div className="assistant-chat-error">
                    {error.message || 'Помилка з\'єднання'}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} className="assistant-chat-input-area">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Напишіть запитання..."
                  className="assistant-chat-input"
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="assistant-chat-send"
                >
                  <Send size={16} />
                </button>
              </form>
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
