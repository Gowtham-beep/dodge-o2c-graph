import React, { useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
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
    const isHighlighted = data.isHighlighted;
    const nodeColor = NODE_COLORS[data.nodeType] || '#CBD5E1';

    const defaultStyle = {
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
        <div style={currentStyle} className="nodrag">
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
        </div>
    );
};

const nodeTypes = {
    custom: CustomNode,
};

const getScatteredPosition = (index, total, nodeType) => {
    const seed = index * 137.508;
    const radius = 200 + (index % 5) * 120;
    const angle = (index * 137.508 * Math.PI) / 180;

    const typeOffsets = {
        BusinessPartner: { x: 0, y: 0 },
        SalesOrder: { x: 600, y: 0 },
        OutboundDelivery: { x: 1200, y: -300 },
        BillingDocument: { x: 1200, y: 300 },
        JournalEntry: { x: 1800, y: 200 },
        Payment: { x: 2400, y: 200 },
        Product: { x: 600, y: 600 },
        Plant: { x: 1200, y: -600 },
    };

    const offset = typeOffsets[nodeType] || { x: 0, y: 0 };
    return {
        x: offset.x + Math.cos(angle) * radius * 0.4 + (index % 10) * 20,
        y: offset.y + Math.sin(angle) * radius * 0.4 + Math.floor(index / 10) * 80
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
                    style: {
                        stroke: '#93c5fd',
                        strokeWidth: 1,
                        opacity: 0.5
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
