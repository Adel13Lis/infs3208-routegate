import axios from "axios";

// In production builds, REACT_APP_API_URL is not set, so I default to '/api'
// In development, I use localhost:5000
const API = axios.create({
  baseURL:
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:5000"),
});

export const login = (email, password) =>
  API.post("/login", { email, password });

export const signup = (email, password, first_name, last_name, home_airport) =>
  API.post("/signup", { email, password, first_name, last_name, home_airport });

export const getAirports = () => API.get("/airports");

export const getUpcomingFlights = (origin) =>
  API.get("/upcoming-flights", { params: { origin } });

export const calculateFlight = (flight_id) =>
  API.post("/calculate-flight", { flight_id });

export const calculateDestination = (origin, destination) =>
  API.post("/calculate-destination", { origin, destination });

export const getAllFlights = (origin_airport) =>
  API.get("/all-flights", { params: { origin_airport } });
