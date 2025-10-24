import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAllFlights } from "../services/api";

function AllFlights() {
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get user from localStorage
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

      const loadFlights = async () => {
        try {
          const res = await getAllFlights(parsedUser.airport);
          setFlights(res.data);
        } catch (err) {
          setError("Failed to load flights");
        } finally {
          setLoading(false);
        }
      };

      loadFlights();
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "scheduled":
        return "#28a745";
      case "departed":
        return "#0066ff";
      case "arrived":
        return "#6c757d";
      case "cancelled":
        return "#dc3545";
      default:
        return "#333";
    }
  };

  return (
    <div>
      <div className="nav">
        <span style={{ color: "white", fontWeight: "bold" }}>
          RouteGate - All Flights
        </span>
        <div className="nav-buttons-display">
          <button
            className="nav-button"
            onClick={() => navigate("/calculator")}
          >
            Calculator
          </button>
          <button className="nav-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="container">
        <h1>Flights from {user?.airportName || user?.airport}</h1>

        {loading && <p>Loading flights...</p>}
        {error && <p className="error">{error}</p>}

        {!loading && !error && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: "800px" }}>
              <thead>
                <tr>
                  <th>Flight #</th>
                  <th>Route</th>
                  <th>Departure</th>
                  <th>Arrival</th>
                  <th>Aircraft</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {flights.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      style={{ textAlign: "center", padding: "20px" }}
                    >
                      No flights found
                    </td>
                  </tr>
                ) : (
                  flights.map((flight, index) => (
                    <tr key={index}>
                      <td>
                        <strong>{flight.flight_number}</strong>
                      </td>
                      <td>
                        {flight.origin_airport} → {flight.destination_airport}
                      </td>
                      <td>
                        <div>{flight.departure_date}</div>
                        <div style={{ fontSize: "12px", color: "#666" }}>
                          {flight.departure_time}
                        </div>
                      </td>
                      <td>
                        <div>{flight.arrival_date}</div>
                        <div style={{ fontSize: "12px", color: "#666" }}>
                          {flight.arrival_time}
                        </div>
                      </td>
                      <td style={{ fontSize: "12px" }}>
                        {flight.aircraft_type}
                      </td>
                      <td>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: "bold",
                            color: "white",
                            background: getStatusColor(flight.status),
                            textTransform: "uppercase",
                          }}
                        >
                          {flight.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {flights.length > 0 && (
              <p style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
                Total Flights: {flights.length}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AllFlights;
