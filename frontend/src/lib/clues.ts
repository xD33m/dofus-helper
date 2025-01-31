import { Clue } from "@/components/overlay/hunt/hunt";
import { getAllClues } from "@/db/cluesDatabase";
import Fuse from "fuse.js";
import { normalizeUnicodeText } from "normalize-unicode-text";

type CluesInDirection = {
  name: string;
  distance: number;
  xPos: number;
  yPos: number;
}[];

// TODO: Filter out coordinates that were already visited (reset on start position click?)

export function matchClues(
  ocrString: string,
  directionClues: CluesInDirection
): { clue: Clue | null; error: string | null } {
  // --- 1) Split & normalize your OCR lines
  const linesArr = ocrString
    .split("\n")
    .map((l) => normalizeUnicodeText(l.trim()))
    .filter(Boolean);

  const normalizedOCRLines = linesArr
    .map((line) =>
      line
        .toLowerCase()
        .replace(/œ/g, "oe")
        .replace(/\b(ex cours|encourrs|enesues|en cours|encours|encours q)\b/gi, "")
        .replace(/\b(wurm|lauft|laut|läuft|laurtq|um so)\b/gi, "")
        .replace(/\bq\b/gi, "")
        .replace(/\b\d+\b/g, "") // remove standalone numbers
        .replace(/[^a-z\s]/gi, "")
        .trim()
    )
    .filter(
      (line) =>
        line.length > 0 &&
        !line.includes("etape") &&
        !line.includes("départ") &&
        !line.includes("essais restants")
    );

  console.log("🔠 Normalized OCR Lines:", normalizedOCRLines);

  // --- 2) Normalize *all* known clues from the DB
  const allClues = getAllClues(); // Full DB of clues
  const normalizedAllClues = allClues.map((clue) => ({
    originalName: clue, // Keep original for reference (optional)
    normalizedName: clue
      .toLowerCase()
      .replace(/\b\d+\b/g, "")
      .replace(/[^a-z\s]/gi, "")
      .trim(),
  }));

  // --- 3) Prepare Fuse for searching among *all* known clues
  const fuseAllClues = new Fuse(normalizedAllClues, {
    keys: ["normalizedName"],
    threshold: 0.5, // Lower = more strict
    includeScore: true,
    minMatchCharLength: 3,
  });

  // --- 4) Also normalize the direction clues
  // so we can confirm the final match is actually in them
  const normalizedDirectionClues = directionClues.map((clue) => ({
    ...clue,
    normalizedName: clue.name
      .toLowerCase()
      .replace(/\b\d+\b/g, "")
      .replace(/[^a-z\s]/gi, "")
      .trim(),
  }));

  // A quick helper to see if a clue is among directionClues
  function isInDirectionClues(normalizedName: string): boolean {
    return normalizedDirectionClues.some((dc) => dc.normalizedName === normalizedName);
  }

  // --- 5) Instead of returning the first (top) Fuse result,
  // we want the *best* result that actually is in directionClues
  // Returns null if none in the results are in directionClues
  function getBestMatchInDirection(text: string): string | null {
    const results = fuseAllClues.search(text);

    // results are sorted by ascending score (best = lowest)
    for (const r of results) {
      if (r?.score !== undefined && r.score < 0.5) {
        const matchedNormalizedName = r.item.normalizedName;
        if (isInDirectionClues(matchedNormalizedName)) {
          // Found a valid clue that's *also* in direction clues
          return matchedNormalizedName;
        }
      } else {
        // If the best score is already >= 0.5, the rest won't be better
        break;
      }
    }
    return null; // No match found among direction clues
  }

  // We'll store the last valid clue (the actual normalized text)
  let lastValidClueText: string | null = null;

  // --- 6) Identify the LAST valid clue from bottom to top
  // We try single line, then line+next line, etc.
  // The moment we find one that is in direction clues, we stop.
  outerLoop: for (let i = normalizedOCRLines.length - 1; i >= 0; i--) {
    const line = normalizedOCRLines[i];

    // (a) Single-line search
    const match1 = getBestMatchInDirection(line);
    if (match1) {
      console.log("✅ Single-line match:", line, "->", match1);
      lastValidClueText = match1;
      break outerLoop;
    }

    // (b) Try line + next line, if available
    if (i + 1 < normalizedOCRLines.length) {
      const combo2 = line + " " + normalizedOCRLines[i + 1];
      const match2 = getBestMatchInDirection(combo2);
      if (match2) {
        console.log("✅ Two-line match:", combo2, "->", match2);
        lastValidClueText = match2;
        break outerLoop;
      }
    }

    // (c) Optionally, line + next 2 lines, if available
    if (i + 2 < normalizedOCRLines.length) {
      const combo3 = line + " " + normalizedOCRLines[i + 1] + " " + normalizedOCRLines[i + 2];
      const match3 = getBestMatchInDirection(combo3);
      if (match3) {
        console.log("✅ Three-line match:", combo3, "->", match3);
        lastValidClueText = match3;
        break outerLoop;
      }
    }

    // Could keep going with more lines if your OCR frequently splits it more,
    // but usually 2-3 lines is enough for typical “In Fischgräten behauener Felsen”.
  }

  // If we never found a match
  if (!lastValidClueText) {
    return { clue: null, error: "No valid clue found on screen" };
  }

  // --- 7) Now we have the final matched normalized text,
  // find it in the directionClues (which we already know is guaranteed to exist),
  // and return that object.
  const finalMatch = normalizedDirectionClues.find(
    (clue) => clue.normalizedName === lastValidClueText
  );

  if (finalMatch) {
    console.log("🎯 Matched Clue in Direction:", finalMatch);
    return { clue: finalMatch, error: null };
  }

  // This theoretically shouldn't happen if we only pick matches in directionClues,
  // but in case there's any mismatch:
  console.log("❌ No matching clue found in direction clues, unexpected fallback");
  return {
    clue: null,
    error: `${lastValidClueText} was not found in this direction`,
  };
}
