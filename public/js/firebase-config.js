// Firebase Configuration
// استبدل هذه القيم بالقيم من Firebase Console الخاص بك
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "nafs-competition.firebaseapp.com", 
  projectId: "nafs-competition",
  storageBucket: "nafs-competition.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

// تهيئة Firebase باستخدام CDN
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// متغيرات النظام
let currentUser = null;
let sessionId = null;

// تسجيل دخول مجهول للطالب
async function initializeStudent() {
    try {
        const userCredential = await auth.signInAnonymously();
        currentUser = userCredential.user;
        sessionId = generateSessionId();
        console.log('تم تسجيل الدخول بنجاح');
        return currentUser;
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        showMessage('error', 'حدث خطأ في الاتصال. يرجى إعادة تحميل الصفحة.');
    }
}

// إنشاء معرف جلسة فريد
function generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// حفظ نتيجة المسابقة في قاعدة البيانات
async function saveQuizResult(studentData, results) {
    try {
        const resultData = {
            studentId: currentUser.uid,
            sessionId: sessionId,
            studentName: studentData.name,
            studentGrade: studentData.grade,
            studentSection: studentData.section,
            score: results.score,
            totalQuestions: results.totalQuestions,
            percentage: Math.round((results.score / results.totalQuestions) * 100),
            timeSpent: results.totalTime,
            fastAnswers: results.fastAnswers || 0,
            skippedQuestions: results.skippedQuestions || 0,
            correctStreak: results.maxStreak || 0,
            answers: results.answers || [],
            startTime: results.startTime,
            endTime: firebase.firestore.FieldValue.serverTimestamp(),
            ipAddress: await getClientIP(),
            userAgent: navigator.userAgent,
            screenResolution: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('quiz_results').add(resultData);
        console.log('تم حفظ النتيجة بنجاح:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('خطأ في حفظ النتيجة:', error);
        // حفظ محلي في حالة فشل الاتصال
        localStorage.setItem('quiz_result_backup', JSON.stringify(resultData));
        throw error;
    }
}

// جلب IP العميل
async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('لا يمكن جلب IP:', error);
        return 'unknown';
    }
}

// مراقبة النشاط المباشر للمعلم
function monitorLiveActivity(callback) {
    const oneHourAgo = new Date(Date.now() - 3600000);
    
    return db.collection('quiz_results')
        .where('endTime', '>=', oneHourAgo)
        .orderBy('endTime', 'desc')
        .onSnapshot((querySnapshot) => {
            const activities = [];
            querySnapshot.forEach((doc) => {
                activities.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            callback(activities);
        });
}

// إحصائيات سريعة للمعلم
async function getQuickStats() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayResults = await db.collection('quiz_results')
            .where('endTime', '>=', today)
            .get();
            
        const allResults = await db.collection('quiz_results')
            .orderBy('endTime', 'desc')
            .limit(100)
            .get();
            
        let totalStudents = 0;
        let averageScore = 0;
        let todayCount = todayResults.size;
        let topScore = 0;
        
        if (!allResults.empty) {
            let scoreSum = 0;
            allResults.forEach(doc => {
                const data = doc.data();
                scoreSum += data.percentage || 0;
                if (data.percentage > topScore) {
                    topScore = data.percentage;
                }
            });
            totalStudents = allResults.size;
            averageScore = Math.round(scoreSum / totalStudents);
        }
        
        return {
            totalStudents,
            averageScore,
            todayCount,
            topScore
        };
    } catch (error) {
        console.error('خطأ في جلب الإحصائيات:', error);
        return {
            totalStudents: 0,
            averageScore: 0,
            todayCount: 0,
            topScore: 0
        };
    }
}

// تحقق من حالة Firebase
function checkFirebaseConnection() {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            resolve(false);
        }, 5000);
        
        db.doc('test/connection').get()
            .then(() => {
                clearTimeout(timeout);
                resolve(true);
            })
            .catch(() => {
                clearTimeout(timeout);
                resolve(false);
            });
    });
}

// تصدير الوظائف للاستخدام العام
window.FirebaseService = {
    initializeStudent,
    saveQuizResult,
    monitorLiveActivity,
    getQuickStats,
    checkFirebaseConnection,
    db,
    auth
};

// تهيئة Firebase عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    console.log('Firebase Service جاهز للاستخدام');
});
