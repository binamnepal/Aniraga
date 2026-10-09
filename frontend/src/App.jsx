import { useEffect } from "react";
import { Outlet, Route, Routes, useLocation } from "react-router-dom";
import Footer from "./components/Footer";
import Header from "./components/Header";
import Browse from "./pages/Browse";
import Detail from "./pages/Detail";
import Home from "./pages/Home";
import { Login, Register } from "./pages/AuthPages";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Schedule from "./pages/Schedule";
import Watch from "./pages/Watch";
import { Stream } from "./api/client";

function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <div className="ambient" aria-hidden="true" />
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

export default function App() {
  useEffect(() => {
    Stream.warm();
  }, []);
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="browse" element={<Browse />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="anime/:id" element={<Detail />} />
        <Route path="watch/:id" element={<Watch />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}