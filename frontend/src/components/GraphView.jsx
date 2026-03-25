import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import {
    ReactFlow,
    Controls,
    Background,
    MiniMap,
    Handle,
    Position,
    MarkerType,
    useReactFlow,
    BaseEdge,
    EdgeLabelRenderer,
    getStraightPath
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

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
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const { isHighlighted, granularOverlay } = data;
    const nodeColor = NODE_COLORS[data.nodeType] || '#CBD5E1';

    const defaultStyle = {
        position: 'relative',
        overflow: 'visible',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'white',
        border: `1px solid ${selected ? '#333' : '#e2e8f0'}`,
        borderRadius: '20px',
        padding: granularOverlay ? '4px 10px' : '2px 8px',
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

    const shortLabel = data.label ? data.label.substring(0, 8) + (data.label.length > 8 ? '...' : '') : '';

    return (
        <div
            style={{
                ...currentStyle,
                position: 'relative',
                overflow: 'visible',
                zIndex: hovered ? 99999 : (isHighlighted ? 1000 : 1),
            }}
            className="nodrag"
            onMouseEnter={(e) => {
                setHovered(true);
                setMousePos({ x: e.clientX, y: e.clientY });
            }}
            onMouseMove={(e) => {
                setMousePos({ x: e.clientX, y: e.clientY });
            }}
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
                {granularOverlay ? data.label : shortLabel}
            </span>
            <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />

            {hovered && createPortal(
                <div style={{
                    position: 'fixed',
                    left: mousePos.x + 12,
                    top: mousePos.y - 10,
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    minWidth: '220px',
                    maxWidth: '280px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                    zIndex: 999999,
                    isolation: 'isolate',
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: nodeColor,
                                flexShrink: 0
                            }} />
                            <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: nodeColor,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                {data.nodeType}
                            </span>
                        </div>
                        {granularOverlay && (
                            <span style={{
                                fontSize: '10px',
                                color: '#94a3b8'
                            }}>
                                {Object.keys(data.meta || {}).length} fields
                            </span>
                        )}
                    </div>

                    <div style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#1e293b',
                        marginBottom: granularOverlay ? '8px' : '0px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word'
                    }}>
                        {data.label}
                    </div>

                    {granularOverlay && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {Object.entries(data.meta || {})
                                .filter(([k, v]) => v !== null && v !== '' && v !== undefined && k !== 'id')
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
                                            maxWidth: '150px',
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
                    )}

                    {!granularOverlay && (
                        <div style={{
                            marginTop: '4px',
                            fontSize: '10px',
                            color: '#94a3b8',
                            textAlign: 'left'
                        }}>
                            Expand overlay to see full details
                        </div>
                    )}

                    {granularOverlay && (
                        <div style={{
                            marginTop: '8px',
                            paddingTop: '8px',
                            borderTop: '1px solid #f1f5f9',
                            fontSize: '10px',
                            color: '#94a3b8',
                            textAlign: 'left'
                        }}>
                            <div style={{ marginBottom: '2px' }}>Click to analyze in chat</div>
                            <div>Double-click to expand neighbors</div>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};

const CustomEdge = ({
    id, sourceX, sourceY, targetX, targetY,
    data, style, markerEnd
}) => {
    const [hovered, setHovered] = useState(false);
    const [edgePath, labelX, labelY] = getStraightPath({
        sourceX, sourceY, targetX, targetY
    });

    const { label, isHighlighted, anyHighlighted, granularOverlay } = data || {};

    let opacity = 0.5;
    if (granularOverlay === false) opacity = 0.3;
    if (isHighlighted) opacity = 1;
    else if (anyHighlighted) opacity = 0.1;
    if (hovered) opacity = 1;
    if (style?.opacity !== undefined) opacity = style.opacity;

    let stroke = style?.stroke || '#e2e8f0';
    if (isHighlighted) stroke = '#F59E0B';
    else if (hovered) stroke = '#3B82F6';

    let strokeWidth = style?.strokeWidth || 1.5;
    if (isHighlighted) strokeWidth = 2.5;
    else if (hovered) strokeWidth = 2;

    const showLabel = isHighlighted || hovered;

    return (
        <>
            <path
                d={edgePath}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{ cursor: 'pointer' }}
            />
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    ...style,
                    stroke,
                    strokeWidth,
                    opacity,
                    transition: 'all 0.2s',
                    strokeDasharray: isHighlighted ? '6 3' : 'none'
                }}
            />
            {showLabel && label && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            background: isHighlighted ? '#F59E0B' : '#1e293b',
                            color: 'white',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                            letterSpacing: '0.05em',
                            pointerEvents: 'none',
                            zIndex: 9999,
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                        className="nodrag nopan"
                    >
                        {label}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
};

const nodeTypes = {
    custom: CustomNode,
};

const edgeTypes = {
    custom: CustomEdge,
};

const GraphViewInner = forwardRef(({ nodes, edges, onNodesChange, highlightedNodeIds, granularOverlay, onNodeClick, onNodeDoubleClick }, ref) => {
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

    const nodesWithHighlight = nodes.map(n => ({
        ...n,
        data: {
            ...n.data,
            isHighlighted: highlightedNodeIds.includes(n.id),
            granularOverlay
        }
    }));

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <ReactFlow
                style={{ width: '100%', height: '100%', overflow: 'visible' }}
                edgesUpdatable={false}
                nodes={nodesWithHighlight}
                edges={edges}
                onNodesChange={onNodesChange}
                onNodeClick={(_, node) => onNodeClick(node)}
                onNodeDoubleClick={(_, node) => onNodeDoubleClick?.(node.id)}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView={true}
                fitViewOptions={{ padding: 0.15 }}
                minZoom={0.05}
                maxZoom={3}
                nodesDraggable={true}
                panOnDrag={true}
                panOnScroll={false}
                zoomOnScroll={true}
                zoomOnPinch={true}
                nodesConnectable={false}
                elementsSelectable={true}
                preventScrolling={true}
                defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
                defaultEdgeOptions={{
                    type: 'custom',
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
