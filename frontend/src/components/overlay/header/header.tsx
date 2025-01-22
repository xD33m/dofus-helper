import './header.css';
import { FaSearch } from "react-icons/fa";

const Header = () => {
  return (
    <div className="header">
        <FaSearch className="search-icon-header" size={12} />
        DOFUS HELPER
    </div>
  );
};

export default Header;
