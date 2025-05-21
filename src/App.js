import React, { useState, useEffect, useCallback } from "react";
import { Button } from "./components/ui/button";
import { Slider } from "./components/ui/slider";
import logo from './logo.svg';

// Configuración del laberinto
const WIDTH = 39;
const HEIGHT = 33;


// Generador de laberintos mejorado
function generateMaze(width, height, start, goal, wallPercent = 0.05) {
  // Inicializar todo como muro (1)
  const maze = Array(height).fill().map(() => Array(width).fill(1));
  
  // Función auxiliar para tallar pasillos
  function carve(x, y) {
    maze[x][y] = 0; // Hacer pasillo
    
    // Direcciones aleatorias
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .sort(() => Math.random() - 0.5);
    
    for (const [dx, dy] of directions) {
      const nx = x + dx * 2;
      const ny = y + dy * 2;
      
      if (nx > 0 && nx < height - 1 && ny > 0 && ny < width - 1 && maze[nx][ny] === 1) {
        maze[x + dx][y + dy] = 0; // Quitar muro entre celdas
        carve(nx, ny);
      }
    }
  }
  
  // Empezar a tallar desde una posición impar
  carve(1, 1);
  
  // Configurar entrada (start) y muro en [0,0]
  maze[0][0] = 1;               // Muro en esquina superior izquierda
  maze[start[0]][start[1]] = 0; // Entrada en [1,0]
  
  // Asegurar camino desde la entrada
  if (maze[1][1] === 1) {
    maze[1][1] = 0;  // Conectar entrada al laberinto
  }

// Configurar salida (goal) y asegurar camino
maze[goal[0]][goal[1]] = 0;  // Posición de salida
// Coordenadas relativas de los 8 vecinos alrededor de goal (incluye esquinas)
const vecinos = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1],          [ 0, 1],
  [ 1, -1], [ 1, 0], [ 1, 1]
];

// Índices de las posiciones cardinales en el array vecinos: 1 (arriba), 3 (izquierda), 4 (derecha), 6 (abajo)
const cardinales = [1, 3, 4, 6];
// Filtra solo las entradas cardinales que NO sean muros externos
const posiblesEntradas = cardinales.filter(idx => {
  const [dx, dy] = vecinos[idx];
  const x = goal[0] + dx;
  const y = goal[1] + dy;
  return x > 0 && x < height - 1 && y > 0 && y < width - 1;
});
const entradaIdx = posiblesEntradas[Math.floor(Math.random() * posiblesEntradas.length)];
const [ex, ey] = [goal[0] + vecinos[entradaIdx][0], goal[1] + vecinos[entradaIdx][1]];

// Rodea goal con muros, excepto la entrada (que ahora nunca será una esquina)
vecinos.forEach(([dx, dy], idx) => {
  const x = goal[0] + dx;
  const y = goal[1] + dy;
  if (x >= 0 && x < height && y >= 0 && y < width) {
    maze[x][y] = (idx === entradaIdx) ? 0 : 1;
  }
});

// Rodea TODOS los muros de la isla (incluyendo esquinas) con pasillos
vecinos.forEach(([dx, dy], idx) => {
  if (idx === entradaIdx) return;
  const mx = goal[0] + dx;
  const my = goal[1] + dy;
  [
    [-1, -1], [-1, 0], [-1, 1],
    [ 0, -1],          [ 0, 1],
    [ 1, -1], [ 1, 0], [ 1, 1]
  ].forEach(([ddx, ddy]) => {
    const px = mx + ddx;
    const py = my + ddy;
    // Protege los muros externos: no crear pasillos en los bordes
    if (
      px > 0 && px < height - 1 && py > 0 && py < width - 1 && // <-- solo interior
      !(px === goal[0] && py === goal[1]) &&
      !(px === ex && py === ey) &&
      !vecinos.some(([vdx, vdy]) => px === goal[0] + vdx && py === goal[1] + vdy)
    ) {
      maze[px][py] = 0;
    }
  });
});
// --- HACER LOS MUROS MENOS CONTINUOS ---
for (let i = 1; i < height - 1; i++) {
  for (let j = 1; j < width - 1; j++) {
    // No modificar la isla de muros ni el goal ni la entrada de la isla
    const esIsla =
      (Math.abs(i - goal[0]) <= 1 && Math.abs(j - goal[1]) <= 1) ||
      (i === ex && j === ey);
    if (!esIsla && maze[i][j] === 1 && Math.random() < wallPercent) {
      maze[i][j] = 0;
    }
  }
}

  // --- SOLO UNA ENTRADA A LA SALIDA ---
  // Encuentra las celdas adyacentes a la salida
  const adj = [
    [goal[0] + 1, goal[1]],
    [goal[0] - 1, goal[1]],
    [goal[0], goal[1] + 1],
    [goal[0], goal[1] - 1]
  ].filter(([x, y]) => x >= 0 && x < height && y >= 0 && y < width);

  // Mantén solo una celda adyacente como pasillo (la primera que ya sea pasillo)
  let found = false;
  for (const [x, y] of adj) {
    if (maze[x][y] === 0 && !found) {
      found = true; // deja solo la primera como pasillo
    } else {
      maze[x][y] = 1; // el resto, pon muro
    }
  }


  return maze;
}

