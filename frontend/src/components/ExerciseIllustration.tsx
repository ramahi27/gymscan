import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Rect, Path, Line, G } from 'react-native-svg';

// App colour palette
const P  = '#6F61EF';                   // primary purple
const T  = '#39D2C0';                   // teal
const W  = 'rgba(255,255,255,0.85)';    // bright white
const WD = 'rgba(255,255,255,0.3)';     // dim white
const BG = '#16162A';                   // dark navy bg

type Category =
  | 'dumbbell' | 'barbell' | 'kettlebell'
  | 'cable'    | 'pullup'
  | 'treadmill'| 'bike'    | 'rowing'
  | 'bench'    | 'squat'
  | 'shoulder' | 'chest'   | 'bicep' | 'tricep' | 'abs'
  | 'band'     | 'medicine_ball' | 'mat'
  | 'elliptical'| 'stair'
  | 'default';

export function categorizeExercise(raw: string): Category {
  const n = raw.toLowerCase();

  if (n.includes('dumbbell') || /\bdb\b/.test(n))              return 'dumbbell';
  if (n.includes('barbell')  || n.includes('deadlift'))        return 'barbell';
  if (n.includes('bench press'))                               return 'barbell';
  if (n.includes('kettlebell'))                                return 'kettlebell';
  if (n.includes('cable')    || n.includes('pulldown') ||
      n.includes('lat pull') || n.includes('crossover') ||
      n.includes('seated row'))                                return 'cable';
  if (n.includes('pull-up')  || n.includes('pull up')  ||
      n.includes('pullup')   || n.includes('chin'))           return 'pullup';
  if (n.includes('treadmill')|| n.includes('run'))            return 'treadmill';
  if (n.includes('bike')     || n.includes('cycle') ||
      n.includes('spin')     || n.includes('air bike'))       return 'bike';
  if (n.includes('row') && !n.includes('seated row'))         return 'rowing';
  if (n.includes('bench')    && !n.includes('press'))         return 'bench';
  if (n.includes('squat')    || n.includes('leg press') ||
      n.includes('lunge')    || n.includes('hack squat') ||
      n.includes('leg curl') || n.includes('leg extension') ||
      n.includes('smith machine'))                            return 'squat';
  if (n.includes('shoulder') || n.includes('overhead press')||
      n.includes('lateral raise') || n.includes('upright row')) return 'shoulder';
  if (n.includes('chest')    || n.includes('pec') ||
      n.includes('fly')      || n.includes('push-up') ||
      n.includes('push up')  || n.includes('pushup') ||
      n.includes('dip'))                                       return 'chest';
  if (n.includes('bicep')    || n.includes('curl') ||
      n.includes('hammer'))                                   return 'bicep';
  if (n.includes('tricep')   || n.includes('pushdown') ||
      n.includes('skull crusher'))                            return 'tricep';
  if (n.includes('abs')      || n.includes('plank') ||
      n.includes('crunch')   || n.includes('core')   ||
      n.includes('sit-up')   || n.includes('sit up')) return 'abs';
  if (n.includes('band')     || n.includes('resistance'))     return 'band';
  if (n.includes('medicine') || n.includes('med ball') ||
      n.includes('slam'))                                      return 'medicine_ball';
  if (n.includes('mat')      || n.includes('yoga') ||
      n.includes('foam roller'))                              return 'mat';
  if (n.includes('elliptical'))                               return 'elliptical';
  if (n.includes('stair')    || n.includes('climber') ||
      n.includes('step'))                                     return 'stair';
  // muscle-group fallbacks
  if (n.includes('back')     || n.includes('lat') ||
      n.includes('trap'))                                     return 'cable';
  if (n.includes('glute')    || n.includes('hip') ||
      n.includes('hamstring')|| n.includes('quad') ||
      n.includes('calf'))                                     return 'squat';

  return 'default';
}

// ─── Individual SVG drawings (100×100 viewBox) ───────────────────────────────

function Dumbbell() {
  return (
    <G>
      <Rect x="8"  y="33" width="14" height="34" rx="4" fill={P} />
      <Rect x="22" y="43" width="7"  height="14" rx="2" fill={W} />
      <Rect x="29" y="46" width="42" height="8"  rx="4" fill={W} />
      <Rect x="71" y="43" width="7"  height="14" rx="2" fill={W} />
      <Rect x="78" y="33" width="14" height="34" rx="4" fill={P} />
    </G>
  );
}

