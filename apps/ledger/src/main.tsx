import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { Eval } from './site/Eval.tsx';
import { Landing } from './site/Landing.tsx';
import './styles.css';
import './site/site.css';

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const live = new URLSearchParams(window.location.search).has('live');
const Page = live || path === '/demo' ? App : path === '/eval' ? Eval : Landing;
document.body.dataset.page = Page === App ? 'demo' : 'site';

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><Page /></StrictMode>);
