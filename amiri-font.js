/**
 * HAYEK SPOT - FONT ENGINE
 * هذا الملف يحول خط Amiri إلى صيغة برمجية لضمان ظهور اللغة العربية في الـ PDF
 */

const AMIRI_FONT_DATA = "AAEAAAATAQA... (هنا يكون كود الخط الطويل جداً) ..."; 

// تخزين الخط في الذاكرة المحلية لضمان السرعة
(function setupFont() {
    try {
        localStorage.setItem("AMIRI_TTF_BASE64_V1", AMIRI_FONT_DATA);
        console.log("✅ تم تحميل الخط العربي بنجاح في نظام حايك سبوت");
    } catch (e) {
        console.error("❌ فشل تخزين الخط، قد تكون المساحة ممتلئة");
    }
})();