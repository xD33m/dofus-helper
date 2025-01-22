import './App.css'
import Overlay from './components/overlay/overlay.js'
import { useEffect } from 'react';
import { initializeDB } from './db/translationDatabase.js';

function App() {
  useEffect(() => {
    initializeDB()
      .then(() => console.log("DB Initialized"))
      .catch(console.error);
  }, []);
  return (
    <Overlay />
  )
}

export default App