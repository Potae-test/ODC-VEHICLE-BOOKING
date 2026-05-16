import { useState } from "react";

const THAI_MONTHS = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"
];
const EN_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
const THAI_DAYS = ["อา","จ","อ","พ","พฤ","ศ","ส"];
const EN_DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const THAI_HOLIDAYS_2026 = {
  "2026-1-1":  { name: "วันปีใหม่", en: "New Year's Day" },
  "2026-2-13": { name: "วันมาฆบูชา", en: "Makha Bucha Day" },
  "2026-4-6":  { name: "วันจักรี", en: "Chakri Day" },
  "2026-4-13": { name: "วันสงกรานต์", en: "Songkran Festival" },
  "2026-4-14": { name: "วันสงกรานต์", en: "Songkran Festival" },
  "2026-4-15": { name: "วันสงกรานต์", en: "Songkran Festival" },
  "2026-5-1":  { name: "วันแรงงาน", en: "Labour Day" },
  "2026-5-4":  { name: "วันฉัตรมงคล", en: "Coronation Day" },
  "2026-5-11": { name: "วันวิสาขบูชา", en: "Visakha Bucha Day" },
  "2026-6-3":  { name: "วันเฉลิมพระชนมพรรษา", en: "Queen's Birthday" },
  "2026-7-28": { name: "วันเฉลิมพระชนมพรรษา", en: "King's Birthday" },
  "2026-8-12": { name: "วันแม่แห่งชาติ", en: "Mother's Day" },
  "2026-10-13":{ name: "วันคล้ายวันสวรรคต", en: "Memorial Day" },
  "2026-10-23":{ name: "วันปิยมหาราช", en: "Chulalongkorn Day" },
  "2026-12-5": { name: "วันพ่อแห่งชาติ", en: "Father's Day" },
  "2026-12-10":{ name: "วันรัฐธรรมนูญ", en: "Constitution Day" },
  "2026-12-31":{ name: "วันสิ้นปี", en: "New Year's Eve" },
};

function hkey(y, m, d) { return `${y}-${m + 1}-${d}`; }
function toThaiBE(year) { return year + 543; }

const LOTUS_SVG = (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{display:"block"}}>
    <ellipse cx="16" cy="22" rx="4" ry="7" fill="#E91E8C" opacity="0.18"/>
    <ellipse cx="16" cy="20" rx="3" ry="9" fill="#E91E8C" opacity="0.28"/>
    <ellipse cx="10" cy="21" rx="3.5" ry="7" fill="#C2185B" opacity="0.22" transform="rotate(-20 10 21)"/>
    <ellipse cx="22" cy="21" rx="3.5" ry="7" fill="#C2185B" opacity="0.22" transform="rotate(20 22 21)"/>
    <ellipse cx="6" cy="22" rx="3" ry="5.5" fill="#AD1457" opacity="0.16" transform="rotate(-38 6 22)"/>
    <ellipse cx="26" cy="22" rx="3" ry="5.5" fill="#AD1457" opacity="0.16" transform="rotate(38 26 22)"/>
    <ellipse cx="16" cy="24" rx="3.5" ry="3" fill="#FFC1E3" opacity="0.6"/>
    <circle cx="16" cy="24" r="1.8" fill="#FFD54F" opacity="0.9"/>
  </svg>
);

