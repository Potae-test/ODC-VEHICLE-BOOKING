import { useMemo, useRef, useState } from "react";
import { resetUserPassword, updateUser } from "../api";
import { showError, showSuccess } from "../utils/alert";
import { persistStoredSessionUser } from "../utils/sessionTimeout";

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("odc_user") || "null");
  } catch {
    return null;
  }
}

function getProfileFormState(user) {
  const profile = user || {};

  return {
    user_id: String(profile.user_id || "").trim(),
    role: String(profile.role || "").trim(),
    status: String(profile.status || "").trim(),
    name: String(profile.name || "").trim(),
    department: String(profile.department || "").trim(),
    phone: String(profile.phone || "").trim(),
    email: String(profile.email || "").trim(),
  };
}

function normalizeSection(value) {
  return String(value || "").trim().toLowerCase() === "password" ? "password" : "profile";
}

function buildUpdatedStoredUser(currentUser, nextProfile) {
  return {
    ...(currentUser || {}),
    ...nextProfile,
    user_id: String(nextProfile.user_id || currentUser?.user_id || "").trim(),
    role: String(nextProfile.role || currentUser?.role || "").trim(),
    status: String(nextProfile.status || currentUser?.status || "").trim(),
  };
}

export default function Profile({
  currentUser,
  onUserUpdate,
  initialSection = "profile",
}) {
  const storedUser = currentUser || readStoredUser();
  const [profileForm, setProfileForm] = useState(() => getProfileFormState(currentUser || readStoredUser()));
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [activeSection, setActiveSection] = useState(() => normalizeSection(initialSection));
  const profileSectionRef = useRef(null);
  const passwordSectionRef = useRef(null);

  const supportsEditableEmail = useMemo(() => {
    if (!storedUser) return false;
    return Object.prototype.hasOwnProperty.call(storedUser, "email");
  }, [storedUser]);

  function setProfileField(field, value) {
    setProfileForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function setPasswordField(field, value) {
    setPasswordForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSaveProfile(event) {
    event.preventDefault();

    if (!profileForm.user_id) {
      showError("ไม่พบข้อมูลผู้ใช้งาน");
      return;
    }

    if (!profileForm.name || !profileForm.department || !profileForm.phone) {
      showError("กรุณากรอกชื่อ หน่วยงาน และเบอร์โทร");
      return;
    }

    if (supportsEditableEmail && !profileForm.email) {
      showError("กรุณากรอกอชื่อผู้ใช้งานเพื่อใช้เข้าสู่ระบบ");
      return;
    }

    setSavingProfile(true);

    try {
      const payload = {
        user_id: profileForm.user_id,
        role: profileForm.role,
        status: profileForm.status,
        name: profileForm.name,
        department: profileForm.department,
        phone: profileForm.phone,
        ...(supportsEditableEmail ? { email: profileForm.email } : {}),
      };
      const updatedUser = await updateUser(payload);
      const nextStoredUser = buildUpdatedStoredUser(storedUser, {
        ...payload,
        ...(updatedUser || {}),
      });

      persistStoredSessionUser(nextStoredUser);
      setProfileForm(getProfileFormState(nextStoredUser));
      onUserUpdate?.(nextStoredUser);
      await showSuccess("บันทึกข้อมูลโปรไฟล์สำเร็จ");
    } catch (error) {
      showError(error.message || "บันทึกข้อมูลโปรไฟล์ไม่สำเร็จ");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();

    if (!profileForm.user_id) {
      showError("ไม่พบข้อมูลผู้ใช้งาน");
      return;
    }

    if (!passwordForm.password || !passwordForm.confirmPassword) {
      showError("กรุณากรอกรหัสผ่านใหม่ให้ครบ");
      return;
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      showError("รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setSavingPassword(true);

    try {
      await resetUserPassword({
        user_id: profileForm.user_id,
        password: passwordForm.password,
      });
      setPasswordForm({
        password: "",
        confirmPassword: "",
      });
      await showSuccess("เปลี่ยนรหัสผ่านสำเร็จ");
    } catch (error) {
      showError(error.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setSavingPassword(false);
    }
  }

  if (!storedUser) {
    return <div className="form-card">ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่</div>;
  }

  return (
    <div className="profile-page">
      <div className="page-header profile-page-header">
        <div>
          <h2>โปรไฟล์ของฉัน</h2>
          <p>แก้ไขข้อมูลส่วนตัวและเปลี่ยนรหัสผ่านของคุณได้จากหน้านี้</p>
        </div>
      </div>

      <div className="profile-section-switcher">
        <button
          type="button"
          className={activeSection === "profile" ? "profile-switch-button is-active" : "profile-switch-button"}
          onClick={() => {
            setActiveSection("profile");
            profileSectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
          }}
        >
          ข้อมูลโปรไฟล์
        </button>
        <button
          type="button"
          className={activeSection === "password" ? "profile-switch-button is-active" : "profile-switch-button"}
          onClick={() => {
            setActiveSection("password");
            passwordSectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
          }}
        >
          เปลี่ยนรหัสผ่าน
        </button>
      </div>

      <div className="profile-grid">
        <section ref={profileSectionRef} className="form-card profile-card">
          <div className="profile-card-head">
            <div>
              <h3>ข้อมูลส่วนตัว</h3>
              <p>อัปเดตข้อมูลบัญชีที่ใช้ในระบบ</p>
            </div>
          </div>

          <form className="profile-form-grid" onSubmit={handleSaveProfile}>
            <label>
              รหัสผู้ใช้
              <input className="profile-readonly-input" value={profileForm.user_id} readOnly />
            </label>

            <label>
              บทบาท
              <input className="profile-readonly-input" value={profileForm.role} readOnly />
            </label>

            <label>
              สถานะ
              <input className="profile-readonly-input" value={profileForm.status} readOnly />
            </label>

            <label>
              ชื่อ
              <input
                value={profileForm.name}
                onChange={(event) => setProfileField("name", event.target.value)}
                placeholder="ชื่อ - นามสกุล"
              />
            </label>

            <label>
              หน่วยงาน
              <input
                value={profileForm.department}
                onChange={(event) => setProfileField("department", event.target.value)}
                placeholder="หน่วยงาน"
              />
            </label>

            <label>
              เบอร์โทร
              <input
                value={profileForm.phone}
                onChange={(event) => setProfileField("phone", event.target.value)}
                placeholder="08x-xxx-xxxx"
              />
            </label>

            <label className="profile-form-grid-full">
              ชื่อผู้ใช้งาน
              <input
                value={profileForm.email}
                onChange={(event) => setProfileField("email", event.target.value)}
                readOnly={!supportsEditableEmail}
                placeholder="ชื่อผู้ใช้งานเพื่อใช้เข้าสู่ระบบ"
              />
            </label>

            <div className="profile-form-actions profile-form-grid-full">
              <button type="submit" disabled={savingProfile}>
                {savingProfile ? "กำลังบันทึก..." : "บันทึกข้อมูลโปรไฟล์"}
              </button>
            </div>
          </form>
        </section>

        <section ref={passwordSectionRef} className="form-card profile-card">
          <div className="profile-card-head">
            <div>
              <h3>เปลี่ยนรหัสผ่าน</h3>
              <p>ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</p>
            </div>
          </div>

          <form className="profile-form-grid" onSubmit={handleChangePassword}>
            <label className="profile-form-grid-full">
              รหัสผ่านใหม่
              <input
                type="password"
                value={passwordForm.password}
                onChange={(event) => setPasswordField("password", event.target.value)}
                placeholder="กรอกรหัสผ่านใหม่"
              />
            </label>

            <label className="profile-form-grid-full">
              ยืนยันรหัสผ่านใหม่
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordField("confirmPassword", event.target.value)}
                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
              />
            </label>

            <div className="profile-password-hint profile-form-grid-full">
              รหัสผ่านใหม่และยืนยันรหัสผ่านต้องตรงกันก่อนบันทึก
            </div>

            <div className="profile-form-actions profile-form-grid-full">
              <button type="submit" disabled={savingPassword}>
                {savingPassword ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