const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // Izquierda (←) → Abajo (↓) → Derecha (→) → Arriba (↑)
// Algoritmos de búsqueda corregidos
async function bfs(start, goal, maze, onVisit, delay) {
  let queue = [[start]];
  let visited = new Set([start.toString()]);
  let steps = 0;
  let maxQueueSize = 1;

  while (queue.length > 0) {
    maxQueueSize = Math.max(maxQueueSize, queue.length);
    const path = queue.shift();
    const [x, y] = path[path.length - 1];
    steps++;

    onVisit?.(x, y, steps, queue.length);

    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));

    if (x === goal[0] && y === goal[1]) {
      // Actualiza maxQueueSize antes de retornar
      maxQueueSize = Math.max(maxQueueSize, queue.length);
      return { path, steps, maxQueueSize, visited: visited.size };
    }

    for (let [dx, dy] of directions) {
      const next = [x + dx, y + dy];
      const nextKey = next.toString();
      if (isValid(next, maze) && !visited.has(nextKey)) {
        visited.add(nextKey);
        queue.push([...path, next]);
      }
    }
  }
  // Actualiza maxQueueSize antes de retornar
  maxQueueSize = Math.max(maxQueueSize, queue.length);
  return { path: null, steps, maxQueueSize, visited: visited.size };
}
// Función de validación independiente
function isValid(pos, maze) {
  const [x, y] = pos;
  return x >= 0 && x < HEIGHT && y >= 0 && y < WIDTH && maze[x][y] === 0;
}

// DFS (Búsqueda en Profundidad)
async function dfs(start, goal, maze, onVisit, delay, limit = Infinity) {
  let stack = [[start]];
  let visited = new Set([start.toString()]);
  let steps = 0;
  let maxStackSize = 1;

  while (stack.length > 0) {
    maxStackSize = Math.max(maxStackSize, stack.length);
    const path = stack.pop();
    const [x, y] = path[path.length - 1];
    steps++;

    onVisit?.(x, y, steps, stack.length);

    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));

    if (x === goal[0] && y === goal[1]) {
      maxStackSize = Math.max(maxStackSize, stack.length);
      return { path, steps, maxStackSize, visited: visited.size };
    }

    if (path.length - 1 < limit) {
      for (let [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]].reverse()) {
        const next = [x + dx, y + dy];
        const nextKey = next.toString();
        if (isValid(next, maze) && !visited.has(nextKey)) {
          visited.add(nextKey);
          stack.push([...path, next]);
        }
      }
    }
  }
  maxStackSize = Math.max(maxStackSize, stack.length);

  return { path: null, steps, maxStackSize, visited: visited.size };
}

