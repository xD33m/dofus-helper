import React, { useState, useEffect, useRef } from "react";
import Downshift from "downshift";
import Fuse from "fuse.js";

import { loadClueData, getCluesInDirectionWithMetadata } from "@/db/cluesDatabase";

import "./hunt.css";
import { FaArrowUp, FaArrowDown, FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { matchClues } from "@/lib/clues";

const CLUE_LANG = "fr";
const OCR_LANG = "fra";

type Clue = {
  name: string;
  distance: number;
  xPos: number;
  yPos: number;
};

const Hunt: React.FC = () => {
  console.log("🔍 Hunt Component");
  // -----------------------------------------------------
  //  1) State + Refs
  // -----------------------------------------------------
  const [activeDirection, setActiveDirection] = useState<"up" | "down" | "left" | "right" | null>(
    null
  );
  const [coordinates, setCoordinates] = useState({ x: "", y: "" });
  const [cluesInDirection, setCluesInDirection] = useState<any[]>([]);
  const [filteredClues, setFilteredClues] = useState<any[]>([]);
  const [selectedClueDetails, setSelectedClueDetails] = useState<any>(null);
  const [noCluesMessage, setNoCluesMessage] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fuse = new Fuse(cluesInDirection, {
    keys: ["name"],
    threshold: 0.4,
    minMatchCharLength: 2,
  });

  // -----------------------------------------------------
  //  2) Setup on Mount: data load + global key from IPC
  // -----------------------------------------------------
  useEffect(() => {
    loadClueData(CLUE_LANG);

    if (window?.ipcRenderer) {
      const keyPressHandler = (_event: any, direction: "up" | "down" | "left" | "right") => {
        handleDirection(direction);
      };

      window.ipcRenderer.on("key-press", keyPressHandler);
    }
  }, []);

  // -----------------------------------------------------
  //  3) Update clues when direction or coordinates change
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

    if (newClues.length === 0) {
      setNoCluesMessage(true);
      setSelectedClueDetails(null);
      setTimeout(() => setNoCluesMessage(false), 3000);
    } else {
      setNoCluesMessage(false);
    }
  }, [activeDirection, coordinates]);

  const handleDirection = async (direction: "up" | "down" | "left" | "right") => {
    console.log("🔀 Direction:", direction);
    setActiveDirection(direction);
    inputRef.current?.focus();

    if (!window?.ipcRenderer) return { clue: null };

    // Use the latest coordinates by reading them inside setState callback
    setCoordinates((prevCoords) => {
      console.log("🔍 Coordinates Before OCR:", prevCoords);

      // Now, we ensure we're using the latest coordinates
      const cluesInDir = getCluesInDirectionWithMetadata(
        Number(prevCoords.x),
        Number(prevCoords.y),
        direction
      );

      console.log("🔍 Clues in Direction (cluesInDir):", cluesInDir);

      // Perform OCR based on the latest coordinates
      window.ipcRenderer
        .invoke("read-dofus-ocr", {
          crop: { left: 0, top: 190, width: 300, height: 350 },
          lang: OCR_LANG,
        })
        .then((ocrString) => {
          console.log("🔠 OCR Text:", ocrString);

          const clue = matchClues(ocrString, cluesInDir);

          if (clue) {
            console.log("🔍 Clue Detected:", clue);
            handleSelectClue(clue, { clearSelection: () => {} });
          }
        });

      return prevCoords; // Keep the coordinates unchanged
    });
  };

  const handleCoordinateChange = (e: React.ChangeEvent<HTMLInputElement>, axis: "x" | "y") => {
    const value = e.target.value;
    if (
      value === "" ||
      !isNaN(Number(value)) ||
      (value[0] === "-" && !isNaN(Number(value.slice(1))))
    ) {
      setCoordinates((prev) => ({ ...prev, [axis]: value }));
    }
  };

  const handleInputValueChange = (inputValue?: string) => {
    if (!inputValue || !inputValue.trim()) {
      setFilteredClues(cluesInDirection);
      return;
    }
    const results = fuse.search(inputValue);
    setFilteredClues(results.map((r) => r.item));
  };

  const handleSelectClue = (selectedClue: Clue, downshiftHelpers: any) => {
    if (!selectedClue) return;

    const travelCommand = `/travel ${selectedClue.xPos},${selectedClue.yPos}`;
    navigator.clipboard.writeText(travelCommand);

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

    console.log("🎯 Selected Clue:", selectedClue);
    setCoordinates({ x: selectedClue.xPos.toString(), y: selectedClue.yPos.toString() });
    setActiveDirection(null);

    setTimeout(() => {
      downshiftHelpers.clearSelection();
      setSelectedClueDetails(null);
    }, 3000);
  };

  return (
    <div className="hunt-container" ref={containerRef}>
      {/* Coordinates */}
      <div className="coordinates">
        <input
          placeholder="X"
          type="number"
          value={coordinates.x}
          onChange={(e) => handleCoordinateChange(e, "x")}
        />
        <input
          placeholder="Y"
          type="number"
          value={coordinates.y}
          onChange={(e) => handleCoordinateChange(e, "y")}
        />
      </div>

      {/* D-Pad */}
      <div className="dpad-container">
        <div className="dpad-row">
          <button
            className={`dpad-button ${activeDirection === "up" ? "active" : ""}`}
            onClick={() => handleDirection("up")}
          >
            <FaArrowUp size={20} />
          </button>
        </div>
        <div className="dpad-row">
          <button
            className={`dpad-button ${activeDirection === "left" ? "active" : ""}`}
            onClick={() => handleDirection("left")}
          >
            <FaArrowLeft size={20} />
          </button>
          <button className="dpad-center" aria-hidden="true" />
          <button
            className={`dpad-button ${activeDirection === "right" ? "active" : ""}`}
            onClick={() => handleDirection("right")}
          >
            <FaArrowRight size={20} />
          </button>
        </div>
        <div className="dpad-row">
          <button
            className={`dpad-button ${activeDirection === "down" ? "active" : ""}`}
            onClick={() => handleDirection("down")}
          >
            <FaArrowDown size={20} />
          </button>
        </div>
      </div>

      {noCluesMessage ? (
        <div className="no-clues-message">No more clues in this direction</div>
      ) : (
        selectedClueDetails && (
          <div className="selected-clue-details">
            <span>{selectedClueDetails.clue}</span>
            <span className="direction-icon">{selectedClueDetails.direction}</span>
            <span>{selectedClueDetails.distance}</span>
            <span className="selected-coordinates">{selectedClueDetails.coordinates}</span>
          </div>
        )
      )}

      <Downshift
        items={filteredClues}
        itemToString={(item) => (item ? item.name : "")}
        onChange={handleSelectClue}
        onInputValueChange={handleInputValueChange}
      >
        {({ getInputProps, getMenuProps, getItemProps, isOpen, highlightedIndex }) => (
          <div style={{ position: "relative" }} className="input-container">
            <input
              {...getInputProps({
                ref: inputRef,
                placeholder: "Enter clue...",
                className: "clue-input",
              })}
            />
            {isOpen && filteredClues.length > 0 && (
              <ul {...getMenuProps()} className="clue-dropdown">
                {filteredClues.map((clue, index) => (
                  <li
                    key={clue.name}
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
