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
  const [coordinates, setCoordinates] = useState({ x: 0, y: 0 });
  const [inputValue, setInputValue] = useState("");
  const [cluesInDirection, setCluesInDirection] = useState<any[]>([]); // Store clues in the selected direction
  const [filteredClues, setFilteredClues] = useState<any[]>([]); // Filtered clues based on input
  const [dropdownVisible, setDropdownVisible] = useState(false); // Track whether the dropdown is visible or not
  const inputRef = useRef<HTMLInputElement>(null); // To keep the input field focused after arrow press
  const [isCoordinateInputFocused, setCoordinateInputFocused] = useState(false); // Track focus state for coordinate inputs

  // Fuse.js options for fuzzy searching
  const fuseOptions = {
    keys: ["name"], // We'll search by the "name" property of the clues
    threshold: 0.4, // Adjust threshold to control fuzzy matching (lower is stricter)
  };

  // Fetch clue data on component mount
  useEffect(() => {
    loadClueData("en"); // Load data for the 'en' language
  }, []);

  // Listen for key press events from the main process (if needed)
  useEffect(() => {
    if (typeof window.ipcRenderer === "undefined") {
      console.log("ipcRenderer is undefined");
      return;
    }
    console.log("ipcRenderer is defined");

    window.ipcRenderer.on("key-press", (event, direction) => {
      console.log("Received key press event", direction);
      if (isCoordinateInputFocused) return; // Prevent focus change when coordinate input is focused

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
    if (value === "" || !isNaN(Number(value))) {
      setCoordinates((prev) => ({
        ...prev,
        [axis]: value === "" ? 0 : Number(value),
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
      setDropdownVisible(true); // Show the dropdown when clues are available
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

    // Show the clue in the input field for 3 seconds
    setInputValue(`${clue.name} (${clue.xPos}, ${clue.yPos})`);

    // Reset the input field to empty after 3 seconds
    setTimeout(() => {
      setInputValue("");
    }, 3000);
  };

  return (
    <div className="dpad-container">
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

      {/* D-Pad for direction */}
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

      {/* Clue selection dropdown */}
      <div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Enter text..."
        />
        {dropdownVisible && filteredClues.length > 0 && (
          <ul className="clue-dropdown">
            {filteredClues.map((clue) => (
              <li key={clue.name} onClick={() => handleClueSelect(clue)}>
                {clue.name} (Position: {clue.xPos}, {clue.yPos})
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Display current direction and coordinates */}
      <p>Active Direction: {activeDirection || "None"}</p>
      <p>
        Coordinates: X: {coordinates.x}, Y: {coordinates.y}
      </p>
    </div>
  );
};

export default Hunt;
