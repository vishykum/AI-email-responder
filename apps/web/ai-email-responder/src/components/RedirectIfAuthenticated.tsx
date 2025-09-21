//Component to redirect a protected route (eg. login) when a user is already authenticated
import { Navigate } from "react-router-dom";
import type { JSX } from "react";
import { useGlobalContext } from "../context/GlobalContext";

export default function RedirectIfAuthenticated({ children }: {
  children: JSX.Element;
}) {
    const {isAuthenticated} = useGlobalContext();

    if (isAuthenticated) {
    // Already logged in → send them home (or dashboard)
    return <Navigate to="/" replace />;
    }
    return children;
}