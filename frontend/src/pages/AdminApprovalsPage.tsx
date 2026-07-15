import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  UserCheck, 
  AlertCircle, 
  CheckCircle, 
  X,
  ShieldAlert
} from 'lucide-react';

interface PendingUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  createdAt: string;
}

export default function AdminApprovalsPage() {
  const { token } = useAuthStore();
  const [pendingList, setPendingList] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Approve override details
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [finalRole, setFinalRole] = useState<string>('WAITER');

  // Rejection details
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const fetchPending = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/pending-approvals', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingList(data);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to load approvals list');
      }
    } catch {
      setErrorMsg('Failed to load pending users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApproveSubmit = async () => {
    if (!approvingUserId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/auth/approve/${approvingUserId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ finalRole })
      });
      if (res.ok) {
        setSuccessMsg('User registration approved successfully!');
        setApprovingUserId(null);
        fetchPending();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Approval failed');
      }
    } catch {
      setErrorMsg('Approval process encountered an error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectingUserId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/auth/reject/${rejectingUserId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: rejectReason })
      });
      if (res.ok) {
        setSuccessMsg('User request rejected successfully.');
        setRejectingUserId(null);
        setRejectReason('');
        fetchPending();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Rejection failed');
      }
    } catch {
      setErrorMsg('Rejection process encountered an error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-extrabold text-2xl tracking-tight flex items-center gap-3">
          <ShieldAlert className="text-primary w-7 h-7" />
          Pending Employee Registration Gate
        </h2>
        <p className="text-xs text-text/50">Verify and authorize newly registered WAITER, KITCHEN, or MANAGER accounts to your property.</p>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 p-4 rounded-2xl flex items-center gap-3 text-sm">
          <CheckCircle className="w-5 h-5" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/20 border border-rose-500/40 text-rose-400 p-4 rounded-2xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Pending list */}
      <div className="bg-surface/20 border border-border/20 rounded-3xl p-6 backdrop-blur-md">
        {isLoading && pendingList.length === 0 ? (
          <div className="text-center py-10 text-xs text-text/40">Loading pending signups...</div>
        ) : pendingList.length === 0 ? (
          <div className="text-center py-12">
            <UserCheck className="w-10 h-10 text-text/20 mx-auto mb-2" />
            <span className="text-xs font-bold text-text/40">No pending staff approvals at this property.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/25 text-text/40 font-bold uppercase tracking-wider">
                  <th className="pb-3 px-2">Name</th>
                  <th className="pb-3 px-2">Email</th>
                  <th className="pb-3 px-2">Phone</th>
                  <th className="pb-3 px-2">Requested Role</th>
                  <th className="pb-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingList.map(userItem => (
                  <tr key={userItem.id} className="border-b border-border/10 last:border-0 hover:bg-surface/10">
                    <td className="py-3 px-2 font-bold">{userItem.name}</td>
                    <td className="py-3 px-2 text-text/70">{userItem.email}</td>
                    <td className="py-3 px-2 text-text/70">{userItem.phone || 'N/A'}</td>
                    <td className="py-3 px-2">
                      <span className="font-extrabold text-[9px] uppercase bg-primary/10 border border-primary/20 text-primary px-2.5 py-0.5 rounded-full">
                        {userItem.role}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right space-x-2">
                      <button
                        onClick={() => {
                          setApprovingUserId(userItem.id);
                          setFinalRole(userItem.role);
                          setRejectingUserId(null);
                        }}
                        className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl transition-all"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setRejectingUserId(userItem.id);
                          setApprovingUserId(null);
                        }}
                        className="bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl transition-all"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approval Overlay Form */}
      {approvingUserId && (
        <div className="bg-surface/30 border border-border/30 rounded-3xl p-5 backdrop-blur-md space-y-4 max-w-md">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-xs uppercase text-emerald-400 tracking-wider">Confirm Roster Approval</h4>
            <button onClick={() => setApprovingUserId(null)} className="text-text/40 hover:text-text"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-wider text-text/40 block">Assign Official Role:</label>
            <select
              value={finalRole}
              onChange={(e) => setFinalRole(e.target.value)}
              className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl px-3 py-2 text-text focus:outline-none focus:border-primary"
            >
              <option value="MANAGER">MANAGER</option>
              <option value="WAITER">WAITER</option>
              <option value="KITCHEN">KITCHEN</option>
            </select>
          </div>
          <button
            onClick={handleApproveSubmit}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-surface text-xs font-black uppercase py-2.5 rounded-xl transition-all shadow-sm"
          >
            Confirm & Activate Account
          </button>
        </div>
      )}

      {/* Rejection Overlay Form */}
      {rejectingUserId && (
        <div className="bg-surface/30 border border-border/30 rounded-3xl p-5 backdrop-blur-md space-y-4 max-w-md">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-xs uppercase text-rose-400 tracking-wider">Confirm Account Rejection</h4>
            <button onClick={() => setRejectingUserId(null)} className="text-text/40 hover:text-text"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-wider text-text/40 block">Reason for Rejection:</label>
            <input
              type="text"
              placeholder="e.g. Invalid credentials, unverified profile..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-bg/50 border border-border/30 text-xs rounded-xl px-3 py-2 text-text focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={handleRejectSubmit}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-black uppercase py-2.5 rounded-xl transition-all shadow-sm"
          >
            Confirm Rejection
          </button>
        </div>
      )}

    </div>
  );
}
