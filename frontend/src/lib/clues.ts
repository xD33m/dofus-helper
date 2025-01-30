import { getAllClues } from "@/db/cluesDatabase";
import Fuse from "fuse.js";
import { normalizeUnicodeText } from "normalize-unicode-text";

type CluesInDirection = {
  name: string;
  distance: number;
  xPos: number;
  yPos: number;
}[];

export function matchClues(ocrString: string, directionClues: CluesInDirection): any | null {
  const linesArr = ocrString
    .split("\n")
    .map((l) => normalizeUnicodeText(l.trim())) // Normalize OCR output
    .filter(Boolean); // Remove empty lines

  // Step 1: Normalize OCR lines to remove unwanted characters
  const normalizedOCRLines = linesArr
    .map(
      (line) =>
        line
          .toLowerCase()
          .replace(/œ/g, "oe") // Convert "œ" to "oe"
          .replace(/\b(encourrs|enesues|en cours|encours|encours q)\b/gi, "") // Remove "encours" and "encours q"
          .replace(/\bq\b/gi, "") // Remove any leftover standalone "q"
          .replace(/\b\d+\b/g, "") // Remove standalone numbers
          .replace(/[^a-z\s]/gi, "") // Remove special characters
          .trim() // Trim spaces after cleaning
    )
    .filter(
      (line) =>
        line.length > 0 && // Remove empty lines
        !line.startsWith("etape") && // Ignore "Étape" lines
        !line.startsWith("départ") && // Ignore "Départ" lines
        !line.includes("essais restants") // Ignore "essais restants"
    );

  console.log("🔠 Normalized OCR Lines:", normalizedOCRLines);

  // Step 2: Normalize ALL CLUES (to identify valid clues from OCR)
  const normalizedAllClues = getAllClues().map((clue) => ({
    normalizedName: clue
      .toLowerCase()
      .replace(/\b\d+\b/g, "") // Remove standalone numbers
      .replace(/[^a-z\s]/gi, "") // Remove special characters
      .trim(),
  }));

  // Step 3: Use Fuse.js to check if an OCR line is a valid clue
  const fuseAllClues = new Fuse(normalizedAllClues, {
    keys: ["normalizedName"],
    threshold: 0.5, // Lower = stricter matching
    includeScore: true,
    minMatchCharLength: 4,
  });

  let lastValidClueText: string | null = null;

  // Step 4: Identify the LAST valid clue from the OCR list
  for (let i = normalizedOCRLines.length - 1; i >= 0; i--) {
    const ocrLine = normalizedOCRLines[i];
    const results = fuseAllClues.search(ocrLine);

    console.log("🔍 OCR Line:", ocrLine, results);

    if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.5) {
      lastValidClueText = results[0].item.normalizedName; // Store last valid clue text
      console.log("✅ Last detected clue:", lastValidClueText);
      break; // Stop once the last clue is found
    }
  }

  if (!lastValidClueText) return null; // If no valid clue is found, return null

  // Step 5: Match the last valid clue against the `directionClues` list
  const normalizedDirectionClues = directionClues.map((clue) => ({
    ...clue,
    normalizedName: clue.name
      .toLowerCase()
      .replace(/\b\d+\b/g, "") // Remove standalone numbers
      .replace(/[^a-z\s]/gi, "") // Remove special characters
      .trim(),
  }));

  console.log("🔠 Direction Clues:", normalizedDirectionClues);

  const finalMatch = normalizedDirectionClues.find(
    (clue) => clue.normalizedName === lastValidClueText
  );

  if (finalMatch) {
    console.log("🎯 Matched Clue in Direction:", finalMatch);
    return finalMatch; // Return the found clue
  }

  console.log("❌ No matching clue found in direction clues");
  return null;
}
