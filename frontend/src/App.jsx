import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ReactFlowProvider } from '@xyflow/react';
import GraphView from './components/GraphView';
import ChatPanel from './components/ChatPanel';
import Legend from './components/Legend';

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [highlightedNodeIds, setHighlightedNodeIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showToast, setShowToast] = useState(false);

  const graphRef = useRef(null);
  const chatPanelRef = useRef(null);

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/graph');
        setGraphData(res.data);
        setIsLoading(false);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } catch (err) {
        console.error("Failed to load graph:", err);
        setError("Could not load the graph data from backend.");
        setIsLoading(false);
      }
    };
    fetchGraph();
  }, []);

  const handleHighlightNodes = (ids) => {
    setHighlightedNodeIds(ids);
    if (ids.length > 0) {
      setTimeout(() => {
        graphRef.current?.focusNodes(ids);
      }, 100);
    }
  };

  const handleNodeClick = (node) => {
    if (chatPanelRef.current) {
      chatPanelRef.current.sendMessage(`Tell me about ${node.data.nodeType} ${node.id}`);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-900 font-sans">
      <div className="relative flex-grow h-full bg-slate-50">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-slate-50/80 backdrop-blur-sm">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-600 font-medium animate-pulse">Loading Order to Cash graph...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200 max-w-md text-center shadow-lg">
              <h3 className="font-bold mb-1">Connection Error</h3>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-500 ${showToast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
          <div className="bg-green-100 text-green-800 border border-green-200 px-4 py-2 rounded shadow-sm text-sm font-medium">
            Loaded {graphData.nodes.length} nodes and {graphData.edges.length} edges
          </div>
        </div>

        {!isLoading && !error && (
          <ReactFlowProvider>
            <GraphView
              ref={graphRef}
              nodes={graphData.nodes}
              edges={graphData.edges}
              highlightedNodeIds={highlightedNodeIds}
              onNodeClick={handleNodeClick}
            />
          </ReactFlowProvider>
        )}

        {!isLoading && !error && <Legend />}
      </div>

      <div className="w-[380px] h-full flex-shrink-0 z-10 relative shadow-[-4px_0_15px_rgba(0,0,0,0.03)]">
        <ChatPanel
          ref={chatPanelRef}
          onHighlightNodes={handleHighlightNodes}
          graphNodes={graphData.nodes}
        />
      </div>
    </div>
  );
}

export default App;
