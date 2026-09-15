import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import logoPreface from '../assets/logo-preface.jpeg'

// ── WebGL contour shader ────────────────────────────────────────────────────
const VERT = `attribute vec2 a_pos; void main(){ gl_Position = vec4(a_pos,0.0,1.0); }`
const FRAG =
`#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 u_res; uniform vec2 u_mouse; uniform float u_time; uniform float u_int;
uniform vec4 u_rip[6]; uniform int u_ripN;
float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  float a=hash21(i),b=hash21(i+vec2(1.,0.)),c=hash21(i+vec2(0.,1.)),d=hash21(i+vec2(1.,1.));
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
float fbm(vec2 p){ float v=0.,a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<5;i++){ v+=a*vnoise(p); p=m*p; a*=.5; } return v; }
float ripW(vec2 p){ float s=0.; for(int i=0;i<6;i++){ if(i>=u_ripN) break; vec4 r=u_rip[i];
  float age=u_time-r.z; if(age<0.) continue; float d=distance(p,r.xy); float rad=age*430.;
  float ring=d-rad; float w=80.; s+=sin(ring*.045)*exp(-age*1.5)*exp(-(ring*ring)/(2.*w*w)); } return s; }
float ripR(vec2 p){ float s=0.; for(int i=0;i<6;i++){ if(i>=u_ripN) break; vec4 r=u_rip[i];
  float age=u_time-r.z; if(age<0.) continue; float d=distance(p,r.xy); float ring=abs(d-age*430.);
  s+=exp(-age*1.9)*smoothstep(26.,0.,ring); } return s; }
void main(){ vec2 frag=gl_FragCoord.xy; vec2 uv=(frag-0.5*u_res)/u_res.y; vec2 m=(u_mouse-0.5*u_res)/u_res.y;
  float t=u_time*0.04; vec2 p=uv*2.2; float md=distance(uv,m); vec2 dir=uv-m;
  float bump=exp(-md*md*3.2)*(0.5+0.9*u_int); p+=normalize(dir+1e-4)*bump*0.85;
  float f=fbm(p+vec2(t,-t*0.6)); f+=ripW(frag)*0.16*(0.5+u_int);
  float lines=f*15.0; float e=abs(fract(lines)-0.5); float w=fwidth(lines);
  float contour=smoothstep(0.04,0.04+w*2.2,e);
  vec3 col=vec3(0.962); col*=mix(0.55,1.0,contour); col*=0.94+0.06*f;
  col-=ripR(frag)*0.13; col+=exp(-md*md*7.0)*0.045;
  col+=(hash21(frag+u_time)-0.5)*0.018; col*=1.0-0.06*dot(uv,uv);
  gl_FragColor=vec4(col,1.0); }`

function HeroCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: true })
    if (!gl) return
    gl.getExtension('OES_standard_derivatives')
    function sh(type, src) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null }
      return s
    }
    const prog = gl.createProgram()
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG)
    if (vs) gl.attachShader(prog, vs); if (fs) gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    const glBuf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, glBuf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'a_pos')
    const U = n => gl.getUniformLocation(prog, n)
    const uRes=U('u_res'),uMouse=U('u_mouse'),uTime=U('u_time'),uInt=U('u_int'),uRip=U('u_rip'),uRipN=U('u_ripN')
    let dpr=Math.min(window.devicePixelRatio||1,1.5), W=0, H=0
    const mouse={tx:0,ty:0,x:0,y:0}
    const ripples=[]; const ripBuf=new Float32Array(24)
    const start=performance.now()
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches
    function resize(){
      dpr=Math.min(window.devicePixelRatio||1,1.5)
      const r=canvas.getBoundingClientRect()
      W=Math.round(r.width*dpr); H=Math.round(r.height*dpr)
      canvas.width=W; canvas.height=H; gl.viewport(0,0,W,H)
      if(mouse.x===0&&mouse.y===0){mouse.tx=mouse.x=W*0.62;mouse.ty=mouse.y=H*0.6}
    }
    window.addEventListener('resize',resize); resize()
    function toLocal(cx,cy){const r=canvas.getBoundingClientRect();mouse.tx=(cx-r.left)*dpr;mouse.ty=(r.height-(cy-r.top))*dpr}
    const onMove=e=>toLocal(e.clientX,e.clientY)
    const onDown=e=>{
      if(e.target.closest('button,a,input'))return
      toLocal(e.clientX,e.clientY)
      const r=canvas.getBoundingClientRect()
      ripples.push({x:(e.clientX-r.left)*dpr,y:(r.height-(e.clientY-r.top))*dpr,start:(performance.now()-start)/1000})
      while(ripples.length>6)ripples.shift()
    }
    window.addEventListener('pointermove',onMove,{passive:true})
    canvas.parentElement?.addEventListener('pointerdown',onDown,{passive:true})
    let rafId
    function loop(now){
      rafId=requestAnimationFrame(loop)
      const rect=canvas.getBoundingClientRect()
      if(rect.bottom<0||rect.top>window.innerHeight)return
      const t=(now-start)/1000*(reduce?0.3:1)
      mouse.x+=(mouse.tx-mouse.x)*0.07; mouse.y+=(mouse.ty-mouse.y)*0.07
      for(let i=ripples.length-1;i>=0;i--){if(t-ripples[i].start>6)ripples.splice(i,1)}
      const n=ripples.length
      for(let i=0;i<n;i++){ripBuf[i*4]=ripples[i].x;ripBuf[i*4+1]=ripples[i].y;ripBuf[i*4+2]=ripples[i].start;ripBuf[i*4+3]=0}
      gl.useProgram(prog); gl.bindBuffer(gl.ARRAY_BUFFER,glBuf)
      gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,0,0)
      gl.uniform2f(uRes,W,H); gl.uniform2f(uMouse,mouse.x,mouse.y)
      gl.uniform1f(uTime,t); gl.uniform1f(uInt,0.55); gl.uniform1i(uRipN,n)
      if(n>0)gl.uniform4fv(uRip,ripBuf.subarray(0,n*4))
      gl.drawArrays(gl.TRIANGLES,0,3)
    }
    requestAnimationFrame(loop)
    return()=>{cancelAnimationFrame(rafId);window.removeEventListener('resize',resize);window.removeEventListener('pointermove',onMove);canvas.parentElement?.removeEventListener('pointerdown',onDown)}
  },[])
  return <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',display:'block',zIndex:0}} />
}

