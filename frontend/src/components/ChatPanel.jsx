import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import axios from 'axios';
import { Send, ChevronDown, ChevronUp } from 'lucide-react';

const NODE_COLORS = {
    SalesOrder: '#3B82F6',
    BusinessPartner: '#8B5CF6',
    OutboundDelivery: '#10B981',
    BillingDocument: '#F59E0B',
    JournalEntry: '#EF4444',
    Payment: '#06B6D4',
    Product: '#F97316',
    Plant: '#6B7280',
};

const ChatPanel = forwardRef(({ onHighlightNodes, graphNodes }, ref) => {
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

    const sendQuery = async (userText) => {
        if (!userText.trim() || isLoading) return;

        const newMessages = [...messages, { role: 'user', text: userText }];
        setMessages(newMessages);
        setIsLoading(true);
        onHighlightNodes([]);

        // Add empty assistant message that we'll fill in
        const assistantMsgId = Date.now();
        setMessages(prev => [...prev, {
            id: assistantMsgId,
            role: 'model',
            text: '',
            sql: null,
            isStreaming: true,
            results: [],
            nodeIds: []
        }]);

        try {
            const historyMsg = messages
                .filter(m => m.role !== 'model' || messages.indexOf(m) !== 0) // exclude welcome message
                .slice(-8) // last 8 messages
                .map(m => ({
                    role: m.role,
                    text: m.role === 'model' && m.sql
                        ? `${m.text}\n[SQL used: ${m.sql}]`
                        : m.text
                }));

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userText,
                    history: historyMsg
                })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop(); // keep incomplete chunk

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const event = JSON.parse(line.slice(6));

                        if (event.type === 'sql') {
                            setMessages(prev => prev.map(m =>
                                m.id === assistantMsgId
                                    ? { ...m, sql: event.sql }
                                    : m
                            ));
                        }

                        if (event.type === 'token') {
                            setMessages(prev => prev.map(m =>
                                m.id === assistantMsgId
                                    ? { ...m, text: m.text + event.content }
                                    : m
                            ));
                        }

                        if (event.type === 'done') {
                            setMessages(prev => prev.map(m =>
                                m.id === assistantMsgId
                                    ? { ...m, isStreaming: false, nodeIds: event.nodeIds || [] }
                                    : m
                            ));
                            if (event.nodeIds?.length > 0) {
                                onHighlightNodes(event.nodeIds);
                            }
                        }
                    } catch (e) { }
                }
            }
        } catch (error) {
            console.error(error);
            setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                    ? {
                        ...m,
                        text: 'Sorry, I encountered an error communicating with the server.\n' + error.message,
                        isStreaming: false
                    }
                    : m
            ));
        } finally {
            setIsLoading(false);
        }
    };


    useImperativeHandle(ref, () => ({
        sendMessage: (msg) => {
            sendQuery(msg);
        }
    }));

    const handleSend = () => {
        sendQuery(input);
        setInput('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200">
            <div className="flex flex-col p-4 bg-white border-b border-slate-200">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800">Chat with Graph</h2>
                    <div className={`w-2.5 h-2.5 rounded-full ${isLoading ? 'bg-slate-400 animate-pulse' : 'bg-green-500'}`} title={isLoading ? "Loading..." : "Ready"} />
                </div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-1">Order to Cash</p>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <ChatMessage key={idx} message={msg} graphNodes={graphNodes} />
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
});

function ChatMessage({ message, graphNodes }) {
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
                <div className="whitespace-pre-wrap">
                    {message.text}
                    {message.isStreaming && (
                        <span style={{
                            display: 'inline-block',
                            width: '2px',
                            height: '14px',
                            background: '#64748b',
                            marginLeft: '2px',
                            animation: 'blink 1s infinite'
                        }} />
                    )}
                </div>

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

            {!isUser && message.nodeIds && message.nodeIds.length > 0 && graphNodes && (
                <div className="mt-2 w-full max-w-[95%]">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                        Referenced Entities
                    </div>
                    <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-thin scrollbar-thumb-slate-300 hide-scrollbar-on-mobile">
                        {message.nodeIds.slice(0, 6).map(id => {
                            const node = graphNodes.find(n => n.id === id);
                            if (!node) return null;
                            const color = NODE_COLORS[node.data.nodeType] || '#CBD5E1';
                            return (
                                <div key={id} style={{
                                    minWidth: 160,
                                    border: `1px solid ${color}`,
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    fontSize: 11,
                                    backgroundColor: 'white',
                                    flexShrink: 0
                                }}>
                                    <div style={{
                                        color: color,
                                        fontWeight: 700,
                                        fontSize: 10,
                                        textTransform: 'uppercase'
                                    }}>
                                        {node.data.nodeType}
                                    </div>
                                    <div style={{ fontWeight: 600, marginTop: 2, color: '#1e293b', paddingBottom: 4 }}>
                                        {node.data.label}
                                    </div>
                                    {Object.entries(node.data.meta || {})
                                        .slice(0, 3)
                                        .map(([k, v]) => (
                                            <div key={k} style={{ color: '#6b7280', fontSize: 10, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {k}: {v}
                                            </div>
                                        ))
                                    }
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatPanel;
