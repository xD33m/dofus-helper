import { useEffect, useRef, useState } from "react";
import Content from "./content/content.js";
import Header from "./header/header.js";
import "./overlay.css";
import Hunt from "./hunt/hunt.js";

const Overlay = () => {
  const [isSearch, setIsSearch] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        window.ipcRenderer?.send("resize-window", {
          width: Math.round(width),
          height: Math.round(height),
        });
      }
    });

    if (containerRef.current) {
      ro.observe(containerRef.current);
    }
  }, []);

  return (
    <div ref={containerRef} className="overlay">
      <Header setIsSearch={setIsSearch} isSearch={isSearch} />
      {isSearch ? <Content /> : <Hunt />}
      {/* <Content /> */}
    </div>
  );
};

export default Overlay;
