import { useState, useRef, useEffect } from 'react';
import type { Flair, Priority } from '../App';

const FLAIR_ICONS: Record<Flair, string> = {
  'Coursework': '📚',
  'Sport/Athleticism': '🏋️',
  'Home/Personal': '🏠',
  'Commitments': '🗓️',
  'Research': '🔬',
  'Work': '💼'
};

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

interface TodoListProps {
  todos: Todo[];
  onToggleTodo: (id: string) => void;
  onAddTodo: (title: string, flair: Flair, dueDate: string, priority: Priority) => void;
  onDeleteTodo: (id: string) => void;
}

interface HoneycombParticle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
  alpha: number;
  color: string;
}

const FLAIR_COLORS: Record<Flair, { bg: string; text: string }> = {
  'Coursework': { bg: '#2e2511', text: '#facc15' },       
  'Sport/Athleticism': { bg: '#14291f', text: '#4ade80' }, 
  'Home/Personal': { bg: '#1c2436', text: '#60a5fa' },     
  'Commitments': { bg: '#2d1624', text: '#f472b6' },      
  'Research': { bg: '#2d1a12', text: '#fb923c' },          
  'Work': { bg: '#27272a', text: '#e4e4e7' }               
};

export default function TodoList({ todos, onToggleTodo, onAddTodo, onDeleteTodo }: TodoListProps) {
  const [title, setTitle] = useState('');
  const [flair, setFlair] = useState<Flair>('Coursework');
  const [dueDate, setDueDate] = useState('');
  const [isHighPriority, setIsHighPriority] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<HoneycombParticle[]>([]);
  const ambientParticlesRef = useRef<{ x: number; y: number; vx: number; vy: number; size: number }[]>([]);
  const animationFrameId = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Live ref so the animation loop always reads the current pending count without stale closure
  const pendingCountRef = useRef<number>(0);

  // Sorting Engine: Chronological Date First -> High Priority Ties Second
  const sortedTodos = (items: Todo[]) => {
    return [...items].sort((a, b) => {
      const dateA = new Date(a.dueDate || '9999-12-31').getTime();
      const dateB = new Date(b.dueDate || '9999-12-31').getTime();
      if (dateA !== dateB) return dateA - dateB;
      
      const rankA = a.priority === 'High' ? 1 : 0;
      const rankB = b.priority === 'High' ? 1 : 0;
      return rankB - rankA;
    });
  };

  const pendingTodos = sortedTodos(todos.filter(t => !t.completed));
  const completedTodos = todos.filter(t => t.completed);

  // Keep the ref in sync on every render so the animation loop always has the live count
  pendingCountRef.current = pendingTodos.length;

  // Audio Context Setup
  useEffect(() => {
    const initAudio = () => {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtxRef.current = new AudioContextClass();
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    };
    window.addEventListener('click', initAudio);
    window.addEventListener('touchstart', initAudio);
    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('touchstart', initAudio);
    };
  }, []);

  const playBuzzSound = () => {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle'; 
      osc.frequency.setValueAtTime(160, ctx.currentTime); 
      osc.frequency.exponentialRampToValueAtTime(340, ctx.currentTime + 0.12); 
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15); 
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn('Audio fallback triggered:', e);
    }
  };

  // Click Explosion Particle Trigger
  const triggerHoneycombExplosion = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX > 0 ? (clientX - rect.left) : (canvas.width / 2);
    const y = clientY > 0 ? (clientY - rect.top) : (rect.height / 3);
    const honeyColors = ['#facc15', '#eab308', '#fef08a', '#ca8a04'];
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 3 + Math.random() * 6;
      particlesRef.current.push({
        x, y,
        size: 6 + Math.random() * 8,
        speedX: Math.cos(angle) * velocity,
        speedY: Math.sin(angle) * velocity - 2, 
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.25,
        alpha: 1,
        color: honeyColors[Math.floor(Math.random() * honeyColors.length)]
      });
    }
  };

  // HTML5 Particle Animation Canvas Pipeline (Dynamic Hive Ambient Engine Added)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    const updateAndRender = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 1. Read live pending count via ref — no stale closure
      const pendingCount = pendingCountRef.current;

      // 2. Smooth continuous scaling: every task adds ~4 particles and nudges speed up
      //    Capped at 60 particles so it never becomes a blizzard at high task counts
      const targetAmbientCount = pendingCount === 0 ? 0 : Math.min(60, pendingCount * 4);

      // Speed grows smoothly: starts gentle at 1 task, noticeably frantic by 8+
      // Using square-root curve so early tasks feel responsive but it doesn't go insane
      const speedMultiplier = pendingCount === 0 ? 0 : 0.8 + Math.sqrt(pendingCount) * 0.55;

      // Opacity also scales up subtly with busyness — more tasks = more visible swarm
      const swarmOpacity = Math.min(0.45, 0.15 + pendingCount * 0.03);

      // 3. Adjust Active Particle Pool — new particles spawned at random positions
      while (ambientParticlesRef.current.length < targetAmbientCount) {
        ambientParticlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 2 * speedMultiplier,
          vy: (Math.random() - 0.5) * 2 * speedMultiplier,
          size: 2 + Math.random() * 3.5
        });
      }
      while (ambientParticlesRef.current.length > targetAmbientCount) {
        ambientParticlesRef.current.pop();
      }

      // 4. Render Dynamic Worker Bee Swarm Background
      ctx.fillStyle = `rgba(250, 204, 21, ${swarmOpacity})`;
      ambientParticlesRef.current.forEach(p => {
        // Jitter scaled by speed so high-task swarms feel erratic and frantic
        p.x += p.vx + (Math.random() - 0.5) * speedMultiplier * 0.7;
        p.y += p.vy + (Math.random() - 0.5) * speedMultiplier * 0.7;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 4. Render Task Completion Burst Exploded Geometry
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.speedX; p.y += p.speedY; p.speedY += 0.15; p.rotation += p.rotationSpeed; p.alpha -= 0.02; 
        if (p.alpha <= 0) { particles.splice(i, 1); continue; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color; ctx.strokeStyle = '#0b0c10'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let side = 0; side < 6; side++) {
          ctx.lineTo(p.size * Math.cos((side * Math.PI) / 3), p.size * Math.sin((side * Math.PI) / 3));
        }
        ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      
      animationFrameId.current = requestAnimationFrame(updateAndRender);
    };
    
    updateAndRender();
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, []); // Runs once — live count is read via pendingCountRef inside the loop, no restarts needed

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>, id: string, currentlyCompleted: boolean) => {
    if (!currentlyCompleted) {
      const nativeEvent = e.nativeEvent as MouseEvent;
      playBuzzSound();
      triggerHoneycombExplosion(nativeEvent.clientX, nativeEvent.clientY);
    }
    onToggleTodo(id);
  };

  const handleTomorrowShortcut = (e: React.MouseEvent) => {
    e.preventDefault();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDueDate(tomorrow.toISOString().split('T')[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      const priorityValue: Priority = isHighPriority ? 'High' : 'Medium';
      onAddTodo(title.trim(), flair, dueDate, priorityValue);
      setTitle('');
      setDueDate('');
      setIsHighPriority(false);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && title.trim()) {
      handleSubmit(e as any);
    }
  };

  const renderTaskCard = (todo: Todo) => {
    const color = FLAIR_COLORS[todo.flair] || FLAIR_COLORS['Work'];
    const isTodoOverdue = todo.isOverdue && !todo.completed;
    const isTodoHighPriority = todo.priority === 'High' && !todo.completed && !isTodoOverdue;

    const cardBorder = isTodoOverdue
      ? '2px solid rgba(239, 68, 68, 0.45)' 
      : '2px solid rgba(250, 204, 21, 0.15)';

    const cardBackground = todo.completed 
      ? '#181920' 
      : isTodoOverdue
        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, transparent 100%), #181920'
        : 'linear-gradient(135deg, rgba(250, 204, 21, 0.03) 0%, transparent 100%), #181920';

  return (
      <li 
        key={todo.id} 
        style={{ 
          display: 'flex', flexDirection: 'column', padding: '1.2rem', gap: '0.65rem',
          backgroundColor: '#181920', border: cardBorder, borderRadius: '12px',
          opacity: todo.completed ? 0.5 : 1, transition: 'all 0.25s ease',
          boxShadow: isTodoOverdue 
            ? '0 4px 12px rgba(239, 68, 68, 0.15)' 
            : '0 2px 8px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(10px)', background: cardBackground, position: 'relative', width: '100%', boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >
        {/* Overdue Left Vertical Strip Indicator - Crimson Warning */}
        {isTodoOverdue && (
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', backgroundColor: '#ef4444', boxShadow: '0 0 10px #ef4444' }} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, paddingLeft: isTodoOverdue ? '0.25rem' : '0' }}>
            {/* Custom checkbox: visible border at rest, gold fill + ✓ when checked */}
            <div
              onClick={(e) => handleCheckboxChange(e as any, todo.id, todo.completed)}
              style={{
                width: '1.15rem', height: '1.15rem', flexShrink: 0, cursor: 'pointer', borderRadius: '4px',
                border: `2px solid ${todo.completed ? '#facc15' : '#52525b'}`,
                backgroundColor: todo.completed ? '#facc15' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease', boxSizing: 'border-box',
                boxShadow: todo.completed ? '0 0 8px rgba(250, 204, 21, 0.4)' : 'none'
              }}
              onMouseOver={(e) => {
                if (!todo.completed) {
                  e.currentTarget.style.borderColor = '#facc15';
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(250, 204, 21, 0.3)';
                }
              }}
              onMouseOut={(e) => {
                if (!todo.completed) {
                  e.currentTarget.style.borderColor = '#52525b';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {todo.completed && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 3.5L3.5 6.5L9 1" stroke="#0b0c10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span style={{ textDecoration: todo.completed ? 'line-through' : 'none', color: todo.completed ? '#71717a' : isTodoOverdue ? '#ef4444' : '#f4f4f5', fontSize: '0.95rem', fontWeight: isTodoOverdue ? 700 : 600, wordBreak: 'break-word' }}>
              {todo.title}
            </span>
          </div>

          {/* Trash icon remove button — cleaner and more universally readable than circled ✕ */}
          <button
            type="button"
            onClick={() => onDeleteTodo(todo.id)}
            title="Remove Task from Hive"
            style={{
              background: 'transparent',
              color: '#52525b',
              border: '1px solid transparent',
              borderRadius: '8px',
              padding: '0.4rem 0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              flexShrink: 0
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = '#52525b';
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Lid */}
              <path d="M1 3.5H14M5 3.5V2.5C5 2 5.5 1.5 6 1.5H9C9.5 1.5 10 2 10 2.5V3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              {/* Body */}
              <path d="M2.5 3.5L3.2 13C3.2 13.8 3.8 14.5 4.6 14.5H10.4C11.2 14.5 11.8 13.8 11.8 13L12.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              {/* Inner lines */}
              <path d="M6 7V11.5M9 7V11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', paddingLeft: isTodoOverdue ? '2.15rem' : '1.9rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.3rem 0.7rem', borderRadius: '6px', backgroundColor: color.bg, color: color.text, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)', flexShrink: 0 }}>
            <span>{FLAIR_ICONS[todo.flair]}</span>
            <span>{todo.flair}</span>
          </span>
          
          {/* ✅ FIXED: was checking isHighPriority (form state), now correctly checks isTodoHighPriority (per-todo value) */}
          {isTodoHighPriority && (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.3rem 0.5rem', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.08)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
              <span>🔥</span><span>High Priority</span>
            </span>
          )}

          {/* Overdue Warning Engine Badge - Uniquely Crimson & Distinct */}
          {isTodoOverdue && (
            <span 
              className="animate-pulse"
              style={{ 
                fontSize: '0.65rem', fontWeight: 800, padding: '0.3rem 0.6rem', borderRadius: '6px', 
                backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)',
                textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem', 
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.1)', flexShrink: 0
              }}
            >
              <span>⚠️</span><span>Overdue</span>
            </span>
          )}

          {todo.dueDate && (
            <span style={{ fontSize: '0.75rem', color: isTodoOverdue ? '#ef4444' : '#a1a1aa', fontWeight: isTodoOverdue ? 700 : 500 }}>
              📅 {todo.dueDate}
            </span>
          )}
        </div>
      </li>
    );
  };

  return (
    <div style={{ position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 10 }} />

      <form onSubmit={handleSubmit} style={{ backgroundColor: '#181920',
          backgroundImage: `
            url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='honeycomb' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23facc15;stop-opacity:0.08'/%3E%3Cstop offset='100%25' style='stop-color:%23fef08a;stop-opacity:0.04'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cg fill='none' stroke='url(%23honeycomb)' stroke-width='1.5'%3E%3Cpath d='M50,10 L80,25 L80,55 L50,70 L20,55 L20,25 Z'/%3E%3Cpath d='M0,35 L30,20 L30,50 L0,65 Z'/%3E%3Cpath d='M70,35 L100,20 L100,50 L70,65 Z'/%3E%3Cpath d='M50,75 L80,90 L80,100 L20,100 L20,90 Z'/%3E%3C/g%3E%3C/svg%3E"),
            linear-gradient(135deg, rgba(250, 204, 21, 0.08) 0%, transparent 100%)
          `,
          backgroundSize: '100px 100px, 100%',
          backgroundPosition: '0 0, 0 0',
          backgroundRepeat: 'repeat, no-repeat',
          border: '2px solid rgba(250, 204, 21, 0.2)', 
          borderRadius: '16px', 
          padding: '2rem', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.5rem', 
          marginBottom: '2rem',
          boxSizing: 'border-box',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(250, 204, 21, 0.1)'
          }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>🍯 What's pending?</label>
          <input 
            type="text" placeholder="e.g., Review project proposal" value={title}
            onChange={(e) => setTitle(e.target.value)} onKeyDown={handleTitleKeyDown} required
            style={{ width: '100%', padding: '0.9rem 1.1rem', borderRadius: '10px', border: '2px solid rgba(250, 204, 21, 0.2)', backgroundColor: '#0b0c10', color: '#fff', fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            onFocus={(e) => e.target.style.borderColor = '#facc15'} onBlur={(e) => e.target.style.borderColor = 'rgba(250, 204, 21, 0.2)'}
          />
        </div>

        {/* Row 1: Category + Due Date side by side, High Priority toggle pinned to the right */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>

          {/* Category — grows to fill available space */}
          <div style={{ flex: '2 1 160px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#71717a', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>Category</label>
            <select
              value={flair} onChange={(e) => setFlair(e.target.value as Flair)}
              style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', border: '2px solid rgba(250, 204, 21, 0.2)', backgroundColor: '#0b0c10', color: '#fff', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
              onFocus={(e) => e.target.style.borderColor = '#facc15'} onBlur={(e) => e.target.style.borderColor = 'rgba(250, 204, 21, 0.2)'}
            >
              <option value="Coursework">📚 Coursework</option>
              <option value="Sport/Athleticism">🏋️ Sport/Athleticism</option>
              <option value="Home/Personal">🏠 Home/Personal</option>
              <option value="Commitments">🗓️ Commitments</option>
              <option value="Research">🔬 Research</option>
              <option value="Work">💼 Work</option>
            </select>
          </div>

          {/* Due Date — fixed comfortable width, shortcut below */}
          <div style={{ flex: '2 1 160px', display: 'flex', flexDirection: 'column' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#71717a', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>Due Date</label>
            <input
              type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
              style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', border: '2px solid rgba(250, 204, 21, 0.2)', backgroundColor: '#0b0c10', color: '#fff', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
              onFocus={(e) => e.target.style.borderColor = '#facc15'} onBlur={(e) => e.target.style.borderColor = 'rgba(250, 204, 21, 0.2)'}
            />
            <div style={{ marginTop: '0.4rem' }}>
              <button
                onClick={handleTomorrowShortcut}
                style={{ background: 'rgba(250, 204, 21, 0.06)', border: '1px solid rgba(250, 204, 21, 0.2)', color: '#facc15', borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease', textTransform: 'uppercase' }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(250, 204, 21, 0.15)'; e.currentTarget.style.borderColor = '#facc15'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(250, 204, 21, 0.06)'; e.currentTarget.style.borderColor = 'rgba(250, 204, 21, 0.2)'; }}
              >
                ⚡ Due Tomorrow
              </button>
            </div>
          </div>

          {/* High Priority — compact toggle pill pinned right, self-aligns to input bottom */}
          <div style={{ flex: '0 0 auto' }} title="Mark this task to start early">
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#71717a', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>Priority</label>
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: '0.55rem',
                padding: '0.75rem 1rem',
                borderRadius: '10px', cursor: 'pointer', userSelect: 'none',
                border: `2px solid ${isHighPriority ? 'rgba(245, 158, 11, 0.6)' : 'rgba(250, 204, 21, 0.2)'}`,
                backgroundColor: isHighPriority ? 'rgba(245, 158, 11, 0.08)' : '#0b0c10',
                color: isHighPriority ? '#fbbf24' : '#71717a',
                fontSize: '0.85rem', fontWeight: 700,
                transition: 'all 0.2s ease', whiteSpace: 'nowrap',
                boxShadow: isHighPriority ? '0 0 12px rgba(245, 158, 11, 0.15)' : 'none'
              }}
            >
              <input
                type="checkbox" checked={isHighPriority} onChange={(e) => setIsHighPriority(e.target.checked)}
                style={{ display: 'none' }}
              />
              {/* Custom toggle dot */}
              <span style={{
                width: '1rem', height: '1rem', borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${isHighPriority ? '#fbbf24' : '#52525b'}`,
                backgroundColor: isHighPriority ? '#fbbf24' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease',
                boxShadow: isHighPriority ? '0 0 6px rgba(251, 191, 36, 0.5)' : 'none'
              }}>
                {isHighPriority && (
                  <svg width="6" height="5" viewBox="0 0 6 5" fill="none">
                    <path d="M0.5 2.5L2 4L5.5 1" stroke="#0b0c10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              🔥 High Priority
            </label>
          </div>
        </div>

        {/* Row 2: Submit — full width, clean and prominent */}
        <button
          type="submit"
          style={{ width: '100%', padding: '0.9rem', backgroundColor: '#facc15', color: '#0b0c10', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.3s ease', boxShadow: '0 4px 12px rgba(250, 204, 21, 0.2)' }}
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#eab308'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(250, 204, 21, 0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#facc15'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(250, 204, 21, 0.2)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          🐝 Add to Hive
        </button>
      </form>

      <div>
        <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#facc15', letterSpacing: '0.5px', marginBottom: '1rem', fontWeight: 800, backgroundImage: 'linear-gradient(90deg, #facc15, #fef08a)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>
          🐝 Active Buzz ({pendingTodos.length})
        </h4>
        {pendingTodos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', border: '2px dashed rgba(250, 204, 21, 0.2)', borderRadius: '14px', backgroundColor: 'rgba(250, 204, 21, 0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1.25rem', lineHeight: '1' }}>🍯</div>
            <p style={{ color: '#a1a1aa', fontSize: '1.1rem', margin: '0 0 0.4rem 0', fontWeight: 600, letterSpacing: '0.3px' }}>Sweet! No Buzz left.</p>
            <p style={{ color: '#71717a', fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>Time to recharge the Hive!</p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {pendingTodos.map(renderTaskCard)}
          </ul>
        )}
      </div>

      {completedTodos.length > 0 && (
        <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid rgba(250, 204, 21, 0.1)' }}>
          <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#71717a', letterSpacing: '0.5px', marginBottom: '0.35rem', fontWeight: 800 }}>
            ✨ Cleared Buzz ({completedTodos.length})
          </h4>
          <p style={{ fontSize: '0.73rem', color: '#52525b', fontWeight: 500, margin: '0 0 1rem 0', fontStyle: 'italic' }}>
            Completed tasks are automatically cleared after 5 days.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {completedTodos.map(renderTaskCard)}
          </ul>
        </div>
      )}
    </div>
  );
}