function Barbell() {
  return (
    <G>
      <Rect x="3"  y="46" width="94" height="8" rx="4" fill={W} />
      <Rect x="3"  y="28" width="14" height="44" rx="4" fill={P} />
      <Rect x="18" y="36" width="9"  height="28" rx="3" fill={T} />
      <Rect x="73" y="36" width="9"  height="28" rx="3" fill={T} />
      <Rect x="83" y="28" width="14" height="44" rx="4" fill={P} />
    </G>
  );
}

function Kettlebell() {
  return (
    <G>
      {/* Handle */}
      <Path
        d="M 32 56 Q 30 22 50 22 Q 70 22 68 56 L 64 56 Q 65 28 50 28 Q 35 28 36 56 Z"
        fill={P}
      />
      {/* Ball */}
      <Circle cx="50" cy="70" r="22" fill={P} />
      {/* Highlight */}
      <Circle cx="42" cy="60" r="6" fill="rgba(255,255,255,0.15)" />
    </G>
  );
}

function Cable() {
  return (
    <G>
      {/* Weight stack */}
      <Rect x="18" y="22" width="18" height="58" rx="3" fill={P} />
      <Line x1="18" y1="32" x2="36" y2="32" stroke={WD} strokeWidth="1.5" />
      <Line x1="18" y1="42" x2="36" y2="42" stroke={WD} strokeWidth="1.5" />
      <Line x1="18" y1="52" x2="36" y2="52" stroke={WD} strokeWidth="1.5" />
      <Line x1="18" y1="62" x2="36" y2="62" stroke={WD} strokeWidth="1.5" />
      {/* Frame pole */}
      <Rect x="42" y="12" width="8" height="76" rx="3" fill={WD} />
      {/* Top cap */}
      <Rect x="28" y="12" width="34" height="9" rx="3" fill={WD} />
      {/* Base */}
      <Rect x="28" y="83" width="34" height="8" rx="3" fill={WD} />
      {/* Pulley */}
      <Circle cx="46" cy="18" r="6" fill={T} />
      {/* Cable */}
      <Line x1="46" y1="24" x2="46" y2="72" stroke={T} strokeWidth="2" />
      {/* Handle */}
      <Rect x="40" y="72" width="12" height="6" rx="3" fill={T} />
    </G>
  );
}

function PullUp() {
  return (
    <G>
      {/* Bar supports */}
      <Rect x="10" y="12" width="7" height="18" rx="2" fill={WD} />
      <Rect x="83" y="12" width="7" height="18" rx="2" fill={WD} />
      {/* Bar */}
      <Rect x="10" y="18" width="80" height="7" rx="3" fill={P} />
      {/* Head */}
      <Circle cx="50" cy="35" r="8" fill={T} />
      {/* Arms up */}
      <Line x1="50" y1="30" x2="35" y2="22" stroke={T} strokeWidth="4" strokeLinecap="round" />
      <Line x1="50" y1="30" x2="65" y2="22" stroke={T} strokeWidth="4" strokeLinecap="round" />
      {/* Body */}
      <Line x1="50" y1="43" x2="50" y2="68" stroke={T} strokeWidth="4" strokeLinecap="round" />
      {/* Legs */}
      <Line x1="50" y1="68" x2="42" y2="84" stroke={T} strokeWidth="4" strokeLinecap="round" />
      <Line x1="50" y1="68" x2="58" y2="84" stroke={T} strokeWidth="4" strokeLinecap="round" />
    </G>
  );
}

function Treadmill() {
  return (
    <G>
      {/* Belt deck */}
      <Rect x="12" y="52" width="76" height="22" rx="8" fill={P} />
      {/* Running surface lines */}
      <Line x1="24" y1="63" x2="76" y2="63" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
      <Line x1="24" y1="68" x2="76" y2="68" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
      {/* Left upright */}
      <Rect x="24" y="24" width="6" height="32" rx="3" fill={W} />
      {/* Right upright */}
      <Rect x="70" y="24" width="6" height="32" rx="3" fill={W} />
      {/* Console */}
      <Rect x="24" y="18" width="52" height="12" rx="4" fill={T} />
      {/* Handrail */}
      <Rect x="22" y="36" width="56" height="5" rx="2" fill={WD} />
    </G>
  );
}

