// notification.tsx
import React, { useEffect, useState } from "react";
import { ipcRenderer } from "electron";
import { FaArrowUp, FaArrowDown, FaArrowLeft, FaArrowRight } from "react-icons/fa";
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
  
  
  return (
    <div className="notification">
      <span className="selected-clue-name">{details.clue}</span>
      <span className="selected-destination">
        <span className="direction-icon">{renderDirectionIcon(details.direction)}</span>
        <span>{details.distance}</span>
        <span className="selected-coordinates">{details.coordinates}</span>
      </span>
    </div>
  );
};

export default Notification;
