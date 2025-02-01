import React, { useState, useEffect, useRef, useCallback } from "react";
import Downshift from "downshift";
import Fuse from "fuse.js";

import { loadClueData, getCluesInDirectionWithMetadata } from "@/db/cluesDatabase";

import "./hunt.css";
import { FaArrowUp, FaArrowDown, FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { matchClues } from "@/lib/clues";

// Language configurations
const LANGUAGES = {
  fr: { clueLang: "fr", ocrLang: "fra", flag: "FR" },
  de: { clueLang: "de", ocrLang: "deu", flag: "DE" },
};

export type Clue = {
  name: string;
  distance: number;
  xPos: number;
  yPos: number;
  normalizedName?: string;
};

type SelectedClueDetails = {
  direction: JSX.Element | null;
  distance: string;
  coordinates: string;
  clue: string;
} | null;

const Hunt: React.FC = () => {
  console.log("🔍 Hunt Component");

  // -----------------------------------------------------
  // 1) State + Refs
  // -----------------------------------------------------
  const [language, setLanguage] = useState<"fr" | "de">("fr");
  const [clueLang, setClueLang] = useState<string>(LANGUAGES["fr"].clueLang);
  const [ocrLang, setOcrLang] = useState<string>(LANGUAGES["fr"].ocrLang);

  // Ref to store the latest ocrLang
  const ocrLangRef = useRef<string>(ocrLang);
  useEffect(() => {
    ocrLangRef.current = ocrLang;
    console.log(`📝 OCR Language updated to: ${ocrLang}`);
  }, [ocrLang]);

  const [activeDirection, setActiveDirection] = useState<"up" | "down" | "left" | "right" | null>(
    null
  );
  const [coordinates, setCoordinates] = useState({ x: "", y: "" });
  const [startingCoordinates, setStartingCoordinates] = useState({
    x: "",
    y: "",
  }); // New state for starting point
  const [cluesInDirection, setCluesInDirection] = useState<Clue[]>([]);
  const [filteredClues, setFilteredClues] = useState<Clue[]>([]);
  const [selectedClueDetails, setSelectedClueDetails] = useState<SelectedClueDetails>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize Fuse with dynamic cluesInDirection
  const fuse = useRef<Fuse<Clue>>(
    new Fuse(cluesInDirection, {
      keys: ["name", "normalizedName"],
      threshold: 0.4,
      minMatchCharLength: 2,
    })
  ).current;

  // Update Fuse whenever cluesInDirection changes
  useEffect(() => {
    fuse.setCollection(cluesInDirection);
    console.log("🔄 Fuse collection updated:", cluesInDirection);
  }, [cluesInDirection, fuse]);

  // Language toggle handler
  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => (prev === "fr" ? "de" : "fr"));
    console.log(`🌐 Language toggled to: ${language === "fr" ? "de" : "fr"}`);
  }, [language]);

  // Update clueLang and ocrLang based on selected language
  useEffect(() => {
    setClueLang(LANGUAGES[language].clueLang);
    setOcrLang(LANGUAGES[language].ocrLang);
    console.log(
      `🌐 Language set to ${language}. ClueLang: ${LANGUAGES[language].clueLang}, OCRLang: ${LANGUAGES[language].ocrLang}`
    );
  }, [language]);

  // Load clue data whenever clueLang changes
  useEffect(() => {
    try {
      loadClueData(clueLang);
      console.log(`🔄 Clue data loaded for language: ${clueLang}`);

      // If there's an active direction and valid coordinates, refresh clues
      if (activeDirection && coordinates.x !== "" && coordinates.y !== "") {
        const newClues = getCluesInDirectionWithMetadata(
          Number(coordinates.x),
          Number(coordinates.y),
          activeDirection
        );
        setCluesInDirection(newClues);
        setFilteredClues(newClues);
        console.log("🔍 Clues refreshed after language change:", newClues);
      }
    } catch (error) {
      console.error("Error loading clue data:", error);
      setErrorMessage("Failed to load clues data.");
      setTimeout(() => setErrorMessage(""), 4000);
    }
  }, [clueLang, activeDirection, coordinates]);

  // -----------------------------------------------------
  // 2) Setup on Mount: global key from IPC
  // -----------------------------------------------------
  useEffect(() => {
    if (window?.ipcRenderer) {
      const keyPressHandler = (_event: any, direction: "up" | "down" | "left" | "right") => {
        handleDirectionWithOCR(direction);
      };

      window.ipcRenderer.on("key-press", keyPressHandler);

      // Cleanup listener on unmount
      // return () => {
      //   window.ipcRenderer.removeListener("key-press", keyPressHandler);
      //   console.log("🔑 IPC Keypress listener removed on unmount.");
      // };
    }
  }, []); // pty dependency array ensures this runs once on mount

  // -----------------------------------------------------
  // 3) Update clues when direction or coordinates change
  // -----------------------------------------------------
  useEffect(() => {
    if (!activeDirection || coordinates.x === "" || coordinates.y === "") return;

    const newClues = getCluesInDirectionWithMetadata(
      Number(coordinates.x),
      Number(coordinates.y),
      activeDirection
    );

    setCluesInDirection(newClues);
    setFilteredClues(newClues);
    console.log("🔍 Clues updated based on direction and coordinates:", newClues);

    if (newClues.length === 0) {
      console.warn("No clues found in this direction.");
      setErrorMessage("No clues found in this direction.");
      setSelectedClueDetails(null);
      setTimeout(() => setErrorMessage(""), 4000);
    } else {
      setErrorMessage("");
    }
  }, [activeDirection, coordinates]);

  // -----------------------------------------------------
  // 4) Handle Direction with OCR (Triggered via IPC Keypresses)
  // -----------------------------------------------------
  const handleDirectionWithOCR = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      console.log("🔀 Handling direction with OCR:", direction);
      setActiveDirection(direction);

      if (!window?.ipcRenderer) {
        console.error("ipcRenderer not available.");
        setErrorMessage("OCR functionality unavailable.");
        setTimeout(() => setErrorMessage(""), 4000);
        return;
      }

      setCoordinates((prevCoords) => {
        console.log("🔍 Coordinates Before OCR:", prevCoords);

        const currentX = Number(prevCoords.x);
        const currentY = Number(prevCoords.y);

        if (isNaN(currentX) || isNaN(currentY)) {
          console.error("Invalid coordinates:", prevCoords);
          setErrorMessage("Invalid coordinates.");
          setTimeout(() => setErrorMessage(""), 4000);
          return prevCoords; // Keep the coordinates unchanged
        }

        const cluesInDir = getCluesInDirectionWithMetadata(currentX, currentY, direction);
        console.log("🔍 Clues in Direction (cluesInDir):", cluesInDir);

        setCluesInDirection(cluesInDir);
        setFilteredClues(cluesInDir);

        if (cluesInDir.length === 0) {
          console.warn("No clues found in this direction.");
          setErrorMessage("No clues found in this direction.");
          setSelectedClueDetails(null);
          setTimeout(() => setErrorMessage(""), 4000);
        } else {
          setErrorMessage("");
        }

        // Perform OCR based on the latest ocrLang from ref
        window.ipcRenderer
          .invoke("read-dofus-ocr", {
            crop: { left: 0, top: 80, width: 300, height: 450 },
            lang: ocrLangRef.current, // Use ref to ensure latest value
          })
          .then((ocrString: string) => {
            console.log("🔠 OCR Text:", ocrString);

            const { clue, error } = matchClues(ocrString, cluesInDir);

            if (clue) {
              console.log("🔍 Clue Detected:", clue);
              handleSelectClue(clue, { clearSelection: () => {} });
            } else if (error) {
              console.warn("🔍 OCR Match Error:", error);
              setErrorMessage(error);
              setSelectedClueDetails(null);
              setTimeout(() => setErrorMessage(""), 4000);
            }
          });
        // .catch((err: any) => {
        //   console.error("OCR Error:", err);
        //   setErrorMessage("OCR Error");
        //   setSelectedClueDetails(null);
        //   setTimeout(() => setErrorMessage(""), 4000);
        // });

        return prevCoords; // Keep the coordinates unchanged
      });
    },
    [matchClues]
  );

  // -----------------------------------------------------
  // 5) Handle Direction Manually (Triggered via Arrow Button Clicks)
  // -----------------------------------------------------
  const handleDirectionManual = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      console.log("🔀 Handling direction manually:", direction);
      setActiveDirection(direction);

      if (!coordinates.x || !coordinates.y) {
        console.error("Coordinates are required for manual input.");
        setErrorMessage("Set coordinates before selecting a direction.");
        setTimeout(() => setErrorMessage(""), 4000);
        return;
      }

      const newClues = getCluesInDirectionWithMetadata(
        Number(coordinates.x),
        Number(coordinates.y),
        direction
      );

      setCluesInDirection(newClues);
      setFilteredClues(newClues);
      console.log("🔍 Clues updated based on manual direction:", newClues);

      if (newClues.length === 0) {
        console.warn("No clues found in this direction.");
        setErrorMessage("No clues found in this direction.");
        setSelectedClueDetails(null);
        setTimeout(() => setErrorMessage(""), 4000);
      } else {
        setErrorMessage("");
      }

      // Focus the input field for manual entry
      inputRef.current?.focus();
    },
    [coordinates]
  );

  // -----------------------------------------------------
  // 6) Handle Coordinate Change
  // -----------------------------------------------------
  const handleCoordinateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, axis: "x" | "y") => {
      const value = e.target.value;
      if (
        value === "" ||
        !isNaN(Number(value)) ||
        (value[0] === "-" && !isNaN(Number(value.slice(1))))
      ) {
        setCoordinates((prev) => ({ ...prev, [axis]: value }));
        console.log(`📝 Updated Coordinates: (${axis}: ${value})`);
      }
    },
    []
  );

  // -----------------------------------------------------
  // 7) Handle Input Value Change for Downshift
  // -----------------------------------------------------
  const handleInputValueChange = useCallback(
    (inputValue?: string) => {
      if (!inputValue || !inputValue.trim()) {
        setFilteredClues(cluesInDirection);
        console.log(`🔍 Input cleared. Resetting filtered clues.`);
        return;
      }
      const results = fuse.search(inputValue);
      setFilteredClues(results.map((r) => r.item));
      console.log(
        `🔍 Input Value Changed: "${inputValue}", Filtered Clues:`,
        results.map((r) => r.item)
      );
    },
    [cluesInDirection, fuse]
  );

  // -----------------------------------------------------
  // 8) Handle Clue Selection
  // -----------------------------------------------------
  const handleSelectClue = useCallback(
    (selectedClue: Clue, downshiftHelpers: any) => {
      if (!selectedClue) return;

      console.log("✅ Selected Clue:", selectedClue);

      const travelCommand = `/travel ${selectedClue.xPos},${selectedClue.yPos}`;
      navigator.clipboard.writeText(travelCommand);
      console.log(`📋 Copied Travel Command: ${travelCommand}`);

      const directionArrow =
        activeDirection &&
        {
          up: <FaArrowUp />,
          down: <FaArrowDown />,
          left: <FaArrowLeft />,
          right: <FaArrowRight />,
        }[activeDirection];

      setSelectedClueDetails({
        direction: directionArrow,
        distance: `${selectedClue.distance} map${selectedClue.distance > 1 ? "s" : ""}`,
        coordinates: `[${selectedClue.xPos}; ${selectedClue.yPos}]`,
        clue: selectedClue.name,
      });

      setCoordinates({
        x: selectedClue.xPos.toString(),
        y: selectedClue.yPos.toString(),
      });
      console.log(`📍 Coordinates updated to: (${selectedClue.xPos}, ${selectedClue.yPos})`);
      setActiveDirection(null);

      setTimeout(() => {
        downshiftHelpers.clearSelection();
        setSelectedClueDetails(null);
        console.log("🕒 Cleared selected clue details after timeout.");
      }, 4000);
    },
    [activeDirection]
  );

  // -----------------------------------------------------
  // 9) Parsing Functions for Buttons
  // -----------------------------------------------------
  const handleSetCurrentLocationFromOCR = useCallback(() => {
    console.log("📍 Setting Current Location from OCR");

    if (!window?.ipcRenderer) {
      console.error("ipcRenderer not available.");
      setErrorMessage("OCR functionality unavailable.");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    // Perform OCR scan
    window.ipcRenderer
      .invoke("read-dofus-ocr", {
        crop: { left: 0, top: 80, width: 300, height: 450 }, // Adjust crop as needed
        lang: ocrLangRef.current,
      })
      .then((ocrString: string) => {
        console.log("🔠 OCR Text for Current Location:", ocrString);

        // Regex to find first coordinate pair: e.g., "-34, -36"
        const currentLocRegex = /-?\d{1,2}\s*,\s*-?\d{1,2}/;
        const match = ocrString.match(currentLocRegex);

        if (match) {
          const [x, y] = match[0].split(",").map((coord) => coord.trim());
          setCoordinates({ x, y });
          console.log(`📍 Current Location set to: (${x}, ${y})`);
          setErrorMessage(""); // Clear any existing errors
        } else {
          console.warn("No current location coordinates found in OCR.");
          setErrorMessage("Current location coordinates not found.");
          setTimeout(() => setErrorMessage(""), 4000);
        }
      })
      .catch((err: any) => {
        console.error("OCR Error for Current Location:", err);
        setErrorMessage("OCR Error for Current Location.");
        setTimeout(() => setErrorMessage(""), 4000);
      });
  }, []);

  const handleSetStartingPointFromOCR = useCallback(() => {
    console.log("🏁 Setting Starting Point from OCR");

    if (!window?.ipcRenderer) {
      console.error("ipcRenderer not available.");
      setErrorMessage("OCR functionality unavailable.");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    // Perform OCR scan
    window.ipcRenderer
      .invoke("read-dofus-ocr", {
        crop: { left: 0, top: 80, width: 300, height: 450 }, // Adjust crop as needed
        lang: ocrLangRef.current,
      })
      .then((ocrString: string) => {
        console.log("🔠 OCR Text for Starting Point:", ocrString);

        // Updated Regex:
        // - Looks for a starting bracket '['
        // - Captures X and Y coordinates with 1-2 digits each, including negative signs
        // - Closing bracket is optional
        const startingPointRegex = /\[(-?\d{1,2})\s*,\s*(-?\d{1,2})/;
        const match = ocrString.match(startingPointRegex);

        if (match) {
          const x = match[1];
          let y = match[2];

          // Sanitize Y coordinate to ensure only 1-2 digits
          if (y.length > 2) {
            if (y.startsWith("-")) {
              y = y.slice(0, 3); // Keep '-' and two digits
            } else {
              y = y.slice(0, 2); // Keep two digits
            }
            console.warn("Y coordinate has more than 2 digits. Truncated to:", y);
          }

          // Update both startingCoordinates and coordinates states
          setStartingCoordinates({ x, y });
          setCoordinates({ x, y });
          console.log(`🏁 Starting Point set to: (${x}, ${y})`);
          setErrorMessage(""); // Clear any existing errors
        } else {
          console.warn("No starting point coordinates found in OCR.");
          setErrorMessage("Starting point coordinates not found.");
          setTimeout(() => setErrorMessage(""), 4000);
        }
      })
      .catch((err: any) => {
        console.error("OCR Error for Starting Point:", err);
        setErrorMessage("OCR Error for Starting Point.");
        setTimeout(() => setErrorMessage(""), 4000);
      });
  }, []);

  return (
    <div className="hunt-container" ref={containerRef}>
      {/* Language Switch */}
      <div className="language-switch">
        <button onClick={toggleLanguage} aria-label="Toggle Language">
          {LANGUAGES[language].flag}
        </button>
      </div>

      {/* Coordinates and New Buttons */}
      <div className="coordinates">
        <span className="x-container">
          <input
            placeholder="X"
            type="number"
            value={coordinates.x}
            onChange={(e) => handleCoordinateChange(e, "x")}
          />
          <button
            className="ocr-button ocr-button-current"
            onClick={handleSetCurrentLocationFromOCR}
            title="Set Current Location from OCR"
            aria-label="Set Current Location from OCR"
          >
            📍
          </button>
        </span>
        <span className="y-container ">
          <input
            placeholder="Y"
            type="number"
            value={coordinates.y}
            onChange={(e) => handleCoordinateChange(e, "y")}
          />
          <button
            className="ocr-button ocr-button-start"
            onClick={handleSetStartingPointFromOCR}
            title="Set Starting Point from OCR"
            aria-label="Set Starting Point from OCR"
          >
            🏁
          </button>
        </span>
      </div>

      {/* D-Pad */}
      <div className="dpad-container">
        <div className="dpad-row">
          <button
            className={`dpad-button ${activeDirection === "up" ? "active" : ""}`}
            onClick={() => handleDirectionManual("up")}
            aria-label="Up"
          >
            <FaArrowUp size={20} />
          </button>
        </div>
        <div className="dpad-row">
          <button
            className={`dpad-button ${activeDirection === "left" ? "active" : ""}`}
            onClick={() => handleDirectionManual("left")}
            aria-label="Left"
          >
            <FaArrowLeft size={20} />
          </button>
          <button className="dpad-center" aria-hidden="true" />
          <button
            className={`dpad-button ${activeDirection === "right" ? "active" : ""}`}
            onClick={() => handleDirectionManual("right")}
            aria-label="Right"
          >
            <FaArrowRight size={20} />
          </button>
        </div>
        <div className="dpad-row">
          <button
            className={`dpad-button ${activeDirection === "down" ? "active" : ""}`}
            onClick={() => handleDirectionManual("down")}
            aria-label="Down"
          >
            <FaArrowDown size={20} />
          </button>
        </div>
      </div>

      {/* Error or Selected Clue Details */}
      {errorMessage ? (
        <div className="no-clues-message">{errorMessage}</div>
      ) : (
        selectedClueDetails && (
          <div className="selected-clue-details">
            <span className="selected-clue-name">{selectedClueDetails.clue}</span>
            <span className="selected-destination">
              <span className="direction-icon">{selectedClueDetails.direction}</span>
              <span>{selectedClueDetails.distance}</span>
              <span className="selected-coordinates">{selectedClueDetails.coordinates}</span>
            </span>
          </div>
        )
      )}

      {/* Clue Dropdown */}
      <Downshift
        // items={filteredClues}
        itemToString={(item) => (item ? item.name : "")}
        onChange={(selection, downshiftHelpers) => handleSelectClue(selection, downshiftHelpers)}
        onInputValueChange={handleInputValueChange}
      >
        {({ getInputProps, getMenuProps, getItemProps, isOpen, highlightedIndex }) => (
          <div style={{ position: "relative" }} className="input-container">
            <input
              {...getInputProps({
                ref: inputRef,
                placeholder: "Enter a clue...",
                className: "clue-input",
              })}
            />
            {isOpen && filteredClues.length > 0 && (
              <ul {...getMenuProps()} className="clue-dropdown">
                {filteredClues.map((clue, index) => (
                  <li
                    key={`${clue.name}-${index}`}
                    {...getItemProps({
                      item: clue,
                      index,
                      style: {
                        backgroundColor: highlightedIndex === index ? "#e0e0e036" : "transparent",
                        cursor: "pointer",
                      },
                    })}
                  >
                    {clue.name} ({clue.distance} map
                    {clue.distance > 1 ? "s" : ""})
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Downshift>
    </div>
  );
};

export default Hunt;
