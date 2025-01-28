import React, { useState, useEffect, useRef } from "react";
import Downshift, { DownshiftProps, GetItemPropsOptions } from "downshift";
import Fuse from "fuse.js";

import { loadClueData, getCluesInDirectionWithMetadata } from "@/db/cluesDatabase";

import "./hunt.css"; // Assume you have your custom styles here

import { FaArrowUp, FaArrowDown, FaArrowLeft, FaArrowRight } from "react-icons/fa";

const Hunt: React.FC = () => {
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

  // For resizing the Electron window automatically
  const containerRef = useRef<HTMLDivElement>(null);

  // We’ll let Downshift control open/close, so we do NOT store `dropdownVisible` in state
  const inputRef = useRef<HTMLInputElement>(null);

  // Fuse.js for fuzzy searching. Re-created if `cluesInDirection` changes
  const fuse = new Fuse(cluesInDirection, { keys: ["name"], threshold: 0.4 });

  // -----------------------------------------------------
  //  2) Setup on Mount: data load + global key from IPC + ResizeObserver
  // -----------------------------------------------------
  useEffect(() => {
    // Load your clue data
    loadClueData("fr");

    // Listen for arrow key presses from main process (if you are using them)
    if (window?.ipcRenderer) {
      window.ipcRenderer.on("key-press", (_event, direction) => {
        // direction is "up" | "down" | "left" | "right"
        setActiveDirection(direction);
        // Optionally focus the input so user can type immediately
        inputRef.current?.focus();
      });
    }
  }, []);

  // -----------------------------------------------------
  //  3) Update clues when direction or coordinates change
  // -----------------------------------------------------
  useEffect(() => {
    if (!activeDirection || coordinates.x === "" || coordinates.y === "") {
      return;
    }

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
      // Hide the "no clues" message after a few seconds
      setTimeout(() => setNoCluesMessage(false), 3000);
    } else {
      setNoCluesMessage(false);
    }
  }, [activeDirection, coordinates]);

  // -----------------------------------------------------
  //  4) Handle coordinate input changes
  // -----------------------------------------------------
  const handleCoordinateChange = (e: React.ChangeEvent<HTMLInputElement>, axis: "x" | "y") => {
    const value = e.target.value;
    // allow empty or numeric (including negative)
    if (
      value === "" ||
      !isNaN(Number(value)) ||
      (value[0] === "-" && !isNaN(Number(value.slice(1))))
    ) {
      setCoordinates((prev) => ({
        ...prev,
        [axis]: value, // keep as string but numeric-friendly
      }));
    }
  };

  // -----------------------------------------------------
  //  5) D-Pad click
  // -----------------------------------------------------
  const handleDirectionClick = (direction: "up" | "down" | "left" | "right") => {
    setActiveDirection(direction);
    inputRef.current?.focus();
  };

  // -----------------------------------------------------
  //  6) (Downshift) handle user input, do fuzzy search
  // -----------------------------------------------------
  const handleInputValueChange = (inputValue?: string) => {
    if (!inputValue || !inputValue.trim()) {
      // If empty, show all clues in that direction
      setFilteredClues(cluesInDirection);
      return;
    }
    const results = fuse.search(inputValue);
    setFilteredClues(results.map((r) => r.item));
  };

  // -----------------------------------------------------
  //  7) (Downshift) handle final selection
  // -----------------------------------------------------
  const handleSelectClue = (selectedClue, downshiftHelpers) => {
    // For safety, ensure there's a clue
    if (!selectedClue) return;

    // Copy to clipboard
    const travelCommand = `/travel ${selectedClue.xPos},${selectedClue.yPos}`;
    navigator.clipboard.writeText(travelCommand);

    // Show details
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
    });

    // Optionally set the coordinate inputs to the new clue
    setCoordinates({ x: selectedClue.xPos, y: selectedClue.yPos });

    // Reset direction
    setActiveDirection(null);

    // Hide the details after 3 seconds
    setTimeout(() => {
      // downshiftHelpers.reset({ inputValue: "" });
      downshiftHelpers.clearSelection();
      setSelectedClueDetails(null);
    }, 3000);
  };

  return (
    <div className="hunt-container" ref={containerRef}>
      {/* 1) Coordinates */}
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

      {/* 2) D-Pad */}
      <div className="dpad-container">
        <div className="dpad-row">
          <button
            className={`dpad-button ${activeDirection === "up" ? "active" : ""}`}
            onClick={() => handleDirectionClick("up")}
          >
            <FaArrowUp size={20} />
          </button>
        </div>
        <div className="dpad-row">
          <button
            className={`dpad-button ${activeDirection === "left" ? "active" : ""}`}
            onClick={() => handleDirectionClick("left")}
          >
            <FaArrowLeft size={20} />
          </button>
          <button className="dpad-center" aria-hidden="true"></button>
          <button
            className={`dpad-button ${activeDirection === "right" ? "active" : ""}`}
            onClick={() => handleDirectionClick("right")}
          >
            <FaArrowRight size={20} />
          </button>
        </div>
        <div className="dpad-row">
          <button
            className={`dpad-button ${activeDirection === "down" ? "active" : ""}`}
            onClick={() => handleDirectionClick("down")}
          >
            <FaArrowDown size={20} />
          </button>
        </div>
      </div>

      {/* 3) No clues or selected clue message */}
      {noCluesMessage ? (
        <div className="no-clues-message">No more clues in this direction</div>
      ) : (
        selectedClueDetails && (
          <div className="selected-clue-details">
            <span className="direction-icon">{selectedClueDetails.direction}</span>
            <span>{selectedClueDetails.distance}</span>
            <span className="selected-coordinates">{selectedClueDetails.coordinates}</span>
          </div>
        )
      )}

      {/* 4) Downshift for input + auto dropdown */}
      <Downshift
        // The items are your filtered clues
        items={filteredClues}
        itemToString={(item) => (item ? item.name : "")}
        // Called when user selects an item
        onChange={handleSelectClue}
        // Called whenever the input value changes
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
