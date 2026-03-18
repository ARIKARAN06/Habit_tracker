import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [habits, setHabits] = useState([]);
  const [stats, setStats] = useState({ streak: 0, consistency: 0 });
  const [newHabit, setNewHabit] = useState('');
  const [allLogs, setAllLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('daily');
  const [chatOpen, setChatOpen] = useState(false);

  // Chatbot state
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hey there! 🤖 I\'m your AI Habit Coach. Ask me anything about your habits, or just say hi!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef(null);

  const getPast7Days = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    // Calculate offset to most recent Monday (Mon=1)
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(today.getDate() - mondayOffset + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  const weekDates = getPast7Days();
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const fetchData = async () => {
    try {
      const habitsRes = await axios.get(`${API_URL}/habits/`);
      setHabits(habitsRes.data);
      const logsRes = await axios.get(`${API_URL}/logs_all/`);
      setAllLogs(logsRes.data);
      const statsRes = await axios.get(`${API_URL}/stats/`);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const addHabit = async (e) => {
    e.preventDefault();
    if (!newHabit.trim()) return;
    try {
      await axios.post(`${API_URL}/habits/`, { title: newHabit });
      setNewHabit('');
      fetchData();
    } catch (error) { console.error('Error adding habit:', error); }
  };

  const toggleHabit = async (habitId, dateStr, currentCompletedStatus) => {
    try {
      await axios.post(`${API_URL}/logs/`, { habit_id: habitId, date: dateStr, completed: !currentCompletedStatus });
      fetchData();
    } catch (error) { console.error('Error toggling habit:', error); }
  };

  const deleteHabit = async (habitId, title) => {
    if (!window.confirm(`Delete "${title}"? This will remove all its logs too.`)) return;
    try {
      await axios.delete(`${API_URL}/habits/${habitId}`);
      fetchData();
    } catch (error) { console.error('Error deleting habit:', error); }
  };

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isSending) return;
    const userMsg = { role: 'user', content: chatInput };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput('');
    setIsSending(true);
    try {
      const res = await axios.post(`${API_URL}/chat/`, {
        messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        target_date: todayStr,
      });
      setChatMessages([...updatedMessages, { role: 'assistant', content: res.data.reply }]);
    } catch (error) {
      setChatMessages([...updatedMessages, { role: 'assistant', content: '⚠️ Connection error. Please check the backend server.' }]);
    }
    setIsSending(false);
  };

  // ===== Monthly Progress Helpers =====
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const getDaysInMonth = () => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push(dateStr);
    }
    return days;
  };

  const monthDays = getDaysInMonth();

  const getFirstDayOffset = () => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0=Sun
    // Convert to Mon-first: Mon=0, Tue=1, ..., Sun=6
    return firstDay === 0 ? 6 : firstDay - 1;
  };

  const getDayCompletionRate = (dateStr) => {
    if (habits.length === 0) return 0;
    const dayLogs = allLogs.filter(l => l.date === dateStr && l.completed);
    return dayLogs.length / habits.length;
  };

  const getHeatColor = (rate) => {
    if (rate === 0) return '#1a1a2e';
    if (rate <= 0.25) return '#00ffff15';
    if (rate <= 0.5) return '#00ffff33';
    if (rate <= 0.75) return '#00ffff66';
    if (rate < 1) return '#00ffff99';
    return '#00ffffcc';
  };

  const getMonthlyStats = () => {
    const today = new Date();
    let totalPossible = 0;
    let totalCompleted = 0;
    let perfectDays = 0;

    monthDays.forEach(dateStr => {
      const dayDate = new Date(dateStr + 'T00:00:00');
      if (dayDate > today) return; // skip future days
      totalPossible += habits.length;
      const dayLogs = allLogs.filter(l => l.date === dateStr && l.completed);
      totalCompleted += dayLogs.length;
      if (habits.length > 0 && dayLogs.length === habits.length) perfectDays++;
    });

    const overallRate = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
    return { overallRate, perfectDays, totalCompleted, totalPossible };
  };

  const tabStyle = (isActive) => ({
    padding: '12px 28px',
    borderRadius: '8px 8px 0 0',
    border: 'none',
    borderBottom: isActive ? '2px solid #00ffff' : '2px solid transparent',
    background: isActive ? '#12122a' : 'transparent',
    color: isActive ? '#00ffff' : '#555',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    fontSize: '0.85rem',
    transition: 'all 0.2s ease',
    textShadow: isActive ? '0 0 10px rgba(0, 255, 255, 0.5)' : 'none',
  });

  // ===== RENDER =====
  return (
    <div style={{ background: '#0a0a1a', minHeight: '100vh', padding: '24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header */}
        <header style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{
            fontSize: '2.5rem', fontWeight: 900,
            background: 'linear-gradient(90deg, #00ffff, #ff0080, #00ffff)',
            backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent',
            letterSpacing: '2px', textTransform: 'uppercase',
          }}>
            ⚡ HABIT TRACKER
          </h1>
          <p style={{ color: '#888', fontSize: '0.95rem', letterSpacing: '3px', textTransform: 'uppercase' }}>
            AI-Powered • Cyberpunk Edition
          </p>
        </header>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '0', borderBottom: '1px solid #ffffff11' }}>
          <button onClick={() => setActiveTab('daily')} style={tabStyle(activeTab === 'daily')}>⚡ Daily</button>
          <button onClick={() => setActiveTab('monthly')} style={tabStyle(activeTab === 'monthly')}>📅 Monthly</button>
        </div>

        {/* ============== DAILY TAB ============== */}
        {activeTab === 'daily' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', paddingTop: '24px', paddingBottom: '80px' }}>
            {/* Left Column - Habits */}
            <div>
              <div className="neon-border" style={{ background: '#12122a', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <h2 className="neon-text" style={{ fontSize: '1.2rem', color: '#00ffff', marginBottom: '16px', fontWeight: 700, letterSpacing: '1px' }}>
                  TODAY'S MISSIONS
                </h2>
                <form onSubmit={addHabit} style={{ display: 'flex', gap: '10px' }}>
                  <input type="text" value={newHabit} onChange={(e) => setNewHabit(e.target.value)}
                    placeholder="Add a new habit..."
                    style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid #00ffff33', background: '#0a0a1a', color: '#e0e0ff', fontSize: '0.95rem', outline: 'none' }}
                  />
                  <button type="submit" style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #ff0080', background: 'linear-gradient(135deg, #ff008033, #ff008011)', color: '#ff0080', fontWeight: 700, cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                    + ADD
                  </button>
                </form>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {habits.length === 0 ? (
                  <div className="neon-border" style={{ background: '#12122a', borderRadius: '12px', padding: '30px', textAlign: 'center', color: '#555' }}>
                    No missions loaded. Add your first habit above.
                  </div>
                ) : (
                  habits.map(habit => (
                    <div key={habit.id} className="neon-border" style={{ background: '#12122a', borderRadius: '12px', padding: '16px 20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#e0e0ff', letterSpacing: '0.5px' }}>
                          {habit.title}
                        </span>
                        <button onClick={() => deleteHabit(habit.id, habit.title)} title="Delete habit"
                          style={{
                            background: 'none', border: '1px solid #ff444444', borderRadius: '6px',
                            color: '#ff4444', cursor: 'pointer', padding: '4px 8px', fontSize: '0.75rem',
                            transition: 'all 0.2s ease', letterSpacing: '1px',
                          }}>
                          ✕
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {weekDates.map((dateStr, index) => {
                          const log = allLogs.find(l => l.habit_id === habit.id && l.date === dateStr);
                          const isCompleted = log ? log.completed : false;
                          const dateObj = new Date(dateStr + 'T00:00:00');
                          const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                          const isToday = dateStr === todayStr;
                          return (
                            <div key={dateStr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '40px' }}>
                              <span style={{ fontSize: '0.7rem', marginBottom: '6px', color: isToday ? '#00ffff' : '#555', fontWeight: isToday ? 700 : 400, letterSpacing: '1px', textTransform: 'uppercase' }}>
                                {dayName}
                              </span>
                              <button onClick={() => toggleHabit(habit.id, dateStr, isCompleted)} title={dateStr}
                                style={{
                                  width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  border: isCompleted ? '2px solid #00ffff' : isToday ? '2px dashed #ff008088' : '2px solid #333',
                                  background: isCompleted ? 'linear-gradient(135deg, #00ffff33, #00ffff11)' : '#0a0a1a',
                                  color: isCompleted ? '#00ffff' : '#333', cursor: 'pointer', transition: 'all 0.2s ease',
                                  boxShadow: isCompleted ? '0 0 10px rgba(0, 255, 255, 0.3)' : 'none',
                                }}>
                                {isCompleted && (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column - Stats only */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="cyber-pulse" style={{ background: 'linear-gradient(135deg, #1a0025, #12122a)', borderRadius: '12px', padding: '24px', border: '1px solid #ff008044' }}>
                <h3 className="neon-pink" style={{ color: '#ff0080', fontSize: '1rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '20px' }}>
                  SYSTEM STATUS
                </h3>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '8px', color: '#aaa', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    <span>Consistency</span>
                    <span style={{ color: '#00ffff', fontWeight: 700 }}>{stats.consistency}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#1a1a2e', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.consistency}%`, height: '100%', background: 'linear-gradient(90deg, #00ffff, #ff0080)', borderRadius: '4px', transition: 'width 1s ease', boxShadow: '0 0 10px rgba(0, 255, 255, 0.5)' }}></div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: '#ffffff08', padding: '14px', borderRadius: '10px', border: '1px solid #ffffff11' }}>
                  <div style={{ fontSize: '2rem' }}>🔥</div>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '2px', textTransform: 'uppercase' }}>Current Streak</p>
                    <p style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ff0080' }}>
                      {stats.streak} <span style={{ fontSize: '0.8rem', color: '#888' }}>DAYS</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============== MONTHLY TAB ============== */}
        {activeTab === 'monthly' && (() => {
          const mStats = getMonthlyStats();
          const offset = getFirstDayOffset();
          return (
            <div style={{ paddingTop: '24px' }}>
              {/* Month Stats Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {[
                  { label: 'Completion Rate', value: `${mStats.overallRate}%`, icon: '📊' },
                  { label: 'Perfect Days', value: mStats.perfectDays, icon: '⭐' },
                  { label: 'Tasks Done', value: mStats.totalCompleted, icon: '✅' },
                  { label: 'Total Possible', value: mStats.totalPossible, icon: '🎯' },
                ].map((stat, i) => (
                  <div key={i} className="neon-border" style={{
                    background: '#12122a', borderRadius: '12px', padding: '20px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{stat.icon}</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#00ffff', marginBottom: '4px' }}>{stat.value}</div>
                    <div style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '1px', textTransform: 'uppercase' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Calendar Heatmap */}
              <div className="neon-border" style={{ background: '#12122a', borderRadius: '12px', padding: '24px' }}>
                <h2 className="neon-text" style={{ fontSize: '1.2rem', color: '#00ffff', marginBottom: '20px', fontWeight: 700, letterSpacing: '1px' }}>
                  📅 {monthName.toUpperCase()} — COMPLETION HEATMAP
                </h2>

                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '6px' }}>
                  {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', color: '#555', letterSpacing: '1px', padding: '4px 0' }}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                  {/* Empty cells for offset */}
                  {Array.from({ length: offset }).map((_, i) => (
                    <div key={`empty-${i}`} style={{ aspectRatio: '1', borderRadius: '8px' }}></div>
                  ))}

                  {/* Day cells */}
                  {monthDays.map(dateStr => {
                    const dayNum = parseInt(dateStr.split('-')[2]);
                    const rate = getDayCompletionRate(dateStr);
                    const isFuture = new Date(dateStr + 'T00:00:00') > new Date();
                    const isCurrentDay = dateStr === todayStr;

                    return (
                      <div key={dateStr} title={`${dateStr}: ${Math.round(rate * 100)}% completed`} style={{
                        aspectRatio: '1',
                        borderRadius: '8px',
                        background: isFuture ? '#0f0f20' : getHeatColor(rate),
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: isCurrentDay ? '2px solid #ff0080' : '1px solid #ffffff08',
                        boxShadow: isCurrentDay ? '0 0 12px rgba(255, 0, 128, 0.4)' : rate === 1 ? '0 0 8px rgba(0, 255, 255, 0.3)' : 'none',
                        transition: 'all 0.2s ease',
                        cursor: 'default',
                        position: 'relative',
                      }}>
                        <span style={{
                          fontSize: '0.85rem',
                          fontWeight: isCurrentDay ? 900 : 600,
                          color: isFuture ? '#333' : rate > 0.5 ? '#fff' : '#888',
                        }}>
                          {dayNum}
                        </span>
                        {!isFuture && rate > 0 && (
                          <span style={{
                            fontSize: '0.55rem',
                            color: rate === 1 ? '#00ffff' : '#aaa',
                            marginTop: '2px',
                          }}>
                            {Math.round(rate * 100)}%
                          </span>
                        )}
                        {rate === 1 && !isFuture && (
                          <span style={{ position: 'absolute', top: '2px', right: '4px', fontSize: '0.6rem' }}>⭐</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#555', letterSpacing: '1px' }}>LESS</span>
                  {[0, 0.25, 0.5, 0.75, 1].map((rate, i) => (
                    <div key={i} style={{
                      width: '20px', height: '20px', borderRadius: '4px',
                      background: getHeatColor(rate),
                      border: '1px solid #ffffff11',
                    }}></div>
                  ))}
                  <span style={{ fontSize: '0.7rem', color: '#555', letterSpacing: '1px' }}>MORE</span>
                </div>
              </div>

              {/* Per-Habit Monthly Breakdown */}
              <div className="neon-border" style={{ background: '#12122a', borderRadius: '12px', padding: '24px', marginTop: '20px' }}>
                <h2 className="neon-text" style={{ fontSize: '1.1rem', color: '#00ffff', marginBottom: '20px', fontWeight: 700, letterSpacing: '1px' }}>
                  🎯 HABIT BREAKDOWN
                </h2>
                {habits.length === 0 ? (
                  <p style={{ color: '#555', textAlign: 'center' }}>No habits to display.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {habits.map(habit => {
                      const today = new Date();
                      const pastDays = monthDays.filter(d => new Date(d + 'T00:00:00') <= today);
                      const completedDays = pastDays.filter(d => allLogs.some(l => l.habit_id === habit.id && l.date === d && l.completed));
                      const rate = pastDays.length > 0 ? Math.round((completedDays.length / pastDays.length) * 100) : 0;

                      return (
                        <div key={habit.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.9rem', color: '#e0e0ff', fontWeight: 600 }}>{habit.title}</span>
                            <span style={{ fontSize: '0.8rem', color: rate >= 80 ? '#00ffff' : rate >= 50 ? '#ffaa00' : '#ff4444', fontWeight: 700 }}>
                              {rate}% ({completedDays.length}/{pastDays.length})
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: '#1a1a2e', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${rate}%`, height: '100%', borderRadius: '3px',
                              background: rate >= 80 ? 'linear-gradient(90deg, #00ffff, #00ff88)' : rate >= 50 ? 'linear-gradient(90deg, #ffaa00, #ff8800)' : 'linear-gradient(90deg, #ff4444, #ff0044)',
                              transition: 'width 0.8s ease',
                              boxShadow: rate >= 80 ? '0 0 8px rgba(0, 255, 255, 0.4)' : 'none',
                            }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ============== FLOATING AI CHATBOT ============== */}
      {/* Toggle Button */}
      <button onClick={() => setChatOpen(!chatOpen)} style={{
        position: 'fixed', bottom: chatOpen ? '390px' : '20px', right: '20px', zIndex: 1001,
        width: '56px', height: '56px', borderRadius: '50%',
        background: 'linear-gradient(135deg, #00ffff, #ff0080)',
        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 20px rgba(0, 255, 255, 0.4), 0 4px 15px rgba(0,0,0,0.5)',
        fontSize: '1.5rem', transition: 'transform 0.2s ease',
        transform: chatOpen ? 'rotate(45deg)' : 'rotate(0deg)',
      }}>
        {chatOpen ? '✕' : '🧠'}
      </button>

      {/* Chat Panel */}
      {chatOpen && (
        <div style={{
          position: 'fixed', bottom: '0', left: '0', right: '0', zIndex: 1000,
          height: '380px', display: 'flex', flexDirection: 'column',
          background: '#0d0d20', borderTop: '2px solid #00ffff44',
          boxShadow: '0 -4px 30px rgba(0, 255, 255, 0.15)',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 24px', borderBottom: '1px solid #00ffff22',
            display: 'flex', alignItems: 'center', gap: '10px', background: '#12122a',
          }}>
            <span style={{ fontSize: '1.3rem' }}>🧠</span>
            <span className="neon-text" style={{ color: '#00ffff', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '2px', textTransform: 'uppercase' }}>AI COACH</span>
            <span style={{ marginLeft: '8px', width: '8px', height: '8px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88', display: 'inline-block' }}></span>
            <button onClick={() => setChatOpen(false)} style={{
              marginLeft: 'auto', background: 'none', border: '1px solid #ffffff22', borderRadius: '6px',
              color: '#888', padding: '4px 12px', cursor: 'pointer', fontSize: '0.75rem', letterSpacing: '1px',
            }}>CLOSE</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {chatMessages.map((msg, i) => (
              <div key={i} className="chat-msg" style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '60%' }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #ff008044, #ff008022)' : '#1a1a2e',
                  border: msg.role === 'user' ? '1px solid #ff008055' : '1px solid #00ffff22',
                  color: '#ddd', fontSize: '0.85rem', lineHeight: 1.5,
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="chat-msg" style={{ alignSelf: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: '12px 12px 12px 2px', background: '#1a1a2e', border: '1px solid #00ffff22', color: '#00ffff', fontSize: '0.85rem' }}>
                  Analyzing... ⚡
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendChatMessage} style={{ display: 'flex', gap: '8px', padding: '12px 24px', borderTop: '1px solid #00ffff22', background: '#0a0a1a' }}>
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask your AI coach..." disabled={isSending}
              style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #00ffff33', background: '#12122a', color: '#e0e0ff', fontSize: '0.85rem', outline: 'none' }}
            />
            <button type="submit" disabled={isSending} style={{
              padding: '10px 24px', borderRadius: '8px', border: '1px solid #00ffff55',
              background: isSending ? '#333' : 'linear-gradient(135deg, #00ffff22, #00ffff11)',
              color: '#00ffff', fontWeight: 700, cursor: isSending ? 'not-allowed' : 'pointer', fontSize: '0.85rem',
            }}>
              SEND
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
