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
  'Загальна статистика',
];

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
};

export default function AssistantChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  const getInitialMessages = (): UIMessage[] => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved) as UIMessage[];
    } catch {}
    return [];
  };

  const { messages, status, error, setMessages, sendMessage, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/assistant/chat' }),
    messages: getInitialMessages(),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
      } catch {}
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

  const hasToolCalls = (msg: UIMessage) => Boolean(getToolPart(msg));
  const activeToolStatus = messages.length > 0 ? getToolStatus(messages[messages.length - 1]) : null;

  return (
    <>
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
                          onClick={() => {
                            if (!isLoading) {
                              sendMessage({ text: q });
                            }
                          }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => {
                  const text = getMessageText(msg);
                  return (
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

                        {hasToolCalls(msg) && (
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
                    {error.message || 'Помилка з\'єднання'}
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
