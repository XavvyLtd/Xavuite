import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('pms_token'));

  const login = async (email, password) => {
    const response = await fetch('https://api.xavvy.uk/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) throw new Error('Invalid login credentials');
    const data = await response.json();
    localStorage.setItem('pms_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const signup = async (name, email, password, department, designation) => {
    const response = await fetch('https://api.xavvy.uk/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, department, designation })
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Registration sequence aborted.');
    }
    const data = await response.json();
    localStorage.setItem('pms_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('pms_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout, backendUrl: 'https://api.xavvy.uk' }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);