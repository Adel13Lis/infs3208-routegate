import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, signup, getAirports } from '../services/api';

function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [homeAirport, setHomeAirport] = useState('');
  const [airports, setAirports] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (isSignup) {
      loadAirports();
    }
  }, [isSignup]);

  const loadAirports = async () => {
    try {
      const res = await getAirports();
      setAirports(res.data);
      setError(''); // Clear any previous errors
    } catch (err) {
      console.error('Failed to load airports:', err);
      setError('Failed to load airports. Please try again or refresh the page.');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await login(email, password);
      if (res.data.success) {
        localStorage.setItem('user', JSON.stringify(res.data.user));
        navigate('/calculator');
      }
    } catch (err) {
      setError('Invalid email or password');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!firstName || !lastName || !email || !password || !homeAirport) {
      setError('All fields are required');
      return;
    }
    
    try {
      const res = await signup(email, password, firstName, lastName, homeAirport);
      if (res.data.success) {
        localStorage.setItem('user', JSON.stringify(res.data.user));
        navigate('/calculator');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
    }
  };

  const resetForm = () => {
    setIsSignup(!isSignup);
    setError('');
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setHomeAirport('');
  };

  return (
    <div className="container" style={{ maxWidth: '400px', marginTop: '100px' }}>
      <h1>RouteGate</h1>
      
      {!isSignup ? (
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="error">{error}</p>}
          <button type="submit">Login</button>
        </form>
      ) : (
        <form onSubmit={handleSignup}>
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <select 
            value={homeAirport} 
            onChange={(e) => setHomeAirport(e.target.value)}
            required
          >
            <option value="">Select Home Airport</option>
            {airports.map(a => (
              <option key={a.code} value={a.code}>
                {a.code} - {a.name}
              </option>
            ))}
          </select>
          {error && <p className="error">{error}</p>}
          <button type="submit">Sign Up</button>
        </form>
      )}
      
      <p style={{ textAlign: 'center', marginTop: '20px' }}>
        <button 
          onClick={resetForm}
          style={{ background: 'transparent', color: '#0066ff', textDecoration: 'underline', border: 'none', cursor: 'pointer' }}
        >
          {isSignup ? 'Have account? Login' : 'Need account? Sign Up'}
        </button>
      </p>
      
      {!isSignup && (
        <p style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
          Demo: demo@routegate.com / demo123
        </p>
      )}
    </div>
  );
}

export default Login;