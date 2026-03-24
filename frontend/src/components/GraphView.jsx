import React, { useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';

function formatValue(key, value) {
    if (value === null || value === undefined) return '—';
    if (value === 'C') return 'Complete';
    if (value === 'A') return 'Not Started';
    if (value === 'B') return 'Partial';
    if (value === true || value === 'true') return 'Yes';
    if (value === false || value === 'false') return 'No';
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
        return new Date(value).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    }
    if (!isNaN(value) && value > 999) {
        return Number(value).toLocaleString('en-IN');
    }
    return String(value);
}
import {
    ReactFlow,
    Controls,
    Background,
    MiniMap,
    useNodesState,
    useEdgesState,
    Handle,
    Position,
    MarkerType,
    useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const NODE_COLORS = {
    SalesOrder: '#3B82F6', // (blue)
    BusinessPartner: '#8B5CF6', // (purple)
    OutboundDelivery: '#10B981', // (green)
    BillingDocument: '#F59E0B', // (amber)
    JournalEntry: '#EF4444', // (red)
    Payment: '#06B6D4', // (cyan)
    Product: '#F97316', // (orange)
    Plant: '#6B7280', // (gray)
};

const CustomNode = ({ data, id, selected }) => {
    const [hovered, setHovered] = useState(false);
    const isHighlighted = data.isHighlighted;
    const nodeColor = NODE_COLORS[data.nodeType] || '#CBD5E1';

    const defaultStyle = {
        position: 'relative',
        overflow: 'visible',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'white',
        border: `1px solid ${selected ? '#333' : '#e2e8f0'}`,
        borderRadius: '20px',  // pill shape
        padding: '4px 10px',
        fontSize: '10px',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
    };

    const highlightedStyle = {
        ...defaultStyle,
        border: `2px solid ${nodeColor}`,
        boxShadow: `0 0 0 3px ${nodeColor}40, 0 0 20px ${nodeColor}60`,
        background: `${nodeColor}10`,
        transform: 'scale(1.1)',
        zIndex: 1000,
    };

    const currentStyle = isHighlighted ? highlightedStyle : defaultStyle;

    return (
        <div
            style={currentStyle}
            className="nodrag"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
            <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: nodeColor,
                flexShrink: 0
            }} />
            <span style={{
                color: '#374151',
                fontWeight: isHighlighted ? 700 : 500,
                fontSize: isHighlighted ? '11px' : '10px',
                transition: 'all 0.2s ease',
            }}>
                {data.label}
            </span>
            <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />

            {hovered && (
                <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 8px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    minWidth: '220px',
                    maxWidth: '280px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    zIndex: 9999,
                    pointerEvents: 'none',
                    cursor: 'default',
                    textAlign: 'left'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px',
                        paddingBottom: '8px',
                        borderBottom: '1px solid #f1f5f9'
                    }}>
                        <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: nodeColor,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            {data.nodeType}
                        </span>
                        <span style={{
                            fontSize: '10px',
                            color: '#94a3b8'
                        }}>
                            {Object.keys(data.meta || {}).length} fields
                        </span>
                    </div>

                    <div style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#1e293b',
                        marginBottom: '8px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word'
                    }}>
                        {data.label}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {Object.entries(data.meta || {})
                            .filter(([k, v]) => v !== null && v !== '' && k !== 'id')
                            .slice(0, 6)
                            .map(([key, value]) => (
                                <div key={key} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: '8px',
                                    fontSize: '11px'
                                }}>
                                    <span style={{
                                        color: '#64748b',
                                        fontWeight: 500,
                                        flexShrink: 0
                                    }}>
                                        {key.replace(/([A-Z])/g, ' $1').trim()}:
                                    </span>
                                    <span style={{
                                        color: '#1e293b',
                                        textAlign: 'right',
                                        maxWidth: '140px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {formatValue(key, value)}
                                    </span>
                                </div>
                            ))
                        }
                    </div>

                    <div style={{
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: '1px solid #f1f5f9',
                        fontSize: '10px',
                        color: '#94a3b8',
                        textAlign: 'left'
                    }}>
                        Click to analyze in chat
                    </div>
                </div>
            )}
        </div>
    );
};

const nodeTypes = {
    custom: CustomNode,
};

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

const processLayout = (nodes, edges) => {
    const typeCounts = {};

    const positionedNodes = nodes.map((node) => {
        const type = node.data?.nodeType || 'Unknown';
        if (!typeCounts[type]) typeCounts[type] = 0;

        const index = typeCounts[type]++;
        const total = nodes.length; // rough estimate
        const position = getScatteredPosition(index, total, type);

        return {
            ...node,
            position,
            targetPosition: Position.Left,
            sourcePosition: Position.Right,
        };
    });

    return { nodes: positionedNodes, edges };
};

const GraphViewInner = forwardRef(({ nodes, edges, highlightedNodeIds, onNodeClick }, ref) => {
    const [layoutedNodes, setLayoutedNodes, onNodesChange] = useNodesState([]);
    const [layoutedEdges, setLayoutedEdges, onEdgesChange] = useEdgesState([]);
    const reactFlowInstance = useReactFlow();

    useImperativeHandle(ref, () => ({
        focusNodes: (nodeIds) => {
            const targetNodes = reactFlowInstance.getNodes().filter(n => nodeIds.includes(n.id));
            if (targetNodes.length === 0) return;

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            targetNodes.forEach(n => {
                if (n.position.x < minX) minX = n.position.x;
                if (n.position.y < minY) minY = n.position.y;
                if (n.position.x + 120 > maxX) maxX = n.position.x + 120;
                if (n.position.y + 40 > maxY) maxY = n.position.y + 40;
            });

            reactFlowInstance.fitBounds(
                { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
                { duration: 800, padding: 0.3 }
            );
        }
    }));

    useEffect(() => {
        if (!nodes.length) return;

        const nodesWithHighlight = nodes.map(n => ({
            ...n,
            data: {
                ...n.data,
                isHighlighted: highlightedNodeIds.includes(n.id)
            }
        }));

        const { nodes: repositionedNodes, edges: unformattedEdges } = processLayout(
            nodesWithHighlight,
            edges
        );

        setLayoutedNodes(repositionedNodes);
        setLayoutedEdges(unformattedEdges);
    }, [nodes, edges, highlightedNodeIds, setLayoutedNodes, setLayoutedEdges]);

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <ReactFlow
                style={{ overflow: 'visible' }}
                edgesUpdatable={false}
                nodes={layoutedNodes}
                edges={layoutedEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => onNodeClick(node)}
                nodeTypes={nodeTypes}
                fitView={true}
                fitViewOptions={{ padding: 0.15 }}
                minZoom={0.05}
                maxZoom={3}
                nodesDraggable={true}
                panOnScroll={true}
                defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
                defaultEdgeOptions={{
                    type: 'straight',
                    labelStyle: { display: 'none' },
                    labelBgStyle: { display: 'none' },
                    label: '',
                    style: {
                        stroke: '#e2e8f0',
                        strokeWidth: 1.5,
                        opacity: 0.4
                    },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: '#93c5fd',
                        width: 8,
                        height: 8
                    }
                }}
                elementsSelectable={true}
            >
                <Background variant="dots" gap={20} color="#e2e8f0" />
                <Controls />
                <MiniMap
                    nodeColor={(n) => {
                        return NODE_COLORS[n.data?.nodeType] || '#CBD5E1';
                    }}
                    maskColor="rgba(248, 250, 252, 0.7)"
                    style={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
            </ReactFlow>
        </div>
    );
});

export default GraphViewInner;
