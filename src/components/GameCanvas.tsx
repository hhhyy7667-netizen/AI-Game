/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Gamepad2, Timer, Trophy } from "lucide-react";
import { gameAudio } from "../lib/audio";

interface GameProps {
  userId: string;
  onExit: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

export default function GameCanvas({ userId, onExit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  
  const particlesRef = useRef<Particle[]>([]);
  const popupsRef = useRef<Popup[]>([]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "join", id: userId }));
      gameAudio.playBGM();
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "state") {
        setGameState(data.state);
      } else if (data.type === "pickup") {
        const { x, y, itemType } = data;
        if (itemType === "bomb") {
          gameAudio.playExplosion();
          spawnParticles(x, y, "#ef4444", 20);
          spawnPopup(x, y, "-50", "#ef4444");
        } else {
          gameAudio.playPickup();
          const color = itemType === "diamond" ? "#10b981" : "#eab308";
          const points = itemType === "red" ? "+10" : itemType === "yellow" ? "+20" : "+50";
          spawnParticles(x, y, color, 10);
          spawnPopup(x, y, points, color);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "ArrowLeft") socket.send(JSON.stringify({ type: "input", input: "left" }));
      if (e.key === "ArrowRight") socket.send(JSON.stringify({ type: "input", input: "right" }));
      if (e.key === " " || e.key === "ArrowUp") socket.send(JSON.stringify({ type: "input", input: "jump" }));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        socket.send(JSON.stringify({ type: "input", input: "stopX" }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      socket.close();
      gameAudio.stopBGM();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [userId]);

  const spawnParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x: x + 15, y: y + 15,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1.0,
        color
      });
    }
  };

  const spawnPopup = (x: number, y: number, text: string, color: string) => {
    popupsRef.current.push({
      x: x + 15, y: y - 10,
      text,
      life: 1.0,
      color
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = "#18181b";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // Platforms
      ctx.fillStyle = "#27272a";
      gameState.platforms.forEach((plat: any) => {
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.strokeStyle = "#3f3f46";
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
      });

      // Items
      gameState.items.forEach((item: any) => {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.shadowBlur = 10;
        if (item.type === "red") { ctx.fillStyle = "#ef4444"; ctx.shadowColor = "#ef4444"; }
        else if (item.type === "yellow") { ctx.fillStyle = "#eab308"; ctx.shadowColor = "#eab308"; }
        else if (item.type === "diamond") { ctx.fillStyle = "#10b981"; ctx.shadowColor = "#10b981"; }
        else if (item.type === "bomb") { ctx.fillStyle = "#ffffff"; ctx.shadowColor = "#ef4444"; }

        if (item.type === "bomb") {
          ctx.beginPath(); ctx.arc(15, 15, 12, 0, Math.PI * 2); ctx.fillStyle = "#3f3f46"; ctx.fill();
          ctx.beginPath(); ctx.arc(18, 12, 3, 0, Math.PI * 2); ctx.fillStyle = "#ef4444"; ctx.fill();
          // Fuse highlight
          ctx.beginPath(); ctx.arc(15, 15, 10, -0.5, 0.5); ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.stroke();
        } else if (item.type === "diamond") {
          ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(30, 15); ctx.lineTo(15, 30); ctx.lineTo(0, 15); ctx.closePath(); ctx.fill();
        } else {
          ctx.beginPath(); ctx.arc(15, 15, 10, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      });

      // Players
      Object.values(gameState.players).forEach((p: any) => {
        ctx.save();
        ctx.translate(p.x, p.y);
        
        if (p.isP1) {
          ctx.fillStyle = "#3b82f6"; ctx.fillRect(0, 0, 40, 40);
          ctx.fillStyle = "#1d4ed8"; ctx.fillRect(5, 5, 30, 30);
          ctx.fillStyle = "#ffffff";
          const eyeOffset = p.facing === 1 ? 25 : 5;
          ctx.fillRect(eyeOffset, 10, 8, 8);
        } else {
          ctx.fillStyle = "#facc15";
          ctx.beginPath(); ctx.arc(20, 20, 20, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#000000";
          const eyePos = p.facing === 1 ? 28 : 12;
          ctx.beginPath(); ctx.arc(eyePos, 15, 4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#facc15"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(20, -10); ctx.stroke();
          ctx.beginPath(); ctx.arc(20, -12, 4, 0, Math.PI * 2); ctx.fillStyle = "#facc15"; ctx.fill();
        }

        ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px Inter"; ctx.textAlign = "center";
        ctx.fillText(p.id.slice(0, 10), 20, -25);
        ctx.fillStyle = "#a1a1aa"; ctx.fillText(`${Math.round(p.score)}`, 20, -10);
        ctx.restore();
      });

      // Particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.02;
        if (p.life <= 0) return false;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2); ctx.fill();
        return true;
      });
      ctx.globalAlpha = 1.0;

      // Popups
      popupsRef.current = popupsRef.current.filter(p => {
        p.y -= 1; p.life -= 0.02;
        if (p.life <= 0) return false;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.font = "bold 16px Inter";
        ctx.textAlign = "center";
        ctx.fillText(p.text, p.x, p.y);
        return true;
      });
      ctx.globalAlpha = 1.0;

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [gameState]);

  const formatTime = (ms: number) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col font-sans text-white overflow-hidden">
      <div className="p-4 bg-zinc-901 border-b border-zinc-800 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-6">
          <button id="exit-game" onClick={onExit} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors group">
            <ArrowLeft className="text-zinc-400 group-hover:text-white transition-colors" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Gamepad2 size={24} />
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-tight uppercase text-blue-500">Brawl Bros</h2>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Live Match
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center bg-zinc-800/50 px-6 py-2 rounded-full border border-zinc-700/50 shadow-inner">
          <Timer className="mr-2 text-blue-500" size={20} />
          <span className="font-mono text-2xl font-bold tabular-nums text-white">
            {gameState ? formatTime(gameState.timer) : "5:00"}
          </span>
        </div>

        <div className="flex gap-4">
          {gameState && Object.values(gameState.players).map((p: any) => (
            <div key={p.id} className={`flex items-center gap-3 px-4 py-2 rounded-xl border ${p.isP1 ? "bg-blue-500/10 border-blue-500/20" : "bg-yellow-500/10 border-yellow-500/20"}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.isP1 ? "bg-blue-600" : "bg-yellow-500"}`}>
                <Trophy size={16} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-zinc-400">{p.id.slice(0, 8)}</p>
                <p className="text-lg font-bold leading-none">{p.score}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative border-4 border-zinc-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
          <canvas ref={canvasRef} width={800} height={600} className="block" id="game-canvas" />
          {gameState && gameState.timer <= 0 && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
              <h2 className="text-5xl font-black text-blue-500 mb-6 drop-shadow-lg">GAME OVER</h2>
              <div className="flex gap-8 mb-10">
                {Object.values(gameState.players).map((p: any) => (
                  <div key={p.id} className="text-center">
                    <p className="text-zinc-400 text-sm mb-1 uppercase font-bold tracking-widest">{p.id.slice(0, 8)}</p>
                    <p className="text-4xl font-black">{Math.round(p.score)}</p>
                  </div>
                ))}
              </div>
              <button 
                onClick={onExit}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-600/30 active:scale-95"
              >
                RETURN TO MENU
              </button>
            </div>
          )}
          {!gameState && (
            <div className="absolute inset-0 bg-zinc-950/80 flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-zinc-400 animate-pulse font-medium">Connecting to Server...</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex justify-center gap-8 text-xs text-zinc-400 font-medium font-sans">
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 bg-zinc-800 rounded border border-zinc-700 text-zinc-300">Arrows / Space</kbd>
          <span>Move & Jump</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full" />
          <span>Red: +10</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 rounded-full" />
          <span>Yellow: +20</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-500 rounded-full" />
          <span>Diamond: +50</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-zinc-500 rounded-full border border-red-500" />
          <span>Bomb: -50</span>
        </div>
      </div>
    </div>
  );
}
