import { useEffect, useState } from "react";
import Cars from "./pages/Cars";
import Booking from "./pages/Booking";
import Staff from "./pages/Staff";
import CalendarPage from "./pages/Calendar";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import "./App.css";

function canAccess(role, page) {
  const permissions = {
    ADMIN: ["cars", "booking", "staff", "calendar", "admin"],
    STAFF: ["cars", "booking", "staff", "calendar"],
    USER: ["cars", "booking", "calendar"],
  };

  return permissions[role]?.includes(page);
}

export default function App() {
  const [page, setPage] = useState("cars");
  const [user, setUser] = useState(null);
    useEffect(() => {
      const savedUser = localStorage.getItem("odc_user");

      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    }, []);
  useEffect(() => {
    const saved = localStorage.getItem("odc_user");
    if (saved) {
      setUser(JSON.parse(saved));
    }
  }, []);

  function goPage(nextPage) {
    if (!canAccess(user.role, nextPage)) {
      alert("คุณไม่มีสิทธิ์เข้าเมนูนี้");
      return;
    }

    setPage(nextPage);
  }

  function logout() {
    localStorage.removeItem("odc_user");
    setUser(null);
    setPage("cars");
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>ระบบงานจองรถ</h1>
          <p>ศูนย์รับบริจาคอวัยวะ สภากาชาดไทย</p>
        </div>

        <div className="user-box">
          <div>{user.name}</div>
          <small>{user.role}</small>
          <button onClick={logout}>ออกจากระบบ</button>
        </div>
      </header>

      <nav className="nav">
        {canAccess(user.role, "cars") && (
          <button onClick={() => goPage("cars")}>หน้าจอรถ</button>
        )}

        {canAccess(user.role, "booking") && (
          <button onClick={() => goPage("booking")}>จองรถ</button>
        )}

        {canAccess(user.role, "staff") && (
          <button onClick={() => goPage("staff")}>เจ้าหน้าที่</button>
        )}

        {canAccess(user.role, "calendar") && (
          <button onClick={() => goPage("calendar")}>ปฏิทิน</button>
        )}

        {canAccess(user.role, "admin") && (
          <button onClick={() => goPage("admin")}>Admin</button>
        )}
      </nav>

      <main className="container">
        {page === "cars" && <Cars />}
        {page === "booking" && <Booking />}
        {page === "staff" && <Staff />}
        {page === "calendar" && <CalendarPage />}
        {page === "admin" && <Admin />}
      </main>
    </div>
  );
}