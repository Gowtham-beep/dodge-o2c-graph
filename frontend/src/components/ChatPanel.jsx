import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, ChevronDown, ChevronUp } from 'lucide-react';

export default function ChatPanel({ onHighlightNodes }) {
    const [messages, setMessages] = useState([
        {
            role: 'model',
            text: 'Hi! I can help you analyze the Order to Cash process. Try asking: "Which products have the most billing documents?" or "Show me sales orders with broken flows."'
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userText = input.trim();
        setInput('');

        const newMessages = [...messages, { role: 'user', text: userText }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            // get last 6 messages
            const historyMsg = messages.slice(-6).map(m => ({ role: m.role === 'model' ? 'model' : 'user', text: m.text }));

            const response = await axios.post('http://localhost:3001/api/chat', {
                message: userText,
                history: historyMsg
            });

            const data = response.data;

            setMessages(prev => [...prev, {
                role: 'model',
                text: data.answer,
                sql: data.sql,
                results: data.results,
                nodeIds: data.nodeIds
            }]);

            if (data.nodeIds && data.nodeIds.length > 0) {
                onHighlightNodes(data.nodeIds);
            } else {
                onHighlightNodes([]); // clear highlights if no nodes
            }

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, {
                role: 'model',
                text: 'Sorry, I encountered an error communicating with the server.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200">
            {/* Header */}
            <div className="flex flex-col p-4 bg-white border-b border-slate-200">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800">Chat with Graph</h2>
                    <div className={`w-2.5 h-2.5 rounded-full ${isLoading ? 'bg-slate-400 animate-pulse' : 'bg-green-500'}`} title={isLoading ? "Loading..." : "Ready"} />
                </div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-1">Order to Cash</p>
            </div>

            {/* Messages */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <ChatMessage key={idx} message={msg} />
                ))}
                {isLoading && (
                    <div className="flex items-center space-x-1 p-3 bg-white border border-slate-200 rounded-2xl rounded-tl-sm self-start w-16 h-10 shadow-sm">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-200">
                <div className="relative flex items-end bg-slate-50 border border-slate-200 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all overflow-hidden">
                    <textarea
                        className="w-full max-h-32 min-h-[50px] bg-transparent p-3 pr-12 focus:outline-none resize-none text-sm text-slate-700 placeholder-slate-400 leading-relaxed"
                        placeholder="Analyze anything..."
                        rows={2}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 bottom-2 p-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 transition-colors"
                    >
                        <Send size={16} />
                    </button>
                </div>
                <div className="mt-2 text-xs text-center text-slate-400">
                    Press Enter to send, Shift+Enter for newline
                </div>
            </div>
        </div>
    );
}

function ChatMessage({ message }) {
    const isUser = message.role === 'user';
    const [showSql, setShowSql] = useState(false);

    return (
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
            <div
                className={`max-w-[85%] p-3 text-sm leading-relaxed shadow-sm ${isUser
                        ? 'bg-slate-800 text-white rounded-2xl rounded-tr-sm'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-sm'
                    }`}
            >
                <div className="whitespace-pre-wrap">{message.text}</div>

                {message.sql && (
                    <div className="mt-3 pt-2 border-t border-slate-100">
                        <button
                            onClick={() => setShowSql(!showSql)}
                            className="flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            {showSql ? <ChevronUp size={14} className="mr-1" /> : <ChevronDown size={14} className="mr-1" />}
                            {showSql ? 'Hide SQL' : 'Show SQL'}
                        </button>
                        {showSql && (
                            <pre className="mt-2 p-2 bg-slate-50 rounded border border-slate-200 overflow-x-auto text-[11px] font-mono text-slate-700 pb-2">
                                {message.sql}
                            </pre>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
