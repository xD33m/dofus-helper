import React, { useEffect, useState } from "react";
import { ipcRenderer } from "electron";
import { 
  FaArrowUp, 
  FaArrowDown, 
  FaArrowLeft, 
  FaArrowRight, 
  FaExclamationTriangle 
} from "react-icons/fa";
import { GiTreasureMap } from "react-icons/gi";
import "./notification.css";

type NotificationDetails = {
  direction: "up" | "down" | "left" | "right" | null;
  distance: string;
  coordinates: string;
  clue: string;
};

const Notification: React.FC = () => {
  const [details, setDetails] = useState<NotificationDetails | null>(null);

  useEffect(() => {
    ipcRenderer.send("notification-ready");
    const handler = (_event: any, newDetails: NotificationDetails) => {
      setDetails(newDetails);
    };
    ipcRenderer.on("update-notification", handler);
    return () => {
      ipcRenderer.removeListener("update-notification", handler);
    };
  }, []);

  if (!details) return null;

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

  const renderLeftIcon = () => {
    if (details.direction) {
      return <GiTreasureMap className="left-icon" />;
    } else {
      return <FaExclamationTriangle className="left-icon" />;
    }
  };

  return (
    <div className="notification">
      <span className="left-icon-container">{renderLeftIcon()}</span>
      <div className="notification-content">
        <span className="selected-clue-name">{details.clue}</span>
        <span className="selected-destination">
          <span className="direction-icon">{renderDirectionIcon(details.direction)}</span>
          <span>{details.distance}</span>
          <span className="selected-coordinates">{details.coordinates}</span>
        </span>
      </div>
    </div>
  );
};

export default Notification;
