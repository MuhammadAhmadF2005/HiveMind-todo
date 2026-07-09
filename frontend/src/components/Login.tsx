import React, { useState, useEffect, useRef } from 'react';

interface AuthProps {
  onAuthSuccess: (token: string, user: any) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const API_URL = 'http://localhost:5000';

  // Floating background blobs animation setup
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth / 2;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const blobs = [
      { x: canvas.width * 0.2, y: canvas.height * 0.3, r: 180, vx: 0.4, vy: 0.3, color: 'rgba(250, 204, 21, 0.12)' },
      { x: canvas.width * 0.8, y: canvas.height * 0.7, r: 240, vx: -0.3, vy: 0.5, color: 'rgba(250, 204, 21, 0.08)' },
      { x: canvas.width * 0.5, y: canvas.height * 0.8, r: 150, vx: 0.5, vy: -0.4, color: 'rgba(234, 179, 8, 0.1)' },
    ];

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      blobs.forEach(blob => {
        blob.x += blob.vx;
        blob.y += blob.vy;
        if (blob.x < -blob.r || blob.x > canvas.width + blob.r) blob.vx *= -1;
        if (blob.y < -blob.r || blob.y > canvas.height + blob.r) blob.vy *= -1;

        const gradient = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
        gradient.addColorStop(0, blob.color);
        gradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    const endpoint = isLogin ? '/auth/login' : '/auth/signup';
    const payload = isLogin 
      ? { email, password } 
      : { email, password, confirmPassword };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onAuthSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent', fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif', overflowX: 'hidden' }}>
      
