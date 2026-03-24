import { useState } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function App() {
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! I'm the SAP O2C Graph Assistant.", sender: 'bot' }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { id: Date.now(), text: input, sender: 'user' }]);
    setInput('');
    // Placeholder for LLM integration
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now() + 1, text: "I'll help you visualize that soon.", sender: 'bot' }]);
    }, 1000);
  };

  return (
    <div className="flex w-full h-screen bg-neutral-50 text-neutral-900">
      {/* Left Panel: Graph (70%) */}
      <div className="w-[70%] h-full border-r border-neutral-200 relative bg-white">
        <h2 className="absolute top-4 left-4 z-10 text-xl font-semibold bg-white/80 px-3 py-1 rounded shadow-sm">
          O2C Process Graph
        </h2>
        <ReactFlow
          nodes={[{ id: '1', position: { x: 250, y: 250 }, data: { label: 'Start Order' } }]}
          edges={[]}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {/* Right Panel: Chat (30%) */}
      <div className="w-[30%] h-full flex flex-col bg-white">
        <div className="p-4 border-b border-neutral-200 shadow-sm">
          <h2 className="text-xl font-semibold">Graph Assistant</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[85%] rounded-lg p-3 ${msg.sender === 'user'
                  ? 'bg-blue-600 text-white self-end ml-auto'
                  : 'bg-neutral-100 text-neutral-800'
                }`}
            >
              {msg.text}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-neutral-200 bg-neutral-50">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 border border-neutral-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ask about the process..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button
              onClick={handleSend}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
