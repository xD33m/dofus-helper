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
  console.log("Reading Datas...");

  console.log("Loading ClueMap...");
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
  console.log("Loaded ClueMaps");

  console.log("Loading ClueNames...");
  data.clues.forEach((clueItem: any) => {
    const id = parseInt(clueItem["clue-id"]);
    let name = clueItem[langKey] || ""; // Access the name based on the country code
    name = normalizeUnicodeText(name).toLowerCase();
    ClueNamesMap.set(id, name);
  });
  console.log("Loaded ClueNames");
}

type ClueMetadata = {
  name: string;
  xPos: number;
  yPos: number;
  distance: number;
};

function getCluesInDirectionWithMetadata(
  x: number,
  y: number,
  direction: "up" | "down" | "left" | "right",
  radius: number = 10
): ClueMetadata[] {
  const clueMetadataInDirection: Map<string, ClueMetadata> = new Map(); // Keyed by clue name to track the closest clue

  // Iterate over all positions in CluesPosMap
  CluesPosMap.forEach((rowMap, xPos) => {
    rowMap.forEach((clueIds, yPos) => {
      let isValidPosition = false;

      // Determine if the position is in the specified direction within the radius
      switch (direction) {
        case "up":
          // Only consider positions above the current y (yPos <= y) and within the radius (moving upwards)
          if (xPos === x && yPos >= y && Math.abs(yPos - y) <= radius) {
            isValidPosition = true;
          }
          break;
        case "down":
          // Only consider positions below the current y (yPos >= y) and within the radius (moving downwards)
          if (xPos === x && yPos <= y && Math.abs(yPos - y) <= radius) {
            isValidPosition = true;
          }
          break;
        case "left":
          // Only consider positions left of the current x (xPos <= x) and within the radius (moving left)
          if (yPos === y && xPos <= x && Math.abs(xPos - x) <= radius) {
            isValidPosition = true;
          }
          break;
        case "right":
          // Only consider positions right of the current x (xPos >= x) and within the radius (moving right)
          if (yPos === y && xPos >= x && Math.abs(xPos - x) <= radius) {
            isValidPosition = true;
          }
          break;
      }

      // If position is valid for the given direction, add the clue names and metadata
      if (isValidPosition) {
        clueIds.forEach((clueId) => {
          const clueName = ClueNamesMap.get(clueId);
          if (clueName) {
            const distance = Math.sqrt(Math.pow(xPos - x, 2) + Math.pow(yPos - y, 2));

            // If the clue name already exists, compare the distances and keep the closest one
            const existingClue = clueMetadataInDirection.get(clueName);
            if (!existingClue || distance < existingClue.distance) {
              clueMetadataInDirection.set(clueName, { name: clueName, xPos, yPos, distance });
            }
          }
        });
      }
    });
  });

  // Return the list of closest clues
  return Array.from(clueMetadataInDirection.values());
}

export { loadClueData, CluesPosMap, ClueNamesMap, getCluesInDirectionWithMetadata };
