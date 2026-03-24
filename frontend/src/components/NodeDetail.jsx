import React from 'react';
import { X } from 'lucide-react';

const nodeColors = {
    SalesOrder: '#3B82F6',
    BusinessPartner: '#8B5CF6',
    OutboundDelivery: '#10B981',
    BillingDocument: '#F59E0B',
    JournalEntry: '#EF4444',
    Payment: '#06B6D4',
    Product: '#F97316',
    Plant: '#6B7280',
};

const formatKey = (key) => {
    const result = key.replace(/([A-Z])/g, " $1");
    return result.charAt(0).toUpperCase() + result.slice(1);
};

const formatValue = (value) => {
    if (value === null || value === undefined || value === '') return '-';

    // Boolean
    if (typeof value === 'boolean' || value === 'true' || value === 'false') {
        return value === true || value === 'true' ? 'Yes' : 'No';
    }

    // Date
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T.*/)) {
        const d = new Date(value);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    // Status codes
    if (value === 'C') return 'Complete';
    if (value === 'A') return 'Not Started';
    if (value === 'B') return 'Partial';

    // Numbers
    if (!isNaN(value) && typeof value !== 'boolean' && String(value).trim() !== '') {
        const num = Number(value);
        // don't format IDs that happen to be numbers, just amounts
        if (num > 1000 && value.includes('.')) {
            return num.toLocaleString();
        }
    }

    return value;
};

export default function NodeDetail({ node, onClose }) {
    if (!node) return null;

    const { nodeType, label, meta } = node.data;
    const color = nodeColors[nodeType] || '#CBD5E1';

    return (
        <div className="absolute top-4 right-4 w-[300px] bg-white rounded-lg shadow-xl border border-slate-200 z-10 flex flex-col max-h-[calc(100%-32px)] overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between p-4 border-b border-slate-100 pb-3">
                <div>
                    <span
                        className="inline-block px-2 py-1 text-xs font-medium rounded-full mb-1 text-white"
                        style={{ backgroundColor: color }}
                    >
                        {nodeType}
                    </span>
                    <h2 className="text-lg font-bold text-slate-800 break-all">{label}</h2>
                </div>
                <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded p-1 transition-colors"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto">
                <div className="space-y-3">
                    {Object.entries(meta || {}).map(([key, value]) => {
                        // Skips raw ID if it's the same as label to avoid redundancy
                        if (key === 'id' && value === label) return null;

                        return (
                            <div key={key} className="flex flex-col">
                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                                    {formatKey(key)}
                                </span>
                                <span className="text-sm font-medium text-slate-800 break-words">
                                    {formatValue(value)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
