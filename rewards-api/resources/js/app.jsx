import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
    const [users, setUsers] = useState([]);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);

    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [balance, setBalance] = useState(null);
    const [loadingBalance, setLoadingBalance] = useState(false);

    const [selectedProductId, setSelectedProductId] = useState('');
    const [redeemLoading, setRedeemLoading] = useState(false);

    const [alertMessage, setAlertMessage] = useState(null); // { type: 'success' | 'error', text: '' }

    // Report tab state
    const [activeTab, setActiveTab] = useState('redeem'); // 'redeem' | 'report'
    const [reportFilterCategory, setReportFilterCategory] = useState('');
    const [reportStartDate, setReportStartDate] = useState('');
    const [reportEndDate, setReportEndDate] = useState('');
    const [reportData, setReportData] = useState(null);
    const [reportLoading, setReportLoading] = useState(false);

    // Initial load
    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [uRes, pRes, cRes] = await Promise.all([
                fetch('/api/users'),
                fetch('/api/products'),
                fetch('/api/categories'),
            ]);

            if (uRes.ok) {
                const uData = await uRes.json();
                setUsers(uData);
                if (uData.length > 0) {
                    setSelectedUserId(uData[0].id.toString());
                }
            }
            if (pRes.ok) {
                const pData = await pRes.json();
                setProducts(pData);
                if (pData.length > 0) {
                    setSelectedProductId(pData[0].id.toString());
                }
            }
            if (cRes.ok) {
                const cData = await cRes.json();
                setCategories(cData);
            }
        } catch (err) {
            console.error('Error fetching initial data', err);
        }
    };

    // Whenever selectedUserId changes, update selectedUser & balance
    useEffect(() => {
        if (!selectedUserId) {
            setSelectedUser(null);
            setBalance(null);
            return;
        }

        const found = users.find((u) => u.id.toString() === selectedUserId.toString());
        setSelectedUser(found || null);

        fetchUserBalance(selectedUserId);
    }, [selectedUserId, users]);

    const fetchUserBalance = async (userId) => {
        setLoadingBalance(true);
        try {
            const res = await fetch(`/api/users/${userId}/balance`);
            const data = await res.json();
            if (res.ok) {
                setBalance(data.balance);
            } else {
                setBalance(0);
            }
        } catch (err) {
            console.error('Error fetching balance', err);
            setBalance(0);
        } finally {
            setLoadingBalance(false);
        }
    };

    const handleRedeem = async (e) => {
        if (e) e.preventDefault();
        setAlertMessage(null);

        if (!selectedUserId || !selectedProductId) {
            setAlertMessage({
                type: 'error',
                text: 'Please select both a user and a product.',
            });
            return;
        }

        setRedeemLoading(true);

        try {
            const res = await fetch('/api/redemptions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    user_id: parseInt(selectedUserId),
                    product_id: parseInt(selectedProductId),
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setAlertMessage({
                    type: 'success',
                    text: `Redemption Successful! Spent ${data.points_spent} points on ${data.product}. New balance: ${data.remaining_balance} pts.`,
                });
                // Update balance immediately
                setBalance(data.remaining_balance);
            } else {
                // Collect validation errors or error message
                let errorDetails = data.message || 'Redemption failed.';
                if (data.errors) {
                    const list = Object.values(data.errors).flat();
                    if (list.length > 0) {
                        errorDetails = list.join(' ');
                    }
                }
                setAlertMessage({
                    type: 'error',
                    text: errorDetails,
                });
            }
        } catch (err) {
            setAlertMessage({
                type: 'error',
                text: 'Network error or server unavailable.',
            });
        } finally {
            setRedeemLoading(false);
        }
    };

    // Fetch Report
    const fetchReport = async () => {
        setReportLoading(true);
        try {
            const params = new URLSearchParams();
            if (reportFilterCategory) params.append('category_id', reportFilterCategory);
            if (reportStartDate) params.append('start_date', reportStartDate);
            if (reportEndDate) params.append('end_date', reportEndDate);

            const res = await fetch(`/api/reports/redemptions?${params.toString()}`);
            const data = await res.json();
            if (res.ok) {
                setReportData(data);
            }
        } catch (err) {
            console.error('Error fetching report', err);
        } finally {
            setReportLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'report') {
            fetchReport();
        }
    }, [activeTab, reportFilterCategory, reportStartDate, reportEndDate]);

    // Download CSV
    const downloadCSV = () => {
        if (!reportData || !reportData.data || reportData.data.length === 0) return;

        const headers = ['ID', 'User', 'Product', 'Category', 'Points', 'Date'];
        const rows = reportData.data.map((item) => [
            item.id,
            `"${item.user?.name || item.user_id}"`,
            `"${item.product?.name || item.product_id}"`,
            `"${item.product?.category?.name || 'N/A'}"`,
            item.points,
            item.created_at,
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `redemptions_report_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const selectedProduct = products.find((p) => p.id.toString() === selectedProductId.toString());

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <span className="bg-indigo-600 text-white font-bold text-xs uppercase px-2.5 py-1 rounded">SuperBotics</span>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Rewards Redemption Portal</h1>
                    </div>
                    <p className="text-slate-500 text-sm mt-1">Assessment Part B · Real-Time Points Ledger & Redemption API</p>
                </div>
                {/* Tabs */}
                <div className="flex bg-slate-200 p-1 rounded-lg self-start md:self-auto">
                    <button
                        onClick={() => setActiveTab('redeem')}
                        className={`px-4 py-2 text-sm font-semibold rounded-md transition ${
                            activeTab === 'redeem' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Redeem Rewards
                    </button>
                    <button
                        onClick={() => setActiveTab('report')}
                        className={`px-4 py-2 text-sm font-semibold rounded-md transition ${
                            activeTab === 'report' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Redemptions Report & CSV
                    </button>
                </div>
            </div>

            {/* Alert Banner */}
            {alertMessage && (
                <div
                    className={`mb-6 p-4 rounded-xl border flex items-start justify-between shadow-sm ${
                        alertMessage.type === 'success'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{alertMessage.type === 'success' ? '✓' : '✕'}</span>
                        <div>
                            <p className="font-semibold">{alertMessage.type === 'success' ? 'Success' : 'Error Notice'}</p>
                            <p className="text-sm mt-0.5">{alertMessage.text}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setAlertMessage(null)}
                        className="text-slate-400 hover:text-slate-700 font-bold ml-4"
                    >
                        ×
                    </button>
                </div>
            )}

            {activeTab === 'redeem' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: User Selection & Balance */}
                    <div className="space-y-6">
                        {/* User Card */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span>👤</span> Select User Account
                            </h2>

                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Choose from existing users
                            </label>
                            <select
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none mb-4"
                            >
                                <option value="">-- Select a User --</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        User #{u.id}: {u.name} ({u.profile?.name || 'normal'})
                                    </option>
                                ))}
                            </select>

                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-xs text-slate-400">or manual User ID:</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    placeholder="e.g. 1"
                                    className="w-24 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>

                            {/* User details */}
                            {selectedUser && (
                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-slate-400">Profile Status</p>
                                        <span
                                            className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded ${
                                                selectedUser.profile?.name === 'restricted'
                                                    ? 'bg-rose-100 text-rose-700'
                                                    : 'bg-emerald-100 text-emerald-700'
                                            }`}
                                        >
                                            {selectedUser.profile?.name?.toUpperCase() || 'NORMAL'}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-400">User Email</p>
                                        <p className="text-xs font-mono text-slate-600 truncate max-w-[150px]">{selectedUser.email}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Balance Card */}
                        <div className="bg-gradient-to-br from-indigo-900 to-indigo-700 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs uppercase font-semibold tracking-wider text-indigo-200">Current Balance</span>
                                <button
                                    onClick={() => selectedUserId && fetchUserBalance(selectedUserId)}
                                    disabled={loadingBalance}
                                    className="text-xs bg-indigo-800/80 hover:bg-indigo-800 px-2.5 py-1 rounded-full text-indigo-100 transition"
                                >
                                    {loadingBalance ? 'Updating...' : '↻ Refresh'}
                                </button>
                            </div>
                            <div className="flex items-baseline gap-2 my-2">
                                <span className="text-4xl font-extrabold tracking-tight">
                                    {balance !== null ? balance.toLocaleString() : '---'}
                                </span>
                                <span className="text-indigo-200 font-medium">pts</span>
                            </div>
                            <p className="text-xs text-indigo-200/80">Calculated in real-time from user points ledger via SQL aggregate</p>
                        </div>

                        {/* Quick Testing Presets */}
                        <div className="bg-slate-100/80 rounded-2xl p-4 border border-slate-200">
                            <p className="text-xs font-bold text-slate-600 uppercase mb-3">Quick Review Scenarios</p>
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        // Find active user
                                        const active = users.find((u) => u.profile?.name !== 'restricted');
                                        if (active) setSelectedUserId(active.id.toString());
                                        if (products.length > 0) setSelectedProductId(products[0].id.toString());
                                    }}
                                    className="w-full text-left text-xs bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 font-medium transition"
                                >
                                    🟢 <span className="font-semibold">Scenario 1:</span> Normal Active User
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        // Find restricted user
                                        const restricted = users.find((u) => u.profile?.name === 'restricted');
                                        if (restricted) setSelectedUserId(restricted.id.toString());
                                    }}
                                    className="w-full text-left text-xs bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 font-medium transition"
                                >
                                    🔴 <span className="font-semibold">Scenario 2:</span> Restricted User Check
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        // Pick product with maximum points to test insufficient balance
                                        if (products.length > 0) {
                                            const sorted = [...products].sort((a, b) => b.points - a.points);
                                            setSelectedProductId(sorted[0].id.toString());
                                        }
                                    }}
                                    className="w-full text-left text-xs bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 font-medium transition"
                                >
                                    💰 <span className="font-semibold">Scenario 3:</span> High-Cost Product Check
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Product Selection & Redemption Action */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span>🎁</span> Choose Reward Product to Redeem
                            </h2>

                            {/* Products Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 max-h-[380px] overflow-y-auto pr-1">
                                {products.map((p) => {
                                    const isSelected = selectedProductId.toString() === p.id.toString();
                                    const monthlyLimit = p.category?.category_limit?.monthly_limit ?? 'N/A';
                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => setSelectedProductId(p.id.toString())}
                                            className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                                                isSelected
                                                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500'
                                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                                        {p.category?.name || 'Category'}
                                                    </span>
                                                    <span className="text-xs text-slate-400">Limit: {monthlyLimit}/mo</span>
                                                </div>
                                                <h3 className="font-bold text-slate-900 mt-2">{p.name}</h3>
                                            </div>

                                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                                                <span className="text-indigo-600 font-bold text-lg">{p.points.toLocaleString()} pts</span>
                                                <span className={`text-xs font-semibold ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                    {isSelected ? '✓ Selected' : 'Select'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Redemption Confirmation Footer */}
                            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs text-slate-400 uppercase font-semibold">Ready to Redeem</p>
                                    <p className="text-sm font-medium text-slate-700 mt-0.5">
                                        User <span className="font-bold text-slate-900">#{selectedUserId || 'None'}</span> redeeming{' '}
                                        <span className="font-bold text-slate-900">{selectedProduct?.name || 'None'}</span> for{' '}
                                        <span className="font-bold text-indigo-600">{selectedProduct?.points || 0} pts</span>
                                    </p>
                                </div>
                                <button
                                    onClick={handleRedeem}
                                    disabled={redeemLoading || !selectedUserId || !selectedProductId}
                                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2"
                                >
                                    {redeemLoading ? (
                                        <>
                                            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                                            Processing...
                                        </>
                                    ) : (
                                        'Confirm Redemption'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Report Tab */
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-100 gap-4 mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Redemption History Report</h2>
                            <p className="text-slate-500 text-sm mt-0.5">Filtered by category and date range using optimized SQL query</p>
                        </div>
                        <button
                            onClick={downloadCSV}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg shadow-sm transition flex items-center gap-2"
                        >
                            <span>⬇</span> Export CSV
                        </button>
                    </div>

                    {/* Filter controls */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Category</label>
                            <select
                                value={reportFilterCategory}
                                onChange={(e) => setReportFilterCategory(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm focus:outline-none"
                            >
                                <option value="">All Categories</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Start Date</label>
                            <input
                                type="date"
                                value={reportStartDate}
                                onChange={(e) => setReportStartDate(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">End Date</label>
                            <input
                                type="date"
                                value={reportEndDate}
                                onChange={(e) => setReportEndDate(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                            <span className="text-xs uppercase font-semibold text-indigo-600">Total Redemptions</span>
                            <p className="text-2xl font-bold text-indigo-950 mt-1">
                                {reportData ? reportData.total_count.toLocaleString() : '---'}
                            </p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                            <span className="text-xs uppercase font-semibold text-emerald-600">Total Points Redeemed</span>
                            <p className="text-2xl font-bold text-emerald-950 mt-1">
                                {reportData ? reportData.total_points.toLocaleString() : '---'} pts
                            </p>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-100 text-xs font-bold text-slate-700 uppercase">
                                <tr>
                                    <th className="px-4 py-3">ID</th>
                                    <th className="px-4 py-3">User</th>
                                    <th className="px-4 py-3">Product</th>
                                    <th className="px-4 py-3">Category</th>
                                    <th className="px-4 py-3">Points</th>
                                    <th className="px-4 py-3">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {reportLoading ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-8 text-slate-400">
                                            Loading report records...
                                        </td>
                                    </tr>
                                ) : reportData && reportData.data && reportData.data.length > 0 ? (
                                    reportData.data.map((r) => (
                                        <tr key={r.id} className="hover:bg-slate-50 transition">
                                            <td className="px-4 py-3 font-mono text-xs">#{r.id}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900">{r.user?.name || `User #${r.user_id}`}</td>
                                            <td className="px-4 py-3 font-medium text-indigo-600">{r.product?.name || `Product #${r.product_id}`}</td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                                    {r.product?.category?.name || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-900">-{r.points} pts</td>
                                            <td className="px-4 py-3 text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="text-center py-8 text-slate-400">
                                            No redemption records found for this filter.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
