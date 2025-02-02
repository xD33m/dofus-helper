import { createRoot } from 'react-dom/client';
import Notification from './components/notification/notification';
import "./index.css";

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<Notification />);

