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

export default function Legend() {
    return (
        <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow border border-slate-200 z-10">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Legend</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {nodeColors.map(({ type, color, label }) => (
                    <div key={type} className="flex items-center text-xs text-slate-700">
                        <div
                            className="w-3 h-3 rounded-full mr-2 shadow-sm border border-black/5"
                            style={{ backgroundColor: color }}
                        />
                        {label}
                    </div>
                ))}
            </div>
        </div>
    );
}
