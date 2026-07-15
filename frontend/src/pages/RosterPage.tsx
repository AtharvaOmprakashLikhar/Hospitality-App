import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Filter, 
  Clock, 
  AlertCircle 
} from 'lucide-react';
import { io } from 'socket.io-client';
import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';

interface Assignment {
  id: string;
  userId: string;
  role: 'MANAGER' | 'WAITER' | 'KITCHEN';
  section: string;
  shiftStart: string;
  shiftEnd: string;
  status: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Draggable shift chip
function DraggableShiftChip({ assignment, isReadOnly }: { assignment: Assignment; isReadOnly: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: assignment.id,
    disabled: isReadOnly,
    data: { assignment }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 999,
  } : undefined;

  // Determine styling based on role
  let badgeStyle = "bg-border border border-border text-text";
  if (assignment.role === 'MANAGER') {
    badgeStyle = "bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-sm";
  } else if (assignment.role === 'WAITER') {
    badgeStyle = "bg-primary text-white shadow-sm";
  } else if (assignment.role === 'KITCHEN') {
    badgeStyle = "bg-secondary text-white shadow-sm";
  }

  const startHour = new Date(assignment.shiftStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endHour = new Date(assignment.shiftEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-2.5 rounded-xl text-xs font-semibold select-none ${isReadOnly ? '' : 'cursor-grab active:cursor-grabbing'} ${badgeStyle} ${isDragging ? 'opacity-50' : ''} transition-all duration-150 hover:scale-[1.02] flex flex-col gap-1`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate">{assignment.section || 'General'}</span>
        <span className="text-[10px] opacity-75">{assignment.status}</span>
      </div>
      <div className="flex items-center gap-1 text-[10px] opacity-90">
        <Clock className="w-3 h-3 flex-shrink-0" />
        <span>{startHour} - {endHour}</span>
      </div>
    </div>
  );
}

// Droppable calendar cell
function DroppableCell({ 
  staffId, 
  dateStr, 
  children 
}: { 
  staffId: string; 
  dateStr: string; 
  children: React.ReactNode 
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${staffId}:${dateStr}`,
    data: { staffId, dateStr }
  });

  return (
    <div
      ref={setNodeRef}
      className={`p-2 min-h-[90px] border border-border/50 rounded-xl transition-all duration-200 ${
        isOver ? 'bg-primary/10 border-primary scale-[0.98]' : 'bg-surface/30'
      }`}
    >
      <div className="flex flex-col gap-1.5 h-full">
        {children}
      </div>
    </div>
  );
}

export default function RosterPage() {
  const { token, user, propertyId } = useAuthStore();
  const isReadOnly = user?.role !== 'ADMIN' && user?.role !== 'MANAGER';

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(d.setDate(diff));
  });

  // Filters
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');

  // Add Assignment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalUserId, setModalUserId] = useState('');
  const [modalRole, setModalRole] = useState<'MANAGER' | 'WAITER' | 'KITCHEN'>('WAITER');
  const [modalSection, setModalSection] = useState('');
  const [modalDate, setModalDate] = useState('');
  const [modalStart, setModalStart] = useState('09:00');
  const [modalEnd, setModalEnd] = useState('17:00');
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch roster
  const fetchRoster = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Calculate date boundaries
      const weekStartStr = currentWeekStart.toISOString().split('T')[0];
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      // Fetch assignments in week (limit to 100 for simplicity)
      const res = await fetch(`/api/staff/assignments?propertyId=${propertyId}&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load roster assignments");
      const data = await res.json();
      setAssignments(data.assignments || []);

      // Fetch users to populate staff rows and dropdowns
      // To get staff list scoped to property, we register a simple fetch for the property users
      const usersRes = await fetch(`/api/attendance/summary?from=${weekStartStr}&to=${weekEndStr}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (usersRes.ok) {
        const summaryData = await usersRes.json();
        setStaff(summaryData.map((s: any) => ({
          id: s.userId,
          name: s.name,
          email: s.email,
          role: 'WAITER' // fallback placeholder for display row
        })));
      } else {
        // Fallback: Use current user if summary fails
        setStaff([{ id: user!.id, name: user!.name, email: user!.email, role: user!.role }]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();

    // Socket.io live synchronization
    const socket = io({ path: '/socket.io' });
    socket.emit('join_property', propertyId);
    
    socket.on('staff:assignment:updated', () => {
      fetchRoster();
    });

    return () => {
      socket.disconnect();
    };
  }, [currentWeekStart, propertyId]);

  // Generate 7 days of the current week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const navigateWeek = (direction: 'next' | 'prev') => {
    setCurrentWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + (direction === 'next' ? 7 : -7));
      return next;
    });
  };

  // Add Assignment Submit
  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    if (!modalUserId || !modalDate || !modalStart || !modalEnd) {
      setFormError('Please fill in all fields');
      return;
    }

    const startDateTime = new Date(`${modalDate}T${modalStart}`);
    const endDateTime = new Date(`${modalDate}T${modalEnd}`);

    try {
      const response = await fetch('/api/staff/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: modalUserId,
          role: modalRole,
          section: modalSection,
          shiftStart: startDateTime.toISOString(),
          shiftEnd: endDateTime.toISOString()
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create shift assignment');
      }

      setIsModalOpen(false);
      setModalSection('');
      fetchRoster();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  // Drag and drop assignment reassign
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const assignmentId = active.id as string;
    const [targetStaffId, targetDateStr] = (over.id as string).split(':');

    // Find local shift info
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;

    // Check if target user/day is identical to origin
    const originDateStr = new Date(assignment.shiftStart).toISOString().split('T')[0];
    if (assignment.userId === targetStaffId && originDateStr === targetDateStr) return;

    // Calculate new shift starts/ends on the target day retaining original hours
    const origStart = new Date(assignment.shiftStart);
    const origEnd = new Date(assignment.shiftEnd);
    const targetDate = new Date(targetDateStr);

    const newStart = new Date(targetDate.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0));
    const newEnd = new Date(targetDate.setHours(origEnd.getHours(), origEnd.getMinutes(), 0, 0));

    try {
      const response = await fetch(`/api/staff/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: targetStaffId,
          shiftStart: newStart.toISOString(),
          shiftEnd: newEnd.toISOString()
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Shift overlap conflict');
      }

      fetchRoster();
    } catch (err: any) {
      alert(`Shift movement failed: ${err.message}`);
    }
  };

  // Filtering assignments
  const filteredAssignments = assignments.filter(a => {
    const roleMatches = !selectedRole || a.role === selectedRole;
    const sectionMatches = !selectedSection || (a.section && a.section.toLowerCase().includes(selectedSection.toLowerCase()));
    return roleMatches && sectionMatches;
  });

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-surface/40 backdrop-blur-md p-6 border border-border/30 rounded-2xl">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-text to-text/70 bg-clip-text text-transparent flex items-center gap-2">
            <CalendarIcon className="w-7 h-7 text-primary" />
            Staff Scheduling Roster
          </h1>
          <p className="text-sm text-text/60 mt-1">Drag-and-drop shifts to reallocate staff assignments instantly.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-bg/60 border border-border/40 p-1.5 rounded-xl">
            <button
              onClick={() => navigateWeek('prev')}
              className="p-1.5 rounded-lg hover:bg-surface/50 text-text/80 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold px-2 uppercase tracking-wider text-text/80">
              Week of {currentWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
            <button
              onClick={() => navigateWeek('next')}
              className="p-1.5 rounded-lg hover:bg-surface/50 text-text/80 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {!isReadOnly && (
            <button
              onClick={() => {
                setModalUserId(staff[0]?.id || '');
                setModalDate(new Date().toISOString().split('T')[0]);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-white font-bold text-sm px-4 py-2.5 rounded-xl hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Assignment
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      <div className="flex flex-wrap items-center gap-3 bg-surface/10 p-4 border border-border/20 rounded-xl">
        <Filter className="w-4 h-4 text-text/50" />
        <span className="text-xs font-bold tracking-wider text-text/50 uppercase mr-2">Filters:</span>
        
        {/* Role Chips */}
        {['', 'MANAGER', 'WAITER', 'KITCHEN'].map((role) => (
          <button
            key={role}
            onClick={() => setSelectedRole(role)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all border ${
              selectedRole === role 
                ? 'bg-primary text-white border-primary' 
                : 'bg-surface/20 text-text/70 border-border/30 hover:bg-surface/40'
            }`}
          >
            {role || 'ALL ROLES'}
          </button>
        ))}

        <input
          type="text"
          placeholder="Filter by section..."
          value={selectedSection}
          onChange={(e) => setSelectedSection(e.target.value)}
          className="ml-auto bg-surface/20 border border-border/30 text-xs rounded-xl px-3 py-1.5 max-w-[200px] focus:outline-none focus:border-primary text-text placeholder-text/30"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      {/* Roster grid */}
      {isLoading ? (
        <div className="grid grid-cols-8 gap-4">
          <div className="h-16 bg-surface/20 animate-pulse rounded-xl" />
          {Array.from({ length: 7 }).map((_, idx) => (
            <div key={idx} className="h-16 bg-surface/20 animate-pulse rounded-xl" />
          ))}
          {Array.from({ length: 24 }).map((_, idx) => (
            <div key={idx} className="h-32 bg-surface/10 animate-pulse rounded-xl col-span-1" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto bg-surface/20 border border-border/20 rounded-2xl backdrop-blur-md">
          <DndContext onDragEnd={handleDragEnd}>
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-border/20">
                  <th className="p-4 text-left text-xs font-bold text-text/50 uppercase tracking-wider min-w-[180px] bg-surface/10">Staff Roster</th>
                  {weekDays.map((day, idx) => (
                    <th key={idx} className="p-4 text-center text-xs font-bold text-text/70 uppercase tracking-wider bg-surface/5">
                      <div className="font-extrabold">{day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                      <div className="text-[10px] text-text/40 font-semibold">{day.getDate()} {day.toLocaleDateString(undefined, { month: 'short' })}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.id} className="border-b border-border/10 hover:bg-surface/5 transition-colors">
                    <td className="p-4 font-bold text-sm bg-surface/10">
                      <div className="flex flex-col">
                        <span>{member.name}</span>
                        <span className="text-xs text-text/40 font-normal">{member.email}</span>
                      </div>
                    </td>
                    {weekDays.map((day, idx) => {
                      const dateStr = day.toISOString().split('T')[0];
                      const dayAssignments = filteredAssignments.filter(a => {
                        const shiftDate = new Date(a.shiftStart).toISOString().split('T')[0];
                        return a.userId === member.id && shiftDate === dateStr;
                      });

                      return (
                        <td key={idx} className="p-2 align-top">
                          <DroppableCell staffId={member.id} dateStr={dateStr}>
                            {dayAssignments.length === 0 ? (
                              <div className="text-[10px] text-text/25 font-bold italic text-center py-6 select-none">Off</div>
                            ) : (
                              dayAssignments.map(assignment => (
                                <DraggableShiftChip 
                                  key={assignment.id} 
                                  assignment={assignment} 
                                  isReadOnly={isReadOnly} 
                                />
                              ))
                            )}
                          </DroppableCell>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </DndContext>
        </div>
      )}

      {/* Add Assignment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h2 className="text-lg font-extrabold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Assign Shift Schedule
            </h2>

            {formError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text/60 uppercase mb-1">Employee</label>
                <select
                  value={modalUserId}
                  onChange={(e) => setModalUserId(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm focus:outline-none text-text font-bold"
                >
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text/60 uppercase mb-1">Role Type</label>
                  <select
                    value={modalRole}
                    onChange={(e) => setModalRole(e.target.value as any)}
                    className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm focus:outline-none text-text font-bold"
                  >
                    <option value="WAITER">Waiter</option>
                    <option value="KITCHEN">Kitchen Staff</option>
                    <option value="MANAGER">Manager</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text/60 uppercase mb-1">Work Section</label>
                  <input
                    type="text"
                    placeholder="e.g. Floor 1, Bar"
                    value={modalSection}
                    onChange={(e) => setModalSection(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm focus:outline-none text-text placeholder-text/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text/60 uppercase mb-1">Shift Date</label>
                <input
                  type="date"
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm focus:outline-none text-text font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text/60 uppercase mb-1">Start Time</label>
                  <input
                    type="time"
                    value={modalStart}
                    onChange={(e) => setModalStart(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm focus:outline-none text-text font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text/60 uppercase mb-1">End Time</label>
                  <input
                    type="time"
                    value={modalEnd}
                    onChange={(e) => setModalEnd(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm focus:outline-none text-text font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-text/60 hover:bg-surface/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:shadow-lg transition-all"
                >
                  Save Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