async function dls(start, goal, maze, onVisit, limit, delay) {
  let stack = [[start]];
  let visited = new Set([start.toString()]);
  let steps = 0;
  let maxStackSize = 1;

  while (stack.length > 0) {
    maxStackSize = Math.max(maxStackSize, stack.length);
    const path = stack.pop();
    const [x, y] = path[path.length - 1];
    steps++;

    onVisit?.(x, y, steps, stack.length);

    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));

    if (x === goal[0] && y === goal[1]) {
      maxStackSize = Math.max(maxStackSize, stack.length);
      return { path, steps, maxStackSize, visited: visited.size, limitReached: false };
    }

    if (path.length - 1 < limit) {
      for (let [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]].reverse()) {
        const next = [x + dx, y + dy];
        const nextKey = next.toString();
        if (isValid(next, maze) && !visited.has(nextKey)) {
          visited.add(nextKey);
          stack.push([...path, next]);
        }
      }
    }
  }
  maxStackSize = Math.max(maxStackSize, stack.length);
  // Si no se encontró solución, marca que el límite fue alcanzado
  return { path: null, steps, maxStackSize: limit, visited: visited.size, limitReached: true };
}
// IDS (Búsqueda en Profundidad Iterativa)
async function ids(start, goal, maze, onVisit, delay) {
  let totalSteps = 0;
  let totalVisited = 0;
  let maxStackSize = 0;

  for (let depth = 0; depth < 1000; depth++) {
    let currentSteps = 0;
    let currentVisited = 0;

    const result = await dls(start, goal, maze, (x, y, steps, stackSize) => {
      currentSteps = steps;
      currentVisited++;
      maxStackSize = Math.max(maxStackSize, stackSize);
      onVisit?.(x, y, totalSteps + steps, stackSize);
    }, depth, delay);

    totalSteps += currentSteps;
    totalVisited += currentVisited;

    if (result.path) {
      return {
        ...result,
        steps: totalSteps,
        visited: totalVisited,
        maxStackSize,
        depth
      };
    }
  }
  return { path: null, steps: totalSteps, maxStackSize, visited: totalVisited, depth: 100 };
}


// Búsqueda Bidireccional
async function bidirectional(start, goal, maze, onVisit, delay) {
  let queueStart = [[start]];
  let queueGoal = [[goal]];
  let visitedStart = new Map([[start.toString(), [start]]]);
  let visitedGoal = new Map([[goal.toString(), [goal]]]);
  let steps = 0;
  let maxQueueSize = 2;

  while (queueStart.length > 0 && queueGoal.length > 0) {
    maxQueueSize = Math.max(maxQueueSize, queueStart.length + queueGoal.length);
    steps++;

    // Expansión desde el inicio
    const pathStart = queueStart.shift();
    const [x1, y1] = pathStart[pathStart.length - 1];
    onVisit?.(x1, y1, steps, queueStart.length + queueGoal.length, 'start');

    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));

    for (let [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const next = [x1 + dx, y1 + dy];
      const key = next.toString();
      if (isValid(next, maze) && !visitedStart.has(key)) {
        visitedStart.set(key, [...pathStart, next]);
        queueStart.push([...pathStart, next]);

        if (visitedGoal.has(key)) {
          const pathGoal = visitedGoal.get(key);
          maxQueueSize = Math.max(maxQueueSize, queueStart.length + queueGoal.length);
          return {
            path: [...visitedStart.get(key), ...pathGoal.reverse().slice(1)],
            steps,
            maxQueueSize,
            visited: visitedStart.size + visitedGoal.size,
            meetingPoint: next
          };
        }
      }
    }

    // Expansión desde el objetivo
    const pathGoal = queueGoal.shift();
    const [x2, y2] = pathGoal[pathGoal.length - 1];
    onVisit?.(x2, y2, steps, queueStart.length + queueGoal.length, 'goal');

    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));

    for (let [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const next = [x2 + dx, y2 + dy];
      const key = next.toString();
      if (isValid(next, maze) && !visitedGoal.has(key)) {
        visitedGoal.set(key, [...pathGoal, next]);
        queueGoal.push([...pathGoal, next]);

        if (visitedStart.has(key)) {
          const pathStart = visitedStart.get(key);
          maxQueueSize = Math.max(maxQueueSize, queueStart.length + queueGoal.length);
          return {
            path: [...pathStart, ...visitedGoal.get(key).reverse().slice(1)],
            steps,
            maxQueueSize,
            visited: visitedStart.size + visitedGoal.size,
            meetingPoint: next
          };
        }
      }
    }
  }
  maxQueueSize = Math.max(maxQueueSize, queueStart.length + queueGoal.length);
  return { path: null, steps, maxQueueSize, visited: visitedStart.size + visitedGoal.size };
}