function Bike() {
  return (
    <G>
      {/* Wheels */}
      <Circle cx="26" cy="66" r="18" fill="none" stroke={W}  strokeWidth="4" />
      <Circle cx="26" cy="66" r="4"  fill={W} />
      <Circle cx="74" cy="66" r="18" fill="none" stroke={W}  strokeWidth="4" />
      <Circle cx="74" cy="66" r="4"  fill={W} />
      {/* Frame */}
      <Line x1="26" y1="66" x2="50" y2="46" stroke={P} strokeWidth="4" strokeLinecap="round" />
      <Line x1="74" y1="66" x2="50" y2="46" stroke={P} strokeWidth="4" strokeLinecap="round" />
      <Line x1="50" y1="46" x2="50" y2="58" stroke={P} strokeWidth="4" strokeLinecap="round" />
      {/* Seat */}
      <Rect x="40" y="42" width="20" height="5" rx="2" fill={T} />
      {/* Handlebar */}
      <Line x1="74" y1="66" x2="76" y2="44" stroke={P} strokeWidth="4" strokeLinecap="round" />
      <Line x1="68" y1="44" x2="84" y2="44" stroke={T} strokeWidth="4" strokeLinecap="round" />
    </G>
  );
}

function Rowing() {
  return (
    <G>
      {/* Rail */}
      <Rect x="8"  y="58" width="84" height="7" rx="3" fill={WD} />
      {/* Foot platform */}
      <Rect x="60" y="52" width="22" height="14" rx="3" fill={P} />
      {/* Seat */}
      <Rect x="28" y="52" width="18" height="8" rx="3" fill={T} />
      {/* Handle */}
      <Rect x="10" y="42" width="20" height="5" rx="2" fill={W} />
      {/* Chain / cable */}
      <Line x1="30" y1="44" x2="46" y2="55" stroke={WD} strokeWidth="2" />
      {/* Person (seated, arms forward) */}
      <Circle cx="46" cy="40" r="7" fill={T} />
      <Line x1="46" y1="47" x2="46" y2="58" stroke={T} strokeWidth="4" strokeLinecap="round" />
      <Line x1="46" y1="50" x2="30" y2="44" stroke={T} strokeWidth="3" strokeLinecap="round" />
    </G>
  );
}

function Bench() {
  return (
    <G>
      {/* Pad */}
      <Rect x="12" y="38" width="76" height="18" rx="6" fill={P} />
      {/* Left legs */}
      <Rect x="18" y="56" width="6" height="26" rx="2" fill={WD} />
      <Rect x="18" y="78" width="18" height="5" rx="2" fill={WD} />
      {/* Right legs */}
      <Rect x="76" y="56" width="6" height="26" rx="2" fill={WD} />
      <Rect x="64" y="78" width="18" height="5" rx="2" fill={WD} />
    </G>
  );
}

function Squat() {
  return (
    <G>
      {/* Rack posts */}
      <Rect x="12" y="18" width="7" height="68" rx="3" fill={WD} />
      <Rect x="81" y="18" width="7" height="68" rx="3" fill={WD} />
      {/* J-hooks */}
      <Rect x="12" y="36" width="12" height="5" rx="2" fill={P} />
      <Rect x="76" y="36" width="12" height="5" rx="2" fill={P} />
      {/* Barbell on rack */}
      <Rect x="12" y="31" width="76" height="6" rx="3" fill={W} />
      {/* Left plate */}
      <Rect x="4"  y="22" width="10" height="24" rx="3" fill={P} />
      {/* Right plate */}
      <Rect x="86" y="22" width="10" height="24" rx="3" fill={P} />
    </G>
  );
}

function Shoulder() {
  return (
    <G>
      {/* Head */}
      <Circle cx="50" cy="22" r="9" fill={T} />
      {/* Body */}
      <Line x1="50" y1="31" x2="50" y2="60" stroke={T} strokeWidth="4" strokeLinecap="round" />
      {/* Arms raised in V */}
      <Line x1="50" y1="38" x2="25" y2="22" stroke={T} strokeWidth="4" strokeLinecap="round" />
      <Line x1="50" y1="38" x2="75" y2="22" stroke={T} strokeWidth="4" strokeLinecap="round" />
      {/* Dumbbells at fists */}
      <Rect x="14" y="16" width="12" height="12" rx="3" fill={P} />
      <Rect x="74" y="16" width="12" height="12" rx="3" fill={P} />
      {/* Legs */}
      <Line x1="50" y1="60" x2="40" y2="82" stroke={T} strokeWidth="4" strokeLinecap="round" />
      <Line x1="50" y1="60" x2="60" y2="82" stroke={T} strokeWidth="4" strokeLinecap="round" />
    </G>
  );
}

