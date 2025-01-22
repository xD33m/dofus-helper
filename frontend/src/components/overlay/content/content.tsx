import React, { useState, useEffect } from 'react';
import { FaSearch } from 'react-icons/fa';
import { prefixSearchFrench, TranslationEntry } from '../../../db/translationDatabase.js';
import './content.css';

const Content = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<TranslationEntry[]>([]);

  useEffect(() => {
    if (!searchTerm) {
      setSearchResults([]);
      return;
    }

    prefixSearchFrench(searchTerm).then((results) => {
      setSearchResults(results);
    });
  }, [searchTerm]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const limitedResults = searchResults.slice(0, 5);

  return (
    <div className="content">
      <div className="search-container">
        <FaSearch className="search-icon" />
        <input
          className="search-input"
          type="search"
          placeholder="Search in French..."
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>
      
      <div className="result-container">
        {searchTerm && limitedResults.length === 0 && (
          <p>No matches found.</p>
        )}

        {limitedResults.map((entry) => (
          <div className="translation-item" key={entry.id}>
            <p className="german-text">{entry.de}</p>
            <p className="french-text">{entry.fr}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Content;