export default function ThaiCalendar() {
  const today = new Date(2026, 4, 17);
  const [cur, setCur] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(today);
  const [lang, setLang] = useState("th");

  const y = cur.getFullYear(), m = cur.getMonth();
  const thaiYear = toThaiBE(y);
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push({ d: prevDays - firstDay + 1 + i, m: m - 1, y: y, other: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ d, m, y, other: false });
  const rem = 42 - cells.length;
  for (let d = 1; d <= rem; d++) cells.push({ d, m: m + 1, y, other: true });

  const isToday = (cell) => !cell.other && y === today.getFullYear() && m === today.getMonth() && cell.d === today.getDate();
  const isSelected = (cell) => !cell.other && cell.d === selected.getDate() && m === selected.getMonth() && y === selected.getFullYear();
  const getHoliday = (cell) => THAI_HOLIDAYS_2026[hkey(cell.other ? (cell.m < 0 ? y-1 : cell.m > 11 ? y+1 : y) : y, cell.m < 0 ? 11 : cell.m > 11 ? 0 : cell.m, cell.d)];
  const selHoliday = THAI_HOLIDAYS_2026[hkey(selected.getFullYear(), selected.getMonth(), selected.getDate())];

  const monthLabel = lang === "th"
    ? `${THAI_MONTHS[m]} ${thaiYear}`
    : `${EN_MONTHS[m]} ${y}`;

  const dayLabels = lang === "th" ? THAI_DAYS : EN_DAYS;

  const isSunday = (cell) => {
    const dm = cell.m < 0 ? 11 : cell.m > 11 ? 0 : cell.m;
    const dy = cell.m < 0 ? y - 1 : cell.m > 11 ? y + 1 : y;
    return new Date(dy, dm, cell.d).getDay() === 0;
  };
  const isSaturday = (cell) => {
    const dm = cell.m < 0 ? 11 : cell.m > 11 ? 0 : cell.m;
    const dy = cell.m < 0 ? y - 1 : cell.m > 11 ? y + 1 : y;
    return new Date(dy, dm, cell.d).getDay() === 6;
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a0a00 0%, #3d1a00 40%, #5c2800 70%, #2a1000 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600&family=Cinzel:wght@400;600&display=swap" rel="stylesheet"/>

      {/* Gold pattern bg */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `radial-gradient(circle at 20% 20%, rgba(212,175,55,0.06) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(212,175,55,0.06) 0%, transparent 50%)`,
      }}/>

      <div style={{
        position: "relative", zIndex: 1,
        width: "100%", maxWidth: 480,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(212,175,55,0.25)",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 0 60px rgba(212,175,55,0.12), 0 24px 80px rgba(0,0,0,0.7)",
        backdropFilter: "blur(12px)",
      }}>

        {/* Top decorative band */}
        <div style={{
          background: "linear-gradient(90deg, #8B6914, #D4AF37, #F5D56E, #D4AF37, #8B6914)",
          height: 4,
        }}/>

        {/* Header */}
        <div style={{
          padding: "1.5rem 1.5rem 1rem",
          background: "linear-gradient(180deg, rgba(212,175,55,0.12) 0%, transparent 100%)",
          borderBottom: "1px solid rgba(212,175,55,0.15)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {LOTUS_SVG}
              <span style={{
                fontFamily: "'Cinzel', serif",
                color: "#D4AF37",
                fontSize: 13,
                letterSpacing: 2,
                textTransform: "uppercase",
                opacity: 0.85,
              }}>Thai Calendar</span>
            </div>
            {/* Lang toggle */}
            <div style={{
              display: "flex", background: "rgba(0,0,0,0.3)",
              borderRadius: 8, border: "1px solid rgba(212,175,55,0.2)", overflow: "hidden",
            }}>
              {["th","en"].map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  padding: "4px 12px", fontSize: 12, fontFamily: "inherit",
                  background: lang === l ? "rgba(212,175,55,0.2)" : "transparent",
                  color: lang === l ? "#D4AF37" : "rgba(255,255,255,0.4)",
                  border: "none", cursor: "pointer", transition: "all 0.2s",
                  fontWeight: lang === l ? 600 : 400,
                }}>
                  {l === "th" ? "ไทย" : "EN"}
                </button>
              ))}
            </div>
          </div>

          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={() => setCur(new Date(y, m - 1, 1))} style={{
              background: "none", border: "1px solid rgba(212,175,55,0.25)",
              borderRadius: 8, width: 36, height: 36, cursor: "pointer",
              color: "#D4AF37", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}>‹</button>

            <div style={{ textAlign: "center" }}>
              <div style={{
                color: "#F5D56E", fontSize: 22, fontWeight: 600, letterSpacing: 0.5,
              }}>{monthLabel}</div>
              {lang === "en" && (
                <div style={{ color: "rgba(212,175,55,0.6)", fontSize: 12, marginTop: 2 }}>
                  พ.ศ. {thaiYear}
                </div>
              )}
            </div>

            <button onClick={() => setCur(new Date(y, m + 1, 1))} style={{
              background: "none", border: "1px solid rgba(212,175,55,0.25)",
              borderRadius: 8, width: 36, height: 36, cursor: "pointer",
              color: "#D4AF37", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}>›</button>
          </div>
        </div>

        {/* Calendar grid */}
        <div style={{ padding: "1rem 1.25rem 1.25rem" }}>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
            {dayLabels.map((d, i) => (
              <div key={d} style={{
                textAlign: "center", fontSize: 12, fontWeight: 500, padding: "4px 0",
                color: i === 0 ? "#E91E8C" : i === 6 ? "#4FC3F7" : "rgba(212,175,55,0.6)",
              }}>{d}</div>
            ))}
          </div>

          {/* Cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
            {cells.map((cell, idx) => {
              const holiday = getHoliday(cell);
              const sel = isSelected(cell);
              const tod = isToday(cell);
              const sun = isSunday(cell);
              const sat = isSaturday(cell);

              return (
                <div key={idx}
                  onClick={() => {
                    if (!cell.other) {
                      setSelected(new Date(y, m, cell.d));
                    }
                  }}
                  style={{
                    aspectRatio: "1",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    borderRadius: 10,
                    cursor: cell.other ? "default" : "pointer",
                    position: "relative",
                    background: sel
                      ? "linear-gradient(135deg, #D4AF37, #8B6914)"
                      : tod
                      ? "rgba(212,175,55,0.15)"
                      : "transparent",
                    border: sel
                      ? "1px solid #D4AF37"
                      : tod
                      ? "1px solid rgba(212,175,55,0.4)"
                      : "1px solid transparent",
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{
                    fontSize: 14,
                    fontWeight: sel || tod ? 600 : 400,
                    color: sel
                      ? "#1a0a00"
                      : cell.other
                      ? "rgba(255,255,255,0.15)"
                      : holiday
                      ? "#FF80AB"
                      : sun
                      ? "#F48FB1"
                      : sat
                      ? "#81D4FA"
                      : "rgba(255,255,255,0.85)",
                    lineHeight: 1,
                  }}>{cell.d}</span>
                  {holiday && !cell.other && (
                    <div style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: sel ? "#1a0a00" : "#E91E8C",
                      marginTop: 3,
                    }}/>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected day info */}
        <div style={{
          margin: "0 1.25rem 1.25rem",
          padding: "1rem",
          background: "rgba(0,0,0,0.25)",
          borderRadius: 12,
          border: "1px solid rgba(212,175,55,0.15)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ color: "#D4AF37", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                {lang === "th"
                  ? `${selected.getDate()} ${THAI_MONTHS[selected.getMonth()]} ${toThaiBE(selected.getFullYear())}`
                  : `${selected.getDate()} ${EN_MONTHS[selected.getMonth()]} ${selected.getFullYear()}`
                }
              </div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
                {lang === "th"
                  ? `ค.ศ. ${selected.getFullYear()}`
                  : `พ.ศ. ${toThaiBE(selected.getFullYear())}`
                }
              </div>
            </div>
            <button onClick={() => { setSelected(today); setCur(new Date(today.getFullYear(), today.getMonth(), 1)); }} style={{
              background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)",
              borderRadius: 6, padding: "4px 10px", color: "#D4AF37",
              fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            }}>
              {lang === "th" ? "วันนี้" : "Today"}
            </button>
          </div>

          {selHoliday ? (
            <div style={{
              marginTop: 10,
              padding: "8px 12px",
              background: "rgba(233,30,140,0.1)",
              border: "1px solid rgba(233,30,140,0.25)",
              borderRadius: 8,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>🌸</span>
              <div>
                <div style={{ color: "#FF80AB", fontSize: 13, fontWeight: 500 }}>
                  {lang === "th" ? selHoliday.name : selHoliday.en}
                </div>
                {lang === "th" && <div style={{ color: "rgba(255,128,171,0.6)", fontSize: 11 }}>{selHoliday.en}</div>}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 10, color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
              {lang === "th" ? "ไม่มีวันหยุดราชการ" : "No public holiday"}
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{
          display: "flex", gap: 16, padding: "0.75rem 1.25rem 1.25rem",
          borderTop: "1px solid rgba(212,175,55,0.1)",
        }}>
          {[
            { color: "#F48FB1", label: lang === "th" ? "วันอาทิตย์" : "Sunday" },
            { color: "#81D4FA", label: lang === "th" ? "วันเสาร์" : "Saturday" },
            { color: "#FF80AB", label: lang === "th" ? "วันหยุด" : "Holiday" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }}/>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* Bottom gold band */}
        <div style={{
          background: "linear-gradient(90deg, #8B6914, #D4AF37, #F5D56E, #D4AF37, #8B6914)",
          height: 3,
        }}/>
      </div>
    </div>
  );
}
