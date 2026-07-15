import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  DollarSign, 
  Settings, 
  FileText, 
  Download, 
  Play, 
  AlertCircle, 
  CheckCircle
} from 'lucide-react';

interface Payslip {
  id: string;
  month: number;
  year: number;
  grossPay: string;
  deductions: string;
  netPay: string;
  presentDays: number;
  leaveDays: number;
  absentDays: number;
  status: string;
  generatedAt: string;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
}

interface ComputedPayrollRun {
  userId: string;
  name: string;
  baseSalary: number;
  hra: number;
  allowances: number;
  deductions: number;
  absenceDeduction: number;
  calculatedNet: number;
  overrideNetPay?: string;
  overrideReason?: string;
  error?: string;
}

export default function SalaryPage() {
  const { token, user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'my-slips' | 'structures' | 'payroll-run'>('my-slips');

  // Common State
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [mySlips, setMySlips] = useState<Payslip[]>([]);
  
  // Structures Config state
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [baseSalary, setBaseSalary] = useState(2500);
  const [hra, setHra] = useState(500);
  const [allowances, setAllowances] = useState(200);
  const [deductions, setDeductions] = useState(100);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  
  // Bulk Run state
  const [runMonth, setRunMonth] = useState('06');
  const [runYear, setRunYear] = useState('2026');
  const [computedRuns, setComputedRuns] = useState<ComputedPayrollRun[]>([]);
  const [isComputing, setIsComputing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const [toast, setToast] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchStaff = async () => {
    if (!isAdmin) return;
    try {
      // Fetch users from attendance summary for a wide date range
      const res = await fetch('/api/attendance/summary?from=2026-06-01&to=2026-06-30', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStaff(data.map((d: any) => ({ id: d.userId, name: d.name, email: d.email })));
        if (data.length > 0 && !selectedStaffId) {
          setSelectedStaffId(data[0].userId);
        }
      }
    } catch {}
  };

  const fetchMyPayslips = async () => {
    try {
      const res = await fetch(`/api/salary/payslips/${user?.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMySlips(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchMyPayslips();
    fetchStaff();
  }, [token, user]);

  // Load structure settings for selected user
  useEffect(() => {
    if (!selectedStaffId) return;
    const fetchStructure = async () => {
      try {
        const res = await fetch(`/api/salary/structure/${selectedStaffId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setBaseSalary(data.baseSalary);
          setHra(data.hra);
          setAllowances(data.allowances);
          setDeductions(data.deductions);
          setEffectiveFrom(data.effectiveFrom ? data.effectiveFrom.split('T')[0] : '');
        } else {
          // Defaults if not defined
          setBaseSalary(2000);
          setHra(300);
          setAllowances(100);
          setDeductions(50);
          setEffectiveFrom(new Date().toISOString().split('T')[0]);
        }
      } catch {}
    };
    fetchStructure();
  }, [selectedStaffId]);

  // Update salary structure
  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/salary/structure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: selectedStaffId,
          baseSalary,
          hra,
          allowances,
          deductions,
          effectiveFrom: effectiveFrom ? new Date(effectiveFrom).toISOString() : undefined
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save salary structure');
      }

      showToast('Salary structure updated successfully');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Compute bulk run estimates (mock calculate client side based on attendance values)
  const computeBulkEstimates = async () => {
    setIsComputing(true);
    try {
      const fromStr = `${runYear}-${runMonth}-01`;
      const to = new Date(parseInt(runYear), parseInt(runMonth), 0);
      const toStr = to.toISOString().split('T')[0];
      const totalWorkingDays = to.getDate();

      // 1. Fetch attendance summaries
      const summaryRes = await fetch(`/api/attendance/summary?from=${fromStr}&to=${toStr}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!summaryRes.ok) throw new Error('Failed to load attendance metrics for this period');
      const summaries = await summaryRes.json();

      // 2. Fetch and calculate pro-ration for each staff member
      const runs = await Promise.all(
        summaries.map(async (sum: any) => {
          // Fetch their structure
          let struct;
          try {
            const structRes = await fetch(`/api/salary/structure/${sum.userId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (structRes.ok) {
              struct = await structRes.json();
            }
          } catch {}

          const base = struct ? struct.baseSalary : 2000;
          const userHra = struct ? struct.hra : 300;
          const userAllowances = struct ? struct.allowances : 100;
          const userDeductions = struct ? struct.deductions : 50;

          const dailyRate = base / totalWorkingDays;
          // Unpaid absences = absentDays + (halfDay * 0.5) + unpaid leaves
          // Note: leaveDays count in summary can include unpaid leaves.
          // Let's assume 100% of leaves here are casual/sick unless we query them.
          const unpaidAbsences = sum.absent + (sum.halfDay * 0.5);
          const absenceDeduction = dailyRate * unpaidAbsences;

          const calculatedNet = Math.max(0, base + userHra + userAllowances - userDeductions - absenceDeduction);

          return {
            userId: sum.userId,
            name: sum.name,
            baseSalary: base,
            hra: userHra,
            allowances: userAllowances,
            deductions: userDeductions,
            absenceDeduction,
            calculatedNet
          };
        })
      );

      setComputedRuns(runs);
      showToast('Payroll calculations completed. Review and confirm below.');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsComputing(false);
    }
  };

  const handleOverrideChange = (userId: string, val: string) => {
    setComputedRuns(prev => prev.map(p => p.userId === userId ? { ...p, overrideNetPay: val } : p));
  };

  const handleOverrideReasonChange = (userId: string, val: string) => {
    setComputedRuns(prev => prev.map(p => p.userId === userId ? { ...p, overrideReason: val } : p));
  };

  // Submit bulk payroll run
  const submitPayrollRun = async () => {
    setIsFinalizing(true);
    let successCount = 0;
    
    try {
      for (const run of computedRuns) {
        // Validation: if override is applied, reason is mandatory
        if (run.overrideNetPay !== undefined && !run.overrideReason) {
          showToast(`Override reason is required for ${run.name}`, 'error');
          setIsFinalizing(false);
          return;
        }

        const body: any = {
          userId: run.userId,
          month: parseInt(runMonth, 10),
          year: parseInt(runYear, 10)
        };

        if (run.overrideNetPay !== undefined) {
          body.overrideNetPay = run.overrideNetPay;
          body.overrideReason = run.overrideReason;
        }

        const res = await fetch('/api/salary/payslip/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });

        if (res.ok) {
          successCount++;
        }
      }

      showToast(`Successfully finalized and generated payslips for ${successCount} employees.`);
      setComputedRuns([]);
      fetchMyPayslips();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsFinalizing(false);
    }
  };

  const downloadPDF = async (payslipId: string, month: number, year: number) => {
    try {
      const response = await fetch(`/api/salary/payslip/${payslipId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('PDF Generation failed');
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${year}-${month}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const getMonthName = (month: number) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1] || 'N/A';
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-xl font-semibold text-white transition-all flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-secondary' : 'bg-primary'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-border/20 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2 bg-gradient-to-r from-text to-text/70 bg-clip-text text-transparent">
            <DollarSign className="w-7 h-7 text-primary" />
            Salary Portal & Payroll
          </h1>
          <p className="text-xs text-text/50">Manage payslips, configure basic salary structures, and finalize runs.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('my-slips')}
            className={`text-xs font-bold px-4 py-2.5 rounded-xl border transition-all ${
              activeTab === 'my-slips' 
                ? 'bg-text text-surface border-text' 
                : 'bg-surface/20 text-text/80 border-border/20 hover:bg-surface/30'
            }`}
          >
            My Payslips
          </button>
          
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('structures')}
                className={`text-xs font-bold px-4 py-2.5 rounded-xl border transition-all ${
                  activeTab === 'structures' 
                    ? 'bg-text text-surface border-text' 
                    : 'bg-surface/20 text-text/80 border-border/20 hover:bg-surface/30'
                }`}
              >
                Salary Configs
              </button>
              
              <button
                onClick={() => setActiveTab('payroll-run')}
                className={`text-xs font-bold px-4 py-2.5 rounded-xl border transition-all ${
                  activeTab === 'payroll-run' 
                    ? 'bg-text text-surface border-text' 
                    : 'bg-surface/20 text-text/80 border-border/20 hover:bg-surface/30'
                }`}
              >
                Run Payroll
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content tabs */}

      {/* 1. MY PAYSLIPS VIEW */}
      {activeTab === 'my-slips' && (
        <div className="bg-surface/20 border border-border/20 rounded-3xl p-6 backdrop-blur-md">
          <h2 className="text-lg font-extrabold flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-primary" />
            Your Payslip Archives
          </h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-border/20 text-xs font-bold uppercase text-text/50">
                  <th className="p-4">Pay Period</th>
                  <th className="p-4">Gross Earnings</th>
                  <th className="p-4">Total Deductions</th>
                  <th className="p-4 text-center">Duty Metrics (Present / Leave / Absent)</th>
                  <th className="p-4">Net Take-Home</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mySlips.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-xs font-bold text-text/30 italic">
                      No payslips generated for your profile yet.
                    </td>
                  </tr>
                ) : (
                  mySlips.map(slip => (
                    <tr key={slip.id} className="border-b border-border/10 hover:bg-surface/5 transition-all">
                      <td className="p-4 font-bold text-sm">
                        {getMonthName(slip.month)} {slip.year}
                      </td>
                      <td className="p-4 font-semibold text-sm text-text/80">
                        ${parseFloat(slip.grossPay).toFixed(2)}
                      </td>
                      <td className="p-4 font-semibold text-sm text-primary">
                        -${parseFloat(slip.deductions).toFixed(2)}
                      </td>
                      <td className="p-4 text-center text-xs font-bold text-text/60">
                        {slip.presentDays}d / {slip.leaveDays}d / {slip.absentDays}d
                      </td>
                      <td className="p-4 font-extrabold text-sm text-secondary">
                        ${parseFloat(slip.netPay).toFixed(2)}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => downloadPDF(slip.id, slip.month, slip.year)}
                          className="p-2 bg-surface hover:bg-surface-hover border border-border rounded-xl text-primary hover:shadow-md transition-all inline-flex items-center gap-1.5 font-bold text-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. CONFIGURE STRUCTURES */}
      {activeTab === 'structures' && isAdmin && (
        <div className="bg-surface/20 border border-border/20 rounded-3xl p-8 backdrop-blur-md max-w-2xl">
          <h2 className="text-lg font-extrabold flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-primary" />
            Configure Salary Structure
          </h2>
          <p className="text-xs text-text/50 mb-6">Salary components are fully encrypted via AES-256-GCM before writing to the database.</p>

          <form onSubmit={handleSaveStructure} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-text/60 uppercase mb-1">Select Employee</label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl p-3 text-sm focus:outline-none text-text font-bold"
              >
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text/60 uppercase mb-1">Base Salary Monthly ($)</label>
                <input
                  type="number"
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(parseFloat(e.target.value))}
                  className="w-full bg-bg border border-border rounded-xl p-3 text-sm focus:outline-none text-text font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text/60 uppercase mb-1">HRA Allowance ($)</label>
                <input
                  type="number"
                  value={hra}
                  onChange={(e) => setHra(parseFloat(e.target.value))}
                  className="w-full bg-bg border border-border rounded-xl p-3 text-sm focus:outline-none text-text font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text/60 uppercase mb-1">Special Allowances ($)</label>
                <input
                  type="number"
                  value={allowances}
                  onChange={(e) => setAllowances(parseFloat(e.target.value))}
                  className="w-full bg-bg border border-border rounded-xl p-3 text-sm focus:outline-none text-text font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text/60 uppercase mb-1">Structural Deductions ($)</label>
                <input
                  type="number"
                  value={deductions}
                  onChange={(e) => setDeductions(parseFloat(e.target.value))}
                  className="w-full bg-bg border border-border rounded-xl p-3 text-sm focus:outline-none text-text font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text/60 uppercase mb-1">Effective Date</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl p-3 text-sm focus:outline-none text-text font-bold"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                className="bg-primary text-white font-bold text-sm px-6 py-3 rounded-xl hover:shadow-lg transition-all"
              >
                Save Configuration
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. RUN BULK PAYROLL */}
      {activeTab === 'payroll-run' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-surface/20 border border-border/20 rounded-3xl p-6 backdrop-blur-md">
            <h2 className="text-lg font-extrabold flex items-center gap-2 mb-4">
              <Play className="w-5 h-5 text-secondary" />
              Monthly Payroll Run
            </h2>
            <p className="text-xs text-text/50">Run estimates, perform modifications, and finalise payslips for all active users.</p>

            <div className="flex flex-wrap items-center gap-3 mt-4">
              <div className="flex items-center gap-1 bg-bg border border-border p-1 rounded-xl">
                <select
                  value={runMonth}
                  onChange={(e) => setRunMonth(e.target.value)}
                  className="bg-transparent text-xs font-bold text-text p-2 focus:outline-none"
                >
                  <option value="01">January</option>
                  <option value="02">February</option>
                  <option value="03">March</option>
                  <option value="04">April</option>
                  <option value="05">May</option>
                  <option value="06">June</option>
                  <option value="07">July</option>
                  <option value="08">August</option>
                  <option value="09">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
                
                <select
                  value={runYear}
                  onChange={(e) => setRunYear(e.target.value)}
                  className="bg-transparent text-xs font-bold text-text p-2 focus:outline-none border-l border-border"
                >
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
              </div>

              <button
                disabled={isComputing}
                onClick={computeBulkEstimates}
                className="bg-secondary text-white font-bold text-xs px-5 py-3 rounded-xl hover:shadow-md transition-all inline-flex items-center gap-2"
              >
                {isComputing ? 'Computing...' : 'Calculate Estimates'}
              </button>
            </div>
          </div>

          {computedRuns.length > 0 && (
            <div className="bg-surface/20 border border-border/20 rounded-3xl p-6 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4 border-b border-border/10 pb-3">
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-text/60">Calculated Pay Estimates Review Table</h3>
                
                <button
                  disabled={isFinalizing}
                  onClick={submitPayrollRun}
                  className="bg-gradient-to-r from-primary to-primary/80 text-white font-extrabold text-xs px-6 py-3 rounded-xl hover:shadow-lg transition-all"
                >
                  {isFinalizing ? 'Finalizing...' : 'Finalize & Post Payroll'}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/20 text-text/50 font-bold uppercase">
                      <th className="p-3">Employee</th>
                      <th className="p-3">Salary Structure</th>
                      <th className="p-3">Absence Deduct</th>
                      <th className="p-3">Calculated Net</th>
                      <th className="p-3">Manual Override Net ($)</th>
                      <th className="p-3">Override Reason (Mandatory)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedRuns.map(run => (
                      <tr key={run.userId} className="border-b border-border/10">
                        <td className="p-3 font-bold">{run.name}</td>
                        <td className="p-3 text-text/70">
                          Base: {run.baseSalary} | HRA: {run.hra} | All: {run.allowances} | Ded: {run.deductions}
                        </td>
                        <td className="p-3 text-primary font-semibold">-${run.absenceDeduction.toFixed(2)}</td>
                        <td className="p-3 text-secondary font-extrabold">${run.calculatedNet.toFixed(2)}</td>
                        <td className="p-3">
                          <input
                            type="number"
                            placeholder="Override pay..."
                            value={run.overrideNetPay || ''}
                            onChange={(e) => handleOverrideChange(run.userId, e.target.value)}
                            className="bg-bg border border-border/60 rounded px-2.5 py-1 text-xs w-[120px] text-text font-bold"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            placeholder="Reason for override..."
                            value={run.overrideReason || ''}
                            onChange={(e) => handleOverrideReasonChange(run.userId, e.target.value)}
                            disabled={run.overrideNetPay === undefined || run.overrideNetPay === ''}
                            className="bg-bg border border-border/60 rounded px-2.5 py-1 text-xs w-full text-text placeholder-text/30 disabled:opacity-40"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