      {/* Wrapper to hold box and mascot */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', maxWidth: '900px' }}>
        
        {/* Main Unified Card Container */}
        <div style={{
          display: 'flex',
          width: '100%',
          minHeight: '500px',
          backgroundColor: '#181920',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          position: 'relative',
          zIndex: 2
        }}>
        
        {/* Left Splash Screen - Now seamlessly integrated */}
        <div style={{ 
          flex: 1.2, 
          position: 'relative', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'space-between', 
          padding: '2.5rem 2.5rem',
          borderRight: '1px solid rgba(250, 204, 21, 0.1)',
          background: 'radial-gradient(circle at top left, rgba(20, 21, 28, 1) 0%, rgba(11, 12, 16, 1) 100%)',
          overflow: 'hidden'
        }} className="hide-on-mobile">
          <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
          
          {/* Left splash screen content wrapper */}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flex: 1, flexDirection: 'column' }}>
            
            <div style={{ marginTop: '0.5rem' }}>
              <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#f4f4f5', lineHeight: 1.15, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>
                Quiet the buzz.<br />
                <span style={{ color: '#d4d4d8' }}>Clear your</span> <span style={{ color: '#a1a1aa' }}>workspace.</span>
              </h2>

              <img 
                src="/mascot.png" 
                alt="HiveMind Mascot" 
                className="hide-on-mobile"
                style={{ 
                  width: '200px', 
                  height: '200px', 
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 20px rgba(250, 204, 21, 0.4))',
                  animation: 'float-mascot-inline 4s ease-in-out infinite',
                  marginLeft: '0.5rem'
                }} 
              />
            </div>
            
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '4rem', marginBottom: '0', marginLeft: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <h4 style={{ color: '#f4f4f5', margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>10x</h4>
                <p style={{ color: '#71717a', margin: 0, fontSize: '0.85rem', fontWeight: 500 }}>Productivity Boost</p>
              </div>
              <div style={{ width: '1px', background: 'rgba(250, 204, 21, 0.2)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <h4 style={{ color: '#f4f4f5', margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>Zero</h4>
                <p style={{ color: '#71717a', margin: 0, fontSize: '0.85rem', fontWeight: 500 }}>Missed Deadlines</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Screen */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: '2.5rem', 
          position: 'relative',
          backgroundColor: '#181920',
          backgroundImage: `
            url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='honeycomb' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23facc15;stop-opacity:0.08'/%3E%3Cstop offset='100%25' style='stop-color:%23fef08a;stop-opacity:0.04'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cg fill='none' stroke='url(%23honeycomb)' stroke-width='1.5'%3E%3Cpath d='M50,10 L80,25 L80,55 L50,70 L20,55 L20,25 Z'/%3E%3Cpath d='M0,35 L30,20 L30,50 L0,65 Z'/%3E%3Cpath d='M70,35 L100,20 L100,50 L70,65 Z'/%3E%3Cpath d='M50,75 L80,90 L80,100 L20,100 L20,90 Z'/%3E%3C/g%3E%3C/svg%3E"),
            linear-gradient(135deg, rgba(250, 204, 21, 0.08) 0%, transparent 100%)
          `,
          backgroundSize: '100px 100px, 100%',
          backgroundPosition: '0 0, 0 0',
          backgroundRepeat: 'repeat, no-repeat',
        }}>
          
          <div style={{ width: '100%', maxWidth: '380px' }}>
            <div style={{ marginBottom: '2.5rem' }}>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f4f4f5', marginTop: 0, marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>
                {isLogin ? 'Welcome back!' : 'Build Your Hive!'}
              </h3>
              <p style={{ fontSize: '0.95rem', color: '#a1a1aa', margin: 0 }}>
                {isLogin 
                  ? 'Enter your credentials to access your task matrix.' 
                  : 'Initialize your profile to start organizing your chaos.'}
              </p>
            </div>

            {error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '3px solid #ef4444', color: '#ef4444', padding: '0.85rem', borderRadius: '6px', marginBottom: '1.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e4e4e7' }}>Email Address</label>
                <input 
                  type="email" 
                  placeholder="name@company.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ padding: '0.85rem 1.1rem', borderRadius: '12px', border: '1px solid #272833', backgroundColor: '#0b0c10', color: '#fff', fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}
                  onFocus={(e) => { e.target.style.borderColor = '#facc15'; e.target.style.boxShadow = '0 0 0 3px rgba(250, 204, 21, 0.15), inset 0 2px 4px rgba(0,0,0,0.2)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#272833'; e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)'; }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e4e4e7' }}>Password</label>
                <input 
                  type="password" 
                  placeholder={isLogin ? "Enter your password" : "At least 6 characters"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ padding: '0.85rem 1.1rem', borderRadius: '12px', border: '1px solid #272833', backgroundColor: '#0b0c10', color: '#fff', fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}
                  onFocus={(e) => { e.target.style.borderColor = '#facc15'; e.target.style.boxShadow = '0 0 0 3px rgba(250, 204, 21, 0.15), inset 0 2px 4px rgba(0,0,0,0.2)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#272833'; e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)'; }}
                />
              </div>

              {!isLogin && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e4e4e7' }}>Confirm Password</label>
                  <input 
                    type="password" 
                    placeholder="Repeat your password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={{ padding: '0.85rem 1.1rem', borderRadius: '12px', border: '1px solid #272833', backgroundColor: '#0b0c10', color: '#fff', fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}
                    onFocus={(e) => { e.target.style.borderColor = '#facc15'; e.target.style.boxShadow = '0 0 0 3px rgba(250, 204, 21, 0.15), inset 0 2px 4px rgba(0,0,0,0.2)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#272833'; e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)'; }}
                  />
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                style={{ marginTop: '0.5rem', padding: '0.9rem', fontSize: '0.95rem', fontWeight: 800, backgroundColor: '#facc15', color: '#0b0c10', border: 'none', borderRadius: '10px', cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.3s ease', opacity: isLoading ? 0.8 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', boxShadow: '0 4px 12px rgba(250, 204, 21, 0.2)' }}
                onMouseOver={(e) => { if(!isLoading) { e.currentTarget.style.backgroundColor = '#eab308'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(250, 204, 21, 0.35)'; } }}
                onMouseOut={(e) => { if(!isLoading) { e.currentTarget.style.backgroundColor = '#facc15'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(250, 204, 21, 0.2)'; } }}
              >
                {isLoading ? 'Processing...' : (isLogin ? 'Log In' : 'Create Account')}
                {!isLoading && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3.33331 8H12.6666" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 3.33337L12.6667 8.00004L8 12.6667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </form>

            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
              <p style={{ fontSize: '0.85rem', color: '#a1a1aa', margin: 0 }}>
                {isLogin ? "Don't have an account yet? " : "Already have an account? "}
                <button 
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                  }} 
                  style={{ background: 'none', border: 'none', color: '#facc15', cursor: 'pointer', fontWeight: 600, padding: 0, textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.color = '#fef08a'}
                  onMouseOut={(e) => e.currentTarget.style.color = '#facc15'}
                >
                  {isLogin ? 'Sign up' : 'Log in'}
                </button>
              </p>
            </div>
          </div>
        </div>

        </div>
        
        {/* Style block inside the wrapper to apply animations and media queries */}
        <style>{`
          @keyframes float-mascot-inline {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-15px); }
          }
          @media (max-width: 900px) {
            .hide-on-mobile {
              display: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}