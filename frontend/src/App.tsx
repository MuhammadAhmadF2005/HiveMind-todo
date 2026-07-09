import { useState, useEffect } from 'react';

import TodoList from './components/TodoList';
import Auth from './components/Login';

export type Flair = 'Coursework' | 'Sport/Athleticism' | 'Home/Personal' | 'Commitments' | 'Research' | 'Work';
export type Priority = 'High' | 'Medium' | 'Low';

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  flair: Flair;
  dueDate: string;
  priority: Priority;
  userId: string;
  isOverdue?: boolean;
  completedAt?: string | null;
}

const BASE_URL = "http://localhost:5000";
const API_URL = `${BASE_URL}/api/todos`;

export default function App() {
  // 🔐 Auth States (Persisted in localStorage)
  const [token, setToken] = useState<string | null>(localStorage.getItem('hive_token'));
  const [user, setUser] = useState<{ id: number; email: string } | null>(() => {
    const saved = localStorage.getItem('hive_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [todos, setTodos] = useState<Todo[]>([]);
  const [currentDate, setCurrentDate] = useState<string>('');

  // 🗓️ Fixed Date Engine
  useEffect(() => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    };
    setCurrentDate(new Date().toLocaleDateString('en-US', options));
  }, []);

  // 📥 INITIAL FETCH FROM BACKEND CONTAINER
  useEffect(() => {
    if (token) {
      const fetchTodos = async () => {
        try {
          const response = await fetch(API_URL, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          // If token is expired or invalid, boot the user back to login
          if (response.status === 401 || response.status === 403) {
            handleLogout();
            return;
          }

          if (!response.ok) throw new Error('Data layer sync failed');
          const data = await response.json();
          setTodos(data);
        } catch (error) {
          console.error("❌ Failed fetching row matrices from Docker DB:", error);
        }
      };
      fetchTodos();
    }
  }, [token]);

  const handleAuthSuccess = (newToken: string, userData: any) => {
    localStorage.setItem('hive_token', newToken);
    localStorage.setItem('hive_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('hive_token');
    localStorage.removeItem('hive_user');
    setToken(null);
    setUser(null);
    setTodos([]);
  };

  // 🔄 TOGGLE TASK DATA LAYER COMMIT
  const handleToggleTodo = async (id: string) => {
    const targetTodo = todos.find(t => t.id === id);
    if (!targetTodo) return;

    // Optimistically update UI state first for snappy interface performance
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ completed: !targetTodo.completed })
      });
      if (!response.ok) throw new Error('PATCH transaction failed');
    } catch (error) {
      console.error("❌ Database synchronization rollback:", error);
      // Revert back if backend transaction fails
      setTodos(todos);
    }
  };

  // 📤 ADD NEW TASK ROW TRANSACTION
  const handleAddTodo = async (title: string, flair: Flair, dueDate: string, priority: Priority) => {
    const fallbackDate = dueDate || new Date().toISOString().split('T')[0];

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, flair, dueDate: fallbackDate, priority })
      });

      if (!response.ok) throw new Error('POST write action failed');
      
      const savedTodo = await response.json();
      setTodos([savedTodo, ...todos]); // Prepend fresh database entry onto state list
    } catch (error) {
      console.error("❌ Failed to push new row to central stack:", error);
    }
  };

  // 🗑️ PURGE ROW TRANSITION
  const handleDeleteTodo = async (id: string) => {
    // Optimistic purge for smooth UX
    const originalTodos = [...todos];
    setTodos(todos.filter(todo => todo.id !== id));

    try {
      const response = await fetch(`${API_URL}/${id}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('DELETE execution failed');
    } catch (error) {
      console.error("❌ Failed to drop table row item:", error);
      setTodos(originalTodos); // Roll back state list on connection barrier
    }
  };

  return (
    <div style={{ 
      backgroundColor: '#0b0c10', 
      backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(250, 204, 21, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(250, 204, 21, 0.03) 0%, transparent 50%)',
      color: '#f4f4f5', 
      minHeight: '100vh', 
      padding: '3rem 1.5rem',
      fontFamily: '"Plus Jakarta Sans", "Inter", -apple-system, sans-serif',
    }}>

      {/* Dynamic Calendar Header */}
      {token && (
        <div style={{ maxWidth: '650px', margin: '0 auto 0.5rem auto', textAlign: 'right', fontSize: '0.9rem', color: '#71717a', fontWeight: 600 }}>
          {currentDate}
        </div>
      )}

      {token ? (
        <header style={{ 
          maxWidth: '800px', 
          margin: '0 auto 2.5rem auto', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          paddingBottom: '1.5rem',
          borderBottom: '1px solid rgba(250, 204, 21, 0.1)'
        }}>
          {/* Brand Container */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            
            {/* Top Row: Brand Name + Mascot PNG */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
              <h1 style={{ 
                fontSize: '2.8rem', 
                fontWeight: 900, 
                color: '#facc15', 
                margin: 0, 
                letterSpacing: '-0.04em', 
                lineHeight: 1
              }}>
                HiveMind
              </h1>
              <img 
                src="/mascot.png" 
                alt="HiveMind Mascot" 
                style={{ 
                  width: '72px',
                  height: '72px', 
                  objectFit: 'contain',
                  flexShrink: 0,
                  filter: 'drop-shadow(0 0 12px rgba(250, 204, 21, 0.3))',
                  transition: 'transform 0.3s ease',
                  animation: 'gentle-bounce 3s ease-in-out infinite'
                }} 
              />
              <style>{`
                @keyframes gentle-bounce {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(-8px); }
                }
              `}</style>
            </div>

            {/* Bottom Row: Subdued, clean tagline */}
            <p style={{ 
              margin: 0, 
              fontSize: '1.05rem', 
              color: '#a1a1aa', 
              fontWeight: 600,
              letterSpacing: '0.02em'
            }}>
              — quiet the buzz, clear your workspace.
            </p>
          </div>

          {/* User Stats Display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            {user && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
                  {/* Circular Progress */}
                  <div style={{ position: 'relative', width: '60px', height: '60px' }}>
                    <svg width="60" height="60" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="30" cy="30" r="28" fill="none" stroke="rgba(250, 204, 21, 0.1)" strokeWidth="2" />
                      <circle 
                        cx="30" 
                        cy="30" 
                        r="28" 
                        fill="none" 
                        stroke="#facc15" 
                        strokeWidth="2" 
                        strokeDasharray={`${(todos.filter(t => t.completed).length / Math.max(todos.length, 1)) * 176} 176`}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dasharray 0.5s ease' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: '#71717a', fontWeight: 600 }}>DONE</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#facc15' }}>{todos.filter(t => t.completed).length}/{todos.length}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ fontSize: '0.9rem', color: '#e4e4e7', fontWeight: 700 }}>Welcome back!</span>
                    <span style={{ fontSize: '0.7rem', color: '#71717a', fontWeight: 500 }}>{user.email}</span>
                  </div>
                </div>
                <button 
                  onClick={handleLogout} 
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', borderRadius: '8px', border: '1px solid #facc15', backgroundColor: 'transparent', color: '#facc15', textTransform: 'uppercase', transition: '0.3s ease', boxShadow: '0 0 8px rgba(250, 204, 21, 0)' }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#facc15'; e.currentTarget.style.color = '#0b0c10'; e.currentTarget.style.boxShadow = '0 0 12px rgba(250, 204, 21, 0.4)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#facc15'; e.currentTarget.style.boxShadow = '0 0 8px rgba(250, 204, 21, 0)'; }}
                >
                  Log Out
                </button>
              </>
            )}
          </div>
        </header>
      ) : (
        <header style={{ 
          maxWidth: '1150px', 
          margin: '0 auto 1.5rem auto', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          paddingBottom: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', background: '#facc15', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(250, 204, 21, 0.4)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#0b0c10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="#0b0c10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="#0b0c10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 style={{ 
              fontSize: '2.8rem', 
              fontWeight: 900, 
              color: '#facc15', 
              margin: 0, 
              letterSpacing: '-0.04em', 
              lineHeight: 1
            }}>
              HiveMind
            </h1>
          </div>
        </header>
      )}

      <main style={{ maxWidth: token ? '650px' : '100%', margin: '0 auto' }}>
        {!token ? (
          <Auth onAuthSuccess={handleAuthSuccess} />
        ) : (
          <TodoList 
            todos={todos} 
            onToggleTodo={handleToggleTodo} 
            onAddTodo={(title, flair, dueDate, priority) => handleAddTodo(title, flair, dueDate, priority)} 
            onDeleteTodo={handleDeleteTodo} 
          />
        )}
      </main>
    </div>
  );
}