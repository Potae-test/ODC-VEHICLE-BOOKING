import Swal from "sweetalert2";

export function showSuccess(message) {
  return Swal.fire({
    icon: "success",
    title: "สำเร็จ",
    text: message,
    confirmButtonText: "ตกลง",
    confirmButtonColor: "#1455c8",
  });
}

export function showError(message) {
  return Swal.fire({
    icon: "error",
    title: "เกิดข้อผิดพลาด",
    text: message,
    confirmButtonText: "ตกลง",
    confirmButtonColor: "#1455c8",
  });
}

export function showInfo(message) {
  return Swal.fire({
    icon: "info",
    title: "แจ้งเตือน",
    text: message,
    confirmButtonText: "ตกลง",
    confirmButtonColor: "#1455c8",
  });
}

export async function showConfirm(message) {
  const result = await Swal.fire({
    icon: "warning",
    title: "ยืนยันการทำรายการ",
    text: message,
    showCancelButton: true,
    confirmButtonText: "ยืนยัน",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#64748b",
  });

  return result.isConfirmed;
}

export async function showInput(title, label, placeholder = "") {
  const result = await Swal.fire({
    title,
    input: "text",
    inputLabel: label,
    inputPlaceholder: placeholder,
    showCancelButton: true,
    confirmButtonText: "ตกลง",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#1455c8",
    cancelButtonColor: "#64748b",
    inputValidator: (value) => {
      if (!value) return "กรุณากรอกข้อมูล";
    },
  });

  return result.isConfirmed ? result.value : null;
}