import "./header.css";
import { FaSearch } from "react-icons/fa";
import { GiTreasureMap } from "react-icons/gi";

type HeaderProps = {
  isSearch: boolean;
  setIsSearch: (isSearch: boolean) => void;
};

const Header = ({ isSearch, setIsSearch }: HeaderProps) => {
  const toggleView = () => {
    setIsSearch(!isSearch);
  };

  return (
    <div className="header">
      <div className="header-center">
        {isSearch ? (
          <FaSearch className="view-icon" size={16} />
        ) : (
          <GiTreasureMap className="view-icon" size={16} />
        )}
        <span className="header-title">DOFUS HELPER</span>
      </div>

      <div className="header-right" onClick={toggleView}>
        {isSearch ? (
          <GiTreasureMap className="toggle-icon" size={16} />
        ) : (
          <FaSearch className="toggle-icon" size={16} />
        )}
      </div>
    </div>
  );
};

export default Header;