function Chest() {
  return (
    <G>
      {/* Bench */}
      <Rect x="22" y="60" width="56" height="12" rx="4" fill={WD} />
      <Rect x="26" y="72" width="6"  height="16" rx="2" fill={WD} />
      <Rect x="68" y="72" width="6"  height="16" rx="2" fill={WD} />
      {/* Person lying */}
      <Circle cx="50" cy="50" r="8"  fill={T} />
      <Rect   x="44" y="58" width="12" height="18" rx="4" fill={T} />
      {/* Barbell */}
      <Rect x="12" y="46" width="76" height="5" rx="2" fill={W} />
      {/* Left plate */}
      <Rect x="8"  y="38" width="10" height="22" rx="3" fill={P} />
      {/* Right plate */}
      <Rect x="82" y="38" width="10" height="22" rx="3" fill={P} />
      {/* Arms */}
      <Line x1="44" y1="60" x2="24" y2="48" stroke={T} strokeWidth="3" strokeLinecap="round" />
      <Line x1="56" y1="60" x2="76" y2="48" stroke={T} strokeWidth="3" strokeLinecap="round" />
    </G>
  );
}

function Bicep() {
  return (
    <G>
      {/* Upper arm */}
      <Line x1="50" y1="20" x2="50" y2="50" stroke={T} strokeWidth="6" strokeLinecap="round" />
      {/* Forearm curled up */}
      <Line x1="50" y1="50" x2="32" y2="40" stroke={T} strokeWidth="6" strokeLinecap="round" />
      {/* Shoulder */}
      <Circle cx="50" cy="20" r="8" fill={T} />
      {/* Dumbbell at fist */}
      <Rect x="16" y="30" width="10" height="20" rx="3" fill={P} />
      <Rect x="21" y="27" width="6"  height="6"  rx="2" fill={W} />
      <Rect x="21" y="47" width="6"  height="6"  rx="2" fill={W} />
      {/* Elbow joint */}
      <Circle cx="50" cy="50" r="5" fill={P} />
      {/* Body hint */}
      <Line x1="50" y1="28" x2="62" y2="46" stroke={WD} strokeWidth="3" strokeLinecap="round" />
      <Line x1="62" y1="46" x2="62" y2="80" stroke={WD} strokeWidth="3" strokeLinecap="round" />
    </G>
  );
}

function Tricep() {
  return (
    <G>
      {/* Cable pulley suggestion at top */}
      <Circle cx="50" cy="14" r="6" fill={P} />
      <Rect x="46" y="8" width="8" height="12" rx="2" fill={WD} />
      {/* Cable */}
      <Line x1="50" y1="20" x2="50" y2="46" stroke={T} strokeWidth="2" />
      {/* Handle */}
      <Rect x="40" y="46" width="20" height="6" rx="3" fill={T} />
      {/* Upper arm angled back */}
      <Line x1="50" y1="24" x2="42" y2="44" stroke={T} strokeWidth="5" strokeLinecap="round" />
      {/* Forearm extended straight down */}
      <Line x1="42" y1="44" x2="42" y2="76" stroke={T} strokeWidth="5" strokeLinecap="round" />
      {/* Elbow */}
      <Circle cx="42" cy="44" r="5" fill={P} />
      {/* Body */}
      <Line x1="50" y1="24" x2="60" y2="50" stroke={WD} strokeWidth="3" strokeLinecap="round" />
      <Line x1="60" y1="50" x2="60" y2="80" stroke={WD} strokeWidth="3" strokeLinecap="round" />
    </G>
  );
}

function Abs() {
  return (
    <G>
      {/* Floor line */}
      <Rect x="10" y="72" width="80" height="4" rx="2" fill={WD} />
      {/* Head */}
      <Circle cx="82" cy="58" r="8" fill={T} />
      {/* Body (plank) */}
      <Rect x="22" y="60" width="54" height="8" rx="4" fill={T} />
      {/* Left arm */}
      <Rect x="20" y="68" width="6" height="10" rx="2" fill={T} />
      {/* Right arm */}
      <Rect x="38" y="68" width="6" height="10" rx="2" fill={T} />
      {/* Legs */}
      <Rect x="10" y="62" width="14" height="6" rx="3" fill={T} />
    </G>
  );
}

function Band() {
  return (
    <G>
      {/* Left hand */}
      <Rect x="8"  y="44" width="12" height="12" rx="4" fill={WD} />
      {/* Right hand */}
      <Rect x="80" y="44" width="12" height="12" rx="4" fill={WD} />
      {/* Band stretched */}
      <Path
        d="M 20 50 Q 35 28 50 50 Q 65 72 80 50"
        fill="none" stroke={T} strokeWidth="5" strokeLinecap="round"
      />
      <Path
        d="M 20 50 Q 35 72 50 50 Q 65 28 80 50"
        fill="none" stroke={P} strokeWidth="5" strokeLinecap="round"
      />
    </G>
  );
}

