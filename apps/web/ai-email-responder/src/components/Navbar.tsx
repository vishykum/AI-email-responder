import {NavLink, Link} from 'react-router-dom'
import {useState, useEffect, useRef} from "react";
import "./styles/Navbar.css"
import { useGlobalContext } from '../context/GlobalContext';
import axios from 'axios';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const {isHealthy, isAuthenticated, setIsAuthenticated} = useGlobalContext();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;   // clicked inside menu
      if (buttonRef.current?.contains(t)) return; // clicked the toggle
      setOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "nav-link",
      isActive ? "active" : "not-active",
    ].join(" ");

  const handleLogout = async (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log("Sending logout request to server...");

    try {
      const resp = await axios.get(`${import.meta.env.VITE_API_URL}/api/login/logout`, {withCredentials: true});

      console.log("Response received from server successfully");

      if (resp.status === 200) {
        console.log("Logged out sucessfully");

        setIsAuthenticated(false);
      }
    } catch(err: any) {
        if (axios.isAxiosError(err)) {
          console.error("Error authenticating user: ", err.response?.data || err.message);
        } else {
          console.error("Unexpected error: ", err);
        }
      }
  };

  return (
    <nav className={`z-50 h-full w-full bg-navbar backdrop-blur font-normal`}>
      <div className="mx-auto h-full px-4 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="text-lg text-brand-muted font-semibold">
          MyApp
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-2">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          <NavLink to="/about" className={linkClass}>About</NavLink>
          <NavLink to="/contact" className={linkClass}>Contact</NavLink>
          {isAuthenticated ? (<button className="rounded-md px-3 py-2 text-sm font-medium transition text-brand-muted hover:bg-brand-primary" onClick={handleLogout}>Logout</button>) :(<NavLink to="/login" className={linkClass}>Log In</NavLink>)}
        </div>

        {/* Mobile menu button */}
        <button
          ref={buttonRef}
          aria-label="Toggle menu"
          className={open ? 'md:hidden nav-link active' : 'md:hidden nav-link not-active'}
          onClick={() => setOpen(!open)}
        >
          Menu
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="fixed inset-0 bg-black/25 md:hidden" onClick={() => setOpen(false)}>
          <div className="relative md:hidden border-t bg-brand-secondary">
            <div className="mx-auto max-w-6xl px-4 py-2 flex flex-col">
              <NavLink to="/" end className={linkClass} onClick={() => setOpen(false)}>
                Home
              </NavLink>
              <NavLink to="/about" className={linkClass} onClick={() => setOpen(false)}>
                About
              </NavLink>
              <NavLink to="/contact" className={linkClass} onClick={() => setOpen(false)}>
                Contact
              </NavLink>
              {isAuthenticated ? (<button className="text-start nav-link not-active" onClick={handleLogout}>Logout</button>) :(<NavLink to="/login" className={linkClass}>Log In</NavLink>)}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}