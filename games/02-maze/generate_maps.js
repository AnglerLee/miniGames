const fs = require('fs');

function generateMaze(rows, cols) {
    // 1 is wall, 0 is path
    const map = Array.from({ length: rows }, () => Array(cols).fill(1));
    const stack = [];
    const dirs = [
        [0, -2], // Up
        [0, 2],  // Down
        [-2, 0], // Left
        [2, 0]   // Right
    ];

    // Start from (1,1)
    let current = { x: 1, y: 1 };
    map[1][1] = 0;
    stack.push(current);

    while (stack.length > 0) {
        current = stack[stack.length - 1];
        const neighbors = [];

        for (const [dx, dy] of dirs) {
            const nx = current.x + dx;
            const ny = current.y + dy;

            if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && map[ny][nx] === 1) {
                neighbors.push({ x: nx, y: ny, dx, dy });
            }
        }

        if (neighbors.length > 0) {
            const chosen = neighbors[Math.floor(Math.random() * neighbors.length)];
            // Break wall between current and neighbor
            map[current.y + chosen.dy / 2][current.x + chosen.dx / 2] = 0;
            // Visit neighbor
            map[chosen.y][chosen.x] = 0;
            stack.push({ x: chosen.x, y: chosen.y });
        } else {
            stack.pop();
        }
    }

    // Ensure start (1,1) and goal (rows-2, cols-2) are always clear (though algorithm usually ensures connectivity)
    // Goal is typically at bottom-right interior cell

    // For even dimensions, the algorithm above (DFS with step 2) might leave the very last row/col as walls if not handled carefully.
    // Standard maze algorithms work best with odd dimensions (Ex: 11x11, 21x21).
    // If we receive even inputs (e.g. 10x10), we might need to adjust or accept that the effective playable area is smaller.
    // Let's stick effectively to odd dimensions logic or just handle boundaries.
    // To ensure it plays nice with 10x10, we'll just run it. If rows/cols are even, the last row/col will stay as walls, effectively making it a (rows-1)x(cols-1) maze, which is fine.

    return map;
}

const maps = {
    easy: [],
    normal: [],
    hard: []
};

// Generate 20 maps for each difficulty
// User Requested Dimensions:
// easy :  15 rows, 11 cols
// normal : 21 rows, 15 cols
// hard : 25 rows, 17 cols

for (let i = 0; i < 20; i++) {
    maps.easy.push(generateMaze(15, 11));
}

for (let i = 0; i < 20; i++) {
    // Changing to Odd numbers (21x15) to prevent double-wall artifacts
    maps.normal.push(generateMaze(21, 15));
}

for (let i = 0; i < 20; i++) {
    maps.hard.push(generateMaze(25, 17));
}

// Convert to JS file with global variable
const jsContent = `const MAZE_DATA = ${JSON.stringify(maps, null, 2)};`;

fs.writeFileSync('maps.js', jsContent);
console.log('maps.js generated successfully with ' +
    maps.easy.length + ' easy, ' +
    maps.normal.length + ' normal, ' +
    maps.hard.length + ' hard maps.');
