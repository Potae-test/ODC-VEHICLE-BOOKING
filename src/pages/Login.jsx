import { useState } from "react";
import { login } from "../api";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();

    if (!email.trim()) {
      alert("กรุณากรอก Username");
      return;
    }

    try {
      setLoading(true);

      const user = await login(email, password);
      localStorage.setItem("odc_user", JSON.stringify(user));
      onLogin(user);
    } catch (err) {
      alert(err.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page px-3 py-4 sm:px-4 sm:py-6">
      <form className="login-card border border-sky-100 bg-white/95 shadow-sm" onSubmit={handleLogin}>
        <h1>ระบบงานจองรถ</h1>
        <p>ศูนย์รับบริจาคอวัยวะ สภากาชาดไทย</p>

        <label>ชื่อผู้ใช้งาน</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="กรอกชื่อผู้ใช้งาน"
        />
        <div>
          <label>รหัสผ่าน</label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="กรอกรหัสผ่าน"
          />
        </div>
        <button disabled={loading}>
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>

        <div className="login-help">
          <b>ทดสอบ:</b><br />
          staff pass: 1234<br />
          user pass: 1234<br />
          driver1 pass: 1234<br />
          driver2 pass: 1234<br />
          driver3 pass: 1234
        </div>
      </form>
    </div>
  );
}
