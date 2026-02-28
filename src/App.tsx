/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, Zap, AlertTriangle, Settings, Palette, Gauge, ShieldCheck, ChevronLeft, Volume2, VolumeX } from 'lucide-react';

// --- Sound Synthesis ---
class SoundManager {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private isMuted: boolean = false;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  setMute(mute: boolean) {
    this.isMuted = mute;
    if (mute && this.engineGain) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.05);
    }
  }

  playClick() {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playCollision() {
    if (!this.ctx || this.isMuted) return;
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.5);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  startEngine() {
    if (!this.ctx || this.isMuted) return;
    this.stopEngine();
    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(50, this.ctx.currentTime);
    this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.engineGain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.1);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, this.ctx.currentTime);
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
  }

  updateEngine(speed: number) {
    if (!this.ctx || !this.engineOsc || this.isMuted) return;
    const freq = 50 + (speed * 10);
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
  }

  stopEngine() {
    if (this.engineOsc) {
      this.engineOsc.stop();
      this.engineOsc = null;
    }
  }
}

const sounds = new SoundManager();

// --- Constants ---
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const LANE_WIDTH = CANVAS_WIDTH / 3;
const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 80;
const OBSTACLE_WIDTH = 50;
const OBSTACLE_HEIGHT = 80;
const INITIAL_SPEED = 8;
const SPEED_INCREMENT = 0.002;

// --- Types ---
interface Landmark {
  id: string;
  x: number;
  y: number;
  type: 'tower' | 'ruin' | 'felucca' | 'pyramid' | 'building' | 'temple';
  side: 'left' | 'right';
}

interface Track {
  id: string;
  name: string;
  description: string;
  bgColor: string;
  roadColor: string;
  laneColor: string;
  edgeColor: string;
  obstacleColor: string;
  initialSpeed: number;
  speedIncrement: number;
  accentColor: string;
  bgImage?: string;
  landmarkTypes: Landmark['type'][];
}

interface CarCustomization {
  model: 'classic' | 'bmw';
  color: string;
  decal: 'none' | 'stripes' | 'flames' | 'star';
  upgrades: {
    engine: number;
    tires: number;
  };
}

