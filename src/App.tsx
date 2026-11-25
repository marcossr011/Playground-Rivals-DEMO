import { useEffect } from 'react';
import { Link, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { OnboardingGate } from './components/Onboarding';
import Home from './screens/Home';
import Explore from './screens/Explore';
import Profile from './screens/Profile';
import GamePage from './screens/GamePage';
import OutdoorList from './screens/OutdoorList';
import OutdoorGuide from './screens/OutdoorGuide';
import OnlineLobby from './screens/OnlineLobby';
import Room from './screens/Room';
import OutdoorRoom from './screens/OutdoorRoom';
import PrivateChat from './screens/PrivateChat';
import Tournament from './screens/Tournament';
import RandomMode from './screens/RandomMode';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

function AppShell() {
  return (
    <div className="app-frame">
      <Outlet />
      <BottomNav />
    </div>
  );
}

function NotFound() {
  return (
    <div className="app-frame">
      <div className="not-found">
        <div>
          <div className="big">🫥</div>
          <h1 style={{ marginTop: 14 }}>Ese recreo no existe</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            La página que buscas se ha escapado al patio.
          </p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 18 }}>
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/explorar" element={<Explore />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/vida-real" element={<OutdoorList />} />
          <Route path="/salas" element={<OnlineLobby />} />
        </Route>
        <Route path="/juego/:id" element={<GamePage />} />
        <Route path="/vida-real/:id" element={<OutdoorGuide />} />
        <Route path="/sala/:code" element={<Room />} />
        <Route path="/calle/:code" element={<OutdoorRoom />} />
        <Route path="/mensajes/:code" element={<PrivateChat />} />
        <Route path="/torneo/:gameId?" element={<Tournament />} />
        <Route path="/aleatorio" element={<RandomMode />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <OnboardingGate />
    </>
  );
}
