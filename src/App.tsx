/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import Login from "./components/Login";
import GameCanvas from "./components/GameCanvas";

export default function App() {
  const [user, setUser] = useState<{ id: string } | null>(null);

  const handleLogin = (id: string) => {
    setUser({ id });
  };

  const handleExit = () => {
    setUser(null);
  };

  return (
    <div className="w-full h-full min-h-screen bg-black">
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <GameCanvas userId={user.id} onExit={handleExit} />
      )}
    </div>
  );
}

