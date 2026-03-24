import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { ReactFlowProvider, applyNodeChanges } from '@xyflow/react';
import GraphView from './components/GraphView';
import ChatPanel from './components/ChatPanel';
import Legend from './components/Legend';

const getScatteredPosition = (index, total, nodeType) => {
  const typeOffsets = {
    BusinessPartner: { x: 0, y: 500 },
    SalesOrder: { x: 800, y: 500 },
    OutboundDelivery: { x: 1600, y: 0 },
    BillingDocument: { x: 1600, y: 1000 },
    JournalEntry: { x: 2400, y: 800 },
    Payment: { x: 3200, y: 800 },
    Product: { x: 800, y: 1200 },
    Plant: { x: 1600, y: -400 },
  };
  const offset = typeOffsets[nodeType] || { x: 0, y: 0 };
  return {
    x: offset.x + (index % 6) * 220,
    y: offset.y + Math.floor(index / 6) * 120
  };
};

const processLayoutNodes = (nodes) => {
  const typeCounts = {};
  return nodes.map((node) => {
    const type = node.data?.nodeType || 'Unknown';
    if (!typeCounts[type]) typeCounts[type] = 0;
    const index = typeCounts[type]++;
    return {
      ...node,
      position: getScatteredPosition(index, nodes.length, type),
      targetPosition: 'left',
      sourcePosition: 'right',
    };
  });
};

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [nodes, setNodes] = useState([]);
  const [visibleTypes, setVisibleTypes] = useState([
    'BusinessPartner', 'SalesOrder', 'OutboundDelivery',
    'BillingDocument', 'JournalEntry', 'Payment'
  ]);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState([]);
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState([]);
  const [granularOverlay, setGranularOverlay] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showToast, setShowToast] = useState(false);

  const graphRef = useRef(null);
  const chatPanelRef = useRef(null);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

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

  useEffect(() => {
    if (graphData.nodes.length > 0) {
      const filtered = graphData.nodes.filter(n =>
        visibleTypes.includes(n.data.nodeType)
      );
      setNodes(processLayoutNodes(filtered));
    }
  }, [graphData, visibleTypes]);

  const handleHighlightNodes = (ids) => {
    setHighlightedNodeIds(ids);
    const relatedEdges = graphData.edges.filter(e =>
      ids.includes(e.source) && ids.includes(e.target)
    );
    setHighlightedEdgeIds(relatedEdges.map(e => e.id));

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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white text-slate-900 font-sans">
      <div style={{
        height: '48px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: '8px',
        fontSize: '13px',
        color: '#64748b',
        background: 'white',
        flexShrink: 0
      }}>
        <span>Mapping</span>
        <span>/</span>
        <span style={{ color: '#1e293b', fontWeight: 600 }}>
          Order to Cash
        </span>
        <div style={{
          marginLeft: 'auto',
          fontSize: '11px',
          color: '#94a3b8'
        }}>
          {graphData.nodes.length} nodes · {graphData.edges.length} edges
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
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

          {!isLoading && !error && (() => {
            const filteredEdges = graphData.edges.filter(e => {
              const sourceExists = nodes.some(n => n.id === e.source);
              const targetExists = nodes.some(n => n.id === e.target);
              return sourceExists && targetExists;
            });
            const enrichedEdges = filteredEdges.map(e => ({
              ...e,
              type: 'custom',
              data: {
                isHighlighted: highlightedEdgeIds.includes(e.id),
                anyHighlighted: highlightedEdgeIds.length > 0
              }
            }));

            return (
              <ReactFlowProvider>
                <div style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  zIndex: 1000,
                  display: 'flex',
                  gap: '8px'
                }}>
                  <button
                    onClick={() => setGranularOverlay(g => !g)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      background: granularOverlay ? '#1e293b' : 'white',
                      color: granularOverlay ? 'white' : '#1e293b',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span>{granularOverlay ? '⊞' : '⊟'}</span>
                    {granularOverlay ? 'Hide Granular Overlay' : 'Show Granular Overlay'}
                  </button>
                </div>
                <GraphView
                  ref={graphRef}
                  nodes={nodes}
                  edges={enrichedEdges}
                  onNodesChange={onNodesChange}
                  highlightedNodeIds={highlightedNodeIds}
                  granularOverlay={granularOverlay}
                  onNodeClick={handleNodeClick}
                />
              </ReactFlowProvider>
            );
          })()}

          {!isLoading && !error && (
            <Legend
              visibleTypes={visibleTypes}
              onToggle={(nodeType) => {
                setVisibleTypes(prev =>
                  prev.includes(nodeType)
                    ? prev.filter(t => t !== nodeType)
                    : [...prev, nodeType]
                );
              }}
            />
          )}
        </div>

        <div className="w-[380px] h-full flex-shrink-0 z-10 relative shadow-[-4px_0_15px_rgba(0,0,0,0.03)]">
          <ChatPanel
            ref={chatPanelRef}
            onHighlightNodes={handleHighlightNodes}
            graphNodes={graphData.nodes}
            granularOverlay={granularOverlay}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
