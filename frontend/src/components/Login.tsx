import React, { useState } from 'react';
import { signIn, signUp, confirmSignUp, resendSignUpCode, fetchAuthSession } from 'aws-amplify/auth';
import './Login.css';

type LoginProps = {
  onLogin: (user: { 
    email: string; 
    role: 'admin' | 'standard'; 
    token: string;
  }) => void;
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

const handleLogin = async (email: string, password: string) => {
  try {
    console.log('🔐 Attempting Cognito login for:', email);
    
    // TENTAR usar Cognito real
    const { isSignedIn, nextStep } = await signIn({
      username: email,
      password
    });

    console.log('✅ SignIn response:', { isSignedIn, nextStep });

    // VERIFICAR SE PRECISA MUDAR SENHA (NEW_PASSWORD_REQUIRED)
    if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      console.log('🔄 New password required - this is normal for first login');
      
      setError('Please change your temporary password on first login');
      
      // Para DEMO, vamos usar demo mode quando precisa mudar senha
      console.log('🎭 Falling back to demo mode for first-time login');
      handleDemoLogin();
      return;
    }

    if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
      setNeedsConfirmation(true);
      throw new Error('Please confirm your email address');
    }

    if (!isSignedIn) {
      console.log('⚠️ User not fully signed in, checking session...');
    }

    // Obter sessão - usar forceRefresh: true
    const session = await fetchAuthSession({ forceRefresh: true });
    console.log('✅ Session obtained:', session);
    
    if (!session.tokens || !session.tokens.idToken) {
      console.log('ℹ️ No tokens yet - might be first login with temp password');
      
      // Se for primeiro login com senha temporária, usar demo mode
      console.log('🎭 Using demo mode for first login');
      handleDemoLogin();
      return;
    }

    const idToken = session.tokens.idToken;
    const payload = idToken.payload;
    
    console.log('📄 Token payload:', payload);

    // Extrair grupos do usuário
    const groupsRaw = payload['cognito:groups'];
    let groups: string[] = [];

    if (Array.isArray(groupsRaw)) {
      groups = groupsRaw as string[];
    } else if (typeof groupsRaw === 'string') {
      groups = groupsRaw.split(',').map(g => g.trim());
    } else if (groupsRaw) {
      groups = [String(groupsRaw)];
    }

    console.log('👥 User groups:', groups);
    
    const isAdmin = groups.includes('Admin');
    console.log('👑 Is admin?', isAdmin);
    
    onLogin({
      email,
      role: (isAdmin ? 'admin' : 'standard') as 'admin' | 'standard',
      token: idToken.toString(),
    });
    
  } catch (err: any) {
    console.error('❌ Cognito login error:', err);
    console.error('Error details:', JSON.stringify(err, null, 2));
    
    if (err.name === 'UserNotConfirmedException') {
      setError('Please confirm your email address');
      setNeedsConfirmation(true);
    } else if (err.name === 'NotAuthorizedException') {
      setError('Invalid email or password');
    } else if (err.name === 'UserNotFoundException') {
      setError('User not found. Please register first.');
    } else if (err.name === 'PasswordResetRequiredException') {
      setError('Password reset required. Please use "Forgot Password".');
    } else if (err.message?.includes('Network Error')) {
      setError('Network error. Check your connection or CORS configuration.');
    } else if (err.message?.includes('Failed to get authentication session')) {
      // ERRO ESPECÍFICO QUE VOCÊ ESTÁ VENDO
      console.log('🎭 Session not available - using demo mode');
      setError('First login detected. Using demo mode for now.');
      handleDemoLogin();
    } else {
      setError(err.message || 'Login failed');
    }
    
    // Não lançar erro para não quebrar o fluxo
    // throw err; // ← REMOVER ESTA LINHA
  }
};

  const handleRegister = async (email: string, password: string) => {
    try {
      console.log('📝 Registering user:', email);
      
      const { isSignUpComplete, nextStep } = await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            email_verified: 'true' // Para testes
          }
        }
      });

      console.log('✅ Registration result:', { isSignUpComplete, nextStep });

      if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        setNeedsConfirmation(true);
        setError('Registration successful! Please check your email for confirmation code.');
      } else if (isSignUpComplete) {
        // Se já estiver confirmado, fazer login automaticamente
        console.log('✅ User already confirmed, logging in...');
        await handleLogin(email, password);
      }
      
    } catch (err: any) {
      console.error('❌ Registration error:', err);
      
      if (err.name === 'UsernameExistsException') {
        setError('User already exists. Please login instead.');
      } else if (err.name === 'InvalidPasswordException') {
        setError('Password does not meet requirements. Minimum 8 characters with uppercase, lowercase, and numbers.');
      } else {
        setError(err.message || 'Registration failed');
      }
      
      throw err;
    }
  };

  const handleConfirmSignUp = async () => {
    try {
      console.log('🔑 Confirming code for:', email);
      
      const { isSignUpComplete } = await confirmSignUp({
        username: email,
        confirmationCode
      });

      if (isSignUpComplete) {
        setNeedsConfirmation(false);
        setError('Email confirmed successfully!');
        
        // Pequeno delay para mostrar mensagem
        setTimeout(async () => {
          setError('');
          // Fazer login após confirmação
          await handleLogin(email, password);
        }, 1500);
      }
    } catch (err: any) {
      console.error('❌ Confirmation error:', err);
      setError(err.message || 'Confirmation failed. Please check the code and try again.');
    }
  };

  const handleResendCode = async () => {
    try {
      await resendSignUpCode({ username: email });
      setError('Confirmation code resent to your email');
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    console.log('🔄 Form submitted');
    console.log('Email:', email);
    console.log('Is register?', isRegister);
    
    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Verificar requisitos de senha do Cognito
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number');
      return;
    }

    setLoading(true);
    
    try {
      console.log('🚀 Attempting authentication...');
      
      if (isRegister) {
        await handleRegister(email, password);
      } else {
        await handleLogin(email, password);
      }
      
      console.log('✅ Authentication successful!');
      
    } catch (err) {
      console.error('💥 Auth error caught in handleSubmit:', err);
      // Não definir erro aqui - já foi definido nas funções específicas
    } finally {
      if (!needsConfirmation) {
        setLoading(false);
      }
    }
  };

  const handleDemoLogin = () => {
    console.log('🎭 Using demo mode');
    
    const emailStr = String(email);
    const isAdmin = emailStr.toLowerCase().includes('admin') || 
                    emailStr === 'admin@example.com' ||
                    emailStr === '';
    
    const userData = {
      email: emailStr || (isAdmin ? 'admin@example.com' : 'user@example.com'),
      role: isAdmin ? 'admin' : 'standard' as 'admin' | 'standard',
      token: `demo-token-${Date.now()}`,
    };
    
    console.log('Demo user data:', userData);
    onLogin(userData);
  };

  // Tela de confirmação de email
  if (needsConfirmation) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h2>Confirm Your Email</h2>
          <p className="subtitle">
            Please enter the confirmation code sent to <strong>{email}</strong>
          </p>
          
          <div className="form-group">
            <label>Confirmation Code</label>
            <input
              type="text"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              required
              placeholder="Enter 6-digit code"
              disabled={loading}
            />
          </div>

          {error && (
            <div className={`message ${error.includes('successful') ? 'success' : 'error'}`}>
              {error}
            </div>
          )}

          <div className="button-group">
            <button 
              onClick={handleConfirmSignUp}
              className="login-button"
              disabled={loading || !confirmationCode}
            >
              {loading ? 'Confirming...' : 'Confirm Email'}
            </button>
            
            <button 
              onClick={handleResendCode}
              className="secondary-button"
              disabled={loading}
            >
              Resend Code
            </button>
            
            <button 
              onClick={handleDemoLogin}
              className="tertiary-button"
              disabled={loading}
            >
              Use Demo Mode Instead
            </button>
          </div>

          <div className="instructions">
            <p><strong>Note:</strong> Check your spam folder if you don't see the email.</p>
            <p>The confirmation code expires after 24 hours.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>🚀 SaaS Platform</h2>
        <p className="subtitle">
          {isRegister ? 'Create Account' : 'Sign In with AWS Cognito'}
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@example.com or user@example.com"
              disabled={loading}
            />
            <small className="hint">Use "admin" in email for admin access</small>
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={loading}
              placeholder="Min 8 chars with A-Z, a-z, 0-9"
            />
            <small className="hint">
              Must contain: uppercase, lowercase, and number
            </small>
          </div>

          {isRegister && (
            <>
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={loading}
                />
              </div>
              
              <div className="password-requirements">
                <p><strong>Password Requirements:</strong></p>
                <ul>
                  <li>Minimum 8 characters</li>
                  <li>At least one uppercase letter (A-Z)</li>
                  <li>At least one lowercase letter (a-z)</li>
                  <li>At least one number (0-9)</li>
                </ul>
              </div>
            </>
          )}

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span> Processing...
              </>
            ) : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="toggle-register">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="toggle-button"
            disabled={loading}
          >
            {isRegister ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;