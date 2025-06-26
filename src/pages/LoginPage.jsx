
import "../css/login.css"
import { useState } from 'react';
import { useNavigate } from "react-router-dom";




export default function LoginPage() {


    const navigate = useNavigate();
    const [email, setEmail] = useState('mhmwdbas310@gmail.com');
    const [password, setPassword] = useState('3245324534522');
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
       navigate("/home");
    }, 1500);
  };

  return (
    <>
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>تسجيل الدخول</h1>
            <p>أدخل بياناتك للوصول إلى حسابك</p>
          </div>
          
          <div className="login-form">
            <div className="form-group">
              <label htmlFor="email">البريد الإلكتروني</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="أدخل بريدك الإلكتروني"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">كلمة المرور</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                required
              />
            </div>
            
            <div className="form-options">
              <label className="checkbox-container">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="checkmark"></span>
                تذكرني
              </label>
              <a href="#" className="forgot-password">نسيت كلمة المرور؟</a>
            </div>
            
            <button 
              type="button" 
              className="login-btn" 
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </button>
          </div>
     
        </div>
      </div>
      
    </>
  );
}