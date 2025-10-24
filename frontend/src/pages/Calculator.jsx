import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAirports,
  getUpcomingFlights,
  calculateFlight,
  calculateDestination,
} from "../services/api";

function Calculator() {
  const [mode, setMode] = useState("destination");
  const [airports, setAirports] = useState([]);
  const [flights, setFlights] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState("");
  const [selectedFlight, setSelectedFlight] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const airportsRes = await getAirports();
        if (isMounted) {
          setAirports(airportsRes.data);
        }

        if (user.airport) {
          const flightsRes = await getUpcomingFlights(user.airport);
          if (isMounted) {
            setFlights(flightsRes.data);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError("Failed to load data");
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCalculate = async () => {
    setLoading(true);
    setError("");
    setResults(null);

    try {
      if (mode === "flight") {
        if (!selectedFlight) {
          setError("Please select a flight");
          setLoading(false);
          return;
        }
        const res = await calculateFlight(selectedFlight);
        setResults(res.data);
      } else {
        if (!selectedDestination) {
          setError("Please select a destination");
          setLoading(false);
          return;
        }
        const res = await calculateDestination(
          user.airport,
          selectedDestination
        );
        setResults(res.data);
      }
    } catch (err) {
      console.error("Calculation error:", err);
      setError(
        "Calculation failed: " + (err.response?.data?.error || err.message)
      );
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <div>
      <div className="nav">
        <span style={{ color: "white", fontWeight: "bold" }}>
          RouteGate Calculator
        </span>
        <div className="nav-buttons-display">
          <button
            className="nav-button"
            onClick={() => navigate("/all-flights")}
          >
            All Flights
          </button>
          <button className="nav-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="container">
        <h1>Route Feasibility Calculator</h1>

        <div
          style={{
            background: "#f8f9fa",
            padding: "15px",
            borderRadius: "4px",
            marginBottom: "20px",
          }}
        >
          <p>
            <strong>Your Home Airport:</strong> {user.airport} -{" "}
            {user.airport_name}
          </p>
          <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
            All flights depart from your home airport
          </p>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "10px",
              fontWeight: "bold",
            }}
          >
            Select Mode:
          </label>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => {
                setMode("destination");
                setResults(null);
                setSelectedFlight("");
              }}
              style={{
                flex: 1,
                background: mode === "destination" ? "#0066ff" : "#e0e0e0",
                color: mode === "destination" ? "white" : "#333",
              }}
            >
              Check by Destination
            </button>
            <button
              onClick={() => {
                setMode("flight");
                setResults(null);
                setSelectedDestination("");
              }}
              style={{
                flex: 1,
                background: mode === "flight" ? "#0066ff" : "#e0e0e0",
                color: mode === "flight" ? "white" : "#333",
              }}
            >
              Check Specific Flight
            </button>
          </div>
        </div>

        {/* Flight Mode */}
        {mode === "flight" && (
          <div>
            <label style={{ display: "block", marginBottom: "5px" }}>
              Select Flight (Next 14 Days):
            </label>
            <select
              value={selectedFlight}
              onChange={(e) => setSelectedFlight(e.target.value)}
            >
              <option value="">-- Select Flight --</option>
              {flights.map((f) => (
                <option key={f.flight_id} value={f.flight_id}>
                  {f.flight_number} - {user.airport} → {f.destination_airport} -{" "}
                  {f.departure_date} {f.departure_time}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === "destination" && (
          <div>
            <label style={{ display: "block", marginBottom: "5px" }}>
              Select Destination:
            </label>
            <select
              value={selectedDestination}
              onChange={(e) => setSelectedDestination(e.target.value)}
            >
              <option value="">-- Select Destination --</option>
              {airports
                .filter((a) => a.code !== user.airport)
                .map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} - {a.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        <button
          onClick={handleCalculate}
          disabled={loading}
          style={{ marginTop: "15px" }}
        >
          {loading ? "Calculating..." : "Calculate Feasibility"}
        </button>

        {error && <p className="error">{error}</p>}

        {results && mode === "flight" && (
          <div
            style={{
              marginTop: "30px",
              background: "#f8f9fa",
              padding: "20px",
              borderRadius: "8px",
            }}
          >
            <h2>Flight Assessment</h2>

            <div style={{ marginTop: "15px" }}>
              <p>
                <strong>Flight:</strong> {results.flight.flight_number}
              </p>
              <p>
                <strong>Route:</strong> {results.flight.origin} (
                {results.flight.origin_city}) → {results.flight.destination} (
                {results.flight.destination_name},{" "}
                {results.flight.destination_country})
              </p>
              <p>
                <strong>Departure:</strong> {results.flight.departure_date} at{" "}
                {results.flight.departure_time}
              </p>
              <p>
                <strong>Arrival:</strong> {results.flight.arrival_date} at{" "}
                {results.flight.arrival_time}
              </p>
            </div>

            <div
              style={{
                marginTop: "20px",
                padding: "25px",
                borderRadius: "8px",
                background:
                  results.recommendation === "OK"
                    ? "#d4edda"
                    : results.recommendation === "RESCHEDULE"
                    ? "#fff3cd"
                    : "#f8d7da",
                border: `4px solid ${
                  results.recommendation === "OK"
                    ? "#28a745"
                    : results.recommendation === "RESCHEDULE"
                    ? "#ff9800"
                    : "#dc3545"
                }`,
                boxShadow:
                  results.recommendation === "RESCHEDULE"
                    ? "0 4px 12px rgba(255, 152, 0, 0.3)"
                    : "none",
              }}
            >
              <h3
                style={{
                  marginBottom: "10px",
                  fontSize: "28px",
                  color:
                    results.recommendation === "OK"
                      ? "#155724"
                      : results.recommendation === "RESCHEDULE"
                      ? "#e65100"
                      : "#721c24",
                }}
              >
                {results.recommendation === "OK" && "✅ "}
                {results.recommendation === "RESCHEDULE" && "⚠️ "}
                {results.recommendation === "CANCEL" && "❌ "}
                Recommendation: {results.recommendation}
              </h3>

              {results.recommendation === "RESCHEDULE" && (
                <div
                  style={{
                    background: "#fff",
                    padding: "15px",
                    borderRadius: "6px",
                    border: "2px solid #ff9800",
                    marginTop: "15px",
                    marginBottom: "15px",
                  }}
                >
                  <h4
                    style={{
                      color: "#e65100",
                      marginBottom: "10px",
                      fontSize: "16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    ⚠️ WARNING - SEVERE WEATHER DETECTED
                  </h4>
                  <p
                    style={{
                      fontSize: "14px",
                      lineHeight: "1.6",
                      color: "#333",
                      margin: 0,
                    }}
                  >
                    <strong>Reason:</strong> {results.reason}
                  </p>
                </div>
              )}

              {results.recommendation !== "RESCHEDULE" && (
                <p
                  style={{
                    fontSize: "14px",
                    marginTop: "15px",
                    lineHeight: "1.6",
                    color:
                      results.recommendation === "OK" ? "#155724" : "#721c24",
                  }}
                >
                  <strong>Assessment:</strong> {results.reason}
                </p>
              )}
            </div>

            <div style={{ marginTop: "20px" }}>
              <h3>Weather Conditions</h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "15px",
                  marginTop: "10px",
                }}
              >
                <div
                  style={{
                    background: "white",
                    padding: "15px",
                    borderRadius: "4px",
                    border: "1px solid #ddd",
                  }}
                >
                  <h4 style={{ marginBottom: "10px" }}>
                    Departure: {results.flight.origin} -{" "}
                    {results.flight.origin_city}
                  </h4>
                  <p>🌡️ Temperature: {results.origin_weather.temp}°C</p>
                  <p>💨 Wind Speed: {results.origin_weather.wind_speed} km/h</p>
                  <p>💨 Wind Gusts: {results.origin_weather.wind_gusts} km/h</p>
                  <p>
                    🌧️ Precipitation: {results.origin_weather.precipitation} mm
                  </p>
                </div>

                <div
                  style={{
                    background: "white",
                    padding: "15px",
                    borderRadius: "4px",
                    border: "1px solid #ddd",
                  }}
                >
                  <h4 style={{ marginBottom: "10px" }}>
                    Arrival: {results.flight.destination} -{" "}
                    {results.flight.destination_city},{" "}
                    {results.flight.destination_country}
                  </h4>
                  <p>🌡️ Temperature: {results.dest_weather.temp}°C</p>
                  <p>💨 Wind Speed: {results.dest_weather.wind_speed} km/h</p>
                  <p>💨 Wind Gusts: {results.dest_weather.wind_gusts} km/h</p>
                  <p>
                    🌧️ Precipitation: {results.dest_weather.precipitation} mm
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {results && mode === "destination" && (
          <div style={{ marginTop: "30px" }}>
            <h2>
              14-Day Forecast: {user.airport} → {results.destination.code}
            </h2>
            <p style={{ color: "#666", marginBottom: "20px" }}>
              {results.destination.name}, {results.destination.city},{" "}
              {results.destination.country}
            </p>

            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Origin Weather ({user.airport})</th>
                  <th>Dest Weather ({results.destination.code})</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {results.forecast.map((day, i) => (
                  <tr
                    key={i}
                    style={{
                      background:
                        day.status === "OK"
                          ? "#d4edda"
                          : day.status === "RESCHEDULE"
                          ? "#fff3cd"
                          : "#f8d7da",
                    }}
                  >
                    <td>
                      <strong>{day.date}</strong>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: "5px 10px",
                          borderRadius: "4px",
                          fontWeight: "bold",
                          background:
                            day.status === "OK"
                              ? "#28a745"
                              : day.status === "RESCHEDULE"
                              ? "#ffc107"
                              : "#dc3545",
                          color: "white",
                        }}
                      >
                        {day.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: "12px" }}>
                        <div>Wind: {day.origin_wind} km/h</div>
                        <div>Rain: {day.origin_rain} mm</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: "12px" }}>
                        <div>Wind: {day.dest_wind} km/h</div>
                        <div>Rain: {day.dest_rain} mm</div>
                      </div>
                    </td>
                    <td style={{ fontSize: "12px" }}>{day.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Calculator;
