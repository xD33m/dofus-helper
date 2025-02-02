import { createRoot } from 'react-dom/client';
import Overlay from "./components/cropOverlay/cropOverlay";
import "./components/cropOverlay/cropOverlay.css";


const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<Overlay />);