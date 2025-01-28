import { useState } from "react";
import Content from "./content/content.js";
import Header from "./header/header.js";
import "./overlay.css";
import Hunt from "./hunt/hunt.js";

const Overlay = () => {
  const [isSearch, setIsSearch] = useState(true);

  return (
    <div>
      <Header setIsSearch={setIsSearch} isSearch={isSearch} />
      {isSearch ? <Content /> : <Hunt />}
      {/* <Content /> */}
    </div>
  );
};

export default Overlay;
