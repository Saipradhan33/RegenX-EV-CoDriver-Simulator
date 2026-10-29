import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import createGlobe from 'cobe';
import { useMotionValue, useSpring } from 'framer-motion';

const markers = [[14.5995,120.9842,.03],[19.076,72.8777,.05],[23.8103,90.4125,.03],[30.0444,31.2357,.04],[39.9042,116.4074,.06],[-23.5505,-46.6333,.05],[19.4326,-99.1332,.04],[40.7128,-74.006,.07],[34.6937,135.5022,.04],[41.0082,28.9784,.04],[51.5074,-.1278,.06],[48.8566,2.3522,.05]].map(([lat,lng,size])=>({location:[lat,lng] as [number,number],size}));
function Globe() {
  const canvas = useRef<HTMLCanvasElement>(null), phi = useRef(0), start = useRef<number|null>(null), base = useRef(0);
  const offset = useMotionValue(0), spring = useSpring(offset,{mass:1,stiffness:280,damping:40});
  useEffect(()=>{
    const el=canvas.current!; let width=el.offsetWidth;
    const resize=()=>{width=el.offsetWidth}; window.addEventListener('resize',resize);
    const globe=createGlobe(el,{devicePixelRatio:2,width:width*2,height:width*2,phi:0,theta:.3,dark:1,diffuse:1.15,mapSamples:16000,mapBrightness:3.2,mapBaseBrightness:.08,baseColor:[.035,.07,.14],markerColor:[.12,.48,1],glowColor:[.04,.16,.34],markers,onRender:(state)=>{if(start.current===null&&!matchMedia('(prefers-reduced-motion: reduce)').matches)phi.current+=.005;state.phi=phi.current+spring.get();state.width=width*2;state.height=width*2}});
    const timer=setTimeout(()=>{el.style.opacity='1'},100);
    return()=>{globe.destroy();window.removeEventListener('resize',resize);clearTimeout(timer)};
  },[spring]);
  return <div className="globe-wrap"><canvas ref={canvas} aria-label="Interactive rotating globe" onPointerDown={e=>{start.current=e.clientX;base.current=offset.get();e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.style.cursor='grabbing'}} onPointerMove={e=>{if(start.current!==null)offset.set(base.current+(e.clientX-start.current)/(e.pointerType==='touch'?100:200))}} onPointerUp={e=>{start.current=null;e.currentTarget.style.cursor='grab'}} onPointerCancel={()=>{start.current=null}}/><div className="globe-fade"/></div>;
}
const root=document.getElementById('globe-root');
if(root){createRoot(root).render(<Globe/>);document.getElementById('navigate')?.addEventListener('click',()=>{const origin=(document.getElementById('route-origin') as HTMLInputElement).value.trim();const destination=(document.getElementById('route-destination') as HTMLInputElement).value.trim();if(origin&&destination)root.hidden=true});}
