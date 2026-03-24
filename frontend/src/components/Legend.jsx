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
        <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow border border-slate-200 z-10 pointer-events-auto">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Legend</h3>
            <div className="flex flex-wrap gap-2 max-w-[280px]">
                {nodeColors.map(({ type, color, label }) => {
                    const isActive = visibleTypes.includes(type);
                    return (
                        <div
                            key={type}
                            onClick={() => onToggle(type)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 8px',
                                borderRadius: '20px',
                                cursor: 'pointer',
                                opacity: isActive ? 1 : 0.35,
                                background: isActive ? `${color}15` : 'transparent',
                                border: `1px solid ${isActive ? color : '#e2e8f0'}`,
                                transition: 'all 0.2s',
                                fontSize: '11px',
                                fontWeight: 500,
                                userSelect: 'none'
                            }}
                        >
                            <div style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: color,
                                opacity: isActive ? 1 : 0.4
                            }} />
                            {label}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
