import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import { Landing } from './pages/Landing';
import { SoloGame } from './pages/SoloGame';
import { CreateChallenge } from './pages/CreateChallenge';
import { PlayChallenge } from './pages/PlayChallenge';
import { ChallengeResults } from './pages/ChallengeResults';
import { Multiplayer } from './pages/Multiplayer';

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/play', element: <SoloGame /> },
  { path: '/create', element: <CreateChallenge /> },
  { path: '/c/:id', element: <PlayChallenge /> },
  { path: '/c/:id/results', element: <ChallengeResults /> },
  { path: '/multiplayer', element: <Multiplayer /> },
  { path: '*', element: <Landing /> },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
