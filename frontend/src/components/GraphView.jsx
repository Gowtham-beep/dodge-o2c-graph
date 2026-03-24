import React, { useMemo, useEffect } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    MiniMap,
    useNodesState,
    useEdgesState,
    Handle,
    Position,
    MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';

const nodeColors = {
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
    const nodeColor = nodeColors[data.nodeType] || '#CBD5E1';

    return (
        <div
            style={{
                minWidth: '140px',
                background: 'white',
                border: isHighlighted
                    ? '2px solid #F59E0B'
                    : `1px solid ${selected ? '#333' : '#e2e8f0'}`,
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: isHighlighted
                    ? '0 0 12px rgba(245,158,11,0.5)'
                    : '0 2px 4px rgba(0,0,0,0.05)',
            }}
        >
            <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
            <div style={{ height: '4px', backgroundColor: nodeColor, width: '100%' }} />
            <div style={{ padding: '8px 12px' }}>
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                    {data.nodeType}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>
                    {data.label}
                </div>
            </div>
            <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
        </div>
    );
};

const nodeTypes = {
    custom: CustomNode,
};

const getLayoutedElements = (nodes, edges, direction = 'LR') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const nodeWidth = 160;
    const nodeHeight = 60;

    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const newNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
            targetPosition: Position.Left,
            sourcePosition: Position.Right,
        };
    });

    return { nodes: newNodes, edges };
};

export default function GraphView({ nodes, edges, highlightedNodeIds, onNodeClick }) {
    const [layoutedNodes, setLayoutedNodes, onNodesChange] = useNodesState([]);
    const [layoutedEdges, setLayoutedEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        if (!nodes.length) return;

        // Apply highlighting
        const nodesWithHighlight = nodes.map(n => ({
            ...n,
            data: {
                ...n.data,
                isHighlighted: highlightedNodeIds.includes(n.id)
            }
        }));

        // Apply layout
        const { nodes: repositionedNodes, edges: layoutedE } = getLayoutedElements(
            nodesWithHighlight,
            edges,
            'LR'
        );

        setLayoutedNodes(repositionedNodes);

        // Add default markers to edges
        const formattedEdges = layoutedE.map(e => ({
            ...e,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
            style: { stroke: '#94a3b8', strokeWidth: 1.5 },
            animated: e.animated || false
        }));

        setLayoutedEdges(formattedEdges);
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
                fitView
                minZoom={0.1}
            >
                <Background variant="dots" gap={20} color="#e2e8f0" />
                <Controls />
                <MiniMap
                    nodeColor={(n) => {
                        return nodeColors[n.data?.nodeType] || '#CBD5E1';
                    }}
                    maskColor="rgba(248, 250, 252, 0.7)"
                    style={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
            </ReactFlow>
        </div>
    );
}
