'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Bot, Trash2, Minimize2 } from 'lucide-react';
import { useChat, UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import ReactMarkdown from 'react-markdown';

const STORAGE_KEY = 'assistant_chat_messages';
const SUGGESTED_QUESTIONS = [
  'Скільки активних учнів?',
  'Хто боржники цього місяця?',
  'Які заняття сьогодні?',
  'Дай короткий підсумок на сьогодні',
  'Покажи ризикових учнів за цей місяць',
  'Покажи загальну статистику',
];

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
};

const getMessageText = (msg: UIMessage) =>
  msg.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');

const getToolPart = (msg: UIMessage) => {
  const toolParts = msg.parts.filter((part) => part.type.startsWith('tool-'));
  return toolParts.length > 0 ? toolParts[toolParts.length - 1] : null;
};

const getToolStatus = (msg: UIMessage) => {
  const currentTool = getToolPart(msg);
  if (!currentTool || !('state' in currentTool) || currentTool.state === 'output-available') {
    return null;
  }

  const toolName = currentTool.type.replace(/^tool-/, '');
  switch (toolName) {
    case 'query_active_students_count': return 'Підраховую учнів...';
    case 'query_students': return 'Шукаю учнів у базі...';
    case 'query_groups': return 'Перевіряю групи...';
    case 'query_student_groups': return 'Перевіряю записи в групах...';
    case 'query_lessons': return 'Шукаю заняття в розкладі...';
    case 'query_today_lessons': return 'Збираю заняття на сьогодні...';
    case 'query_daily_brief': return 'Готую короткий підсумок дня...';
    case 'query_payments': return 'Перевіряю оплати...';
    case 'query_debts': return 'Рахую боржників...';
    case 'query_debts_summary': return 'Підсумовую борги за місяць...';
    case 'query_at_risk_students': return 'Шукаю учнів, які потребують уваги...';
    case 'query_attendance': return 'Обчислюю відвідуваність...';
    case 'query_courses': return 'Шукаю курси...';
    case 'query_teachers': return 'Шукаю викладачів...';
    case 'query_absences': return 'Шукаю учнів з пропусками...';
    case 'query_stats': return 'Збираю загальну статистику...';
    default: return 'Виконую запит до бази даних...';
  }
};

export default function AssistantChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, status, error, setMessages, sendMessage, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/assistant/chat' }),
  });

  // Restore messages from sessionStorage after hydration
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const storage = getStorage();
    if (!storage) return;
    try {
      const saved = storage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as UIMessage[];
        if (parsed.length > 0) setMessages(parsed);
      }
    } catch {
      storage.removeItem(STORAGE_KEY);
    }
  }, [setMessages]);

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    const storage = getStorage();
    if (!storage) return;

    try {
      if (messages.length === 0) {
        storage.removeItem(STORAGE_KEY);
        return;
      }

      storage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
    } catch {
      storage.removeItem(STORAGE_KEY);
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const submitInput = () => {
    const text = input.trim();
    if (!text || isLoading) return;

    sendMessage({ text });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitInput();
    }
  };

  const handleSubmit = (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    submitInput();
  };

  const clearHistory = () => {
    const storage = getStorage();
    stop();
    setMessages([]);
    storage?.removeItem(STORAGE_KEY);
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

  const hasToolCalls = (msg: UIMessage) => Boolean(getToolPart(msg));
  const activeToolStatus = messages.length > 0 ? getToolStatus(messages[messages.length - 1]) : null;

  return (
    <>
      {isOpen && (
        <div
          className={`assistant-chat-window ${isMinimized ? 'assistant-chat-minimized' : ''}`}
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '16px',
            zIndex: 1000,
          }}
        >
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
                  title="Очистити історію"
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

          {!isMinimized && (
            <>
              <div className="assistant-chat-body">
                {messages.length === 0 && !isLoading && (
                  <div className="assistant-chat-welcome">
                    <Bot size={32} className="assistant-chat-welcome-icon" />
                    <p className="assistant-chat-welcome-title">Привіт! Я помічник CRM.</p>
                    <p className="assistant-chat-welcome-subtitle">
                      Запитай мене про учнів, групи, оплати, відвідуваність або коротку статистику.
                    </p>
                    <div className="assistant-chat-suggestions">
                      {SUGGESTED_QUESTIONS.map((question) => (
                        <button
                          key={question}
                          className="assistant-chat-suggestion"
                          onClick={() => {
                            if (!isLoading) {
                              sendMessage({ text: question });
                            }
                          }}
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, index) => {
                  const text = getMessageText(msg);
                  return (
                    <div
                      key={msg.id || index}
                      className={`assistant-chat-message assistant-chat-message-${msg.role}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="assistant-chat-avatar">
                          <Bot size={14} />
                        </div>
                      )}
                      <div className={`assistant-chat-bubble assistant-chat-bubble-${msg.role}`}>
                        {text && (
                          <ReactMarkdown
                            components={{
                              p: ({ ...props }) => <p style={{ margin: '0 0 0.5em 0' }} {...props} />,
                              ul: ({ ...props }) => <ul style={{ paddingLeft: '1.2em', margin: '0.5em 0' }} {...props} />,
                              ol: ({ ...props }) => <ol style={{ paddingLeft: '1.2em', margin: '0.5em 0' }} {...props} />,
                              li: ({ ...props }) => <li style={{ margin: '0.2em 0' }} {...props} />,
                              strong: ({ ...props }) => <strong style={{ fontWeight: 600 }} {...props} />,
                            }}
                          >
                            {text}
                          </ReactMarkdown>
                        )}

                        {hasToolCalls(msg) && getToolStatus(msg) && (
                          <div style={{ fontSize: '0.85em', color: '#a0aec0', fontStyle: 'italic', marginTop: text ? '4px' : '0' }}>
                            {getToolStatus(msg)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

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
                    {error.message || 'Помилка з’єднання'}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSubmit} className="assistant-chat-input-area">
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
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="assistant-chat-send"
                  title="Надіслати"
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      <button
        onClick={toggleOpen}
        className={`assistant-chat-fab ${isOpen ? 'assistant-chat-fab-active' : ''}`}
        title="AI помічник"
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