function MedicineBall() {
  return (
    <G>
      <Circle cx="50" cy="50" r="32" fill={P} />
      <Path d="M 50 18 Q 68 34 68 50 Q 68 66 50 82 Q 32 66 32 50 Q 32 34 50 18 Z"
        fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
      <Line x1="18" y1="50" x2="82" y2="50" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
      <Circle cx="50" cy="50" r="10" fill="rgba(255,255,255,0.15)" />
    </G>
  );
}

function Mat() {
  return (
    <G>
      {/* Mat body */}
      <Rect x="10" y="34" width="72" height="32" rx="6" fill={P} />
      {/* Rolled end */}
      <Rect x="78" y="30" width="12" height="40" rx="6" fill={T} />
      <Circle cx="84" cy="50" r="8" fill={T} />
      {/* Texture lines */}
      <Line x1="22" y1="34" x2="22" y2="66" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      <Line x1="34" y1="34" x2="34" y2="66" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      <Line x1="46" y1="34" x2="46" y2="66" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      <Line x1="58" y1="34" x2="58" y2="66" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
    </G>
  );
}

function Elliptical() {
  return (
    <G>
      {/* Frame base */}
      <Rect x="20" y="76" width="60" height="8" rx="3" fill={WD} />
      {/* Center post */}
      <Rect x="46" y="30" width="8"  height="48" rx="3" fill={WD} />
      {/* Foot pedal tracks (ovals) */}
      <Path d="M 24 70 Q 22 45 50 38 Q 78 45 76 70 Q 78 82 50 76 Q 22 82 24 70 Z"
        fill="none" stroke={P} strokeWidth="3" />
      {/* Moving handles */}
      <Line x1="50" y1="30" x2="28" y2="58" stroke={T} strokeWidth="4" strokeLinecap="round" />
      <Line x1="50" y1="30" x2="72" y2="58" stroke={T} strokeWidth="4" strokeLinecap="round" />
      {/* Console */}
      <Rect x="36" y="18" width="28" height="14" rx="4" fill={P} />
    </G>
  );
}

function Stair() {
  return (
    <G>
      {/* 4 stair steps */}
      <Rect x="10" y="68" width="52" height="8" rx="2" fill={P} />
      <Rect x="22" y="56" width="52" height="8" rx="2" fill={P} />
      <Rect x="34" y="44" width="52" height="8" rx="2" fill={P} />
      <Rect x="46" y="32" width="52" height="8" rx="2" fill={P} />
      {/* Handrail */}
      <Line x1="16" y1="68" x2="52" y2="22" stroke={T} strokeWidth="3" strokeLinecap="round" />
      {/* Person going up */}
      <Circle cx="40" cy="26" r="7" fill={T} />
      <Line x1="40" y1="33" x2="40" y2="50" stroke={T} strokeWidth="4" strokeLinecap="round" />
      <Line x1="40" y1="44" x2="30" y2="52" stroke={T} strokeWidth="3" strokeLinecap="round" />
      <Line x1="40" y1="50" x2="34" y2="64" stroke={T} strokeWidth="4" strokeLinecap="round" />
      <Line x1="40" y1="50" x2="48" y2="56" stroke={T} strokeWidth="4" strokeLinecap="round" />
    </G>
  );
}

// ─── Map category → component ─────────────────────────────────────────────────

const ILLUSTRATIONS: Record<Category, React.FC> = {
  dumbbell:      Dumbbell,
  barbell:       Barbell,
  kettlebell:    Kettlebell,
  cable:         Cable,
  pullup:        PullUp,
  treadmill:     Treadmill,
  bike:          Bike,
  rowing:        Rowing,
  bench:         Bench,
  squat:         Squat,
  shoulder:      Shoulder,
  chest:         Chest,
  bicep:         Bicep,
  tricep:        Tricep,
  abs:           Abs,
  band:          Band,
  medicine_ball: MedicineBall,
  mat:           Mat,
  elliptical:    Elliptical,
  stair:         Stair,
  default:       Dumbbell,
};

// ─── Public component ─────────────────────────────────────────────────────────

type Props = {
  name: string;
  width?: number;
  height?: number;
  testID?: string;
};

export function ExerciseIllustration({ name, width = 100, height = 100, testID }: Props) {
  const category = categorizeExercise(name);
  const Drawing = ILLUSTRATIONS[category];
  return (
    <View style={{ width, height, backgroundColor: BG, overflow: 'hidden' }} testID={testID}>
      <Svg width={width} height={height} viewBox="0 0 100 100">
        <Drawing />
      </Svg>
    </View>
  );
}