export default function Laberinto() {
  const [dlsLimit, setDlsLimit] = useState(50);
  const [start, setStart] = useState([17, 0]);
  const [goal, setGoal] = useState([17, 19]);
  const [wallPercent, setWallPercent] = useState(0.05);

  const [maze, setMaze] = useState(() => generateMaze(WIDTH, HEIGHT, start, goal, wallPercent));
  const [path, setPath] = useState([]);
  const [visited, setVisited] = useState(new Set());
  const [algo, setAlgo] = useState("bfs");
  const [isSolving, setIsSolving] = useState(false);
  const [currentPos, setCurrentPos] = useState(start);
  const [stats, setStats] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [meetingPoint, setMeetingPoint] = useState(null);
  
  //mapeo de algoritmos 
  const algorithms = {
    bfs: (start, goal, maze, onVisit, delay) => bfs(start, goal, maze, onVisit, delay),
    dfs: (start, goal, maze, onVisit, delay) => dfs(start, goal, maze, onVisit, delay),
    dls: (start, goal, maze, onVisit, delay) => dls(start, goal, maze, onVisit, dlsLimit, delay),
    ids: (start, goal, maze, onVisit, delay) => ids(start, goal, maze, onVisit, delay),
    bidirectional: (start, goal, maze, onVisit, delay) => bidirectional(start, goal, maze, onVisit, delay),
  };

  // Generar un nuevo laberinto
  const generateNewMaze = useCallback(() => {
    const newMaze = generateMaze(WIDTH, HEIGHT, start, goal, wallPercent);
    setMaze(newMaze);
    reset();
  }, [start, goal, wallPercent]);

  // Resetear el laberinto
  function reset() {
    setPath([]);
    setVisited(new Set());
    setCurrentPos(start);
    setStats(null);
    setIsSolving(false);
    setMeetingPoint(null);
  }

async function solve() {
  reset();
  setIsSolving(true);
  
  const visitedCells = new Set();
  let meetingPoint = null;
  
  const onVisit = (x, y, steps, queueSize, type = 'normal') => {
    visitedCells.add(`${x},${y}`);
    setVisited(new Set(visitedCells));
    setCurrentPos([x, y]);
    
    if (type === 'start' || type === 'goal') {
      meetingPoint = [x, y];
      setMeetingPoint(meetingPoint);
    }
  };
  
  try {
    const result = await algorithms[algo](start, goal, maze, onVisit, speed);
    
    setPath(result.path || []);
    setStats({
      steps: result.steps,
      maxQueueSize: result.maxQueueSize || result.maxStackSize,
      visited: result.visited,
      pathLength: result.path?.length || 0,
      found: !!result.path
    });
    
    if (result.meetingPoint) {
      setMeetingPoint(result.meetingPoint);
    }
  } finally {
    setIsSolving(false);
    setShowStats(true);
  }
}

  // Renderizar celda del laberinto
  function renderCell(x, y) {
   const isStart = x === start[0] && y === start[1];
    const isGoal = x === goal[0] && y === goal[1];
    const isPath = path.some(([px, py]) => px === x && py === y);
    const isVisited = visited.has(`${x},${y}`);
    const isCurrent = currentPos[0] === x && currentPos[1] === y;
    const isMeetingPoint = meetingPoint && meetingPoint[0] === x && meetingPoint[1] === y;
    const isWall = maze[x][y] === 1;

    let className = "w-6 h-6 border border-gray-300 flex items-center justify-center transition-all duration-200 ";
    
    if (isWall) {
      className += "bg-gray-800 ";
    } else if (isStart) {
      className += "bg-green-500 font-bold ";
    } else if (isGoal) {
      className += "bg-red-500 font-bold ";
    } else if (isMeetingPoint && algo === 'bidirectional') {
      className += "bg-purple-500 animate-pulse ";
    } else if (isCurrent && isSolving) {
      className += "bg-yellow-400 ";
    } else if (isPath) {
      className += "bg-green-400 ";
    } else if (isVisited) {
      className += "bg-blue-600 ";
    } else {
      className += "bg-white ";
    }

  return (
    <div key={`${x}-${y}`} className={className}>
      {isStart && (stats && stats.found ?'S':<img src={logo} alt="Logo" className="w-40 h-40"/>) }
      {isGoal && (stats && stats.found ? <img src={logo} alt="Logo" className="w-40 h-40" /> : 'G')}
      {isMeetingPoint && algo === 'bidirectional' && 'M'}
    </div>
  );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-center">Laberinto del Raton</h1>
      
      <div className="flex flex-col md:flex-row gap-6">
        {/* Panel de control */}
        <div className="w-full md:w-1/3 space-y-4">
          <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-2">Configuración</h2>
              <p className="text-sm mb-2">Tamaño: X={WIDTH} Y={HEIGHT}</p>
                        {/* Inputs para start y goal */}
            <div className="mb-4 flex gap-2">
              <div>
                <label className="block text-xs">Inicio X</label>
                <input type="number" min={0} max={WIDTH-1} value={start[1]} onChange={e => setStart([start[0], +e.target.value])} className="w-16 p-1 border rounded" />
              </div>
              <div>
                <label className="block text-xs">Inicio Y</label>
                <input type="number" min={0} max={HEIGHT-1} value={start[0]} onChange={e => setStart([+e.target.value, start[1]])} className="w-16 p-1 border rounded" />
              </div>
              <div>
                <label className="block text-xs">Meta X</label>
                <input type="number" min={0} max={WIDTH-1} value={goal[1]} onChange={e => setGoal([goal[0], +e.target.value])} className="w-16 p-1 border rounded" />
              </div>
              <div>
                <label className="block text-xs">Meta Y</label>
                <input type="number" min={0} max={HEIGHT-1} value={goal[0]} onChange={e => setGoal([+e.target.value, goal[1]])} className="w-16 p-1 border rounded" />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Algoritmos de busqueda no informados:</label>
<select 
  value={algo} 
  onChange={(e) => {
    setAlgo(e.target.value);
    reset();
  }} 
  className="w-full p-2 border rounded"
  disabled={isSolving}
>
  <option value="bfs">Búsqueda en Anchura (BFS)</option>
  <option value="dfs">Búsqueda en Profundidad (DFS)</option>
  <option value="dls">Profundidad Acotada (DLS)</option>
  <option value="ids">Profundidad Iterativa (IDS)</option>
  <option value="bidirectional">Búsqueda Bidireccional</option>
</select>
            </div>

            {algo === "dls" && (
  <div className="mb-4">
    <label className="block text-sm font-medium mb-1">Profundidad máxima DLS:</label>
    <input
      type="number"
      min={1}
      max={WIDTH * HEIGHT}
      value={dlsLimit}
      onChange={e => setDlsLimit(Number(e.target.value))}
      disabled={isSolving}
      className="w-24 p-1 border rounded"
    />
  </div>
)}

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Porcentaje de muros aleatorios: {(wallPercent*100).toFixed(1)}%</label>
              <Slider 
                value={[wallPercent*100]}
                onValueChange={([value]) => setWallPercent(value/100)}
                min={0}
                max={30}
                step={0.5}
                disabled={isSolving}
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Velocidad: {speed}ms</label>
              <Slider 
                value={algo=="ids"?0:[speed]}
                onValueChange={([value]) => setSpeed(value)}
                min={0}
                max={algo=="ids"?0:30}
                step={1}
                disabled={isSolving||algo=="ids"}
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={solve} 
                disabled={isSolving}
                className="flex-1"
              >
                {isSolving ? 'Ejecutando...' : 'Resolver'}
              </Button>
              <Button 
                onClick={reset} 
                variant="outline" 
                className="flex-1"
              >
                Reiniciar
              </Button>
              <Button 
                onClick={generateNewMaze} 
                variant="outline" 
                className="flex-1"
                disabled={isSolving}
              >
                Nuevo Laberinto
              </Button>
            </div>
          </div>
          
          {showStats && stats && (
            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-2">Estadísticas</h2>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">Pasos totales:</span> {stats.steps}</p>
                <p><span className="font-medium">Máximo en cola/pila:</span> {stats.maxQueueSize}</p>
                <p><span className="font-medium">Celdas visitadas:</span> {stats.visited}</p>
{stats.pathLength > 0 ? (
  <p><span className="font-medium">Longitud del camino:</span> {stats.pathLength}</p>
) : (
  <>
    <p className="text-red-500">No se encontró solución</p>
    {algo === "dls" && stats.limitReached && (
      <p className="text-red-500">Límite de profundidad alcanzado</p>
    )}
  </>
)}
                {stats.depth && <p><span className="font-medium">Profundidad final (IDS):</span> {stats.depth}</p>}
              </div>
            </div>
          )}
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">Leyenda</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-500 mr-2"></div>
                <span>Inicio (S)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-red-500 mr-2"></div>
                <span>Objetivo (G)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-600 mr-2"></div>
                <span>Visitado</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-400 mr-2"></div>
                <span>Camino</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-yellow-400 mr-2"></div>
                <span>Actual</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-purple-500 mr-2"></div>
                <span>Punto de encuentro (M)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-gray-800 mr-2"></div>
                <span>Muro</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Laberinto */}
        <div className="w-full md:w-2/3">
          <div 
            className="grid gap-px p-1 bg-gray-300 rounded-lg overflow-hidden shadow-lg"
            style={{
              gridTemplateColumns: `repeat(${WIDTH}, minmax(0, 1fr))`
            }}
          >
            {maze.map((row, i) =>
              row.map((_, j) => renderCell(i, j))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}