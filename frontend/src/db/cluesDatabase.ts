import { normalizeUnicodeText } from "normalize-unicode-text";
import data from "@/assets/clues.json";

// Maps to hold data
type CluesPosMapType = Map<number, Map<number, number[]>>;
type ClueNamesMapType = Map<number, string>;

const CluesPosMap: CluesPosMapType = new Map();
const ClueNamesMap: ClueNamesMapType = new Map();

// Reading embedded JSON file (replace 'clues.json' with the actual path)

// Function to parse and load data
function loadClueData(countryCode: string): void {
  const langKey = `name-${countryCode}`;

  Object.values(data.maps).forEach((mapItem: any) => {
    const pos = mapItem.position;
    const x = pos.x;
    const y = pos.y;

    const clues: number[] = mapItem.clues.map((clue: any) => parseInt(clue));

    if (!CluesPosMap.has(x)) {
      CluesPosMap.set(x, new Map());
    }

    const rowMap = CluesPosMap.get(x)!;
    rowMap.set(y, clues);
  });

  data.clues.forEach((clueItem: any) => {
    const id = parseInt(clueItem["clue-id"]);
    let name = clueItem[langKey] || ""; // Access the name based on the country code
    name = normalizeUnicodeText(name).toLowerCase();
    ClueNamesMap.set(id, name);
  });

  console.log(`✅ Clues data loaded ${countryCode}`);
}

type ClueMetadata = {
  name: string;
  xPos: number;
  yPos: number;
  distance: number;
};

/**
 * Returns clues found within 10 steps of (x, y) in a single direction.
 * (Excludes the starting position itself.)
 */
function getCluesInDirectionWithMetadata(
  x: number,
  y: number,
  direction: "up" | "down" | "left" | "right"
): ClueMetadata[] {
  // A map from clueName -> the closest ClueMetadata
  const cluesByName = new Map<string, ClueMetadata>();

  console.log(`Searching for clues in direction ${direction} from (${x}, ${y})`);

  let stepX = 0;
  let stepY = 0;

  switch (direction) {
    case "up":
      stepY = -1;
      break;
    case "down":
      stepY = 1;
      break;
    case "left":
      stepX = -1;
      break;
    case "right":
      stepX = 1;
      break;
  }

  // Up to 10 steps in that direction
  for (let i = 1; i <= 10; i++) {
    const newX = x + stepX * i;
    const newY = y + stepY * i;

    // Check if we have a row for newX
    const rowMap = CluesPosMap.get(newX);
    if (!rowMap) continue;

    // Check if we have any clue IDs for newY
    const clueIds = rowMap.get(newY);
    if (!clueIds) continue;

    for (const clueId of clueIds) {
      const clueName = ClueNamesMap.get(clueId);
      if (!clueName) continue;

      // Euclidean distance, or you can treat "i" as the distance in a grid sense
      const distance = Math.sqrt((newX - x) ** 2 + (newY - y) ** 2);
      if (distance === 0) continue; // exclude the starting position

      const existing = cluesByName.get(clueName);
      if (!existing || distance < existing.distance) {
        // either this clueName hasn't been stored yet or this new one is closer
        cluesByName.set(clueName, {
          name: clueName,
          xPos: newX,
          yPos: newY,
          distance,
        });
      }
    }
  }

  // Convert the map to an array and sort
  const uniqueClues = Array.from(cluesByName.values());
  uniqueClues.sort((a, b) => a.name.localeCompare(b.name));
  return uniqueClues;
}

function getAllClues(): string[] {
  return Array.from(ClueNamesMap.values());
}

export { loadClueData, CluesPosMap, ClueNamesMap, getCluesInDirectionWithMetadata, getAllClues };