// ── Constants ───────────────────────────────────────────────────────────────
const RED      = '#ED1B24'
const RED_DEEP = '#c8141c'
const BG       = '#F5F3EF'
const INK      = '#1a1714'
const INK_SOFT = '#6b6560'
const INK_FAINT= '#9a9690'
const LINE     = 'rgba(180,174,163,0.65)'
const LINE_SOFT= 'rgba(180,174,163,0.35)'
const MONO     = '"JetBrains Mono", ui-monospace, monospace'
const SANS     = '"Space Grotesk", system-ui, sans-serif'

function Btn({ children, red, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
        padding: '10px 18px', border: `1px solid ${red ? RED : INK}`,
        background: red ? (hov ? RED_DEEP : RED) : (hov ? INK : 'transparent'),
        color: red ? '#fff' : (hov ? BG : INK),
        cursor: 'pointer', transition: 'all .18s ease',
        display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [clock, setClock] = useState('')

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true }); fn()
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    const tick = () => {
      const d = new Date(), p = n => String(n).padStart(2,'0')
      setClock(p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds()))
    }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  const goLogin = useCallback(() => navigate('/login'), [navigate])

  return (
    <div style={{ fontFamily: SANS, color: INK, background: BG, overflowX: 'clip', WebkitFontSmoothing: 'antialiased' }}>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav id="lp-nav" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
        background: scrolled ? 'rgba(245,243,239,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px) saturate(1.1)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(14px) saturate(1.1)' : 'none',
        borderBottom: `1px solid ${scrolled ? LINE_SOFT : 'transparent'}`,
        transition: 'background .35s ease, border-color .35s ease',
      }}>
        <div className="lp-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          {/* Brand */}
          <a href="#top" className="lp-brand" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
            onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            <img src={logoPreface} alt="Preface" style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '0.26em', color: INK }}>PREFACE</span>
            <span className="lp-brand-sub" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: INK_FAINT, textTransform: 'uppercase', borderLeft: `1px solid ${LINE}`, paddingLeft: 10, marginLeft: 2 }}>
              Internal System
            </span>
          </a>
          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="https://career.prefacesystem.com"
              style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK_SOFT, textDecoration: 'none' }}>
              Career
            </a>
            <Btn red onClick={goLogin}>Sign in</Btn>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <header id="top" style={{ position: 'relative', minHeight: '100svh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <HeroCanvas />

        {/* scrim — full on mobile, directional on desktop */}
        <div className="lp-scrim" style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }} />

        {/* corner ticks — hidden on mobile via CSS */}
        <div className="lp-corner lp-corner-tl" style={{ position:'absolute', width:24, height:24, border:`solid ${LINE}`, borderWidth:0, top:80, left:20, borderTopWidth:1.5, borderLeftWidth:1.5, zIndex:2 }} />
        <div className="lp-corner lp-corner-bl" style={{ position:'absolute', width:24, height:24, border:`solid ${LINE}`, borderWidth:0, bottom:24, left:20, borderBottomWidth:1.5, borderLeftWidth:1.5, zIndex:2 }} />

        <div className="lp-wrap lp-hero-content" style={{ position: 'relative', zIndex: 2, width: '100%' }}>
          {/* eyebrow */}
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: INK_FAINT, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 20, height: 1.5, background: RED, display: 'inline-block', flexShrink: 0 }} />
            Preface System · Internal Management
          </div>

          {/* headline */}
          <h1 className="lp-h1" style={{ fontWeight: 600, lineHeight: 1.02, letterSpacing: '-0.02em', margin: '20px 0 20px', fontFamily: SANS, color: INK }}>
            One system to run<br />the{' '}
            <em style={{ fontStyle: 'normal', color: RED }}>wear</em>house.
          </h1>

          {/* body */}
          <p className="lp-body" style={{ color: INK_SOFT, lineHeight: 1.65, margin: 0, maxWidth: 520 }}>
            The internal management system for Preface Wearhouse — covering inventory, task management, HR, vendor portal, and everything else a fashion operation runs on.
          </p>

          {/* CTA */}
          <div style={{ marginTop: 32 }}>
            <Btn red onClick={goLogin}>Sign in →</Btn>
          </div>

          {/* status chip */}
          <div className="lp-chip" style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 36,
            fontFamily: MONO, letterSpacing: '0.12em', color: INK_SOFT,
            textTransform: 'uppercase', padding: '8px 14px', border: `1px solid ${LINE}`,
            background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            flexWrap: 'wrap',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', flexShrink: 0, animation: 'lp-ping 2.6s ease-out infinite' }} />
            <span>All systems operational</span>
            <span style={{ color: LINE_SOFT }}>·</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{clock} WIB</span>
          </div>
        </div>

        {/* surface note — desktop only */}
        <div className="lp-surface-note" style={{
          position: 'absolute', right: 40, bottom: 28, zIndex: 2,
          fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: INK_FAINT, display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <span style={{ width: 18, height: 1.5, background: RED, display: 'inline-block' }} />
          Interactive surface — move &amp; click
        </div>
      </header>

      {/* ── SUPPORT ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 0 0', background: '#EFEDE9', borderTop: `1px solid ${LINE_SOFT}` }}>
        <div className="lp-wrap">
          <div className="lp-support-grid">
            <div className="lp-support-title" style={{ fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.1, color: INK }}>
              Access is provisioned by the operations team.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ContactLink label="admin@prefacewearhouse.com →" href="mailto:admin@prefacewearhouse.com" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer style={{ borderTop: `1px solid ${LINE}`, marginTop: 72, padding: '28px 0 36px' }}>
          <div className="lp-wrap lp-footer-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={logoPreface} alt="Preface" style={{ width: 26, height: 26, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.26em', color: INK }}>PREFACE</span>
              <span className="lp-footer-sub" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: INK_FAINT, textTransform: 'uppercase', borderLeft: `1px solid ${LINE}`, paddingLeft: 10, marginLeft: 2 }}>
                System v2.4
              </span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: INK_FAINT, textTransform: 'uppercase', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span>Internal use only</span>
              <span>© 2026 Preface Wearhouse</span>
            </div>
          </div>
        </footer>
      </section>

      <style>{`
        /* ── base (mobile-first) ── */
        .lp-wrap {
          max-width: 1240px;
          margin: 0 auto;
          padding: 0 20px;
        }
        .lp-hero-content {
          padding-top: 96px;
          padding-bottom: 48px;
        }
        .lp-h1 {
          font-size: clamp(36px, 10vw, 86px);
        }
        .lp-body {
          font-size: 15px;
        }
        .lp-chip {
          font-size: 10px;
        }
        .lp-scrim {
          background: rgba(245,243,239,0.78);
        }
        .lp-corner { display: none; }
        .lp-surface-note { display: none; }
        .lp-brand-sub { display: none; }
        .lp-support-grid {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }
        .lp-support-title {
          font-size: clamp(22px, 5vw, 38px);
        }
        .lp-footer-inner {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .lp-footer-sub { display: none; }

        /* ── tablet (≥ 640px) ── */
        @media (min-width: 640px) {
          .lp-wrap { padding: 0 32px; }
          .lp-body { font-size: 17px; }
          .lp-chip { font-size: 11px; }
          .lp-brand-sub { display: inline; }
          .lp-corner { display: block; }
          .lp-scrim {
            background: linear-gradient(100deg, #F5F3EF 0%, rgba(245,243,239,0.72) 40%, transparent 68%);
          }
        }

        /* ── desktop (≥ 960px) ── */
        @media (min-width: 960px) {
          .lp-wrap { padding: 0 40px; }
          #lp-nav .lp-wrap { height: 68px !important; }
          .lp-body { font-size: 19px; }
          .lp-surface-note { display: flex; }
          .lp-support-grid {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 48px;
            align-items: end;
          }
          .lp-footer-inner {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
          .lp-footer-sub { display: inline; }
        }

        @keyframes lp-ping {
          0%   { box-shadow: 0 0 0 0 rgba(74,222,128,0.5); }
          70%, 100% { box-shadow: 0 0 0 7px transparent; }
        }
      `}</style>
    </div>
  )
}

function ContactLink({ label, href }) {
  const [hov, setHov] = useState(false)
  return (
    <a href={href}
      style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '0.04em', color: hov ? RED : INK_SOFT, display: 'inline-flex', gap: 10, alignItems: 'center', transition: 'color .2s', textDecoration: 'none' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {label}
    </a>
  )
}
