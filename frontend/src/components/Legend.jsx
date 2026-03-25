import React from 'react';

const nodeColors = [
    { type: 'SalesOrder', color: '#3B82F6', label: 'Sales Order' },
    { type: 'BusinessPartner', color: '#8B5CF6', label: 'Business Partner' },
    { type: 'OutboundDelivery', color: '#10B981', label: 'Outbound Delivery' },
    { type: 'BillingDocument', color: '#F59E0B', label: 'Billing Document' },
    { type: 'JournalEntry', color: '#EF4444', label: 'Journal Entry' },
    { type: 'Payment', color: '#06B6D4', label: 'Payment' },
    { type: 'Product', color: '#F97316', label: 'Product' },
    { type: 'Plant', color: '#6B7280', label: 'Plant' },
];

export default function Legend({ visibleTypes, onToggle }) {
    return (
        <div style={{
            position: 'absolute',
            bottom: 10,
            left: 60,
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(4px)',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '6px 10px',
            zIndex: 50,
            pointerEvents: 'auto',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
            maxWidth: '380px'
        }}>
            <span style={{
                fontSize: '9px',
                fontWeight: 700,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginRight: '2px',
                whiteSpace: 'nowrap'
            }}>Legend</span>
            {nodeColors.map(({ type, color, label }) => {
                const isActive = visibleTypes.includes(type);
                return (
                    <div
                        key={type}
                        onClick={() => onToggle(type)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 7px',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            opacity: isActive ? 1 : 0.35,
                            background: isActive ? `${color}15` : 'transparent',
                            border: `1px solid ${isActive ? color : '#e2e8f0'}`,
                            transition: 'all 0.2s',
                            fontSize: '10px',
                            fontWeight: 500,
                            userSelect: 'none',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: color,
                            flexShrink: 0,
                            opacity: isActive ? 1 : 0.4
                        }} />
                        {label}
                    </div>
                );
            })}
        </div>
    );
}
