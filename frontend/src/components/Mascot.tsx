export default function Mascot() {
  return (
    <div style={{ position: 'relative', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Injecting CSS Keyframes directly into the document for the smooth hover/wing animations */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
          100% { transform: translateY(0px); }
        }
        @keyframes leftWingBuzz {
          0% { transform: rotate(-35deg) scaleX(1); }
          50% { transform: rotate(-50deg) scaleX(0.8); }
          100% { transform: rotate(-35deg) scaleX(1); }
        }
        @keyframes rightWingBuzz {
          0% { transform: rotate(35deg) scaleX(1); }
          50% { transform: rotate(50deg) scaleX(0.8); }
          100% { transform: rotate(35deg) scaleX(1); }
        }
      `}</style>

      {/* The Animated Mascot Wrapper */}
      <div style={{
        width: '32px',
        height: '24px',
        backgroundColor: '#facc15', // Main Hive Yellow
        borderRadius: '50% 50% 45% 45%',
        position: 'relative',
        boxShadow: '0 4px 10px rgba(250, 204, 21, 0.25)',
        animation: 'float 2.5s ease-in-out infinite',
        border: '2px solid #0b0c10',
        boxSizing: 'border-box'
      }}>
        {/* Left Wing */}
        <div style={{
          position: 'absolute',
          top: '-10px',
          left: '2px',
          width: '12px',
          height: '14px',
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          border: '1.5px solid #0b0c10',
          borderRadius: '50%',
          transformOrigin: 'bottom right',
          animation: 'leftWingBuzz 0.15s linear infinite'
        }} />

        {/* Right Wing */}
        <div style={{
          position: 'absolute',
          top: '-10px',
          right: '2px',
          width: '12px',
          height: '14px',
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          border: '1.5px solid #0b0c10',
          borderRadius: '50%',
          transformOrigin: 'bottom left',
          animation: 'rightWingBuzz 0.15s linear infinite'
        }} />

        {/* Charcoal Body Stripes */}
        <div style={{
          position: 'absolute',
          left: '25%',
          width: '4px',
          height: '100%',
          backgroundColor: '#181920',
          opacity: 0.85
        }} />
        <div style={{
          position: 'absolute',
          left: '50%',
          width: '4px',
          height: '100%',
          backgroundColor: '#181920',
          opacity: 0.85
        }} />

        {/* Tiny Minimalist Face Eyes */}
        <div style={{
          position: 'absolute',
          right: '5px',
          top: '6px',
          width: '3px',
          height: '3px',
          backgroundColor: '#181920',
          borderRadius: '50%'
        }} />
      </div>
    </div>
  );
}