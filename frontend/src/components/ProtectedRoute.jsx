import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  const user = localStorage.getItem("user");

  if (!user) {
    // Redirect to login route if not authenticated
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
