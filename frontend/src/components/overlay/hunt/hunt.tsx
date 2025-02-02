import React, { useState, useEffect, useRef, useCallback } from "react";
import Downshift from "downshift";
import Fuse from "fuse.js";

import { loadClueData, getCluesInDirectionWithMetadata } from "@/db/cluesDatabase";
import { matchClues } from "@/lib/clues";
import { SlTarget } from "react-icons/sl";
import { IoLocationSharp } from "react-icons/io5";
import { IoPlaySkipForwardSharp } from "react-icons/io5";

import "./hunt.css";
import { FaArrowUp, FaArrowDown, FaArrowLeft, FaArrowRight } from "react-icons/fa";

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
  direction: "up" | "down" | "left" | "right" | null;
  distance: string;
  coordinates: string;
  clue: string;
} | null;

type CropZone = {
  left: number;
  top: number;
  width: number;
  height: number;
} | null;

const Hunt: React.FC = () => {
  console.log("🔍 Hunt Component");

  // -------------------------------
  // 1) General State and Refs
  // -------------------------------
  const [language, setLanguage] = useState<"fr" | "de">("fr");
  const [clueLang, setClueLang] = useState<string>(LANGUAGES.fr.clueLang);
  const [ocrLang, setOcrLang] = useState<string>(LANGUAGES.fr.ocrLang);
  const ocrLangRef = useRef<string>(ocrLang);
  useEffect(() => {
    ocrLangRef.current = ocrLang;
    console.log(`📝 OCR Language updated to: ${ocrLang}`);
  }, [ocrLang]);

  const [activeDirection, setActiveDirection] = useState<"up" | "down" | "left" | "right" | null>(
    null
  );
  const [coordinates, setCoordinates] = useState({ x: "", y: "" });
  const [startingCoordinates, setStartingCoordinates] = useState({ x: "", y: "" });
  const [cluesInDirection, setCluesInDirection] = useState<Clue[]>([]);
  const [filteredClues, setFilteredClues] = useState<Clue[]>([]);
  const [selectedClueDetails, setSelectedClueDetails] = useState<SelectedClueDetails>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [cropZone, setCropZone] = useState<CropZone>(null);
  const cropZoneRef = useRef<CropZone>(null);
  useEffect(() => {
    cropZoneRef.current = cropZone;
  }, [cropZone]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fuse = useRef<Fuse<Clue>>(
    new Fuse(cluesInDirection, {
      keys: ["name", "normalizedName"],
      threshold: 0.4,
      minMatchCharLength: 2,
    })
  ).current;

  const renderDirectionIcon = (direction: "up" | "down" | "left" | "right" | null) => {
    if (!direction) return null;
    const icons: Record<string, JSX.Element> = {
      up: <FaArrowUp />,
      down: <FaArrowDown />,
      left: <FaArrowLeft />,
      right: <FaArrowRight />,
    };
    return icons[direction];
  };

  useEffect(() => {
    if (selectedClueDetails && window?.ipcRenderer) {
      console.log("🔔 Sending notification");
      window.ipcRenderer.send("show-notification", selectedClueDetails);
    }
  }, [selectedClueDetails]);


  // Listen for the crop zone from the external overlay via IPC.
  useEffect(() => {
    if (!window?.ipcRenderer) return;
    const handler = (_event: any, crop: CropZone) => {
      console.log("Received crop zone from overlay:", crop);
      setCropZone(crop);
      cropZoneRef.current = crop;
    };
    window.ipcRenderer.on("update-crop-zone", handler);
    // return () => {
    //   window.ipcRenderer.removeListener("update-crop-zone", handler);
    // };
  }, []);

  useEffect(() => {
    fuse.setCollection(cluesInDirection);
    console.log("🔄 Fuse collection updated:", cluesInDirection);
  }, [cluesInDirection, fuse]);

  // -------------------------------
  // Language Switching and Clue Data Loading
  // -------------------------------
  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => (prev === "fr" ? "de" : "fr"));
    console.log(`🌐 Language toggled to: ${language === "fr" ? "de" : "fr"}`);
  }, [language]);

  // Update clueLang and ocrLang based on selected language
  useEffect(() => {
    setClueLang(LANGUAGES[language].clueLang);
    setOcrLang(LANGUAGES[language].ocrLang);
    // send notification 
    window?.ipcRenderer.send("show-notification", { direction: "up", distance: "1 map", coordinates: "[0; 0]", clue: "Test Clue" });
    console.log(
      `🌐 Language set to ${language}. ClueLang: ${LANGUAGES[language].clueLang}, OCRLang: ${LANGUAGES[language].ocrLang}`
    );
  }, [language]);

  // Load clue data whenever clueLang changes
  useEffect(() => {
    try {
      loadClueData(clueLang);
      console.log(`🔄 Clue data loaded for language: ${clueLang}`);
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

  useEffect(() => {
    if (window?.ipcRenderer) {
      const keyPressHandler = (_event: any, direction: "up" | "down" | "left" | "right") => {
        handleDirectionWithOCR(direction);
      };
      window.ipcRenderer.on("key-press", keyPressHandler);
      // return () => {
      //   window.ipcRenderer.removeListener("key-press", keyPressHandler);
      //   console.log("🔑 IPC Keypress listener removed on unmount.");
      // };
    }
  }, []);

  // -------------------------------
  // Update Clues on Direction or Coordinates Change
  // -------------------------------
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

  const handleStartCropSelection = useCallback(() => {
    window?.ipcRenderer.send("show-crop-overlay");
  }, []);

  const handleDirectionWithOCR = useCallback((direction: "up" | "down" | "left" | "right") => {
    console.log("🔀 Handling direction with OCR:", direction);
    setActiveDirection(direction);
    if (!window?.ipcRenderer) {
      console.error("ipcRenderer not available.");
      setErrorMessage("OCR functionality unavailable.");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }
    setCoordinates((prevCoords) => {
      const currentX = Number(prevCoords.x);
      const currentY = Number(prevCoords.y);
      if (isNaN(currentX) || isNaN(currentY)) {
        console.error("Invalid coordinates:", prevCoords);
        setErrorMessage("Invalid coordinates.");
        setTimeout(() => setErrorMessage(""), 4000);
        return prevCoords;
      }
      const cluesInDir = getCluesInDirectionWithMetadata(currentX, currentY, direction);
      setCluesInDirection(cluesInDir);
      setFilteredClues(cluesInDir);
      if (cluesInDir.length === 0) {
        setErrorMessage("No clues found in this direction.");
        setSelectedClueDetails(null);
        setTimeout(() => setErrorMessage(""), 4000);
      } else {
        setErrorMessage("");
      }
      const crop = cropZoneRef.current || { left: 0, top: 80, width: 300, height: 450 };
      window.ipcRenderer
        .invoke("read-dofus-ocr", {
          crop,
          lang: ocrLangRef.current,
        })
        .then((ocrString: string) => {
          console.log("🔠 OCR Text:", ocrString);
          const { clue, error } = matchClues(ocrString, cluesInDir);
          if (clue) {
            console.log("🔍 Clue Detected:", clue);
            handleSelectClue(clue, { clearSelection: () => {} });
          } else if (error) {
            setErrorMessage(error);
            setSelectedClueDetails(null);
            setTimeout(() => setErrorMessage(""), 4000);
          }
        });
      return prevCoords;
    });
  }, []);

  const handleDirectionManual = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      console.log("🔀 Handling direction manually:", direction);
      setActiveDirection(direction);
      if (!coordinates.x || !coordinates.y) {
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
      if (newClues.length === 0) {
        setErrorMessage("No clues found in this direction.");
        setSelectedClueDetails(null);
        setTimeout(() => setErrorMessage(""), 4000);
      } else {
        setErrorMessage("");
      }
      inputRef.current?.focus();
    },
    [coordinates]
  );

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

  const handleInputValueChange = useCallback(
    (inputValue?: string) => {
      if (!inputValue || !inputValue.trim()) {
        setFilteredClues(cluesInDirection);
        console.log("🔍 Input cleared. Resetting filtered clues.");
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

  const handleSelectClue = useCallback(
    (selectedClue: Clue, downshiftHelpers: any) => {
      if (!selectedClue) return;
      console.log("✅ Selected Clue:", selectedClue);
      const travelCommand = `/travel ${selectedClue.xPos},${selectedClue.yPos}`;
      navigator.clipboard.writeText(travelCommand);
      console.log(`📋 Copied Travel Command: ${travelCommand}`);
      const directionString = activeDirection;
      
      setSelectedClueDetails({
        direction: directionString,
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
      }, 4000);
    },
    [activeDirection]
  );

  const handleSetCurrentLocationFromOCR = useCallback(() => {
    console.log("📍 Setting Current Location from OCR");
    if (!window?.ipcRenderer) {
      setErrorMessage("OCR functionality unavailable.");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }
    const crop = cropZone || { left: 0, top: 80, width: 300, height: 450 };
    window.ipcRenderer
      .invoke("read-dofus-ocr", {
        crop,
        lang: ocrLangRef.current,
      })
      .then((ocrString: string) => {
        console.log("🔠 OCR Text for Current Location:", ocrString);
        const currentLocRegex = /-?\d{1,2}\s*,\s*-?\d{1,2}/;
        const match = ocrString.match(currentLocRegex);
        if (match) {
          const [x, y] = match[0].split(",").map((coord) => coord.trim());
          setCoordinates({ x, y });
          console.log(`📍 Current Location set to: (${x}, ${y})`);
          setErrorMessage("");
        } else {
          setErrorMessage("Current location coordinates not found.");
          setTimeout(() => setErrorMessage(""), 4000);
        }
      })
      .catch((err: any) => {
        console.error("OCR Error for Current Location:", err);
        setErrorMessage("OCR Error for Current Location.");
        setTimeout(() => setErrorMessage(""), 4000);
      });
  }, [cropZone]);

  const handleSetStartingPointFromOCR = useCallback(() => {
    console.log("🏁 Setting Starting Point from OCR");
    if (!window?.ipcRenderer) {
      setErrorMessage("OCR functionality unavailable.");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }
    const crop = cropZone || { left: 0, top: 80, width: 300, height: 450 };
    window.ipcRenderer
      .invoke("read-dofus-ocr", {
        crop,
        lang: ocrLangRef.current,
      })
      .then((ocrString: string) => {
        console.log("🔠 OCR Text for Starting Point:", ocrString);
        const startingPointRegex = /\[(-?\d{1,2})\s*,\s*(-?\d{1,2})/;
        const match = ocrString.match(startingPointRegex);
        if (match) {
          const x = match[1];
          let y = match[2];
          if (y.length > 2) {
            y = y.startsWith("-") ? y.slice(0, 3) : y.slice(0, 2);
            console.warn("Y coordinate has more than 2 digits. Truncated to:", y);
          }
          setStartingCoordinates({ x, y });
          setCoordinates({ x, y });
          console.log(`🏁 Starting Point set to: (${x}, ${y})`);
          setErrorMessage("");
        } else {
          setErrorMessage("Starting point coordinates not found.");
          setTimeout(() => setErrorMessage(""), 4000);
        }
      })
      .catch((err: any) => {
        console.error("OCR Error for Starting Point:", err);
        setErrorMessage("OCR Error for Starting Point.");
        setTimeout(() => setErrorMessage(""), 4000);
      });
  }, [cropZone]);

  return (
    <div className="hunt-container" ref={containerRef}>
      {/* Language Switch */}
      <div className="language-switch">
        <button onClick={toggleLanguage} aria-label="Toggle Language" tabIndex={-1}>
          {LANGUAGES[language].flag}
        </button>
      </div>

      {/* Coordinates and OCR Buttons */}
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
            tabIndex={-1}
          >
            <IoLocationSharp />
          </button>
        </span>
        <span className="y-container">
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
            tabIndex={-1}
          >
            <IoPlaySkipForwardSharp />
          </button>
        </span>
      </div>

      {/* D-Pad for Manual Direction */}
      <div className="dpad-container">
        <div className="dpad-row">
          <button
            className={`dpad-button ${activeDirection === "up" ? "active" : ""}`}
            onClick={() => handleDirectionManual("up")}
            aria-label="Up"
            tabIndex={-1}
          >
            <FaArrowUp size={20} />
          </button>
        </div>
        <div className="dpad-row">
          <button
            className={`dpad-button ${activeDirection === "left" ? "active" : ""}`}
            onClick={() => handleDirectionManual("left")}
            aria-label="Left"
            tabIndex={-1}
          >
            <FaArrowLeft size={20} />
          </button>
          <button className="dpad-center" aria-hidden="true" />
          <button
            className={`dpad-button ${activeDirection === "right" ? "active" : ""}`}
            onClick={() => handleDirectionManual("right")}
            aria-label="Right"
            tabIndex={-1}
          >
            <FaArrowRight size={20} />
          </button>
        </div>
        <div className="dpad-row">
          <button
            className={`dpad-button ${activeDirection === "down" ? "active" : ""}`}
            onClick={() => handleDirectionManual("down")}
            aria-label="Down"
            tabIndex={-1}
          >
            <FaArrowDown size={20} />
          </button>
        </div>
      </div>

      {/* Crop Selection Button */}
      <div className="crop-selector-container">
        <button
          className="crop-selector-button ocr-button-crop"
          onClick={handleStartCropSelection}
          title="Select OCR Crop Zone"
          aria-label="Select OCR Crop Zone"
          tabIndex={-1}
        >
          <SlTarget />
        </button>
      </div>

      {/* Error or Selected Clue Details */}
      {errorMessage ? (
        <div className="no-clues-message">{errorMessage}</div>
      ) : (
        selectedClueDetails && (
          <div className="selected-clue-details">
            <span className="selected-clue-name">{selectedClueDetails.clue}</span>
            <span className="selected-destination">
              <span className="direction-icon">{renderDirectionIcon(selectedClueDetails.direction)}</span>
              <span>{selectedClueDetails.distance}</span>
              <span className="selected-coordinates">{selectedClueDetails.coordinates}</span>
            </span>
          </div>
        )
      )}

      {/* Downshift Clue Dropdown */}
      <Downshift
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
                    {clue.name} ({clue.distance} map{clue.distance > 1 ? "s" : ""})
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
