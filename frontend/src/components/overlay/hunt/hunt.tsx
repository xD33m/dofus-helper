import { useState, useEffect, useRef } from "react";
import "./hunt.css";
import { FaArrowUp, FaArrowDown, FaArrowLeft, FaArrowRight } from "react-icons/fa";
import Fuse from "fuse.js";
import {
  ClueNamesMap,
  CluesPosMap,
  getCluesInDirectionWithMetadata,
  loadClueData,
} from "@/db/cluesDatabase";

const Hunt = () => {
  const [activeDirection, setActiveDirection] = useState<"up" | "down" | "left" | "right" | null>(
    null
  );
  const [coordinates, setCoordinates] = useState({ x: "", y: "" });
  const [inputValue, setInputValue] = useState("");
  const [cluesInDirection, setCluesInDirection] = useState<any[]>([]); // Store clues in the selected direction
  const [filteredClues, setFilteredClues] = useState<any[]>([]); // Filtered clues based on input
  const [dropdownVisible, setDropdownVisible] = useState(false); // Track whether the dropdown is visible or not
  const [selectedClueDetails, setSelectedClueDetails] = useState<any>(null); // Details of the selected clue
  const [noCluesMessage, setNoCluesMessage] = useState(false); // Track when no clues exist in the selected direction
  const inputRef = useRef<HTMLInputElement>(null); // To keep the input field focused after arrow press
  const [isCoordinateInputFocused, setCoordinateInputFocused] = useState(false); // Track focus state for coordinate inputs
  const [selectedClueIndex, setSelectedClueIndex] = useState<number | null>(null); // Index of the selected clue

  // Fuse.js options for fuzzy searching
  const fuseOptions = {
    keys: ["name"], // We'll search by the "name" property of the clues
    threshold: 0.4, // Adjust threshold to control fuzzy matching (lower is stricter)
  };

  // Fetch clue data on component mount
  useEffect(() => {
    loadClueData("de"); // Load data for the 'de' language
  }, []);

  // Listen for key press events from the main process (if needed)
  // Update key press listener to prevent activeDirection change when input is focused
  useEffect(() => {
    if (typeof window.ipcRenderer === "undefined") {
      console.log("ipcRenderer is undefined");
      return;
    }
    console.log("ipcRenderer is defined");

    window.ipcRenderer.on("key-press", (event, direction) => {
      console.log("Received key press event", direction);

      // Prevent updating activeDirection if input is focused
      if (isCoordinateInputFocused || inputRef.current === document.activeElement) {
        return; // Don't update activeDirection if the input is focused
      }

      setActiveDirection(direction);

      if (inputRef.current) {
        // Use setTimeout to ensure focus happens after the event loop
        inputRef.current?.focus();
      }
    });
  }, [isCoordinateInputFocused, inputRef.current]);

  const handleClick = (direction: "up" | "down" | "left" | "right") => {
    setActiveDirection(direction);

    // Focus the input field after click
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleCoordinateChange = (e: React.ChangeEvent<HTMLInputElement>, axis: "x" | "y") => {
    const value = e.target.value;

    // Allow the input to be empty or a valid number, including negative numbers
    if (
      value === "" ||
      !isNaN(Number(value)) ||
      (value[0] === "-" && !isNaN(Number(value.slice(1))))
    ) {
      setCoordinates((prev) => ({
        ...prev,
        [axis]: value === "" ? "" : Number(value),
      }));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (value.trim() === "") {
      setFilteredClues(cluesInDirection); // Reset the filter when input is empty
      return;
    }

    const fuse = new Fuse(cluesInDirection, fuseOptions); // Initialize Fuse.js with the clues list
    const result = fuse.search(value); // Perform the search
    const filteredResults = result.map((res) => res.item); // Extract the matching items
    setFilteredClues(filteredResults); // Set the filtered clues to be displayed
  };

  const handleCoordinateInputFocus = () => {
    setCoordinateInputFocused(true);
  };

  const handleCoordinateInputBlur = () => {
    setCoordinateInputFocused(false);
  };

  // Fetch clues when direction changes
  useEffect(() => {
    if (activeDirection && coordinates) {
      const clues = getCluesInDirectionWithMetadata(coordinates.x, coordinates.y, activeDirection);
      setCluesInDirection(clues);
      setFilteredClues(clues); // Initially, set all clues as filtered

      if (clues.length === 0) {
        // If no clues, show a message
        setNoCluesMessage(true);
        setSelectedClueDetails(null);
        setTimeout(() => setNoCluesMessage(false), 3000); // Hide the message after 3 seconds
      } else {
        setDropdownVisible(true); // Show the dropdown when clues are available
        setNoCluesMessage(false);
      }
    }
  }, [activeDirection, coordinates]);

  // Handle clue selection from the dropdown
  const handleClueSelect = (clue: any) => {
    setCoordinates({ x: clue.xPos, y: clue.yPos });
    setActiveDirection(null); // Reset the direction after selecting a clue
    setDropdownVisible(false); // Close the dropdown immediately after selection

    // Copy the clue to the clipboard in the desired format
    const travelCommand = `/travel ${clue.xPos},${clue.yPos}`;
    navigator.clipboard.writeText(travelCommand).then(() => {
      console.log("Clue copied to clipboard:", travelCommand);
    });

    // Show the clue in the input field and clue details
    const directionArrow =
      activeDirection &&
      {
        up: <FaArrowUp />,
        down: <FaArrowDown />,
        left: <FaArrowLeft />,
        right: <FaArrowRight />,
      }[activeDirection];

    const distance = `${clue.distance} map${clue.distance > 1 ? "s" : ""}`;

    setInputValue(`${clue.name} (${clue.distance} map${clue.distance > 1 ? "s" : ""})`);
    setSelectedClueDetails({
      direction: directionArrow,
      distance: distance,
      coordinates: `[${clue.xPos}; ${clue.yPos}]`,
    });

    // Reset the input field and clue details after 3 seconds
    setTimeout(() => {
      setInputValue("");
      setSelectedClueDetails(null);
    }, 3000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownVisible) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedClueIndex((prev) => {
        if (prev === null || prev === filteredClues.length - 1) return 0;
        return prev + 1;
      });
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedClueIndex((prev) => {
        if (prev === null || prev === 0) return filteredClues.length - 1;
        return prev - 1;
      });
    }

    if (e.key === "Enter" && selectedClueIndex !== null) {
      e.preventDefault();
      handleClueSelect(filteredClues[selectedClueIndex]);
    }
  };

  // Highlight selected clue in dropdown
  const getClueClassName = (index: number) => (selectedClueIndex === index ? "selected" : "");

  return (
    <div className="hunt-container">
      {/* Coordinates Input */}
      <div className="coordinates">
        <input
          type="number"
          value={coordinates.x}
          onChange={(e) => handleCoordinateChange(e, "x")}
          onFocus={handleCoordinateInputFocus}
          onBlur={handleCoordinateInputBlur}
          placeholder="X"
        />
        <input
          type="number"
          value={coordinates.y}
          onChange={(e) => handleCoordinateChange(e, "y")}
          onFocus={handleCoordinateInputFocus}
          onBlur={handleCoordinateInputBlur}
          placeholder="Y"
        />
      </div>

      <div className="dpad-container">
        <div className="dpad-row">
          <button
            className={`dpad-button ${activeDirection === "up" ? "active" : ""}`}
            onClick={() => handleClick("up")}
            aria-label="Up"
          >
            <FaArrowUp size={20} />
          </button>
        </div>
        <div className="dpad-row">
          <button
            className={`dpad-button ${activeDirection === "left" ? "active" : ""}`}
            onClick={() => handleClick("left")}
            aria-label="Left"
          >
            <FaArrowLeft size={20} />
          </button>
          <button className="dpad-center" aria-hidden="true"></button>
          <button
            className={`dpad-button ${activeDirection === "right" ? "active" : ""}`}
            onClick={() => handleClick("right")}
            aria-label="Right"
          >
            <FaArrowRight size={20} />
          </button>
        </div>
        <div className="dpad-row">
          <button
            className={`dpad-button ${activeDirection === "down" ? "active" : ""}`}
            onClick={() => handleClick("down")}
            aria-label="Down"
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
            <span className="direction-icon">{selectedClueDetails.direction}</span>
            <span>{selectedClueDetails.distance}</span>
            <span>{selectedClueDetails.coordinates}</span>
          </div>
        )
      )}

      {/* Clue selection dropdown */}
      <div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Enter clue..."
          onKeyDown={handleKeyDown}
        />
        {dropdownVisible && filteredClues.length > 0 && (
          <ul className="clue-dropdown">
            {filteredClues.map((clue, index) => (
              <li
                key={clue.name}
                onClick={() => handleClueSelect(clue)}
                className={getClueClassName(index)}
              >
                {clue.name} ({clue.distance} map{clue.distance > 1 ? "s" : ""})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Hunt;
