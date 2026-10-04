import { useEffect, useState } from "react";
import { LockKeyhole, LogIn, ShieldCheck, UserRound } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Login() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const login = trpc.auth.login.useMutation({
    onSuccess: async (loggedInUser) => {
      try {
        if (loggedInUser.sessionToken) sessionStorage.setItem("alhaitari-session-token", loggedInUser.sessionToken);
      } catch {}
      utils.auth.me.setData(undefined, loggedInUser);
      toast.success("تم تسجيل الدخول بنجاح");
      navigate("/dashboard");
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!authLoading && user) navigate("/dashboard");
  }, [authLoading, navigate, user]);

  if (authLoading || user) {
    return <main className="login-page" dir="rtl"><section className="login-card login-loading"><span className="login-logo">ه</span><strong>{authLoading ? "جارٍ التحقق من الجلسة..." : "جارٍ فتح لوحة التحكم..."}</strong></section></main>;
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      toast.error("أدخل اسم المستخدم وكلمة المرور");
      return;
    }
    login.mutate({ username: username.trim().toLowerCase(), password });
  };

  return (
    <main className="login-page" dir="rtl">
      <section className="login-card">
        <div className="login-brand"><span className="login-logo">هـ</span><div><strong>الهتاري بلس</strong><small>إدارة الأسطول</small></div></div>
        <div className="login-heading"><span className="login-icon"><ShieldCheck size={22} /></span><h1>تسجيل الدخول</h1><p>أدخل بيانات حسابك للوصول إلى لوحة التحكم.</p></div>
        <form onSubmit={submit} className="login-form">
          <label className="login-field"><span>اسم المستخدم</span><div><UserRound size={17} /><input type="text" value={username} onChange={event => setUsername(event.target.value)} placeholder="username" autoComplete="username" autoFocus /></div></label>
          <label className="login-field"><span>كلمة المرور</span><div><LockKeyhole size={17} /><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="أدخل كلمة المرور" autoComplete="current-password" /></div></label>
          <button className="btn primary login-submit" type="submit" disabled={login.isPending}><LogIn size={17} />{login.isPending ? "جارٍ الدخول..." : "دخول إلى النظام"}</button>
        </form>
        <p className="login-note">إذا لم يكن لديك حساب، تواصل مع مدير النظام لإنشائه.</p>
      </section>
    </main>
  );
}
