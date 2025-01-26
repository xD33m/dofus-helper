import "./header.css";
import { FaSearch } from "react-icons/fa";

type HeaderProps = {
  isSearch: boolean;
  setIsSearch: (isSearch: boolean) => void;
};

const Header = ({ isSearch, setIsSearch }: HeaderProps) => {
  const handleChange = () => {
    console.log("handleChange");
    setIsSearch(!isSearch);
  };

  return (
    <div className="header">
      <FaSearch className="search-icon-header" size={12} />
      DOFUS HELPER
      <input type="checkbox" checked={isSearch} onChange={handleChange} />
    </div>
  );
};

export default Header;