const TRACKS: Track[] = [
  {
    id: 'city',
    name: 'القاهرة الفاطمية',
    description: 'سباق جنب برج القاهرة وخان الخليلي.',
    bgColor: '#18181b',
    roadColor: '#18181b',
    laneColor: '#3f3f46',
    edgeColor: '#71717a',
    obstacleColor: '#ef4444',
    initialSpeed: 8,
    speedIncrement: 0.002,
    accentColor: '#3b82f6',
    bgImage: 'https://images.unsplash.com/photo-1553913861-c0fddf2619ee?q=80&w=1000&auto=format&fit=crop',
    landmarkTypes: ['tower', 'building']
  },
  {
    id: 'desert',
    name: 'آثار الإسكندرية',
    description: 'جري وسط الآثار الرومانية في قلب الصحراء.',
    bgColor: '#451a03',
    roadColor: '#78350f',
    laneColor: '#f59e0b',
    edgeColor: '#d97706',
    obstacleColor: '#991b1b',
    initialSpeed: 11,
    speedIncrement: 0.003,
    accentColor: '#fbbf24',
    bgImage: 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?q=80&w=1000&auto=format&fit=crop',
    landmarkTypes: ['ruin', 'pyramid']
  },
  {
    id: 'neon',
    name: 'نيل المستقبل',
    description: 'نيل سايبر وفلوكة بتنور في الضلمة.',
    bgColor: '#020617',
    roadColor: '#0f172a',
    laneColor: '#22d3ee',
    edgeColor: '#818cf8',
    obstacleColor: '#f472b6',
    initialSpeed: 14,
    speedIncrement: 0.004,
    accentColor: '#a855f7',
    bgImage: 'https://images.unsplash.com/photo-1568051243851-f9b136146e97?q=80&w=1000&auto=format&fit=crop',
    landmarkTypes: ['felucca', 'temple']
  }
];

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  lane: number;
  type?: 'pottery' | 'stall' | 'chariot';
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER' | 'GARAGE'>('START');
  const [isMuted, setIsMuted] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track>(TRACKS[0]);
  const [customization, setCustomization] = useState<CarCustomization>({
    model: 'classic',
    color: '#3b82f6',
    decal: 'none',
    upgrades: { engine: 0, tires: 0 }
  });
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [speed, setSpeed] = useState(INITIAL_SPEED);

  // Game state refs for the loop
  const gameStateRef = useRef<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const speedRef = useRef(INITIAL_SPEED);
  const scoreRef = useRef(0);
  
  const playerRef = useRef<GameObject>({
    x: LANE_WIDTH + (LANE_WIDTH - PLAYER_WIDTH) / 2,
    y: CANVAS_HEIGHT - PLAYER_HEIGHT - 20,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    color: '#3b82f6', // blue-500
    lane: 1
  });
  const obstaclesRef = useRef<GameObject[]>([]);
  const landmarksRef = useRef<Landmark[]>([]);
  const roadOffsetRef = useRef(0);
  const frameIdRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const selectedTrackRef = useRef<Track>(TRACKS[0]);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  // Sync selected track to ref
  useEffect(() => {
    selectedTrackRef.current = selectedTrack;
    if (selectedTrack.bgImage) {
      const img = new Image();
      img.src = selectedTrack.bgImage;
      img.onload = () => {
        bgImageRef.current = img;
      };
    } else {
      bgImageRef.current = null;
    }
  }, [selectedTrack]);

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem('turbo-racer-highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // Handle Input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'PLAYING') return;

      if (e.key === 'ArrowLeft' || e.key === 'a') {
        movePlayer(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        movePlayer(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const movePlayer = (dir: number) => {
    const newLane = Math.max(0, Math.min(2, playerRef.current.lane + dir));
    playerRef.current.lane = newLane;
    playerRef.current.x = newLane * LANE_WIDTH + (LANE_WIDTH - PLAYER_WIDTH) / 2;
  };

  const startGame = () => {
    sounds.init();
    sounds.startEngine();
    gameStateRef.current = 'PLAYING';
    setGameState('PLAYING');
    setScore(0);
    scoreRef.current = 0;
    
    const track = selectedTrackRef.current;
    // Apply engine upgrade: higher initial speed
    const engineBonus = customization.upgrades.engine * 1.0;
    speedRef.current = track.initialSpeed + engineBonus;
    setSpeed(speedRef.current);
    
    obstaclesRef.current = [];
    landmarksRef.current = [];
    playerRef.current.lane = 1;
    playerRef.current.x = LANE_WIDTH + (LANE_WIDTH - PLAYER_WIDTH) / 2;
    playerRef.current.color = customization.color;
    lastTimeRef.current = performance.now();
    
    // Ensure any existing loop is cancelled
    if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
    frameIdRef.current = requestAnimationFrame(gameLoop);
  };

  const gameOver = () => {
    if (gameStateRef.current !== 'PLAYING') return;
    
    sounds.stopEngine();
    sounds.playCollision();
    gameStateRef.current = 'GAMEOVER';
    setGameState('GAMEOVER');
    if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
    
    const finalScore = scoreRef.current;
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('turbo-racer-highscore', finalScore.toString());
    }
  };

  const gameLoop = (time: number) => {
    if (gameStateRef.current !== 'PLAYING') return;

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    // Core logic
    const track = selectedTrackRef.current;
    
    // Update Speed
    // Apply tires upgrade: slower speed increment
    const tireBonus = customization.upgrades.tires * 0.0002;
    const effectiveIncrement = Math.max(0.0001, track.speedIncrement - tireBonus);
    speedRef.current += effectiveIncrement;
    const currentSpeed = speedRef.current;

    sounds.updateEngine(currentSpeed);
    
    // Move road
    roadOffsetRef.current = (roadOffsetRef.current + currentSpeed) % 100;

    // Move obstacles
    obstaclesRef.current.forEach(obs => {
      obs.y += currentSpeed;
    });

    // Move landmarks
    landmarksRef.current.forEach(lm => {
      lm.y += currentSpeed;
    });

    // Remove off-screen obstacles
    obstaclesRef.current = obstaclesRef.current.filter(obs => obs.y < CANVAS_HEIGHT);
    // Remove off-screen landmarks
    landmarksRef.current = landmarksRef.current.filter(lm => lm.y < CANVAS_HEIGHT);

    // Spawn new obstacles
    if (obstaclesRef.current.length === 0 || 
        (obstaclesRef.current[obstaclesRef.current.length - 1].y > 200 && Math.random() < 0.02)) {
      const lane = Math.floor(Math.random() * 3);
      const types: GameObject['type'][] = ['pottery', 'stall', 'chariot'];
      const type = types[Math.floor(Math.random() * types.length)];
      
      obstaclesRef.current.push({
        x: lane * LANE_WIDTH + (LANE_WIDTH - OBSTACLE_WIDTH) / 2,
        y: -OBSTACLE_HEIGHT,
        width: OBSTACLE_WIDTH,
        height: OBSTACLE_HEIGHT,
        color: track.obstacleColor,
        lane,
        type
      });
    }

    // Spawn new landmarks
    if (landmarksRef.current.length === 0 || 
        (landmarksRef.current[landmarksRef.current.length - 1].y > 400 && Math.random() < 0.01)) {
      const side = Math.random() > 0.5 ? 'left' : 'right';
      const type = track.landmarkTypes[Math.floor(Math.random() * track.landmarkTypes.length)];
      landmarksRef.current.push({
        id: Math.random().toString(),
        x: side === 'left' ? 20 : CANVAS_WIDTH - 80,
        y: -200,
        type,
        side
      });
    }

    // Collision detection
    const player = playerRef.current;
    for (const obs of obstaclesRef.current) {
      if (
        player.x < obs.x + obs.width &&
        player.x + player.width > obs.x &&
        player.y < obs.y + obs.height &&
        player.y + player.height > obs.y
      ) {
        gameOver();
        return;
      }
    }

    // Update score
    scoreRef.current += 1;
    
    // Sync to state for UI (throttled)
    if (scoreRef.current % 10 === 0) {
      setScore(scoreRef.current);
      setSpeed(currentSpeed);
    }

    // Draw
    draw(track);

    frameIdRef.current = requestAnimationFrame(gameLoop);
  };

  const draw = (track: Track) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = track.bgColor;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Background Image
    if (bgImageRef.current) {
      // Draw two copies for scrolling effect
      const img = bgImageRef.current;
      const scrollY = (roadOffsetRef.current * 6) % CANVAS_HEIGHT;
      ctx.drawImage(img, 0, scrollY, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.drawImage(img, 0, scrollY - CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Add a dark overlay to keep the road visible
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Draw Road
    ctx.strokeStyle = track.laneColor;
    ctx.setLineDash([40, 40]);
    ctx.lineDashOffset = -roadOffsetRef.current;
    ctx.lineWidth = 4;

    // Lane dividers
    ctx.beginPath();
    ctx.moveTo(LANE_WIDTH, 0);
    ctx.lineTo(LANE_WIDTH, CANVAS_HEIGHT);
    ctx.moveTo(LANE_WIDTH * 2, 0);
    ctx.lineTo(LANE_WIDTH * 2, CANVAS_HEIGHT);
    ctx.stroke();

    // Road edges
    ctx.setLineDash([]);
    ctx.strokeStyle = track.edgeColor;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 0, CANVAS_WIDTH - 8, CANVAS_HEIGHT);

    // Draw Landmarks
    landmarksRef.current.forEach(lm => {
      ctx.save();
      ctx.translate(lm.x, lm.y);
      
      if (lm.type === 'tower') {
        // Cairo Tower
        ctx.fillStyle = '#71717a';
        ctx.fillRect(20, 0, 20, 150);
        ctx.fillStyle = '#3f3f46';
        ctx.beginPath();
        ctx.arc(30, 10, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(28, -10, 4, 10); // Antenna
      } else if (lm.type === 'pyramid') {
        // Giza Pyramids (Multiple)
        ctx.fillStyle = '#d97706';
        // Main Pyramid
        ctx.beginPath();
        ctx.moveTo(0, 100);
        ctx.lineTo(40, 0);
        ctx.lineTo(80, 100);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.stroke();
        // Smaller Pyramid behind
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.moveTo(-20, 100);
        ctx.lineTo(10, 40);
        ctx.lineTo(40, 100);
        ctx.closePath();
        ctx.fill();
      } else if (lm.type === 'temple') {
        // Futuristic Neon Temple
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#a855f7';
        // Pylon (Entrance)
        ctx.strokeRect(0, 20, 30, 80);
        ctx.strokeRect(50, 20, 30, 80);
        // Connecting Beam
        ctx.beginPath();
        ctx.moveTo(30, 30);
        ctx.lineTo(50, 30);
        ctx.stroke();
        // Glowing Obelisk
        ctx.fillStyle = 'rgba(168, 85, 247, 0.3)';
        ctx.beginPath();
        ctx.moveTo(35, 100);
        ctx.lineTo(40, 0);
        ctx.lineTo(45, 100);
        ctx.fill();
        ctx.stroke();
      } else if (lm.type === 'ruin') {
        // Roman Ruin (Column)
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(10, 0, 15, 80);
        ctx.fillRect(5, -5, 25, 10); // Top
        ctx.fillRect(5, 75, 25, 10); // Base
      } else if (lm.type === 'felucca') {
        // Futuristic Felucca
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(0, 40);
        ctx.lineTo(60, 40);
        ctx.lineTo(50, 55);
        ctx.lineTo(10, 55);
        ctx.closePath();
        ctx.fill();
        // Neon Sail
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#22d3ee';
        ctx.beginPath();
        ctx.moveTo(30, 40);
        ctx.lineTo(30, 0);
        ctx.lineTo(10, 35);
        ctx.stroke();
      } else if (lm.type === 'building') {
        // Khan el-Khalili style building
        ctx.fillStyle = '#a16207';
        ctx.fillRect(0, 0, 60, 100);
        ctx.fillStyle = '#713f12';
        ctx.fillRect(10, 20, 15, 20); // Window
        ctx.fillRect(35, 20, 15, 20); // Window
        ctx.beginPath();
        ctx.arc(30, 0, 20, Math.PI, 0); // Dome
        ctx.fill();
      }
      
      ctx.restore();
    });

    // Add some glow for Neon track
    if (track.id === 'neon') {
      ctx.shadowBlur = 15;
      ctx.shadowColor = track.laneColor;
    } else {
      ctx.shadowBlur = 0;
    }

    // Draw Player Car
    const p = playerRef.current;
    ctx.fillStyle = customization.color;
    // Body
    roundRect(ctx, p.x, p.y, p.width, p.height, 8);
    ctx.fill();

    // BMW Specific Details
    if (customization.model === 'bmw') {
      // Kidney Grille
      ctx.fillStyle = '#000';
      ctx.fillRect(p.x + p.width/2 - 12, p.y + 5, 10, 6);
      ctx.fillRect(p.x + p.width/2 + 2, p.y + 5, 10, 6);
      
      // Headlights (Halo rings look)
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x + 8, p.y + 8, 3, 0, Math.PI * 2);
      ctx.arc(p.x + p.width - 8, p.y + 8, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Hood lines
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x + 15, p.y + 15);
      ctx.lineTo(p.x + 15, p.y + 40);
      ctx.moveTo(p.x + p.width - 15, p.y + 15);
      ctx.lineTo(p.x + p.width - 15, p.y + 40);
      ctx.stroke();
    }

    // Draw Decal
    if (customization.decal !== 'none') {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      if (customization.decal === 'stripes') {
        ctx.fillRect(p.x + p.width/2 - 5, p.y, 10, p.height);
      } else if (customization.decal === 'flames') {
        ctx.beginPath();
        ctx.moveTo(p.x + 10, p.y + p.height);
        ctx.lineTo(p.x + p.width/2, p.y + p.height - 30);
        ctx.lineTo(p.x + p.width - 10, p.y + p.height);
        ctx.fill();
      } else if (customization.decal === 'star') {
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('★', p.x + p.width/2, p.y + p.height/2 + 7);
      }
      ctx.restore();
    }

    // Windows
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(p.x + 10, p.y + 15, p.width - 20, 20);
    // Wheels
    ctx.fillStyle = '#000';
    ctx.fillRect(p.x - 5, p.y + 10, 5, 20);
    ctx.fillRect(p.x + p.width, p.y + 10, 5, 20);
    ctx.fillRect(p.x - 5, p.y + p.height - 30, 5, 20);
    ctx.fillRect(p.x + p.width, p.y + p.height - 30, 5, 20);

    // Draw Obstacles
    obstaclesRef.current.forEach(obs => {
      ctx.save();
      ctx.translate(obs.x, obs.y);
      
      if (obs.type === 'pottery') {
        // Ancient Pottery (Qolla)
        ctx.fillStyle = '#a8a29e'; // Stone/Clay
        ctx.beginPath();
        ctx.moveTo(10, 80);
        ctx.bezierCurveTo(0, 80, 0, 40, 25, 30); // Base to neck
        ctx.lineTo(25, 10); // Neck
        ctx.lineTo(35, 10);
        ctx.lineTo(35, 30);
        ctx.bezierCurveTo(60, 40, 60, 80, 50, 80);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.stroke();
      } else if (obs.type === 'stall') {
        // Market Stall (Farsha)
        ctx.fillStyle = '#78350f'; // Wood
        ctx.fillRect(0, 60, 60, 20); // Table
        ctx.fillStyle = '#ef4444'; // Red canopy
        ctx.beginPath();
        ctx.moveTo(-5, 60);
        ctx.lineTo(30, 20);
        ctx.lineTo(65, 60);
        ctx.closePath();
        ctx.fill();
        // Items on stall
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(15, 55, 5, 0, Math.PI * 2);
        ctx.arc(45, 55, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.type === 'chariot') {
        // Chariot
        ctx.fillStyle = '#d97706'; // Golden wood
        ctx.fillRect(10, 40, 40, 30); // Body
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(10, 70, 10, 0, Math.PI * 2); // Wheel
        ctx.arc(50, 70, 10, 0, Math.PI * 2); // Wheel
        ctx.fill();
        // Spear/Pole
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(30, 40);
        ctx.lineTo(30, 0);
        ctx.stroke();
      } else {
        // Fallback generic
        ctx.fillStyle = obs.color;
        roundRect(ctx, 0, 0, obs.width, obs.height, 8);
        ctx.fill();
      }
      
      ctx.restore();
    });
  };

  // Helper for rounded rectangles
  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  const toggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    sounds.setMute(newMute);
  };

  const handleTrackSelect = (track: Track) => {
    setSelectedTrack(track);
    sounds.playClick();
  };

  const handleGarageClick = () => {
    setGameState('GARAGE');
    sounds.playClick();
  };

  const handleBackToStart = () => {
    setGameState('START');
    sounds.playClick();
  };

  const handleCustomizationChange = (update: Partial<CarCustomization>) => {
    setCustomization(prev => ({ ...prev, ...update }));
    sounds.playClick();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 font-sans">
      <div className="relative group">
        {/* Mute Toggle */}
        <button
          onClick={toggleMute}
          className="absolute -top-12 right-0 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full border border-white/10 text-zinc-400 transition-colors z-50"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
        {/* Game Canvas */}
        <div className="border-4 border-zinc-800 rounded-lg overflow-hidden shadow-2xl shadow-blue-500/10">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block"
          />
        </div>

        {/* HUD */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none" dir="rtl">
          <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <p className="text-xs uppercase tracking-widest text-zinc-400 font-bold">النتيجة</p>
            <p className="text-xl font-mono font-bold" style={{ color: selectedTrack.accentColor }}>{score.toLocaleString()}</p>
          </div>
          <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-right">
            <p className="text-xs uppercase tracking-widest text-zinc-400 font-bold">أعلى نتيجة</p>
            <p className="text-xl font-mono font-bold text-emerald-400">{highScore.toLocaleString()}</p>
          </div>
        </div>

        {/* Speed Indicator */}
        {gameState === 'PLAYING' && (
          <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2" dir="rtl">
            <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-tighter">
              السرعة: {(speed * 10).toFixed(1)} كم/س
            </span>
          </div>
        )}

        {/* Overlays */}
        <AnimatePresence>
          {gameState === 'START' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
            >
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                className="mb-6"
              >
                <h1 className="text-5xl font-game text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500 mb-2 tracking-tighter">
                  صاروخ<br/>الطريق
                </h1>
                <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">
                  اختار طريقك يا بطل
                </p>
              </motion.div>

              <div className="grid grid-cols-1 gap-3 mb-8 w-full max-w-[280px]">
                {TRACKS.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => handleTrackSelect(track)}
                    className={`p-3 rounded-xl border-2 transition-all text-left flex flex-col gap-1 ${
                      selectedTrack.id === track.id
                        ? 'border-white bg-white/10'
                        : 'border-white/5 bg-black/20 hover:border-white/20'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-game text-white">{track.name}</span>
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: track.accentColor }}
                      />
                    </div>
                    <p className="text-[9px] text-zinc-500 leading-tight">{track.description}</p>
                  </button>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={startGame}
                  className="group relative px-8 py-4 text-white rounded-full font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-3 shadow-lg"
                  style={{ backgroundColor: selectedTrack.accentColor }}
                >
                  <Play className="w-5 h-5 fill-current" />
                  دّوس بنزين!
                </button>

                <button
                  onClick={handleGarageClick}
                  className="px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-3 border border-white/10"
                >
                  <Settings className="w-5 h-5" />
                  الورشة
                </button>
              </div>

              <div className="mt-12 grid grid-cols-2 gap-4 text-[10px] text-zinc-500 font-bold tracking-widest uppercase" dir="rtl">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border border-zinc-700 rounded flex items-center justify-center">A</div>
                  <span>يسار</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border border-zinc-700 rounded flex items-center justify-center">D</div>
                  <span>يمين</span>
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'GARAGE' && (
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="absolute inset-0 bg-zinc-950 flex flex-col p-6 overflow-y-auto"
            >
              <div className="flex items-center gap-4 mb-6" dir="rtl">
                <button 
                  onClick={handleBackToStart}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 rotate-180" />
                </button>
                <h2 className="text-xl font-game uppercase tracking-tighter">الورشة</h2>
              </div>

              <div className="space-y-8" dir="rtl">
                {/* Model Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4 text-zinc-400">
                    <ShieldCheck className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">نوع العربية</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleCustomizationChange({ model: 'classic' })}
                      className={`p-4 rounded-xl border-2 transition-all text-right flex flex-col gap-1 ${
                        customization.model === 'classic' 
                          ? 'border-white bg-white/10' 
                          : 'border-white/5 bg-black/20'
                      }`}
                    >
                      <span className="text-xs font-game text-white">فيات 128</span>
                      <p className="text-[9px] text-zinc-500">الوحش المصري</p>
                    </button>
                    <button
                      onClick={() => handleCustomizationChange({ model: 'bmw' })}
                      className={`p-4 rounded-xl border-2 transition-all text-right flex flex-col gap-1 ${
                        customization.model === 'bmw' 
                          ? 'border-blue-500 bg-blue-500/10' 
                          : 'border-white/5 bg-black/20'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-game text-white italic">ميكروباص</span>
                        <div className="flex gap-0.5">
                          <div className="w-1 h-3 bg-blue-500" />
                          <div className="w-1 h-3 bg-blue-800" />
                          <div className="w-1 h-3 bg-red-600" />
                        </div>
                      </div>
                      <p className="text-[9px] text-zinc-500">طيارة على الطريق</p>
                    </button>
                  </div>
                </section>

                {/* Paint Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4 text-zinc-400">
                    <Palette className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">طلاء السيارة</h3>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff', '#000000', '#fbbf24', '#22d3ee'].map(color => (
                      <button
                        key={color}
                        onClick={() => handleCustomizationChange({ color })}
                        className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${
                          customization.color === color ? 'border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </section>

                {/* Decals Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4 text-zinc-400">
                    <Settings className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">الملصقات</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {([['none', 'بدون'], ['stripes', 'خطوط'], ['flames', 'لهب'], ['star', 'نجمة']] as const).map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => handleCustomizationChange({ decal: id as any })}
                        className={`p-3 rounded-xl border-2 transition-all text-xs font-bold uppercase ${
                          customization.decal === id 
                            ? 'border-white bg-white/10' 
                            : 'border-white/5 bg-black/20'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Upgrades Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4 text-zinc-400">
                    <Gauge className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">الأداء</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold uppercase tracking-widest">المحرك (السرعة)</span>
                        <span className="text-blue-400 font-mono text-sm">مستوى {customization.upgrades.engine}</span>
                      </div>
                      <div className="flex gap-1 mb-3">
                        {[1, 2, 3].map(lv => (
                          <div key={lv} className={`h-1.5 flex-1 rounded-full ${lv <= customization.upgrades.engine ? 'bg-blue-500' : 'bg-zinc-800'}`} />
                        ))}
                      </div>
                      <button 
                        disabled={customization.upgrades.engine >= 3}
                        onClick={() => handleCustomizationChange({ 
                          upgrades: { ...customization.upgrades, engine: customization.upgrades.engine + 1 } 
                        })}
                        className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/40 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                      >
                        {customization.upgrades.engine >= 3 ? 'أقصى مستوى' : 'ترقية المحرك'}
                      </button>
                    </div>

                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold uppercase tracking-widest">الإطارات (الثبات)</span>
                        <span className="text-emerald-400 font-mono text-sm">مستوى {customization.upgrades.tires}</span>
                      </div>
                      <div className="flex gap-1 mb-3">
                        {[1, 2, 3].map(lv => (
                          <div key={lv} className={`h-1.5 flex-1 rounded-full ${lv <= customization.upgrades.tires ? 'bg-emerald-500' : 'bg-zinc-800'}`} />
                        ))}
                      </div>
                      <button 
                        disabled={customization.upgrades.tires >= 3}
                        onClick={() => handleCustomizationChange({ 
                          upgrades: { ...customization.upgrades, tires: customization.upgrades.tires + 1 } 
                        })}
                        className="w-full py-2 bg-emerald-600/20 hover:bg-emerald-600/40 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                      >
                        {customization.upgrades.tires >= 3 ? 'أقصى مستوى' : 'ترقية الإطارات'}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </motion.div>
          )}

          {gameState === 'GAMEOVER' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-red-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
              dir="rtl"
            >
              <AlertTriangle className="w-16 h-16 text-red-500 mb-4 animate-pulse" />
              <h2 className="text-4xl font-game text-white mb-2">لبست في الحيط!</h2>
              
              <div className="my-8 space-y-2">
                <p className="text-zinc-400 text-xs uppercase tracking-widest font-bold">لميت كام نقطة؟</p>
                <p className="text-5xl font-mono font-black text-white">{score.toLocaleString()}</p>
                {score >= highScore && score > 0 && (
                  <p className="text-emerald-400 text-xs font-bold flex items-center justify-center gap-1">
                    <Trophy className="w-3 h-3" /> عاش يا وحش.. رقم قياسي!
                  </p>
                )}
              </div>

              <button
                onClick={startGame}
                className="px-8 py-4 bg-white text-red-950 rounded-full font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-3 shadow-xl"
              >
                <RotateCcw className="w-5 h-5" />
                جرب تاني يا بطل
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="mt-8 text-zinc-600 text-[10px] font-bold tracking-widest uppercase flex items-center gap-4" dir="rtl">
        <span>استخدم الأسهم عشان تحود يمين وشمال</span>
        <span className="w-1 h-1 bg-zinc-800 rounded-full" />
        <span>صُنع بحب في مصر (React & Canvas)</span>
      </footer>
    </div>
  );
}
