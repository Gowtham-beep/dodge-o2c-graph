import React, { useState, useEffect } from 'react';
import axios from 'axios';
import GraphView from './components/GraphView';
import NodeDetail from './components/NodeDetail';
import ChatPanel from './components/ChatPanel';
import Legend from './components/Legend';

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [highlightedNodeIds, setHighlightedNodeIds] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/graph');
        setGraphData(res.data);
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load graph:", err);
        setError("Could not load the graph data from backend.");
        setIsLoading(false);
      }
    };
    fetchGraph();
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-900 font-sans">
      {/* Main Graph Area */}
      <div className="relative flex-grow h-full bg-slate-50 model-pattern">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-slate-50/80 backdrop-blur-sm">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-medium animate-pulse">Loading SAP O2C Graph...</p>
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

        {!isLoading && !error && (
          <>
            <GraphView
              nodes={graphData.nodes}
              edges={graphData.edges}
              highlightedNodeIds={highlightedNodeIds}
              onNodeClick={(node) => setSelectedNode(node)}
            />
            {selectedNode && (
              <NodeDetail
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
              />
            )}
            <Legend />
          </>
        )}
      </div>

      {/* Right Sidebar - Chat */}
      <div className="w-[380px] h-full flex-shrink-0 z-10 relative shadow-[-4px_0_15px_rgba(0,0,0,0.03)]">
        <ChatPanel onHighlightNodes={(ids) => setHighlightedNodeIds(ids)} />
      </div>
    </div>
  );
}

export default App;
