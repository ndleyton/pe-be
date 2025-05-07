import React from 'react';
import GoogleSignInButton from "./GoogleSignInButton";
import './App.css';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-base-200">
      <div className="w-full max-w-xs p-8 bg-base-100 rounded-xl shadow-lg flex flex-col items-center gap-6">
        <h1 className="text-2xl font-bold text-center mb-4">Sign in to Fitness Tracker</h1>
        <GoogleSignInButton />
      </div>
    </div>
  );
};

export default App;