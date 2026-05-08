import { useState } from "react";
import { login } from "../api";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("admin@odc.local");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();

    if (!email.trim()) {
      alert("กรุณากรอก Email");
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
    <div className="login-page">
      <form className="login-card" onSubmit={handleLogin}>
<h1>ระบบงานจองรถ</h1>
<p>ศูนย์รับบริจาคอวัยวะ สภากาชาดไทย</p>

        <label>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="กรอก Email"
        />
        <div>
          <label>Password</label>

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
          admin@odc.local<br />
          staff@odc.local<br />
          user@odc.local
        </div>
      </form>
    </div>
  );
}