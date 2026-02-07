// مصفوفة المستخدمين - هنا يتم تخزين البيانات حالياً
let users = [
    { username: "admin", password: "123", status: "active" },
    { username: "mahmood", password: "456", status: "active" }
];

// وظيفة التحقق من الدخول (Logic)
function login(inputUser, inputPass) {
    const user = users.find(u => u.username === inputUser);

    if (!user) {
        alert("المستخدم غير موجود!");
        return false;
    }

    if (user.status === "blocked") {
        alert("عذراً، هذا الحساب محظور حالياً!");
        return false;
    }

    if (user.password === inputPass) {
        return true;
    } else {
        alert("كلمة السر خاطئة!");
        return false;
    }
}
